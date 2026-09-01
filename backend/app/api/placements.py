"""API Router for Campus Placement Drives, Recruiter Candidate Ranking, and Registrations."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import current_principal, require_role
from app.models import Recruiter, Student
from app.schemas.contracts import (
    PlacementCandidateRanking,
    PlacementDriveCreate,
    PlacementDriveResponse,
    PlacementDriveUpdate,
    PlacementRegistrationRequest,
    PlacementRegistrationStageUpdate,
    PlacementStatusEventResponse,
)
from app.services import placement_service

router = APIRouter(prefix="/placements", tags=["placements"])


def _domain_error(exc: ValueError) -> HTTPException:
    if isinstance(exc, placement_service.PlacementNotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    if isinstance(exc, placement_service.PlacementConflictError):
        return HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))


@router.get("/drives", response_model=list[PlacementDriveResponse])
async def get_placement_drives(
    principal: Annotated[Student | Recruiter, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[PlacementDriveResponse]:
    student_id = principal.id if isinstance(principal, Student) else None
    recruiter_id = principal.id if isinstance(principal, Recruiter) else None
    return await placement_service.list_placement_drives(session, student_id=student_id, recruiter_id=recruiter_id)


@router.post("/drives", response_model=PlacementDriveResponse, status_code=status.HTTP_201_CREATED)
async def create_placement_drive(
    payload: PlacementDriveCreate,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PlacementDriveResponse:
    try:
        return await placement_service.create_placement_drive(
            session, recruiter.id, payload
        )
    except ValueError as exc:
        raise _domain_error(exc) from exc


@router.get("/drives/mine", response_model=list[PlacementDriveResponse])
async def get_my_placement_drives(
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[PlacementDriveResponse]:
    return await placement_service.list_placement_drives(
        session, recruiter_id=recruiter.id
    )


@router.get("/drives/{id}", response_model=PlacementDriveResponse)
async def get_placement_drive(
    id: UUID,
    principal: Annotated[Student | Recruiter, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PlacementDriveResponse:
    try:
        return await placement_service.get_placement_drive(session, id, principal)
    except ValueError as exc:
        raise _domain_error(exc) from exc


@router.patch("/drives/{id}", response_model=PlacementDriveResponse)
async def update_placement_drive(
    id: UUID,
    payload: PlacementDriveUpdate,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PlacementDriveResponse:
    try:
        return await placement_service.update_placement_drive(
            session, id, recruiter.id, payload
        )
    except ValueError as exc:
        raise _domain_error(exc) from exc


@router.delete("/drives/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_placement_drive(
    id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    try:
        await placement_service.delete_placement_drive(session, id, recruiter.id)
    except ValueError as exc:
        raise _domain_error(exc) from exc


@router.post("/register", response_model=PlacementDriveResponse)
async def register_placement_drive(
    payload: PlacementRegistrationRequest,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PlacementDriveResponse:
    try:
        return await placement_service.register_for_placement(session, student.id, payload)
    except ValueError as exc:
        raise _domain_error(exc) from exc


@router.get("/drives/{id}/candidates", response_model=list[PlacementCandidateRanking])
async def get_drive_candidates(
    id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[PlacementCandidateRanking]:
    try:
        return await placement_service.rank_placement_candidates(
            session, id, recruiter.id, page=page, page_size=page_size
        )
    except ValueError as exc:
        raise _domain_error(exc) from exc


@router.patch("/registrations/{id}/stage", response_model=PlacementCandidateRanking)
async def update_registration_stage(
    id: UUID,
    payload: PlacementRegistrationStageUpdate,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PlacementCandidateRanking:
    try:
        return await placement_service.update_placement_stage(session, id, recruiter.id, payload)
    except ValueError as exc:
        raise _domain_error(exc) from exc


@router.get(
    "/registrations/{id}/timeline",
    response_model=list[PlacementStatusEventResponse],
)
async def get_registration_timeline(
    id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[PlacementStatusEventResponse]:
    try:
        return await placement_service.placement_registration_timeline(
            session, id, recruiter.id
        )
    except ValueError as exc:
        raise _domain_error(exc) from exc
