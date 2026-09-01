import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Evidence,
    EvidenceType,
    ExtractionStatus,
    Institution,
    InstitutionActionPlan,
    InstitutionInterventionPlan,
    Internship,
    InternshipEngagement,
    InternshipRequirement,
    Recruiter,
    Role,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.services.demand_supply_service import backfill_institution_memberships


@pytest_asyncio.fixture
async def phase6_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


def _headers(subject: uuid.UUID, role: Role) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(subject, role.value)}"}


async def _seed(factory):
    async with factory() as session:
        institution = Institution(
            email="institution@example.com",
            password_hash="hash",
            institution_name="Scope University",
            institution_code="SCOPE",
            departments=["CSE", "ECE"],
        )
        other_institution = Institution(
            email="other-institution@example.com",
            password_hash="hash",
            institution_name="Other University",
            institution_code="OTHER",
            departments=["CSE"],
        )
        recruiter = Recruiter(
            email="owner@example.com", password_hash="hash", company_name="Owner Co"
        )
        other_recruiter = Recruiter(
            email="other@example.com", password_hash="hash", company_name="Other Co"
        )
        python = Skill(canonical_name="Python Phase6", category="technical", aliases=[])
        session.add_all([institution, other_institution, recruiter, other_recruiter, python])
        await session.flush()
        assigned = Student(
            email="assigned@example.com", password_hash="hash", full_name="Assigned",
            university="legacy text does not matter", institution_id=institution.id,
            department="CSE", cohort_year=2026, roll_number="001",
        )
        other = Student(
            email="other-student@example.com", password_hash="hash", full_name="Other",
            university="Scope University", institution_id=other_institution.id,
            department="CSE", cohort_year=2026, roll_number="001",
        )
        unassigned = Student(
            email="unassigned@example.com", password_hash="hash", full_name="Unassigned",
            university="Scope University", department="CSE", cohort_year=2026,
        )
        session.add_all([assigned, other, unassigned])
        await session.flush()
        for student in (assigned, other):
            evidence = Evidence(
                student_id=student.id, evidence_type=EvidenceType.project,
                title="Python evidence", description="Built a Python service.",
                extraction_status=ExtractionStatus.extracted,
            )
            session.add(evidence)
            await session.flush()
            session.add(StudentSkill(
                student_id=student.id, skill_id=python.id, source_evidence_id=evidence.id,
                extraction_confidence=0.9, verification_tier=VerificationTier.verified,
                evidence_span="Python",
            ))
        internship = Internship(
            recruiter_id=recruiter.id, title="Backend", description="Python backend",
            is_published=True,
        )
        hidden_internship = Internship(
            recruiter_id=other_recruiter.id, title="Other", description="Other Python",
            is_published=True,
        )
        session.add_all([internship, hidden_internship])
        await session.flush()
        session.add_all([
            InternshipRequirement(internship_id=internship.id, skill_id=python.id, is_required=True, weight=2),
            InternshipRequirement(internship_id=hidden_internship.id, skill_id=python.id, is_required=True, weight=5),
            InternshipEngagement(internship_id=internship.id, student_id=assigned.id, recruiter_id=recruiter.id),
        ])
        await session.commit()
        return institution.id, other_institution.id, recruiter.id, assigned.id, unassigned.id


@pytest.mark.asyncio
async def test_institution_supply_is_fk_scoped_and_filterable(phase6_client):
    client, factory = phase6_client
    institution_id, _other_id, _recruiter_id, _assigned_id, _unassigned_id = await _seed(factory)
    response = await client.get("/institution/demand-supply", headers=_headers(institution_id, Role.institution))
    assert response.status_code == 200
    body = response.json()
    assert body["assigned_students"] == 1
    assert body["skills"][0]["student_supply"] == 1
    filtered = await client.get("/institution/demand-supply?department=ECE", headers=_headers(institution_id, Role.institution))
    assert filtered.json()["assigned_students"] == 0
    assert filtered.json()["skills"][0]["student_supply"] == 0


@pytest.mark.asyncio
async def test_recruiter_supply_is_authorized_and_company_scoped(phase6_client):
    client, factory = phase6_client
    _institution_id, _other_id, recruiter_id, _assigned_id, _unassigned_id = await _seed(factory)
    response = await client.get("/recruiter-analytics/me/demand", headers=_headers(recruiter_id, Role.recruiter))
    assert response.status_code == 200
    body = response.json()
    assert body["active_opportunities"] == 1
    assert body["authorized_candidate_pool"] == 1
    assert body["skills"] == [body["skills"][0]]
    assert body["skills"][0]["demand_count"] == 1
    assert body["skills"][0]["weighted_demand"] == 2.0
    assert body["skills"][0]["qualified_supply"] == 1
    assert body["skills"][0]["trend_available"] is False


@pytest.mark.asyncio
async def test_conservative_backfill_rejects_ambiguous_names(phase6_client):
    _client, factory = phase6_client
    async with factory() as session:
        session.add_all([
            Institution(email="a@example.com", password_hash="hash", institution_name="Duplicate University", institution_code="DU-A", departments=[]),
            Institution(email="b@example.com", password_hash="hash", institution_name=" duplicate   university ", institution_code="DU-B", departments=[]),
        ])
        student = Student(email="legacy@example.com", password_hash="hash", full_name="Legacy", university="Duplicate University", graduation_year=2027)
        session.add(student)
        await session.flush()
        assert await backfill_institution_memberships(session) == 0
        assert student.institution_id is None
        assert student.cohort_year == 2027


@pytest.mark.asyncio
async def test_institution_empty_state_has_no_fabricated_metrics_or_get_side_writes(
    phase6_client,
):
    client, factory = phase6_client
    async with factory() as session:
        institution = Institution(
            email="empty@example.com",
            password_hash="hash",
            institution_name="Empty University",
            institution_code="EMPTY",
            departments=["CSE"],
        )
        session.add(institution)
        await session.commit()
        await session.refresh(institution)
        institution_id = institution.id

    headers = _headers(institution_id, Role.institution)
    overview = (await client.get("/institution/analytics", headers=headers)).json()
    assert overview["total_students"] == 0
    assert overview["top_skills_distribution"] == []
    assert overview["market_skill_demand_gaps"] == []
    assert (await client.get("/institution/interventions/recommendations", headers=headers)).json() == []
    assert (await client.get("/institution/curriculum-recommendations", headers=headers)).json() == []
    assert (await client.get("/institution/cohorts", headers=headers)).json()["cohorts"] == []
    assert (await client.get("/institution/action-plans", headers=headers)).json() == []
    assert (await client.get("/institution/interventions", headers=headers)).json() == []

    async with factory() as session:
        assert await session.scalar(select(func.count(InstitutionActionPlan.id))) == 0
        assert await session.scalar(select(func.count(InstitutionInterventionPlan.id))) == 0


@pytest.mark.asyncio
async def test_recommendation_is_derived_from_persisted_demand_and_supply(
    phase6_client,
):
    client, factory = phase6_client
    institution_id, _other_id, recruiter_id, _student_id, _unassigned_id = await _seed(factory)
    async with factory() as session:
        skill = await session.scalar(select(Skill).where(Skill.canonical_name == "Python Phase6"))
        assert skill is not None
        second = Internship(
            recruiter_id=recruiter_id,
            title="Second backend role",
            description="Additional persisted Python demand",
            is_published=True,
        )
        session.add(second)
        await session.flush()
        session.add(
            InternshipRequirement(
                internship_id=second.id,
                skill_id=skill.id,
                is_required=True,
                weight=1,
            )
        )
        await session.commit()

    headers = _headers(institution_id, Role.institution)
    recommendations = (
        await client.get("/institution/interventions/recommendations", headers=headers)
    ).json()
    assert len(recommendations) == 1
    recommendation = recommendations[0]
    assert recommendation["skill"] == "Python Phase6"
    assert recommendation["industry_demand_index"] == 3.0
    assert recommendation["student_supply_index"] == 1.0
    assert recommendation["recommended_courses"][0]["source"] == "persisted demand-supply shortage"
