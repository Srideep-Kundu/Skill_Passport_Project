"""Integration and unit tests for Automated GitHub Project Assessment."""
from uuid import UUID, uuid4

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import auth as auth_api
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import ProjectAssessment, ProjectAssessmentStatus, Recruiter, Role, Student
from app.services.project_assessment_service import (
    AssessmentEngine,
    GitHubRepositoryProvider,
    project_assessment_service,
)


@pytest_asyncio.fixture
async def assessment_client(monkeypatch: pytest.MonkeyPatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    async def no_op_rate_limit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(auth_api, "enforce_rate_limit", no_op_rate_limit)

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# =============================================================================
# Unit Tests for Repository Provider & Assessment Engine
# =============================================================================

def test_github_url_validation():
    provider = GitHubRepositoryProvider()
    
    # Valid URLs
    owner, repo = provider.validate_url("https://github.com/torvalds/linux")
    assert owner == "torvalds"
    assert repo == "linux"

    owner, repo = provider.validate_url("https://github.com/user-name/my-cool-project.git")
    assert owner == "user-name"
    assert repo == "my-cool-project"

    owner, repo = provider.validate_url("http://www.github.com/org_name/repo_123/")
    assert owner == "org_name"
    assert repo == "repo_123"

    # Invalid URLs
    with pytest.raises(ValueError, match="Only GitHub"):
        provider.validate_url("https://gitlab.com/user/project")

    with pytest.raises(ValueError, match="scheme"):
        provider.validate_url("ftp://github.com/user/project")

    with pytest.raises(ValueError, match="format"):
        provider.validate_url("https://github.com/invalid")


def test_assessment_engine_scoring():
    engine = AssessmentEngine()
    mock_repo_data = {
        "owner": "testuser",
        "repo": "ecommerce-api",
        "stars_count": 42,
        "forks_count": 12,
        "open_issues_count": 2,
        "has_readme": True,
        "languages": {"Python": 80000, "TypeScript": 40000},
        "file_paths": [
            "backend/app/main.py",
            "backend/app/services/order_service.py",
            "backend/app/models/domain.py",
            "backend/tests/test_orders.py",
            "backend/tests/test_auth.py",
            "frontend/src/App.tsx",
            "frontend/src/components/Checkout.tsx",
            "Dockerfile",
            "docker-compose.yml",
            ".github/workflows/ci.yml",
            "README.md",
            "requirements.txt",
            "package.json",
        ],
        "test_files": ["backend/tests/test_orders.py", "backend/tests/test_auth.py"],
        "config_files": ["Dockerfile", "docker-compose.yml", "requirements.txt", "package.json"],
        "ci_cd_present": True,
        "docker_present": True,
    }

    result = engine.analyze_and_score("Distributed E-Commerce API", mock_repo_data)

    assert result["overall_score"] >= 75
    assert len(result["categories"]) == 7
    assert len(result["strengths"]) >= 2
    assert len(result["improvements"]) >= 1
    assert "FastAPI" in result["technologies"] or "Python" in result["technologies"]
    assert result["repository_metadata"]["files_count"] == 13


# =============================================================================
# API Integration Tests
# =============================================================================

@pytest.mark.asyncio
async def test_project_assessment_flow_end_to_end(assessment_client):
    client, factory = assessment_client

    # 1. Seed Student and Recruiter accounts
    student_id = uuid4()
    student_2_id = uuid4()
    recruiter_id = uuid4()

    async with factory() as session:
        s1 = Student(
            id=student_id,
            email="rahul.sharma@example.com",
            password_hash=hash_password("Password123"),
            full_name="Rahul Sharma",
            university="NIT Trichy",
            github_username="rahulsharma-dev",
        )
        s2 = Student(
            id=student_2_id,
            email="aarav.singh@example.com",
            password_hash=hash_password("Password123"),
            full_name="Aarav Singh",
            university="IIT Madras",
            github_username="aarav-ml",
        )
        rec = Recruiter(
            id=recruiter_id,
            email="recruiter@techcorp.com",
            password_hash=hash_password("Password123"),
            company_name="TechCorp Global",
        )
        session.add_all([s1, s2, rec])
        await session.commit()

    recruiter_token = create_access_token(recruiter_id, Role.recruiter)
    student_token = create_access_token(student_id, Role.student)

    # 2. Recruiter fetches candidate options
    res = await client.get("/project-assessments/candidates", headers=auth_header(recruiter_token))
    assert res.status_code == 200
    candidates = res.json()
    assert len(candidates) >= 2
    assert any(c["full_name"] == "Rahul Sharma" for c in candidates)

    # 3. Recruiter creates a project assessment for Rahul
    create_payload = {
        "student_id": str(student_id),
        "project_title": "Scalable Microservices Gateway",
        "repository_url": "https://github.com/rahulsharma-dev/microservices-gateway",
    }
    res = await client.post("/project-assessments", json=create_payload, headers=auth_header(recruiter_token))
    assert res.status_code == 201
    assessment_data = res.json()
    assessment_id = assessment_data["id"]
    assert assessment_data["project_title"] == "Scalable Microservices Gateway"
    assert assessment_data["status"] in ("scanning", "completed")

    # Manually run pipeline execution synchronously with test session
    owner, repo = "rahulsharma-dev", "microservices-gateway"
    async with factory() as session:
        await project_assessment_service.run_automated_pipeline(
            UUID(assessment_data["id"]), owner, repo, session_override=session
        )

    # 4. Pipeline executes: generates 5 repository-tailored questions and sets status to 'ready'
    res = await client.get(f"/project-assessments/{assessment_id}", headers=auth_header(recruiter_token))
    assert res.status_code == 200
    detail = res.json()
    assert detail["status"] == "ready"
    assert len(detail["questions"]) == 5
    assert len(detail["category_scores"]) >= 5
    correct_answers = {q["id"]: q["correct_answer"] for q in detail["questions"]}

    # 5. Student checks project assessments and sees the ready assessment
    res = await client.get("/student/project-assessments", headers=auth_header(student_token))
    assert res.status_code == 200
    student_assessments = res.json()
    assert len(student_assessments) >= 1
    assert student_assessments[0]["id"] == assessment_id
    assert student_assessments[0]["status"] == "ready"

    # 6. Student retrieves detailed questions (solutions hidden prior to submission)
    res = await client.get(f"/student/project-assessments/{assessment_id}", headers=auth_header(student_token))
    assert res.status_code == 200
    student_detail = res.json()
    assert student_detail["status"] == "ready"
    assert len(student_detail["questions"]) == 5
    # Solution must be concealed from student prior to answering
    assert student_detail["questions"][0]["correct_answer"] is None

    # 7. Student takes assessment and submits answers
    res = await client.post(
        f"/student/project-assessments/{assessment_id}/submit",
        json={"answers": correct_answers},
        headers=auth_header(student_token),
    )
    assert res.status_code == 200
    graded_result = res.json()
    assert graded_result["status"] == "completed"
    assert graded_result["overall_score"] == 100
    assert graded_result["completed_at"] is not None
    # Now solution and explanation are revealed
    assert graded_result["questions"][0]["correct_answer"] is not None

    # 8. Recruiter sees completed candidate marks on their portal
    res = await client.get(f"/project-assessments/{assessment_id}", headers=auth_header(recruiter_token))
    assert res.status_code == 200
    recruiter_view = res.json()
    assert recruiter_view["status"] == "completed"
    assert recruiter_view["overall_score"] >= 60

    # 9. Recruiter shortlists candidate based on assessment marks
    shortlist_payload = {
        "is_shortlisted": True,
        "shortlist_notes": "Exceptional microservices architecture and clean Docker configuration.",
    }
    res = await client.post(
        f"/project-assessments/{assessment_id}/shortlist",
        json=shortlist_payload,
        headers=auth_header(recruiter_token),
    )
    assert res.status_code == 200
    shortlisted_data = res.json()
    assert shortlisted_data["is_shortlisted"] is True
    assert "Exceptional microservices" in shortlisted_data["shortlist_notes"]

    # 10. Recruiter lists & ranks candidates on the leaderboard
    res = await client.get(
        "/project-assessments",
        params={"status": "shortlisted", "sort_by": "score_desc"},
        headers=auth_header(recruiter_token),
    )
    assert res.status_code == 200
    list_res = res.json()
    assert list_res["total"] >= 1
    assert list_res["items"][0]["id"] == assessment_id
    assert list_res["items"][0]["overall_score"] >= 60

    # 11. RBAC: Unauthorized student cannot access Rahul's assessment
    student_2_token = create_access_token(student_2_id, Role.student)
    res = await client.get(f"/student/project-assessments/{assessment_id}", headers=auth_header(student_2_token))
    assert res.status_code == 403
