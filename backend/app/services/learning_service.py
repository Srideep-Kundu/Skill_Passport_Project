"""Governed learning programs and provenance-backed completion outcomes."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AuditLog,
    CourseEnrollment,
    Evidence,
    EvidenceType,
    ExtractionStatus,
    LearningCourse,
    Recruiter,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    AttendanceUpdate,
    CourseEnrollmentResponse,
    CourseProgressUpdate,
    LearningCourseResponse,
    LearningProgramCreate,
    LearningProgramUpdate,
)
from app.services.skill_gap_service import analyze_skill_gaps

logger = logging.getLogger(__name__)


class LearningNotFoundError(ValueError):
    """Raised when a governed learning record is unavailable to the actor."""


class LearningConflictError(ValueError):
    """Raised when a requested lifecycle transition is not valid."""


class LearningValidationError(ValueError):
    """Raised when program configuration violates a domain invariant."""


async def _canonical_skills(
    session: AsyncSession, skill_ids: list[UUID]
) -> list[Skill]:
    unique_ids = list(dict.fromkeys(skill_ids))
    if len(unique_ids) != len(skill_ids):
        raise LearningValidationError("Program skills must be unique")
    skills = list(
        (await session.scalars(select(Skill).where(Skill.id.in_(unique_ids)))).all()
    )
    by_id = {skill.id: skill for skill in skills}
    if len(by_id) != len(unique_ids):
        raise LearningValidationError(
            "All program skills must reference the canonical taxonomy"
        )
    return [by_id[skill_id] for skill_id in unique_ids]


async def _course_skill_ids(
    session: AsyncSession, course: LearningCourse
) -> list[UUID]:
    if not course.skills:
        return []
    rows = list(
        (
            await session.scalars(
                select(Skill).where(Skill.canonical_name.in_(course.skills))
            )
        ).all()
    )
    by_name = {skill.canonical_name: skill.id for skill in rows}
    return [by_name[name] for name in course.skills if name in by_name]


def _validate_dates(start_date: datetime | None, end_date: datetime | None) -> None:
    if start_date is not None and end_date is not None and end_date < start_date:
        raise LearningValidationError("Program end date cannot precede its start date")


async def _course_response(
    session: AsyncSession,
    course: LearningCourse,
    enrollment: CourseEnrollment | None = None,
    enrolled_count: int | None = None,
    recommendation_reason: str | None = None,
) -> LearningCourseResponse:
    if enrolled_count is None:
        enrolled_count = int(
            (
                await session.scalar(
                    select(func.count())
                    .select_from(CourseEnrollment)
                    .where(CourseEnrollment.course_id == course.id)
                )
            )
            or 0
        )
    return LearningCourseResponse(
        id=course.id,
        title=course.title,
        provider=course.provider,
        category=course.category,
        difficulty=course.difficulty,
        duration_hours=course.duration_hours,
        url=course.url,
        rating=float(course.rating),
        description=course.description,
        skills=course.skills,
        skill_ids=await _course_skill_ids(session, course),
        program_type=course.program_type,
        recruiter_id=course.recruiter_id,
        start_date=course.start_date,
        end_date=course.end_date,
        delivery_mode=course.delivery_mode,
        capacity=course.capacity,
        enrolled_count=enrolled_count,
        certificate_available=course.certificate_available,
        is_published=course.is_published,
        is_enrolled=enrollment is not None,
        progress=enrollment.progress if enrollment else 0,
        enrollment_status=enrollment.status if enrollment else None,
        attendance_status=enrollment.attendance_status if enrollment else None,
        completion_verified=(
            enrollment is not None and enrollment.completion_evidence_id is not None
        ),
        recommendation_reason=recommendation_reason,
    )


async def _enrollment_response(
    session: AsyncSession,
    enrollment: CourseEnrollment,
    course: LearningCourse,
    *,
    include_student: bool = False,
) -> CourseEnrollmentResponse:
    student = await session.get(Student, enrollment.student_id) if include_student else None
    return CourseEnrollmentResponse(
        id=enrollment.id,
        course_id=course.id,
        course_title=course.title,
        provider=course.provider,
        status=enrollment.status,
        progress=enrollment.progress,
        attendance_status=enrollment.attendance_status,
        attendance_marked_at=enrollment.attendance_marked_at,
        completion_source=enrollment.completion_source,
        completion_evidence_id=enrollment.completion_evidence_id,
        verified_by_recruiter_id=enrollment.verified_by_recruiter_id,
        completion_verified=enrollment.completion_evidence_id is not None,
        student_id=enrollment.student_id if include_student else None,
        student_name=student.full_name if student else None,
        student_email=student.email if student else None,
        enrolled_at=enrollment.enrolled_at,
        completed_at=enrollment.completed_at,
    )


async def _owned_course(
    session: AsyncSession, course_id: UUID, recruiter_id: UUID
) -> LearningCourse:
    course = await session.get(LearningCourse, course_id)
    if course is None or course.recruiter_id != recruiter_id:
        raise LearningNotFoundError("Learning program not found")
    return course


async def _owned_enrollment(
    session: AsyncSession, enrollment_id: UUID, recruiter_id: UUID
) -> tuple[CourseEnrollment, LearningCourse]:
    enrollment = await session.get(CourseEnrollment, enrollment_id)
    if enrollment is None:
        raise LearningNotFoundError("Enrollment not found")
    course = await _owned_course(session, enrollment.course_id, recruiter_id)
    return enrollment, course


def _audit(
    recruiter_id: UUID, action: str, entity_type: str, entity_id: UUID, details: dict
) -> AuditLog:
    return AuditLog(
        actor_id=recruiter_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )


async def list_courses(
    session: AsyncSession,
    student_id: UUID | None = None,
    category: str | None = None,
    skill_name: str | None = None,
) -> list[LearningCourseResponse]:
    stmt = select(LearningCourse).where(LearningCourse.is_published.is_(True))
    if category:
        stmt = stmt.where(LearningCourse.category.ilike(category))
    courses = list(
        (
            await session.scalars(
                stmt.order_by(LearningCourse.start_date, LearningCourse.created_at.desc())
            )
        ).all()
    )

    enrollment_map: dict[UUID, CourseEnrollment] = {}
    missing_gaps_map: dict[str, tuple[str, str]] = {}
    if student_id is not None:
        enrollments = list(
            (
                await session.scalars(
                    select(CourseEnrollment).where(
                        CourseEnrollment.student_id == student_id
                    )
                )
            ).all()
        )
        enrollment_map = {enrollment.course_id: enrollment for enrollment in enrollments}
        student = await session.get(Student, student_id)
        target_role = (
            student.career_goals.get("target_roles", ["Full Stack Developer"])[0]
            if student
            and student.career_goals
            and student.career_goals.get("target_roles")
            else "Full Stack Developer"
        )
        try:
            gap_analysis = await analyze_skill_gaps(session, student_id, target_role)
            for item in gap_analysis.gap_items:
                if item.status == "missing":
                    missing_gaps_map[item.skill_name.casefold()] = (
                        item.importance,
                        target_role,
                    )
        except ValueError:
            logger.warning(
                "skill_gap_analysis_unavailable_for_learning",
                extra={"student_id": str(student_id)},
            )

    results: list[LearningCourseResponse] = []
    for course in courses:
        if skill_name and not any(
            skill_name.casefold() in name.casefold() for name in course.skills
        ):
            continue
        recommendation_reason = None
        for name in course.skills:
            gap = missing_gaps_map.get(name.casefold())
            if gap:
                importance, role = gap
                recommendation_reason = (
                    f"Recommended because {name} is a {importance} gap for your "
                    f"{role} target role."
                )
                break
        results.append(
            await _course_response(
                session,
                course,
                enrollment_map.get(course.id),
                recommendation_reason=recommendation_reason,
            )
        )
    results.sort(
        key=lambda item: (
            0
            if item.recommendation_reason
            and "critical" in item.recommendation_reason
            else 1 if item.recommendation_reason else 2,
            item.start_date or datetime.max.replace(tzinfo=UTC),
            item.title.casefold(),
        )
    )
    return results


async def create_program(
    session: AsyncSession, recruiter: Recruiter, payload: LearningProgramCreate
) -> LearningCourseResponse:
    skills = await _canonical_skills(session, payload.skill_ids)
    _validate_dates(payload.start_date, payload.end_date)
    course = LearningCourse(
        recruiter_id=recruiter.id,
        title=payload.title,
        provider=recruiter.company_name,
        category=payload.category,
        program_type=payload.program_type,
        difficulty=payload.difficulty,
        duration_hours=payload.duration_hours,
        start_date=payload.start_date,
        end_date=payload.end_date,
        delivery_mode=payload.delivery_mode,
        capacity=payload.capacity,
        certificate_available=payload.certificate_available,
        is_published=payload.is_published,
        url=payload.url,
        rating=0,
        description=payload.description,
        skills=[skill.canonical_name for skill in skills],
    )
    session.add(course)
    await session.flush()
    session.add(
        _audit(
            recruiter.id,
            "learning_program_created",
            "learning_course",
            course.id,
            {"program_type": course.program_type, "published": course.is_published},
        )
    )
    await session.commit()
    await session.refresh(course)
    return await _course_response(session, course, enrolled_count=0)


async def list_owned_programs(
    session: AsyncSession, recruiter_id: UUID
) -> list[LearningCourseResponse]:
    courses = list(
        (
            await session.scalars(
                select(LearningCourse)
                .where(LearningCourse.recruiter_id == recruiter_id)
                .order_by(LearningCourse.created_at.desc())
            )
        ).all()
    )
    return [await _course_response(session, course) for course in courses]


async def get_owned_program(
    session: AsyncSession, recruiter_id: UUID, course_id: UUID
) -> LearningCourseResponse:
    return await _course_response(
        session, await _owned_course(session, course_id, recruiter_id)
    )


async def update_program(
    session: AsyncSession,
    recruiter: Recruiter,
    course_id: UUID,
    payload: LearningProgramUpdate,
) -> LearningCourseResponse:
    if not payload.model_fields_set:
        raise LearningValidationError("At least one program field must be supplied")
    course = await _owned_course(session, course_id, recruiter.id)
    if payload.skill_ids is not None:
        skills = await _canonical_skills(session, payload.skill_ids)
        course.skills = [skill.canonical_name for skill in skills]
    for field in (
        "title",
        "category",
        "program_type",
        "difficulty",
        "duration_hours",
        "start_date",
        "end_date",
        "delivery_mode",
        "capacity",
        "certificate_available",
        "is_published",
        "url",
        "description",
    ):
        if field in payload.model_fields_set:
            setattr(course, field, getattr(payload, field))
    _validate_dates(course.start_date, course.end_date)
    if course.capacity is not None:
        enrollment_count = int(
            (
                await session.scalar(
                    select(func.count())
                    .select_from(CourseEnrollment)
                    .where(CourseEnrollment.course_id == course.id)
                )
            )
            or 0
        )
        if course.capacity < enrollment_count:
            raise LearningConflictError(
                "Program capacity cannot be lower than current enrollment"
            )
    session.add(
        _audit(
            recruiter.id,
            "learning_program_updated",
            "learning_course",
            course.id,
            {"fields": sorted(payload.model_fields_set)},
        )
    )
    await session.commit()
    await session.refresh(course)
    return await _course_response(session, course)


async def delete_program(
    session: AsyncSession, recruiter_id: UUID, course_id: UUID
) -> None:
    course = await _owned_course(session, course_id, recruiter_id)
    enrollment_count = int(
        (
            await session.scalar(
                select(func.count())
                .select_from(CourseEnrollment)
                .where(CourseEnrollment.course_id == course.id)
            )
        )
        or 0
    )
    if enrollment_count:
        raise LearningConflictError(
            "Programs with enrollments cannot be deleted; unpublish instead"
        )
    session.add(
        _audit(
            recruiter_id,
            "learning_program_deleted",
            "learning_course",
            course.id,
            {"title": course.title},
        )
    )
    await session.delete(course)
    await session.commit()


async def list_program_enrollments(
    session: AsyncSession, recruiter_id: UUID, course_id: UUID
) -> list[CourseEnrollmentResponse]:
    course = await _owned_course(session, course_id, recruiter_id)
    enrollments = list(
        (
            await session.scalars(
                select(CourseEnrollment)
                .where(CourseEnrollment.course_id == course.id)
                .order_by(CourseEnrollment.enrolled_at, CourseEnrollment.id)
            )
        ).all()
    )
    return [
        await _enrollment_response(session, item, course, include_student=True)
        for item in enrollments
    ]


async def enroll_course(
    session: AsyncSession, student_id: UUID, course_id: UUID
) -> CourseEnrollmentResponse:
    existing = await session.scalar(
        select(CourseEnrollment).where(
            CourseEnrollment.student_id == student_id,
            CourseEnrollment.course_id == course_id,
        )
    )
    course = await session.get(LearningCourse, course_id)
    if course is None or not course.is_published:
        raise LearningNotFoundError("Learning program not found")
    if existing is not None:
        return await _enrollment_response(session, existing, course)
    if course.capacity is not None:
        count = int(
            (
                await session.scalar(
                    select(func.count())
                    .select_from(CourseEnrollment)
                    .where(CourseEnrollment.course_id == course.id)
                )
            )
            or 0
        )
        if count >= course.capacity:
            raise LearningConflictError("Learning program is at capacity")
    enrollment = CourseEnrollment(student_id=student_id, course_id=course_id)
    session.add(enrollment)
    await session.commit()
    await session.refresh(enrollment)
    return await _enrollment_response(session, enrollment, course)


async def update_course_progress(
    session: AsyncSession,
    student_id: UUID,
    course_id: UUID,
    payload: CourseProgressUpdate,
) -> CourseEnrollmentResponse:
    enrollment = await session.scalar(
        select(CourseEnrollment).where(
            CourseEnrollment.student_id == student_id,
            CourseEnrollment.course_id == course_id,
        )
    )
    if enrollment is None:
        raise LearningNotFoundError("Enrollment not found")
    course = await session.get(LearningCourse, course_id)
    if course is None:
        raise LearningNotFoundError("Learning program not found")
    if enrollment.status == "verified":
        raise LearningConflictError("Verified completion cannot be changed")
    if enrollment.attendance_status == "absent":
        raise LearningConflictError("An absent enrollment cannot report progress")
    enrollment.progress = payload.progress
    if payload.progress >= 100:
        enrollment.status = "completed"
        enrollment.completed_at = enrollment.completed_at or datetime.now(UTC)
        enrollment.completion_source = "student_self_reported"
    elif payload.progress > 0:
        enrollment.status = "in_progress"
        enrollment.completed_at = None
        enrollment.completion_source = None
    else:
        enrollment.status = (
            "attended" if enrollment.attendance_status == "attended" else "enrolled"
        )
        enrollment.completed_at = None
        enrollment.completion_source = None
    await session.commit()
    await session.refresh(enrollment)
    return await _enrollment_response(session, enrollment, course)


async def mark_attendance(
    session: AsyncSession,
    recruiter_id: UUID,
    enrollment_id: UUID,
    payload: AttendanceUpdate,
) -> CourseEnrollmentResponse:
    enrollment, course = await _owned_enrollment(
        session, enrollment_id, recruiter_id
    )
    if enrollment.status == "verified":
        raise LearningConflictError("Verified completion cannot be changed")
    enrollment.attendance_status = payload.attendance_status
    enrollment.attendance_marked_at = datetime.now(UTC)
    if payload.attendance_status == "absent":
        enrollment.status = "absent"
    elif enrollment.progress >= 100:
        enrollment.status = "completed"
    elif enrollment.progress > 0:
        enrollment.status = "in_progress"
    else:
        enrollment.status = "attended"
    session.add(
        _audit(
            recruiter_id,
            "learning_attendance_marked",
            "course_enrollment",
            enrollment.id,
            {"attendance_status": payload.attendance_status},
        )
    )
    await session.commit()
    await session.refresh(enrollment)
    return await _enrollment_response(
        session, enrollment, course, include_student=True
    )


async def verify_completion(
    session: AsyncSession, recruiter_id: UUID, enrollment_id: UUID
) -> CourseEnrollmentResponse:
    enrollment, course = await _owned_enrollment(
        session, enrollment_id, recruiter_id
    )
    if enrollment.completion_evidence_id is not None:
        return await _enrollment_response(
            session, enrollment, course, include_student=True
        )
    if enrollment.attendance_status != "attended":
        raise LearningConflictError(
            "Attendance must be marked attended before completion verification"
        )
    skills = list(
        (
            await session.scalars(
                select(Skill).where(Skill.canonical_name.in_(course.skills))
            )
        ).all()
    )
    by_name = {skill.canonical_name: skill for skill in skills}
    if len(by_name) != len(set(course.skills)):
        raise LearningValidationError(
            "Program contains a skill outside the canonical taxonomy"
        )

    evidence = Evidence(
        student_id=enrollment.student_id,
        evidence_type=EvidenceType.coursework,
        title=f"Verified Learning Completion: {course.title}",
        description=(
            f"Completion of the {course.program_type.replace('_', ' ')} "
            f"'{course.title}' was verified by {course.provider}."
        ),
        external_url=course.url or None,
        raw_metadata={
            "learning_program_id": str(course.id),
            "course_enrollment_id": str(enrollment.id),
            "program_type": course.program_type,
            "provider": course.provider,
            "completion_source": "recruiter_verified",
            "skills": course.skills,
            "verified_at": datetime.now(UTC).isoformat(),
        },
        extraction_status=ExtractionStatus.extracted,
    )
    session.add(evidence)
    await session.flush()
    enrollment.completion_evidence_id = evidence.id
    enrollment.verified_by_recruiter_id = recruiter_id
    enrollment.completion_source = "recruiter_verified"
    enrollment.status = "verified"
    enrollment.progress = 100
    enrollment.completed_at = enrollment.completed_at or datetime.now(UTC)

    for skill_name in course.skills:
        skill = by_name[skill_name]
        existing = await session.scalar(
            select(StudentSkill).where(
                StudentSkill.student_id == enrollment.student_id,
                StudentSkill.skill_id == skill.id,
                StudentSkill.source_evidence_id == evidence.id,
            )
        )
        if existing is not None:
            existing.extraction_confidence = 1.0
            existing.verification_tier = VerificationTier.verified
            continue
        session.add(
            StudentSkill(
                student_id=enrollment.student_id,
                skill_id=skill.id,
                source_evidence_id=evidence.id,
                extraction_confidence=1.0,
                verification_tier=VerificationTier.verified,
                proficiency_hint="Recruiter verified completion",
                evidence_span=(
                    f"Completed {course.title}; canonical competency: {skill_name}"
                ),
            )
        )
    session.add(
        _audit(
            recruiter_id,
            "learning_completion_verified",
            "course_enrollment",
            enrollment.id,
            {
                "learning_program_id": str(course.id),
                "completion_evidence_id": str(evidence.id),
            },
        )
    )
    await session.commit()
    await session.refresh(enrollment)
    return await _enrollment_response(
        session, enrollment, course, include_student=True
    )
