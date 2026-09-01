from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Recruiter, Student
from app.schemas.contracts import (
    InternshipCompletionRequest,
    InternshipEngagementCreate,
    InternshipEngagementResponse,
    InternshipEngagementUpdate,
    MentorFeedbackRequest,
)
from app.services import internship_engagement_service

router = APIRouter(prefix="/internship-engagements", tags=["internship-engagements"])


def _domain_http_error(exc: ValueError) -> HTTPException:
    if isinstance(exc, internship_engagement_service.EngagementNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, internship_engagement_service.EngagementConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
    )


@router.get("/me", response_model=list[InternshipEngagementResponse])
async def list_my_engagements(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[InternshipEngagementResponse]:
    return await internship_engagement_service.list_student_engagements(session, principal.id)


@router.get("/recruiter", response_model=list[InternshipEngagementResponse])
async def list_recruiter_engagements(
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    internship_id: UUID | None = None,
) -> list[InternshipEngagementResponse]:
    try:
        return await internship_engagement_service.list_recruiter_engagements(
            session, principal.id, internship_id
        )
    except ValueError as exc:
        raise _domain_http_error(exc) from exc


@router.post("", response_model=InternshipEngagementResponse, status_code=status.HTTP_201_CREATED)
async def create_engagement(
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: InternshipEngagementCreate,
) -> InternshipEngagementResponse:
    try:
        return await internship_engagement_service.create_internship_engagement(session, principal.id, payload)
    except ValueError as exc:
        raise _domain_http_error(exc) from exc


@router.patch("/{id}/status", response_model=InternshipEngagementResponse)
async def update_status(
    id: UUID,
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: InternshipEngagementUpdate,
) -> InternshipEngagementResponse:
    try:
        return await internship_engagement_service.update_engagement_status(session, id, principal.id, payload)
    except ValueError as exc:
        raise _domain_http_error(exc) from exc


@router.post("/{id}/feedback", response_model=InternshipEngagementResponse)
async def submit_feedback(
    id: UUID,
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: MentorFeedbackRequest,
) -> InternshipEngagementResponse:
    try:
        return await internship_engagement_service.submit_mentor_feedback(session, id, principal.id, payload)
    except ValueError as exc:
        raise _domain_http_error(exc) from exc


@router.post("/{id}/complete", response_model=InternshipEngagementResponse)
async def complete_engagement(
    id: UUID,
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: InternshipCompletionRequest,
) -> InternshipEngagementResponse:
    try:
        return await internship_engagement_service.complete_engagement(
            session, id, principal.id, payload
        )
    except ValueError as exc:
        raise _domain_http_error(exc) from exc


@router.post("/{id}/withdraw", response_model=InternshipEngagementResponse)
async def withdraw_engagement(
    id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InternshipEngagementResponse:
    try:
        return await internship_engagement_service.withdraw_engagement(
            session, id, principal.id
        )
    except ValueError as exc:
        raise _domain_http_error(exc) from exc
