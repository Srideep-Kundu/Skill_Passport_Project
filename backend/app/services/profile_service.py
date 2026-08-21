"""Read-only unified candidate profile aggregation with no matching-side effects."""
import re
from collections import defaultdict
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Evidence,
    LinkedInImport,
    ResumeDocument,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    ActiveLinkedInReference,
    ActiveResumeReference,
    CandidateProfileResponse,
    MatchingProfileResponse,
    MatchingProfileSkill,
    ProfileCompleteness,
    ProfileEvidenceSupport,
    ProfileSkill,
)

TIER_MULTIPLIER = {
    VerificationTier.verified.value: 1.0,
    VerificationTier.partially_verified.value: 0.85,
    VerificationTier.unverified.value: 0.65,
}
TIER_ORDER = {
    VerificationTier.unverified.value: 0,
    VerificationTier.partially_verified.value: 1,
    VerificationTier.verified.value: 2,
}


@dataclass(frozen=True)
class SupportRow:
    student_skill: StudentSkill
    skill: Skill
    evidence: Evidence


def _normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.strip().casefold())


def _duplicate_key(row: SupportRow) -> tuple[str, str]:
    # Exact same type/title across resume, linkedin, and manual evidence is a conservative flag only.
    return row.evidence.evidence_type.value, _normalize_title(row.evidence.title)


def _origin(evidence: Evidence) -> str:
    if evidence.linkedin_import_id is not None or (evidence.raw_metadata and evidence.raw_metadata.get("source") == "linkedin_export"):
        return "linkedin_export"
    if evidence.resume_document_id is not None:
        return "resume"
    return "manual"


def _source_types(row: SupportRow) -> set[str]:
    sources = {_origin(row.evidence), row.evidence.evidence_type.value}
    if row.evidence.external_url and "github.com/" in row.evidence.external_url.casefold() and row.student_skill.verification_tier != VerificationTier.unverified:
        sources.add("github_verified")
    return sources


def _effective_confidence(row: SupportRow) -> float:
    return round(float(row.student_skill.extraction_confidence) * TIER_MULTIPLIER[row.student_skill.verification_tier.value], 4)


def _summary_confidence(supports: list[ProfileEvidenceSupport]) -> tuple[float, int]:
    """Use the strongest evidence plus capped reinforcement from independent evidence groups."""
    groups: dict[tuple[str, str], float] = {}
    for support in supports:
        group_key = support.evidence_type, _normalize_title(support.title)
        groups[group_key] = max(groups.get(group_key, 0.0), support.effective_confidence)
    values = sorted(groups.values(), reverse=True)
    if not values:
        return 0.0, 0
    reinforcement = sum(min(value, 0.5) for value in values[1:])
    return round(min(1.0, values[0] + 0.15 * reinforcement), 4), len(values)


async def _support_rows(session: AsyncSession, student_id: UUID) -> list[SupportRow]:
    rows = (
        await session.execute(
            select(StudentSkill, Skill, Evidence)
            .join(Skill, StudentSkill.skill_id == Skill.id)
            .join(Evidence, StudentSkill.source_evidence_id == Evidence.id)
            .where(StudentSkill.student_id == student_id)
            .order_by(Skill.canonical_name, Evidence.submitted_at, Evidence.id)
        )
    ).all()
    return [SupportRow(student_skill, skill, evidence) for student_skill, skill, evidence in rows]


def _aggregate_skill(rows: list[SupportRow]) -> ProfileSkill:
    ordered = sorted(rows, key=lambda row: str(row.evidence.id))
    duplicate_roots: dict[tuple[str, str], UUID] = {}
    supports: list[ProfileEvidenceSupport] = []
    for row in ordered:
        key = _duplicate_key(row)
        root = duplicate_roots.get(key)
        # Same source type does not become a duplicate relationship.
        origin = _origin(row.evidence)
        if root is None:
            duplicate_roots[key] = row.evidence.id
            duplicate_id = None
        else:
            root_row = next(item for item in ordered if item.evidence.id == root)
            if _origin(root_row.evidence) != origin:
                duplicate_id = root
            else:
                duplicate_id = None
        supports.append(
            ProfileEvidenceSupport(
                evidence_id=row.evidence.id,
                title=row.evidence.title,
                evidence_type=row.evidence.evidence_type.value,
                origin=origin,  # type: ignore[arg-type]
                verification_tier=row.student_skill.verification_tier.value,
                extraction_confidence=float(row.student_skill.extraction_confidence),
                effective_confidence=_effective_confidence(row),
                evidence_span=row.student_skill.evidence_span,
                source_types=sorted(_source_types(row)),
                likely_duplicate_of=duplicate_id,
            )
        )
    highest = max(supports, key=lambda item: (TIER_ORDER[item.verification_tier], item.effective_confidence)).verification_tier
    source_types = sorted({source for support in supports for source in support.source_types})
    confidence, independent_count = _summary_confidence(supports)
    verification_summary = "verified support exists" if highest == "verified" else "partially verified support exists" if highest == "partially_verified" else "unverified support only"
    return ProfileSkill(
        skill_id=rows[0].skill.id,
        canonical_name=rows[0].skill.canonical_name,
        category=rows[0].skill.category,
        supports=supports,
        supporting_evidence_count=len(supports),
        independent_evidence_count=independent_count,
        source_types=source_types,
        source_diversity=len(source_types),
        highest_verification_tier=highest,
        verification_summary=verification_summary,
        summary_confidence=confidence,
    )


async def build_candidate_profile(session: AsyncSession, student: Student) -> CandidateProfileResponse:
    rows = await _support_rows(session, student.id)
    grouped: dict[UUID, list[SupportRow]] = defaultdict(list)
    for row in rows:
        grouped[row.skill.id].append(row)
    active_resume = await session.scalar(select(ResumeDocument).where(ResumeDocument.student_id == student.id, ResumeDocument.is_active.is_(True)))
    active_linkedin = await session.scalar(select(LinkedInImport).where(LinkedInImport.student_id == student.id, LinkedInImport.is_active.is_(True)))
    skills = [_aggregate_skill(grouped[key]) for key in sorted(grouped, key=lambda item: grouped[item][0].skill.canonical_name.casefold())]
    all_supports = [support for skill in skills for support in skill.supports]
    return CandidateProfileResponse(
        student_id=student.id,
        skills=skills,
        active_resume=ActiveResumeReference(id=active_resume.id, original_filename=active_resume.original_filename, parse_status=active_resume.parse_status.value, parsed_at=active_resume.parsed_at) if active_resume else None,
        active_linkedin_import=ActiveLinkedInReference(id=active_linkedin.id, original_filename=active_linkedin.original_filename, parse_status=active_linkedin.parse_status.value, parsed_at=active_linkedin.parsed_at) if active_linkedin else None,
        github_identity_status="claimed" if student.github_username else "not_linked",
        profile_completeness=ProfileCompleteness(
            has_active_resume=active_resume is not None,
            has_linkedin_import=active_linkedin is not None,
            has_project_evidence=any(support.evidence_type == "project" for support in all_supports),
            has_verified_evidence=any(support.verification_tier == "verified" for support in all_supports),
            has_evidence_backed_skills=bool(skills),
            has_github_identity=student.github_username is not None,
        ),
    )


async def build_matching_profile(session: AsyncSession, student_id: UUID) -> MatchingProfileResponse:
    """Fairness-safe helper for future consumers; matching still uses matching_view directly."""
    rows = await _support_rows(session, student_id)
    return MatchingProfileResponse(
        student_id=student_id,
        skills=[MatchingProfileSkill(skill_id=row.skill.id, evidence_id=row.evidence.id, effective_confidence=_effective_confidence(row), verification_tier=row.student_skill.verification_tier.value) for row in rows],
    )
