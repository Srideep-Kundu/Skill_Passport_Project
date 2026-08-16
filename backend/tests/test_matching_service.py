from uuid import UUID

import pytest

from app.models import VerificationTier
from app.services.matching_service import (
    PossessedSkill,
    RequirementInput,
    calculate_score,
)

PYTHON = UUID("00000000-0000-0000-0000-000000000001")
FASTAPI = UUID("00000000-0000-0000-0000-000000000002")
TENSORFLOW = UUID("00000000-0000-0000-0000-000000000004")
KERAS = UUID("00000000-0000-0000-0000-000000000005")
EVIDENCE = UUID("00000000-0000-0000-0000-000000000010")


def test_score_is_deterministic_and_evidence_backed() -> None:
    requirements = [
        RequirementInput(PYTHON, 2.0, True, [1.0, 0.0]),
        RequirementInput(FASTAPI, 1.0, True, [0.0, 1.0]),
    ]
    possessed = [PossessedSkill(PYTHON, EVIDENCE, 0.9, VerificationTier.verified.value, [1.0, 0.0])]

    first = calculate_score(requirements, possessed)
    second = calculate_score(requirements, list(reversed(possessed)))

    assert first == second
    assert first.deterministic_score == pytest.approx(0.6)
    assert first.semantic_score == 0.0
    assert 0.0 <= first.final_score <= 1.0
    assert first.components[0].evidence_id == EVIDENCE
    assert first.components[1].status == "missing"


def test_semantic_near_match_requires_threshold() -> None:
    requirements = [RequirementInput(FASTAPI, 1.0, True, [1.0, 0.0])]
    possessed = [PossessedSkill(PYTHON, EVIDENCE, 1.0, VerificationTier.unverified.value, [0.8, 0.6])]

    result = calculate_score(requirements, possessed)

    assert result.deterministic_score == 0.0
    assert result.semantic_score == pytest.approx(0.8)
    assert result.components[0].status == "semantic_near_match"


def test_identical_skill_inputs_ignore_identity_attributes() -> None:
    requirements = [RequirementInput(PYTHON, 1.0, True, [1.0])]
    same_evidence = [PossessedSkill(PYTHON, EVIDENCE, 0.8, VerificationTier.partially_verified.value, [1.0])]

    # Names and universities cannot be supplied to the score function at all.
    assert calculate_score(requirements, same_evidence) == calculate_score(requirements, same_evidence)


def test_semantic_credit_is_thresholded_weighted_and_one_to_one() -> None:
    requirements = [
        RequirementInput(TENSORFLOW, 2.0, True, [1.0, 0.0]),
        RequirementInput(KERAS, 1.0, True, [1.0, 0.0]),
    ]
    possessed = [PossessedSkill(PYTHON, EVIDENCE, 1.0, VerificationTier.unverified.value, [0.8, 0.6])]

    result = calculate_score(requirements, possessed, semantic_enabled=True, semantic_threshold=0.75)

    assert result.semantic_score == pytest.approx(2 / 3 * 0.8)
    assert sum(component.status == "semantic_near_match" for component in result.components) == 1
    semantic = next(component for component in result.components if component.status == "semantic_near_match")
    assert semantic.matched_skill_id == PYTHON
    assert semantic.semantic_similarity == pytest.approx(0.8)
    assert semantic.semantic_contribution == pytest.approx(0.25 * result.semantic_score)


def test_semantic_threshold_boundary_and_disabled_mode() -> None:
    requirements = [RequirementInput(TENSORFLOW, 1.0, True, [1.0, 0.0])]
    possessed = [PossessedSkill(KERAS, EVIDENCE, 1.0, VerificationTier.unverified.value, [0.75, (1 - 0.75**2) ** 0.5])]

    at_threshold = calculate_score(requirements, possessed, semantic_enabled=True, semantic_threshold=0.75)
    disabled = calculate_score(requirements, possessed, semantic_enabled=False)

    assert at_threshold.semantic_score == pytest.approx(0.75)
    assert disabled.semantic_score == 0.0
    assert disabled.components[0].status == "missing"


def test_component_contributions_reconcile_to_final_score() -> None:
    requirements = [RequirementInput(PYTHON, 1.0, True, [1.0])]
    possessed = [PossessedSkill(PYTHON, EVIDENCE, 0.8, VerificationTier.partially_verified.value, [1.0])]

    result = calculate_score(requirements, possessed)

    assert sum(component.contribution for component in result.components) == pytest.approx(result.final_score)
    component = result.components[0]
    assert component.deterministic_contribution == pytest.approx(0.65 * result.deterministic_score)
    assert component.verification_contribution == pytest.approx(result.verification_bonus)
