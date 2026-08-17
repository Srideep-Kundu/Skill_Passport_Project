"""HTTP-level release smoke check using explicitly supplied non-production credentials."""

import asyncio
import os

import httpx

from app.core.release_check import verify_release


async def main() -> None:
    failures = await verify_release()
    if failures:
        print("Release smoke failed: " + ", ".join(failures))
        raise SystemExit(1)

    base_url = os.environ.get("RELEASE_SMOKE_API_URL", "http://localhost:8000").rstrip("/")
    email = os.environ.get("RELEASE_SMOKE_EMAIL")
    password = os.environ.get("RELEASE_SMOKE_PASSWORD")
    async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as client:
        for path, expected_status in (("/health", 200), ("/ready", 200)):
            response = await client.get(path)
            if response.status_code != expected_status:
                print(f"Release smoke failed: {path}")
                raise SystemExit(1)
        if email or password:
            if not email or not password:
                print("Release smoke failed: credentials must include both email and password")
                raise SystemExit(1)
            login = await client.post("/auth/login", json={"email": email, "password": password})
            if login.status_code != 200:
                print("Release smoke failed: login")
                raise SystemExit(1)
            token = login.json().get("access_token")
            protected = await client.get(
                "/passport/me", headers={"Authorization": f"Bearer {token}"}
            )
            if protected.status_code != 200:
                print("Release smoke failed: protected_endpoint")
                raise SystemExit(1)
    print("Release smoke passed.")


if __name__ == "__main__":
    asyncio.run(main())
