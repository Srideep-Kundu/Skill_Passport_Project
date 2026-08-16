import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import UUID

import httpx
from pydantic import BaseModel, Field, ValidationError
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import (
    AuditLog,
    Evidence,
    ExtractionJob,
    ExtractionJobStatus,
    ExtractionStatus,
    Skill,
    StudentSkill,
    VerificationTier,
)

logger = logging.getLogger(__name__)
QUEUE_NAME = "skill-passport:extraction"


class ExtractionCandidate(BaseModel):
    skill: str = Field(min_length=1, max_length=120)
    confidence: float = Field(ge=0, le=1)
    evidence_span: str = Field(min_length=1, max_length=500)
    proficiency_hint: str | None = Field(default=None, pattern="^(beginner|intermediate|advanced)$")


class ExtractionPayload(BaseModel):
    skills: list[ExtractionCandidate] = Field(max_length=30)


class ExtractionFailure(Exception):
    def __init__(self, code: str, *, retryable: bool, user_message: str) -> None:
        super().__init__(code)
        self.code = code
        self.retryable = retryable
        self.user_message = user_message


class ProviderResponseError(ExtractionFailure):
    def __init__(self) -> None:
        super().__init__("provider_response_invalid", retryable=False, user_message="Extraction returned an invalid response. You can retry later.")


class ExtractionValidationError(ExtractionFailure):
    def __init__(self) -> None:
        super().__init__("extraction_validation_failed", retryable=False, user_message="Extraction could not validate the submitted evidence. You can retry later.")


@dataclass(frozen=True)
class NormalizedCandidate:
    skill: Skill
    confidence: float
    evidence_span: str
    proficiency_hint: str | None


def extraction_provider_name() -> str:
    return "gemini" if get_settings().extraction_provider == "gemini" else "local_fallback"


def normalize_candidates(payload: ExtractionPayload, evidence_text: str, taxonomy: list[Skill]) -> list[NormalizedCandidate]:
    """Accept taxonomy-backed claims only when their claimed span occurs in the evidence."""
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
        if skill is None:
            continue
        if candidate.evidence_span.casefold() not in evidence_folded:
            raise ExtractionValidationError()
        if skill.id in seen:
            continue
        seen.add(skill.id)
        normalized.append(NormalizedCandidate(skill, candidate.confidence, candidate.evidence_span, candidate.proficiency_hint))
    return normalized


class GeminiExtractor:
    """Strict provider adapter. The local fallback is used only when explicitly configured."""

    async def extract(self, evidence_type: str, evidence_text: str, taxonomy: list[Skill]) -> ExtractionPayload:
        settings = get_settings()
        if settings.extraction_provider != "gemini":
            return self._local_fallback(evidence_text, taxonomy)
        if not settings.gemini_api_key:
            raise ExtractionFailure("gemini_not_configured", retryable=False, user_message="Extraction is not configured. Please contact support.")
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
        try:
            body = response.json()
            raw = body["candidates"][0]["content"]["parts"][0]["text"]
            if not isinstance(raw, str) or not raw.strip():
                raise ProviderResponseError()
            return ExtractionPayload.model_validate_json(raw)
        except (IndexError, KeyError, TypeError, ValueError, ValidationError) as error:
            raise ProviderResponseError() from error

    @staticmethod
    def _local_fallback(evidence_text: str, taxonomy: list[Skill]) -> ExtractionPayload:
        candidates: list[dict[str, object]] = []
        for skill in taxonomy:
            for label in [skill.canonical_name, *(skill.aliases or [])]:
                match = re.search(r"\b" + re.escape(label) + r"\b", evidence_text, flags=re.IGNORECASE)
                if match:
                    candidates.append({"skill": skill.canonical_name, "confidence": 0.8, "evidence_span": match.group(0)})
                    break
        return ExtractionPayload.model_validate({"skills": candidates})


def _now() -> datetime:
    return datetime.now(UTC)


def _retry_at(attempt_count: int) -> datetime:
    settings = get_settings()
    delay = min(settings.extraction_retry_base_seconds * (2 ** max(attempt_count - 1, 0)), settings.extraction_retry_max_seconds)
    return _now() + timedelta(seconds=delay)


def _audit(evidence: Evidence, action: str, details: dict[str, object] | None = None) -> AuditLog:
    return AuditLog(actor_id=evidence.student_id, action=action, entity_type="evidence", entity_id=evidence.id, details=details)


async def create_extraction_job(session: AsyncSession, evidence: Evidence) -> ExtractionJob:
    """Create exactly one job per evidence record inside the evidence persistence transaction."""
    job = ExtractionJob(
        evidence_id=evidence.id,
        status=ExtractionJobStatus.pending,
        max_attempts=get_settings().extraction_max_attempts,
        idempotency_key=str(evidence.id),
    )
    session.add(job)
    return job


async def _locked_job(session: AsyncSession, evidence_id: UUID) -> ExtractionJob | None:
    return (await session.scalars(select(ExtractionJob).where(ExtractionJob.evidence_id == evidence_id).with_for_update())).first()


async def enqueue_extraction(session: AsyncSession, evidence_id: UUID) -> bool:
    """Push an existing job to Redis, keeping failed scheduling visibly recoverable."""
    job = await _locked_job(session, evidence_id)
    evidence = await session.get(Evidence, evidence_id)
    if job is None or evidence is None:
        return False
    if job.status == ExtractionJobStatus.completed or job.status in {ExtractionJobStatus.queued, ExtractionJobStatus.processing}:
        return True

    settings = get_settings()
    if not settings.redis_url:
        if settings.extraction_sync_fallback:
            job.status = ExtractionJobStatus.queued
            job.queued_at = _now()
            evidence.extraction_status = ExtractionStatus.queued
            session.add(_audit(evidence, "extraction_job_queued", {"mode": "local_task"}))
            await session.commit()
            asyncio.create_task(process_evidence_job(evidence_id))
            return True
        job.status = ExtractionJobStatus.retry_scheduled
        job.next_retry_at = _now()
        job.last_error = "queue_unavailable"
        job.user_message = "Extraction could not be scheduled. Retry this evidence later."
        evidence.extraction_status = ExtractionStatus.retry_scheduled
        session.add(_audit(evidence, "extraction_job_enqueue_failed", {"reason": "redis_not_configured"}))
        await session.commit()
        return False

    client = Redis.from_url(settings.redis_url)
    try:
        await client.rpush(QUEUE_NAME, str(evidence_id))
    except RedisError:
        job.status = ExtractionJobStatus.retry_scheduled
        job.next_retry_at = _now()
        job.last_error = "queue_unavailable"
        job.user_message = "Extraction could not be scheduled. Retry this evidence later."
        evidence.extraction_status = ExtractionStatus.retry_scheduled
        session.add(_audit(evidence, "extraction_job_enqueue_failed", {"reason": "redis_unavailable"}))
        await session.commit()
        return False
    finally:
        await client.aclose()

    job.status = ExtractionJobStatus.queued
    job.queued_at = _now()
    job.next_retry_at = None
    job.last_error = None
    job.user_message = None
    evidence.extraction_status = ExtractionStatus.queued
    session.add(_audit(evidence, "extraction_job_queued", {"mode": "redis"}))
    await session.commit()
    return True


async def manually_requeue_extraction(session: AsyncSession, evidence_id: UUID) -> bool:
    job = await _locked_job(session, evidence_id)
    evidence = await session.get(Evidence, evidence_id)
    if job is None or evidence is None or job.status == ExtractionJobStatus.completed:
        return False
    job.status = ExtractionJobStatus.pending
    job.attempt_count = 0
    job.next_retry_at = None
    job.completed_at = None
    job.last_error = None
    job.user_message = None
    job.provider = None
    evidence.extraction_status = ExtractionStatus.pending_extraction
    session.add(_audit(evidence, "extraction_job_manually_requeued"))
    await session.commit()
    return await enqueue_extraction(session, evidence_id)


async def reset_extraction_for_evidence(session: AsyncSession, evidence: Evidence) -> None:
    """Invalidate derived skills before an edited evidence record is extracted again."""
    job = await _locked_job(session, evidence.id)
    if job is None:
        job = await create_extraction_job(session, evidence)
    await session.execute(delete(StudentSkill).where(StudentSkill.source_evidence_id == evidence.id))
    job.status = ExtractionJobStatus.pending
    job.attempt_count = 0
    job.queued_at = None
    job.started_at = None
    job.completed_at = None
    job.next_retry_at = None
    job.last_error = None
    job.user_message = None
    job.provider = None
    evidence.extraction_status = ExtractionStatus.pending_extraction
    session.add(_audit(evidence, "evidence_extraction_invalidated"))


async def _claim_job(session: AsyncSession, evidence_id: UUID) -> Evidence | None:
    job = await _locked_job(session, evidence_id)
    evidence = await session.get(Evidence, evidence_id)
    if job is None or evidence is None or job.status == ExtractionJobStatus.completed:
        return None
    if job.status == ExtractionJobStatus.processing:
        timeout = timedelta(seconds=get_settings().extraction_claim_timeout_seconds)
        if job.started_at is not None and job.started_at > _now() - timeout:
            return None
    if job.status == ExtractionJobStatus.retry_scheduled and job.next_retry_at is not None and job.next_retry_at > _now():
        return None
    if job.status in {ExtractionJobStatus.failed, ExtractionJobStatus.dead_lettered}:
        return None
    job.status = ExtractionJobStatus.processing
    job.attempt_count += 1
    job.started_at = _now()
    job.next_retry_at = None
    job.user_message = None
    evidence.extraction_status = ExtractionStatus.processing
    session.add(_audit(evidence, "extraction_job_started", {"attempt": job.attempt_count}))
    await session.commit()
    return evidence


def _classify_failure(error: Exception) -> ExtractionFailure:
    if isinstance(error, ExtractionFailure):
        return error
    if isinstance(error, httpx.HTTPStatusError):
        if error.response.status_code == 429 or error.response.status_code >= 500:
            return ExtractionFailure("provider_transient", retryable=True, user_message="Extraction is temporarily unavailable and will retry automatically.")
        return ExtractionFailure("provider_rejected_request", retryable=False, user_message="Extraction could not process this evidence. You can retry later.")
    if isinstance(error, (httpx.TimeoutException, httpx.TransportError, RedisError, IntegrityError)):
        return ExtractionFailure("transient_processing_error", retryable=True, user_message="Extraction is temporarily unavailable and will retry automatically.")
    return ExtractionFailure("unexpected_processing_error", retryable=True, user_message="Extraction encountered a temporary issue and will retry automatically.")


async def _record_failure(session: AsyncSession, evidence_id: UUID, error: Exception) -> None:
    await session.rollback()
    job = await _locked_job(session, evidence_id)
    evidence = await session.get(Evidence, evidence_id)
    if job is None or evidence is None:
        return
    failure = _classify_failure(error)
    job.last_error = failure.code
    job.user_message = failure.user_message
    if failure.retryable and job.attempt_count < job.max_attempts:
        job.status = ExtractionJobStatus.retry_scheduled
        job.next_retry_at = _retry_at(job.attempt_count)
        evidence.extraction_status = ExtractionStatus.retry_scheduled
        session.add(_audit(evidence, "extraction_job_retry_scheduled", {"attempt": job.attempt_count, "error": failure.code}))
    elif failure.retryable:
        job.status = ExtractionJobStatus.dead_lettered
        job.completed_at = _now()
        evidence.extraction_status = ExtractionStatus.dead_lettered
        session.add(_audit(evidence, "extraction_job_dead_lettered", {"attempt": job.attempt_count, "error": failure.code}))
    else:
        job.status = ExtractionJobStatus.failed
        job.completed_at = _now()
        evidence.extraction_status = ExtractionStatus.failed
        session.add(_audit(evidence, "extraction_job_failed", {"attempt": job.attempt_count, "error": failure.code}))
    await session.commit()


async def extract_evidence(session: AsyncSession, evidence_id: UUID) -> str:
    """Claim, extract, and atomically persist one evidence job without duplicate skills."""
    evidence = await _claim_job(session, evidence_id)
    if evidence is None:
        return "ignored"
    try:
        taxonomy = list((await session.scalars(select(Skill).order_by(Skill.canonical_name))).all())
        payload = await GeminiExtractor().extract(evidence.evidence_type.value, evidence.description, taxonomy)
        candidates = normalize_candidates(payload, evidence.description, taxonomy)
        job = await _locked_job(session, evidence_id)
        if job is None:
            raise ExtractionFailure("job_missing", retryable=False, user_message="Extraction could not be completed. Please retry later.")
        await session.execute(delete(StudentSkill).where(StudentSkill.source_evidence_id == evidence.id))
        for candidate in candidates:
            session.add(StudentSkill(student_id=evidence.student_id, skill_id=candidate.skill.id, source_evidence_id=evidence.id, extraction_confidence=candidate.confidence, verification_tier=VerificationTier.unverified, proficiency_hint=candidate.proficiency_hint, evidence_span=candidate.evidence_span))
        job.status = ExtractionJobStatus.completed
        job.provider = extraction_provider_name()
        job.completed_at = _now()
        job.next_retry_at = None
        job.last_error = None
        job.user_message = None
        evidence.extraction_status = ExtractionStatus.extracted
        session.add(_audit(evidence, "extraction_job_completed", {"attempt": job.attempt_count, "provider": job.provider, "skill_count": len(candidates)}))
        await session.commit()
        return "completed"
    except Exception as error:  # noqa: BLE001 - job failures must not escape the worker boundary.
        await _record_failure(session, evidence_id, error)
        logger.warning("extraction_job_failed evidence_id=%s error_code=%s", evidence_id, _classify_failure(error).code)
        return "failed"


async def process_evidence_job(evidence_id: UUID) -> str:
    async with SessionLocal() as session:
        return await extract_evidence(session, evidence_id)


async def enqueue_due_retries(limit: int = 25) -> int:
    """Promote due retry jobs without sleeping; the worker invokes this on each poll cycle."""
    async with SessionLocal() as session:
        due_ids = list((await session.scalars(select(ExtractionJob.evidence_id).where(ExtractionJob.status == ExtractionJobStatus.retry_scheduled, ExtractionJob.next_retry_at <= _now()).order_by(ExtractionJob.next_retry_at).limit(limit))).all())
    queued = 0
    for evidence_id in due_ids:
        async with SessionLocal() as session:
            if await enqueue_extraction(session, evidence_id):
                queued += 1
    return queued
