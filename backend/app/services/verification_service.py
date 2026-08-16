"""Deterministic GitHub project verification from persisted evidence and API facts."""

import logging
import re
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    AuditLog,
    Evidence,
    Student,
    StudentSkill,
    VerificationCheck,
    VerificationTier,
)
from app.services.github_service import (
    GitHubClient,
    GitHubError,
    GitHubInaccessible,
    GitHubInvalidRepository,
    GitHubNotFound,
    GitHubRepository,
    GitHubUnavailable,
    parse_github_repository_url,
)

logger = logging.getLogger(__name__)
COMMIT_VERIFIED_THRESHOLD = 3
YEAR_RE = re.compile(r"\b(20\d{2})\b")
LANGUAGE_ALIASES = {
    "python": "Python", "javascript": "JavaScript", "typescript": "TypeScript", "java": "Java",
    "golang": "Go", "go": "Go", "rust": "Rust", "ruby": "Ruby", "php": "PHP",
    "c++": "C++", "c#": "C#", "csharp": "C#",
}
CRITICAL_CHECKS = {"commit_author_match", "language_consistency", "timeline_consistency"}


@dataclass(frozen=True)
class VerificationRun:
    tier: VerificationTier
    checks: list[VerificationCheck]
    transient_failure: bool


def _check(evidence_id: UUID, check_type: str, result: str, details: dict[str, object]) -> VerificationCheck:
    return VerificationCheck(evidence_id=evidence_id, check_type=check_type, result=result, details=details)


def _claimed_languages(evidence: Evidence) -> set[str]:
    text = f"{evidence.title} {evidence.description}".casefold()
    return {language for label, language in LANGUAGE_ALIASES.items() if re.search(rf"(?<!\w){re.escape(label)}(?!\w)", text)}


def _claimed_years(evidence: Evidence) -> tuple[int, int] | None:
    years = sorted({int(value) for value in YEAR_RE.findall(f"{evidence.title} {evidence.description}")})
    return (years[0], years[-1]) if years else None


def _language_check(evidence_id: UUID, evidence: Evidence, languages: set[str]) -> VerificationCheck:
    claimed = _claimed_languages(evidence)
    if not claimed:
        return _check(evidence_id, "language_consistency", "not_applicable", {"reason": "No explicit programming language claim was found in the evidence"})
    matched = sorted(claimed.intersection(languages))
    details: dict[str, object] = {
        "claimed_languages": sorted(claimed),
        "repository_languages": sorted(languages),
        "matching_languages": matched,
    }
    return _check(evidence_id, "language_consistency", "pass" if matched else "fail", details)


def _timeline_check(evidence_id: UUID, evidence: Evidence, repository: GitHubRepository) -> VerificationCheck:
    claim = _claimed_years(evidence)
    if claim is None:
        return _check(evidence_id, "timeline_consistency", "not_applicable", {"reason": "No claimed project timeframe was found in the evidence"})
    if repository.created_at is None or repository.pushed_at is None:
        return _check(evidence_id, "timeline_consistency", "partial", {"claimed_years": list(claim), "reason": "Repository activity dates were incomplete"})
    activity = (repository.created_at.year, repository.pushed_at.year)
    overlaps = activity[0] <= claim[1] and activity[1] >= claim[0]
    return _check(evidence_id, "timeline_consistency", "pass" if overlaps else "fail", {"claimed_years": list(claim), "repository_activity_years": list(activity)})


def compute_verification_tier(checks: list[VerificationCheck]) -> VerificationTier:
    """Verified requires at least three attributable commits and no technology/timeline contradiction."""
    by_type = {check.check_type: check.result for check in checks}
    if any(by_type.get(check_type) == "fail" for check_type in CRITICAL_CHECKS):
        return VerificationTier.unverified
    if by_type.get("commit_author_match") == "pass":
        return VerificationTier.verified
    if any(check.result in {"pass", "partial"} for check in checks):
        return VerificationTier.partially_verified
    return VerificationTier.unverified


def _existing_tier(skills: list[StudentSkill]) -> VerificationTier:
    if any(skill.verification_tier == VerificationTier.verified for skill in skills):
        return VerificationTier.verified
    if any(skill.verification_tier == VerificationTier.partially_verified for skill in skills):
        return VerificationTier.partially_verified
    return VerificationTier.unverified


async def verify_github_evidence(session: AsyncSession, evidence_id: UUID, *, client: GitHubClient | None = None) -> VerificationRun:
    """Run and persist bounded GitHub checks without identity proxies or an LLM."""
    evidence = await session.get(Evidence, evidence_id)
    if evidence is None:
        return VerificationRun(VerificationTier.unverified, [], False)
    student = await session.get(Student, evidence.student_id)
    skills = list((await session.scalars(select(StudentSkill).where(StudentSkill.source_evidence_id == evidence_id))).all())
    checks: list[VerificationCheck] = []
    transient_failure = False
    client = client or GitHubClient()

    if evidence.evidence_type.value != "project":
        checks.append(_check(evidence_id, "repository_accessible", "not_applicable", {"reason": "GitHub project verification applies only to project evidence"}))
    elif not evidence.external_url:
        checks.append(_check(evidence_id, "repository_accessible", "not_applicable", {"reason": "No GitHub repository URL was supplied"}))
    else:
        try:
            owner, repository_name = parse_github_repository_url(evidence.external_url)
            repository = await client.repository(owner, repository_name)
        except GitHubInvalidRepository:
            checks.append(_check(evidence_id, "repository_accessible", "fail", {"reason": "The evidence URL is not a valid GitHub repository URL"}))
        except (GitHubNotFound, GitHubInaccessible):
            checks.append(_check(evidence_id, "repository_accessible", "fail", {"reason": "The GitHub repository is not publicly accessible"}))
        except GitHubUnavailable:
            transient_failure = True
            checks.append(_check(evidence_id, "repository_accessible", "partial", {"reason": "GitHub is temporarily unavailable; existing verification was preserved"}))
        else:
            checks.append(_check(evidence_id, "repository_accessible", "pass", {"repository": repository.full_name, "public": not repository.is_private}))
            username = student.github_username if student is not None else None
            if not username:
                checks.append(_check(evidence_id, "repository_owner_match", "not_applicable", {"reason": "No student-confirmed GitHub username is linked"}))
            elif repository.owner_type.casefold() == "organization":
                checks.append(_check(evidence_id, "repository_owner_match", "not_applicable", {"reason": "Repository is organization-owned; commit authorship is evaluated separately"}))
            elif repository.owner_login.casefold() == username.casefold():
                checks.append(_check(evidence_id, "repository_owner_match", "pass", {"repository_owner": repository.owner_login, "linked_username": username}))
            else:
                checks.append(_check(evidence_id, "repository_owner_match", "partial", {"reason": "Repository owner differs from the linked GitHub username"}))

            if not username:
                checks.append(_check(evidence_id, "commit_author_match", "not_applicable", {"reason": "No student-confirmed GitHub username is linked"}))
            else:
                try:
                    commits = await client.commits(owner, repository_name)
                except GitHubUnavailable:
                    transient_failure = True
                    checks.append(_check(evidence_id, "commit_author_match", "partial", {"reason": "GitHub commit data is temporarily unavailable; existing verification was preserved"}))
                except GitHubError:
                    checks.append(_check(evidence_id, "commit_author_match", "fail", {"reason": "GitHub commit data could not support authorship"}))
                else:
                    count = sum(commit.author_login is not None and commit.author_login.casefold() == username.casefold() for commit in commits)
                    result = "pass" if count >= COMMIT_VERIFIED_THRESHOLD else "partial" if count else "fail"
                    checks.append(_check(evidence_id, "commit_author_match", result, {"candidate_commit_count": count, "verified_threshold": COMMIT_VERIFIED_THRESHOLD, "sample_limit": 100}))

            try:
                languages = await client.languages(owner, repository_name)
            except GitHubUnavailable:
                transient_failure = True
                checks.append(_check(evidence_id, "language_consistency", "partial", {"reason": "GitHub language data is temporarily unavailable; existing verification was preserved"}))
            except GitHubError:
                checks.append(_check(evidence_id, "language_consistency", "not_applicable", {"reason": "Repository language metadata is unavailable"}))
            else:
                checks.append(_language_check(evidence_id, evidence, languages))
            checks.append(_timeline_check(evidence_id, evidence, repository))

    tier = _existing_tier(skills) if transient_failure else compute_verification_tier(checks)
    if not transient_failure:
        for skill in skills:
            skill.verification_tier = tier
    for check in checks:
        session.add(check)
    session.add(AuditLog(actor_id=evidence.student_id, action="github_project_verification_checked", entity_type="evidence", entity_id=evidence.id, details={"verification_tier": tier.value, "checks": [{"check_type": check.check_type, "result": check.result} for check in checks], "transient_failure": transient_failure}))
    await session.commit()
    for check in checks:
        await session.refresh(check)
    logger.info("github_project_verification_completed evidence_id=%s tier=%s checks=%s", evidence.id, tier.value, len(checks))
    return VerificationRun(tier, checks, transient_failure)
