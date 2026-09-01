from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import external_jobs as external_jobs_api
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import AuditLog, ExternalJob, Student
from app.services import external_jobs_service
from app.services.external_jobs_service import (
    PROVIDER_SYNC_AUDIT_ACTION,
    provider_sync_evidence,
    sync_external_jobs,
)
from app.services.job_providers import (
    JobProvider,
    JobProviderRegistry,
    JobSearchFilters,
    NormalizedExternalJob,
    ProviderCapabilities,
    ProviderError,
    ProviderPayloadError,
    ProviderRateLimited,
    ProviderSearchPage,
    YCJobProvider,
)


class ControlledProvider(JobProvider):
    name = "greenhouse"
    capabilities = ProviderCapabilities(True, True, False, False)

    def __init__(self, outcome: ProviderSearchPage | Exception, *, fixture: bool = False) -> None:
        self.outcome = outcome
        self.is_fixture = fixture

    async def search_jobs(
        self, filters: JobSearchFilters, *, source_key: str
    ) -> ProviderSearchPage:
        del filters, source_key
        if isinstance(self.outcome, Exception):
            raise self.outcome
        return self.outcome

    async def get_job(
        self, external_id: str, *, source_key: str
    ) -> NormalizedExternalJob:
        del external_id, source_key
        raise AssertionError("not used")


@pytest_asyncio.fixture
async def phase10_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    yield factory
    await engine.dispose()


def _audit(
    provider: str,
    *,
    at: datetime,
    outcome: str,
    fixture: bool = False,
    error_category: str | None = None,
) -> AuditLog:
    return AuditLog(
        action=PROVIDER_SYNC_AUDIT_ACTION,
        entity_type="external_job_source",
        details={
            "provider": provider,
            "provider_source": "approved",
            "outcome": outcome,
            "fixture": fixture,
            "item_count": 3 if outcome == "success" else None,
            "latency_ms": 42,
            "error_category": error_category,
        },
        created_at=at,
    )


@pytest.mark.asyncio
async def test_statuses_are_derived_from_persisted_truthful_evidence(
    phase10_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime.now(UTC)
    async with phase10_factory() as session:
        session.add_all(
            [
                ExternalJob(
                    provider="greenhouse",
                    provider_source="fixture",
                    external_id="fixture-1",
                    title="Fixture",
                    company_name="Fixture",
                    description="Fixture",
                    source_url="https://fixtures.example.test/job",
                    raw_metadata={"fixture": "offline_demo"},
                    last_seen_at=now,
                    last_synced_at=now,
                ),
                _audit("greenhouse", at=now, outcome="success", fixture=True),
                _audit("yc", at=now - timedelta(minutes=2), outcome="success"),
                _audit(
                    "yc",
                    at=now - timedelta(minutes=1),
                    outcome="failure",
                    error_category="timeout",
                ),
            ]
        )
        await session.commit()

        monkeypatch.setattr(
            external_jobs_service,
            "configured_provider_sources",
            lambda: {
                "yc": ["yc_startups"],
                "greenhouse": ["approved"],
                "lever": ["approved"],
                "ashby": [],
            },
        )
        statuses = await provider_sync_evidence(session)

    assert statuses["greenhouse"].status == "fixture"
    assert statuses["greenhouse"].last_success_at is None
    assert statuses["lever"].status == "configured"
    assert statuses["ashby"].status == "disabled"
    assert statuses["yc"].status == "degraded"
    assert statuses["yc"].last_success_at is not None
    assert statuses["yc"].last_success_at.replace(tzinfo=UTC) == now - timedelta(minutes=2)
    assert statuses["yc"].latest_error_category == "timeout"


@pytest.mark.asyncio
async def test_real_zero_result_sync_is_live_then_safe_failure_is_degraded(
    phase10_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    successful = ControlledProvider(ProviderSearchPage((), None))
    monkeypatch.setattr(
        external_jobs_service, "provider_registry", JobProviderRegistry((successful,))
    )
    monkeypatch.setattr(
        external_jobs_service,
        "configured_provider_source",
        lambda provider, source: provider == "greenhouse" and source == "approved",
    )
    monkeypatch.setattr(
        external_jobs_service,
        "configured_provider_sources",
        lambda: {
            "yc": [],
            "greenhouse": ["approved"],
            "lever": [],
            "ashby": [],
        },
    )

    async with phase10_factory() as session:
        result = await sync_external_jobs(
            session, provider_name="greenhouse", source_key="approved"
        )
        assert result.synced == 0 and result.fixture is False
        assert (await provider_sync_evidence(session))["greenhouse"].status == "live"

        failing = ControlledProvider(ProviderRateLimited("token=must-not-persist"))
        monkeypatch.setattr(
            external_jobs_service, "provider_registry", JobProviderRegistry((failing,))
        )
        with pytest.raises(ProviderRateLimited):
            await sync_external_jobs(
                session, provider_name="greenhouse", source_key="approved"
            )
        status = (await provider_sync_evidence(session))["greenhouse"]
        attempts = list(
            (
                await session.scalars(
                    select(AuditLog).where(
                        AuditLog.action == PROVIDER_SYNC_AUDIT_ACTION
                    )
                )
            ).all()
        )

    assert status.status == "degraded"
    assert status.last_success_at is not None
    assert status.latest_error_category == "rate_limited"
    assert "must-not-persist" not in repr([attempt.details for attempt in attempts])


@pytest.mark.asyncio
async def test_fixture_sync_never_becomes_live_and_malformed_output_is_safe(
    phase10_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    fixture = ControlledProvider(ProviderSearchPage((), None), fixture=True)
    monkeypatch.setattr(
        external_jobs_service, "provider_registry", JobProviderRegistry((fixture,))
    )
    monkeypatch.setattr(
        external_jobs_service,
        "configured_provider_source",
        lambda provider, source: provider == "greenhouse" and source == "approved",
    )
    monkeypatch.setattr(
        external_jobs_service,
        "configured_provider_sources",
        lambda: {
            "yc": [],
            "greenhouse": ["approved"],
            "lever": [],
            "ashby": [],
        },
    )

    async with phase10_factory() as session:
        await sync_external_jobs(
            session, provider_name="greenhouse", source_key="approved"
        )
        assert (await provider_sync_evidence(session))["greenhouse"].status == "fixture"

        malformed = ControlledProvider(ProviderPayloadError("api_key=fake-secret"))
        monkeypatch.setattr(
            external_jobs_service,
            "provider_registry",
            JobProviderRegistry((malformed,)),
        )
        with pytest.raises(ProviderPayloadError):
            await sync_external_jobs(
                session, provider_name="greenhouse", source_key="approved"
            )
        attempts = list(
            (
                await session.scalars(
                    select(AuditLog).where(
                        AuditLog.action == PROVIDER_SYNC_AUDIT_ACTION
                    )
                )
            ).all()
        )

    latest = attempts[-1].details or {}
    assert latest["error_category"] == "malformed_response"
    assert "fake-secret" not in repr([attempt.details for attempt in attempts])


@pytest.mark.asyncio
async def test_provider_status_api_is_typed_and_never_exposes_configuration(
    phase10_factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async with phase10_factory() as session:
        student = Student(
            email="phase10@example.test",
            password_hash="hash",
            full_name="Phase Ten",
        )
        session.add(student)
        await session.commit()
        token = create_access_token(student.id, "student")

    async def override_session():
        async with phase10_factory() as session:
            yield session

    settings = SimpleNamespace(
        yc_source_keys=["yc_startups"],
        greenhouse_board_tokens=["secret-shaped-board-name"],
        lever_site_tokens=[],
        ashby_job_board_names=[],
    )
    monkeypatch.setattr(external_jobs_api, "get_settings", lambda: settings)
    monkeypatch.setattr(
        external_jobs_service,
        "configured_provider_sources",
        lambda: {
            "yc": ["yc_startups"],
            "greenhouse": ["secret-shaped-board-name"],
            "lever": [],
            "ashby": [],
        },
    )
    app.dependency_overrides[get_session] = override_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                "/external-jobs/providers",
                headers={"Authorization": f"Bearer {token}"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert "secret-shaped-board-name" not in response.text
    statuses = {item["provider"]: item for item in response.json()}
    assert statuses["yc"]["status"] == "configured"
    assert statuses["greenhouse"]["status"] == "configured"
    assert statuses["indeed"]["status"] == "disabled"
    assert statuses["jobsuit"]["status"] == "disabled"
    assert statuses["greenhouse"]["last_attempt_at"] is None


@pytest.mark.asyncio
async def test_yc_distinguishes_valid_zero_results_from_upstream_failure() -> None:
    valid_zero = YCJobProvider(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"hits": []})
            if request.url.host == "hn.algolia.com"
            else httpx.Response(503)
        )
    )
    assert (
        await valid_zero.search_jobs(
            JobSearchFilters(), source_key="yc_startups"
        )
    ).jobs == ()

    unavailable = YCJobProvider(
        transport=httpx.MockTransport(lambda request: httpx.Response(503))
    )
    with pytest.raises(ProviderError):
        await unavailable.search_jobs(
            JobSearchFilters(), source_key="yc_startups"
        )
