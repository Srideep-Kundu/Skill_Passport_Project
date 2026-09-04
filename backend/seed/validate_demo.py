"""Fail-fast validation for the deterministic offline demo fixture graph."""

import asyncio

from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.models import (
    Application,
    ApplicationStatus,
    ApplicationStatusEvent,
    AutomationPolicy,
    DiscoveryRecommendation,
    Evidence,
    ExternalJob,
    ExternalJobMatchExplanation,
    FacultyOpportunity,
    Internship,
    JobDiscovery,
    Match,
    ResumeDocument,
    Student,
    StudentSkill,
    VerificationCheck,
)
from seed.seed_demo_data import DEMO_STUDENT_EMAIL, _assert_demo_environment


async def _require(session, statement, label: str) -> object:
    value = await session.scalar(statement)
    if not value:
        raise RuntimeError(f"Demo validation failed: {label}")
    return value


async def validate_demo() -> None:
    _assert_demo_environment()
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
            select(ExternalJobMatchExplanation.id).where(
                ExternalJobMatchExplanation.status == "semantic_near_match"
            ),
            "semantic near match",
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
        hub_types = set((await session.scalars(select(FacultyOpportunity.discovery_type))).all())
        if not {"society", "expert", "collaborator", "funding"}.issubset(hub_types):
            raise RuntimeError("Demo validation failed: faculty collaboration/funding hub catalog")
        await _require(session, select(AutomationPolicy.id).where(AutomationPolicy.student_id == maya.id, AutomationPolicy.enabled.is_(True)), "automation policy")
        await _require(session, select(Application.id).where(Application.student_id == maya.id, Application.status == ApplicationStatus.approval_pending), "approval-pending review")
        tracked = await _require(session, select(Application.id).where(Application.student_id == maya.id, Application.status == ApplicationStatus.submitted), "tracked application")
        await _require(session, select(ApplicationStatusEvent.id).where(ApplicationStatusEvent.application_id == tracked), "application timeline")


async def main() -> None:
    await validate_demo()
    print("Demo validation passed.")


if __name__ == "__main__":
    asyncio.run(main())
