from collections.abc import Callable
from datetime import UTC, datetime
from typing import Annotated
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
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
    PassportShareCreate,
    PassportShareCreated,
    PassportShareResponse,
    PublicPassportResponse,
    RecruiterEvidenceConsentResponse,
    RecruiterEvidenceConsentUpdate,
)
from app.services.github_service import GitHubClient, GitHubError, GitHubNotFound
from app.services.passport_sharing_service import (
    ShareNotFoundError,
    build_public_passport,
    create_share,
    list_shares,
    management_response,
    owned_share,
    render_pdf,
    render_qr_svg,
    resolve_active_share,
    revoke_share,
)
from app.services.profile_service import build_candidate_profile
from app.services.rate_limit_service import enforce_rate_limit

router = APIRouter(prefix="/passport", tags=["passport"])
public_router = APIRouter(prefix="/public/passports", tags=["public-passport"])


def _public_url_builder(request: Request) -> Callable[[str], str]:
    settings = get_settings()
    candidates = [request.headers.get("origin")]
    referer = request.headers.get("referer")
    if referer:
        parsed = urlsplit(referer)
        candidates.append(f"{parsed.scheme}://{parsed.netloc}")
    candidates.extend(settings.cors_origins)
    allowed_origins = {value.rstrip("/") for value in settings.cors_origins}
    trusted = next(
        (
            value.rstrip("/")
            for value in candidates
            if value and value.rstrip("/") in allowed_origins
        ),
        None,
    )
    base = trusted or str(request.base_url).rstrip("/")
    return lambda token: f"{base}/public/passports/{token}"


def _share_not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "Shared passport not found")


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
    evidence = list(
        (
            await session.scalars(
                select(Evidence)
                .where(Evidence.student_id == principal.id)
                .order_by(Evidence.submitted_at.desc())
            )
        ).all()
    )
    rows = (
        await session.execute(
            select(StudentSkill, Skill)
            .join(Skill)
            .where(StudentSkill.student_id == principal.id)
        )
    ).all()
    return PassportResponse(
        evidence=[EvidenceResponse.model_validate(item) for item in evidence],
        skills=[
            ExtractedSkillResponse(
                id=item.id,
                skill_id=item.skill_id,
                canonical_name=skill.canonical_name,
                extraction_confidence=float(item.extraction_confidence),
                verification_tier=item.verification_tier.value,
                source_evidence_id=item.source_evidence_id,
                evidence_span=item.evidence_span,
            )
            for item, skill in rows
        ],
    )


@router.post(
    "/shares", response_model=PassportShareCreated, status_code=status.HTTP_201_CREATED
)
async def create_passport_share(
    payload: PassportShareCreate,
    request: Request,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PassportShareCreated:
    try:
        return await create_share(
            session, principal, payload, _public_url_builder(request)
        )
    except ValueError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, str(error)
        ) from error


@router.get("/shares", response_model=list[PassportShareResponse])
async def get_passport_shares(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[PassportShareResponse]:
    return await list_shares(session, principal.id)


@router.get("/shares/{share_id}", response_model=PassportShareResponse)
async def get_passport_share(
    share_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PassportShareResponse:
    try:
        return management_response(await owned_share(session, principal.id, share_id))
    except ShareNotFoundError as error:
        raise _share_not_found() from error


@router.delete("/shares/{share_id}", response_model=PassportShareResponse)
async def delete_passport_share(
    share_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PassportShareResponse:
    try:
        return await revoke_share(session, principal, share_id)
    except ShareNotFoundError as error:
        raise _share_not_found() from error


@router.post("/shares/{share_id}/regenerate", response_model=PassportShareCreated)
async def regenerate_passport_share(
    share_id: UUID,
    request: Request,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PassportShareCreated:
    try:
        old_share = await owned_share(session, principal.id, share_id)
        expires_at = old_share.expires_at
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        payload = PassportShareCreate(
            label=old_share.label,
            visibility_allowlist=old_share.visibility_allowlist,
            expires_at=expires_at
            if expires_at and expires_at > datetime.now(UTC)
            else None,
        )
        await revoke_share(session, principal, share_id)
        return await create_share(
            session, principal, payload, _public_url_builder(request)
        )
    except ShareNotFoundError as error:
        raise _share_not_found() from error


async def _public_projection(
    token: str, session: AsyncSession, *, record_access: bool
) -> PublicPassportResponse:
    try:
        share = await resolve_active_share(session, token, record_access=record_access)
        return await build_public_passport(session, share)
    except ShareNotFoundError as error:
        raise _share_not_found() from error


@public_router.get("/{token}.pdf")
async def public_passport_pdf(
    token: str,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    passport = await _public_projection(token, session, record_access=True)
    return Response(
        content=render_pdf(passport, _public_url_builder(request)(token)),
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="skill-passport.pdf"',
            "Cache-Control": "no-store",
        },
    )


@public_router.get("/{token}/qr")
async def public_passport_qr(
    token: str,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    await _public_projection(token, session, record_access=True)
    return Response(
        content=render_qr_svg(_public_url_builder(request)(token)),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-store"},
    )


@public_router.get("/{token}", response_model=PublicPassportResponse)
async def public_passport(
    token: str,
    response: Response,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PublicPassportResponse:
    response.headers["Cache-Control"] = "no-store"
    return await _public_projection(token, session, record_access=True)


@router.get("/profile", response_model=CandidateProfileResponse)
async def unified_profile(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CandidateProfileResponse:
    return await build_candidate_profile(session, principal)


@router.get("/github-identity", response_model=GitHubIdentityResponse)
async def get_github_identity(
    principal: Annotated[Student, Depends(require_role("student"))],
) -> GitHubIdentityResponse:
    return _github_identity(principal)


@router.put("/github-identity", response_model=GitHubIdentityResponse)
async def set_github_identity(
    payload: GitHubIdentityUpdate,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> GitHubIdentityResponse:
    await enforce_rate_limit(
        "verification",
        str(principal.id),
        get_settings().verification_rate_limit_per_minute,
    )
    try:
        canonical_username = await GitHubClient().validate_username(
            payload.github_username
        )
    except GitHubNotFound as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "GitHub username was not found"
        ) from error
    except GitHubError as error:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "GitHub is temporarily unavailable. Please try again.",
        ) from error
    principal.github_username = canonical_username
    session.add(
        AuditLog(
            actor_id=principal.id,
            action="github_identity_claimed",
            entity_type="student",
            entity_id=principal.id,
            details={"github_username": canonical_username},
        )
    )
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That GitHub username is already linked to another student",
        ) from error
    return _github_identity(principal)


@router.get("/consent", response_model=RecruiterEvidenceConsentResponse)
async def get_recruiter_evidence_consent(
    principal: Annotated[Student, Depends(require_role("student"))],
) -> RecruiterEvidenceConsentResponse:
    return RecruiterEvidenceConsentResponse(
        recruiter_evidence_consent=principal.recruiter_evidence_consent
    )


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
                details={
                    "recruiter_evidence_consent": payload.recruiter_evidence_consent
                },
            )
        )
        await session.commit()
    return RecruiterEvidenceConsentResponse(
        recruiter_evidence_consent=principal.recruiter_evidence_consent
    )
