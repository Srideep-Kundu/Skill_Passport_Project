from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import require_role
from app.models import JobDiscovery, JobDiscoveryRun, Student
from app.schemas.contracts import (
    JobDiscoveryCreate,
    JobDiscoveryResponse,
    JobDiscoveryRunResponse,
    JobDiscoveryUpdate,
    PaginatedResponse,
)
from app.services.discovery_service import (
    DiscoveryError,
    create_discovery,
    run_discovery,
    update_discovery,
)
from app.services.rate_limit_service import enforce_rate_limit

router = APIRouter(prefix="/job-discoveries", tags=["job-discoveries"])


async def _owned(session: AsyncSession, discovery_id: UUID, student_id: UUID) -> JobDiscovery:
    discovery = await session.scalar(select(JobDiscovery).where(JobDiscovery.id == discovery_id, JobDiscovery.student_id == student_id))
    if discovery is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Saved discovery not found")
    return discovery


def _error(error: DiscoveryError) -> HTTPException:
    return HTTPException(error.status_code, error.detail)


@router.post("", response_model=JobDiscoveryResponse, status_code=status.HTTP_201_CREATED)
async def create(payload: JobDiscoveryCreate, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> JobDiscovery:
    try:
        return await create_discovery(session, student_id=principal.id, values=payload.model_dump())
    except DiscoveryError as error:
        raise _error(error) from error


@router.get("", response_model=PaginatedResponse[JobDiscoveryResponse])
async def list_discoveries(principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)], page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=100)] = 20) -> PaginatedResponse[JobDiscoveryResponse]:
    filters = [JobDiscovery.student_id == principal.id]
    total = int((await session.scalar(select(func.count()).select_from(JobDiscovery).where(*filters))) or 0)
    items = list((await session.scalars(select(JobDiscovery).where(*filters).order_by(JobDiscovery.updated_at.desc(), JobDiscovery.id.desc()).offset((page - 1) * page_size).limit(page_size))).all())
    return PaginatedResponse(page=page, page_size=page_size, total=total, items=[JobDiscoveryResponse.model_validate(item) for item in items])


@router.get("/{discovery_id}", response_model=JobDiscoveryResponse)
async def get(discovery_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> JobDiscovery:
    return await _owned(session, discovery_id, principal.id)


@router.patch("/{discovery_id}", response_model=JobDiscoveryResponse)
async def update(discovery_id: UUID, payload: JobDiscoveryUpdate, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> JobDiscovery:
    try:
        return await update_discovery(session, discovery=await _owned(session, discovery_id, principal.id), values=payload.model_dump(exclude_unset=True))
    except DiscoveryError as error:
        raise _error(error) from error


@router.delete("/{discovery_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(discovery_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> None:
    discovery = await _owned(session, discovery_id, principal.id)
    await session.delete(discovery)
    await session.commit()


@router.post("/{discovery_id}/run", response_model=JobDiscoveryRunResponse)
async def run(discovery_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> JobDiscoveryRun:
    await enforce_rate_limit(
        "discovery-run",
        str(principal.id),
        get_settings().discovery_run_rate_limit_per_minute,
    )
    try:
        return await run_discovery(session, discovery=await _owned(session, discovery_id, principal.id))
    except DiscoveryError as error:
        raise _error(error) from error


@router.get("/{discovery_id}/runs", response_model=PaginatedResponse[JobDiscoveryRunResponse])
async def runs(discovery_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)], page: Annotated[int, Query(ge=1)] = 1, page_size: Annotated[int, Query(ge=1, le=100)] = 20) -> PaginatedResponse[JobDiscoveryRunResponse]:
    await _owned(session, discovery_id, principal.id)
    filters = [JobDiscoveryRun.discovery_id == discovery_id]
    total = int((await session.scalar(select(func.count()).select_from(JobDiscoveryRun).where(*filters))) or 0)
    items = list((await session.scalars(select(JobDiscoveryRun).where(*filters).order_by(JobDiscoveryRun.started_at.desc(), JobDiscoveryRun.id.desc()).offset((page - 1) * page_size).limit(page_size))).all())
    return PaginatedResponse(page=page, page_size=page_size, total=total, items=[JobDiscoveryRunResponse.model_validate(item) for item in items])
