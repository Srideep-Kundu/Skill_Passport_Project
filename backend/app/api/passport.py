from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import AuditLog, Evidence, Skill, Student, StudentSkill
from app.schemas.contracts import (
    EvidenceResponse,
    ExtractedSkillResponse,
    PassportResponse,
    RecruiterEvidenceConsentResponse,
    RecruiterEvidenceConsentUpdate,
)

router = APIRouter(prefix="/passport", tags=["passport"])


@router.get("/me", response_model=PassportResponse)
async def my_passport(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PassportResponse:
    evidence = list((await session.scalars(select(Evidence).where(Evidence.student_id == principal.id).order_by(Evidence.submitted_at.desc()))).all())
    rows = (await session.execute(select(StudentSkill, Skill).join(Skill).where(StudentSkill.student_id == principal.id))).all()
    return PassportResponse(
        evidence=[EvidenceResponse.model_validate(item) for item in evidence],
        skills=[ExtractedSkillResponse(id=item.id, skill_id=item.skill_id, canonical_name=skill.canonical_name, extraction_confidence=float(item.extraction_confidence), verification_tier=item.verification_tier.value, source_evidence_id=item.source_evidence_id, evidence_span=item.evidence_span) for item, skill in rows],
    )


@router.get("/consent", response_model=RecruiterEvidenceConsentResponse)
async def get_recruiter_evidence_consent(
    principal: Annotated[Student, Depends(require_role("student"))],
) -> RecruiterEvidenceConsentResponse:
    return RecruiterEvidenceConsentResponse(recruiter_evidence_consent=principal.recruiter_evidence_consent)


@router.put("/consent", response_model=RecruiterEvidenceConsentResponse)
async def set_recruiter_evidence_consent(
    payload: RecruiterEvidenceConsentUpdate,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> RecruiterEvidenceConsentResponse:
    if principal.recruiter_evidence_consent != payload.recruiter_evidence_consent:
        principal.recruiter_evidence_consent = payload.recruiter_evidence_consent
        session.add(
            AuditLog(
                actor_id=principal.id,
                action="recruiter_evidence_consent_changed",
                entity_type="student",
                entity_id=principal.id,
                details={"recruiter_evidence_consent": payload.recruiter_evidence_consent},
            )
        )
        await session.commit()
    return RecruiterEvidenceConsentResponse(recruiter_evidence_consent=principal.recruiter_evidence_consent)
