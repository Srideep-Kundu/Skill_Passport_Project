from datetime import UTC, datetime
from types import SimpleNamespace

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
from app.services import external_jobs_service
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

    providers_resp = await client.get("/external-jobs/providers", headers={"Authorization": f"Bearer {student_token}"})
    assert providers_resp.status_code == 200
    provider_data = providers_resp.json()
    provider_names = [p["provider"] for p in provider_data]
    assert "yc" in provider_names
    assert "greenhouse" in provider_names
    assert "indeed" in provider_names
    assert "jobsuit" in provider_names
    yc_entry = next(p for p in provider_data if p["provider"] == "yc")
    assert yc_entry["status"] == "configured"
    assert yc_entry["last_synced_at"] is None
    greenhouse_entry = next(p for p in provider_data if p["provider"] == "greenhouse")
    assert greenhouse_entry["status"] == "disabled"
    assert greenhouse_entry["active_jobs_count"] == 1
    indeed_entry = next(p for p in provider_data if p["provider"] == "indeed")
    assert indeed_entry["status"] == "disabled"


@pytest.mark.asyncio
async def test_provider_health_uses_non_fixture_sync_evidence_in_demo(
    client_and_factory: tuple[
        httpx.AsyncClient, async_sessionmaker[AsyncSession]
    ],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, factory = client_and_factory
    now = datetime.now(UTC)
    async with factory() as session:
        student = Student(
            email="health@example.test",
            password_hash="hash",
            full_name="Health Student",
        )
        session.add(student)
        session.add_all(
            [
                ExternalJob(
                    provider="greenhouse",
                    provider_source="fixture",
                    external_id="fixture-1",
                    title="Fixture",
                    company_name="Fixture",
                    description="Fixture",
                    source_url="https://fixtures.example.demo/greenhouse/1",
                    raw_metadata={"fixture": "offline_demo"},
                    last_seen_at=now,
                    last_synced_at=now,
                    is_active=True,
                ),
                ExternalJob(
                    provider="greenhouse",
                    provider_source="live-board",
                    external_id="live-1",
                    title="Live",
                    company_name="Live",
                    description="Live",
                    source_url="https://job-boards.greenhouse.io/live/jobs/1",
                    raw_metadata={"provider_metadata": []},
                    last_seen_at=now,
                    last_synced_at=now,
                    is_active=True,
                ),
            ]
        )
        await session.commit()
        token = create_access_token(student.id, "student")

    provider_settings = SimpleNamespace(
        environment="demo",
        yc_source_keys=[],
        greenhouse_board_tokens=["live-board"],
        lever_site_tokens=[],
        ashby_job_board_names=[],
    )
    monkeypatch.setattr(external_jobs_api, "get_settings", lambda: provider_settings)
    monkeypatch.setattr(
        external_jobs_api,
        "provider_sync_evidence",
        lambda session: external_jobs_service.provider_sync_evidence(session),
    )
    monkeypatch.setattr(
        external_jobs_service,
        "get_settings",
        lambda: provider_settings,
    )
    response = await client.get(
        "/external-jobs/providers",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    greenhouse = next(
        item for item in response.json() if item["provider"] == "greenhouse"
    )
    # Stored jobs do not prove a live sync. The fixture remains explicit even
    # when a non-fixture-shaped row also exists without sync audit evidence.
    assert greenhouse["status"] == "fixture"
    assert greenhouse["active_jobs_count"] == 2

