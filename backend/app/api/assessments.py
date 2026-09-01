"""API Router for Skill Assessments and Diagnostic Validation."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Student
from app.schemas.contracts import (
    AssessmentAttemptResponse,
    AssessmentResponse,
    AssessmentSubmitRequest,
    AssessmentSummaryResponse,
)
from app.services.assessment_service import (
    get_assessment_details,
    list_available_assessments,
    submit_assessment,
)

router = APIRouter(prefix="/assessments", tags=["assessments"])


@router.get("", response_model=list[AssessmentSummaryResponse])
async def get_assessments(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[AssessmentSummaryResponse]:
    return await list_available_assessments(session)


@router.get("/{assessment_id}", response_model=AssessmentResponse)
async def get_assessment(
    assessment_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AssessmentResponse:
    try:
        return await get_assessment_details(session, assessment_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/{assessment_id}/submit", response_model=AssessmentAttemptResponse)
async def submit_student_assessment(
    assessment_id: UUID,
    payload: AssessmentSubmitRequest,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AssessmentAttemptResponse:
    try:
        return await submit_assessment(session, student.id, assessment_id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
