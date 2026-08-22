"""API Router for Mentorship Sessions, Innovation Challenges, and Live Industry Projects."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Student
from app.schemas.contracts import (
    InnovationChallengeResponse,
    MentorshipSessionResponse,
    ProjectApplicationCreate,
    ProjectApplicationResponse,
)
from app.services import collaboration_service

router = APIRouter(prefix="/collaborations", tags=["collaborations"])


@router.get("/mentorship", response_model=list[MentorshipSessionResponse])
async def get_mentorship_sessions(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[MentorshipSessionResponse]:
    return await collaboration_service.list_mentorship_sessions(session)


@router.get("/challenges", response_model=list[InnovationChallengeResponse])
async def get_challenges(
    session: Annotated[AsyncSession, Depends(get_session)],
    challenge_type: str | None = None,
) -> list[InnovationChallengeResponse]:
    return await collaboration_service.list_innovation_challenges(session, challenge_type)


@router.post("/projects/apply", response_model=ProjectApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_project(
    payload: ProjectApplicationCreate,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectApplicationResponse:
    try:
        return await collaboration_service.apply_for_project(session, student.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get("/projects/me", response_model=list[ProjectApplicationResponse])
async def get_my_projects(
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ProjectApplicationResponse]:
    return await collaboration_service.list_student_project_applications(session, student.id)
