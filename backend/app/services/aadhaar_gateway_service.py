"""Live Aadhaar OTP Verification Service via authorized UIDAI Gateway (Sandbox.co.in)."""

from __future__ import annotations

import logging
import os
import re
from typing import Any
import httpx

logger = logging.getLogger(__name__)

SANDBOX_AUTH_URL = "https://api.sandbox.co.in/authenticate"
SANDBOX_OTP_GENERATE_URL = "https://api.sandbox.co.in/kyc/aadhaar/okyc/otp"
SANDBOX_OTP_VERIFY_URL = "https://api.sandbox.co.in/kyc/aadhaar/okyc/otp/verify"

_cached_token: str | None = None


def get_credentials() -> tuple[str, str]:
    api_key = os.getenv("SANDBOX_API_KEY", "key_live_ab870694b0624d69ab251ebbc310359b")
    api_secret = os.getenv("SANDBOX_API_SECRET", "secret_live_e77b10e3450f47039cf1ab945f8b4542")
    return api_key, api_secret


async def get_sandbox_access_token() -> str:
    """Retrieve or refresh Sandbox.co.in JWT access token."""
    global _cached_token
    if _cached_token:
        return _cached_token

    api_key, api_secret = get_credentials()
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            SANDBOX_AUTH_URL,
            headers={
                "x-api-key": api_key,
                "x-api-secret": api_secret,
                "x-api-version": "1.0",
                "Content-Type": "application/json",
            },
            json={},
        )
        if res.status_code != 200:
            logger.error("Sandbox authentication failed: %s %s", res.status_code, res.text)
            raise ValueError(f"Failed to authenticate with Aadhaar gateway: {res.text}")

        data = res.json()
        token = data.get("access_token")
        if not token:
            raise ValueError("No access token returned by Aadhaar gateway")
        _cached_token = token
        return token


async def generate_live_aadhaar_otp(aadhaar_number: str) -> dict[str, Any]:
    """Dispatch real-time UIDAI SMS OTP to citizen's registered mobile phone."""
    clean_digits = re.sub(r"\D", "", aadhaar_number)
    if len(clean_digits) != 12:
        raise ValueError("Aadhaar Number must be exactly 12 digits.")

    token = await get_sandbox_access_token()
    api_key, _ = get_credentials()

    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            SANDBOX_OTP_GENERATE_URL,
            headers={
                "Authorization": token,
                "x-api-key": api_key,
                "x-api-version": "1.0",
                "Content-Type": "application/json",
            },
            json={
                "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
                "aadhaar_number": clean_digits,
                "consent": "Y",
                "reason": "Skill Passport academic identity verification",
            },
        )

        # Token expiration check & retry
        if res.status_code == 401:
            global _cached_token
            _cached_token = None
            token = await get_sandbox_access_token()
            res = await client.post(
                SANDBOX_OTP_GENERATE_URL,
                headers={
                    "Authorization": token,
                    "x-api-key": api_key,
                    "x-api-version": "1.0",
                    "Content-Type": "application/json",
                },
                json={
                    "@entity": "in.co.sandbox.kyc.aadhaar.okyc.otp.request",
                    "aadhaar_number": clean_digits,
                    "consent": "Y",
                    "reason": "Skill Passport academic identity verification",
                },
            )

        if res.status_code not in (200, 201):
            logger.error("Aadhaar OTP generate failed: %s %s", res.status_code, res.text)
            err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
            msg = err_data.get("message") or err_data.get("error") or res.text
            raise ValueError(f"Aadhaar OTP Gateway error: {msg}")

        result = res.json()
        data = result.get("data", {})
        reference_id = data.get("reference_id") or data.get("ref_id")
        return {
            "reference_id": reference_id,
            "masked_aadhaar": f"XXXX-XXXX-{clean_digits[-4:]}",
            "message": data.get("message", "Real-Time UIDAI OTP dispatched to your registered mobile phone."),
        }


async def verify_live_aadhaar_otp(reference_id: str, otp: str) -> dict[str, Any]:
    """Verify live SMS OTP with UIDAI and sanitize private demographic data."""
    clean_otp = re.sub(r"\D", "", otp)
    if len(clean_otp) != 6:
        raise ValueError("OTP must be exactly 6 digits.")

    token = await get_sandbox_access_token()
    api_key, _ = get_credentials()

    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.post(
            SANDBOX_OTP_VERIFY_URL,
            headers={
                "Authorization": token,
                "x-api-key": api_key,
                "x-api-version": "1.0",
                "Content-Type": "application/json",
            },
            json={
                "@entity": "in.co.sandbox.kyc.aadhaar.okyc.request",
                "reference_id": reference_id,
                "otp": clean_otp,
            },
        )

        if res.status_code not in (200, 201):
            logger.error("Aadhaar OTP verify failed: %s %s", res.status_code, res.text)
            err_data = res.json() if res.headers.get("content-type", "").startswith("application/json") else {}
            msg = err_data.get("message") or err_data.get("error") or res.text
            raise ValueError(f"Aadhaar OTP verification failed: {msg}")

        result = res.json()
        data = result.get("data", {})

        if data.get("status") in ("INVALID", "FAILED") or "invalid" in data.get("message", "").lower() or "error" in data.get("message", "").lower():
            err_msg = data.get("message", "Invalid OTP. Please check the code received on your phone.")
            raise ValueError(err_msg)

        # Zero-PII sanitization compliance: scrub raw DOB/gender/address before returning
        return {
            "status": "VALID",
            "is_verified": True,
            "verification_tier": "verified",
            "confidence_multiplier": 1.00,
            "message": data.get("message") or "Aadhaar Identity verified with UIDAI cryptographic signature.",
        }
