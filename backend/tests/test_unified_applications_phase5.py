import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import auth as auth_api
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusEvent,
    ApplicationStatusSource,
    AuditLog,
    ExternalJob,
    ExternalJobMatch,
    Internship,
    InternshipEngagement,
    PlacementDrive,
    PlacementRegistration,
    PlacementStatusEvent,
    Recruiter,
    ResumeDocument,
    ResumeParseStatus,
    Role,
    Student,
)


@pytest_asyncio.fixture
async def phase5_client(monkeypatch: pytest.MonkeyPatch):
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
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


def _headers(subject: uuid.UUID, role: Role) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(subject, role.value)}"}


async def _setup(factory):
    async with factory() as session:
        owner = Recruiter(
            email=f"owner-{uuid.uuid4()}@example.test",
            password_hash="hash",
            company_name="Owned Company",
        )
        outsider = Recruiter(
            email=f"other-{uuid.uuid4()}@example.test",
            password_hash="hash",
            company_name="Other Company",
        )
        student = Student(
            email=f"student-{uuid.uuid4()}@example.test",
            password_hash="hash",
            full_name="Student One",
        )
        other_student = Student(
            email=f"student-{uuid.uuid4()}@example.test",
            password_hash="hash",
            full_name="Student Two",
        )
        session.add_all([owner, outsider, student, other_student])
        await session.flush()

        now = datetime.now(UTC)
        drive = PlacementDrive(
            recruiter_id=owner.id,
            company_name=owner.company_name,
            title="Campus Backend Role",
            description="A governed campus backend position.",
            role_type="Software Engineer",
            ctc_lpa=12,
            eligible_departments=[],
            minimum_cgpa=0,
            passing_year=2026,
            drive_date=now + timedelta(days=20),
            application_deadline=now + timedelta(days=10),
            status="published",
            required_skills=[],
            eligibility={},
            employment_type="full_time",
            location="Remote",
        )
        internship = Internship(
            recruiter_id=owner.id,
            title="Platform Internship",
            description="Build platform services.",
            location="Hybrid",
        )
        session.add_all([drive, internship])
        await session.flush()
        registration = PlacementRegistration(
            student_id=student.id,
            placement_drive_id=drive.id,
            status="registered",
            match_score=0.75,
            deterministic_score=0.9,
            semantic_score=0.4,
            verification_bonus=0.1,
        )
        engagement = InternshipEngagement(
            internship_id=internship.id,
            student_id=student.id,
            recruiter_id=owner.id,
            status="applied",
            progress_percentage=0,
            milestones=[],
        )
        session.add_all([registration, engagement])
        await session.flush()
        session.add_all(
            [
                PlacementStatusEvent(
                    placement_registration_id=registration.id,
                    old_stage=None,
                    new_stage="applied",
                    actor_id=student.id,
                    actor_role="student",
                    source="student_registration",
                    created_at=now,
                ),
                AuditLog(
                    actor_id=owner.id,
                    action="internship_engagement_created",
                    entity_type="internship_engagement",
                    entity_id=engagement.id,
                    details={"to_status": "applied"},
                ),
            ]
        )

        job = ExternalJob(
            provider="test",
            provider_source="test-board",
            external_id=str(uuid.uuid4()),
            title="External AI Role",
            company_name="External Company",
            description="Build AI systems.",
            location="India",
            source_url="https://example.test/job",
            expires_at=now + timedelta(days=15),
        )
        resume = ResumeDocument(
            student_id=student.id,
            original_filename="resume.pdf",
            storage_key=str(uuid.uuid4()),
            mime_type="application/pdf",
            size_bytes=100,
            checksum=uuid.uuid4().hex,
            parse_status=ResumeParseStatus.completed,
            parser_version="test",
        )
        session.add_all([job, resume])
        await session.flush()
        match = ExternalJobMatch(
            student_id=student.id,
            external_job_id=job.id,
            deterministic_score=0.8,
            semantic_score=0.2,
            verification_bonus=0.1,
            final_score=0.58,
            score_version="v2-embedding-accounting",
            input_fingerprint="test",
        )
        session.add(match)
        await session.flush()
        external = Application(
            student_id=student.id,
            external_job_id=job.id,
            external_job_match_id=match.id,
            resume_document_id=resume.id,
            status=ApplicationStatus.approval_pending,
            application_snapshot={},
            application_fingerprint="fingerprint",
            provider_capabilities={},
        )
        session.add(external)
        await session.flush()
        session.add(
            ApplicationStatusEvent(
                application_id=external.id,
                event_type="application_created",
                source=ApplicationStatusSource.system,
                safe_metadata={},
            )
        )
        await session.commit()
        return {
            "owner": owner.id,
            "outsider": outsider.id,
            "student": student.id,
            "other_student": other_student.id,
            "registration": registration.id,
            "engagement": engagement.id,
            "external": external.id,
        }


@pytest.mark.asyncio
async def test_unified_read_filters_timelines_and_student_isolation(phase5_client):
    client, factory = phase5_client
    data = await _setup(factory)
    student_headers = _headers(data["student"], Role.student)

    response = await client.get("/students/me/applications", headers=student_headers)
    assert response.status_code == 200
    assert response.json()["total"] == 3
    items = response.json()["items"]
    assert {item["source_type"] for item in items} == {
        "placement",
        "internship",
        "external_job",
    }
    external = next(item for item in items if item["source_type"] == "external_job")
    assert external["normalized_status"] == "approval_pending"
    assert external["source_status"] == "approval_pending"
    assert external["action_required"] is True

    filtered = await client.get(
        "/students/me/applications?source_type=placement&normalized_status=applied",
        headers=student_headers,
    )
    assert filtered.json()["total"] == 1
    required = await client.get(
        "/students/me/applications?action_required=true", headers=student_headers
    )
    assert [item["source_type"] for item in required.json()["items"]] == [
        "external_job"
    ]
    isolated = await client.get(
        "/students/me/applications",
        headers=_headers(data["other_student"], Role.student),
    )
    assert isolated.json()["total"] == 0

    for source, item_id in (
        ("placement", data["registration"]),
        ("internship", data["engagement"]),
        ("external_job", data["external"]),
    ):
        timeline = await client.get(
            f"/students/me/applications/{source}/{item_id}/timeline",
            headers=student_headers,
        )
        assert timeline.status_code == 200
        assert len(timeline.json()) == 1
        assert timeline.json()[0]["source_type"] == source
    blocked = await client.get(
        f"/students/me/applications/placement/{data['registration']}/timeline",
        headers=_headers(data["other_student"], Role.student),
    )
    assert blocked.status_code == 404


@pytest.mark.asyncio
async def test_recruiter_pipeline_state_machine_events_and_score_stability(phase5_client):
    client, factory = phase5_client
    data = await _setup(factory)
    owner_headers = _headers(data["owner"], Role.recruiter)
    original_score = 0.75

    invalid = await client.patch(
        f"/placements/registrations/{data['registration']}/stage",
        json={"stage": "offer"},
        headers=owner_headers,
    )
    assert invalid.status_code == 409
    cross_company = await client.patch(
        f"/placements/registrations/{data['registration']}/stage",
        json={"stage": "shortlisted"},
        headers=_headers(data["outsider"], Role.recruiter),
    )
    assert cross_company.status_code == 404

    for stage in ("shortlisted", "interview", "offer", "hired"):
        moved = await client.patch(
            f"/placements/registrations/{data['registration']}/stage",
            json={"stage": stage, "note": f"Moved to {stage}"},
            headers=owner_headers,
        )
        assert moved.status_code == 200
        assert moved.json()["stage"] == stage
        assert moved.json()["match_score"] == original_score

    timeline = await client.get(
        f"/placements/registrations/{data['registration']}/timeline",
        headers=owner_headers,
    )
    assert [event["new_stage"] for event in timeline.json()] == [
        "applied",
        "shortlisted",
        "interview",
        "offer",
        "hired",
    ]
    assert (
        await client.get(
            f"/placements/registrations/{data['registration']}/timeline",
            headers=_headers(data["outsider"], Role.recruiter),
        )
    ).status_code == 404

    terminal_withdrawal = await client.post(
        f"/students/me/applications/placement/{data['registration']}/withdraw",
        headers=_headers(data["student"], Role.student),
    )
    assert terminal_withdrawal.status_code == 409


@pytest.mark.asyncio
async def test_unified_withdrawal_dispatches_to_each_owned_domain(phase5_client):
    client, factory = phase5_client
    data = await _setup(factory)
    headers = _headers(data["student"], Role.student)

    other_student = await client.post(
        f"/students/me/applications/placement/{data['registration']}/withdraw",
        headers=_headers(data["other_student"], Role.student),
    )
    assert other_student.status_code == 404
    for source, item_id in (
        ("placement", data["registration"]),
        ("internship", data["engagement"]),
        ("external_job", data["external"]),
    ):
        withdrawn = await client.post(
            f"/students/me/applications/{source}/{item_id}/withdraw",
            headers=headers,
        )
        assert withdrawn.status_code == 200
        assert withdrawn.json()["normalized_status"] == "withdrawn"

    async with factory() as session:
        placement_events = list(
            (
                await session.scalars(
                    select(PlacementStatusEvent).where(
                        PlacementStatusEvent.placement_registration_id
                        == data["registration"]
                    )
                )
            ).all()
        )
        assert placement_events[-1].new_stage == "withdrawn"
