from uuid import uuid4

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Assessment,
    AssessmentAttempt,
    AssessmentQuestion,
    Evidence,
    Recruiter,
    Role,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)


@pytest_asyncio.fixture
async def assessment_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


async def _assessment(
    session: AsyncSession,
    *,
    title: str,
    assessment_type: str,
    skills: list[Skill],
) -> tuple[Assessment, list[AssessmentQuestion]]:
    assessment = Assessment(
        title=title,
        assessment_type=assessment_type,
        canonical_skill_name=skills[0].canonical_name,
        skill_id=skills[0].id,
        category="Soft Skills" if assessment_type == "soft_skill" else "Aptitude",
        difficulty="intermediate",
        duration_minutes=15,
        passing_score=70,
    )
    session.add(assessment)
    await session.flush()
    questions: list[AssessmentQuestion] = []
    for index, skill in enumerate(skills):
        for repetition in range(2):
            question = AssessmentQuestion(
                assessment_id=assessment.id,
                competency_skill_id=skill.id,
                question_text=f"{title} scenario {index}-{repetition}",
                question_type=(
                    "situational_judgment"
                    if assessment_type == "soft_skill"
                    else "mcq"
                ),
                options=["Best response", "Unsafe response"],
                correct_answer="Best response",
                explanation="Deterministic rubric",
                points=25,
            )
            session.add(question)
            questions.append(question)
    await session.flush()
    return assessment, questions


@pytest.mark.asyncio
async def test_dimension_scoring_provenance_and_replay_are_deterministic(
    assessment_client,
):
    client, factory = assessment_client
    async with factory() as session:
        student = Student(
            email="dimensions@example.test",
            password_hash="test",
            full_name="Assessment Candidate",
        )
        communication = Skill(
            canonical_name="Communication",
            category="Professional Competency",
            aliases=[],
        )
        teamwork = Skill(
            canonical_name="Teamwork",
            category="Professional Competency",
            aliases=[],
        )
        session.add_all([student, communication, teamwork])
        await session.flush()
        assessment, questions = await _assessment(
            session,
            title="Scenario Rubric",
            assessment_type="soft_skill",
            skills=[communication, teamwork],
        )
        await session.commit()
        student_id = student.id
        assessment_id = assessment.id

    submission_id = str(uuid4())
    answers = {
        str(questions[0].id): "Best response",
        str(questions[1].id): "Best response",
        str(questions[2].id): "Best response",
        str(questions[3].id): "Unsafe response",
    }
    headers = {
        "Authorization": f"Bearer {create_access_token(student_id, Role.student)}"
    }
    payload = {"answers": answers, "submission_id": submission_id}
    first = await client.post(
        f"/assessments/{assessment_id}/submit", json=payload, headers=headers
    )
    replay = await client.post(
        f"/assessments/{assessment_id}/submit", json=payload, headers=headers
    )

    assert first.status_code == replay.status_code == 200
    assert first.json()["id"] == replay.json()["id"]
    assert first.json()["percentage"] == 75.0
    results = {item["skill_name"]: item for item in first.json()["competencies"]}
    assert results["Communication"]["percentage"] == 100.0
    assert results["Communication"]["passed"] is True
    assert results["Teamwork"]["percentage"] == 50.0
    assert results["Teamwork"]["passed"] is False
    assert first.json()["passport_updated"] is True

    async with factory() as session:
        assert await session.scalar(select(func.count(AssessmentAttempt.id))) == 1
        assert await session.scalar(select(func.count(Evidence.id))) == 1
        skills = list(
            (
                await session.scalars(
                    select(StudentSkill).where(StudentSkill.student_id == student_id)
                )
            ).all()
        )
        assert len(skills) == 1
        assert skills[0].skill_id == communication.id
        assert str(skills[0].source_evidence_id) == first.json()["evidence_id"]
        assert skills[0].verification_tier == VerificationTier.partially_verified
        assert float(skills[0].extraction_confidence) == pytest.approx(1.0)

    history = await client.get("/assessments/attempts/me", headers=headers)
    assert history.status_code == 200
    assert [item["id"] for item in history.json()] == [first.json()["id"]]

    passport = await client.get("/passport/me", headers=headers)
    assert passport.status_code == 200
    assert [item["canonical_name"] for item in passport.json()["skills"]] == [
        "Communication"
    ]
    assert passport.json()["skills"][0]["source_evidence_id"] == first.json()[
        "evidence_id"
    ]

    gaps = await client.get("/skill-gaps/analyze", headers=headers)
    assert gaps.status_code == 200
    assert "overall_readiness_score" in gaps.json()


@pytest.mark.asyncio
async def test_aptitude_filter_and_missing_mapping_fail_closed(assessment_client):
    client, factory = assessment_client
    async with factory() as session:
        student = Student(
            email="aptitude@example.test",
            password_hash="test",
            full_name="Aptitude Candidate",
        )
        recruiter = Recruiter(
            email="recruiter@example.test",
            password_hash="test",
            company_name="Test Company",
        )
        aptitude_skills = [
            Skill(canonical_name=name, category="Aptitude", aliases=[])
            for name in (
                "Quantitative Aptitude",
                "Logical Reasoning",
                "Analytical Reasoning",
                "Verbal Reasoning",
            )
        ]
        session.add_all([student, recruiter, *aptitude_skills])
        await session.flush()
        aptitude, questions = await _assessment(
            session,
            title="Aptitude Dimensions",
            assessment_type="aptitude",
            skills=aptitude_skills,
        )
        broken = Assessment(
            title="Broken Mapping",
            assessment_type="soft_skill",
            canonical_skill_name="Unmapped",
            category="Soft Skills",
            difficulty="intermediate",
            duration_minutes=5,
            passing_score=70,
        )
        session.add(broken)
        await session.flush()
        broken_question = AssessmentQuestion(
            assessment_id=broken.id,
            question_text="Unmapped question",
            options=["A", "B"],
            correct_answer="A",
            points=100,
        )
        session.add(broken_question)
        await session.commit()
        student_id, recruiter_id = student.id, recruiter.id

    student_headers = {
        "Authorization": f"Bearer {create_access_token(student_id, Role.student)}"
    }
    answers = {str(question.id): "Best response" for question in questions}
    result = await client.post(
        f"/assessments/{aptitude.id}/submit",
        json={"answers": answers, "submission_id": str(uuid4())},
        headers=student_headers,
    )
    assert result.status_code == 200
    assert result.json()["percentage"] == 100.0
    assert {item["skill_name"] for item in result.json()["competencies"]} == {
        "Quantitative Aptitude",
        "Logical Reasoning",
        "Analytical Reasoning",
        "Verbal Reasoning",
    }
    async with factory() as session:
        persisted_skills = list(
            (
                await session.scalars(
                    select(StudentSkill).where(
                        StudentSkill.student_id == student_id
                    )
                )
            ).all()
        )
        assert len(persisted_skills) == 4
        assert {str(item.source_evidence_id) for item in persisted_skills} == {
            result.json()["evidence_id"]
        }

    catalog = await client.get("/assessments?assessment_type=aptitude")
    assert catalog.status_code == 200
    assert {item["assessment_type"] for item in catalog.json()} == {"aptitude"}

    broken_result = await client.post(
        f"/assessments/{broken.id}/submit",
        json={"answers": {str(broken_question.id): "A"}},
        headers=student_headers,
    )
    assert broken_result.status_code == 409
    assert broken_result.json()["detail"] == "Assessment competency mapping is incomplete"

    recruiter_headers = {
        "Authorization": f"Bearer {create_access_token(recruiter_id, Role.recruiter)}"
    }
    forbidden = await client.post(
        f"/assessments/{aptitude.id}/submit",
        json={"answers": answers},
        headers=recruiter_headers,
    )
    assert forbidden.status_code == 403
