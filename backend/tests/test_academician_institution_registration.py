"""Targeted tests for Academician (Faculty) and Institution (University) Self-Registration."""
from types import SimpleNamespace

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import auth as auth_api
from app.core.db import Base, create_matching_view, get_session
from app.core.security import verify_password
from app.main import app
from app.models import Academician, AccountEmail, Institution, Role


@pytest_asyncio.fixture
async def api_client():
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
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.asyncio
async def test_faculty_registration_and_auth_lifecycle(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client

    payload = {
        "email": "prof.sharma@iitb.ac.in",
        "password": "FacultyPassword123!",
        "full_name": "Prof. R. K. Sharma",
        "institution_name": "IIT Bombay",
        "department": "Computer Science & Engineering",
        "designation": "Professor",
        "research_areas": ["Distributed Systems", "Cloud Computing"],
    }

    # 1. Registration succeeds with 201 and valid TokenResponse
    res = await client.post("/auth/register/academician", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["role"] == "academician"
    token = data["access_token"]
    assert token

    # 2. Database verification: Academician profile and AccountEmail records exist
    async with factory() as session:
        faculty = (await session.scalars(select(Academician).where(Academician.email == "prof.sharma@iitb.ac.in"))).first()
        assert faculty is not None
        assert faculty.full_name == "Prof. R. K. Sharma"
        assert faculty.institution_name == "IIT Bombay"
        assert faculty.department == "Computer Science & Engineering"
        assert faculty.designation == "Professor"
        assert verify_password("FacultyPassword123!", faculty.password_hash)

        account_email = (await session.scalars(select(AccountEmail).where(AccountEmail.email == "prof.sharma@iitb.ac.in"))).first()
        assert account_email is not None
        assert account_email.role == Role.academician
        assert account_email.account_id == faculty.id

    # 3. Can login with registered credentials
    login_res = await client.post("/auth/login", json={"email": "prof.sharma@iitb.ac.in", "password": "FacultyPassword123!"})
    assert login_res.status_code == 200
    assert login_res.json()["role"] == "academician"

    # 4. Login fails with incorrect password
    bad_login = await client.post("/auth/login", json={"email": "prof.sharma@iitb.ac.in", "password": "WrongPassword"})
    assert bad_login.status_code == 401

    # 5. Duplicate registration returns 409
    dup_res = await client.post("/auth/register/academician", json=payload)
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"]

    # 6. Access Faculty route with token
    fac_res = await client.get("/academician/opportunities", headers={"Authorization": f"Bearer {token}"})
    assert fac_res.status_code == 200

    # 7. RBAC isolation: Faculty cannot access Institution-only analytics
    inst_res = await client.get("/institution/analytics", headers={"Authorization": f"Bearer {token}"})
    assert inst_res.status_code == 403


@pytest.mark.asyncio
async def test_institution_registration_and_auth_lifecycle(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client

    payload = {
        "email": "dean.analytics@polytech.edu",
        "password": "InstitutionPassword123!",
        "institution_name": "Polytechnic State University",
        "institution_code": "PSU-AISHE-9988",
        "state": "Maharashtra",
        "departments": ["Computer Science", "Information Technology"],
    }

    # 1. Registration succeeds with 201
    res = await client.post("/auth/register/institution", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["role"] == "institution"
    token = data["access_token"]
    assert token

    # 2. Database verification: Institution record and AccountEmail exist
    async with factory() as session:
        inst = (await session.scalars(select(Institution).where(Institution.email == "dean.analytics@polytech.edu"))).first()
        assert inst is not None
        assert inst.institution_name == "Polytechnic State University"
        assert inst.institution_code == "PSU-AISHE-9988"
        assert inst.state == "Maharashtra"
        assert verify_password("InstitutionPassword123!", inst.password_hash)

        account_email = (await session.scalars(select(AccountEmail).where(AccountEmail.email == "dean.analytics@polytech.edu"))).first()
        assert account_email is not None
        assert account_email.role == Role.institution
        assert account_email.account_id == inst.id

    # 3. Can login with registered credentials
    login_res = await client.post("/auth/login", json={"email": "dean.analytics@polytech.edu", "password": "InstitutionPassword123!"})
    assert login_res.status_code == 200
    assert login_res.json()["role"] == "institution"

    # 4. Duplicate registration returns 409
    dup_res = await client.post("/auth/register/institution", json=payload)
    assert dup_res.status_code == 409
    assert "already exists" in dup_res.json()["detail"]

    # 5. Duplicate institution code with different email returns 409 with specific message
    diff_email_payload = {**payload, "email": "other_dean@polytech.edu"}
    dup_code_res = await client.post("/auth/register/institution", json=diff_email_payload)
    assert dup_code_res.status_code == 409
    assert "institution with this code already exists" in dup_code_res.json()["detail"]

    # 6. Access Institution route with token
    inst_res = await client.get("/institution/analytics", headers={"Authorization": f"Bearer {token}"})
    assert inst_res.status_code == 200

    # 7. RBAC isolation: Institution cannot access Academician-only routes
    fac_res = await client.get("/academician/opportunities", headers={"Authorization": f"Bearer {token}"})
    assert fac_res.status_code == 403


@pytest.mark.asyncio
async def test_invalid_payload_validation(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, _ = api_client

    # Academician missing required fields
    bad_fac = await client.post("/auth/register/academician", json={"email": "incomplete@test.com", "password": "short"})
    assert bad_fac.status_code == 422

    # Institution missing required fields
    bad_inst = await client.post("/auth/register/institution", json={"email": "incomplete@test.com", "password": "short"})
    assert bad_inst.status_code == 422


@pytest.mark.asyncio
async def test_production_institution_registration_requires_invited_email(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = api_client
    settings = SimpleNamespace(
        environment="production",
        institution_registration_allowlist=["invited@polytech.edu"],
        registration_rate_limit_per_minute=5,
    )
    monkeypatch.setattr(auth_api, "get_settings", lambda: settings)
    payload = {
        "email": "not-invited@polytech.edu",
        "password": "InstitutionPassword123!",
        "institution_name": "Polytechnic State University",
        "institution_code": "PSU-INVITE-1",
        "departments": ["Computer Science"],
    }

    rejected = await client.post("/auth/register/institution", json=payload)
    assert rejected.status_code == 403

    accepted = await client.post(
        "/auth/register/institution",
        json={**payload, "email": "Invited@Polytech.edu"},
    )
    assert accepted.status_code == 201
