from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import require_role
from app.models import AuditLog, Evidence, Skill, Student, StudentSkill
from app.schemas.contracts import (
    CandidateProfileResponse,
    EvidenceResponse,
    ExtractedSkillResponse,
    GitHubIdentityResponse,
    GitHubIdentityUpdate,
    PassportResponse,
    RecruiterEvidenceConsentResponse,
    RecruiterEvidenceConsentUpdate,
)
from app.services.github_service import GitHubClient, GitHubError, GitHubNotFound
from app.services.profile_service import build_candidate_profile
from app.services.rate_limit_service import enforce_rate_limit

router = APIRouter(prefix="/passport", tags=["passport"])


def _github_identity(student: Student) -> GitHubIdentityResponse:
    return GitHubIdentityResponse(
        github_username=student.github_username,
        association_status="claimed" if student.github_username else "not_linked",
    )


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


@router.get("/profile", response_model=CandidateProfileResponse)
async def unified_profile(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CandidateProfileResponse:
    return await build_candidate_profile(session, principal)


@router.get("/github-identity", response_model=GitHubIdentityResponse)
async def get_github_identity(principal: Annotated[Student, Depends(require_role("student"))]) -> GitHubIdentityResponse:
    return _github_identity(principal)


@router.put("/github-identity", response_model=GitHubIdentityResponse)
async def set_github_identity(
    payload: GitHubIdentityUpdate,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> GitHubIdentityResponse:
    await enforce_rate_limit("verification", str(principal.id), get_settings().verification_rate_limit_per_minute)
    try:
        canonical_username = await GitHubClient().validate_username(payload.github_username)
    except GitHubNotFound as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "GitHub username was not found") from error
    except GitHubError as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "GitHub is temporarily unavailable. Please try again.") from error
    principal.github_username = canonical_username
    session.add(AuditLog(actor_id=principal.id, action="github_identity_claimed", entity_type="student", entity_id=principal.id, details={"github_username": canonical_username}))
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That GitHub username is already linked to another student") from error
    return _github_identity(principal)


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
