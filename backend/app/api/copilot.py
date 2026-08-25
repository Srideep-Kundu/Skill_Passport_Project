"""FastAPI Router for Skill Passport Copilot."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import current_principal
from app.models import Academician, Admin, Institution, Recruiter, Student
from app.schemas.contracts import APIModel
from app.services.copilot_service import CopilotResponse, answer_copilot_query

router = APIRouter(prefix="/copilot", tags=["copilot"])


class CopilotQueryRequest(APIModel):
    query: str


@router.post("/query", response_model=CopilotResponse)
async def query_copilot(
    payload: CopilotQueryRequest,
    principal: Annotated[Student | Recruiter | Academician | Institution | Admin, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CopilotResponse:
    """Answer student, recruiter, faculty, or university contextual question grounded in actual platform records."""
    return await answer_copilot_query(session, principal, payload.query)
