"""Tests for Faculty Video Lectures Upload & Student Discovery by Faculty Name."""
import uuid
from datetime import UTC, datetime

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import Academician, Role, Student


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
async def test_faculty_video_upload_and_student_discovery(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client

    # 1. Setup Faculty and Student accounts
    async with factory() as session:
        fac = Academician(
            email="dr.ananya@demo.ac.in",
            password_hash=hash_password("FacultyPass123"),
            full_name="Dr. Ananya Sharma",
            institution_name="National Institute of Technology Demo University",
            department="Computer Science Engineering",
            designation="Associate Professor",
            research_areas=["AI", "Systems"],
            years_experience=8,
            technical_skills=["Python", "FastAPI", "pgvector"],
        )
        st = Student(
            email="student.maya@demo.ac.in",
            password_hash=hash_password("StudentPass123"),
            full_name="Maya Rivera",
            university="Harbor Polytechnic University",
        )
        session.add_all([fac, st])
        await session.commit()
        await session.refresh(fac)
        await session.refresh(st)
        fac_id = fac.id
        st_id = st.id

    fac_token = create_access_token(fac_id, Role.academician)
    st_token = create_access_token(st_id, Role.student)

    # 2. Faculty uploads/publishes a video lecture
    payload = {
        "title": "Quantum Computing & Qubit Superposition Fundamentals",
        "description": "Introduction to quantum gates, superposition, and entanglement algorithms.",
        "video_url": "https://www.youtube.com/watch?v=QuAn8d2QJgE",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "duration_minutes": 55,
        "subject": "Quantum Computing",
        "department": "Computer Science Engineering",
        "skills_covered": ["Quantum Computing", "Qiskit", "Linear Algebra"],
        "notes_markdown": "# Quantum Gates Cheat Sheet\n\n- Hadamard Gate: creates equal superposition.",
        "is_published": True,
    }

    create_resp = await client.post(
        "/academician/videos",
        json=payload,
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert create_resp.status_code == 201, create_resp.text
    video_data = create_resp.json()
    assert video_data["title"] == payload["title"]
    assert video_data["faculty_name"] == "Dr. Ananya Sharma"
    video_id = video_data["id"]

    # 3. Faculty lists own uploaded videos
    own_resp = await client.get(
        "/academician/videos",
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert own_resp.status_code == 200
    own_videos = own_resp.json()
    assert any(v["id"] == video_id for v in own_videos)

    # 4. Student discovers faculty video masterclasses without filter
    catalog_resp = await client.get(
        "/learning/faculty-videos",
        headers={"Authorization": f"Bearer {st_token}"},
    )
    assert catalog_resp.status_code == 200
    catalog_data = catalog_resp.json()
    assert catalog_data["total"] >= 1
    assert any(v["id"] == video_id for v in catalog_data["items"])
    assert "Dr. Ananya Sharma" in catalog_data["faculty_names"]

    # 5. Student filters specifically by Faculty Name
    faculty_name = "Dr. Ananya Sharma"
    filtered_resp = await client.get(
        f"/learning/faculty-videos?faculty_name={faculty_name}",
        headers={"Authorization": f"Bearer {st_token}"},
    )
    assert filtered_resp.status_code == 200
    filtered_data = filtered_resp.json()
    assert len(filtered_data["items"]) >= 1
    for item in filtered_data["items"]:
        assert "ananya" in item["faculty_name"].lower()

    # 6. Student tracks video view
    view_resp = await client.post(
        f"/learning/faculty-videos/{video_id}/view",
        headers={"Authorization": f"Bearer {st_token}"},
    )
    assert view_resp.status_code == 200
    assert view_resp.json()["views_count"] == 1

    # 7. Faculty deletes own video
    del_resp = await client.delete(
        f"/academician/videos/{video_id}",
        headers={"Authorization": f"Bearer {fac_token}"},
    )
    assert del_resp.status_code == 204

