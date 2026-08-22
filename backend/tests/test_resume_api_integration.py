import io
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from docx import Document
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import resumes
from app.core.db import Base, create_matching_view, get_session
from app.main import app
from app.services import resume_service


def docx_bytes(text: str) -> bytes:
    document = Document()
    for line in text.splitlines():
        document.add_paragraph(line)
    output = io.BytesIO(); document.save(output)
    return output.getvalue()


@pytest_asyncio.fixture
async def resume_client(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    monkeypatch.setattr(resumes, "LocalResumeStorage", lambda: resume_service.LocalResumeStorage(tmp_path))
    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
    await engine.dispose()


async def register(client: httpx.AsyncClient, email: str) -> str:
    response = await client.post("/auth/register/student", json={"email": email, "password": "StrongPassword123", "full_name": "Resume Student"})
    assert response.status_code == 201
    return response.json()["access_token"]


def headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_resume_upload_parse_idempotency_activation_and_ownership(resume_client: httpx.AsyncClient) -> None:
    token = await register(resume_client, "resume-api@example.test")
    other_token = await register(resume_client, "resume-other@example.test")
    data = docx_bytes("Projects\nAPI - Built Python FastAPI\nCertifications\nAWS - Cloud\nSkills\nPython, FastAPI")
    uploaded = await resume_client.post("/resumes", headers=headers(token), files={"file": ("../../resume.docx", data, resume_service.DOCX_MIME)})
    assert uploaded.status_code == 201, uploaded.text
    document_id = uploaded.json()["id"]
    assert uploaded.json()["original_filename"] == "resume.docx"
    duplicate = await resume_client.post("/resumes", headers=headers(token), files={"file": ("resume.docx", data, resume_service.DOCX_MIME)})
    assert duplicate.status_code == 200 and duplicate.json()["id"] == document_id
    assert (await resume_client.get(f"/resumes/{document_id}", headers=headers(other_token))).status_code == 404
    parsed = await resume_client.post(f"/resumes/{document_id}/parse", headers=headers(token))
    assert parsed.status_code == 200 and parsed.json()["generated_evidence_count"] == 3
    assert (await resume_client.delete(f"/resumes/{document_id}", headers=headers(token))).status_code == 204
    empty_claim_resume = await resume_client.post("/resumes", headers=headers(token), files={"file": ("second.docx", docx_bytes("Jane Candidate\nEducation\nExample University"), resume_service.DOCX_MIME)})
    assert empty_claim_resume.status_code == 201
    second_id = empty_claim_resume.json()["id"]
    active = await resume_client.put(f"/resumes/{second_id}/activate", headers=headers(token))
    assert active.status_code == 200 and active.json()["is_active"] is True
    assert (await resume_client.delete(f"/resumes/{second_id}", headers=headers(token))).status_code == 204
    wrong_mime = await resume_client.post("/resumes", headers=headers(token), files={"file": ("bad.docx", data, resume_service.PDF_MIME)})
    assert wrong_mime.status_code == 422
