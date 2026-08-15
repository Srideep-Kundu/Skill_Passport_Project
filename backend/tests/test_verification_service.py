from types import SimpleNamespace
from typing import Self
from uuid import UUID

import pytest

from app.models import Evidence, EvidenceType, StudentSkill, VerificationTier
from app.services import verification_service

EVIDENCE_ID = UUID("00000000-0000-0000-0000-000000000001")
STUDENT_ID = UUID("00000000-0000-0000-0000-000000000002")
SKILL_ID = UUID("00000000-0000-0000-0000-000000000003")


class AccessibleRepositoryResponse:
    is_success = True

    @staticmethod
    def json() -> dict[str, object]:
        return {"private": False}


class AccessibleRepositoryClient:
    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def get(self, *_args: object, **_kwargs: object) -> AccessibleRepositoryResponse:
        return AccessibleRepositoryResponse()


class VerificationSession:
    def __init__(self, item: Evidence, student_skill: StudentSkill) -> None:
        self.item = item
        self.student_skill = student_skill
        self.added: list[object] = []

    async def get(self, _model: type[object], _identifier: UUID) -> Evidence:
        return self.item

    async def scalars(self, _statement: object) -> SimpleNamespace:
        return SimpleNamespace(all=lambda: [self.student_skill])

    def add(self, item: object) -> None:
        self.added.append(item)

    async def commit(self) -> None:
        return None

    async def refresh(self, _item: object) -> None:
        return None


@pytest.mark.asyncio
async def test_accessible_repository_never_marks_skills_verified(monkeypatch: pytest.MonkeyPatch) -> None:
    item = Evidence(id=EVIDENCE_ID, student_id=STUDENT_ID, evidence_type=EvidenceType.project, title="Project", description="Evidence", external_url="https://github.com/example/project")
    student_skill = StudentSkill(student_id=STUDENT_ID, skill_id=SKILL_ID, source_evidence_id=EVIDENCE_ID, extraction_confidence=0.8, verification_tier=VerificationTier.unverified, evidence_span="Evidence")
    session = VerificationSession(item, student_skill)
    monkeypatch.setattr(verification_service.httpx, "AsyncClient", lambda **_kwargs: AccessibleRepositoryClient())

    result = await verification_service.verify_github_evidence(session, EVIDENCE_ID)  # type: ignore[arg-type]

    assert result.check_type == "github_repository_accessibility"
    assert result.result == "repository_accessible"
    assert student_skill.verification_tier is VerificationTier.partially_verified
    assert student_skill.verification_tier is not VerificationTier.verified
