"""Persistence and taxonomy normalization for provider-neutral external jobs."""

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import AuditLog, ExternalJob, ExternalJobRequirement, Skill
from app.services.application_service import (
    invalidate_stale_approved_applications_for_jobs,
)
from app.services.job_providers import (
    JobSearchFilters,
    NormalizedExternalJob,
    ProviderError,
    provider_registry,
)


@dataclass(frozen=True)
class NormalizedRequirement:
    skill_id: UUID
    is_required: bool
    weight: float
    confidence: float
    source_span: str


@dataclass(frozen=True)
class ExternalJobSyncResult:
    provider: str
    provider_source: str
    created: int
    updated: int
    marked_inactive: int
    synced: int
    synced_at: datetime


def _now() -> datetime:
    return datetime.now(UTC)


def configured_provider_source(provider: str, source_key: str) -> bool:
    settings = get_settings()
    return provider == "greenhouse" and source_key in settings.greenhouse_board_tokens


def normalize_job_requirements(description: str, taxonomy: list[Skill]) -> list[NormalizedRequirement]:
    """Use exact taxonomy labels only; external prose is data, never instructions or scoring input."""
    matches: dict[UUID, NormalizedRequirement] = {}
    required_markers = ("requirement", "qualification", "must have", "required", "you have", "what you bring")
    preferred_markers = ("preferred", "nice to have", "bonus", "plus", "would be a plus")
    for skill in sorted(taxonomy, key=lambda item: str(item.id)):
        labels = sorted({label.strip() for label in [skill.canonical_name, *(skill.aliases or [])] if label.strip()}, key=len, reverse=True)
        for label in labels:
            match = re.search(r"(?<!\w)" + re.escape(label) + r"(?!\w)", description, flags=re.IGNORECASE)
            if match is None:
                continue
            line_start = description.rfind("\n", 0, match.start()) + 1
            line_end = description.find("\n", match.end())
            source_span = description[line_start : len(description) if line_end == -1 else line_end].strip()[:500] or match.group(0)
            context = description[max(0, line_start - 300) : match.end()].casefold()
            is_preferred = any(marker in context for marker in preferred_markers)
            is_required = not is_preferred and any(marker in context for marker in required_markers)
            candidate = NormalizedRequirement(skill.id, is_required, 1.0, 1.0, source_span)
            existing = matches.get(skill.id)
            if existing is None or (candidate.is_required and not existing.is_required):
                matches[skill.id] = candidate
            break
    return [matches[skill_id] for skill_id in sorted(matches, key=str)]


async def _persist_job(session: AsyncSession, job: NormalizedExternalJob, taxonomy: list[Skill], synced_at: datetime) -> tuple[ExternalJob, bool]:
    existing = (
        await session.scalars(
            select(ExternalJob).where(ExternalJob.provider == job.provider, ExternalJob.external_id == job.external_id)
        )
    ).first()
    created = existing is None
    external_job = existing or ExternalJob(
        provider=job.provider,
        provider_source=job.provider_source,
        external_id=job.external_id,
        title=job.title,
        company_name=job.company_name,
        description=job.description,
        source_url=job.source_url,
        last_seen_at=synced_at,
        last_synced_at=synced_at,
    )
    if existing is None:
        session.add(external_job)
    for field, value in {
        "provider_source": job.provider_source,
        "title": job.title,
        "company_name": job.company_name,
        "description": job.description,
        "location": job.location,
        "remote_status": job.remote_status,
        "employment_type": job.employment_type,
        "experience_level": job.experience_level,
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "salary_currency": job.salary_currency,
        "apply_url": job.apply_url,
        "source_url": job.source_url,
        "posted_at": job.posted_at,
        "expires_at": job.expires_at,
        "raw_metadata": job.raw_metadata,
        "last_seen_at": synced_at,
        "last_synced_at": synced_at,
        "is_active": True,
    }.items():
        setattr(external_job, field, value)
    await session.flush()
    await session.execute(delete(ExternalJobRequirement).where(ExternalJobRequirement.external_job_id == external_job.id))
    for requirement in normalize_job_requirements(external_job.description, taxonomy):
        session.add(
            ExternalJobRequirement(
                external_job_id=external_job.id,
                skill_id=requirement.skill_id,
                is_required=requirement.is_required,
                weight=requirement.weight,
                confidence=requirement.confidence,
                source_span=requirement.source_span,
            )
        )
    return external_job, created


async def sync_external_jobs(session: AsyncSession, *, provider_name: str, source_key: str, actor_id: UUID | None = None) -> ExternalJobSyncResult:
    """Fetch a complete configured source, upsert stable IDs, then retire unseen postings."""
    provider = provider_registry.get(provider_name)
    if not configured_provider_source(provider_name, source_key):
        raise ProviderError("provider source is not configured")
    if not provider.capabilities.search:
        raise ProviderError("provider does not support search")
    cursor: str | None = None
    fetched: dict[str, NormalizedExternalJob] = {}
    for _ in range(50):
        page = await provider.search_jobs(JobSearchFilters(cursor=cursor, page_size=100), source_key=source_key)
        for job in page.jobs:
            if job.provider != provider_name or job.provider_source != source_key:
                raise ProviderError("provider returned an invalid source")
            fetched[job.external_id] = job
        if page.next_cursor is None:
            break
        if page.next_cursor == cursor:
            raise ProviderError("provider pagination did not advance")
        cursor = page.next_cursor
    else:
        raise ProviderError("provider pagination limit reached")

    synced_at = _now()
    taxonomy = list((await session.scalars(select(Skill).order_by(Skill.canonical_name, Skill.id))).all())
    created = updated = 0
    changed_job_ids: set[UUID] = set()
    for external_id in sorted(fetched):
        external_job, was_created = await _persist_job(session, fetched[external_id], taxonomy, synced_at)
        changed_job_ids.add(external_job.id)
        created += int(was_created)
        updated += int(not was_created)

    active_rows = list(
        (
            await session.scalars(
                select(ExternalJob).where(
                    ExternalJob.provider == provider_name,
                    ExternalJob.provider_source == source_key,
                    ExternalJob.is_active.is_(True),
                )
            )
        ).all()
    )
    marked_inactive = 0
    for external_job in active_rows:
        if external_job.external_id not in fetched:
            external_job.is_active = False
            external_job.last_synced_at = synced_at
            changed_job_ids.add(external_job.id)
            marked_inactive += 1
    await invalidate_stale_approved_applications_for_jobs(session, changed_job_ids)
    session.add(
        AuditLog(
            actor_id=actor_id,
            action="external_jobs_synced",
            entity_type="external_job_source",
            entity_id=None,
            details={
                "provider": provider_name,
                "provider_source": source_key,
                "created": created,
                "updated": updated,
                "marked_inactive": marked_inactive,
            },
        )
    )
    await session.commit()
    return ExternalJobSyncResult(provider_name, source_key, created, updated, marked_inactive, len(fetched), synced_at)
