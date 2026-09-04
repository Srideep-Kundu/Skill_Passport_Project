import uuid
from datetime import UTC, datetime, timedelta
import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import (
    Academician,
    FundingOpportunity,
    IndustryExpert,
    ProfessionalSociety,
    Role,
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
async def test_collaboration_funding_hub_flow(api_client: httpx.AsyncClient):
    # 1. Create Academician
    faculty_id = uuid.uuid4()
    faculty_user = Academician(
        id=faculty_id,
        email="prof.sharma@testuniv.edu",
        password_hash=hash_password("FacultySecret123"),
        full_name="Prof. Sharma",
        department="Computer Science",
        designation="Associate Professor",
        institution_name="Test University",
        research_areas=["Artificial Intelligence", "Machine Learning", "Cloud Computing"],
        collaboration_availability="available",
        created_at=datetime.now(UTC),
    )

    # 2. Seed Society, Expert, Funding
    soc_id = uuid.uuid4()
    society = ProfessionalSociety(
        id=soc_id,
        name="IEEE Computer Society",
        short_name="IEEE_CS",
        description="Global computing society supporting workshops, conferences, and student chapters.",
        website="https://computer.org",
        domains=["Artificial Intelligence", "Machine Learning", "Software Engineering"],
        membership_fee="₹4,500 / year",
        benefits=["Up to ₹50,000 student chapter grants", "Distinguished Visitor Program speakers"],
        available_programs=["Distinguished Visitor Program", "Student Branch Workshop Grants"],
        expert_speakers=[{"name": "Dr. Arvind Swaminathan", "topic": "AI Architecture"}],
        contact_email="chapters@computer.org",
        proposal_guidelines="Submit at least 14 days before event date.",
        sponsorship_available=True,
    )

    expert_id = uuid.uuid4()
    expert = IndustryExpert(
        id=expert_id,
        name="Dr. Arvind Swaminathan",
        title="Principal AI Architect",
        organization="Google DeepMind",
        bio="Specialist in distributed training and scalable machine learning systems.",
        expertise_tags=["Artificial Intelligence", "Machine Learning", "MLOps"],
        experience_years=14,
        availability="available",
        speaking_fee="Honorarium (Standard AICTE / Institutional)",
        rating=4.95,
        past_sessions_count=32,
        email="arvind.deepmind@example.com",
    )

    fund_id = uuid.uuid4()
    funding = FundingOpportunity(
        id=fund_id,
        title="AICTE ATAL Faculty Development & Workshop Grant",
        funding_organization="AICTE India",
        grant_type="workshop_grant",
        amount="₹3,00,000",
        amount_numeric=300000.0,
        deadline=datetime.now(UTC) + timedelta(days=25),
        eligibility="Faculty members of AICTE-approved engineering institutions.",
        supported_domains=["Artificial Intelligence", "Machine Learning", "Cybersecurity"],
        required_documents=["Proposal Form", "Institutional Endorsement", "Curriculum Syllabus"],
        source_url="https://atalacademy.aicte-india.org",
        match_reason_template="Matches your department's AI/ML focus.",
        is_active=True,
    )

    override = app.dependency_overrides[get_session]
    async for session in override():
        session.add_all([faculty_user, society, expert, funding])
        await session.commit()
        break

    token = create_access_token(str(faculty_id), role=Role.academician.value)
    headers = {"Authorization": f"Bearer {token}"}

    # 3. List Societies & Detail
    res_soc = await api_client.get("/academician/societies", headers=headers)
    assert res_soc.status_code == 200
    societies_data = res_soc.json()["items"]
    assert len(societies_data) >= 1
    assert societies_data[0]["name"] == "IEEE Computer Society"

    res_soc_detail = await api_client.get(f"/academician/societies/{soc_id}", headers=headers)
    assert res_soc_detail.status_code == 200
    assert res_soc_detail.json()["short_name"] == "IEEE_CS"

    # 4. List Experts
    res_exp = await api_client.get("/academician/experts", headers=headers)
    assert res_exp.status_code == 200
    experts_data = res_exp.json()["items"]
    assert len(experts_data) >= 1
    assert experts_data[0]["name"] == "Dr. Arvind Swaminathan"

    # 5. List Funding Opportunities & Explainable Recommendations
    res_fund = await api_client.get("/academician/funding", headers=headers)
    assert res_fund.status_code == 200
    assert len(res_fund.json()["items"]) >= 1

    res_rec = await api_client.get("/academician/funding/recommended", headers=headers)
    assert res_rec.status_code == 200
    recs = res_rec.json()
    assert len(recs) >= 1
    assert "why_recommended" in recs[0]
    assert "match_score" in recs[0]

    # 6. Create Proposal (Draft -> Submitted -> Under Review -> Accepted)
    prop_payload = {
        "society_id": str(soc_id),
        "title": "IEEE Hands-on Workshop on Machine Learning Deployment",
        "objective": "Address 61% student skill gap in MLOps and production inference.",
        "event_type": "workshop",
        "target_audience": "3rd Year CSE",
        "expected_participants": 80,
        "duration_days": 2,
        "required_funding": "₹45,000",
        "funding_amount_numeric": 45000.0,
        "proposed_dates": "15-16 October 2026",
        "infrastructure_needed": ["60-system Computer Lab", "100 Mbps connection"],
        "expected_outcomes": ["80 certified students with verified skill passports."],
        "budget_breakdown": {"trainer_fee": 20000, "kits": 5000, "infra": 20000},
    }

    res_create_prop = await api_client.post("/academician/proposals", json=prop_payload, headers=headers)
    assert res_create_prop.status_code == 201
    created_prop = res_create_prop.json()
    assert created_prop["title"] == prop_payload["title"]
    assert created_prop["status"] in ["draft", "submitted"]
    prop_id = created_prop["id"]

    # 7. List Proposals
    res_list_props = await api_client.get("/academician/proposals", headers=headers)
    assert res_list_props.status_code == 200
    assert len(res_list_props.json()["items"]) >= 1

    # 8. Transition Proposal Status & verify audit events
    status_update_payload = {
        "status": "under_review",
        "reviewer_feedback": "Under technical committee review for chapter sponsorship.",
        "actor_name": "IEEE Section Reviewer",
    }
    res_status = await api_client.patch(
        f"/academician/proposals/{prop_id}/status",
        json=status_update_payload,
        headers=headers,
    )
    assert res_status.status_code == 200
    assert res_status.json()["status"] == "under_review"
    assert len(res_status.json()["events"]) >= 1

    # Transition to accepted
    res_accept = await api_client.patch(
        f"/academician/proposals/{prop_id}/status",
        json={"status": "accepted", "reviewer_feedback": "Proposal approved by IEEE Section.", "actor_name": "IEEE Chair"},
        headers=headers,
    )
    assert res_accept.status_code == 200
    assert res_accept.json()["status"] == "accepted"
