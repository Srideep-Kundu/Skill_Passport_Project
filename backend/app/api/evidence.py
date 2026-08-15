from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Evidence, Skill, Student, StudentSkill
from app.schemas.contracts import (
    EvidenceCreate,
    EvidenceDetail,
    EvidenceResponse,
    ExtractedSkillResponse,
    VerificationRequest,
    VerificationResponse,
)
from app.services.extraction_service import enqueue_extraction
from app.services.verification_service import verify_github_evidence

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.post("", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def submit_evidence(payload: EvidenceCreate, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> EvidenceResponse:
    evidence = Evidence(student_id=principal.id, evidence_type=payload.evidence_type, title=payload.title, description=payload.description, external_url=str(payload.external_url) if payload.external_url else None)
    session.add(evidence)
    await session.commit()
    await session.refresh(evidence)
    await enqueue_extraction(evidence.id)
    return EvidenceResponse.model_validate(evidence)


async def _owned_evidence(session: AsyncSession, evidence_id: UUID, student_id: UUID) -> Evidence:
    evidence = await session.get(Evidence, evidence_id)
    if evidence is None or evidence.student_id != student_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evidence not found")
    return evidence


@router.get("/{evidence_id}", response_model=EvidenceDetail)
async def get_evidence(evidence_id: UUID, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> EvidenceDetail:
    evidence = await _owned_evidence(session, evidence_id, principal.id)
    rows = (await session.execute(select(StudentSkill, Skill).join(Skill).where(StudentSkill.source_evidence_id == evidence.id))).all()
    return EvidenceDetail(**EvidenceResponse.model_validate(evidence).model_dump(), extracted_skills=[ExtractedSkillResponse(id=item.id, skill_id=item.skill_id, canonical_name=skill.canonical_name, extraction_confidence=float(item.extraction_confidence), verification_tier=item.verification_tier.value, source_evidence_id=item.source_evidence_id, evidence_span=item.evidence_span) for item, skill in rows])


@router.post("/{evidence_id}/verify", response_model=VerificationResponse)
async def verify_evidence(evidence_id: UUID, payload: VerificationRequest, principal: Annotated[Student, Depends(require_role("student"))], session: Annotated[AsyncSession, Depends(get_session)]) -> VerificationResponse:
    await _owned_evidence(session, evidence_id, principal.id)
    check = await verify_github_evidence(session, evidence_id)
    return VerificationResponse(result=check.result, details=check.details or {})
