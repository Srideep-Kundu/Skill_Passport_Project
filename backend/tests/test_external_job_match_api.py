from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import external_job_matches as external_match_api
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Evidence,
    EvidenceType,
    ExternalJob,
    ExternalJobRequirement,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)


@pytest_asyncio.fixture
async def client_and_factory():
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


def _job(external_id: str, title: str, *, active: bool = True) -> ExternalJob:
    return ExternalJob(provider="greenhouse", provider_source="acme", external_id=external_id, title=title, company_name="Acme", description="Python", source_url=f"https://boards.greenhouse.io/acme/jobs/{external_id}", location="Remote", remote_status="remote", is_active=active)


@pytest.mark.asyncio
async def test_external_match_api_persists_orders_filters_and_scopes_students(
    client_and_factory: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, factory = client_and_factory
    async with factory() as session:
        first = Student(email="first@example.test", password_hash="hash", full_name="First", university="University A")
        second = Student(email="second@example.test", password_hash="hash", full_name="Second", university="University B")
        skill = Skill(canonical_name="Python", category="language", aliases=[])
        alpha, zulu, incomplete, inactive = _job("alpha", "Alpha role"), _job("zulu", "Zulu role"), _job("empty", "Unparsed role"), _job("inactive", "Inactive role", active=False)
        session.add_all([first, second, skill, alpha, zulu, incomplete, inactive])
        await session.flush()
        evidence = Evidence(student_id=first.id, evidence_type=EvidenceType.project, title="Python API", description="Python")
        session.add(evidence)
        await session.flush()
        session.add(StudentSkill(student_id=first.id, skill_id=skill.id, source_evidence_id=evidence.id, extraction_confidence=0.8, verification_tier=VerificationTier.verified, evidence_span="Python"))
        session.add_all([
            ExternalJobRequirement(external_job_id=alpha.id, skill_id=skill.id, is_required=True, weight=1, confidence=1, source_span="Python"),
            ExternalJobRequirement(external_job_id=zulu.id, skill_id=skill.id, is_required=True, weight=1, confidence=1, source_span="Python"),
            ExternalJobRequirement(external_job_id=inactive.id, skill_id=skill.id, is_required=True, weight=1, confidence=1, source_span="Python"),
        ])
        await session.commit()
        first_token, second_token = create_access_token(first.id, "student"), create_access_token(second.id, "student")

    recomputed = await client.post("/external-jobs/matches/recompute", headers={"Authorization": f"Bearer {first_token}"})
    assert recomputed.status_code == 200 and [item["title"] for item in recomputed.json()] == ["Alpha role", "Zulu role"]
    recommended = await client.get("/external-jobs/matches?page=1&page_size=1&remote=true", headers={"Authorization": f"Bearer {first_token}"})
    assert recommended.status_code == 200 and recommended.json()["total"] == 2 and recommended.json()["items"][0]["title"] == "Alpha role"
    match_id = recommended.json()["items"][0]["id"]
    explanation = await client.get(f"/external-job-matches/{match_id}/explanation", headers={"Authorization": f"Bearer {first_token}"})
    assert explanation.status_code == 200 and explanation.json()["items"][0]["evidence_title"] == "Python API"
    assert (await client.get(f"/external-job-matches/{match_id}/explanation", headers={"Authorization": f"Bearer {second_token}"})).status_code == 403
    assert (await client.get(f"/external-jobs/{incomplete.id}/match", headers={"Authorization": f"Bearer {first_token}"})).json()["matching_status"] == "insufficient_requirements"
    assert (await client.get(f"/external-jobs/{inactive.id}/match", headers={"Authorization": f"Bearer {first_token}"})).json()["matching_status"] == "inactive"

    monkeypatch.setattr(external_match_api, "get_settings", lambda: SimpleNamespace(external_job_min_match_score=0.7))
    assert (await client.get("/external-jobs/matches", headers={"Authorization": f"Bearer {first_token}"})).json()["total"] == 0
