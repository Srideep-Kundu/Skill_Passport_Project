"""Deterministic, offline-only data for the complete Skill Passport demo story."""

import asyncio
import hashlib
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select, text

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    Academician,
    AccountEmail,
    ApplicationStatusSource,
    ApplicationTrackingStatus,
    AutomationPolicy,
    CollaborationWorkspace,
    DiscoveryRecommendation,
    DiscoveryRunStatus,
    Evidence,
    EvidenceType,
    ExternalJob,
    ExternalJobRequirement,
    ExtractionJob,
    ExtractionJobStatus,
    ExtractionStatus,
    FacultyApplication,
    FacultyEventRegistration,
    FacultyOpportunity,
    Institution,
    Internship,
    InternshipRequirement,
    JobDiscovery,
    JobDiscoveryRun,
    Recruiter,
    ResumeDocument,
    ResumeParseStatus,
    Role,
    Skill,
    Student,
    StudentSkill,
    VerificationCheck,
    VerificationTier,
)
from app.services.application_execution_service import prepare_application
from app.services.application_service import (
    approve_application,
    create_application_intent,
    select_manual_apply,
)
from app.services.application_tracking_service import (
    record_manual_submission,
    record_status_event,
)
from app.services.automation_policy_service import apply_policies_to_matches
from app.services.embeddings import (
    EmbeddingSpec,
    deterministic_embedding,
    embedding_fingerprint,
)
from app.services.matching_service import (
    compute_and_persist_external_job_match,
    recompute_matches_for_internship,
)
from seed.seed_skills import seed_skills

DEMO_PASSWORD = "DemoPassword123"
DEMO_STUDENT_EMAIL = "maya@example.demo"
_NOW = datetime(2026, 8, 1, 12, tzinfo=UTC)
_EMBEDDING_SPEC = EmbeddingSpec("deterministic_test", "demo-deterministic-v1", 768)


def _assert_demo_environment() -> None:
    settings = get_settings()
    if settings.environment not in {"demo", "test"}:
        raise RuntimeError("Demo fixtures may only be seeded with APP_ENV=demo or APP_ENV=test.")
    if (
        not settings.semantic_matching_enabled
        or settings.embedding_provider != _EMBEDDING_SPEC.provider
        or settings.embedding_model != _EMBEDDING_SPEC.model
        or settings.embedding_dimension != _EMBEDDING_SPEC.dimension
    ):
        raise RuntimeError(
            "Demo fixtures require deterministic semantic matching configuration."
        )


def _resume_payload() -> dict[str, object]:
    return {
        "contact": {"name": "Maya Rivera", "email": DEMO_STUDENT_EMAIL, "github_links": ["https://github.com/demo-maya"], "portfolio_links": ["https://portfolio.example.demo/maya"]},
        "education": [{"institution": "Harbor Polytechnic", "detail": "BSc Computer Science", "source_span": "Education"}],
        "projects": [{"title": "Reliable API", "description": "Built Python FastAPI services backed by PostgreSQL.", "source_span": "Projects: Reliable API"}],
        "certifications": [{"name": "Cloud Foundations", "detail": "Demo certification", "source_span": "Certifications"}],
        "explicit_technical_skills": ["Python", "FastAPI", "PostgreSQL", "Keras"],
        "prohibited_attribute_labels": [],
    }


async def _evidence(session, student: Student, *, title: str, description: str, skill_names: list[str], skills: dict[str, Skill], tier: VerificationTier, evidence_type: EvidenceType = EvidenceType.project, resume: ResumeDocument | None = None, section: str | None = None) -> Evidence:
    evidence = Evidence(student_id=student.id, evidence_type=evidence_type, title=title, description=description, raw_metadata={"fixture": "offline_demo", "live_provider_call": False}, resume_document_id=resume.id if resume else None, resume_section=section, resume_source_hash=resume.checksum if resume else None, extraction_status=ExtractionStatus.extracted)
    session.add(evidence)
    await session.flush()
    session.add(ExtractionJob(evidence_id=evidence.id, status=ExtractionJobStatus.completed, attempt_count=1, max_attempts=3, provider="local_fixture", idempotency_key=hashlib.sha256(f"demo:{evidence.id}".encode()).hexdigest(), completed_at=_NOW))
    for name in skill_names:
        session.add(StudentSkill(student_id=student.id, skill_id=skills[name].id, source_evidence_id=evidence.id, extraction_confidence=0.92, verification_tier=tier, evidence_span=name))
    session.add(VerificationCheck(evidence_id=evidence.id, check_type="offline_demo_fixture", result=tier.value, details={"fixture": True, "live_github_call": False, "deterministic_tier": tier.value}, checked_at=_NOW))
    return evidence


async def _external_job(session, *, provider: str, source: str, external_id: str, title: str, description: str, requirement_names: list[str], skills: dict[str, Skill], metadata: dict[str, object] | None = None) -> ExternalJob:
    job = ExternalJob(provider=provider, provider_source=source, external_id=external_id, title=title, company_name=f"{provider.title()} Demo Labs", description=description, location="Remote, Demo", remote_status="remote", employment_type="internship", experience_level="intern", apply_url=f"https://jobs.example.demo/{provider}/{external_id}", source_url=f"https://fixtures.example.demo/{provider}/{source}/{external_id}", raw_metadata={"fixture": "offline_demo", "live_provider_call": False, **(metadata or {})}, posted_at=_NOW - timedelta(days=2), first_seen_at=_NOW - timedelta(days=2), last_seen_at=_NOW, last_synced_at=_NOW, is_active=True)
    session.add(job)
    await session.flush()
    for index, name in enumerate(requirement_names):
        session.add(ExternalJobRequirement(external_job_id=job.id, skill_id=skills[name].id, is_required=True, weight=1.0 if index < 3 else 0.8, confidence=1.0, source_span=name))
    return job


async def seed_demo_data() -> None:
    """Create fixture records through the same provenance and workflow contracts as the app."""
    _assert_demo_environment()
    await seed_skills()
    async with SessionLocal() as session:
        if await session.scalar(select(Student.id).where(Student.email == DEMO_STUDENT_EMAIL)):
            return
        wanted = ["Python", "FastAPI", "PostgreSQL", "React", "Docker", "Keras", "TensorFlow", "Kubernetes", "AWS"]
        skills = {skill.canonical_name: skill for skill in (await session.scalars(select(Skill).where(Skill.canonical_name.in_(wanted)))).all()}
        if set(wanted) != set(skills):
            raise RuntimeError("Demo taxonomy is incomplete")
        for name in ("Keras", "TensorFlow"):
            skill = skills[name]
            skill.embedding = deterministic_embedding("deep learning neural network")
            skill.embedding_provider, skill.embedding_model, skill.embedding_dimension = _EMBEDDING_SPEC.provider, _EMBEDDING_SPEC.model, _EMBEDDING_SPEC.dimension
            skill.embedding_fingerprint = embedding_fingerprint("deep learning neural network", _EMBEDDING_SPEC)
            skill.embedding_generated_at = _NOW
        recruiter = Recruiter(email="recruiter@example.demo", password_hash=hash_password(DEMO_PASSWORD), company_name="TechNova AI Solutions")
        recruiter_technova = Recruiter(email="recruiter.demo@technova.com", password_hash=hash_password(DEMO_PASSWORD), company_name="TechNova AI Solutions")
        faculty = Academician(
            email="faculty@example.demo",
            password_hash=hash_password(DEMO_PASSWORD),
            full_name="Dr. Ananya Sharma",
            institution_name="National Institute of Technology Demo University",
            department="Computer Science and Engineering",
            designation="Associate Professor",
            research_areas=["Artificial Intelligence", "Machine Learning", "Data Analytics", "Software Engineering"],
            bio="Associate Professor in Computer Science & Engineering with 8 years of academic and research experience. Focuses on Deep Learning, Explainable AI, Predictive Analytics, and industry-academic bridge programs.",
            years_experience=8,
            technical_skills=["Artificial Intelligence", "Machine Learning", "Data Analytics", "Software Engineering", "Python", "PyTorch", "MLOps", "Generative AI", "FastAPI"],
            certifications=[
                {"name": "AWS Cloud Practitioner", "issuer": "Amazon Web Services", "year": "2024"},
                {"name": "Machine Learning Specialization", "issuer": "DeepLearning.AI / Stanford", "year": "2023"},
                {"name": "Cloud Computing", "issuer": "Google Cloud", "year": "2024"},
            ],
            publications=[
                {"title": "Deep Learning Approaches for Predictive Analytics", "journal_or_conf": "International AI Research Journal", "year": "2025"},
                {"title": "Industry-Academia Collaboration Models for Skill Development", "journal_or_conf": "Journal of Engineering Education & Industry Practice", "year": "2024"},
                {"title": "Automated Skill Verification and Provenance Telemetry", "journal_or_conf": "IEEE Trans. Learning Technologies", "year": "2025"},
                {"title": "Explainable Vector Embeddings for Student Competency Mapping", "journal_or_conf": "ACM SIGCSE", "year": "2024"},
                {"title": "Zero-Demographic Bias Talent Pipelines", "journal_or_conf": "ACM KDD Workshop", "year": "2023"},
            ],
            patents=[
                {"title": "System and Method for Provable Skill Provenance Verification", "patent_number": "IN-2024-99881", "status": "Granted", "year": "2024"},
                {"title": "Deterministic Competency Graph Generator for Multi-Tenant Workspaces", "patent_number": "IN-2025-10293", "status": "Published", "year": "2025"},
            ],
            past_industry_experience=[
                {"company": "TechNova AI Solutions", "role": "AI Consulting Lead", "duration_years": 2, "description": "Consulted on production ML pipeline optimization and explainability toolkits."},
                {"company": "Vision Analytics Labs", "role": "Research Collaboration Advisor", "duration_years": 3, "description": "Directed joint industry R&D on predictive student skill analytics."},
                {"company": "CloudSphere Technologies", "role": "Industry Mentorship Director", "duration_years": 3, "description": "Mentored university cohorts and industrial training modules."},
            ],
            completed_fdps=[
                {"title": "Cloud Architecture FDP", "organizer": "CloudSphere Technologies", "year": "2025", "mode": "5-day Hybrid"},
                {"title": "National FDP on Explainable Artificial Intelligence", "organizer": "IIT Bombay & AICTE", "year": "2024"},
            ],
            completed_trainings=[
                {"title": "Industry 4.0 Faculty Training", "company": "TechNova", "duration_weeks": 3, "year": "2025", "skills": ["AI Systems", "Cloud Architecture", "DevOps"]},
                {"title": "AI Faculty Immersion Program", "company": "TechNova AI Solutions", "duration_weeks": 4, "year": "2026", "skills": ["Machine Learning", "MLOps", "Generative AI"]},
            ],
            collaboration_availability="available",
            phone="+91 98765 43210",
            linkedin_url="https://linkedin.com/in/demo-dr-ananya-sharma",
            google_scholar_url="https://scholar.google.com/citations?user=demo_ananya_sharma",
        )
        faculty_demo = Academician(
            email="faculty.demo@example.com",
            password_hash=hash_password(DEMO_PASSWORD),
            full_name="Dr. Ananya Sharma",
            institution_name="National Institute of Technology Demo University",
            department="Computer Science and Engineering",
            designation="Associate Professor",
            years_experience=8,
            research_areas=["Artificial Intelligence", "Machine Learning", "Data Analytics", "Software Engineering"],
            technical_skills=["Artificial Intelligence", "Machine Learning", "Data Analytics", "Software Engineering", "Python", "PyTorch", "MLOps", "Generative AI", "FastAPI"],
            certifications=faculty.certifications,
            publications=faculty.publications,
            patents=faculty.patents,
            past_industry_experience=faculty.past_industry_experience,
            completed_fdps=faculty.completed_fdps,
            completed_trainings=faculty.completed_trainings,
        )
        institution = Institution(
            email="dean@example.demo",
            password_hash=hash_password(DEMO_PASSWORD),
            institution_name="National Institute of Technology Demo University",
            institution_code="HPU-DEMO",
            state="Karnataka",
            departments=["Computer Science", "Information Technology", "Electronics", "Mechanical"],
        )
        institution_demo = Institution(
            email="institution.demo@example.com",
            password_hash=hash_password(DEMO_PASSWORD),
            institution_name="National Institute of Technology Demo University",
            institution_code="NIT-DEMO-2026",
            state="Karnataka",
            departments=["Computer Science", "Information Technology", "Electronics", "Mechanical"],
        )
        students = {
            "maya": Student(email=DEMO_STUDENT_EMAIL, password_hash=hash_password(DEMO_PASSWORD), full_name="Maya Rivera", university="Harbor Polytechnic University", recruiter_evidence_consent=True),
            "noah": Student(email="noah@example.demo", password_hash=hash_password(DEMO_PASSWORD), full_name="Noah Chen", university="Northwind Institute", recruiter_evidence_consent=True),
            "aria": Student(email="aria@example.demo", password_hash=hash_password(DEMO_PASSWORD), full_name="Aria Patel", university="Eastlake College", recruiter_evidence_consent=True),
            "blake": Student(email="blake@example.demo", password_hash=hash_password(DEMO_PASSWORD), full_name="Blake Morgan", university="Summit University", recruiter_evidence_consent=True),
        }
        session.add_all([recruiter, recruiter_technova, faculty, faculty_demo, institution, institution_demo, *students.values()])
        await session.flush()

        faculty_opportunities = [
            FacultyOpportunity(
                title="Cloud Systems Faculty Immersion",
                opportunity_type="industrial_immersion",
                organization_name="Skill Passport Demo Labs",
                description="Offline demo record for a faculty cloud-systems immersion program.",
                domain="Distributed Systems",
                duration_weeks=6,
                deadline=_NOW + timedelta(days=30),
                status="open",
                required_expertise=["Python", "Distributed Systems"],
                created_by_recruiter_id=recruiter.id,
            ),
            FacultyOpportunity(
                title="Explainable AI Faculty Development Program",
                opportunity_type="fdp",
                organization_name="Skill Passport Demo Labs",
                description="Offline demo faculty development program.",
                domain="Explainable AI",
                duration_weeks=2,
                deadline=_NOW + timedelta(days=45),
                status="open",
                required_expertise=["Machine Learning"],
                created_by_recruiter_id=recruiter.id,
            ),
            FacultyOpportunity(
                title="Evidence Provenance Research Grant",
                opportunity_type="research_grant",
                organization_name="Skill Passport Demo Labs",
                description="Offline demo sponsored research opportunity.",
                domain="Verification Systems",
                stipend_or_grant=750000,
                duration_weeks=24,
                deadline=_NOW + timedelta(days=60),
                status="open",
                required_expertise=["PostgreSQL", "FastAPI"],
                created_by_recruiter_id=recruiter.id,
            ),
            FacultyOpportunity(
                title="Curriculum Architecture Consultancy",
                opportunity_type="consultancy_request",
                organization_name="Skill Passport Demo Labs",
                description="Offline demo consultancy request.",
                domain="Cloud Curriculum",
                duration_weeks=8,
                deadline=_NOW + timedelta(days=35),
                status="open",
                required_expertise=["Docker", "Distributed Systems"],
                created_by_recruiter_id=recruiter.id,
            ),
        ]
        session.add_all(faculty_opportunities)
        await session.flush()
        faculty_application = FacultyApplication(
            faculty_id=faculty.id,
            opportunity_id=faculty_opportunities[0].id,
            status="accepted",
            application_type="industrial_immersion",
            proposal_title="Auditable cloud-native teaching lab",
            proposal_text="Offline demo proposal for a deterministic faculty lifecycle.",
            objectives=["Create a reproducible cloud lab", "Publish curriculum outcomes"],
            engagement_status="active",
            start_date=_NOW - timedelta(days=14),
            end_date=_NOW + timedelta(days=28),
        )
        session.add(faculty_application)
        await session.flush()
        session.add(
            CollaborationWorkspace(
                application_id=faculty_application.id,
                title="Auditable Cloud Teaching Lab",
                collaboration_type="industrial_training",
                organization_name="Skill Passport Demo Labs",
                faculty_lead_id=faculty.id,
                industry_lead_name="Demo Industry Mentor",
                status="active",
                progress_percentage=45,
                objectives=["Build the lab", "Validate learning outcomes"],
                milestones=[{"id": "m1", "title": "Lab design", "status": "completed"}],
                discussion_posts=[{"author_name": "Demo Industry Mentor", "content": "Offline fixture workspace initialized."}],
                start_date=_NOW - timedelta(days=14),
                end_date=_NOW + timedelta(days=28),
            )
        )
        session.add_all(
            [
                FacultyEventRegistration(
                    faculty_id=faculty.id,
                    event_id=uuid4(),
                    event_type="workshop",
                    event_title="Cloud-Native Microservices Architecture Masterclass",
                    host_organization="Skill Passport Demo Labs",
                    role="attendee",
                    status="registered",
                    scheduled_at=_NOW + timedelta(days=10),
                ),
                FacultyEventRegistration(
                    faculty_id=faculty.id,
                    event_id=uuid4(),
                    event_type="fdp",
                    event_title="Applied Generative AI and Embeddings Workshop",
                    host_organization="Skill Passport Demo Labs",
                    role="speaker",
                    status="registered",
                    scheduled_at=_NOW + timedelta(days=18),
                ),
            ]
        )
        session.add_all([
            AccountEmail(email=recruiter.email, account_id=recruiter.id, role=Role.recruiter),
            AccountEmail(email=faculty.email, account_id=faculty.id, role=Role.academician),
            AccountEmail(email=institution.email, account_id=institution.id, role=Role.institution),
            *(AccountEmail(email=student.email, account_id=student.id, role=Role.student) for student in students.values()),
        ])
        resume_text = "Maya Rivera — Python, FastAPI, PostgreSQL, Keras. Reliable API project."
        resume = ResumeDocument(student_id=students["maya"].id, original_filename="maya-rivera-demo-resume.pdf", storage_key="demo/maya-rivera-resume.pdf", mime_type="application/pdf", size_bytes=len(resume_text.encode()), checksum=hashlib.sha256(resume_text.encode()).hexdigest(), parse_status=ResumeParseStatus.completed, parser_version="demo-parser-v1", parsed_data=_resume_payload(), extracted_text=resume_text, parsed_at=_NOW, is_active=True)
        session.add(resume)
        await session.flush()
        await _evidence(session, students["maya"], title="Resume: Reliable API project", description="Resume-derived project demonstrating Python, FastAPI, PostgreSQL, and Keras.", skill_names=["Python", "FastAPI", "PostgreSQL", "Keras"], skills=skills, tier=VerificationTier.partially_verified, resume=resume, section="projects")
        await _evidence(session, students["maya"], title="Manual Docker deployment project", description="Manually submitted project evidence for Docker and Python.", skill_names=["Docker", "Python"], skills=skills, tier=VerificationTier.unverified)
        await _evidence(session, students["maya"], title="GitHub-backed API evidence", description="Offline fixture for an attributable GitHub API project using Python.", skill_names=["Python", "FastAPI"], skills=skills, tier=VerificationTier.verified)
        await _evidence(session, students["noah"], title="Frontend coursework", description="React and Python coursework fixture.", skill_names=["React", "Python"], skills=skills, tier=VerificationTier.partially_verified, evidence_type=EvidenceType.coursework)
        for key in ("aria", "blake"):
            await _evidence(session, students[key], title="Equivalent backend project", description="Equivalent Python FastAPI PostgreSQL project fixture.", skill_names=["Python", "FastAPI", "PostgreSQL"], skills=skills, tier=VerificationTier.unverified)
        await session.commit()
        backend = Internship(recruiter_id=recruiter.id, title="Backend Platform Intern", description="Python, FastAPI, and PostgreSQL services.")
        frontend = Internship(recruiter_id=recruiter.id, title="Frontend Product Intern", description="React product development.")
        weak = Internship(recruiter_id=recruiter.id, title="Cloud Infrastructure Intern", description="Kubernetes and AWS operations.")
        session.add_all([backend, frontend, weak])
        await session.flush()
        for internship, requirements in ((backend, [("Python", True, 1.0), ("FastAPI", True, 1.0), ("PostgreSQL", True, 1.0), ("Docker", False, 0.5)]), (frontend, [("React", True, 1.0), ("Python", False, 0.5)]), (weak, [("Kubernetes", True, 1.0), ("AWS", True, 1.0)])):
            session.add_all(InternshipRequirement(internship_id=internship.id, skill_id=skills[name].id, is_required=required, weight=weight) for name, required, weight in requirements)
        await session.commit()
        for internship in (backend, frontend, weak):
            await recompute_matches_for_internship(session, internship.id)
        yc = await _external_job(session, provider="yc", source="yc_startups", external_id="yc-ai-001", title="Founding Fullstack & API Intern", description="Join our YC W24 backed team building Python FastAPI services with Docker and PostgreSQL.", requirement_names=["Python", "FastAPI", "Docker", "PostgreSQL"], skills=skills, metadata={"batch": "YC W24", "source": "y_combinator"})
        greenhouse = await _external_job(session, provider="greenhouse", source="demo-board", external_id="gh-backend-001", title="Backend Reliability Intern", description="Build Python FastAPI and PostgreSQL services; Kubernetes and AWS are valuable.", requirement_names=["Python", "FastAPI", "PostgreSQL", "Kubernetes", "AWS"], skills=skills, metadata={"application_questions": [{"id": "why_interested", "label": "Why are you interested?", "type": "textarea", "required": True}]})
        lever = await _external_job(session, provider="lever", source="demo-site", external_id="lever-data-001", title="Data API Intern", description="Build Python and PostgreSQL APIs with Docker.", requirement_names=["Python", "PostgreSQL", "Docker"], skills=skills)
        ashby = await _external_job(session, provider="ashby", source="demo-board", external_id="ashby-ml-001", title="ML Platform Intern", description="TensorFlow model platform internship.", requirement_names=["TensorFlow"], skills=skills)
        await session.commit()
        for job in (yc, greenhouse, lever, ashby):
            await compute_and_persist_external_job_match(session, students["maya"].id, job.id)
        greenhouse_match = await compute_and_persist_external_job_match(session, students["maya"].id, greenhouse.id)
        if greenhouse_match is None:
            raise RuntimeError("Demo recommendation could not be computed")
        # Matching activates the restricted role; fixture writes resume as the app role.
        if (await session.connection()).dialect.name == "postgresql":
            await session.execute(text("RESET ROLE"))
        await session.commit()
        discovery = JobDiscovery(student_id=students["maya"].id, name="Remote backend internships", enabled=True, query="backend intern", remote_preference=True, providers=["greenhouse", "lever", "ashby"], freshness_days=30, minimum_match_score=0.2, cadence_hours=24, next_run_at=_NOW + timedelta(days=1))
        session.add(discovery)
        await session.flush()
        run = JobDiscoveryRun(discovery_id=discovery.id, status=DiscoveryRunStatus.completed, providers_requested=list(discovery.providers), provider_results={"greenhouse": {"status": "fixture", "seen": 1}, "lever": {"status": "fixture", "seen": 1}, "ashby": {"status": "fixture", "seen": 1}}, jobs_seen=3, jobs_created=3, recommendations_created=1, started_at=_NOW - timedelta(hours=1), completed_at=_NOW)
        session.add_all([run, DiscoveryRecommendation(discovery_id=discovery.id, external_job_id=greenhouse.id, match_fingerprint=greenhouse_match.input_fingerprint, first_recommended_at=_NOW, last_recommended_at=_NOW)])
        policy = AutomationPolicy(student_id=students["maya"].id, name="Conservative remote backend review", enabled=True, priority=1, minimum_match_score=0.2, allowed_providers=["greenhouse"], remote_preference=True, maximum_jobs_per_run=3, maximum_review_intents_per_run=1, maximum_review_intents_per_day=1, maximum_pending_review_queue_size=2, auto_create_review_intent=True)
        session.add(policy)
        await session.commit()
        if await apply_policies_to_matches(session, student=students["maya"], external_job_ids={greenhouse.id}) != 1:
            raise RuntimeError("Demo policy did not create one review intent")
        lever_match = await compute_and_persist_external_job_match(session, students["maya"].id, lever.id)
        if lever_match is None:
            raise RuntimeError("Demo application recommendation could not be computed")
        if (await session.connection()).dialect.name == "postgresql":
            await session.execute(text("RESET ROLE"))
        await session.commit()
        historical = await create_application_intent(session, student=students["maya"], external_job_id=lever.id, external_job_match_id=lever_match.id)
        historical = await approve_application(session, application=historical, student=students["maya"])
        await prepare_application(session, application=historical, student=students["maya"])
        historical = await select_manual_apply(session, application=historical)
        historical = await record_manual_submission(session, application=historical, submitted_at=_NOW - timedelta(days=1), provider_reference="DEMO-LEVER-001")
        record_status_event(session, historical, event_type="user_reported_in_review", source=ApplicationStatusSource.user, tracking_status=ApplicationTrackingStatus.in_review, safe_metadata={"fixture": "offline_demo", "user_reported": True}, created_at=_NOW)
        await session.commit()

    from seed.seed_sih_ecosystem import seed_sih_ecosystem
    await seed_sih_ecosystem()


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
