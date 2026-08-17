from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Application,
    ApplicationField,
    ApplicationSubmissionAttempt,
    AuditLog,
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
from app.services import (
    application_execution_service,
    application_service,
    application_tracking_service,
)
from app.services.job_providers import (
    DeterministicTestApplicationProvider,
    JobProviderRegistry,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


@pytest_asyncio.fixture
async def execution_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _approved_application(
    client: httpx.AsyncClient,
    factory: async_sessionmaker[AsyncSession],
    monkeypatch: pytest.MonkeyPatch,
    outcomes: tuple[str, ...] = ("submitted",),
    *,
    provider_name: str = "test_application",
) -> tuple[str, str, UUID, DeterministicTestApplicationProvider | None]:
    provider = DeterministicTestApplicationProvider(outcomes) if provider_name == "test_application" else None
    if provider is not None:
        registry = JobProviderRegistry((provider,))
        monkeypatch.setattr(application_execution_service, "provider_registry", registry)
        monkeypatch.setattr(application_service, "provider_registry", registry)
        monkeypatch.setattr(application_tracking_service, "provider_registry", registry)
    async with factory() as session:
        student = Student(email=f"{provider_name}@example.test", password_hash="hash", full_name="Execution Student", university="University A")
        other = Student(email=f"other-{provider_name}@example.test", password_hash="hash", full_name="Other Student", university="University B")
        skill = Skill(canonical_name="Python", category="language", aliases=[])
        job = ExternalJob(provider=provider_name, provider_source="fixture", external_id=f"{provider_name}-job", title="Platform Intern", company_name="Acme", description="Requirements: Python", source_url="https://example.test/job", apply_url="https://example.test/apply")
        session.add_all([student, other, skill, job])
        await session.flush()
        resume = ResumeDocument(student_id=student.id, original_filename="resume.docx", storage_key=f"resume-{provider_name}", mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes=100, checksum="a" * 64, parser_version="v1", is_active=True, parsed_data={"contact": {"phone": "+1 555 0100", "github_links": [], "portfolio_links": []}})
        evidence = Evidence(student_id=student.id, evidence_type=EvidenceType.project, title="Python API", description="Python")
        session.add_all([resume, evidence])
        await session.flush()
        session.add(StudentSkill(student_id=student.id, skill_id=skill.id, source_evidence_id=evidence.id, extraction_confidence=0.9, verification_tier=VerificationTier.verified, evidence_span="Python"))
        session.add(ExternalJobRequirement(external_job_id=job.id, skill_id=skill.id, is_required=True, weight=1, confidence=1, source_span="Python"))
        await session.commit()
        token = create_access_token(student.id, "student")
        other_token = create_access_token(other.id, "student")

    matches = await client.post("/external-jobs/matches/recompute", headers=_headers(token))
    assert matches.status_code == 200
    match_id = matches.json()[0]["id"]
    created = await client.post("/applications", headers=_headers(token), json={"external_job_id": str(job.id), "external_job_match_id": match_id})
    assert created.status_code == 201, created.text
    application_id = created.json()["id"]
    assert (await client.post(f"/applications/{application_id}/request-approval", headers=_headers(token))).status_code == 200
    assert (await client.post(f"/applications/{application_id}/approve", headers=_headers(token))).status_code == 200
    return token, other_token, UUID(application_id), provider


async def _ready(
    client: httpx.AsyncClient,
    token: str,
    application_id: UUID,
) -> None:
    prepared = await client.post(f"/applications/{application_id}/prepare", headers=_headers(token))
    assert prepared.status_code == 200, prepared.text
    assert prepared.json()["unresolved_field_ids"] == ["why_interested", "work_authorization"]
    assert (await client.put(f"/applications/{application_id}/answers", headers=_headers(token), json={"answers": {"why_interested": "My evidence-backed Python work fits this role.", "work_authorization": "yes"}})).status_code == 200
    assert (await client.post(f"/applications/{application_id}/ready", headers=_headers(token))).status_code == 200


@pytest.mark.asyncio
async def test_prepare_masks_sensitive_fields_and_executes_idempotently(
    execution_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, factory = execution_client
    token, other_token, application_id, provider = await _approved_application(client, factory, monkeypatch)
    async with factory() as session:
        application = await session.get(Application, application_id)
        assert application is not None
        match = await session.get(ExternalJobMatch, application.external_job_match_id)
        assert match is not None
        score_before = float(match.final_score)
    prepared = await client.post(f"/applications/{application_id}/prepare", headers=_headers(token))
    assert prepared.status_code == 200
    form = prepared.json()
    assert form["provider_auto_apply"] is True and form["is_assisted"] is False
    assert form["unresolved_field_ids"] == ["why_interested", "work_authorization"]
    sensitive = next(field for field in form["fields"] if field["field_id"] == "work_authorization")
    assert sensitive["sensitive"] is True and sensitive["requires_user_input"] is True and sensitive["answer"] is None
    assert (await client.post(f"/applications/{application_id}/ready", headers=_headers(token))).status_code == 409
    assert (await client.put(f"/applications/{application_id}/answers", headers=_headers(other_token), json={"answers": {"work_authorization": "yes"}})).status_code == 404
    updated = await client.put(f"/applications/{application_id}/answers", headers=_headers(token), json={"answers": {"why_interested": "My evidence-backed Python work fits this role.", "work_authorization": "yes"}})
    assert updated.status_code == 200 and updated.json()["unresolved_field_ids"] == []
    masked = await client.get(f"/applications/{application_id}/form", headers=_headers(token))
    sensitive = next(field for field in masked.json()["fields"] if field["field_id"] == "work_authorization")
    assert sensitive["answer"] is None and sensitive["is_answered"] is True
    ready = await client.post(f"/applications/{application_id}/ready", headers=_headers(token))
    assert ready.status_code == 200 and ready.json()["status"] == "ready_to_submit"
    submitted = await client.post(f"/applications/{application_id}/submit", headers=_headers(token))
    assert submitted.status_code == 200 and submitted.json()["status"] == "submitted"
    timeline_response = await client.get(f"/applications/{application_id}/timeline", headers=_headers(token))
    confirmed_event = next(event for event in timeline_response.json() if event["event_type"] == "submission_confirmed")
    assert confirmed_event["source"] == "provider" and confirmed_event["status"] == "submitted"
    assert provider is not None and provider.submit_calls == 1
    assert (await client.post(f"/applications/{application_id}/submit", headers=_headers(token))).status_code == 409
    async with factory() as session:
        attempts = list((await session.scalars(select(ApplicationSubmissionAttempt).where(ApplicationSubmissionAttempt.application_id == application_id))).all())
        assert len(attempts) == 1 and attempts[0].attempt_count == 1 and attempts[0].provider_response_id
        sensitive_field = await session.scalar(select(ApplicationField).where(ApplicationField.application_id == application_id, ApplicationField.field_id == "work_authorization"))
        assert sensitive_field is not None and sensitive_field.answer == "yes"
        audit = list((await session.scalars(select(AuditLog).where(AuditLog.entity_id == application_id))).all())
        assert all("yes" not in str(item.details) and "evidence-backed Python" not in str(item.details) for item in audit)
        match = await session.get(ExternalJobMatch, application.external_job_match_id)
        assert match is not None
        assert float(match.final_score) == score_before


@pytest.mark.asyncio
async def test_submission_requires_an_active_approval(
    execution_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, factory = execution_client
    token, _, application_id, provider = await _approved_application(client, factory, monkeypatch)
    assert (await client.post(f"/applications/{application_id}/revoke-approval", headers=_headers(token))).status_code == 200
    assert (await client.post(f"/applications/{application_id}/submit", headers=_headers(token))).status_code == 409
    assert provider is not None and provider.submit_calls == 0


@pytest.mark.asyncio
async def test_submission_refuses_a_changed_resume_snapshot(
    execution_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, factory = execution_client
    token, _, application_id, provider = await _approved_application(client, factory, monkeypatch)
    await _ready(client, token, application_id)
    async with factory() as session:
        application = await session.get(Application, application_id)
        assert application is not None
        resume = await session.get(ResumeDocument, application.resume_document_id)
        assert resume is not None
        resume.checksum = "b" * 64
        await session.commit()
    assert (await client.post(f"/applications/{application_id}/submit", headers=_headers(token))).status_code == 409
    assert provider is not None and provider.submit_calls == 0


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("outcomes", "expected_status", "retry"),
    [
        (("rejected_by_provider",), "failed", False),
        (("validation_failed",), "needs_input", False),
        (("rate_limited", "submitted"), "ready_to_submit", True),
        (("temporary_failure", "submitted"), "ready_to_submit", True),
        (("unknown_submission_state",), "unknown_submission_state", False),
    ],
)
async def test_test_provider_normalizes_submission_outcomes(
    execution_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
    outcomes: tuple[str, ...],
    expected_status: str,
    retry: bool,
) -> None:
    client, factory = execution_client
    token, _, application_id, provider = await _approved_application(client, factory, monkeypatch, outcomes)
    await _ready(client, token, application_id)
    response = await client.post(f"/applications/{application_id}/submit", headers=_headers(token))
    assert response.status_code == 200 and response.json()["status"] == expected_status
    if retry:
        retried = await client.post(f"/applications/{application_id}/submit", headers=_headers(token))
        assert retried.status_code == 200 and retried.json()["status"] == "submitted"
        assert provider is not None and provider.submit_calls == 2
    elif expected_status == "unknown_submission_state":
        assert (await client.post(f"/applications/{application_id}/submit", headers=_headers(token))).status_code == 409


@pytest.mark.asyncio
async def test_greenhouse_is_assisted_only_and_never_submits(
    execution_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, factory = execution_client
    token, _, application_id, _ = await _approved_application(client, factory, monkeypatch, provider_name="greenhouse")
    prepared = await client.post(f"/applications/{application_id}/prepare", headers=_headers(token))
    assert prepared.status_code == 200 and prepared.json()["is_assisted"] is True
    assert {field["field_id"] for field in prepared.json()["fields"]} == {"full_name", "email", "phone"}
    assert (await client.post(f"/applications/{application_id}/ready", headers=_headers(token))).status_code == 409
    assert (await client.post(f"/applications/{application_id}/submit", headers=_headers(token))).status_code == 409


@pytest.mark.asyncio
async def test_manual_tracking_timeline_is_user_reported_and_withdrawal_is_local(
    execution_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, _, = execution_client
    token, other_token, application_id, _ = await _approved_application(client, execution_client[1], monkeypatch)
    assert (await client.post(f"/applications/{application_id}/manual", headers=_headers(token))).status_code == 200
    invalid = await client.post(f"/applications/{application_id}/mark-manual-submitted", headers=_headers(token), json={"provider_reference": "not safe/"})
    assert invalid.status_code == 422
    marked = await client.post(f"/applications/{application_id}/mark-manual-submitted", headers=_headers(token), json={"provider_reference": "candidate-123"})
    assert marked.status_code == 200
    assert marked.json()["status"] == "submitted"
    assert marked.json()["tracking_status"] == "submitted"
    assert marked.json()["tracking_status_source"] == "user"
    assert (await client.get(f"/applications/{application_id}/timeline", headers=_headers(other_token))).status_code == 404
    timeline = (await client.get(f"/applications/{application_id}/timeline", headers=_headers(token))).json()
    manual_event = next(event for event in timeline if event["event_type"] == "manual_submission_recorded")
    assert manual_event["source"] == "user" and manual_event["provider_status"] is None
    withdrawn = await client.post(f"/applications/{application_id}/withdraw", headers=_headers(token))
    assert withdrawn.status_code == 200 and withdrawn.json()["tracking_status"] == "withdrawn"
    assert withdrawn.json()["tracking_status_source"] == "user"
    assert (await client.post(f"/applications/{application_id}/withdraw", headers=_headers(token))).status_code == 409


@pytest.mark.asyncio
async def test_ambiguous_submission_reconciliation_never_replays_the_post(
    execution_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]], monkeypatch: pytest.MonkeyPatch
) -> None:
    client, factory = execution_client
    token, _, application_id, provider = await _approved_application(client, factory, monkeypatch, ("unknown_submission_state",))
    await _ready(client, token, application_id)
    assert (await client.post(f"/applications/{application_id}/submit", headers=_headers(token))).json()["status"] == "unknown_submission_state"
    assert provider is not None and provider.submit_calls == 1
    reconciled = await client.post(f"/applications/{application_id}/reconcile", headers=_headers(token))
    assert reconciled.status_code == 200 and reconciled.json()["status"] == "unknown_submission_state"
    assert (await client.post(f"/applications/{application_id}/reconcile", headers=_headers(token))).status_code == 409
    assert (await client.post(f"/applications/{application_id}/submit", headers=_headers(token))).status_code == 409
    assert provider.submit_calls == 1
    attempts = (await client.get(f"/applications/{application_id}/attempts", headers=_headers(token))).json()
    assert len(attempts) == 1 and attempts[0]["status"] == "unknown_submission_state"
    timeline = (await client.get(f"/applications/{application_id}/timeline", headers=_headers(token))).json()
    assert [event["created_at"] for event in timeline] == sorted(event["created_at"] for event in timeline)
    assert any(event["event_type"] == "status_reconciliation_requested" for event in timeline)
    confirmed = await client.post(f"/applications/{application_id}/mark-manual-submitted", headers=_headers(token), json={})
    assert confirmed.status_code == 200 and confirmed.json()["tracking_status_source"] == "user"
