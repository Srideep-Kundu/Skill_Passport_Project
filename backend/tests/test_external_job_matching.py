from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view
from app.models import (
    Evidence,
    EvidenceType,
    ExternalJob,
    ExternalJobMatchExplanation,
    ExternalJobRequirement,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.services import matching_service
from app.services.matching_service import (
    compute_and_persist_external_job_match,
    external_job_match_is_stale,
    external_job_requirements,
    recompute_external_job_matches_for_student,
)


@pytest_asyncio.fixture
async def session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)
    yield async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    await engine.dispose()


async def _student_skill(session: AsyncSession, student: Student, skill: Skill, *, confidence: float, tier: VerificationTier = VerificationTier.verified) -> None:
    evidence = Evidence(student_id=student.id, evidence_type=EvidenceType.project, title=f"{skill.canonical_name} project", description=skill.canonical_name)
    session.add(evidence)
    await session.flush()
    session.add(StudentSkill(student_id=student.id, skill_id=skill.id, source_evidence_id=evidence.id, extraction_confidence=confidence, verification_tier=tier, evidence_span=skill.canonical_name))


def _job(*, provider: str = "greenhouse", external_id: str = "1", active: bool = True) -> ExternalJob:
    return ExternalJob(
        provider=provider,
        provider_source="public",
        external_id=external_id,
        title="Backend Engineer",
        company_name="Acme",
        description="Safe normalized description",
        source_url=f"https://example.test/{provider}/{external_id}",
        is_active=active,
    )


@pytest.mark.asyncio
async def test_external_exact_match_persists_reconcilable_provenance_and_preferred_missing(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with session_factory() as session:
        student = Student(email="student@example.test", password_hash="hash", full_name="Private Name", university="Private University")
        python, aws = Skill(canonical_name="Python", category="language", aliases=[]), Skill(canonical_name="AWS", category="cloud", aliases=[])
        job = _job()
        session.add_all([student, python, aws, job])
        await session.flush()
        await _student_skill(session, student, python, confidence=0.8)
        await _student_skill(session, student, python, confidence=0.4)  # Duplicate evidence must not inflate the selected support.
        session.add_all([
            ExternalJobRequirement(external_job_id=job.id, skill_id=python.id, is_required=True, weight=1, confidence=1, source_span="Python"),
            ExternalJobRequirement(external_job_id=job.id, skill_id=aws.id, is_required=False, weight=1, confidence=1, source_span="AWS preferred"),
        ])
        await session.commit()

        match = await compute_and_persist_external_job_match(session, student.id, job.id)
        assert match is not None
        explanations = list((await session.scalars(select(ExternalJobMatchExplanation).where(ExternalJobMatchExplanation.external_job_match_id == match.id))).all())

    assert float(match.deterministic_score) == pytest.approx(0.8)
    assert float(match.verification_bonus) == pytest.approx(0.1)
    assert float(match.final_score) == pytest.approx(0.62)
    assert sum(float(item.contribution) for item in explanations) == pytest.approx(float(match.final_score))
    by_skill = {item.skill_id: item for item in explanations}
    assert by_skill[python.id].contributing_evidence_id is not None and by_skill[python.id].verification_tier == VerificationTier.verified
    assert by_skill[aws.id].status == "missing" and by_skill[aws.id].is_required is False and float(by_skill[aws.id].contribution) == 0


@pytest.mark.asyncio
async def test_external_semantic_missing_staleness_and_inactive_policy(
    session_factory: async_sessionmaker[AsyncSession], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        matching_service,
        "get_settings",
        lambda: SimpleNamespace(semantic_matching_enabled=True, semantic_similarity_threshold=0.75, embedding_provider="deterministic_test", embedding_model="test", embedding_dimension=2),
    )
    async with session_factory() as session:
        student = Student(email="semantic@example.test", password_hash="hash", full_name="Student")
        python = Skill(canonical_name="Python", category="language", aliases=[], embedding=[0.8, 0.6], embedding_provider="deterministic_test", embedding_model="test", embedding_dimension=2, embedding_fingerprint="python")
        fastapi = Skill(canonical_name="FastAPI", category="framework", aliases=[], embedding=[1.0, 0.0], embedding_provider="deterministic_test", embedding_model="test", embedding_dimension=2, embedding_fingerprint="fastapi")
        missing = Skill(canonical_name="Kubernetes", category="platform", aliases=[])
        job, empty_job = _job(), _job(external_id="empty")
        session.add_all([student, python, fastapi, missing, job, empty_job])
        await session.flush()
        await _student_skill(session, student, python, confidence=1, tier=VerificationTier.partially_verified)
        session.add_all([
            ExternalJobRequirement(external_job_id=job.id, skill_id=fastapi.id, is_required=True, weight=1, confidence=1, source_span="FastAPI"),
            ExternalJobRequirement(external_job_id=job.id, skill_id=missing.id, is_required=False, weight=1, confidence=1, source_span="Kubernetes preferred"),
        ])
        await session.commit()
        stored_embedding = await session.get(Skill, fastapi.id)
        assert stored_embedding is not None and stored_embedding.embedding == [1.0, 0.0]
        assert any(item.embedding == [1.0, 0.0] for item in await external_job_requirements(session, job.id))
        match = await compute_and_persist_external_job_match(session, student.id, job.id)
        assert match is not None and float(match.semantic_score) == pytest.approx(0.68)
        explanation = (
            await session.scalars(
                select(ExternalJobMatchExplanation).where(
                    ExternalJobMatchExplanation.external_job_match_id == match.id,
                    ExternalJobMatchExplanation.skill_id == fastapi.id,
                )
            )
        ).one()
        assert explanation is not None and explanation.status == "semantic_near_match" and explanation.contributing_evidence_id is not None
        assert await compute_and_persist_external_job_match(session, student.id, empty_job.id) is None

        student_skill = (await session.scalars(select(StudentSkill).where(StudentSkill.student_id == student.id))).one()
        student_skill.extraction_confidence = 0.9
        await session.commit()
        assert await external_job_match_is_stale(session, match) is True
        match = await compute_and_persist_external_job_match(session, student.id, job.id)
        assert match is not None

        fastapi.embedding_fingerprint = "fastapi-v2"
        await session.commit()
        assert await external_job_match_is_stale(session, match) is True
        match = await compute_and_persist_external_job_match(session, student.id, job.id)
        assert match is not None

        requirement = (await session.scalars(select(ExternalJobRequirement).where(ExternalJobRequirement.external_job_id == job.id, ExternalJobRequirement.skill_id == fastapi.id))).one()
        requirement.weight = 2
        await session.commit()
        assert await external_job_match_is_stale(session, match) is True
        previous_fingerprint = match.input_fingerprint
        recomputed = await compute_and_persist_external_job_match(session, student.id, job.id)
        assert recomputed is not None and recomputed.input_fingerprint != previous_fingerprint
        job.is_active = False
        await session.commit()
        assert await external_job_match_is_stale(session, recomputed) is True
        assert await recompute_external_job_matches_for_student(session, student.id) == []


@pytest.mark.asyncio
async def test_external_matching_is_fair_and_provider_independent(session_factory: async_sessionmaker[AsyncSession]) -> None:
    async with session_factory() as session:
        first = Student(email="first@example.test", password_hash="hash", full_name="First Name", university="University A")
        second = Student(email="second@example.test", password_hash="hash", full_name="Second Name", university="University B")
        skill = Skill(canonical_name="Python", category="language", aliases=[])
        greenhouse, other = _job(provider="greenhouse", external_id="same"), _job(provider="ashby", external_id="same")
        session.add_all([first, second, skill, greenhouse, other])
        await session.flush()
        await _student_skill(session, first, skill, confidence=0.9)
        await _student_skill(session, second, skill, confidence=0.9)
        session.add_all([
            ExternalJobRequirement(external_job_id=greenhouse.id, skill_id=skill.id, is_required=True, weight=1, confidence=1, source_span="Python"),
            ExternalJobRequirement(external_job_id=other.id, skill_id=skill.id, is_required=True, weight=1, confidence=1, source_span="Python"),
        ])
        await session.commit()
        first_match = await compute_and_persist_external_job_match(session, first.id, greenhouse.id)
        second_match = await compute_and_persist_external_job_match(session, second.id, greenhouse.id)
        provider_match = await compute_and_persist_external_job_match(session, first.id, other.id)

    assert first_match is not None and second_match is not None and provider_match is not None
    assert float(first_match.final_score) == float(second_match.final_score) == float(provider_match.final_score)


@pytest.mark.asyncio
async def test_external_weighted_and_no_match_scores_are_explicit(session_factory: async_sessionmaker[AsyncSession]) -> None:
    async with session_factory() as session:
        student = Student(email="weighted@example.test", password_hash="hash", full_name="Student")
        python = Skill(canonical_name="Python", category="language", aliases=[])
        golang = Skill(canonical_name="Go", category="language", aliases=[])
        weighted, no_match = _job(external_id="weighted"), _job(external_id="no-match")
        session.add_all([student, python, golang, weighted, no_match])
        await session.flush()
        await _student_skill(session, student, python, confidence=1, tier=VerificationTier.unverified)
        session.add_all([
            ExternalJobRequirement(external_job_id=weighted.id, skill_id=python.id, is_required=True, weight=2, confidence=1, source_span="Python"),
            ExternalJobRequirement(external_job_id=weighted.id, skill_id=golang.id, is_required=True, weight=1, confidence=1, source_span="Go"),
            ExternalJobRequirement(external_job_id=no_match.id, skill_id=golang.id, is_required=True, weight=1, confidence=1, source_span="Go"),
        ])
        await session.commit()
        weighted_match = await compute_and_persist_external_job_match(session, student.id, weighted.id)
        no_match_result = await compute_and_persist_external_job_match(session, student.id, no_match.id)
        assert weighted_match is not None and no_match_result is not None
        missing = (await session.scalars(select(ExternalJobMatchExplanation).where(ExternalJobMatchExplanation.external_job_match_id == no_match_result.id))).one()

    assert float(weighted_match.deterministic_score) == pytest.approx(2 / 3 * 0.65, abs=0.0001)
    assert 0 <= float(weighted_match.final_score) <= 1
    assert float(no_match_result.final_score) == 0 and missing.status == "missing" and missing.is_required is True
