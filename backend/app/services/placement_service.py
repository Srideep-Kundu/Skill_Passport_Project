"""Campus Placement & Job Drive Engine.

Handles placement drive scheduling, deterministic candidate ranking using the
shared scoring formula (0.65D + 0.25S + 0.10V), recruiter candidate management,
and student interview/offer lifecycle.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    PlacementDrive,
    PlacementRegistration,
    Skill,
    StudentSkill,
)
from app.schemas.contracts import (
    PlacementCandidateRanking,
    PlacementDriveCreate,
    PlacementDriveResponse,
    PlacementRegistrationRequest,
    PlacementRegistrationStageUpdate,
)
from app.services.matching_service import (
    TIER_MULTIPLIER,
    PossessedSkill,
    RequirementInput,
    calculate_score,
)


async def list_placement_drives(
    session: AsyncSession,
    student_id: UUID | None = None,
    recruiter_id: UUID | None = None,
) -> list[PlacementDriveResponse]:
    query = select(PlacementDrive).order_by(PlacementDrive.drive_date.desc())
    if recruiter_id:
        query = query.where(PlacementDrive.recruiter_id == recruiter_id)

    drives = (await session.scalars(query)).all()

    reg_map: dict[UUID, PlacementRegistration] = {}
    if student_id:
        regs = (
            await session.scalars(
                select(PlacementRegistration).where(PlacementRegistration.student_id == student_id)
            )
        ).all()
        reg_map = {r.placement_drive_id: r for r in regs}

    results: list[PlacementDriveResponse] = []
    for d in drives:
        reg = reg_map.get(d.id)
        results.append(
            PlacementDriveResponse(
                id=d.id,
                company_name=d.company_name,
                title=d.title,
                description=d.description,
                role_type=d.role_type,
                ctc_lpa=float(d.ctc_lpa),
                eligible_departments=d.eligible_departments,
                minimum_cgpa=float(d.minimum_cgpa),
                passing_year=d.passing_year,
                drive_date=d.drive_date,
                status=d.status,
                required_skills=d.required_skills,
                is_registered=reg is not None,
                registration_status=reg.status if reg else None,
            )
        )
    return results


async def create_placement_drive(
    session: AsyncSession,
    recruiter_id: UUID,
    payload: PlacementDriveCreate,
) -> PlacementDriveResponse:
    drive = PlacementDrive(
        recruiter_id=recruiter_id,
        company_name=payload.company_name,
        title=payload.title,
        description=payload.description,
        role_type=payload.role_type,
        ctc_lpa=payload.ctc_lpa,
        eligible_departments=payload.eligible_departments,
        minimum_cgpa=payload.minimum_cgpa,
        passing_year=payload.passing_year,
        drive_date=payload.drive_date,
        status="active",
        required_skills=payload.required_skills,
    )
    session.add(drive)
    await session.commit()
    await session.refresh(drive)

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
        required_skills=drive.required_skills,
        is_registered=False,
        registration_status=None,
    )


async def register_for_placement(
    session: AsyncSession,
    student_id: UUID,
    payload: PlacementRegistrationRequest,
) -> PlacementDriveResponse:
    drive = await session.get(PlacementDrive, payload.placement_drive_id)
    if not drive:
        raise ValueError("Placement drive not found")

    existing = (
        await session.scalars(
            select(PlacementRegistration).where(
                PlacementRegistration.student_id == student_id,
                PlacementRegistration.placement_drive_id == drive.id,
            )
        )
    ).first()
    if existing:
        return (await list_placement_drives(session, student_id))[0]

    # Compute deterministic match score for this registration
    req_skills = (
        await session.scalars(
            select(Skill).where(Skill.canonical_name.in_(drive.required_skills))
        )
    ).all()

    req_inputs = [
        RequirementInput(
            skill_id=s.id,
            weight=1.0,
            is_required=True,
            embedding=s.embedding,
        )
        for s in req_skills
    ]

    st_skills = (
        await session.scalars(
            select(StudentSkill)
            .where(StudentSkill.student_id == student_id)
            .options(selectinload(StudentSkill.skill))
        )
    ).all()

    possessed = [
        PossessedSkill(
            skill_id=item.skill_id,
            evidence_id=item.source_evidence_id,
            effective_confidence=float(item.extraction_confidence)
            * TIER_MULTIPLIER.get(item.verification_tier.value, 0.65),
            verification_tier=item.verification_tier.value,
            embedding=item.skill.embedding if item.skill else None,
            extraction_confidence=float(item.extraction_confidence),
        )
        for item in st_skills
    ]

    score_res = calculate_score(req_inputs, possessed) if req_inputs else None

    registration = PlacementRegistration(
        student_id=student_id,
        placement_drive_id=drive.id,
        status="registered",
        match_score=score_res.final_score if score_res else 0.5,
        deterministic_score=score_res.deterministic_score if score_res else 0.5,
        semantic_score=score_res.semantic_score if score_res else 0.0,
        verification_bonus=score_res.verification_bonus if score_res else 0.0,
        notes=payload.notes,
    )
    session.add(registration)
    await session.commit()

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
        required_skills=drive.required_skills,
        is_registered=True,
        registration_status="registered",
    )


async def rank_placement_candidates(
    session: AsyncSession,
    placement_drive_id: UUID,
    recruiter_id: UUID,
) -> list[PlacementCandidateRanking]:
    drive = await session.get(PlacementDrive, placement_drive_id)
    if not drive:
        raise ValueError("Placement drive not found")

    registrations = (
        await session.scalars(
            select(PlacementRegistration)
            .where(PlacementRegistration.placement_drive_id == placement_drive_id)
            .options(selectinload(PlacementRegistration.student))
            .order_by(PlacementRegistration.match_score.desc())
        )
    ).all()

    results = []
    for reg in registrations:
        st_skills = (
            await session.scalars(
                select(StudentSkill)
                .where(StudentSkill.student_id == reg.student_id)
                .options(selectinload(StudentSkill.skill))
            )
        ).all()

        possessed_names = {item.skill.canonical_name for item in st_skills if item.skill}
        matched = [s for s in drive.required_skills if s.casefold() in {p.casefold() for p in possessed_names}]
        missing = [s for s in drive.required_skills if s.casefold() not in {p.casefold() for p in possessed_names}]

        results.append(
            PlacementCandidateRanking(
                registration_id=reg.id,
                student_id=reg.student_id,
                student_name=reg.student.full_name if reg.student else "Student Candidate",
                student_email=reg.student.email if reg.student else "candidate@email.com",
                stage=reg.status,
                match_score=float(reg.match_score),
                deterministic_score=float(reg.deterministic_score),
                semantic_score=float(reg.semantic_score),
                verification_bonus=float(reg.verification_bonus),
                matched_skills=matched,
                missing_skills=missing,
                registered_at=reg.registered_at,
                interview_date=reg.interview_date,
                offer_details=reg.offer_details,
            )
        )

    # Deterministic sort: match_score desc, registered_at asc
    results.sort(key=lambda x: (-x.match_score, str(x.registered_at)))
    return results


async def update_placement_stage(
    session: AsyncSession,
    registration_id: UUID,
    recruiter_id: UUID,
    payload: PlacementRegistrationStageUpdate,
) -> PlacementCandidateRanking:
    registration = (
        await session.scalars(
            select(PlacementRegistration)
            .where(PlacementRegistration.id == registration_id)
            .options(
                selectinload(PlacementRegistration.drive),
                selectinload(PlacementRegistration.student),
            )
        )
    ).first()
    if not registration:
        raise ValueError("Placement registration not found")

    registration.status = payload.stage
    if payload.interview_date is not None:
        registration.interview_date = payload.interview_date
    if payload.interview_notes is not None:
        registration.interview_notes = payload.interview_notes
    if payload.offer_details is not None:
        registration.offer_details = payload.offer_details

    await session.commit()
    await session.refresh(registration)

    return PlacementCandidateRanking(
        registration_id=registration.id,
        student_id=registration.student_id,
        student_name=registration.student.full_name if registration.student else "Student Candidate",
        student_email=registration.student.email if registration.student else "candidate@email.com",
        stage=registration.status,
        match_score=float(registration.match_score),
        deterministic_score=float(registration.deterministic_score),
        semantic_score=float(registration.semantic_score),
        verification_bonus=float(registration.verification_bonus),
        matched_skills=registration.drive.required_skills if registration.drive else [],
        missing_skills=[],
        registered_at=registration.registered_at,
        interview_date=registration.interview_date,
        offer_details=registration.offer_details,
    )
