"""Governed recruiter/student/faculty collaboration lifecycle."""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Academician,
    ChallengeSkillRequirement,
    CollaborationWorkspace,
    Evidence,
    EvidenceType,
    ExtractionStatus,
    FacultyApplication,
    FacultyInvitation,
    FacultyNotification,
    FacultyOpportunity,
    InnovationChallenge,
    ProjectApplication,
    Recruiter,
    Skill,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    ChallengeSkillRequirementInput,
    ChallengeSkillRequirementResponse,
    FacultyInvitationCreate,
    FacultyInvitationResponse,
    InnovationChallengeCreate,
    InnovationChallengeResponse,
    InnovationChallengeUpdate,
    ProjectApplicationResponse,
    SharedValidatedFeedback,
)


class CollaborationError(ValueError):
    pass


class CollaborationNotFoundError(CollaborationError):
    pass


class CollaborationForbiddenError(CollaborationError):
    pass


class CollaborationConflictError(CollaborationError):
    pass


_TRANSITIONS = {
    "applied": {"shortlisted", "rejected", "withdrawn", "cancelled"},
    "shortlisted": {"selected", "rejected", "withdrawn", "cancelled"},
    "selected": {"active", "withdrawn", "cancelled"},
    "active": {"submitted", "cancelled"},
    "submitted": {"completed", "cancelled"},
}


def _challenge_options():
    return selectinload(InnovationChallenge.requirements).selectinload(
        ChallengeSkillRequirement.skill
    )


def challenge_response(challenge: InnovationChallenge) -> InnovationChallengeResponse:
    return InnovationChallengeResponse(
        id=challenge.id,
        recruiter_id=challenge.recruiter_id,
        challenge_type=challenge.challenge_type,
        title=challenge.title,
        host_company=challenge.host_company,
        problem_statement=challenge.problem_statement,
        prize_pool=challenge.prize_pool,
        team_size=challenge.team_size,
        duration_weeks=challenge.duration_weeks,
        mentor_name=challenge.mentor_name,
        deliverables=challenge.deliverables,
        milestones=challenge.milestones,
        deadline=challenge.deadline,
        tags=challenge.tags,
        status=challenge.status,
        start_date=challenge.start_date,
        end_date=challenge.end_date,
        published_at=challenge.published_at,
        closed_at=challenge.closed_at,
        participant_capacity=challenge.participant_capacity,
        eligibility=challenge.eligibility,
        outcome_criteria=challenge.outcome_criteria,
        requirements=[
            ChallengeSkillRequirementResponse(
                skill_id=row.skill_id,
                skill_name=row.skill.canonical_name,
                requirement_type=row.requirement_type,
                weight=float(row.weight),
            )
            for row in challenge.requirements
        ],
    )


def application_response(application: ProjectApplication) -> ProjectApplicationResponse:
    challenge = application.challenge
    return ProjectApplicationResponse(
        id=application.id,
        challenge_id=application.challenge_id,
        challenge_title=challenge.title,
        student_id=application.student_id,
        team_members=application.team_members,
        status=application.status,
        submission_url=application.submission_url,
        submission_notes=application.submission_notes,
        feedback=application.feedback,
        score_or_grade=application.score_or_grade,
        applied_at=application.applied_at,
        completion_evidence_id=application.completion_evidence_id,
        feedback_rating=application.feedback_rating,
        outcome_metadata=application.outcome_metadata,
        started_at=application.started_at,
        submitted_at=application.submitted_at,
        completed_at=application.completed_at,
        challenge_requirements=[
            ChallengeSkillRequirementResponse(
                skill_id=row.skill_id,
                skill_name=row.skill.canonical_name,
                requirement_type=row.requirement_type,
                weight=float(row.weight),
            )
            for row in challenge.requirements
        ],
    )


async def _validate_requirements(
    session: AsyncSession, requirements: list[ChallengeSkillRequirementInput]
) -> list[Skill]:
    skill_ids = [row.skill_id for row in requirements]
    if len(skill_ids) != len(set(skill_ids)):
        raise CollaborationConflictError("Each canonical skill may be configured once")
    skills = list(
        (await session.scalars(select(Skill).where(Skill.id.in_(skill_ids)))).all()
    ) if skill_ids else []
    if len(skills) != len(skill_ids):
        raise CollaborationConflictError(
            "All challenge skills must reference the canonical taxonomy"
        )
    return skills


def _replace_requirements(
    challenge: InnovationChallenge,
    payload: list[ChallengeSkillRequirementInput],
) -> None:
    challenge.requirements = [
        ChallengeSkillRequirement(
            skill_id=row.skill_id,
            requirement_type=row.requirement_type,
            weight=row.weight,
        )
        for row in payload
    ]


async def create_challenge(
    session: AsyncSession,
    recruiter: Recruiter,
    payload: InnovationChallengeCreate,
) -> InnovationChallengeResponse:
    await _validate_requirements(session, payload.requirements)
    challenge = InnovationChallenge(
        recruiter_id=recruiter.id,
        challenge_type=payload.challenge_type,
        title=payload.title,
        host_company=recruiter.company_name,
        problem_statement=payload.problem_statement,
        prize_pool=payload.prize_pool,
        team_size=payload.team_size,
        duration_weeks=payload.duration_weeks,
        mentor_name=payload.mentor_name,
        deliverables=payload.deliverables,
        milestones=payload.milestones,
        deadline=payload.deadline,
        tags=[],
        status="draft",
        start_date=payload.start_date,
        end_date=payload.end_date,
        participant_capacity=payload.participant_capacity,
        eligibility=payload.eligibility,
        outcome_criteria=payload.outcome_criteria,
    )
    _replace_requirements(challenge, payload.requirements)
    session.add(challenge)
    await session.commit()
    return await get_owned_challenge(session, recruiter.id, challenge.id)


async def get_owned_challenge(
    session: AsyncSession, recruiter_id: UUID, challenge_id: UUID
) -> InnovationChallengeResponse:
    challenge = await session.scalar(
        select(InnovationChallenge)
        .where(InnovationChallenge.id == challenge_id)
        .options(_challenge_options())
    )
    if challenge is None:
        raise CollaborationNotFoundError("Challenge not found")
    if challenge.recruiter_id != recruiter_id:
        raise CollaborationForbiddenError("Challenge belongs to another company")
    return challenge_response(challenge)


async def list_owned_challenges(
    session: AsyncSession, recruiter_id: UUID
) -> list[InnovationChallengeResponse]:
    rows = (
        await session.scalars(
            select(InnovationChallenge)
            .where(InnovationChallenge.recruiter_id == recruiter_id)
            .options(_challenge_options())
            .order_by(InnovationChallenge.created_at.desc())
        )
    ).all()
    return [challenge_response(row) for row in rows]


async def update_challenge(
    session: AsyncSession,
    recruiter_id: UUID,
    challenge_id: UUID,
    payload: InnovationChallengeUpdate,
) -> InnovationChallengeResponse:
    challenge = await _owned_challenge_model(session, recruiter_id, challenge_id)
    if challenge.status == "closed":
        raise CollaborationConflictError("Closed challenges cannot be edited")
    values = payload.model_dump(exclude_unset=True, exclude={"requirements"})
    for field, value in values.items():
        setattr(challenge, field, value)
    if payload.requirements is not None:
        await _validate_requirements(session, payload.requirements)
        _replace_requirements(challenge, payload.requirements)
    await session.commit()
    return await get_owned_challenge(session, recruiter_id, challenge_id)


async def _owned_challenge_model(
    session: AsyncSession, recruiter_id: UUID, challenge_id: UUID
) -> InnovationChallenge:
    challenge = await session.scalar(
        select(InnovationChallenge)
        .where(InnovationChallenge.id == challenge_id)
        .options(_challenge_options())
    )
    if challenge is None:
        raise CollaborationNotFoundError("Challenge not found")
    if challenge.recruiter_id != recruiter_id:
        raise CollaborationForbiddenError("Challenge belongs to another company")
    return challenge


async def set_challenge_publication(
    session: AsyncSession, recruiter_id: UUID, challenge_id: UUID, action: str
) -> InnovationChallengeResponse:
    challenge = await _owned_challenge_model(session, recruiter_id, challenge_id)
    now = datetime.now(UTC)
    if action == "publish":
        if not challenge.requirements:
            raise CollaborationConflictError("At least one canonical skill is required")
        challenge.status = "published"
        challenge.published_at = challenge.published_at or now
        challenge.closed_at = None
    elif action == "close":
        challenge.status = "closed"
        challenge.closed_at = now
    else:
        raise CollaborationConflictError("Unsupported publication action")
    await session.commit()
    return await get_owned_challenge(session, recruiter_id, challenge_id)


async def delete_challenge(
    session: AsyncSession, recruiter_id: UUID, challenge_id: UUID
) -> None:
    challenge = await _owned_challenge_model(session, recruiter_id, challenge_id)
    application = await session.scalar(
        select(ProjectApplication.id).where(ProjectApplication.challenge_id == challenge.id)
    )
    if challenge.status != "draft" or application is not None:
        raise CollaborationConflictError("Only unused draft challenges can be deleted")
    await session.delete(challenge)
    await session.commit()


async def list_public_challenges(
    session: AsyncSession, challenge_type: str | None = None
) -> list[InnovationChallengeResponse]:
    statement = (
        select(InnovationChallenge)
        .where(InnovationChallenge.status == "published")
        .options(_challenge_options())
        .order_by(InnovationChallenge.deadline.asc())
    )
    if challenge_type:
        statement = statement.where(InnovationChallenge.challenge_type == challenge_type)
    rows = (await session.scalars(statement)).all()
    return [challenge_response(row) for row in rows]


async def apply_for_challenge(
    session: AsyncSession, student_id: UUID, challenge_id: UUID,
    team_members: list[str], submission_notes: str | None,
) -> ProjectApplicationResponse:
    challenge = await session.scalar(
        select(InnovationChallenge)
        .where(InnovationChallenge.id == challenge_id)
        .options(_challenge_options())
    )
    if challenge is None or challenge.status != "published":
        raise CollaborationNotFoundError("Published challenge not found")
    existing = await session.scalar(select(ProjectApplication.id).where(
        ProjectApplication.student_id == student_id,
        ProjectApplication.challenge_id == challenge_id,
    ))
    if existing is not None:
        raise CollaborationConflictError("Student has already applied")
    application = ProjectApplication(
        challenge_id=challenge_id, student_id=student_id,
        team_members=team_members, submission_notes=submission_notes, status="applied",
    )
    session.add(application)
    await session.commit()
    return await get_student_application(session, student_id, application.id)


async def _application_model(session: AsyncSession, application_id: UUID) -> ProjectApplication:
    application = await session.scalar(
        select(ProjectApplication)
        .where(ProjectApplication.id == application_id)
        .options(selectinload(ProjectApplication.challenge).options(_challenge_options()))
    )
    if application is None:
        raise CollaborationNotFoundError("Project application not found")
    return application


async def get_student_application(
    session: AsyncSession, student_id: UUID, application_id: UUID
) -> ProjectApplicationResponse:
    application = await _application_model(session, application_id)
    if application.student_id != student_id:
        raise CollaborationForbiddenError("Project application belongs to another student")
    return application_response(application)


async def list_student_applications(
    session: AsyncSession, student_id: UUID
) -> list[ProjectApplicationResponse]:
    rows = (
        await session.scalars(
            select(ProjectApplication)
            .where(ProjectApplication.student_id == student_id)
            .options(selectinload(ProjectApplication.challenge).options(_challenge_options()))
            .order_by(ProjectApplication.applied_at.desc())
        )
    ).all()
    return [application_response(row) for row in rows]


async def list_challenge_applications(
    session: AsyncSession, recruiter_id: UUID, challenge_id: UUID
) -> list[ProjectApplicationResponse]:
    await _owned_challenge_model(session, recruiter_id, challenge_id)
    rows = (
        await session.scalars(
            select(ProjectApplication)
            .where(ProjectApplication.challenge_id == challenge_id)
            .options(selectinload(ProjectApplication.challenge).options(_challenge_options()))
            .order_by(ProjectApplication.applied_at)
        )
    ).all()
    return [application_response(row) for row in rows]


async def transition_application(
    session: AsyncSession, recruiter_id: UUID, application_id: UUID, target: str
) -> ProjectApplicationResponse:
    application = await _application_model(session, application_id)
    if application.challenge.recruiter_id != recruiter_id:
        raise CollaborationForbiddenError("Application belongs to another company")
    if target == "completed":
        raise CollaborationConflictError("Use verified completion after feedback")
    if target not in _TRANSITIONS.get(application.status, set()):
        raise CollaborationConflictError(
            f"Cannot transition {application.status} to {target}"
        )
    application.status = target
    if target == "active":
        application.started_at = application.started_at or datetime.now(UTC)
    await session.commit()
    return await get_owned_application(session, recruiter_id, application_id)


async def get_owned_application(
    session: AsyncSession, recruiter_id: UUID, application_id: UUID
) -> ProjectApplicationResponse:
    application = await _application_model(session, application_id)
    if application.challenge.recruiter_id != recruiter_id:
        raise CollaborationForbiddenError("Application belongs to another company")
    return application_response(application)


async def submit_project(
    session: AsyncSession, student_id: UUID, application_id: UUID,
    submission_url: str, submission_notes: str | None,
) -> ProjectApplicationResponse:
    application = await _application_model(session, application_id)
    if application.student_id != student_id:
        raise CollaborationForbiddenError("Project application belongs to another student")
    if application.status != "active":
        raise CollaborationConflictError("Only active projects may be submitted")
    application.status = "submitted"
    application.submission_url = submission_url
    application.submission_notes = submission_notes
    application.submitted_at = datetime.now(UTC)
    await session.commit()
    return await get_student_application(session, student_id, application_id)


async def record_project_feedback(
    session: AsyncSession, recruiter_id: UUID, application_id: UUID,
    payload: SharedValidatedFeedback,
) -> ProjectApplicationResponse:
    application = await _application_model(session, application_id)
    if application.challenge.recruiter_id != recruiter_id:
        raise CollaborationForbiddenError("Application belongs to another company")
    if application.status not in {"active", "submitted"}:
        raise CollaborationConflictError("Feedback requires active or submitted work")
    allowed = {row.skill_id for row in application.challenge.requirements}
    skill_ids = [row.skill_id for row in payload.skill_feedback]
    if len(skill_ids) != len(set(skill_ids)) or not set(skill_ids).issubset(allowed):
        raise CollaborationConflictError(
            "Feedback skills must be unique configured canonical skills"
        )
    existing_skills = set(
        (await session.scalars(select(Skill.id).where(Skill.id.in_(skill_ids)))).all()
    )
    if existing_skills != set(skill_ids):
        raise CollaborationConflictError("Feedback references an unknown canonical skill")
    now = datetime.now(UTC)
    application.feedback = payload.comment
    application.feedback_rating = payload.rating
    application.outcome_metadata = {
        "schema": "shared_validated_feedback_v1",
        "observed_outcome": payload.observed_outcome,
        "skills": [row.model_dump(mode="json") for row in payload.skill_feedback],
        "evaluator_role": "recruiter",
        "submitted_at": now.isoformat(),
    }
    await session.commit()
    return await get_owned_application(session, recruiter_id, application_id)


async def complete_project(
    session: AsyncSession, recruiter_id: UUID, application_id: UUID,
    outcome_summary: str,
) -> ProjectApplicationResponse:
    application = await _application_model(session, application_id)
    if application.challenge.recruiter_id != recruiter_id:
        raise CollaborationForbiddenError("Application belongs to another company")
    if application.status == "completed":
        if application.completion_evidence_id is None:
            raise CollaborationConflictError("Completed project lacks evidence")
        return application_response(application)
    if application.status != "submitted":
        raise CollaborationConflictError("Only submitted projects can be completed")
    feedback_rows = application.outcome_metadata.get("skills")
    if not isinstance(feedback_rows, list) or not feedback_rows:
        raise CollaborationConflictError("Validated canonical-skill feedback is required")
    now = datetime.now(UTC)
    evidence = Evidence(
        student_id=application.student_id,
        evidence_type=EvidenceType.project,
        title=f"Verified Industry Project: {application.challenge.title}",
        description=outcome_summary,
        external_url=application.submission_url,
        raw_metadata={
            "source": "recruiter_verified_collaboration",
            "challenge_id": str(application.challenge_id),
            "project_application_id": str(application.id),
            "recruiter_id": str(recruiter_id),
            "completed_at": now.isoformat(),
            "skill_outcomes": feedback_rows,
        },
        extraction_status=ExtractionStatus.extracted,
    )
    session.add(evidence)
    await session.flush()
    for row in feedback_rows:
        skill_id = UUID(str(row["skill_id"]))
        rating = int(row["rating"])
        session.add(StudentSkill(
            student_id=application.student_id,
            skill_id=skill_id,
            source_evidence_id=evidence.id,
            extraction_confidence=Decimal(rating) / Decimal(5),
            verification_tier=VerificationTier.verified,
            proficiency_hint=f"recruiter_rating_{rating}_of_5",
            evidence_span=str(row["observed_outcome"])[:500],
        ))
    application.status = "completed"
    application.completed_at = now
    application.completion_evidence_id = evidence.id
    application.outcome_metadata = {**application.outcome_metadata, "outcome_summary": outcome_summary}
    await session.commit()
    return await get_owned_application(session, recruiter_id, application_id)


async def _invitation_response(
    session: AsyncSession, invitation: FacultyInvitation
) -> FacultyInvitationResponse:
    recruiter = await session.get(Recruiter, invitation.recruiter_id)
    academician = await session.get(Academician, invitation.academician_id)
    opportunity = await session.get(FacultyOpportunity, invitation.faculty_opportunity_id) if invitation.faculty_opportunity_id else None
    workspace = await session.get(CollaborationWorkspace, invitation.collaboration_workspace_id) if invitation.collaboration_workspace_id else None
    if recruiter is None or academician is None:
        raise CollaborationNotFoundError("Invitation principal not found")
    return FacultyInvitationResponse(
        id=invitation.id, recruiter_id=recruiter.id,
        recruiter_company=recruiter.company_name, academician_id=academician.id,
        academician_name=academician.full_name,
        faculty_opportunity_id=invitation.faculty_opportunity_id,
        opportunity_title=opportunity.title if opportunity else None,
        collaboration_workspace_id=invitation.collaboration_workspace_id,
        workspace_title=workspace.title if workspace else None,
        status=invitation.status, message=invitation.message,
        created_at=invitation.created_at, responded_at=invitation.responded_at,
    )


async def create_faculty_invitation(
    session: AsyncSession, recruiter_id: UUID, payload: FacultyInvitationCreate
) -> FacultyInvitationResponse:
    if (payload.faculty_opportunity_id is None) == (payload.collaboration_workspace_id is None):
        raise CollaborationConflictError("Exactly one invitation context is required")
    if await session.get(Academician, payload.academician_id) is None:
        raise CollaborationNotFoundError("Academician not found")
    if payload.faculty_opportunity_id:
        opportunity = await session.get(FacultyOpportunity, payload.faculty_opportunity_id)
        if opportunity is None or opportunity.created_by_recruiter_id != recruiter_id:
            raise CollaborationForbiddenError("Faculty opportunity belongs to another company")
    if payload.collaboration_workspace_id:
        workspace = await session.get(CollaborationWorkspace, payload.collaboration_workspace_id)
        if workspace is None:
            raise CollaborationNotFoundError("Workspace not found")
        owner_id = None
        if workspace.challenge_id:
            challenge = await session.get(InnovationChallenge, workspace.challenge_id)
            owner_id = challenge.recruiter_id if challenge else None
        elif workspace.application_id:
            faculty_app = await session.get(FacultyApplication, workspace.application_id)
            opportunity = await session.get(FacultyOpportunity, faculty_app.opportunity_id) if faculty_app else None
            owner_id = opportunity.created_by_recruiter_id if opportunity else None
        if owner_id != recruiter_id:
            raise CollaborationForbiddenError("Workspace belongs to another company")
    existing = await session.scalar(select(FacultyInvitation).where(
        FacultyInvitation.recruiter_id == recruiter_id,
        FacultyInvitation.academician_id == payload.academician_id,
        FacultyInvitation.faculty_opportunity_id == payload.faculty_opportunity_id,
        FacultyInvitation.collaboration_workspace_id == payload.collaboration_workspace_id,
        FacultyInvitation.status == "pending",
    ))
    if existing:
        raise CollaborationConflictError("A pending invitation already exists")
    invitation = FacultyInvitation(recruiter_id=recruiter_id, **payload.model_dump())
    session.add(invitation)
    await session.flush()
    session.add(FacultyNotification(
        faculty_id=payload.academician_id,
        title="Industry collaboration invitation",
        message=payload.message,
        category="workspace" if payload.collaboration_workspace_id else "application",
    ))
    await session.commit()
    await session.refresh(invitation)
    return await _invitation_response(session, invitation)


async def list_faculty_invitations(
    session: AsyncSession, academician_id: UUID
) -> list[FacultyInvitationResponse]:
    rows = (await session.scalars(select(FacultyInvitation).where(
        FacultyInvitation.academician_id == academician_id
    ).order_by(FacultyInvitation.created_at.desc()))).all()
    return [await _invitation_response(session, row) for row in rows]


async def list_recruiter_invitations(
    session: AsyncSession, recruiter_id: UUID
) -> list[FacultyInvitationResponse]:
    rows = (await session.scalars(select(FacultyInvitation).where(
        FacultyInvitation.recruiter_id == recruiter_id
    ).order_by(FacultyInvitation.created_at.desc()))).all()
    return [await _invitation_response(session, row) for row in rows]


async def respond_to_invitation(
    session: AsyncSession, academician_id: UUID, invitation_id: UUID, status: str
) -> FacultyInvitationResponse:
    invitation = await session.get(FacultyInvitation, invitation_id)
    if invitation is None:
        raise CollaborationNotFoundError("Invitation not found")
    if invitation.academician_id != academician_id:
        raise CollaborationForbiddenError("Invitation belongs to another academician")
    if invitation.status != "pending" or status not in {"accepted", "declined"}:
        raise CollaborationConflictError("Invitation cannot be updated")
    invitation.status = status
    invitation.responded_at = datetime.now(UTC)
    if status == "accepted" and invitation.faculty_opportunity_id is not None:
        existing_application = await session.scalar(
            select(FacultyApplication).where(
                FacultyApplication.faculty_id == academician_id,
                FacultyApplication.opportunity_id == invitation.faculty_opportunity_id,
            )
        )
        if existing_application is None:
            opportunity = await session.get(
                FacultyOpportunity, invitation.faculty_opportunity_id
            )
            session.add(
                FacultyApplication(
                    faculty_id=academician_id,
                    opportunity_id=invitation.faculty_opportunity_id,
                    status="accepted",
                    application_type="recruiter_invitation",
                    proposal_title=(
                        f"Invited collaboration: {opportunity.title}"
                        if opportunity is not None
                        else "Invited industry collaboration"
                    ),
                    feedback="Accepted through a governed recruiter invitation.",
                )
            )
    if status == "accepted" and invitation.collaboration_workspace_id is not None:
        workspace = await session.get(
            CollaborationWorkspace, invitation.collaboration_workspace_id
        )
        if workspace is not None:
            workspace.faculty_lead_id = academician_id
    await session.commit()
    await session.refresh(invitation)
    return await _invitation_response(session, invitation)


async def revoke_invitation(
    session: AsyncSession, recruiter_id: UUID, invitation_id: UUID
) -> FacultyInvitationResponse:
    invitation = await session.get(FacultyInvitation, invitation_id)
    if invitation is None:
        raise CollaborationNotFoundError("Invitation not found")
    if invitation.recruiter_id != recruiter_id:
        raise CollaborationForbiddenError("Invitation belongs to another recruiter")
    if invitation.status != "pending":
        raise CollaborationConflictError("Only pending invitations may be revoked")
    invitation.status = "revoked"
    invitation.responded_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(invitation)
    return await _invitation_response(session, invitation)
