"""Academia-Industry Collaboration Service.

Manages Industry Mentorship Sessions, Innovation Challenges, Hackathons,
Live Industry Projects, Workshops, and Research Collaborations.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    InnovationChallenge,
    MentorshipSession,
    ProjectApplication,
)
from app.schemas.contracts import (
    InnovationChallengeResponse,
    MentorshipSessionResponse,
    ProjectApplicationCreate,
    ProjectApplicationResponse,
)


async def list_mentorship_sessions(session: AsyncSession) -> list[MentorshipSessionResponse]:
    stmt = select(MentorshipSession).order_by(MentorshipSession.scheduled_at.desc())
    sessions = (await session.scalars(stmt)).all()
    return [
        MentorshipSessionResponse(
            id=s.id,
            mentor_name=s.mentor_name,
            mentor_company=s.mentor_company,
            mentor_role=s.mentor_role,
            domain=s.domain,
            scheduled_at=s.scheduled_at,
            duration_minutes=s.duration_minutes,
            meeting_link=s.meeting_link,
            max_participants=s.max_participants,
            description=s.description,
        )
        for s in sessions
    ]


async def list_innovation_challenges(
    session: AsyncSession,
    challenge_type: str | None = None,
) -> list[InnovationChallengeResponse]:
    stmt = select(InnovationChallenge).order_by(InnovationChallenge.deadline.asc())
    if challenge_type:
        stmt = stmt.where(InnovationChallenge.challenge_type == challenge_type)

    challenges = (await session.scalars(stmt)).all()
    return [
        InnovationChallengeResponse(
            id=c.id,
            challenge_type=c.challenge_type,
            title=c.title,
            host_company=c.host_company,
            problem_statement=c.problem_statement,
            prize_pool=c.prize_pool,
            team_size=c.team_size,
            duration_weeks=c.duration_weeks,
            mentor_name=c.mentor_name,
            deliverables=c.deliverables,
            milestones=c.milestones,
            deadline=c.deadline,
            tags=c.tags,
            status=c.status,
        )
        for c in challenges
    ]


async def apply_for_project(
    session: AsyncSession,
    student_id: UUID,
    payload: ProjectApplicationCreate,
) -> ProjectApplicationResponse:
    challenge = await session.get(InnovationChallenge, payload.challenge_id)
    if not challenge:
        raise ValueError("Challenge or project not found")

    existing = (
        await session.scalars(
            select(ProjectApplication).where(
                ProjectApplication.student_id == student_id,
                ProjectApplication.challenge_id == challenge.id,
            )
        )
    ).first()
    if existing:
        return ProjectApplicationResponse(
            id=existing.id,
            challenge_id=challenge.id,
            challenge_title=challenge.title,
            student_id=student_id,
            team_members=existing.team_members,
            status=existing.status,
            submission_url=existing.submission_url,
            submission_notes=existing.submission_notes,
            feedback=existing.feedback,
            score_or_grade=existing.score_or_grade,
            applied_at=existing.applied_at,
        )

    application = ProjectApplication(
        challenge_id=challenge.id,
        student_id=student_id,
        team_members=payload.team_members,
        submission_notes=payload.submission_notes,
        status="applied",
    )
    session.add(application)
    await session.commit()
    await session.refresh(application)

    return ProjectApplicationResponse(
        id=application.id,
        challenge_id=challenge.id,
        challenge_title=challenge.title,
        student_id=student_id,
        team_members=application.team_members,
        status=application.status,
        submission_url=None,
        submission_notes=application.submission_notes,
        feedback=None,
        score_or_grade=None,
        applied_at=application.applied_at,
    )


async def list_student_project_applications(
    session: AsyncSession,
    student_id: UUID,
) -> list[ProjectApplicationResponse]:
    stmt = (
        select(ProjectApplication)
        .where(ProjectApplication.student_id == student_id)
        .options(selectinload(ProjectApplication.challenge))
        .order_by(ProjectApplication.applied_at.desc())
    )
    rows = (await session.scalars(stmt)).all()
    return [
        ProjectApplicationResponse(
            id=app.id,
            challenge_id=app.challenge_id,
            challenge_title=app.challenge.title if app.challenge else "Project Challenge",
            student_id=app.student_id,
            team_members=app.team_members,
            status=app.status,
            submission_url=app.submission_url,
            submission_notes=app.submission_notes,
            feedback=app.feedback,
            score_or_grade=app.score_or_grade,
            applied_at=app.applied_at,
        )
        for app in rows
    ]
