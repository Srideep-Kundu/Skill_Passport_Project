from uuid import UUID

from app.models import Skill
from app.services.extraction_service import ExtractionPayload, normalize_candidates


def test_normalization_requires_a_taxonomy_skill_and_literal_evidence_span() -> None:
    skill = Skill(id=UUID("00000000-0000-0000-0000-000000000001"), canonical_name="Python", category="Language", aliases=["python3"])
    payload = ExtractionPayload.model_validate(
        {
            "skills": [
                {"skill": "python3", "confidence": 0.8, "evidence_span": "Python 3"},
                {"skill": "Invented", "confidence": 0.9, "evidence_span": "Invented"},
            ]
        }
    )

    normalized = normalize_candidates(payload, "Built an API with Python 3.", [skill])

    assert len(normalized) == 1
    assert normalized[0].skill.canonical_name == "Python"
    assert normalized[0].evidence_span == "Python 3"
