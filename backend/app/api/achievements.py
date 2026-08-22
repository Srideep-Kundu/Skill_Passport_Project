"""API Router for Student Portfolio Achievements and Awards."""
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Student
from app.services.achievement_service import (
    StudentAchievementCreate,
    StudentAchievementResponse,
    create_student_achievement,
    list_student_achievements,
)

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("/me", response_model=list[StudentAchievementResponse])
async def get_my_achievements(
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[StudentAchievementResponse]:
    return await list_student_achievements(session, student.id)


@router.post("", response_model=StudentAchievementResponse, status_code=status.HTTP_201_CREATED)
async def add_achievement(
    payload: StudentAchievementCreate,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> StudentAchievementResponse:
    return await create_student_achievement(session, student.id, payload)
