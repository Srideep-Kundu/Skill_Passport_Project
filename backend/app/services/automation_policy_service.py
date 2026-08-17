"""Deterministic post-score automation policy evaluation with no submission authority."""

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Application,
    ApplicationStatus,
    AuditLog,
    AutomationPolicy,
    ExternalJob,
    ExternalJobMatch,
    ExternalJobRequirement,
    Student,
)
from app.services.application_service import (
    ApplicationWorkflowError,
    create_application_intent,
)


@dataclass(frozen=True)
class PolicyDecision:
    eligible: bool
    reasons: tuple[str, ...]
    actions: tuple[str, ...]


def _policy_skill_ids(values: list[UUID] | list[str] | None) -> set[UUID]:
    """JSON policy fields are persisted as strings at the REST boundary."""
    return {
        value if isinstance(value, UUID) else UUID(str(value)) for value in values or []
    }


def evaluate_policy(
    policy: AutomationPolicy,
    job: ExternalJob,
    match: ExternalJobMatch,
    skill_ids: set[UUID],
) -> PolicyDecision:
    """Apply declared filters to a persisted recommendation; never change its score."""
    if not policy.enabled:
        return PolicyDecision(False, ("policy_disabled",), ())
    if float(match.final_score) < float(policy.minimum_match_score):
        return PolicyDecision(False, ("match_score_below_threshold",), ())
    if policy.allowed_providers and job.provider not in (
        policy.allowed_providers or []
    ):
        return PolicyDecision(False, ("provider_not_allowed",), ())
    if policy.allowed_locations and not any(
        value.casefold() in (job.location or "").casefold()
        for value in (policy.allowed_locations or [])
    ):
        return PolicyDecision(False, ("location_not_allowed",), ())
    if (
        policy.remote_preference is not None
        and (job.remote_status == "remote") != policy.remote_preference
    ):
        return PolicyDecision(False, ("remote_preference_not_met",), ())
    if policy.employment_types and job.employment_type not in (
        policy.employment_types or []
    ):
        return PolicyDecision(False, ("employment_type_not_allowed",), ())
    if policy.experience_levels and job.experience_level not in (
        policy.experience_levels or []
    ):
        return PolicyDecision(False, ("experience_level_not_allowed",), ())
    text = f"{job.title} {job.company_name} {job.description}".casefold()
    if any(
        value.casefold() == job.company_name.casefold()
        for value in (policy.excluded_companies or [])
    ):
        return PolicyDecision(False, ("company_excluded",), ())
    if any(value.casefold() in text for value in (policy.excluded_keywords or [])):
        return PolicyDecision(False, ("keyword_excluded",), ())
    required_any = _policy_skill_ids(policy.required_skills_any)
    required_all = _policy_skill_ids(policy.required_skills_all)
    excluded = _policy_skill_ids(policy.excluded_skills)
    if required_any and not skill_ids.intersection(required_any):
        return PolicyDecision(False, ("required_skill_any_not_met",), ())
    if required_all and not required_all.issubset(skill_ids):
        return PolicyDecision(False, ("required_skill_all_not_met",), ())
    if excluded.intersection(skill_ids):
        return PolicyDecision(False, ("excluded_skill_present",), ())
    actions = (
        ("surface", "create_review_intent")
        if policy.auto_create_review_intent
        else ("surface",)
    )
    return PolicyDecision(
        True, ("match_score_threshold_met", "policy_filters_matched"), actions
    )


async def _required_skill_ids(
    session: AsyncSession, external_job_id: UUID
) -> set[UUID]:
    return set(
        (
            await session.scalars(
                select(ExternalJobRequirement.skill_id).where(
                    ExternalJobRequirement.external_job_id == external_job_id
                )
            )
        ).all()
    )


async def review_queue(
    session: AsyncSession, student_id: UUID
) -> list[
    tuple[
        AutomationPolicy,
        ExternalJob,
        ExternalJobMatch,
        PolicyDecision,
        Application | None,
    ]
]:
    """Return policy-selected work in stable order. This is a read-only operation."""
    policies = list(
        (
            await session.scalars(
                select(AutomationPolicy)
                .where(
                    AutomationPolicy.student_id == student_id,
                    AutomationPolicy.enabled.is_(True),
                )
                .order_by(AutomationPolicy.priority, AutomationPolicy.id)
            )
        ).all()
    )
    rows = (
        await session.execute(
            select(ExternalJob, ExternalJobMatch)
            .join(ExternalJobMatch, ExternalJobMatch.external_job_id == ExternalJob.id)
            .where(
                ExternalJobMatch.student_id == student_id,
                ExternalJob.is_active.is_(True),
            )
            .order_by(
                ExternalJobMatch.final_score.desc(),
                ExternalJob.company_name,
                ExternalJob.title,
                ExternalJob.id,
            )
        )
    ).all()
    applications = {
        application.external_job_id: application
        for application in (
            await session.scalars(
                select(Application).where(Application.student_id == student_id)
            )
        ).all()
    }
    requirements = {
        job.id: await _required_skill_ids(session, job.id) for job, _match in rows
    }
    result: list[
        tuple[
            AutomationPolicy,
            ExternalJob,
            ExternalJobMatch,
            PolicyDecision,
            Application | None,
        ]
    ] = []
    for policy in policies:
        for job, match in rows[: policy.maximum_jobs_per_run]:
            decision = evaluate_policy(policy, job, match, requirements[job.id])
            if decision.eligible:
                result.append((policy, job, match, decision, applications.get(job.id)))
    return result


async def apply_policies_to_matches(
    session: AsyncSession, *, student: Student, external_job_ids: set[UUID]
) -> int:
    """Create bounded approval-pending review intents only; never prepare, approve, or submit."""
    policies = list(
        (
            await session.scalars(
                select(AutomationPolicy)
                .where(
                    AutomationPolicy.student_id == student.id,
                    AutomationPolicy.enabled.is_(True),
                )
                .order_by(AutomationPolicy.priority, AutomationPolicy.id)
            )
        ).all()
    )
    created = 0
    today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    daily = int(
        (
            await session.scalar(
                select(func.count())
                .select_from(AuditLog)
                .where(
                    AuditLog.actor_id == student.id,
                    AuditLog.action == "application_review_intent_created",
                    AuditLog.created_at >= today,
                )
            )
        )
        or 0
    )
    pending_review = int(
        (
            await session.scalar(
                select(func.count())
                .select_from(Application)
                .where(
                    Application.student_id == student.id,
                    Application.status == ApplicationStatus.approval_pending,
                )
            )
        )
        or 0
    )
    for policy in policies:
        created_for_policy = 0
        for job_id in sorted(external_job_ids, key=str)[: policy.maximum_jobs_per_run]:
            if (
                daily >= policy.maximum_review_intents_per_day
                or created_for_policy >= policy.maximum_review_intents_per_run
                or pending_review >= policy.maximum_pending_review_queue_size
            ):
                break
            job = await session.get(ExternalJob, job_id)
            match = await session.scalar(
                select(ExternalJobMatch).where(
                    ExternalJobMatch.student_id == student.id,
                    ExternalJobMatch.external_job_id == job_id,
                )
            )
            if job is None or not job.is_active or match is None:
                continue
            decision = evaluate_policy(
                policy, job, match, await _required_skill_ids(session, job_id)
            )
            session.add(
                AuditLog(
                    actor_id=student.id,
                    action="policy_evaluated",
                    entity_type="automation_policy",
                    entity_id=policy.id,
                    details={
                        "external_job_id": str(job_id),
                        "eligible": decision.eligible,
                        "reasons": list(decision.reasons),
                    },
                )
            )
            if not decision.eligible or "create_review_intent" not in decision.actions:
                continue
            if await session.scalar(
                select(Application.id).where(
                    Application.student_id == student.id,
                    Application.external_job_id == job_id,
                )
            ):
                continue
            try:
                application = await create_application_intent(
                    session,
                    student=student,
                    external_job_id=job_id,
                    external_job_match_id=match.id,
                )
            except ApplicationWorkflowError:
                continue
            session.add_all(
                [
                    AuditLog(
                        actor_id=student.id,
                        action="recommendation_selected_by_policy",
                        entity_type="automation_policy",
                        entity_id=policy.id,
                        details={"external_job_id": str(job_id)},
                    ),
                    AuditLog(
                        actor_id=student.id,
                        action="application_review_intent_created",
                        entity_type="application",
                        entity_id=application.id,
                        details={
                            "policy_id": str(policy.id),
                            "external_job_id": str(job_id),
                        },
                    ),
                ]
            )
            await session.commit()
            created += 1
            created_for_policy += 1
            daily += 1
            pending_review += 1
        policy.last_applied_at = datetime.now(UTC)
    await session.commit()
    return created
