"""Fail-fast, read-only validation for the persisted demo fixture graph."""

import asyncio

from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusEvent,
    AssessmentAttempt,
    AutomationPolicy,
    CourseEnrollment,
    DiscoveryRecommendation,
    Evidence,
    ExternalJob,
    ExternalJobMatchExplanation,
    FacultyInvitation,
    InstitutionImportBatch,
    InstitutionMapping,
    Internship,
    InternshipEngagement,
    JobDiscovery,
    Match,
    PassportShare,
    PlacementRegistration,
    PlacementStatusEvent,
    ProjectApplication,
    ResumeDocument,
    Student,
    StudentSkill,
    VerificationCheck,
)
from app.services.external_jobs_service import provider_sync_evidence
from seed.seed_demo_data import DEMO_STUDENT_EMAIL


async def _require(session, statement, label: str) -> object:
    value = await session.scalar(statement)
    if not value:
        raise RuntimeError(f"Demo validation failed: {label}")
    return value


async def validate_demo() -> None:
    async with SessionLocal() as session:
        maya = await _require(
            session, select(Student).where(Student.email == DEMO_STUDENT_EMAIL), "main student"
        )
        assert isinstance(maya, Student)
        await _require(
            session,
            select(ResumeDocument.id).where(
                ResumeDocument.student_id == maya.id, ResumeDocument.is_active.is_(True)
            ),
            "active resume",
        )
        await _require(
            session,
            select(Evidence.id).where(
                Evidence.student_id == maya.id, Evidence.resume_document_id.is_not(None)
            ),
            "resume-derived evidence",
        )
        orphan_count = int(
            await session.scalar(
                select(func.count())
                .select_from(StudentSkill)
                .where(StudentSkill.source_evidence_id.is_(None))
            )
            or 0
        )
        if orphan_count:
            raise RuntimeError("Demo validation failed: orphaned student skill")
        tiers = set(
            (await session.scalars(select(VerificationCheck.result))).all()
        )
        if not {"verified", "partially_verified", "unverified"}.issubset(tiers):
            raise RuntimeError("Demo validation failed: verification tier examples")
        match_count = int(
            await session.scalar(select(func.count()).select_from(Match)) or 0
        )
        if match_count < 3:
            raise RuntimeError("Demo validation failed: internal matches")
        providers = set((await session.scalars(select(ExternalJob.provider))).all())
        if not {"greenhouse", "lever", "ashby"}.issubset(providers):
            raise RuntimeError("Demo validation failed: provider fixture coverage")
        await _require(
            session,
            select(ExternalJobMatchExplanation.id),
            "external-job match explanation",
        )
        await _require(
            session,
            select(ExternalJobMatchExplanation.id).where(
                ExternalJobMatchExplanation.status == "missing"
            ),
            "missing-skill explanation",
        )
        fairness_scores = list(
            (
                await session.execute(
                    select(Match.final_score)
                    .join(Internship, Internship.id == Match.internship_id)
                    .join(Student, Student.id == Match.student_id)
                    .where(
                        Internship.title == "Backend Platform Intern",
                        Student.email.in_(["aria@example.demo", "blake@example.demo"]),
                    )
                    .order_by(Student.email)
                )
            ).scalars()
        )
        if len(fairness_scores) != 2 or float(fairness_scores[0]) != float(fairness_scores[1]):
            raise RuntimeError("Demo validation failed: fairness-pair score equality")
        await _require(session, select(JobDiscovery.id).where(JobDiscovery.student_id == maya.id), "saved discovery")
        await _require(session, select(DiscoveryRecommendation.id), "discovery recommendation")
        await _require(session, select(AutomationPolicy.id).where(AutomationPolicy.student_id == maya.id, AutomationPolicy.enabled.is_(True)), "automation policy")
        await _require(session, select(Application.id).where(Application.student_id == maya.id, Application.status == ApplicationStatus.approval_pending), "approval-pending review")
        tracked = await _require(session, select(Application.id).where(Application.student_id == maya.id, Application.status == ApplicationStatus.submitted), "tracked application")
        await _require(session, select(ApplicationStatusEvent.id).where(ApplicationStatusEvent.application_id == tracked), "application timeline")
        await _require(
            session,
            select(AssessmentAttempt.id).where(
                AssessmentAttempt.student_id == maya.id,
                AssessmentAttempt.evidence_id.is_not(None),
                AssessmentAttempt.passed.is_(True),
            ),
            "assessment provenance",
        )
        await _require(
            session,
            select(CourseEnrollment.id).where(
                CourseEnrollment.student_id == maya.id,
                CourseEnrollment.status == "verified",
                CourseEnrollment.completion_evidence_id.is_not(None),
            ),
            "learning completion provenance",
        )
        await _require(
            session,
            select(InternshipEngagement.id).where(
                InternshipEngagement.student_id == maya.id,
                InternshipEngagement.status == "completed",
                InternshipEngagement.completion_evidence_id.is_not(None),
            ),
            "internship completion provenance",
        )
        registration = await _require(
            session,
            select(PlacementRegistration.id).where(
                PlacementRegistration.student_id == maya.id,
                PlacementRegistration.status == "hired",
            ),
            "placement pipeline outcome",
        )
        stage_count = int(
            await session.scalar(
                select(func.count())
                .select_from(PlacementStatusEvent)
                .where(PlacementStatusEvent.placement_registration_id == registration)
            )
            or 0
        )
        if stage_count < 5:
            raise RuntimeError("Demo validation failed: placement stage timeline")
        await _require(
            session,
            select(ProjectApplication.id).where(
                ProjectApplication.student_id == maya.id,
                ProjectApplication.status == "completed",
                ProjectApplication.completion_evidence_id.is_not(None),
            ),
            "collaboration completion provenance",
        )
        await _require(
            session,
            select(FacultyInvitation.id).where(FacultyInvitation.status == "accepted"),
            "faculty invitation lifecycle",
        )
        await _require(
            session,
            select(PassportShare.id).where(
                PassportShare.student_id == maya.id,
                PassportShare.revoked_at.is_(None),
            ),
            "shareable passport",
        )
        await _require(session, select(InstitutionImportBatch.id), "institution import audit")
        await _require(session, select(InstitutionMapping.id), "institution mapping")

        health = await provider_sync_evidence(session)
        if any(item.status == "live" and item.fixture for item in health.values()):
            raise RuntimeError("Demo validation failed: fixture provider reported live")


async def main() -> None:
    await validate_demo()
    print("Demo validation passed.")


if __name__ == "__main__":
    asyncio.run(main())
