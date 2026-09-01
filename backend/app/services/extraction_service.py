import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import ClassVar, Protocol, cast
from uuid import UUID, uuid4

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
    ExtractionAttempt,
    ExtractionCacheEntry,
    ExtractionJob,
    ExtractionJobStatus,
    ExtractionStatus,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.services.hybrid_extraction import (
    ExtractionUnit,
    content_fingerprint,
    deterministic_gate,
    extraction_config_fingerprint,
    prior_verified_skills,
    retrieve_taxonomy_candidates_many,
    sanitize_provider_text,
    semantic_chunks,
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
    taxonomy_context = [
        {"skill_id": str(skill.id), "name": skill.canonical_name, "aliases": skill.aliases or []}
        for skill in taxonomy
    ]
    return (
        "Extract only explicit technical skills from the evidence. Return JSON object "
        "{skills:[{skill,confidence,evidence_span,proficiency_hint}]}; do not infer "
        "identity, demographics, background, or any non-skill. Use only an exact skill "
        "name from the supplied canonical taxonomy, copy evidence_span verbatim from "
        "the evidence, and use an empty list if uncertain. Candidate taxonomy: "
        + json.dumps(taxonomy_context)
        + "\nEvidence type: "
        + evidence_type
        + "\nEvidence:\n"
        + evidence_text
    )


class BatchExtractionItem(BaseModel):
    correlation_id: str = Field(min_length=1, max_length=100)
    skills: list[ExtractionCandidate] = Field(max_length=30)


class BatchExtractionPayload(BaseModel):
    items: list[BatchExtractionItem] = Field(min_length=1, max_length=30)


@dataclass(frozen=True)
class BatchEvidence:
    correlation_id: str
    evidence_type: str
    text: str


def _batch_extraction_prompt(items: list[BatchEvidence], taxonomy: list[Skill]) -> str:
    taxonomy_context = [
        {"skill_id": str(skill.id), "name": skill.canonical_name, "aliases": skill.aliases or []}
        for skill in taxonomy
    ]
    evidence_items = [
        {
            "correlation_id": item.correlation_id,
            "evidence_type": item.evidence_type,
            "evidence": item.text,
        }
        for item in items
    ]
    return (
        "For each evidence item, extract only explicit technical skills. Return every "
        "correlation_id exactly once, even when its skills list is empty. Never infer "
        "identity, demographics, background, verification, scores, or non-skills. Use "
        "only exact names from Candidate taxonomy and copy each evidence_span verbatim "
        "from that item's evidence. Candidate taxonomy: "
        + json.dumps(taxonomy_context)
        + "\nEvidence items:\n"
        + json.dumps(evidence_items)
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


def _batch_extraction_response_schema() -> dict[str, object]:
    candidate_schema = cast(
        dict[str, object],
        cast(dict[str, object], _extraction_response_schema()["properties"])[
            "skills"
        ],
    )
    return {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "minItems": 1,
                "maxItems": 30,
                "items": {
                    "type": "object",
                    "properties": {
                        "correlation_id": {"type": "string"},
                        "skills": candidate_schema,
                    },
                    "required": ["correlation_id", "skills"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["items"],
        "additionalProperties": False,
    }


@dataclass(frozen=True)
class ProviderExtraction:
    payload: ExtractionPayload
    provider: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None


@dataclass(frozen=True)
class ProviderBatchExtraction:
    payload: BatchExtractionPayload
    provider: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None


@dataclass(frozen=True)
class ProviderAttemptTrace:
    provider: str
    model: str
    outcome: str
    latency_ms: int
    input_tokens: int | None = None
    output_tokens: int | None = None
    error_code: str | None = None


class ExtractionAdapter(Protocol):
    provider: str
    model: str
    last_input_tokens: int | None
    last_output_tokens: int | None

    async def extract(
        self, evidence_type: str, evidence_text: str, taxonomy: list[Skill]
    ) -> ExtractionPayload: ...

    async def extract_batch(
        self, items: list[BatchEvidence], taxonomy: list[Skill]
    ) -> BatchExtractionPayload: ...


class LocalExtractor:
    provider = "local_fallback"
    model = "deterministic_taxonomy_v1"
    last_input_tokens: int | None = None
    last_output_tokens: int | None = None

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

    async def extract_batch(
        self, items: list[BatchEvidence], taxonomy: list[Skill]
    ) -> BatchExtractionPayload:
        results = []
        for item in items:
            payload = await self.extract(item.evidence_type, item.text, taxonomy)
            results.append(
                {"correlation_id": item.correlation_id, "skills": payload.skills}
            )
        return BatchExtractionPayload.model_validate({"items": results})


class GeminiExtractor:
    provider = "gemini"

    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.extraction_model
        self.api_key = settings.gemini_api_key
        self.last_input_tokens: int | None = None
        self.last_output_tokens: int | None = None

    async def _generate(
        self, prompt: str, schema: dict[str, object]
    ) -> tuple[str, dict[str, object]]:
        if not self.api_key:
            raise ExtractionFailure(
                "gemini_not_configured",
                retryable=False,
                user_message="Extraction is not configured. Please contact support.",
            )
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
                headers={"x-goog-api-key": self.api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "responseJsonSchema": schema,
                    },
                },
            )
            response.raise_for_status()
        try:
            body = response.json()
            usage = body.get("usageMetadata", {})
            self.last_input_tokens = _optional_int(usage.get("promptTokenCount"))
            self.last_output_tokens = _optional_int(usage.get("candidatesTokenCount"))
            raw = body["candidates"][0]["content"]["parts"][0]["text"]
            if not isinstance(raw, str) or not raw.strip():
                raise ProviderResponseError()
            return raw, body
        except (IndexError, KeyError, TypeError, ValueError) as error:
            raise ProviderResponseError() from error

    async def extract(
        self, evidence_type: str, evidence_text: str, taxonomy: list[Skill]
    ) -> ExtractionPayload:
        try:
            raw, _ = await self._generate(
                _extraction_prompt(evidence_type, evidence_text, taxonomy),
                _extraction_response_schema(),
            )
            return ExtractionPayload.model_validate_json(raw)
        except ValidationError as error:
            raise ProviderResponseError() from error

    async def extract_batch(
        self, items: list[BatchEvidence], taxonomy: list[Skill]
    ) -> BatchExtractionPayload:
        try:
            raw, _ = await self._generate(
                _batch_extraction_prompt(items, taxonomy),
                _batch_extraction_response_schema(),
            )
            return BatchExtractionPayload.model_validate_json(raw)
        except ValidationError as error:
            raise ProviderResponseError() from error


def _optional_int(value: object) -> int | None:
    return int(value) if isinstance(value, int | float) else None


class OpenAICompatibleExtractor:
    provider = "openai_compatible"
    model = ""
    endpoint = ""
    api_key: str | None = None
    timeout_seconds = 20
    require_parameters = False

    def __init__(self) -> None:
        self.last_input_tokens: int | None = None
        self.last_output_tokens: int | None = None

    async def _generate(self, prompt: str, schema: dict[str, object]) -> str:
        if not self.api_key and self.provider != "huggingface_local":
            raise ExtractionFailure(
                f"{self.provider}_not_configured",
                retryable=False,
                user_message="Extraction is not configured. Please contact support.",
            )
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body: dict[str, object] = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "skill_extraction",
                    "strict": True,
                    "schema": schema,
                },
            },
            "temperature": 0,
        }
        if self.require_parameters:
            body["provider"] = {"require_parameters": True}
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(self.endpoint, headers=headers, json=body)
            response.raise_for_status()
        try:
            response_body = response.json()
            usage = response_body.get("usage", {})
            self.last_input_tokens = _optional_int(usage.get("prompt_tokens"))
            self.last_output_tokens = _optional_int(usage.get("completion_tokens"))
            raw = response_body["choices"][0]["message"]["content"]
            if not isinstance(raw, str) or not raw.strip():
                raise ProviderResponseError()
            return raw
        except (IndexError, KeyError, TypeError, ValueError) as error:
            raise ProviderResponseError() from error

    async def extract(
        self, evidence_type: str, evidence_text: str, taxonomy: list[Skill]
    ) -> ExtractionPayload:
        try:
            raw = await self._generate(
                _extraction_prompt(evidence_type, evidence_text, taxonomy),
                _extraction_response_schema(),
            )
            return ExtractionPayload.model_validate_json(raw)
        except ValidationError as error:
            raise ProviderResponseError() from error

    async def extract_batch(
        self, items: list[BatchEvidence], taxonomy: list[Skill]
    ) -> BatchExtractionPayload:
        try:
            raw = await self._generate(
                _batch_extraction_prompt(items, taxonomy),
                _batch_extraction_response_schema(),
            )
            return BatchExtractionPayload.model_validate_json(raw)
        except ValidationError as error:
            raise ProviderResponseError() from error


class GroqExtractor(OpenAICompatibleExtractor):
    provider = "groq"
    _strict_models: ClassVar[set[str]] = {
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
    }

    def __init__(self) -> None:
        super().__init__()
        settings = get_settings()
        self.model = settings.groq_extraction_model
        self.api_key = settings.groq_api_key
        self.endpoint = "https://api.groq.com/openai/v1/chat/completions"


class OpenRouterExtractor(OpenAICompatibleExtractor):
    provider = "openrouter"
    require_parameters = True

    def __init__(self) -> None:
        super().__init__()
        settings = get_settings()
        self.model = settings.openrouter_extraction_model
        self.api_key = settings.openrouter_api_key
        self.endpoint = "https://openrouter.ai/api/v1/chat/completions"


class HuggingFaceEndpointExtractor(OpenAICompatibleExtractor):
    provider = "huggingface_local"

    def __init__(self) -> None:
        super().__init__()
        settings = get_settings()
        self.model = settings.hf_extraction_model
        self.api_key = settings.hf_extraction_api_key
        endpoint = (settings.hf_extraction_endpoint or "").rstrip("/")
        if endpoint.endswith("/v1/chat/completions"):
            self.endpoint = endpoint
        elif endpoint.endswith("/v1"):
            self.endpoint = endpoint + "/chat/completions"
        else:
            self.endpoint = endpoint + "/v1/chat/completions"
        self.timeout_seconds = settings.hf_extraction_timeout_seconds


class CohereExtractor:
    provider = "cohere"

    def __init__(self) -> None:
        settings = get_settings()
        self.model = settings.cohere_extraction_model
        self.api_key = settings.cohere_api_key
        self.last_input_tokens: int | None = None
        self.last_output_tokens: int | None = None

    async def _generate(self, prompt: str, schema: dict[str, object]) -> str:
        if not self.api_key:
            raise ExtractionFailure(
                "cohere_not_configured",
                retryable=False,
                user_message="Extraction is not configured. Please contact support.",
            )
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://api.cohere.com/v2/chat",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": prompt}],
                    "response_format": {
                        "type": "json_object",
                        "schema": schema,
                    },
                    "temperature": 0,
                },
            )
            response.raise_for_status()
        try:
            body = response.json()
            billed = body.get("usage", {}).get("billed_units", {})
            self.last_input_tokens = _optional_int(billed.get("input_tokens"))
            self.last_output_tokens = _optional_int(billed.get("output_tokens"))
            raw = body["message"]["content"][0]["text"]
            if not isinstance(raw, str) or not raw.strip():
                raise ProviderResponseError()
            return raw
        except (IndexError, KeyError, TypeError, ValueError) as error:
            raise ProviderResponseError() from error

    async def extract(
        self, evidence_type: str, evidence_text: str, taxonomy: list[Skill]
    ) -> ExtractionPayload:
        try:
            return ExtractionPayload.model_validate_json(
                await self._generate(
                    _extraction_prompt(evidence_type, evidence_text, taxonomy),
                    _extraction_response_schema(),
                )
            )
        except ValidationError as error:
            raise ProviderResponseError() from error

    async def extract_batch(
        self, items: list[BatchEvidence], taxonomy: list[Skill]
    ) -> BatchExtractionPayload:
        try:
            return BatchExtractionPayload.model_validate_json(
                await self._generate(
                    _batch_extraction_prompt(items, taxonomy),
                    _batch_extraction_response_schema(),
                )
            )
        except ValidationError as error:
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
    if provider == "cohere":
        return CohereExtractor()
    if provider == "openrouter":
        return OpenRouterExtractor()
    if provider == "local":
        return LocalExtractor()
    raise ExtractionFailure(
        "provider_configuration_error",
        retryable=False,
        user_message="Extraction provider configuration is unavailable. Please contact support.",
    )


async def extract_with_fallback(
    evidence_type: str,
    evidence_text: str,
    taxonomy: list[Skill],
    traces: list[ProviderAttemptTrace] | None = None,
) -> ProviderExtraction:
    chain = _provider_chain()
    for index, provider_name in enumerate(chain):
        adapter = _adapter(provider_name)
        started = time.monotonic()
        try:
            payload = await adapter.extract(evidence_type, evidence_text, taxonomy)
            elapsed = int((time.monotonic() - started) * 1_000)
            if traces is not None:
                traces.append(
                    ProviderAttemptTrace(
                        adapter.provider,
                        adapter.model,
                        "completed",
                        elapsed,
                        getattr(adapter, "last_input_tokens", None),
                        getattr(adapter, "last_output_tokens", None),
                    )
                )
            return ProviderExtraction(
                payload,
                adapter.provider,
                adapter.model,
                getattr(adapter, "last_input_tokens", None),
                getattr(adapter, "last_output_tokens", None),
            )
        except Exception as error:
            failure = _classify_failure(error)
            if traces is not None:
                traces.append(
                    ProviderAttemptTrace(
                        adapter.provider,
                        adapter.model,
                        "failed",
                        int((time.monotonic() - started) * 1_000),
                        error_code=failure.code,
                    )
                )
            if not failure.retryable or index == len(chain) - 1:
                raise failure from error
    raise ExtractionFailure(
        "provider_unavailable",
        retryable=True,
        user_message="Extraction is temporarily unavailable and will retry automatically.",
    )


def _validate_batch_correlations(
    payload: BatchExtractionPayload, items: list[BatchEvidence]
) -> None:
    expected = {item.correlation_id for item in items}
    actual = [item.correlation_id for item in payload.items]
    if len(actual) != len(set(actual)) or set(actual) != expected:
        raise ProviderResponseError()


async def extract_batch_with_fallback(
    items: list[BatchEvidence],
    taxonomy: list[Skill],
    traces: list[ProviderAttemptTrace] | None = None,
) -> ProviderBatchExtraction:
    chain = _provider_chain()
    for index, provider_name in enumerate(chain):
        adapter = _adapter(provider_name)
        started = time.monotonic()
        try:
            payload = await adapter.extract_batch(items, taxonomy)
            _validate_batch_correlations(payload, items)
            elapsed = int((time.monotonic() - started) * 1_000)
            if traces is not None:
                traces.append(
                    ProviderAttemptTrace(
                        adapter.provider,
                        adapter.model,
                        "completed",
                        elapsed,
                        getattr(adapter, "last_input_tokens", None),
                        getattr(adapter, "last_output_tokens", None),
                    )
                )
            return ProviderBatchExtraction(
                payload,
                adapter.provider,
                adapter.model,
                getattr(adapter, "last_input_tokens", None),
                getattr(adapter, "last_output_tokens", None),
            )
        except Exception as error:
            failure = _classify_failure(error)
            if traces is not None:
                traces.append(
                    ProviderAttemptTrace(
                        adapter.provider,
                        adapter.model,
                        "failed",
                        int((time.monotonic() - started) * 1_000),
                        error_code=failure.code,
                    )
                )
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
    asyncio.create_task(process_evidence_job(evidence_id))
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


async def _claim_resume_siblings(
    session: AsyncSession, trigger: Evidence
) -> list[Evidence]:
    settings = get_settings()
    if trigger.resume_document_id is None:
        return []
    max_units = getattr(settings, "extraction_batch_max_units", 12)
    max_characters = getattr(settings, "extraction_batch_max_characters", 12_000)
    candidates = list(
        (
            await session.execute(
                select(Evidence, ExtractionJob)
                .join(ExtractionJob, ExtractionJob.evidence_id == Evidence.id)
                .where(
                    Evidence.resume_document_id == trigger.resume_document_id,
                    Evidence.id != trigger.id,
                    ExtractionJob.status.in_(
                        [
                            ExtractionJobStatus.pending,
                            ExtractionJobStatus.queued,
                            ExtractionJobStatus.retry_scheduled,
                        ]
                    ),
                )
                .order_by(Evidence.id)
                .limit(max_units - 1)
                .with_for_update(skip_locked=True)
            )
        ).all()
    )
    claimed: list[Evidence] = []
    used_characters = len(trigger.description)
    for candidate, job in candidates:
        if used_characters + len(candidate.description) > max_characters:
            break
        if (
            job.status == ExtractionJobStatus.retry_scheduled
            and job.next_retry_at is not None
            and job.next_retry_at > _now()
        ):
            continue
        job.status = ExtractionJobStatus.processing
        job.attempt_count += 1
        job.started_at = _now()
        job.next_retry_at = None
        job.user_message = None
        candidate.extraction_status = ExtractionStatus.processing
        session.add(
            _audit(
                candidate,
                "extraction_job_started",
                {"attempt": job.attempt_count, "batch_lease": True},
            )
        )
        claimed.append(candidate)
        used_characters += len(candidate.description)
    if claimed:
        await session.commit()
    return claimed


def _attempt(
    job: ExtractionJob,
    evidence: Evidence,
    batch_id: UUID,
    stage: str,
    outcome: str,
    *,
    provider: str | None = None,
    model: str | None = None,
    cache_hit: bool = False,
    request_count: int = 0,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    latency_ms: int | None = None,
    error_code: str | None = None,
) -> ExtractionAttempt:
    return ExtractionAttempt(
        extraction_job_id=job.id,
        resume_document_id=evidence.resume_document_id,
        batch_id=batch_id,
        stage=stage,
        outcome=outcome,
        provider=provider,
        model=model,
        cache_hit=cache_hit,
        request_count=request_count,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=latency_ms,
        error_code=error_code,
    )


def _cache_payload(
    candidates: list[NormalizedCandidate], evidence_text: str
) -> dict[str, object]:
    values: list[dict[str, object]] = []
    for candidate in candidates:
        match = re.search(
            re.escape(candidate.evidence_span), evidence_text, flags=re.IGNORECASE
        )
        if match is None:
            raise ExtractionValidationError()
        start = match.start()
        values.append(
            {
                "skill_id": str(candidate.skill.id),
                "confidence": candidate.confidence,
                "start": start,
                "end": start + len(candidate.evidence_span),
                "proficiency_hint": candidate.proficiency_hint,
            }
        )
    return {"candidates": values}


def _candidates_from_cache(
    cache: ExtractionCacheEntry, evidence_text: str, taxonomy: list[Skill]
) -> list[NormalizedCandidate] | None:
    skills = {str(skill.id): skill for skill in taxonomy}
    raw_candidates = cache.payload.get("candidates")
    if not isinstance(raw_candidates, list):
        return None
    candidates: list[NormalizedCandidate] = []
    seen: set[UUID] = set()
    try:
        for raw in raw_candidates:
            if not isinstance(raw, dict):
                return None
            skill = skills.get(str(raw["skill_id"]))
            start, end = int(raw["start"]), int(raw["end"])
            confidence = float(raw["confidence"])
            if (
                skill is None
                or skill.id in seen
                or start < 0
                or end <= start
                or end > len(evidence_text)
                or not 0 <= confidence <= 1
            ):
                return None
            span = evidence_text[start:end]
            if not span.strip():
                return None
            hint = raw.get("proficiency_hint")
            if hint not in {None, "beginner", "intermediate", "advanced"}:
                return None
            seen.add(skill.id)
            candidates.append(
                NormalizedCandidate(skill, confidence, span, cast(str | None, hint))
            )
    except (KeyError, TypeError, ValueError):
        return None
    return candidates


async def _cache_lookup(
    session: AsyncSession,
    evidence: Evidence,
    taxonomy: list[Skill],
) -> tuple[ExtractionCacheEntry | None, list[NormalizedCandidate] | None]:
    if not getattr(get_settings(), "extraction_cache_enabled", True):
        return None, None
    cache = await session.scalar(
        select(ExtractionCacheEntry).where(
            ExtractionCacheEntry.student_id == evidence.student_id,
            ExtractionCacheEntry.evidence_type == evidence.evidence_type.value,
            ExtractionCacheEntry.content_fingerprint
            == content_fingerprint(evidence.description),
            ExtractionCacheEntry.config_fingerprint
            == extraction_config_fingerprint(taxonomy),
        )
    )
    if cache is None:
        return None, None
    return cache, _candidates_from_cache(cache, evidence.description, taxonomy)


async def _store_cache(
    session: AsyncSession,
    evidence: Evidence,
    taxonomy: list[Skill],
    candidates: list[NormalizedCandidate],
    provider: str,
    model: str,
) -> None:
    if not getattr(get_settings(), "extraction_cache_enabled", True):
        return
    content_key = content_fingerprint(evidence.description)
    config_key = extraction_config_fingerprint(taxonomy)
    existing = await session.scalar(
        select(ExtractionCacheEntry.id).where(
            ExtractionCacheEntry.student_id == evidence.student_id,
            ExtractionCacheEntry.evidence_type == evidence.evidence_type.value,
            ExtractionCacheEntry.content_fingerprint == content_key,
            ExtractionCacheEntry.config_fingerprint == config_key,
        )
    )
    if existing is None:
        try:
            async with session.begin_nested():
                session.add(
                    ExtractionCacheEntry(
                        student_id=evidence.student_id,
                        evidence_type=evidence.evidence_type.value,
                        content_fingerprint=content_key,
                        config_fingerprint=config_key,
                        payload=_cache_payload(candidates, evidence.description),
                        source_provider=provider,
                        source_model=model,
                    )
                )
                await session.flush()
        except IntegrityError:
            # A concurrent job populated the same student-scoped cache key.
            pass


async def _complete_job(
    session: AsyncSession,
    evidence: Evidence,
    candidates: list[NormalizedCandidate],
    provider: str,
    model: str,
    batch_id: UUID,
    stage: str,
    *,
    cache_hit: bool = False,
    taxonomy: list[Skill] | None = None,
) -> None:
    job = await _locked_job(session, evidence.id)
    if job is None:
        raise ExtractionFailure(
            "job_missing",
            retryable=False,
            user_message="Extraction could not be completed. Please retry later.",
        )
    await session.execute(
        delete(StudentSkill).where(StudentSkill.source_evidence_id == evidence.id)
    )
    for candidate in candidates:
        session.add(
            StudentSkill(
                student_id=evidence.student_id,
                skill_id=candidate.skill.id,
                source_evidence_id=evidence.id,
                extraction_confidence=candidate.confidence,
                verification_tier=VerificationTier.unverified,
                proficiency_hint=candidate.proficiency_hint,
                evidence_span=candidate.evidence_span,
            )
        )
    job.status = ExtractionJobStatus.completed
    job.provider = provider
    job.completed_at = _now()
    job.next_retry_at = None
    job.last_error = None
    job.user_message = None
    evidence.extraction_status = ExtractionStatus.extracted
    session.add(
        _attempt(
            job,
            evidence,
            batch_id,
            stage,
            "completed",
            provider=provider,
            model=model,
            cache_hit=cache_hit,
        )
    )
    session.add(
        _audit(
            evidence,
            "extraction_job_completed",
            {
                "attempt": job.attempt_count,
                "provider": provider,
                "model": model,
                "skill_count": len(candidates),
                "pipeline_stage": stage,
                "cache_hit": cache_hit,
            },
        )
    )
    if taxonomy is not None and not cache_hit:
        await _store_cache(
            session, evidence, taxonomy, candidates, provider, model
        )
    await session.commit()


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


async def _record_failure(
    session: AsyncSession,
    evidence_id: UUID,
    error: Exception,
    *,
    batch_id: UUID | None = None,
    traces: list[ProviderAttemptTrace] | None = None,
) -> None:
    await session.rollback()
    job = await _locked_job(session, evidence_id)
    evidence = await session.get(Evidence, evidence_id)
    if job is None or evidence is None:
        return
    failure = _classify_failure(error)
    active_batch_id = batch_id or uuid4()
    if traces:
        for trace in traces:
            session.add(
                _attempt(
                    job,
                    evidence,
                    active_batch_id,
                    "provider",
                    trace.outcome,
                    provider=trace.provider,
                    model=trace.model,
                    request_count=0 if trace.provider == "local_fallback" else 1,
                    input_tokens=trace.input_tokens,
                    output_tokens=trace.output_tokens,
                    latency_ms=trace.latency_ms,
                    error_code=trace.error_code,
                )
            )
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


async def _extract_single_legacy(
    session: AsyncSession, evidence: Evidence
) -> str:
    """Compatibility path used by isolated tests and pre-v2 configuration."""
    try:
        taxonomy = list((await session.scalars(select(Skill).order_by(Skill.canonical_name))).all())
        extraction = await extract_with_fallback(
            evidence.evidence_type.value, evidence.description, taxonomy
        )
        candidates = normalize_candidates(
            extraction.payload, evidence.description, taxonomy
        )
        job = await _locked_job(session, evidence.id)
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
        await _record_failure(session, evidence.id, error)
        logger.warning("extraction_job_failed evidence_id=%s error_code=%s", evidence.id, _classify_failure(error).code)
        return "failed"


def _merge_candidates(
    current: list[NormalizedCandidate], additional: list[NormalizedCandidate]
) -> list[NormalizedCandidate]:
    seen = {candidate.skill.id for candidate in current}
    merged = list(current)
    for candidate in additional:
        if candidate.skill.id not in seen:
            seen.add(candidate.skill.id)
            merged.append(candidate)
    return merged


def _provider_groups(
    values: list[tuple[Evidence, ExtractionUnit]],
    max_units: int,
    max_characters: int,
) -> list[list[tuple[Evidence, ExtractionUnit]]]:
    groups: list[list[tuple[Evidence, ExtractionUnit]]] = []
    current: list[tuple[Evidence, ExtractionUnit]] = []
    characters = 0
    for value in values:
        length = len(value[1].text)
        if current and (len(current) >= max_units or characters + length > max_characters):
            groups.append(current)
            current = []
            characters = 0
        current.append(value)
        characters += length
    if current:
        groups.append(current)
    return groups


async def _record_traces(
    session: AsyncSession,
    evidence: Evidence,
    batch_id: UUID,
    traces: list[ProviderAttemptTrace],
    *,
    stage: str = "provider",
) -> None:
    job = await _locked_job(session, evidence.id)
    if job is None:
        return
    for trace in traces:
        session.add(
            _attempt(
                job,
                evidence,
                batch_id,
                stage,
                trace.outcome,
                provider=trace.provider,
                model=trace.model,
                request_count=(
                    0
                    if stage == "provider" and trace.provider == "local_fallback"
                    else 1
                ),
                input_tokens=trace.input_tokens,
                output_tokens=trace.output_tokens,
                latency_ms=trace.latency_ms,
                error_code=trace.error_code,
            )
        )


async def _extract_hybrid_batch(
    session: AsyncSession, trigger: Evidence
) -> str:
    settings = get_settings()
    evidences = [trigger, *(await _claim_resume_siblings(session, trigger))]
    taxonomy = list(
        (await session.scalars(select(Skill).order_by(Skill.canonical_name))).all()
    )
    batch_id = uuid4()
    pending: list[tuple[Evidence, ExtractionUnit]] = []
    resolved: dict[UUID, list[NormalizedCandidate]] = {}
    required_units: dict[UUID, int] = {}
    successful_units: dict[UUID, int] = {}
    provider_by_evidence: dict[UUID, tuple[str, str]] = {}
    sensitive_by_student: dict[UUID, list[str]] = {}

    for evidence in evidences:
        units = semantic_chunks(
            evidence.description,
            evidence.resume_section or evidence.evidence_type.value,
            correlation_prefix=str(evidence.id),
        )
        decisions = [(unit, deterministic_gate(unit, taxonomy)) for unit in units]
        deterministic_candidates: list[NormalizedCandidate] = []
        for _, decision in decisions:
            deterministic_candidates = _merge_candidates(
                deterministic_candidates,
                [
                    NormalizedCandidate(
                        candidate.skill,
                        candidate.confidence,
                        candidate.evidence_span,
                        None,
                    )
                    for candidate in decision.candidates
                ],
            )
        unresolved = [unit for unit, decision in decisions if decision.requires_model]
        if unresolved:
            cache, cached_candidates = await _cache_lookup(session, evidence, taxonomy)
            if cache is not None and cached_candidates is not None:
                await _complete_job(
                    session,
                    evidence,
                    cached_candidates,
                    cache.source_provider,
                    cache.source_model,
                    batch_id,
                    "cache",
                    cache_hit=True,
                )
                continue
            resolved[evidence.id] = deterministic_candidates
            required_units[evidence.id] = len(unresolved)
            successful_units[evidence.id] = 0
            pending.extend((evidence, unit) for unit in unresolved)
            continue
        await _complete_job(
            session,
            evidence,
            deterministic_candidates,
            "deterministic",
            "deterministic_taxonomy_v2",
            batch_id,
            "deterministic",
            taxonomy=taxonomy,
        )

    max_units = getattr(settings, "extraction_batch_max_units", 12)
    max_characters = getattr(settings, "extraction_batch_max_characters", 12_000)
    failed_evidence: set[UUID] = set()
    prior_by_student: dict[UUID, list[Skill]] = {}
    for group in _provider_groups(pending, max_units, max_characters):
        active_group = [item for item in group if item[0].id not in failed_evidence]
        if not active_group:
            continue
        provider_texts: list[str] = []
        for evidence, unit in active_group:
            if evidence.student_id not in sensitive_by_student:
                student = await session.get(Student, evidence.student_id)
                sensitive_by_student[evidence.student_id] = (
                    []
                    if student is None
                    else [
                        student.full_name,
                        student.email,
                        student.university or "",
                        str(student.graduation_year or ""),
                    ]
                )
            provider_texts.append(
                sanitize_provider_text(
                    unit.text, sensitive_by_student[evidence.student_id]
                )
            )
        shortlisted: dict[UUID, Skill] = {}
        retrieved_groups, embedded = await retrieve_taxonomy_candidates_many(
            session, provider_texts, taxonomy
        )
        for (evidence, _unit), retrieved in zip(
            active_group, retrieved_groups, strict=True
        ):
            for item in retrieved:
                shortlisted[item.skill.id] = item.skill
            if evidence.student_id not in prior_by_student:
                prior_by_student[evidence.student_id] = await prior_verified_skills(
                    session, evidence.student_id
                )
            for skill in prior_by_student[evidence.student_id]:
                shortlisted[skill.id] = skill
            job = await _locked_job(session, evidence.id)
            if job is not None:
                session.add(
                    _attempt(
                        job,
                        evidence,
                        batch_id,
                        "retrieval",
                        "completed",
                        provider=(
                            get_settings().embedding_provider if embedded else "lexical"
                        ),
                        model=(get_settings().embedding_model if embedded else None),
                        request_count=(
                            1
                            if embedded and (evidence, _unit) == active_group[0]
                            else 0
                        ),
                    )
                )
        # Retrieval is a completed, independently auditable pipeline stage.
        # Persist it before provider I/O so a fail-closed provider response does
        # not roll back truthful RAG request accounting.
        await session.commit()
        provider_items = [
            BatchEvidence(
                unit.correlation_id, evidence.evidence_type.value, provider_text
            )
            for (evidence, unit), provider_text in zip(
                active_group, provider_texts, strict=True
            )
        ]
        traces: list[ProviderAttemptTrace] = []
        extraction: ProviderBatchExtraction | None = None
        if getattr(settings, "hf_extraction_enabled", False):
            adapter = HuggingFaceEndpointExtractor()
            started = time.monotonic()
            try:
                payload = await adapter.extract_batch(
                    provider_items, list(shortlisted.values())
                )
                _validate_batch_correlations(payload, provider_items)
                trace = ProviderAttemptTrace(
                    adapter.provider,
                    adapter.model,
                    "completed",
                    int((time.monotonic() - started) * 1_000),
                    adapter.last_input_tokens,
                    adapter.last_output_tokens,
                )
                await _record_traces(
                    session, active_group[0][0], batch_id, [trace], stage="local_model"
                )
                extraction = ProviderBatchExtraction(
                    payload,
                    adapter.provider,
                    adapter.model,
                    adapter.last_input_tokens,
                    adapter.last_output_tokens,
                )
            except (ExtractionFailure, httpx.HTTPError) as error:
                failure = _classify_failure(error)
                trace = ProviderAttemptTrace(
                    adapter.provider,
                    adapter.model,
                    "failed",
                    int((time.monotonic() - started) * 1_000),
                    error_code=failure.code,
                )
                await _record_traces(
                    session, active_group[0][0], batch_id, [trace], stage="local_model"
                )
        if extraction is None:
            try:
                extraction = await extract_batch_with_fallback(
                    provider_items, list(shortlisted.values()), traces
                )
                await _record_traces(
                    session, active_group[0][0], batch_id, traces
                )
            except ExtractionFailure as error:
                affected = {evidence.id: evidence for evidence, _ in active_group}
                first = True
                for evidence in affected.values():
                    await _record_failure(
                        session,
                        evidence.id,
                        error,
                        batch_id=batch_id,
                        traces=traces if first else None,
                    )
                    failed_evidence.add(evidence.id)
                    first = False
                continue
        unit_by_id = {unit.correlation_id: (evidence, unit) for evidence, unit in active_group}
        try:
            for extracted_item in extraction.payload.items:
                evidence, unit = unit_by_id[extracted_item.correlation_id]
                normalized = normalize_candidates(
                    ExtractionPayload(skills=extracted_item.skills), unit.text, taxonomy
                )
                resolved[evidence.id] = _merge_candidates(
                    resolved[evidence.id], normalized
                )
                successful_units[evidence.id] += 1
                provider_by_evidence[evidence.id] = (
                    extraction.provider,
                    extraction.model,
                )
        except (ExtractionFailure, KeyError) as error:
            affected = {evidence.id: evidence for evidence, _ in active_group}
            for evidence in affected.values():
                await _record_failure(
                    session, evidence.id, error, batch_id=batch_id
                )
                failed_evidence.add(evidence.id)

    evidence_by_id = {evidence.id: evidence for evidence in evidences}
    for evidence_id, count in successful_units.items():
        if evidence_id in failed_evidence or count != required_units[evidence_id]:
            continue
        provider, model = provider_by_evidence[evidence_id]
        await _complete_job(
            session,
            evidence_by_id[evidence_id],
            resolved[evidence_id],
            provider,
            model,
            batch_id,
            "provider",
            taxonomy=taxonomy,
        )
    trigger_job = await _locked_job(session, trigger.id)
    return (
        "completed"
        if trigger_job is not None and trigger_job.status == ExtractionJobStatus.completed
        else "failed"
    )


async def extract_evidence(session: AsyncSession, evidence_id: UUID) -> str:
    """Claim and run the configured extraction pipeline without duplicate skills."""
    evidence = await _claim_job(session, evidence_id)
    if evidence is None:
        return "ignored"
    if getattr(get_settings(), "extraction_schema_version", None) != "v2-hybrid-batch":
        return await _extract_single_legacy(session, evidence)
    try:
        return await _extract_hybrid_batch(session, evidence)
    except Exception as error:  # noqa: BLE001 - worker boundary must isolate all jobs.
        await _record_failure(session, evidence.id, error)
        logger.warning(
            "hybrid_extraction_failed evidence_id=%s error_code=%s",
            evidence.id,
            _classify_failure(error).code,
        )
        return "failed"


async def extraction_metrics_for_resume(
    session: AsyncSession, resume_document_id: UUID
) -> dict[str, object]:
    """Return safe call accounting without prompts, evidence text, or provider bodies."""
    jobs = list(
        (
            await session.scalars(
                select(ExtractionJob)
                .join(Evidence, Evidence.id == ExtractionJob.evidence_id)
                .where(Evidence.resume_document_id == resume_document_id)
            )
        ).all()
    )
    attempts = list(
        (
            await session.scalars(
                select(ExtractionAttempt)
                .where(ExtractionAttempt.resume_document_id == resume_document_id)
                .order_by(ExtractionAttempt.created_at, ExtractionAttempt.id)
            )
        ).all()
    )
    provider_calls: dict[str, dict[str, int]] = {}
    for attempt in attempts:
        if attempt.stage != "provider" or not attempt.provider:
            continue
        values = provider_calls.setdefault(
            attempt.provider,
            {"calls": 0, "input_tokens": 0, "output_tokens": 0, "failures": 0},
        )
        values["calls"] += attempt.request_count
        values["input_tokens"] += attempt.input_tokens or 0
        values["output_tokens"] += attempt.output_tokens or 0
        values["failures"] += int(attempt.outcome == "failed")
    completed = sum(job.status == ExtractionJobStatus.completed for job in jobs)
    failed = sum(
        job.status in {ExtractionJobStatus.failed, ExtractionJobStatus.dead_lettered}
        for job in jobs
    )
    return {
        "resume_document_id": str(resume_document_id),
        "total_jobs": len(jobs),
        "completed_jobs": completed,
        "failed_jobs": failed,
        "pending_jobs": len(jobs) - completed - failed,
        "deterministic_resolutions": sum(
            attempt.stage == "deterministic" and attempt.outcome == "completed"
            for attempt in attempts
        ),
        "cache_hits": sum(attempt.cache_hit for attempt in attempts),
        "duplicate_work_avoided": sum(attempt.cache_hit for attempt in attempts),
        "rag_embedding_requests": sum(
            attempt.request_count
            for attempt in attempts
            if attempt.stage == "retrieval"
        ),
        "local_model_calls": sum(
            attempt.request_count
            for attempt in attempts
            if attempt.stage == "local_model"
        ),
        "fallbacks": sum(
            attempt.stage == "provider" and attempt.outcome == "failed"
            for attempt in attempts
        ),
        "retries": sum(max(job.attempt_count - 1, 0) for job in jobs),
        "providers": provider_calls,
    }


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
