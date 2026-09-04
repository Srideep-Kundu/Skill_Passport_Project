import uuid
from datetime import UTC, datetime, timedelta
import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import (
    Academician,
    Evidence,
    IndustryExpert,
    Role,
    Skill,
    Student,
    StudentSkill,
    TrainingParticipant,
    TrainingProgram,
    VerificationTier,
)


@pytest_asyncio.fixture
async def api_client():
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
        yield client
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_training_planner_closed_loop_flow(api_client: httpx.AsyncClient):
    # 1. Create Academician, Skill, Expert, and Student
    faculty_id = uuid.uuid4()
    faculty_user = Academician(
        id=faculty_id,
        email="dr.kulkarni@univ.edu",
        password_hash=hash_password("FacultySecret123"),
        full_name="Dr. Pooja Kulkarni",
        department="Computer Science",
        designation="Professor",
        institution_name="Test University",
        research_areas=["Machine Learning", "DevOps"],
        collaboration_availability="available",
        created_at=datetime.now(UTC),
    )

    skill_id = uuid.uuid4()
    skill = Skill(
        id=skill_id,
        canonical_name="MLOps",
        category="Technical",
    )

    expert_id = uuid.uuid4()
    expert = IndustryExpert(
        id=expert_id,
        name="Vikramaditya Roy",
        title="Staff Cloud & ML Specialist",
        organization="Amazon Web Services",
        bio="Specialist in containerization and model scaling.",
        expertise_tags=["Machine Learning", "Cloud Deployment", "MLOps"],
        experience_years=11,
        availability="available",
        speaking_fee="Honorarium (Standard AICTE / Institutional)",
        rating=4.91,
        past_sessions_count=27,
        email="vikramaditya@aws.example.com",
    )

    student_id = uuid.uuid4()
    student = Student(
        id=student_id,
        email="student.test@univ.edu",
        password_hash=hash_password("StudentSecret123"),
        full_name="Aarav Mehta",
        created_at=datetime.now(UTC),
    )

    override = app.dependency_overrides[get_session]
    async for session in override():
        session.add_all([faculty_user, skill, expert, student])
        await session.commit()
        break

    token = create_access_token(str(faculty_id), role=Role.academician.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Get Gap-Driven Training Recommendations
    res_recs = await api_client.get("/academician/training-recommendations", headers=headers)
    assert res_recs.status_code == 200
    recs_data = res_recs.json()
    recs = recs_data["recommendations"]
    assert len(recs) >= 1
    assert "why_recommended" in recs[0]
    assert recs[0]["skill_gap_percentage"] > 0

    # 3. Create Workshop via Multi-step wizard data
    start_time = datetime.now(UTC) + timedelta(days=21)
    end_time = start_time + timedelta(days=2)

    training_payload = {
        "title": "Hands-on MLOps & Production Deployment Workshop",
        "description": "Close the 61% student gap in model containerization and cloud serving.",
        "program_type": "skill_gap_workshop",
        "target_department": "Computer Science & Engineering",
        "target_year": "3rd Year",
        "target_skills": ["MLOps"],
        "expected_participants": 80,
        "trainer_type": "external_expert",
        "trainer_name": "Vikramaditya Roy",
        "trainer_id": str(expert_id),
        "infrastructure_required": [{"item": "Workstations", "required": 80, "available": 60, "gap": 20}],
        "infrastructure_resolution": "Run in two lab sessions with cloud credits.",
        "budget_total": 45000.0,
        "funding_gap": 25000.0,
        "budget_breakdown": {
            "trainer_honorarium": 20000,
            "venue_setup": 5000,
            "certificates_kits": 5000,
            "food_refreshments": 10000,
            "marketing_outreach": 2000,
            "cloud_credits_infra": 3000,
        },
        "start_date": start_time.isoformat(),
        "end_date": end_time.isoformat(),
        "status": "scheduled",
    }

    res_create = await api_client.post("/academician/trainings", json=training_payload, headers=headers)
    assert res_create.status_code == 201
    created_training = res_create.json()
    training_id = created_training["id"]

    # Verify Notice Period & Diagnostics computed automatically
    assert created_training["funding_gap"] == 25000
    assert created_training["preparation_days"] >= 20
    assert created_training["notice_period_status"] in ["good", "warning", "urgent"]
    assert "marketing_kit" in created_training
    assert "email_announcement" in created_training["marketing_kit"]

    # 4. List Trainings & Get Detail
    res_list = await api_client.get("/academician/trainings", headers=headers)
    assert res_list.status_code == 200
    assert len(res_list.json()["items"]) >= 1

    res_get = await api_client.get(f"/academician/trainings/{training_id}", headers=headers)
    assert res_get.status_code == 200
    assert res_get.json()["title"] == training_payload["title"]

    # 5. Enroll Student Participant
    async for session in override():
        part = TrainingParticipant(
            id=uuid.uuid4(),
            training_id=uuid.UUID(training_id),
            student_id=student_id,
            registration_status="confirmed",
            attendance_percent=95.0,
            pre_score=41.0,
            post_score=72.0,
        )
        session.add(part)
        await session.commit()
        break

    # 6. Record Closed-Loop Outcomes (+31% improvement, verified evidence in Student Skill Passport)
    outcome_payload = {
        "registered_count": 80,
        "attended_count": 76,
        "completed_count": 72,
        "feedback_rating": 4.85,
        "pre_workshop_readiness": 41.0,
        "post_workshop_readiness": 72.0,
        "skills_certified": ["MLOps"],
        "participant_student_ids": [str(student_id)],
        "notes": "Verified closed-loop outcome recorded.",
    }

    res_outcomes = await api_client.post(
        f"/academician/trainings/{training_id}/record-outcomes",
        json=outcome_payload,
        headers=headers,
    )
    assert res_outcomes.status_code == 200
    outcome_res = res_outcomes.json()
    assert "successfully" in outcome_res["status"].lower()
    assert outcome_res["delta_readiness"] == pytest.approx(31.0, 0.5)
    assert outcome_res["students_impacted"] == 72

    # 7. Verify Evidence and StudentSkill in Student Passport
    async for session in override():
        evidence_records = (
            await session.scalars(select(Evidence).where(Evidence.student_id == student_id))
        ).all()
        assert len(evidence_records) >= 1
        assert "Hands-on MLOps & Production Deployment Workshop" in evidence_records[0].description

        skill_records = (
            await session.scalars(select(StudentSkill).where(StudentSkill.student_id == student_id))
        ).all()
        assert len(skill_records) >= 1
        assert skill_records[0].verification_tier == VerificationTier.verified
        break
