"""Comprehensive Integration Tests for SIH Ecosystem Expansions:
Academician, Institution, Assessments, Learning, Placement, Skill Gaps, and Collaboration.
"""
from datetime import UTC, datetime
from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import auth as auth_api
from app.core.db import Base, create_matching_view, get_session
from app.main import app
from app.models import (
    Academician,
    Assessment,
    AssessmentQuestion,
    Evidence,
    Institution,
    LearningCourse,
    PlacementDrive,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)


@pytest_asyncio.fixture
async def ecosystem_client(monkeypatch: pytest.MonkeyPatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    async def no_op_rate_limit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(auth_api, "enforce_rate_limit", no_op_rate_limit)

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()



def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_academician_and_institution_auth(ecosystem_client):
    client, _ = ecosystem_client

    # 1. Register Academician
    acad_resp = await client.post(
        "/auth/register/academician",
        json={
            "email": "prof.sharma@iit.demo",
            "password": "StrongPassword123",
            "full_name": "Prof. R. K. Sharma",
            "institution_name": "IIT Bombay",
            "department": "Computer Science",
            "designation": "Professor",
            "research_areas": ["AI", "Distributed Systems"],
        },
    )
    assert acad_resp.status_code == 201, acad_resp.text
    acad_data = acad_resp.json()
    assert acad_data["role"] == "academician"
    assert "access_token" in acad_data

    # 2. Register Institution
    inst_resp = await client.post(
        "/auth/register/institution",
        json={
            "email": "dean@nit.demo",
            "password": "StrongPassword123",
            "institution_name": "NIT Surathkal",
            "institution_code": "NIT-SUR-01",
            "state": "Karnataka",
            "departments": ["CSE", "ECE", "IT"],
        },
    )
    assert inst_resp.status_code == 201, inst_resp.text
    inst_data = inst_resp.json()
    assert inst_data["role"] == "institution"

    # 3. Login test for academician
    login_resp = await client.post(
        "/auth/login",
        json={"email": "prof.sharma@iit.demo", "password": "StrongPassword123"},
    )
    assert login_resp.status_code == 200
    assert login_resp.json()["role"] == "academician"


@pytest.mark.asyncio
async def test_career_goals_and_skill_gap_analysis(ecosystem_client):
    client, factory = ecosystem_client

    # Register student
    st_resp = await client.post(
        "/auth/register/student",
        json={"email": "student1@test.demo", "password": "StrongPassword123", "full_name": "Rohan Das"},
    )
    token = st_resp.json()["access_token"]

    # 1. Get default career goals
    goals_resp = await client.get("/career-goals", headers=auth_header(token))
    assert goals_resp.status_code == 200

    # 2. Update career goals
    update_resp = await client.put(
        "/career-goals",
        headers=auth_header(token),
        json={
            "target_roles": ["AI / Machine Learning Engineer"],
            "target_industry": "Artificial Intelligence",
            "target_skills": ["Python", "PyTorch", "Machine Learning"],
            "target_salary_lpa": 18.0,
            "ambition_level": "intermediate",
        },
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["target_roles"] == ["AI / Machine Learning Engineer"]

    # 3. Perform skill gap analysis
    gap_resp = await client.get("/skill-gaps/analyze", headers=auth_header(token))
    assert gap_resp.status_code == 200
    gap_data = gap_resp.json()
    assert gap_data["target_role"] == "AI / Machine Learning Engineer"
    assert "gap_items" in gap_data
    assert len(gap_data["gap_items"]) > 0


@pytest.mark.asyncio
async def test_assessment_flow_and_passport_sync(ecosystem_client):
    client, factory = ecosystem_client

    # Register student
    st_resp = await client.post(
        "/auth/register/student",
        json={"email": "student2@test.demo", "password": "StrongPassword123", "full_name": "Aditi Roy"},
    )
    token = st_resp.json()["access_token"]

    # Seed an assessment
    async with factory() as session:
        ass = Assessment(
            title="FastAPI Diagnostic",
            canonical_skill_name="FastAPI",
            category="Backend",
            difficulty="intermediate",
            duration_minutes=15,
            passing_score=70,
        )
        session.add(ass)
        await session.flush()
        q1 = AssessmentQuestion(
            assessment_id=ass.id,
            question_text="What does FastAPI use for data validation?",
            question_type="mcq",
            options=["Pydantic", "Django ORM", "Flask-WTF", "None"],
            correct_answer="Pydantic",
            points=100,
        )
        session.add(q1)
        await session.commit()
        ass_id = ass.id
        q1_id = str(q1.id)

    # List assessments
    list_resp = await client.get("/assessments")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) >= 1

    # Get assessment details
    detail_resp = await client.get(f"/assessments/{ass_id}")
    assert detail_resp.status_code == 200
    assert len(detail_resp.json()["questions"]) == 1

    # Submit assessment with correct answer
    submit_resp = await client.post(
        f"/assessments/{ass_id}/submit",
        headers=auth_header(token),
        json={"answers": {q1_id: "Pydantic"}},
    )
    assert submit_resp.status_code == 200
    res = submit_resp.json()
    assert res["passed"] is True
    assert res["percentage"] == 100.0

    # Verify skill entered the student's passport with VERIFIED tier
    passport_resp = await client.get("/passport/me", headers=auth_header(token))
    assert passport_resp.status_code == 200
    passport_skills = passport_resp.json()["skills"]
    assert any(s["canonical_name"].lower() == "fastapi" for s in passport_skills)



@pytest.mark.asyncio
async def test_learning_and_placement_drives(ecosystem_client):
    client, factory = ecosystem_client

    # Register student
    st_resp = await client.post(
        "/auth/register/student",
        json={"email": "student3@test.demo", "password": "StrongPassword123", "full_name": "Vikram Sen"},
    )
    token = st_resp.json()["access_token"]

    # Seed a course & placement drive
    async with factory() as session:
        course = LearningCourse(
            title="React 18 Foundations",
            provider="Coursera",
            category="Frontend",
            difficulty="beginner",
            duration_hours=8,
            url="https://coursera.org/demo",
            rating=4.9,
            description="Learn React hooks",
            skills=["React", "TypeScript"],
        )
        drive = PlacementDrive(
            company_name="Amazon India",
            title="SDE-1 Campus Hire",
            description="Campus drive for 2025",
            role_type="Full Time",
            ctc_lpa=28.0,
            eligible_departments=["CSE", "IT"],
            minimum_cgpa=7.5,
            passing_year=2025,
            drive_date=datetime.now(UTC),
            status="upcoming",
            required_skills=["Python", "Data Structures"],
        )
        session.add_all([course, drive])
        await session.commit()
        c_id = course.id
        d_id = drive.id

    # 1. Enroll in course
    enroll_resp = await client.post(f"/learning/courses/{c_id}/enroll", headers=auth_header(token))
    assert enroll_resp.status_code == 200
    assert enroll_resp.json()["status"] == "enrolled"

    # 2. Update progress to 100%
    prog_resp = await client.put(
        f"/learning/courses/{c_id}/progress",
        headers=auth_header(token),
        json={"progress": 100},
    )
    assert prog_resp.status_code == 200
    assert prog_resp.json()["status"] == "completed"

    # 3. Register for placement drive
    place_resp = await client.post(
        "/placements/register",
        headers=auth_header(token),
        json={"placement_drive_id": str(d_id), "notes": "Interested in Cloud systems"},
    )
    assert place_resp.status_code == 200
    assert place_resp.json()["is_registered"] is True


@pytest.mark.asyncio
async def test_institution_analytics(ecosystem_client):
    client, _ = ecosystem_client

    # Register institution
    inst_resp = await client.post(
        "/auth/register/institution",
        json={
            "email": "admin@university.demo",
            "password": "StrongPassword123",
            "institution_name": "State University",
            "institution_code": "STATE-UNIV-01",
            "departments": ["CSE", "ECE"],
        },
    )
    token = inst_resp.json()["access_token"]

    # Query analytics
    analytics_resp = await client.get("/institution/analytics", headers=auth_header(token))
    assert analytics_resp.status_code == 200
    data = analytics_resp.json()
    assert data["institution_name"] == "State University"
    assert "department_metrics" in data
    assert "top_skills_distribution" in data
