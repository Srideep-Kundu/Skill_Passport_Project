"""API Router for Adaptive Learning and Course Enrollments."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Student
from app.schemas.contracts import (
    CourseEnrollmentResponse,
    CourseProgressUpdate,
    LearningCourseResponse,
)
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
