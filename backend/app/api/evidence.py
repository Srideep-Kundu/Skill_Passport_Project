from collections.abc import Sequence
from typing import Annotated, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.engine import Row
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import require_role
from app.models import (
    Evidence,
    EvidenceType,
    ExtractionJob,
    ExtractionStatus,
    Internship,
    Match,
    Recruiter,
    Skill,
    Student,
    StudentSkill,
    VerificationCheck,
)
from app.schemas.contracts import (
    EvidenceCreate,
    EvidenceDetail,
    EvidenceResponse,
    EvidenceUpdate,
    ExtractedSkillResponse,
    ExtractionJobResponse,
    PaginatedResponse,
    VerificationCheckResponse,
    VerificationRequest,
    VerificationResponse,
)
from app.services.extraction_service import (
    create_extraction_job,
    enqueue_extraction,
    manually_requeue_extraction,
    reset_extraction_for_evidence,
)
from app.services.rate_limit_service import enforce_rate_limit
from app.services.verification_service import verify_github_evidence

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.post("", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def submit_evidence(payload: EvidenceCreate, response: Response, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> EvidenceResponse:
    await enforce_rate_limit("extraction", str(principal.id), get_settings().extraction_rate_limit_per_minute)
    evidence = Evidence(student_id=principal.id, evidence_type=payload.evidence_type, title=payload.title, description=payload.description, external_url=str(payload.external_url) if payload.external_url else None)
    session.add(evidence)
    await session.flush()
    await create_extraction_job(session, evidence)
    await session.commit()
    await session.refresh(evidence)
    if not await enqueue_extraction(session, evidence.id):
        response.status_code = status.HTTP_202_ACCEPTED
        await session.refresh(evidence)
    return EvidenceResponse.model_validate(evidence)


@router.get("", response_model=PaginatedResponse[EvidenceResponse])
async def list_evidence(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    evidence_type: EvidenceType | None = None,
    extraction_status: ExtractionStatus | None = None,
) -> PaginatedResponse[EvidenceResponse]:
    filters = [Evidence.student_id == principal.id]
    if evidence_type is not None:
        filters.append(Evidence.evidence_type == evidence_type)
    if extraction_status is not None:
        filters.append(Evidence.extraction_status == extraction_status)
    total = int((await session.scalar(select(func.count()).select_from(Evidence).where(*filters))) or 0)
    items = list(
        (
            await session.scalars(
                select(Evidence)
                .where(*filters)
                .order_by(Evidence.submitted_at.desc(), Evidence.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return PaginatedResponse(page=page, page_size=page_size, total=total, items=[EvidenceResponse.model_validate(item) for item in items])


async def _owned_evidence(session: AsyncSession, evidence_id: UUID, student_id: UUID) -> Evidence:
    evidence = await session.get(Evidence, evidence_id)
    if evidence is None or evidence.student_id != student_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evidence not found")
    return evidence


@router.get("/{evidence_id}", response_model=EvidenceDetail)
async def get_evidence(evidence_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> EvidenceDetail:
    evidence = await _owned_evidence(session, evidence_id, principal.id)
    rows = (await session.execute(select(StudentSkill, Skill).join(Skill).where(StudentSkill.source_evidence_id == evidence.id))).all()
    job = (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))).first()
    return _evidence_detail(evidence, rows, job)


@router.patch("/{evidence_id}", response_model=EvidenceDetail)
async def update_evidence(
    evidence_id: UUID,
    payload: EvidenceUpdate,
    response: Response,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EvidenceDetail:
    if not payload.model_fields_set:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one evidence field must be supplied")
    if any(getattr(payload, field) is None for field in payload.model_fields_set - {"external_url"}):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Evidence title, type, and description cannot be null")
    evidence = await _owned_evidence(session, evidence_id, principal.id)
    extraction_input_changed = bool({"description", "evidence_type"} & payload.model_fields_set)
    if extraction_input_changed:
        await enforce_rate_limit(
            "extraction",
            str(principal.id),
            get_settings().extraction_rate_limit_per_minute,
        )
    if "evidence_type" in payload.model_fields_set:
        assert payload.evidence_type is not None
        evidence.evidence_type = EvidenceType(payload.evidence_type)
    if "title" in payload.model_fields_set:
        assert payload.title is not None
        evidence.title = payload.title
    if "description" in payload.model_fields_set:
        assert payload.description is not None
        evidence.description = payload.description
    if "external_url" in payload.model_fields_set:
        evidence.external_url = str(payload.external_url) if payload.external_url is not None else None
    if extraction_input_changed:
        await reset_extraction_for_evidence(session, evidence)
    await session.commit()
    if extraction_input_changed and not await enqueue_extraction(session, evidence.id):
        response.status_code = status.HTTP_202_ACCEPTED
    await session.refresh(evidence)
    rows = (await session.execute(select(StudentSkill, Skill).join(Skill).where(StudentSkill.source_evidence_id == evidence.id))).all()
    job = (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))).first()
    return _evidence_detail(evidence, rows, job)


@router.delete("/{evidence_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evidence(
    evidence_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    evidence = await _owned_evidence(session, evidence_id, principal.id)
    # Explicit deletes make the lifecycle correct even in SQLite test/dev databases
    # where foreign-key enforcement can be disabled by connection settings.
    await session.execute(delete(StudentSkill).where(StudentSkill.source_evidence_id == evidence.id))
    await session.execute(delete(VerificationCheck).where(VerificationCheck.evidence_id == evidence.id))
    await session.execute(delete(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))
    await session.delete(evidence)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _evidence_detail(evidence: Evidence, rows: Sequence[Row[tuple[StudentSkill, Skill]]], job: ExtractionJob | None) -> EvidenceDetail:
    return EvidenceDetail(
        **EvidenceResponse.model_validate(evidence).model_dump(),
        extracted_skills=[ExtractedSkillResponse(id=item.id, skill_id=item.skill_id, canonical_name=skill.canonical_name, extraction_confidence=float(item.extraction_confidence), verification_tier=item.verification_tier.value, source_evidence_id=item.source_evidence_id, evidence_span=item.evidence_span) for item, skill in rows],
        extraction_job=ExtractionJobResponse(status=job.status.value, attempt_count=job.attempt_count, max_attempts=job.max_attempts, next_retry_at=job.next_retry_at, user_message=job.user_message, provider=job.provider) if job else None,
    )


@router.post("/{evidence_id}/requeue", response_model=EvidenceDetail)
async def requeue_evidence(evidence_id: UUID, response: Response, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> EvidenceDetail:
    evidence = await _owned_evidence(session, evidence_id, principal.id)
    await enforce_rate_limit(
        "extraction",
        str(principal.id),
        get_settings().extraction_rate_limit_per_minute,
    )
    if not await manually_requeue_extraction(session, evidence_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Evidence extraction cannot be requeued")
    await session.refresh(evidence)
    rows = (await session.execute(select(StudentSkill, Skill).join(Skill).where(StudentSkill.source_evidence_id == evidence.id))).all()
    job = (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))).first()
    if job is not None and job.status.value == "retry_scheduled":
        response.status_code = status.HTTP_202_ACCEPTED
    return _evidence_detail(evidence, rows, job)


@router.post("/{evidence_id}/verify", response_model=VerificationResponse)
async def verify_evidence(evidence_id: UUID, payload: VerificationRequest, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> VerificationResponse:
    await _owned_evidence(session, evidence_id, principal.id)
    await enforce_rate_limit("verification", str(principal.id), get_settings().verification_rate_limit_per_minute)
    run = await verify_github_evidence(session, evidence_id)
    return VerificationResponse(
        result=run.tier.value,
        details={"transient_failure": run.transient_failure, "check_count": len(run.checks)},
        verification_tier=run.tier.value,
        checks=[VerificationCheckResponse(check_type=check.check_type, result=cast(Literal["pass", "partial", "fail", "not_applicable"], check.result), details=check.details or {}, checked_at=check.checked_at) for check in run.checks],
    )


@router.get("/internships/{internship_id}/candidates/{student_id}/{evidence_id}", response_model=EvidenceDetail)
async def recruiter_evidence(
    internship_id: UUID,
    student_id: UUID,
    evidence_id: UUID,
    principal: Annotated[Recruiter, Depends(require_role("recruiter"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EvidenceDetail:
    """Return raw evidence only for a consenting candidate matched to the recruiter's internship."""
    internship = await session.get(Internship, internship_id)
    evidence = await session.get(Evidence, evidence_id)
    if internship is None or internship.recruiter_id != principal.id or evidence is None or evidence.student_id != student_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evidence not found")
    student = await session.get(Student, student_id)
    if student is None or not student.recruiter_evidence_consent:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Candidate has not consented to recruiter evidence access")
    match = (
        await session.scalars(
            select(Match.id).where(Match.student_id == student_id, Match.internship_id == internship_id)
        )
    ).first()
    if match is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Evidence is not available for this internship")
    rows = (await session.execute(select(StudentSkill, Skill).join(Skill).where(StudentSkill.source_evidence_id == evidence.id))).all()
    job = (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence.id))).first()
    return _evidence_detail(evidence, rows, job)
