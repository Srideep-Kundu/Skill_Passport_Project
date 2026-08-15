from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.api import evidence, matches, passport
from app.models import Evidence, EvidenceType, Internship, Recruiter, Student
from app.schemas.contracts import RecruiterEvidenceConsentUpdate

STUDENT_ID = UUID("00000000-0000-0000-0000-000000000001")
RECRUITER_ID = UUID("00000000-0000-0000-0000-000000000002")
INTERNSHIP_ID = UUID("00000000-0000-0000-0000-000000000003")
EVIDENCE_ID = UUID("00000000-0000-0000-0000-000000000004")


class ConsentSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.committed = False

    def add(self, item: object) -> None:
        self.added.append(item)

    async def commit(self) -> None:
        self.committed = True


class EvidenceAccessSession:
    def __init__(self, internship: Internship, candidate: Student, item: Evidence) -> None:
        self.internship = internship
        self.candidate = candidate
        self.item = item

    async def get(self, model: type[object], _identifier: UUID) -> object | None:
        if model is Internship:
            return self.internship
        if model is Student:
            return self.candidate
        if model is Evidence:
            return self.item
        return None


class ExplanationSession:
    def __init__(self, match: object, internship: Internship, candidate: Student) -> None:
        self.match = match
        self.internship = internship
        self.candidate = candidate

    async def get(self, model: type[object], _identifier: UUID) -> object | None:
        if model.__name__ == "Match":
            return self.match
        if model is Internship:
            return self.internship
        if model is Student:
            return self.candidate
        return None


@pytest.mark.asyncio
async def test_student_can_persist_and_audit_own_recruiter_evidence_consent() -> None:
    student = Student(id=STUDENT_ID, email="student@example.test", password_hash="hash", full_name="Student", recruiter_evidence_consent=False)
    session = ConsentSession()

    result = await passport.set_recruiter_evidence_consent(
        RecruiterEvidenceConsentUpdate(recruiter_evidence_consent=True), student, session  # type: ignore[arg-type]
    )

    assert result.recruiter_evidence_consent is True
    assert student.recruiter_evidence_consent is True
    assert session.committed is True
    assert session.added[-1].action == "recruiter_evidence_consent_changed"  # type: ignore[union-attr]


@pytest.mark.asyncio
async def test_recruiter_raw_evidence_is_forbidden_without_student_consent() -> None:
    recruiter = Recruiter(id=RECRUITER_ID, email="recruiter@example.test", password_hash="hash", company_name="Company")
    student = Student(id=STUDENT_ID, email="student@example.test", password_hash="hash", full_name="Student", recruiter_evidence_consent=False)
    internship = Internship(id=INTERNSHIP_ID, recruiter_id=RECRUITER_ID, title="Intern", description="Description")
    item = Evidence(id=EVIDENCE_ID, student_id=STUDENT_ID, evidence_type=EvidenceType.project, title="Private project", description="Private raw evidence")
    session = EvidenceAccessSession(internship, student, item)

    with pytest.raises(HTTPException) as raised:
        await evidence.recruiter_evidence(INTERNSHIP_ID, STUDENT_ID, EVIDENCE_ID, recruiter, session)  # type: ignore[arg-type]

    assert raised.value.status_code == 403


@pytest.mark.asyncio
async def test_recruiter_can_view_redacted_match_explanation_without_raw_evidence_consent(monkeypatch: pytest.MonkeyPatch) -> None:
    recruiter = Recruiter(id=RECRUITER_ID, email="recruiter@example.test", password_hash="hash", company_name="Company")
    student = Student(id=STUDENT_ID, email="student@example.test", password_hash="hash", full_name="Student", recruiter_evidence_consent=False)
    internship = Internship(id=INTERNSHIP_ID, recruiter_id=RECRUITER_ID, title="Intern", description="Description")
    match = SimpleNamespace(id=UUID("00000000-0000-0000-0000-000000000005"), student_id=STUDENT_ID, internship_id=INTERNSHIP_ID)
    observed: dict[str, bool] = {}

    async def fake_render(_session: object, _match_id: UUID, *, include_evidence_references: bool) -> dict[str, object]:
        observed["include_evidence_references"] = include_evidence_references
        return {
            "lines": ["Recommended based on persisted records."],
            "items": [{"skill_id": UUID("00000000-0000-0000-0000-000000000006"), "skill_name": "Python", "status": "matched_unverified", "contribution": 0.2, "evidence_id": None, "evidence_title": None}],
            "deterministic_score": 0.2,
            "semantic_score": 0.0,
            "verification_bonus": 0.0,
            "final_score": 0.13,
            "score_version": "v1",
        }

    monkeypatch.setattr(matches, "render_explanation", fake_render)
    result = await matches.match_explanation(match.id, recruiter, ExplanationSession(match, internship, student))  # type: ignore[arg-type]

    assert observed["include_evidence_references"] is False
    assert result.items[0].evidence_id is None
