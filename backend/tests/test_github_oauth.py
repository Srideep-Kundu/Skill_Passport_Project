import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
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

    settings = get_settings()
    monkeypatch.setattr(settings, "github_oauth_client_id", "test-github-client-id")
    monkeypatch.setattr(settings, "github_oauth_client_secret", "test-github-client-secret")

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client, monkeypatch
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_github_login_url(auth_client):
    client, _ = auth_client
    response = await client.get("/auth/github/login?role=student")
    assert response.status_code == 200
    data = response.json()
    assert "https://github.com/login/oauth/authorize" in data["url"]
    assert "client_id=test-github-client-id" in data["url"]
    assert "student" in data["url"]


@pytest.mark.asyncio
async def test_github_exchange_new_student(auth_client):
    client, monkeypatch = auth_client

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            return httpx.Response(200, json={"access_token": "gh-access-token-123"})

        async def get(self, url, **kwargs):
            if "user/emails" in url:
                return httpx.Response(200, json=[{"email": "student@github.com", "primary": True, "verified": True}])
            return httpx.Response(200, json={"id": 998877, "login": "ghstudent", "name": "GitHub Student"})

    monkeypatch.setattr(httpx, "AsyncClient", MockAsyncClient)

    response = await client.post(
        "/auth/github/exchange",
        json={"code": "valid-code", "role": "student"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "student"
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_github_exchange_new_recruiter(auth_client):
    client, monkeypatch = auth_client

    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            return httpx.Response(200, json={"access_token": "gh-access-token-456"})

        async def get(self, url, **kwargs):
            if "user/emails" in url:
                return httpx.Response(200, json=[{"email": "recruiter@github.com", "primary": True, "verified": True}])
            return httpx.Response(200, json={"id": 887766, "login": "ghrecruiter", "name": "GitHub Recruiter"})

    monkeypatch.setattr(httpx, "AsyncClient", MockAsyncClient)

    response = await client.post(
        "/auth/github/exchange",
        json={"code": "valid-code-recruiter", "role": "recruiter", "company_name": "OctoCorp"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "recruiter"
    assert "access_token" in data


@pytest.mark.asyncio
async def test_github_exchange_links_existing_student(auth_client):
    client, monkeypatch = auth_client

    # 1. Register traditional student
    reg_resp = await client.post(
        "/auth/register/student",
        json={
            "email": "linkme@example.com",
            "password": "StrongPassword123",
            "full_name": "Linked Student",
        },
    )
    assert reg_resp.status_code == 201

    # 2. Login via GitHub with same email
    class MockAsyncClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            return httpx.Response(200, json={"access_token": "gh-access-token-789"})

        async def get(self, url, **kwargs):
            if "user/emails" in url:
                return httpx.Response(200, json=[{"email": "linkme@example.com", "primary": True, "verified": True}])
            return httpx.Response(200, json={"id": 112233, "login": "linkmegh", "name": "Linked Student"})

    monkeypatch.setattr(httpx, "AsyncClient", MockAsyncClient)

    response = await client.post(
        "/auth/github/exchange",
        json={"code": "valid-code-link", "role": "student"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "student"
    assert "access_token" in data


@pytest.mark.asyncio
async def test_github_login_not_configured(auth_client):
    client, monkeypatch = auth_client
    settings = get_settings()
    monkeypatch.setattr(settings, "github_oauth_client_id", None)

    response = await client.get("/auth/github/login?role=student")
    assert response.status_code == 503
    assert response.json()["detail"] == "github_oauth_not_configured"

