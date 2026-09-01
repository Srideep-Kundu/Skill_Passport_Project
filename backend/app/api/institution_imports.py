"""Tenant-scoped institution import and mapping endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Institution
from app.schemas.contracts import (
    InstitutionImportBatchResponse,
    InstitutionImportPreview,
    InstitutionMappingCreate,
    InstitutionMappingResponse,
    InstitutionMappingUpdate,
)
from app.services import institution_import_service as service

router = APIRouter(prefix="/institution", tags=["institution-imports"])

STUDENT_HEADERS = {"full_name", "email", "roll_number", "department", "cohort_year"}
PLACEMENT_HEADERS = {
    "external_source",
    "external_id",
    "company_name",
    "title",
    "drive_date",
}
LEARNING_HEADERS = {
    "external_source",
    "external_id",
    "student_roll_number",
    "course_external_key",
    "status",
}


def _error(exc: ValueError) -> HTTPException:
    if isinstance(exc, service.ImportNotFoundError):
        return HTTPException(status.HTTP_404_NOT_FOUND, str(exc))
    return HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc))


async def _parse(file: UploadFile, headers: set[str]) -> service.ParsedCsv:
    content = await file.read(service.MAX_IMPORT_BYTES + 1)
    return service.parse_csv_upload(file.filename, file.content_type, content, headers)


@router.post("/imports/students/dry-run", response_model=InstitutionImportPreview)
async def student_import_dry_run(
    file: Annotated[UploadFile, File()],
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionImportPreview:
    try:
        return await service.preview_students(
            session, institution, await _parse(file, STUDENT_HEADERS)
        )
    except ValueError as exc:
        raise _error(exc) from exc


@router.post(
    "/imports/students",
    response_model=InstitutionImportBatchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def confirm_student_import(
    file: Annotated[UploadFile, File()],
    confirmed_checksum: Annotated[str, Form(min_length=64, max_length=64)],
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionImportBatchResponse:
    try:
        return await service.import_students(
            session,
            institution,
            await _parse(file, STUDENT_HEADERS),
            confirmed_checksum,
        )
    except ValueError as exc:
        raise _error(exc) from exc


@router.post(
    "/imports/placements",
    response_model=InstitutionImportBatchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def confirm_placement_import(
    file: Annotated[UploadFile, File()],
    confirmed_checksum: Annotated[str, Form(min_length=64, max_length=64)],
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionImportBatchResponse:
    try:
        return await service.import_placements(
            session,
            institution,
            await _parse(file, PLACEMENT_HEADERS),
            confirmed_checksum,
        )
    except ValueError as exc:
        raise _error(exc) from exc


@router.post("/imports/placements/dry-run", response_model=InstitutionImportPreview)
async def placement_import_dry_run(
    file: Annotated[UploadFile, File()],
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionImportPreview:
    try:
        return await service.preview_placements(
            session, institution, await _parse(file, PLACEMENT_HEADERS)
        )
    except ValueError as exc:
        raise _error(exc) from exc


@router.post(
    "/imports/learning-completions",
    response_model=InstitutionImportBatchResponse,
    status_code=status.HTTP_201_CREATED,
)
async def confirm_learning_import(
    file: Annotated[UploadFile, File()],
    confirmed_checksum: Annotated[str, Form(min_length=64, max_length=64)],
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionImportBatchResponse:
    try:
        return await service.import_learning_completions(
            session,
            institution,
            await _parse(file, LEARNING_HEADERS),
            confirmed_checksum,
        )
    except ValueError as exc:
        raise _error(exc) from exc


@router.post(
    "/imports/learning-completions/dry-run",
    response_model=InstitutionImportPreview,
)
async def learning_import_dry_run(
    file: Annotated[UploadFile, File()],
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionImportPreview:
    try:
        return await service.preview_learning_completions(
            session, institution, await _parse(file, LEARNING_HEADERS)
        )
    except ValueError as exc:
        raise _error(exc) from exc


@router.get("/imports", response_model=list[InstitutionImportBatchResponse])
async def list_imports(
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[InstitutionImportBatchResponse]:
    return await service.list_batches(session, institution.id)


@router.get("/imports/{batch_id}", response_model=InstitutionImportBatchResponse)
async def get_import(
    batch_id: UUID,
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionImportBatchResponse:
    try:
        return await service.get_batch(session, institution.id, batch_id)
    except ValueError as exc:
        raise _error(exc) from exc


@router.get("/mappings", response_model=list[InstitutionMappingResponse])
async def list_mappings(
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    mapping_type: str | None = Query(default=None, max_length=32),
) -> list[InstitutionMappingResponse]:
    if mapping_type is not None and mapping_type not in service.MAPPING_TYPES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unsupported mapping type")
    return await service.list_mappings(session, institution.id, mapping_type)


@router.post(
    "/mappings",
    response_model=InstitutionMappingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_mapping(
    payload: InstitutionMappingCreate,
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionMappingResponse:
    try:
        return await service.create_mapping(session, institution, payload)
    except ValueError as exc:
        raise _error(exc) from exc


@router.patch("/mappings/{mapping_id}", response_model=InstitutionMappingResponse)
async def update_mapping(
    mapping_id: UUID,
    payload: InstitutionMappingUpdate,
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionMappingResponse:
    try:
        return await service.update_mapping(
            session, institution, mapping_id, payload
        )
    except ValueError as exc:
        raise _error(exc) from exc


@router.delete("/mappings/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mapping(
    mapping_id: UUID,
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    try:
        await service.delete_mapping(session, institution.id, mapping_id)
    except ValueError as exc:
        raise _error(exc) from exc
