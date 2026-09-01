"""Institutional Analytics & Employability Intelligence Service.

Aggregates university-wide skill distributions, department metrics,
curriculum-to-market alignment, cohort monitoring, intervention planning,
and faculty-industry engagement without exposing individual PII.
"""
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models import (
    Academician,
    Application,
    ApplicationTrackingStatus,
    AssessmentAttempt,
    CollaborationWorkspace,
    CourseEnrollment,
    FacultyApplication,
    Institution,
    InstitutionActionPlan,
    InstitutionInterventionPlan,
    InternshipEngagement,
    LearningCourse,
    PlacementRegistration,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    ActionPlanCreate,
    ActionPlanResponse,
    ActionPlanUpdate,
    AtRiskCohortGroup,
    AtRiskCohortSummary,
    CohortAnalyticsResponse,
    CohortSummaryItem,
    CollaborationRelationshipItem,
    CollaborationRelationshipsResponse,
    CourseEffectivenessMetric,
    CurriculumRecommendationItem,
    DepartmentDetailAnalytics,
    DepartmentMetric,
    FacultyEngagementOverview,
    IndustryPartnerDetail,
    IndustryPartnershipOverview,
    IndustryPartnerSummary,
    InstitutionAlertItem,
    InstitutionAlertsResponse,
    InstitutionAnalyticsOverview,
    InstitutionReportResponse,
    InstitutionSkillDistribution,
    InternshipMonitoringOverview,
    InterventionPlanCreate,
    InterventionPlanResponse,
    InterventionPlanUpdate,
    InterventionRecommendation,
    LearningEffectivenessOverview,
    PlacementMonitoringOverview,
)
from app.services.demand_supply_service import institution_demand_supply_analytics


async def _institution_student_scope(
    session: AsyncSession, institution_id: UUID
) -> tuple[Institution, ColumnElement[bool]]:
    institution = await session.get(Institution, institution_id)
    if institution is None:
        raise ValueError("Institution not found")
    scope = Student.institution_id == institution.id
    return institution, scope


_TIER_MULTIPLIER = {
    VerificationTier.verified: 1.0,
    VerificationTier.partially_verified: 0.85,
    VerificationTier.unverified: 0.65,
}


def _percentage(numerator: int, denominator: int) -> float:
    return round(100.0 * numerator / denominator, 1) if denominator else 0.0


async def _scoped_students(
    session: AsyncSession,
    institution_id: UUID | None,
    *,
    department: str | None = None,
) -> list[Student]:
    statement = select(Student)
    if institution_id is not None:
        statement = statement.where(Student.institution_id == institution_id)
    if department and department.casefold() != "all":
        statement = statement.where(func.lower(Student.department) == department.casefold())
    return list((await session.scalars(statement)).all())


async def _student_readiness(
    session: AsyncSession, student_ids: list[UUID]
) -> dict[UUID, float]:
    if not student_ids:
        return {}
    rows = (
        await session.scalars(
            select(StudentSkill).where(StudentSkill.student_id.in_(student_ids))
        )
    ).all()
    totals: dict[UUID, list[float]] = {}
    for row in rows:
        effective = float(row.extraction_confidence) * _TIER_MULTIPLIER[
            row.verification_tier
        ]
        totals.setdefault(row.student_id, []).append(effective)
    return {
        student_id: round(100.0 * sum(values) / len(values), 1)
        for student_id, values in totals.items()
        if values
    }


async def get_institution_analytics(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> InstitutionAnalyticsOverview:
    inst: Institution | None = None
    inst_name = "All institutions"
    student_scope: ColumnElement[bool] | None = None
    if institution_id:
        inst, student_scope = await _institution_student_scope(session, institution_id)
        inst_name = inst.institution_name

    student_count_stmt = select(func.count(Student.id))
    if student_scope is not None:
        student_count_stmt = student_count_stmt.where(student_scope)
    total_students = (await session.scalar(student_count_stmt)) or 0

    verified_students_stmt = (
        select(func.count(StudentSkill.student_id.distinct()))
        .join(Student, Student.id == StudentSkill.student_id)
        .where(StudentSkill.verification_tier == VerificationTier.verified)
    )
    if student_scope is not None:
        verified_students_stmt = verified_students_stmt.where(student_scope)
    verified_students = (await session.scalar(verified_students_stmt)) or 0

    verified_skills_stmt = (
        select(func.count(StudentSkill.id))
        .join(Student, Student.id == StudentSkill.student_id)
        .where(StudentSkill.verification_tier == VerificationTier.verified)
    )
    if student_scope is not None:
        verified_skills_stmt = verified_skills_stmt.where(student_scope)
    total_verified = (
        await session.scalar(verified_skills_stmt)
    ) or 0

    active_internships_stmt = (
        select(func.count(Application.id))
        .join(Student, Student.id == Application.student_id)
        .where(
            Application.tracking_status.in_([
                ApplicationTrackingStatus.interview,
                ApplicationTrackingStatus.offer,
                ApplicationTrackingStatus.hired,
            ])
        )
    )
    if student_scope is not None:
        active_internships_stmt = active_internships_stmt.where(student_scope)
    active_internships = (await session.scalar(active_internships_stmt)) or 0

    placements_stmt = (
        select(func.count(PlacementRegistration.id))
        .join(Student, Student.id == PlacementRegistration.student_id)
        .where(PlacementRegistration.status.in_(["offered", "shortlisted", "accepted"]))
    )
    if student_scope is not None:
        placements_stmt = placements_stmt.where(student_scope)
    placements_count = (await session.scalar(placements_stmt)) or 0

    skill_dist_stmt = (
        select(
            Skill.canonical_name,
            func.count(StudentSkill.student_id.distinct()).label("student_count"),
            func.avg(StudentSkill.extraction_confidence).label("avg_conf"),
            func.sum(
                case((StudentSkill.verification_tier == VerificationTier.verified, 1), else_=0)
            ).label("verified_count"),
            func.count(StudentSkill.id).label("skill_count"),
        )
        .join(Skill, StudentSkill.skill_id == Skill.id)
        .join(Student, Student.id == StudentSkill.student_id)
        .group_by(Skill.canonical_name)
        .order_by(func.count(StudentSkill.student_id.distinct()).desc())
        .limit(8)
    )
    if student_scope is not None:
        skill_dist_stmt = skill_dist_stmt.where(student_scope)
    skill_rows = (await session.execute(skill_dist_stmt)).all()

    top_skills: list[InstitutionSkillDistribution] = [
        InstitutionSkillDistribution(
            skill_name=row[0],
            student_count=int(row[1]),
            average_proficiency=round(float(row[2] or 0.0), 2),
            verified_ratio=round(float(row[3] or 0) / max(int(row[4] or 0), 1), 2),
        )
        for row in skill_rows
    ]

    students = await _scoped_students(session, institution_id)
    students_by_department: dict[str, list[Student]] = {}
    for student in students:
        students_by_department.setdefault(student.department or "Unassigned", []).append(
            student
        )
    verified_by_student: dict[UUID, int] = {}
    if students:
        verified_by_student = {
            student_id: int(count)
            for student_id, count in (
                await session.execute(
                select(StudentSkill.student_id, func.count(StudentSkill.id))
                .where(
                    StudentSkill.student_id.in_([student.id for student in students]),
                    StudentSkill.verification_tier == VerificationTier.verified,
                )
                .group_by(StudentSkill.student_id)
            )
            ).all()
        }
    dept_metrics: list[DepartmentMetric] = []
    for department, department_students in sorted(students_by_department.items()):
        department_ids = {student.id for student in department_students}
        department_placements = (
            await session.scalar(
                select(func.count(PlacementRegistration.id)).where(
                    PlacementRegistration.student_id.in_(department_ids),
                    PlacementRegistration.status.in_(["offered", "accepted", "hired"]),
                )
            )
        ) or 0
        department_internships = (
            await session.scalar(
                select(func.count(InternshipEngagement.id)).where(
                    InternshipEngagement.student_id.in_(department_ids),
                    InternshipEngagement.status.in_(["selected", "active", "completed"]),
                )
            )
        ) or 0
        dept_metrics.append(
            DepartmentMetric(
                department=department,
                total_students=len(department_students),
                verified_skills_average=round(
                    sum(verified_by_student.get(student_id, 0) for student_id in department_ids)
                    / len(department_students),
                    1,
                ),
                placement_rate=_percentage(int(department_placements), len(department_students)),
                internship_rate=_percentage(int(department_internships), len(department_students)),
            )
        )

    market_gaps: list[dict[str, str | int]] = []
    if institution_id is not None:
        demand_supply = await institution_demand_supply_analytics(
            session, institution_id
        )
        market_gaps = [
            {
                "skill": row.skill_name,
                "industry_demand_index": row.industry_demand,
                "student_supply_index": row.qualified_supply,
                "gap_severity": row.classification.title(),
            }
            for row in demand_supply.skills
        ]

    eff_total_students = int(total_students)
    eff_verified_skills = int(total_verified)
    eff_active_internships = int(active_internships)
    eff_placements = int(placements_count)
    eff_employability = _percentage(int(verified_students), int(total_students))

    return InstitutionAnalyticsOverview(
        institution_name=inst_name,
        total_students=eff_total_students,
        total_verified_skills=eff_verified_skills,
        active_internships=eff_active_internships,
        placements_secured=eff_placements,
        overall_employability_index=eff_employability,
        department_metrics=dept_metrics,
        top_skills_distribution=top_skills[:8],
        market_skill_demand_gaps=market_gaps,
    )


async def get_department_detail(
    session: AsyncSession,
    department_name: str,
    institution_id: UUID | None = None,
) -> DepartmentDetailAnalytics:
    dept_clean = department_name.strip()
    students = await _scoped_students(
        session, institution_id, department=dept_clean
    )
    student_ids = [student.id for student in students]
    total = len(students)
    skill_rows: list[tuple[str, int, float, int]] = []
    if student_ids:
        result_rows = (
            await session.execute(
                select(
                    Skill.canonical_name,
                    func.count(StudentSkill.student_id.distinct()),
                    func.avg(StudentSkill.extraction_confidence),
                    func.sum(
                        case(
                            (
                                StudentSkill.verification_tier
                                == VerificationTier.verified,
                                1,
                            ),
                            else_=0,
                        )
                    ),
                )
                .join(Skill, Skill.id == StudentSkill.skill_id)
                .where(StudentSkill.student_id.in_(student_ids))
                .group_by(Skill.id, Skill.canonical_name)
                .order_by(func.count(StudentSkill.student_id.distinct()).desc())
                .limit(10)
            )
        ).all()
        skill_rows = [
            (
                str(row[0]),
                int(row[1]),
                float(row[2] or 0.0),
                int(row[3] or 0),
            )
            for row in result_rows
        ]
    top_skills = [
        {
            "skill": name,
            "students": int(count),
            "avg_proficiency": round(float(confidence or 0.0), 2),
            "verified_evidence": int(verified_count or 0),
        }
        for name, count, confidence, verified_count in skill_rows
    ]
    verified_skill_count = sum(row[3] for row in skill_rows)
    assessed_students = 0
    if student_ids:
        assessed_students = int(
            (
                await session.scalar(
                    select(func.count(AssessmentAttempt.student_id.distinct())).where(
                        AssessmentAttempt.student_id.in_(student_ids)
                    )
                )
            )
            or 0
        )
    readiness = await _student_readiness(session, student_ids)
    average_readiness = (
        round(sum(readiness.values()) / len(readiness), 1) if readiness else 0.0
    )
    engagements = (
        list(
            (
                await session.scalars(
                    select(InternshipEngagement).where(
                        InternshipEngagement.student_id.in_(student_ids)
                    )
                )
            ).all()
        )
        if student_ids
        else []
    )
    placements = (
        list(
            (
                await session.scalars(
                    select(PlacementRegistration).where(
                        PlacementRegistration.student_id.in_(student_ids)
                    )
                )
            ).all()
        )
        if student_ids
        else []
    )
    active_apps = int(
        (
            await session.scalar(
                select(func.count(Application.id)).where(
                    Application.student_id.in_(student_ids)
                )
            )
        )
        or 0
    ) if student_ids else 0
    demand_rows = []
    if institution_id is not None:
        demand_rows = (
            await institution_demand_supply_analytics(
                session, institution_id, department=dept_clean
            )
        ).skills
    gap_rows = [row for row in demand_rows if row.classification == "shortage"]
    tech_gaps = [
        {
            "skill": row.skill_name,
            "industry_demand": row.industry_demand,
            "student_supply": row.qualified_supply,
            "gap_severity": "Critical" if row.gap >= 3 else "High",
            "affected_students": max(0, total - row.qualified_supply),
        }
        for row in gap_rows
    ]
    curriculum_radar = [
        {
            "skill": row.skill_name,
            "curriculum_coverage": row.qualified_supply,
            "industry_demand": row.industry_demand,
            "source": "persisted opportunity requirements and evidence-backed skills",
        }
        for row in demand_rows
    ]
    enrollments = (
        list(
            (
                await session.scalars(
                    select(CourseEnrollment).where(
                        CourseEnrollment.student_id.in_(student_ids)
                    )
                )
            ).all()
        )
        if student_ids
        else []
    )
    completed_enrollments = sum(
        enrollment.status == "completed" for enrollment in enrollments
    )
    learning = {
        "enrolled_students": len({row.student_id for row in enrollments}),
        "completed_students": len(
            {row.student_id for row in enrollments if row.status == "completed"}
        ),
        "completion_rate": _percentage(completed_enrollments, len(enrollments)),
        "active_programs": len({row.course_id for row in enrollments}),
    }
    faculty_eng = {
        "active_faculty": 0,
        "research_grants_count": 0,
        "total_grant_value": 0.0,
        "industry_fdps": 0,
        "available": False,
        "reason": "no durable department-linked faculty records",
    }
    actions = [
        f"Review training options for {row.skill_name}: persisted demand "
        f"{row.industry_demand}, qualified supply {row.qualified_supply}."
        for row in gap_rows[:3]
    ]

    return DepartmentDetailAnalytics(
        department=dept_clean,
        total_students=total,
        verified_skills_average=round(verified_skill_count / total, 1) if total else 0.0,
        assessment_completion_rate=_percentage(assessed_students, total),
        average_readiness=average_readiness,
        internship_participation_rate=_percentage(
            len({row.student_id for row in engagements}), total
        ),
        internship_completion_rate=_percentage(
            sum(row.status == "completed" for row in engagements), len(engagements)
        ),
        placement_eligibility_rate=_percentage(len(placements), total),
        placement_conversion_rate=_percentage(
            sum(row.status in {"offered", "accepted", "hired"} for row in placements),
            len(placements),
        ),
        active_applications=active_apps,
        top_verified_skills=top_skills,
        top_technical_gaps=tech_gaps,
        top_soft_skill_gaps=[],
        curriculum_vs_industry_demand=curriculum_radar,
        learning_participation=learning,
        faculty_industry_engagement=faculty_eng,
        recommended_actions=actions,
    )


async def get_cohort_analytics(
    session: AsyncSession,
    department: str | None = None,
    graduation_year: str | None = None,
    readiness_band: str | None = None,
    internship_status: str | None = None,
    placement_status: str | None = None,
    institution_id: UUID | None = None,
) -> CohortAnalyticsResponse:
    students = await _scoped_students(session, institution_id)
    student_ids = [student.id for student in students]
    readiness = await _student_readiness(session, student_ids)
    verified_counts: dict[UUID, int] = {}
    assessed: set[UUID] = set()
    internship_students: set[UUID] = set()
    placement_students: set[UUID] = set()
    placed_students: set[UUID] = set()
    learning_students: set[UUID] = set()
    if student_ids:
        verified_counts = {
            student_id: int(count)
            for student_id, count in (
                await session.execute(
                    select(StudentSkill.student_id, func.count(StudentSkill.id))
                    .where(
                        StudentSkill.student_id.in_(student_ids),
                        StudentSkill.verification_tier == VerificationTier.verified,
                    )
                    .group_by(StudentSkill.student_id)
                )
            ).all()
        }
        assessed = set(
            (
                await session.scalars(
                    select(AssessmentAttempt.student_id)
                    .where(AssessmentAttempt.student_id.in_(student_ids))
                    .distinct()
                )
            ).all()
        )
        internship_students = set(
            (
                await session.scalars(
                    select(InternshipEngagement.student_id)
                    .where(InternshipEngagement.student_id.in_(student_ids))
                    .distinct()
                )
            ).all()
        )
        registrations = list(
            (
                await session.scalars(
                    select(PlacementRegistration).where(
                        PlacementRegistration.student_id.in_(student_ids)
                    )
                )
            ).all()
        )
        placement_students = {row.student_id for row in registrations}
        placed_students = {
            row.student_id
            for row in registrations
            if row.status in {"offered", "accepted", "hired"}
        }
        learning_students = set(
            (
                await session.scalars(
                    select(CourseEnrollment.student_id)
                    .where(CourseEnrollment.student_id.in_(student_ids))
                    .distinct()
                )
            ).all()
        )
    grouped: dict[tuple[str, int], list[Student]] = {}
    for student in students:
        year = student.cohort_year or student.graduation_year or datetime.now(UTC).year
        grouped.setdefault((student.department or "Unassigned", year), []).append(student)
    filtered: list[CohortSummaryItem] = []
    for (department_name, year), cohort_students in sorted(grouped.items()):
        cohort_ids = {student.id for student in cohort_students}
        total = len(cohort_students)
        cohort_readiness = [readiness[item] for item in cohort_ids if item in readiness]
        average_readiness = (
            round(sum(cohort_readiness) / len(cohort_readiness), 1)
            if cohort_readiness
            else 0.0
        )
        if average_readiness >= 80:
            band = "High Readiness (>=80%)"
        elif average_readiness >= 50:
            band = "Moderate Readiness (50-79%)"
        else:
            band = "Low Readiness (<50%)"
        filtered.append(
            CohortSummaryItem(
                cohort_id=f"{institution_id or 'all'}-{department_name}-{year}",
                cohort_name=f"{department_name} ({year})",
                department=department_name,
                graduation_year=year,
                readiness_band=band,
                total_students=total,
                average_readiness=average_readiness,
                assessment_completion_pct=_percentage(len(cohort_ids & assessed), total),
                verified_skills_average=round(
                    sum(verified_counts.get(item, 0) for item in cohort_ids) / total,
                    1,
                ),
                internship_participation_pct=_percentage(
                    len(cohort_ids & internship_students), total
                ),
                placement_eligibility_pct=_percentage(
                    len(cohort_ids & placement_students), total
                ),
                placement_conversion_pct=_percentage(
                    len(cohort_ids & placed_students), total
                ),
                active_learning_enrollment=len(cohort_ids & learning_students),
                critical_skill_gaps=[],
            )
        )
    if department and department.lower() != "all":
        d_lower = department.lower()
        filtered = [
            c for c in filtered
            if d_lower in c.department.lower()
            or d_lower in c.cohort_name.lower()
            or ("cse" in d_lower and "computer" in c.department.lower())
            or ("it" in d_lower and "information" in c.department.lower())
            or ("ece" in d_lower and "electronics" in c.department.lower())
            or ("mech" in d_lower and "mechanical" in c.department.lower())
        ]
    if graduation_year and graduation_year.lower() != "all":
        filtered = [c for c in filtered if str(c.graduation_year) == str(graduation_year)]
    if readiness_band and readiness_band.lower() != "all":
        if "high" in readiness_band.lower():
            filtered = [c for c in filtered if c.average_readiness >= 80]
        elif "mod" in readiness_band.lower():
            filtered = [c for c in filtered if 50 <= c.average_readiness < 80]
        elif "low" in readiness_band.lower():
            filtered = [c for c in filtered if c.average_readiness < 50]

    total_monitored = sum(c.total_students for c in filtered)
    return CohortAnalyticsResponse(
        total_cohorts=len(filtered),
        total_students_monitored=total_monitored,
        cohorts=filtered,
    )


async def get_intervention_recommendations(
    session: AsyncSession, institution_id: UUID | None = None
) -> list[InterventionRecommendation]:
    if institution_id is None:
        return []
    analytics = await institution_demand_supply_analytics(session, institution_id)
    departments = analytics.available_departments or ["All Departments"]
    recommendations: list[InterventionRecommendation] = []
    for row in analytics.skills:
        if row.classification != "shortage":
            continue
        recommendations.append(
            InterventionRecommendation(
                skill=row.skill_name,
                skill_cluster=row.skill_name,
                industry_demand_index=float(row.industry_demand),
                student_supply_index=float(row.qualified_supply),
                gap_severity="Critical" if row.gap >= 3 else "High",
                affected_student_count=max(
                    0, analytics.assigned_students - row.qualified_supply
                ),
                affected_departments=departments,
                recommended_courses=[
                    {
                        "title": f"{row.skill_name} evidence-building program",
                        "source": "persisted demand-supply shortage",
                        "demand_count": row.industry_demand,
                        "qualified_supply": row.qualified_supply,
                    }
                ],
                recommended_workshops=[],
                recommended_mentorship=[],
            )
        )
    return recommendations


async def list_intervention_plans(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> list[InterventionPlanResponse]:
    stmt = select(InstitutionInterventionPlan).order_by(InstitutionInterventionPlan.created_at.desc())
    if institution_id:
        stmt = stmt.where(InstitutionInterventionPlan.institution_id == institution_id)
    plans = (await session.scalars(stmt)).all()

    return [
        InterventionPlanResponse(
            id=p.id,
            institution_id=p.institution_id,
            title=p.title,
            skill_cluster=p.skill_cluster,
            department=p.department,
            target_students_count=p.target_students_count,
            baseline_supply_index=float(p.baseline_supply_index),
            target_supply_index=float(p.target_supply_index),
            selected_learning_programs=p.selected_learning_programs or [],
            selected_workshops=p.selected_workshops or [],
            selected_mentorship=p.selected_mentorship or [],
            start_date=p.start_date,
            target_date=p.target_date,
            status=p.status,
            notes=p.notes,
            created_at=p.created_at,
            updated_at=p.created_at,
        )
        for p in plans
    ]


async def create_intervention_plan(
    session: AsyncSession,
    payload: InterventionPlanCreate,
    institution_id: UUID | None = None,
) -> InterventionPlanResponse:
    plan = InstitutionInterventionPlan(
        institution_id=institution_id,
        title=payload.title,
        skill_cluster=payload.skill_cluster,
        department=payload.department,
        target_students_count=payload.target_students_count,
        baseline_supply_index=payload.baseline_supply_index,
        target_supply_index=payload.target_supply_index,
        selected_learning_programs=payload.selected_learning_programs,
        selected_workshops=payload.selected_workshops,
        selected_mentorship=payload.selected_mentorship,
        start_date=payload.start_date,
        target_date=payload.target_date,
        status=payload.status,
        notes=payload.notes,
    )
    session.add(plan)
    await session.commit()
    await session.refresh(plan)

    return InterventionPlanResponse(
        id=plan.id,
        institution_id=plan.institution_id,
        title=plan.title,
        skill_cluster=plan.skill_cluster,
        department=plan.department,
        target_students_count=plan.target_students_count,
        baseline_supply_index=float(plan.baseline_supply_index),
        target_supply_index=float(plan.target_supply_index),
        selected_learning_programs=plan.selected_learning_programs or [],
        selected_workshops=plan.selected_workshops or [],
        selected_mentorship=plan.selected_mentorship or [],
        start_date=plan.start_date,
        target_date=plan.target_date,
        status=plan.status,
        notes=plan.notes,
        created_at=plan.created_at,
        updated_at=plan.created_at,
    )


async def update_intervention_plan(
    session: AsyncSession,
    plan_id: UUID,
    payload: InterventionPlanUpdate,
    institution_id: UUID | None = None,
) -> InterventionPlanResponse | None:
    plan = await session.get(InstitutionInterventionPlan, plan_id)
    if not plan or (
        institution_id is not None and plan.institution_id != institution_id
    ):
        return None

    if payload.title is not None:
        plan.title = payload.title
    if payload.target_students_count is not None:
        plan.target_students_count = payload.target_students_count
    if payload.target_supply_index is not None:
        plan.target_supply_index = payload.target_supply_index
    if payload.selected_learning_programs is not None:
        plan.selected_learning_programs = payload.selected_learning_programs
    if payload.selected_workshops is not None:
        plan.selected_workshops = payload.selected_workshops
    if payload.selected_mentorship is not None:
        plan.selected_mentorship = payload.selected_mentorship
    if payload.start_date is not None:
        plan.start_date = payload.start_date
    if payload.target_date is not None:
        plan.target_date = payload.target_date
    if payload.status is not None:
        plan.status = payload.status
    if payload.notes is not None:
        plan.notes = payload.notes

    await session.commit()
    await session.refresh(plan)

    return InterventionPlanResponse(
        id=plan.id,
        institution_id=plan.institution_id,
        title=plan.title,
        skill_cluster=plan.skill_cluster,
        department=plan.department,
        target_students_count=plan.target_students_count,
        baseline_supply_index=float(plan.baseline_supply_index),
        target_supply_index=float(plan.target_supply_index),
        selected_learning_programs=plan.selected_learning_programs or [],
        selected_workshops=plan.selected_workshops or [],
        selected_mentorship=plan.selected_mentorship or [],
        start_date=plan.start_date,
        target_date=plan.target_date,
        status=plan.status,
        notes=plan.notes,
        created_at=plan.created_at,
        updated_at=plan.created_at,
    )


async def delete_intervention_plan(
    session: AsyncSession,
    plan_id: UUID,
    institution_id: UUID | None = None,
) -> bool:
    plan = await session.get(InstitutionInterventionPlan, plan_id)
    if not plan or (
        institution_id is not None and plan.institution_id != institution_id
    ):
        return False
    await session.delete(plan)
    await session.commit()
    return True


async def get_internship_monitoring(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> InternshipMonitoringOverview:
    students = await _scoped_students(session, institution_id)
    student_ids = [student.id for student in students]
    engagements = (
        list(
            (
                await session.scalars(
                    select(InternshipEngagement).where(
                        InternshipEngagement.student_id.in_(student_ids)
                    )
                )
            ).all()
        )
        if student_ids
        else []
    )
    active = [row for row in engagements if row.status in {"selected", "active"}]
    completed = [row for row in engagements if row.status == "completed"]
    selected = [
        row
        for row in engagements
        if row.status in {"selected", "active", "completed"}
    ]
    by_department: list[dict[str, int | float | str]] = []
    for department in sorted({student.department or "Unassigned" for student in students}):
        department_ids = {
            student.id
            for student in students
            if (student.department or "Unassigned") == department
        }
        department_active = sum(row.student_id in department_ids for row in active)
        department_completed = sum(row.student_id in department_ids for row in completed)
        by_department.append(
            {
                "department": department,
                "eligible": len(department_ids),
                "active": department_active,
                "completed": department_completed,
                "rate": _percentage(
                    len(
                        {
                            row.student_id
                            for row in engagements
                            if row.student_id in department_ids
                        }
                    ),
                    len(department_ids),
                ),
            }
        )
    return InternshipMonitoringOverview(
        eligible_students=len(students),
        applicants=len(engagements),
        selected_students=len({row.student_id for row in selected}),
        active_internships=len(active),
        completed_internships=len(completed),
        completion_rate=_percentage(len(completed), len(selected)),
        mentor_feedback_completion_rate=_percentage(
            sum(row.mentor_feedback is not None for row in completed), len(completed)
        ),
        ppo_conversions=0,
        ppo_conversion_rate=0.0,
        by_department=by_department,
        by_graduation_year=[],
        by_opportunity_type=[],
        by_industry=[],
        by_skill_cluster=[],
    )


async def get_placement_monitoring(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> PlacementMonitoringOverview:
    students = await _scoped_students(session, institution_id)
    student_ids = [student.id for student in students]
    registrations = (
        list(
            (
                await session.scalars(
                    select(PlacementRegistration).where(
                        PlacementRegistration.student_id.in_(student_ids)
                    )
                )
            ).all()
        )
        if student_ids
        else []
    )
    readiness = await _student_readiness(session, student_ids)
    placed = [
        row for row in registrations if row.status in {"offered", "accepted", "hired"}
    ]
    return PlacementMonitoringOverview(
        eligible_students=len(students),
        applications=len(registrations),
        shortlisted=sum(row.status == "shortlisted" for row in registrations),
        interviews_scheduled=sum(
            row.status in {"interview", "interview_scheduled", "interviewed"}
            for row in registrations
        ),
        offers_extended=sum(row.status == "offered" for row in registrations),
        placements_secured=len(placed),
        conversion_rate=_percentage(len(placed), len(registrations)),
        average_readiness=(
            round(sum(readiness.values()) / len(readiness), 1) if readiness else 0.0
        ),
        average_compatibility=(
            round(
                sum(float(row.match_score) for row in registrations)
                / len(registrations),
                2,
            )
            if registrations
            else 0.0
        ),
        top_placement_skill_gaps=[],
        top_recruiting_skill_demand=[],
        by_department=[],
        by_role=[],
        by_company=[],
        by_graduation_year=[],
    )


async def get_faculty_engagement_analytics(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> FacultyEngagementOverview:
    institution = await session.get(Institution, institution_id) if institution_id else None
    statement = select(Academician)
    if institution is not None:
        statement = statement.where(
            func.lower(Academician.institution_name)
            == institution.institution_name.casefold()
        )
    faculty = list((await session.scalars(statement)).all())
    faculty_ids = [item.id for item in faculty]
    applications = (
        list(
            (
                await session.scalars(
                    select(FacultyApplication).where(
                        FacultyApplication.faculty_id.in_(faculty_ids)
                    )
                )
            ).all()
        )
        if faculty_ids
        else []
    )
    workspaces = (
        list(
            (
                await session.scalars(
                    select(CollaborationWorkspace).where(
                        CollaborationWorkspace.faculty_lead_id.in_(faculty_ids)
                    )
                )
            ).all()
        )
        if faculty_ids
        else []
    )
    department_counts: dict[str, int] = {}
    for item in faculty:
        department_counts[item.department] = department_counts.get(item.department, 0) + 1
    return FacultyEngagementOverview(
        total_participating_faculty=len(faculty),
        active_faculty_internships=sum(
            row.application_type == "faculty_internship" and row.status in {"accepted", "active"}
            for row in applications
        ),
        active_industrial_training=sum(
            row.application_type in {"industrial_training", "industrial_immersion"}
            and row.status in {"accepted", "active"}
            for row in applications
        ),
        active_fdps=sum(
            row.application_type == "fdp" and row.status in {"accepted", "active"}
            for row in applications
        ),
        research_collaborations=sum(
            row.collaboration_type == "research_collaboration" for row in workspaces
        ),
        consultancy_projects=sum(
            row.collaboration_type == "consultancy" for row in workspaces
        ),
        workshops_guest_lectures=0,
        total_research_grant_value=0.0,
        active_industry_partners_count=len(
            {row.organization_name for row in workspaces if row.status == "active"}
        ),
        by_department=[
            {
                "department": department,
                "faculty_count": count,
                "grants_value": 0.0,
                "fdps": sum(
                    row.application_type == "fdp"
                    and row.faculty_id in {item.id for item in faculty if item.department == department}
                    for row in applications
                ),
            }
            for department, count in sorted(department_counts.items())
        ],
        by_opportunity_type=[],
        by_industry_partner=[],
        by_status=[],
    )


async def get_curriculum_recommendations(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> list[CurriculumRecommendationItem]:
    if institution_id is None:
        return []
    analytics = await institution_demand_supply_analytics(session, institution_id)
    return [
        CurriculumRecommendationItem(
            id=f"persisted-gap-{row.skill_id}",
            skill_area=row.skill_name,
            industry_demand_index=float(row.industry_demand),
            student_supply_index=float(row.qualified_supply),
            gap_size=float(max(0, row.gap)),
            gap_severity="Critical" if row.gap >= 3 else "High",
            departments_affected=analytics.available_departments or ["All Departments"],
            recommended_modules=[f"Evidence-building module for {row.skill_name}"],
            suggested_labs=[],
            bootcamp_tracks=[],
            linked_intervention_id=None,
        )
        for row in analytics.skills
        if row.classification == "shortage"
    ]


async def get_industry_partnerships(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> IndustryPartnershipOverview:
    relationships = await get_collaboration_relationships(session, institution_id)
    grouped: dict[str, list[CollaborationRelationshipItem]] = {}
    for relationship in relationships.relationships:
        grouped.setdefault(relationship.industry_partner, []).append(relationship)
    partners = [
        IndustryPartnerSummary(
            partner_name=name,
            domain="Persisted collaboration",
            partner_types=sorted({row.initiative_type for row in items}),
            internships_posted=0,
            students_selected=0,
            placements_offered=0,
            learning_programs_count=0,
            faculty_engagements_count=len(items),
            research_collaborations_count=sum(
                row.initiative_type == "research_collaboration" for row in items
            ),
            status=(
                "Active"
                if any(row.status.casefold() == "active" for row in items)
                else "Recorded"
            ),
        )
        for name, items in sorted(grouped.items())
    ]
    return IndustryPartnershipOverview(
        total_partners=len(partners),
        internship_partners=sum(
            "faculty_internship" in row.partner_types for row in partners
        ),
        placement_partners=0,
        training_partners=0,
        research_partners=sum(
            "research_collaboration" in row.partner_types for row in partners
        ),
        mentorship_partners=sum(
            "mentorship" in row.partner_types for row in partners
        ),
        partners=partners,
    )


async def get_industry_partner_detail(
    session: AsyncSession,
    partner_name: str,
    institution_id: UUID | None = None,
) -> IndustryPartnerDetail:
    clean_name = partner_name.strip()
    relationships = await get_collaboration_relationships(session, institution_id)
    partner_rows = [
        row
        for row in relationships.relationships
        if row.industry_partner.casefold() == clean_name.casefold()
    ]
    return IndustryPartnerDetail(
        partner_name=clean_name,
        domain="Persisted collaboration" if partner_rows else "Not available",
        partner_overview=(
            f"{len(partner_rows)} persisted institution-linked collaboration record(s)."
            if partner_rows
            else "No persisted institution-linked partnership data is available."
        ),
        student_engagements=[],
        faculty_engagements=[
            {
                "faculty": row.faculty_lead,
                "department": row.faculty_department,
                "role": row.initiative_type,
                "status": row.status,
            }
            for row in partner_rows
        ],
        posted_opportunities=[],
        placement_drives=[],
        research_and_consultancy=[],
        outcome_metrics={
            "available": bool(partner_rows),
            "persisted_collaborations": len(partner_rows),
        },
    )


async def get_learning_effectiveness(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> LearningEffectivenessOverview:
    students = await _scoped_students(session, institution_id)
    student_ids = [student.id for student in students]
    rows = (
        (
            await session.execute(
                select(CourseEnrollment, LearningCourse, Student)
                .join(LearningCourse, LearningCourse.id == CourseEnrollment.course_id)
                .join(Student, Student.id == CourseEnrollment.student_id)
                .where(CourseEnrollment.student_id.in_(student_ids))
            )
        ).all()
        if student_ids
        else []
    )
    grouped: dict[UUID, list[tuple[CourseEnrollment, Student]]] = {}
    course_by_id: dict[UUID, LearningCourse] = {}
    for enrollment, course, student in rows:
        grouped.setdefault(course.id, []).append((enrollment, student))
        course_by_id[course.id] = course
    courses: list[CourseEffectivenessMetric] = []
    for course_id, enrollments in grouped.items():
        course = course_by_id[course_id]
        completed = sum(item.status == "completed" for item, _student in enrollments)
        department_counts: dict[str, int] = {}
        for _item, student in enrollments:
            name = student.department or "Unassigned"
            department_counts[name] = department_counts.get(name, 0) + 1
        courses.append(
            CourseEffectivenessMetric(
                course_id=str(course.id),
                title=course.title,
                category=course.category,
                provider=course.provider,
                enrolled_count=len(enrollments),
                completed_count=completed,
                completion_rate=_percentage(completed, len(enrollments)),
                targeted_skills=course.skills or [],
                baseline_readiness_avg=0.0,
                post_completion_readiness_avg=0.0,
                readiness_gain=0.0,
                placement_correlation_rate=0.0,
                department_participation=[
                    {"department": name, "students": count}
                    for name, count in sorted(department_counts.items())
                ],
            )
        )

    total_enr = len(rows)
    total_cmp = sum(item.status == "completed" for item, _course, _student in rows)
    comp_rate = _percentage(total_cmp, total_enr)

    return LearningEffectivenessOverview(
        total_enrolled=total_enr,
        total_completed=total_cmp,
        overall_completion_rate=comp_rate,
        average_readiness_gain=0.0,
        courses=courses,
    )


async def get_at_risk_cohorts(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> AtRiskCohortSummary:
    cohorts = await get_cohort_analytics(session, institution_id=institution_id)
    risk_groups = [
        AtRiskCohortGroup(
            risk_category="Low evidence-backed readiness (<50%)",
            severity="Critical",
            affected_students_count=cohort.total_students,
            department=cohort.department,
            graduation_year=cohort.graduation_year,
            key_signals=[
                f"Persisted average readiness is {cohort.average_readiness}%"
            ],
            recommended_action="Review evidence-backed skill gaps before creating an intervention plan.",
        )
        for cohort in cohorts.cohorts
        if cohort.average_readiness < 50
    ]

    total_risk = sum(g.affected_students_count for g in risk_groups)
    return AtRiskCohortSummary(
        total_at_risk_students=total_risk,
        risk_groups=risk_groups,
    )


async def list_action_plans(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> list[ActionPlanResponse]:
    stmt = select(InstitutionActionPlan).order_by(InstitutionActionPlan.created_at.desc())
    if institution_id:
        stmt = stmt.where(InstitutionActionPlan.institution_id == institution_id)
    plans = (await session.scalars(stmt)).all()

    return [
        ActionPlanResponse(
            id=a.id,
            institution_id=a.institution_id,
            title=a.title,
            action_type=a.action_type,
            related_department=a.related_department,
            source_insight=a.source_insight,
            priority=a.priority,
            owner=a.owner,
            target_date=a.target_date,
            status=a.status,
            linked_intervention_id=a.linked_intervention_id,
            outcome_notes=a.outcome_notes,
            created_at=a.created_at,
            updated_at=a.created_at,
        )
        for a in plans
    ]


async def create_action_plan(
    session: AsyncSession,
    payload: ActionPlanCreate,
    institution_id: UUID | None = None,
) -> ActionPlanResponse:
    plan = InstitutionActionPlan(
        institution_id=institution_id,
        title=payload.title,
        action_type=payload.action_type,
        related_department=payload.related_department,
        source_insight=payload.source_insight,
        priority=payload.priority,
        owner=payload.owner,
        target_date=payload.target_date,
        status=payload.status,
        linked_intervention_id=payload.linked_intervention_id,
        outcome_notes=payload.outcome_notes,
    )
    session.add(plan)
    await session.commit()
    await session.refresh(plan)

    return ActionPlanResponse(
        id=plan.id,
        institution_id=plan.institution_id,
        title=plan.title,
        action_type=plan.action_type,
        related_department=plan.related_department,
        source_insight=plan.source_insight,
        priority=plan.priority,
        owner=plan.owner,
        target_date=plan.target_date,
        status=plan.status,
        linked_intervention_id=plan.linked_intervention_id,
        outcome_notes=plan.outcome_notes,
        created_at=plan.created_at,
        updated_at=plan.created_at,
    )


async def update_action_plan(
    session: AsyncSession,
    plan_id: UUID,
    payload: ActionPlanUpdate,
    institution_id: UUID | None = None,
) -> ActionPlanResponse | None:
    plan = await session.get(InstitutionActionPlan, plan_id)
    if not plan or (
        institution_id is not None and plan.institution_id != institution_id
    ):
        return None

    if payload.title is not None:
        plan.title = payload.title
    if payload.priority is not None:
        plan.priority = payload.priority
    if payload.owner is not None:
        plan.owner = payload.owner
    if payload.target_date is not None:
        plan.target_date = payload.target_date
    if payload.status is not None:
        plan.status = payload.status
    if payload.outcome_notes is not None:
        plan.outcome_notes = payload.outcome_notes

    await session.commit()
    await session.refresh(plan)

    return ActionPlanResponse(
        id=plan.id,
        institution_id=plan.institution_id,
        title=plan.title,
        action_type=plan.action_type,
        related_department=plan.related_department,
        source_insight=plan.source_insight,
        priority=plan.priority,
        owner=plan.owner,
        target_date=plan.target_date,
        status=plan.status,
        linked_intervention_id=plan.linked_intervention_id,
        outcome_notes=plan.outcome_notes,
        created_at=plan.created_at,
        updated_at=plan.created_at,
    )


async def delete_action_plan(
    session: AsyncSession,
    plan_id: UUID,
    institution_id: UUID | None = None,
) -> bool:
    plan = await session.get(InstitutionActionPlan, plan_id)
    if not plan or (
        institution_id is not None and plan.institution_id != institution_id
    ):
        return False
    await session.delete(plan)
    await session.commit()
    return True


async def get_institution_alerts(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> InstitutionAlertsResponse:
    recommendations = await get_intervention_recommendations(session, institution_id)
    alerts = [
        InstitutionAlertItem(
            id=f"persisted-gap-{index}",
            alert_type="persisted_skill_shortage",
            severity="critical" if item.gap_severity == "Critical" else "warning",
            title=f"Evidence-backed supply gap: {item.skill}",
            message=(
                f"Persisted opportunity demand is {item.industry_demand_index:g}; "
                f"qualified institution supply is {item.student_supply_index:g}."
            ),
            department=", ".join(item.affected_departments),
            target_tab="interventions",
            action_label="Review Derived Recommendation",
        )
        for index, item in enumerate(recommendations)
    ]
    return InstitutionAlertsResponse(alerts=alerts)


async def get_collaboration_relationships(
    session: AsyncSession,
    institution_id: UUID | None = None,
) -> CollaborationRelationshipsResponse:
    institution = await session.get(Institution, institution_id) if institution_id else None
    faculty_statement = select(Academician)
    if institution is not None:
        faculty_statement = faculty_statement.where(
            func.lower(Academician.institution_name)
            == institution.institution_name.casefold()
        )
    faculty = list((await session.scalars(faculty_statement)).all())
    faculty_by_id = {item.id: item for item in faculty}
    workspaces = (
        list(
            (
                await session.scalars(
                    select(CollaborationWorkspace).where(
                        CollaborationWorkspace.faculty_lead_id.in_(faculty_by_id)
                    )
                )
            ).all()
        )
        if faculty_by_id
        else []
    )
    relationships = [
        CollaborationRelationshipItem(
            id=str(workspace.id),
            industry_partner=workspace.organization_name,
            faculty_lead=faculty_by_id[workspace.faculty_lead_id].full_name,
            faculty_department=faculty_by_id[workspace.faculty_lead_id].department,
            student_team_or_cohort=f"{len(workspace.participants or [])} recorded participants",
            initiative_title=workspace.title,
            initiative_type=workspace.collaboration_type,
            status=workspace.status,
            outcome_metric=workspace.outcome_summary or "No persisted outcome yet",
        )
        for workspace in workspaces
    ]

    return CollaborationRelationshipsResponse(
        total_collaborations=len(relationships),
        relationships=relationships,
    )


async def generate_institution_report(
    session: AsyncSession,
    report_type: str,
    institution_id: UUID | None = None,
) -> InstitutionReportResponse:
    rtype = report_type.lower().strip()
    now = datetime.now(UTC)

    title = "Persisted Institution Report"
    columns: list[str] = []
    rows: list[dict[str, object]] = []
    if rtype in {"skill_gap", "skill_gaps", "gaps", "industry_demand"}:
        title = "Persisted Opportunity Demand and Institution Supply Report"
        columns = ["Skill", "Demand", "Qualified Supply", "Gap", "Classification"]
        if institution_id is not None:
            analytics = await institution_demand_supply_analytics(session, institution_id)
            rows = [
                {
                    "Skill": row.skill_name,
                    "Demand": row.industry_demand,
                    "Qualified Supply": row.qualified_supply,
                    "Gap": row.gap,
                    "Classification": row.classification,
                }
                for row in analytics.skills
            ]
    elif rtype in {"department_readiness", "department", "departments"}:
        title = "Department Evidence and Outcome Report"
        columns = [
            "Department",
            "Students",
            "Verified Skills Average",
            "Placement Rate",
            "Internship Rate",
        ]
        overview = await get_institution_analytics(session, institution_id)
        rows = [
            {
                "Department": row.department,
                "Students": row.total_students,
                "Verified Skills Average": row.verified_skills_average,
                "Placement Rate": row.placement_rate,
                "Internship Rate": row.internship_rate,
            }
            for row in overview.department_metrics
        ]
    elif rtype in {"internship", "internships"}:
        title = "Persisted Internship Lifecycle Report"
        columns = ["Department", "Eligible", "Active", "Completed", "Rate"]
        monitoring = await get_internship_monitoring(session, institution_id)
        rows = list(monitoring.by_department)
    elif rtype in {"learning_adoption", "learning"}:
        title = "Persisted Learning Completion Report"
        columns = ["Course", "Provider", "Enrolled", "Completed", "Completion Rate"]
        learning = await get_learning_effectiveness(session, institution_id)
        rows = [
            {
                "Course": row.title,
                "Provider": row.provider,
                "Enrolled": row.enrolled_count,
                "Completed": row.completed_count,
                "Completion Rate": row.completion_rate,
            }
            for row in learning.courses
        ]
    elif rtype in {"faculty_engagement", "faculty"}:
        title = "Persisted Faculty Collaboration Report"
        columns = ["Partner", "Faculty Lead", "Department", "Initiative", "Status"]
        relationships = await get_collaboration_relationships(session, institution_id)
        rows = [
            {
                "Partner": row.industry_partner,
                "Faculty Lead": row.faculty_lead,
                "Department": row.faculty_department,
                "Initiative": row.initiative_title,
                "Status": row.status,
            }
            for row in relationships.relationships
        ]
    elif rtype in {"placement", "placements"}:
        title = "Persisted Placement Outcome Report"
        columns = ["Metric", "Value"]
        placement = await get_placement_monitoring(session, institution_id)
        if placement.applications:
            rows = [
                {"Metric": "Applications", "Value": placement.applications},
                {"Metric": "Placements secured", "Value": placement.placements_secured},
                {"Metric": "Conversion rate", "Value": placement.conversion_rate},
            ]
    elif rtype in {"industry_partnerships", "partnerships", "partners"}:
        title = "Persisted Industry Partnership Report"
        columns = ["Partner", "Faculty Lead", "Initiative", "Status"]
        relationships = await get_collaboration_relationships(session, institution_id)
        rows = [
            {
                "Partner": row.industry_partner,
                "Faculty Lead": row.faculty_lead,
                "Initiative": row.initiative_title,
                "Status": row.status,
            }
            for row in relationships.relationships
        ]
    return InstitutionReportResponse(
        report_type=rtype,
        report_title=title,
        generated_at=now,
        columns=columns,
        rows=rows,
        csv_export_url=None,
    )
