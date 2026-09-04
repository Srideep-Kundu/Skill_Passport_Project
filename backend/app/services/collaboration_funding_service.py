import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.domain import (
    Academician,
    FacultyProposal,
    FundingOpportunity,
    IndustryExpert,
    ProfessionalSociety,
    ProposalEvent,
)
from app.schemas.contracts import (
    FacultyProposalCreate,
    FacultyProposalListResponse,
    FacultyProposalResponse,
    FundingOpportunityListResponse,
    FundingOpportunityResponse,
    FundingRecommendationResponse,
    IndustryExpertListResponse,
    IndustryExpertResponse,
    ProfessionalSocietyListResponse,
    ProfessionalSocietyResponse,
    ProposalEventResponse,
)

logger = logging.getLogger(__name__)


# =============================================================================
# PROFESSIONAL SOCIETIES SERVICE
# =============================================================================

async def list_professional_societies(
    session: AsyncSession,
    domain: str | None = None,
    search: str | None = None,
) -> ProfessionalSocietyListResponse:
    query = select(ProfessionalSociety).order_by(ProfessionalSociety.name.asc())
    
    if domain and domain.lower() != "all":
        # Check if domain string is in the domains JSON list or matches
        query = query.where(
            or_(
                func.cast(ProfessionalSociety.domains, String).ilike(f"%{domain}%"),
                ProfessionalSociety.name.ilike(f"%{domain}%"),
            )
        )
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                ProfessionalSociety.name.ilike(search_pattern),
                ProfessionalSociety.short_name.ilike(search_pattern),
                ProfessionalSociety.description.ilike(search_pattern),
            )
        )

    results = (await session.scalars(query)).all()
    
    # Collect all unique domain tags
    all_domains_set = set()
    for soc in results:
        for d in soc.domains:
            all_domains_set.add(d)

    items = [
        ProfessionalSocietyResponse(
            id=soc.id,
            name=soc.name,
            short_name=soc.short_name,
            description=soc.description,
            website=soc.website,
            logo_url=soc.logo_url,
            domains=soc.domains,
            membership_fee=soc.membership_fee,
            benefits=soc.benefits,
            available_programs=soc.available_programs,
            expert_speakers=soc.expert_speakers,
            previous_collaborations=soc.previous_collaborations,
            contact_email=soc.contact_email,
            proposal_guidelines=soc.proposal_guidelines,
            sponsorship_available=soc.sponsorship_available,
            created_at=soc.created_at,
        )
        for soc in results
    ]

    return ProfessionalSocietyListResponse(
        total=len(items),
        items=items,
        all_domains=sorted(list(all_domains_set)) or ["AI/ML", "Cloud Computing", "Cybersecurity", "IoT", "Data Science", "Software Engineering"],
    )


async def get_professional_society_detail(
    session: AsyncSession,
    society_id: UUID,
) -> ProfessionalSocietyResponse | None:
    soc = await session.get(ProfessionalSociety, society_id)
    if not soc:
        return None
    return ProfessionalSocietyResponse(
        id=soc.id,
        name=soc.name,
        short_name=soc.short_name,
        description=soc.description,
        website=soc.website,
        logo_url=soc.logo_url,
        domains=soc.domains,
        membership_fee=soc.membership_fee,
        benefits=soc.benefits,
        available_programs=soc.available_programs,
        expert_speakers=soc.expert_speakers,
        previous_collaborations=soc.previous_collaborations,
        contact_email=soc.contact_email,
        proposal_guidelines=soc.proposal_guidelines,
        sponsorship_available=soc.sponsorship_available,
        created_at=soc.created_at,
    )


# =============================================================================
# INDUSTRY EXPERTS SERVICE
# =============================================================================

async def list_industry_experts(
    session: AsyncSession,
    expertise: str | None = None,
    search: str | None = None,
) -> IndustryExpertListResponse:
    query = select(IndustryExpert).order_by(desc(IndustryExpert.rating))

    if expertise and expertise.lower() != "all":
        query = query.where(
            func.cast(IndustryExpert.expertise_tags, String).ilike(f"%{expertise}%")
        )
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                IndustryExpert.name.ilike(search_pattern),
                IndustryExpert.organization.ilike(search_pattern),
                IndustryExpert.title.ilike(search_pattern),
                IndustryExpert.bio.ilike(search_pattern),
            )
        )

    results = (await session.scalars(query)).all()
    all_exp_set = set()
    for exp in results:
        for tag in exp.expertise_tags:
            all_exp_set.add(tag)

    items = [
        IndustryExpertResponse(
            id=exp.id,
            name=exp.name,
            organization=exp.organization,
            title=exp.title,
            expertise_tags=exp.expertise_tags,
            experience_years=exp.experience_years,
            speaking_fee=exp.speaking_fee,
            availability=exp.availability,
            bio=exp.bio,
            email=exp.email,
            rating=float(exp.rating),
            past_sessions_count=exp.past_sessions_count,
            avatar_url=exp.avatar_url,
        )
        for exp in results
    ]

    return IndustryExpertListResponse(
        total=len(items),
        items=items,
        all_expertise=sorted(list(all_exp_set)) or ["MLOps", "Kubernetes", "Generative AI", "Cybersecurity", "Cloud Architecture", "System Design"],
    )


# =============================================================================
# FUNDING EXPLORER & RECOMMENDATIONS
# =============================================================================

async def list_funding_opportunities(
    session: AsyncSession,
    domain: str | None = None,
    grant_type: str | None = None,
) -> FundingOpportunityListResponse:
    query = select(FundingOpportunity).where(FundingOpportunity.is_active.is_(True)).order_by(FundingOpportunity.deadline.asc())

    if domain and domain.lower() != "all":
        query = query.where(
            func.cast(FundingOpportunity.supported_domains, String).ilike(f"%{domain}%")
        )
    if grant_type and grant_type.lower() != "all":
        query = query.where(FundingOpportunity.grant_type == grant_type)

    results = (await session.scalars(query)).all()
    total_val = sum(float(r.amount_numeric) for r in results)
    grant_types = list({r.grant_type for r in results})

    items = [
        FundingOpportunityResponse(
            id=f.id,
            title=f.title,
            funding_organization=f.funding_organization,
            grant_type=f.grant_type,
            amount=f.amount,
            amount_numeric=float(f.amount_numeric),
            deadline=f.deadline,
            eligibility=f.eligibility,
            supported_domains=f.supported_domains,
            source_url=f.source_url,
            required_documents=f.required_documents,
            match_reason=f.match_reason_template or None,
            is_active=f.is_active,
            created_at=f.created_at,
        )
        for f in results
    ]

    return FundingOpportunityListResponse(
        total=len(items),
        items=items,
        total_funding_available=f"₹{total_val/100000:.1f} Lakhs" if total_val > 0 else "₹0",
        grant_types=grant_types,
    )


async def get_recommended_funding_for_faculty(
    session: AsyncSession,
    faculty_id: UUID,
) -> list[FundingRecommendationResponse]:
    faculty = await session.get(Academician, faculty_id)
    department = faculty.department if faculty and faculty.department else "Computer Science & Engineering"

    # Get active funding opportunities
    query = select(FundingOpportunity).where(FundingOpportunity.is_active.is_(True)).order_by(FundingOpportunity.deadline.asc())
    opportunities = (await session.scalars(query)).all()

    recommendations: list[FundingRecommendationResponse] = []
    
    for opp in opportunities:
        # Explainable matching logic
        is_dept_match = any(
            d.lower() in department.lower() or "engineering" in d.lower() or "computer" in d.lower()
            for d in opp.supported_domains
        )
        
        why_parts = []
        if is_dept_match:
            why_parts.append(f"Supports {department} faculty research and student skill elevation")
        if "AI/ML" in opp.supported_domains:
            why_parts.append("Directly covers the 61% student gap in Model Deployment & MLOps")
        elif "Cloud Computing" in opp.supported_domains:
            why_parts.append("Directly covers the 42% student gap in Cloud Deployment & Docker")
        elif "Cybersecurity" in opp.supported_domains:
            why_parts.append("Matches institutional focus on secure software development")
        else:
            why_parts.append("Qualifies under AICTE & Institutional Research Development Framework")

        why_text = " • ".join(why_parts)

        match_score = 0.92 if is_dept_match and len(why_parts) > 1 else 0.82

        resp_opp = FundingOpportunityResponse(
            id=opp.id,
            title=opp.title,
            funding_organization=opp.funding_organization,
            grant_type=opp.grant_type,
            amount=opp.amount,
            amount_numeric=float(opp.amount_numeric),
            deadline=opp.deadline,
            eligibility=opp.eligibility,
            supported_domains=opp.supported_domains,
            source_url=opp.source_url,
            required_documents=opp.required_documents,
            match_reason=why_text,
            is_active=opp.is_active,
            created_at=opp.created_at,
        )

        recommendations.append(
            FundingRecommendationResponse(
                opportunity=resp_opp,
                match_score=match_score,
                why_recommended=why_text,
                relevant_department=department,
                matched_student_gap="Model Deployment / Cloud CI/CD" if "AI/ML" in opp.supported_domains or "Cloud Computing" in opp.supported_domains else None,
            )
        )

    return sorted(recommendations, key=lambda x: x.match_score, reverse=True)


# =============================================================================
# FACULTY PROPOSAL BUILDER & LIFECYCLE
# =============================================================================

async def create_faculty_proposal(
    session: AsyncSession,
    faculty_id: UUID,
    payload: FacultyProposalCreate,
) -> FacultyProposalResponse:
    proposal = FacultyProposal(
        faculty_id=faculty_id,
        society_id=payload.society_id,
        funding_id=payload.funding_id,
        title=payload.title,
        objective=payload.objective,
        event_type=payload.event_type,
        target_audience=payload.target_audience,
        expected_participants=payload.expected_participants,
        required_funding=payload.required_funding,
        funding_amount_numeric=payload.funding_amount_numeric,
        duration_days=payload.duration_days,
        proposed_dates=payload.proposed_dates,
        infrastructure_needed=payload.infrastructure_needed,
        expected_outcomes=payload.expected_outcomes,
        budget_breakdown=payload.budget_breakdown,
        status="draft",
    )
    session.add(proposal)
    await session.flush()

    # Create initial proposal event
    init_event = ProposalEvent(
        proposal_id=proposal.id,
        status="draft",
        note="Proposal draft created with budget breakdown and infrastructure requisites.",
        actor_name="Faculty Lead",
    )
    session.add(init_event)
    await session.commit()
    await session.refresh(proposal)

    return await get_proposal_detail(session, proposal.id)  # type: ignore[return-value]


async def update_proposal_status(
    session: AsyncSession,
    proposal_id: UUID,
    new_status: str,
    feedback: str | None = None,
    actor_name: str = "Faculty Lead",
) -> FacultyProposalResponse | None:
    proposal = await session.get(FacultyProposal, proposal_id)
    if not proposal:
        return None

    proposal.status = new_status
    if feedback:
        proposal.reviewer_feedback = feedback
    if new_status == "submitted" and not proposal.submitted_at:
        proposal.submitted_at = datetime.now(timezone.utc)

    # Record event
    event = ProposalEvent(
        proposal_id=proposal.id,
        status=new_status,
        note=feedback or f"Proposal moved to {new_status.replace('_', ' ').title()}.",
        actor_name=actor_name,
    )
    session.add(event)
    await session.commit()
    await session.refresh(proposal)

    return await get_proposal_detail(session, proposal.id)


async def get_proposal_detail(
    session: AsyncSession,
    proposal_id: UUID,
) -> FacultyProposalResponse | None:
    stmt = (
        select(FacultyProposal)
        .options(
            selectinload(FacultyProposal.faculty),
            selectinload(FacultyProposal.society),
            selectinload(FacultyProposal.funding),
        )
        .where(FacultyProposal.id == proposal_id)
    )
    proposal = (await session.scalars(stmt)).first()
    if not proposal:
        return None

    events_stmt = (
        select(ProposalEvent)
        .where(ProposalEvent.proposal_id == proposal_id)
        .order_by(ProposalEvent.created_at.asc())
    )
    events = (await session.scalars(events_stmt)).all()

    return FacultyProposalResponse(
        id=proposal.id,
        faculty_id=proposal.faculty_id,
        faculty_name=proposal.faculty.full_name if proposal.faculty else None,
        society_id=proposal.society_id,
        society_name=proposal.society.name if proposal.society else None,
        funding_id=proposal.funding_id,
        funding_title=proposal.funding.title if proposal.funding else None,
        title=proposal.title,
        objective=proposal.objective,
        event_type=proposal.event_type,
        target_audience=proposal.target_audience,
        expected_participants=proposal.expected_participants,
        required_funding=proposal.required_funding,
        funding_amount_numeric=float(proposal.funding_amount_numeric),
        duration_days=proposal.duration_days,
        proposed_dates=proposal.proposed_dates,
        infrastructure_needed=proposal.infrastructure_needed,
        expected_outcomes=proposal.expected_outcomes,
        budget_breakdown=proposal.budget_breakdown,
        status=proposal.status,
        reviewer_feedback=proposal.reviewer_feedback,
        submitted_at=proposal.submitted_at,
        created_at=proposal.created_at,
        updated_at=getattr(proposal, "updated_at", proposal.created_at),
        events=[
            ProposalEventResponse(
                id=ev.id,
                proposal_id=ev.proposal_id,
                status=ev.status,
                note=ev.note,
                actor_name=ev.actor_name,
                created_at=ev.created_at,
            )
            for ev in events
        ],
    )


async def list_faculty_proposals(
    session: AsyncSession,
    faculty_id: UUID,
    status_filter: str | None = None,
) -> FacultyProposalListResponse:
    query = (
        select(FacultyProposal)
        .options(
            selectinload(FacultyProposal.faculty),
            selectinload(FacultyProposal.society),
            selectinload(FacultyProposal.funding),
        )
        .where(FacultyProposal.faculty_id == faculty_id)
        .order_by(desc(FacultyProposal.created_at))
    )

    if status_filter and status_filter.lower() != "all":
        query = query.where(FacultyProposal.status == status_filter)

    results = (await session.scalars(query)).all()
    items = []
    for prop in results:
        detail = await get_proposal_detail(session, prop.id)
        if detail:
            items.append(detail)

    return FacultyProposalListResponse(
        total=len(items),
        items=items,
    )
