"""API Router for Secure Document Management Vault."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import current_principal
from app.models import Academician, Recruiter, Student
from app.services.document_service import (
    UserDocumentCreate,
    UserDocumentResponse,
    create_user_document,
    delete_user_document,
    list_user_documents,
)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[UserDocumentResponse])
async def list_documents(
    principal: Annotated[Student | Academician | Recruiter, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
    document_type: str | None = None,
) -> list[UserDocumentResponse]:
    return await list_user_documents(session, principal.id, document_type)


@router.post("", response_model=UserDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    payload: UserDocumentCreate,
    principal: Annotated[Student | Academician | Recruiter, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> UserDocumentResponse:
    role = (
        "student"
        if isinstance(principal, Student)
        else "academician"
        if isinstance(principal, Academician)
        else "recruiter"
    )
    return await create_user_document(session, principal.id, role, payload)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_document(
    id: UUID,
    principal: Annotated[Student | Academician | Recruiter, Depends(current_principal)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    try:
        await delete_user_document(session, id, principal.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
