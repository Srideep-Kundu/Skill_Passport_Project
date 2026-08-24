"""Adaptive Learning & Course Recommendation Service.

Curates courses mapped to canonical skills, computes explainable recommendation
reasons tied to student skill gaps, tracks progress, and links completed coursework
into the student's Skill Passport.
"""
import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CourseEnrollment,
    Evidence,
    EvidenceType,
    ExtractionStatus,
    LearningCourse,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    CourseEnrollmentResponse,
    CourseProgressUpdate,
    LearningCourseResponse,
)
from app.services.skill_gap_service import analyze_skill_gaps

logger = logging.getLogger(__name__)


async def list_courses(
    session: AsyncSession,
    student_id: UUID | None = None,
    category: str | None = None,
    skill_name: str | None = None,
) -> list[LearningCourseResponse]:
    stmt = select(LearningCourse)
    if category:
        stmt = stmt.where(LearningCourse.category.ilike(category))

    courses = (await session.scalars(stmt)).all()
    if not courses:
        try:
            from seed.seed_sih_ecosystem import seed_sih_ecosystem
            await seed_sih_ecosystem()
            courses = (await session.scalars(stmt)).all()
        except Exception:
            pass

    # Get student enrollments and missing skill gaps for explainable recommendations
    enrollment_map: dict[UUID, CourseEnrollment] = {}
    missing_gaps_map: dict[str, tuple[str, str]] = {}  # skill_name_lower -> (importance, target_role)

    if student_id:
        enr_stmt = select(CourseEnrollment).where(CourseEnrollment.student_id == student_id)
        enrollments = (await session.scalars(enr_stmt)).all()
        enrollment_map = {e.course_id: e for e in enrollments}

        student = await session.get(Student, student_id)
        target_role = (
            student.career_goals.get("target_roles", ["Full Stack Developer"])[0]
            if student and student.career_goals and student.career_goals.get("target_roles")
            else "Full Stack Developer"
        )
        try:
            gap_analysis = await analyze_skill_gaps(session, student_id, target_role)
            for item in gap_analysis.gap_items:
                if item.status == "missing":
                    missing_gaps_map[item.skill_name.casefold()] = (item.importance, target_role)
        except (SQLAlchemyError, ValueError):
            logger.warning(
                "Skill-gap analysis unavailable while listing courses",
                extra={"student_id": str(student_id)},
            )

    results: list[LearningCourseResponse] = []
    for c in courses:
        if skill_name and not any(skill_name.casefold() in s.casefold() for s in c.skills):
            continue
        enr = enrollment_map.get(c.id)

        # Generate explainable recommendation reason
        rec_reason = None
        matched_gap = None
        for s in c.skills:
            if s.casefold() in missing_gaps_map:
                importance, role = missing_gaps_map[s.casefold()]
                matched_gap = (s, importance, role)
                break

        if matched_gap:
            s_name, importance, role = matched_gap
            rec_reason = f"Recommended because {s_name} is a {importance} gap for your {role} target role."

        results.append(
            LearningCourseResponse(
                id=c.id,
                title=c.title,
                provider=c.provider,
                category=c.category,
                difficulty=c.difficulty,
                duration_hours=c.duration_hours,
                url=c.url,
                rating=float(c.rating),
                description=c.description,
                skills=c.skills,
                is_enrolled=enr is not None,
                progress=enr.progress if enr else 0,
                recommendation_reason=rec_reason,
            )
        )

    # Rank recommended courses addressing critical gaps first
    results.sort(
        key=lambda x: (
            0 if x.recommendation_reason and "critical" in x.recommendation_reason else 1 if x.recommendation_reason else 2,
            -x.rating,
        )
    )
    return results


async def enroll_course(
    session: AsyncSession,
    student_id: UUID,
    course_id: UUID,
) -> CourseEnrollmentResponse:
    existing = (
        await session.scalars(
            select(CourseEnrollment).where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.course_id == course_id,
            )
        )
    ).first()
    if existing:
        course = await session.get(LearningCourse, course_id)
        return CourseEnrollmentResponse(
            id=existing.id,
            course_id=course_id,
            course_title=course.title if course else "Course",
            provider=course.provider if course else "",
            status=existing.status,
            progress=existing.progress,
            enrolled_at=existing.enrolled_at,
            completed_at=existing.completed_at,
        )

    course = await session.get(LearningCourse, course_id)
    if not course:
        raise ValueError("Course not found")

    enrollment = CourseEnrollment(
        student_id=student_id,
        course_id=course_id,
        status="enrolled",
        progress=0,
    )
    session.add(enrollment)
    await session.commit()

    return CourseEnrollmentResponse(
        id=enrollment.id,
        course_id=course.id,
        course_title=course.title,
        provider=course.provider,
        status=enrollment.status,
        progress=enrollment.progress,
        enrolled_at=enrollment.enrolled_at,
        completed_at=None,
    )


async def update_course_progress(
    session: AsyncSession,
    student_id: UUID,
    course_id: UUID,
    payload: CourseProgressUpdate,
) -> CourseEnrollmentResponse:
    enrollment = (
        await session.scalars(
            select(CourseEnrollment).where(
                CourseEnrollment.student_id == student_id,
                CourseEnrollment.course_id == course_id,
            )
        )
    ).first()
    if not enrollment:
        raise ValueError("Enrollment not found")

    course = await session.get(LearningCourse, course_id)
    if not course:
        raise ValueError("Course not found")

    enrollment.progress = payload.progress
    if payload.progress >= 100:
        enrollment.status = "completed"
        enrollment.completed_at = datetime.now(UTC)

        # Create Coursework Evidence for Passport
        evidence = Evidence(
            student_id=student_id,
            evidence_type=EvidenceType.coursework,
            title=f"Completed Course: {course.title}",
            description=f"Successfully completed {course.duration_hours}-hour coursework offered by {course.provider}.",
            external_url=course.url,
            raw_metadata={
                "course_id": str(course.id),
                "provider": course.provider,
                "skills_covered": course.skills,
            },
            extraction_status=ExtractionStatus.extracted,
        )
        session.add(evidence)
        await session.flush()

        for s_name in course.skills[:3]:
            skill = (
                await session.scalars(
                    select(Skill).where(Skill.canonical_name.ilike(s_name))
                )
            ).first()
            if not skill:
                skill = Skill(canonical_name=s_name, category=course.category, aliases=[])
                session.add(skill)
                await session.flush()

            # Check if already verified from stronger external evidence
            existing_skills = (
                await session.scalars(
                    select(StudentSkill).where(
                        StudentSkill.student_id == student_id,
                        StudentSkill.skill_id == skill.id,
                    )
                )
            ).all()
            has_verified = any(s.verification_tier == VerificationTier.verified for s in existing_skills)
            tier = VerificationTier.verified if has_verified else VerificationTier.partially_verified

            session.add(
                StudentSkill(
                    student_id=student_id,
                    skill_id=skill.id,
                    source_evidence_id=evidence.id,
                    extraction_confidence=0.90,
                    verification_tier=tier,
                    proficiency_hint="Course Completed",
                    evidence_span=f"Completed curriculum for {s_name} in {course.title}",
                )
            )
    elif payload.progress > 0:
        enrollment.status = "in_progress"

    await session.commit()

    return CourseEnrollmentResponse(
        id=enrollment.id,
        course_id=course.id,
        course_title=course.title,
        provider=course.provider,
        status=enrollment.status,
        progress=enrollment.progress,
        enrolled_at=enrollment.enrolled_at,
        completed_at=enrollment.completed_at,
    )
