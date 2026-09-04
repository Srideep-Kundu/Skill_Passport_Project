"""API Router for Adaptive Learning and Course Enrollments."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import current_principal, require_role
from app.models import Student
from app.schemas.contracts import (
    CourseEnrollmentResponse,
    CourseProgressUpdate,
    FacultyVideoListResponse,
    FacultyVideoResponse,
    LearningCourseResponse,
)
from app.services import academician_service
from app.services.learning_service import (
    enroll_course,
    list_courses,
    update_course_progress,
)

router = APIRouter(prefix="/learning", tags=["learning"])


@router.get("/courses", response_model=list[LearningCourseResponse])
async def get_courses(
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    category: str | None = Query(default=None),
    skill: str | None = Query(default=None),
) -> list[LearningCourseResponse]:
    return await list_courses(session, student.id, category, skill)


@router.post("/courses/{course_id}/enroll", response_model=CourseEnrollmentResponse)
async def enroll_in_course(
    course_id: UUID,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CourseEnrollmentResponse:
    try:
        return await enroll_course(session, student.id, course_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.put("/courses/{course_id}/progress", response_model=CourseEnrollmentResponse)
async def update_progress(
    course_id: UUID,
    payload: CourseProgressUpdate,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CourseEnrollmentResponse:
    try:
        return await update_course_progress(session, student.id, course_id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


# =============================================================================
# Faculty Video Lectures & Masterclasses Discovery for Students
# =============================================================================

@router.get("/faculty-videos", response_model=FacultyVideoListResponse)
async def get_faculty_videos(
    session: Annotated[AsyncSession, Depends(get_session)],
    faculty_name: str | None = Query(default=None, description="Filter specifically by Faculty Name"),
    subject: str | None = Query(default=None, description="Filter by Subject / Domain"),
    university: str | None = Query(default=None, description="Filter by University / Institution"),
    institution: str | None = Query(default=None, description="Alias for university"),
    search: str | None = Query(default=None, description="Keyword search in title, notes, faculty"),
) -> FacultyVideoListResponse:
    """Retrieve published faculty video lectures with filtering by Faculty Name, University, and Subject."""
    target_inst = university or institution
    return await academician_service.list_faculty_videos_catalog(
        session=session,
        faculty_name=faculty_name,
        subject=subject,
        institution=target_inst,
        search=search,
    )


@router.post("/faculty-videos/{video_id}/view")
async def track_video_view(
    video_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, int]:
    """Increment the view counter for a faculty lecture video."""
    try:
        views = await academician_service.record_video_view(session, video_id)
        return {"views_count": views}
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

