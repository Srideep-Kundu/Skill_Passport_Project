"""Industry-Side Skill Demand & Talent Pipeline Analytics.

Computes skill supply vs demand ratios, applicant skill gaps, and recruitment
funnel metrics from real platform data for corporate recruiters.
"""
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Internship,
    InternshipEngagement,
    PlacementDrive,
    PlacementRegistration,
)
from app.schemas.contracts import APIModel
from app.services.demand_supply_service import recruiter_demand_analytics


class RecruiterSkillMetric(APIModel):
    skill_name: str
    required_in_postings_count: int
    applicant_pool_count: int
    supply_demand_ratio: float
    market_status: str  # high_demand_shortage, balanced, abundant_supply


class RecruiterAnalyticsOverview(APIModel):
    company_name: str
    active_postings: int
    total_applicants: int
    shortlisted_candidates: int
    interviews_scheduled: int
    offers_extended: int
    offers_accepted: int
    top_demanded_skills: list[RecruiterSkillMetric]
    most_common_applicant_gaps: list[dict[str, str | int]]
    recruitment_funnel: list[dict[str, str | int]]


async def get_recruiter_skill_analytics(
    session: AsyncSession,
    recruiter_id: UUID,
    company_name: str,
) -> RecruiterAnalyticsOverview:
    # 1. Count recruiter postings
    internships_count = (
        await session.scalar(
            select(func.count(Internship.id)).where(Internship.recruiter_id == recruiter_id)
        )
    ) or 0
    drives_count = (
        await session.scalar(
            select(func.count(PlacementDrive.id)).where(PlacementDrive.recruiter_id == recruiter_id)
        )
    ) or 0
    total_postings = internships_count + drives_count

    # 2. Recruitment Funnel from PlacementRegistrations & InternshipEngagements
    engagements = (
        await session.scalars(
            select(InternshipEngagement).where(InternshipEngagement.recruiter_id == recruiter_id)
        )
    ).all()

    drives = (
        await session.scalars(
            select(PlacementDrive.id).where(PlacementDrive.recruiter_id == recruiter_id)
        )
    ).all()
    drive_ids = list(drives)

    registrations: Sequence[PlacementRegistration] = ()
    if drive_ids:
        registrations = (
            await session.scalars(
                select(PlacementRegistration).where(PlacementRegistration.placement_drive_id.in_(drive_ids))
            )
        ).all()

    total_apps = len(engagements) + len(registrations)
    shortlisted = len([e for e in engagements if e.status in ("shortlisted", "selected", "active", "completed")]) + len([r for r in registrations if r.status in ("shortlisted", "interview_scheduled", "interviewed", "offered", "accepted")])
    interviews = len([r for r in registrations if r.status in ("interview_scheduled", "interviewed", "offered", "accepted")])
    offered = len([r for r in registrations if r.status in ("offered", "accepted")]) + len([e for e in engagements if e.status in ("selected", "active", "completed")])
    accepted = len([r for r in registrations if r.status == "accepted"]) + len([e for e in engagements if e.status == "completed"])

    funnel: list[dict[str, str | int]] = [
        {"stage": "Applications Received", "count": total_apps},
        {"stage": "Skill-Matched Shortlist", "count": shortlisted},
        {"stage": "Technical Interviews", "count": interviews},
        {"stage": "Offers Extended", "count": offered},
        {"stage": "Offers Accepted", "count": accepted},
    ]

    # 3. Top Demanded Skills vs Supply
    # Aggregate skill demand from requirements
    demand = await recruiter_demand_analytics(session, recruiter_id)
    skill_metrics: list[RecruiterSkillMetric] = []
    for row in demand.skills:
        ratio = round(row.candidate_supply / row.demand_count, 2)
        status = "high_demand_shortage" if ratio < 1.5 else "balanced" if ratio < 3.5 else "abundant_supply"

        skill_metrics.append(
            RecruiterSkillMetric(
                skill_name=row.skill_name,
                required_in_postings_count=row.demand_count,
                applicant_pool_count=row.candidate_supply,
                supply_demand_ratio=ratio,
                market_status=status,
            )
        )

    gaps: list[dict[str, str | int]] = [
        {
            "skill": row.skill_name,
            "gap_percentage": (
                f"{round(100 * max(row.gap, 0) / row.demand_count)}%"
                if row.demand_count
                else "0%"
            ),
            "impact": "Shortage" if row.gap > 0 else "Covered",
        }
        for row in demand.skills
        if row.gap > 0
    ]

    return RecruiterAnalyticsOverview(
        company_name=company_name,
        active_postings=total_postings,
        total_applicants=total_apps,
        shortlisted_candidates=shortlisted,
        interviews_scheduled=interviews,
        offers_extended=offered,
        offers_accepted=accepted,
        top_demanded_skills=skill_metrics,
        most_common_applicant_gaps=gaps,
        recruitment_funnel=funnel,
    )
