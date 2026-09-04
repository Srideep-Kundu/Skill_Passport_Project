"""API Router for Automated GitHub Project Assessments."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models.domain import Recruiter, Student
from app.schemas.contracts import (
    CandidateOptionResponse,
    ProjectAssessmentAnswerSubmitRequest,
    ProjectAssessmentCreateRequest,
    ProjectAssessmentListResponse,
    ProjectAssessmentResponse,
    ProjectAssessmentShortlistRequest,
)
from app.services.project_assessment_service import project_assessment_service

router = APIRouter(tags=["project_assessments"])


# =============================================================================
# Recruiter Project Assessment Endpoints
# =============================================================================

@router.post(
    "/project-assessments",
    response_model=ProjectAssessmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_assessment(
    payload: ProjectAssessmentCreateRequest,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectAssessmentResponse:
    """Submit a student's GitHub repository for automated analysis and assessment."""
    try:
        return await project_assessment_service.create_assessment(session, recruiter.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get(
    "/project-assessments",
    response_model=ProjectAssessmentListResponse,
)
async def list_recruiter_assessments(
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    search: str | None = Query(None, description="Search candidate name, email, project title, or URL"),
    status: str | None = Query("all", description="Filter by status or shortlisted"),
    sort_by: str = Query("score_desc", description="Sort by: score_desc, date_desc, name_asc"),
) -> ProjectAssessmentListResponse:
    """List, search, filter, and rank candidate project assessments."""
    items = await project_assessment_service.list_recruiter_assessments(
        session, recruiter.id, search=search, status_filter=status, sort_by=sort_by
    )
    return ProjectAssessmentListResponse(total=len(items), items=items)


@router.get(
    "/project-assessments/candidates",
    response_model=list[CandidateOptionResponse],
)
async def list_assessment_candidate_options(
    _: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[CandidateOptionResponse]:
    """Retrieve available student candidate options for project assessment submission."""
    return await project_assessment_service.list_candidate_options(session)


@router.get(
    "/project-assessments/{assessment_id}",
    response_model=ProjectAssessmentResponse,
)
async def get_recruiter_assessment_detail(
    assessment_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectAssessmentResponse:
    """Get full assessment breakdown, category scores, strengths, and improvement suggestions."""
    try:
        return await project_assessment_service.get_assessment_detail(
            session, assessment_id, recruiter.id, "recruiter"
        )
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post(
    "/project-assessments/{assessment_id}/retry",
    response_model=ProjectAssessmentResponse,
)
async def retry_failed_assessment(
    assessment_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectAssessmentResponse:
    """Retry automated scanning and analysis for a failed repository assessment."""
    try:
        return await project_assessment_service.retry_assessment(session, assessment_id, recruiter.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post(
    "/project-assessments/{assessment_id}/shortlist",
    response_model=ProjectAssessmentResponse,
)
async def toggle_candidate_shortlist(
    assessment_id: UUID,
    payload: ProjectAssessmentShortlistRequest,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectAssessmentResponse:
    """Shortlist or unshortlist candidate based on automated project assessment outcome."""
    try:
        return await project_assessment_service.toggle_shortlist(
            session, assessment_id, recruiter.id, payload
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


# =============================================================================
# Student Project Assessment Endpoints
# =============================================================================

@router.get(
    "/student/project-assessments",
    response_model=list[ProjectAssessmentResponse],
)
async def list_student_project_assessments(
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ProjectAssessmentResponse]:
    """Retrieve all automated project assessments associated with the student's repositories."""
    return await project_assessment_service.list_student_assessments(session, student.id)


@router.get(
    "/student/project-assessments/{assessment_id}",
    response_model=ProjectAssessmentResponse,
)
async def get_student_project_assessment_detail(
    assessment_id: UUID,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectAssessmentResponse:
    """View detailed project assessment results for the student's project."""
    try:
        return await project_assessment_service.get_assessment_detail(
            session, assessment_id, student.id, "student"
        )
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post(
    "/student/project-assessments/{assessment_id}/submit",
    response_model=ProjectAssessmentResponse,
)
async def submit_student_project_assessment(
    assessment_id: UUID,
    payload: ProjectAssessmentAnswerSubmitRequest,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectAssessmentResponse:
    """Submit candidate answers to repository-tailored assessment questions."""
    try:
        return await project_assessment_service.submit_student_assessment(
            session, assessment_id, student.id, payload
        )
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
