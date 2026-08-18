from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import require_role
from app.models import ExternalJob, ExternalJobMatch, ExternalJobRequirement, Student
from app.schemas.contracts import (
    ExplanationResponse,
    ExternalJobMatchResponse,
    ExternalJobMatchStateResponse,
    PaginatedResponse,
)
from app.services.explanation_service import render_external_job_explanation
from app.services.matching_service import (
    external_job_match_is_stale,
    recompute_external_job_matches_for_student,
)

router = APIRouter(tags=["external-job-matches"])


async def _match_response(session: AsyncSession, match: ExternalJobMatch) -> ExternalJobMatchResponse:
    job = await session.get(ExternalJob, match.external_job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="External job not found")
    explanation = await render_external_job_explanation(session, match.id)
    assert explanation is not None
    return ExternalJobMatchResponse(
        id=match.id,
        student_id=match.student_id,
        external_job_id=match.external_job_id,
        title=job.title,
        company_name=job.company_name,
        provider=job.provider,
        external_id=job.external_id,
        source_url=job.source_url,
        location=job.location,
        remote_status=job.remote_status,
        posted_at=job.posted_at,
        is_active=job.is_active,
        deterministic_score=float(match.deterministic_score),
        semantic_score=float(match.semantic_score),
        verification_bonus=float(match.verification_bonus),
        final_score=float(match.final_score),
        score_version=match.score_version,
        is_stale=await external_job_match_is_stale(session, match),
        explanation=ExplanationResponse.model_validate(explanation),
    )


@router.post("/external-jobs/matches/recompute", response_model=list[ExternalJobMatchResponse])
async def recompute_external_job_matches(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ExternalJobMatchResponse]:
    matches = await recompute_external_job_matches_for_student(session, principal.id)
    return [await _match_response(session, match) for match in matches]


@router.get("/external-jobs/matches", response_model=PaginatedResponse[ExternalJobMatchResponse])
async def recommended_external_job_matches(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    location: Annotated[str | None, Query(max_length=255)] = None,
    remote: bool | None = None,
    employment_type: Annotated[str | None, Query(max_length=64)] = None,
) -> PaginatedResponse[ExternalJobMatchResponse]:
    filters: list[ColumnElement[bool]] = [
        ExternalJobMatch.student_id == principal.id,
        ExternalJob.is_active.is_(True),
        ExternalJobMatch.final_score >= get_settings().external_job_min_match_score,
    ]
    if location and location.strip():
        filters.append(ExternalJob.location.ilike(f"%{location.strip()}%"))
    if remote is not None:
        filters.append(ExternalJob.remote_status == ("remote" if remote else "not_remote"))
    if employment_type and employment_type.strip():
        filters.append(ExternalJob.employment_type == employment_type.strip())
    statement = (
        select(ExternalJobMatch)
        .join(ExternalJob, ExternalJob.id == ExternalJobMatch.external_job_id)
        .where(*filters)
        .order_by(
            ExternalJobMatch.final_score.desc(),
            ExternalJob.posted_at.desc().nullslast(),
            ExternalJob.company_name,
            ExternalJob.title,
            ExternalJob.external_id,
        )
    )
    total = int(await session.scalar(select(func.count()).select_from(statement.subquery())) or 0)
    matches = list((await session.scalars(statement.offset((page - 1) * page_size).limit(page_size))).all())
    return PaginatedResponse(page=page, page_size=page_size, total=total, items=[await _match_response(session, match) for match in matches])


@router.get("/external-jobs/{external_job_id}/match", response_model=ExternalJobMatchStateResponse)
async def external_job_match_state(
    external_job_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExternalJobMatchStateResponse:
    job = await session.get(ExternalJob, external_job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="External job not found")
    if not job.is_active:
        return ExternalJobMatchStateResponse(matching_status="inactive")
    has_required = bool(
        await session.scalar(
            select(ExternalJobRequirement.id).where(
                ExternalJobRequirement.external_job_id == external_job_id,
                ExternalJobRequirement.is_required.is_(True),
            )
        )
    )
    if not has_required:
        return ExternalJobMatchStateResponse(matching_status="insufficient_requirements")
    match = (
        await session.scalars(
            select(ExternalJobMatch).where(
                ExternalJobMatch.student_id == principal.id,
                ExternalJobMatch.external_job_id == external_job_id,
            )
        )
    ).first()
    if match is None:
        return ExternalJobMatchStateResponse(matching_status="not_computed")
    return ExternalJobMatchStateResponse(matching_status="ready", match=await _match_response(session, match))


@router.get("/external-job-matches/{match_id}/explanation", response_model=ExplanationResponse)
async def external_job_match_explanation(
    match_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExplanationResponse:
    match = await session.get(ExternalJobMatch, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="External job match not found")
    if match.student_id != principal.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this explanation")
    explanation = await render_external_job_explanation(session, match_id)
    assert explanation is not None
    return ExplanationResponse.model_validate(explanation)
