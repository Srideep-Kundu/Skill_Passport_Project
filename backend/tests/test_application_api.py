from uuid import UUID

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    Application,
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


@pytest_asyncio.fixture
async def application_client():
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


def _resume(student_id: UUID, suffix: str, *, active: bool) -> ResumeDocument:
    return ResumeDocument(
        student_id=student_id,
        original_filename=f"resume-{suffix}.docx",
        storage_key=f"resume-{suffix}",
        mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size_bytes=100,
        checksum=(suffix * 64)[:64],
        parser_version="v1",
        is_active=active,
        parsed_data={"contact": {"phone": "+1 555 0100", "github_links": ["https://github.com/student"], "portfolio_links": []}},
    )


@pytest.mark.asyncio
async def test_application_approval_workflow_snapshot_staleness_ownership_and_audit(
    application_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = application_client
    async with factory() as session:
        student = Student(email="student@example.test", password_hash="hash", full_name="Student One", university="University A")
        other = Student(email="other@example.test", password_hash="hash", full_name="Other Student", university="University B")
        skill = Skill(canonical_name="Python", category="language", aliases=[])
        job = ExternalJob(provider="greenhouse", provider_source="acme", external_id="job-1", title="Backend Intern", company_name="Acme", description="Requirements: Python", source_url="https://boards.greenhouse.io/acme/jobs/job-1", apply_url="https://boards.greenhouse.io/acme/jobs/job-1")
        other_job = ExternalJob(provider="greenhouse", provider_source="acme", external_id="job-2", title="Other Intern", company_name="Acme", description="Requirements: Python", source_url="https://boards.greenhouse.io/acme/jobs/job-2")
        session.add_all([student, other, skill, job, other_job])
        await session.flush()
        active_resume, replacement_resume = _resume(student.id, "a", active=True), _resume(student.id, "b", active=False)
        evidence = Evidence(student_id=student.id, evidence_type=EvidenceType.project, title="Python API", description="Python")
        session.add_all([active_resume, replacement_resume, evidence])
        await session.flush()
        session.add(StudentSkill(student_id=student.id, skill_id=skill.id, source_evidence_id=evidence.id, extraction_confidence=0.9, verification_tier=VerificationTier.verified, evidence_span="Python"))
        session.add_all([
            ExternalJobRequirement(external_job_id=job.id, skill_id=skill.id, is_required=True, weight=1, confidence=1, source_span="Python"),
            ExternalJobRequirement(external_job_id=other_job.id, skill_id=skill.id, is_required=True, weight=1, confidence=1, source_span="Python"),
        ])
        await session.commit()
        token, other_token = create_access_token(student.id, "student"), create_access_token(other.id, "student")

    recomputed = await client.post("/external-jobs/matches/recompute", headers=_headers(token))
    assert recomputed.status_code == 200
    first_match = next(item for item in recomputed.json() if item["external_job_id"] != str(other_job.id))
    created = await client.post("/applications", headers=_headers(token), json={"external_job_id": str(job.id), "external_job_match_id": first_match["id"]})
    assert created.status_code == 201, created.text
    application = created.json()
    assert application["status"] == "approval_pending"
    assert application["application_snapshot"]["resume"]["id"] == str(active_resume.id)
    assert application["application_snapshot"]["recommendation"]["supporting_evidence"][0]["evidence_title"] == "Python API"
    assert application["provider_capabilities"]["auto_apply"] is False
    application_id = application["id"]

    assert (await client.post("/applications", headers=_headers(token), json={"external_job_id": str(job.id), "external_job_match_id": first_match["id"]})).status_code == 409
    assert (await client.post("/applications", headers=_headers(token), json={"external_job_id": str(other_job.id), "external_job_match_id": first_match["id"]})).status_code == 409
    assert (await client.get(f"/applications/{application_id}", headers=_headers(other_token))).status_code == 404
    assert (await client.post(f"/applications/{application_id}/approve", headers=_headers(other_token))).status_code == 404
    listed = await client.get("/applications?page=1&page_size=1", headers=_headers(token))
    assert listed.status_code == 200 and listed.json()["total"] == 1

    assert (await client.post(f"/applications/{application_id}/request-approval", headers=_headers(token))).status_code == 200
    approved = await client.post(f"/applications/{application_id}/approve", headers=_headers(token))
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    assert (await client.post(f"/applications/{application_id}/approve", headers=_headers(token))).status_code == 409

    # Identity/contact changes are application inputs, but do not affect the persisted matching score.
    async with factory() as session:
        person = await session.get(Student, UUID(application["student_id"]))
        match = await session.get(ExternalJobMatch, UUID(first_match["id"]))
        assert person is not None and match is not None
        score_before = float(match.final_score)
        person.full_name = "Renamed Student"
        person.email = "renamed@example.test"
        await session.commit()
    stale = await client.get(f"/applications/{application_id}", headers=_headers(token))
    assert stale.json()["status"] == "approved" and stale.json()["is_approval_stale"] is True
    refreshed = await client.post(f"/applications/{application_id}/request-approval", headers=_headers(token))
    assert refreshed.status_code == 200 and refreshed.json()["status"] == "approval_pending"
    assert (await client.post(f"/applications/{application_id}/approve", headers=_headers(token))).json()["status"] == "approved"
    async with factory() as session:
        match = await session.get(ExternalJobMatch, UUID(first_match["id"]))
        assert match is not None and float(match.final_score) == score_before
        match.final_score = 0.81
        await session.commit()
    assert (await client.get(f"/applications/{application_id}", headers=_headers(token))).json()["is_approval_stale"] is True
    assert (await client.post(f"/applications/{application_id}/request-approval", headers=_headers(token))).json()["status"] == "approval_pending"
    assert (await client.post(f"/applications/{application_id}/approve", headers=_headers(token))).json()["status"] == "approved"
    async with factory() as session:
        changed_job = await session.get(ExternalJob, job.id)
        assert changed_job is not None
        changed_job.description = "Requirements: Python; updated application instructions"
        await session.commit()
    assert (await client.get(f"/applications/{application_id}", headers=_headers(token))).json()["is_approval_stale"] is True
    # A stale approval cannot be replayed; it is demoted to pending and must be approved again.
    assert (await client.post(f"/applications/{application_id}/approve", headers=_headers(token))).status_code == 409
    assert (await client.get(f"/applications/{application_id}", headers=_headers(token))).json()["status"] == "approval_pending"

    assert (await client.post(f"/applications/{application_id}/request-approval", headers=_headers(token))).status_code == 200
    assert (await client.post(f"/applications/{application_id}/approve", headers=_headers(token))).json()["status"] == "approved"
    activated = await client.put(f"/resumes/{replacement_resume.id}/activate", headers=_headers(token))
    assert activated.status_code == 200
    after_resume = await client.get(f"/applications/{application_id}", headers=_headers(token))
    assert after_resume.json()["status"] == "approval_pending"

    manual = await client.post(f"/applications/{application_id}/manual", headers=_headers(token))
    assert manual.status_code == 200 and manual.json()["status"] == "manual_apply"
    assert manual.json()["manual_apply_url"] == "https://boards.greenhouse.io/acme/jobs/job-1"
    withdrawn = await client.post(f"/applications/{application_id}/withdraw", headers=_headers(token))
    assert withdrawn.status_code == 200 and withdrawn.json()["status"] == "withdrawn"
    assert (await client.post(f"/applications/{application_id}/manual", headers=_headers(token))).status_code == 409

    async with factory() as session:
        audit = list((await session.scalars(select(AuditLog).where(AuditLog.entity_id == UUID(application_id)).order_by(AuditLog.created_at))).all())
        actions = {item.action for item in audit}
        assert {"application_intent_created", "approval_requested", "application_approved", "approval_invalidated", "manual_apply_selected", "application_withdrawn"} <= actions
        assert all("Renamed Student" not in str(item.details) and "renamed@example.test" not in str(item.details) for item in audit)
        persisted = await session.get(Application, UUID(application_id))
        assert persisted is not None and persisted.submitted_at is None and persisted.external_application_id is None
