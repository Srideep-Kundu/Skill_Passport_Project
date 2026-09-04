"""API Router for Academician & Faculty Ecosystem (Passport, Applications, Workspaces, Events, Advising)."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import current_principal, require_role
from app.models import Academician, Recruiter
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
    FacultyProposalCreate,
    FacultyProposalListResponse,
    FacultyProposalResponse,
    FacultyProposalStatusUpdate,
    FacultyVideoCreate,
    FacultyVideoResponse,
    FundingOpportunityListResponse,
    FundingOpportunityResponse,
    FundingRecommendationResponse,
    IndustryExpertListResponse,
    IndustryExpertResponse,
    MarketingKitResponse,
    ProfessionalSocietyListResponse,
    ProfessionalSocietyResponse,
    TrainingOutcomeMetricResponse,
    TrainingOutcomeRecordRequest,
    TrainingProgramCreate,
    TrainingProgramListResponse,
    TrainingProgramResponse,
    TrainingRecommendationListResponse,
    WorkspaceDeliverableSubmit,
    WorkspaceDiscussionPostCreate,
    WorkspaceFeedbackSubmit,
    WorkspaceMilestoneUpdate,
    WorkspaceTaskCreate,
    WorkspaceTaskUpdate,
)
from app.services import (
    academician_service,
    collaboration_funding_service,
    training_planner_service,
)

router = APIRouter(prefix="/academician", tags=["academician"])


# ============================================================================
# 1. Faculty Passport Endpoints
# ============================================================================

@router.get("/passport/me", response_model=FacultyPassportResponse)
async def get_my_passport(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyPassportResponse:
    try:
        return await academician_service.get_faculty_passport(session, faculty.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.put("/passport/me", response_model=FacultyPassportResponse)
async def update_my_passport(
    payload: FacultyPassportUpdateRequest,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyPassportResponse:
    try:
        return await academician_service.update_faculty_passport(session, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/passport/{faculty_id}", response_model=FacultyPassportResponse)
async def get_faculty_public_passport(
    faculty_id: UUID,
    principal: Annotated[Academician | Recruiter, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyPassportResponse:
    try:
        return await academician_service.get_faculty_passport(session, faculty_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


# ============================================================================
# 2. Opportunity Discovery & Details
# ============================================================================

@router.get("/opportunities", response_model=list[FacultyOpportunityResponse])
async def get_opportunities(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    opportunity_type: str | None = Query(default=None),
) -> list[FacultyOpportunityResponse]:
    return await academician_service.list_faculty_opportunities(session, faculty.id, opportunity_type)


@router.get("/opportunities/{opportunity_id}", response_model=FacultyOpportunityResponse)
async def get_opportunity_detail(
    opportunity_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyOpportunityResponse:
    try:
        return await academician_service.get_faculty_opportunity_detail(session, opportunity_id, faculty.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


# ============================================================================
# 3. Application & Proposal Submission Lifecycle
# ============================================================================

@router.get("/applications/me", response_model=list[FacultyApplicationResponse])
async def get_my_applications(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    status_filter: str | None = Query(default=None, alias="status"),
) -> list[FacultyApplicationResponse]:
    return await academician_service.list_faculty_applications(session, faculty.id, status_filter)


@router.post("/applications", response_model=FacultyApplicationResponse)
async def create_or_save_application(
    payload: FacultyApplicationRequest,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyApplicationResponse:
    try:
        return await academician_service.create_or_save_faculty_application(session, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/apply", response_model=FacultyApplicationResponse)
async def apply_opportunity_legacy(
    payload: FacultyApplicationRequest,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyApplicationResponse:
    """Legacy compatibility endpoint."""
    try:
        return await academician_service.create_or_save_faculty_application(session, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get("/applications/{application_id}", response_model=FacultyApplicationResponse)
async def get_application_detail(
    application_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyApplicationResponse:
    try:
        return await academician_service.get_faculty_application(session, application_id, faculty.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.put("/applications/{application_id}", response_model=FacultyApplicationResponse)
async def update_application(
    application_id: UUID,
    payload: FacultyApplicationUpdateRequest,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyApplicationResponse:
    try:
        return await academician_service.update_faculty_application(session, application_id, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/applications/{application_id}/submit", response_model=FacultyApplicationResponse)
async def submit_application(
    application_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyApplicationResponse:
    try:
        return await academician_service.submit_faculty_application(session, application_id, faculty.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/applications/{application_id}/withdraw", response_model=FacultyApplicationResponse)
async def withdraw_application(
    application_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyApplicationResponse:
    try:
        return await academician_service.withdraw_faculty_application(session, application_id, faculty.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


# ============================================================================
# 4. Collaboration Workspaces (Phase 2)
# ============================================================================

@router.get("/workspaces", response_model=list[CollaborationWorkspaceResponse])
async def get_workspaces(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[CollaborationWorkspaceResponse]:
    return await academician_service.list_faculty_workspaces(session, faculty.id)


@router.get("/workspaces/{workspace_id}", response_model=CollaborationWorkspaceResponse)
async def get_workspace(
    workspace_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CollaborationWorkspaceResponse:
    try:
        return await academician_service.get_faculty_workspace(session, workspace_id, faculty.id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.put("/workspaces/{workspace_id}/milestones", response_model=CollaborationWorkspaceResponse)
async def update_workspace_milestones(
    workspace_id: UUID,
    payload: WorkspaceMilestoneUpdate,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CollaborationWorkspaceResponse:
    try:
        return await academician_service.update_workspace_milestone(session, workspace_id, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/workspaces/{workspace_id}/tasks", response_model=CollaborationWorkspaceResponse)
async def create_workspace_task(
    workspace_id: UUID,
    payload: WorkspaceTaskCreate,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CollaborationWorkspaceResponse:
    try:
        return await academician_service.add_workspace_task(session, workspace_id, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.put("/workspaces/{workspace_id}/tasks", response_model=CollaborationWorkspaceResponse)
async def update_workspace_task(
    workspace_id: UUID,
    payload: WorkspaceTaskUpdate,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CollaborationWorkspaceResponse:
    try:
        return await academician_service.update_workspace_task_status(session, workspace_id, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/workspaces/{workspace_id}/discussions", response_model=CollaborationWorkspaceResponse)
async def create_workspace_discussion(
    workspace_id: UUID,
    payload: WorkspaceDiscussionPostCreate,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CollaborationWorkspaceResponse:
    try:
        return await academician_service.add_workspace_discussion(session, workspace_id, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/workspaces/{workspace_id}/deliverables", response_model=CollaborationWorkspaceResponse)
async def submit_deliverable(
    workspace_id: UUID,
    payload: WorkspaceDeliverableSubmit,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CollaborationWorkspaceResponse:
    try:
        return await academician_service.submit_workspace_deliverable(session, workspace_id, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/workspaces/{workspace_id}/feedback", response_model=CollaborationWorkspaceResponse)
async def submit_feedback(
    workspace_id: UUID,
    payload: WorkspaceFeedbackSubmit,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CollaborationWorkspaceResponse:
    try:
        return await academician_service.submit_workspace_feedback(session, workspace_id, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/workspaces/{workspace_id}/complete", response_model=CollaborationWorkspaceResponse)
async def complete_workspace_action(
    workspace_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    outcome_summary: str | None = Query(default=None),
) -> CollaborationWorkspaceResponse:
    try:
        return await academician_service.complete_workspace(session, workspace_id, faculty.id, outcome_summary)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


# ============================================================================
# 5. Events & Workshops (Phase 2)
# ============================================================================

@router.post("/events/register", response_model=FacultyEventRegistrationResponse)
async def register_event(
    payload: FacultyEventRegistrationCreate,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyEventRegistrationResponse:
    try:
        return await academician_service.register_faculty_event(session, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/events/me", response_model=list[FacultyEventRegistrationResponse])
async def get_my_events(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FacultyEventRegistrationResponse]:
    return await academician_service.list_faculty_events(session, faculty.id)


# ============================================================================
# 6. Notifications & History
# ============================================================================

@router.get("/notifications", response_model=list[FacultyNotificationResponse])
async def get_notifications(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FacultyNotificationResponse]:
    return await academician_service.list_faculty_notifications(session, faculty.id)


@router.put("/notifications/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_notif_read(
    notification_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    await academician_service.mark_notification_read(session, notification_id, faculty.id)


@router.get("/history/me", response_model=list[FacultyCollaborationHistoryItem])
async def get_my_history(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FacultyCollaborationHistoryItem]:
    return await academician_service.get_faculty_collaboration_history(session, faculty.id)


# ============================================================================
# 7. Live Project Advising
# ============================================================================

@router.get("/live-projects/advising", response_model=list[FacultyAdvisedProjectResponse])
async def get_advised_projects(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FacultyAdvisedProjectResponse]:
    return await academician_service.list_advised_projects(session, faculty.id)


@router.post("/live-projects/feedback", status_code=status.HTTP_200_OK)
async def submit_advising_feedback(
    payload: FacultyProjectFeedbackRequest,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    try:
        await academician_service.submit_project_advising_feedback(session, faculty.id, payload)
        return {"status": "success", "message": "Advising feedback recorded"}
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


# ============================================================================
# 8. Recruiter / Industry Review Flow
# ============================================================================

@router.get("/recruiter/applications", response_model=list[FacultyApplicationResponse])
async def get_recruiter_faculty_applications(
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FacultyApplicationResponse]:
    return await academician_service.list_recruiter_faculty_applications(session, recruiter.id)


@router.put("/recruiter/applications/{application_id}/status", response_model=FacultyApplicationResponse)
async def update_faculty_application_status(
    application_id: UUID,
    payload: FacultyApplicationStatusUpdateRequest,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyApplicationResponse:
    try:
        return await academician_service.update_faculty_application_status_recruiter(session, application_id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


# ============================================================================
# 9. Faculty Video Lectures (Upload / Manage)
# ============================================================================

@router.post("/videos", response_model=FacultyVideoResponse, status_code=status.HTTP_201_CREATED)
async def publish_faculty_video(
    payload: FacultyVideoCreate,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyVideoResponse:
    try:
        return await academician_service.create_faculty_video(session, faculty.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/videos", response_model=list[FacultyVideoResponse])
async def get_own_faculty_videos(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FacultyVideoResponse]:
    return await academician_service.list_faculty_own_videos(session, faculty.id)


@router.post("/videos/upload", response_model=FacultyVideoResponse, status_code=status.HTTP_201_CREATED)
async def upload_faculty_video(
    file: Annotated[UploadFile, File()],
    title: Annotated[str, Form()],
    description: Annotated[str, Form()] = "",
    subject: Annotated[str, Form()] = "General",
    department: Annotated[str, Form()] = "",
    duration_minutes: Annotated[int, Form()] = 30,
    skills_covered: Annotated[str, Form()] = "",
    notes_markdown: Annotated[str | None, Form()] = None,
    faculty: Annotated[Academician, Depends(require_role("academician"))] = None,
    session: Annotated[AsyncSession, Depends(get_session)] = None,
) -> FacultyVideoResponse:
    if not file.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No file provided")

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "File is empty")

    skills_list = [s.strip() for s in skills_covered.split(",") if s.strip()] if skills_covered else []

    try:
        return await academician_service.upload_faculty_video_file(
            session=session,
            faculty_id=faculty.id,
            file_bytes=file_bytes,
            original_filename=file.filename,
            title=title,
            description=description,
            subject=subject,
            department=department or None,
            duration_minutes=duration_minutes,
            skills_covered=skills_list,
            notes_markdown=notes_markdown,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_faculty_video(
    video_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    try:
        await academician_service.delete_faculty_video(session, faculty.id, video_id)
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


# ============================================================================
# 8. Professional Societies & Industry Experts Endpoints
# ============================================================================

@router.get("/societies", response_model=ProfessionalSocietyListResponse)
async def get_professional_societies(
    domain: str | None = Query(None),
    search: str | None = Query(None),
    session: Annotated[AsyncSession, Depends(get_session)] = None,
) -> ProfessionalSocietyListResponse:
    return await collaboration_funding_service.list_professional_societies(session, domain=domain, search=search)


@router.get("/societies/{society_id}", response_model=ProfessionalSocietyResponse)
async def get_professional_society(
    society_id: UUID,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProfessionalSocietyResponse:
    soc = await collaboration_funding_service.get_professional_society_detail(session, society_id)
    if not soc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Professional society not found")
    return soc


@router.get("/experts", response_model=IndustryExpertListResponse)
async def get_industry_experts(
    expertise: str | None = Query(None),
    search: str | None = Query(None),
    session: Annotated[AsyncSession, Depends(get_session)] = None,
) -> IndustryExpertListResponse:
    return await collaboration_funding_service.list_industry_experts(session, expertise=expertise, search=search)


# ============================================================================
# 9. Funding Explorer & Explainable Recommendations Endpoints
# ============================================================================

@router.get("/funding", response_model=FundingOpportunityListResponse)
async def get_funding_opportunities(
    domain: str | None = Query(None),
    grant_type: str | None = Query(None),
    session: Annotated[AsyncSession, Depends(get_session)] = None,
) -> FundingOpportunityListResponse:
    return await collaboration_funding_service.list_funding_opportunities(session, domain=domain, grant_type=grant_type)


@router.get("/funding/recommended", response_model=list[FundingRecommendationResponse])
async def get_recommended_funding(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FundingRecommendationResponse]:
    return await collaboration_funding_service.get_recommended_funding_for_faculty(session, faculty.id)


# ============================================================================
# 10. Faculty Proposal Builder & Lifecycle Endpoints
# ============================================================================

@router.get("/proposals", response_model=FacultyProposalListResponse)
async def get_my_proposals(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    status: str | None = Query(None),
) -> FacultyProposalListResponse:
    return await collaboration_funding_service.list_faculty_proposals(session, faculty.id, status_filter=status)


@router.post("/proposals", response_model=FacultyProposalResponse, status_code=status.HTTP_201_CREATED)
async def create_proposal(
    payload: FacultyProposalCreate,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyProposalResponse:
    return await collaboration_funding_service.create_faculty_proposal(session, faculty.id, payload)


@router.get("/proposals/{proposal_id}", response_model=FacultyProposalResponse)
async def get_proposal(
    proposal_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyProposalResponse:
    prop = await collaboration_funding_service.get_proposal_detail(session, proposal_id)
    if not prop:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proposal not found")
    return prop


@router.patch("/proposals/{proposal_id}/status", response_model=FacultyProposalResponse)
async def update_proposal_state(
    proposal_id: UUID,
    payload: FacultyProposalStatusUpdate,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyProposalResponse:
    prop = await collaboration_funding_service.update_proposal_status(
        session, proposal_id, payload.status, payload.reviewer_feedback, payload.actor_name
    )
    if not prop:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proposal not found")
    return prop


# ============================================================================
# 11. Training & Workshop Planner Endpoints
# ============================================================================

@router.get("/training-recommendations", response_model=TrainingRecommendationListResponse)
async def get_training_recommendations(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TrainingRecommendationListResponse:
    return await training_planner_service.generate_training_recommendations(session, faculty.id)


@router.get("/trainings", response_model=TrainingProgramListResponse)
async def get_faculty_trainings(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TrainingProgramListResponse:
    return await training_planner_service.list_faculty_trainings(session, faculty.id)


@router.post("/trainings", response_model=TrainingProgramResponse, status_code=status.HTTP_201_CREATED)
async def create_training(
    payload: TrainingProgramCreate,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TrainingProgramResponse:
    return await training_planner_service.create_training_program(session, faculty.id, payload)


@router.get("/trainings/{training_id}", response_model=TrainingProgramResponse)
async def get_training(
    training_id: UUID,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TrainingProgramResponse:
    tr = await training_planner_service.get_training_detail(session, training_id)
    if not tr:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Training program not found")
    return tr


@router.post("/trainings/{training_id}/record-outcomes", response_model=TrainingOutcomeMetricResponse)
async def record_program_outcomes(
    training_id: UUID,
    payload: TrainingOutcomeRecordRequest,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TrainingOutcomeMetricResponse:
    try:
        return await training_planner_service.record_training_outcomes(session, training_id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


