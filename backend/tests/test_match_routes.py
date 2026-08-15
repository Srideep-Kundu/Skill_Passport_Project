from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import UUID

import pytest

from app.api import internships, matches

STUDENT_ID = UUID("00000000-0000-0000-0000-000000000001")
RECRUITER_ID = UUID("00000000-0000-0000-0000-000000000002")
INTERNSHIP_ID = UUID("00000000-0000-0000-0000-000000000003")
MATCH_ID = UUID("00000000-0000-0000-0000-000000000004")


def match_record() -> SimpleNamespace:
    return SimpleNamespace(
        id=MATCH_ID,
        student_id=STUDENT_ID,
        internship_id=INTERNSHIP_ID,
        deterministic_score=0.65,
        semantic_score=0.25,
        verification_bonus=0.10,
        final_score=1.0,
        score_version="v1",
        created_at=datetime.now(UTC),
    )


class StudentMatchSession:
    async def scalars(self, _statement: object) -> SimpleNamespace:
        return SimpleNamespace(all=lambda: [SimpleNamespace(id=INTERNSHIP_ID, title="Backend Intern")])


class RecruiterMatchSession:
    async def get(self, _model: object, _id: UUID) -> SimpleNamespace:
        return SimpleNamespace(id=INTERNSHIP_ID, recruiter_id=RECRUITER_ID)


@pytest.mark.asyncio
async def test_student_matches_adds_title_without_duplicate_response_field(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_compute(_session: object, _student_id: UUID, _internship_id: UUID) -> SimpleNamespace:
        return match_record()

    monkeypatch.setattr(matches, "compute_and_persist_match", fake_compute)

    result = await matches.my_matches(SimpleNamespace(id=STUDENT_ID), StudentMatchSession())

    assert result[0].internship_title == "Backend Intern"


@pytest.mark.asyncio
async def test_recruiter_matches_adds_candidate_label_without_duplicate_response_field(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_ranked(_session: object, _internship_id: UUID) -> list[SimpleNamespace]:
        return [match_record()]

    monkeypatch.setattr(internships, "ranked_matches_for_internship", fake_ranked)

    result = await internships.internship_matches(
        INTERNSHIP_ID,
        SimpleNamespace(id=RECRUITER_ID),
        RecruiterMatchSession(),
    )

    assert result[0].candidate_label == "Candidate 00000000"
