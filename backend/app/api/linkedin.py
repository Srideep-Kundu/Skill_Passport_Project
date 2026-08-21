import hashlib
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
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import require_role
from app.models import Evidence, LinkedInImport, LinkedInParseStatus, Student
from app.schemas.contracts import LinkedInImportResponse, PaginatedResponse
from app.services.linkedin_service import (
    LINKEDIN_PARSER_VERSION,
    LinkedInError,
    LocalLinkedInStorage,
    activate_linkedin_import,
    linkedin_response,
    parse_linkedin_archive,
    parse_linkedin_document,
    validate_linkedin_upload,
)
from app.services.rate_limit_service import enforce_rate_limit

router = APIRouter(prefix="/linkedin/imports", tags=["linkedin"])


async def _owned_linkedin_import(
    session: AsyncSession, import_id: UUID, student_id: UUID
) -> LinkedInImport:
    document = await session.get(LinkedInImport, import_id)
    if document is None or document.student_id != student_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "LinkedIn export import not found")
    return document


@router.post("", response_model=LinkedInImportResponse, status_code=status.HTTP_201_CREATED)
async def upload_linkedin_import(
    response: Response,
    file: Annotated[UploadFile, File(...)],
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LinkedInImportResponse:
    await enforce_rate_limit(
        "linkedin_upload", str(principal.id), get_settings().extraction_rate_limit_per_minute
    )
    data = await file.read()
    try:
        suffix = validate_linkedin_upload(file.filename, data)
        try:
            parse_linkedin_archive(data)
            parse_status = LinkedInParseStatus.uploaded
            safe_error = None
        except LinkedInError as error:
            if not error.unsupported:
                raise
            parse_status = LinkedInParseStatus.unsupported
            safe_error = error.message
    except LinkedInError as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, error.message) from error

    checksum = hashlib.sha256(data).hexdigest()
    existing = await session.scalar(
        select(LinkedInImport).where(
            LinkedInImport.student_id == principal.id,
            LinkedInImport.checksum == checksum,
        )
    )
    if existing is not None:
        response.status_code = status.HTTP_200_OK
        return await linkedin_response(session, existing)

    original_filename = Path(file.filename or f"linkedin_export{suffix}").name[:255]
    storage = LocalLinkedInStorage()
    storage_key = storage.save(data, suffix)
    active_exists = await session.scalar(
        select(LinkedInImport.id).where(
            LinkedInImport.student_id == principal.id,
            LinkedInImport.is_active.is_(True),
        )
    )
    document = LinkedInImport(
        student_id=principal.id,
        original_filename=original_filename,
        storage_key=storage_key,
        mime_type=file.content_type or "application/zip",
        size_bytes=len(data),
        checksum=checksum,
        parse_status=parse_status,
        parser_version=LINKEDIN_PARSER_VERSION,
        safe_error_message=safe_error,
        is_active=active_exists is None,
    )
    session.add(document)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        storage.delete(storage_key)
        existing = await session.scalar(
            select(LinkedInImport).where(
                LinkedInImport.student_id == principal.id,
                LinkedInImport.checksum == checksum,
            )
        )
        if existing is not None:
            response.status_code = status.HTTP_200_OK
            return await linkedin_response(session, existing)
        raise HTTPException(status.HTTP_409_CONFLICT, "A matching LinkedIn export already exists") from error

    await session.refresh(document)
    return await linkedin_response(session, document)


@router.get("", response_model=PaginatedResponse[LinkedInImportResponse])
async def list_linkedin_imports(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[LinkedInImportResponse]:
    filters = [LinkedInImport.student_id == principal.id]
    total = int(
        (
            await session.scalar(
                select(func.count()).select_from(LinkedInImport).where(*filters)
            )
        )
        or 0
    )
    documents = list(
        (
            await session.scalars(
                select(LinkedInImport)
                .where(*filters)
                .order_by(LinkedInImport.uploaded_at.desc(), LinkedInImport.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return PaginatedResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=[await linkedin_response(session, document) for document in documents],
    )


@router.get("/{import_id}", response_model=LinkedInImportResponse)
async def get_linkedin_import(
    import_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LinkedInImportResponse:
    document = await _owned_linkedin_import(session, import_id, principal.id)
    return await linkedin_response(session, document)


@router.post("/{import_id}/parse", response_model=LinkedInImportResponse)
async def parse_linkedin_import_endpoint(
    import_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LinkedInImportResponse:
    await enforce_rate_limit(
        "linkedin_parse", str(principal.id), get_settings().extraction_rate_limit_per_minute
    )
    document = await _owned_linkedin_import(session, import_id, principal.id)
    if document.parse_status != LinkedInParseStatus.unsupported:
        await parse_linkedin_document(session, document, LocalLinkedInStorage())
    return await linkedin_response(session, document)


@router.put("/{import_id}/activate", response_model=LinkedInImportResponse)
async def set_active_linkedin_import_endpoint(
    import_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LinkedInImportResponse:
    document = await _owned_linkedin_import(session, import_id, principal.id)
    await activate_linkedin_import(session, document)
    await session.refresh(document)
    return await linkedin_response(session, document)


@router.delete("/{import_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_linkedin_import_endpoint(
    import_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    from sqlalchemy import update
    document = await _owned_linkedin_import(session, import_id, principal.id)
    await session.execute(
        update(Evidence).where(Evidence.linkedin_import_id == document.id).values(linkedin_import_id=None)
    )
    storage = LocalLinkedInStorage()
    storage.delete(document.storage_key)
    await session.delete(document)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


from app.schemas.contracts import APIModel, EvidenceResponse
from app.services.integrations.linkedin_import_provider import (
    ProfessionalProfile,
    get_linkedin_import_provider,
)
from app.models import EvidenceType, ExtractionStatus, Skill, StudentSkill, VerificationTier


class LinkedInUrlRequest(APIModel):
    profile_url: str


@router.post("/import-url", response_model=ProfessionalProfile)
async def import_linkedin_profile_url(
    payload: LinkedInUrlRequest,
    principal: Annotated[Student, Depends(require_role("student"))],
) -> ProfessionalProfile:
    provider = get_linkedin_import_provider()
    return await provider.fetch_profile(payload.profile_url)


@router.post("/save-profile", response_model=EvidenceResponse)
async def save_imported_linkedin_profile(
    profile: ProfessionalProfile,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EvidenceResponse:
    evidence = Evidence(
        student_id=principal.id,
        evidence_type=EvidenceType.project,
        title=f"LinkedIn Profile: {profile.headline or profile.full_name}",
        description=f"{profile.summary}\n\nExperience: {len(profile.experiences)} roles | Education: {len(profile.education)} records | Skills: {', '.join(profile.skills)}",
        external_url=f"https://linkedin.com/in/{principal.id}",
        raw_metadata=profile.model_dump(),
        extraction_status=ExtractionStatus.extracted,
    )
    session.add(evidence)
    await session.flush()

    for skill_name in profile.skills:
        skill = (await session.scalars(select(Skill).where(Skill.canonical_name.ilike(skill_name)))).first()
        if not skill:
            skill = Skill(canonical_name=skill_name, category="Imported", aliases=[])
            session.add(skill)
            await session.flush()

        existing = (await session.scalars(select(StudentSkill).where(StudentSkill.student_id == principal.id, StudentSkill.skill_id == skill.id))).all()
        has_verified = any(s.verification_tier == VerificationTier.verified for s in existing)
        tier = VerificationTier.verified if has_verified else VerificationTier.partially_verified

        session.add(
            StudentSkill(
                student_id=principal.id,
                skill_id=skill.id,
                source_evidence_id=evidence.id,
                extraction_confidence=profile.source_confidence,
                verification_tier=tier,
                proficiency_hint=f"LinkedIn: {profile.headline}",
                evidence_span=f"Imported from verified LinkedIn profile {profile.full_name}",
            )
        )

    await session.commit()
    await session.refresh(evidence)

    return EvidenceResponse(
        id=evidence.id,
        evidence_type=evidence.evidence_type.value,
        title=evidence.title,
        description=evidence.description,
        external_url=evidence.external_url,
        extraction_status=evidence.extraction_status.value,
        submitted_at=evidence.submitted_at,
    )


