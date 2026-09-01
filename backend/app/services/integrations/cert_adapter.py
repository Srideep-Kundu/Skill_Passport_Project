"""Certification Provider Adapter Interface.

Provides a pluggable adapter protocol for validating external verifiable credentials
(e.g., Badgr, Credly, IEEE, AWS, Google Cloud).
"""
from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class ExternalCertificateClaim(BaseModel):
    badge_id: str
    recipient_email: str
    issuer_name: str
    badge_name: str
    issued_on: str
    expires_on: str | None = None
    verification_url: str
    skills_asserted: list[str] = Field(default_factory=list)
    is_cryptographically_valid: bool = True


class BaseCertificationAdapter(ABC):
    provider_name: str
    credentialed: bool = False

    @abstractmethod
    async def verify_credential_assertion(self, credential_url: str) -> ExternalCertificateClaim:
        """Verify credential signature with provider."""
        raise NotImplementedError
