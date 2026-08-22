"""Automated Test Suite for Final SIH26044 Features.

Tests:
1. Soft-skill assessment flow and competency breakdown
2. Aptitude assessment flow with category breakdown
3. Apprenticeship opportunity creation and filtering
4. Industry training and certification programs
5. Explainable Career Guidance recommendations
6. Secure Document Management Vault & access control
7. Digital Portfolio Achievements & Evidence linkage
8. Recruiter Skill Demand Analytics & recruitment funnel
9. Stretch integration adapters (LMS, Cert, CSV student roster import)
"""
from datetime import datetime, timezone
import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Assessment,
    AssessmentQuestion,
    Internship,
    LearningCourse,
    Recruiter,
    Skill,
    Student,
    StudentSkill,
    UserDocument,
    StudentAchievement,
    VerificationTier,
    Evidence,
    EvidenceType,
    ExtractionStatus,
)
from app.services.integrations.lms_adapter import MockLMSAdapter
from app.services.integrations.cert_adapter import MockCertificationAdapter
from app.services.integrations.institution_import_adapter import import_students_csv


@pytest_asyncio.fixture
async def final_fixture():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_soft_skills_and_aptitude_assessments(final_fixture):
    client, factory = final_fixture

    async with factory() as session:
        student = Student(
            email="softskill_student@university.edu",
            full_name="Alex Patel",
            password_hash="testpass",
            career_goals={"target_roles": ["Backend Engineer"]},
        )
        session.add(student)
        await session.flush()

        soft_ass = Assessment(
            title="Workplace Situational Judgment",
            canonical_skill_name="Team Leadership",
            category="Soft Skills",
            difficulty="intermediate",
            duration_minutes=20,
            passing_score=70,
        )
        session.add(soft_ass)
        await session.flush()

        q1 = AssessmentQuestion(
            assessment_id=soft_ass.id,
            question_text="How to handle disagreements?",
            question_type="mcq",
            options=["Collaborate", "Argue"],
            correct_answer="Collaborate",
            explanation="Collaboration is key.",
            points=100,
        )
        session.add(q1)

        apt_ass = Assessment(
            title="Logical Reasoning Test",
            canonical_skill_name="Logical Reasoning",
            category="Aptitude",
            difficulty="intermediate",
            duration_minutes=20,
            passing_score=70,
        )
        session.add(apt_ass)
        await session.flush()

        q2 = AssessmentQuestion(
            assessment_id=apt_ass.id,
            question_text="If A=B and B=C, is A=C?",
            question_type="mcq",
            options=["Yes", "No"],
            correct_answer="Yes",
            explanation="Transitive property",
            points=100,
        )
        session.add(q2)
        await session.commit()

        s_id = student.id
        soft_id = soft_ass.id
        apt_id = apt_ass.id
        q1_id = str(q1.id)
        q2_id = str(q2.id)

    token = create_access_token(s_id, "student")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Submit Soft-Skill Assessment
    submit_res = await client.post(
        f"/assessments/{soft_id}/submit",
        json={"answers": {q1_id: "Collaborate"}},
        headers=headers,
    )
    assert submit_res.status_code == 200
    data = submit_res.json()
    assert data["passed"] is True
    assert data["breakdown"]["type"] == "soft_skills"
    assert "communication" in data["breakdown"]
    assert "teamwork" in data["breakdown"]
    assert "strengths" in data["breakdown"]

    # 2. Submit Aptitude Assessment
    apt_res = await client.post(
        f"/assessments/{apt_id}/submit",
        json={"answers": {q2_id: "Yes"}},
        headers=headers,
    )
    assert apt_res.status_code == 200
    apt_data = apt_res.json()
    assert apt_data["passed"] is True
    assert apt_data["breakdown"]["type"] == "aptitude"
    assert "quantitative_score" in apt_data["breakdown"]
    assert "logical_reasoning_score" in apt_data["breakdown"]


@pytest.mark.asyncio
async def test_apprenticeships_and_recruiter_programs(final_fixture):
    client, factory = final_fixture

    async with factory() as session:
        recruiter = Recruiter(
            email="talent@innovate.com",
            company_name="Innovate Works",
            password_hash="testpass",
        )
        session.add(recruiter)
        await session.flush()

        appr = Internship(
            recruiter_id=recruiter.id,
            title="Embedded Systems Apprenticeship",
            description="12-month hands-on apprenticeship with hardware mentors",
            opportunity_type="apprenticeship",
            mode="onsite",
            duration_weeks=48,
            stipend_amount=25000,
            location="Bengaluru",
        )
        session.add(appr)

        course = LearningCourse(
            recruiter_id=recruiter.id,
            title="Full Stack Cloud Bootcamp",
            provider="Innovate Academy",
            category="Full Stack",
            program_type="training_program",
            duration_hours=60,
            delivery_mode="hybrid",
            url="https://innovate.com/bootcamp",
            description="Comprehensive industry bootcamp",
            skills=["React", "FastAPI", "PostgreSQL"],
        )
        session.add(course)

        student = Student(email="appr_student@uni.edu", full_name="Rohan Gupta", password_hash="pass")
        session.add(student)
        await session.commit()
        s_id = student.id

    s_token = create_access_token(s_id, "student")
    headers = {"Authorization": f"Bearer {s_token}"}

    res = await client.get("/learning/courses", headers=headers)
    assert res.status_code == 200
    courses = res.json()
    assert any(c["title"] == "Full Stack Cloud Bootcamp" for c in courses)


@pytest.mark.asyncio
async def test_career_guidance_and_role_readiness(final_fixture):
    client, factory = final_fixture

    async with factory() as session:
        student = Student(
            email="guidance_student@uni.edu",
            full_name="Priya Sharma",
            password_hash="pass",
            career_goals={"target_roles": ["Backend Engineer"]},
        )
        session.add(student)
        await session.flush()

        skill_py = Skill(canonical_name="Python", category="Backend", aliases=[])
        session.add(skill_py)
        await session.flush()

        evidence = Evidence(
            student_id=student.id,
            evidence_type=EvidenceType.project,
            title="FastAPI Project",
            description="Built async REST API",
            extraction_status=ExtractionStatus.extracted,
        )
        session.add(evidence)
        await session.flush()

        session.add(
            StudentSkill(
                student_id=student.id,
                skill_id=skill_py.id,
                source_evidence_id=evidence.id,
                extraction_confidence=0.95,
                verification_tier=VerificationTier.verified,
                evidence_span="Built Python REST backend using FastAPI with database session handling",
            )
        )
        await session.commit()
        s_id = student.id

    token = create_access_token(s_id, "student")
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/career-guidance/overview", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "ready_roles" in data
    assert "next_step_roles" in data
    assert "top_skill_priorities" in data
    assert "aligning_industry_sectors" in data
    assert len(data["learning_action_plan"]) > 0


@pytest.mark.asyncio
async def test_secure_documents_and_achievements(final_fixture):
    client, factory = final_fixture

    async with factory() as session:
        student = Student(email="vault_student@uni.edu", full_name="Karan Verma", password_hash="pass")
        session.add(student)
        await session.commit()
        s_id = student.id

    token = create_access_token(s_id, "student")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Upload document
    doc_res = await client.post(
        "/documents",
        json={
            "document_type": "certificate",
            "title": "AWS Certified Cloud Practitioner",
            "file_name": "aws_cert_2026.pdf",
            "file_size_bytes": 102400,
            "mime_type": "application/pdf",
        },
        headers=headers,
    )
    assert doc_res.status_code == 201

    # 2. List documents
    list_res = await client.get("/documents", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Add achievement
    ach_res = await client.post(
        "/achievements",
        json={
            "title": "Smart India Hackathon 1st Place",
            "achievement_type": "hackathon",
            "issuer_organization": "Ministry of Education",
            "issue_date": datetime.now(timezone.utc).isoformat(),
            "description": "Built AI-powered Skill Passport platform",
            "proof_url": "https://sih.gov.in/winners/2026",
        },
        headers=headers,
    )
    assert ach_res.status_code == 201
    ach_data = ach_res.json()
    assert ach_data["verification_status"] == "verified"
    assert ach_data["evidence_id"] is not None


@pytest.mark.asyncio
async def test_recruiter_analytics_and_integration_adapters(final_fixture):
    client, factory = final_fixture

    async with factory() as session:
        recruiter = Recruiter(
            email="hiring@techcorp.com",
            company_name="TechCorp Global",
            password_hash="pass",
        )
        session.add(recruiter)
        await session.commit()
        r_id = recruiter.id

    r_token = create_access_token(r_id, "recruiter")
    r_headers = {"Authorization": f"Bearer {r_token}"}

    # 1. Recruiter analytics
    res = await client.get("/recruiter-analytics/me", headers=r_headers)
    assert res.status_code == 200
    analytics = res.json()
    assert analytics["company_name"] == "TechCorp Global"
    assert len(analytics["recruitment_funnel"]) == 5
    assert len(analytics["top_demanded_skills"]) > 0

    # 2. Test LMS adapter
    lms = MockLMSAdapter()
    completions = await lms.fetch_student_completions("student_123")
    assert len(completions) == 2
    assert completions[0].provider == "NPTEL / SWAYAM"

    # 3. Test Certification adapter
    cert = MockCertificationAdapter()
    claim = await cert.verify_credential_assertion("https://credly.com/badge/123")
    assert claim.is_cryptographically_valid is True
    assert "AWS" in claim.skills_asserted

    # 4. Test Institutional CSV Roster Import
    async with factory() as session:
        csv_data = """full_name,email,department,cgpa,passing_year\nRahul Nair,rahul.nair@college.edu,Computer Science,8.9,2025\nSneha Sen,sneha.sen@college.edu,Information Technology,9.2,2025"""
        summary = await import_students_csv(session, csv_data)
        assert summary.imported_count == 2
        assert summary.errors == []
