from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Student
from app.schemas.contracts import TeamSuggestion, TeamSuggestionRequest
from app.services.matching_service import suggest_teams

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("/suggest", response_model=list[TeamSuggestion])
async def team_suggestions(
    payload: TeamSuggestionRequest,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[TeamSuggestion]:
    # Students may initiate suggestions including themselves and peer candidates
    pool = list(dict.fromkeys(payload.pool))
    suggestions = await suggest_teams(
        session,
        payload.target_skill_set,
        pool,
        principal_id=principal.id,
    )
    return [
        TeamSuggestion(pair=pair, complementarity_score=score)
        for pair, score in suggestions
    ]
