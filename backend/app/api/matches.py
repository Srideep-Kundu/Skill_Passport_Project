from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import current_principal, require_role
from app.models import Internship, Match, Recruiter, Student
from app.schemas.contracts import ExplanationResponse, MatchResponse
from app.services.explanation_service import render_explanation
from app.services.matching_service import compute_and_persist_match

router = APIRouter(tags=["matches"])


@router.get("/students/me/matches", response_model=list[MatchResponse])
async def my_matches(principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> list[MatchResponse]:
    internships = (await session.scalars(select(Internship).order_by(Internship.created_at))).all()
    matches = [await compute_and_persist_match(session, principal.id, internship.id) for internship in internships]
    internship_titles = {internship.id: internship.title for internship in internships}
    return [
        MatchResponse.model_validate(match).model_copy(
            update={"internship_title": internship_titles[match.internship_id]}
        )
        for match in sorted(matches, key=lambda match: (-float(match.final_score), str(match.internship_id)))
    ]


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
