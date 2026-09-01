from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Evidence,
    EvidenceType,
    ExtractionStatus,
    Internship,
    InternshipEngagement,
    Recruiter,
)
from app.schemas.contracts import (
    InternshipEngagementCreate,
    InternshipEngagementResponse,
    InternshipEngagementUpdate,
    MentorFeedbackRequest,
)


async def list_student_engagements(
    session: AsyncSession,
    student_id: UUID,
) -> list[InternshipEngagementResponse]:
    stmt = (
        select(InternshipEngagement)
        .where(InternshipEngagement.student_id == student_id)
        .options(
            selectinload(InternshipEngagement.internship).selectinload(Internship.recruiter)
        )
        .order_by(InternshipEngagement.created_at.desc())
    )
    rows = (await session.scalars(stmt)).all()
    results = []
    for eng in rows:
        company_name = (
            eng.internship.recruiter.company_name
            if eng.internship and eng.internship.recruiter
            else "Partner Corporate"
        )
        title = eng.internship.title if eng.internship else "Software Engineering Internship"
        results.append(
            InternshipEngagementResponse(
                id=eng.id,
                internship_id=eng.internship_id,
                student_id=eng.student_id,
                recruiter_id=eng.recruiter_id,
                internship_title=title,
                company_name=company_name,
                mentor_id=eng.mentor_id,
                mentor_name=eng.mentor_name,
                mentor_email=eng.mentor_email,
                start_date=eng.start_date,
                end_date=eng.end_date,
                status=eng.status,
                progress_percentage=eng.progress_percentage,
                milestones=eng.milestones,
                mentor_feedback=eng.mentor_feedback,
                final_rating=float(eng.final_rating) if eng.final_rating is not None else None,
                completion_notes=eng.completion_notes,
                created_at=eng.created_at,
            )
        )
    return results


async def list_recruiter_engagements(
    session: AsyncSession,
    recruiter_id: UUID,
    internship_id: UUID | None = None,
) -> list[InternshipEngagementResponse]:
    query = (
        select(InternshipEngagement)
        .where(InternshipEngagement.recruiter_id == recruiter_id)
        .options(
            selectinload(InternshipEngagement.internship).selectinload(Internship.recruiter),
            selectinload(InternshipEngagement.student),
        )
        .order_by(InternshipEngagement.created_at.desc())
    )
    if internship_id:
        query = query.where(InternshipEngagement.internship_id == internship_id)

    rows = (await session.scalars(query)).all()
    results = []
    for eng in rows:
        company_name = (
            eng.internship.recruiter.company_name
            if eng.internship and eng.internship.recruiter
            else "Corporate"
        )
        title = eng.internship.title if eng.internship else "Internship"
        results.append(
            InternshipEngagementResponse(
                id=eng.id,
                internship_id=eng.internship_id,
                student_id=eng.student_id,
                recruiter_id=eng.recruiter_id,
                internship_title=title,
                company_name=company_name,
                student_name=eng.student.full_name if eng.student else "Student",
                mentor_id=eng.mentor_id,
                mentor_name=eng.mentor_name,
                mentor_email=eng.mentor_email,
                start_date=eng.start_date,
                end_date=eng.end_date,
                status=eng.status,
                progress_percentage=eng.progress_percentage,
                milestones=eng.milestones,
                mentor_feedback=eng.mentor_feedback,
                final_rating=float(eng.final_rating) if eng.final_rating is not None else None,
                completion_notes=eng.completion_notes,
                created_at=eng.created_at,
            )
        )
    return results


async def create_internship_engagement(
    session: AsyncSession,
    recruiter_id: UUID,
    payload: InternshipEngagementCreate,
) -> InternshipEngagementResponse:
    internship = await session.get(Internship, payload.internship_id)
    if not internship or internship.recruiter_id != recruiter_id:
        raise ValueError("Internship not found or unauthorized")

    default_milestones = [
        {
            "id": "m1",
            "title": "Onboarding & Environment Setup",
            "description": "Codebase setup, dev environment provisioning, and initial ticket assignment.",
            "due_date": None,
            "status": "pending",
            "submitted_at": None,
            "feedback": None,
        },
        {
            "id": "m2",
            "title": "Core Feature Development",
            "description": "Implement assigned module features and unit test suites.",
            "due_date": None,
            "status": "pending",
            "submitted_at": None,
            "feedback": None,
        },
        {
            "id": "m3",
            "title": "Code Review & Final Project Demonstration",
            "description": "Demonstrate deliverables to engineering mentors and complete handover documentation.",
            "due_date": None,
            "status": "pending",
            "submitted_at": None,
            "feedback": None,
        },
    ]

    engagement = InternshipEngagement(
        internship_id=payload.internship_id,
        student_id=payload.student_id,
        recruiter_id=recruiter_id,
        mentor_name=payload.mentor_name,
        mentor_email=payload.mentor_email,
        start_date=payload.start_date or datetime.now(UTC),
        end_date=payload.end_date,
        status="active",
        progress_percentage=0,
        milestones=payload.milestones or default_milestones,
    )
    session.add(engagement)
    await session.commit()
    await session.refresh(engagement)

    recruiter = await session.get(Recruiter, recruiter_id)
    return InternshipEngagementResponse(
        id=engagement.id,
        internship_id=engagement.internship_id,
        student_id=engagement.student_id,
        recruiter_id=engagement.recruiter_id,
        internship_title=internship.title,
        company_name=recruiter.company_name if recruiter else "Company",
        mentor_name=engagement.mentor_name,
        mentor_email=engagement.mentor_email,
        start_date=engagement.start_date,
        end_date=engagement.end_date,
        status=engagement.status,
        progress_percentage=engagement.progress_percentage,
        milestones=engagement.milestones,
        mentor_feedback=engagement.mentor_feedback,
        final_rating=None,
        completion_notes=None,
        created_at=engagement.created_at,
    )


async def update_engagement_status(
    session: AsyncSession,
    engagement_id: UUID,
    recruiter_id: UUID,
    payload: InternshipEngagementUpdate,
) -> InternshipEngagementResponse:
    engagement = await session.get(InternshipEngagement, engagement_id)
    if not engagement or engagement.recruiter_id != recruiter_id:
        raise ValueError("Engagement not found or unauthorized")

    if payload.status is not None:
        engagement.status = payload.status
    if payload.progress_percentage is not None:
        engagement.progress_percentage = payload.progress_percentage
    if payload.mentor_name is not None:
        engagement.mentor_name = payload.mentor_name
    if payload.mentor_email is not None:
        engagement.mentor_email = payload.mentor_email
    if payload.completion_notes is not None:
        engagement.completion_notes = payload.completion_notes
    if payload.final_rating is not None:
        engagement.final_rating = payload.final_rating

    # If completed, generate formal internship completion evidence
    if engagement.status == "completed" and not engagement.completion_evidence_id:
        internship = await session.get(Internship, engagement.internship_id)
        recruiter = await session.get(Recruiter, recruiter_id)
        company = recruiter.company_name if recruiter else "Industry Partner"
        title = internship.title if internship else "Software Engineering"

        evidence = Evidence(
            student_id=engagement.student_id,
            evidence_type=EvidenceType.project,
            title=f"Verified Internship Completion: {title}",
            description=f"Successfully completed professional engineering internship at {company}. Rating: {engagement.final_rating or 4.5}/5.0. Mentor: {engagement.mentor_name or 'Engineering Lead'}.",
            raw_metadata={
                "internship_id": str(engagement.internship_id),
                "engagement_id": str(engagement.id),
                "company_name": company,
                "final_rating": float(engagement.final_rating) if engagement.final_rating else 4.5,
                "completed_at": datetime.now(UTC).isoformat(),
            },
            extraction_status=ExtractionStatus.extracted,
        )
        session.add(evidence)
        await session.flush()
        engagement.completion_evidence_id = evidence.id

    await session.commit()
    await session.refresh(engagement)

    internship = await session.get(Internship, engagement.internship_id)
    recruiter = await session.get(Recruiter, recruiter_id)

    return InternshipEngagementResponse(
        id=engagement.id,
        internship_id=engagement.internship_id,
        student_id=engagement.student_id,
        recruiter_id=engagement.recruiter_id,
        internship_title=internship.title if internship else "Internship",
        company_name=recruiter.company_name if recruiter else "Company",
        mentor_name=engagement.mentor_name,
        mentor_email=engagement.mentor_email,
        start_date=engagement.start_date,
        end_date=engagement.end_date,
        status=engagement.status,
        progress_percentage=engagement.progress_percentage,
        milestones=engagement.milestones,
        mentor_feedback=engagement.mentor_feedback,
        final_rating=float(engagement.final_rating) if engagement.final_rating is not None else None,
        completion_notes=engagement.completion_notes,
        created_at=engagement.created_at,
    )


async def submit_mentor_feedback(
    session: AsyncSession,
    engagement_id: UUID,
    recruiter_id: UUID,
    payload: MentorFeedbackRequest,
) -> InternshipEngagementResponse:
    engagement = await session.get(InternshipEngagement, engagement_id)
    if not engagement or engagement.recruiter_id != recruiter_id:
        raise ValueError("Engagement not found or unauthorized")

    feedback_dict = {
        "technical_skills_rating": payload.technical_skills_rating,
        "communication_rating": payload.communication_rating,
        "teamwork_rating": payload.teamwork_rating,
        "problem_solving_rating": payload.problem_solving_rating,
        "overall_rating": payload.overall_rating,
        "comments": payload.comments,
        "submitted_at": datetime.now(UTC).isoformat(),
    }
    engagement.mentor_feedback = feedback_dict
    engagement.final_rating = payload.overall_rating
    await session.commit()
    await session.refresh(engagement)

    internship = await session.get(Internship, engagement.internship_id)
    recruiter = await session.get(Recruiter, recruiter_id)

    return InternshipEngagementResponse(
        id=engagement.id,
        internship_id=engagement.internship_id,
        student_id=engagement.student_id,
        recruiter_id=engagement.recruiter_id,
        internship_title=internship.title if internship else "Internship",
        company_name=recruiter.company_name if recruiter else "Company",
        mentor_name=engagement.mentor_name,
        mentor_email=engagement.mentor_email,
        start_date=engagement.start_date,
        end_date=engagement.end_date,
        status=engagement.status,
        progress_percentage=engagement.progress_percentage,
        milestones=engagement.milestones,
        mentor_feedback=engagement.mentor_feedback,
        final_rating=float(engagement.final_rating) if engagement.final_rating is not None else None,
        completion_notes=engagement.completion_notes,
        created_at=engagement.created_at,
    )
