"""Tests for Institution Portal Faculty Video Masterclasses & Teacher Value Ranking."""
import uuid
import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import Academician, FacultyVideo, Institution, Role


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
async def test_institution_faculty_video_contributions_and_value_ranking(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client

    # 1. Setup Institution and Faculty accounts
    async with factory() as session:
        inst = Institution(
            email="dean@nit.demo",
            password_hash=hash_password("DemoPass123"),
            institution_name="National Institute of Technology Demo University",
            institution_code="NIT-DEMO-01",
            state="Karnataka",
            departments=["Computer Science", "Information Technology"],
        )
        fac1 = Academician(
            email="dr.ananya@nit.demo",
            password_hash=hash_password("DemoPass123"),
            full_name="Dr. Ananya Sharma",
            institution_name="National Institute of Technology Demo University",
            department="Computer Science Engineering",
            designation="Associate Professor",
        )
        fac2 = Academician(
            email="dr.vikram@nit.demo",
            password_hash=hash_password("DemoPass123"),
            full_name="Dr. Vikram Rao",
            institution_name="National Institute of Technology Demo University",
            department="Computer Science Engineering",
            designation="Professor & Dean of Computing",
        )
        session.add_all([inst, fac1, fac2])
        await session.commit()
        await session.refresh(inst)
        await session.refresh(fac1)
        await session.refresh(fac2)

        inst_id = inst.id
        fac1_id = fac1.id
        fac2_id = fac2.id

        # Add 2 videos for Dr. Ananya Sharma (total views = 300 + 200 = 500)
        v1 = FacultyVideo(
            faculty_id=fac1_id,
            faculty_name="Dr. Ananya Sharma",
            faculty_institution="National Institute of Technology Demo University",
            faculty_designation="Associate Professor",
            title="FastAPI Production Architecture",
            description="Deep dive into async FastAPI endpoints and dependency injection.",
            video_url="https://www.youtube.com/watch?v=kCgGjBG6i10",
            duration_minutes=40,
            subject="Backend Engineering",
            department="Computer Science Engineering",
            skills_covered=["FastAPI", "Python", "AsyncIO"],
            views_count=300,
            is_published=True,
        )
        v2 = FacultyVideo(
            faculty_id=fac1_id,
            faculty_name="Dr. Ananya Sharma",
            faculty_institution="National Institute of Technology Demo University",
            faculty_designation="Associate Professor",
            title="PostgreSQL pgvector & Semantic Embeddings",
            description="High-dimensional cosine indexing with pgvector.",
            video_url="https://www.youtube.com/watch?v=F0dU_Jg_u0U",
            duration_minutes=45,
            subject="AI Systems",
            department="Computer Science Engineering",
            skills_covered=["pgvector", "PostgreSQL", "Embeddings"],
            views_count=200,
            is_published=True,
        )

        # Add 1 video for Dr. Vikram Rao (total views = 150)
        v3 = FacultyVideo(
            faculty_id=fac2_id,
            faculty_name="Dr. Vikram Rao",
            faculty_institution="National Institute of Technology Demo University",
            faculty_designation="Professor & Dean of Computing",
            title="Distributed Caching with Redis",
            description="Cache invalidation, streams, and cluster architectures.",
            video_url="https://www.youtube.com/watch?v=jgpVdJB2sKQ",
            duration_minutes=50,
            subject="Distributed Systems",
            department="Computer Science Engineering",
            skills_covered=["Redis", "Distributed Systems"],
            views_count=150,
            is_published=True,
        )

        session.add_all([v1, v2, v3])
        await session.commit()

    inst_token = create_access_token(inst_id, Role.institution)

    # 2. Call GET /institution/faculty-videos
    res = await client.get(
        "/institution/faculty-videos",
        headers={"Authorization": f"Bearer {inst_token}"},
    )
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["institution_name"] == "National Institute of Technology Demo University"
    assert data["total_videos"] == 3
    assert data["total_faculty_contributors"] == 2
    assert data["total_video_views"] == 650  # 300 + 200 + 150
    assert data["top_faculty_contributor"] == "Dr. Ananya Sharma"

    contributions = data["faculty_contributions"]
    assert len(contributions) == 2

    # Verify Ranked #1 is Dr. Ananya Sharma
    top_teacher = contributions[0]
    assert top_teacher["faculty_name"] == "Dr. Ananya Sharma"
    assert top_teacher["total_videos"] == 2
    assert top_teacher["total_views"] == 500
    assert top_teacher["avg_views_per_video"] == 250.0
    assert top_teacher["value_rank"] == 1
    assert "Top Value Faculty Leader" in top_teacher["value_tier"]
    assert len(top_teacher["videos"]) == 2
    # Check skills taught union
    assert set(top_teacher["skills_taught"]) == {"AsyncIO", "Embeddings", "FastAPI", "PostgreSQL", "Python", "pgvector"}
    # Value score: views (500) + 2*50 (100) + 6*15 (90) = 690.0
    assert top_teacher["value_score"] == 690.0

    # Verify Ranked #2 is Dr. Vikram Rao
    second_teacher = contributions[1]
    assert second_teacher["faculty_name"] == "Dr. Vikram Rao"
    assert second_teacher["total_videos"] == 1
    assert second_teacher["total_views"] == 150
    assert second_teacher["value_rank"] == 2
    assert len(second_teacher["videos"]) == 1
    assert second_teacher["videos"][0]["title"] == "Distributed Caching with Redis"
