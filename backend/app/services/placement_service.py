"""Recruiter-owned internal jobs with canonical, deterministic matching."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AuditLog,
    PlacementDrive,
    PlacementRegistration,
    PlacementRequirement,
    PlacementStatusEvent,
    Recruiter,
    Skill,
    Student,
)
from app.schemas.contracts import (
    PlacementCandidateRanking,
    PlacementDriveCreate,
    PlacementDriveResponse,
    PlacementDriveUpdate,
    PlacementRegistrationRequest,
    PlacementRegistrationStageUpdate,
    PlacementRequirementInput,
    PlacementRequirementResponse,
    PlacementStatusEventResponse,
)
from app.services.matching_service import (
    SCORE_VERSION,
    PossessedSkill,
    RequirementInput,
    ScoreResult,
    calculate_score,
    possessed_matching_inputs,
)

PUBLIC_STATUSES = {"published", "active", "upcoming"}
PLACEMENT_STAGE_ALIASES = {
    "registered": "applied",
    "interview_scheduled": "interview",
    "interviewed": "interview",
    "offered": "offer",
    "accepted": "hired",
}
PLACEMENT_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "applied": ("shortlisted", "rejected"),
    "shortlisted": ("interview", "rejected"),
    "interview": ("offer", "rejected"),
    "offer": ("hired", "rejected"),
}
PLACEMENT_WITHDRAWAL_STAGES = {"applied", "shortlisted", "interview"}


class PlacementNotFoundError(ValueError):
    """The placement resource is absent or outside recruiter ownership."""


class PlacementConflictError(ValueError):
    """The requested operation conflicts with placement state."""


class PlacementValidationError(ValueError):
    """Placement configuration or eligibility data is invalid."""


def normalized_placement_stage(stage: str) -> str:
    return PLACEMENT_STAGE_ALIASES.get(stage, stage)


def allowed_placement_transitions(stage: str) -> list[str]:
    return list(PLACEMENT_TRANSITIONS.get(normalized_placement_stage(stage), ()))


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _audit(
    actor_id: UUID, action: str, entity_type: str, entity_id: UUID, details: dict
) -> AuditLog:
    return AuditLog(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )


async def _owned_drive(
    session: AsyncSession, drive_id: UUID, recruiter_id: UUID
) -> PlacementDrive:
    drive = await session.get(PlacementDrive, drive_id)
    if drive is None or drive.recruiter_id != recruiter_id:
        raise PlacementNotFoundError("Placement job not found")
    return drive


async def _canonical_requirements(
    session: AsyncSession,
    inputs: list[PlacementRequirementInput],
) -> list[tuple[Skill, PlacementRequirementInput]]:
    skill_ids = [item.skill_id for item in inputs]
    if len(skill_ids) != len(set(skill_ids)):
        raise PlacementValidationError("Each canonical skill may be required only once")
    skills = list(
        (await session.scalars(select(Skill).where(Skill.id.in_(skill_ids)))).all()
    )
    by_id = {skill.id: skill for skill in skills}
    if len(by_id) != len(skill_ids):
        raise PlacementValidationError(
            "All placement requirements must reference the canonical taxonomy"
        )
    if inputs and not any(item.requirement_type == "required" for item in inputs):
        raise PlacementValidationError("At least one required skill is required")
    return [(by_id[item.skill_id], item) for item in inputs]


async def _legacy_requirements(
    session: AsyncSession, names: list[str]
) -> tuple[list[tuple[Skill, PlacementRequirementInput]], list[str]]:
    normalized = list(dict.fromkeys(name.strip() for name in names if name.strip()))
    if not normalized:
        return [], []
    skills = list(
        (
            await session.scalars(
                select(Skill).where(
                    func.lower(Skill.canonical_name).in_(
                        [name.casefold() for name in normalized]
                    )
                )
            )
        ).all()
    )
    by_name = {skill.canonical_name.casefold(): skill for skill in skills}
    mapped = [
        (
            by_name[name.casefold()],
            PlacementRequirementInput(
                skill_id=by_name[name.casefold()].id,
                weight=1.0,
                requirement_type="required",
            ),
        )
        for name in normalized
        if name.casefold() in by_name
    ]
    unresolved = [name for name in normalized if name.casefold() not in by_name]
    return mapped, unresolved


async def _replace_requirements(
    session: AsyncSession,
    drive: PlacementDrive,
    mapped: list[tuple[Skill, PlacementRequirementInput]],
) -> None:
    await session.execute(
        delete(PlacementRequirement).where(
            PlacementRequirement.placement_drive_id == drive.id
        )
    )
    for skill, item in mapped:
        session.add(
            PlacementRequirement(
                placement_drive_id=drive.id,
                skill_id=skill.id,
                weight=item.weight,
                requirement_type=item.requirement_type,
            )
        )
    drive.required_skills = [
        skill.canonical_name
        for skill, item in mapped
        if item.requirement_type == "required"
    ]


async def _loaded_requirements(
    session: AsyncSession, drive_id: UUID
) -> list[PlacementRequirement]:
    return list(
        (
            await session.scalars(
                select(PlacementRequirement)
                .where(PlacementRequirement.placement_drive_id == drive_id)
                .options(selectinload(PlacementRequirement.skill))
                .order_by(
                    PlacementRequirement.requirement_type,
                    PlacementRequirement.skill_id,
                )
            )
        ).all()
    )


async def _possessed_skills(
    session: AsyncSession, student_id: UUID
) -> list[PossessedSkill]:
    return await possessed_matching_inputs(session, student_id)


def _score(
    requirements: list[PlacementRequirement], possessed: list[PossessedSkill]
) -> ScoreResult:
    inputs = [
        RequirementInput(
            skill_id=item.skill_id,
            weight=float(item.weight),
            is_required=item.requirement_type == "required",
            embedding=item.skill.embedding if item.skill else None,
            embedding_fingerprint=(
                item.skill.embedding_fingerprint if item.skill else None
            ),
        )
        for item in requirements
    ]
    return calculate_score(inputs, possessed)


def _eligibility(
    drive: PlacementDrive, student: Student | None
) -> tuple[str, list[str], bool]:
    if student is None:
        return "not_evaluated", [], False
    profile = student.career_goals or {}
    department = str(profile.get("department") or "").strip()
    degree = str(profile.get("degree") or "").strip()
    cgpa_value = profile.get("cgpa")
    try:
        cgpa = float(cgpa_value) if cgpa_value is not None else None
    except (TypeError, ValueError):
        cgpa = None
    rules = drive.eligibility or {}
    departments = list(rules.get("departments") or drive.eligible_departments or [])
    graduation_year = rules.get("graduation_year", drive.passing_year)
    minimum_cgpa = float(rules.get("minimum_cgpa", drive.minimum_cgpa))
    degrees = [str(value) for value in rules.get("degrees", [])]
    enforce = bool(rules.get("enforce", False))
    reasons: list[str] = []
    if departments and department and department.casefold() not in {
        value.casefold() for value in departments
    }:
        reasons.append("Department is outside the eligible set")
    if graduation_year and student.graduation_year and int(graduation_year) != student.graduation_year:
        reasons.append("Graduation year does not meet the requirement")
    if cgpa is not None and cgpa < minimum_cgpa:
        reasons.append("CGPA is below the eligibility threshold")
    if degrees and degree and degree.casefold() not in {value.casefold() for value in degrees}:
        reasons.append("Degree does not meet the eligibility requirement")
    status = "ineligible" if reasons else "eligible"
    return status, reasons, not (enforce and reasons)


def _component_names(
    requirements: list[PlacementRequirement], score: ScoreResult
) -> tuple[list[str], list[str], list[str], list[UUID]]:
    by_id = {item.skill_id: item for item in requirements}
    matched: list[str] = []
    missing: list[str] = []
    preferred: list[str] = []
    evidence: list[UUID] = []
    for component in score.components:
        requirement = by_id[component.skill_id]
        name = requirement.skill.canonical_name
        if requirement.requirement_type == "preferred":
            preferred.append(name)
        if component.status == "missing":
            missing.append(name)
        else:
            matched.append(name)
            if component.evidence_id is not None:
                evidence.append(component.evidence_id)
    return matched, missing, preferred, list(dict.fromkeys(evidence))


async def _drive_response(
    session: AsyncSession,
    drive: PlacementDrive,
    *,
    student: Student | None = None,
    registration: PlacementRegistration | None = None,
) -> PlacementDriveResponse:
    requirements = await _loaded_requirements(session, drive.id)
    score = _score(requirements, await _possessed_skills(session, student.id)) if student else ScoreResult(0, 0, 0, 0, ())
    matched, missing, preferred, evidence = _component_names(requirements, score)
    if student is None:
        preferred = [
            item.skill.canonical_name
            for item in requirements
            if item.requirement_type == "preferred"
        ]
    canonical_names = {item.skill.canonical_name.casefold() for item in requirements}
    unresolved = [
        name for name in drive.required_skills if name.casefold() not in canonical_names
    ]
    eligibility_status, eligibility_reasons, eligibility_allows = _eligibility(
        drive, student
    )
    now = datetime.now(UTC)
    open_for_applications = (
        drive.status in PUBLIC_STATUSES
        and drive.closed_at is None
        and (
            drive.application_deadline is None
            or _utc(drive.application_deadline) >= now
        )
    )
    return PlacementDriveResponse(
        id=drive.id,
        company_name=drive.company_name,
        title=drive.title,
        description=drive.description,
        role_type=drive.role_type,
        ctc_lpa=float(drive.ctc_lpa),
        eligible_departments=drive.eligible_departments,
        minimum_cgpa=float(drive.minimum_cgpa),
        passing_year=drive.passing_year,
        drive_date=drive.drive_date,
        status=drive.status,
        required_skills=[
            item.skill.canonical_name
            for item in requirements
            if item.requirement_type == "required"
        ],
        preferred_skills=preferred,
        requirements=[
            PlacementRequirementResponse(
                skill_id=item.skill_id,
                skill_name=item.skill.canonical_name,
                weight=float(item.weight),
                requirement_type=item.requirement_type,
            )
            for item in requirements
        ],
        qualifications=drive.qualifications,
        employment_type=drive.employment_type,
        location=drive.location,
        application_deadline=drive.application_deadline,
        eligibility=drive.eligibility,
        eligibility_status=eligibility_status,
        eligibility_reasons=eligibility_reasons,
        can_apply=student is not None and eligibility_allows and open_for_applications,
        published_at=drive.published_at,
        closed_at=drive.closed_at,
        unresolved_skill_names=unresolved,
        deterministic_score=score.deterministic_score,
        semantic_score=score.semantic_score,
        verification_bonus=score.verification_bonus,
        final_score=score.final_score,
        matched_skills=matched,
        missing_skills=missing,
        evidence_references=evidence,
        formula_version=SCORE_VERSION,
        is_registered=registration is not None,
        registration_status=registration.status if registration else None,
    )


async def list_placement_drives(
    session: AsyncSession,
    student_id: UUID | None = None,
    recruiter_id: UUID | None = None,
) -> list[PlacementDriveResponse]:
    query = select(PlacementDrive)
    if recruiter_id is not None:
        query = query.where(PlacementDrive.recruiter_id == recruiter_id)
    elif student_id is not None:
        query = query.where(PlacementDrive.status.in_(PUBLIC_STATUSES))
    drives = list(
        (await session.scalars(query.order_by(PlacementDrive.created_at.desc()))).all()
    )
    student = await session.get(Student, student_id) if student_id else None
    registrations: dict[UUID, PlacementRegistration] = {}
    if student_id is not None:
        rows = list(
            (
                await session.scalars(
                    select(PlacementRegistration).where(
                        PlacementRegistration.student_id == student_id
                    )
                )
            ).all()
        )
        registrations = {row.placement_drive_id: row for row in rows}
    return [
        await _drive_response(
            session, drive, student=student, registration=registrations.get(drive.id)
        )
        for drive in drives
    ]


async def get_placement_drive(
    session: AsyncSession,
    drive_id: UUID,
    actor: Student | Recruiter,
) -> PlacementDriveResponse:
    drive = await session.get(PlacementDrive, drive_id)
    if drive is None:
        raise PlacementNotFoundError("Placement job not found")
    if isinstance(actor, Recruiter):
        if drive.recruiter_id != actor.id:
            raise PlacementNotFoundError("Placement job not found")
        return await _drive_response(session, drive)
    if drive.status not in PUBLIC_STATUSES:
        raise PlacementNotFoundError("Placement job not found")
    registration = await session.scalar(
        select(PlacementRegistration).where(
            PlacementRegistration.student_id == actor.id,
            PlacementRegistration.placement_drive_id == drive.id,
        )
    )
    return await _drive_response(session, drive, student=actor, registration=registration)


async def create_placement_drive(
    session: AsyncSession,
    recruiter_id: UUID,
    payload: PlacementDriveCreate,
) -> PlacementDriveResponse:
    recruiter = await session.get(Recruiter, recruiter_id)
    if recruiter is None:
        raise PlacementNotFoundError("Recruiter not found")
    if payload.application_deadline and payload.application_deadline > payload.drive_date:
        raise PlacementValidationError("Application deadline cannot follow drive date")
    if payload.requirements:
        mapped = await _canonical_requirements(session, payload.requirements)
        unresolved: list[str] = []
    else:
        mapped, unresolved = await _legacy_requirements(session, payload.required_skills)
    if not mapped:
        raise PlacementValidationError("At least one canonical required skill is required")
    now = datetime.now(UTC)
    drive = PlacementDrive(
        recruiter_id=recruiter_id,
        company_name=recruiter.company_name,
        title=payload.title,
        description=payload.description,
        role_type=payload.role_type,
        ctc_lpa=payload.ctc_lpa,
        eligible_departments=payload.eligible_departments,
        minimum_cgpa=payload.minimum_cgpa,
        passing_year=payload.passing_year,
        drive_date=payload.drive_date,
        status=payload.status,
        required_skills=[skill.canonical_name for skill, _ in mapped] + unresolved,
        qualifications=payload.qualifications,
        employment_type=payload.employment_type,
        location=payload.location,
        application_deadline=payload.application_deadline,
        eligibility=payload.eligibility,
        published_at=now if payload.status == "published" else None,
    )
    session.add(drive)
    await session.flush()
    await _replace_requirements(session, drive, mapped)
    # Preserve unresolved legacy values for compatibility and explicit reporting.
    drive.required_skills = drive.required_skills + unresolved
    session.add(
        _audit(
            recruiter_id,
            "placement_job_created",
            "placement_drive",
            drive.id,
            {"status": drive.status, "unresolved_skill_names": unresolved},
        )
    )
    await session.commit()
    await session.refresh(drive)
    return await _drive_response(session, drive)


async def update_placement_drive(
    session: AsyncSession,
    drive_id: UUID,
    recruiter_id: UUID,
    payload: PlacementDriveUpdate,
) -> PlacementDriveResponse:
    drive = await _owned_drive(session, drive_id, recruiter_id)
    updates = payload.model_dump(exclude_unset=True, exclude={"requirements", "status"})
    for field, value in updates.items():
        setattr(drive, field, value)
    deadline = payload.application_deadline or drive.application_deadline
    drive_date = payload.drive_date or drive.drive_date
    if deadline is not None and _utc(deadline) > _utc(drive_date):
        raise PlacementValidationError("Application deadline cannot follow drive date")
    if payload.requirements is not None:
        mapped = await _canonical_requirements(session, payload.requirements)
        if not mapped:
            raise PlacementValidationError("At least one canonical required skill is required")
        await _replace_requirements(session, drive, mapped)
    if payload.status is not None and payload.status != drive.status:
        allowed = {
            "draft": {"published"},
            "published": {"closed"},
            "active": {"closed"},
            "upcoming": {"published", "closed"},
        }
        if payload.status not in allowed.get(drive.status, set()):
            raise PlacementConflictError(
                f"Placement job cannot transition from {drive.status} to {payload.status}"
            )
        drive.status = payload.status
        now = datetime.now(UTC)
        if payload.status == "published":
            drive.published_at = now
            drive.closed_at = None
        elif payload.status == "closed":
            drive.closed_at = now
    session.add(
        _audit(
            recruiter_id,
            "placement_job_updated",
            "placement_drive",
            drive.id,
            {"status": drive.status},
        )
    )
    await session.commit()
    await session.refresh(drive)
    return await _drive_response(session, drive)


async def delete_placement_drive(
    session: AsyncSession, drive_id: UUID, recruiter_id: UUID
) -> None:
    drive = await _owned_drive(session, drive_id, recruiter_id)
    registration_count = int(
        (
            await session.scalar(
                select(func.count())
                .select_from(PlacementRegistration)
                .where(PlacementRegistration.placement_drive_id == drive.id)
            )
        )
        or 0
    )
    if registration_count:
        raise PlacementConflictError(
            "Placement jobs with registrations must be closed, not deleted"
        )
    await session.delete(drive)
    await session.commit()


async def register_for_placement(
    session: AsyncSession,
    student_id: UUID,
    payload: PlacementRegistrationRequest,
) -> PlacementDriveResponse:
    drive = await session.get(PlacementDrive, payload.placement_drive_id)
    student = await session.get(Student, student_id)
    if drive is None or student is None:
        raise PlacementNotFoundError("Placement job not found")
    now = datetime.now(UTC)
    if drive.status == "closed" or drive.closed_at is not None or (
        drive.application_deadline is not None
        and _utc(drive.application_deadline) < now
    ):
        raise PlacementConflictError("Placement job is closed for registrations")
    if drive.status not in PUBLIC_STATUSES:
        raise PlacementNotFoundError("Placement job not found")
    eligibility_status, reasons, allowed = _eligibility(drive, student)
    if not allowed:
        raise PlacementValidationError(
            "Student is not eligible: " + "; ".join(reasons)
        )
    existing = await session.scalar(
        select(PlacementRegistration).where(
            PlacementRegistration.student_id == student_id,
            PlacementRegistration.placement_drive_id == drive.id,
        )
    )
    if existing is not None:
        raise PlacementConflictError("Student is already registered")
    requirements = await _loaded_requirements(session, drive.id)
    score = _score(requirements, await _possessed_skills(session, student_id))
    registration = PlacementRegistration(
        student_id=student_id,
        placement_drive_id=drive.id,
        status="registered",
        match_score=score.final_score,
        deterministic_score=score.deterministic_score,
        semantic_score=score.semantic_score,
        verification_bonus=score.verification_bonus,
        notes=payload.notes,
    )
    session.add(registration)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise PlacementConflictError("Student is already registered") from exc
    session.add(
        PlacementStatusEvent(
            placement_registration_id=registration.id,
            old_stage=None,
            new_stage="applied",
            actor_id=student_id,
            actor_role="student",
            source="student_registration",
            note=None,
            created_at=datetime.now(UTC),
        )
    )
    session.add(
        _audit(
            student_id,
            "placement_registration_created",
            "placement_registration",
            registration.id,
            {
                "placement_drive_id": str(drive.id),
                "eligibility_status": eligibility_status,
                "formula_version": SCORE_VERSION,
            },
        )
    )
    await session.commit()
    await session.refresh(registration)
    return await _drive_response(
        session, drive, student=student, registration=registration
    )


async def rank_placement_candidates(
    session: AsyncSession,
    placement_drive_id: UUID,
    recruiter_id: UUID,
    *,
    page: int = 1,
    page_size: int = 100,
    recompute_scores: bool = True,
) -> list[PlacementCandidateRanking]:
    drive = await _owned_drive(session, placement_drive_id, recruiter_id)
    requirements = await _loaded_requirements(session, drive.id)
    registrations = list(
        (
            await session.scalars(
                select(PlacementRegistration)
                .where(PlacementRegistration.placement_drive_id == drive.id)
                .options(selectinload(PlacementRegistration.student))
            )
        ).all()
    )
    results: list[PlacementCandidateRanking] = []
    for registration in registrations:
        score = _score(
            requirements,
            await _possessed_skills(session, registration.student_id),
        )
        if recompute_scores:
            registration.match_score = score.final_score
            registration.deterministic_score = score.deterministic_score
            registration.semantic_score = score.semantic_score
            registration.verification_bonus = score.verification_bonus
        matched, missing, preferred, evidence = _component_names(requirements, score)
        eligibility_status, reasons, _ = _eligibility(drive, registration.student)
        results.append(
            PlacementCandidateRanking(
                registration_id=registration.id,
                student_id=registration.student_id,
                student_name=(
                    registration.student.full_name
                    if registration.student
                    else "Unavailable student"
                ),
                student_email=(
                    registration.student.email
                    if registration.student
                    else "unavailable@example.invalid"
                ),
                stage=registration.status,
                match_score=float(registration.match_score),
                deterministic_score=float(registration.deterministic_score),
                semantic_score=float(registration.semantic_score),
                verification_bonus=float(registration.verification_bonus),
                matched_skills=matched,
                missing_skills=missing,
                preferred_skills=preferred,
                evidence_references=evidence,
                eligibility_status=eligibility_status,
                eligibility_reasons=reasons,
                formula_version=SCORE_VERSION,
                registered_at=registration.registered_at,
                interview_date=registration.interview_date,
                offer_details=registration.offer_details,
                allowed_next_stages=allowed_placement_transitions(
                    registration.status
                ),
            )
        )
    await session.commit()
    ordered = sorted(
        results,
        key=lambda item: (-item.match_score, item.registered_at, str(item.student_id)),
    )
    start = (page - 1) * page_size
    return ordered[start : start + page_size]


async def update_placement_stage(
    session: AsyncSession,
    registration_id: UUID,
    recruiter_id: UUID,
    payload: PlacementRegistrationStageUpdate,
) -> PlacementCandidateRanking:
    registration = await session.scalar(
        select(PlacementRegistration)
        .where(PlacementRegistration.id == registration_id)
        .options(
            selectinload(PlacementRegistration.drive),
            selectinload(PlacementRegistration.student),
        )
    )
    if (
        registration is None
        or registration.drive is None
        or registration.drive.recruiter_id != recruiter_id
    ):
        raise PlacementNotFoundError("Placement registration not found")
    previous_stage = normalized_placement_stage(registration.status)
    target_stage = normalized_placement_stage(payload.stage)
    if target_stage not in PLACEMENT_TRANSITIONS.get(previous_stage, ()):
        raise PlacementConflictError(
            f"Transition from {previous_stage} to {target_stage} is not allowed"
        )
    registration.status = payload.stage
    if payload.interview_date is not None:
        registration.interview_date = payload.interview_date
    if payload.interview_notes is not None:
        registration.interview_notes = payload.interview_notes
    if payload.offer_details is not None:
        registration.offer_details = payload.offer_details
    session.add(
        PlacementStatusEvent(
            placement_registration_id=registration.id,
            old_stage=previous_stage,
            new_stage=target_stage,
            actor_id=recruiter_id,
            actor_role="recruiter",
            source="recruiter_pipeline",
            note=payload.note,
            created_at=datetime.now(UTC),
        )
    )
    await session.commit()
    ranked = await rank_placement_candidates(
        session,
        registration.placement_drive_id,
        recruiter_id,
        recompute_scores=False,
    )
    return next(item for item in ranked if item.registration_id == registration.id)


async def placement_registration_timeline(
    session: AsyncSession,
    registration_id: UUID,
    recruiter_id: UUID,
) -> list[PlacementStatusEventResponse]:
    registration = await session.scalar(
        select(PlacementRegistration)
        .where(PlacementRegistration.id == registration_id)
        .options(selectinload(PlacementRegistration.drive))
    )
    if (
        registration is None
        or registration.drive is None
        or registration.drive.recruiter_id != recruiter_id
    ):
        raise PlacementNotFoundError("Placement registration not found")
    events = list(
        (
            await session.scalars(
                select(PlacementStatusEvent)
                .where(
                    PlacementStatusEvent.placement_registration_id
                    == registration_id
                )
                .order_by(PlacementStatusEvent.created_at, PlacementStatusEvent.id)
            )
        ).all()
    )
    return [PlacementStatusEventResponse.model_validate(event) for event in events]


async def withdraw_placement_registration(
    session: AsyncSession,
    registration_id: UUID,
    student_id: UUID,
) -> None:
    registration = await session.get(PlacementRegistration, registration_id)
    if registration is None or registration.student_id != student_id:
        raise PlacementNotFoundError("Placement registration not found")
    previous_stage = normalized_placement_stage(registration.status)
    if previous_stage not in PLACEMENT_WITHDRAWAL_STAGES:
        raise PlacementConflictError(
            f"A placement application in {previous_stage} cannot be withdrawn"
        )
    registration.status = "withdrawn"
    session.add(
        PlacementStatusEvent(
            placement_registration_id=registration.id,
            old_stage=previous_stage,
            new_stage="withdrawn",
            actor_id=student_id,
            actor_role="student",
            source="student_withdrawal",
            note=None,
            created_at=datetime.now(UTC),
        )
    )
    session.add(
        _audit(
            student_id,
            "placement_registration_withdrawn",
            "placement_registration",
            registration.id,
            {"from_stage": previous_stage, "to_stage": "withdrawn"},
        )
    )
    await session.commit()
