"""Idempotent canonical assessment catalog for SIH Phase 1."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Assessment, AssessmentQuestion, Skill


@dataclass(frozen=True)
class QuestionSpec:
    competency: str
    text: str
    options: list[str]
    answer: str
    explanation: str
    points: int = 25


SOFT_SKILLS = {
    "Communication": "Professional Competency",
    "Teamwork": "Professional Competency",
    "Leadership": "Professional Competency",
    "Adaptability": "Professional Competency",
    "Problem Solving": "Professional Competency",
}

APTITUDE_SKILLS = {
    "Quantitative Aptitude": "Aptitude",
    "Logical Reasoning": "Aptitude",
    "Analytical Reasoning": "Aptitude",
    "Verbal Reasoning": "Aptitude",
}

SOFT_QUESTIONS = [
    QuestionSpec(
        "Leadership",
        "A critical production release is scheduled for tomorrow, but your code review reveals a minor security vulnerability. What is the most responsible action?",
        [
            "Document the finding, notify the tech lead and release manager immediately, and propose a hotfix before deployment",
            "Ignore it since the ticket is marked high priority by marketing",
            "Secretly push a patch after production deployment without informing teammates",
            "Blame the junior engineer who authored the module",
        ],
        "Document the finding, notify the tech lead and release manager immediately, and propose a hotfix before deployment",
        "Responsible leadership makes risk visible and coordinates a safe response.",
    ),
    QuestionSpec(
        "Communication",
        "During a cross-functional sprint planning meeting, product and engineering disagree sharply on scope. How do you facilitate alignment?",
        [
            "Deconstruct requirements into essential MVP milestones and negotiate trade-offs using objective technical effort estimates",
            "Walk out of the meeting in protest",
            "Agree to all demands without reviewing capacity",
            "Insist engineering makes all decisions unilaterally",
        ],
        "Deconstruct requirements into essential MVP milestones and negotiate trade-offs using objective technical effort estimates",
        "Clear framing and evidence-based trade-offs support shared decisions.",
    ),
    QuestionSpec(
        "Teamwork",
        "You discover a teammate is struggling to meet a milestone due to unfamiliarity with Docker. What demonstrates positive teamwork?",
        [
            "Offer a 30-minute pair-programming session to share onboarding templates and debug together",
            "Complain to the engineering manager during daily standup",
            "Take over the ticket and do it yourself in silence",
            "Refuse to assist because it is outside your assigned tickets",
        ],
        "Offer a 30-minute pair-programming session to share onboarding templates and debug together",
        "Collaborative support improves capability without removing ownership.",
    ),
    QuestionSpec(
        "Adaptability",
        "You receive constructive but critical feedback on your architectural proposal during design review. What is the best response?",
        [
            "Thank the reviewer, objectively evaluate their trade-off arguments, and update the proposal with benchmarked justifications",
            "Take it personally and argue defensively",
            "Ignore all review comments and proceed with the initial design",
            "Delete the document in frustration",
        ],
        "Thank the reviewer, objectively evaluate their trade-off arguments, and update the proposal with benchmarked justifications",
        "Adaptability requires evaluating new evidence and revising the approach.",
    ),
    QuestionSpec(
        "Problem Solving",
        "A recurring service failure has three plausible causes and limited production diagnostics. What should you do first?",
        [
            "Form hypotheses, collect targeted telemetry, reproduce safely, and test the highest-risk cause first",
            "Change several components at once and wait for complaints",
            "Assume the newest engineer caused it",
            "Restart the service repeatedly without recording evidence",
        ],
        "Form hypotheses, collect targeted telemetry, reproduce safely, and test the highest-risk cause first",
        "Structured diagnosis isolates causes while limiting operational risk.",
    ),
]

APTITUDE_QUESTIONS = [
    QuestionSpec(
        "Quantitative Aptitude",
        "A server processing pipeline handles 1,200 requests/sec with a 15% annual growth rate. In 2 years, what capacity is required?",
        ["~1,587 req/sec", "~1,380 req/sec", "~2,400 req/sec", "~1,230 req/sec"],
        "~1,587 req/sec",
        "1200 × 1.15² = approximately 1587 requests per second.",
    ),
    QuestionSpec(
        "Logical Reasoning",
        "If all Microservices are Distributed Systems, and some Distributed Systems are Fault-Tolerant, which deduction is logically valid?",
        [
            "Some Distributed Systems are Microservices",
            "All Microservices are Fault-Tolerant",
            "No Microservices are Fault-Tolerant",
            "All Fault-Tolerant systems are Microservices",
        ],
        "Some Distributed Systems are Microservices",
        "If all A are B, then the members of A are also members of B.",
    ),
    QuestionSpec(
        "Analytical Reasoning",
        "In a code repository, 40% of files are Python, 35% are TypeScript, and 10% contain both. What percentage contains either Python or TypeScript?",
        ["65%", "75%", "85%", "55%"],
        "65%",
        "Use inclusion-exclusion: 40 + 35 - 10 = 65%.",
    ),
    QuestionSpec(
        "Quantitative Aptitude",
        "A database query takes 120ms with table scan. Adding a B-Tree index reduces execution time by 85%. What is the new query time?",
        ["18ms", "24ms", "35ms", "12ms"],
        "18ms",
        "120 × (1 - 0.85) = 18 milliseconds.",
    ),
    QuestionSpec(
        "Verbal Reasoning",
        "Choose the statement that most clearly preserves the meaning: 'The deployment proceeded only after every critical check passed.'",
        [
            "Every critical check had to pass before deployment could proceed",
            "The deployment proceeded before the critical checks",
            "Some failed checks were ignored during deployment",
            "Critical checks were optional after deployment",
        ],
        "Every critical check had to pass before deployment could proceed",
        "The sentence states that passing every critical check was a prerequisite.",
    ),
]


async def _skills(session: AsyncSession) -> dict[str, Skill]:
    result: dict[str, Skill] = {}
    for name, category in {**SOFT_SKILLS, **APTITUDE_SKILLS}.items():
        skill = await session.scalar(
            select(Skill).where(Skill.canonical_name.ilike(name))
        )
        if skill is None:
            skill = Skill(canonical_name=name, category=category, aliases=[])
            session.add(skill)
            await session.flush()
        result[name] = skill
    return result


async def _upsert_assessment(
    session: AsyncSession,
    *,
    title: str,
    assessment_type: str,
    canonical_skill_name: str,
    category: str,
    questions: list[QuestionSpec],
    skills: dict[str, Skill],
) -> Assessment:
    assessment = await session.scalar(select(Assessment).where(Assessment.title == title))
    if assessment is None:
        assessment = Assessment(
            title=title,
            assessment_type=assessment_type,
            canonical_skill_name=canonical_skill_name,
            skill_id=skills[canonical_skill_name].id,
            category=category,
            difficulty="intermediate",
            duration_minutes=20,
            passing_score=70,
        )
        session.add(assessment)
        await session.flush()
    else:
        assessment.assessment_type = assessment_type
        assessment.skill_id = skills[canonical_skill_name].id

    existing = {
        item.question_text: item
        for item in (
            await session.scalars(
                select(AssessmentQuestion).where(
                    AssessmentQuestion.assessment_id == assessment.id
                )
            )
        ).all()
    }
    for spec in questions:
        question = existing.get(spec.text)
        if question is None:
            question = AssessmentQuestion(
                assessment_id=assessment.id,
                question_text=spec.text,
                question_type=(
                    "situational_judgment"
                    if assessment_type == "soft_skill"
                    else "mcq"
                ),
                options=spec.options,
                correct_answer=spec.answer,
                explanation=spec.explanation,
                points=spec.points,
            )
            session.add(question)
        question.competency_skill_id = skills[spec.competency].id
    return assessment


async def seed_phase1_assessments(session: AsyncSession) -> None:
    skills = await _skills(session)
    await _upsert_assessment(
        session,
        title="Workplace Situational Judgment & Soft Skills",
        assessment_type="soft_skill",
        canonical_skill_name="Leadership",
        category="Soft Skills",
        questions=SOFT_QUESTIONS,
        skills=skills,
    )
    await _upsert_assessment(
        session,
        title="Quantitative & Analytical Reasoning Diagnostic",
        assessment_type="aptitude",
        canonical_skill_name="Analytical Reasoning",
        category="Aptitude",
        questions=APTITUDE_QUESTIONS,
        skills=skills,
    )

    technical = list(
        (
            await session.scalars(
                select(Assessment).where(
                    Assessment.assessment_type == "technical"
                )
            )
        ).all()
    )
    for assessment in technical:
        skill = await session.scalar(
            select(Skill).where(
                Skill.canonical_name.ilike(assessment.canonical_skill_name)
            )
        )
        if skill is None:
            continue
        assessment.skill_id = skill.id
        questions = (
            await session.scalars(
                select(AssessmentQuestion).where(
                    AssessmentQuestion.assessment_id == assessment.id
                )
            )
        ).all()
        for question in questions:
            question.competency_skill_id = skill.id

    await session.flush()
