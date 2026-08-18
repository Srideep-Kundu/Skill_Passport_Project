"""Student-owned automation policies and the resulting safe review queue."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.applications import _response
from app.core.db import get_session
from app.core.security import require_role
from app.models import Application, AuditLog, AutomationPolicy, ResumeDocument, Student
from app.schemas.contracts import (
    ApplicationResponse,
    AutomationPolicyInput,
    AutomationPolicyResponse,
    AutomationPolicyUpdate,
    AutomationQueueItem,
    ExplanationResponse,
    PaginatedResponse,
)
from app.services.application_service import ApplicationWorkflowError, request_approval
from app.services.automation_policy_service import review_queue
from app.services.explanation_service import render_external_job_explanation

router = APIRouter(prefix="/automation-policies", tags=["automation-policies"])
queue_router = APIRouter(
    prefix="/automation-review-queue", tags=["automation-review-queue"]
)


async def _owned(
    session: AsyncSession, policy_id: UUID, student_id: UUID
) -> AutomationPolicy:
    policy = await session.scalar(
        select(AutomationPolicy).where(
            AutomationPolicy.id == policy_id,
            AutomationPolicy.student_id == student_id,
        )
    )
    if policy is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Automation policy not found")
    return policy


@router.post(
    "", response_model=AutomationPolicyResponse, status_code=status.HTTP_201_CREATED
)
async def create(
    payload: AutomationPolicyInput,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AutomationPolicy:
    policy = AutomationPolicy(
        student_id=principal.id, **payload.model_dump(mode="json")
    )
    session.add(policy)
    await session.flush()
    session.add(
        AuditLog(
            actor_id=principal.id,
            action="automation_policy_created",
            entity_type="automation_policy",
            entity_id=policy.id,
            details={
                "enabled": policy.enabled,
                "auto_create_review_intent": policy.auto_create_review_intent,
            },
        )
    )
    await session.commit()
    await session.refresh(policy)
    return policy


@router.get("", response_model=PaginatedResponse[AutomationPolicyResponse])
async def list_policies(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[AutomationPolicyResponse]:
    filters = [AutomationPolicy.student_id == principal.id]
    total = int(
        (
            await session.scalar(
                select(func.count()).select_from(AutomationPolicy).where(*filters)
            )
        )
        or 0
    )
    policies = list(
        (
            await session.scalars(
                select(AutomationPolicy)
                .where(*filters)
                .order_by(AutomationPolicy.priority, AutomationPolicy.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return PaginatedResponse(
        page=page,
        page_size=page_size,
        total=total,
        items=[AutomationPolicyResponse.model_validate(policy) for policy in policies],
    )


@router.get("/{policy_id}", response_model=AutomationPolicyResponse)
async def get_policy(
    policy_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AutomationPolicy:
    return await _owned(session, policy_id, principal.id)


@router.patch("/{policy_id}", response_model=AutomationPolicyResponse)
async def update(
    policy_id: UUID,
    payload: AutomationPolicyUpdate,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> AutomationPolicy:
    policy = await _owned(session, policy_id, principal.id)
    changes = payload.model_dump(exclude_unset=True, mode="json")
    for key, value in changes.items():
        setattr(policy, key, value)
    session.add(
        AuditLog(
            actor_id=principal.id,
            action="automation_policy_updated",
            entity_type="automation_policy",
            entity_id=policy.id,
            details={"changed_fields": sorted(changes)},
        )
    )
    await session.commit()
    await session.refresh(policy)
    return policy


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    policy_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    policy = await _owned(session, policy_id, principal.id)
    session.add(
        AuditLog(
            actor_id=principal.id,
            action="automation_policy_deleted",
            entity_type="automation_policy",
            entity_id=policy.id,
            details={},
        )
    )
    await session.delete(policy)
    await session.commit()


@queue_router.get("", response_model=PaginatedResponse[AutomationQueueItem])
async def queue(
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PaginatedResponse[AutomationQueueItem]:
    active_resume = await session.scalar(
        select(ResumeDocument).where(
            ResumeDocument.student_id == principal.id,
            ResumeDocument.is_active.is_(True),
        )
    )
    items: list[AutomationQueueItem] = []
    for policy, job, match, decision, application in await review_queue(
        session, principal.id
    ):
        explanation = await render_external_job_explanation(session, match.id)
        assert explanation is not None
        items.append(
            AutomationQueueItem(
                external_job_id=job.id,
                match_id=match.id,
                title=job.title,
                company_name=job.company_name,
                provider=job.provider,
                final_score=float(match.final_score),
                policy_id=policy.id,
                policy_name=policy.name,
                policy_reason=list(decision.reasons),
                application_id=application.id if application else None,
                application_status=application.status.value if application else None,
                active_resume_filename=active_resume.original_filename
                if active_resume
                else None,
                explanation=ExplanationResponse.model_validate(explanation),
            )
        )
    start = (page - 1) * page_size
    return PaginatedResponse(
        page=page,
        page_size=page_size,
        total=len(items),
        items=items[start : start + page_size],
    )


@queue_router.post("/{application_id}/review", response_model=ApplicationResponse)
async def refresh_review_intent(
    application_id: UUID,
    principal: Annotated[Student, Depends(require_role("student"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ApplicationResponse:
    """Refresh a pending review snapshot; approval remains a separate student action."""
    application = await session.scalar(
        select(Application).where(
            Application.id == application_id, Application.student_id == principal.id
        )
    )
    if application is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    try:
        application = await request_approval(
            session, application=application, student=principal
        )
    except ApplicationWorkflowError as error:
        raise HTTPException(status.HTTP_409_CONFLICT, str(error)) from error
    return await _response(session, application, principal)
