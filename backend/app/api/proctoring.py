"""API Router for Assessment Proctoring and Keystroke Dynamics Tracking."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import current_principal, require_role
from app.models.domain import Admin, Recruiter, Student
from app.schemas.contracts import (
    ProctoringEventsBatchRequest,
    ProctoringEvidenceUploadRequest,
    ProctoringKeyboardMetricsCreate,
    ProctoringReportResponse,
    ProctoringSessionEndRequest,
    ProctoringSessionResponse,
    ProctoringSessionStartRequest,
)
from app.services.proctoring_service import proctoring_service

router = APIRouter(prefix="/proctoring", tags=["proctoring"])


@router.post(
    "/session/start",
    response_model=ProctoringSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def start_proctoring_session(
    payload: ProctoringSessionStartRequest,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProctoringSessionResponse:
    """Initialize a verified proctoring and keystroke tracking session."""
    return await proctoring_service.start_session(session, student.id, payload)


@router.post(
    "/events",
    response_model=ProctoringSessionResponse,
)
async def record_proctoring_events_batch(
    payload: ProctoringEventsBatchRequest,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProctoringSessionResponse:
    """Batch-record client-side proctoring violation events and update authoritative score."""
    try:
        return await proctoring_service.record_events_batch(session, student.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post(
    "/keyboard",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def record_keyboard_metrics(
    payload: ProctoringKeyboardMetricsCreate,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Record aggregated keystroke dynamics biometric metrics."""
    try:
        await proctoring_service.record_keyboard_metrics(session, student.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post(
    "/evidence",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def upload_proctoring_evidence(
    payload: ProctoringEvidenceUploadRequest,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Upload timestamped webcam/screen snapshot evidence for proctoring audit."""
    try:
        await proctoring_service.upload_evidence(session, student.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get(
    "/session/{session_id}",
    response_model=ProctoringSessionResponse,
)
async def get_session_status(
    session_id: str,
    current_user: Annotated[Student | Recruiter | Admin, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProctoringSessionResponse:
    """Get live status, warning count, and score of a proctoring session."""
    try:
        role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        return await proctoring_service.get_session_status(
            session, session_id, current_user.id, role_str
        )
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post(
    "/session/{session_id}/end",
    response_model=ProctoringSessionResponse,
)
async def end_proctoring_session(
    session_id: str,
    payload: ProctoringSessionEndRequest,
    student: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProctoringSessionResponse:
    """Finalize an active proctoring session upon assessment completion or auto-termination."""
    try:
        return await proctoring_service.end_session(session, session_id, student.id, payload)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.get(
    "/report/{assessment_id}/{student_id}",
    response_model=ProctoringReportResponse,
)
async def get_proctoring_report(
    assessment_id: str,
    student_id: str,
    current_user: Annotated[Student | Recruiter | Admin, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProctoringReportResponse:
    """Retrieve full audit report with integrity score, timeline, snapshots, and keyboard dynamics."""
    try:
        role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
        return await proctoring_service.get_proctoring_report(
            session, assessment_id, student_id, current_user.id, role_str
        )
    except PermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
