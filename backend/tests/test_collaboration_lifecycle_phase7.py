import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Academician,
    Evidence,
    FacultyApplication,
    FacultyOpportunity,
    ProjectApplication,
    Recruiter,
    Role,
    Skill,
    Student,
    StudentSkill,
)


@pytest_asyncio.fixture
async def phase7_client():
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
        owner = Recruiter(email="owner-phase7@example.com", password_hash="hash", company_name="Industry Labs")
        outsider = Recruiter(email="outsider-phase7@example.com", password_hash="hash", company_name="Other Labs")
        student = Student(email="student-phase7@example.com", password_hash="hash", full_name="Student", university="University")
        other_student = Student(email="other-student-phase7@example.com", password_hash="hash", full_name="Other", university="University")
        faculty = Academician(email="faculty-phase7@example.com", password_hash="hash", full_name="Faculty One", institution_name="University", department="CSE", designation="Professor")
        other_faculty = Academician(email="other-faculty-phase7@example.com", password_hash="hash", full_name="Faculty Two", institution_name="University", department="ECE", designation="Professor")
        python = Skill(canonical_name="Python Phase7", category="technical", aliases=[])
        arbitrary = Skill(canonical_name="Arbitrary Phase7", category="technical", aliases=[])
        session.add_all([owner, outsider, student, other_student, faculty, other_faculty, python, arbitrary])
        await session.flush()
        opportunity = FacultyOpportunity(
            title="Industry Research Collaboration", opportunity_type="research_grant",
            organization_name=owner.company_name, description="Governed research collaboration.",
            domain="AI", duration_weeks=4, status="open", created_by_recruiter_id=owner.id,
        )
        other_opportunity = FacultyOpportunity(
            title="Second Collaboration", opportunity_type="consultancy_request",
            organization_name=owner.company_name, description="Second governed collaboration.",
            domain="Cloud", duration_weeks=3, status="open", created_by_recruiter_id=owner.id,
        )
        session.add_all([opportunity, other_opportunity])
        await session.commit()
        return {
            "owner": owner.id, "outsider": outsider.id, "student": student.id,
            "other_student": other_student.id, "faculty": faculty.id,
            "other_faculty": other_faculty.id, "python": python.id,
            "arbitrary": arbitrary.id, "opportunity": opportunity.id,
            "other_opportunity": other_opportunity.id,
        }


def _challenge_payload(data):
    now = datetime.now(UTC)
    return {
        "challenge_type": "live_project",
        "title": "Auditable AI Delivery Project",
        "problem_statement": "Build an evidence-backed delivery system for industry.",
        "prize_pool": "Certificate",
        "team_size": 1,
        "duration_weeks": 4,
        "deadline": (now + timedelta(days=10)).isoformat(),
        "start_date": (now + timedelta(days=11)).isoformat(),
        "end_date": (now + timedelta(days=40)).isoformat(),
        "participant_capacity": 10,
        "outcome_criteria": ["Working audited implementation"],
        "requirements": [{"skill_id": str(data["python"]), "requirement_type": "required", "weight": 2}],
    }


@pytest.mark.asyncio
async def test_recruiter_crud_publication_ownership_and_canonical_validation(phase7_client):
    client, factory = phase7_client
    data = await _seed(factory)
    owner = _headers(data["owner"], Role.recruiter)
    outsider = _headers(data["outsider"], Role.recruiter)

    invalid = _challenge_payload(data)
    invalid["requirements"] = [{"skill_id": str(uuid.uuid4()), "requirement_type": "required", "weight": 1}]
    assert (await client.post("/collaborations/recruiter/challenges", json=invalid, headers=owner)).status_code == 409
    created = await client.post("/collaborations/recruiter/challenges", json=_challenge_payload(data), headers=owner)
    assert created.status_code == 201
    challenge_id = created.json()["id"]
    assert created.json()["status"] == "draft"
    assert (await client.get("/collaborations/challenges")).json() == []
    assert (await client.patch(f"/collaborations/recruiter/challenges/{challenge_id}", json={"title": "Stolen"}, headers=outsider)).status_code == 403
    edited = await client.patch(f"/collaborations/recruiter/challenges/{challenge_id}", json={"title": "Auditable Industry AI Project"}, headers=owner)
    assert edited.status_code == 200
    published = await client.post(f"/collaborations/recruiter/challenges/{challenge_id}/publish", headers=owner)
    assert published.status_code == 200
    public = await client.get("/collaborations/challenges")
    assert [row["id"] for row in public.json()] == [challenge_id]
    closed = await client.post(f"/collaborations/recruiter/challenges/{challenge_id}/close", headers=owner)
    assert closed.json()["status"] == "closed"
    assert (await client.get("/collaborations/challenges")).json() == []


@pytest.mark.asyncio
async def test_project_lifecycle_feedback_evidence_and_replay_idempotency(phase7_client):
    client, factory = phase7_client
    data = await _seed(factory)
    owner = _headers(data["owner"], Role.recruiter)
    student = _headers(data["student"], Role.student)
    other_student = _headers(data["other_student"], Role.student)
    created = (await client.post("/collaborations/recruiter/challenges", json=_challenge_payload(data), headers=owner)).json()
    challenge_id = created["id"]
    await client.post(f"/collaborations/recruiter/challenges/{challenge_id}/publish", headers=owner)
    application = await client.post("/collaborations/projects/apply", json={"challenge_id": challenge_id, "team_members": [], "submission_notes": "Ready"}, headers=student)
    assert application.status_code == 201
    application_id = application.json()["id"]
    assert (await client.post("/collaborations/projects/apply", json={"challenge_id": challenge_id}, headers=student)).status_code == 409
    assert (await client.post(f"/collaborations/projects/{application_id}/submit", json={"submission_url": "https://example.com/work"}, headers=student)).status_code == 409
    assert (await client.post(f"/collaborations/recruiter/applications/{application_id}/transition", json={"status": "active"}, headers=owner)).status_code == 409
    for target in ("shortlisted", "selected", "active"):
        response = await client.post(f"/collaborations/recruiter/applications/{application_id}/transition", json={"status": target}, headers=owner)
        assert response.status_code == 200
    assert (await client.post(f"/collaborations/projects/{application_id}/submit", json={"submission_url": "https://example.com/work", "submission_notes": "Delivered"}, headers=other_student)).status_code == 403
    submitted = await client.post(f"/collaborations/projects/{application_id}/submit", json={"submission_url": "https://example.com/work", "submission_notes": "Delivered"}, headers=student)
    assert submitted.json()["status"] == "submitted"
    arbitrary_feedback = {"rating": 5, "comment": "Good", "observed_outcome": "Delivered", "skill_feedback": [{"skill_id": str(data["arbitrary"]), "rating": 5, "comment": "No", "observed_outcome": "Not configured"}]}
    assert (await client.post(f"/collaborations/recruiter/applications/{application_id}/feedback", json=arbitrary_feedback, headers=owner)).status_code == 409
    feedback = {"rating": 5, "comment": "Production quality", "observed_outcome": "Audited delivery", "skill_feedback": [{"skill_id": str(data["python"]), "rating": 5, "comment": "Strong implementation", "observed_outcome": "Built the audited Python service"}]}
    assert (await client.post(f"/collaborations/recruiter/applications/{application_id}/feedback", json=feedback, headers=owner)).status_code == 200
    completed = await client.post(f"/collaborations/recruiter/applications/{application_id}/complete", json={"outcome_summary": "Delivered and verified by the industry owner."}, headers=owner)
    assert completed.status_code == 200
    evidence_id = completed.json()["completion_evidence_id"]
    replay = await client.post(f"/collaborations/recruiter/applications/{application_id}/complete", json={"outcome_summary": "Replay"}, headers=owner)
    assert replay.json()["completion_evidence_id"] == evidence_id
    async with factory() as session:
        assert await session.scalar(select(func.count(Evidence.id)).where(Evidence.id == uuid.UUID(evidence_id))) == 1
        assert await session.scalar(select(func.count(StudentSkill.id)).where(StudentSkill.source_evidence_id == uuid.UUID(evidence_id))) == 1
        app_row = await session.get(ProjectApplication, uuid.UUID(application_id))
        assert app_row is not None and app_row.status == "completed"


@pytest.mark.asyncio
async def test_faculty_invitation_lifecycle_and_cross_role_isolation(phase7_client):
    client, factory = phase7_client
    data = await _seed(factory)
    owner = _headers(data["owner"], Role.recruiter)
    outsider = _headers(data["outsider"], Role.recruiter)
    faculty = _headers(data["faculty"], Role.academician)
    other_faculty = _headers(data["other_faculty"], Role.academician)
    payload = {"academician_id": str(data["faculty"]), "faculty_opportunity_id": str(data["opportunity"]), "message": "Join our governed research collaboration."}
    created = await client.post("/collaborations/recruiter/invitations", json=payload, headers=owner)
    assert created.status_code == 201
    invitation_id = created.json()["id"]
    assert (await client.post("/collaborations/recruiter/invitations", json=payload, headers=owner)).status_code == 409
    assert (await client.post("/collaborations/recruiter/invitations", json=payload, headers=outsider)).status_code == 403
    listed = await client.get("/collaborations/invitations/me", headers=faculty)
    assert [row["id"] for row in listed.json()] == [invitation_id]
    assert (await client.post(f"/collaborations/invitations/{invitation_id}/accept", headers=other_faculty)).status_code == 403
    accepted = await client.post(f"/collaborations/invitations/{invitation_id}/accept", headers=faculty)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"
    async with factory() as session:
        accepted_application = await session.scalar(
            select(FacultyApplication).where(
                FacultyApplication.faculty_id == data["faculty"],
                FacultyApplication.opportunity_id == data["opportunity"],
            )
        )
        assert accepted_application is not None
        assert accepted_application.status == "accepted"
    decline_payload = {"academician_id": str(data["faculty"]), "faculty_opportunity_id": str(data["other_opportunity"]), "message": "Join a second collaboration."}
    second = (await client.post("/collaborations/recruiter/invitations", json=decline_payload, headers=owner)).json()
    declined = await client.post(f"/collaborations/invitations/{second['id']}/decline", headers=faculty)
    assert declined.json()["status"] == "declined"
