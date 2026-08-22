"""Academician / Faculty Ecosystem Service.

Manages Faculty Development Programs (FDP), Industrial Immersion,
Joint Research Grants, and Consultancy Requests.
"""
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Academician, FacultyApplication, FacultyOpportunity
from app.schemas.contracts import (
    FacultyApplicationRequest,
    FacultyApplicationResponse,
    FacultyOpportunityResponse,
)


async def list_faculty_opportunities(
    session: AsyncSession,
    faculty_id: UUID | None = None,
    opportunity_type: str | None = None,
) -> list[FacultyOpportunityResponse]:
    stmt = select(FacultyOpportunity)
    if opportunity_type:
        stmt = stmt.where(FacultyOpportunity.opportunity_type == opportunity_type)

    opportunities = (await session.scalars(stmt)).all()

    app_map: dict[UUID, FacultyApplication] = {}
    if faculty_id:
        apps = (
            await session.scalars(
                select(FacultyApplication).where(FacultyApplication.faculty_id == faculty_id)
            )
        ).all()
        app_map = {a.opportunity_id: a for a in apps}

    results: list[FacultyOpportunityResponse] = []
    for opp in opportunities:
        app = app_map.get(opp.id)
        results.append(
            FacultyOpportunityResponse(
                id=opp.id,
                title=opp.title,
                opportunity_type=opp.opportunity_type,
                organization_name=opp.organization_name,
                description=opp.description,
                domain=opp.domain,
                stipend_or_grant=float(opp.stipend_or_grant) if opp.stipend_or_grant else None,
                duration_weeks=opp.duration_weeks,
                deadline=opp.deadline,
                status=opp.status,
                has_applied=app is not None,
                application_status=app.status if app else None,
            )
        )
    return results


async def apply_for_opportunity(
    session: AsyncSession,
    faculty_id: UUID,
    payload: FacultyApplicationRequest,
) -> FacultyApplicationResponse:
    opp = await session.get(FacultyOpportunity, payload.opportunity_id)
    if not opp:
        raise ValueError("Opportunity not found")

    existing = (
        await session.scalars(
            select(FacultyApplication).where(
                FacultyApplication.faculty_id == faculty_id,
                FacultyApplication.opportunity_id == opp.id,
            )
        )
    ).first()
    if existing:
        return FacultyApplicationResponse(
            id=existing.id,
            opportunity_id=opp.id,
            opportunity_title=opp.title,
            organization_name=opp.organization_name,
            opportunity_type=opp.opportunity_type,
            status=existing.status,
            proposal_text=existing.proposal_text,
            applied_at=existing.applied_at,
        )

    app = FacultyApplication(
        faculty_id=faculty_id,
        opportunity_id=opp.id,
        status="applied",
        proposal_text=payload.proposal_text,
    )
    session.add(app)
    await session.commit()

    return FacultyApplicationResponse(
        id=app.id,
        opportunity_id=opp.id,
        opportunity_title=opp.title,
        organization_name=opp.organization_name,
        opportunity_type=opp.opportunity_type,
        status=app.status,
        proposal_text=app.proposal_text,
        applied_at=app.applied_at,
    )
