"""Comprehensive test suite for Phase 1 and Phase 2 University / Institution Portal features."""
import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import Academician, Institution, Role, Student


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
async def test_institution_phase1_endpoints(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client

    async with factory() as session:
        inst = Institution(
            email="dean.test@university.edu",
            password_hash="hashed",
            institution_name="National Institute of Technology",
            institution_code="NIT-AISHE-101",
            state="Karnataka",
            departments=["Computer Science & Engineering", "Information Technology"],
        )
        in_scope_student = Student(
            email="student@nit.example",
            password_hash="hashed",
            full_name="Scoped Student",
            university="  NATIONAL INSTITUTE OF TECHNOLOGY ",
            institution=inst,
            department="Computer Science & Engineering",
        )
        out_of_scope_student = Student(
            email="student@other.example",
            password_hash="hashed",
            full_name="Other Student",
            university="Other University",
        )
        session.add_all([inst, in_scope_student, out_of_scope_student])
        await session.commit()
        await session.refresh(inst)
        inst_id = inst.id

    inst_token = create_access_token(inst_id, Role.institution)
    headers = {"Authorization": f"Bearer {inst_token}"}

    # 1. Basic analytics overview
    res = await client.get("/institution/analytics", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["institution_name"] == "National Institute of Technology"
    assert data["total_students"] == 1
    assert len(data["department_metrics"]) == 1

    # 2. Department Drill-Down
    dept_res = await client.get("/institution/departments/Computer Science & Engineering", headers=headers)
    assert dept_res.status_code == 200, dept_res.text
    dept_data = dept_res.json()
    assert dept_data["department"] == "Computer Science & Engineering"
    assert dept_data["total_students"] > 0
    assert dept_data["top_verified_skills"] == []
    assert dept_data["recommended_actions"] == []

    # 3. Student Cohort Monitoring
    cohort_res = await client.get("/institution/cohorts", headers=headers)
    assert cohort_res.status_code == 200, cohort_res.text
    cohort_data = cohort_res.json()
    assert cohort_data["total_cohorts"] > 0
    assert len(cohort_data["cohorts"]) > 0

    # Test Cohort Filter
    filtered_cohort = await client.get("/institution/cohorts?department=CSE", headers=headers)
    assert filtered_cohort.status_code == 200
    assert len(filtered_cohort.json()["cohorts"]) > 0

    # 4. Skill Gap Intervention Recommendations
    recs_res = await client.get("/institution/interventions/recommendations", headers=headers)
    assert recs_res.status_code == 200, recs_res.text
    recs = recs_res.json()
    assert recs == []

    # 5. Intervention Plans CRUD
    plan_payload = {
        "title": "Full Stack & Microservices Sprint",
        "skill_cluster": "Backend Engineering",
        "department": "Computer Science & Engineering",
        "target_students_count": 35,
        "baseline_supply_index": 50.0,
        "target_supply_index": 85.0,
        "selected_learning_programs": ["FastAPI Mastery"],
        "selected_workshops": ["Microservices Lab"],
        "selected_mentorship": ["Senior Architect"],
        "status": "planned",
        "notes": "Target for Q2 placement preparation.",
    }
    create_plan_res = await client.post("/institution/interventions", json=plan_payload, headers=headers)
    assert create_plan_res.status_code == 201, create_plan_res.text
    created_plan = create_plan_res.json()
    plan_id = created_plan["id"]
    assert created_plan["title"] == "Full Stack & Microservices Sprint"

    # List plans
    list_plans_res = await client.get("/institution/interventions", headers=headers)
    assert list_plans_res.status_code == 200
    assert any(p["id"] == plan_id for p in list_plans_res.json())

    # Update plan
    patch_res = await client.patch(f"/institution/interventions/{plan_id}", json={"status": "in_progress"}, headers=headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "in_progress"

    # 6. Internship Monitoring
    intern_res = await client.get("/institution/internships/monitoring", headers=headers)
    assert intern_res.status_code == 200, intern_res.text
    intern_data = intern_res.json()
    assert intern_data["eligible_students"] > 0
    assert len(intern_data["by_department"]) > 0

    # 7. Placement Monitoring
    place_res = await client.get("/institution/placements/monitoring", headers=headers)
    assert place_res.status_code == 200, place_res.text
    place_data = place_res.json()
    assert place_data["eligible_students"] > 0
    assert place_data["by_company"] == []

    # 8. Faculty Engagement
    fac_res = await client.get("/institution/faculty-engagement", headers=headers)
    assert fac_res.status_code == 200, fac_res.text
    fac_data = fac_res.json()
    assert fac_data["total_participating_faculty"] == 0
    assert fac_data["by_department"] == []

    # Delete intervention plan
    del_res = await client.delete(f"/institution/interventions/{plan_id}", headers=headers)
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_institution_phase2_endpoints(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client

    async with factory() as session:
        inst = Institution(
            email="provost@techuniversity.edu",
            password_hash="hashed",
            institution_name="Global Tech University",
            institution_code="GTU-AISHE-202",
            state="Maharashtra",
            departments=["Computer Science & Engineering", "Information Technology"],
        )
        session.add(inst)
        await session.commit()
        await session.refresh(inst)
        inst_id = inst.id

    inst_token = create_access_token(inst_id, Role.institution)
    headers = {"Authorization": f"Bearer {inst_token}"}

    # 1. Curriculum Recommendations
    cur_res = await client.get("/institution/curriculum-recommendations", headers=headers)
    assert cur_res.status_code == 200, cur_res.text
    cur_data = cur_res.json()
    assert cur_data == []

    # 2. Industry Partnerships
    part_res = await client.get("/institution/partnerships", headers=headers)
    assert part_res.status_code == 200, part_res.text
    part_data = part_res.json()
    assert part_data["total_partners"] == 0
    assert part_data["partners"] == []

    # Partner Detail
    p_detail_res = await client.get("/institution/partnerships/Hyperscale Cloud Labs", headers=headers)
    assert p_detail_res.status_code == 200, p_detail_res.text
    assert p_detail_res.json()["partner_name"] == "Hyperscale Cloud Labs"

    # 3. Learning Effectiveness
    learn_res = await client.get("/institution/learning-effectiveness", headers=headers)
    assert learn_res.status_code == 200, learn_res.text
    learn_data = learn_res.json()
    assert learn_data["total_enrolled"] == 0
    assert learn_data["courses"] == []

    # 4. At-Risk Cohort Detection
    risk_res = await client.get("/institution/at-risk-cohorts", headers=headers)
    assert risk_res.status_code == 200, risk_res.text
    risk_data = risk_res.json()
    assert risk_data["total_at_risk_students"] == 0
    assert risk_data["risk_groups"] == []

    # 5. Action Plans CRUD
    action_payload = {
        "title": "Semester 6 API Security Lab Mandatory Integration",
        "action_type": "curriculum",
        "related_department": "Computer Science & Engineering",
        "source_insight": "Critical gap in OAuth 2.0 and API Security observed.",
        "priority": "critical",
        "owner": "Prof. Arvind Rao",
        "status": "planned",
        "outcome_notes": "Syllabus revision submitted to academic council.",
    }
    create_act_res = await client.post("/institution/action-plans", json=action_payload, headers=headers)
    assert create_act_res.status_code == 201, create_act_res.text
    action_id = create_act_res.json()["id"]

    # List action plans
    act_list_res = await client.get("/institution/action-plans", headers=headers)
    assert act_list_res.status_code == 200
    assert any(a["id"] == action_id for a in act_list_res.json())

    # Patch action plan
    patch_act_res = await client.patch(f"/institution/action-plans/{action_id}", json={"status": "in_progress"}, headers=headers)
    assert patch_act_res.status_code == 200
    assert patch_act_res.json()["status"] == "in_progress"

    # 6. Actionable Alerts
    alert_res = await client.get("/institution/alerts", headers=headers)
    assert alert_res.status_code == 200, alert_res.text
    alerts = alert_res.json()["alerts"]
    assert alerts == []

    # 7. Collaboration Relationships View
    rel_res = await client.get("/institution/relationships", headers=headers)
    assert rel_res.status_code == 200, rel_res.text
    rel_data = rel_res.json()
    assert rel_data["total_collaborations"] == 0
    assert rel_data["relationships"] == []

    # 8. Reports Generation
    rep_types = ["skill_gap", "department_readiness", "internship", "placement", "faculty_engagement", "learning_adoption", "industry_partnerships"]
    for rtype in rep_types:
        rep_res = await client.get(f"/institution/reports/{rtype}", headers=headers)
        assert rep_res.status_code == 200, f"Failed on report {rtype}: {rep_res.text}"
        rep_data = rep_res.json()
        assert len(rep_data["columns"]) > 0
        assert rep_data["rows"] == []

    # Delete action plan
    del_act_res = await client.delete(f"/institution/action-plans/{action_id}", headers=headers)
    assert del_act_res.status_code == 200


@pytest.mark.asyncio
async def test_institution_rbac_isolation(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client

    async with factory() as session:
        fac = Academician(
            email="faculty.test@univ.edu",
            password_hash="hashed",
            full_name="Prof. Test",
            institution_name="Tech Univ",
            department="CSE",
            designation="Professor",
        )
        session.add(fac)
        await session.commit()
        await session.refresh(fac)
        fac_id = fac.id

    fac_token = create_access_token(fac_id, Role.academician)
    fac_headers = {"Authorization": f"Bearer {fac_token}"}

    # Faculty cannot access institution-only decision endpoints
    assert (await client.get("/institution/analytics", headers=fac_headers)).status_code == 403
    assert (await client.get("/institution/cohorts", headers=fac_headers)).status_code == 403
    assert (await client.get("/institution/interventions", headers=fac_headers)).status_code == 403
    assert (await client.get("/institution/action-plans", headers=fac_headers)).status_code == 403
    assert (await client.get("/institution/reports/skill_gap", headers=fac_headers)).status_code == 403


@pytest.mark.asyncio
async def test_institution_tenants_cannot_read_or_mutate_each_others_aggregates_and_plans(
    api_client: tuple[httpx.AsyncClient, async_sessionmaker[AsyncSession]],
) -> None:
    client, factory = api_client
    async with factory() as session:
        first = Institution(
            email="first.institution@example.edu",
            password_hash="hashed",
            institution_name="First Technical University",
            institution_code="FIRST-001",
            state="Karnataka",
            departments=["Computer Science & Engineering"],
        )
        second = Institution(
            email="second.institution@example.edu",
            password_hash="hashed",
            institution_name="Second Technical University",
            institution_code="SECOND-002",
            state="Maharashtra",
            departments=["Information Technology"],
        )
        session.add_all([first, second])
        await session.flush()
        session.add_all(
            [
                Student(
                    email="first.student@example.edu",
                    password_hash="hashed",
                    full_name="First Student",
                    university="First Technical University",
                    institution=first,
                ),
                Student(
                    email="second.student@example.edu",
                    password_hash="hashed",
                    full_name="Second Student",
                    university="Second Technical University",
                    institution=second,
                ),
                Student(
                    email="unrelated.student@example.edu",
                    password_hash="hashed",
                    full_name="Unrelated Student",
                    university="Unrelated University",
                ),
            ]
        )
        await session.commit()
        first_id = first.id
        second_id = second.id

    first_headers = {
        "Authorization": f"Bearer {create_access_token(first_id, Role.institution)}"
    }
    second_headers = {
        "Authorization": f"Bearer {create_access_token(second_id, Role.institution)}"
    }

    first_analytics = (
        await client.get("/institution/analytics", headers=first_headers)
    ).json()
    second_analytics = (
        await client.get("/institution/analytics", headers=second_headers)
    ).json()
    assert first_analytics["institution_name"] == "First Technical University"
    assert second_analytics["institution_name"] == "Second Technical University"
    assert first_analytics["total_students"] == 1
    assert second_analytics["total_students"] == 1

    plan = await client.post(
        "/institution/interventions",
        headers=first_headers,
        json={
            "title": "First Tenant Plan",
            "skill_cluster": "Backend Engineering",
            "department": "Computer Science & Engineering",
            "target_students_count": 1,
            "baseline_supply_index": 20,
            "target_supply_index": 80,
            "selected_learning_programs": [],
            "selected_workshops": [],
            "selected_mentorship": [],
            "status": "planned",
        },
    )
    assert plan.status_code == 201
    plan_id = plan.json()["id"]
    second_plans = await client.get(
        "/institution/interventions", headers=second_headers
    )
    assert second_plans.status_code == 200
    assert all(item["id"] != plan_id for item in second_plans.json())
    assert (
        await client.patch(
            f"/institution/interventions/{plan_id}",
            headers=second_headers,
            json={"status": "in_progress"},
        )
    ).status_code == 404
    assert (
        await client.delete(
            f"/institution/interventions/{plan_id}", headers=second_headers
        )
    ).status_code == 404
