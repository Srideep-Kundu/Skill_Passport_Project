import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import pytest_asyncio
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import (
    Academician,
    Evidence,
    Institution,
    InstitutionInterventionPlan,
    Role,
    StudentSkill,
    TrainingOutcomeMetric,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def planner_fixture():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    faculty_id, other_id, institution_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    async with factory() as session:
        session.add_all([
            Academician(id=faculty_id, email="planner@demo.edu", password_hash=hash_password("DemoPassword123"), full_name="Dr. Planner", institution_name="Demo Institute", department="CSE", designation="Professor", technical_skills=["Python"]),
            Academician(id=other_id, email="other@demo.edu", password_hash=hash_password("DemoPassword123"), full_name="Dr. Other", institution_name="Demo Institute", department="CSE", designation="Professor"),
            Institution(id=institution_id, email="institution@demo.edu", password_hash=hash_password("DemoPassword123"), institution_name="Demo Institute", institution_code="DEMO-1", departments=["CSE"]),
            InstitutionInterventionPlan(institution_id=institution_id, title="Cloud Readiness Workshop", skill_cluster="Cloud Computing", department="CSE", target_students_count=80, baseline_supply_index=35, target_supply_index=80),
        ])
        await session.commit()

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client, factory, faculty_id, other_id
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_training_planner_lifecycle_preserves_skill_provenance(planner_fixture):
    client, factory, faculty_id, other_id = planner_fixture
    headers = {"Authorization": f"Bearer {create_access_token(str(faculty_id), role=Role.academician.value)}"}
    recommendations = await client.get("/academician/training-recommendations", headers=headers)
    assert recommendations.status_code == 200
    assert recommendations.json()[0]["gap_percentage"] == 45
    assert "Persisted cohort analytics" in recommendations.json()[0]["why_recommended"]

    start = datetime.now(UTC) + timedelta(days=30)
    created = await client.post("/academician/trainings", headers=headers, json={
        "title": "Cloud and MLOps Workshop", "objective": "Close measured cloud deployment skill gaps.",
        "program_type": "Hands-on Workshop", "target_cohort": "CSE placement cohort", "target_department": "CSE",
        "target_year": "3rd Year", "target_skill": "Cloud Computing, MLOps", "expected_participants": 80,
        "trainer_type": "Industry Professional", "trainer_name": "Aarav Menon", "trainer_organization": "TechNova",
        "infrastructure_requirements": ["Computer Lab", "GPU Lab", "High-speed Internet"],
        "lab_systems_required": 80, "lab_systems_available": 60,
        "budget_breakdown": {"trainer_fee": 20000, "venue": 5000, "food": 10000, "certificates": 2000, "marketing": 3000, "equipment": 5000, "software": 5000},
        "confirmed_funding": 25000, "start_date": start.isoformat(), "end_date": (start + timedelta(days=2)).isoformat(),
    })
    assert created.status_code == 201
    body = created.json()
    assert body["total_estimated_budget"] == 50000
    assert body["funding_gap"] == 25000
    assert body["notice_status"] == "TIGHT"  # Five pending setup tasks tighten an otherwise healthy date buffer.
    assert body["capacity_diagnostic"]["capacity_gap"] == 20
    assert set(body["marketing_kit"]) == {"poster_content", "email_announcement", "whatsapp_announcement", "linkedin_caption", "registration_page_copy"}

    managed = await client.patch(f"/academician/trainings/{body['id']}", headers=headers, json={
        "status": "registration_open",
        "preparation_tasks": [{"id": "approval", "title": "Institution approval", "status": "completed"}],
        "confirmed_funding": 40000,
        "campaign_metrics": {"emails_sent": 120, "registrations": 32},
    })
    assert managed.status_code == 200
    assert managed.json()["notice_status"] == "GOOD"
    assert managed.json()["funding_gap"] == 10000

    other_headers = {"Authorization": f"Bearer {create_access_token(str(other_id), role=Role.academician.value)}"}
    assert (await client.get(f"/academician/trainings/{body['id']}", headers=other_headers)).status_code == 404

    outcomes = await client.post(f"/academician/trainings/{body['id']}/record-outcomes", headers=headers, json={
        "skill_name": "Cloud Computing", "pre_score": 41, "post_score": 72, "cohort_name": "CSE 3rd Year",
        "registered_count": 80, "attendance_count": 76, "completion_count": 70, "feedback_rating": 4.7,
    })
    assert outcomes.status_code == 200
    assert outcomes.json()["outcomes"][0]["improvement_percentage"] == 31
    assert outcomes.json()["outcomes"][0]["evidence_records_created"] == 0
    async with factory() as session:
        assert await session.scalar(select(func.count(Evidence.id))) == 0
        assert await session.scalar(select(func.count(StudentSkill.id))) == 0
        assert await session.scalar(select(func.count(TrainingOutcomeMetric.id))) == 1
