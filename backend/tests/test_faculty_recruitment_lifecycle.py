"""Integration tests for University Faculty Job Postings, Candidate Applications, Interview Scheduling & Hiring Decisions."""
import uuid
import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import Academician, Institution, Role


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
async def test_faculty_recruitment_and_interview_lifecycle(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client

    # 1. Create an Institution and a Faculty Member
    async with factory() as session:
        inst = Institution(
            email="recruitment@oxford-demo.edu",
            password_hash=hash_password("DemoPass123"),
            institution_name="Oxford Technological Institute",
            institution_code="OX-TECH-01",
            state="Karnataka",
            departments=["Computer Science", "Artificial Intelligence"],
        )
        fac = Academician(
            email="dr.alan@turing-demo.edu",
            password_hash=hash_password("DemoPass123"),
            full_name="Dr. Alan Turing",
            institution_name="Cambridge Research Lab",
            department="Computer Science",
            designation="Assistant Professor",
            years_experience=6,
            research_areas=["Theoretical Computer Science", "Machine Learning"],
        )
        session.add_all([inst, fac])
        await session.commit()
        await session.refresh(inst)
        await session.refresh(fac)
        inst_id = inst.id
        fac_id = fac.id

    inst_token = create_access_token(inst_id, Role.institution)
    fac_token = create_access_token(fac_id, Role.academician)

    inst_headers = {"Authorization": f"Bearer {inst_token}"}
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # 2. Institution Posts a Faculty Job Opening
    create_job_payload = {
        "title": "Professor & Head of AI & Machine Learning",
        "department": "Artificial Intelligence",
        "designation": "Full Professor",
        "employment_type": "Full-time Tenure Track",
        "min_experience_years": 5,
        "qualification_required": "Ph.D. in Computer Science or Artificial Intelligence",
        "skills_required": ["Deep Learning", "PyTorch", "Curriculum Development", "Grant Writing"],
        "research_areas": ["Foundation Models", "Robotics", "Reinforcement Learning"],
        "salary_range_lpa": "24 - 32 LPA",
        "location": "Main Campus, Bangalore",
        "openings_count": 2,
        "description": "Seeking an eminent academic scholar to lead our AI research center and undergraduate curriculum.",
        "responsibilities": ["Lead department research", "Teach Advanced AI", "Mentor Ph.D. scholars"],
        "benefits": ["Research Seed Grant 10 Lakhs", "Faculty Housing Allowance", "Annual Conference Travel"],
        "status": "open",
    }
    resp = await client.post("/institution/faculty-jobs", json=create_job_payload, headers=inst_headers)
    assert resp.status_code == 201, resp.text
    job_data = resp.json()
    job_id = job_data["id"]
    assert job_data["title"] == "Professor & Head of AI & Machine Learning"
    assert job_data["institution_name"] == "Oxford Technological Institute"

    # 3. Institution lists their faculty jobs
    resp = await client.get("/institution/faculty-jobs", headers=inst_headers)
    assert resp.status_code == 200
    inst_jobs = resp.json()
    assert inst_jobs["total"] >= 1
    assert any(j["id"] == job_id for j in inst_jobs["items"])

    # 4. Faculty browses open faculty vacancies
    resp = await client.get("/academician/faculty-jobs?department=Artificial+Intelligence", headers=fac_headers)
    assert resp.status_code == 200
    catalog = resp.json()
    assert catalog["total"] >= 1
    matched_job = next(j for j in catalog["items"] if j["id"] == job_id)
    assert matched_job["has_applied"] is False

    # 5. Faculty applies for the job opening
    apply_payload = {
        "job_id": job_id,
        "statement_of_purpose": "I wish to lead the AI research group and contribute to cutting-edge research in neural systems.",
        "research_statement": "My work spans neural algorithms, transformer efficiency, and algorithmic game theory.",
        "teaching_philosophy": "Emphasizing hands-on laboratory experimentation and open-source contributions.",
        "current_institution": "Cambridge Research Lab",
        "current_designation": "Assistant Professor",
        "years_of_experience": 6,
        "notice_period_days": 30,
        "cv_url": "https://credentials.example.com/cv-dr-turing.pdf",
    }
    resp = await client.post("/academician/faculty-jobs/apply", json=apply_payload, headers=fac_headers)
    assert resp.status_code == 201, resp.text
    app_data = resp.json()
    app_id = app_data["id"]
    assert app_data["status"] == "applied"
    assert app_data["job_id"] == job_id

    # 6. Duplicate apply should fail gracefully
    resp = await client.post("/academician/faculty-jobs/apply", json=apply_payload, headers=fac_headers)
    assert resp.status_code == 400

    # 7. Institution views applications for this job opening
    resp = await client.get(f"/institution/faculty-jobs/{job_id}/applications", headers=inst_headers)
    assert resp.status_code == 200
    job_apps = resp.json()
    assert job_apps["total"] == 1
    assert job_apps["items"][0]["id"] == app_id
    assert job_apps["items"][0]["faculty_name"] == "Dr. Alan Turing"

    # 8. Institution schedules an interview
    schedule_payload = {
        "scheduled_at": "2026-10-15T14:30:00Z",
        "mode": "online",
        "meeting_link": "https://meet.google.com/abc-defg-hij",
        "venue": "Virtual Room Alpha",
        "panel_members": ["Prof. Ada Lovelace (Dean)", "Prof. Charles Babbage (External Expert)"],
        "instructions": "Please prepare a 20-minute presentation on your research vision followed by Q&A.",
    }
    resp = await client.post(
        f"/institution/faculty-job-applications/{app_id}/schedule-interview",
        json=schedule_payload,
        headers=inst_headers,
    )
    assert resp.status_code == 200, resp.text
    sched_resp = resp.json()
    assert sched_resp["status"] == "interview_scheduled"
    assert sched_resp["interview_details"]["meeting_link"] == "https://meet.google.com/abc-defg-hij"

    # 9. Faculty checks their applications and sees interview scheduled
    resp = await client.get("/academician/faculty-jobs/my-applications", headers=fac_headers)
    assert resp.status_code == 200
    my_apps = resp.json()
    assert my_apps["total"] == 1
    my_app = my_apps["items"][0]
    assert my_app["status"] == "interview_scheduled"
    assert my_app["interview_details"]["mode"] == "online"
    assert my_app["interview_details"]["meeting_link"] == "https://meet.google.com/abc-defg-hij"

    # 10. Institution conducts interview and records decision: OFFERED
    decision_payload = {
        "status": "offered",
        "rating": 4.9,
        "feedback": "Outstanding research track record and visionary curriculum roadmap.",
        "notes": "Unanimous committee consensus for full professorship.",
        "offer_details": {
            "designation": "Professor & Head of AI",
            "base_salary_lpa": 30.0,
            "joining_date": "2026-12-01",
        },
    }
    resp = await client.post(
        f"/institution/faculty-job-applications/{app_id}/decision",
        json=decision_payload,
        headers=inst_headers,
    )
    assert resp.status_code == 200, resp.text
    dec_resp = resp.json()
    assert dec_resp["status"] == "offered"
    assert dec_resp["interview_details"]["rating"] == 4.9

    # 11. Faculty re-checks their dashboard
    resp = await client.get("/academician/faculty-jobs/my-applications", headers=fac_headers)
    assert resp.status_code == 200
    final_apps = resp.json()
    assert final_apps["items"][0]["status"] == "offered"
    assert final_apps["items"][0]["interview_details"]["feedback"] == "Outstanding research track record and visionary curriculum roadmap."
