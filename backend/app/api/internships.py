from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Internship, InternshipRequirement, Recruiter, Skill
from app.schemas.contracts import InternshipCreate, InternshipResponse, MatchResponse
from app.services.matching_service import (
    match_is_stale,
    persisted_internship_matches,
    recompute_matches_for_internship,
)

router = APIRouter(prefix="/internships", tags=["internships"])


@router.post("", response_model=InternshipResponse, status_code=status.HTTP_201_CREATED)
async def create_internship(payload: InternshipCreate, principal: Annotated[Recruiter, Depends(require_role("recruiter"))], session: Annotated[AsyncSession, Depends(get_session)]) -> InternshipResponse:
    known = set((await session.scalars(select(Skill.id).where(Skill.id.in_([requirement.skill_id for requirement in payload.requirements])))).all())
    if len(known) != len(payload.requirements):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "All requirements must reference canonical skills")
    internship = Internship(recruiter_id=principal.id, title=payload.title, description=payload.description)
    session.add(internship)
    await session.flush()
    for requirement in payload.requirements:
        session.add(InternshipRequirement(internship_id=internship.id, skill_id=requirement.skill_id, is_required=requirement.is_required, weight=requirement.weight))
    await session.commit()
    await recompute_matches_for_internship(session, internship.id)
    await session.refresh(internship)
    return InternshipResponse.model_validate(internship)


@router.get("", response_model=list[InternshipResponse])
async def list_internships(
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[InternshipResponse]:
    internships = (
        await session.scalars(
            select(Internship)
            .where(Internship.recruiter_id == principal.id)
            .order_by(Internship.created_at.desc())
        )
    ).all()
    return [InternshipResponse.model_validate(internship) for internship in internships]


@router.get("/{internship_id}/matches", response_model=list[MatchResponse])
async def internship_matches(internship_id: UUID, principal: Annotated[Recruiter, Depends(require_role("recruiter"))], session: Annotated[AsyncSession, Depends(get_session)]) -> list[MatchResponse]:
    internship = await session.get(Internship, internship_id)
    if internship is None or internship.recruiter_id != principal.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Internship not found")
    return [
        MatchResponse.model_validate(match).model_copy(
            update={"candidate_label": f"Candidate {str(match.student_id)[:8]}", "is_stale": await match_is_stale(session, match)}
        )
        for match in sorted(await persisted_internship_matches(session, internship_id), key=lambda item: (-float(item.final_score), str(item.student_id)))
    ]


@router.post("/{internship_id}/matches/recompute", response_model=list[MatchResponse])
async def recompute_internship_matches(internship_id: UUID, principal: Annotated[Recruiter, Depends(require_role("recruiter"))], session: Annotated[AsyncSession, Depends(get_session)]) -> list[MatchResponse]:
    internship = await session.get(Internship, internship_id)
    if internship is None or internship.recruiter_id != principal.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Internship not found")
    matches = await recompute_matches_for_internship(session, internship_id)
    return [MatchResponse.model_validate(match).model_copy(update={"candidate_label": f"Candidate {str(match.student_id)[:8]}", "is_stale": False}) for match in matches]
