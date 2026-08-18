import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from itertools import combinations
from typing import Any
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import (
    AuditLog,
    ExternalJob,
    ExternalJobMatch,
    ExternalJobMatchExplanation,
    Match,
    MatchExplanation,
    VerificationTier,
)
from app.services.embeddings import cosine_similarity

SCORE_VERSION = "v2-embedding-accounting"
TIER_MULTIPLIER = {VerificationTier.verified.value: 1.0, VerificationTier.partially_verified.value: 0.85, VerificationTier.unverified.value: 0.65}


async def activate_matching_role(session: AsyncSession) -> None:
    if session.get_bind().dialect.name == "postgresql":
        await session.execute(text("SET LOCAL ROLE skill_passport_matcher"))


@dataclass(frozen=True)
class RequirementInput:
    skill_id: UUID
    weight: float
    is_required: bool
    embedding: list[float] | None
    embedding_fingerprint: str | None = None


@dataclass(frozen=True)
class PossessedSkill:
    skill_id: UUID
    evidence_id: UUID
    effective_confidence: float
    verification_tier: str
    embedding: list[float] | None
    embedding_fingerprint: str | None = None
    extraction_confidence: float | None = None


@dataclass(frozen=True)
class Component:
    skill_id: UUID
    status: str
    evidence_id: UUID | None
    matched_skill_id: UUID | None
    semantic_similarity: float | None
    deterministic_contribution: float
    semantic_contribution: float
    verification_contribution: float
    is_required: bool = True
    extraction_confidence: float | None = None
    verification_tier: str | None = None

    @property
    def contribution(self) -> float:
        return self.deterministic_contribution + self.semantic_contribution + self.verification_contribution


@dataclass(frozen=True)
class ScoreResult:
    deterministic_score: float
    semantic_score: float
    verification_bonus: float
    final_score: float
    components: tuple[Component, ...]


def calculate_score(requirements: list[RequirementInput], possessed: list[PossessedSkill], *, semantic_enabled: bool = True, semantic_threshold: float = 0.75) -> ScoreResult:
    """Score required requirements only; preferred requirements are persisted as zero-weight explanations."""
    all_requirements = sorted(requirements, key=lambda item: str(item.skill_id))
    required = [item for item in all_requirements if item.is_required]
    preferred = [item for item in all_requirements if not item.is_required]
    total_weight = sum(item.weight for item in required)
    if total_weight <= 0:
        return ScoreResult(0.0, 0.0, 0.0, 0.0, ())
    by_skill: dict[UUID, list[PossessedSkill]] = {}
    for candidate in sorted(possessed, key=lambda item: (str(item.skill_id), str(item.evidence_id))):
        by_skill.setdefault(candidate.skill_id, []).append(candidate)
    components: dict[UUID, Component] = {}
    unmatched: list[RequirementInput] = []
    exact = verification_quality = 0.0
    for requirement in required:
        candidates = by_skill.get(requirement.skill_id, [])
        if not candidates:
            unmatched.append(requirement)
            continue
        best = max(candidates, key=lambda item: (item.effective_confidence, str(item.evidence_id)))
        overlap = requirement.weight * best.effective_confidence / total_weight
        verification = 0.10 * requirement.weight * TIER_MULTIPLIER[best.verification_tier] / total_weight
        exact += overlap
        verification_quality += verification
        status = "matched_verified" if best.verification_tier == VerificationTier.verified.value else "matched_partially_verified" if best.verification_tier == VerificationTier.partially_verified.value else "matched_unverified"
        components[requirement.skill_id] = Component(
            requirement.skill_id, status, best.evidence_id, best.skill_id, None, 0.65 * overlap, 0.0, verification,
            is_required=True, extraction_confidence=best.extraction_confidence, verification_tier=best.verification_tier,
        )
    semantic = 0.0
    if semantic_enabled:
        pairs: list[tuple[float, float, RequirementInput, PossessedSkill]] = []
        for requirement in unmatched:
            for candidate in possessed:
                similarity = cosine_similarity(requirement.embedding, candidate.embedding)
                if similarity >= semantic_threshold:
                    value = requirement.weight * similarity * candidate.effective_confidence / total_weight
                    pairs.append((value, similarity, requirement, candidate))
        used_requirements: set[UUID] = set()
        used_candidates: set[tuple[UUID, UUID]] = set()
        for value, similarity, requirement, candidate in sorted(pairs, key=lambda item: (-item[0], -item[1], str(item[2].skill_id), str(item[3].skill_id), str(item[3].evidence_id))):
            candidate_key = (candidate.skill_id, candidate.evidence_id)
            if requirement.skill_id in used_requirements or candidate_key in used_candidates:
                continue
            used_requirements.add(requirement.skill_id)
            used_candidates.add(candidate_key)
            semantic += value
            components[requirement.skill_id] = Component(
                requirement.skill_id, "semantic_near_match", candidate.evidence_id, candidate.skill_id, similarity, 0.0, 0.25 * value, 0.0,
                is_required=True, extraction_confidence=candidate.extraction_confidence, verification_tier=candidate.verification_tier,
            )
    for requirement in unmatched:
        components.setdefault(requirement.skill_id, Component(requirement.skill_id, "missing", None, None, None, 0.0, 0.0, 0.0, is_required=True))
    for requirement in preferred:
        candidates = by_skill.get(requirement.skill_id, [])
        if candidates:
            best = max(candidates, key=lambda item: (item.effective_confidence, str(item.evidence_id)))
            status = "matched_verified" if best.verification_tier == VerificationTier.verified.value else "matched_partially_verified" if best.verification_tier == VerificationTier.partially_verified.value else "matched_unverified"
            components[requirement.skill_id] = Component(
                requirement.skill_id, status, best.evidence_id, best.skill_id, None, 0.0, 0.0, 0.0,
                is_required=False, extraction_confidence=best.extraction_confidence, verification_tier=best.verification_tier,
            )
            continue
        semantic_candidates = [
            (cosine_similarity(requirement.embedding, candidate.embedding), candidate)
            for candidate in possessed
        ] if semantic_enabled else []
        semantic_candidates = [item for item in semantic_candidates if item[0] >= semantic_threshold]
        if semantic_candidates:
            similarity, candidate = max(semantic_candidates, key=lambda item: (item[0], item[1].effective_confidence, str(item[1].skill_id), str(item[1].evidence_id)))
            components[requirement.skill_id] = Component(
                requirement.skill_id, "semantic_near_match", candidate.evidence_id, candidate.skill_id, similarity, 0.0, 0.0, 0.0,
                is_required=False, extraction_confidence=candidate.extraction_confidence, verification_tier=candidate.verification_tier,
            )
        else:
            components[requirement.skill_id] = Component(requirement.skill_id, "missing", None, None, None, 0.0, 0.0, 0.0, is_required=False)
    deterministic_score, semantic_score = min(1.0, exact), min(1.0, semantic)
    verification_bonus = min(0.10, max(0.0, verification_quality))
    final_score = min(1.0, max(0.0, 0.65 * deterministic_score + 0.25 * semantic_score + verification_bonus))
    return ScoreResult(deterministic_score, semantic_score, verification_bonus, final_score, tuple(components[item.skill_id] for item in all_requirements))


async def _requirements(session: AsyncSession, internship_id: UUID) -> list[RequirementInput]:
    rows = (await session.execute(text("SELECT r.skill_id, r.weight, r.is_required, s.embedding, s.embedding_fingerprint, s.embedding_provider, s.embedding_model, s.embedding_dimension FROM internship_requirements r JOIN skills s ON s.id = r.skill_id WHERE r.internship_id = :internship_id"), {"internship_id": _database_id(session, internship_id)})).mappings().all()
    return [RequirementInput(UUID(str(row["skill_id"])), float(row["weight"]), bool(row["is_required"]), _usable_embedding(row), row["embedding_fingerprint"]) for row in rows]


async def external_job_requirements(session: AsyncSession, external_job_id: UUID) -> list[RequirementInput]:
    """Adapter read model for future external-job matching; the scoring formula remains shared."""
    rows = (
        await session.execute(
            text(
                "SELECT r.skill_id, r.weight, r.is_required, s.embedding, s.embedding_fingerprint, "
                "s.embedding_provider, s.embedding_model, s.embedding_dimension "
                "FROM external_job_requirements r JOIN skills s ON s.id = r.skill_id "
                "WHERE r.external_job_id = :external_job_id"
            ),
            {"external_job_id": _database_id(session, external_job_id)},
        )
    ).mappings().all()
    return [
        RequirementInput(
            UUID(str(row["skill_id"])),
            float(row["weight"]),
            bool(row["is_required"]),
            _usable_embedding(row),
            row["embedding_fingerprint"],
        )
        for row in rows
    ]


async def _possessed(session: AsyncSession, student_id: UUID) -> list[PossessedSkill]:
    rows = (await session.execute(text("SELECT mv.skill_id, mv.source_evidence_id, mv.extraction_confidence, mv.effective_confidence, mv.verification_tier, s.embedding, s.embedding_fingerprint, s.embedding_provider, s.embedding_model, s.embedding_dimension FROM matching_view mv JOIN skills s ON s.id = mv.skill_id WHERE mv.student_id = :student_id"), {"student_id": _database_id(session, student_id)})).mappings().all()
    return [PossessedSkill(UUID(str(row["skill_id"])), UUID(str(row["source_evidence_id"])), float(row["effective_confidence"]), str(row["verification_tier"]), _usable_embedding(row), row["embedding_fingerprint"], float(row["extraction_confidence"])) for row in rows]


def _usable_embedding(row: Any) -> list[float] | None:
    settings = get_settings()
    if not settings.semantic_matching_enabled or row["embedding_provider"] != settings.embedding_provider or row["embedding_model"] != settings.embedding_model or row["embedding_dimension"] != settings.embedding_dimension:
        return None
    vector = row["embedding"]
    if isinstance(vector, str):
        try:
            vector = json.loads(vector)
        except json.JSONDecodeError:
            return None
    return vector if isinstance(vector, list) and len(vector) == settings.embedding_dimension else None


def _input_fingerprint(requirements: list[RequirementInput], possessed: list[PossessedSkill]) -> str:
    settings = get_settings()
    payload = {"score": SCORE_VERSION, "semantic": settings.semantic_matching_enabled, "threshold": settings.semantic_similarity_threshold, "embedding": [settings.embedding_provider, settings.embedding_model, settings.embedding_dimension], "requirements": [(str(item.skill_id), item.weight, item.is_required, item.embedding_fingerprint) for item in requirements], "possessed": [(str(item.skill_id), str(item.evidence_id), item.effective_confidence, item.verification_tier, item.embedding_fingerprint) for item in possessed]}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _database_id(session: AsyncSession, value: UUID) -> UUID | str:
    return value.hex if session.get_bind().dialect.name == "sqlite" else value


async def compute_and_persist_match(session: AsyncSession, student_id: UUID, internship_id: UUID) -> Match:
    await activate_matching_role(session)
    requirements, possessed = await _requirements(session, internship_id), await _possessed(session, student_id)
    fingerprint = _input_fingerprint(requirements, possessed)
    existing = (await session.scalars(select(Match).where(Match.student_id == student_id, Match.internship_id == internship_id).order_by(Match.computed_at.desc()))).first()
    if existing is not None and existing.input_fingerprint == fingerprint:
        return existing
    settings = get_settings()
    result = calculate_score(requirements, possessed, semantic_enabled=settings.semantic_matching_enabled, semantic_threshold=settings.semantic_similarity_threshold)
    if existing is None:
        match = Match(student_id=student_id, internship_id=internship_id, deterministic_score=result.deterministic_score, semantic_score=result.semantic_score, verification_bonus=result.verification_bonus, final_score=result.final_score, score_version=SCORE_VERSION, input_fingerprint=fingerprint)
        session.add(match)
        await session.flush()
    else:
        match = existing
        await session.execute(text("DELETE FROM match_explanations WHERE match_id=:match_id"), {"match_id": _database_id(session, match.id)})
        match.deterministic_score, match.semantic_score, match.verification_bonus, match.final_score, match.score_version, match.input_fingerprint, match.computed_at = result.deterministic_score, result.semantic_score, result.verification_bonus, result.final_score, SCORE_VERSION, fingerprint, datetime.now(UTC)
    for component in (item for item in result.components if item.is_required):
        session.add(MatchExplanation(match_id=match.id, skill_id=component.skill_id, status=component.status, contribution=component.contribution, deterministic_contribution=component.deterministic_contribution, semantic_contribution=component.semantic_contribution, verification_contribution=component.verification_contribution, matched_skill_id=component.matched_skill_id, semantic_similarity=component.semantic_similarity, contributing_evidence_id=component.evidence_id))
    session.add(AuditLog(actor_id=None, action="match_computed", entity_type="match", entity_id=match.id, details={"D": result.deterministic_score, "S": result.semantic_score, "V": result.verification_bonus, "formula_version": SCORE_VERSION, "input_fingerprint": fingerprint}))
    await session.commit()
    await session.refresh(match)
    return match


async def compute_and_persist_external_job_match(session: AsyncSession, student_id: UUID, external_job_id: UUID) -> ExternalJobMatch | None:
    """Thin target adapter: external jobs use the same inputs, fingerprint, and score function as internships."""
    await activate_matching_role(session)
    external_job = await session.get(ExternalJob, external_job_id)
    if external_job is None or not external_job.is_active:
        return None
    requirements, possessed = await external_job_requirements(session, external_job_id), await _possessed(session, student_id)
    if not any(requirement.is_required for requirement in requirements):
        return None
    fingerprint = _input_fingerprint(requirements, possessed)
    existing = (
        await session.scalars(
            select(ExternalJobMatch).where(
                ExternalJobMatch.student_id == student_id,
                ExternalJobMatch.external_job_id == external_job_id,
            )
        )
    ).first()
    if existing is not None and existing.input_fingerprint == fingerprint:
        return existing
    settings = get_settings()
    result = calculate_score(requirements, possessed, semantic_enabled=settings.semantic_matching_enabled, semantic_threshold=settings.semantic_similarity_threshold)
    if existing is None:
        match = ExternalJobMatch(
            student_id=student_id,
            external_job_id=external_job_id,
            deterministic_score=result.deterministic_score,
            semantic_score=result.semantic_score,
            verification_bonus=result.verification_bonus,
            final_score=result.final_score,
            score_version=SCORE_VERSION,
            input_fingerprint=fingerprint,
        )
        session.add(match)
        await session.flush()
    else:
        match = existing
        await session.execute(
            text("DELETE FROM external_job_match_explanations WHERE external_job_match_id=:match_id"),
            {"match_id": _database_id(session, match.id)},
        )
        match.deterministic_score = result.deterministic_score
        match.semantic_score = result.semantic_score
        match.verification_bonus = result.verification_bonus
        match.final_score = result.final_score
        match.score_version = SCORE_VERSION
        match.input_fingerprint = fingerprint
        match.computed_at = datetime.now(UTC)
    for component in result.components:
        session.add(
            ExternalJobMatchExplanation(
                external_job_match_id=match.id,
                skill_id=component.skill_id,
                is_required=component.is_required,
                status=component.status,
                contribution=component.contribution,
                deterministic_contribution=component.deterministic_contribution,
                semantic_contribution=component.semantic_contribution,
                verification_contribution=component.verification_contribution,
                matched_skill_id=component.matched_skill_id,
                semantic_similarity=component.semantic_similarity,
                contributing_evidence_id=component.evidence_id,
                extraction_confidence=component.extraction_confidence,
                verification_tier=VerificationTier(component.verification_tier) if component.verification_tier is not None else None,
            )
        )
    session.add(
        AuditLog(
            actor_id=student_id,
            action="external_job_match_computed",
            entity_type="external_job_match",
            entity_id=match.id,
            details={
                "external_job_id": str(external_job_id),
                "D": result.deterministic_score,
                "S": result.semantic_score,
                "V": result.verification_bonus,
                "formula_version": SCORE_VERSION,
                "input_fingerprint": fingerprint,
            },
        )
    )
    await session.commit()
    await session.refresh(match)
    return match


async def match_is_stale(session: AsyncSession, match: Match) -> bool:
    await activate_matching_role(session)
    return match.score_version != SCORE_VERSION or match.input_fingerprint != _input_fingerprint(await _requirements(session, match.internship_id), await _possessed(session, match.student_id))


async def external_job_match_is_stale(session: AsyncSession, match: ExternalJobMatch) -> bool:
    external_job = await session.get(ExternalJob, match.external_job_id)
    if external_job is None or not external_job.is_active:
        return True
    requirements, possessed = await external_job_requirements(session, match.external_job_id), await _possessed(session, match.student_id)
    return not any(requirement.is_required for requirement in requirements) or match.score_version != SCORE_VERSION or match.input_fingerprint != _input_fingerprint(requirements, possessed)


async def persisted_student_matches(session: AsyncSession, student_id: UUID) -> list[Match]:
    return list((await session.scalars(select(Match).where(Match.student_id == student_id))).all())


async def persisted_internship_matches(session: AsyncSession, internship_id: UUID) -> list[Match]:
    return list((await session.scalars(select(Match).where(Match.internship_id == internship_id))).all())


async def persisted_external_job_matches(session: AsyncSession, student_id: UUID) -> list[ExternalJobMatch]:
    return list((await session.scalars(select(ExternalJobMatch).where(ExternalJobMatch.student_id == student_id))).all())


async def recompute_matches_for_internship(session: AsyncSession, internship_id: UUID) -> list[Match]:
    await activate_matching_role(session)
    student_ids = [UUID(str(value)) for value in (await session.execute(text("SELECT DISTINCT student_id FROM matching_view ORDER BY student_id"))).scalars().all()]
    matches = [await compute_and_persist_match(session, student_id, internship_id) for student_id in student_ids]
    return sorted(matches, key=lambda match: (-float(match.final_score), str(match.student_id)))


async def recompute_external_job_matches_for_student(session: AsyncSession, student_id: UUID) -> list[ExternalJobMatch]:
    job_ids = list(
        (
            await session.scalars(
                select(ExternalJob.id)
                .where(ExternalJob.is_active.is_(True))
                .order_by(ExternalJob.posted_at.desc().nullslast(), ExternalJob.company_name, ExternalJob.title, ExternalJob.external_id)
            )
        ).all()
    )
    computed = [await compute_and_persist_external_job_match(session, student_id, job_id) for job_id in job_ids]
    return [match for match in computed if match is not None]


async def suggest_teams(session: AsyncSession, target_skill_ids: list[UUID], pool: list[UUID]) -> list[tuple[tuple[UUID, UUID], float]]:
    await activate_matching_role(session)
    targets, skills_by_student = set(target_skill_ids), {}
    for student_id in sorted(set(pool), key=str):
        skills_by_student[student_id] = {entry.skill_id for entry in await _possessed(session, student_id)}
    suggestions = []
    for left, right in combinations(sorted(skills_by_student, key=str), 2):
        left_skills, right_skills = skills_by_student[left], skills_by_student[right]
        union = left_skills | right_skills
        coverage = len(union & targets) / len(targets) if targets else 0.0
        redundancy = len(left_skills & right_skills) / len(union) if union else 0.0
        suggestions.append(((left, right), coverage - 0.5 * redundancy))
    return sorted(suggestions, key=lambda item: (-item[1], str(item[0][0]), str(item[0][1])))
