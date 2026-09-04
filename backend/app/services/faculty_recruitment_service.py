"""Faculty Recruitment and Interview Lifecycle Service.

Allows Institutes/Universities to:
- Post, manage, and close faculty job openings.
- Review applicant academic passports, CVs, and statements of purpose.
- Schedule video / in-person interviews (with Google Meet/Zoom links or campus venues).
- Record interview notes, ratings, and finalize hiring decisions (offered, shortlisted, rejected).

Allows Faculty/Academicians to:
- Browse open faculty openings across universities with multi-parameter search.
- Submit structured academic job applications.
- Track application status and view interview schedules with direct join links.
"""

from datetime import UTC, datetime
from uuid import UUID
import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Academician,
    FacultyJobApplication,
    FacultyNotification,
    Institution,
    InstitutionFacultyJob,
)
from app.schemas.contracts import (
    FacultyJobApplicationCreate,
    FacultyJobApplicationListResponse,
    FacultyJobApplicationResponse,
    InstitutionFacultyJobCreate,
    InstitutionFacultyJobListResponse,
    InstitutionFacultyJobResponse,
    InstitutionFacultyJobUpdate,
    InterviewDecisionRequest,
    InterviewScheduleRequest,
)


def _to_job_response(
    job: InstitutionFacultyJob,
    applications_count: int = 0,
    has_applied: bool = False,
    my_application_status: str | None = None,
) -> InstitutionFacultyJobResponse:
    return InstitutionFacultyJobResponse(
        id=job.id,
        institution_id=job.institution_id,
        institution_name=job.institution_name,
        title=job.title,
        department=job.department,
        designation=job.designation,
        employment_type=job.employment_type,
        min_experience_years=job.min_experience_years,
        qualification_required=job.qualification_required,
        skills_required=job.skills_required or [],
        research_areas=job.research_areas or [],
        salary_range_lpa=job.salary_range_lpa,
        location=job.location,
        openings_count=job.openings_count,
        deadline=job.deadline,
        description=job.description,
        responsibilities=job.responsibilities or [],
        benefits=job.benefits or [],
        status=job.status,
        created_at=job.created_at,
        updated_at=job.updated_at,
        applications_count=applications_count,
        has_applied=has_applied,
        my_application_status=my_application_status,
    )


def _to_application_response(
    app: FacultyJobApplication,
    faculty: Academician | None = None,
    job: InstitutionFacultyJob | None = None,
) -> FacultyJobApplicationResponse:
    f_name = faculty.full_name if faculty else None
    f_email = faculty.email if faculty else None
    f_dept = faculty.department if faculty else None
    f_desig = faculty.designation if faculty else None
    f_research = faculty.research_areas if faculty and faculty.research_areas else []

    j_title = job.title if job else None
    j_inst = job.institution_name if job else None
    j_dept = job.department if job else None
    j_desig = job.designation if job else None

    return FacultyJobApplicationResponse(
        id=app.id,
        job_id=app.job_id,
        faculty_id=app.faculty_id,
        status=app.status,
        statement_of_purpose=app.statement_of_purpose,
        research_statement=app.research_statement,
        teaching_philosophy=app.teaching_philosophy,
        current_institution=app.current_institution,
        current_designation=app.current_designation,
        years_of_experience=app.years_of_experience,
        notice_period_days=app.notice_period_days,
        cv_url=app.cv_url,
        interview_details=app.interview_details or {},
        applied_at=app.applied_at,
        updated_at=app.updated_at,
        faculty_name=f_name,
        faculty_email=f_email,
        faculty_department=f_dept,
        faculty_designation=f_desig,
        faculty_research_areas=f_research,
        job_title=j_title,
        institution_name=j_inst,
        department=j_dept,
        designation=j_desig,
    )


# -----------------------------------------------------------------------------
# Institution Operations
# -----------------------------------------------------------------------------

async def create_faculty_job(
    session: AsyncSession,
    institution_id: UUID,
    institution_name: str,
    payload: InstitutionFacultyJobCreate,
) -> InstitutionFacultyJobResponse:
    job = InstitutionFacultyJob(
        institution_id=institution_id,
        institution_name=institution_name,
        title=payload.title,
        department=payload.department,
        designation=payload.designation,
        employment_type=payload.employment_type,
        min_experience_years=payload.min_experience_years,
        qualification_required=payload.qualification_required,
        skills_required=payload.skills_required,
        research_areas=payload.research_areas,
        salary_range_lpa=payload.salary_range_lpa,
        location=payload.location,
        openings_count=payload.openings_count,
        deadline=payload.deadline,
        description=payload.description,
        responsibilities=payload.responsibilities,
        benefits=payload.benefits,
        status=payload.status,
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    return _to_job_response(job, applications_count=0)


async def update_faculty_job(
    session: AsyncSession,
    institution_id: UUID,
    job_id: UUID,
    payload: InstitutionFacultyJobUpdate,
) -> InstitutionFacultyJobResponse:
    stmt = select(InstitutionFacultyJob).where(
        InstitutionFacultyJob.id == job_id,
        InstitutionFacultyJob.institution_id == institution_id,
    )
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job:
        raise ValueError("Faculty job posting not found or not owned by your institution")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, val)

    job.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(job)

    count_stmt = select(func.count(FacultyJobApplication.id)).where(FacultyJobApplication.job_id == job.id)
    app_count = (await session.execute(count_stmt)).scalar() or 0

    return _to_job_response(job, applications_count=app_count)


async def delete_faculty_job(
    session: AsyncSession,
    institution_id: UUID,
    job_id: UUID,
) -> bool:
    stmt = select(InstitutionFacultyJob).where(
        InstitutionFacultyJob.id == job_id,
        InstitutionFacultyJob.institution_id == institution_id,
    )
    job = (await session.execute(stmt)).scalar_one_or_none()
    if not job:
        raise ValueError("Faculty job posting not found or unauthorized")

    await session.delete(job)
    await session.commit()
    return True


async def list_institution_faculty_jobs(
    session: AsyncSession,
    institution_id: UUID,
) -> InstitutionFacultyJobListResponse:
    stmt = (
        select(InstitutionFacultyJob)
        .where(InstitutionFacultyJob.institution_id == institution_id)
        .order_by(InstitutionFacultyJob.created_at.desc())
    )
    jobs = list((await session.execute(stmt)).scalars().all())

    # Fetch application counts per job
    job_ids = [j.id for j in jobs]
    count_map: dict[UUID, int] = {}
    if job_ids:
        c_stmt = (
            select(FacultyJobApplication.job_id, func.count(FacultyJobApplication.id))
            .where(FacultyJobApplication.job_id.in_(job_ids))
            .group_by(FacultyJobApplication.job_id)
        )
        for jid, cnt in (await session.execute(c_stmt)).all():
            count_map[jid] = cnt

    departments = sorted({j.department for j in jobs if j.department})
    designations = sorted({j.designation for j in jobs if j.designation})

    return InstitutionFacultyJobListResponse(
        total=len(jobs),
        items=[_to_job_response(j, applications_count=count_map.get(j.id, 0)) for j in jobs],
        departments=departments,
        designations=designations,
        institutions=[],
    )


# -----------------------------------------------------------------------------
# Academician / Public Discovery
# -----------------------------------------------------------------------------

async def list_open_faculty_jobs(
    session: AsyncSession,
    department: str | None = None,
    designation: str | None = None,
    institution_name: str | None = None,
    search: str | None = None,
    faculty_id: UUID | None = None,
) -> InstitutionFacultyJobListResponse:
    query = select(InstitutionFacultyJob).where(InstitutionFacultyJob.status == "open")

    if department and department.strip() and department.lower() != "all":
        query = query.where(InstitutionFacultyJob.department.ilike(f"%{department.strip()}%"))
    if designation and designation.strip() and designation.lower() != "all":
        query = query.where(InstitutionFacultyJob.designation.ilike(f"%{designation.strip()}%"))
    if institution_name and institution_name.strip() and institution_name.lower() != "all":
        query = query.where(InstitutionFacultyJob.institution_name.ilike(f"%{institution_name.strip()}%"))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                InstitutionFacultyJob.title.ilike(term),
                InstitutionFacultyJob.description.ilike(term),
                InstitutionFacultyJob.department.ilike(term),
                InstitutionFacultyJob.institution_name.ilike(term),
            )
        )

    query = query.order_by(InstitutionFacultyJob.created_at.desc())
    jobs = list((await session.execute(query)).scalars().all())

    # If faculty_id is provided, check application status
    user_app_map: dict[UUID, str] = {}
    if faculty_id and jobs:
        job_ids = [j.id for j in jobs]
        apps_stmt = select(FacultyJobApplication).where(
            FacultyJobApplication.faculty_id == faculty_id,
            FacultyJobApplication.job_id.in_(job_ids),
        )
        for app in (await session.execute(apps_stmt)).scalars().all():
            user_app_map[app.job_id] = app.status

    dept_stmt = select(InstitutionFacultyJob.department).distinct()
    desig_stmt = select(InstitutionFacultyJob.designation).distinct()
    inst_stmt = select(InstitutionFacultyJob.institution_name).distinct()

    departments = sorted([d for d in (await session.scalars(dept_stmt)).all() if d])
    designations = sorted([d for d in (await session.scalars(desig_stmt)).all() if d])
    institutions = sorted([i for i in (await session.scalars(inst_stmt)).all() if i])

    items = [
        _to_job_response(
            j,
            has_applied=(j.id in user_app_map),
            my_application_status=user_app_map.get(j.id),
        )
        for j in jobs
    ]

    return InstitutionFacultyJobListResponse(
        total=len(jobs),
        items=items,
        departments=departments,
        designations=designations,
        institutions=institutions,
    )


async def apply_for_faculty_job(
    session: AsyncSession,
    faculty_id: UUID,
    payload: FacultyJobApplicationCreate,
) -> FacultyJobApplicationResponse:
    # 1. Check job exists and is open
    job = await session.get(InstitutionFacultyJob, payload.job_id)
    if not job:
        raise ValueError("Faculty vacancy not found")
    if job.status != "open":
        raise ValueError("This faculty position is no longer accepting applications")

    # 2. Check if already applied
    existing_stmt = select(FacultyJobApplication).where(
        FacultyJobApplication.job_id == payload.job_id,
        FacultyJobApplication.faculty_id == faculty_id,
    )
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise ValueError("You have already submitted an application for this position")

    # 3. Get faculty record
    faculty = await session.get(Academician, faculty_id)
    if not faculty:
        raise ValueError("Faculty profile not found")

    app = FacultyJobApplication(
        job_id=job.id,
        faculty_id=faculty.id,
        status="applied",
        statement_of_purpose=payload.statement_of_purpose,
        research_statement=payload.research_statement,
        teaching_philosophy=payload.teaching_philosophy,
        current_institution=payload.current_institution or faculty.institution_name,
        current_designation=payload.current_designation or faculty.designation,
        years_of_experience=payload.years_of_experience or faculty.years_experience,
        notice_period_days=payload.notice_period_days,
        cv_url=payload.cv_url,
        interview_details={},
    )
    session.add(app)

    # Optional: notification for faculty
    notif = FacultyNotification(
        faculty_id=faculty.id,
        title="Application Submitted",
        message=f"Your application for '{job.title}' at {job.institution_name} has been received.",
        category="job_application",
        is_read=False,
    )
    session.add(notif)

    await session.commit()
    await session.refresh(app)

    return _to_application_response(app, faculty=faculty, job=job)


async def list_applications_for_job(
    session: AsyncSession,
    institution_id: UUID,
    job_id: UUID,
) -> FacultyJobApplicationListResponse:
    job = await session.get(InstitutionFacultyJob, job_id)
    if not job or job.institution_id != institution_id:
        raise ValueError("Job not found or access denied")

    stmt = (
        select(FacultyJobApplication, Academician)
        .join(Academician, FacultyJobApplication.faculty_id == Academician.id)
        .where(FacultyJobApplication.job_id == job_id)
        .order_by(FacultyJobApplication.applied_at.desc())
    )
    results = (await session.execute(stmt)).all()

    items = [_to_application_response(app, faculty=fac, job=job) for app, fac in results]
    return FacultyJobApplicationListResponse(total=len(items), items=items)


async def list_all_applications_for_institution(
    session: AsyncSession,
    institution_id: UUID,
) -> FacultyJobApplicationListResponse:
    stmt = (
        select(FacultyJobApplication, Academician, InstitutionFacultyJob)
        .join(InstitutionFacultyJob, FacultyJobApplication.job_id == InstitutionFacultyJob.id)
        .join(Academician, FacultyJobApplication.faculty_id == Academician.id)
        .where(InstitutionFacultyJob.institution_id == institution_id)
        .order_by(FacultyJobApplication.applied_at.desc())
    )
    results = (await session.execute(stmt)).all()

    items = [_to_application_response(app, faculty=fac, job=job) for app, fac, job in results]
    return FacultyJobApplicationListResponse(total=len(items), items=items)


async def list_faculty_own_applications(
    session: AsyncSession,
    faculty_id: UUID,
) -> FacultyJobApplicationListResponse:
    stmt = (
        select(FacultyJobApplication, InstitutionFacultyJob)
        .join(InstitutionFacultyJob, FacultyJobApplication.job_id == InstitutionFacultyJob.id)
        .where(FacultyJobApplication.faculty_id == faculty_id)
        .order_by(FacultyJobApplication.applied_at.desc())
    )
    results = (await session.execute(stmt)).all()

    faculty = await session.get(Academician, faculty_id)
    items = [_to_application_response(app, faculty=faculty, job=job) for app, job in results]
    return FacultyJobApplicationListResponse(total=len(items), items=items)


# -----------------------------------------------------------------------------
# Interview Scheduling & Evaluation
# -----------------------------------------------------------------------------

async def schedule_faculty_interview(
    session: AsyncSession,
    institution_id: UUID,
    application_id: UUID,
    payload: InterviewScheduleRequest,
) -> FacultyJobApplicationResponse:
    stmt = (
        select(FacultyJobApplication, Academician, InstitutionFacultyJob)
        .join(InstitutionFacultyJob, FacultyJobApplication.job_id == InstitutionFacultyJob.id)
        .join(Academician, FacultyJobApplication.faculty_id == Academician.id)
        .where(
            FacultyJobApplication.id == application_id,
            InstitutionFacultyJob.institution_id == institution_id,
        )
    )
    result = (await session.execute(stmt)).first()
    if not result:
        raise ValueError("Application not found or unauthorized")

    app, faculty, job = result

    interview_data = {
        "scheduled_at": payload.scheduled_at.isoformat(),
        "mode": payload.mode,
        "meeting_link": payload.meeting_link,
        "venue": payload.venue,
        "panel_members": payload.panel_members,
        "instructions": payload.instructions,
        "status": "scheduled",
    }
    app.interview_details = interview_data
    app.status = "interview_scheduled"
    app.updated_at = datetime.now(UTC)

    # Notify faculty
    meeting_info = f"via {payload.meeting_link}" if payload.mode == "online" and payload.meeting_link else f"at {payload.venue}"
    notif = FacultyNotification(
        faculty_id=faculty.id,
        title="Faculty Interview Scheduled!",
        message=(
            f"An interview for '{job.title}' has been scheduled by {job.institution_name} "
            f"on {payload.scheduled_at.strftime('%b %d, %Y %I:%M %p')} ({payload.mode.capitalize()} {meeting_info})."
        ),
        category="interview_scheduled",
        is_read=False,
    )
    session.add(notif)

    await session.commit()
    await session.refresh(app)
    return _to_application_response(app, faculty=faculty, job=job)


async def record_interview_decision(
    session: AsyncSession,
    institution_id: UUID,
    application_id: UUID,
    payload: InterviewDecisionRequest,
) -> FacultyJobApplicationResponse:
    stmt = (
        select(FacultyJobApplication, Academician, InstitutionFacultyJob)
        .join(InstitutionFacultyJob, FacultyJobApplication.job_id == InstitutionFacultyJob.id)
        .join(Academician, FacultyJobApplication.faculty_id == Academician.id)
        .where(
            FacultyJobApplication.id == application_id,
            InstitutionFacultyJob.institution_id == institution_id,
        )
    )
    result = (await session.execute(stmt)).first()
    if not result:
        raise ValueError("Application not found or unauthorized")

    app, faculty, job = result

    # Merge or initialize interview details
    details = dict(app.interview_details or {})
    if payload.rating is not None:
        details["rating"] = payload.rating
    if payload.feedback:
        details["feedback"] = payload.feedback
    if payload.notes:
        details["notes"] = payload.notes
    if payload.offer_details:
        details["offer_details"] = payload.offer_details
    details["decision_at"] = datetime.now(UTC).isoformat()
    details["decision"] = payload.status

    app.interview_details = details
    app.status = payload.status
    app.updated_at = datetime.now(UTC)

    # Notify faculty
    status_label = {
        "offered": "Formal Offer Extended",
        "shortlisted": "Shortlisted for Final Round",
        "rejected": "Application Status Update",
    }.get(payload.status, f"Status: {payload.status}")

    notif = FacultyNotification(
        faculty_id=faculty.id,
        title=f"Faculty Recruitment: {status_label}",
        message=f"{job.institution_name} has updated your status for '{job.title}' to '{payload.status.replace('_', ' ').capitalize()}'.",
        category="job_decision",
        is_read=False,
    )
    session.add(notif)

    await session.commit()
    await session.refresh(app)
    return _to_application_response(app, faculty=faculty, job=job)
