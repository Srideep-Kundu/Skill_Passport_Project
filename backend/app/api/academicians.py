"""API Router for Academician & Faculty Opportunities (FDP, Immersion, Consultancy, Grants)."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Academician
from app.schemas.contracts import (
    FacultyApplicationRequest,
    FacultyApplicationResponse,
    FacultyOpportunityResponse,
)
from app.services.academician_service import (
    apply_for_opportunity,
    list_faculty_opportunities,
)

router = APIRouter(prefix="/academician", tags=["academician"])


@router.get("/opportunities", response_model=list[FacultyOpportunityResponse])
async def get_opportunities(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    opportunity_type: str | None = Query(default=None),
) -> list[FacultyOpportunityResponse]:
    return await list_faculty_opportunities(session, faculty.id, opportunity_type)


@router.post("/apply", response_model=FacultyApplicationResponse)
async def apply_opportunity(
    payload: FacultyApplicationRequest,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyApplicationResponse:
    try:
        return await apply_for_opportunity(session, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
