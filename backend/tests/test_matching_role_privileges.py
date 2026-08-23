import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.db import SessionLocal, engine
from app.models import (
    Evidence,
    EvidenceType,
    Internship,
    InternshipRequirement,
    Recruiter,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.services.embeddings import deterministic_embedding
from app.services.matching_service import compute_and_persist_match

pytestmark = pytest.mark.asyncio(loop_scope="module")


async def test_matching_role_cannot_select_protected_student_fields() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL privilege test requires the migrated CI or deployment database")

    async with engine.connect() as connection:
        transaction = await connection.begin()
        try:
            await connection.execute(text("SET LOCAL ROLE skill_passport_matcher"))
            with pytest.raises(DBAPIError):
                await connection.execute(text("SELECT full_name, university FROM students"))
        finally:
            await transaction.rollback()


async def test_matching_operation_works_when_activated_as_matching_role() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("PostgreSQL privilege test requires the migrated CI or deployment database")

    from uuid import uuid4
    suffix = uuid4().hex[:8]
    async with SessionLocal() as session:
        recruiter = Recruiter(email=f"role-recruiter-{suffix}@example.test", password_hash="hash", company_name="Company")
        student = Student(email=f"role-student-{suffix}@example.test", password_hash="hash", full_name="Student")
        skill = Skill(canonical_name=f"Role Test Python {suffix}", category="Language", embedding=deterministic_embedding("Role Test Python"), aliases=[])
        session.add_all([recruiter, student, skill])
        await session.flush()
        evidence = Evidence(student_id=student.id, evidence_type=EvidenceType.project, title="Project", description="Role Test Python")
        internship = Internship(recruiter_id=recruiter.id, title="Intern", description="Role Test Python", embedding=deterministic_embedding("Role Test Python"))
        session.add_all([evidence, internship])
        await session.flush()
        session.add_all(
            [
                StudentSkill(student_id=student.id, skill_id=skill.id, source_evidence_id=evidence.id, extraction_confidence=0.9, verification_tier=VerificationTier.verified, evidence_span="Role Test Python"),
                InternshipRequirement(internship_id=internship.id, skill_id=skill.id, is_required=True, weight=1.0),
            ]
        )
        await session.commit()

        match = await compute_and_persist_match(session, student.id, internship.id)

    assert float(match.final_score) > 0
