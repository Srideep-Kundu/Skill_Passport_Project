import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import auth as auth_api
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Evidence,
    EvidenceType,
    ExtractionStatus,
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
from app.services.internship_engagement_service import allowed_next_statuses


@pytest_asyncio.fixture
async def phase3_client(monkeypatch: pytest.MonkeyPatch):
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


async def _setup(factory):
    async with factory() as session:
        recruiter = Recruiter(
            email=f"r-{uuid.uuid4()}@example.com",
            password_hash="hash",
            company_name="Outcome Labs",
        )
        other_recruiter = Recruiter(
            email=f"r-{uuid.uuid4()}@example.com",
            password_hash="hash",
            company_name="Other Company",
        )
        student = Student(
            email=f"s-{uuid.uuid4()}@example.com",
            password_hash="hash",
            full_name="Outcome Student",
        )
        python = Skill(canonical_name="Python", category="technical")
        teamwork = Skill(canonical_name="Teamwork", category="soft_skill")
        session.add_all([recruiter, other_recruiter, student, python, teamwork])
        await session.flush()
        internship = Internship(
            recruiter_id=recruiter.id,
            title="Platform Internship",
            description="Build and validate platform services.",
        )
        session.add(internship)
        await session.flush()
        session.add(
            InternshipRequirement(
                internship_id=internship.id,
                skill_id=python.id,
                is_required=True,
                weight=1.0,
            )
        )
        independent_evidence = Evidence(
            student_id=student.id,
            evidence_type=EvidenceType.certification,
            title="Independent Python certification",
            description="Previously verified independent Python evidence.",
            extraction_status=ExtractionStatus.extracted,
        )
        session.add(independent_evidence)
        await session.flush()
        independent_skill = StudentSkill(
            student_id=student.id,
            skill_id=python.id,
            source_evidence_id=independent_evidence.id,
            extraction_confidence=1.0,
            verification_tier=VerificationTier.verified,
            evidence_span="Previously verified independent Python evidence.",
        )
        session.add(independent_skill)
        await session.commit()
        return {
            "recruiter": recruiter.id,
            "other_recruiter": other_recruiter.id,
            "student": student.id,
            "internship": internship.id,
            "skills": [python.id, teamwork.id],
            "independent_skill": independent_skill.id,
        }


def _headers(subject: uuid.UUID, role: Role) -> dict[str, str]:
    token = create_access_token(subject, role.value)
    return {"Authorization": f"Bearer {token}"}


def test_transition_policy_is_centralized_and_terminal() -> None:
    assert allowed_next_statuses("applied") == ["shortlisted", "rejected"]
    assert allowed_next_statuses("shortlisted") == ["selected", "rejected"]
    assert allowed_next_statuses("selected") == ["active", "rejected"]
    assert allowed_next_statuses("active") == ["abandoned"]
    assert allowed_next_statuses("completed") == []
    assert allowed_next_statuses("withdrawn") == []


@pytest.mark.asyncio
async def test_lifecycle_feedback_completion_provenance_and_replay(phase3_client):
    client, factory = phase3_client
    data = await _setup(factory)
    recruiter_headers = _headers(data["recruiter"], Role.recruiter)
    student_headers = _headers(data["student"], Role.student)

    created = await client.post(
        "/internship-engagements",
        json={
            "internship_id": str(data["internship"]),
            "student_id": str(data["student"]),
        },
        headers=recruiter_headers,
    )
    assert created.status_code == 201
    engagement_id = created.json()["id"]
    assert created.json()["status"] == "applied"
    assert created.json()["mentor_name"] is None
    assert created.json()["final_rating"] is None

    duplicate = await client.post(
        "/internship-engagements",
        json={
            "internship_id": str(data["internship"]),
            "student_id": str(data["student"]),
        },
        headers=recruiter_headers,
    )
    assert duplicate.status_code == 409

    invalid_jump = await client.patch(
        f"/internship-engagements/{engagement_id}/status",
        json={"status": "active"},
        headers=recruiter_headers,
    )
    assert invalid_jump.status_code == 409

    other_company = await client.patch(
        f"/internship-engagements/{engagement_id}/status",
        json={"status": "shortlisted"},
        headers=_headers(data["other_recruiter"], Role.recruiter),
    )
    assert other_company.status_code == 404

    for next_status in ("shortlisted", "selected", "active"):
        response = await client.patch(
            f"/internship-engagements/{engagement_id}/status",
            json={"status": next_status},
            headers=recruiter_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == next_status

    generic_completion = await client.patch(
        f"/internship-engagements/{engagement_id}/status",
        json={"status": "completed"},
        headers=recruiter_headers,
    )
    assert generic_completion.status_code == 422

    no_feedback = await client.post(
        f"/internship-engagements/{engagement_id}/complete",
        json={"completion_notes": "Completed", "outcome_summary": "Delivered APIs"},
        headers=recruiter_headers,
    )
    assert no_feedback.status_code == 422

    unknown_skill = await client.post(
        f"/internship-engagements/{engagement_id}/feedback",
        json={
            "mentor_name": "Industry Mentor",
            "skill_feedback": [
                {
                    "skill_id": str(uuid.uuid4()),
                    "rating": 5,
                    "observed_outcome": "Delivered a reviewed service",
                }
            ],
        },
        headers=recruiter_headers,
    )
    assert unknown_skill.status_code == 422

    feedback = await client.post(
        f"/internship-engagements/{engagement_id}/feedback",
        json={
            "mentor_name": "Industry Mentor",
            "skill_feedback": [
                {
                    "skill_id": str(data["skills"][0]),
                    "rating": 5,
                    "comment": "Consistent delivery",
                    "observed_outcome": "Implemented and tested the API",
                },
                {
                    "skill_id": str(data["skills"][1]),
                    "rating": 4,
                    "observed_outcome": "Led peer review and handover",
                },
            ],
            "overall_comment": "Evidence reviewed against delivered work.",
        },
        headers=recruiter_headers,
    )
    assert feedback.status_code == 200
    assert feedback.json()["final_rating"] == 4.5
    assert len(feedback.json()["mentor_feedback"]["skills"]) == 2

    completion_payload = {
        "completion_notes": "All agreed milestones accepted.",
        "outcome_summary": "Built, tested, and documented platform APIs.",
    }
    completed = await client.post(
        f"/internship-engagements/{engagement_id}/complete",
        json=completion_payload,
        headers=recruiter_headers,
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["completion_verified"] is True
    evidence_id = completed.json()["completion_evidence_id"]

    replay = await client.post(
        f"/internship-engagements/{engagement_id}/complete",
        json=completion_payload,
        headers=recruiter_headers,
    )
    assert replay.status_code == 200
    assert replay.json()["completion_evidence_id"] == evidence_id

    student_view = await client.get(
        "/internship-engagements/me", headers=student_headers
    )
    assert student_view.status_code == 200
    assert student_view.json()[0]["completion_verified"] is True

    passport = await client.get("/passport/me", headers=student_headers)
    assert passport.status_code == 200
    passport_skill_ids = {
        row["skill_id"] for row in passport.json()["skills"]
    }
    assert {str(skill_id) for skill_id in data["skills"]} <= passport_skill_ids

    gaps = await client.get(
        "/skill-gaps/analyze?target_role=Full%20Stack%20Developer",
        headers=student_headers,
    )
    assert gaps.status_code == 200
    assert "overall_readiness_score" in gaps.json()
    matches = await client.post(
        "/students/me/matches/recompute", headers=student_headers
    )
    assert matches.status_code == 200
    target_match = next(
        item for item in matches.json() if item["internship_id"] == str(data["internship"])
    )
    assert target_match["deterministic_score"] > 0

    async with factory() as session:
        evidence_count = await session.scalar(
            select(func.count()).select_from(Evidence).where(Evidence.id == uuid.UUID(evidence_id))
        )
        skills = list(
            (
                await session.scalars(
                    select(StudentSkill).where(
                        StudentSkill.source_evidence_id == uuid.UUID(evidence_id)
                    )
                )
            ).all()
        )
        engagement = await session.get(
            InternshipEngagement, uuid.UUID(engagement_id)
        )
        independent_skill = await session.get(StudentSkill, data["independent_skill"])
        assert evidence_count == 1
        assert len(skills) == 2
        assert {row.verification_tier for row in skills} == {VerificationTier.verified}
        assert engagement is not None
        assert engagement.completed_at is not None
        assert engagement.mentor_verified_at is not None
        assert independent_skill is not None
        assert float(independent_skill.extraction_confidence) == 1.0
        assert independent_skill.verification_tier == VerificationTier.verified


@pytest.mark.asyncio
async def test_student_withdrawal_rules_and_rbac(phase3_client):
    client, factory = phase3_client
    data = await _setup(factory)
    created = await client.post(
        "/internship-engagements",
        json={
            "internship_id": str(data["internship"]),
            "student_id": str(data["student"]),
        },
        headers=_headers(data["recruiter"], Role.recruiter),
    )
    engagement_id = created.json()["id"]
    recruiter_cannot_withdraw = await client.post(
        f"/internship-engagements/{engagement_id}/withdraw",
        headers=_headers(data["recruiter"], Role.recruiter),
    )
    assert recruiter_cannot_withdraw.status_code == 403
    withdrawn = await client.post(
        f"/internship-engagements/{engagement_id}/withdraw",
        headers=_headers(data["student"], Role.student),
    )
    assert withdrawn.status_code == 200
    assert withdrawn.json()["status"] == "withdrawn"
    repeated = await client.post(
        f"/internship-engagements/{engagement_id}/withdraw",
        headers=_headers(data["student"], Role.student),
    )
    assert repeated.status_code == 409


@pytest.mark.asyncio
async def test_legacy_feedback_contract_is_visible_but_not_passport_eligible(
    phase3_client,
):
    client, factory = phase3_client
    data = await _setup(factory)
    headers = _headers(data["recruiter"], Role.recruiter)
    created = await client.post(
        "/internship-engagements",
        json={
            "internship_id": str(data["internship"]),
            "student_id": str(data["student"]),
        },
        headers=headers,
    )
    engagement_id = created.json()["id"]
    for next_status in ("shortlisted", "selected", "active"):
        assert (
            await client.patch(
                f"/internship-engagements/{engagement_id}/status",
                json={"status": next_status},
                headers=headers,
            )
        ).status_code == 200
    legacy = await client.post(
        f"/internship-engagements/{engagement_id}/feedback",
        json={
            "technical_skills_rating": 4.0,
            "communication_rating": 4.0,
            "teamwork_rating": 4.0,
            "problem_solving_rating": 4.0,
            "overall_rating": 4.0,
            "comments": "Legacy category feedback remains readable.",
        },
        headers=headers,
    )
    assert legacy.status_code == 200
    assert legacy.json()["mentor_feedback"]["schema"] == "legacy_category_ratings_v1"
    completion = await client.post(
        f"/internship-engagements/{engagement_id}/complete",
        json={"completion_notes": "Completed", "outcome_summary": "Delivered work"},
        headers=headers,
    )
    assert completion.status_code == 422
