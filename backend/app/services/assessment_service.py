"""Deterministic assessment scoring with evidence-backed passport provenance."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any, Literal, cast
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Assessment,
    AssessmentAttempt,
    AssessmentQuestion,
    Evidence,
    EvidenceType,
    ExtractionStatus,
    Skill,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    AssessmentAttemptResponse,
    AssessmentCompetencyResult,
    AssessmentQuestionResponse,
    AssessmentResponse,
    AssessmentSubmitRequest,
    AssessmentSummaryResponse,
)

AssessmentType = Literal["technical", "soft_skill", "aptitude"]
VALID_ASSESSMENT_TYPES = {"technical", "soft_skill", "aptitude"}


class AssessmentConfigurationError(ValueError):
    """Raised when an assessment is not mapped to the canonical taxonomy."""


def _assessment_type(assessment: Assessment) -> AssessmentType:
    value = assessment.assessment_type
    if value in VALID_ASSESSMENT_TYPES:
        return cast(AssessmentType, value)
    raise AssessmentConfigurationError("Assessment type is not configured")


def _compatibility_breakdown(
    assessment_type: AssessmentType,
    competencies: list[AssessmentCompetencyResult],
) -> dict[str, Any]:
    """Keep legacy display keys, populated only from real dimension scores."""
    result: dict[str, Any] = {
        "type": "soft_skills" if assessment_type == "soft_skill" else assessment_type,
        "competencies": [item.model_dump(mode="json") for item in competencies],
    }
    percentages = {
        re.sub(r"[^a-z0-9]+", "_", item.skill_name.casefold()).strip("_"): item.percentage
        for item in competencies
    }
    if assessment_type == "soft_skill":
        for key in (
            "communication",
            "teamwork",
            "leadership",
            "adaptability",
            "problem_solving",
        ):
            if key in percentages:
                result[key] = percentages[key]
        result["strengths"] = [item.skill_name for item in competencies if item.passed]
        result["improvement_areas"] = [
            item.skill_name for item in competencies if not item.passed
        ]
    elif assessment_type == "aptitude":
        aliases = {
            "quantitative_aptitude": "quantitative_score",
            "logical_reasoning": "logical_reasoning_score",
            "analytical_reasoning": "analytical_score",
            "verbal_reasoning": "verbal_score",
        }
        for key, legacy_key in aliases.items():
            if key in percentages:
                result[legacy_key] = percentages[key]
    return result


def _attempt_response(
    attempt: AssessmentAttempt,
    assessment: Assessment,
) -> AssessmentAttemptResponse:
    percentage = round(float(attempt.score) / max(attempt.total_points, 1) * 100.0, 2)
    raw_competencies = attempt.breakdown.get("competencies", [])
    competencies = [
        AssessmentCompetencyResult.model_validate(item)
        for item in raw_competencies
        if isinstance(item, dict)
    ]
    return AssessmentAttemptResponse(
        id=attempt.id,
        assessment_id=assessment.id,
        assessment_title=assessment.title,
        assessment_type=_assessment_type(assessment),
        score=float(attempt.score),
        total_points=attempt.total_points,
        percentage=percentage,
        passed=attempt.passed,
        breakdown=attempt.breakdown,
        competencies=competencies,
        evidence_id=attempt.evidence_id,
        passport_updated=attempt.evidence_id is not None,
        completed_at=attempt.completed_at,
    )


async def list_available_assessments(
    session: AsyncSession,
    assessment_type: AssessmentType | None = None,
) -> list[AssessmentSummaryResponse]:
    stmt = (
        select(Assessment)
        .where(Assessment.is_active.is_(True))
        .options(selectinload(Assessment.questions))
        .order_by(Assessment.assessment_type, Assessment.title)
    )
    if assessment_type is not None:
        stmt = stmt.where(Assessment.assessment_type == assessment_type)
    assessments = list((await session.scalars(stmt)).all())
    return [
        AssessmentSummaryResponse(
            id=assessment.id,
            title=assessment.title,
            assessment_type=_assessment_type(assessment),
            canonical_skill_name=assessment.canonical_skill_name,
            category=assessment.category,
            difficulty=assessment.difficulty,
            duration_minutes=assessment.duration_minutes,
            passing_score=assessment.passing_score,
            question_count=len(assessment.questions),
        )
        for assessment in assessments
    ]


async def get_assessment_details(
    session: AsyncSession, assessment_id: UUID
) -> AssessmentResponse:
    assessment = await session.scalar(
        select(Assessment)
        .where(Assessment.id == assessment_id)
        .options(
            selectinload(Assessment.questions).selectinload(
                AssessmentQuestion.competency_skill
            )
        )
    )
    if assessment is None:
        raise ValueError("Assessment not found")
    return AssessmentResponse(
        id=assessment.id,
        title=assessment.title,
        assessment_type=_assessment_type(assessment),
        canonical_skill_name=assessment.canonical_skill_name,
        category=assessment.category,
        difficulty=assessment.difficulty,
        duration_minutes=assessment.duration_minutes,
        passing_score=assessment.passing_score,
        questions=[
            AssessmentQuestionResponse(
                id=question.id,
                question_text=question.question_text,
                question_type=question.question_type,
                options=question.options,
                points=question.points,
                competency_skill_id=question.competency_skill_id,
                competency_name=(
                    question.competency_skill.canonical_name
                    if question.competency_skill is not None
                    else None
                ),
            )
            for question in assessment.questions
        ],
    )


async def list_student_attempts(
    session: AsyncSession, student_id: UUID
) -> list[AssessmentAttemptResponse]:
    attempts = list(
        (
            await session.scalars(
                select(AssessmentAttempt)
                .where(AssessmentAttempt.student_id == student_id)
                .options(selectinload(AssessmentAttempt.assessment))
                .order_by(AssessmentAttempt.completed_at.desc())
            )
        ).all()
    )
    return [_attempt_response(attempt, attempt.assessment) for attempt in attempts]


async def _load_assessment(
    session: AsyncSession, assessment_id: UUID
) -> Assessment:
    assessment = await session.scalar(
        select(Assessment)
        .where(Assessment.id == assessment_id)
        .options(
            selectinload(Assessment.questions).selectinload(
                AssessmentQuestion.competency_skill
            )
        )
    )
    if assessment is None:
        raise ValueError("Assessment not found")
    return assessment


async def _mapped_questions(
    session: AsyncSession, assessment: Assessment
) -> list[tuple[AssessmentQuestion, Skill]]:
    assessment_type = _assessment_type(assessment)
    default_skill: Skill | None = None
    if assessment_type == "technical":
        if assessment.skill_id is not None:
            default_skill = await session.get(Skill, assessment.skill_id)
        if default_skill is None:
            default_skill = await session.scalar(
                select(Skill).where(
                    Skill.canonical_name.ilike(assessment.canonical_skill_name)
                )
            )

    mapped: list[tuple[AssessmentQuestion, Skill]] = []
    for question in assessment.questions:
        skill = question.competency_skill or default_skill
        if skill is None:
            raise AssessmentConfigurationError(
                "Assessment competency mapping is incomplete"
            )
        mapped.append((question, skill))
    if not mapped:
        raise AssessmentConfigurationError("Assessment has no scored questions")
    return mapped


async def submit_assessment(
    session: AsyncSession,
    student_id: UUID,
    assessment_id: UUID,
    payload: AssessmentSubmitRequest,
) -> AssessmentAttemptResponse:
    assessment = await _load_assessment(session, assessment_id)
    idempotency_key = str(payload.submission_id) if payload.submission_id else None
    if idempotency_key is not None:
        existing = await session.scalar(
            select(AssessmentAttempt)
            .where(
                AssessmentAttempt.student_id == student_id,
                AssessmentAttempt.assessment_id == assessment_id,
                AssessmentAttempt.idempotency_key == idempotency_key,
            )
            .options(selectinload(AssessmentAttempt.assessment))
        )
        if existing is not None:
            return _attempt_response(existing, existing.assessment)

    mapped_questions = await _mapped_questions(session, assessment)
    scores: dict[UUID, dict[str, Any]] = defaultdict(
        lambda: {"earned": 0, "total": 0, "skill": None}
    )
    earned_points = 0
    total_points = 0
    for question, skill in mapped_questions:
        correct = (
            payload.answers.get(str(question.id), "").strip().casefold()
            == question.correct_answer.strip().casefold()
        )
        points = max(question.points, 0)
        total_points += points
        earned_points += points if correct else 0
        scores[skill.id]["skill"] = skill
        scores[skill.id]["total"] += points
        scores[skill.id]["earned"] += points if correct else 0

    percentage = round(earned_points / max(total_points, 1) * 100.0, 2)
    passed = percentage >= assessment.passing_score
    competencies: list[AssessmentCompetencyResult] = []
    for values in sorted(
        scores.values(), key=lambda item: item["skill"].canonical_name.casefold()
    ):
        skill = cast(Skill, values["skill"])
        competency_percentage = round(
            values["earned"] / max(values["total"], 1) * 100.0, 2
        )
        competencies.append(
            AssessmentCompetencyResult(
                skill_id=skill.id,
                skill_name=skill.canonical_name,
                earned_points=values["earned"],
                total_points=values["total"],
                percentage=competency_percentage,
                passed=competency_percentage >= assessment.passing_score,
            )
        )

    breakdown = _compatibility_breakdown(_assessment_type(assessment), competencies)
    attempt = AssessmentAttempt(
        student_id=student_id,
        assessment_id=assessment.id,
        score=earned_points,
        total_points=total_points,
        passed=passed,
        answers=payload.answers,
        breakdown=breakdown,
        idempotency_key=idempotency_key,
    )
    session.add(attempt)
    await session.flush()

    if passed:
        evidence = Evidence(
            student_id=student_id,
            evidence_type=EvidenceType.certification,
            title=f"Assessment Passed: {assessment.title}",
            description=(
                f"Standardized {_assessment_type(assessment).replace('_', ' ')} "
                f"assessment completed with score {percentage}% "
                f"(pass threshold: {assessment.passing_score}%)."
            ),
            raw_metadata={
                "assessment_id": str(assessment.id),
                "attempt_id": str(attempt.id),
                "assessment_type": _assessment_type(assessment),
                "score_percentage": percentage,
                "competencies": [item.model_dump(mode="json") for item in competencies],
                "verified_at": datetime.now(UTC).isoformat(),
            },
            extraction_status=ExtractionStatus.extracted,
        )
        session.add(evidence)
        await session.flush()
        attempt.evidence_id = evidence.id

        for competency in competencies:
            if not competency.passed:
                continue
            confidence = round(competency.percentage / 100.0, 3)
            session.add(
                StudentSkill(
                    student_id=student_id,
                    skill_id=competency.skill_id,
                    source_evidence_id=evidence.id,
                    extraction_confidence=confidence,
                    verification_tier=VerificationTier.partially_verified,
                    proficiency_hint=f"Assessed: {competency.percentage}%",
                    evidence_span=(
                        f"{competency.skill_name}: {competency.earned_points}/"
                        f"{competency.total_points} weighted points in {assessment.title}"
                    ),
                )
            )

    await session.commit()
    await session.refresh(attempt)
    return _attempt_response(attempt, assessment)
