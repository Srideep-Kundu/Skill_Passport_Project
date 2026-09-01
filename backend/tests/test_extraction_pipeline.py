import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import ClassVar, Self
from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models import (
    AuditLog,
    Evidence,
    EvidenceType,
    ExtractionJob,
    ExtractionJobStatus,
    ExtractionStatus,
    Skill,
    Student,
    StudentSkill,
)
from app.services import extraction_service
from app.workers import extraction_worker


def settings(**overrides: object) -> SimpleNamespace:
    values: dict[str, object] = {
        "extraction_provider": "local",
        "extraction_fallback_providers": [],
        "extraction_model": "gemini-3.6-flash",
        "gemini_api_key": None,
        "groq_api_key": None,
        "groq_extraction_model": "openai/gpt-oss-20b",
        "extraction_max_attempts": 2,
        "extraction_retry_base_seconds": 1,
        "extraction_retry_max_seconds": 2,
        "extraction_claim_timeout_seconds": 30,
        "redis_url": None,
        "extraction_sync_fallback": False,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest_asyncio.fixture
async def session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    await engine.dispose()


async def evidence_with_job(session: AsyncSession) -> tuple[Evidence, Skill]:
    student = Student(email="pipeline@example.test", password_hash="hash", full_name="Pipeline Student")
    skill = Skill(canonical_name="Python", category="Language", aliases=["python3"])
    session.add_all([student, skill])
    await session.flush()
    evidence = Evidence(student_id=student.id, evidence_type=EvidenceType.project, title="API", description="Built a Python API.")
    session.add(evidence)
    await session.flush()
    await extraction_service.create_extraction_job(session, evidence)
    await session.commit()
    return evidence, skill


@pytest.mark.asyncio
async def test_successful_extraction_is_idempotent_and_records_provider(monkeypatch: pytest.MonkeyPatch, session_factory: async_sessionmaker[AsyncSession]) -> None:
    monkeypatch.setattr(extraction_service, "get_settings", lambda: settings())
    async with session_factory() as session:
        evidence, _ = await evidence_with_job(session)
        assert await extraction_service.extract_evidence(session, evidence.id) == "completed"
        assert await extraction_service.extract_evidence(session, evidence.id) == "ignored"
        job = (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))).one()
        skills = (await session.scalars(select(StudentSkill).where(StudentSkill.source_evidence_id == evidence.id))).all()

    assert job.status is ExtractionJobStatus.completed
    assert job.provider == "local_fallback"
    assert len(skills) == 1


@pytest.mark.asyncio
async def test_duplicate_provider_skills_persist_once(monkeypatch: pytest.MonkeyPatch, session_factory: async_sessionmaker[AsyncSession]) -> None:
    monkeypatch.setattr(extraction_service, "get_settings", lambda: settings())

    async def duplicate_extract(*_args: object) -> extraction_service.ExtractionPayload:
        return extraction_service.ExtractionPayload.model_validate({"skills": [{"skill": "Python", "confidence": 0.8, "evidence_span": "Python"}, {"skill": "Python", "confidence": 0.9, "evidence_span": "Python"}]})

    monkeypatch.setattr(extraction_service.LocalExtractor, "extract", duplicate_extract)
    async with session_factory() as session:
        evidence, _ = await evidence_with_job(session)
        await extraction_service.extract_evidence(session, evidence.id)
        skills = (await session.scalars(select(StudentSkill).where(StudentSkill.source_evidence_id == evidence.id))).all()

    assert len(skills) == 1


@pytest.mark.asyncio
async def test_invalid_evidence_span_is_non_retryable_failure(monkeypatch: pytest.MonkeyPatch, session_factory: async_sessionmaker[AsyncSession]) -> None:
    monkeypatch.setattr(extraction_service, "get_settings", lambda: settings())

    async def invalid_span_extract(*_args: object) -> extraction_service.ExtractionPayload:
        return extraction_service.ExtractionPayload.model_validate({"skills": [{"skill": "Python", "confidence": 0.8, "evidence_span": "Java"}]})

    monkeypatch.setattr(extraction_service.LocalExtractor, "extract", invalid_span_extract)
    async with session_factory() as session:
        evidence, _ = await evidence_with_job(session)
        await extraction_service.extract_evidence(session, evidence.id)
        job = (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))).one()

    assert job.status is ExtractionJobStatus.failed
    assert job.last_error == "extraction_validation_failed"


@pytest.mark.asyncio
async def test_transient_timeout_retries_then_dead_letters(monkeypatch: pytest.MonkeyPatch, session_factory: async_sessionmaker[AsyncSession]) -> None:
    monkeypatch.setattr(extraction_service, "get_settings", lambda: settings())

    async def timeout_extract(*_args: object) -> extraction_service.ExtractionPayload:
        raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(extraction_service.LocalExtractor, "extract", timeout_extract)
    async with session_factory() as session:
        evidence, _ = await evidence_with_job(session)
        await extraction_service.extract_evidence(session, evidence.id)
        job = (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))).one()
        assert job.status is ExtractionJobStatus.retry_scheduled
        job.next_retry_at = datetime.now(UTC) - timedelta(seconds=1)
        await session.commit()
        await extraction_service.extract_evidence(session, evidence.id)
        await session.refresh(job)

    assert job.status is ExtractionJobStatus.dead_lettered
    assert job.attempt_count == 2


@pytest.mark.asyncio
async def test_terminal_batch_requeue_preserves_completed_job_and_prevents_duplicates(
    monkeypatch: pytest.MonkeyPatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    queued_ids: list[UUID] = []

    async def record_enqueue(_session: AsyncSession, evidence_id: UUID) -> bool:
        queued_ids.append(evidence_id)
        return True

    monkeypatch.setattr(extraction_service, "enqueue_extraction", record_enqueue)
    async with session_factory() as session:
        completed_evidence, _ = await evidence_with_job(session)
        completed_job = (
            await session.scalars(
                select(ExtractionJob).where(
                    ExtractionJob.evidence_id == completed_evidence.id
                )
            )
        ).one()
        completed_job.status = ExtractionJobStatus.completed
        student = await session.get(Student, completed_evidence.student_id)
        assert student is not None
        failed_evidence = Evidence(
            student_id=student.id,
            evidence_type=EvidenceType.project,
            title="Failed evidence",
            description="Built a FastAPI service.",
        )
        session.add(failed_evidence)
        await session.flush()
        await extraction_service.create_extraction_job(session, failed_evidence)
        failed_job = (
            await session.scalars(
                select(ExtractionJob).where(
                    ExtractionJob.evidence_id == failed_evidence.id
                )
            )
        ).one()
        failed_job.status = ExtractionJobStatus.dead_lettered
        failed_job.attempt_count = failed_job.max_attempts
        await session.commit()

        assert await extraction_service.requeue_terminal_extractions(
            session, [completed_evidence.id, failed_evidence.id]
        ) == 1
        assert await extraction_service.requeue_terminal_extractions(
            session, [completed_evidence.id, failed_evidence.id]
        ) == 0
        await session.refresh(completed_job)
        await session.refresh(failed_job)

    assert completed_job.status is ExtractionJobStatus.completed
    assert failed_job.status is ExtractionJobStatus.pending
    assert failed_job.attempt_count == 0
    assert queued_ids == [failed_evidence.id]


class FailingRedis:
    @classmethod
    def from_url(cls, _url: str) -> "FailingRedis":
        return cls()

    async def rpush(self, *_args: object) -> None:
        raise extraction_service.RedisError("unavailable")

    async def aclose(self) -> None:
        return None


class RecordingRedis:
    calls: ClassVar[list[tuple[object, ...]]] = []

    @classmethod
    def from_url(cls, _url: str) -> "RecordingRedis":
        return cls()

    async def rpush(self, *args: object) -> None:
        self.calls.append(args)

    async def aclose(self) -> None:
        return None


@pytest.mark.asyncio
async def test_enqueue_failure_is_recoverable_and_duplicate_enqueue_does_not_push_twice(monkeypatch: pytest.MonkeyPatch, session_factory: async_sessionmaker[AsyncSession]) -> None:
    monkeypatch.setattr(extraction_service, "get_settings", lambda: settings(redis_url="redis://test"))
    direct_processing: list[UUID] = []

    async def record_direct_processing(evidence_id: UUID) -> str:
        direct_processing.append(evidence_id)
        return "completed"

    monkeypatch.setattr(extraction_service, "process_evidence_job", record_direct_processing)
    async with session_factory() as session:
        evidence, _ = await evidence_with_job(session)
        monkeypatch.setattr(extraction_service, "Redis", FailingRedis)
        assert not await extraction_service.enqueue_extraction(session, evidence.id)
        job = (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))).one()
        assert job.status is ExtractionJobStatus.retry_scheduled
        monkeypatch.setattr(extraction_service, "Redis", RecordingRedis)
        RecordingRedis.calls = []
        assert await extraction_service.enqueue_extraction(session, evidence.id)
        assert await extraction_service.enqueue_extraction(session, evidence.id)
        await asyncio.sleep(0)

    assert len(RecordingRedis.calls) == 1
    assert direct_processing == []


@pytest.mark.asyncio
async def test_manual_requeue_resets_dead_lettered_job(monkeypatch: pytest.MonkeyPatch, session_factory: async_sessionmaker[AsyncSession]) -> None:
    monkeypatch.setattr(extraction_service, "get_settings", lambda: settings(redis_url="redis://test"))
    monkeypatch.setattr(extraction_service, "Redis", RecordingRedis)
    RecordingRedis.calls = []
    async with session_factory() as session:
        evidence, _ = await evidence_with_job(session)
        job = (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))).one()
        job.status = ExtractionJobStatus.dead_lettered
        job.attempt_count = 2
        evidence.extraction_status = ExtractionStatus.dead_lettered
        await session.commit()
        assert await extraction_service.manually_requeue_extraction(session, evidence.id)
        await session.refresh(job)

    assert job.status is ExtractionJobStatus.queued
    assert job.attempt_count == 0


@pytest.mark.asyncio
async def test_stale_worker_lease_is_requeued_or_dead_lettered_at_its_attempt_limit(
    monkeypatch: pytest.MonkeyPatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    monkeypatch.setattr(extraction_service, "get_settings", lambda: settings(redis_url="redis://test"))
    monkeypatch.setattr(extraction_service, "Redis", RecordingRedis)
    RecordingRedis.calls = []
    async with session_factory() as session:
        evidence, _ = await evidence_with_job(session)
        job = (
            await session.scalars(
                select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id)
            )
        ).one()
        job.status = ExtractionJobStatus.queued
        job.queued_at = datetime.now(UTC) - timedelta(seconds=31)
        evidence.extraction_status = ExtractionStatus.queued
        await session.commit()

        recovered = await extraction_service.recover_stale_processing_jobs(session)
        await session.refresh(job)
        await session.refresh(evidence)
        assert recovered == [evidence.id]
        assert job.status is ExtractionJobStatus.pending
        assert evidence.extraction_status is ExtractionStatus.pending_extraction
        assert await extraction_service.enqueue_extraction(session, evidence.id)
        assert job.status is ExtractionJobStatus.queued

        job.status = ExtractionJobStatus.processing
        job.attempt_count = job.max_attempts
        job.started_at = datetime.now(UTC) - timedelta(seconds=31)
        evidence.extraction_status = ExtractionStatus.processing
        await session.commit()
        assert await extraction_service.recover_stale_processing_jobs(session) == []
        await session.refresh(job)
        await session.refresh(evidence)

    assert job.status is ExtractionJobStatus.dead_lettered
    assert evidence.extraction_status is ExtractionStatus.dead_lettered
    assert len(RecordingRedis.calls) == 1


@pytest.mark.asyncio
async def test_malformed_gemini_response_and_http_statuses_are_classified(monkeypatch: pytest.MonkeyPatch) -> None:
    class BadResponse:
        def __init__(self, body: dict[str, object]) -> None:
            self.body = body

        def json(self) -> dict[str, object]:
            return self.body

        def raise_for_status(self) -> None:
            return None

    class BadClient:
        response: ClassVar[BadResponse]
        requested_url: ClassVar[str]
        requested_json: ClassVar[dict[str, object]]

        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def post(self, url: str, *_args: object, **kwargs: object) -> BadResponse:
            type(self).requested_url = url
            type(self).requested_json = kwargs["json"]  # type: ignore[assignment]
            return self.response

    monkeypatch.setattr(extraction_service, "get_settings", lambda: settings(extraction_provider="gemini", gemini_api_key="test"))
    monkeypatch.setattr(extraction_service.httpx, "AsyncClient", lambda **_kwargs: BadClient())
    BadClient.response = BadResponse({"candidates": [{"content": {"parts": [{"text": "not-json"}]}}]})
    with pytest.raises(extraction_service.ProviderResponseError):
        await extraction_service.GeminiExtractor().extract("project", "Python", [])
    assert BadClient.requested_url.endswith("/gemini-3.6-flash:generateContent")
    generation_config = BadClient.requested_json["generationConfig"]
    assert isinstance(generation_config, dict)
    assert generation_config["responseMimeType"] == "application/json"
    assert generation_config["responseJsonSchema"]
    BadClient.response = BadResponse({"candidates": [{"content": {"parts": [{"text": '{"skills":"not-a-list"}'}]}}]})
    with pytest.raises(extraction_service.ProviderResponseError):
        await extraction_service.GeminiExtractor().extract("project", "Python", [])

    request = httpx.Request("POST", "https://example.test")
    assert extraction_service._classify_failure(httpx.HTTPStatusError("rate limited", request=request, response=httpx.Response(429, request=request))).retryable
    assert extraction_service._classify_failure(httpx.HTTPStatusError("server", request=request, response=httpx.Response(500, request=request))).retryable


@pytest.mark.asyncio
async def test_groq_success_uses_shared_structured_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class GroqClient:
        requested_json: ClassVar[dict[str, object]]

        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def post(self, _url: str, **kwargs: object) -> httpx.Response:
            type(self).requested_json = kwargs["json"]  # type: ignore[assignment]
            return httpx.Response(
                200,
                request=httpx.Request("POST", "https://api.groq.com"),
                json={
                    "choices": [
                        {
                            "message": {
                                "content": '{"skills":[{"skill":"Python","confidence":0.9,"evidence_span":"Python","proficiency_hint":"intermediate"}]}'
                            }
                        }
                    ]
                },
            )

    monkeypatch.setattr(
        extraction_service,
        "get_settings",
        lambda: settings(extraction_provider="groq", groq_api_key="test-key"),
    )
    monkeypatch.setattr(
        extraction_service.httpx, "AsyncClient", lambda **_kwargs: GroqClient()
    )

    result = await extraction_service.GroqExtractor().extract(
        "project", "Built with Python", []
    )

    assert result.skills[0].skill == "Python"
    assert GroqClient.requested_json["model"] == "openai/gpt-oss-20b"
    response_format = GroqClient.requested_json["response_format"]
    assert isinstance(response_format, dict)
    assert response_format["type"] == "json_schema"


@pytest.mark.asyncio
async def test_groq_malformed_json_is_a_permanent_provider_response_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class MalformedClient:
        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def post(self, _url: str, **_kwargs: object) -> httpx.Response:
            return httpx.Response(
                200,
                request=httpx.Request("POST", "https://api.groq.com"),
                json={"choices": [{"message": {"content": "not-json"}}]},
            )

    monkeypatch.setattr(
        extraction_service,
        "get_settings",
        lambda: settings(extraction_provider="groq", groq_api_key="test-key"),
    )
    monkeypatch.setattr(
        extraction_service.httpx,
        "AsyncClient",
        lambda **_kwargs: MalformedClient(),
    )

    with pytest.raises(extraction_service.ProviderResponseError):
        await extraction_service.GroqExtractor().extract("project", "Python", [])


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("provider_error", "expected_code", "retryable"),
    [
        (httpx.TimeoutException("timeout"), "provider_transient", True),
        (429, "provider_transient", True),
        (500, "provider_transient", True),
        (401, "provider_configuration_error", False),
        (404, "provider_configuration_error", False),
    ],
)
async def test_groq_errors_use_existing_failure_taxonomy(
    monkeypatch: pytest.MonkeyPatch,
    provider_error: Exception | int,
    expected_code: str,
    retryable: bool,
) -> None:
    class FailingClient:
        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def post(self, _url: str, **_kwargs: object) -> httpx.Response:
            if isinstance(provider_error, Exception):
                raise provider_error
            return httpx.Response(
                provider_error,
                request=httpx.Request("POST", "https://api.groq.com"),
            )

    monkeypatch.setattr(
        extraction_service,
        "get_settings",
        lambda: settings(extraction_provider="groq", groq_api_key="test-key"),
    )
    monkeypatch.setattr(
        extraction_service.httpx, "AsyncClient", lambda **_kwargs: FailingClient()
    )

    with pytest.raises(extraction_service.ExtractionFailure) as failure:
        await extraction_service.extract_with_fallback("project", "Python", [])

    assert failure.value.code == expected_code
    assert failure.value.retryable is retryable


@pytest.mark.asyncio
async def test_transient_fallback_records_actual_gemini_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def groq_timeout(*_args: object) -> extraction_service.ExtractionPayload:
        raise httpx.TimeoutException("timeout")

    async def gemini_success(*_args: object) -> extraction_service.ExtractionPayload:
        return extraction_service.ExtractionPayload.model_validate({"skills": []})

    monkeypatch.setattr(
        extraction_service,
        "get_settings",
        lambda: settings(
            extraction_provider="groq",
            extraction_fallback_providers=["gemini", "local"],
            groq_api_key="test-groq",
            gemini_api_key="test-gemini",
        ),
    )
    monkeypatch.setattr(extraction_service.GroqExtractor, "extract", groq_timeout)
    monkeypatch.setattr(
        extraction_service.GeminiExtractor, "extract", gemini_success
    )

    result = await extraction_service.extract_with_fallback(
        "project", "Python", []
    )

    assert result.provider == "gemini"
    assert result.model == "gemini-3.6-flash"


@pytest.mark.asyncio
async def test_transient_chain_can_reach_local_without_schema_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def provider_timeout(*_args: object) -> extraction_service.ExtractionPayload:
        raise httpx.TimeoutException("timeout")

    monkeypatch.setattr(
        extraction_service,
        "get_settings",
        lambda: settings(
            extraction_provider="groq",
            extraction_fallback_providers=["gemini", "local"],
            groq_api_key="test-groq",
            gemini_api_key="test-gemini",
        ),
    )
    monkeypatch.setattr(extraction_service.GroqExtractor, "extract", provider_timeout)
    monkeypatch.setattr(
        extraction_service.GeminiExtractor, "extract", provider_timeout
    )
    skill = Skill(canonical_name="Python", category="Language", aliases=[])

    result = await extraction_service.extract_with_fallback(
        "project", "Built with Python", [skill]
    )

    assert result.provider == "local_fallback"
    assert result.payload.skills[0].skill == "Python"


@pytest.mark.asyncio
async def test_non_transient_groq_schema_error_does_not_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    gemini_called = False

    async def invalid_groq(*_args: object) -> extraction_service.ExtractionPayload:
        raise extraction_service.ProviderResponseError()

    async def gemini_success(*_args: object) -> extraction_service.ExtractionPayload:
        nonlocal gemini_called
        gemini_called = True
        return extraction_service.ExtractionPayload.model_validate({"skills": []})

    monkeypatch.setattr(
        extraction_service,
        "get_settings",
        lambda: settings(
            extraction_provider="groq",
            extraction_fallback_providers=["gemini"],
            groq_api_key="test-groq",
            gemini_api_key="test-gemini",
        ),
    )
    monkeypatch.setattr(extraction_service.GroqExtractor, "extract", invalid_groq)
    monkeypatch.setattr(
        extraction_service.GeminiExtractor, "extract", gemini_success
    )

    with pytest.raises(extraction_service.ProviderResponseError):
        await extraction_service.extract_with_fallback("project", "Python", [])

    assert not gemini_called


@pytest.mark.asyncio
async def test_groq_provider_and_model_are_persisted_in_provenance(
    monkeypatch: pytest.MonkeyPatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async def groq_success(*_args: object) -> extraction_service.ExtractionPayload:
        return extraction_service.ExtractionPayload.model_validate(
            {
                "skills": [
                    {
                        "skill": "Python",
                        "confidence": 0.9,
                        "evidence_span": "Python",
                    }
                ]
            }
        )

    monkeypatch.setattr(
        extraction_service,
        "get_settings",
        lambda: settings(extraction_provider="groq", groq_api_key="test-groq"),
    )
    monkeypatch.setattr(extraction_service.GroqExtractor, "extract", groq_success)
    async with session_factory() as session:
        evidence, _ = await evidence_with_job(session)
        assert await extraction_service.extract_evidence(session, evidence.id) == "completed"
        job = (
            await session.scalars(
                select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id)
            )
        ).one()
        audit = (
            await session.scalars(
                select(AuditLog)
                .where(
                    AuditLog.entity_id == evidence.id,
                    AuditLog.action == "extraction_job_completed",
                )
                .order_by(AuditLog.created_at.desc())
            )
        ).first()

    assert job.provider == "groq"
    assert audit is not None
    assert audit.details is not None
    assert audit.details["provider"] == "groq"
    assert audit.details["model"] == "openai/gpt-oss-20b"


@pytest.mark.asyncio
async def test_worker_isolates_failed_job(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fail_job(_evidence_id: UUID) -> str:
        raise RuntimeError("unexpected")

    monkeypatch.setattr(extraction_worker, "process_evidence_job", fail_job)
    await extraction_worker.process_queue_item(b"00000000-0000-0000-0000-000000000001")
