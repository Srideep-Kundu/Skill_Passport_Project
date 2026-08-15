import asyncio
import re
from dataclasses import dataclass
from uuid import UUID

import httpx
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import (
    AuditLog,
    Evidence,
    ExtractionStatus,
    Skill,
    StudentSkill,
    VerificationTier,
)


class ExtractionCandidate(BaseModel):
    skill: str = Field(min_length=1, max_length=120)
    confidence: float = Field(ge=0, le=1)
    evidence_span: str = Field(min_length=1, max_length=500)
    proficiency_hint: str | None = Field(default=None, pattern="^(beginner|intermediate|advanced)$")


class ExtractionPayload(BaseModel):
    skills: list[ExtractionCandidate] = Field(max_length=30)


@dataclass(frozen=True)
class NormalizedCandidate:
    skill: Skill
    confidence: float
    evidence_span: str
    proficiency_hint: str | None


def normalize_candidates(payload: ExtractionPayload, evidence_text: str, taxonomy: list[Skill]) -> list[NormalizedCandidate]:
    """Accept only explicit, taxonomy-backed claims with a literal source span."""
    lookup = {
        label.casefold(): skill
        for skill in taxonomy
        for label in [skill.canonical_name, *(skill.aliases or [])]
    }
    normalized: list[NormalizedCandidate] = []
    seen: set[UUID] = set()
    evidence_folded = evidence_text.casefold()
    for candidate in payload.skills:
        skill = lookup.get(candidate.skill.casefold())
        if skill is None or skill.id in seen or candidate.evidence_span.casefold() not in evidence_folded:
            continue
        seen.add(skill.id)
        normalized.append(NormalizedCandidate(skill, candidate.confidence, candidate.evidence_span, candidate.proficiency_hint))
    return normalized


class GeminiExtractor:
    """Strict extraction adapter. It is not used for scoring or explanations."""

    async def extract(self, evidence_type: str, evidence_text: str, taxonomy: list[Skill]) -> ExtractionPayload:
        settings = get_settings()
        if settings.extraction_provider == "gemini":
            if not settings.gemini_api_key:
                raise ValueError("Gemini extraction is enabled without an API key")
            prompt = (
                "Extract only explicit technical skills from the evidence. Return JSON object {skills:[{skill,confidence,"
                "evidence_span,proficiency_hint}]}; do not infer identity, demographics, background, or any non-skill. "
                "Use an empty list if uncertain. Evidence type: " + evidence_type + "\nEvidence:\n" + evidence_text
            )
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
                    params={"key": settings.gemini_api_key},
                    json={"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"responseMimeType": "application/json"}},
                )
                response.raise_for_status()
                raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                return ExtractionPayload.model_validate_json(raw)
        # Offline deterministic fallback is intentionally conservative and taxonomy constrained.
        candidates = []
        for skill in taxonomy:
            for label in [skill.canonical_name, *(skill.aliases or [])]:
                match = re.search(r"\b" + re.escape(label) + r"\b", evidence_text, flags=re.IGNORECASE)
                if match:
                    candidates.append({"skill": skill.canonical_name, "confidence": 0.8, "evidence_span": match.group(0)})
                    break
        return ExtractionPayload.model_validate({"skills": candidates})


async def extract_evidence(session: AsyncSession, evidence_id: UUID) -> None:
    evidence = await session.get(Evidence, evidence_id)
    if evidence is None:
        return
    taxonomy = list((await session.scalars(select(Skill).order_by(Skill.canonical_name))).all())
    try:
        payload = await GeminiExtractor().extract(evidence.evidence_type.value, evidence.description, taxonomy)
        candidates = normalize_candidates(payload, evidence.description, taxonomy)
        for candidate in candidates:
            session.add(StudentSkill(
                student_id=evidence.student_id,
                skill_id=candidate.skill.id,
                source_evidence_id=evidence.id,
                extraction_confidence=candidate.confidence,
                verification_tier=VerificationTier.unverified,
                proficiency_hint=candidate.proficiency_hint,
                evidence_span=candidate.evidence_span,
            ))
        evidence.extraction_status = ExtractionStatus.extracted
        session.add(AuditLog(actor_id=evidence.student_id, action="evidence_extracted", entity_type="evidence", entity_id=evidence.id,
                              details={"skill_count": len(candidates), "provider": get_settings().extraction_provider}))
        await session.commit()
    except (httpx.HTTPError, IntegrityError, KeyError, TypeError, ValueError):
        await session.rollback()
        evidence = await session.get(Evidence, evidence_id)
        if evidence is None:
            return
        evidence.extraction_status = ExtractionStatus.failed
        session.add(
            AuditLog(
                actor_id=evidence.student_id,
                action="evidence_extraction_failed",
                entity_type="evidence",
                entity_id=evidence.id,
                details=None,
            )
        )
        await session.commit()


async def process_evidence_job(evidence_id: UUID) -> None:
    async with SessionLocal() as session:
        await extract_evidence(session, evidence_id)


async def enqueue_extraction(evidence_id: UUID) -> bool:
    """Use Redis when configured; local background task is an explicit dev/test compatibility path."""
    settings = get_settings()
    if settings.redis_url:
        from redis.asyncio import Redis

        client = Redis.from_url(settings.redis_url)
        try:
            await client.rpush("skill-passport:extraction", str(evidence_id))
            return True
        finally:
            await client.aclose()
    if settings.extraction_sync_fallback:
        asyncio.create_task(process_evidence_job(evidence_id))
    return False
