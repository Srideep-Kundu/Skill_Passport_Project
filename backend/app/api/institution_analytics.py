"""API Router for Institution Decision-Support Portal, Employability Analytics & Interventions."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_role
from app.models import Admin, Institution
from app.schemas.contracts import (
    ActionPlanCreate,
    ActionPlanResponse,
    ActionPlanUpdate,
    AtRiskCohortSummary,
    CohortAnalyticsResponse,
    CollaborationRelationshipsResponse,
    CurriculumRecommendationItem,
    DepartmentDetailAnalytics,
    FacultyEngagementOverview,
    IndustryPartnerDetail,
    IndustryPartnershipOverview,
    InstitutionAlertsResponse,
    InstitutionAnalyticsOverview,
    InstitutionDemandSupplyAnalytics,
    InstitutionReportResponse,
    InternshipMonitoringOverview,
    InterventionPlanCreate,
    InterventionPlanResponse,
    InterventionPlanUpdate,
    InterventionRecommendation,
    LearningEffectivenessOverview,
    PlacementMonitoringOverview,
)
from app.services import institution_analytics_service as svc
from app.services.demand_supply_service import institution_demand_supply_analytics

router = APIRouter(prefix="/institution", tags=["institution"])


@router.get("/demand-supply", response_model=InstitutionDemandSupplyAnalytics)
async def get_demand_supply(
    institution: Annotated[Institution, Depends(require_role("institution"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    department: str | None = Query(None, min_length=1, max_length=120),
    cohort_year: int | None = Query(None, ge=2000, le=2100),
) -> InstitutionDemandSupplyAnalytics:
    """Compare persisted market demand with this institution's scoped supply."""
    return await institution_demand_supply_analytics(
        session,
        institution.id,
        department=department.strip() if department else None,
        cohort_year=cohort_year,
    )


@router.get("/analytics", response_model=InstitutionAnalyticsOverview)
async def get_analytics(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionAnalyticsOverview:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_institution_analytics(session, inst_id)


@router.get("/departments/{department_name}", response_model=DepartmentDetailAnalytics)
async def get_department_detail(
    department_name: str,
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> DepartmentDetailAnalytics:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_department_detail(session, department_name, inst_id)


@router.get("/cohorts", response_model=CohortAnalyticsResponse)
async def get_cohorts(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    department: str | None = Query(None),
    graduation_year: str | None = Query(None),
    readiness_band: str | None = Query(None),
    internship_status: str | None = Query(None),
    placement_status: str | None = Query(None),
) -> CohortAnalyticsResponse:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_cohort_analytics(
        session,
        department=department,
        graduation_year=graduation_year,
        readiness_band=readiness_band,
        internship_status=internship_status,
        placement_status=placement_status,
        institution_id=inst_id,
    )


@router.get("/interventions/recommendations", response_model=list[InterventionRecommendation])
async def get_intervention_recommendations(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[InterventionRecommendation]:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_intervention_recommendations(session, inst_id)


@router.get("/interventions", response_model=list[InterventionPlanResponse])
async def list_interventions(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[InterventionPlanResponse]:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.list_intervention_plans(session, inst_id)


@router.post("/interventions", response_model=InterventionPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_intervention(
    payload: InterventionPlanCreate,
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InterventionPlanResponse:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.create_intervention_plan(session, payload, inst_id)


@router.patch("/interventions/{plan_id}", response_model=InterventionPlanResponse)
async def update_intervention(
    plan_id: UUID,
    payload: InterventionPlanUpdate,
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InterventionPlanResponse:
    inst_id = principal.id if isinstance(principal, Institution) else None
    plan = await svc.update_intervention_plan(session, plan_id, payload, inst_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Intervention plan not found")
    return plan


@router.delete("/interventions/{plan_id}")
async def delete_intervention(
    plan_id: UUID,
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, bool]:
    inst_id = principal.id if isinstance(principal, Institution) else None
    deleted = await svc.delete_intervention_plan(session, plan_id, inst_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Intervention plan not found")
    return {"ok": True}


@router.get("/internships/monitoring", response_model=InternshipMonitoringOverview)
async def get_internship_monitoring(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InternshipMonitoringOverview:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_internship_monitoring(session, inst_id)


@router.get("/placements/monitoring", response_model=PlacementMonitoringOverview)
async def get_placement_monitoring(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PlacementMonitoringOverview:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_placement_monitoring(session, inst_id)


@router.get("/faculty-engagement", response_model=FacultyEngagementOverview)
async def get_faculty_engagement(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FacultyEngagementOverview:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_faculty_engagement_analytics(session, inst_id)


@router.get("/curriculum-recommendations", response_model=list[CurriculumRecommendationItem])
async def get_curriculum_recommendations(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[CurriculumRecommendationItem]:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_curriculum_recommendations(session, inst_id)


@router.get("/partnerships", response_model=IndustryPartnershipOverview)
async def get_partnerships(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> IndustryPartnershipOverview:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_industry_partnerships(session, inst_id)


@router.get("/partnerships/{partner_name}", response_model=IndustryPartnerDetail)
async def get_partner_detail(
    partner_name: str,
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> IndustryPartnerDetail:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_industry_partner_detail(session, partner_name, inst_id)


@router.get("/learning-effectiveness", response_model=LearningEffectivenessOverview)
async def get_learning_effectiveness(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> LearningEffectivenessOverview:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_learning_effectiveness(session, inst_id)


@router.get("/at-risk-cohorts", response_model=AtRiskCohortSummary)
async def get_at_risk_cohorts(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AtRiskCohortSummary:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_at_risk_cohorts(session, inst_id)


@router.get("/action-plans", response_model=list[ActionPlanResponse])
async def list_action_plans(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ActionPlanResponse]:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.list_action_plans(session, inst_id)


@router.post("/action-plans", response_model=ActionPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_action_plan(
    payload: ActionPlanCreate,
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ActionPlanResponse:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.create_action_plan(session, payload, inst_id)


@router.patch("/action-plans/{plan_id}", response_model=ActionPlanResponse)
async def update_action_plan(
    plan_id: UUID,
    payload: ActionPlanUpdate,
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ActionPlanResponse:
    inst_id = principal.id if isinstance(principal, Institution) else None
    plan = await svc.update_action_plan(session, plan_id, payload, inst_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Action plan not found")
    return plan


@router.delete("/action-plans/{plan_id}")
async def delete_action_plan(
    plan_id: UUID,
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, bool]:
    inst_id = principal.id if isinstance(principal, Institution) else None
    deleted = await svc.delete_action_plan(session, plan_id, inst_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Action plan not found")
    return {"ok": True}


@router.get("/alerts", response_model=InstitutionAlertsResponse)
async def get_alerts(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionAlertsResponse:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_institution_alerts(session, inst_id)


@router.get("/relationships", response_model=CollaborationRelationshipsResponse)
async def get_relationships(
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CollaborationRelationshipsResponse:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.get_collaboration_relationships(session, inst_id)


@router.get("/reports/{report_type}", response_model=InstitutionReportResponse)
async def get_report(
    report_type: str,
    principal: Annotated[Institution | Admin, Depends(require_role("institution", "admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> InstitutionReportResponse:
    inst_id = principal.id if isinstance(principal, Institution) else None
    return await svc.generate_institution_report(session, report_type, inst_id)
