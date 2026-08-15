from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Match, MatchExplanation


async def render_explanation(session: AsyncSession, match_id):  # type: ignore[no-untyped-def]
    """Render only persisted data. This service must remain LLM-free."""
    match = (await session.scalars(
        select(Match).where(Match.id == match_id).options(
            selectinload(Match.explanations).selectinload(MatchExplanation.skill),
            selectinload(Match.explanations).selectinload(MatchExplanation.evidence),
        )
    )).first()
    if match is None:
        return None
    lines = ["Recommended based on persisted, evidence-backed skill records:"]
    items = []
    for item in sorted(match.explanations, key=lambda value: str(value.skill_id)):
        skill_name = item.skill.canonical_name
        evidence_title = item.evidence.title if item.evidence else None
        if item.status == "matched_verified":
            lines.append(f"✓ {skill_name} — verified via {evidence_title}")
        elif item.status in {"matched_partially_verified", "matched_unverified"}:
            lines.append(f"✓ {skill_name} — evidenced via {evidence_title} ({item.status.removeprefix('matched_').replace('_', ' ')})")
        elif item.status == "semantic_near_match":
            lines.append(f"≈ {skill_name} — related evidenced skill via {evidence_title}")
        else:
            lines.append(f"△ {skill_name} — missing required skill")
        items.append({"skill_id": item.skill_id, "skill_name": skill_name, "status": item.status, "contribution": float(item.contribution), "evidence_id": item.contributing_evidence_id, "evidence_title": evidence_title})
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
