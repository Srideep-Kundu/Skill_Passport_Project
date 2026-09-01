"""API Router for Adaptive Learning and Course Enrollments."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Recruiter, Student
from app.schemas.contracts import (
    AttendanceUpdate,
    CourseEnrollmentResponse,
    CourseProgressUpdate,
    LearningCourseResponse,
    LearningProgramCreate,
    LearningProgramUpdate,
)
from app.services.learning_service import (
    LearningConflictError,
    LearningNotFoundError,
    LearningValidationError,
    create_program,
    delete_program,
    enroll_course,
    get_owned_program,
    list_courses,
    list_owned_programs,
    list_program_enrollments,
    mark_attendance,
    update_course_progress,
    update_program,
    verify_completion,
)

router = APIRouter(prefix="/learning", tags=["learning"])


def _learning_http_error(exc: ValueError) -> HTTPException:
    if isinstance(exc, LearningNotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    if isinstance(exc, LearningConflictError):
        return HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))


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
    except (LearningNotFoundError, LearningConflictError) as exc:
        raise _learning_http_error(exc) from exc


@router.put("/courses/{course_id}/progress", response_model=CourseEnrollmentResponse)
async def update_progress(
    course_id: UUID,
    payload: CourseProgressUpdate,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CourseEnrollmentResponse:
    try:
        return await update_course_progress(session, student.id, course_id, payload)
    except (LearningNotFoundError, LearningConflictError) as exc:
        raise _learning_http_error(exc) from exc


@router.post(
    "/programs",
    response_model=LearningCourseResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_learning_program(
    payload: LearningProgramCreate,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LearningCourseResponse:
    try:
        return await create_program(session, recruiter, payload)
    except LearningValidationError as exc:
        raise _learning_http_error(exc) from exc


@router.get("/programs/mine", response_model=list[LearningCourseResponse])
async def get_my_learning_programs(
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[LearningCourseResponse]:
    return await list_owned_programs(session, recruiter.id)


@router.get("/programs/{program_id}", response_model=LearningCourseResponse)
async def get_learning_program(
    program_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LearningCourseResponse:
    try:
        return await get_owned_program(session, recruiter.id, program_id)
    except LearningNotFoundError as exc:
        raise _learning_http_error(exc) from exc


@router.patch("/programs/{program_id}", response_model=LearningCourseResponse)
async def patch_learning_program(
    program_id: UUID,
    payload: LearningProgramUpdate,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LearningCourseResponse:
    try:
        return await update_program(session, recruiter, program_id, payload)
    except (
        LearningNotFoundError,
        LearningConflictError,
        LearningValidationError,
    ) as exc:
        raise _learning_http_error(exc) from exc


@router.delete("/programs/{program_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_learning_program(
    program_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    try:
        await delete_program(session, recruiter.id, program_id)
    except (LearningNotFoundError, LearningConflictError) as exc:
        raise _learning_http_error(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/programs/{program_id}/enrollments",
    response_model=list[CourseEnrollmentResponse],
)
async def get_learning_program_enrollments(
    program_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[CourseEnrollmentResponse]:
    try:
        return await list_program_enrollments(session, recruiter.id, program_id)
    except LearningNotFoundError as exc:
        raise _learning_http_error(exc) from exc


@router.patch(
    "/enrollments/{enrollment_id}/attendance",
    response_model=CourseEnrollmentResponse,
)
async def patch_learning_attendance(
    enrollment_id: UUID,
    payload: AttendanceUpdate,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CourseEnrollmentResponse:
    try:
        return await mark_attendance(
            session, recruiter.id, enrollment_id, payload
        )
    except (LearningNotFoundError, LearningConflictError) as exc:
        raise _learning_http_error(exc) from exc


@router.post(
    "/enrollments/{enrollment_id}/verify-completion",
    response_model=CourseEnrollmentResponse,
)
async def verify_learning_completion(
    enrollment_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CourseEnrollmentResponse:
    try:
        return await verify_completion(session, recruiter.id, enrollment_id)
    except (
        LearningNotFoundError,
        LearningConflictError,
        LearningValidationError,
    ) as exc:
        raise _learning_http_error(exc) from exc
