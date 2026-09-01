"""Unified student-owned application read and action endpoints."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Student
from app.schemas.contracts import (
    UnifiedApplicationPage,
    UnifiedApplicationResponse,
    UnifiedApplicationTimelineEvent,
)
from app.services import unified_application_service as service

router = APIRouter(prefix="/students/me/applications", tags=["student applications"])


def _domain_error(exc: ValueError) -> HTTPException:
    if isinstance(exc, service.UnifiedApplicationNotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    return HTTPException(status.HTTP_409_CONFLICT, str(exc))


@router.get("", response_model=UnifiedApplicationPage)
async def list_applications(
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    source_type: Literal["external_job", "placement", "internship"] | None = None,
    normalized_status: str | None = Query(default=None, max_length=32),
    action_required: bool | None = None,
    order: Literal["asc", "desc"] = "desc",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> UnifiedApplicationPage:
    items = await service.list_unified_applications(
        session,
        student.id,
        source_type=source_type,
        normalized_status=normalized_status,
        action_required=action_required,
        sort_order=order,
    )
    start = (page - 1) * page_size
    return UnifiedApplicationPage(
        page=page,
        page_size=page_size,
        total=len(items),
        items=items[start : start + page_size],
    )


@router.get(
    "/{source_type}/{id}/timeline",
    response_model=list[UnifiedApplicationTimelineEvent],
)
async def application_timeline(
    source_type: Literal["external_job", "placement", "internship"],
    id: UUID,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[UnifiedApplicationTimelineEvent]:
    try:
        return await service.application_timeline(session, student.id, source_type, id)
    except ValueError as exc:
        raise _domain_error(exc) from exc


@router.post(
    "/{source_type}/{id}/withdraw",
    response_model=UnifiedApplicationResponse,
)
async def withdraw_application(
    source_type: Literal["external_job", "placement", "internship"],
    id: UUID,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UnifiedApplicationResponse:
    try:
        await service.withdraw_unified_application(
            session, student.id, source_type, id
        )
        items = await service.list_unified_applications(
            session, student.id, source_type=source_type
        )
        return next(item for item in items if item.id == id)
    except StopIteration as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found") from exc
    except ValueError as exc:
        raise _domain_error(exc) from exc
