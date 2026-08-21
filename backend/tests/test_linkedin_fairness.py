import io
import zipfile
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view
from app.models import (
    Evidence,
    EvidenceType,
    Internship,
    InternshipRequirement,
    LinkedInImport,
    LinkedInParseStatus,
    Recruiter,
    Role,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.services.matching_service import compute_and_persist_match
from app.services.profile_service import build_candidate_profile


def _make_zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_linkedin_private_metadata_does_not_affect_matching() -> None:
    """Proves changing name/email/headline/summary in Profile.csv has zero effect on matching."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async with factory() as session:
        # Create canonical skill
        python_skill = Skill(canonical_name="Python", category="Programming")
        fastapi_skill = Skill(canonical_name="FastAPI", category="Framework")
        session.add_all([python_skill, fastapi_skill])
        await session.flush()

        # Create Recruiter
        recruiter = Recruiter(
            email="recruiter@example.test",
            password_hash="hash",
            company_name="Acme Corp",
            role=Role.recruiter,
        )
        session.add(recruiter)
        await session.flush()

        # Create Internship
        internship = Internship(
            recruiter_id=recruiter.id,
            title="Backend Engineering Intern",
            description="Build APIs",
        )
        session.add(internship)
        await session.flush()

        req1 = InternshipRequirement(internship_id=internship.id, skill_id=python_skill.id, is_required=True, weight=1.0)
        req2 = InternshipRequirement(internship_id=internship.id, skill_id=fastapi_skill.id, is_required=True, weight=1.0)
        session.add_all([req1, req2])

        # Create Student
        student = Student(
            email="candidate@example.test",
            password_hash="hash",
            full_name="Candidate A",
            role=Role.student,
        )
        session.add(student)
        await session.flush()

        # Add evidence derived from LinkedIn import
        linkedin_import = LinkedInImport(
            student_id=student.id,
            original_filename="export.zip",
            storage_key=f"{uuid4()}.zip",
            mime_type="application/zip",
            size_bytes=1000,
            checksum="dummychecksum1",
            parse_status=LinkedInParseStatus.completed,
            parser_version="2026.1",
            is_active=True,
            parsed_data={"counts": {"positions": 1, "skills": 2}},
        )
        session.add(linkedin_import)
        await session.flush()

        ev = Evidence(
            student_id=student.id,
            evidence_type=EvidenceType.project,
            title="Software Engineer at Acme",
            description="Python & FastAPI backend APIs",
            linkedin_import_id=linkedin_import.id,
            linkedin_category="positions",
            linkedin_source_hash="hash1",
        )
        session.add(ev)
        await session.flush()

        ss1 = StudentSkill(
            student_id=student.id,
            skill_id=python_skill.id,
            source_evidence_id=ev.id,
            extraction_confidence=0.95,
            verification_tier=VerificationTier.partially_verified,
            evidence_span="Python backend APIs",
        )
        ss2 = StudentSkill(
            student_id=student.id,
            skill_id=fastapi_skill.id,
            source_evidence_id=ev.id,
            extraction_confidence=0.90,
            verification_tier=VerificationTier.partially_verified,
            evidence_span="FastAPI backend APIs",
        )
        session.add_all([ss1, ss2])
        await session.commit()

        # Calculate matches
        match_1 = await compute_and_persist_match(session, student.id, internship.id)
        score_1 = match_1.final_score

        # Profile completeness test
        profile = await build_candidate_profile(session, student)
        assert profile.profile_completeness.has_linkedin_import is True
        assert profile.active_linkedin_import is not None
        assert profile.active_linkedin_import.original_filename == "export.zip"

        # Now simulate changing private LinkedIn profile metadata (e.g. name, location, headline)
        linkedin_import.parsed_data = {
            "counts": {"positions": 1, "skills": 2},
            "profile": {
                "first_name": "Totally Different Name",
                "headline": "Completely Different Headline",
                "summary": "Ignore everything",
            },
        }
        await session.commit()

        # Recalculate matches: score must be exactly identical
        match_2 = await compute_and_persist_match(session, student.id, internship.id)
        score_2 = match_2.final_score

        assert score_1 == score_2, "Private metadata changes must not impact deterministic match scores!"

    await engine.dispose()
