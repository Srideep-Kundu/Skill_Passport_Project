from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Application, ApplicationField, ExternalJob, Student
from app.schemas.contracts import (
    ApplicationAnswersUpdate,
    ApplicationCreate,
    ApplicationFieldResponse,
    ApplicationFormResponse,
    ApplicationResponse,
    PaginatedResponse,
)
from app.services.application_execution_service import (
    get_prepared_form,
    prepare_application,
    ready_application,
    submit_application,
    update_application_answers,
)
from app.services.application_service import (
    ApplicationWorkflowError,
    application_is_stale,
    approve_application,
    create_application_intent,
    request_approval,
    revoke_approval,
    select_manual_apply,
    withdraw_application,
)

router = APIRouter(prefix="/applications", tags=["applications"])


def _workflow_error(error: ApplicationWorkflowError) -> HTTPException:
    return HTTPException(status_code=error.status_code, detail=error.detail)


async def _owned_application(session: AsyncSession, application_id: UUID, student_id: UUID) -> Application:
    application = await session.scalar(
        select(Application).where(Application.id == application_id, Application.student_id == student_id)
    )
    if application is None:
        # Use the same response for absent and other-student records to avoid ID enumeration.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return application


async def _response(session: AsyncSession, application: Application, student: Student) -> ApplicationResponse:
    payload = ApplicationResponse.model_validate(application)
    return payload.model_copy(update={"is_approval_stale": await application_is_stale(session, application, student)})


def _field_response(field: ApplicationField) -> ApplicationFieldResponse:
    is_answered = field.answer is not None and field.answer != "" and field.answer != []
    return ApplicationFieldResponse(
        field_id=field.field_id,
        label=field.label,
        field_type=field.field_type,
        required=field.required,
        category=field.category,
        allowed_values=field.allowed_values,
        sensitive=field.sensitive,
        source=field.source,
        answer=None if field.sensitive else field.answer,
        answer_source=field.answer_source,
        requires_user_input=field.requires_user_input,
        is_answered=is_answered,
    )


async def _form_response(session: AsyncSession, application: Application) -> ApplicationFormResponse:
    form = await get_prepared_form(session, application)
    job = await session.get(ExternalJob, application.external_job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="External job not found")
    return ApplicationFormResponse(
        application_id=application.id,
        provider=job.provider,
        provider_auto_apply=not form.is_assisted,
        provider_schema_version=application.provider_schema_version,
        payload_fingerprint=application.execution_payload_fingerprint,
        unresolved_field_ids=form.unresolved_field_ids,
        is_assisted=form.is_assisted,
        fields=[_field_response(field) for field in form.fields],
    )


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    try:
        application = await create_application_intent(
            session,
            student=principal,
            external_job_id=payload.external_job_id,
            external_job_match_id=payload.external_job_match_id,
        )
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error
    return await _response(session, application, principal)


@router.get("", response_model=PaginatedResponse[ApplicationResponse])
async def list_applications(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[ApplicationResponse]:
    filters = [Application.student_id == principal.id]
    total = int((await session.scalar(select(func.count()).select_from(Application).where(*filters))) or 0)
    applications = list(
        (
            await session.scalars(
                select(Application)
                .where(*filters)
                .order_by(Application.created_at.desc(), Application.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return PaginatedResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=[await _response(session, application, principal) for application in applications],
    )


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    return await _response(session, await _owned_application(session, application_id, principal.id), principal)


@router.post("/{application_id}/prepare", response_model=ApplicationFormResponse)
async def prepare_application_form(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationFormResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        await prepare_application(session, application=application, student=principal)
        return await _form_response(session, application)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error


@router.get("/{application_id}/form", response_model=ApplicationFormResponse)
async def get_application_form(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationFormResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        return await _form_response(session, application)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error


@router.put("/{application_id}/answers", response_model=ApplicationFormResponse)
async def set_application_answers(
    application_id: UUID,
    payload: ApplicationAnswersUpdate,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationFormResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        await update_application_answers(session, application=application, student=principal, answers=payload.answers)
        return await _form_response(session, application)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error


@router.post("/{application_id}/ready", response_model=ApplicationResponse)
async def mark_application_ready(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        application = await ready_application(session, application=application, student=principal)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error
    return await _response(session, application, principal)


@router.post("/{application_id}/submit", response_model=ApplicationResponse)
async def execute_application_submission(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        application = await submit_application(session, application=application, student=principal)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error
    return await _response(session, application, principal)


@router.post("/{application_id}/request-approval", response_model=ApplicationResponse)
async def request_application_approval(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        application = await request_approval(session, application=application, student=principal)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error
    return await _response(session, application, principal)


@router.post("/{application_id}/approve", response_model=ApplicationResponse)
async def approve_application_intent(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        application = await approve_application(session, application=application, student=principal)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error
    return await _response(session, application, principal)


@router.post("/{application_id}/revoke-approval", response_model=ApplicationResponse)
async def revoke_application_approval(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        application = await revoke_approval(session, application=application)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error
    return await _response(session, application, principal)


@router.post("/{application_id}/manual", response_model=ApplicationResponse)
async def choose_manual_application(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        application = await select_manual_apply(session, application=application)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error
    return await _response(session, application, principal)


@router.post("/{application_id}/withdraw", response_model=ApplicationResponse)
async def withdraw_application_intent(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, application_id, principal.id)
    try:
        application = await withdraw_application(session, application=application)
    except ApplicationWorkflowError as error:
        raise _workflow_error(error) from error
    return await _response(session, application, principal)
