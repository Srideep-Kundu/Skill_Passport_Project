"""Persisted, tenant-safe skill demand and evidence-backed supply analytics."""

from dataclasses import dataclass, field
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Institution,
    Internship,
    InternshipEngagement,
    InternshipRequirement,
    PlacementDrive,
    PlacementRegistration,
    PlacementRequirement,
    Recruiter,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    InstitutionDemandSupplyAnalytics,
    InstitutionDemandSupplySkill,
    RecruiterDemandAnalytics,
    RecruiterDemandSkill,
)

QUALIFICATION_THRESHOLD = 0.75
_TIER_MULTIPLIER = {
    VerificationTier.verified: 1.0,
    VerificationTier.partially_verified: 0.85,
    VerificationTier.unverified: 0.65,
}
_ACTIVE_PLACEMENT_STATES = {"published", "active", "upcoming"}


def normalize_institution_name(value: str) -> str:
    return " ".join(value.split()).casefold()


async def resolve_institution_id_by_name(
    session: AsyncSession, institution_name: str | None
) -> UUID | None:
    """Return an institution only for one exact normalized-name match."""
    if not institution_name or not institution_name.strip():
        return None
    target = normalize_institution_name(institution_name)
    matches = [
        institution.id
        for institution in (await session.scalars(select(Institution))).all()
        if normalize_institution_name(institution.institution_name) == target
    ]
    return matches[0] if len(matches) == 1 else None


async def backfill_institution_memberships(session: AsyncSession) -> int:
    """Conservatively link legacy students; useful for non-PostgreSQL test stores."""
    institutions = list((await session.scalars(select(Institution))).all())
    by_name: dict[str, list[UUID]] = {}
    for institution in institutions:
        by_name.setdefault(
            normalize_institution_name(institution.institution_name), []
        ).append(institution.id)
    changed = 0
    students = list((await session.scalars(select(Student))).all())
    for student in students:
        if student.institution_id is None and student.university:
            matches = by_name.get(normalize_institution_name(student.university), [])
            if len(matches) == 1:
                student.institution_id = matches[0]
                changed += 1
        goals = student.career_goals or {}
        if student.department is None and isinstance(goals.get("department"), str):
            department = str(goals["department"]).strip()
            student.department = department or None
        if student.cohort_year is None and student.graduation_year is not None:
            student.cohort_year = student.graduation_year
    await session.flush()
    return changed


@dataclass
class _Demand:
    skill_id: UUID
    skill_name: str
    demand_count: int = 0
    required_count: int = 0
    preferred_count: int = 0
    weighted_demand: float = 0.0
    internship_count: int = 0
    placement_count: int = 0
    opportunities: set[str] = field(default_factory=set)


def _add_demand(
    rows: dict[UUID, _Demand],
    *,
    skill_id: UUID,
    skill_name: str,
    required: bool,
    weight: float,
    source: Literal["internship", "placement"],
    opportunity_id: UUID,
) -> None:
    item = rows.setdefault(skill_id, _Demand(skill_id, skill_name))
    item.demand_count += 1
    item.required_count += int(required)
    item.preferred_count += int(not required)
    item.weighted_demand += weight
    item.internship_count += int(source == "internship")
    item.placement_count += int(source == "placement")
    item.opportunities.add(f"{source}:{opportunity_id}")


async def _demand_rows(
    session: AsyncSession,
    *,
    recruiter_id: UUID | None = None,
    opportunity_type: Literal["all", "internship", "placement"] = "all",
    active_only: bool = True,
) -> dict[UUID, _Demand]:
    result: dict[UUID, _Demand] = {}
    if opportunity_type in {"all", "internship"}:
        internship_statement = (
            select(InternshipRequirement, Skill, Internship)
            .join(Skill, Skill.id == InternshipRequirement.skill_id)
            .join(Internship, Internship.id == InternshipRequirement.internship_id)
        )
        if recruiter_id is not None:
            internship_statement = internship_statement.where(
                Internship.recruiter_id == recruiter_id
            )
        if active_only:
            internship_statement = internship_statement.where(
                Internship.is_published.is_(True)
            )
        for requirement, skill, internship in (
            await session.execute(internship_statement)
        ).all():
            _add_demand(
                result,
                skill_id=skill.id,
                skill_name=skill.canonical_name,
                required=requirement.is_required,
                weight=float(requirement.weight),
                source="internship",
                opportunity_id=internship.id,
            )
    if opportunity_type in {"all", "placement"}:
        placement_statement = (
            select(PlacementRequirement, Skill, PlacementDrive)
            .join(Skill, Skill.id == PlacementRequirement.skill_id)
            .join(
                PlacementDrive,
                PlacementDrive.id == PlacementRequirement.placement_drive_id,
            )
        )
        if recruiter_id is not None:
            placement_statement = placement_statement.where(
                PlacementDrive.recruiter_id == recruiter_id
            )
        if active_only:
            placement_statement = placement_statement.where(
                PlacementDrive.status.in_(_ACTIVE_PLACEMENT_STATES),
                PlacementDrive.closed_at.is_(None),
            )
        for requirement, skill, drive in (
            await session.execute(placement_statement)
        ).all():
            _add_demand(
                result,
                skill_id=skill.id,
                skill_name=skill.canonical_name,
                required=requirement.requirement_type == "required",
                weight=float(requirement.weight),
                source="placement",
                opportunity_id=drive.id,
            )
    return result


async def _candidate_ids(session: AsyncSession, recruiter_id: UUID) -> set[UUID]:
    internship_ids = set(
        (
            await session.scalars(
                select(InternshipEngagement.student_id).where(
                    InternshipEngagement.recruiter_id == recruiter_id
                )
            )
        ).all()
    )
    placement_ids = set(
        (
            await session.scalars(
                select(PlacementRegistration.student_id)
                .join(
                    PlacementDrive,
                    PlacementDrive.id == PlacementRegistration.placement_drive_id,
                )
                .where(PlacementDrive.recruiter_id == recruiter_id)
            )
        ).all()
    )
    return internship_ids | placement_ids


async def _best_skill_confidence(
    session: AsyncSession, student_ids: set[UUID]
) -> dict[UUID, dict[UUID, tuple[float, bool]]]:
    by_skill: dict[UUID, dict[UUID, tuple[float, bool]]] = {}
    if not student_ids:
        return by_skill
    rows = (
        await session.scalars(
            select(StudentSkill).where(StudentSkill.student_id.in_(student_ids))
        )
    ).all()
    for row in rows:
        effective = float(row.extraction_confidence) * _TIER_MULTIPLIER[
            row.verification_tier
        ]
        current = by_skill.setdefault(row.skill_id, {}).get(row.student_id)
        verified = row.verification_tier == VerificationTier.verified
        if current is None or effective > current[0]:
            by_skill[row.skill_id][row.student_id] = (effective, verified)
        elif verified and current is not None:
            by_skill[row.skill_id][row.student_id] = (current[0], True)
    return by_skill


async def recruiter_demand_analytics(
    session: AsyncSession,
    recruiter_id: UUID,
    *,
    opportunity_type: Literal["all", "internship", "placement"] = "all",
    active_only: bool = True,
) -> RecruiterDemandAnalytics:
    recruiter = await session.get(Recruiter, recruiter_id)
    if recruiter is None:
        raise ValueError("Recruiter not found")
    demand = await _demand_rows(
        session,
        recruiter_id=recruiter_id,
        opportunity_type=opportunity_type,
        active_only=active_only,
    )
    candidates = await _candidate_ids(session, recruiter_id)
    supply = await _best_skill_confidence(session, candidates)
    skills: list[RecruiterDemandSkill] = []
    for item in demand.values():
        candidate_values = supply.get(item.skill_id, {})
        qualified = sum(
            confidence >= QUALIFICATION_THRESHOLD
            for confidence, _verified in candidate_values.values()
        )
        average = (
            round(
                100
                * sum(value[0] for value in candidate_values.values())
                / len(candidate_values),
                1,
            )
            if candidate_values
            else None
        )
        skills.append(
            RecruiterDemandSkill(
                skill_id=item.skill_id,
                skill_name=item.skill_name,
                demand_count=item.demand_count,
                required_count=item.required_count,
                preferred_count=item.preferred_count,
                weighted_demand=round(item.weighted_demand, 2),
                active_opportunity_count=len(item.opportunities),
                candidate_supply=len(candidate_values),
                qualified_supply=qualified,
                candidates_missing=max(0, len(candidates) - len(candidate_values)),
                gap=item.demand_count - qualified,
                average_readiness=average,
            )
        )
    skills.sort(key=lambda row: (-row.weighted_demand, row.skill_name.casefold()))
    opportunities = {key for item in demand.values() for key in item.opportunities}
    return RecruiterDemandAnalytics(
        company_name=recruiter.company_name,
        opportunity_type=opportunity_type,
        active_only=active_only,
        active_opportunities=len(opportunities),
        authorized_candidate_pool=len(candidates),
        qualification_threshold=QUALIFICATION_THRESHOLD,
        skills=skills,
    )


async def institution_demand_supply_analytics(
    session: AsyncSession,
    institution_id: UUID,
    *,
    department: str | None = None,
    cohort_year: int | None = None,
) -> InstitutionDemandSupplyAnalytics:
    institution = await session.get(Institution, institution_id)
    if institution is None:
        raise ValueError("Institution not found")
    base_students = list(
        (
            await session.scalars(
                select(Student).where(Student.institution_id == institution_id)
            )
        ).all()
    )
    departments = sorted(
        {student.department for student in base_students if student.department},
        key=str.casefold,
    )
    cohorts = sorted(
        {student.cohort_year for student in base_students if student.cohort_year is not None}
    )
    students = [
        student
        for student in base_students
        if (department is None or student.department == department)
        and (cohort_year is None or student.cohort_year == cohort_year)
    ]
    student_ids = {student.id for student in students}
    supply = await _best_skill_confidence(session, student_ids)
    demand = await _demand_rows(session)
    skill_ids = set(demand) | set(supply)
    skill_names: dict[UUID, str] = {}
    if skill_ids:
        skill_names = {
            skill.id: skill.canonical_name
            for skill in (
                await session.scalars(select(Skill).where(Skill.id.in_(skill_ids)))
            ).all()
        }
    rows: list[InstitutionDemandSupplySkill] = []
    for skill_id in skill_ids:
        demand_item = demand.get(skill_id)
        values = supply.get(skill_id, {})
        qualified = sum(
            confidence >= QUALIFICATION_THRESHOLD
            for confidence, _verified in values.values()
        )
        verified = sum(is_verified for _confidence, is_verified in values.values())
        industry_demand = demand_item.demand_count if demand_item else 0
        gap = industry_demand - qualified
        average = (
            round(100 * sum(value[0] for value in values.values()) / len(values), 1)
            if values
            else None
        )
        rows.append(
            InstitutionDemandSupplySkill(
                skill_id=skill_id,
                skill_name=skill_names[skill_id],
                student_supply=len(values),
                evidence_backed_supply=len(values),
                qualified_supply=qualified,
                verified_supply=verified,
                average_readiness=average,
                industry_demand=industry_demand,
                weighted_demand=round(
                    demand_item.weighted_demand if demand_item else 0.0, 2
                ),
                internship_demand=demand_item.internship_count if demand_item else 0,
                placement_demand=demand_item.placement_count if demand_item else 0,
                gap=gap,
                classification=(
                    "shortage" if gap > 0 else "surplus" if gap < 0 else "balanced"
                ),
            )
        )
    rows.sort(
        key=lambda row: (-row.gap, -row.weighted_demand, row.skill_name.casefold())
    )
    return InstitutionDemandSupplyAnalytics(
        institution_id=institution.id,
        institution_name=institution.institution_name,
        department=department,
        cohort_year=cohort_year,
        assigned_students=len(students),
        qualification_threshold=QUALIFICATION_THRESHOLD,
        available_departments=departments,
        available_cohorts=cohorts,
        student_metadata_available=bool(departments or cohorts),
        industry_demand_available=bool(demand),
        skills=rows,
    )
