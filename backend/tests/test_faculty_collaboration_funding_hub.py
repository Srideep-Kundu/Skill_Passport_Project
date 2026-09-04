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
    AuditLog,
    FacultyOpportunity,
    Institution,
    InstitutionActionPlan,
    InstitutionInterventionPlan,
    Recruiter,
    Role,
    Student,
)


@pytest_asyncio.fixture
async def hub_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

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


@pytest.mark.asyncio
async def test_hub_discovery_filters_saves_recommendations_and_proposal_lifecycle(hub_client) -> None:
    client, factory = hub_client
    now = datetime.now(UTC)
    async with factory() as session:
        institution = Institution(
            email="institution@example.test",
            password_hash=hash_password("InstitutionPass123"),
            institution_name="Harbor Institute of Technology",
            institution_code="HIT-001",
            departments=["Computer Science"],
        )
        faculty = Academician(
            email="faculty@example.test",
            password_hash=hash_password("FacultyPass123"),
            full_name="Dr. Mira Sen",
            institution_name="Harbor Institute of Technology",
            department="Computer Science",
            designation="Professor",
            research_areas=["Explainable AI", "Machine Learning"],
            technical_skills=["Python", "Data Analytics"],
        )
        other_faculty = Academician(
            email="faculty2@example.test",
            password_hash=hash_password("FacultyPass123"),
            full_name="Dr. Other Faculty",
            institution_name="Another Institute",
            department="Mechanical Engineering",
            designation="Professor",
        )
        recruiter = Recruiter(
            email="partner@example.test",
            password_hash=hash_password("RecruiterPass123"),
            company_name="Applied AI Labs",
        )
        student = Student(
            email="student@example.test",
            password_hash=hash_password("StudentPass123"),
            full_name="Student",
            university="Harbor Institute of Technology",
        )
        session.add_all([institution, faculty, other_faculty, recruiter, student])
        await session.flush()
        session.add_all(
            [
                InstitutionInterventionPlan(
                    institution_id=institution.id,
                    title="Close the Explainable AI student skill gap",
                    skill_cluster="Explainable AI",
                    department="Computer Science",
                    status="in_progress",
                ),
                InstitutionActionPlan(
                    institution_id=institution.id,
                    title="Priority: applied AI research partnerships",
                    action_type="faculty_immersion",
                    source_insight="Increase explainable AI and data analytics capability",
                    status="planned",
                ),
            ]
        )
        grant = FacultyOpportunity(
            title="Explainable AI Applied Research Grant",
            opportunity_type="research_grant",
            discovery_type="funding",
            organization_name="Applied AI Labs",
            description="Funding for explainable machine learning and analytics prototypes.",
            domain="Artificial Intelligence",
            stipend_or_grant=900000,
            duration_weeks=16,
            deadline=now + timedelta(days=30),
            status="open",
            required_expertise=["Explainable AI", "Machine Learning"],
            collaboration_types=["joint_research", "research_grant"],
            profile_metadata={"funding_type": "Grant"},
            created_by_recruiter_id=recruiter.id,
        )
        society = FacultyOpportunity(
            title="Professional Engineering Society Chapter",
            opportunity_type="society_partnership",
            discovery_type="society",
            organization_name="Engineering Society",
            description="An institutional chapter and speaker network.",
            domain="Engineering Education",
            duration_weeks=12,
            deadline=now + timedelta(days=60),
            status="open",
            required_expertise=["Engineering Education"],
            collaboration_types=["chapter_partnership", "expert_speaker"],
        )
        session.add_all([grant, society])
        await session.commit()
        faculty_id = faculty.id
        other_faculty_id = other_faculty.id
        recruiter_id = recruiter.id
        student_id = student.id
        grant_id = grant.id

    faculty_headers = {
        "Authorization": f"Bearer {create_access_token(faculty_id, Role.academician)}"
    }
    other_headers = {
        "Authorization": f"Bearer {create_access_token(other_faculty_id, Role.academician)}"
    }
    recruiter_headers = {
        "Authorization": f"Bearer {create_access_token(recruiter_id, Role.recruiter)}"
    }
    student_headers = {
        "Authorization": f"Bearer {create_access_token(student_id, Role.student)}"
    }

    catalog = await client.get("/academician/hub/opportunities", headers=faculty_headers)
    assert catalog.status_code == 200
    items = catalog.json()
    assert len(items) == 2
    assert items[0]["id"] == str(grant_id)
    assert items[0]["recommendation_version"] == "faculty-hub-v1"
    assert items[0]["recommendation_score"] > items[1]["recommendation_score"]
    assert items[0]["recommendation_components"] == {
        "faculty_expertise": 1.0,
        "student_skill_gaps": 0.5,
        "institution_priorities": 1.0,
    }
    assert any("faculty expertise" in reason for reason in items[0]["why_recommended"])
    assert any("student skill gaps" in reason for reason in items[0]["why_recommended"])

    funding = await client.get(
        "/academician/hub/opportunities",
        params={
            "discovery_type": "funding",
            "minimum_funding": 800000,
            "maximum_funding": 1000000,
            "expertise": "Machine Learning",
            "collaboration_type": "joint_research",
        },
        headers=faculty_headers,
    )
    assert funding.status_code == 200
    assert [item["id"] for item in funding.json()] == [str(grant_id)]

    invalid_range = await client.get(
        "/academician/hub/opportunities",
        params={"minimum_funding": 100, "maximum_funding": 50},
        headers=faculty_headers,
    )
    assert invalid_range.status_code == 422

    saved = await client.put(
        f"/academician/hub/opportunities/{grant_id}/saved", headers=faculty_headers
    )
    assert saved.status_code == 200
    assert saved.json()["is_saved"] is True
    saved_again = await client.put(
        f"/academician/hub/opportunities/{grant_id}/saved", headers=faculty_headers
    )
    assert saved_again.status_code == 200
    saved_only = await client.get(
        "/academician/hub/opportunities",
        params={"saved_only": True},
        headers=faculty_headers,
    )
    assert [item["id"] for item in saved_only.json()] == [str(grant_id)]
    other_saved = await client.get(
        "/academician/hub/opportunities",
        params={"saved_only": True},
        headers=other_headers,
    )
    assert other_saved.json() == []
    assert (
        await client.get("/academician/hub/opportunities", headers=student_headers)
    ).status_code == 403

    draft = await client.post(
        "/academician/applications",
        headers=faculty_headers,
        json={
            "opportunity_id": str(grant_id),
            "proposal_title": "Transparent AI Lab",
            "proposal_text": "A deterministic research and training plan.",
            "application_type": "research_grant",
            "is_draft": True,
        },
    )
    assert draft.status_code == 200
    application_id = draft.json()["id"]
    submitted = await client.post(
        f"/academician/applications/{application_id}/submit", headers=faculty_headers
    )
    assert submitted.json()["status"] == "submitted"
    review = await client.put(
        f"/academician/recruiter/applications/{application_id}/status",
        headers=recruiter_headers,
        json={"status": "under_review", "reviewer_notes": "Panel review started"},
    )
    assert review.status_code == 200
    assert review.json()["status"] == "under_review"
    accepted = await client.put(
        f"/academician/recruiter/applications/{application_id}/status",
        headers=recruiter_headers,
        json={"status": "accepted", "industry_mentor_name": "Ravi Kapoor"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["workspace_id"] is not None

    workspaces = await client.get("/academician/workspaces", headers=faculty_headers)
    assert any(
        workspace["application_id"] == application_id
        and workspace["status"] == "active"
        for workspace in workspaces.json()
    )
    async with factory() as session:
        transitions = (
            await session.scalars(
                select(AuditLog).where(
                    AuditLog.action == "faculty_proposal_status_updated",
                    AuditLog.entity_id == uuid.UUID(application_id),
                )
            )
        ).all()
        assert [entry.details["to_status"] for entry in transitions] == [
            "under_review",
            "accepted",
        ]
