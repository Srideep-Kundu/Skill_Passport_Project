import hashlib
import logging
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import require_role
from app.models import Evidence, ResumeDocument, ResumeParseStatus, Student
from app.schemas.contracts import PaginatedResponse, ResumeDocumentResponse
from app.services.rate_limit_service import enforce_rate_limit
from app.services.resume_service import (
    PARSER_VERSION,
    LocalResumeStorage,
    ResumeError,
    activate_resume,
    extract_document_text,
    parse_resume_document,
    resume_response,
    validate_upload,
)

router = APIRouter(prefix="/resumes", tags=["resumes"])
logger = logging.getLogger(__name__)


async def _owned_resume(session: AsyncSession, document_id: UUID, student_id: UUID) -> ResumeDocument:
    document = await session.get(ResumeDocument, document_id)
    if document is None or document.student_id != student_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return document


@router.post("", response_model=ResumeDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    response: Response,
    file: Annotated[UploadFile, File(...)],
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeDocumentResponse:
    await enforce_rate_limit("resume_upload", str(principal.id), get_settings().extraction_rate_limit_per_minute)
    data = await file.read()
    try:
        suffix, mime_type = validate_upload(file.filename, file.content_type, data)
        try:
            extract_document_text(data, mime_type)
            parse_status = ResumeParseStatus.uploaded
            safe_error = None
        except ResumeError as error:
            if not error.unsupported:
                raise
            parse_status = ResumeParseStatus.unsupported
            safe_error = error.message
    except ResumeError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, error.message) from error
    checksum = hashlib.sha256(data).hexdigest()
    existing = await session.scalar(select(ResumeDocument).where(ResumeDocument.student_id == principal.id, ResumeDocument.checksum == checksum))
    if existing is not None:
        response.status_code = status.HTTP_200_OK
        return await resume_response(session, existing)
    original_filename = Path(file.filename or f"resume{suffix}").name[:255]
    storage = LocalResumeStorage()
    storage_key = storage.save(data, suffix)
    active_exists = await session.scalar(select(ResumeDocument.id).where(ResumeDocument.student_id == principal.id, ResumeDocument.is_active.is_(True)))
    document = ResumeDocument(student_id=principal.id, original_filename=original_filename, storage_key=storage_key, mime_type=mime_type, size_bytes=len(data), checksum=checksum, parse_status=parse_status, parser_version=PARSER_VERSION, safe_error_message=safe_error, is_active=active_exists is None)
    session.add(document)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        storage.delete(storage_key)
        existing = await session.scalar(select(ResumeDocument).where(ResumeDocument.student_id == principal.id, ResumeDocument.checksum == checksum))
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            return await resume_response(session, existing)
        raise HTTPException(status.HTTP_409_CONFLICT, "A matching resume already exists") from error
    await session.refresh(document)

    # Automatic zero-effort analysis: parse and extract immediately upon upload
    if document.parse_status != ResumeParseStatus.unsupported:
        try:
            await parse_resume_document(session, document, storage)
            await activate_resume(session, document)
            await session.refresh(document)
        except Exception:
            logger.exception(
                "Automatic resume processing failed",
                extra={"resume_document_id": str(document.id)},
            )

    return await resume_response(session, document)


@router.get("", response_model=PaginatedResponse[ResumeDocumentResponse])
async def list_resumes(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[ResumeDocumentResponse]:
    filters = [ResumeDocument.student_id == principal.id]
    total = int((await session.scalar(select(func.count()).select_from(ResumeDocument).where(*filters))) or 0)
    documents = list((await session.scalars(select(ResumeDocument).where(*filters).order_by(ResumeDocument.uploaded_at.desc(), ResumeDocument.id.desc()).offset((page - 1) * page_size).limit(page_size))).all())
    return PaginatedResponse(page=page, page_size=page_size, total=total, items=[await resume_response(session, document) for document in documents])


@router.get("/{document_id}", response_model=ResumeDocumentResponse)
async def get_resume(document_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> ResumeDocumentResponse:
    return await resume_response(session, await _owned_resume(session, document_id, principal.id))


@router.post("/{document_id}/parse", response_model=ResumeDocumentResponse)
async def parse_resume(document_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> ResumeDocumentResponse:
    await enforce_rate_limit("resume_parse", str(principal.id), get_settings().extraction_rate_limit_per_minute)
    document = await _owned_resume(session, document_id, principal.id)
    if document.parse_status != ResumeParseStatus.unsupported:
        await parse_resume_document(session, document, LocalResumeStorage())
    return await resume_response(session, document)


@router.put("/{document_id}/activate", response_model=ResumeDocumentResponse)
async def set_active_resume(document_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> ResumeDocumentResponse:
    document = await _owned_resume(session, document_id, principal.id)
    await activate_resume(session, document)
    await session.refresh(document)
    return await resume_response(session, document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(document_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> Response:
    document = await _owned_resume(session, document_id, principal.id)
    
    # Safely detach derived evidence foreign key so resume deletion succeeds cleanly
    await session.execute(
        update(Evidence).where(Evidence.resume_document_id == document.id).values(resume_document_id=None)
    )
    storage = LocalResumeStorage()
    storage.delete(document.storage_key)
    await session.delete(document)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

