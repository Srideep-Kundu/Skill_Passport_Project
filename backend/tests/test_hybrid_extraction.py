from types import SimpleNamespace
from typing import Self
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models import (
    Evidence,
    EvidenceType,
    ExtractionAttempt,
    ExtractionCacheEntry,
    ExtractionJob,
    ExtractionJobStatus,
    ResumeDocument,
    ResumeParseStatus,
    Skill,
    Student,
    StudentSkill,
)
from app.services import extraction_service, hybrid_extraction


def hybrid_settings(**overrides: object) -> SimpleNamespace:
    values: dict[str, object] = {
        "extraction_schema_version": "v2-hybrid-batch",
        "extraction_provider": "local",
        "extraction_fallback_providers": [],
        "extraction_model": "gemini-test",
        "gemini_api_key": None,
        "groq_api_key": None,
        "groq_extraction_model": "openai/gpt-oss-20b",
        "cohere_api_key": None,
        "cohere_extraction_model": "command-test",
        "openrouter_api_key": None,
        "openrouter_extraction_model": "model-test",
        "hf_extraction_enabled": False,
        "hf_extraction_endpoint": None,
        "hf_extraction_model": "local-test",
        "hf_extraction_api_key": None,
        "hf_extraction_timeout_seconds": 5,
        "extraction_rag_enabled": False,
        "extraction_rag_top_k": 8,
        "extraction_rag_min_similarity": 0.72,
        "extraction_cache_enabled": True,
        "extraction_batch_max_units": 12,
        "extraction_batch_max_characters": 12_000,
        "extraction_max_attempts": 3,
        "extraction_retry_base_seconds": 1,
        "extraction_retry_max_seconds": 2,
        "extraction_claim_timeout_seconds": 30,
        "embedding_provider": "disabled",
        "embedding_model": "gemini-embedding-001",
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


def configure(monkeypatch: pytest.MonkeyPatch, **overrides: object) -> None:
    configured = hybrid_settings(**overrides)
    monkeypatch.setattr(extraction_service, "get_settings", lambda: configured)
    monkeypatch.setattr(hybrid_extraction, "get_settings", lambda: configured)


async def add_evidence(
    session: AsyncSession,
    student: Student,
    description: str,
    *,
    document: ResumeDocument | None = None,
    section: str | None = None,
) -> Evidence:
    evidence = Evidence(
        student_id=student.id,
        evidence_type=EvidenceType.project,
        title="Evidence",
        description=description,
        resume_document_id=document.id if document else None,
        resume_section=section,
    )
    session.add(evidence)
    await session.flush()
    await extraction_service.create_extraction_job(session, evidence)
    await session.commit()
    return evidence


def test_semantic_chunk_offsets_and_deterministic_confidence() -> None:
    text = "Built an API. " * 180
    units = hybrid_extraction.semantic_chunks(
        text, "projects", correlation_prefix="unit"
    )
    assert len(units) > 1
    assert all(text[unit.source_start : unit.source_end] == unit.text for unit in units)
    python = Skill(id=uuid4(), canonical_name="Python", category="Language", aliases=[])
    unit = hybrid_extraction.ExtractionUnit(
        "skills", "skills", "Explicit technical skills listed in resume: Python", 0, 53
    )
    decision = hybrid_extraction.deterministic_gate(unit, [python])
    assert not decision.requires_model
    assert decision.candidates[0].confidence == 0.8


def test_provider_sanitizer_removes_identity_and_protected_profile_data() -> None:
    sanitized = hybrid_extraction.sanitize_provider_text(
        "Jane Candidate jane@example.test University: Prestige College; built Python API",
        ["Jane Candidate", "Prestige College"],
    )
    assert "Jane Candidate" not in sanitized
    assert "jane@example.test" not in sanitized
    assert "Prestige College" not in sanitized
    assert "Python API" in sanitized


@pytest.mark.asyncio
async def test_postgres_rag_uses_pgvector_cosine_operator() -> None:
    skill = Skill(
        id=uuid4(), canonical_name="Python", category="Language", aliases=[]
    )

    class Result:
        def all(self) -> list[tuple[Skill, float]]:
            return [(skill, 0.91)]

    class Session:
        bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))
        statement = ""

        async def execute(self, statement: object) -> Result:
            self.statement = str(statement)
            return Result()

    session = Session()
    ranked = await hybrid_extraction._rank_vector_candidates(
        session,  # type: ignore[arg-type]
        [0.0] * 768,
        [skill],
        8,
    )

    assert ranked == [(skill, 0.91)]
    assert "<=>" in session.statement


@pytest.mark.asyncio
async def test_structured_resume_batch_uses_zero_provider_calls(
    monkeypatch: pytest.MonkeyPatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    configure(monkeypatch)
    calls = 0

    async def unexpected_call(*_args: object) -> extraction_service.ProviderBatchExtraction:
        nonlocal calls
        calls += 1
        raise AssertionError("provider should not be called")

    monkeypatch.setattr(extraction_service, "extract_batch_with_fallback", unexpected_call)
    async with session_factory() as session:
        student = Student(email="zero@example.test", password_hash="hash", full_name="Zero")
        python = Skill(canonical_name="Python", category="Language", aliases=["Python3"])
        session.add_all([student, python])
        await session.flush()
        document = ResumeDocument(
            student_id=student.id,
            original_filename="resume.docx",
            storage_key="zero.docx",
            mime_type="application/docx",
            size_bytes=100,
            checksum="a" * 64,
            parse_status=ResumeParseStatus.processing_skills,
            parser_version="test",
        )
        session.add(document)
        await session.flush()
        evidence = await add_evidence(
            session,
            student,
            "Explicit technical skills listed in resume: Python",
            document=document,
            section="skills",
        )
        assert await extraction_service.extract_evidence(session, evidence.id) == "completed"
        skill_count = await session.scalar(select(func.count()).select_from(StudentSkill))
        deterministic_count = await session.scalar(
            select(func.count())
            .select_from(ExtractionAttempt)
            .where(ExtractionAttempt.stage == "deterministic")
        )

    assert calls == 0
    assert skill_count == 1
    assert deterministic_count == 1


@pytest.mark.asyncio
async def test_ambiguous_resume_jobs_share_one_provider_batch(
    monkeypatch: pytest.MonkeyPatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    configure(monkeypatch)
    calls: list[list[str]] = []

    async def batch_extract(
        items: list[extraction_service.BatchEvidence],
        _taxonomy: list[Skill],
        traces: list[extraction_service.ProviderAttemptTrace] | None = None,
    ) -> extraction_service.ProviderBatchExtraction:
        calls.append([item.correlation_id for item in items])
        if traces is not None:
            traces.append(
                extraction_service.ProviderAttemptTrace("cohere", "test", "completed", 5)
            )
        payload = extraction_service.BatchExtractionPayload.model_validate(
            {
                "items": [
                    {"correlation_id": item.correlation_id, "skills": []}
                    for item in items
                ]
            }
        )
        return extraction_service.ProviderBatchExtraction(payload, "cohere", "test")

    monkeypatch.setattr(extraction_service, "extract_batch_with_fallback", batch_extract)
    async with session_factory() as session:
        student = Student(email="batch@example.test", password_hash="hash", full_name="Batch")
        session.add_all([student, Skill(canonical_name="Python", category="Language", aliases=[])])
        await session.flush()
        document = ResumeDocument(
            student_id=student.id,
            original_filename="resume.docx",
            storage_key="batch.docx",
            mime_type="application/docx",
            size_bytes=100,
            checksum="b" * 64,
            parse_status=ResumeParseStatus.processing_skills,
            parser_version="test",
        )
        session.add(document)
        await session.flush()
        evidences = [
            await add_evidence(
                session,
                student,
                f"Developed technical automation pipeline {index}",
                document=document,
                section="projects",
            )
            for index in range(3)
        ]
        assert await extraction_service.extract_evidence(session, evidences[0].id) == "completed"
        statuses = list((await session.scalars(select(ExtractionJob.status))).all())
        metrics = await extraction_service.extraction_metrics_for_resume(session, document.id)

    assert len(calls) == 1
    assert len(calls[0]) == 3
    assert statuses == [ExtractionJobStatus.completed] * 3
    assert metrics["providers"] == {
        "cohere": {"calls": 1, "input_tokens": 0, "output_tokens": 0, "failures": 0}
    }


@pytest.mark.asyncio
async def test_rag_metrics_survive_truthful_provider_failure(
    monkeypatch: pytest.MonkeyPatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    configure(monkeypatch, extraction_rag_enabled=True)

    async def retrieved(
        _session: AsyncSession, texts: list[str], _taxonomy: list[Skill]
    ) -> tuple[list[list[hybrid_extraction.RetrievedSkill]], bool]:
        return [[] for _ in texts], True

    async def malformed(
        _items: list[extraction_service.BatchEvidence],
        _taxonomy: list[Skill],
        traces: list[extraction_service.ProviderAttemptTrace] | None = None,
    ) -> extraction_service.ProviderBatchExtraction:
        if traces is not None:
            traces.append(
                extraction_service.ProviderAttemptTrace(
                    "cohere", "test", "failed", 5, error_code="provider_response_invalid"
                )
            )
        raise extraction_service.ProviderResponseError()

    monkeypatch.setattr(
        extraction_service, "retrieve_taxonomy_candidates_many", retrieved
    )
    monkeypatch.setattr(extraction_service, "extract_batch_with_fallback", malformed)

    async with session_factory() as session:
        student = Student(
            email="rag-failure@example.test", password_hash="hash", full_name="RAG"
        )
        session.add_all(
            [student, Skill(canonical_name="Python", category="Language", aliases=[])]
        )
        await session.flush()
        document = ResumeDocument(
            student_id=student.id,
            original_filename="rag.docx",
            storage_key="rag.docx",
            mime_type="application/docx",
            size_bytes=100,
            checksum="d" * 64,
            parse_status=ResumeParseStatus.processing_skills,
            parser_version="test",
        )
        session.add(document)
        await session.flush()
        evidence = await add_evidence(
            session,
            student,
            "Developed a technical orchestration system",
            document=document,
            section="projects",
        )

        assert await extraction_service.extract_evidence(session, evidence.id) == "failed"
        metrics = await extraction_service.extraction_metrics_for_resume(
            session, document.id
        )

    assert metrics["rag_embedding_requests"] == 1
    assert metrics["failed_jobs"] == 1
    assert metrics["providers"] == {
        "cohere": {"calls": 1, "input_tokens": 0, "output_tokens": 0, "failures": 1}
    }


@pytest.mark.asyncio
async def test_thirty_unit_resume_is_bounded_to_three_provider_calls(
    monkeypatch: pytest.MonkeyPatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    configure(monkeypatch)
    calls = 0

    async def batch_extract(
        items: list[extraction_service.BatchEvidence],
        _taxonomy: list[Skill],
        traces: list[extraction_service.ProviderAttemptTrace] | None = None,
    ) -> extraction_service.ProviderBatchExtraction:
        nonlocal calls
        calls += 1
        if traces is not None:
            traces.append(
                extraction_service.ProviderAttemptTrace("cohere", "test", "completed", 1)
            )
        return extraction_service.ProviderBatchExtraction(
            extraction_service.BatchExtractionPayload.model_validate(
                {
                    "items": [
                        {"correlation_id": item.correlation_id, "skills": []}
                        for item in items
                    ]
                }
            ),
            "cohere",
            "test",
        )

    monkeypatch.setattr(extraction_service, "extract_batch_with_fallback", batch_extract)
    async with session_factory() as session:
        student = Student(email="quota@example.test", password_hash="hash", full_name="Quota")
        session.add_all([student, Skill(canonical_name="Python", category="Language", aliases=[])])
        await session.flush()
        document = ResumeDocument(
            student_id=student.id,
            original_filename="resume.docx",
            storage_key="quota.docx",
            mime_type="application/docx",
            size_bytes=100,
            checksum="c" * 64,
            parse_status=ResumeParseStatus.processing_skills,
            parser_version="test",
        )
        session.add(document)
        await session.flush()
        evidences = [
            await add_evidence(
                session,
                student,
                f"Developed technical automation workflow number {index}",
                document=document,
                section="projects",
            )
            for index in range(30)
        ]
        for evidence in evidences:
            await extraction_service.extract_evidence(session, evidence.id)
        completed = await session.scalar(
            select(func.count())
            .select_from(ExtractionJob)
            .where(ExtractionJob.status == ExtractionJobStatus.completed)
        )

    assert completed == 30
    assert calls == 3


@pytest.mark.asyncio
async def test_cache_is_student_scoped_and_preserves_distinct_evidence(
    monkeypatch: pytest.MonkeyPatch,
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    configure(monkeypatch)
    calls = 0

    async def batch_extract(
        items: list[extraction_service.BatchEvidence],
        _taxonomy: list[Skill],
        _traces: list[extraction_service.ProviderAttemptTrace] | None = None,
    ) -> extraction_service.ProviderBatchExtraction:
        nonlocal calls
        calls += 1
        payload = extraction_service.BatchExtractionPayload.model_validate(
            {
                "items": [
                    {
                        "correlation_id": item.correlation_id,
                        "skills": [
                            {
                                "skill": "Python",
                                "confidence": 0.9,
                                "evidence_span": "scripting",
                            }
                        ],
                    }
                    for item in items
                ]
            }
        )
        return extraction_service.ProviderBatchExtraction(payload, "cohere", "test")

    monkeypatch.setattr(extraction_service, "extract_batch_with_fallback", batch_extract)
    async with session_factory() as session:
        first_student = Student(email="first@example.test", password_hash="hash", full_name="First")
        second_student = Student(email="second@example.test", password_hash="hash", full_name="Second")
        session.add_all(
            [first_student, second_student, Skill(canonical_name="Python", category="Language", aliases=[])]
        )
        await session.flush()
        description = "Implemented technical scripting automation"
        first = await add_evidence(session, first_student, description)
        repeated = await add_evidence(session, first_student, description)
        other_student = await add_evidence(session, second_student, description)
        assert await extraction_service.extract_evidence(session, first.id) == "completed"
        assert await extraction_service.extract_evidence(session, repeated.id) == "completed"
        assert await extraction_service.extract_evidence(session, other_student.id) == "completed"
        rows = list((await session.scalars(select(StudentSkill))).all())
        cache_count = await session.scalar(select(func.count()).select_from(ExtractionCacheEntry))
        cache_hits = await session.scalar(
            select(func.count())
            .select_from(ExtractionAttempt)
            .where(ExtractionAttempt.cache_hit.is_(True))
        )

    assert calls == 2
    assert len(rows) == 3
    assert len({row.source_evidence_id for row in rows}) == 3
    assert cache_count == 2
    assert cache_hits == 1


def test_batch_correlations_fail_closed() -> None:
    expected = [extraction_service.BatchEvidence("expected", "project", "text")]
    payload = extraction_service.BatchExtractionPayload.model_validate(
        {"items": [{"correlation_id": "foreign", "skills": []}]}
    )
    with pytest.raises(extraction_service.ProviderResponseError):
        extraction_service._validate_batch_correlations(payload, expected)


@pytest.mark.asyncio
async def test_external_batch_chain_is_ordered_and_stops_after_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure(
        monkeypatch,
        extraction_provider="cohere",
        extraction_fallback_providers=["groq", "openrouter", "gemini", "local"],
    )
    calls: list[str] = []

    class Adapter:
        last_input_tokens = None
        last_output_tokens = None

        def __init__(self, provider: str) -> None:
            self.provider = provider
            self.model = f"{provider}-model"

        async def extract_batch(
            self,
            items: list[extraction_service.BatchEvidence],
            _taxonomy: list[Skill],
        ) -> extraction_service.BatchExtractionPayload:
            calls.append(self.provider)
            if self.provider in {"cohere", "groq"}:
                raise extraction_service.httpx.TimeoutException("temporary")
            return extraction_service.BatchExtractionPayload.model_validate(
                {
                    "items": [
                        {"correlation_id": item.correlation_id, "skills": []}
                        for item in items
                    ]
                }
            )

    monkeypatch.setattr(extraction_service, "_adapter", Adapter)
    result = await extraction_service.extract_batch_with_fallback(
        [extraction_service.BatchEvidence("one", "project", "technical work")],
        [],
    )

    assert calls == ["cohere", "groq", "openrouter"]
    assert result.provider == "openrouter"


@pytest.mark.asyncio
async def test_invalid_batch_output_does_not_fall_through(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure(
        monkeypatch,
        extraction_provider="cohere",
        extraction_fallback_providers=["groq", "local"],
    )
    calls: list[str] = []

    class Adapter:
        last_input_tokens = None
        last_output_tokens = None

        def __init__(self, provider: str) -> None:
            self.provider = provider
            self.model = "test"

        async def extract_batch(
            self,
            _items: list[extraction_service.BatchEvidence],
            _taxonomy: list[Skill],
        ) -> extraction_service.BatchExtractionPayload:
            calls.append(self.provider)
            return extraction_service.BatchExtractionPayload.model_validate(
                {"items": [{"correlation_id": "wrong", "skills": []}]}
            )

    monkeypatch.setattr(extraction_service, "_adapter", Adapter)
    with pytest.raises(extraction_service.ProviderResponseError):
        await extraction_service.extract_batch_with_fallback(
            [extraction_service.BatchEvidence("expected", "project", "text")], []
        )

    assert calls == ["cohere"]


@pytest.mark.asyncio
async def test_cohere_and_openrouter_use_strict_structured_outputs(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    configure(
        monkeypatch,
        cohere_api_key="cohere-test",
        openrouter_api_key="openrouter-test",
    )
    requests: list[tuple[str, dict[str, object]]] = []

    class Client:
        async def __aenter__(self) -> Self:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def post(self, url: str, **kwargs: object) -> extraction_service.httpx.Response:
            body = kwargs["json"]
            assert isinstance(body, dict)
            requests.append((url, body))
            if "cohere.com" in url:
                response_body = {
                    "message": {
                        "content": [
                            {"text": '{"items":[{"correlation_id":"one","skills":[]}]}' }
                        ]
                    }
                }
            else:
                response_body = {
                    "choices": [
                        {
                            "message": {
                                "content": '{"items":[{"correlation_id":"one","skills":[]}]}'
                            }
                        }
                    ]
                }
            return extraction_service.httpx.Response(
                200,
                request=extraction_service.httpx.Request("POST", url),
                json=response_body,
            )

    monkeypatch.setattr(
        extraction_service.httpx, "AsyncClient", lambda **_kwargs: Client()
    )
    item = extraction_service.BatchEvidence("one", "project", "technical text")
    assert (await extraction_service.CohereExtractor().extract_batch([item], [])).items
    assert (
        await extraction_service.OpenRouterExtractor().extract_batch([item], [])
    ).items

    cohere_body = requests[0][1]
    openrouter_body = requests[1][1]
    assert cohere_body["response_format"]
    assert openrouter_body["response_format"]
    assert openrouter_body["provider"] == {"require_parameters": True}
