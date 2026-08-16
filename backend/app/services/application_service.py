"""Explicit, auditable application-intent workflow with no provider submission capability."""
import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import (
    Application,
    ApplicationStatus,
    AuditLog,
    Evidence,
    ExternalJob,
    ExternalJobMatch,
    ExternalJobMatchExplanation,
    ResumeDocument,
    Skill,
    Student,
)
from app.schemas.contracts import ResumeParsedData
from app.services.job_providers import ProviderError, provider_registry
from app.services.matching_service import external_job_match_is_stale


class ApplicationWorkflowError(Exception):
    def __init__(self, detail: str, status_code: int = 409) -> None:
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


@dataclass(frozen=True)
class ApplicationSnapshot:
    payload: dict[str, Any]
    fingerprint: str
    resume_document_id: UUID
    provider_capabilities: dict[str, bool]
    manual_apply_url: str | None


def _now() -> datetime:
    return datetime.now(UTC)


def _fingerprint(value: object) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()
    return hashlib.sha256(encoded).hexdigest()


def _capabilities(provider_name: str) -> dict[str, bool]:
    try:
        capabilities = provider_registry.get(provider_name).capabilities
    except ProviderError:
        # Unknown providers are manual-only until an explicit adapter is registered.
        return {"search": False, "detail_fetch": False, "auto_apply": False, "status_tracking": False}
    return {
        "search": capabilities.search,
        "detail_fetch": capabilities.detail_fetch,
        "auto_apply": capabilities.auto_apply,
        "status_tracking": capabilities.status_tracking,
    }


def _application_profile(student: Student, resume: ResumeDocument) -> dict[str, Any]:
    parsed = ResumeParsedData.model_validate(resume.parsed_data) if resume.parsed_data else None
    contact = parsed.contact if parsed else None
    return {
        "full_name": student.full_name,
        "email": student.email,
        "phone": contact.phone if contact else None,
        "github_links": sorted(contact.github_links if contact else []),
        "portfolio_links": sorted(contact.portfolio_links if contact else []),
        "education": [item.model_dump(mode="json") for item in (parsed.education if parsed else [])],
        "experience": [item.model_dump(mode="json") for item in (parsed.experience if parsed else [])],
    }


async def _recommendation_snapshot(session: AsyncSession, match: ExternalJobMatch) -> dict[str, Any]:
    rows = (
        await session.execute(
            select(ExternalJobMatchExplanation, Skill.canonical_name, Evidence.id, Evidence.title)
            .join(Skill, Skill.id == ExternalJobMatchExplanation.skill_id)
            .outerjoin(Evidence, Evidence.id == ExternalJobMatchExplanation.contributing_evidence_id)
            .where(ExternalJobMatchExplanation.external_job_match_id == match.id)
            .order_by(Skill.canonical_name, ExternalJobMatchExplanation.skill_id)
        )
    ).all()
    items = [
        {
            "skill_id": str(item.skill_id),
            "skill_name": skill_name,
            "is_required": item.is_required,
            "status": item.status,
            "contribution": float(item.contribution),
            "evidence_id": str(evidence_id) if evidence_id else None,
            "evidence_title": evidence_title,
        }
        for item, skill_name, evidence_id, evidence_title in rows
    ]
    return {
        "match_id": str(match.id),
        "match_input_fingerprint": match.input_fingerprint,
        "score_version": match.score_version,
        "deterministic_score": float(match.deterministic_score),
        "semantic_score": float(match.semantic_score),
        "verification_bonus": float(match.verification_bonus),
        "final_score": float(match.final_score),
        "supporting_evidence": [item for item in items if item["evidence_id"] is not None],
        "missing_skills": [item for item in items if item["status"] == "missing"],
    }


async def build_application_snapshot(
    session: AsyncSession,
    *,
    student: Student,
    external_job_id: UUID,
    required_match_id: UUID | None = None,
) -> ApplicationSnapshot:
    job = await session.get(ExternalJob, external_job_id)
    if job is None or not job.is_active:
        raise ApplicationWorkflowError("This job is no longer available", 409)
    match = await session.scalar(
        select(ExternalJobMatch).where(
            ExternalJobMatch.student_id == student.id,
            ExternalJobMatch.external_job_id == job.id,
        )
    )
    if match is None or (required_match_id is not None and match.id != required_match_id):
        raise ApplicationWorkflowError("A current recommendation is required before creating an application", 409)
    if float(match.final_score) < get_settings().external_job_min_match_score:
        raise ApplicationWorkflowError("Only an eligible recommendation can be used to create an application", 409)
    if await external_job_match_is_stale(session, match):
        raise ApplicationWorkflowError("Refresh this recommendation before creating an application", 409)
    resume = await session.scalar(
        select(ResumeDocument).where(
            ResumeDocument.student_id == student.id,
            ResumeDocument.is_active.is_(True),
        )
    )
    if resume is None:
        raise ApplicationWorkflowError("Select an active resume before creating an application", 409)
    job_content_fingerprint = _fingerprint(
        {
            "provider": job.provider,
            "provider_source": job.provider_source,
            "external_id": job.external_id,
            "title": job.title,
            "company_name": job.company_name,
            "description": job.description,
            "apply_url": job.apply_url,
            "source_url": job.source_url,
            "employment_type": job.employment_type,
        }
    )
    snapshot = {
        "schema_version": "application-v1",
        "job": {
            "id": str(job.id),
            "provider": job.provider,
            "provider_source": job.provider_source,
            "external_id": job.external_id,
            "title": job.title,
            "company_name": job.company_name,
            "source_url": job.source_url,
            "manual_apply_url": job.apply_url or job.source_url,
            "content_fingerprint": job_content_fingerprint,
        },
        "recommendation": await _recommendation_snapshot(session, match),
        "resume": {
            "id": str(resume.id),
            "original_filename": resume.original_filename,
            "checksum": resume.checksum,
            "parser_version": resume.parser_version,
            "parsed_at": resume.parsed_at,
        },
        # This is intentionally separate from matching_view and never enters matching.
        "application_profile": _application_profile(student, resume),
        "sensitive_question_policy": "requires_direct_user_input",
    }
    return ApplicationSnapshot(
        payload=snapshot,
        fingerprint=_fingerprint(snapshot),
        resume_document_id=resume.id,
        provider_capabilities=_capabilities(job.provider),
        manual_apply_url=job.apply_url or job.source_url,
    )


def _audit(application: Application, action: str, *, from_status: ApplicationStatus | None = None) -> AuditLog:
    details: dict[str, object] = {
        "job_id": str(application.external_job_id),
        "to_status": application.status.value,
        "application_fingerprint": application.application_fingerprint,
    }
    if from_status is not None:
        details["from_status"] = from_status.value
    return AuditLog(actor_id=application.student_id, action=action, entity_type="application", entity_id=application.id, details=details)


def _set_snapshot(application: Application, snapshot: ApplicationSnapshot) -> None:
    application.application_snapshot = snapshot.payload
    application.application_fingerprint = snapshot.fingerprint
    application.resume_document_id = snapshot.resume_document_id
    application.provider_capabilities = snapshot.provider_capabilities
    application.manual_apply_url = snapshot.manual_apply_url


async def create_application_intent(session: AsyncSession, *, student: Student, external_job_id: UUID, external_job_match_id: UUID) -> Application:
    exists = await session.scalar(select(Application.id).where(Application.student_id == student.id, Application.external_job_id == external_job_id))
    if exists is not None:
        raise ApplicationWorkflowError("An application record already exists for this job", 409)
    snapshot = await build_application_snapshot(session, student=student, external_job_id=external_job_id, required_match_id=external_job_match_id)
    application = Application(
        student_id=student.id,
        external_job_id=external_job_id,
        external_job_match_id=external_job_match_id,
        resume_document_id=snapshot.resume_document_id,
        status=ApplicationStatus.approval_pending,
        application_snapshot=snapshot.payload,
        application_fingerprint=snapshot.fingerprint,
        provider_capabilities=snapshot.provider_capabilities,
        manual_apply_url=snapshot.manual_apply_url,
    )
    session.add(application)
    await session.flush()
    session.add(_audit(application, "application_intent_created"))
    await session.commit()
    await session.refresh(application)
    return application


async def application_is_stale(session: AsyncSession, application: Application, student: Student) -> bool:
    if application.status != ApplicationStatus.approved:
        return False
    try:
        current = await build_application_snapshot(
            session,
            student=student,
            external_job_id=application.external_job_id,
            required_match_id=application.external_job_match_id,
        )
    except ApplicationWorkflowError:
        return True
    return current.fingerprint != application.approved_fingerprint


async def request_approval(session: AsyncSession, *, application: Application, student: Student) -> Application:
    if application.status == ApplicationStatus.approved and await application_is_stale(session, application, student):
        previous = application.status
        application.status = ApplicationStatus.approval_pending
        session.add(_audit(application, "approval_invalidated", from_status=previous))
    if application.status != ApplicationStatus.approval_pending:
        raise ApplicationWorkflowError("Approval can only be requested for a pending application")
    snapshot = await build_application_snapshot(session, student=student, external_job_id=application.external_job_id, required_match_id=application.external_job_match_id)
    _set_snapshot(application, snapshot)
    session.add(_audit(application, "approval_requested"))
    await session.commit()
    await session.refresh(application)
    return application


async def approve_application(session: AsyncSession, *, application: Application, student: Student) -> Application:
    if application.status == ApplicationStatus.approved and await application_is_stale(session, application, student):
        previous = application.status
        application.status = ApplicationStatus.approval_pending
        session.add(_audit(application, "approval_invalidated", from_status=previous))
        await session.commit()
        raise ApplicationWorkflowError("Application inputs changed. Review the updated application and approve again.")
    if application.status != ApplicationStatus.approval_pending:
        raise ApplicationWorkflowError("Only a pending application can be approved")
    current = await build_application_snapshot(session, student=student, external_job_id=application.external_job_id, required_match_id=application.external_job_match_id)
    if current.fingerprint != application.application_fingerprint:
        _set_snapshot(application, current)
        session.add(_audit(application, "approval_requested"))
        await session.commit()
        raise ApplicationWorkflowError("Application inputs changed. Review the updated application and approve again.")
    pending_status = ApplicationStatus.approval_pending
    application.status = ApplicationStatus.approved
    application.approved_at = _now()
    application.approved_fingerprint = current.fingerprint
    application.approval_revoked_at = None
    session.add(_audit(application, "application_approved", from_status=pending_status))
    await session.commit()
    await session.refresh(application)
    return application


async def revoke_approval(session: AsyncSession, *, application: Application) -> Application:
    if application.status != ApplicationStatus.approved:
        raise ApplicationWorkflowError("Only an approved application can have approval revoked")
    previous = application.status
    application.status = ApplicationStatus.approval_pending
    application.approval_revoked_at = _now()
    session.add(_audit(application, "approval_revoked", from_status=previous))
    await session.commit()
    await session.refresh(application)
    return application


async def select_manual_apply(session: AsyncSession, *, application: Application) -> Application:
    if application.status not in {ApplicationStatus.approval_pending, ApplicationStatus.approved}:
        raise ApplicationWorkflowError("Manual application is not available in the current state")
    previous = application.status
    application.status = ApplicationStatus.manual_apply
    session.add(_audit(application, "manual_apply_selected", from_status=previous))
    await session.commit()
    await session.refresh(application)
    return application


async def withdraw_application(session: AsyncSession, *, application: Application) -> Application:
    if application.status not in {ApplicationStatus.approval_pending, ApplicationStatus.approved, ApplicationStatus.manual_apply}:
        raise ApplicationWorkflowError("This application cannot be withdrawn in the current state")
    previous = application.status
    application.status = ApplicationStatus.withdrawn
    application.withdrawn_at = _now()
    session.add(_audit(application, "application_withdrawn", from_status=previous))
    await session.commit()
    await session.refresh(application)
    return application


async def invalidate_approved_applications_for_student(session: AsyncSession, student_id: UUID) -> int:
    """Invalidate approvals after an active-resume change without exposing profile data in audit logs."""
    applications = list(
        (
            await session.scalars(
                select(Application).where(Application.student_id == student_id, Application.status == ApplicationStatus.approved)
            )
        ).all()
    )
    for application in applications:
        previous = application.status
        application.status = ApplicationStatus.approval_pending
        session.add(_audit(application, "approval_invalidated", from_status=previous))
    return len(applications)


async def invalidate_stale_approved_applications_for_jobs(session: AsyncSession, external_job_ids: set[UUID]) -> int:
    if not external_job_ids:
        return 0
    rows = (
        await session.execute(
            select(Application, Student)
            .join(Student, Student.id == Application.student_id)
            .where(Application.external_job_id.in_(external_job_ids), Application.status == ApplicationStatus.approved)
        )
    ).all()
    invalidated = 0
    for application, student in rows:
        if not await application_is_stale(session, application, student):
            continue
        previous = application.status
        application.status = ApplicationStatus.approval_pending
        session.add(_audit(application, "approval_invalidated", from_status=previous))
        invalidated += 1
    return invalidated
