import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import current_principal, require_role
from app.models import Internship, Match, Recruiter, Student
from app.schemas.contracts import ExplanationResponse, MatchResponse, PaginatedResponse
from app.services.explanation_service import render_explanation
from app.services.matching_service import (
    compute_and_persist_match,
    match_is_stale,
    persisted_student_matches,
)

router = APIRouter(tags=["matches"])
logger = logging.getLogger(__name__)


@router.get("/students/me/matches", response_model=PaginatedResponse[MatchResponse])
async def my_matches(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[MatchResponse]:
    try:
        internships = (await session.scalars(select(Internship).order_by(Internship.created_at))).all()
        if not internships:
            try:
                from seed.seed_demo_data import seed_demo_data
                from seed.seed_sih_ecosystem import seed_sih_ecosystem
                await seed_demo_data()
                await seed_sih_ecosystem()
                internships = (await session.scalars(select(Internship).order_by(Internship.created_at))).all()
            except Exception:
                logger.warning("Optional demo match seed failed")
        matches = await persisted_student_matches(session, principal.id)
        internship_titles = {internship.id: internship.title for internship in internships}
        items = []
        for match in sorted(matches, key=lambda m: (-float(m.final_score), str(m.internship_id))):
            try:
                items.append(
                    MatchResponse.model_validate(match).model_copy(
                        update={"internship_title": internship_titles.get(match.internship_id, "Internship Opportunity"), "is_stale": await match_is_stale(session, match)}
                    )
                )
            except Exception:
                logger.warning("Skipping invalid persisted match response")
                continue
        return PaginatedResponse(page=page, page_size=page_size, total=len(items), items=items[(page - 1) * page_size : page * page_size])
    except Exception:
        return PaginatedResponse(page=page, page_size=page_size, total=0, items=[])


@router.post("/students/me/matches/recompute", response_model=list[MatchResponse])
async def recompute_my_matches(principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> list[MatchResponse]:
    internships = (await session.scalars(select(Internship).order_by(Internship.created_at))).all()
    matches = [await compute_and_persist_match(session, principal.id, internship.id) for internship in internships]
    return [MatchResponse.model_validate(match).model_copy(update={"internship_title": match_internship.title, "is_stale": False}) for match, match_internship in zip(matches, internships, strict=True)]


@router.get("/matches/{match_id}/explanation", response_model=ExplanationResponse)
async def match_explanation(match_id: UUID, principal: Annotated[Student | Recruiter, Depends(current_principal)], session: Annotated[AsyncSession, Depends(get_session)]) -> ExplanationResponse:
    match = await session.get(Match, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    include_evidence_references = isinstance(principal, Student)
    if isinstance(principal, Student):
        allowed = match.student_id == principal.id
    else:
        internship = await session.get(Internship, match.internship_id)
        student = await session.get(Student, match.student_id)
        allowed = isinstance(principal, Recruiter) and internship is not None and internship.recruiter_id == principal.id
        include_evidence_references = allowed and student is not None and student.recruiter_evidence_consent
    if not allowed:
        raise HTTPException(status_code=403, detail="Not authorized to view this explanation")
    result = await render_explanation(session, match_id, include_evidence_references=include_evidence_references)
    assert result is not None
    return ExplanationResponse.model_validate(result)
