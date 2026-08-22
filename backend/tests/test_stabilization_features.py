"""Unit and integration tests for final product stabilization features:
- Resume clean delete & auto-analysis
- LinkedIn profile URL extraction provider abstraction
- Skill Passport contextual grounded Copilot
- Canonical profile completeness & GitHub synchronization
"""
import uuid
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Evidence,
    EvidenceType,
    ExtractionStatus,
    ResumeDocument,
    ResumeParseStatus,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.services.copilot_service import answer_copilot_query
from app.services.integrations.linkedin_import_provider import (
    MockDemoProvider,
)


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    async def override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_mock_linkedin_import_provider():
    provider = MockDemoProvider()
    profile = await provider.fetch_profile("https://www.linkedin.com/in/maya-rivera")
    assert profile.full_name == "Maya Rivera"
    assert len(profile.skills) > 0
    assert "Python" in profile.skills
    assert profile.source_confidence == 0
    assert profile.is_demo_fixture is True
    assert profile.persistable is False
    assert len(profile.experiences) > 0


@pytest.mark.asyncio
async def test_copilot_grounded_query(db_session: AsyncSession):
    # Setup student with skills and career goal
    student = Student(
        id=uuid.uuid4(),
        full_name="Maya Rivera",
        email="maya@poly.demo",
        password_hash="pw",
        career_goals={"target_roles": ["Backend Engineer"], "target_industries": ["FinTech"]},
    )
    db_session.add(student)
    await db_session.flush()

    skill = Skill(id=uuid.uuid4(), canonical_name="Python", category="Backend", aliases=[])
    evidence = Evidence(id=uuid.uuid4(), student_id=student.id, evidence_type=EvidenceType.project, title="API Project", description="API", extraction_status=ExtractionStatus.extracted)
    db_session.add_all([skill, evidence])
    await db_session.flush()

    student_skill = StudentSkill(student_id=student.id, skill_id=skill.id, source_evidence_id=evidence.id, extraction_confidence=0.9, verification_tier=VerificationTier.verified, evidence_span="span")
    db_session.add(student_skill)
    await db_session.commit()

    # Query Copilot
    res = await answer_copilot_query(db_session, student.id, "What are my verified skills in my passport?")
    assert "Python" in res.message or "verified" in res.message
    assert len(res.sources) > 0
    assert len(res.actions) > 0
    assert res.actions[0].target_tab == "passport"

    # Query Copilot for career readiness
    gap_res = await answer_copilot_query(db_session, student.id, "Why am I ready for Backend Engineer?")
    assert "Backend Engineer" in gap_res.message
    assert any(a.target_tab == "gaps" for a in gap_res.actions)


@pytest.mark.asyncio
async def test_resume_clean_delete_unlinks_evidence(client: AsyncClient, db_session: AsyncSession):
    student = Student(id=uuid.uuid4(), full_name="Maya Rivera", email="maya2@poly.demo", password_hash="pw")
    db_session.add(student)
    await db_session.flush()

    token = create_access_token(student.id, "student")
    headers = {"Authorization": f"Bearer {token}"}

    # Create a resume document and evidence linked to it
    resume = ResumeDocument(
        id=uuid.uuid4(),
        student_id=student.id,
        original_filename="resume_test.pdf",
        storage_key="dummy_key.pdf",
        mime_type="application/pdf",
        size_bytes=1000,
        checksum="dummy_checksum",
        parse_status=ResumeParseStatus.parsed,
        parser_version="1.0",
        is_active=True,
    )
    db_session.add(resume)
    await db_session.flush()

    evidence = Evidence(
        id=uuid.uuid4(),
        student_id=student.id,
        resume_document_id=resume.id,
        evidence_type=EvidenceType.project,
        title="Resume Extracted Experience",
        description="Software intern experience",
        extraction_status=ExtractionStatus.extracted,
    )
    db_session.add(evidence)
    await db_session.commit()

    # Delete resume via API
    with patch("app.api.resumes.LocalResumeStorage.delete", return_value=None):
        resp = await client.delete(f"/resumes/{resume.id}", headers=headers)
        assert resp.status_code == 204

    # Verify resume is deleted and evidence foreign key was cleanly set to None
    refreshed_evidence = await db_session.get(Evidence, evidence.id)
    assert refreshed_evidence is not None
    assert refreshed_evidence.resume_document_id is None
    deleted_resume = await db_session.get(ResumeDocument, resume.id)
    assert deleted_resume is None


@pytest.mark.asyncio
async def test_linkedin_url_import_api(client: AsyncClient, db_session: AsyncSession):
    student = Student(id=uuid.uuid4(), full_name="Maya Rivera", email="maya3@poly.demo", password_hash="pw")
    db_session.add(student)
    await db_session.commit()

    token = create_access_token(student.id, "student")
    headers = {"Authorization": f"Bearer {token}"}

    # Step 1: Import URL
    import_resp = await client.post(
        "/linkedin/imports/import-url",
        json={"profile_url": "https://linkedin.com/in/maya-rivera"},
        headers=headers,
    )
    assert import_resp.status_code == 200
    profile_data = import_resp.json()
    assert profile_data["full_name"] == "Maya Rivera"
    assert len(profile_data["skills"]) > 0

    # Step 2: Simulated URL previews cannot enter the evidence-backed passport.
    save_resp = await client.post(
        "/linkedin/imports/save-profile",
        json=profile_data,
        headers=headers,
    )
    assert save_resp.status_code == 422

    # Verify no skills were fabricated from the preview.
    skills_in_db = (await db_session.scalars(select(StudentSkill).where(StudentSkill.student_id == student.id))).all()
    assert skills_in_db == []

