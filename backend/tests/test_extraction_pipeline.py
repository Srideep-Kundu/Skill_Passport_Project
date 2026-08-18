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
        "gemini_api_key": None,
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

    monkeypatch.setattr(extraction_service.GeminiExtractor, "extract", duplicate_extract)
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

    monkeypatch.setattr(extraction_service.GeminiExtractor, "extract", invalid_span_extract)
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

    monkeypatch.setattr(extraction_service.GeminiExtractor, "extract", timeout_extract)
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

    assert len(RecordingRedis.calls) == 1


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

        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def post(self, *_args: object, **_kwargs: object) -> BadResponse:
            return self.response

    monkeypatch.setattr(extraction_service, "get_settings", lambda: settings(extraction_provider="gemini", gemini_api_key="test"))
    monkeypatch.setattr(extraction_service.httpx, "AsyncClient", lambda **_kwargs: BadClient())
    BadClient.response = BadResponse({"candidates": [{"content": {"parts": [{"text": "not-json"}]}}]})
    with pytest.raises(extraction_service.ProviderResponseError):
        await extraction_service.GeminiExtractor().extract("project", "Python", [])
    BadClient.response = BadResponse({"candidates": [{"content": {"parts": [{"text": '{"skills":"not-a-list"}'}]}}]})
    with pytest.raises(extraction_service.ProviderResponseError):
        await extraction_service.GeminiExtractor().extract("project", "Python", [])

    request = httpx.Request("POST", "https://example.test")
    assert extraction_service._classify_failure(httpx.HTTPStatusError("rate limited", request=request, response=httpx.Response(429, request=request))).retryable
    assert extraction_service._classify_failure(httpx.HTTPStatusError("server", request=request, response=httpx.Response(500, request=request))).retryable


@pytest.mark.asyncio
async def test_worker_isolates_failed_job(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fail_job(_evidence_id: UUID) -> str:
        raise RuntimeError("unexpected")

    monkeypatch.setattr(extraction_worker, "process_evidence_job", fail_job)
    await extraction_worker.process_queue_item(b"00000000-0000-0000-0000-000000000001")
