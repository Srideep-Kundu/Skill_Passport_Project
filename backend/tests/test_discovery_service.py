from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import job_discoveries
from app.core.db import Base
from app.models import Application, JobDiscovery, JobDiscoveryRun, Student
from app.services import discovery_service


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_saved_discovery_is_bounded_and_has_no_application_side_effect(session: AsyncSession, monkeypatch: pytest.MonkeyPatch) -> None:
    student = Student(email="discovery@example.test", password_hash="hash", full_name="Discovery Student")
    session.add(student)
    await session.commit()
    monkeypatch.setattr(discovery_service, "get_settings", lambda: SimpleNamespace(discovery_max_active_per_student=1, greenhouse_board_tokens=[], lever_site_tokens=[]))
    discovery = await discovery_service.create_discovery(session, student_id=student.id, values={"name": "Intern roles", "enabled": True, "query": "python", "location": None, "remote_preference": True, "employment_type": None, "experience_level": None, "providers": ["greenhouse"], "freshness_days": 14, "minimum_match_score": 0.5, "cadence_hours": 12})
    assert discovery.next_run_at is not None
    with pytest.raises(discovery_service.DiscoveryError):
        await discovery_service.create_discovery(session, student_id=student.id, values={"name": "Second", "enabled": True, "query": None, "location": None, "remote_preference": None, "employment_type": None, "experience_level": None, "providers": ["greenhouse"], "freshness_days": 14, "minimum_match_score": 0.5, "cadence_hours": 12})
    assert (await session.scalars(select(Application))).all() == []
    assert await session.get(JobDiscovery, discovery.id) is not None


@pytest.mark.asyncio
async def test_discovery_run_is_rate_limited_before_provider_work(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> None:
    student = Student(
        email="rate-limited-discovery@example.test",
        password_hash="hash",
        full_name="Discovery Student",
    )
    session.add(student)
    await session.flush()
    discovery = JobDiscovery(
        student_id=student.id,
        name="Intern roles",
        providers=["greenhouse"],
    )
    session.add(discovery)
    await session.commit()
    calls: list[tuple[str, str, int]] = []

    async def record_limit(category: str, subject: str, limit: int) -> None:
        calls.append((category, subject, limit))

    async def fake_run(_session: AsyncSession, *, discovery: JobDiscovery) -> JobDiscoveryRun:
        return JobDiscoveryRun(
            discovery_id=discovery.id,
            status="completed",
            providers_requested=discovery.providers,
            provider_results={},
            started_at=datetime.now(UTC),
        )

    monkeypatch.setattr(job_discoveries, "enforce_rate_limit", record_limit)
    monkeypatch.setattr(job_discoveries, "run_discovery", fake_run)
    await job_discoveries.run(discovery.id, student, session)

    assert calls == [("discovery-run", str(student.id), 10)]
