from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Recruiter, Student
from app.schemas.contracts import (
    InternshipEngagementCreate,
    InternshipEngagementResponse,
    InternshipEngagementUpdate,
    MentorFeedbackRequest,
)
from app.services import internship_engagement_service

router = APIRouter(prefix="/internship-engagements", tags=["internship-engagements"])


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
    return await internship_engagement_service.list_recruiter_engagements(session, principal.id, internship_id)


@router.post("", response_model=InternshipEngagementResponse, status_code=status.HTTP_201_CREATED)
async def create_engagement(
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    payload: InternshipEngagementCreate,
) -> InternshipEngagementResponse:
    try:
        return await internship_engagement_service.create_internship_engagement(session, principal.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
