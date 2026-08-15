from dataclasses import dataclass
from itertools import combinations
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AuditLog,
    Match,
    MatchExplanation,
    VerificationTier,
)
from app.services.embeddings import cosine_similarity

SCORE_VERSION = "v1"
SEMANTIC_THRESHOLD = 0.75
TIER_MULTIPLIER = {
    VerificationTier.verified.value: 1.0,
    VerificationTier.partially_verified.value: 0.85,
    VerificationTier.unverified.value: 0.65,
}


async def activate_matching_role(session: AsyncSession) -> None:
    """Restrict PostgreSQL matching operations to the least-privilege database role.

    The API currently shares one connection identity for all services, so this is a
    transaction-scoped boundary rather than a separate process identity. The matcher
    must still use this role before it reads matching inputs or persists match output.
    """
    if session.get_bind().dialect.name == "postgresql":
        await session.execute(text("SET LOCAL ROLE skill_passport_matcher"))


@dataclass(frozen=True)
class RequirementInput:
    skill_id: UUID
    weight: float
    is_required: bool
    embedding: list[float] | None


@dataclass(frozen=True)
class PossessedSkill:
    skill_id: UUID
    evidence_id: UUID
    effective_confidence: float
    verification_tier: str
    embedding: list[float] | None


@dataclass(frozen=True)
class Component:
    skill_id: UUID
    status: str
    contribution: float
    evidence_id: UUID | None


@dataclass(frozen=True)
class ScoreResult:
    deterministic_score: float
    semantic_score: float
    verification_bonus: float
    final_score: float
    components: tuple[Component, ...]


def calculate_score(requirements: list[RequirementInput], possessed: list[PossessedSkill]) -> ScoreResult:
    """Pure, deterministic hybrid scoring. No LLM is ever involved in this function."""
    required = sorted((item for item in requirements if item.is_required), key=lambda item: str(item.skill_id))
    total_weight = sum(item.weight for item in required)
    if total_weight <= 0:
        return ScoreResult(0.0, 0.0, 0.0, 0.0, ())
    by_skill: dict[UUID, list[PossessedSkill]] = {}
    for candidate in sorted(possessed, key=lambda item: (str(item.skill_id), str(item.evidence_id))):
        by_skill.setdefault(candidate.skill_id, []).append(candidate)
    components: list[Component] = []
    exact = 0.0
    semantic = 0.0
    verification_quality = 0.0
    for requirement in required:
        candidates = by_skill.get(requirement.skill_id, [])
        if candidates:
            best = max(candidates, key=lambda item: (item.effective_confidence, str(item.evidence_id)))
            overlap = requirement.weight * best.effective_confidence / total_weight
            exact += overlap
            verification_quality += requirement.weight * TIER_MULTIPLIER[best.verification_tier] / total_weight
            status = "matched_verified" if best.verification_tier == VerificationTier.verified.value else "matched_partially_verified" if best.verification_tier == VerificationTier.partially_verified.value else "matched_unverified"
            components.append(Component(requirement.skill_id, status, 0.65 * overlap, best.evidence_id))
            continue
        semantic_candidates = [candidate for candidates in by_skill.values() for candidate in candidates]
        closest = max(
            semantic_candidates,
            key=lambda item: (cosine_similarity(requirement.embedding, item.embedding), item.effective_confidence, str(item.evidence_id)),
            default=None,
        )
        similarity = cosine_similarity(requirement.embedding, closest.embedding) if closest else 0.0
        if closest is not None and similarity >= SEMANTIC_THRESHOLD:
            value = requirement.weight * similarity * closest.effective_confidence / total_weight
            semantic += value
            components.append(Component(requirement.skill_id, "semantic_near_match", 0.25 * value, closest.evidence_id))
        else:
            components.append(Component(requirement.skill_id, "missing", 0.0, None))
    # Verification quality only rewards exactly matched skills and is bounded by the formula's 10% term.
    verification_bonus = min(0.10, max(0.0, 0.10 * verification_quality))
    deterministic_score, semantic_score = min(1.0, exact), min(1.0, semantic)
    final_score = min(1.0, max(0.0, 0.65 * deterministic_score + 0.25 * semantic_score + verification_bonus))
    return ScoreResult(deterministic_score, semantic_score, verification_bonus, final_score, tuple(components))


async def _requirements(session: AsyncSession, internship_id: UUID) -> list[RequirementInput]:
    rows = (await session.execute(
        text("""SELECT r.skill_id, r.weight, r.is_required, s.embedding
                 FROM internship_requirements r JOIN skills s ON s.id = r.skill_id
                 WHERE r.internship_id = :internship_id"""), {"internship_id": str(internship_id)}
    )).mappings().all()
    return [RequirementInput(UUID(str(row["skill_id"])), float(row["weight"]), bool(row["is_required"]), row["embedding"]) for row in rows]


async def _possessed(session: AsyncSession, student_id: UUID) -> list[PossessedSkill]:
    """The matcher reads the restricted view only: never the students table."""
    rows = (await session.execute(
        text("""SELECT mv.student_id, mv.skill_id, mv.source_evidence_id, mv.effective_confidence,
                        mv.verification_tier, s.embedding
                 FROM matching_view mv JOIN skills s ON s.id = mv.skill_id
                 WHERE mv.student_id = :student_id"""), {"student_id": str(student_id)}
    )).mappings().all()
    return [PossessedSkill(UUID(str(row["skill_id"])), UUID(str(row["source_evidence_id"])), float(row["effective_confidence"]), str(row["verification_tier"]), row["embedding"]) for row in rows]


async def compute_and_persist_match(session: AsyncSession, student_id: UUID, internship_id: UUID) -> Match:
    await activate_matching_role(session)
    result = calculate_score(await _requirements(session, internship_id), await _possessed(session, student_id))
    existing = (await session.execute(text("SELECT id FROM matches WHERE student_id=:student_id AND internship_id=:internship_id AND score_version=:version"), {"student_id": str(student_id), "internship_id": str(internship_id), "version": SCORE_VERSION})).scalar_one_or_none()
    if existing:
        match = await session.get(Match, UUID(str(existing)))
        assert match is not None
        await session.execute(text("DELETE FROM match_explanations WHERE match_id=:match_id"), {"match_id": str(match.id)})
        match.deterministic_score, match.semantic_score, match.verification_bonus, match.final_score = result.deterministic_score, result.semantic_score, result.verification_bonus, result.final_score
    else:
        match = Match(student_id=student_id, internship_id=internship_id, deterministic_score=result.deterministic_score, semantic_score=result.semantic_score, verification_bonus=result.verification_bonus, final_score=result.final_score, score_version=SCORE_VERSION)
        session.add(match)
        await session.flush()
    for component in result.components:
        session.add(MatchExplanation(match_id=match.id, skill_id=component.skill_id, status=component.status, contribution=component.contribution, contributing_evidence_id=component.evidence_id))
    session.add(AuditLog(actor_id=None, action="match_computed", entity_type="match", entity_id=match.id, details={"D": result.deterministic_score, "S": result.semantic_score, "V": result.verification_bonus, "formula_version": SCORE_VERSION}))
    await session.commit()
    await session.refresh(match)
    return match


async def ranked_matches_for_internship(session: AsyncSession, internship_id: UUID) -> list[Match]:
    await activate_matching_role(session)
    student_ids = [UUID(str(value)) for value in (await session.execute(text("SELECT DISTINCT student_id FROM matching_view ORDER BY student_id"))).scalars().all()]
    matches = [await compute_and_persist_match(session, student_id, internship_id) for student_id in student_ids]
    return sorted(matches, key=lambda match: (-float(match.final_score), str(match.student_id)))


async def suggest_teams(session: AsyncSession, target_skill_ids: list[UUID], pool: list[UUID]) -> list[tuple[tuple[UUID, UUID], float]]:
    await activate_matching_role(session)
    targets = set(target_skill_ids)
    skills_by_student: dict[UUID, set[UUID]] = {}
    for student_id in sorted(set(pool), key=str):
        skills_by_student[student_id] = {entry.skill_id for entry in await _possessed(session, student_id)}
    suggestions: list[tuple[tuple[UUID, UUID], float]] = []
    for left, right in combinations(sorted(skills_by_student, key=str), 2):
        left_skills, right_skills = skills_by_student[left], skills_by_student[right]
        coverage = len((left_skills | right_skills) & targets) / len(targets)
        union = left_skills | right_skills
        redundancy = len(left_skills & right_skills) / len(union) if union else 0.0
        suggestions.append(((left, right), coverage - 0.5 * redundancy))
    return sorted(suggestions, key=lambda item: (-item[1], str(item[0][0]), str(item[0][1])))
