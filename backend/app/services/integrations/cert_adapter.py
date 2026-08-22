"""Certification Provider Adapter Interface.

Provides a pluggable adapter protocol for validating external verifiable credentials
(e.g., Badgr, Credly, IEEE, AWS, Google Cloud).
"""
from abc import ABC, abstractmethod

from pydantic import BaseModel


class ExternalCertificateClaim(BaseModel):
    badge_id: str
    recipient_email: str
    issuer_name: str
    badge_name: str
    issued_on: str
    expires_on: str | None = None
    verification_url: str
    skills_asserted: list[str] = []
    is_cryptographically_valid: bool = True


class BaseCertificationAdapter(ABC):
    @abstractmethod
    async def verify_credential_assertion(self, credential_url: str) -> ExternalCertificateClaim:
        """Verify credential signature with provider."""
        raise NotImplementedError


class MockCertificationAdapter(BaseCertificationAdapter):
    """Reference adapter implementation for demonstrations & testing."""

    async def verify_credential_assertion(self, credential_url: str) -> ExternalCertificateClaim:
        return ExternalCertificateClaim(
            badge_id="credly-aws-certified-developer-2026",
            recipient_email="student@university.edu",
            issuer_name="Amazon Web Services Training & Certification",
            badge_name="AWS Certified Developer - Associate",
            issued_on="2026-03-01T00:00:00Z",
            verification_url=credential_url or "https://www.credly.com/badges/demo-aws-badge",
            skills_asserted=["AWS", "Serverless", "Python", "Cloud Architecture"],
            is_cryptographically_valid=True,
        )
