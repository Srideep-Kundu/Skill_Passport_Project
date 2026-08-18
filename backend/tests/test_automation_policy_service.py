from datetime import UTC, datetime
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
    Application,
    ApplicationField,
    ApplicationStatus,
    ApplicationSubmissionAttempt,
    AuditLog,
    AutomationPolicy,
    Evidence,
    EvidenceType,
    ExternalJob,
    ExternalJobMatch,
    ExternalJobRequirement,
    ResumeDocument,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.services.automation_policy_service import (
    apply_policies_to_matches,
    evaluate_policy,
)
from app.services.matching_service import compute_and_persist_external_job_match


@pytest_asyncio.fixture
async def policy_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

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


def test_policy_is_post_score_and_never_authorizes_submission() -> None:
    policy = AutomationPolicy(
        student_id=uuid4(),
        name="Safe",
        enabled=True,
        minimum_match_score=0.8,
        allowed_providers=["greenhouse"],
        auto_create_review_intent=True,
    )
    job = ExternalJob(
        provider="greenhouse",
        provider_source="acme",
        external_id="job",
        title="Python Intern",
        company_name="Acme",
        description="Python",
        source_url="https://example.test",
        last_synced_at=datetime.now(UTC),
    )
    match = ExternalJobMatch(
        student_id=policy.student_id,
        external_job_id=uuid4(),
        deterministic_score=0.8,
        semantic_score=0,
        verification_bonus=0,
        final_score=0.8,
        score_version="v1",
        input_fingerprint="x" * 64,
    )
    decision = evaluate_policy(policy, job, match, set())
    assert decision.eligible is True
    assert decision.actions == ("surface", "create_review_intent")
    assert "submit" not in decision.actions and "approve" not in decision.actions


def test_disabled_or_excluding_policy_never_creates_a_review_action() -> None:
    student_id = uuid4()
    job = ExternalJob(
        provider="greenhouse",
        provider_source="acme",
        external_id="excluded-job",
        title="Python Intern",
        company_name="Acme",
        description="Python",
        source_url="https://example.test",
        last_synced_at=datetime.now(UTC),
    )
    match = ExternalJobMatch(
        student_id=student_id,
        external_job_id=uuid4(),
        deterministic_score=0.8,
        semantic_score=0,
        verification_bonus=0,
        final_score=0.8,
        score_version="v1",
        input_fingerprint="x" * 64,
    )
    disabled = AutomationPolicy(
        student_id=student_id,
        name="Disabled",
        enabled=False,
        auto_create_review_intent=True,
    )
    excluded = AutomationPolicy(
        student_id=student_id,
        name="Exclude Acme",
        enabled=True,
        minimum_match_score=0.2,
        excluded_companies=["acme"],
        auto_create_review_intent=True,
    )
    assert evaluate_policy(disabled, job, match, set()).actions == ()
    assert evaluate_policy(excluded, job, match, set()).actions == ()


@pytest.mark.asyncio
async def test_policy_crud_is_student_scoped(
    policy_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = policy_client
    async with factory() as session:
        student = Student(
            email="policy-api@example.test",
            password_hash="hash",
            full_name="Policy Student",
        )
        other = Student(
            email="other-policy-api@example.test",
            password_hash="hash",
            full_name="Other Student",
        )
        session.add_all([student, other])
        await session.commit()
        token = create_access_token(student.id, "student")
        other_token = create_access_token(other.id, "student")
    headers = {"Authorization": f"Bearer {token}"}
    created = await client.post(
        "/automation-policies",
        headers=headers,
        json={
            "name": "Review only",
            "enabled": False,
            "auto_create_review_intent": True,
            "maximum_review_intents_per_run": 1,
            "maximum_review_intents_per_day": 1,
        },
    )
    assert created.status_code == 201, created.text
    policy_id = created.json()["id"]
    listed = await client.get("/automation-policies", headers=headers)
    assert listed.status_code == 200 and listed.json()["total"] == 1
    assert (
        await client.get(
            f"/automation-policies/{policy_id}",
            headers={"Authorization": f"Bearer {other_token}"},
        )
    ).status_code == 404
    updated = await client.patch(
        f"/automation-policies/{policy_id}", headers=headers, json={"enabled": True}
    )
    assert updated.status_code == 200 and updated.json()["enabled"] is True


@pytest.mark.asyncio
async def test_policy_creates_only_one_pending_review_intent_without_preparation() -> (
    None
):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)
    async with factory() as session:
        student = Student(
            email="policy@example.test",
            password_hash="hash",
            full_name="Policy Student",
            university="University A",
        )
        skill = Skill(canonical_name="Python", category="language", aliases=[])
        job = ExternalJob(
            provider="greenhouse",
            provider_source="acme",
            external_id="job",
            title="Python Intern",
            company_name="Acme",
            description="Required: Python",
            source_url="https://example.test/job",
            apply_url="https://example.test/apply",
            last_synced_at=datetime.now(UTC),
        )
        session.add_all([student, skill, job])
        await session.flush()
        evidence = Evidence(
            student_id=student.id,
            evidence_type=EvidenceType.project,
            title="Python API",
            description="Python",
        )
        resume = ResumeDocument(
            student_id=student.id,
            original_filename="resume.docx",
            storage_key="resume",
            mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size_bytes=100,
            checksum="a" * 64,
            parser_version="v1",
            is_active=True,
            parsed_data={},
        )
        policy = AutomationPolicy(
            student_id=student.id,
            name="Safe review",
            enabled=True,
            minimum_match_score=0.2,
            auto_create_review_intent=True,
            maximum_jobs_per_run=1,
            maximum_review_intents_per_run=1,
            maximum_review_intents_per_day=1,
        )
        session.add_all([evidence, resume, policy])
        await session.flush()
        session.add(
            StudentSkill(
                student_id=student.id,
                skill_id=skill.id,
                source_evidence_id=evidence.id,
                extraction_confidence=0.9,
                verification_tier=VerificationTier.verified,
                evidence_span="Python",
            )
        )
        session.add(
            ExternalJobRequirement(
                external_job_id=job.id,
                skill_id=skill.id,
                is_required=True,
                weight=1,
                confidence=1,
                source_span="Python",
            )
        )
        await session.commit()
        assert await compute_and_persist_external_job_match(session, student.id, job.id)

        assert (
            await apply_policies_to_matches(
                session, student=student, external_job_ids={job.id}
            )
            == 1
        )
        assert (
            await apply_policies_to_matches(
                session, student=student, external_job_ids={job.id}
            )
            == 0
        )

        applications = list((await session.scalars(select(Application))).all())
        assert len(applications) == 1
        assert applications[0].status == ApplicationStatus.approval_pending
        assert (
            int(
                (
                    await session.scalar(
                        select(func.count()).select_from(ApplicationField)
                    )
                )
                or 0
            )
            == 0
        )
        assert (
            int(
                (
                    await session.scalar(
                        select(func.count()).select_from(ApplicationSubmissionAttempt)
                    )
                )
                or 0
            )
            == 0
        )
        events = set((await session.scalars(select(AuditLog.action))).all())
        assert {
            "policy_evaluated",
            "recommendation_selected_by_policy",
            "application_review_intent_created",
        }.issubset(events)
    await engine.dispose()
