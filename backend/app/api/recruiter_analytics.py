"""API Router for Corporate Recruiter Skill Demand & Funnel Analytics."""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Recruiter
from app.schemas.contracts import RecruiterDemandAnalytics
from app.services.demand_supply_service import recruiter_demand_analytics
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


@router.get("/me/demand", response_model=RecruiterDemandAnalytics)
async def get_my_recruiter_demand(
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    opportunity_type: Literal["all", "internship", "placement"] = Query("all"),
    active_only: bool = Query(True),
) -> RecruiterDemandAnalytics:
    """Return demand and authorized applicant supply for this company only."""
    return await recruiter_demand_analytics(
        session,
        recruiter.id,
        opportunity_type=opportunity_type,
        active_only=active_only,
    )
