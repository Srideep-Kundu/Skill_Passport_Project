"""API Router for Mentorship Sessions, Innovation Challenges, and Live Industry Projects."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Academician, Recruiter, Student
from app.schemas.contracts import (
    FacultyInvitationCreate,
    FacultyInvitationResponse,
    InnovationChallengeCreate,
    InnovationChallengeResponse,
    InnovationChallengeUpdate,
    MentorshipSessionResponse,
    ProjectApplicationCreate,
    ProjectApplicationResponse,
    ProjectApplicationTransition,
    ProjectCompletionRequest,
    ProjectSubmissionRequest,
    SharedValidatedFeedback,
)
from app.services import collaboration_lifecycle_service as lifecycle
from app.services import collaboration_service

router = APIRouter(prefix="/collaborations", tags=["collaborations"])


@router.get("/mentorship", response_model=list[MentorshipSessionResponse])
async def get_mentorship_sessions(
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[MentorshipSessionResponse]:
    return await collaboration_service.list_mentorship_sessions(session)


@router.get("/challenges", response_model=list[InnovationChallengeResponse])
async def get_challenges(
    session: Annotated[AsyncSession, Depends(get_session)],
    challenge_type: str | None = None,
) -> list[InnovationChallengeResponse]:
    return await lifecycle.list_public_challenges(session, challenge_type)


@router.post("/projects/apply", response_model=ProjectApplicationResponse, status_code=status.HTTP_201_CREATED)
async def apply_project(
    payload: ProjectApplicationCreate,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectApplicationResponse:
    try:
        return await lifecycle.apply_for_challenge(
            session,
            student.id,
            payload.challenge_id,
            payload.team_members,
            payload.submission_notes,
        )
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.get("/projects/me", response_model=list[ProjectApplicationResponse])
async def get_my_projects(
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ProjectApplicationResponse]:
    return await lifecycle.list_student_applications(session, student.id)


def _http_error(exc: lifecycle.CollaborationError) -> HTTPException:
    if isinstance(exc, lifecycle.CollaborationNotFoundError):
        code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, lifecycle.CollaborationForbiddenError):
        code = status.HTTP_403_FORBIDDEN
    else:
        code = status.HTTP_409_CONFLICT
    return HTTPException(code, str(exc))


@router.post("/recruiter/challenges", response_model=InnovationChallengeResponse, status_code=status.HTTP_201_CREATED)
async def create_challenge(
    payload: InnovationChallengeCreate,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InnovationChallengeResponse:
    try:
        return await lifecycle.create_challenge(session, recruiter, payload)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.get("/recruiter/challenges", response_model=list[InnovationChallengeResponse])
async def list_owned_challenges(
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[InnovationChallengeResponse]:
    return await lifecycle.list_owned_challenges(session, recruiter.id)


@router.get("/recruiter/challenges/{challenge_id}", response_model=InnovationChallengeResponse)
async def get_owned_challenge(
    challenge_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InnovationChallengeResponse:
    try:
        return await lifecycle.get_owned_challenge(session, recruiter.id, challenge_id)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.patch("/recruiter/challenges/{challenge_id}", response_model=InnovationChallengeResponse)
async def update_challenge(
    challenge_id: UUID,
    payload: InnovationChallengeUpdate,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InnovationChallengeResponse:
    try:
        return await lifecycle.update_challenge(session, recruiter.id, challenge_id, payload)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.post("/recruiter/challenges/{challenge_id}/{action}", response_model=InnovationChallengeResponse)
async def publish_or_close_challenge(
    challenge_id: UUID,
    action: str,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InnovationChallengeResponse:
    try:
        return await lifecycle.set_challenge_publication(session, recruiter.id, challenge_id, action)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.delete("/recruiter/challenges/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_challenge(
    challenge_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    try:
        await lifecycle.delete_challenge(session, recruiter.id, challenge_id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.get("/recruiter/challenges/{challenge_id}/applications", response_model=list[ProjectApplicationResponse])
async def list_challenge_applications(
    challenge_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ProjectApplicationResponse]:
    try:
        return await lifecycle.list_challenge_applications(session, recruiter.id, challenge_id)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.post("/recruiter/applications/{application_id}/transition", response_model=ProjectApplicationResponse)
async def transition_application(
    application_id: UUID,
    payload: ProjectApplicationTransition,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectApplicationResponse:
    try:
        return await lifecycle.transition_application(session, recruiter.id, application_id, payload.status)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.post("/projects/{application_id}/submit", response_model=ProjectApplicationResponse)
async def submit_project(
    application_id: UUID,
    payload: ProjectSubmissionRequest,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectApplicationResponse:
    try:
        return await lifecycle.submit_project(session, student.id, application_id, payload.submission_url, payload.submission_notes)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.post("/recruiter/applications/{application_id}/feedback", response_model=ProjectApplicationResponse)
async def record_feedback(
    application_id: UUID,
    payload: SharedValidatedFeedback,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectApplicationResponse:
    try:
        return await lifecycle.record_project_feedback(session, recruiter.id, application_id, payload)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.post("/recruiter/applications/{application_id}/complete", response_model=ProjectApplicationResponse)
async def complete_project(
    application_id: UUID,
    payload: ProjectCompletionRequest,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProjectApplicationResponse:
    try:
        return await lifecycle.complete_project(session, recruiter.id, application_id, payload.outcome_summary)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.post("/recruiter/invitations", response_model=FacultyInvitationResponse, status_code=status.HTTP_201_CREATED)
async def create_faculty_invitation(
    payload: FacultyInvitationCreate,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyInvitationResponse:
    try:
        return await lifecycle.create_faculty_invitation(session, recruiter.id, payload)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.get("/recruiter/invitations", response_model=list[FacultyInvitationResponse])
async def list_recruiter_invitations(
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FacultyInvitationResponse]:
    return await lifecycle.list_recruiter_invitations(session, recruiter.id)


@router.post("/recruiter/invitations/{invitation_id}/revoke", response_model=FacultyInvitationResponse)
async def revoke_invitation(
    invitation_id: UUID,
    recruiter: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyInvitationResponse:
    try:
        return await lifecycle.revoke_invitation(session, recruiter.id, invitation_id)
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc


@router.get("/invitations/me", response_model=list[FacultyInvitationResponse])
async def list_my_faculty_invitations(
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FacultyInvitationResponse]:
    return await lifecycle.list_faculty_invitations(session, faculty.id)


@router.post("/invitations/{invitation_id}/{action}", response_model=FacultyInvitationResponse)
async def respond_to_invitation(
    invitation_id: UUID,
    action: str,
    faculty: Annotated[Academician, Depends(require_role("academician"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyInvitationResponse:
    try:
        target = {"accept": "accepted", "decline": "declined"}.get(action, action)
        return await lifecycle.respond_to_invitation(
            session, faculty.id, invitation_id, target
        )
    except lifecycle.CollaborationError as exc:
        raise _http_error(exc) from exc
