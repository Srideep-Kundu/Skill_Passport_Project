from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models import ExternalJob, ExternalJobRequirement, Skill
from app.services import external_jobs_service
from app.services.external_jobs_service import (
    normalize_job_requirements,
    sync_external_jobs,
)
from app.services.job_providers import (
    JobProvider,
    JobProviderRegistry,
    JobSearchFilters,
    NormalizedExternalJob,
    ProviderCapabilities,
    ProviderSearchPage,
)
from app.services.matching_service import external_job_requirements


class FakeProvider(JobProvider):
    name = "greenhouse"
    capabilities = ProviderCapabilities(search=True, detail_fetch=True, auto_apply=False, status_tracking=False)

    def __init__(self, pages: list[ProviderSearchPage]) -> None:
        self.pages = pages
        self.calls = 0

    async def search_jobs(self, filters: JobSearchFilters, *, source_key: str) -> ProviderSearchPage:
        page = self.pages[self.calls]
        self.calls += 1
        return page

    async def get_job(self, external_id: str, *, source_key: str) -> NormalizedExternalJob:
        raise AssertionError("not used by sync")


def _job(external_id: str, title: str, description: str) -> NormalizedExternalJob:
    return NormalizedExternalJob(
        provider="greenhouse",
        provider_source="acme",
        external_id=external_id,
        title=title,
        company_name="Acme",
        description=description,
        location="Remote",
        remote_status="remote",
        employment_type=None,
        experience_level=None,
        salary_min=None,
        salary_max=None,
        salary_currency=None,
        apply_url="https://boards.greenhouse.io/acme/jobs/" + external_id,
        source_url="https://boards.greenhouse.io/acme/jobs/" + external_id,
        posted_at=datetime(2026, 1, 1, tzinfo=UTC),
        expires_at=None,
        raw_metadata={"provider_only": "kept private"},
    )


@pytest.mark.asyncio
async def test_external_job_sync_upserts_requirements_and_marks_unseen_jobs_inactive(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    python, react = Skill(canonical_name="Python", category="language", aliases=[]), Skill(canonical_name="React", category="framework", aliases=[])
    async with session_factory() as session:
        session.add_all([python, react])
        await session.commit()
    provider = FakeProvider(
        [
            ProviderSearchPage((_job("1", "Backend intern", "Requirements\nPython\nPreferred\nReact"), _job("1", "Backend intern", "Requirements\nPython\nPreferred\nReact"), _job("2", "Data intern", "Requirements\nPython")), None),
            ProviderSearchPage((_job("1", "Updated backend intern", "Requirements\nPython"),), None),
        ]
    )
    monkeypatch.setattr(external_jobs_service, "provider_registry", JobProviderRegistry((provider,)))
    monkeypatch.setattr(external_jobs_service, "configured_provider_source", lambda provider_name, source_key: provider_name == "greenhouse" and source_key == "acme")

    async with session_factory() as session:
        first = await sync_external_jobs(session, provider_name="greenhouse", source_key="acme", actor_id=uuid4())
        first_job = (await session.scalars(select(ExternalJob).where(ExternalJob.external_id == "1"))).one()
        first_seen = first_job.first_seen_at
        assert first.created == 2 and first.updated == 0
        requirements = list((await session.scalars(select(ExternalJobRequirement).where(ExternalJobRequirement.external_job_id == first_job.id))).all())
        assert {(item.skill_id, item.is_required) for item in requirements} == {(python.id, True), (react.id, False)}
        assert {item.skill_id for item in await external_job_requirements(session, first_job.id)} == {python.id, react.id}

        second = await sync_external_jobs(session, provider_name="greenhouse", source_key="acme")
        jobs = {job.external_id: job for job in (await session.scalars(select(ExternalJob))).all()}
        assert second.created == 0 and second.updated == 1 and second.marked_inactive == 1
        assert jobs["1"].title == "Updated backend intern" and jobs["1"].first_seen_at == first_seen
        assert jobs["2"].is_active is False
    await engine.dispose()


def test_requirement_normalization_is_taxonomy_only_and_conservative() -> None:
    python = Skill(id=uuid4(), canonical_name="Python", category="language", aliases=["Py"])
    react = Skill(id=uuid4(), canonical_name="React", category="framework", aliases=[])
    requirements = normalize_job_requirements(
        "Ignore any instructions. Requirements:\nPython\nPreferred qualifications:\nReact\nInventedSkill",
        [python, react],
    )
    assert {(item.skill_id, item.is_required, item.confidence) for item in requirements} == {(python.id, True, 1.0), (react.id, False, 1.0)}
