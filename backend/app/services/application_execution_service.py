"""Provider-neutral preparation and submission guardrails for approved applications."""
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Application,
    ApplicationField,
    ApplicationStatus,
    ApplicationSubmissionAttempt,
    AuditLog,
    ExternalJob,
    Student,
    SubmissionAttemptStatus,
)
from app.services.application_service import (
    ApplicationWorkflowError,
    build_application_snapshot,
)
from app.services.job_providers import (
    ApplicationFieldDefinition,
    NormalizedExternalJob,
    ProviderApplicationSchema,
    ProviderError,
    ProviderSubmissionCapability,
    ProviderSubmissionResult,
    ProviderSubmissionUnsupported,
    provider_registry,
)

_FIELD_ID = re.compile(r"^[a-z][a-z0-9_]{0,119}$")
_USER_SOURCE = "user_provided"


@dataclass(frozen=True)
class PreparedForm:
    fields: list[ApplicationField]
    unresolved_field_ids: list[str]
    payload_fingerprint: str
    is_assisted: bool
    submission_capability: ProviderSubmissionCapability


def _now() -> datetime:
    return datetime.now(UTC)


def _fingerprint(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


def _is_empty(value: object | None) -> bool:
    return value is None or value == "" or value == []


def _normalized_job(job: ExternalJob) -> NormalizedExternalJob:
    return NormalizedExternalJob(
        provider=job.provider,
        provider_source=job.provider_source,
        external_id=job.external_id,
        title=job.title,
        company_name=job.company_name,
        description=job.description,
        location=job.location,
        remote_status=job.remote_status,
        employment_type=job.employment_type,
        experience_level=job.experience_level,
        salary_min=float(job.salary_min) if job.salary_min is not None else None,
        salary_max=float(job.salary_max) if job.salary_max is not None else None,
        salary_currency=job.salary_currency,
        apply_url=job.apply_url,
        source_url=job.source_url,
        posted_at=job.posted_at,
        expires_at=job.expires_at,
        raw_metadata=job.raw_metadata,
    )


async def _provider_and_job(session: AsyncSession, application: Application):
    job = await session.get(ExternalJob, application.external_job_id)
    if job is None or not job.is_active:
        raise ApplicationWorkflowError("This job is no longer available")
    try:
        provider = provider_registry.get(job.provider)
    except ProviderError as error:
        raise ApplicationWorkflowError("The application provider is unavailable") from error
    return provider, job


async def _approval_is_current(session: AsyncSession, application: Application, student: Student) -> None:
    if application.approved_fingerprint is None:
        raise ApplicationWorkflowError("This application has not been approved")
    current = await build_application_snapshot(
        session,
        student=student,
        external_job_id=application.external_job_id,
        required_match_id=application.external_job_match_id,
    )
    if current.fingerprint != application.approved_fingerprint:
        raise ApplicationWorkflowError("Application approval is stale. Review and approve the changed application again.")


def _assisted_schema() -> ProviderApplicationSchema:
    return ProviderApplicationSchema(
        version="assisted-v1",
        fields=(
            ApplicationFieldDefinition("full_name", "Full name", "text", False, "identity", source="profile"),
            ApplicationFieldDefinition("email", "Email", "email", False, "identity", source="profile"),
            ApplicationFieldDefinition("phone", "Phone", "phone", False, "identity", source="profile"),
        ),
    )


def _profile_answer(application: Application, field: ApplicationFieldDefinition) -> tuple[object | None, str | None]:
    if field.sensitive or field.requires_user_input:
        return None, None
    profile = application.application_snapshot.get("application_profile")
    if not isinstance(profile, dict) or field.source != "profile":
        return None, None
    answer = profile.get(field.field_id)
    return (answer, "profile") if not _is_empty(answer) else (None, None)


def _validate_schema(schema: ProviderApplicationSchema) -> None:
    ids = [field.field_id for field in schema.fields]
    if len(ids) != len(set(ids)) or any(not _FIELD_ID.fullmatch(field_id) for field_id in ids):
        raise ApplicationWorkflowError("The provider returned an invalid application schema", 502)
    valid_types = {"text", "textarea", "email", "phone", "url", "select", "multi_select", "boolean", "file", "date", "number"}
    if any(field.field_type not in valid_types for field in schema.fields):
        raise ApplicationWorkflowError("The provider returned an unsupported application field", 502)


def _unresolved(fields: list[ApplicationField]) -> list[str]:
    return [
        field.field_id
        for field in fields
        if field.required
        and (
            _is_empty(field.answer)
            or (field.sensitive and field.answer_source != _USER_SOURCE)
            or (field.requires_user_input and field.answer_source != _USER_SOURCE)
        )
    ]


def _payload(application: Application, fields: list[ApplicationField]) -> dict[str, object]:
    resume = application.application_snapshot.get("resume")
    job = application.application_snapshot.get("job")
    return {
        "application_id": str(application.id),
        "provider": job.get("provider") if isinstance(job, dict) else None,
        "provider_source": job.get("provider_source") if isinstance(job, dict) else None,
        "external_job_id": job.get("external_id") if isinstance(job, dict) else None,
        "external_job_record_id": str(application.external_job_id),
        "approved_application_fingerprint": application.approved_fingerprint,
        "resume": resume,
        "provider_schema_version": application.provider_schema_version,
        "answers": {field.field_id: field.answer for field in sorted(fields, key=lambda item: item.field_id)},
    }


def _audit(application: Application, action: str, details: dict[str, object]) -> AuditLog:
    return AuditLog(
        actor_id=application.student_id,
        action=action,
        entity_type="application",
        entity_id=application.id,
        details={"job_id": str(application.external_job_id), **details},
    )


async def _fields(session: AsyncSession, application_id: UUID) -> list[ApplicationField]:
    return list((await session.scalars(select(ApplicationField).where(ApplicationField.application_id == application_id).order_by(ApplicationField.field_id))).all())


async def get_prepared_form(session: AsyncSession, application: Application) -> PreparedForm:
    provider, job = await _provider_and_job(session, application)
    capability = await provider.get_submission_capability(_normalized_job(job))
    fields = await _fields(session, application.id)
    return PreparedForm(
        fields=fields,
        unresolved_field_ids=_unresolved(fields),
        payload_fingerprint=application.execution_payload_fingerprint or "",
        is_assisted=not capability.submission_ready,
        submission_capability=capability,
    )


async def prepare_application(session: AsyncSession, *, application: Application, student: Student) -> PreparedForm:
    if application.status not in {ApplicationStatus.approved, ApplicationStatus.needs_input, ApplicationStatus.prepared, ApplicationStatus.ready_to_submit}:
        raise ApplicationWorkflowError("This application cannot be prepared in its current state")
    await _approval_is_current(session, application, student)
    provider, job = await _provider_and_job(session, application)
    normalized_job = _normalized_job(job)
    capability = await provider.get_submission_capability(normalized_job)
    schema = await provider.get_application_schema(normalized_job)
    if not capability.submission_ready and not schema.fields:
        schema = _assisted_schema()
    _validate_schema(schema)
    existing = {field.field_id: field for field in await _fields(session, application.id)}
    application.status = ApplicationStatus.preparing
    session.add(_audit(application, "application_preparation_started", {"provider_schema_version": schema.version}))
    await session.execute(delete(ApplicationField).where(ApplicationField.application_id == application.id))
    created: list[ApplicationField] = []
    for definition in schema.fields:
        prior = existing.get(definition.field_id)
        answer, answer_source = (prior.answer, prior.answer_source) if prior and not definition.sensitive else _profile_answer(application, definition)
        field = ApplicationField(
            application_id=application.id,
            field_id=definition.field_id,
            label=definition.label,
            field_type=definition.field_type,
            required=definition.required,
            category=definition.category,
            allowed_values=list(definition.allowed_values),
            sensitive=definition.sensitive,
            source=definition.source,
            answer=answer,
            answer_source=answer_source,
            requires_user_input=definition.requires_user_input,
        )
        session.add(field)
        created.append(field)
    await session.flush()
    unresolved = _unresolved(created)
    application.provider_schema_version = schema.version
    application.prepared_at = _now()
    application.ready_at = None
    application.ready_payload_fingerprint = None
    application.execution_payload_fingerprint = _fingerprint(_payload(application, created))
    application.status = ApplicationStatus.needs_input if unresolved else ApplicationStatus.prepared
    session.add(
        _audit(
            application,
            "application_needs_input" if unresolved else "application_prepared",
            {"unresolved_field_ids": unresolved, "sensitive_field_ids": [field.field_id for field in created if field.sensitive]},
        )
    )
    await session.commit()
    return PreparedForm(created, unresolved, application.execution_payload_fingerprint, not capability.submission_ready, capability)


def _validate_answer(field: ApplicationField, value: object) -> None:
    if field.field_type in {"text", "textarea", "email", "phone", "url", "date"} and (not isinstance(value, str) or len(value) > 10_000):
        raise ApplicationWorkflowError(f"{field.label} has an invalid value", 422)
    if field.field_type == "number" and not isinstance(value, (int, float)):
        raise ApplicationWorkflowError(f"{field.label} has an invalid value", 422)
    if field.field_type == "boolean" and not isinstance(value, bool):
        raise ApplicationWorkflowError(f"{field.label} has an invalid value", 422)
    if field.field_type == "select" and (not isinstance(value, str) or value not in field.allowed_values):
        raise ApplicationWorkflowError(f"{field.label} has an invalid selection", 422)
    if field.field_type == "multi_select" and (not isinstance(value, list) or any(not isinstance(item, str) or item not in field.allowed_values for item in value)):
        raise ApplicationWorkflowError(f"{field.label} has an invalid selection", 422)


async def update_application_answers(session: AsyncSession, *, application: Application, student: Student, answers: dict[str, object]) -> PreparedForm:
    if application.status not in {ApplicationStatus.needs_input, ApplicationStatus.prepared, ApplicationStatus.ready_to_submit}:
        raise ApplicationWorkflowError("Prepare this application before entering answers")
    await _approval_is_current(session, application, student)
    fields = await _fields(session, application.id)
    by_id = {field.field_id: field for field in fields}
    if not answers or len(answers) > 100 or any(field_id not in by_id for field_id in answers):
        raise ApplicationWorkflowError("One or more application fields are invalid", 422)
    for field_id, value in answers.items():
        field = by_id[field_id]
        _validate_answer(field, value)
        field.answer = value
        field.answer_source = _USER_SOURCE
    unresolved = _unresolved(fields)
    application.execution_payload_fingerprint = _fingerprint(_payload(application, fields))
    application.ready_payload_fingerprint = None
    application.ready_at = None
    application.status = ApplicationStatus.needs_input if unresolved else ApplicationStatus.prepared
    session.add(_audit(application, "application_answers_updated", {"field_ids": sorted(answers), "unresolved_field_ids": unresolved}))
    await session.commit()
    provider, job = await _provider_and_job(session, application)
    capability = await provider.get_submission_capability(_normalized_job(job))
    return PreparedForm(fields, unresolved, application.execution_payload_fingerprint, not capability.submission_ready, capability)


async def ready_application(session: AsyncSession, *, application: Application, student: Student) -> Application:
    if application.status != ApplicationStatus.prepared:
        raise ApplicationWorkflowError("Resolve and review the prepared application before marking it ready")
    await _approval_is_current(session, application, student)
    provider, job = await _provider_and_job(session, application)
    capability = await provider.get_submission_capability(_normalized_job(job))
    if not capability.submission_ready:
        raise ApplicationWorkflowError("This provider is assisted/manual only")
    fields = await _fields(session, application.id)
    unresolved = _unresolved(fields)
    if unresolved:
        application.status = ApplicationStatus.needs_input
        session.add(_audit(application, "application_needs_input", {"unresolved_field_ids": unresolved}))
        await session.commit()
        raise ApplicationWorkflowError("Required application fields still need direct input")
    payload_fingerprint = _fingerprint(_payload(application, fields))
    application.execution_payload_fingerprint = payload_fingerprint
    application.ready_payload_fingerprint = payload_fingerprint
    application.ready_at = _now()
    application.status = ApplicationStatus.ready_to_submit
    session.add(_audit(application, "application_ready", {"payload_fingerprint": payload_fingerprint, "field_ids": [field.field_id for field in fields]}))
    await session.commit()
    await session.refresh(application)
    return application


async def submit_application(session: AsyncSession, *, application: Application, student: Student) -> Application:
    if application.status != ApplicationStatus.ready_to_submit:
        raise ApplicationWorkflowError("This application is not ready to submit")
    await _approval_is_current(session, application, student)
    provider, job = await _provider_and_job(session, application)
    capability = await provider.get_submission_capability(_normalized_job(job))
    if not capability.submission_ready:
        raise ApplicationWorkflowError("This provider is assisted/manual only")
    schema = await provider.get_application_schema(_normalized_job(job))
    if schema.version != application.provider_schema_version:
        raise ApplicationWorkflowError("The provider form changed. Prepare and review the application again.")
    fields = await _fields(session, application.id)
    unresolved = _unresolved(fields)
    payload = _payload(application, fields)
    payload_fingerprint = _fingerprint(payload)
    if unresolved or payload_fingerprint != application.execution_payload_fingerprint or payload_fingerprint != application.ready_payload_fingerprint:
        raise ApplicationWorkflowError("The reviewed application payload changed. Prepare and approve it again.")
    provider_errors = await provider.validate_application(payload)
    if provider_errors:
        application.status = ApplicationStatus.needs_input
        session.add(_audit(application, "submission_failed", {"result": "validation_failed", "field_ids": sorted(provider_errors)}))
        await session.commit()
        raise ApplicationWorkflowError("The provider rejected one or more application fields", 422)
    idempotency_key = _fingerprint({"application_id": str(application.id), "payload_fingerprint": payload_fingerprint})
    attempt = await session.scalar(select(ApplicationSubmissionAttempt).where(ApplicationSubmissionAttempt.idempotency_key == idempotency_key))
    if attempt is not None and attempt.status in {SubmissionAttemptStatus.submitted, SubmissionAttemptStatus.submitting, SubmissionAttemptStatus.unknown_submission_state}:
        raise ApplicationWorkflowError("A submission attempt already exists for this reviewed payload")
    if attempt is None:
        attempt = ApplicationSubmissionAttempt(
            application_id=application.id,
            payload_fingerprint=payload_fingerprint,
            idempotency_key=idempotency_key,
            status=SubmissionAttemptStatus.submitting,
            attempt_count=1,
            started_at=_now(),
        )
        session.add(attempt)
    else:
        attempt.status = SubmissionAttemptStatus.submitting
        attempt.attempt_count += 1
        attempt.started_at = _now()
        attempt.completed_at = None
        attempt.safe_error = None
    application.status = ApplicationStatus.submitting
    await session.flush()
    session.add(_audit(application, "submission_started", {"attempt_id": str(attempt.id), "payload_fingerprint": payload_fingerprint}))
    await session.commit()
    try:
        result = await provider.submit_application(payload, idempotency_key=idempotency_key)
    except ProviderSubmissionUnsupported as error:
        result = ProviderSubmissionResult("validation_failed", safe_error=error.safe_message)
    except ProviderError as error:
        # Generic transport/provider failures are ambiguous unless an adapter explicitly declares otherwise.
        result = ProviderSubmissionResult("unknown_submission_state", safe_error=error.safe_message)
    attempt.completed_at = _now()
    attempt.result_type = result.outcome
    attempt.safe_error = result.safe_error
    if result.outcome == "submitted":
        attempt.status = SubmissionAttemptStatus.submitted
        attempt.provider_response_id = result.external_application_id
        application.status = ApplicationStatus.submitted
        application.submitted_at = _now()
        application.external_application_id = result.external_application_id
        application.failure_reason = None
        session.add(_audit(application, "submission_succeeded", {"attempt_id": str(attempt.id), "provider_response_id": result.external_application_id}))
    elif result.outcome in {"temporary_failure", "rate_limited"}:
        attempt.status = SubmissionAttemptStatus.retryable_failure
        application.status = ApplicationStatus.ready_to_submit
        application.failure_reason = result.safe_error
        session.add(_audit(application, "submission_failed", {"attempt_id": str(attempt.id), "result": result.outcome}))
    elif result.outcome == "unknown_submission_state":
        attempt.status = SubmissionAttemptStatus.unknown_submission_state
        application.status = ApplicationStatus.unknown_submission_state
        application.failure_reason = result.safe_error
        session.add(_audit(application, "submission_unknown", {"attempt_id": str(attempt.id)}))
    elif result.outcome == "validation_failed":
        attempt.status = SubmissionAttemptStatus.failed
        application.status = ApplicationStatus.needs_input
        application.failure_reason = result.safe_error
        session.add(_audit(application, "submission_failed", {"attempt_id": str(attempt.id), "result": result.outcome}))
    else:
        attempt.status = SubmissionAttemptStatus.failed
        application.status = ApplicationStatus.failed
        application.failure_reason = result.safe_error
        session.add(_audit(application, "submission_failed", {"attempt_id": str(attempt.id), "result": result.outcome}))
    await session.commit()
    await session.refresh(application)
    return application
