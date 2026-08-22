"""API Router for Skill Gap and Role Readiness Analysis."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Student
from app.schemas.contracts import SkillGapAnalysisResponse
from app.services.skill_gap_service import analyze_skill_gaps

router = APIRouter(prefix="/skill-gaps", tags=["skill-gaps"])


@router.get("/analyze", response_model=SkillGapAnalysisResponse)
async def get_skill_gap_analysis(
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    target_role: str | None = Query(default=None),
) -> SkillGapAnalysisResponse:
    return await analyze_skill_gaps(session, student.id, target_role)
