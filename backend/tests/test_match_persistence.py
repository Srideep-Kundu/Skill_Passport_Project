import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view
from app.models import (
    Evidence,
    EvidenceType,
    Internship,
    InternshipRequirement,
    MatchExplanation,
    Recruiter,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.services.matching_service import compute_and_persist_match


@pytest_asyncio.fixture
async def session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)
    yield async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    await engine.dispose()


@pytest.mark.asyncio
async def test_match_persistence_is_idempotent_then_recomputes_changed_inputs(session_factory: async_sessionmaker[AsyncSession]) -> None:
    async with session_factory() as session:
        student = Student(email="student@example.test", password_hash="hash", full_name="Student", university="A")
        recruiter = Recruiter(email="recruiter@example.test", password_hash="hash", company_name="Company")
        skill = Skill(canonical_name="Python", category="Language", aliases=[])
        session.add_all([student, recruiter, skill])
        await session.flush()
        evidence = Evidence(student_id=student.id, evidence_type=EvidenceType.project, title="Project", description="Python")
        internship = Internship(recruiter_id=recruiter.id, title="Intern", description="Python")
        session.add_all([evidence, internship])
        await session.flush()
        possessed = StudentSkill(student_id=student.id, skill_id=skill.id, source_evidence_id=evidence.id, extraction_confidence=0.8, verification_tier=VerificationTier.verified, evidence_span="Python")
        session.add_all([possessed, InternshipRequirement(internship_id=internship.id, skill_id=skill.id, is_required=True, weight=1.0)])
        await session.commit()

        first = await compute_and_persist_match(session, student.id, internship.id)
        first_id, first_fingerprint, first_score, first_computed_at = first.id, first.input_fingerprint, float(first.final_score), first.computed_at
        repeat = await compute_and_persist_match(session, student.id, internship.id)
        assert repeat.id == first_id
        assert repeat.input_fingerprint == first_fingerprint

        possessed.extraction_confidence = 0.9
        await session.commit()
        recomputed = await compute_and_persist_match(session, student.id, internship.id)
        explanations = list((await session.scalars(select(MatchExplanation).where(MatchExplanation.match_id == recomputed.id))).all())

    assert recomputed.id == first_id
    assert recomputed.input_fingerprint != first_fingerprint
    assert recomputed.computed_at != first_computed_at
    assert float(recomputed.final_score) > first_score
    assert sum(float(item.contribution) for item in explanations) == pytest.approx(float(recomputed.final_score))
