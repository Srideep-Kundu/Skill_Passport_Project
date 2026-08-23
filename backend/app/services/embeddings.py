"""Validated embedding providers and idempotent taxonomy backfill helpers."""

import hashlib
import math
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Skill

VECTOR_DIMENSIONS = 768


class EmbeddingError(Exception):
    pass


class EmbeddingUnavailable(EmbeddingError):
    pass


class InvalidEmbedding(EmbeddingError):
    pass


@dataclass(frozen=True)
class EmbeddingSpec:
    provider: str
    model: str
    dimension: int


def deterministic_embedding(text: str, dimensions: int = VECTOR_DIMENSIONS) -> list[float]:
    """Deterministic test-only vectors. Production never enables this provider."""
    values = [0.0] * dimensions
    for token in text.casefold().split():
        digest = hashlib.sha256(token.encode()).digest()
        values[digest[0] % dimensions] += 1.0 if digest[1] % 2 else -1.0
    return normalize_vector(values, dimensions)


def normalize_vector(values: list[float], dimension: int) -> list[float]:
    if len(values) != dimension or not all(math.isfinite(value) for value in values):
        raise InvalidEmbedding("Embedding has an invalid dimension or value")
    norm = math.sqrt(sum(value * value for value in values))
    if norm == 0:
        raise InvalidEmbedding("Embedding cannot be empty")
    return [value / norm for value in values]


def cosine_similarity(left: list[float] | None, right: list[float] | None) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    denominator = math.sqrt(sum(x * x for x in left)) * math.sqrt(sum(y * y for y in right))
    return max(-1.0, min(1.0, sum(x * y for x, y in zip(left, right)) / denominator)) if denominator else 0.0


def embedding_fingerprint(text: str, spec: EmbeddingSpec) -> str:
    normalized = " ".join(text.casefold().split())
    return hashlib.sha256(f"{spec.provider}|{spec.model}|{spec.dimension}|{normalized}".encode()).hexdigest()


class EmbeddingService:
    def __init__(self, spec: EmbeddingSpec) -> None:
        self.spec = spec

    async def embed(self, text: str) -> list[float]:
        raise NotImplementedError

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        return [await self.embed(text) for text in texts]


class GeminiEmbeddingService(EmbeddingService):
    async def embed(self, text: str) -> list[float]:
        settings = get_settings()
        if not settings.gemini_api_key:
            raise EmbeddingUnavailable("Gemini embeddings are not configured")
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{self.spec.model}:embedContent",
                    headers={"x-goog-api-key": settings.gemini_api_key},
                    json={"model": f"models/{self.spec.model}", "content": {"parts": [{"text": text}]}, "outputDimensionality": self.spec.dimension},
                )
        except (httpx.TimeoutException, httpx.TransportError) as error:
            raise EmbeddingUnavailable("Embedding provider is temporarily unavailable") from error
        if response.status_code == 429 or response.status_code >= 500:
            raise EmbeddingUnavailable("Embedding provider is temporarily unavailable")
        if not response.is_success:
            raise EmbeddingError("Embedding provider rejected the request")
        try:
            values = response.json()["embedding"]["values"]
        except (KeyError, TypeError, ValueError) as error:
            raise InvalidEmbedding("Embedding provider returned an invalid response") from error
        if not isinstance(values, list) or not all(isinstance(value, int | float) for value in values):
            raise InvalidEmbedding("Embedding provider returned an invalid vector")
        return normalize_vector([float(value) for value in values], self.spec.dimension)

    async def embed_many(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        settings = get_settings()
        if not settings.gemini_api_key:
            raise EmbeddingUnavailable("Gemini embeddings are not configured")
        requests = [
            {
                "model": f"models/{self.spec.model}",
                "content": {"parts": [{"text": text}]},
                "outputDimensionality": self.spec.dimension,
            }
            for text in texts
        ]
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{self.spec.model}:batchEmbedContents",
                    headers={"x-goog-api-key": settings.gemini_api_key},
                    json={"requests": requests},
                )
        except (httpx.TimeoutException, httpx.TransportError) as error:
            raise EmbeddingUnavailable(
                "Embedding provider is temporarily unavailable"
            ) from error
        if response.status_code == 429 or response.status_code >= 500:
            raise EmbeddingUnavailable("Embedding provider is temporarily unavailable")
        if not response.is_success:
            raise EmbeddingError("Embedding provider rejected the request")
        try:
            embeddings = response.json()["embeddings"]
            vectors = [embedding["values"] for embedding in embeddings]
        except (KeyError, TypeError, ValueError) as error:
            raise InvalidEmbedding(
                "Embedding provider returned an invalid response"
            ) from error
        if len(vectors) != len(texts):
            raise InvalidEmbedding("Embedding provider returned an incomplete batch")
        return [
            normalize_vector([float(value) for value in values], self.spec.dimension)
            for values in vectors
        ]


def configured_embedding_spec() -> EmbeddingSpec:
    settings = get_settings()
    return EmbeddingSpec(settings.embedding_provider, settings.embedding_model, settings.embedding_dimension)


def embedding_service() -> EmbeddingService:
    spec = configured_embedding_spec()
    if spec.provider != "gemini":
        raise EmbeddingUnavailable("Real embeddings are disabled; configure EMBEDDING_PROVIDER=gemini")
    if spec.dimension != VECTOR_DIMENSIONS:
        raise InvalidEmbedding("Embedding dimension is incompatible with the pgvector schema")
    return GeminiEmbeddingService(spec)


def skill_embedding_text(skill: Skill) -> str:
    return " | ".join([skill.canonical_name, *(skill.aliases or [])])


async def ensure_skill_embedding(session: AsyncSession, skill: Skill, service: EmbeddingService) -> bool:
    text = skill_embedding_text(skill)
    expected = embedding_fingerprint(text, service.spec)
    if skill.embedding_fingerprint == expected and skill.embedding and len(skill.embedding) == service.spec.dimension:
        return False
    vector = await service.embed(text)
    skill.embedding = vector
    skill.embedding_provider = service.spec.provider
    skill.embedding_model = service.spec.model
    skill.embedding_dimension = service.spec.dimension
    skill.embedding_fingerprint = expected
    skill.embedding_generated_at = datetime.now(UTC)
    return True


async def backfill_skill_embeddings(session: AsyncSession, service: EmbeddingService, *, limit: int | None = None) -> int:
    skills = list((await session.scalars(select(Skill).order_by(Skill.canonical_name).limit(limit))).all()) if limit else list((await session.scalars(select(Skill).order_by(Skill.canonical_name))).all())
    updated = 0
    for skill in skills:
        if await ensure_skill_embedding(session, skill, service):
            updated += 1
    if updated:
        await session.commit()
    return updated
