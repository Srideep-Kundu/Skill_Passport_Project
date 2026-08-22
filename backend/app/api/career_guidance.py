"""API Router for Explainable Career Guidance and Role Readiness."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Student
from app.services.career_guidance_service import (
    CareerGuidanceOverview,
    generate_career_guidance,
)

router = APIRouter(prefix="/career-guidance", tags=["career-guidance"])


@router.get("/overview", response_model=CareerGuidanceOverview)
async def get_career_guidance_overview(
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CareerGuidanceOverview:
    return await generate_career_guidance(session, student.id)
