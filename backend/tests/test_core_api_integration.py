"""Critical API flows against a real relational database (SQLite for fast coverage).

PostgreSQL-specific migration/grant coverage remains in its dedicated test module.
"""
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from jose import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import evidence as evidence_api
from app.core.config import get_settings
from app.core.db import Base, create_matching_view, get_session
from app.main import app
from app.models import Evidence, ExtractionJob, Skill, StudentSkill
from app.services import extraction_service


@pytest_asyncio.fixture
async def api_client(monkeypatch: pytest.MonkeyPatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    async def queued_without_worker(*_args: object) -> bool:
        return True

    monkeypatch.setattr(evidence_api, "enqueue_extraction", queued_without_worker)
    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


async def register(client: httpx.AsyncClient, role: str, email: str) -> str:
    payload = {"email": email, "password": "StrongPassword123"}
    if role == "student":
        payload.update({"full_name": "A Student", "university": "University A"})
    else:
        payload.update({"company_name": "Acme"})
    response = await client.post(f"/auth/register/{role}", json=payload)
    assert response.status_code == 201, response.text
    return response.json()["access_token"]


def authorization(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_auth_identity_and_access_boundaries(api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]]) -> None:
    client, _ = api_client
    student_token = await register(client, "student", "student@example.test")
    recruiter_token = await register(client, "recruiter", "recruiter@example.test")

    assert (await client.post("/auth/register/recruiter", json={"email": "student@example.test", "password": "StrongPassword123", "company_name": "Other"})).status_code == 409
    assert (await client.post("/auth/login", json={"email": "student@example.test", "password": "wrong"})).status_code == 401
    assert (await client.get("/evidence", headers=authorization(recruiter_token))).status_code == 403

    settings = get_settings()
    expired = jwt.encode(
        {"sub": "00000000-0000-0000-0000-000000000001", "role": "student", "exp": datetime.now(UTC) - timedelta(minutes=1)},
        settings.jwt_secret,
        settings.jwt_algorithm,
    )
    assert (await client.get("/passport/me", headers=authorization(expired))).status_code == 401
    assert (await client.post("/auth/login", json={"email": "recruiter@example.test", "password": "StrongPassword123"})).json()["role"] == "recruiter"
    assert student_token


@pytest.mark.asyncio
async def test_evidence_internship_matching_and_consent_lifecycle(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, factory = api_client
    student_token = await register(client, "student", "lifecycle-student@example.test")
    other_student_token = await register(client, "student", "other-student@example.test")
    recruiter_token = await register(client, "recruiter", "lifecycle-recruiter@example.test")
    other_recruiter_token = await register(client, "recruiter", "other-recruiter@example.test")
    async with factory() as session:
        skill = Skill(canonical_name="Python", category="Language", aliases=[])
        session.add(skill)
        await session.commit()
        skill_id = str(skill.id)

    created = await client.post(
        "/evidence",
        headers=authorization(student_token),
        json={"evidence_type": "project", "title": "API", "description": "Built a Python API."},
    )
    assert created.status_code == 201
    evidence_id = created.json()["id"]
    evidence_page = await client.get("/evidence?page=1&page_size=1&evidence_type=project&extraction_status=pending_extraction", headers=authorization(student_token))
    assert evidence_page.status_code == 200 and evidence_page.json()["total"] == 1
    assert (await client.get(f"/evidence/{evidence_id}", headers=authorization(other_student_token))).status_code == 404

    async def extract_python(*_args: object) -> extraction_service.ExtractionPayload:
        return extraction_service.ExtractionPayload.model_validate({"skills": [{"skill": "Python", "confidence": 0.9, "evidence_span": "Python"}]})

    monkeypatch.setattr(extraction_service.LocalExtractor, "extract", extract_python)
    monkeypatch.setattr(extraction_service, "get_settings", lambda: SimpleNamespace(extraction_provider="local", extraction_fallback_providers=[], extraction_max_attempts=3, extraction_retry_base_seconds=1, extraction_retry_max_seconds=2, extraction_claim_timeout_seconds=30))
    async with factory() as session:
        assert await extraction_service.extract_evidence(session, UUID(created.json()["id"])) == "completed"
    passport = await client.get("/passport/me", headers=authorization(student_token))
    assert passport.status_code == 200
    assert passport.json()["skills"][0]["source_evidence_id"] == evidence_id

    internship = await client.post(
        "/internships",
        headers=authorization(recruiter_token),
        json={"title": "Backend", "description": "Python work", "requirements": [{"skill_id": skill_id, "is_required": True, "weight": 1}]},
    )
    assert internship.status_code == 201, internship.text
    internship_id = internship.json()["id"]
    internship_page = await client.get("/internships?query=Back&page=1&page_size=1", headers=authorization(recruiter_token))
    assert internship_page.status_code == 200 and internship_page.json()["total"] == 1
    matches = await client.get(f"/internships/{internship_id}/matches", headers=authorization(recruiter_token))
    assert matches.status_code == 200 and matches.json()["total"] == 1
    match_id = matches.json()["items"][0]["id"]
    assert (await client.get(f"/internships/{internship_id}/matches", headers=authorization(other_recruiter_token))).status_code == 404
    assert (await client.patch(f"/internships/{internship_id}", headers=authorization(other_recruiter_token), json={"title": "Nope"})).status_code == 404

    raw_evidence_path = f"/evidence/internships/{internship_id}/candidates/{matches.json()['items'][0]['student_id']}/{evidence_id}"
    assert (await client.get(raw_evidence_path, headers=authorization(recruiter_token))).status_code == 403
    assert (await client.put("/passport/consent", headers=authorization(student_token), json={"recruiter_evidence_consent": True})).status_code == 200
    assert (await client.get(raw_evidence_path, headers=authorization(recruiter_token))).status_code == 200
    assert (await client.put("/passport/consent", headers=authorization(student_token), json={"recruiter_evidence_consent": False})).status_code == 200
    assert (await client.get(raw_evidence_path, headers=authorization(recruiter_token))).status_code == 403
    redacted = await client.get(f"/matches/{match_id}/explanation", headers=authorization(recruiter_token))
    assert redacted.status_code == 200 and redacted.json()["items"][0]["evidence_id"] is None

    updated = await client.patch(
        f"/evidence/{evidence_id}",
        headers=authorization(student_token),
        json={"description": "Rebuilt this API without the former skill."},
    )
    assert updated.status_code == 200 and updated.json()["extraction_status"] == "pending_extraction"
    stale = await client.get("/students/me/matches", headers=authorization(student_token))
    assert stale.json()["items"][0]["is_stale"] is True
    async with factory() as session:
        assert await session.scalar(select(func.count()).select_from(StudentSkill).where(StudentSkill.source_evidence_id == UUID(evidence_id))) == 0
        assert await session.scalar(select(func.count()).select_from(ExtractionJob).where(ExtractionJob.evidence_id == UUID(evidence_id))) == 1

    changed_requirements = await client.patch(
        f"/internships/{internship_id}",
        headers=authorization(recruiter_token),
        json={"requirements": [{"skill_id": skill_id, "is_required": True, "weight": 2}]},
    )
    assert changed_requirements.status_code == 200 and changed_requirements.json()["requirements"][0]["weight"] == 2
    assert (await client.get(f"/internships/{internship_id}/matches", headers=authorization(recruiter_token))).json()["items"][0]["is_stale"] is True

    assert (await client.delete(f"/evidence/{evidence_id}", headers=authorization(student_token))).status_code == 204
    async with factory() as session:
        assert await session.scalar(select(func.count()).select_from(Evidence)) == 0
        assert await session.scalar(select(func.count()).select_from(ExtractionJob)) == 0
    assert (await client.delete(f"/internships/{internship_id}", headers=authorization(recruiter_token))).status_code == 204


@pytest.mark.asyncio
async def test_all_evidence_extraction_triggers_share_the_student_rate_limit(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = api_client
    calls: list[tuple[str, str, int]] = []

    async def record_limit(category: str, subject: str, limit: int) -> None:
        calls.append((category, subject, limit))

    monkeypatch.setattr(evidence_api, "enforce_rate_limit", record_limit)
    async def requeue_without_worker(*_args: object) -> bool:
        return True

    monkeypatch.setattr(
        evidence_api, "manually_requeue_extraction", requeue_without_worker
    )
    token = await register(client, "student", "limited-student@example.test")
    created = await client.post(
        "/evidence",
        headers=authorization(token),
        json={
            "evidence_type": "project",
            "title": "API",
            "description": "Built a Python API.",
        },
    )
    assert created.status_code == 201
    evidence_id = created.json()["id"]
    assert (
        await client.patch(
            f"/evidence/{evidence_id}",
            headers=authorization(token),
            json={"description": "Rebuilt the Python API."},
        )
    ).status_code == 200
    assert (
        await client.post(
            f"/evidence/{evidence_id}/requeue", headers=authorization(token)
        )
    ).status_code == 200

    assert len(calls) == 3
    assert {category for category, _, _ in calls} == {"extraction"}
    assert len({subject for _, subject, _ in calls}) == 1
