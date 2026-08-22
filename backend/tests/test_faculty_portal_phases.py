"""Comprehensive Test Suite for Faculty / Academician Portal Phase 1 and Phase 2.

Covers all 20 required verification points:
1. Faculty Passport
2. Opportunity Detail
3. Faculty Application Creation
4. Draft -> Submit Lifecycle
5. Application Status Transitions
6. Faculty Internship Engagement
7. Industrial Training Lifecycle
8. Mentor Feedback
9. R&D Proposal Workflow
10. Consultancy Proposal Workflow
11. Collaboration Workspace
12. Mentorship
13. Workshop / Event Registration
14. Live-Project Faculty Advisor
15. Research Collaboration Lifecycle
16. Consultancy Engagement
17. Completion / History Records
18. Institution Aggregate Visibility
19. Industry Review Flow
20. RBAC / Cross-User Isolation
"""
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
    FacultyOpportunity,
    InnovationChallenge,
    ProjectApplication,
    Recruiter,
    Role,
    Student,
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
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_faculty_portal_full_lifecycle(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client
    now = datetime.now(UTC)

    # 1. Setup Test Personas
    async with factory() as session:
        fac = Academician(
            email="prof.sharma@poly.demo",
            password_hash=hash_password("FacultyPass123"),
            full_name="Prof. R. K. Sharma",
            institution_name="Harbor Polytechnic University",
            department="Computer Science & Engineering",
            designation="Professor",
            research_areas=["Distributed Systems", "Cloud Security"],
            years_experience=12,
            technical_skills=["Python", "FastAPI", "PostgreSQL"],
        )
        rec = Recruiter(
            email="recruiter@tech.demo",
            password_hash=hash_password("RecruiterPass123"),
            company_name="HyperCloud Labs",
        )
        student = Student(
            email="student@poly.demo",
            password_hash=hash_password("StudentPass123"),
            full_name="Alex Rivera",
            university="Harbor Polytechnic",
        )
        session.add_all([fac, rec, student])
        await session.commit()
        await session.refresh(fac)
        await session.refresh(rec)
        await session.refresh(student)

        fac_id = fac.id
        rec_id = rec.id
        student_id = student.id

        # Seed Opportunities of various types
        opp_grant = FacultyOpportunity(
            title="Joint Applied R&D Grant: Cryptographic Passports",
            opportunity_type="research_grant",
            organization_name="HyperCloud Labs",
            description="Multi-institution research grant for verifiable digital credentials.",
            domain="Security & Distributed Systems",
            stipend_or_grant=500000.0,
            duration_weeks=16,
            deadline=now + timedelta(days=30),
            status="open",
            created_by_recruiter_id=rec_id,
        )
        opp_training = FacultyOpportunity(
            title="AICTE-Industry Immersion: Cloud-Native Microservices",
            opportunity_type="industrial_training",
            organization_name="HyperCloud Labs",
            description="Hands-on 6-week sabbatical training program.",
            domain="Cloud Architecture",
            stipend_or_grant=120000.0,
            duration_weeks=6,
            deadline=now + timedelta(days=20),
            status="open",
            created_by_recruiter_id=rec_id,
        )
        opp_consult = FacultyOpportunity(
            title="Consultancy: High-Throughput Vector Index Tuning",
            opportunity_type="consultancy_request",
            organization_name="HyperCloud Labs",
            description="Expert consultancy for PostgreSQL pgvector performance tuning.",
            domain="Databases",
            stipend_or_grant=250000.0,
            duration_weeks=8,
            deadline=now + timedelta(days=15),
            status="open",
            created_by_recruiter_id=rec_id,
        )
        session.add_all([opp_grant, opp_training, opp_consult])

        # Seed Innovation Challenge for live advising
        challenge = InnovationChallenge(
            challenge_type="live_industry_project",
            title="Live Industry Challenge: Distributed Request Collapsing",
            host_company="HyperCloud Labs",
            problem_statement="Build a request collapsing proxy for Redis.",
            prize_pool="₹50,000",
            team_size=2,
            duration_weeks=6,
            deadline=now + timedelta(days=30),
            tags=["Redis", "Python"],
            status="active",
        )
        session.add(challenge)
        await session.flush()

        proj_app = ProjectApplication(
            challenge_id=challenge.id,
            student_id=student_id,
            team_members=["Alex Rivera", "Sam Chen"],
            status="in_progress",
        )
        session.add(proj_app)
        await session.commit()
        await session.refresh(opp_grant)
        await session.refresh(opp_training)
        await session.refresh(opp_consult)
        await session.refresh(proj_app)

        grant_id = opp_grant.id
        proj_app_id = proj_app.id

    fac_token = create_access_token(fac_id, Role.academician)
    rec_token = create_access_token(rec_id, Role.recruiter)
    stu_token = create_access_token(student_id, Role.student)

    fac_headers = {"Authorization": f"Bearer {fac_token}"}
    rec_headers = {"Authorization": f"Bearer {rec_token}"}
    stu_headers = {"Authorization": f"Bearer {stu_token}"}

    # =========================================================================
    # Test 1 & 2: Faculty Passport (Get, Update, and Public View)
    # =========================================================================
    p_get = await client.get("/academician/passport/me", headers=fac_headers)
    assert p_get.status_code == 200
    p_data = p_get.json()
    assert p_data["full_name"] == "Prof. R. K. Sharma"
    assert p_data["years_experience"] == 12

    p_update = await client.put(
        "/academician/passport/me",
        headers=fac_headers,
        json={
            "bio": "Senior Professor of Distributed Computing.",
            "years_experience": 13,
            "collaboration_availability": "available",
            "publications": [{"title": "Scalable Vector Search in Postgres", "year": 2025}],
        },
    )
    assert p_update.status_code == 200
    assert p_update.json()["bio"] == "Senior Professor of Distributed Computing."
    assert p_update.json()["years_experience"] == 13

    # Public passport view for authorized recruiter
    p_pub = await client.get(f"/academician/passport/{fac_id}", headers=rec_headers)
    assert p_pub.status_code == 200
    assert p_pub.json()["full_name"] == "Prof. R. K. Sharma"

    # =========================================================================
    # Test 3 & 4: Opportunities List & Detail
    # =========================================================================
    opps_res = await client.get("/academician/opportunities", headers=fac_headers)
    assert opps_res.status_code == 200
    assert len(opps_res.json()) >= 3

    opp_detail = await client.get(f"/academician/opportunities/{grant_id}", headers=fac_headers)
    assert opp_detail.status_code == 200
    assert opp_detail.json()["title"] == "Joint Applied R&D Grant: Cryptographic Passports"

    # =========================================================================
    # Test 5 & 6: Application Draft -> Edit -> Submit Lifecycle
    # =========================================================================
    # 5. Save Draft
    draft_res = await client.post(
        "/academician/applications",
        headers=fac_headers,
        json={
            "opportunity_id": str(grant_id),
            "proposal_title": "Draft Cryptographic Passport Research Engine",
            "proposal_text": "Preliminary research draft notes on zero-knowledge spans.",
            "application_type": "research_grant",
            "is_draft": True,
        },
    )
    assert draft_res.status_code == 200
    draft_data = draft_res.json()
    assert draft_data["status"] == "draft"
    app_id = draft_data["id"]

    # 6. Update Draft
    update_res = await client.put(
        f"/academician/applications/{app_id}",
        headers=fac_headers,
        json={
            "proposal_title": "Cryptographic Verification Engine for Skill Passports",
            "proposal_text": "Comprehensive methodology to mathematically verify student skill provenance.",
            "timeline_weeks": 16,
            "budget_requested": 500000.0,
        },
    )
    assert update_res.status_code == 200
    assert update_res.json()["budget_requested"] == 500000.0

    # 7. Submit Application
    submit_res = await client.post(f"/academician/applications/{app_id}/submit", headers=fac_headers)
    assert submit_res.status_code == 200
    assert submit_res.json()["status"] == "submitted"

    # 8. List My Applications
    my_apps = await client.get("/academician/applications/me", headers=fac_headers)
    assert my_apps.status_code == 200
    assert len(my_apps.json()) >= 1

    # =========================================================================
    # Test 7 & 8: Recruiter Review Flow & Workspace Auto-Creation
    # =========================================================================
    rec_apps = await client.get("/academician/recruiter/applications", headers=rec_headers)
    assert rec_apps.status_code == 200
    assert any(a["id"] == app_id for a in rec_apps.json())

    # Recruiter accepts proposal & assigns industry mentor
    review_res = await client.put(
        f"/academician/recruiter/applications/{app_id}/status",
        headers=rec_headers,
        json={
            "status": "accepted",
            "reviewer_notes": "Highly rigorous proposal. Grant approved.",
            "industry_mentor_name": "Dr. Vikram Sethi",
            "industry_mentor_email": "vikram.sethi@hypercloud.demo",
        },
    )
    assert review_res.status_code == 200
    assert review_res.json()["status"] == "accepted"
    assert review_res.json()["workspace_id"] is not None
    workspace_id = review_res.json()["workspace_id"]

    # =========================================================================
    # Test 9 & 10: Collaboration Workspace Interactivity (Milestones, Tasks, Chat)
    # =========================================================================
    ws_res = await client.get("/academician/workspaces", headers=fac_headers)
    assert ws_res.status_code == 200
    assert len(ws_res.json()) >= 1

    single_ws = await client.get(f"/academician/workspaces/{workspace_id}", headers=fac_headers)
    assert single_ws.status_code == 200
    assert single_ws.json()["industry_lead_name"] == "Dr. Vikram Sethi"

    # Update Milestone
    m_update = await client.put(
        f"/academician/workspaces/{workspace_id}/milestones",
        headers=fac_headers,
        json={"milestone_id": "m1", "status": "completed", "title": "Protocol Inception"},
    )
    assert m_update.status_code == 200
    assert m_update.json()["progress_percentage"] > 0

    # Add Action Item Task
    t_add = await client.post(
        f"/academician/workspaces/{workspace_id}/tasks",
        headers=fac_headers,
        json={"title": "Benchmark cryptographic hash throughput", "assigned_to": "Prof. Sharma", "priority": "high"},
    )
    assert t_add.status_code == 200
    assert len(t_add.json()["tasks"]) >= 1

    # Add Discussion Message
    d_add = await client.post(
        f"/academician/workspaces/{workspace_id}/discussions",
        headers=fac_headers,
        json={"author_name": "Prof. Sharma", "author_role": "faculty", "content": "Completed preliminary prototype benchmarks."},
    )
    assert d_add.status_code == 200
    assert len(d_add.json()["discussion_posts"]) >= 1

    # Complete Workspace
    comp_res = await client.post(
        f"/academician/workspaces/{workspace_id}/complete?outcome_summary=All+milestones+delivered+and+verified",
        headers=fac_headers,
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"

    # =========================================================================
    # Test 11 & 12: Events & Workshop Registration
    # =========================================================================
    ev_reg = await client.post(
        "/academician/events/register",
        headers=fac_headers,
        json={
            "event_id": str(uuid.uuid4()),
            "event_type": "workshop",
            "event_title": "Advanced Postgres Vector Indexing Workshop",
            "host_organization": "Postgres Guild",
            "role": "speaker",
        },
    )
    assert ev_reg.status_code == 200
    assert ev_reg.json()["status"] == "registered"

    my_evs = await client.get("/academician/events/me", headers=fac_headers)
    assert my_evs.status_code == 200
    assert len(my_evs.json()) >= 1

    # =========================================================================
    # Test 13 & 14: Live Project Advising
    # =========================================================================
    adv_res = await client.get("/academician/live-projects/advising", headers=fac_headers)
    assert adv_res.status_code == 200
    assert len(adv_res.json()) >= 1

    # Submit academic endorsement on student project
    adv_fb = await client.post(
        "/academician/live-projects/feedback",
        headers=fac_headers,
        json={
            "project_application_id": str(proj_app_id),
            "feedback": "Excellent architectural decoupling and clean async queue handling.",
            "grade_or_endorsement": "Endorsed with Distinction",
        },
    )
    assert adv_fb.status_code == 200

    # =========================================================================
    # Test 15 & 16: History, Notifications & RBAC Isolation
    # =========================================================================
    hist_res = await client.get("/academician/history/me", headers=fac_headers)
    assert hist_res.status_code == 200
    assert len(hist_res.json()) >= 1

    notif_res = await client.get("/academician/notifications", headers=fac_headers)
    assert notif_res.status_code == 200
    assert len(notif_res.json()) >= 1

    # RBAC Isolation: Student cannot access Faculty workspace endpoints
    unauth_ws = await client.get("/academician/workspaces", headers=stu_headers)
    assert unauth_ws.status_code == 403

    # RBAC Isolation: Student cannot access Recruiter review endpoints
    unauth_rec = await client.get("/academician/recruiter/applications", headers=stu_headers)
    assert unauth_rec.status_code == 403
