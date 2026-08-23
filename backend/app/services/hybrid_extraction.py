"""Deterministic, privacy-preserving preprocessing for skill extraction."""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterable
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import Float, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import Skill, StudentSkill, VerificationTier
from app.services.embeddings import EmbeddingError, cosine_similarity, embedding_service

UNIT_TARGET_CHARACTERS = 1_500
UNIT_OVERLAP_CHARACTERS = 150
DETERMINISTIC_CONFIDENCE = 0.80
TECHNICAL_SIGNALS = re.compile(
    r"\b(?:api|application|backend|cloud|code|database|deploy|develop|framework|"
    r"frontend|implement|library|machine learning|model|pipeline|program|service|"
    r"software|stack|system|technical|technology|tool|web)\b",
    re.IGNORECASE,
)
PROTECTED_LABEL_PATTERN = re.compile(
    r"\b(?:age|address|caste|date of birth|disability|dob|ethnicity|gender|gpa|"
    r"marital status|nationality|pronouns|religion|university|college)\b\s*[:=-]\s*[^,;\n]+",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ExtractionUnit:
    correlation_id: str
    section_type: str
    text: str
    source_start: int
    source_end: int


@dataclass(frozen=True)
class DeterministicCandidate:
    skill: Skill
    confidence: float
    evidence_span: str


@dataclass(frozen=True)
class DeterministicDecision:
    candidates: list[DeterministicCandidate]
    requires_model: bool
    reason: str


@dataclass(frozen=True)
class RetrievedSkill:
    skill: Skill
    similarity: float | None
    source: str


def normalize_content(value: str) -> str:
    return " ".join(value.casefold().split())


def sanitize_provider_text(text: str, sensitive_values: Iterable[str]) -> str:
    """Remove identity and protected profile data before any remote AI request."""
    sanitized = re.sub(
        r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
        "[redacted-email]",
        text,
        flags=re.IGNORECASE,
    )
    sanitized = re.sub(
        r"(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)",
        "[redacted-phone]",
        sanitized,
    )
    sanitized = re.sub(
        r"https?://[^\s)>]+", "[redacted-url]", sanitized, flags=re.IGNORECASE
    )
    sanitized = PROTECTED_LABEL_PATTERN.sub("[redacted-attribute]", sanitized)
    for value in sorted(
        {item.strip() for item in sensitive_values if item.strip()},
        key=len,
        reverse=True,
    ):
        sanitized = re.sub(
            re.escape(value), "[redacted-profile]", sanitized, flags=re.IGNORECASE
        )
    return sanitized


def semantic_chunks(
    text: str,
    section_type: str,
    *,
    correlation_prefix: str,
    target: int = UNIT_TARGET_CHARACTERS,
    overlap: int = UNIT_OVERLAP_CHARACTERS,
) -> list[ExtractionUnit]:
    """Split oversized evidence on semantic line/sentence boundaries with offsets."""
    if len(text) <= target:
        return [ExtractionUnit(correlation_prefix, section_type, text, 0, len(text))]
    boundaries = [match.end() for match in re.finditer(r"(?:\n+|(?<=[.!?])\s+)", text)]
    boundaries.append(len(text))
    units: list[ExtractionUnit] = []
    start = 0
    while start < len(text):
        ceiling = min(len(text), start + target)
        end = max((point for point in boundaries if start < point <= ceiling), default=ceiling)
        chunk = text[start:end].strip()
        if chunk:
            leading = len(text[start:end]) - len(text[start:end].lstrip())
            actual_start = start + leading
            units.append(
                ExtractionUnit(
                    f"{correlation_prefix}:{len(units)}",
                    section_type,
                    chunk,
                    actual_start,
                    actual_start + len(chunk),
                )
            )
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return units


def _label_matches(text: str, taxonomy: Iterable[Skill]) -> list[DeterministicCandidate]:
    candidates: list[DeterministicCandidate] = []
    seen: set[UUID] = set()
    for skill in taxonomy:
        labels = sorted(
            {skill.canonical_name, *(skill.aliases or [])}, key=len, reverse=True
        )
        for label in labels:
            match = re.search(
                rf"(?<![\w.+#-]){re.escape(label)}(?![\w.+#-])",
                text,
                flags=re.IGNORECASE,
            )
            if match and skill.id not in seen:
                seen.add(skill.id)
                candidates.append(
                    DeterministicCandidate(
                        skill, DETERMINISTIC_CONFIDENCE, match.group(0)
                    )
                )
                break
    return candidates


def deterministic_gate(
    unit: ExtractionUnit, taxonomy: list[Skill]
) -> DeterministicDecision:
    candidates = _label_matches(unit.text, taxonomy)
    explicit_list = unit.section_type == "skills" or unit.text.casefold().startswith(
        "explicit technical skills listed in resume:"
    )
    if explicit_list:
        listed = unit.text.split(":", 1)[-1]
        tokens = [token.strip() for token in re.split(r"[,;|•]", listed) if token.strip()]
        known_spans = {candidate.evidence_span.casefold() for candidate in candidates}
        unknown = [
            token
            for token in tokens
            if not any(span in token.casefold() or token.casefold() in span for span in known_spans)
        ]
        return DeterministicDecision(
            candidates,
            bool(unknown),
            "explicit_list_ambiguous" if unknown else "explicit_list_resolved",
        )
    if candidates:
        return DeterministicDecision(candidates, False, "exact_taxonomy_resolved")
    if TECHNICAL_SIGNALS.search(unit.text):
        return DeterministicDecision([], True, "technical_prose_ambiguous")
    return DeterministicDecision([], False, "nontechnical_empty")


def taxonomy_fingerprint(taxonomy: list[Skill]) -> str:
    values = [
        {
            "id": str(skill.id),
            "name": skill.canonical_name,
            "aliases": sorted(skill.aliases or [], key=str.casefold),
            "embedding": skill.embedding_fingerprint,
        }
        for skill in sorted(taxonomy, key=lambda item: str(item.id))
    ]
    return hashlib.sha256(
        json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def extraction_config_fingerprint(taxonomy: list[Skill]) -> str:
    settings = get_settings()
    values = {
        "schema": getattr(settings, "extraction_schema_version", "v2-hybrid-batch"),
        "taxonomy": taxonomy_fingerprint(taxonomy),
        "rag_enabled": getattr(settings, "extraction_rag_enabled", True),
        "rag_top_k": getattr(settings, "extraction_rag_top_k", 8),
        "rag_threshold": getattr(settings, "extraction_rag_min_similarity", 0.72),
    }
    return hashlib.sha256(
        json.dumps(values, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def content_fingerprint(text: str) -> str:
    return hashlib.sha256(normalize_content(text).encode()).hexdigest()


async def prior_verified_skills(
    session: AsyncSession, student_id: UUID
) -> list[Skill]:
    return list(
        (
            await session.scalars(
                select(Skill)
                .join(StudentSkill, StudentSkill.skill_id == Skill.id)
                .where(
                    StudentSkill.student_id == student_id,
                    StudentSkill.verification_tier.in_(
                        [VerificationTier.verified, VerificationTier.partially_verified]
                    ),
                )
                .distinct()
                .order_by(Skill.canonical_name)
            )
        ).all()
    )


async def retrieve_taxonomy_candidates(
    session: AsyncSession,
    text: str,
    taxonomy: list[Skill],
) -> tuple[list[RetrievedSkill], bool]:
    results, embedded = await retrieve_taxonomy_candidates_many(
        session, [text], taxonomy
    )
    return results[0], embedded


async def _rank_vector_candidates(
    session: AsyncSession,
    vector: list[float],
    taxonomy: list[Skill],
    top_k: int,
) -> list[tuple[Skill, float]]:
    if session.bind is not None and session.bind.dialect.name == "postgresql":
        # ``Embedding`` uses a JSON type with a PostgreSQL pgvector variant so
        # its ORM comparator is the portable JSON comparator. Invoke pgvector's
        # cosine-distance operator explicitly instead of assuming the Vector
        # comparator is exposed by the variant wrapper.
        distance = Skill.embedding.op("<=>", return_type=Float)(vector)
        rows = (
            await session.execute(
                select(Skill, (1 - distance).label("similarity"))
                .where(Skill.embedding.is_not(None))
                .order_by(distance, Skill.canonical_name)
                .limit(top_k)
            )
        ).all()
        return [(skill, float(similarity)) for skill, similarity in rows]
    return sorted(
        (
            (skill, cosine_similarity(skill.embedding, vector))
            for skill in taxonomy
            if skill.embedding
        ),
        key=lambda item: (-item[1], item[0].canonical_name),
    )[:top_k]


async def retrieve_taxonomy_candidates_many(
    session: AsyncSession,
    texts: list[str],
    taxonomy: list[Skill],
) -> tuple[list[list[RetrievedSkill]], bool]:
    """Retrieve all ambiguous units with at most one embedding API request."""
    settings = get_settings()
    selections = [
        {
            item.skill.id: RetrievedSkill(item.skill, None, "lexical")
            for item in _label_matches(text, taxonomy)
        }
        for text in texts
    ]
    if not getattr(settings, "extraction_rag_enabled", True):
        return [list(selected.values()) for selected in selections], False
    try:
        vectors = await embedding_service().embed_many(texts)
    except EmbeddingError:
        return [list(selected.values()) for selected in selections], False
    top_k = getattr(settings, "extraction_rag_top_k", 8)
    threshold = getattr(settings, "extraction_rag_min_similarity", 0.72)
    for selected, vector in zip(selections, vectors, strict=True):
        ranked = await _rank_vector_candidates(session, vector, taxonomy, top_k)
        for skill, similarity in ranked:
            if similarity >= threshold and skill.id not in selected:
                selected[skill.id] = RetrievedSkill(skill, similarity, "vector")
    return [list(selected.values())[:top_k] for selected in selections], True
