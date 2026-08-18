from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import require_role
from app.models import Admin, ExternalJob, ExternalJobRequirement, Skill, Student
from app.schemas.contracts import (
    ExternalJobRequirementResponse,
    ExternalJobResponse,
    ExternalJobSyncRequest,
    ExternalJobSyncResponse,
    PaginatedResponse,
)
from app.services.external_jobs_service import sync_external_jobs
from app.services.job_providers import (
    ProviderError,
    ProviderNotFound,
    ProviderRateLimited,
)
from app.services.rate_limit_service import enforce_rate_limit

router = APIRouter(prefix="/external-jobs", tags=["external-jobs"])


async def _response(session: AsyncSession, external_job: ExternalJob) -> ExternalJobResponse:
    rows = (
        await session.execute(
            select(ExternalJobRequirement, Skill.canonical_name)
            .join(Skill, Skill.id == ExternalJobRequirement.skill_id)
            .where(ExternalJobRequirement.external_job_id == external_job.id)
            .order_by(ExternalJobRequirement.is_required.desc(), Skill.canonical_name, ExternalJobRequirement.id)
        )
    ).all()
    return ExternalJobResponse(
        id=external_job.id,
        provider=external_job.provider,
        provider_source=external_job.provider_source,
        external_id=external_job.external_id,
        title=external_job.title,
        company_name=external_job.company_name,
        description=external_job.description,
        location=external_job.location,
        remote_status=external_job.remote_status,
        employment_type=external_job.employment_type,
        experience_level=external_job.experience_level,
        salary_min=float(external_job.salary_min) if external_job.salary_min is not None else None,
        salary_max=float(external_job.salary_max) if external_job.salary_max is not None else None,
        salary_currency=external_job.salary_currency,
        apply_url=external_job.apply_url,
        source_url=external_job.source_url,
        posted_at=external_job.posted_at,
        expires_at=external_job.expires_at,
        first_seen_at=external_job.first_seen_at,
        last_seen_at=external_job.last_seen_at,
        last_synced_at=external_job.last_synced_at,
        is_active=external_job.is_active,
        requirements=[
            ExternalJobRequirementResponse(
                id=requirement.id,
                skill_id=requirement.skill_id,
                skill_name=skill_name,
                is_required=requirement.is_required,
                weight=float(requirement.weight),
                confidence=float(requirement.confidence),
                source_span=requirement.source_span,
            )
            for requirement, skill_name in rows
        ],
    )


@router.get("", response_model=PaginatedResponse[ExternalJobResponse])
async def list_external_jobs(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    provider: Annotated[str | None, Query(max_length=64)] = None,
    location: Annotated[str | None, Query(max_length=255)] = None,
    remote: bool | None = None,
    query: Annotated[str | None, Query(max_length=200)] = None,
    employment_type: Annotated[str | None, Query(max_length=64)] = None,
    experience_level: Annotated[str | None, Query(max_length=64)] = None,
    active: bool = True,
) -> PaginatedResponse[ExternalJobResponse]:
    del principal
    filters: list[ColumnElement[bool]] = [ExternalJob.is_active.is_(active)]
    if provider and provider.strip():
        filters.append(ExternalJob.provider == provider.strip().casefold())
    if location and location.strip():
        filters.append(ExternalJob.location.ilike(f"%{location.strip()}%"))
    if remote is not None:
        filters.append(ExternalJob.remote_status == ("remote" if remote else "not_remote"))
    if query and query.strip():
        value = f"%{query.strip()}%"
        filters.append(or_(ExternalJob.title.ilike(value), ExternalJob.company_name.ilike(value)))
    if employment_type and employment_type.strip():
        filters.append(ExternalJob.employment_type == employment_type.strip())
    if experience_level and experience_level.strip():
        filters.append(ExternalJob.experience_level == experience_level.strip())
    total = int((await session.scalar(select(func.count()).select_from(ExternalJob).where(*filters))) or 0)
    jobs = list(
        (
            await session.scalars(
                select(ExternalJob)
                .where(*filters)
                .order_by(ExternalJob.posted_at.desc().nullslast(), ExternalJob.last_synced_at.desc(), ExternalJob.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return PaginatedResponse(page=page, page_size=page_size, total=total, items=[await _response(session, job) for job in jobs])


@router.get("/{external_job_id}", response_model=ExternalJobResponse)
async def get_external_job(
    external_job_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExternalJobResponse:
    del principal
    external_job = await session.get(ExternalJob, external_job_id)
    if external_job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "External job not found")
    return await _response(session, external_job)


@router.post("/sync", response_model=ExternalJobSyncResponse, status_code=status.HTTP_200_OK)
async def sync_jobs(
    payload: ExternalJobSyncRequest,
    principal: Annotated[Admin, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ExternalJobSyncResponse:
    await enforce_rate_limit("external-job-sync", str(principal.id), get_settings().external_job_sync_rate_limit_per_minute)
    try:
        result = await sync_external_jobs(session, provider_name=payload.provider, source_key=payload.source_key, actor_id=principal.id)
    except ProviderRateLimited as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, error.safe_message) from error
    except ProviderNotFound as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, error.safe_message) from error
    except ProviderError as error:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, error.safe_message) from error
    return ExternalJobSyncResponse(
        provider=result.provider,
        provider_source=result.provider_source,
        created=result.created,
        updated=result.updated,
        marked_inactive=result.marked_inactive,
        synced=result.synced,
        synced_at=result.synced_at,
    )
