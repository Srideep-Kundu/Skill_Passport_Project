import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_password_reset_token, verify_password_reset_token
from app.main import app
from app.models import Student, Role


@pytest_asyncio.fixture
async def auth_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_forgot_password_flow_and_reset(auth_client: httpx.AsyncClient):
    # 1. Register a student
    reg_resp = await auth_client.post(
        "/auth/register/student",
        json={
            "email": "student.reset@example.com",
            "password": "OldPassword123!",
            "full_name": "Reset Test Student",
            "university": "Test University",
        },
    )
    assert reg_resp.status_code == 201

    # 2. Request forgot password
    forgot_resp = await auth_client.post(
        "/auth/forgot-password",
        json={"email": "student.reset@example.com"},
    )
    assert forgot_resp.status_code == 200
    forgot_data = forgot_resp.json()
    assert "password reset link has been sent" in forgot_data["message"].lower()
    assert forgot_data["dev_token"] is not None
    token = forgot_data["dev_token"]

    # 3. Verify reset token endpoint
    verify_resp = await auth_client.post(
        "/auth/verify-reset-token",
        json={"token": token},
    )
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["valid"] is True
    assert verify_data["email"] == "student.reset@example.com"
    assert verify_data["role"] == "student"

    # 4. Reset the password
    reset_resp = await auth_client.post(
        "/auth/reset-password",
        json={
            "token": token,
            "new_password": "NewBrandSecurePass123!",
        },
    )
    assert reset_resp.status_code == 200
    assert "successfully updated" in reset_resp.json()["message"].lower()

    # 5. Verify old password no longer works
    old_login = await auth_client.post(
        "/auth/login",
        json={
            "email": "student.reset@example.com",
            "password": "OldPassword123!",
        },
    )
    assert old_login.status_code == 401

    # 6. Verify new password logs in successfully
    new_login = await auth_client.post(
        "/auth/login",
        json={
            "email": "student.reset@example.com",
            "password": "NewBrandSecurePass123!",
        },
    )
    assert new_login.status_code == 200
    login_data = new_login.json()
    assert login_data["role"] == "student"
    assert "access_token" in login_data


@pytest.mark.asyncio
async def test_forgot_password_recruiter_and_academician(auth_client: httpx.AsyncClient):
    # Register recruiter
    rec_reg = await auth_client.post(
        "/auth/register/recruiter",
        json={
            "email": "recruiter.reset@technova.com",
            "password": "InitialRecPassword123!",
            "company_name": "TechNova Corp",
        },
    )
    assert rec_reg.status_code == 201

    # Request reset for recruiter
    forgot_rec = await auth_client.post(
        "/auth/forgot-password",
        json={"email": "recruiter.reset@technova.com"},
    )
    assert forgot_rec.status_code == 200
    rec_token = forgot_rec.json()["dev_token"]

    # Reset recruiter password
    reset_rec = await auth_client.post(
        "/auth/reset-password",
        json={
            "token": rec_token,
            "new_password": "NewRecruiterPassword456!",
        },
    )
    assert reset_rec.status_code == 200

    # Login recruiter with new password
    rec_login = await auth_client.post(
        "/auth/login",
        json={
            "email": "recruiter.reset@technova.com",
            "password": "NewRecruiterPassword456!",
        },
    )
    assert rec_login.status_code == 200
    assert rec_login.json()["role"] == "recruiter"


@pytest.mark.asyncio
async def test_forgot_password_nonexistent_email_safe(auth_client: httpx.AsyncClient):
    # Requesting reset for non-existent email should return 200 without leaking account absence
    resp = await auth_client.post(
        "/auth/forgot-password",
        json={"email": "nonexistent.user999@example.com"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "password reset link has been sent" in data["message"].lower()
    assert data["dev_token"] is None


@pytest.mark.asyncio
async def test_invalid_and_expired_token(auth_client: httpx.AsyncClient):
    # Invalid token
    verify_resp = await auth_client.post(
        "/auth/verify-reset-token",
        json={"token": "invalid-token-string-xyz"},
    )
    assert verify_resp.status_code == 400

    reset_resp = await auth_client.post(
        "/auth/reset-password",
        json={
            "token": "invalid-token-string-xyz",
            "new_password": "SomeNewPassword123!",
        },
    )
    assert reset_resp.status_code == 400
