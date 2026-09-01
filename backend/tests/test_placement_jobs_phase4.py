import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import auth as auth_api
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
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
async def phase4_client(monkeypatch: pytest.MonkeyPatch):
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
    return {
        "Authorization": f"Bearer {create_access_token(subject, role.value)}"
    }


async def _setup(factory):
    async with factory() as session:
        owner = Recruiter(
            email=f"owner-{uuid.uuid4()}@example.com",
            password_hash="hash",
            company_name="Canonical Jobs Ltd",
        )
        outsider = Recruiter(
            email=f"outsider-{uuid.uuid4()}@example.com",
            password_hash="hash",
            company_name="Other Company",
        )
        eligible = Student(
            email=f"eligible-{uuid.uuid4()}@example.com",
            password_hash="hash",
            full_name="Alpha Candidate",
            university="University A",
            graduation_year=2026,
            career_goals={"department": "CSE", "degree": "BTech", "cgpa": 9.0},
        )
        low_cgpa = Student(
            email=f"low-{uuid.uuid4()}@example.com",
            password_hash="hash",
            full_name="Beta Candidate",
            university="University B",
            graduation_year=2026,
            career_goals={"department": "CSE", "degree": "BTech", "cgpa": 6.0},
        )
        python = Skill(canonical_name="Python", category="technical", aliases=[])
        teamwork = Skill(canonical_name="Teamwork", category="soft_skill", aliases=[])
        session.add_all([owner, outsider, eligible, low_cgpa, python, teamwork])
        await session.flush()
        for student in (eligible, low_cgpa):
            evidence = Evidence(
                student_id=student.id,
                evidence_type=EvidenceType.project,
                title="Equivalent Python evidence",
                description="Implemented the same Python service.",
                extraction_status=ExtractionStatus.extracted,
            )
            session.add(evidence)
            await session.flush()
            session.add(
                StudentSkill(
                    student_id=student.id,
                    skill_id=python.id,
                    source_evidence_id=evidence.id,
                    extraction_confidence=0.9,
                    verification_tier=VerificationTier.verified,
                    evidence_span="Implemented the same Python service.",
                )
            )
        await session.commit()
        return {
            "owner": owner.id,
            "outsider": outsider.id,
            "eligible": eligible.id,
            "low_cgpa": low_cgpa.id,
            "python": python.id,
            "teamwork": teamwork.id,
        }


def _payload(data, *, status: str = "published", enforce: bool = False):
    now = datetime.now(UTC)
    return {
        "company_name": "Ignored client company",
        "title": "Backend Platform Engineer",
        "description": "Build auditable backend services for the placement platform.",
        "role_type": "Software Engineer",
        "ctc_lpa": 15,
        "eligible_departments": ["CSE"],
        "minimum_cgpa": 7.5,
        "passing_year": 2026,
        "drive_date": (now + timedelta(days=20)).isoformat(),
        "application_deadline": (now + timedelta(days=10)).isoformat(),
        "location": "Bengaluru",
        "employment_type": "full_time",
        "qualifications": "BTech or equivalent with demonstrable backend work.",
        "eligibility": {
            "departments": ["CSE"],
            "graduation_year": 2026,
            "minimum_cgpa": 7.5,
            "degrees": ["BTech"],
            "enforce": enforce,
        },
        "requirements": [
            {
                "skill_id": str(data["python"]),
                "weight": 2.0,
                "requirement_type": "required",
            },
            {
                "skill_id": str(data["teamwork"]),
                "weight": 0.5,
                "requirement_type": "preferred",
            },
        ],
        "status": status,
    }


@pytest.mark.asyncio
async def test_recruiter_crud_canonical_requirements_and_ownership(phase4_client):
    client, factory = phase4_client
    data = await _setup(factory)
    owner_headers = _headers(data["owner"], Role.recruiter)
    outsider_headers = _headers(data["outsider"], Role.recruiter)

    created = await client.post(
        "/placements/drives",
        json=_payload(data, status="draft"),
        headers=owner_headers,
    )
    assert created.status_code == 201
    drive_id = created.json()["id"]
    assert created.json()["company_name"] == "Canonical Jobs Ltd"
    assert created.json()["required_skills"] == ["Python"]
    assert created.json()["preferred_skills"] == ["Teamwork"]
    assert created.json()["requirements"][0]["weight"] in {2.0, 0.5}

    mine = await client.get("/placements/drives/mine", headers=owner_headers)
    assert mine.status_code == 200
    assert [row["id"] for row in mine.json()] == [drive_id]
    assert (
        await client.get(
            f"/placements/drives/{drive_id}", headers=outsider_headers
        )
    ).status_code == 404
    assert (
        await client.patch(
            f"/placements/drives/{drive_id}",
            json={"title": "Stolen title"},
            headers=outsider_headers,
        )
    ).status_code == 404
    assert (
        await client.delete(
            f"/placements/drives/{drive_id}", headers=outsider_headers
        )
    ).status_code == 404

    updated = await client.patch(
        f"/placements/drives/{drive_id}",
        json={"title": "Senior Backend Platform Engineer", "status": "published"},
        headers=owner_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "published"
    assert updated.json()["published_at"] is not None

    invalid_skill = await client.post(
        "/placements/drives",
        json={
            **_payload(data),
            "requirements": [
                {
                    "skill_id": str(uuid.uuid4()),
                    "weight": 1,
                    "requirement_type": "required",
                }
            ],
        },
        headers=owner_headers,
    )
    assert invalid_skill.status_code == 422
    invalid_weight_payload = _payload(data)
    invalid_weight_payload["requirements"][0]["weight"] = 0
    invalid_weight = await client.post(
        "/placements/drives",
        json=invalid_weight_payload,
        headers=owner_headers,
    )
    assert invalid_weight.status_code == 422

    disposable = await client.post(
        "/placements/drives",
        json={**_payload(data, status="draft"), "title": "Disposable Job"},
        headers=owner_headers,
    )
    assert disposable.status_code == 201
    assert (
        await client.delete(
            f"/placements/drives/{disposable.json()['id']}", headers=owner_headers
        )
    ).status_code == 204


@pytest.mark.asyncio
async def test_eligibility_is_separate_from_deterministic_ranking(phase4_client):
    client, factory = phase4_client
    data = await _setup(factory)
    owner_headers = _headers(data["owner"], Role.recruiter)
    created = await client.post(
        "/placements/drives", json=_payload(data, enforce=False), headers=owner_headers
    )
    drive_id = created.json()["id"]

    eligible_view = await client.get(
        f"/placements/drives/{drive_id}",
        headers=_headers(data["eligible"], Role.student),
    )
    low_view = await client.get(
        f"/placements/drives/{drive_id}",
        headers=_headers(data["low_cgpa"], Role.student),
    )
    assert eligible_view.json()["eligibility_status"] == "eligible"
    assert low_view.json()["eligibility_status"] == "ineligible"
    assert eligible_view.json()["deterministic_score"] == low_view.json()["deterministic_score"]
    assert eligible_view.json()["final_score"] == low_view.json()["final_score"]
    assert eligible_view.json()["matched_skills"] == ["Python"]
    assert "Teamwork" in eligible_view.json()["missing_skills"]

    for student_id in (data["eligible"], data["low_cgpa"]):
        registered = await client.post(
            "/placements/register",
            json={"placement_drive_id": drive_id},
            headers=_headers(student_id, Role.student),
        )
        assert registered.status_code == 200
    duplicate = await client.post(
        "/placements/register",
        json={"placement_drive_id": drive_id},
        headers=_headers(data["eligible"], Role.student),
    )
    assert duplicate.status_code == 409

    ranked = await client.get(
        f"/placements/drives/{drive_id}/candidates", headers=owner_headers
    )
    assert ranked.status_code == 200
    assert len(ranked.json()) == 2
    assert ranked.json()[0]["match_score"] == ranked.json()[1]["match_score"]
    assert all(item["formula_version"] for item in ranked.json())
    assert all(item["evidence_references"] for item in ranked.json())
    assert (
        await client.get(
            f"/placements/drives/{drive_id}/candidates",
            headers=_headers(data["outsider"], Role.recruiter),
        )
    ).status_code == 404

    close = await client.patch(
        f"/placements/drives/{drive_id}",
        json={"status": "closed"},
        headers=owner_headers,
    )
    assert close.status_code == 200
    assert (
        await client.post(
            "/placements/register",
            json={"placement_drive_id": drive_id},
            headers=_headers(data["eligible"], Role.student),
        )
    ).status_code == 409
    assert (
        await client.delete(f"/placements/drives/{drive_id}", headers=owner_headers)
    ).status_code == 409


@pytest.mark.asyncio
async def test_strict_eligibility_and_legacy_skill_audit(phase4_client):
    client, factory = phase4_client
    data = await _setup(factory)
    owner_headers = _headers(data["owner"], Role.recruiter)
    strict = await client.post(
        "/placements/drives", json=_payload(data, enforce=True), headers=owner_headers
    )
    denied = await client.post(
        "/placements/register",
        json={"placement_drive_id": strict.json()["id"]},
        headers=_headers(data["low_cgpa"], Role.student),
    )
    assert denied.status_code == 422

    expired_payload = _payload(data, enforce=False)
    expired_payload["application_deadline"] = (
        datetime.now(UTC) - timedelta(minutes=1)
    ).isoformat()
    expired = await client.post(
        "/placements/drives", json=expired_payload, headers=owner_headers
    )
    assert expired.status_code == 201
    expired_registration = await client.post(
        "/placements/register",
        json={"placement_drive_id": expired.json()["id"]},
        headers=_headers(data["eligible"], Role.student),
    )
    assert expired_registration.status_code == 409

    legacy_payload = _payload(data)
    legacy_payload.pop("requirements")
    legacy_payload["required_skills"] = ["Python", "Unknown Legacy Skill"]
    legacy = await client.post(
        "/placements/drives", json=legacy_payload, headers=owner_headers
    )
    assert legacy.status_code == 201
    assert legacy.json()["required_skills"] == ["Python"]
    assert legacy.json()["unresolved_skill_names"] == ["Unknown Legacy Skill"]
