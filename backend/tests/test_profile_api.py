import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.main import app


@pytest_asyncio.fixture
async def client() -> httpx.AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as result:
        yield result
    app.dependency_overrides.clear()
    await engine.dispose()


async def register(client: httpx.AsyncClient, role: str, email: str) -> str:
    payload = {"email": email, "password": "StrongPassword123"}
    payload.update({"full_name": "Student"} if role == "student" else {"company_name": "Company"})
    response = await client.post(f"/auth/register/{role}", json=payload)
    assert response.status_code == 201
    return response.json()["access_token"]


@pytest.mark.asyncio
async def test_profile_is_student_private_and_never_selects_another_student(client: httpx.AsyncClient) -> None:
    first = await register(client, "student", "first-profile@example.test")
    second = await register(client, "student", "second-profile@example.test")
    recruiter = await register(client, "recruiter", "profile-recruiter@example.test")
    first_response = await client.get("/passport/profile", headers={"Authorization": f"Bearer {first}"})
    second_response = await client.get("/passport/profile?student_id=ignored", headers={"Authorization": f"Bearer {second}"})
    assert first_response.status_code == 200 and second_response.status_code == 200
    assert first_response.json()["student_id"] != second_response.json()["student_id"]
    assert "full_name" not in first_response.text and "email" not in first_response.text
    assert (await client.get("/passport/profile", headers={"Authorization": f"Bearer {recruiter}"})).status_code == 403
