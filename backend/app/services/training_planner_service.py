"""Deterministic faculty training-planner workflows."""
from datetime import UTC, datetime
from typing import Literal, cast
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Academician,
    Institution,
    InstitutionInterventionPlan,
    TrainingOutcomeMetric,
    TrainingProgram,
)
from app.schemas.contracts import (
    TrainingOutcomeCreateRequest,
    TrainingOutcomeResponse,
    TrainingProgramCreateRequest,
    TrainingProgramListResponse,
    TrainingProgramResponse,
    TrainingProgramUpdateRequest,
    TrainingRecommendationResponse,
)

INVENTORY = {"Auditorium": 1, "Computer Lab": 60, "GPU Lab": 12, "Projector & Audio": 4, "High-speed Internet": 1, "Cloud Credits": 50, "Robotics Kits": 20, "Software Licenses": 40}


def _skills(value: str) -> list[str]:
    return list(dict.fromkeys(part.strip() for part in value.split(",") if part.strip()))


def _notice(start: datetime | None, tasks: list[dict]) -> tuple[int, str]:
    if start is None:
        return 0, "CRITICAL"
    start = start if start.tzinfo else start.replace(tzinfo=UTC)
    days = max(0, (start - datetime.now(UTC)).days)
    pending = sum(task.get("status") != "completed" for task in tasks)
    if days < 10 or (days < 21 and pending >= 5):
        return days, "CRITICAL"
    if days < 21 or pending >= 3:
        return days, "TIGHT"
    return days, "GOOD"


def _infrastructure(payload: TrainingProgramCreateRequest) -> list[dict]:
    rows = []
    for item in payload.infrastructure_requirements:
        required = payload.lab_systems_required or payload.expected_participants if item == "Computer Lab" else 1
        available = payload.lab_systems_available if item == "Computer Lab" else INVENTORY.get(item, 0)
        gap = max(0, required - available)
        rows.append({"item": item, "required": required, "available": available, "gap": gap, "status": "GAP" if gap else "AVAILABLE"})
    return rows


def _marketing(payload: TrainingProgramCreateRequest) -> dict[str, str]:
    date = payload.start_date.strftime("%d %b %Y") if payload.start_date else "Date to be announced"
    trainer = payload.trainer_name or "Faculty training team"
    return {
        "poster_content": f"{payload.title} | {date} | {payload.target_department} | Register on Lumina Intel.",
        "email_announcement": f"Subject: Registrations open — {payload.title}\n\nJoin {trainer} for training in {payload.target_skill}. Date: {date}.",
        "whatsapp_announcement": f"{payload.title} • {date} • {payload.target_skill} • Register through Lumina Intel.",
        "linkedin_caption": f"Registrations are open for {payload.title}, addressing measured gaps in {payload.target_skill}. #Training #SkillDevelopment",
        "registration_page_copy": f"Target cohort: {payload.target_cohort}, {payload.target_year}. Seats: {payload.expected_participants}.",
    }


def _response(program: TrainingProgram) -> TrainingProgramResponse:
    skills = list(program.target_skills or [])
    lab = next((row for row in program.infrastructure_requirements if row["item"] == "Computer Lab"), None)
    diagnostic = None if lab is None else {"required_systems": lab["required"], "available_systems": lab["available"], "capacity_gap": lab["gap"], "recommendation": "Use staggered lab batches or cloud workstations." if lab["gap"] else "Available capacity meets the stated requirement."}
    return TrainingProgramResponse(
        id=program.id, faculty_id=program.faculty_id, title=program.title, objective=program.objective,
        program_type=program.program_type, target_cohort=program.target_cohort, target_department=program.target_department,
        target_year=program.target_year, target_skill=", ".join(skills), target_skills=skills,
        expected_participants=program.expected_participants, prerequisites=program.prerequisites,
        trainer_type=program.trainer_type, trainer_name=program.trainer_name, trainer_organization=program.trainer_organization,
        expert_id=program.trainer_reference_id, infrastructure_requirements=[row["item"] for row in program.infrastructure_requirements],
        infrastructure_comparison=program.infrastructure_requirements, capacity_diagnostic=diagnostic,
        budget_breakdown=program.budget_breakdown, total_estimated_budget=float(program.total_estimated_budget),
        confirmed_funding=float(program.confirmed_funding), funding_gap=float(program.funding_gap), start_date=program.start_date,
        end_date=program.end_date, notice_period_days=program.notice_period_days, notice_status=cast(Literal["GOOD", "TIGHT", "CRITICAL"], program.notice_status),
        preparation_tasks=program.preparation_tasks, marketing_kit=program.marketing_kit, campaign_metrics=program.campaign_metrics,
        execution_metrics=program.execution_metrics, status=program.status,
        outcomes=[TrainingOutcomeResponse.model_validate(outcome) for outcome in program.outcomes or []],
        created_at=program.created_at, updated_at=program.updated_at,
    )


async def recommendations(session: AsyncSession, faculty_id: UUID) -> list[TrainingRecommendationResponse]:
    faculty = await session.get(Academician, faculty_id)
    if faculty is None:
        raise ValueError("Faculty account not found")
    institution = await session.scalar(select(Institution).where(Institution.institution_name == faculty.institution_name))
    query = select(InstitutionInterventionPlan).order_by(desc(InstitutionInterventionPlan.target_students_count), InstitutionInterventionPlan.skill_cluster)
    if institution:
        query = query.where(InstitutionInterventionPlan.institution_id == institution.id)
    plans = list((await session.scalars(query.limit(6))).all())
    if not plans:
        plans = list((await session.scalars(select(InstitutionInterventionPlan).order_by(InstitutionInterventionPlan.skill_cluster).limit(6))).all())
    faculty_skills = {item.casefold() for item in faculty.technical_skills}
    return [TrainingRecommendationResponse(
        title=plan.title,
        why_recommended=f"Persisted cohort analytics show {float(plan.baseline_supply_index):.0f}% readiness against a {float(plan.target_supply_index):.0f}% target for {plan.skill_cluster}; the deterministic gap is {max(0, float(plan.target_supply_index) - float(plan.baseline_supply_index)):.0f} points across {plan.target_students_count} students.",
        target_students=f"{plan.department} cohort", target_skill=plan.skill_cluster,
        gap_percentage=round(max(0, float(plan.target_supply_index) - float(plan.baseline_supply_index)), 1),
        suggested_duration_days=3, estimated_participants=max(1, plan.target_students_count),
        recommended_trainer=faculty.full_name if plan.skill_cluster.casefold() in faculty_skills else "Industry domain expert",
        recommended_trainer_org=faculty.institution_name if plan.skill_cluster.casefold() in faculty_skills else "Collaboration & Funding Hub",
        infrastructure_needed=["Computer Lab", "High-speed Internet", "Projector & Audio"], estimated_cost=45000,
        suggested_collaborators=["IEEE Computer Society", "ACM India", "Industry training partner"]
    ) for plan in plans]


async def create(session: AsyncSession, faculty_id: UUID, payload: TrainingProgramCreateRequest) -> TrainingProgramResponse:
    if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
        raise ValueError("end_date cannot be before start_date")
    tasks = [{"id": key, "title": title, "status": "pending"} for key, title in [("approval", "Institution approval"), ("trainer", "Trainer confirmation"), ("infrastructure", "Infrastructure readiness"), ("marketing", "Marketing launch"), ("registration", "Registration review")]]
    days, readiness = _notice(payload.start_date, tasks)
    total = round(sum(float(value) for value in payload.budget_breakdown.values()), 2)
    program = TrainingProgram(
        faculty_id=faculty_id, title=payload.title, objective=payload.objective, program_type=payload.program_type,
        target_cohort=payload.target_cohort, target_department=payload.target_department, target_year=payload.target_year,
        target_skills=_skills(payload.target_skill), expected_participants=payload.expected_participants,
        prerequisites=payload.prerequisites, trainer_type=payload.trainer_type, trainer_name=payload.trainer_name,
        trainer_organization=payload.trainer_organization, trainer_reference_id=payload.expert_id,
        infrastructure_requirements=_infrastructure(payload), budget_breakdown=payload.budget_breakdown,
        total_estimated_budget=total, confirmed_funding=payload.confirmed_funding, funding_gap=max(0, total - payload.confirmed_funding),
        start_date=payload.start_date, end_date=payload.end_date, notice_period_days=days, notice_status=readiness,
        preparation_tasks=tasks, marketing_kit=_marketing(payload),
        campaign_metrics={"emails_sent": 0, "whatsapp_recipients": 0, "linkedin_views": 0, "poster_scans": 0, "registrations": 0, "confirmed_participants": 0},
        execution_metrics={"registered_count": 0, "attended_count": 0, "completed_count": 0, "attendance_rate": 0, "average_feedback_rating": 0, "certificates_issued": 0}, status="planned")
    session.add(program)
    await session.commit()
    return await get(session, faculty_id, program.id)


async def get(session: AsyncSession, faculty_id: UUID, training_id: UUID) -> TrainingProgramResponse:
    program = await session.scalar(select(TrainingProgram).options(selectinload(TrainingProgram.outcomes)).where(TrainingProgram.id == training_id, TrainingProgram.faculty_id == faculty_id))
    if program is None:
        raise ValueError("Training program not found")
    return _response(program)


async def list_all(session: AsyncSession, faculty_id: UUID, status: str | None = None) -> TrainingProgramListResponse:
    query = select(TrainingProgram).options(selectinload(TrainingProgram.outcomes)).where(TrainingProgram.faculty_id == faculty_id)
    if status:
        query = query.where(TrainingProgram.status == status)
    programs = list((await session.scalars(query.order_by(desc(TrainingProgram.created_at)))).all())
    return TrainingProgramListResponse(total=len(programs), items=[_response(program) for program in programs])


async def update(session: AsyncSession, faculty_id: UUID, training_id: UUID, payload: TrainingProgramUpdateRequest) -> TrainingProgramResponse:
    program = await session.scalar(select(TrainingProgram).options(selectinload(TrainingProgram.outcomes)).where(TrainingProgram.id == training_id, TrainingProgram.faculty_id == faculty_id))
    if program is None:
        raise ValueError("Training program not found")
    if payload.status is not None:
        program.status = payload.status
    if payload.preparation_tasks is not None:
        program.preparation_tasks = payload.preparation_tasks
    if payload.confirmed_funding is not None:
        program.confirmed_funding = payload.confirmed_funding
        program.funding_gap = max(0, float(program.total_estimated_budget) - payload.confirmed_funding)
    if payload.campaign_metrics is not None:
        program.campaign_metrics = payload.campaign_metrics
    program.notice_period_days, program.notice_status = _notice(program.start_date, program.preparation_tasks)
    await session.commit()
    return await get(session, faculty_id, training_id)


async def record_outcomes(session: AsyncSession, faculty_id: UUID, training_id: UUID, payload: TrainingOutcomeCreateRequest) -> TrainingProgramResponse:
    program = await session.scalar(select(TrainingProgram).options(selectinload(TrainingProgram.outcomes)).where(TrainingProgram.id == training_id, TrainingProgram.faculty_id == faculty_id))
    if program is None:
        raise ValueError("Training program not found")
    registered = payload.registered_count if payload.registered_count is not None else max(payload.attendance_count, int(program.execution_metrics.get("registered_count", 0)))
    completed = payload.completion_count if payload.completion_count is not None else payload.attendance_count
    if payload.attendance_count > registered or completed > payload.attendance_count:
        raise ValueError("completion must not exceed attendance, and attendance must not exceed registrations")
    session.add(TrainingOutcomeMetric(training_id=program.id, skill_name=payload.skill_name, cohort_name=payload.cohort_name,
        pre_readiness_score=payload.pre_score, post_readiness_score=payload.post_score,
        improvement_percentage=round(payload.post_score - payload.pre_score, 2), attendance_count=payload.attendance_count,
        feedback_rating=payload.feedback_rating, evidence_records_created=0))
    program.execution_metrics = {"registered_count": registered, "attended_count": payload.attendance_count,
        "completed_count": completed, "attendance_rate": round(payload.attendance_count / registered * 100, 1) if registered else 0,
        "average_feedback_rating": payload.feedback_rating, "certificates_issued": completed}
    program.status = "completed"
    await session.commit()
    session.expire(program, ["outcomes"])
    return await get(session, faculty_id, training_id)
