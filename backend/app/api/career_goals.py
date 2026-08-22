"""API Router for Student Career Goals and Ambition Profiles."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Student
from app.schemas.contracts import CareerGoalsResponse, CareerGoalsUpdate
from app.services.skill_gap_service import (
    get_student_career_goals,
    update_student_career_goals,
)

router = APIRouter(prefix="/career-goals", tags=["career-goals"])


@router.get("", response_model=CareerGoalsResponse)
async def get_career_goals(
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CareerGoalsResponse:
    return await get_student_career_goals(session, student.id)


@router.put("", response_model=CareerGoalsResponse)
async def set_career_goals(
    payload: CareerGoalsUpdate,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CareerGoalsResponse:
    return await update_student_career_goals(session, student.id, payload)
