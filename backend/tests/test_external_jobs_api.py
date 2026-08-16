from datetime import UTC, datetime

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import external_jobs as external_jobs_api
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Admin,
    ExternalJob,
    ExternalJobRequirement,
    Recruiter,
    Skill,
    Student,
)
from app.services.external_jobs_service import ExternalJobSyncResult


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


@pytest.mark.asyncio
async def test_external_job_api_filters_provenance_and_role_boundaries(
    client_and_factory: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, factory = client_and_factory
    async with factory() as session:
        student = Student(email="student@example.test", password_hash="hash", full_name="Private Student", university="Private University")
        recruiter = Recruiter(email="recruiter@example.test", password_hash="hash", company_name="Company")
        admin = Admin(email="admin@example.test", password_hash="hash")
        skill = Skill(canonical_name="Python", category="language", aliases=[])
        session.add_all([student, recruiter, admin, skill])
        await session.flush()
        greenhouse = ExternalJob(
            provider="greenhouse", provider_source="acme", external_id="1", title="Backend Intern", company_name="Acme", description="Safe plain text Python",
            location="Remote", remote_status="remote", source_url="https://boards.greenhouse.io/acme/jobs/1", apply_url="https://boards.greenhouse.io/acme/jobs/1",
            first_seen_at=datetime.now(UTC), last_seen_at=datetime.now(UTC), last_synced_at=datetime.now(UTC), raw_metadata={"secret_provider_field": "never exposed"}, is_active=True,
        )
        other_provider = ExternalJob(
            provider="other", provider_source="public", external_id="1", title="Other role", company_name="Other", description="Safe", location="Pune", remote_status="not_remote",
            source_url="https://example.test/jobs/1", first_seen_at=datetime.now(UTC), last_seen_at=datetime.now(UTC), last_synced_at=datetime.now(UTC), is_active=True,
        )
        inactive = ExternalJob(
            provider="greenhouse", provider_source="acme", external_id="old", title="Old role", company_name="Acme", description="Safe", location="Remote", remote_status="remote",
            source_url="https://boards.greenhouse.io/acme/jobs/old", first_seen_at=datetime.now(UTC), last_seen_at=datetime.now(UTC), last_synced_at=datetime.now(UTC), is_active=False,
        )
        session.add_all([greenhouse, other_provider, inactive])
        await session.flush()
        session.add(ExternalJobRequirement(external_job_id=greenhouse.id, skill_id=skill.id, is_required=True, weight=1, confidence=1, source_span="Python"))
        await session.commit()
        student_token = create_access_token(student.id, "student")
        recruiter_token = create_access_token(recruiter.id, "recruiter")
        admin_token = create_access_token(admin.id, "admin")

    response = await client.get("/external-jobs?provider=greenhouse&remote=true", headers={"Authorization": f"Bearer {student_token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1 and body["items"][0]["external_id"] == "1"
    assert body["items"][0]["requirements"][0]["skill_name"] == "Python"
    assert "secret_provider_field" not in response.text and "Private Student" not in response.text
    assert (await client.get("/external-jobs?query=Backend&location=Remote", headers={"Authorization": f"Bearer {student_token}"})).json()["total"] == 1
    assert (await client.get("/external-jobs", headers={"Authorization": f"Bearer {recruiter_token}"})).status_code == 403

    async def fake_sync(*_args: object, **_kwargs: object) -> ExternalJobSyncResult:
        return ExternalJobSyncResult("greenhouse", "acme", 1, 2, 3, 3, datetime(2026, 1, 1, tzinfo=UTC))

    monkeypatch.setattr(external_jobs_api, "sync_external_jobs", fake_sync)
    synced = await client.post("/external-jobs/sync", headers={"Authorization": f"Bearer {admin_token}"}, json={"provider": "greenhouse", "source_key": "acme"})
    assert synced.status_code == 200 and synced.json()["marked_inactive"] == 3
