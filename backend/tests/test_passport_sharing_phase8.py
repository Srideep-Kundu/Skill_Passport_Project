import hashlib
import io
import logging
import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import pytest_asyncio
from pypdf import PdfReader
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import passport as passport_api
from app.core.db import Base, get_session
from app.core.observability import redact_secrets
from app.core.security import create_access_token
from app.main import _safe_log_path, app
from app.models import (
    Evidence,
    EvidenceType,
    ExtractionStatus,
    PassportShare,
    ResumeDocument,
    ResumeParseStatus,
    Role,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)


@pytest_asyncio.fixture
async def phase8_client():
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


def _headers(subject: uuid.UUID) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {create_access_token(subject, Role.student.value)}"
    }


def test_share_tokens_are_redacted_from_application_access_paths():
    assert (
        _safe_log_path("/public/passports/raw-secret-token.pdf")
        == "/public/passports/[redacted]"
    )
    assert (
        _safe_log_path("/public/passports/raw-secret-token/qr")
        == "/public/passports/[redacted]/qr"
    )
    assert "raw-secret-token" not in redact_secrets(
        "GET /public/passports/raw-secret-token.pdf HTTP/1.1"
    )


async def _seed(factory):
    async with factory() as session:
        student = Student(
            email="private.student@example.com",
            password_hash="hash",
            full_name="Visible Student",
            university="Private University",
        )
        other = Student(
            email="other.student@example.com",
            password_hash="hash",
            full_name="Other Student",
        )
        skill = Skill(canonical_name="Phase8 FastAPI", category="technical", aliases=[])
        session.add_all([student, other, skill])
        await session.flush()
        resume = ResumeDocument(
            student_id=student.id,
            original_filename="private-resume-name.pdf",
            storage_key="private-storage-key.pdf",
            mime_type="application/pdf",
            size_bytes=128,
            checksum="a" * 64,
            parse_status=ResumeParseStatus.completed,
            parser_version="test",
            extracted_text="SECRET RAW RESUME CONTENT",
        )
        session.add(resume)
        await session.flush()
        evidence = Evidence(
            student_id=student.id,
            evidence_type=EvidenceType.project,
            title="private-resume-name.pdf",
            description="SECRET RAW RESUME CONTENT",
            external_url="https://private.example/token-secret",
            raw_metadata={"provider_secret": "never-public"},
            resume_document_id=resume.id,
            extraction_status=ExtractionStatus.extracted,
        )
        session.add(evidence)
        await session.flush()
        session.add(
            StudentSkill(
                student_id=student.id,
                skill_id=skill.id,
                source_evidence_id=evidence.id,
                extraction_confidence=0.95,
                verification_tier=VerificationTier.verified,
                evidence_span="private raw span",
            )
        )
        await session.commit()
        return student.id, other.id, evidence.id


async def _create(client, student_id, **overrides):
    payload = {
        "visibility_allowlist": [
            "display_identity",
            "verified_skills",
            "selected_evidence_summaries",
            "verification_summaries",
        ],
        "label": "Judge review",
    }
    payload.update(overrides)
    return await client.post(
        "/passport/shares",
        json=payload,
        headers={**_headers(student_id), "Origin": "http://localhost:5173"},
    )


@pytest.mark.asyncio
async def test_private_default_token_hash_projection_and_owner_rbac(
    phase8_client, caplog
):
    client, factory = phase8_client
    student_id, other_id, evidence_id = await _seed(factory)
    assert (await client.get("/passport/me")).status_code == 401
    created = await _create(client, student_id)
    assert created.status_code == 201, created.text
    body = created.json()
    raw_token = body["raw_token"]
    assert len(raw_token) >= 43
    assert body["public_url"] == f"http://localhost:5173/public/passports/{raw_token}"

    async with factory() as session:
        stored = await session.get(PassportShare, uuid.UUID(body["id"]))
        assert stored is not None
        assert stored.token_hash != raw_token
        assert stored.token_hash == hashlib.sha256(raw_token.encode()).hexdigest()
        evidence_before = await session.scalar(select(func.count(Evidence.id)))
        skills_before = await session.scalar(select(func.count(StudentSkill.id)))

    listed = await client.get("/passport/shares", headers=_headers(student_id))
    assert listed.status_code == 200
    assert "raw_token" not in listed.text
    assert body["public_url"] not in listed.text
    assert (
        await client.get(f"/passport/shares/{body['id']}", headers=_headers(other_id))
    ).status_code == 404

    caplog.clear()
    with caplog.at_level(logging.INFO, logger="app.main"):
        public = await client.get(f"/public/passports/{raw_token}")
    assert public.status_code == 200
    projection = public.json()
    assert projection["display_name"] == "Visible Student"
    assert projection["skills"][0]["canonical_name"] == "Phase8 FastAPI"
    assert projection["skills"][0]["provenance"][0]["source_label"] == "Resume evidence"
    assert projection["projects"] is None
    forbidden = [
        "private.student@example.com",
        "Private University",
        "SECRET RAW RESUME CONTENT",
        "private-resume-name.pdf",
        "private-storage-key.pdf",
        "token-secret",
        "provider_secret",
        "private raw span",
        str(student_id),
        str(evidence_id),
    ]
    assert all(value not in public.text for value in forbidden)
    assert raw_token not in caplog.text
    assert any(
        getattr(record, "path", None) == "/public/passports/[redacted]"
        for record in caplog.records
    )

    assert (
        await client.get(f"/public/passports/{raw_token}changed")
    ).status_code == 404
    async with factory() as session:
        assert await session.scalar(select(func.count(Evidence.id))) == evidence_before
        assert (
            await session.scalar(select(func.count(StudentSkill.id))) == skills_before
        )


@pytest.mark.asyncio
async def test_expiry_revocation_regeneration_pdf_and_qr(phase8_client, monkeypatch):
    client, factory = phase8_client
    student_id, _, _ = await _seed(factory)
    past = (datetime.now(UTC) - timedelta(minutes=1)).isoformat()
    assert (await _create(client, student_id, expires_at=past)).status_code == 422

    created = (await _create(client, student_id)).json()
    token = created["raw_token"]
    pdf = await client.get(f"/public/passports/{token}.pdf")
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    pdf_text = "\n".join(
        page.extract_text() or "" for page in PdfReader(io.BytesIO(pdf.content)).pages
    )
    assert "Phase8 FastAPI" in pdf_text
    assert "private.student@example.com" not in pdf_text
    assert "SECRET RAW RESUME CONTENT" not in pdf_text
    assert "private-storage-key.pdf" not in pdf_text

    qr = await client.get(f"/public/passports/{token}/qr")
    assert qr.status_code == 200
    assert qr.headers["content-type"].startswith("image/svg+xml")
    assert b"<svg" in qr.content
    assert b"private.student@example.com" not in qr.content
    captured: list[str] = []
    monkeypatch.setattr(
        passport_api,
        "render_qr_svg",
        lambda destination: captured.append(destination) or b"<svg/>",
    )
    assert (await client.get(f"/public/passports/{token}/qr")).status_code == 200
    assert captured == [f"http://localhost:5173/public/passports/{token}"]

    regenerated = await client.post(
        f"/passport/shares/{created['id']}/regenerate",
        headers={**_headers(student_id), "Origin": "http://localhost:5173"},
    )
    assert regenerated.status_code == 200
    new_token = regenerated.json()["raw_token"]
    assert new_token != token
    assert (await client.get(f"/public/passports/{token}")).status_code == 404
    assert (await client.get(f"/public/passports/{new_token}")).status_code == 200

    new_id = regenerated.json()["id"]
    revoked = await client.delete(
        f"/passport/shares/{new_id}", headers=_headers(student_id)
    )
    assert revoked.json()["status"] == "revoked"
    assert (await client.get(f"/public/passports/{new_token}")).status_code == 404
    assert (await client.get(f"/public/passports/{new_token}.pdf")).status_code == 404
    assert (await client.get(f"/public/passports/{new_token}/qr")).status_code == 404

    async with factory() as session:
        expired = PassportShare(
            student_id=student_id,
            token_hash=hashlib.sha256(
                b"expired-token-that-is-long-enough-for-validation-123"
            ).hexdigest(),
            visibility_allowlist=["verified_skills"],
            expires_at=datetime.now(UTC) - timedelta(seconds=1),
        )
        session.add(expired)
        await session.commit()
    assert (
        await client.get(
            "/public/passports/expired-token-that-is-long-enough-for-validation-123"
        )
    ).status_code == 404
