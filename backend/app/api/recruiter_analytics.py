"""API Router for Corporate Recruiter Skill Demand & Funnel Analytics."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Recruiter
from app.services.recruiter_analytics_service import (
    RecruiterAnalyticsOverview,
    get_recruiter_skill_analytics,
)

router = APIRouter(prefix="/recruiter-analytics", tags=["recruiter-analytics"])


@router.get("/me", response_model=RecruiterAnalyticsOverview)
async def get_my_recruiter_analytics(
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RecruiterAnalyticsOverview:
    return await get_recruiter_skill_analytics(session, recruiter.id, recruiter.company_name)
