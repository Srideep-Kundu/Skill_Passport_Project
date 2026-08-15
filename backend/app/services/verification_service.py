from urllib.parse import urlparse
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AuditLog,
    Evidence,
    StudentSkill,
    VerificationCheck,
    VerificationTier,
)


async def verify_github_evidence(session: AsyncSession, evidence_id: UUID) -> VerificationCheck:
    result: str
    details: dict[str, object]
    evidence = await session.get(Evidence, evidence_id)
    if evidence is None or not evidence.external_url:
        result, details = "not_applicable", {"reason": "No GitHub repository URL supplied"}
    else:
        parsed = urlparse(evidence.external_url)
        parts = [part for part in parsed.path.split("/") if part]
        if parsed.netloc.lower() not in {"github.com", "www.github.com"} or len(parts) < 2:
            result, details = "fail", {"reason": "external_url is not a GitHub repository"}
        else:
            try:
                async with httpx.AsyncClient(timeout=8) as client:
                    response = await client.get(f"https://api.github.com/repos/{parts[0]}/{parts[1]}", headers={"Accept": "application/vnd.github+json"})
                if response.is_success:
                    result = "repository_accessible"
                    details = {"repository": f"{parts[0]}/{parts[1]}", "public": not response.json().get("private", True)}
                else:
                    result = "partial"
                    details = {"status": response.status_code}
            except httpx.HTTPError:
                result, details = "partial", {"reason": "GitHub unavailable"}
    check = VerificationCheck(evidence_id=evidence_id, check_type="github_repository_accessibility", result=result, details=details)
    session.add(check)
    # Repository availability is a weak supporting signal, not proof that the student authored
    # the work or demonstrated any claimed skill. Keep existing verified tiers unchanged only
    # where a future stronger check established them.
    tier = VerificationTier.partially_verified if result in {"repository_accessible", "partial"} else VerificationTier.unverified
    for student_skill in (await session.scalars(select(StudentSkill).where(StudentSkill.source_evidence_id == evidence_id))).all():
        student_skill.verification_tier = tier
    if evidence is not None:
        session.add(
            AuditLog(
                actor_id=evidence.student_id,
                action="evidence_verification_checked",
                entity_type="evidence",
                entity_id=evidence.id,
                details={"check_type": "github_repository_accessibility", "result": result},
            )
        )
    await session.commit()
    await session.refresh(check)
    return check
