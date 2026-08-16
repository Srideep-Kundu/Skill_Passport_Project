from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Application, Student
from app.schemas.contracts import (
    ApplicationCreate,
    ApplicationResponse,
    PaginatedResponse,
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
