"""Fail-fast validation for the deterministic offline demo fixture graph."""

import asyncio

from app.core.db import SessionLocal
from app.models import (
    Academician,
    Application,
    ApplicationStatus,
    ApplicationStatusEvent,
    AutomationPolicy,
    CollaborationWorkspace,
    DiscoveryRecommendation,
    Evidence,
    ExternalJob,
    ExternalJobMatchExplanation,
    FacultyApplication,
    FacultyOpportunity,
    Internship,
    JobDiscovery,
    Match,
    ResumeDocument,
    SavedFacultyOpportunity,
    Student,
    StudentSkill,
    VerificationCheck,
)
from sqlalchemy import func, select

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
        faculty_demo = await _require(
            session,
            select(Academician).where(Academician.email == "faculty.demo@example.com"),
            "faculty demo account",
        )
        assert isinstance(faculty_demo, Academician)
        complete_hub_opportunity_count = await session.scalar(
            select(func.count(FacultyOpportunity.id)).where(
                FacultyOpportunity.discovery_type.in_(["society", "expert", "collaborator", "funding"]),
                FacultyOpportunity.location.is_not(None),
                FacultyOpportunity.eligibility.is_not(None),
                FacultyOpportunity.contact_email.is_not(None),
                FacultyOpportunity.contact_person.is_not(None),
                FacultyOpportunity.website_url.is_not(None),
            )
        )
        if not complete_hub_opportunity_count or complete_hub_opportunity_count < 8:
            raise RuntimeError("Demo validation failed: complete faculty hub opportunity details")
        saved_hub_count = await session.scalar(
            select(func.count(SavedFacultyOpportunity.id)).where(
                SavedFacultyOpportunity.faculty_id == faculty_demo.id
            )
        )
        if not saved_hub_count or saved_hub_count < 4:
            raise RuntimeError("Demo validation failed: faculty hub saved opportunities")
        proposal_statuses = set(
            (
                await session.scalars(
                    select(FacultyApplication.status).where(
                        FacultyApplication.faculty_id == faculty_demo.id
                    )
                )
            ).all()
        )
        if not {"draft", "submitted", "under_review", "accepted", "rejected"}.issubset(proposal_statuses):
            raise RuntimeError("Demo validation failed: faculty hub proposal lifecycle")
        await _require(
            session,
            select(CollaborationWorkspace.id)
            .join(FacultyApplication, FacultyApplication.id == CollaborationWorkspace.application_id)
            .where(
                FacultyApplication.faculty_id == faculty_demo.id,
                FacultyApplication.status == "accepted",
                CollaborationWorkspace.status == "active",
            ),
            "accepted faculty proposal active collaboration",
        )
        await _require(session, select(AutomationPolicy.id).where(AutomationPolicy.student_id == maya.id, AutomationPolicy.enabled.is_(True)), "automation policy")
        await _require(session, select(Application.id).where(Application.student_id == maya.id, Application.status == ApplicationStatus.approval_pending), "approval-pending review")
        tracked = await _require(session, select(Application.id).where(Application.student_id == maya.id, Application.status == ApplicationStatus.submitted), "tracked application")
        await _require(session, select(ApplicationStatusEvent.id).where(ApplicationStatusEvent.application_id == tracked), "application timeline")


async def main() -> None:
    await validate_demo()
    print("Demo validation passed.")


if __name__ == "__main__":
    asyncio.run(main())
