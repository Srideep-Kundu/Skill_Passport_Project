import io
import zipfile
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import linkedin
from app.core.db import Base, create_matching_view, get_session
from app.main import app
from app.services import linkedin_service


def _make_zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)
    return buffer.getvalue()


@pytest_asyncio.fixture
async def linkedin_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    monkeypatch.setattr(linkedin, "LocalLinkedInStorage", lambda: linkedin_service.LocalLinkedInStorage(tmp_path))
    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
    await engine.dispose()


async def register(client: httpx.AsyncClient, email: str) -> str:
    response = await client.post(
        "/auth/register/student",
        json={"email": email, "password": "StrongPassword123", "full_name": "LinkedIn Student"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_linkedin_upload_parse_idempotency_activation_and_ownership(
    linkedin_client: httpx.AsyncClient,
) -> None:
    token = await register(linkedin_client, "linkedin-student@example.test")
    other_token = await register(linkedin_client, "linkedin-other@example.test")

    files = {
        "Positions.csv": "Company Name,Title,Description\nTech Corp,Software Engineer,Built APIs in Python and FastAPI\n",
        "Skills.csv": "Name\nPython\nFastAPI\nPostgreSQL\n",
        "Certifications.csv": "Name,Authority\nAWS Certified Developer,Amazon\n",
    }
    zip_data = _make_zip(files)

    # 1. Upload
    uploaded = await linkedin_client.post(
        "/linkedin/imports",
        headers=headers(token),
        files={"file": ("../../export.zip", zip_data, "application/zip")},
    )
    assert uploaded.status_code == 201, uploaded.text
    import_id = uploaded.json()["id"]
    assert uploaded.json()["original_filename"] == "export.zip"
    assert uploaded.json()["parse_status"] == "uploaded"

    # 2. Idempotent upload (same checksum)
    duplicate = await linkedin_client.post(
        "/linkedin/imports",
        headers=headers(token),
        files={"file": ("export.zip", zip_data, "application/zip")},
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["id"] == import_id

    # 3. Cross-student access isolation (404)
    other_access = await linkedin_client.get(
        f"/linkedin/imports/{import_id}", headers=headers(other_token)
    )
    assert other_access.status_code == 404

    # 4. List imports
    listing = await linkedin_client.get("/linkedin/imports", headers=headers(token))
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["id"] == import_id

    # 5. Parse
    parsed = await linkedin_client.post(
        f"/linkedin/imports/{import_id}/parse", headers=headers(token)
    )
    assert parsed.status_code == 200
    assert parsed.json()["generated_evidence_count"] >= 3
    assert parsed.json()["parsed_summary"]["counts"]["positions"] == 1
    assert parsed.json()["parsed_summary"]["counts"]["skills"] == 3

    # 6. Activate
    activated = await linkedin_client.put(
        f"/linkedin/imports/{import_id}/activate", headers=headers(token)
    )
    assert activated.status_code == 200
    assert activated.json()["is_active"] is True

    # 7. Delete cleanly unlinks associated evidence
    del_clean = await linkedin_client.delete(
        f"/linkedin/imports/{import_id}", headers=headers(token)
    )
    assert del_clean.status_code == 204


@pytest.mark.asyncio
async def test_linkedin_url_preview_is_labeled_and_cannot_persist(
    linkedin_client: httpx.AsyncClient,
) -> None:
    token = await register(linkedin_client, "linkedin-preview@example.test")
    preview = await linkedin_client.post(
        "/linkedin/imports/import-url",
        headers=headers(token),
        json={"profile_url": "https://www.linkedin.com/in/maya-rivera"},
    )
    assert preview.status_code == 200
    profile = preview.json()
    assert profile["source"] == "demo_fixture"
    assert profile["source_confidence"] == 0
    assert profile["is_demo_fixture"] is True
    assert profile["persistable"] is False

    saved = await linkedin_client.post(
        "/linkedin/imports/save-profile",
        headers=headers(token),
        json=profile,
    )
    assert saved.status_code == 422
    assert "simulated" in saved.json()["detail"].lower()
