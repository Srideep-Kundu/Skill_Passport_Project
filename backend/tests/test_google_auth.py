import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import auth as auth_api
from app.core.db import Base, create_matching_view, get_session
from app.main import app


@pytest_asyncio.fixture
async def auth_client(monkeypatch: pytest.MonkeyPatch):
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
        yield client, monkeypatch
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_google_auth_new_student_signup(auth_client):
    client, monkeypatch = auth_client
    
    # Mock verify_google_credential
    monkeypatch.setattr(
        auth_api,
        "verify_google_credential",
        lambda token, client_id: {
            "email": "new.student@google.com",
            "name": "Jane Google",
            "sub": "google-sub-12345",
        },
    )

    response = await client.post(
        "/auth/google",
        json={"credential": "mocked_valid_google_token", "role": "student"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "student"
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_google_auth_new_recruiter_signup(auth_client):
    client, monkeypatch = auth_client

    monkeypatch.setattr(
        auth_api,
        "verify_google_credential",
        lambda token, client_id: {
            "email": "recruiter.talent@company.com",
            "name": "Alex Recruiter",
            "sub": "google-sub-67890",
        },
    )

    response = await client.post(
        "/auth/google",
        json={
            "credential": "mocked_valid_google_token",
            "role": "recruiter",
            "company_name": "Google Tech Corp",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "recruiter"
    assert "access_token" in data


@pytest.mark.asyncio
async def test_google_auth_existing_user_login(auth_client):
    client, monkeypatch = auth_client

    # 1. Register traditional student
    reg_resp = await client.post(
        "/auth/register/student",
        json={
            "email": "existing.student@example.com",
            "password": "StrongPassword123",
            "full_name": "Existing Student",
        },
    )
    assert reg_resp.status_code == 201

    # 2. Login via Google with the same email
    monkeypatch.setattr(
        auth_api,
        "verify_google_credential",
        lambda token, client_id: {
            "email": "existing.student@example.com",
            "name": "Existing Student via Google",
            "sub": "google-sub-99999",
        },
    )

    response = await client.post(
        "/auth/google",
        json={"credential": "mocked_valid_google_token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "student"
    assert "access_token" in data


@pytest.mark.asyncio
async def test_google_auth_invalid_token(auth_client):
    client, monkeypatch = auth_client

    def _fail_verify(token, client_id):
        raise auth_api.HTTPException(status_code=401, detail="Token expired or invalid")

    monkeypatch.setattr(auth_api, "verify_google_credential", _fail_verify)

    response = await client.post(
        "/auth/google",
        json={"credential": "bad_token_12345"},
    )
    assert response.status_code == 401
    assert "detail" in response.json()


def test_google_verification_sanitizes_provider_exception(monkeypatch: pytest.MonkeyPatch) -> None:
    def _provider_failure(*_args: object, **_kwargs: object) -> None:
        raise ValueError("provider response containing sensitive diagnostics")

    monkeypatch.setattr(auth_api.id_token, "verify_oauth2_token", _provider_failure)
    with pytest.raises(auth_api.HTTPException) as caught:
        auth_api.verify_google_credential("bad-token", "expected-client-id")
    assert caught.value.status_code == 401
    assert caught.value.detail == "Google authentication token validation failed"
    assert "sensitive" not in str(caught.value.detail)
