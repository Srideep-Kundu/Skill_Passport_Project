"""Persistence and taxonomy normalization for provider-neutral external jobs."""

import re
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from time import perf_counter
from typing import Any
from uuid import UUID

import httpx
from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import AuditLog, ExternalJob, ExternalJobRequirement, Skill
from app.services.application_service import (
    invalidate_stale_approved_applications_for_jobs,
)
from app.services.job_providers import (
    JobSearchFilters,
    NormalizedExternalJob,
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderError,
    ProviderNotFound,
    ProviderPayloadError,
    ProviderRateLimited,
    provider_registry,
)

PROVIDER_SYNC_AUDIT_ACTION = "external_job_provider_sync"
SUPPORTED_DISCOVERY_PROVIDERS = ("yc", "greenhouse", "lever", "ashby")


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
    latency_ms: int = 0
    fixture: bool = False


@dataclass(frozen=True)
class ProviderSyncEvidence:
    provider: str
    status: str
    enabled: bool
    configured: bool
    fixture: bool
    active_jobs_count: int
    last_attempt_at: datetime | None
    last_success_at: datetime | None
    last_item_count: int | None
    last_latency_ms: int | None
    latest_error_category: str | None
    message: str | None


def _now() -> datetime:
    return datetime.now(UTC)


def configured_provider_source(provider: str, source_key: str) -> bool:
    settings = get_settings()
    return (
        (
            provider == "yc"
            and (
                not settings.yc_source_keys
                or source_key in settings.yc_source_keys
                or source_key in ("yc_startups", "default")
            )
        )
        or (provider == "greenhouse" and source_key in settings.greenhouse_board_tokens)
        or (provider == "lever" and source_key in settings.lever_site_tokens)
        or (provider == "ashby" and source_key in settings.ashby_job_board_names)
    )


def configured_provider_sources() -> dict[str, list[str]]:
    """Return approved source identifiers without exposing provider credentials."""
    settings = get_settings()
    return {
        "yc": list(settings.yc_source_keys or ["yc_startups"]),
        "greenhouse": list(settings.greenhouse_board_tokens),
        "lever": list(settings.lever_site_tokens),
        "ashby": list(settings.ashby_job_board_names),
    }


def classify_provider_failure(error: Exception) -> str:
    """Map provider failures to bounded, non-secret operational categories."""
    if isinstance(error, ProviderRateLimited):
        return "rate_limited"
    if isinstance(error, ProviderAuthenticationError):
        return "authentication_error"
    if isinstance(error, (ProviderConfigurationError, ProviderNotFound)):
        return "configuration_error"
    if isinstance(error, ProviderPayloadError):
        return "malformed_response"
    if isinstance(error, SQLAlchemyError):
        return "persistence_error"
    if isinstance(error, (KeyError, TypeError, ValueError)):
        return "normalization_error"

    cause: BaseException | None = error
    while cause is not None:
        if isinstance(cause, httpx.TimeoutException):
            return "timeout"
        if isinstance(cause, httpx.HTTPStatusError):
            status_code = cause.response.status_code
            if status_code in {401, 403}:
                return "authentication_error"
            if status_code == 429:
                return "rate_limited"
            if status_code >= 500:
                return "upstream_unavailable"
        if isinstance(cause, httpx.TransportError):
            return "upstream_unavailable"
        cause = cause.__cause__
    if isinstance(error, ProviderError):
        return "upstream_unavailable"
    return "unknown"


def _sync_audit_log(
    *,
    actor_id: UUID | None,
    provider: str,
    source_key: str,
    outcome: str,
    fixture: bool,
    latency_ms: int,
    item_count: int | None = None,
    error_category: str | None = None,
    created: int = 0,
    updated: int = 0,
    marked_inactive: int = 0,
) -> AuditLog:
    return AuditLog(
        actor_id=actor_id,
        action=PROVIDER_SYNC_AUDIT_ACTION,
        entity_type="external_job_source",
        entity_id=None,
        details={
            "provider": provider,
            "provider_source": source_key,
            "outcome": outcome,
            "fixture": fixture,
            "item_count": item_count,
            "latency_ms": max(0, latency_ms),
            "error_category": error_category,
            "created": created,
            "updated": updated,
            "marked_inactive": marked_inactive,
        },
        created_at=_now(),
    )


async def provider_sync_evidence(
    session: AsyncSession,
) -> dict[str, ProviderSyncEvidence]:
    """Derive provider health only from persisted attempts and explicit fixtures."""
    sources = configured_provider_sources()
    rows = list(
        (
            await session.scalars(
                select(AuditLog)
                .where(AuditLog.action == PROVIDER_SYNC_AUDIT_ACTION)
                .order_by(AuditLog.created_at, AuditLog.id)
            )
        ).all()
    )
    active_jobs = list(
        (
            await session.scalars(
                select(ExternalJob).where(
                    ExternalJob.provider.in_(SUPPORTED_DISCOVERY_PROVIDERS),
                    ExternalJob.is_active.is_(True),
                )
            )
        ).all()
    )

    output: dict[str, ProviderSyncEvidence] = {}
    for provider_name in SUPPORTED_DISCOVERY_PROVIDERS:
        configured = bool(sources[provider_name])
        enabled = configured and provider_name in provider_registry.names()
        if enabled:
            enabled = provider_registry.get(provider_name).capabilities.search
        provider_rows = [
            row
            for row in rows
            if isinstance(row.details, dict)
            and row.details.get("provider") == provider_name
        ]
        real_rows = [
            row for row in provider_rows if not bool((row.details or {}).get("fixture"))
        ]
        successful_real_rows = [
            row for row in real_rows if (row.details or {}).get("outcome") == "success"
        ]
        latest = provider_rows[-1] if provider_rows else None
        latest_real = real_rows[-1] if real_rows else None
        latest_real_success = successful_real_rows[-1] if successful_real_rows else None
        provider_jobs = [job for job in active_jobs if job.provider == provider_name]
        has_fixture_data = any(
            isinstance(job.raw_metadata, dict)
            and bool(job.raw_metadata.get("fixture"))
            for job in provider_jobs
        )
        latest_details = latest.details if latest and isinstance(latest.details, dict) else {}
        latest_real_details = (
            latest_real.details
            if latest_real and isinstance(latest_real.details, dict)
            else {}
        )

        if not enabled:
            status = "disabled"
            message = "No approved provider source identifiers are configured"
        elif latest_real_details.get("outcome") == "success":
            status = "live"
            message = "Latest real provider sync completed successfully"
        elif latest_real_details.get("outcome") == "failure":
            status = "degraded"
            message = "Latest real provider sync failed safely"
        elif has_fixture_data or (
            latest_details.get("outcome") == "success"
            and bool(latest_details.get("fixture"))
        ):
            status = "fixture"
            message = "Demo fixture data; no live provider health is implied"
        else:
            status = "configured"
            message = "Configured, but no successful real sync is recorded"

        output[provider_name] = ProviderSyncEvidence(
            provider=provider_name,
            status=status,
            enabled=enabled,
            configured=configured,
            fixture=status == "fixture",
            active_jobs_count=len(provider_jobs),
            last_attempt_at=latest.created_at if latest else None,
            last_success_at=(
                latest_real_success.created_at if latest_real_success else None
            ),
            last_item_count=(
                int(latest_details["item_count"])
                if isinstance(latest_details.get("item_count"), int)
                else None
            ),
            last_latency_ms=(
                int(latest_details["latency_ms"])
                if isinstance(latest_details.get("latency_ms"), int)
                else None
            ),
            latest_error_category=(
                str(latest_real_details["error_category"])
                if latest_real_details.get("outcome") == "failure"
                and latest_real_details.get("error_category")
                else None
            ),
            message=message,
        )
    return output


def normalize_job_requirements(
    description: str, taxonomy: list[Skill]
) -> list[NormalizedRequirement]:
    """Use exact taxonomy labels only; external prose is data, never instructions or scoring input."""
    matches: dict[UUID, NormalizedRequirement] = {}
    required_markers = (
        "requirement",
        "qualification",
        "must have",
        "required",
        "you have",
        "what you bring",
    )
    preferred_markers = (
        "preferred",
        "nice to have",
        "bonus",
        "plus",
        "would be a plus",
    )
    for skill in sorted(taxonomy, key=lambda item: str(item.id)):
        labels = sorted(
            {
                label.strip()
                for label in [skill.canonical_name, *(skill.aliases or [])]
                if label.strip()
            },
            key=len,
            reverse=True,
        )
        for label in labels:
            match = re.search(
                r"(?<!\w)" + re.escape(label) + r"(?!\w)",
                description,
                flags=re.IGNORECASE,
            )
            if match is None:
                continue
            line_start = description.rfind("\n", 0, match.start()) + 1
            line_end = description.find("\n", match.end())
            source_span = description[
                line_start : len(description) if line_end == -1 else line_end
            ].strip()[:500] or match.group(0)
            context = description[max(0, line_start - 300) : match.end()].casefold()
            is_preferred = any(marker in context for marker in preferred_markers)
            is_required = not is_preferred and any(
                marker in context for marker in required_markers
            )
            candidate = NormalizedRequirement(
                skill.id, is_required, 1.0, 1.0, source_span
            )
            existing = matches.get(skill.id)
            if existing is None or (candidate.is_required and not existing.is_required):
                matches[skill.id] = candidate
            break
    return [matches[skill_id] for skill_id in sorted(matches, key=str)]


async def _persist_job(
    session: AsyncSession,
    job: NormalizedExternalJob,
    taxonomy: list[Skill],
    synced_at: datetime,
) -> tuple[ExternalJob, bool]:
    existing = (
        await session.scalars(
            select(ExternalJob).where(
                ExternalJob.provider == job.provider,
                ExternalJob.external_id == job.external_id,
            )
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
    await session.execute(
        delete(ExternalJobRequirement).where(
            ExternalJobRequirement.external_job_id == external_job.id
        )
    )
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


async def _sync_external_jobs_once(
    session: AsyncSession,
    *,
    provider_name: str,
    source_key: str,
) -> ExternalJobSyncResult:
    """Fetch a complete configured source, upsert stable IDs, then retire unseen postings."""
    provider = provider_registry.get(provider_name)
    if not configured_provider_source(provider_name, source_key):
        raise ProviderConfigurationError()
    if not provider.capabilities.search:
        raise ProviderConfigurationError()
    cursor: str | None = None
    fetched: dict[str, NormalizedExternalJob] = {}
    for _ in range(50):
        page = await provider.search_jobs(
            JobSearchFilters(cursor=cursor, page_size=100), source_key=source_key
        )
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
    taxonomy = list(
        (
            await session.scalars(
                select(Skill).order_by(Skill.canonical_name, Skill.id)
            )
        ).all()
    )
    created = updated = 0
    changed_job_ids: set[UUID] = set()
    for external_id in sorted(fetched):
        external_job, was_created = await _persist_job(
            session, fetched[external_id], taxonomy, synced_at
        )
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
    await session.commit()
    return ExternalJobSyncResult(
        provider_name,
        source_key,
        created,
        updated,
        marked_inactive,
        len(fetched),
        synced_at,
    )


async def sync_external_jobs(
    session: AsyncSession,
    *,
    provider_name: str,
    source_key: str,
    actor_id: UUID | None = None,
) -> ExternalJobSyncResult:
    """Run a source sync and persist safe evidence for every outcome."""
    started = perf_counter()
    fixture = False
    try:
        provider = provider_registry.get(provider_name)
        fixture = provider.is_fixture
        result = await _sync_external_jobs_once(
            session,
            provider_name=provider_name,
            source_key=source_key,
        )
    except Exception as error:
        latency_ms = round((perf_counter() - started) * 1000)
        await session.rollback()
        session.add(
            _sync_audit_log(
                actor_id=actor_id,
                provider=provider_name,
                source_key=source_key,
                outcome="failure",
                fixture=fixture,
                latency_ms=latency_ms,
                error_category=classify_provider_failure(error),
            )
        )
        await session.commit()
        raise

    latency_ms = round((perf_counter() - started) * 1000)
    session.add(
        _sync_audit_log(
            actor_id=actor_id,
            provider=provider_name,
            source_key=source_key,
            outcome="success",
            fixture=fixture,
            latency_ms=latency_ms,
            item_count=result.synced,
            created=result.created,
            updated=result.updated,
            marked_inactive=result.marked_inactive,
        )
    )
    await session.commit()
    return replace(result, latency_ms=latency_ms, fixture=fixture)


async def _sync_discovery_source_once(
    session: AsyncSession,
    *,
    provider_name: str,
    source_key: str,
    filters: JobSearchFilters,
) -> tuple[list[UUID], ExternalJobSyncResult]:
    """Bounded filtered sync for one discovery source; filtered results never retire jobs."""
    provider = provider_registry.get(provider_name)
    if (
        not configured_provider_source(provider_name, source_key)
        or not provider.capabilities.search
    ):
        raise ProviderConfigurationError()
    cursor: str | None = None
    fetched: dict[str, NormalizedExternalJob] = {}
    for _ in range(5):
        page = await provider.search_jobs(
            replace(filters, cursor=cursor, page_size=min(filters.page_size, 100)),
            source_key=source_key,
        )
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
    now = _now()
    taxonomy = list(
        (
            await session.scalars(
                select(Skill).order_by(Skill.canonical_name, Skill.id)
            )
        ).all()
    )
    job_ids: list[UUID] = []
    created = updated = 0
    for external_id in sorted(fetched):
        persisted, was_created = await _persist_job(
            session, fetched[external_id], taxonomy, now
        )
        job_ids.append(persisted.id)
        created += int(was_created)
        updated += int(not was_created)
    await invalidate_stale_approved_applications_for_jobs(session, set(job_ids))
    await session.commit()
    return job_ids, ExternalJobSyncResult(
        provider_name, source_key, created, updated, 0, len(fetched), now
    )


async def sync_discovery_source(
    session: AsyncSession,
    *,
    provider_name: str,
    source_key: str,
    filters: JobSearchFilters,
) -> tuple[list[UUID], ExternalJobSyncResult]:
    """Run a bounded discovery sync while recording the same health evidence."""
    started = perf_counter()
    fixture = False
    try:
        provider = provider_registry.get(provider_name)
        fixture = provider.is_fixture
        job_ids, result = await _sync_discovery_source_once(
            session,
            provider_name=provider_name,
            source_key=source_key,
            filters=filters,
        )
    except Exception as error:
        latency_ms = round((perf_counter() - started) * 1000)
        await session.rollback()
        session.add(
            _sync_audit_log(
                actor_id=None,
                provider=provider_name,
                source_key=source_key,
                outcome="failure",
                fixture=fixture,
                latency_ms=latency_ms,
                error_category=classify_provider_failure(error),
            )
        )
        await session.commit()
        raise

    latency_ms = round((perf_counter() - started) * 1000)
    session.add(
        _sync_audit_log(
            actor_id=None,
            provider=provider_name,
            source_key=source_key,
            outcome="success",
            fixture=fixture,
            latency_ms=latency_ms,
            item_count=result.synced,
            created=result.created,
            updated=result.updated,
        )
    )
    await session.commit()
    return job_ids, replace(result, latency_ms=latency_ms, fixture=fixture)


async def sync_all_configured_sources(
    session: AsyncSession,
    *,
    actor_id: UUID | None = None,
) -> dict[str, Any]:
    """Sync all live providers safely without failing the whole sync if one source is rate-limited."""
    results: dict[str, Any] = {}
    total_created = total_updated = total_synced = 0
    sources_map = configured_provider_sources()

    for provider_name, source_keys in sources_map.items():
        if provider_name not in provider_registry.names():
            results[provider_name] = {"status": "disabled", "jobs_synced": 0}
            continue
        provider = provider_registry.get(provider_name)
        if not source_keys or not provider.capabilities.search:
            results[provider_name] = {"status": "disabled", "jobs_synced": 0}
            continue

        provider_synced = provider_created = provider_updated = provider_errors = 0
        provider_successes = provider_fixture_successes = 0
        provider_error_categories: list[str] = []
        provider_started = perf_counter()
        for source_key in source_keys[:5]:
            try:
                res = await sync_external_jobs(
                    session,
                    provider_name=provider_name,
                    source_key=source_key,
                    actor_id=actor_id,
                )
                provider_synced += res.synced
                provider_created += res.created
                provider_updated += res.updated
                provider_successes += 1
                provider_fixture_successes += int(res.fixture)
            except ProviderError as error:
                provider_errors += 1
                provider_error_categories.append(classify_provider_failure(error))
                continue

        total_created += provider_created
        total_updated += provider_updated
        total_synced += provider_synced
        if provider_errors:
            sync_status = "degraded"
        elif provider_successes and provider_fixture_successes == provider_successes:
            sync_status = "fixture"
        elif provider_successes:
            sync_status = "live"
        else:
            sync_status = "configured"
        aggregate_fixture = (
            provider_successes > 0
            and provider_fixture_successes == provider_successes
        )
        session.add(
            _sync_audit_log(
                actor_id=actor_id,
                provider=provider_name,
                source_key="all_configured_sources",
                outcome="failure" if provider_errors else "success",
                fixture=aggregate_fixture,
                latency_ms=round((perf_counter() - provider_started) * 1000),
                item_count=provider_synced,
                error_category=(
                    provider_error_categories[0] if provider_error_categories else None
                ),
                created=provider_created,
                updated=provider_updated,
            )
        )
        await session.commit()
        results[provider_name] = {
            "status": sync_status,
            "jobs_synced": provider_synced,
            "jobs_created": provider_created,
            "jobs_updated": provider_updated,
            "errors": provider_errors,
        }

    # Record provider integrations requiring API configuration
    results["indeed"] = {
        "status": "disabled",
        "jobs_synced": 0,
        "reason": "Publisher/Partner API credentials required",
    }
    results["jobsuit"] = {
        "status": "disabled",
        "jobs_synced": 0,
        "reason": "Partner API configuration required",
    }

    return {
        "total_created": total_created,
        "total_updated": total_updated,
        "total_synced": total_synced,
        "providers": results,
        "synced_at": _now().isoformat(),
    }

