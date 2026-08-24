import logging
from typing import Annotated, Any
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

logger = logging.getLogger(__name__)
router = APIRouter(tags=["external-job-matches"])


async def _match_response(session: AsyncSession, match: ExternalJobMatch) -> ExternalJobMatchResponse | None:
    job = await session.get(ExternalJob, match.external_job_id)
    if job is None:
        return None
    try:
        explanation = await render_external_job_explanation(session, match.id)
    except Exception:
        explanation = None
    explanation_response = ExplanationResponse.model_validate(explanation) if explanation else ExplanationResponse(
        lines=[f"Match score: {float(match.final_score):.0%}"],
        items=[],
        deterministic_score=float(match.deterministic_score),
        semantic_score=float(match.semantic_score),
        verification_bonus=float(match.verification_bonus),
        final_score=float(match.final_score),
        score_version=match.score_version,
    )
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
        explanation=explanation_response,
    )


@router.post("/external-jobs/matches/recompute", response_model=list[ExternalJobMatchResponse])
async def recompute_external_job_matches(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ExternalJobMatchResponse]:
    try:
        matches = await recompute_external_job_matches_for_student(session, principal.id)
    except Exception:
        await session.rollback()
        matches = []
    items = [await _match_response(session, m) for m in matches]
    return [item for item in items if item is not None]


@router.get("/external-jobs/matches", response_model=PaginatedResponse[ExternalJobMatchResponse])
async def recommended_external_job_matches(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    provider: Annotated[str | None, Query(max_length=64)] = None,
    location: Annotated[str | None, Query(max_length=255)] = None,
    remote: bool | None = None,
    employment_type: Annotated[str | None, Query(max_length=64)] = None,
    query: Annotated[str | None, Query(max_length=200)] = None,
    sort_by: Annotated[str | None, Query(max_length=32)] = "best_match",
) -> PaginatedResponse[ExternalJobMatchResponse]:
    from sqlalchemy import or_

    try:
        existing_count = int(
            (
                await session.scalar(
                    select(func.count())
                    .select_from(ExternalJobMatch)
                    .where(ExternalJobMatch.student_id == principal.id)
                )
            )
            or 0
        )
        if existing_count == 0:
            try:
                await recompute_external_job_matches_for_student(session, principal.id)
            except Exception as recompute_err:
                logger.warning("external_job_matches_recompute_deferred", extra={"error": str(recompute_err)})
                await session.rollback()

        filters: list[ColumnElement[bool]] = [
            ExternalJobMatch.student_id == principal.id,
            ExternalJob.is_active.is_(True),
            ExternalJobMatch.final_score >= get_settings().external_job_min_match_score,
        ]
        if provider and provider.strip() and provider.strip().casefold() != "all":
            filters.append(ExternalJob.provider == provider.strip().casefold())
        if location and location.strip():
            filters.append(ExternalJob.location.ilike(f"%{location.strip()}%"))
        if remote is not None:
            filters.append(ExternalJob.remote_status == ("remote" if remote else "not_remote"))
        if employment_type and employment_type.strip():
            filters.append(ExternalJob.employment_type.ilike(f"%{employment_type.strip()}%"))
        if query and query.strip():
            val = f"%{query.strip()}%"
            filters.append(or_(ExternalJob.title.ilike(val), ExternalJob.company_name.ilike(val)))

        # Determine sort order
        order_clause: list[Any]
        if sort_by == "newest":
            order_clause = [
                ExternalJob.posted_at.desc().nullslast(),
                ExternalJobMatch.final_score.desc(),
                ExternalJob.company_name,
                ExternalJob.title,
            ]
        elif sort_by == "recently_added":
            order_clause = [
                ExternalJobMatch.computed_at.desc(),
                ExternalJobMatch.final_score.desc(),
                ExternalJob.company_name,
            ]
        else:  # best_match
            order_clause = [
                ExternalJobMatch.final_score.desc(),
                ExternalJob.posted_at.desc().nullslast(),
                ExternalJob.company_name,
                ExternalJob.title,
                ExternalJob.external_id,
            ]

        statement = (
            select(ExternalJobMatch)
            .join(ExternalJob, ExternalJob.id == ExternalJobMatch.external_job_id)
            .where(*filters)
            .order_by(*order_clause)
        )
        total = int(await session.scalar(select(func.count()).select_from(statement.subquery())) or 0)
        matches = list((await session.scalars(statement.offset((page - 1) * page_size).limit(page_size))).all())
        items = [await _match_response(session, m) for m in matches]
        return PaginatedResponse(page=page, page_size=page_size, total=total, items=[item for item in items if item is not None])
    except Exception as exc:
        logger.exception("recommended_external_job_matches_error", extra={"error": str(exc)})
        return PaginatedResponse(page=page, page_size=page_size, total=0, items=[])


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
