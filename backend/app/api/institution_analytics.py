"""API Router for Institution Level Employability and Skill Analytics."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Admin, Institution
from app.schemas.contracts import InstitutionAnalyticsOverview
from app.services.institution_analytics_service import get_institution_analytics

router = APIRouter(prefix="/institution", tags=["institution"])


@router.get("/analytics", response_model=InstitutionAnalyticsOverview)
async def get_analytics(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionAnalyticsOverview:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await get_institution_analytics(session, inst_id)
