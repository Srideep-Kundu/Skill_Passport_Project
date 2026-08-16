from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID

import pytest

from app.models import Evidence, EvidenceType, Student, StudentSkill, VerificationCheck, VerificationTier
from app.services.github_service import GitHubCommit, GitHubInaccessible, GitHubNotFound, GitHubRepository, GitHubUnavailable
from app.services import verification_service

EVIDENCE_ID = UUID("00000000-0000-0000-0000-000000000001")
STUDENT_ID = UUID("00000000-0000-0000-0000-000000000002")
SKILL_ID = UUID("00000000-0000-0000-0000-000000000003")


class FakeGitHubClient:
    def __init__(self, repository: GitHubRepository | Exception, commits: list[GitHubCommit] | Exception = (), languages: set[str] | Exception = frozenset()) -> None:
        self.repository_result = repository
        self.commits_result = commits
        self.languages_result = languages

    async def repository(self, _owner: str, _repository: str) -> GitHubRepository:
        if isinstance(self.repository_result, Exception):
            raise self.repository_result
        return self.repository_result

    async def commits(self, _owner: str, _repository: str) -> list[GitHubCommit]:
        if isinstance(self.commits_result, Exception):
            raise self.commits_result
        return list(self.commits_result)

    async def languages(self, _owner: str, _repository: str) -> set[str]:
        if isinstance(self.languages_result, Exception):
            raise self.languages_result
        return set(self.languages_result)


class VerificationSession:
    def __init__(self, evidence: Evidence, student: Student, skill: StudentSkill) -> None:
        self.evidence = evidence
        self.student = student
        self.skill = skill
        self.added: list[object] = []
        self.committed = False

    async def get(self, model: type[object], _identifier: UUID) -> object | None:
        if model is Evidence:
            return self.evidence
        if model is Student:
            return self.student
        return None

    async def scalars(self, _statement: object) -> SimpleNamespace:
        return SimpleNamespace(all=lambda: [self.skill])

    def add(self, item: object) -> None:
        self.added.append(item)

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, _item: object) -> None:
        return None


def repository(*, owner: str = "candidate", owner_type: str = "User", created: int = 2024, pushed: int = 2024) -> GitHubRepository:
    return GitHubRepository(
        full_name=f"{owner}/project",
        owner_login=owner,
        owner_type=owner_type,
        is_private=False,
        created_at=datetime(created, 1, 1, tzinfo=UTC),
        pushed_at=datetime(pushed, 12, 1, tzinfo=UTC),
    )


def candidate_commits(count: int, username: str = "candidate") -> list[GitHubCommit]:
    return [GitHubCommit(author_login=username, committed_at=datetime(2024, 4, 1, tzinfo=UTC)) for _ in range(count)]


def verification_context(*, username: str | None = "candidate", description: str = "Built a Python project in 2024", url: str = "https://github.com/candidate/project", current_tier: VerificationTier = VerificationTier.unverified) -> tuple[VerificationSession, Evidence]:
    evidence = Evidence(id=EVIDENCE_ID, student_id=STUDENT_ID, evidence_type=EvidenceType.project, title="Project", description=description, external_url=url)
    student = Student(id=STUDENT_ID, email="student@example.test", password_hash="hash", full_name="Student", github_username=username)
    skill = StudentSkill(student_id=STUDENT_ID, skill_id=SKILL_ID, source_evidence_id=EVIDENCE_ID, extraction_confidence=0.8, verification_tier=current_tier, evidence_span="Python")
    return VerificationSession(evidence, student, skill), evidence


def results(run: verification_service.VerificationRun) -> dict[str, VerificationCheck]:
    return {check.check_type: check for check in run.checks}


@pytest.mark.asyncio
async def test_repository_accessibility_alone_is_never_verified() -> None:
    session, _ = verification_context(username=None, description="Project")
    run = await verification_service.verify_github_evidence(session, EVIDENCE_ID, client=FakeGitHubClient(repository(), [], {"Python"}))  # type: ignore[arg-type]

    assert run.tier is VerificationTier.partially_verified
    assert results(run)["repository_accessible"].result == "pass"
    assert session.skill.verification_tier is VerificationTier.partially_verified


@pytest.mark.asyncio
async def test_owned_repository_with_meaningful_candidate_commits_is_verified_and_audited() -> None:
    session, _ = verification_context()
    run = await verification_service.verify_github_evidence(session, EVIDENCE_ID, client=FakeGitHubClient(repository(), candidate_commits(3), {"Python"}))  # type: ignore[arg-type]

    assert run.tier is VerificationTier.verified
    assert results(run)["repository_owner_match"].result == "pass"
    assert results(run)["commit_author_match"].details["candidate_commit_count"] == 3
    assert any(getattr(item, "action", None) == "github_project_verification_checked" for item in session.added)


@pytest.mark.asyncio
async def test_organization_repository_with_candidate_commits_is_verified() -> None:
    session, _ = verification_context()
    run = await verification_service.verify_github_evidence(session, EVIDENCE_ID, client=FakeGitHubClient(repository(owner="org", owner_type="Organization"), candidate_commits(4), {"Python"}))  # type: ignore[arg-type]

    assert run.tier is VerificationTier.verified
    assert results(run)["repository_owner_match"].result == "not_applicable"


@pytest.mark.asyncio
@pytest.mark.parametrize("commits", [[], [GitHubCommit(author_login=None, committed_at=None)]])
async def test_unrelated_or_ambiguous_commits_never_verify(commits: list[GitHubCommit]) -> None:
    session, _ = verification_context()
    run = await verification_service.verify_github_evidence(session, EVIDENCE_ID, client=FakeGitHubClient(repository(owner="other"), commits, {"Python"}))  # type: ignore[arg-type]

    assert run.tier is VerificationTier.unverified
    assert results(run)["commit_author_match"].result == "fail"


@pytest.mark.asyncio
async def test_language_and_timeline_contradictions_override_commit_strength() -> None:
    session, _ = verification_context(description="Built a Java project in 2020")
    run = await verification_service.verify_github_evidence(session, EVIDENCE_ID, client=FakeGitHubClient(repository(created=2024, pushed=2024), candidate_commits(3), {"Python"}))  # type: ignore[arg-type]

    assert run.tier is VerificationTier.unverified
    assert results(run)["language_consistency"].result == "fail"
    assert results(run)["timeline_consistency"].result == "fail"


@pytest.mark.asyncio
async def test_timeline_overlap_and_missing_timeframe_are_conservative() -> None:
    overlapping, _ = verification_context(description="Built a Python project in 2024")
    overlap_run = await verification_service.verify_github_evidence(overlapping, EVIDENCE_ID, client=FakeGitHubClient(repository(), candidate_commits(1), {"Python"}))  # type: ignore[arg-type]
    no_timeframe, _ = verification_context(description="Built a Python project")
    no_timeframe_run = await verification_service.verify_github_evidence(no_timeframe, EVIDENCE_ID, client=FakeGitHubClient(repository(), candidate_commits(1), {"Python"}))  # type: ignore[arg-type]

    assert results(overlap_run)["timeline_consistency"].result == "pass"
    assert results(no_timeframe_run)["timeline_consistency"].result == "not_applicable"
    assert overlap_run.tier is VerificationTier.partially_verified


@pytest.mark.asyncio
@pytest.mark.parametrize("error", [GitHubNotFound(), GitHubInaccessible()])
async def test_missing_or_inaccessible_repository_fails(error: Exception) -> None:
    session, _ = verification_context()
    run = await verification_service.verify_github_evidence(session, EVIDENCE_ID, client=FakeGitHubClient(error))  # type: ignore[arg-type]

    assert run.tier is VerificationTier.unverified
    assert results(run)["repository_accessible"].result == "fail"


@pytest.mark.asyncio
async def test_timeout_or_rate_limit_preserves_existing_tier() -> None:
    session, _ = verification_context(current_tier=VerificationTier.verified)
    run = await verification_service.verify_github_evidence(session, EVIDENCE_ID, client=FakeGitHubClient(GitHubUnavailable()))  # type: ignore[arg-type]

    assert run.transient_failure is True
    assert run.tier is VerificationTier.verified
    assert session.skill.verification_tier is VerificationTier.verified


@pytest.mark.asyncio
@pytest.mark.parametrize("url", ["https://example.com/candidate/project", "https://github.com/candidate/project/issues", "http://github.com/candidate/project"])
async def test_invalid_or_non_github_urls_are_rejected_without_api_calls(url: str) -> None:
    session, _ = verification_context(url=url)
    run = await verification_service.verify_github_evidence(session, EVIDENCE_ID, client=FakeGitHubClient(repository()))  # type: ignore[arg-type]

    assert run.tier is VerificationTier.unverified
    assert results(run)["repository_accessible"].result == "fail"


def test_tier_rules_require_authorship_and_respect_critical_failure() -> None:
    accessible = VerificationCheck(evidence_id=EVIDENCE_ID, check_type="repository_accessible", result="pass", details={})
    authored = VerificationCheck(evidence_id=EVIDENCE_ID, check_type="commit_author_match", result="pass", details={})
    mismatch = VerificationCheck(evidence_id=EVIDENCE_ID, check_type="language_consistency", result="fail", details={})

    assert verification_service.compute_verification_tier([accessible]) is VerificationTier.partially_verified
    assert verification_service.compute_verification_tier([accessible, authored]) is VerificationTier.verified
    assert verification_service.compute_verification_tier([accessible, authored, mismatch]) is VerificationTier.unverified
