from datetime import UTC, datetime
from uuid import UUID

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models import (
    Evidence,
    EvidenceType,
    ResumeDocument,
    ResumeParseStatus,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.services.profile_service import build_candidate_profile, build_matching_profile


@pytest_asyncio.fixture
async def session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    await engine.dispose()


@pytest.mark.asyncio
async def test_profile_aggregates_evidence_conservatively_and_excludes_private_data(session_factory: async_sessionmaker[AsyncSession]) -> None:
    async with session_factory() as session:
        student = Student(email="candidate@example.test", password_hash="hash", full_name="Private Candidate", university="Private University", github_username="candidate")
        python = Skill(canonical_name="Python", category="Language", aliases=[])
        session.add_all([student, python]); await session.flush()
        resume = ResumeDocument(student_id=student.id, original_filename="resume.docx", storage_key="00000000-0000-0000-0000-000000000001.docx", mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes=100, checksum="a" * 64, parse_status=ResumeParseStatus.completed, parser_version="v1", parsed_at=datetime.now(UTC), is_active=True)
        manual = Evidence(student_id=student.id, evidence_type=EvidenceType.project, title="API Platform", description="Python", external_url="https://github.com/candidate/api")
        resume_project = Evidence(student_id=student.id, evidence_type=EvidenceType.project, title="API Platform", description="Python", resume_document_id=resume.id, resume_section="projects", resume_source_hash="b" * 64)
        coursework = Evidence(student_id=student.id, evidence_type=EvidenceType.coursework, title="Data Structures", description="Python")
        session.add_all([resume, manual]); await session.flush()
        resume_project.resume_document_id = resume.id
        session.add_all([resume_project, coursework]); await session.flush()
        session.add_all([
            StudentSkill(student_id=student.id, skill_id=python.id, source_evidence_id=manual.id, extraction_confidence=0.8, verification_tier=VerificationTier.verified, evidence_span="Python"),
            StudentSkill(student_id=student.id, skill_id=python.id, source_evidence_id=resume_project.id, extraction_confidence=0.9, verification_tier=VerificationTier.unverified, evidence_span="Python"),
            StudentSkill(student_id=student.id, skill_id=python.id, source_evidence_id=coursework.id, extraction_confidence=0.6, verification_tier=VerificationTier.partially_verified, evidence_span="Python"),
        ])
        await session.commit()
        profile = await build_candidate_profile(session, student)
        matching_profile = await build_matching_profile(session, student.id)

    skill = profile.skills[0]
    assert skill.supporting_evidence_count == 3
    assert skill.independent_evidence_count == 2
    assert skill.highest_verification_tier == "verified"
    assert skill.verification_summary == "verified support exists"
    assert skill.summary_confidence == 0.875
    assert "resume" in skill.source_types and "github_verified" in skill.source_types
    assert any(support.likely_duplicate_of is not None for support in skill.supports)
    assert profile.active_resume is not None and profile.profile_completeness.has_project_evidence
    assert profile.profile_completeness.has_verified_evidence and profile.profile_completeness.has_github_identity
    serialized = matching_profile.model_dump_json()
    for prohibited in ("full_name", "email", "university", "contact", "address", "Private Candidate"):
        assert prohibited not in serialized
    assert matching_profile.skills[0].skill_id == UUID(str(python.id))
