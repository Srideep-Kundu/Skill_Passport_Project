from uuid import uuid4

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    CourseEnrollment,
    Evidence,
    EvidenceType,
    ExtractionStatus,
    Recruiter,
    Role,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)


@pytest_asyncio.fixture
async def learning_client():
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


def _headers(actor_id, role: Role) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(actor_id, role)}"}


@pytest.mark.asyncio
async def test_recruiter_program_ownership_publication_and_safe_delete(learning_client):
    client, factory = learning_client
    async with factory() as session:
        owner = Recruiter(
            email="owner@learning.test",
            password_hash="test",
            company_name="Acme Learning",
        )
        other = Recruiter(
            email="other@learning.test",
            password_hash="test",
            company_name="Other Company",
        )
        student = Student(
            email="student@learning.test",
            password_hash="test",
            full_name="Learning Student",
        )
        python = Skill(canonical_name="Python", category="Languages", aliases=[])
        session.add_all([owner, other, student, python])
        await session.commit()

    owner_headers = _headers(owner.id, Role.recruiter)
    other_headers = _headers(other.id, Role.recruiter)
    student_headers = _headers(student.id, Role.student)
    payload = {
        "title": "Applied Python Workshop",
        "category": "Backend",
        "program_type": "workshop",
        "duration_hours": 8,
        "delivery_mode": "hybrid",
        "capacity": 2,
        "is_published": False,
        "description": "A governed hands-on workshop for production Python skills.",
        "skill_ids": [str(python.id)],
    }
    created = await client.post("/learning/programs", json=payload, headers=owner_headers)
    assert created.status_code == 201
    program_id = created.json()["id"]
    assert created.json()["provider"] == "Acme Learning"
    assert created.json()["skills"] == ["Python"]

    mine = await client.get("/learning/programs/mine", headers=owner_headers)
    assert mine.status_code == 200
    assert [item["id"] for item in mine.json()] == [program_id]
    hidden = await client.get("/learning/courses", headers=student_headers)
    assert hidden.status_code == 200
    assert hidden.json() == []

    for method, path, body in (
        ("get", f"/learning/programs/{program_id}", None),
        ("patch", f"/learning/programs/{program_id}", {"is_published": True}),
        ("delete", f"/learning/programs/{program_id}", None),
    ):
        response = await client.request(method, path, json=body, headers=other_headers)
        assert response.status_code == 404

    published = await client.patch(
        f"/learning/programs/{program_id}",
        json={"is_published": True, "title": "Production Python Workshop"},
        headers=owner_headers,
    )
    assert published.status_code == 200
    visible = await client.get("/learning/courses", headers=student_headers)
    assert [item["id"] for item in visible.json()] == [program_id]

    invalid = await client.post(
        "/learning/programs",
        json={**payload, "title": "Invalid Taxonomy", "skill_ids": [str(uuid4())]},
        headers=owner_headers,
    )
    assert invalid.status_code == 422

    removable = await client.post(
        "/learning/programs",
        json={**payload, "title": "Safe to Delete"},
        headers=owner_headers,
    )
    removed = await client.delete(
        f"/learning/programs/{removable.json()['id']}", headers=owner_headers
    )
    assert removed.status_code == 204

    student_forbidden = await client.post(
        "/learning/programs", json=payload, headers=student_headers
    )
    assert student_forbidden.status_code == 403


@pytest.mark.asyncio
async def test_verified_completion_is_idempotent_and_provenance_backed(learning_client):
    client, factory = learning_client
    async with factory() as session:
        owner = Recruiter(
            email="verifier@learning.test",
            password_hash="test",
            company_name="Verifier Labs",
        )
        other = Recruiter(
            email="outsider@learning.test",
            password_hash="test",
            company_name="Outsider Labs",
        )
        student = Student(
            email="learner@learning.test",
            password_hash="test",
            full_name="Verified Learner",
        )
        python = Skill(canonical_name="Python", category="Languages", aliases=[])
        teamwork = Skill(
            canonical_name="Teamwork", category="Professional Competency", aliases=[]
        )
        session.add_all([owner, other, student, python, teamwork])
        await session.flush()
        prior_evidence = Evidence(
            student_id=student.id,
            evidence_type=EvidenceType.project,
            title="Independent verified Python",
            description="Verified repository evidence.",
            extraction_status=ExtractionStatus.extracted,
        )
        session.add(prior_evidence)
        await session.flush()
        prior_skill = StudentSkill(
            student_id=student.id,
            skill_id=python.id,
            source_evidence_id=prior_evidence.id,
            extraction_confidence=0.95,
            verification_tier=VerificationTier.verified,
            evidence_span="Python repository",
        )
        session.add(prior_skill)
        await session.commit()

    owner_headers = _headers(owner.id, Role.recruiter)
    other_headers = _headers(other.id, Role.recruiter)
    student_headers = _headers(student.id, Role.student)
    created = await client.post(
        "/learning/programs",
        json={
            "title": "Team Delivery Bootcamp",
            "category": "Professional",
            "program_type": "bootcamp",
            "duration_hours": 12,
            "capacity": 1,
            "is_published": True,
            "description": "A verified delivery bootcamp with collaborative Python practice.",
            "skill_ids": [str(python.id), str(teamwork.id)],
        },
        headers=owner_headers,
    )
    program_id = created.json()["id"]
    first_enrollment = await client.post(
        f"/learning/courses/{program_id}/enroll", headers=student_headers
    )
    replay_enrollment = await client.post(
        f"/learning/courses/{program_id}/enroll", headers=student_headers
    )
    assert first_enrollment.status_code == replay_enrollment.status_code == 200
    assert first_enrollment.json()["id"] == replay_enrollment.json()["id"]
    enrollment_id = first_enrollment.json()["id"]

    self_completed = await client.put(
        f"/learning/courses/{program_id}/progress",
        json={"progress": 100},
        headers=student_headers,
    )
    assert self_completed.status_code == 200
    assert self_completed.json()["status"] == "completed"
    assert self_completed.json()["completion_source"] == "student_self_reported"
    assert self_completed.json()["completion_evidence_id"] is None

    premature = await client.post(
        f"/learning/enrollments/{enrollment_id}/verify-completion",
        headers=owner_headers,
    )
    assert premature.status_code == 409
    outsider = await client.patch(
        f"/learning/enrollments/{enrollment_id}/attendance",
        json={"attendance_status": "attended"},
        headers=other_headers,
    )
    assert outsider.status_code == 404
    invalid_attendance = await client.patch(
        f"/learning/enrollments/{enrollment_id}/attendance",
        json={"attendance_status": "maybe"},
        headers=owner_headers,
    )
    assert invalid_attendance.status_code == 422

    attended = await client.patch(
        f"/learning/enrollments/{enrollment_id}/attendance",
        json={"attendance_status": "attended"},
        headers=owner_headers,
    )
    assert attended.status_code == 200
    verified = await client.post(
        f"/learning/enrollments/{enrollment_id}/verify-completion",
        headers=owner_headers,
    )
    replay = await client.post(
        f"/learning/enrollments/{enrollment_id}/verify-completion",
        headers=owner_headers,
    )
    assert verified.status_code == replay.status_code == 200
    assert verified.json()["completion_evidence_id"] == replay.json()[
        "completion_evidence_id"
    ]
    assert verified.json()["status"] == "verified"
    assert verified.json()["completion_source"] == "recruiter_verified"

    enrollments = await client.get(
        f"/learning/programs/{program_id}/enrollments", headers=owner_headers
    )
    assert enrollments.status_code == 200
    assert enrollments.json()[0]["student_name"] == "Verified Learner"
    assert enrollments.json()[0]["completion_verified"] is True
    cannot_delete = await client.delete(
        f"/learning/programs/{program_id}", headers=owner_headers
    )
    assert cannot_delete.status_code == 409
    student_cannot_verify = await client.post(
        f"/learning/enrollments/{enrollment_id}/verify-completion",
        headers=student_headers,
    )
    assert student_cannot_verify.status_code == 403

    async with factory() as session:
        assert await session.scalar(select(func.count(CourseEnrollment.id))) == 1
        completion_evidence = list(
            (
                await session.scalars(
                    select(Evidence).where(
                        Evidence.title == "Verified Learning Completion: Team Delivery Bootcamp"
                    )
                )
            ).all()
        )
        assert len(completion_evidence) == 1
        evidence_id = completion_evidence[0].id
        completion_skills = list(
            (
                await session.scalars(
                    select(StudentSkill).where(
                        StudentSkill.source_evidence_id == evidence_id
                    )
                )
            ).all()
        )
        assert len(completion_skills) == 2
        assert {item.skill_id for item in completion_skills} == {python.id, teamwork.id}
        assert all(
            item.verification_tier == VerificationTier.verified
            for item in completion_skills
        )
        assert all(len(item.proficiency_hint or "") <= 32 for item in completion_skills)
        preserved = await session.get(StudentSkill, prior_skill.id)
        assert preserved is not None
        assert preserved.source_evidence_id == prior_evidence.id
        assert preserved.verification_tier == VerificationTier.verified


@pytest.mark.asyncio
async def test_absence_and_capacity_are_enforced(learning_client):
    client, factory = learning_client
    async with factory() as session:
        recruiter = Recruiter(
            email="capacity@learning.test",
            password_hash="test",
            company_name="Capacity Labs",
        )
        first_student = Student(
            email="first@learning.test", password_hash="test", full_name="First"
        )
        second_student = Student(
            email="second@learning.test", password_hash="test", full_name="Second"
        )
        skill = Skill(canonical_name="Docker", category="DevOps", aliases=[])
        session.add_all([recruiter, first_student, second_student, skill])
        await session.commit()
    recruiter_headers = _headers(recruiter.id, Role.recruiter)
    first_headers = _headers(first_student.id, Role.student)
    second_headers = _headers(second_student.id, Role.student)
    program = await client.post(
        "/learning/programs",
        json={
            "title": "Capacity Workshop",
            "category": "DevOps",
            "program_type": "workshop",
            "duration_hours": 4,
            "capacity": 1,
            "is_published": True,
            "description": "A capacity-bound workshop with governed attendance.",
            "skill_ids": [str(skill.id)],
        },
        headers=recruiter_headers,
    )
    program_id = program.json()["id"]
    enrolled = await client.post(
        f"/learning/courses/{program_id}/enroll", headers=first_headers
    )
    full = await client.post(
        f"/learning/courses/{program_id}/enroll", headers=second_headers
    )
    assert full.status_code == 409
    absent = await client.patch(
        f"/learning/enrollments/{enrolled.json()['id']}/attendance",
        json={"attendance_status": "absent"},
        headers=recruiter_headers,
    )
    assert absent.json()["status"] == "absent"
    progress = await client.put(
        f"/learning/courses/{program_id}/progress",
        json={"progress": 50},
        headers=first_headers,
    )
    assert progress.status_code == 409
