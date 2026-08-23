import asyncio
import json
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import ClassVar, Protocol
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


def _extraction_prompt(
    evidence_type: str, evidence_text: str, taxonomy: list[Skill]
) -> str:
    taxonomy_names = [skill.canonical_name for skill in taxonomy]
    return (
        "Extract only explicit technical skills from the evidence. Return JSON object "
        "{skills:[{skill,confidence,evidence_span,proficiency_hint}]}; do not infer "
        "identity, demographics, background, or any non-skill. Use only an exact skill "
        "name from the supplied canonical taxonomy, copy evidence_span verbatim from "
        "the evidence, and use an empty list if uncertain. Canonical taxonomy: "
        + json.dumps(taxonomy_names)
        + "\nEvidence type: "
        + evidence_type
        + "\nEvidence:\n"
        + evidence_text
    )


def _extraction_response_schema() -> dict[str, object]:
    return {
        "type": "object",
        "properties": {
            "skills": {
                "type": "array",
                "maxItems": 30,
                "items": {
                    "type": "object",
                    "properties": {
                        "skill": {"type": "string"},
                        "confidence": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                        },
                        "evidence_span": {"type": "string"},
                        "proficiency_hint": {
                            "type": "string",
                            "enum": ["beginner", "intermediate", "advanced"],
                        },
                    },
                    "required": [
                        "skill",
                        "confidence",
                        "evidence_span",
                        "proficiency_hint",
                    ],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["skills"],
        "additionalProperties": False,
    }


@dataclass(frozen=True)
class ProviderExtraction:
    payload: ExtractionPayload
    provider: str
    model: str


class ExtractionAdapter(Protocol):
    provider: str
    model: str

    async def extract(
        self, evidence_type: str, evidence_text: str, taxonomy: list[Skill]
    ) -> ExtractionPayload: ...


class LocalExtractor:
    provider = "local_fallback"
    model = "deterministic_taxonomy_v1"

    async def extract(
        self, _evidence_type: str, evidence_text: str, taxonomy: list[Skill]
    ) -> ExtractionPayload:
        candidates: list[dict[str, object]] = []
        for skill in taxonomy:
            for label in [skill.canonical_name, *(skill.aliases or [])]:
                match = re.search(r"\b" + re.escape(label) + r"\b", evidence_text, flags=re.IGNORECASE)
                if match:
                    candidates.append({"skill": skill.canonical_name, "confidence": 0.8, "evidence_span": match.group(0)})
                    break
        return ExtractionPayload.model_validate({"skills": candidates})


class GeminiExtractor:
    provider = "gemini"

    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.extraction_model
        self.api_key = settings.gemini_api_key

    async def extract(
        self, evidence_type: str, evidence_text: str, taxonomy: list[Skill]
    ) -> ExtractionPayload:
        if not self.api_key:
            return await LocalExtractor().extract(evidence_type, evidence_text, taxonomy)

        models_to_try = list(
            dict.fromkeys(["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.6-flash", self.model])
        )

        for model_name in models_to_try:
            try:
                async with httpx.AsyncClient(timeout=25) as client:
                    response = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent",
                        params={"key": self.api_key},
                        json={
                            "contents": [
                                {
                                    "parts": [
                                        {"text": _extraction_prompt(evidence_type, evidence_text, taxonomy)}
                                    ]
                                }
                            ],
                            "generationConfig": {
                                "responseMimeType": "application/json",
                            },
                        },
                    )
                    if response.status_code == 200:
                        body = response.json()
                        raw = body["candidates"][0]["content"]["parts"][0]["text"]
                        if isinstance(raw, str) and raw.strip():
                            cleaned = raw.strip()
                            if cleaned.startswith("```json"):
                                cleaned = cleaned[7:].strip()
                            if cleaned.startswith("```"):
                                cleaned = cleaned[3:].strip()
                            if cleaned.endswith("```"):
                                cleaned = cleaned[:-3].strip()
                            return ExtractionPayload.model_validate_json(cleaned)
            except Exception:
                continue

        # Graceful fallback to deterministic local extractor to prevent failed analysis state
        return await LocalExtractor().extract(evidence_type, evidence_text, taxonomy)


class GroqExtractor:
    provider = "groq"
    _strict_models: ClassVar[set[str]] = {
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
    }

    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.groq_extraction_model
        self.api_key = settings.groq_api_key

    async def extract(
        self, evidence_type: str, evidence_text: str, taxonomy: list[Skill]
    ) -> ExtractionPayload:
        if not self.api_key:
            raise ExtractionFailure(
                "groq_not_configured",
                retryable=False,
                user_message="Extraction is not configured. Please contact support.",
            )
        response_format: dict[str, object]
        if self.model in self._strict_models:
            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": "skill_extraction",
                    "strict": True,
                    "schema": _extraction_response_schema(),
                },
            }
        else:
            response_format = {"type": "json_object"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {
                            "role": "user",
                            "content": _extraction_prompt(
                                evidence_type, evidence_text, taxonomy
                            ),
                        }
                    ],
                    "response_format": response_format,
                    "temperature": 0,
                },
            )
            response.raise_for_status()
        try:
            body = response.json()
            raw = body["choices"][0]["message"]["content"]
            if not isinstance(raw, str) or not raw.strip():
                raise ProviderResponseError()
            return ExtractionPayload.model_validate_json(raw)
        except (IndexError, KeyError, TypeError, ValueError, ValidationError) as error:
            raise ProviderResponseError() from error


def _provider_chain() -> list[str]:
    settings = get_settings()
    chain: list[str] = []
    for provider in [
        settings.extraction_provider,
        *settings.extraction_fallback_providers,
    ]:
        if provider not in chain:
            chain.append(provider)
    return chain


def _adapter(provider: str) -> ExtractionAdapter:
    if provider == "gemini":
        return GeminiExtractor()
    if provider == "groq":
        return GroqExtractor()
    return LocalExtractor()


async def extract_with_fallback(
    evidence_type: str, evidence_text: str, taxonomy: list[Skill]
) -> ProviderExtraction:
    chain = _provider_chain()
    for index, provider_name in enumerate(chain):
        adapter = _adapter(provider_name)
        try:
            payload = await adapter.extract(evidence_type, evidence_text, taxonomy)
            return ProviderExtraction(payload, adapter.provider, adapter.model)
        except Exception as error:
            failure = _classify_failure(error)
            if not failure.retryable or index == len(chain) - 1:
                raise failure from error
    raise ExtractionFailure(
        "provider_unavailable",
        retryable=True,
        user_message="Extraction is temporarily unavailable and will retry automatically.",
    )


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


async def requeue_terminal_extractions(session: AsyncSession, evidence_ids: list[UUID]) -> int:
    """Atomically reset only terminal jobs, then enqueue each once."""
    if not evidence_ids:
        return 0
    terminal_statuses = {
        ExtractionJobStatus.failed,
        ExtractionJobStatus.dead_lettered,
    }
    jobs = list(
        (
            await session.scalars(
                select(ExtractionJob)
                .where(
                    ExtractionJob.evidence_id.in_(evidence_ids),
                    ExtractionJob.status.in_(terminal_statuses),
                )
                .with_for_update()
            )
        ).all()
    )
    if not jobs:
        return 0
    evidence_by_id = {
        evidence.id: evidence
        for evidence in (
            await session.scalars(
                select(Evidence).where(
                    Evidence.id.in_([job.evidence_id for job in jobs])
                )
            )
        ).all()
    }
    requeued_ids: list[UUID] = []
    for job in jobs:
        evidence = evidence_by_id.get(job.evidence_id)
        if evidence is None:
            continue
        job.status = ExtractionJobStatus.pending
        job.attempt_count = 0
        job.queued_at = None
        job.started_at = None
        job.next_retry_at = None
        job.completed_at = None
        job.last_error = None
        job.user_message = None
        job.provider = None
        evidence.extraction_status = ExtractionStatus.pending_extraction
        session.add(_audit(evidence, "extraction_job_manually_requeued"))
        requeued_ids.append(evidence.id)
    await session.commit()
    for evidence_id in requeued_ids:
        await enqueue_extraction(session, evidence_id)
    return len(requeued_ids)


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
        if error.response.status_code in {429, 498} or error.response.status_code >= 500:
            return ExtractionFailure("provider_transient", retryable=True, user_message="Extraction is temporarily unavailable and will retry automatically.")
        if error.response.status_code in {401, 403, 404}:
            return ExtractionFailure("provider_configuration_error", retryable=False, user_message="Extraction provider configuration is unavailable. Please contact support.")
        return ExtractionFailure("provider_rejected_request", retryable=False, user_message="Extraction could not process this evidence. You can retry later.")
    if isinstance(error, (httpx.TimeoutException, httpx.TransportError)):
        return ExtractionFailure("provider_transient", retryable=True, user_message="Extraction is temporarily unavailable and will retry automatically.")
    if isinstance(error, (RedisError, IntegrityError)):
        return ExtractionFailure("transient_processing_error", retryable=True, user_message="Extraction is temporarily unavailable and will retry automatically.")
    return ExtractionFailure("unexpected_processing_error", retryable=False, user_message="Extraction could not be completed. Please retry later.")


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
        extraction = await extract_with_fallback(
            evidence.evidence_type.value, evidence.description, taxonomy
        )
        candidates = normalize_candidates(
            extraction.payload, evidence.description, taxonomy
        )
        job = await _locked_job(session, evidence_id)
        if job is None:
            raise ExtractionFailure("job_missing", retryable=False, user_message="Extraction could not be completed. Please retry later.")
        await session.execute(delete(StudentSkill).where(StudentSkill.source_evidence_id == evidence.id))
        for candidate in candidates:
            session.add(StudentSkill(student_id=evidence.student_id, skill_id=candidate.skill.id, source_evidence_id=evidence.id, extraction_confidence=candidate.confidence, verification_tier=VerificationTier.unverified, proficiency_hint=candidate.proficiency_hint, evidence_span=candidate.evidence_span))
        job.status = ExtractionJobStatus.completed
        job.provider = extraction.provider
        job.completed_at = _now()
        job.next_retry_at = None
        job.last_error = None
        job.user_message = None
        evidence.extraction_status = ExtractionStatus.extracted
        session.add(_audit(evidence, "extraction_job_completed", {"attempt": job.attempt_count, "provider": job.provider, "model": extraction.model, "skill_count": len(candidates)}))
        await session.commit()
        return "completed"
    except Exception as error:  # noqa: BLE001 - job failures must not escape the worker boundary.
        await _record_failure(session, evidence_id, error)
        logger.warning("extraction_job_failed evidence_id=%s error_code=%s", evidence_id, _classify_failure(error).code)
        return "failed"


async def process_evidence_job(evidence_id: UUID) -> str:
    async with SessionLocal() as session:
        return await extract_evidence(session, evidence_id)


async def recover_stale_processing_jobs(
    session: AsyncSession, *, limit: int = 25
) -> list[UUID]:
    """Return abandoned queue and worker leases without duplicating live work."""
    cutoff = _now() - timedelta(seconds=get_settings().extraction_claim_timeout_seconds)
    evidence_ids = list(
        (
            await session.scalars(
                select(ExtractionJob.evidence_id)
                .where(
                    ExtractionJob.status == ExtractionJobStatus.processing,
                    ExtractionJob.started_at <= cutoff,
                )
                .union_all(
                    select(ExtractionJob.evidence_id).where(
                        ExtractionJob.status == ExtractionJobStatus.queued,
                        ExtractionJob.queued_at <= cutoff,
                    )
                )
                .order_by(ExtractionJob.evidence_id)
                .limit(limit)
            )
        ).all()
    )
    recovered: list[UUID] = []
    for evidence_id in evidence_ids:
        job = await _locked_job(session, evidence_id)
        evidence = await session.get(Evidence, evidence_id)
        is_stale_processing = (
            job is not None
            and job.status == ExtractionJobStatus.processing
            and job.started_at is not None
            and job.started_at <= cutoff
        )
        is_stale_queued = (
            job is not None
            and job.status == ExtractionJobStatus.queued
            and job.queued_at is not None
            and job.queued_at <= cutoff
        )
        if job is None or evidence is None or not (is_stale_processing or is_stale_queued):
            continue
        reason = "worker_lease_expired" if is_stale_processing else "queue_lease_expired"
        if is_stale_processing and job.attempt_count >= job.max_attempts:
            job.status = ExtractionJobStatus.dead_lettered
            job.completed_at = _now()
            job.last_error = reason
            job.user_message = "Extraction could not be completed. Retry this evidence later."
            evidence.extraction_status = ExtractionStatus.dead_lettered
            session.add(
                _audit(
                    evidence,
                    "extraction_job_dead_lettered",
                    {"attempt": job.attempt_count, "error": reason},
                )
            )
            continue
        job.status = ExtractionJobStatus.pending
        job.started_at = None
        job.queued_at = None
        job.next_retry_at = None
        job.last_error = reason
        job.user_message = "Extraction was interrupted and will retry automatically."
        evidence.extraction_status = ExtractionStatus.pending_extraction
        session.add(
            _audit(
                evidence,
                "extraction_job_recovered",
                {"attempt": job.attempt_count, "reason": reason},
            )
        )
        recovered.append(evidence_id)
    if evidence_ids:
        await session.commit()
    return recovered


async def enqueue_due_retries(limit: int = 25) -> int:
    """Promote due retries and abandoned worker leases on each poll cycle."""
    async with SessionLocal() as session:
        due_ids = list(
            (
                await session.scalars(
                    select(ExtractionJob.evidence_id)
                    .where(
                        ExtractionJob.status == ExtractionJobStatus.retry_scheduled,
                        ExtractionJob.next_retry_at <= _now(),
                    )
                    .order_by(ExtractionJob.next_retry_at, ExtractionJob.id)
                    .limit(limit)
                )
            ).all()
        )
        remaining = max(0, limit - len(due_ids))
        if remaining:
            due_ids.extend(
                await recover_stale_processing_jobs(session, limit=remaining)
            )
    queued = 0
    for evidence_id in due_ids:
        async with SessionLocal() as session:
            if await enqueue_extraction(session, evidence_id):
                queued += 1
    return queued
