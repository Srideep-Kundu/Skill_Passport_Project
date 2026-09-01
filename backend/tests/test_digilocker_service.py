"""Tests for DigiLocker Verifiable Credential Service and API endpoints."""

import hashlib
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.main import app
from app.models import Evidence, EvidenceType, Role, Student, StudentDigiLockerAccount, StudentSkill, Skill, VerificationTier, VerificationCheck
from app.services.digilocker_service import (
    sanitize_pii,
    generate_auth_params,
    get_available_academic_credentials,
)
from app.core.security import create_access_token


def test_digilocker_pii_sanitization():
    """Verify that demographic and sensitive PII attributes are rigorously redacted."""
    raw_transcript = (
        "Student Name: John Doe\n"
        "Aadhaar Number: 2345 6789 0123\n"
        "DOB: 15/08/2003\n"
        "Gender: Male\n"
        "Category: General / OBC\n"
        "Address: Flat 402, Green Park Avenue, New Delhi - 110016\n"
        "Course: Deep Learning Specialization\n"
        "Score: 95% (Elite + Gold)\n"
    )

    sanitized = sanitize_pii(raw_transcript)

    assert "2345 6789 0123" not in sanitized
    assert "[REDACTED_IDENTITY_ID]" in sanitized
    assert "15/08/2003" not in sanitized
    assert "[REDACTED_DOB]" in sanitized
    assert "Male" not in sanitized
    assert "[REDACTED_GENDER]" in sanitized
    assert "General" not in sanitized
    assert "[REDACTED_CATEGORY]" in sanitized
    assert "Green Park Avenue" not in sanitized
    assert "[REDACTED_ADDRESS]" in sanitized

    # Legitimate academic skills and grades MUST be preserved
    assert "Deep Learning Specialization" in sanitized
    assert "95%" in sanitized


def test_digilocker_auth_params():
    """Test OAuth 2.0 PKCE auth parameter creation."""
    params = generate_auth_params(redirect_uri="http://localhost:5173/callback")
    assert "auth_url" in params
    assert "meripehchan.gov.in" in params["auth_url"]
    assert "state" in params
    assert params["client_id"] == "LUMINA_INTEL_SIH"


def test_available_academic_credentials():
    """Verify that accredited university and NPTEL credentials contain cryptographic metadata."""
    docs = get_available_academic_credentials()
    assert len(docs) >= 3

    nptel = next(d for d in docs if "nptel" in d.issuer_id)
    assert nptel.metadata.signature_verified is True
    assert len(nptel.metadata.cert_sha256) == 64
    assert len(nptel.verifiable_skills) > 0


@pytest.mark.asyncio
async def test_digilocker_api_flow(session: AsyncSession):
    """End-to-end test of DigiLocker account linking, doc listing, and import."""
    # Create test student
    student_id = uuid.uuid4()
    student = Student(
        id=student_id,
        email=f"digi_student_{uuid.uuid4().hex[:6]}@example.com",
        password_hash="mockhash",
        full_name="DigiLocker Test Student",
    )
    session.add(student)
    await session.commit()

    token = create_access_token(str(student.id), role=Role.student.value)
    headers = {"Authorization": f"Bearer {token}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Get Auth URL
        auth_resp = await client.get("/digilocker/auth-url", headers=headers)
        assert auth_resp.status_code == 200
        assert "auth_url" in auth_resp.json()

        # 2. Status before linking
        status_resp = await client.get("/digilocker/status", headers=headers)
        assert status_resp.status_code == 200
        assert status_resp.json()["is_linked"] is False

        # 3. Callback Handshake
        cb_resp = await client.post(
            "/digilocker/callback",
            json={"code": "auth_code_mock_123", "state": "test_state", "apaar_id": "APAAR-9901-2025"},
            headers=headers,
        )
        assert cb_resp.status_code == 200
        assert cb_resp.json()["is_linked"] is True

        # 4. List Documents
        docs_resp = await client.get("/digilocker/documents", headers=headers)
        assert docs_resp.status_code == 200
        docs = docs_resp.json()
        assert len(docs) >= 3
        target_doc_id = docs[0]["doc_id"]

        # 5. Import Credential
        import_resp = await client.post(
            "/digilocker/import",
            json={"doc_id": target_doc_id},
            headers=headers,
        )
        assert import_resp.status_code == 201
        data = import_resp.json()
        assert data["verification_tier"] == "verified"
        assert data["signature_verified"] is True

        # Verify Evidence in database
        ev_id = uuid.UUID(data["evidence_id"])
        ev_stmt = select(Evidence).where(Evidence.id == ev_id)
        evidence = (await session.execute(ev_stmt)).scalar_one()
        assert evidence.evidence_type == EvidenceType.digilocker_credential
        assert evidence.verification_metadata["signature_verified"] is True

        # Verify Check
        check_stmt = select(VerificationCheck).where(VerificationCheck.evidence_id == ev_id)
        check = (await session.execute(check_stmt)).scalar_one()
        assert check.result == "passed"
        assert check.details["verification_tier"] == "verified"

        # 6. Unlink
        unlink_resp = await client.delete("/digilocker/unlink", headers=headers)
        assert unlink_resp.status_code == 200
        assert unlink_resp.json()["is_linked"] is False
