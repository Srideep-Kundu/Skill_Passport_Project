from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AuditLog,
    Evidence,
    EvidenceType,
    ExtractionStatus,
    Internship,
    InternshipEngagement,
    Recruiter,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    InternshipCompletionRequest,
    InternshipEngagementCreate,
    InternshipEngagementResponse,
    InternshipEngagementUpdate,
    MentorFeedbackRequest,
)

RECRUITER_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "applied": ("shortlisted", "rejected"),
    "shortlisted": ("selected", "rejected"),
    "selected": ("active", "rejected"),
    "active": ("abandoned",),
}
STUDENT_WITHDRAWAL_STATES = {"applied", "shortlisted", "selected"}


class EngagementNotFoundError(ValueError):
    """The engagement is absent or outside the actor's company scope."""


class EngagementConflictError(ValueError):
    """The requested lifecycle operation conflicts with persisted state."""


class EngagementValidationError(ValueError):
    """Mentor feedback or completion data violates a domain invariant."""


def allowed_next_statuses(status: str) -> list[str]:
    return list(RECRUITER_TRANSITIONS.get(status, ()))


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _audit(
    actor_id: UUID,
    action: str,
    engagement: InternshipEngagement,
    details: dict[str, object],
) -> AuditLog:
    return AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type="internship_engagement",
        entity_id=engagement.id,
        details=details,
    )


async def _response(
    session: AsyncSession,
    engagement: InternshipEngagement,
    *,
    include_student: bool = False,
) -> InternshipEngagementResponse:
    internship = await session.get(Internship, engagement.internship_id)
    recruiter = await session.get(Recruiter, engagement.recruiter_id)
    student = await session.get(Student, engagement.student_id) if include_student else None
    return InternshipEngagementResponse(
        id=engagement.id,
        internship_id=engagement.internship_id,
        student_id=engagement.student_id,
        recruiter_id=engagement.recruiter_id,
        internship_title=internship.title if internship else "Unavailable internship",
        company_name=recruiter.company_name if recruiter else "Unavailable company",
        student_name=student.full_name if student else None,
        mentor_id=engagement.mentor_id,
        mentor_name=engagement.mentor_name,
        mentor_email=engagement.mentor_email,
        start_date=engagement.start_date,
        end_date=engagement.end_date,
        status=engagement.status,
        progress_percentage=engagement.progress_percentage,
        milestones=engagement.milestones,
        mentor_feedback=engagement.mentor_feedback,
        final_rating=(
            float(engagement.final_rating)
            if engagement.final_rating is not None
            else None
        ),
        completion_notes=engagement.completion_notes,
        completion_evidence_id=engagement.completion_evidence_id,
        completion_verified=engagement.completion_evidence_id is not None,
        completed_at=engagement.completed_at,
        mentor_verified_at=engagement.mentor_verified_at,
        allowed_next_statuses=allowed_next_statuses(engagement.status),
        created_at=engagement.created_at,
    )


async def _owned_engagement(
    session: AsyncSession, engagement_id: UUID, recruiter_id: UUID
) -> InternshipEngagement:
    engagement = await session.get(InternshipEngagement, engagement_id)
    if engagement is None or engagement.recruiter_id != recruiter_id:
        raise EngagementNotFoundError("Internship engagement not found")
    internship = await session.get(Internship, engagement.internship_id)
    if internship is None or internship.recruiter_id != recruiter_id:
        raise EngagementNotFoundError("Internship engagement not found")
    return engagement


async def list_student_engagements(
    session: AsyncSession, student_id: UUID
) -> list[InternshipEngagementResponse]:
    rows = list(
        (
            await session.scalars(
                select(InternshipEngagement)
                .where(InternshipEngagement.student_id == student_id)
                .order_by(InternshipEngagement.created_at.desc())
            )
        ).all()
    )
    return [await _response(session, row) for row in rows]


async def list_recruiter_engagements(
    session: AsyncSession,
    recruiter_id: UUID,
    internship_id: UUID | None = None,
) -> list[InternshipEngagementResponse]:
    query = select(InternshipEngagement).where(
        InternshipEngagement.recruiter_id == recruiter_id
    )
    if internship_id is not None:
        internship = await session.get(Internship, internship_id)
        if internship is None or internship.recruiter_id != recruiter_id:
            raise EngagementNotFoundError("Internship not found")
        query = query.where(InternshipEngagement.internship_id == internship_id)
    rows = list(
        (
            await session.scalars(
                query.order_by(InternshipEngagement.created_at.desc())
            )
        ).all()
    )
    return [await _response(session, row, include_student=True) for row in rows]


async def create_internship_engagement(
    session: AsyncSession,
    recruiter_id: UUID,
    payload: InternshipEngagementCreate,
) -> InternshipEngagementResponse:
    internship = await session.get(Internship, payload.internship_id)
    if internship is None or internship.recruiter_id != recruiter_id:
        raise EngagementNotFoundError("Internship not found")
    if await session.get(Student, payload.student_id) is None:
        raise EngagementValidationError("Student not found")
    if (
        payload.start_date is not None
        and payload.end_date is not None
        and payload.end_date < payload.start_date
    ):
        raise EngagementValidationError("End date cannot precede start date")
    engagement = InternshipEngagement(
        internship_id=payload.internship_id,
        student_id=payload.student_id,
        recruiter_id=recruiter_id,
        mentor_name=payload.mentor_name,
        mentor_email=payload.mentor_email,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="applied",
        progress_percentage=0,
        milestones=payload.milestones or [],
    )
    session.add(engagement)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise EngagementConflictError(
            "A student can have only one engagement for an internship"
        ) from exc
    session.add(
        _audit(
            recruiter_id,
            "internship_engagement_created",
            engagement,
            {"status": "applied", "internship_id": str(internship.id)},
        )
    )
    await session.commit()
    await session.refresh(engagement)
    return await _response(session, engagement, include_student=True)


async def update_engagement_status(
    session: AsyncSession,
    engagement_id: UUID,
    recruiter_id: UUID,
    payload: InternshipEngagementUpdate,
) -> InternshipEngagementResponse:
    engagement = await _owned_engagement(session, engagement_id, recruiter_id)
    previous_status = engagement.status
    if payload.status == "completed":
        raise EngagementValidationError("Use the dedicated completion endpoint")
    if payload.status is not None and payload.status != engagement.status:
        if payload.status not in RECRUITER_TRANSITIONS.get(engagement.status, ()):
            raise EngagementConflictError(
                f"Transition from {engagement.status} to {payload.status} is not allowed"
            )
        engagement.status = payload.status
        if payload.status == "active" and engagement.start_date is None:
            engagement.start_date = datetime.now(UTC)
    if payload.progress_percentage is not None:
        if engagement.status != "active":
            raise EngagementConflictError("Progress can be updated only while active")
        if payload.progress_percentage < engagement.progress_percentage:
            raise EngagementValidationError("Progress cannot move backwards")
        engagement.progress_percentage = payload.progress_percentage
    if payload.mentor_name is not None:
        engagement.mentor_name = payload.mentor_name
    if payload.mentor_email is not None:
        engagement.mentor_email = payload.mentor_email
    session.add(
        _audit(
            recruiter_id,
            "internship_engagement_updated",
            engagement,
            {
                "from_status": previous_status,
                "to_status": engagement.status,
                "progress_percentage": engagement.progress_percentage,
            },
        )
    )
    await session.commit()
    await session.refresh(engagement)
    return await _response(session, engagement, include_student=True)


async def withdraw_engagement(
    session: AsyncSession, engagement_id: UUID, student_id: UUID
) -> InternshipEngagementResponse:
    engagement = await session.get(InternshipEngagement, engagement_id)
    if engagement is None or engagement.student_id != student_id:
        raise EngagementNotFoundError("Internship engagement not found")
    if engagement.status not in STUDENT_WITHDRAWAL_STATES:
        raise EngagementConflictError(
            f"An engagement in {engagement.status} cannot be withdrawn"
        )
    previous_status = engagement.status
    engagement.status = "withdrawn"
    session.add(
        _audit(
            student_id,
            "internship_engagement_withdrawn",
            engagement,
            {"from_status": previous_status, "to_status": "withdrawn"},
        )
    )
    await session.commit()
    await session.refresh(engagement)
    return await _response(session, engagement)


async def _validated_feedback(
    session: AsyncSession, payload: MentorFeedbackRequest
) -> tuple[list[dict[str, object]], Decimal]:
    skill_ids = [item.skill_id for item in payload.skill_feedback]
    if len(skill_ids) != len(set(skill_ids)):
        raise EngagementValidationError("Each canonical skill may be rated only once")
    skills = list(
        (await session.scalars(select(Skill).where(Skill.id.in_(skill_ids)))).all()
    )
    skills_by_id = {skill.id: skill for skill in skills}
    if len(skills_by_id) != len(skill_ids):
        raise EngagementValidationError(
            "All feedback skills must reference the canonical taxonomy"
        )
    feedback: list[dict[str, object]] = [
        {
            "skill_id": str(item.skill_id),
            "skill_name": skills_by_id[item.skill_id].canonical_name,
            "rating": item.rating,
            "comment": item.comment,
            "observed_outcome": item.observed_outcome,
        }
        for item in payload.skill_feedback
    ]
    average = Decimal(sum(item.rating for item in payload.skill_feedback)) / Decimal(
        len(payload.skill_feedback)
    )
    return feedback, average.quantize(Decimal("0.01"))


async def submit_mentor_feedback(
    session: AsyncSession,
    engagement_id: UUID,
    recruiter_id: UUID,
    payload: MentorFeedbackRequest,
) -> InternshipEngagementResponse:
    engagement = await _owned_engagement(session, engagement_id, recruiter_id)
    if engagement.status != "active":
        raise EngagementConflictError("Mentor feedback requires an active engagement")
    now = datetime.now(UTC)
    if payload.skill_feedback:
        feedback, average = await _validated_feedback(session, payload)
        if payload.mentor_name is None:
            raise EngagementValidationError(
                "Mentor name is required for structured skill feedback"
            )
        engagement.mentor_name = payload.mentor_name
        engagement.mentor_email = payload.mentor_email
        engagement.mentor_feedback = {
            "schema": "canonical_skill_outcomes_v1",
            "skills": feedback,
            "overall_comment": payload.overall_comment,
            "submitted_at": now.isoformat(),
        }
        engagement.final_rating = float(average)
        engagement.mentor_verified_at = now
        audit_skill_ids = [item["skill_id"] for item in feedback]
    else:
        legacy_values = (
            payload.technical_skills_rating,
            payload.communication_rating,
            payload.teamwork_rating,
            payload.problem_solving_rating,
            payload.overall_rating,
            payload.comments,
        )
        if any(value is None for value in legacy_values):
            raise EngagementValidationError(
                "Canonical skill feedback is required for verified outcomes"
            )
        engagement.mentor_feedback = {
            "schema": "legacy_category_ratings_v1",
            "technical_skills_rating": payload.technical_skills_rating,
            "communication_rating": payload.communication_rating,
            "teamwork_rating": payload.teamwork_rating,
            "problem_solving_rating": payload.problem_solving_rating,
            "overall_rating": payload.overall_rating,
            "comments": payload.comments,
            "submitted_at": now.isoformat(),
        }
        engagement.final_rating = payload.overall_rating
        audit_skill_ids = []
    session.add(
        _audit(
            recruiter_id,
            "internship_mentor_feedback_recorded",
            engagement,
            {"skill_ids": audit_skill_ids, "passport_eligible": bool(audit_skill_ids)},
        )
    )
    await session.commit()
    await session.refresh(engagement)
    return await _response(session, engagement, include_student=True)


async def complete_engagement(
    session: AsyncSession,
    engagement_id: UUID,
    recruiter_id: UUID,
    payload: InternshipCompletionRequest,
) -> InternshipEngagementResponse:
    engagement = await _owned_engagement(session, engagement_id, recruiter_id)
    if engagement.status == "completed":
        if engagement.completion_evidence_id is None:
            raise EngagementConflictError("Completed engagement has no completion evidence")
        return await _response(session, engagement, include_student=True)
    if engagement.status != "active":
        raise EngagementConflictError("Only an active engagement can be completed")
    feedback = engagement.mentor_feedback
    if not feedback or not isinstance(feedback.get("skills"), list) or not feedback["skills"]:
        raise EngagementValidationError("Structured mentor feedback is required")
    if engagement.mentor_verified_at is None or not engagement.mentor_name:
        raise EngagementValidationError("Verified mentor identity is required")

    skill_ids: list[UUID] = []
    for item in feedback["skills"]:
        try:
            skill_ids.append(UUID(str(item["skill_id"])))
        except (KeyError, TypeError, ValueError) as exc:
            raise EngagementValidationError("Stored mentor feedback is invalid") from exc
    skills = list(
        (await session.scalars(select(Skill).where(Skill.id.in_(skill_ids)))).all()
    )
    if len({skill.id for skill in skills}) != len(skill_ids):
        raise EngagementValidationError("Stored feedback has an invalid skill mapping")

    now = datetime.now(UTC)
    if engagement.start_date is None or _as_utc(engagement.start_date) > now:
        raise EngagementValidationError("A valid internship start date is required")
    if engagement.end_date is not None and _as_utc(engagement.end_date) < _as_utc(
        engagement.start_date
    ):
        raise EngagementValidationError("End date cannot precede start date")
    if engagement.end_date is not None and _as_utc(engagement.end_date) > now:
        raise EngagementValidationError("End date cannot be in the future at completion")
    internship = await session.get(Internship, engagement.internship_id)
    recruiter = await session.get(Recruiter, recruiter_id)
    if internship is None or recruiter is None:
        raise EngagementNotFoundError("Internship engagement not found")

    evidence = Evidence(
        student_id=engagement.student_id,
        evidence_type=EvidenceType.project,
        title=f"Verified Internship Completion: {internship.title}",
        description=f"{payload.outcome_summary} Verified by {recruiter.company_name}.",
        raw_metadata={
            "source": "internship_mentor_completion",
            "internship_id": str(internship.id),
            "engagement_id": str(engagement.id),
            "company_name": recruiter.company_name,
            "completed_at": now.isoformat(),
            "skill_outcomes": feedback["skills"],
        },
        extraction_status=ExtractionStatus.extracted,
    )
    session.add(evidence)
    await session.flush()

    for item in feedback["skills"]:
        skill_id = UUID(str(item["skill_id"]))
        rating = int(item["rating"])
        observed_outcome = str(item["observed_outcome"])
        existing = await session.scalar(
            select(StudentSkill).where(
                StudentSkill.student_id == engagement.student_id,
                StudentSkill.skill_id == skill_id,
                StudentSkill.source_evidence_id == evidence.id,
            )
        )
        confidence = Decimal(rating) / Decimal(5)
        if existing is None:
            session.add(
                StudentSkill(
                    student_id=engagement.student_id,
                    skill_id=skill_id,
                    source_evidence_id=evidence.id,
                    extraction_confidence=confidence,
                    verification_tier=VerificationTier.verified,
                    proficiency_hint=f"mentor_rating_{rating}_of_5",
                    evidence_span=observed_outcome[:500],
                )
            )
        else:
            existing.extraction_confidence = float(
                max(Decimal(str(existing.extraction_confidence)), confidence)
            )
            existing.verification_tier = VerificationTier.verified

    engagement.status = "completed"
    engagement.progress_percentage = 100
    engagement.completed_at = now
    engagement.end_date = engagement.end_date or now
    engagement.completion_notes = payload.completion_notes
    engagement.completion_evidence_id = evidence.id
    session.add(
        _audit(
            recruiter_id,
            "internship_engagement_completed",
            engagement,
            {
                "evidence_id": str(evidence.id),
                "skill_ids": [str(skill_id) for skill_id in skill_ids],
            },
        )
    )
    await session.commit()
    await session.refresh(engagement)
    return await _response(session, engagement, include_student=True)
