import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import (
    Internship,
    InternshipRequirement,
    Match,
    MatchExplanation,
    Recruiter,
    Skill,
)
from app.schemas.contracts import (
    InternshipCreate,
    InternshipRequirementCreate,
    InternshipRequirementResponse,
    InternshipResponse,
    InternshipUpdate,
    MatchResponse,
    PaginatedResponse,
)
from app.services.matching_service import (
    match_is_stale,
    persisted_internship_matches,
    recompute_matches_for_internship,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/internships", tags=["internships"])


async def _owned_internship(session: AsyncSession, internship_id: UUID, recruiter_id: UUID) -> Internship:
    internship = await session.get(Internship, internship_id)
    if internship is None or internship.recruiter_id != recruiter_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Internship not found")
    return internship


async def _validate_requirements(session: AsyncSession, requirements: list[InternshipRequirementCreate]) -> None:
    if not requirements:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "At least one requirement is required")
    total_skills = int((await session.scalar(select(func.count()).select_from(Skill))) or 0)
    if total_skills == 0:
        try:
            from seed.seed_taxonomy import (  # type: ignore[import-not-found]  # Optional fail-soft seed hook.
                seed_taxonomy,
            )
            await seed_taxonomy()
        except Exception as seed_err:  # noqa: BLE001
            logger.warning("taxonomy_seed_deferred", extra={"error": str(seed_err)})
    known = set((await session.scalars(select(Skill.id).where(Skill.id.in_([requirement.skill_id for requirement in requirements])))).all())
    if len(known) != len(requirements):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "All requirements must reference canonical skills")


async def _internship_response(session: AsyncSession, internship: Internship) -> InternshipResponse:
    requirements = list(
        (
            await session.scalars(
                select(InternshipRequirement)
                .where(InternshipRequirement.internship_id == internship.id)
                .order_by(InternshipRequirement.is_required.desc(), InternshipRequirement.skill_id)
            )
        ).all()
    )
    return InternshipResponse(
        id=internship.id,
        title=internship.title,
        description=internship.description,
        recruiter_id=internship.recruiter_id,
        created_at=internship.created_at,
        requirements=[InternshipRequirementResponse.model_validate(requirement) for requirement in requirements],
    )


@router.post("", response_model=InternshipResponse, status_code=status.HTTP_201_CREATED)
async def create_internship(payload: InternshipCreate, principal: Annotated[Recruiter, Depends(require_role("recruiter"))], session: Annotated[AsyncSession, Depends(get_session)]) -> InternshipResponse:
    await _validate_requirements(session, payload.requirements)
    internship = Internship(recruiter_id=principal.id, title=payload.title, description=payload.description)
    session.add(internship)
    await session.flush()
    requirements = []
    for requirement in payload.requirements:
        req = InternshipRequirement(internship_id=internship.id, skill_id=requirement.skill_id, is_required=requirement.is_required, weight=requirement.weight)
        session.add(req)
        requirements.append(req)
    await session.commit()
    
    response = InternshipResponse(
        id=internship.id,
        title=internship.title,
        description=internship.description,
        recruiter_id=internship.recruiter_id,
        created_at=internship.created_at,
        requirements=[InternshipRequirementResponse.model_validate(req) for req in requirements],
    )
    
    try:
        await recompute_matches_for_internship(session, internship.id)
    except Exception as recompute_err:  # noqa: BLE001
        logger.warning("internship_matches_recompute_deferred", extra={"error": str(recompute_err)})
        
    return response


@router.get("", response_model=PaginatedResponse[InternshipResponse])
async def list_internships(
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    query: Annotated[str | None, Query(max_length=200)] = None,
) -> PaginatedResponse[InternshipResponse]:
    filters = [Internship.recruiter_id == principal.id]
    if query and query.strip():
        filters.append(Internship.title.ilike(f"%{query.strip()}%"))
    total = int((await session.scalar(select(func.count()).select_from(Internship).where(*filters))) or 0)
    internships = list(
        (
            await session.scalars(
                select(Internship)
                .where(*filters)
                .order_by(Internship.created_at.desc(), Internship.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return PaginatedResponse(page=page, page_size=page_size, total=total, items=[await _internship_response(session, internship) for internship in internships])


@router.get("/{internship_id}", response_model=InternshipResponse)
async def get_internship(internship_id: UUID, principal: Annotated[Recruiter, Depends(require_role("recruiter"))], session: Annotated[AsyncSession, Depends(get_session)]) -> InternshipResponse:
    return await _internship_response(session, await _owned_internship(session, internship_id, principal.id))


@router.patch("/{internship_id}", response_model=InternshipResponse)
async def update_internship(
    internship_id: UUID,
    payload: InternshipUpdate,
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InternshipResponse:
    if not payload.model_fields_set:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one internship field must be supplied")
    if any(getattr(payload, field) is None for field in payload.model_fields_set):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Internship fields cannot be null")
    internship = await _owned_internship(session, internship_id, principal.id)
    if "title" in payload.model_fields_set:
        assert payload.title is not None
        internship.title = payload.title
    if "description" in payload.model_fields_set:
        assert payload.description is not None
        internship.description = payload.description
    if "requirements" in payload.model_fields_set:
        assert payload.requirements is not None
        await _validate_requirements(session, payload.requirements)
        await session.execute(delete(InternshipRequirement).where(InternshipRequirement.internship_id == internship.id))
        session.add_all(
            [
                InternshipRequirement(internship_id=internship.id, skill_id=requirement.skill_id, is_required=requirement.is_required, weight=requirement.weight)
                for requirement in payload.requirements
            ]
        )
    await session.commit()
    await session.refresh(internship)
    return await _internship_response(session, internship)


@router.delete("/{internship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_internship(
    internship_id: UUID,
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    internship = await _owned_internship(session, internship_id, principal.id)
    match_ids = select(Match.id).where(Match.internship_id == internship.id)
    await session.execute(delete(MatchExplanation).where(MatchExplanation.match_id.in_(match_ids)))
    await session.execute(delete(Match).where(Match.internship_id == internship.id))
    await session.delete(internship)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{internship_id}/matches", response_model=PaginatedResponse[MatchResponse])
async def internship_matches(
    internship_id: UUID,
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[MatchResponse]:
    await _owned_internship(session, internship_id, principal.id)
    items = [
        MatchResponse.model_validate(match).model_copy(
            update={"candidate_label": f"Candidate {str(match.student_id)[:8]}", "is_stale": await match_is_stale(session, match)}
        )
        for match in sorted(await persisted_internship_matches(session, internship_id), key=lambda item: (-float(item.final_score), str(item.student_id)))
    ]
    return PaginatedResponse(page=page, page_size=page_size, total=len(items), items=items[(page - 1) * page_size : page * page_size])


@router.post("/{internship_id}/matches/recompute", response_model=list[MatchResponse])
async def recompute_internship_matches(internship_id: UUID, principal: Annotated[Recruiter, Depends(require_role("recruiter"))], session: Annotated[AsyncSession, Depends(get_session)]) -> list[MatchResponse]:
    await _owned_internship(session, internship_id, principal.id)
    matches = await recompute_matches_for_internship(session, internship_id)
    return [MatchResponse.model_validate(match).model_copy(update={"candidate_label": f"Candidate {str(match.student_id)[:8]}", "is_stale": False}) for match in matches]
