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
    FacultyEventRegistration,
    FacultyOpportunity,
    Internship,
    JobDiscovery,
    Match,
    ResumeDocument,
    SavedFacultyOpportunity,
    Student,
    StudentSkill,
    TrainingOutcomeMetric,
    TrainingProgram,
    UserDocument,
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
        if not (
            len(faculty_demo.research_areas) >= 5
            and len(faculty_demo.technical_skills) >= 12
            and len(faculty_demo.certifications) >= 4
            and len(faculty_demo.publications) >= 5
            and len(faculty_demo.patents) >= 3
            and len(faculty_demo.past_industry_experience) >= 3
            and len(faculty_demo.completed_fdps) >= 3
            and len(faculty_demo.completed_trainings) >= 3
            and faculty_demo.phone
            and faculty_demo.linkedin_url
            and faculty_demo.google_scholar_url
        ):
            raise RuntimeError("Demo validation failed: complete faculty academic passport")
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
        await _require(
            session,
            select(TrainingProgram.id).where(
                TrainingProgram.faculty_id == faculty_demo.id,
                TrainingProgram.status == "registration_open",
                TrainingProgram.funding_gap > 0,
            ),
            "faculty training planner active program",
        )
        training_programs = list(
            (
                await session.scalars(
                    select(TrainingProgram).where(TrainingProgram.faculty_id == faculty_demo.id)
                )
            ).all()
        )
        expected_training_types = {
            "Training Program",
            "Hands-on Workshop",
            "FDP",
            "Industry Talk",
            "Certification Program",
            "Placement Preparation",
        }
        if not expected_training_types.issubset({program.program_type for program in training_programs}):
            raise RuntimeError("Demo validation failed: all faculty training program types")
        if any(
            not program.target_skills
            or not program.infrastructure_requirements
            or not program.budget_breakdown
            or not program.preparation_tasks
            or not program.marketing_kit
            or not program.campaign_metrics
            or not program.execution_metrics
            for program in training_programs
        ):
            raise RuntimeError("Demo validation failed: complete faculty training records")
        measured_training = await _require(
            session,
            select(TrainingProgram.id).where(
                TrainingProgram.faculty_id == faculty_demo.id,
                TrainingProgram.status == "completed",
            ),
            "faculty training planner completed program",
        )
        await _require(
            session,
            select(TrainingOutcomeMetric.id).where(
                TrainingOutcomeMetric.training_id == measured_training,
                TrainingOutcomeMetric.evidence_records_created == 0,
            ),
            "training outcome without automatic passport verification",
        )
        faculty_event_count = int(
            await session.scalar(
                select(func.count(FacultyEventRegistration.id)).where(
                    FacultyEventRegistration.faculty_id == faculty_demo.id
                )
            )
            or 0
        )
        if faculty_event_count < 6:
            raise RuntimeError("Demo validation failed: complete faculty event history")
        faculty_document_count = int(
            await session.scalar(
                select(func.count(UserDocument.id)).where(
                    UserDocument.user_id == faculty_demo.id,
                    UserDocument.user_role == "academician",
                )
            )
            or 0
        )
        if faculty_document_count < 8:
            raise RuntimeError("Demo validation failed: complete faculty document vault")
        await _require(session, select(AutomationPolicy.id).where(AutomationPolicy.student_id == maya.id, AutomationPolicy.enabled.is_(True)), "automation policy")
        await _require(session, select(Application.id).where(Application.student_id == maya.id, Application.status == ApplicationStatus.approval_pending), "approval-pending review")
        tracked = await _require(session, select(Application.id).where(Application.student_id == maya.id, Application.status == ApplicationStatus.submitted), "tracked application")
        await _require(session, select(ApplicationStatusEvent.id).where(ApplicationStatusEvent.application_id == tracked), "application timeline")


async def main() -> None:
    await validate_demo()
    print("Demo validation passed.")


if __name__ == "__main__":
    asyncio.run(main())
