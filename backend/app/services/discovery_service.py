"""Bounded recurring discovery; never creates or changes applications."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import (
    AuditLog,
    DiscoveryRecommendation,
    DiscoveryRunStatus,
    ExternalJobMatch,
    JobDiscovery,
    JobDiscoveryRun,
    Student,
)
from app.services.automation_policy_service import apply_policies_to_matches
from app.services.external_jobs_service import sync_discovery_source
from app.services.job_providers import (
    JobSearchFilters,
    ProviderError,
    ProviderRateLimited,
    provider_registry,
)
from app.services.matching_service import compute_and_persist_external_job_match


class DiscoveryError(Exception):
    def __init__(self, detail: str, status_code: int = 409) -> None:
        self.detail, self.status_code = detail, status_code
        super().__init__(detail)


def _now() -> datetime:
    return datetime.now(UTC)


def _sources(provider: str) -> list[str]:
    settings = get_settings()
    if provider == "yc":
        return list(settings.yc_source_keys or ["yc_startups"])
    if provider == "greenhouse":
        return list(settings.greenhouse_board_tokens)
    if provider == "lever":
        return list(settings.lever_site_tokens)
    if provider == "ashby":
        return list(settings.ashby_job_board_names)
    return []


def _filters(discovery: JobDiscovery) -> JobSearchFilters:
    return JobSearchFilters(
        query=discovery.query,
        location=discovery.location,
        remote=discovery.remote_preference,
        employment_type=discovery.employment_type,
        experience_level=discovery.experience_level,
        posted_after=_now() - timedelta(days=discovery.freshness_days),
        page_size=100,
    )


async def create_discovery(
    session: AsyncSession, *, student_id: UUID, values: dict[str, object]
) -> JobDiscovery:
    active = int(
        (
            await session.scalar(
                select(func.count())
                .select_from(JobDiscovery)
                .where(
                    JobDiscovery.student_id == student_id,
                    JobDiscovery.enabled.is_(True),
                )
            )
        )
        or 0
    )
    if (
        bool(values.get("enabled", True))
        and active >= get_settings().discovery_max_active_per_student
    ):
        raise DiscoveryError("Maximum active saved discoveries reached", 422)
    providers = values.get("providers")
    if (
        not isinstance(providers, list)
        or not providers
        or any(
            not isinstance(item, str) or item not in provider_registry.names()
            for item in providers
        )
    ):
        raise DiscoveryError("One or more providers are unavailable", 422)
    discovery = JobDiscovery(
        student_id=student_id,
        **values,
        next_run_at=_now() if values.get("enabled", True) else None,
    )
    session.add(discovery)
    await session.flush()
    session.add(
        AuditLog(
            actor_id=student_id,
            action="job_discovery_created",
            entity_type="job_discovery",
            entity_id=discovery.id,
            details={"providers": providers, "cadence_hours": discovery.cadence_hours},
        )
    )
    await session.commit()
    await session.refresh(discovery)
    return discovery


async def update_discovery(
    session: AsyncSession, *, discovery: JobDiscovery, values: dict[str, object]
) -> JobDiscovery:
    if "providers" in values:
        providers = values["providers"]
        if (
            not isinstance(providers, list)
            or not providers
            or any(
                not isinstance(item, str) or item not in provider_registry.names()
                for item in providers
            )
        ):
            raise DiscoveryError("One or more providers are unavailable", 422)
    enabled = values.get("enabled", discovery.enabled)
    if enabled and not discovery.enabled:
        active = int(
            (
                await session.scalar(
                    select(func.count())
                    .select_from(JobDiscovery)
                    .where(
                        JobDiscovery.student_id == discovery.student_id,
                        JobDiscovery.enabled.is_(True),
                    )
                )
            )
            or 0
        )
        if active >= get_settings().discovery_max_active_per_student:
            raise DiscoveryError("Maximum active saved discoveries reached", 422)
    for key, value in values.items():
        setattr(discovery, key, value)
    discovery.next_run_at = (
        _now() + timedelta(hours=discovery.cadence_hours) if discovery.enabled else None
    )
    session.add(
        AuditLog(
            actor_id=discovery.student_id,
            action="job_discovery_updated",
            entity_type="job_discovery",
            entity_id=discovery.id,
            details={"enabled": discovery.enabled, "providers": discovery.providers},
        )
    )
    await session.commit()
    await session.refresh(discovery)
    return discovery


async def run_discovery(
    session: AsyncSession, *, discovery: JobDiscovery
) -> JobDiscoveryRun:
    if not discovery.enabled:
        raise DiscoveryError("Enable this saved discovery before running it")
    existing = await session.scalar(
        select(JobDiscoveryRun).where(
            JobDiscoveryRun.discovery_id == discovery.id,
            JobDiscoveryRun.status.in_(
                [DiscoveryRunStatus.queued, DiscoveryRunStatus.running]
            ),
        )
    )
    if existing is not None:
        raise DiscoveryError("This discovery already has an active run")
    run = JobDiscoveryRun(
        discovery_id=discovery.id,
        status=DiscoveryRunStatus.running,
        providers_requested=list(discovery.providers),
        provider_results={},
        started_at=_now(),
    )
    session.add(run)
    await session.commit()
    provider_results: dict[str, object] = {}
    job_ids: set[UUID] = set()
    failures = 0
    for provider_name in sorted(set(discovery.providers)):
        if provider_name not in provider_registry.names():
            failures += 1
            provider_results[provider_name] = {"status": "unavailable"}
            continue
        sources = _sources(provider_name)
        if not sources:
            failures += 1
            provider_results[provider_name] = {"status": "not_configured"}
            continue
        totals = {"seen": 0, "created": 0, "updated": 0, "errors": 0}
        for source in sources:
            try:
                ids, result = await sync_discovery_source(
                    session,
                    provider_name=provider_name,
                    source_key=source,
                    filters=_filters(discovery),
                )
                job_ids.update(ids)
                totals["seen"] += result.synced
                totals["created"] += result.created
                totals["updated"] += result.updated
            except ProviderRateLimited:
                failures += 1
                totals["errors"] += 1
            except ProviderError:
                failures += 1
                totals["errors"] += 1
        provider_results[provider_name] = {
            "status": "partial" if totals["errors"] else "completed",
            **totals,
        }
    created_recommendations = changed_recommendations = 0
    for job_id in sorted(job_ids, key=str):
        previous = await session.scalar(
            select(ExternalJobMatch).where(
                ExternalJobMatch.student_id == discovery.student_id,
                ExternalJobMatch.external_job_id == job_id,
            )
        )
        previous_fingerprint = (
            previous.input_fingerprint if previous is not None else None
        )
        match = await compute_and_persist_external_job_match(
            session, discovery.student_id, job_id
        )
        if match is None or float(match.final_score) < float(
            discovery.minimum_match_score
        ):
            continue
        marker = await session.scalar(
            select(DiscoveryRecommendation).where(
                DiscoveryRecommendation.discovery_id == discovery.id,
                DiscoveryRecommendation.external_job_id == job_id,
            )
        )
        if marker is None:
            session.add(
                DiscoveryRecommendation(
                    discovery_id=discovery.id,
                    external_job_id=job_id,
                    match_fingerprint=match.input_fingerprint,
                    first_recommended_at=_now(),
                    last_recommended_at=_now(),
                )
            )
            created_recommendations += 1
        elif (
            marker.match_fingerprint != match.input_fingerprint
            or previous_fingerprint != match.input_fingerprint
        ):
            marker.match_fingerprint = match.input_fingerprint
            marker.last_recommended_at = _now()
            changed_recommendations += 1
    run.provider_results = provider_results
    run.jobs_seen = sum(
        int(result.get("seen", 0))
        for result in provider_results.values()
        if isinstance(result, dict)
    )
    run.jobs_created = sum(
        int(result.get("created", 0))
        for result in provider_results.values()
        if isinstance(result, dict)
    )
    run.jobs_updated = sum(
        int(result.get("updated", 0))
        for result in provider_results.values()
        if isinstance(result, dict)
    )
    run.recommendations_created, run.recommendations_changed = (
        created_recommendations,
        changed_recommendations,
    )
    student = await session.get(Student, discovery.student_id)
    if student is not None:
        await apply_policies_to_matches(
            session, student=student, external_job_ids=job_ids
        )
    run.status = (
        DiscoveryRunStatus.completed
        if failures == 0
        else DiscoveryRunStatus.partial
        if job_ids
        else DiscoveryRunStatus.failed
    )
    run.safe_error = "One or more providers could not be synced" if failures else None
    run.completed_at = _now()
    discovery.last_run_at = run.completed_at
    discovery.next_run_at = run.completed_at + timedelta(hours=discovery.cadence_hours)
    session.add(
        AuditLog(
            actor_id=discovery.student_id,
            action="job_discovery_completed",
            entity_type="job_discovery_run",
            entity_id=run.id,
            details={
                "status": run.status.value,
                "recommendations_created": created_recommendations,
                "recommendations_changed": changed_recommendations,
            },
        )
    )
    await session.commit()
    await session.refresh(run)
    return run


async def run_due_discoveries(session: AsyncSession, *, limit: int = 10) -> int:
    due = list(
        (
            await session.scalars(
                select(JobDiscovery)
                .where(
                    JobDiscovery.enabled.is_(True),
                    JobDiscovery.next_run_at.is_not(None),
                    JobDiscovery.next_run_at <= _now(),
                )
                .order_by(JobDiscovery.next_run_at)
                .limit(limit)
            )
        ).all()
    )
    completed = 0
    for discovery in due:
        try:
            await run_discovery(session, discovery=discovery)
            completed += 1
        except DiscoveryError:
            continue
    return completed
