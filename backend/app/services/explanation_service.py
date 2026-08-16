from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Match, MatchExplanation


async def render_explanation(session: AsyncSession, match_id, *, include_evidence_references: bool = True):  # type: ignore[no-untyped-def]
    """Render only persisted data. This service must remain LLM-free."""
    match = (await session.scalars(
        select(Match).where(Match.id == match_id).options(
            selectinload(Match.explanations).selectinload(MatchExplanation.skill),
            selectinload(Match.explanations).selectinload(MatchExplanation.matched_skill),
            selectinload(Match.explanations).selectinload(MatchExplanation.evidence),
        )
    )).first()
    if match is None:
        return None
    lines = ["Recommended based on persisted, evidence-backed skill records:"]
    items = []
    for item in sorted(match.explanations, key=lambda value: str(value.skill_id)):
        skill_name = item.skill.canonical_name
        evidence_title = item.evidence.title if include_evidence_references and item.evidence else None
        if item.status == "matched_verified":
            source = f"via {evidence_title}" if evidence_title else "by a persisted verification record"
            lines.append(f"✓ {skill_name} — verified {source}")
        elif item.status in {"matched_partially_verified", "matched_unverified"}:
            source = f"via {evidence_title}" if evidence_title else "by a persisted evidence record"
            lines.append(f"✓ {skill_name} — evidenced {source} ({item.status.removeprefix('matched_').replace('_', ' ')})")
        elif item.status == "semantic_near_match":
            source = f"via {evidence_title}" if evidence_title else "from a persisted evidence record"
            candidate_name = item.matched_skill.canonical_name if item.matched_skill else "related skill"
            lines.append(f"≈ {skill_name} — semantic near-match with {candidate_name} ({float(item.semantic_similarity or 0):.2f}) {source}")
        else:
            lines.append(f"△ {skill_name} — missing required skill")
        items.append({"skill_id": item.skill_id, "skill_name": skill_name, "status": item.status, "contribution": float(item.contribution), "total_contribution": float(item.contribution), "deterministic_contribution": float(item.deterministic_contribution), "semantic_contribution": float(item.semantic_contribution), "verification_contribution": float(item.verification_contribution), "matched_skill_id": item.matched_skill_id, "matched_skill_name": item.matched_skill.canonical_name if item.matched_skill else None, "semantic_similarity": float(item.semantic_similarity) if item.semantic_similarity is not None else None, "evidence_id": item.contributing_evidence_id if include_evidence_references else None, "evidence_title": evidence_title})
    lines.append(f"Overall skill match: {round(float(match.final_score) * 100)}%")
    return {
        "lines": lines,
        "items": items,
        "deterministic_score": float(match.deterministic_score),
        "semantic_score": float(match.semantic_score),
        "verification_bonus": float(match.verification_bonus),
        "final_score": float(match.final_score),
        "score_version": match.score_version,
    }
