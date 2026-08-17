"""Auditable local application tracking; provider adapters never infer outcomes."""
import re
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusEvent,
    ApplicationStatusSource,
    ApplicationTrackingStatus,
    AuditLog,
    ExternalJob,
)
from app.services.application_errors import ApplicationWorkflowError
from app.services.job_providers import (
    ProviderError,
    ProviderStatusCapability,
    ProviderStatusResult,
    provider_registry,
)

_REFERENCE = re.compile(r"^[A-Za-z0-9._:-]{1,255}$")


def _now() -> datetime:
    return datetime.now(UTC)


def record_status_event(
    session: AsyncSession,
    application: Application,
    *,
    event_type: str,
    source: ApplicationStatusSource,
    tracking_status: ApplicationTrackingStatus | None = None,
    provider_status: str | None = None,
    safe_metadata: dict[str, object] | None = None,
    created_at: datetime | None = None,
) -> ApplicationStatusEvent:
    """Create a timeline event without application answers or unvalidated provider data."""
    if not re.fullmatch(r"[a-z0-9_]{1,80}", event_type):
        raise ValueError("invalid event type")
    if provider_status is not None and not re.fullmatch(r"[A-Za-z0-9 _.-]{1,80}", provider_status):
        raise ValueError("invalid provider status")
    event = ApplicationStatusEvent(
        application_id=application.id,
        event_type=event_type,
        status=tracking_status,
        source=source,
        provider_status=provider_status,
        safe_metadata=safe_metadata or {},
        created_at=created_at or _now(),
    )
    session.add(event)
    if tracking_status is not None:
        application.tracking_status = tracking_status
        application.tracking_status_source = source
        application.tracking_updated_at = event.created_at
    return event


def _audit(application: Application, action: str, details: dict[str, object]) -> AuditLog:
    return AuditLog(actor_id=application.student_id, action=action, entity_type="application", entity_id=application.id, details={"job_id": str(application.external_job_id), **details})


async def timeline(session: AsyncSession, application_id: UUID) -> list[ApplicationStatusEvent]:
    return list((await session.scalars(select(ApplicationStatusEvent).where(ApplicationStatusEvent.application_id == application_id).order_by(ApplicationStatusEvent.created_at.asc(), ApplicationStatusEvent.id.asc()))).all())


async def record_manual_submission(
    session: AsyncSession,
    *,
    application: Application,
    submitted_at: datetime | None,
    provider_reference: str | None,
) -> Application:
    if application.status not in {ApplicationStatus.manual_apply, ApplicationStatus.unknown_submission_state}:
        raise ApplicationWorkflowError("Mark manual submission only after choosing manual apply or resolving an unknown submission")
    when = submitted_at or _now()
    if when.tzinfo is None:
        raise ApplicationWorkflowError("Submission time must include a timezone", 422)
    if when > _now():
        raise ApplicationWorkflowError("Submission time cannot be in the future", 422)
    if provider_reference is not None and not _REFERENCE.fullmatch(provider_reference):
        raise ApplicationWorkflowError("The provider reference has an invalid format", 422)
    previous = application.status
    application.status = ApplicationStatus.submitted
    application.submitted_at = when
    application.failure_reason = None
    # A user reference is intentionally timeline-only: it never becomes an authoritative lookup id.
    details: dict[str, object] = {"user_reported": True}
    if provider_reference:
        details["user_reported_reference"] = provider_reference
    record_status_event(
        session,
        application,
        event_type="manual_submission_recorded",
        source=ApplicationStatusSource.user,
        tracking_status=ApplicationTrackingStatus.submitted,
        safe_metadata=details,
        created_at=when,
    )
    session.add(_audit(application, "manual_submission_recorded", {"from_status": previous.value, "has_user_reported_reference": bool(provider_reference)}))
    await session.commit()
    await session.refresh(application)
    return application


async def reconcile_application(session: AsyncSession, *, application: Application) -> Application:
    if application.status not in {ApplicationStatus.unknown_submission_state, ApplicationStatus.submitted}:
        raise ApplicationWorkflowError("Only submitted or ambiguous applications can be reconciled")
    job = await session.get(ExternalJob, application.external_job_id)
    if job is None:
        raise ApplicationWorkflowError("The source job is unavailable")
    try:
        provider = provider_registry.get(job.provider)
    except ProviderError as error:
        raise ApplicationWorkflowError("The application provider is unavailable") from error
    capability: ProviderStatusCapability = await provider.get_status_capability()
    prior = await timeline(session, application.id)
    if application.status == ApplicationStatus.unknown_submission_state and any(event.event_type == "status_reconciliation_requested" for event in prior):
        raise ApplicationWorkflowError("This ambiguous submission was already reconciled. Do not retry it; record a manual confirmation if available.")
    record_status_event(
        session,
        application,
        event_type="status_reconciliation_requested",
        source=ApplicationStatusSource.system,
        safe_metadata={"provider_tracking_supported": capability.supports_status_tracking, "lookup_method": capability.status_lookup_method},
    )
    session.add(_audit(application, "status_reconciliation_requested", {"provider_tracking_supported": capability.supports_status_tracking}))
    if not capability.supports_status_tracking or application.external_application_id is None:
        await session.commit()
        await session.refresh(application)
        return application
    try:
        result: ProviderStatusResult | None = await provider.get_application_status(application.external_application_id)
    except ProviderError:
        await session.commit()
        await session.refresh(application)
        return application
    if result is None:
        await session.commit()
        await session.refresh(application)
        return application
    record_status_event(
        session,
        application,
        event_type="status_update_received",
        source=ApplicationStatusSource.provider,
        tracking_status=result.status,
        provider_status=result.provider_status,
        safe_metadata={"lookup_method": capability.status_lookup_method},
    )
    session.add(_audit(application, "status_reconciled", {"status": result.status.value, "provider_status": result.provider_status}))
    await session.commit()
    await session.refresh(application)
    return application


async def withdraw_tracked_application(session: AsyncSession, *, application: Application) -> Application:
    if application.status == ApplicationStatus.withdrawn:
        raise ApplicationWorkflowError("This application is already withdrawn")
    previous = application.status
    application.status = ApplicationStatus.withdrawn
    application.withdrawn_at = _now()
    record_status_event(
        session,
        application,
        event_type="application_withdrawn",
        source=ApplicationStatusSource.user,
        tracking_status=ApplicationTrackingStatus.withdrawn,
        safe_metadata={"provider_withdrawal": "not_supported"},
    )
    session.add(_audit(application, "application_withdrawn", {"from_status": previous.value, "provider_withdrawal": "not_supported"}))
    await session.commit()
    await session.refresh(application)
    return application
