"""Academician / Faculty Ecosystem Service.

Full Phase 1 and Phase 2 Lifecycle Management:
- Faculty Professional & Academic Passport
- Opportunity Discovery & Deep Details
- Applications & Proposals (Draft, Submit, Review, Withdraw, History)
- Dedicated Faculty Internships, Industrial Training, FDPs
- R&D and Consultancy Proposal Workflows
- Collaboration Workspaces (Milestones, Tasks, Deliverables, Discussions, Meetings)
- Industry Mentorship and Event / Workshop Participation
- Live Industry Projects with Faculty Advisor
- Verifiable Outcomes, Completion Records, and History
- Industry Review & Recruiter Collaboration
"""
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID
import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Academician,
    CollaborationWorkspace,
    FacultyApplication,
    FacultyEventRegistration,
    FacultyNotification,
    FacultyOpportunity,
    FacultyVideo,
    InnovationChallenge,
    ProjectApplication,
)
from app.schemas.contracts import (
    CollaborationWorkspaceResponse,
    FacultyAdvisedProjectResponse,
    FacultyApplicationRequest,
    FacultyApplicationResponse,
    FacultyApplicationStatusUpdateRequest,
    FacultyApplicationUpdateRequest,
    FacultyCollaborationHistoryItem,
    FacultyEventRegistrationCreate,
    FacultyEventRegistrationResponse,
    FacultyNotificationResponse,
    FacultyOpportunityResponse,
    FacultyPassportResponse,
    FacultyPassportUpdateRequest,
    FacultyProjectFeedbackRequest,
    FacultyVideoCreate,
    FacultyVideoListResponse,
    FacultyVideoResponse,
    FacultyVideoUpdate,
    WorkspaceDeliverableSubmit,
    WorkspaceDiscussionPostCreate,
    WorkspaceFeedbackSubmit,
    WorkspaceMilestoneUpdate,
    WorkspaceTaskCreate,
    WorkspaceTaskUpdate,
)

# ============================================================================
# 1. Faculty Passport
# ============================================================================

async def get_faculty_passport(
    session: AsyncSession,
    faculty_id: UUID,
) -> FacultyPassportResponse:
    faculty = await session.get(Academician, faculty_id)
    if not faculty:
        raise ValueError("Faculty member not found")

    # Count active & completed collaborations
    workspaces = (
        await session.scalars(
            select(CollaborationWorkspace).where(
                CollaborationWorkspace.faculty_lead_id == faculty_id
            )
        )
    ).all()

    active_count = sum(1 for w in workspaces if w.status == "active")
    completed_count = sum(1 for w in workspaces if w.status == "completed")

    # Sum total grants from accepted applications / opportunities
    apps = (
        await session.scalars(
            select(FacultyApplication)
            .where(
                FacultyApplication.faculty_id == faculty_id,
                FacultyApplication.status.in_(["accepted", "active", "completed"]),
            )
            .options(selectinload(FacultyApplication.opportunity))
        )
    ).all()

    total_grants: float = 0.0
    for a in apps:
        if a.opportunity and a.opportunity.stipend_or_grant:
            total_grants += float(a.opportunity.stipend_or_grant)

    return FacultyPassportResponse(
        id=faculty.id,
        email=faculty.email,
        full_name=faculty.full_name,
        institution_name=faculty.institution_name,
        department=faculty.department,
        designation=faculty.designation,
        research_areas=faculty.research_areas or [],
        bio=faculty.bio,
        years_experience=faculty.years_experience or 0,
        technical_skills=faculty.technical_skills or [],
        certifications=faculty.certifications or [],
        publications=faculty.publications or [],
        patents=faculty.patents or [],
        past_industry_experience=faculty.past_industry_experience or [],
        completed_fdps=faculty.completed_fdps or [],
        completed_trainings=faculty.completed_trainings or [],
        collaboration_availability=faculty.collaboration_availability or "available",
        phone=faculty.phone,
        linkedin_url=faculty.linkedin_url,
        google_scholar_url=faculty.google_scholar_url,
        active_collaborations_count=active_count,
        completed_collaborations_count=completed_count,
        total_grants_secured=total_grants,
    )


async def update_faculty_passport(
    session: AsyncSession,
    faculty_id: UUID,
    payload: FacultyPassportUpdateRequest,
) -> FacultyPassportResponse:
    faculty = await session.get(Academician, faculty_id)
    if not faculty:
        raise ValueError("Faculty member not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(faculty, key) and value is not None:
            setattr(faculty, key, value)

    await session.commit()
    await session.refresh(faculty)
    return await get_faculty_passport(session, faculty_id)


# ============================================================================
# 2. Opportunities (List & Single Detail)
# ============================================================================

def _to_opportunity_response(
    opp: FacultyOpportunity,
    app: FacultyApplication | None = None,
) -> FacultyOpportunityResponse:
    return FacultyOpportunityResponse(
        id=opp.id,
        title=opp.title,
        opportunity_type=opp.opportunity_type,
        organization_name=opp.organization_name,
        description=opp.description,
        domain=opp.domain,
        stipend_or_grant=float(opp.stipend_or_grant) if opp.stipend_or_grant else None,
        duration_weeks=opp.duration_weeks,
        deadline=opp.deadline,
        status=opp.status,
        objectives=opp.objectives or [],
        mode=opp.mode or "hybrid",
        location=opp.location,
        eligibility=opp.eligibility,
        required_expertise=opp.required_expertise or [],
        deliverables=opp.deliverables or [],
        required_documents=opp.required_documents or [],
        contact_email=opp.contact_email,
        contact_person=opp.contact_person,
        has_applied=app is not None,
        application_status=app.status if app else None,
        application_id=app.id if app else None,
    )


async def list_faculty_opportunities(
    session: AsyncSession,
    faculty_id: UUID | None = None,
    opportunity_type: str | None = None,
) -> list[FacultyOpportunityResponse]:
    stmt = select(FacultyOpportunity).order_by(FacultyOpportunity.created_at.desc())
    if opportunity_type and opportunity_type != "all":
        stmt = stmt.where(FacultyOpportunity.opportunity_type == opportunity_type)

    opportunities = (await session.scalars(stmt)).all()

    app_map: dict[UUID, FacultyApplication] = {}
    if faculty_id:
        apps = (
            await session.scalars(
                select(FacultyApplication).where(FacultyApplication.faculty_id == faculty_id)
            )
        ).all()
        app_map = {a.opportunity_id: a for a in apps}

    return [_to_opportunity_response(opp, app_map.get(opp.id)) for opp in opportunities]


async def get_faculty_opportunity_detail(
    session: AsyncSession,
    opportunity_id: UUID,
    faculty_id: UUID | None = None,
) -> FacultyOpportunityResponse:
    opp = await session.get(FacultyOpportunity, opportunity_id)
    if not opp:
        raise ValueError("Opportunity not found")

    app = None
    if faculty_id:
        app = (
            await session.scalars(
                select(FacultyApplication).where(
                    FacultyApplication.faculty_id == faculty_id,
                    FacultyApplication.opportunity_id == opportunity_id,
                )
            )
        ).first()

    return _to_opportunity_response(opp, app)


# ============================================================================
# 3. Application & Proposal Lifecycle
# ============================================================================

def _to_application_response(
    app: FacultyApplication,
    workspace_id: UUID | None = None,
) -> FacultyApplicationResponse:
    return FacultyApplicationResponse(
        id=app.id,
        opportunity_id=app.opportunity_id,
        opportunity_title=app.opportunity.title if app.opportunity else "Faculty Opportunity",
        organization_name=app.opportunity.organization_name if app.opportunity else "Organization",
        opportunity_type=app.opportunity.opportunity_type if app.opportunity else app.application_type,
        status=app.status,
        application_type=app.application_type,
        proposal_title=app.proposal_title,
        proposal_text=app.proposal_text,
        problem_statement=app.problem_statement,
        objectives=app.objectives or [],
        methodology=app.methodology,
        team_members=app.team_members or [],
        student_researchers=app.student_researchers or [],
        deliverables=app.deliverables or [],
        milestones=app.milestones or [],
        timeline_weeks=app.timeline_weeks,
        budget_requested=float(app.budget_requested) if app.budget_requested else None,
        industry_support_required=app.industry_support_required,
        attachments=app.attachments or [],
        reviewer_notes=app.reviewer_notes,
        feedback=app.feedback,
        industry_mentor_name=app.industry_mentor_name,
        industry_mentor_email=app.industry_mentor_email,
        engagement_status=app.engagement_status or "not_started",
        start_date=app.start_date,
        end_date=app.end_date,
        completion_report=app.completion_report,
        completion_certificate_url=app.completion_certificate_url,
        rating_or_grade=app.rating_or_grade,
        outcome_type=app.outcome_type,
        outcome_details=app.outcome_details or {},
        applied_at=app.applied_at,
        updated_at=app.updated_at,
        workspace_id=workspace_id,
        faculty_name=app.faculty.full_name if app.faculty else None,
        faculty_department=app.faculty.department if app.faculty else None,
        faculty_institution=app.faculty.institution_name if app.faculty else None,
    )


async def list_faculty_applications(
    session: AsyncSession,
    faculty_id: UUID,
    status_filter: str | None = None,
) -> list[FacultyApplicationResponse]:
    stmt = (
        select(FacultyApplication)
        .where(FacultyApplication.faculty_id == faculty_id)
        .options(
            selectinload(FacultyApplication.opportunity),
            selectinload(FacultyApplication.faculty),
        )
        .order_by(FacultyApplication.applied_at.desc())
    )
    if status_filter:
        stmt = stmt.where(FacultyApplication.status == status_filter)

    apps = (await session.scalars(stmt)).all()

    # Find associated workspaces
    app_ids = [a.id for a in apps]
    workspace_map: dict[UUID, UUID] = {}
    if app_ids:
        workspaces = (
            await session.scalars(
                select(CollaborationWorkspace).where(
                    CollaborationWorkspace.application_id.in_(app_ids)
                )
            )
        ).all()
        workspace_map = {w.application_id: w.id for w in workspaces if w.application_id}

    return [_to_application_response(a, workspace_map.get(a.id)) for a in apps]


async def get_faculty_application(
    session: AsyncSession,
    application_id: UUID,
    faculty_id: UUID,
) -> FacultyApplicationResponse:
    app = (
        await session.scalars(
            select(FacultyApplication)
            .where(
                FacultyApplication.id == application_id,
                FacultyApplication.faculty_id == faculty_id,
            )
            .options(
                selectinload(FacultyApplication.opportunity),
                selectinload(FacultyApplication.faculty),
            )
        )
    ).first()
    if not app:
        raise ValueError("Application not found")

    workspace = (
        await session.scalars(
            select(CollaborationWorkspace).where(
                CollaborationWorkspace.application_id == application_id
            )
        )
    ).first()

    return _to_application_response(app, workspace.id if workspace else None)


async def create_or_save_faculty_application(
    session: AsyncSession,
    faculty_id: UUID,
    payload: FacultyApplicationRequest,
) -> FacultyApplicationResponse:
    opp = await session.get(FacultyOpportunity, payload.opportunity_id)
    if not opp:
        raise ValueError("Opportunity not found")

    existing = (
        await session.scalars(
            select(FacultyApplication)
            .where(
                FacultyApplication.faculty_id == faculty_id,
                FacultyApplication.opportunity_id == opp.id,
            )
            .options(
                selectinload(FacultyApplication.opportunity),
                selectinload(FacultyApplication.faculty),
            )
        )
    ).first()

    status = "draft" if payload.is_draft else "submitted"

    if existing:
        existing.status = status
        existing.proposal_text = payload.proposal_text or existing.proposal_text
        existing.proposal_title = payload.proposal_title or existing.proposal_title
        existing.application_type = payload.application_type or existing.application_type
        existing.problem_statement = payload.problem_statement or existing.problem_statement
        existing.objectives = payload.objectives or existing.objectives
        existing.methodology = payload.methodology or existing.methodology
        existing.team_members = payload.team_members or existing.team_members
        existing.student_researchers = payload.student_researchers or existing.student_researchers
        existing.deliverables = payload.deliverables or existing.deliverables
        existing.milestones = payload.milestones or existing.milestones
        existing.timeline_weeks = payload.timeline_weeks or existing.timeline_weeks
        existing.budget_requested = payload.budget_requested or existing.budget_requested
        existing.industry_support_required = payload.industry_support_required or existing.industry_support_required
        existing.attachments = payload.attachments or existing.attachments
        await session.commit()
        await session.refresh(existing)
        return _to_application_response(existing)

    app = FacultyApplication(
        faculty_id=faculty_id,
        opportunity_id=opp.id,
        status=status,
        application_type=payload.application_type or opp.opportunity_type,
        proposal_title=payload.proposal_title or f"Proposal for {opp.title}",
        proposal_text=payload.proposal_text,
        problem_statement=payload.problem_statement,
        objectives=payload.objectives or opp.objectives or [],
        methodology=payload.methodology,
        team_members=payload.team_members or [],
        student_researchers=payload.student_researchers or [],
        deliverables=payload.deliverables or opp.deliverables or [],
        milestones=payload.milestones or [
            {"id": "m1", "title": "Inception & Scope Finalization", "status": "pending", "due_week": 1},
            {"id": "m2", "title": "Intermediate Deliverable & Review", "status": "pending", "due_week": 2},
            {"id": "m3", "title": "Final Outcome & Technical Report", "status": "pending", "due_week": 4},
        ],
        timeline_weeks=payload.timeline_weeks or opp.duration_weeks,
        budget_requested=payload.budget_requested or (float(opp.stipend_or_grant) if opp.stipend_or_grant else None),
        industry_support_required=payload.industry_support_required,
        attachments=payload.attachments or [],
    )
    session.add(app)
    await session.commit()

    # Create notification for faculty
    notification = FacultyNotification(
        faculty_id=faculty_id,
        title=f"Application {status.capitalize()}",
        message=f"Your {app.application_type.replace('_', ' ')} for '{opp.title}' has been {status}.",
        category="application",
    )
    session.add(notification)
    await session.commit()

    reloaded = (
        await session.scalars(
            select(FacultyApplication)
            .where(FacultyApplication.id == app.id)
            .options(
                selectinload(FacultyApplication.opportunity),
                selectinload(FacultyApplication.faculty),
            )
        )
    ).first()

    return _to_application_response(reloaded or app)


async def update_faculty_application(
    session: AsyncSession,
    application_id: UUID,
    faculty_id: UUID,
    payload: FacultyApplicationUpdateRequest,
) -> FacultyApplicationResponse:
    app = (
        await session.scalars(
            select(FacultyApplication)
            .where(
                FacultyApplication.id == application_id,
                FacultyApplication.faculty_id == faculty_id,
            )
            .options(
                selectinload(FacultyApplication.opportunity),
                selectinload(FacultyApplication.faculty),
            )
        )
    ).first()
    if not app:
        raise ValueError("Application not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(app, key) and value is not None:
            setattr(app, key, value)

    await session.commit()
    await session.refresh(app)
    return _to_application_response(app)


async def submit_faculty_application(
    session: AsyncSession,
    application_id: UUID,
    faculty_id: UUID,
) -> FacultyApplicationResponse:
    app = (
        await session.scalars(
            select(FacultyApplication)
            .where(
                FacultyApplication.id == application_id,
                FacultyApplication.faculty_id == faculty_id,
            )
            .options(
                selectinload(FacultyApplication.opportunity),
                selectinload(FacultyApplication.faculty),
            )
        )
    ).first()
    if not app:
        raise ValueError("Application not found")

    app.status = "submitted"
    await session.commit()
    await session.refresh(app)

    # Notification
    session.add(
        FacultyNotification(
            faculty_id=faculty_id,
            title="Proposal Submitted Successfully",
            message=f"Your proposal for '{app.opportunity.title if app.opportunity else 'opportunity'}' is now under industry review.",
            category="application",
        )
    )
    await session.commit()

    return _to_application_response(app)


async def withdraw_faculty_application(
    session: AsyncSession,
    application_id: UUID,
    faculty_id: UUID,
) -> FacultyApplicationResponse:
    app = (
        await session.scalars(
            select(FacultyApplication)
            .where(
                FacultyApplication.id == application_id,
                FacultyApplication.faculty_id == faculty_id,
            )
            .options(
                selectinload(FacultyApplication.opportunity),
                selectinload(FacultyApplication.faculty),
            )
        )
    ).first()
    if not app:
        raise ValueError("Application not found")

    if app.status in ["accepted", "active", "completed"]:
        raise ValueError("Cannot withdraw an application that is already accepted or active.")

    app.status = "withdrawn"
    await session.commit()
    await session.refresh(app)
    return _to_application_response(app)


# ============================================================================
# 4. Collaboration Workspaces (Phase 2)
# ============================================================================

def _to_workspace_response(
    ws: CollaborationWorkspace,
) -> CollaborationWorkspaceResponse:
    return CollaborationWorkspaceResponse(
        id=ws.id,
        application_id=ws.application_id,
        challenge_id=ws.challenge_id,
        title=ws.title,
        collaboration_type=ws.collaboration_type,
        organization_name=ws.organization_name,
        faculty_lead_id=ws.faculty_lead_id,
        faculty_lead_name=ws.faculty_lead.full_name if ws.faculty_lead else None,
        faculty_lead_department=ws.faculty_lead.department if ws.faculty_lead else None,
        industry_lead_name=ws.industry_lead_name,
        industry_lead_email=ws.industry_lead_email,
        status=ws.status,
        progress_percentage=ws.progress_percentage or 0,
        objectives=ws.objectives or [],
        participants=ws.participants or [],
        milestones=ws.milestones or [],
        tasks=ws.tasks or [],
        meetings=ws.meetings or [],
        discussion_posts=ws.discussion_posts or [],
        deliverables=ws.deliverables or [],
        feedback=ws.feedback or [],
        outcome_summary=ws.outcome_summary,
        start_date=ws.start_date,
        end_date=ws.end_date,
        created_at=ws.created_at,
        updated_at=ws.updated_at,
    )


async def create_workspace_for_accepted_application(
    session: AsyncSession,
    app: FacultyApplication,
) -> CollaborationWorkspace:
    existing = (
        await session.scalars(
            select(CollaborationWorkspace).where(
                CollaborationWorkspace.application_id == app.id
            )
        )
    ).first()
    if existing:
        return existing

    opp = app.opportunity or await session.get(FacultyOpportunity, app.opportunity_id)
    faculty = app.faculty or await session.get(Academician, app.faculty_id)

    ws = CollaborationWorkspace(
        application_id=app.id,
        title=app.proposal_title or f"Collaboration: {opp.title if opp else 'Project'}",
        collaboration_type=app.application_type or (opp.opportunity_type if opp else "collaboration"),
        organization_name=opp.organization_name if opp else "Industry Partner",
        faculty_lead_id=app.faculty_id,
        industry_lead_name=app.industry_mentor_name or "Industry Principal Lead",
        industry_lead_email=app.industry_mentor_email or (opp.contact_email if opp else None),
        status="active",
        progress_percentage=20,
        objectives=app.objectives or (opp.objectives if opp else []),
        participants=[
            {
                "id": str(app.faculty_id),
                "name": faculty.full_name if faculty else "Faculty Lead",
                "role": "Faculty Principal Investigator",
                "department": faculty.department if faculty else "",
            },
            {
                "name": app.industry_mentor_name or "Industry Mentor",
                "role": "Industry Technical Director",
                "company": opp.organization_name if opp else "Partner",
            },
        ],
        milestones=app.milestones or [
            {"id": "m1", "title": "Requirements & Kickoff", "status": "completed", "due_date": "Week 1"},
            {"id": "m2", "title": "Architecture & Methodology Review", "status": "in_progress", "due_date": "Week 3"},
            {"id": "m3", "title": "Prototype / Pilot Evaluation", "status": "pending", "due_date": "Week 5"},
            {"id": "m4", "title": "Final Outcome & Transfer", "status": "pending", "due_date": "Week 8"},
        ],
        tasks=[
            {"id": "t1", "title": "Finalize collaboration charter and IP terms", "assigned_to": "Faculty Lead", "status": "done", "priority": "high"},
            {"id": "t2", "title": "Setup development and lab environment", "assigned_to": "Faculty & Team", "status": "in_progress", "priority": "medium"},
            {"id": "t3", "title": "Bi-weekly sync on preliminary results", "assigned_to": "Industry Mentor", "status": "todo", "priority": "medium"},
        ],
        meetings=[
            {"id": "mt1", "title": "Bi-weekly Technical Review", "date": "Every Thursday 3:00 PM IST", "link": "https://meet.google.com/collab-sync"},
        ],
        discussion_posts=[
            {
                "id": "dp1",
                "author_name": app.industry_mentor_name or "Industry Lead",
                "author_role": "industry_mentor",
                "content": "Welcome to the collaborative engagement. Let us align on the sprint deliverables for milestone 2.",
                "created_at": datetime.now(UTC).isoformat(),
            }
        ],
        deliverables=[],
        feedback=[],
        start_date=datetime.now(UTC),
    )
    session.add(ws)
    await session.commit()
    await session.refresh(ws)
    return ws


async def list_faculty_workspaces(
    session: AsyncSession,
    faculty_id: UUID,
) -> list[CollaborationWorkspaceResponse]:
    stmt = (
        select(CollaborationWorkspace)
        .where(CollaborationWorkspace.faculty_lead_id == faculty_id)
        .options(selectinload(CollaborationWorkspace.faculty_lead))
        .order_by(CollaborationWorkspace.created_at.desc())
    )
    workspaces = (await session.scalars(stmt)).all()
    return [_to_workspace_response(ws) for ws in workspaces]


async def get_faculty_workspace(
    session: AsyncSession,
    workspace_id: UUID,
    faculty_id: UUID,
) -> CollaborationWorkspaceResponse:
    ws = (
        await session.scalars(
            select(CollaborationWorkspace)
            .where(
                CollaborationWorkspace.id == workspace_id,
                CollaborationWorkspace.faculty_lead_id == faculty_id,
            )
            .options(selectinload(CollaborationWorkspace.faculty_lead))
        )
    ).first()
    if not ws:
        raise ValueError("Collaboration workspace not found")
    return _to_workspace_response(ws)


async def update_workspace_milestone(
    session: AsyncSession,
    workspace_id: UUID,
    faculty_id: UUID,
    payload: WorkspaceMilestoneUpdate,
) -> CollaborationWorkspaceResponse:
    ws = await session.get(CollaborationWorkspace, workspace_id)
    if not ws or ws.faculty_lead_id != faculty_id:
        raise ValueError("Workspace not found or unauthorized")

    milestones = list(ws.milestones or [])
    found = False
    for m in milestones:
        if m.get("id") == payload.milestone_id:
            m["status"] = payload.status
            if payload.title:
                m["title"] = payload.title
            if payload.due_date:
                m["due_date"] = payload.due_date
            if payload.notes:
                m["notes"] = payload.notes
            found = True
            break

    if not found:
        milestones.append({
            "id": payload.milestone_id,
            "title": payload.title or "Milestone",
            "status": payload.status,
            "due_date": payload.due_date,
            "notes": payload.notes,
        })

    # Recalculate progress
    completed = sum(1 for m in milestones if m.get("status") == "completed")
    ws.progress_percentage = int((completed / max(len(milestones), 1)) * 100)
    ws.milestones = milestones

    await session.commit()
    await session.refresh(ws)
    return _to_workspace_response(ws)


async def add_workspace_task(
    session: AsyncSession,
    workspace_id: UUID,
    faculty_id: UUID,
    payload: WorkspaceTaskCreate,
) -> CollaborationWorkspaceResponse:
    ws = await session.get(CollaborationWorkspace, workspace_id)
    if not ws or ws.faculty_lead_id != faculty_id:
        raise ValueError("Workspace not found or unauthorized")

    tasks = list(ws.tasks or [])
    task_id = f"t_{len(tasks) + 1}_{int(datetime.now(UTC).timestamp())}"
    tasks.append({
        "id": task_id,
        "title": payload.title,
        "assigned_to": payload.assigned_to,
        "due_date": payload.due_date,
        "priority": payload.priority,
        "status": payload.status,
    })
    ws.tasks = tasks

    await session.commit()
    await session.refresh(ws)
    return _to_workspace_response(ws)


async def update_workspace_task_status(
    session: AsyncSession,
    workspace_id: UUID,
    faculty_id: UUID,
    payload: WorkspaceTaskUpdate,
) -> CollaborationWorkspaceResponse:
    ws = await session.get(CollaborationWorkspace, workspace_id)
    if not ws or ws.faculty_lead_id != faculty_id:
        raise ValueError("Workspace not found or unauthorized")

    tasks = list(ws.tasks or [])
    for t in tasks:
        if t.get("id") == payload.task_id:
            t["status"] = payload.status
            break

    ws.tasks = tasks
    await session.commit()
    await session.refresh(ws)
    return _to_workspace_response(ws)


async def add_workspace_discussion(
    session: AsyncSession,
    workspace_id: UUID,
    faculty_id: UUID,
    payload: WorkspaceDiscussionPostCreate,
) -> CollaborationWorkspaceResponse:
    ws = await session.get(CollaborationWorkspace, workspace_id)
    if not ws or ws.faculty_lead_id != faculty_id:
        raise ValueError("Workspace not found or unauthorized")

    posts = list(ws.discussion_posts or [])
    posts.append({
        "id": f"p_{len(posts) + 1}",
        "author_name": payload.author_name,
        "author_role": payload.author_role,
        "content": payload.content,
        "created_at": datetime.now(UTC).isoformat(),
    })
    ws.discussion_posts = posts

    await session.commit()
    await session.refresh(ws)
    return _to_workspace_response(ws)


async def submit_workspace_deliverable(
    session: AsyncSession,
    workspace_id: UUID,
    faculty_id: UUID,
    payload: WorkspaceDeliverableSubmit,
) -> CollaborationWorkspaceResponse:
    ws = await session.get(CollaborationWorkspace, workspace_id)
    if not ws or ws.faculty_lead_id != faculty_id:
        raise ValueError("Workspace not found or unauthorized")

    deliverables = list(ws.deliverables or [])
    deliverables.append({
        "id": f"d_{len(deliverables) + 1}",
        "title": payload.title,
        "deliverable_type": payload.deliverable_type,
        "url_or_key": payload.url_or_key,
        "notes": payload.notes,
        "submitted_at": datetime.now(UTC).isoformat(),
    })
    ws.deliverables = deliverables

    await session.commit()
    await session.refresh(ws)
    return _to_workspace_response(ws)


async def submit_workspace_feedback(
    session: AsyncSession,
    workspace_id: UUID,
    faculty_id: UUID,
    payload: WorkspaceFeedbackSubmit,
) -> CollaborationWorkspaceResponse:
    ws = await session.get(CollaborationWorkspace, workspace_id)
    if not ws or ws.faculty_lead_id != faculty_id:
        raise ValueError("Workspace not found or unauthorized")

    feedback_list = list(ws.feedback or [])
    feedback_list.append({
        "author_name": payload.author_name,
        "author_role": payload.author_role,
        "rating": payload.rating,
        "comments": payload.comments,
        "created_at": datetime.now(UTC).isoformat(),
    })
    ws.feedback = feedback_list

    await session.commit()
    await session.refresh(ws)
    return _to_workspace_response(ws)


async def complete_workspace(
    session: AsyncSession,
    workspace_id: UUID,
    faculty_id: UUID,
    outcome_summary: str | None = None,
) -> CollaborationWorkspaceResponse:
    ws = await session.get(CollaborationWorkspace, workspace_id)
    if not ws or ws.faculty_lead_id != faculty_id:
        raise ValueError("Workspace not found or unauthorized")

    ws.status = "completed"
    ws.progress_percentage = 100
    ws.outcome_summary = outcome_summary or "Collaboration engagement completed successfully with all milestone deliverables verified."
    ws.end_date = datetime.now(UTC)

    # Sync back to application
    if ws.application_id:
        app = await session.get(FacultyApplication, ws.application_id)
        if app:
            app.status = "completed"
            app.engagement_status = "completed"
            app.completion_report = ws.outcome_summary
            app.end_date = ws.end_date

    # Create completion notification
    session.add(
        FacultyNotification(
            faculty_id=faculty_id,
            title="Collaboration Completed 🎉",
            message=f"Your collaboration workspace '{ws.title}' has been marked completed.",
            category="workspace",
        )
    )

    await session.commit()
    await session.refresh(ws)
    return _to_workspace_response(ws)


# ============================================================================
# 5. Events & Workshops (Phase 2)
# ============================================================================

async def register_faculty_event(
    session: AsyncSession,
    faculty_id: UUID,
    payload: FacultyEventRegistrationCreate,
) -> FacultyEventRegistrationResponse:
    existing = (
        await session.scalars(
            select(FacultyEventRegistration).where(
                FacultyEventRegistration.faculty_id == faculty_id,
                FacultyEventRegistration.event_id == payload.event_id,
                FacultyEventRegistration.event_type == payload.event_type,
            )
        )
    ).first()

    if existing:
        return FacultyEventRegistrationResponse(
            id=existing.id,
            faculty_id=existing.faculty_id,
            event_id=existing.event_id,
            event_type=existing.event_type,
            event_title=existing.event_title,
            host_organization=existing.host_organization,
            role=existing.role,
            status=existing.status,
            feedback=existing.feedback,
            certificate_url=existing.certificate_url,
            scheduled_at=existing.scheduled_at,
            registered_at=existing.registered_at,
        )

    reg = FacultyEventRegistration(
        faculty_id=faculty_id,
        event_id=payload.event_id,
        event_type=payload.event_type,
        event_title=payload.event_title,
        host_organization=payload.host_organization,
        role=payload.role,
        scheduled_at=payload.scheduled_at,
        status="registered",
    )
    session.add(reg)
    await session.commit()
    await session.refresh(reg)

    session.add(
        FacultyNotification(
            faculty_id=faculty_id,
            title="Event Registration Confirmed",
            message=f"You are registered as {payload.role} for '{payload.event_title}'.",
            category="event",
        )
    )
    await session.commit()

    return FacultyEventRegistrationResponse(
        id=reg.id,
        faculty_id=reg.faculty_id,
        event_id=reg.event_id,
        event_type=reg.event_type,
        event_title=reg.event_title,
        host_organization=reg.host_organization,
        role=reg.role,
        status=reg.status,
        feedback=reg.feedback,
        certificate_url=reg.certificate_url,
        scheduled_at=reg.scheduled_at,
        registered_at=reg.registered_at,
    )


async def list_faculty_events(
    session: AsyncSession,
    faculty_id: UUID,
) -> list[FacultyEventRegistrationResponse]:
    stmt = (
        select(FacultyEventRegistration)
        .where(FacultyEventRegistration.faculty_id == faculty_id)
        .order_by(FacultyEventRegistration.registered_at.desc())
    )
    regs = (await session.scalars(stmt)).all()
    return [
        FacultyEventRegistrationResponse(
            id=r.id,
            faculty_id=r.faculty_id,
            event_id=r.event_id,
            event_type=r.event_type,
            event_title=r.event_title,
            host_organization=r.host_organization,
            role=r.role,
            status=r.status,
            feedback=r.feedback,
            certificate_url=r.certificate_url,
            scheduled_at=r.scheduled_at,
            registered_at=r.registered_at,
        )
        for r in regs
    ]


# ============================================================================
# 6. Notifications (Phase 1 & 2)
# ============================================================================

async def list_faculty_notifications(
    session: AsyncSession,
    faculty_id: UUID,
) -> list[FacultyNotificationResponse]:
    stmt = (
        select(FacultyNotification)
        .where(FacultyNotification.faculty_id == faculty_id)
        .order_by(FacultyNotification.created_at.desc())
        .limit(30)
    )
    notifs = (await session.scalars(stmt)).all()
    return [
        FacultyNotificationResponse(
            id=n.id,
            faculty_id=n.faculty_id,
            title=n.title,
            message=n.message,
            category=n.category,
            is_read=n.is_read,
            link_url=n.link_url,
            created_at=n.created_at,
        )
        for n in notifs
    ]


async def mark_notification_read(
    session: AsyncSession,
    notification_id: UUID,
    faculty_id: UUID,
) -> None:
    notif = await session.get(FacultyNotification, notification_id)
    if notif and notif.faculty_id == faculty_id:
        notif.is_read = True
        await session.commit()


# ============================================================================
# 7. Collaboration History (Phase 2)
# ============================================================================

async def get_faculty_collaboration_history(
    session: AsyncSession,
    faculty_id: UUID,
) -> list[FacultyCollaborationHistoryItem]:
    # Aggregate from completed workspaces, accepted applications, and completed event registrations
    items: list[FacultyCollaborationHistoryItem] = []

    # Completed workspaces
    workspaces = (
        await session.scalars(
            select(CollaborationWorkspace).where(
                CollaborationWorkspace.faculty_lead_id == faculty_id,
                CollaborationWorkspace.status == "completed",
            )
        )
    ).all()
    for w in workspaces:
        items.append(
            FacultyCollaborationHistoryItem(
                id=w.id,
                title=w.title,
                collaboration_type=w.collaboration_type,
                organization_name=w.organization_name,
                role="Faculty Principal Investigator",
                start_date=w.start_date,
                end_date=w.end_date,
                status="completed",
                outcome_summary=w.outcome_summary,
                outcome_type="research_report",
            )
        )

    # Completed applications / programs
    apps = (
        await session.scalars(
            select(FacultyApplication)
            .where(
                FacultyApplication.faculty_id == faculty_id,
                FacultyApplication.status.in_(["completed", "accepted", "active"]),
            )
            .options(selectinload(FacultyApplication.opportunity))
        )
    ).all()
    for a in apps:
        if a.opportunity:
            items.append(
                FacultyCollaborationHistoryItem(
                    id=a.id,
                    title=a.proposal_title or a.opportunity.title,
                    collaboration_type=a.application_type or a.opportunity.opportunity_type,
                    organization_name=a.opportunity.organization_name,
                    role="Faculty Fellow / Lead",
                    duration_weeks=a.timeline_weeks or a.opportunity.duration_weeks,
                    start_date=a.start_date,
                    end_date=a.end_date,
                    status=a.status,
                    outcome_summary=a.completion_report or a.feedback,
                    outcome_type=a.outcome_type or "certificate",
                    certificate_url=a.completion_certificate_url,
                    stipend_or_grant=float(a.budget_requested or a.opportunity.stipend_or_grant or 0.0),
                )
            )

    # Event participation
    events = (
        await session.scalars(
            select(FacultyEventRegistration).where(
                FacultyEventRegistration.faculty_id == faculty_id,
            )
        )
    ).all()
    for e in events:
        items.append(
            FacultyCollaborationHistoryItem(
                id=e.id,
                title=e.event_title,
                collaboration_type=e.event_type,
                organization_name=e.host_organization,
                role=f"Faculty {e.role.capitalize()}",
                start_date=e.scheduled_at,
                end_date=e.scheduled_at,
                status=e.status,
                outcome_summary=e.feedback or "Attended technical event and session.",
                certificate_url=e.certificate_url,
            )
        )

    return items


# ============================================================================
# 8. Live Project Advising (Phase 2)
# ============================================================================

async def list_advised_projects(
    session: AsyncSession,
    faculty_id: UUID,
) -> list[FacultyAdvisedProjectResponse]:
    # Return live industry challenges with student applications
    challenges = (
        await session.scalars(
            select(InnovationChallenge).where(
                InnovationChallenge.challenge_type.in_(["live_industry_project", "hackathon"])
            )
        )
    ).all()

    c_ids = [c.id for c in challenges]
    student_apps = (
        await session.scalars(
            select(ProjectApplication).where(ProjectApplication.challenge_id.in_(c_ids))
        )
    ).all()

    app_by_challenge: dict[UUID, list[ProjectApplication]] = {}
    for sa in student_apps:
        app_by_challenge.setdefault(sa.challenge_id, []).append(sa)

    results: list[FacultyAdvisedProjectResponse] = []
    for c in challenges:
        teams = [
            {
                "id": str(sa.id),
                "student_id": str(sa.student_id),
                "team_members": sa.team_members,
                "status": sa.status,
                "submission_url": sa.submission_url,
                "feedback": sa.feedback,
                "score_or_grade": sa.score_or_grade,
            }
            for sa in app_by_challenge.get(c.id, [])
        ]
        results.append(
            FacultyAdvisedProjectResponse(
                challenge_id=c.id,
                title=c.title,
                host_company=c.host_company,
                problem_statement=c.problem_statement,
                duration_weeks=c.duration_weeks,
                milestones=c.milestones or [],
                student_teams=teams,
                advisor_feedback=[],
                status=c.status,
            )
        )
    return results


async def submit_project_advising_feedback(
    session: AsyncSession,
    faculty_id: UUID,
    payload: FacultyProjectFeedbackRequest,
) -> None:
    app = await session.get(ProjectApplication, payload.project_application_id)
    if not app:
        raise ValueError("Project application not found")

    faculty = await session.get(Academician, faculty_id)
    advisor_name = faculty.full_name if faculty else "Faculty Advisor"

    app.feedback = f"[Academic Advisor Feedback by {advisor_name}]: {payload.feedback}"
    if payload.grade_or_endorsement:
        app.score_or_grade = payload.grade_or_endorsement

    await session.commit()


# ============================================================================
# 9. Recruiter / Industry Review Workflows (Phase 2)
# ============================================================================

async def list_recruiter_faculty_applications(
    session: AsyncSession,
    recruiter_id: UUID | None = None,
) -> list[FacultyApplicationResponse]:
    stmt = (
        select(FacultyApplication)
        .options(
            selectinload(FacultyApplication.opportunity),
            selectinload(FacultyApplication.faculty),
        )
        .order_by(FacultyApplication.applied_at.desc())
    )
    apps = (await session.scalars(stmt)).all()
    return [_to_application_response(a) for a in apps]


async def update_faculty_application_status_recruiter(
    session: AsyncSession,
    application_id: UUID,
    payload: FacultyApplicationStatusUpdateRequest,
) -> FacultyApplicationResponse:
    app = (
        await session.scalars(
            select(FacultyApplication)
            .where(FacultyApplication.id == application_id)
            .options(
                selectinload(FacultyApplication.opportunity),
                selectinload(FacultyApplication.faculty),
            )
        )
    ).first()
    if not app:
        raise ValueError("Faculty application not found")

    app.status = payload.status
    if payload.reviewer_notes:
        app.reviewer_notes = payload.reviewer_notes
    if payload.feedback:
        app.feedback = payload.feedback
    if payload.industry_mentor_name:
        app.industry_mentor_name = payload.industry_mentor_name
    if payload.industry_mentor_email:
        app.industry_mentor_email = payload.industry_mentor_email

    workspace_id = None
    # Automatically spawn collaboration workspace on acceptance
    if payload.status in ["accepted", "active"]:
        ws = await create_workspace_for_accepted_application(session, app)
        workspace_id = ws.id
        app.engagement_status = "active"

    # Notification
    session.add(
        FacultyNotification(
            faculty_id=app.faculty_id,
            title=f"Application Update: {payload.status.replace('_', ' ').capitalize()}",
            message=f"Your proposal for '{app.opportunity.title if app.opportunity else 'opportunity'}' is now {payload.status}.",
            category="application",
        )
    )

    await session.commit()
    await session.refresh(app)
    return _to_application_response(app, workspace_id)


# ============================================================================
# 10. Faculty Video Lectures & Masterclasses
# ============================================================================

def _to_faculty_video_response(v: FacultyVideo) -> FacultyVideoResponse:
    return FacultyVideoResponse(
        id=v.id,
        faculty_id=v.faculty_id,
        faculty_name=v.faculty_name,
        faculty_institution=v.faculty_institution,
        faculty_designation=v.faculty_designation,
        title=v.title,
        description=v.description,
        video_url=v.video_url,
        thumbnail_url=v.thumbnail_url,
        duration_minutes=v.duration_minutes,
        subject=v.subject,
        department=v.department,
        skills_covered=v.skills_covered or [],
        notes_markdown=v.notes_markdown,
        views_count=v.views_count,
        is_published=v.is_published,
        created_at=v.created_at,
    )


async def create_faculty_video(
    session: AsyncSession,
    faculty_id: UUID,
    payload: FacultyVideoCreate,
) -> FacultyVideoResponse:
    faculty = await session.get(Academician, faculty_id)
    if not faculty:
        raise ValueError("Faculty account not found")

    video = FacultyVideo(
        faculty_id=faculty.id,
        faculty_name=faculty.full_name,
        faculty_institution=faculty.institution_name,
        faculty_designation=f"{faculty.designation}, {faculty.department}" if faculty.department else faculty.designation,
        title=payload.title,
        description=payload.description,
        video_url=payload.video_url,
        thumbnail_url=payload.thumbnail_url,
        duration_minutes=payload.duration_minutes,
        subject=payload.subject,
        department=payload.department or faculty.department,
        skills_covered=payload.skills_covered,
        notes_markdown=payload.notes_markdown,
        is_published=payload.is_published,
    )
    session.add(video)
    await session.commit()
    await session.refresh(video)
    return _to_faculty_video_response(video)


async def list_faculty_own_videos(
    session: AsyncSession,
    faculty_id: UUID,
) -> list[FacultyVideoResponse]:
    stmt = (
        select(FacultyVideo)
        .where(FacultyVideo.faculty_id == faculty_id)
        .order_by(FacultyVideo.created_at.desc())
    )
    videos = (await session.scalars(stmt)).all()
    return [_to_faculty_video_response(v) for v in videos]


async def delete_faculty_video(
    session: AsyncSession,
    faculty_id: UUID,
    video_id: UUID,
) -> None:
    video = await session.get(FacultyVideo, video_id)
    if not video:
        raise ValueError("Video not found")
    if video.faculty_id != faculty_id:
        raise PermissionError("You can only delete your own video lectures")
    await session.delete(video)
    await session.commit()


async def list_faculty_videos_catalog(
    session: AsyncSession,
    faculty_name: str | None = None,
    subject: str | None = None,
    search: str | None = None,
) -> FacultyVideoListResponse:
    stmt = select(FacultyVideo).where(FacultyVideo.is_published == True)  # noqa: E712

    if faculty_name and faculty_name.strip() and faculty_name.lower() != "all":
        stmt = stmt.where(FacultyVideo.faculty_name.ilike(f"%{faculty_name.strip()}%"))

    if subject and subject.strip() and subject.lower() != "all":
        stmt = stmt.where(FacultyVideo.subject.ilike(f"%{subject.strip()}%"))

    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                FacultyVideo.title.ilike(term),
                FacultyVideo.description.ilike(term),
                FacultyVideo.faculty_name.ilike(term),
                FacultyVideo.subject.ilike(term),
            )
        )

    stmt = stmt.order_by(FacultyVideo.created_at.desc())
    videos = (await session.scalars(stmt)).all()

    # Get distinct faculty names and subjects for filtering
    faculty_names_stmt = (
        select(FacultyVideo.faculty_name)
        .where(FacultyVideo.is_published == True)  # noqa: E712
        .distinct()
        .order_by(FacultyVideo.faculty_name)
    )
    faculty_names = list((await session.scalars(faculty_names_stmt)).all())

    subjects_stmt = (
        select(FacultyVideo.subject)
        .where(FacultyVideo.is_published == True)  # noqa: E712
        .distinct()
        .order_by(FacultyVideo.subject)
    )
    subjects = list((await session.scalars(subjects_stmt)).all())

    return FacultyVideoListResponse(
        total=len(videos),
        items=[_to_faculty_video_response(v) for v in videos],
        faculty_names=faculty_names,
        subjects=subjects,
    )


async def record_video_view(
    session: AsyncSession,
    video_id: UUID,
) -> int:
    video = await session.get(FacultyVideo, video_id)
    if not video:
        raise ValueError("Video not found")
    video.views_count += 1
    await session.commit()
    return video.views_count


async def upload_faculty_video_file(
    session: AsyncSession,
    faculty_id: UUID,
    file_bytes: bytes,
    original_filename: str,
    title: str,
    description: str = "",
    subject: str = "General",
    department: str | None = None,
    duration_minutes: int = 30,
    skills_covered: list[str] | None = None,
    notes_markdown: str | None = None,
) -> FacultyVideoResponse:
    faculty = await session.get(Academician, faculty_id)
    if not faculty:
        raise ValueError("Faculty account not found")

    uploads_dir = Path("/app/uploads/videos") if Path("/app/uploads").exists() else Path("./uploads/videos")
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}_{Path(original_filename).name}"
    file_path = uploads_dir / safe_name
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    video_url = f"/uploads/videos/{safe_name}"

    video = FacultyVideo(
        faculty_id=faculty.id,
        faculty_name=faculty.full_name,
        faculty_institution=faculty.institution_name,
        faculty_designation=f"{faculty.designation}, {faculty.department}" if faculty.department else faculty.designation,
        title=title,
        description=description,
        video_url=video_url,
        thumbnail_url=None,
        duration_minutes=duration_minutes,
        subject=subject,
        department=department or faculty.department,
        skills_covered=skills_covered or [],
        notes_markdown=notes_markdown,
        is_published=True,
    )
    session.add(video)
    await session.commit()
    await session.refresh(video)
    return _to_faculty_video_response(video)


