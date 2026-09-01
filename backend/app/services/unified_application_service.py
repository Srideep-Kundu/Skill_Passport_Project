"""Student-owned normalized application reads over domain-authoritative storage."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusEvent,
    AuditLog,
    ExternalJob,
    ExternalJobMatch,
    Internship,
    InternshipEngagement,
    PlacementDrive,
    PlacementRegistration,
    PlacementStatusEvent,
    Recruiter,
)
from app.schemas.contracts import (
    UnifiedApplicationResponse,
    UnifiedApplicationTimelineEvent,
)
from app.services import application_service, application_tracking_service
from app.services.internship_engagement_service import (
    STUDENT_WITHDRAWAL_STATES,
    withdraw_engagement,
)

SourceType = str

PLACEMENT_STATUS: dict[str, str] = {
    "registered": "applied",
    "applied": "applied",
    "shortlisted": "shortlisted",
    "interview_scheduled": "interview",
    "interviewed": "interview",
    "interview": "interview",
    "offered": "offer",
    "offer": "offer",
    "accepted": "hired",
    "hired": "hired",
    "rejected": "rejected",
    "withdrawn": "withdrawn",
}
INTERNSHIP_STATUS: dict[str, str] = {
    "applied": "applied",
    "shortlisted": "shortlisted",
    "selected": "selected",
    "active": "selected",
    "completed": "completed",
    "rejected": "rejected",
    "withdrawn": "withdrawn",
    "abandoned": "withdrawn",
}
EXTERNAL_STATUS: dict[str, str] = {
    "approval_pending": "approval_pending",
    "approved": "draft",
    "preparing": "draft",
    "needs_input": "draft",
    "prepared": "draft",
    "ready_to_submit": "draft",
    "submitting": "applied",
    "submitted": "applied",
    "manual_apply": "draft",
    "failed": "failed",
    "unknown_submission_state": "unknown",
    "withdrawn": "withdrawn",
}
TRACKING_STATUS: dict[str, str] = {
    "submitted": "applied",
    "received": "applied",
    "in_review": "shortlisted",
    "interview": "interview",
    "offer": "offer",
    "hired": "hired",
    "rejected": "rejected",
    "withdrawn": "withdrawn",
    "unknown": "unknown",
}
PLACEMENT_WITHDRAWABLE = {"registered", "applied", "shortlisted", "interview"}
EXTERNAL_TERMINAL = {"hired", "rejected", "withdrawn", "failed"}


class UnifiedApplicationNotFoundError(ValueError):
    """The application is absent or outside the current student scope."""


class UnifiedApplicationConflictError(ValueError):
    """The requested application action is invalid for its domain state."""


def normalize_status(source_type: SourceType, source_status: str) -> str:
    mapping = {
        "placement": PLACEMENT_STATUS,
        "internship": INTERNSHIP_STATUS,
        "external_job": EXTERNAL_STATUS,
    }.get(source_type, {})
    return mapping.get(source_status, "unknown")


def _external_normalized(application: Application) -> str:
    if application.tracking_status is not None:
        return TRACKING_STATUS.get(application.tracking_status.value, "unknown")
    return normalize_status("external_job", application.status.value)


def _external_action(application: Application) -> tuple[bool, str | None]:
    if application.status == ApplicationStatus.approval_pending:
        return True, "Review and approve application"
    if application.status == ApplicationStatus.needs_input:
        return True, "Provide required application information"
    return False, None


async def list_unified_applications(
    session: AsyncSession,
    student_id: UUID,
    *,
    source_type: str | None = None,
    normalized_status: str | None = None,
    action_required: bool | None = None,
    sort_order: str = "desc",
) -> list[UnifiedApplicationResponse]:
    items: list[UnifiedApplicationResponse] = []
    if source_type in {None, "placement"}:
        registrations = list(
            (
                await session.scalars(
                    select(PlacementRegistration).where(
                        PlacementRegistration.student_id == student_id
                    )
                )
            ).all()
        )
        for registration in registrations:
            drive = await session.get(PlacementDrive, registration.placement_drive_id)
            if drive is None:
                continue
            latest = await session.scalar(
                select(PlacementStatusEvent)
                .where(
                    PlacementStatusEvent.placement_registration_id
                    == registration.id
                )
                .order_by(
                    PlacementStatusEvent.created_at.desc(),
                    PlacementStatusEvent.id.desc(),
                )
            )
            can_withdraw = registration.status in PLACEMENT_WITHDRAWABLE
            items.append(
                UnifiedApplicationResponse(
                    id=registration.id,
                    source_type="placement",
                    source_id=drive.id,
                    opportunity_title=drive.title,
                    organization=drive.company_name,
                    location=drive.location,
                    applied_at=registration.registered_at,
                    normalized_status=normalize_status(
                        "placement", registration.status
                    ),
                    source_status=registration.status,
                    match_score=float(registration.match_score),
                    deadline=drive.application_deadline,
                    latest_event=latest.new_stage if latest else None,
                    latest_event_at=latest.created_at if latest else None,
                    can_withdraw=can_withdraw,
                    next_student_action="withdraw" if can_withdraw else None,
                )
            )
    if source_type in {None, "internship"}:
        engagements = list(
            (
                await session.scalars(
                    select(InternshipEngagement).where(
                        InternshipEngagement.student_id == student_id
                    )
                )
            ).all()
        )
        for engagement in engagements:
            internship = await session.get(Internship, engagement.internship_id)
            if internship is None:
                continue
            recruiter = await session.get(Recruiter, engagement.recruiter_id)
            latest = await session.scalar(
                select(AuditLog)
                .where(
                    AuditLog.entity_type == "internship_engagement",
                    AuditLog.entity_id == engagement.id,
                )
                .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            )
            can_withdraw = engagement.status in STUDENT_WITHDRAWAL_STATES
            items.append(
                UnifiedApplicationResponse(
                    id=engagement.id,
                    source_type="internship",
                    source_id=internship.id,
                    opportunity_title=internship.title,
                    organization=(recruiter.company_name if recruiter else "Unavailable company"),
                    location=internship.location,
                    applied_at=engagement.created_at,
                    normalized_status=normalize_status(
                        "internship", engagement.status
                    ),
                    source_status=engagement.status,
                    latest_event=latest.action if latest else None,
                    latest_event_at=latest.created_at if latest else None,
                    can_withdraw=can_withdraw,
                    next_student_action="withdraw" if can_withdraw else None,
                )
            )
    if source_type in {None, "external_job"}:
        applications = list(
            (
                await session.scalars(
                    select(Application).where(Application.student_id == student_id)
                )
            ).all()
        )
        for application in applications:
            job = await session.get(ExternalJob, application.external_job_id)
            match = await session.get(
                ExternalJobMatch, application.external_job_match_id
            )
            if job is None:
                continue
            latest = await session.scalar(
                select(ApplicationStatusEvent)
                .where(ApplicationStatusEvent.application_id == application.id)
                .order_by(
                    ApplicationStatusEvent.created_at.desc(),
                    ApplicationStatusEvent.id.desc(),
                )
            )
            normalized = _external_normalized(application)
            required, label = (
                (False, None)
                if application.tracking_status is not None
                else _external_action(application)
            )
            can_withdraw = normalized not in EXTERNAL_TERMINAL
            items.append(
                UnifiedApplicationResponse(
                    id=application.id,
                    source_type="external_job",
                    source_id=job.id,
                    opportunity_title=job.title,
                    organization=job.company_name,
                    location=job.location,
                    applied_at=application.created_at,
                    normalized_status=normalized,
                    source_status=application.status.value,
                    match_score=float(match.final_score) if match else None,
                    action_required=required,
                    action_label=label,
                    deadline=job.expires_at,
                    latest_event=latest.event_type if latest else None,
                    latest_event_at=latest.created_at if latest else None,
                    can_withdraw=can_withdraw,
                    next_student_action=(label if required else "withdraw" if can_withdraw else None),
                    application_mode=(
                        "manual"
                        if application.status == ApplicationStatus.manual_apply
                        else "assisted"
                    ),
                )
            )
    if normalized_status is not None:
        items = [item for item in items if item.normalized_status == normalized_status]
    if action_required is not None:
        items = [item for item in items if item.action_required is action_required]
    reverse = sort_order != "asc"
    return sorted(items, key=lambda item: (item.applied_at, str(item.id)), reverse=reverse)


async def application_timeline(
    session: AsyncSession,
    student_id: UUID,
    source_type: str,
    item_id: UUID,
) -> list[UnifiedApplicationTimelineEvent]:
    if source_type == "placement":
        registration = await session.get(PlacementRegistration, item_id)
        if registration is None or registration.student_id != student_id:
            raise UnifiedApplicationNotFoundError("Application not found")
        placement_events = list(
            (
                await session.scalars(
                    select(PlacementStatusEvent)
                    .where(
                        PlacementStatusEvent.placement_registration_id == item_id
                    )
                    .order_by(
                        PlacementStatusEvent.created_at, PlacementStatusEvent.id
                    )
                )
            ).all()
        )
        return [
            UnifiedApplicationTimelineEvent(
                id=event.id,
                source_type="placement",
                event_type="placement_stage_changed",
                source_status=event.new_stage,
                normalized_status=normalize_status("placement", event.new_stage),
                source=event.source,
                note=event.note,
                created_at=event.created_at,
            )
            for event in placement_events
        ]
    if source_type == "external_job":
        application = await session.get(Application, item_id)
        if application is None or application.student_id != student_id:
            raise UnifiedApplicationNotFoundError("Application not found")
        external_events = list(
            (
                await session.scalars(
                    select(ApplicationStatusEvent)
                    .where(ApplicationStatusEvent.application_id == item_id)
                    .order_by(
                        ApplicationStatusEvent.created_at,
                        ApplicationStatusEvent.id,
                    )
                )
            ).all()
        )
        return [
            UnifiedApplicationTimelineEvent(
                id=event.id,
                source_type="external_job",
                event_type=event.event_type,
                source_status=event.status.value if event.status else None,
                normalized_status=(
                    TRACKING_STATUS.get(event.status.value, "unknown")
                    if event.status
                    else None
                ),
                source=event.source.value,
                created_at=event.created_at,
            )
            for event in external_events
        ]
    if source_type == "internship":
        engagement = await session.get(InternshipEngagement, item_id)
        if engagement is None or engagement.student_id != student_id:
            raise UnifiedApplicationNotFoundError("Application not found")
        audit_events = list(
            (
                await session.scalars(
                    select(AuditLog)
                    .where(
                        AuditLog.entity_type == "internship_engagement",
                        AuditLog.entity_id == item_id,
                    )
                    .order_by(AuditLog.created_at, AuditLog.id)
                )
            ).all()
        )
        return [
            UnifiedApplicationTimelineEvent(
                id=event.id,
                source_type="internship",
                event_type=event.action,
                source_status=str((event.details or {}).get("to_status") or "") or None,
                normalized_status=normalize_status(
                    "internship", str((event.details or {}).get("to_status") or "")
                ),
                source="audit_log",
                created_at=event.created_at,
            )
            for event in audit_events
        ]
    raise UnifiedApplicationNotFoundError("Application not found")


async def withdraw_unified_application(
    session: AsyncSession,
    student_id: UUID,
    source_type: str,
    item_id: UUID,
) -> None:
    if source_type == "placement":
        from app.services.placement_service import (
            PlacementConflictError,
            PlacementNotFoundError,
            withdraw_placement_registration,
        )

        try:
            await withdraw_placement_registration(session, item_id, student_id)
        except PlacementNotFoundError as exc:
            raise UnifiedApplicationNotFoundError(str(exc)) from exc
        except PlacementConflictError as exc:
            raise UnifiedApplicationConflictError(str(exc)) from exc
        return
    if source_type == "internship":
        try:
            await withdraw_engagement(session, item_id, student_id)
        except ValueError as exc:
            raise UnifiedApplicationConflictError(str(exc)) from exc
        return
    if source_type == "external_job":
        application = await session.get(Application, item_id)
        if application is None or application.student_id != student_id:
            raise UnifiedApplicationNotFoundError("Application not found")
        normalized = _external_normalized(application)
        if normalized in EXTERNAL_TERMINAL:
            raise UnifiedApplicationConflictError(
                "This external application cannot be withdrawn in its current state"
            )
        if application.status in {
            ApplicationStatus.submitted,
            ApplicationStatus.unknown_submission_state,
        } or application.tracking_status is not None:
            try:
                await application_tracking_service.withdraw_tracked_application(
                    session, application=application
                )
            except ValueError as exc:
                raise UnifiedApplicationConflictError(str(exc)) from exc
        else:
            try:
                await application_service.withdraw_application(
                    session, application=application
                )
            except ValueError as exc:
                raise UnifiedApplicationConflictError(str(exc)) from exc
        return
    raise UnifiedApplicationNotFoundError("Application not found")
