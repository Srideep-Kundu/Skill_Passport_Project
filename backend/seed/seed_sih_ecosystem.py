"""Seed data for SIH Ecosystem: Assessments, Learning Courses, Placement Drives, Faculty Opportunities, Mentorship, Challenges."""
import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    Academician,
    AccountEmail,
    Assessment,
    AssessmentCategoryScore,
    AssessmentQuestion,
    CollaborationWorkspace,
    Evidence,
    EvidenceType,
    FacultyApplication,
    FacultyEventRegistration,
    FacultyNotification,
    FacultyOpportunity,
    FacultyVideo,
    InnovationChallenge,
    Institution,
    Internship,
    InternshipRequirement,
    LearningCourse,
    MentorshipSession,
    PlacementDrive,
    ProjectApplication,
    ProjectAssessment,
    ProjectAssessmentStatus,
    Recruiter,
    Role,
    SavedFacultyOpportunity,
    Skill,
    Student,
    StudentSkill,
    TrainingOutcomeMetric,
    TrainingProgram,
    UserDocument,
    VerificationTier,
)
from app.services.matching_service import recompute_matches_for_internship
from sqlalchemy import select

_NOW = datetime.now(UTC)
DEMO_PASSWORD_HASH = hash_password("demo123")


async def _ensure_account_email(session, email: str, account_id: uuid.UUID, role: Role) -> None:
    existing = await session.scalar(select(AccountEmail.email).where(AccountEmail.email == email))
    if not existing:
        session.add(AccountEmail(email=email, account_id=account_id, role=role))
        await session.flush()


async def seed_sih_ecosystem():
    async with SessionLocal() as session:
        # 1. Seed Assessments
        existing_assessment = (await session.scalars(select(Assessment))).first()
        if not existing_assessment:
            # Assessment 1: Python Core & Backend
            py_ass = Assessment(
                title="Python Backend & Systems Diagnostic",
                canonical_skill_name="Python",
                category="Backend",
                difficulty="intermediate",
                duration_minutes=25,
                passing_score=70,
            )
            session.add(py_ass)
            await session.flush()

            session.add_all([
                AssessmentQuestion(
                    assessment_id=py_ass.id,
                    question_text="Which Python construct ensures asynchronous coroutines execute concurrently without blocking the main event loop?",
                    question_type="mcq",
                    options=["asyncio.gather(*tasks)", "threading.Thread.join()", "time.sleep()", "os.fork()"],
                    correct_answer="asyncio.gather(*tasks)",
                    explanation="asyncio.gather schedules multiple awaitable coroutines on the running asyncio event loop concurrently.",
                    points=20,
                ),
                AssessmentQuestion(
                    assessment_id=py_ass.id,
                    question_text="In SQLAlchemy 2.0 async engine, which method executes raw queries safely with parameter binding?",
                    question_type="mcq",
                    options=["session.execute(text('SELECT ...'), {'id': val})", "eval('SELECT ...')", "session.raw_sql()", "engine.run()"],
                    correct_answer="session.execute(text('SELECT ...'), {'id': val})",
                    explanation="Using text() with parameter dictionaries prevents SQL injection and enforces statement compilation.",
                    points=20,
                ),
                AssessmentQuestion(
                    assessment_id=py_ass.id,
                    question_text="What is the average time complexity of lookups in a standard Python dictionary / set?",
                    question_type="mcq",
                    options=["O(1)", "O(n)", "O(log n)", "O(n^2)"],
                    correct_answer="O(1)",
                    explanation="Python dictionaries utilize open addressing hash tables providing amortized O(1) average lookup.",
                    points=20,
                ),
                AssessmentQuestion(
                    assessment_id=py_ass.id,
                    question_text="Which FastAPI dependency pattern is recommended for database session scoping per request?",
                    question_type="mcq",
                    options=["Yielding async session in a Depends() provider with try/finally", "Global static session variable", "Opening session in constructor", "Singleton database pool without closing"],
                    correct_answer="Yielding async session in a Depends() provider with try/finally",
                    explanation="Yielding inside an async generator guarantees clean resource rollback/closure at request completion.",
                    points=20,
                ),
                AssessmentQuestion(
                    assessment_id=py_ass.id,
                    question_text="How do Python dataclasses differ from Pydantic models regarding runtime validation?",
                    question_type="mcq",
                    options=["Pydantic enforces strict runtime type coercion and validation; standard dataclasses do not coerce types by default", "Dataclasses are always faster than C code", "Pydantic does not support JSON serialization", "They are identical in implementation"],
                    correct_answer="Pydantic enforces strict runtime type coercion and validation; standard dataclasses do not coerce types by default",
                    explanation="Pydantic models perform extensive runtime type coercion, parsing, and schema validation via pydantic-core.",
                    points=20,
                ),
            ])

            # Assessment 2: React & Frontend Architecture
            react_ass = Assessment(
                title="React 18 & State Management Assessment",
                canonical_skill_name="React",
                category="Frontend",
                difficulty="intermediate",
                duration_minutes=25,
                passing_score=70,
            )
            session.add(react_ass)
            await session.flush()

            session.add_all([
                AssessmentQuestion(
                    assessment_id=react_ass.id,
                    question_text="What hook is utilized to memoize expensive calculation outputs across re-renders?",
                    question_type="mcq",
                    options=["useMemo", "useCallback", "useEffect", "useRef"],
                    correct_answer="useMemo",
                    explanation="useMemo recomputes memoized values only when specified dependency inputs change.",
                    points=25,
                ),
                AssessmentQuestion(
                    assessment_id=react_ass.id,
                    question_text="Why should state updates depending on prior state values use the functional updater syntax?",
                    question_type="mcq",
                    options=["To guarantee state updates read the latest queued state during batching", "To avoid re-rendering entirely", "It makes state synchronous", "To bypass React lifecycle checks"],
                    correct_answer="To guarantee state updates read the latest queued state during batching",
                    explanation="Functional state updaters receive the guaranteed pending state value avoiding stale closure bugs.",
                    points=25,
                ),
                AssessmentQuestion(
                    assessment_id=react_ass.id,
                    question_text="Which React 18 feature allows rendering transitions without blocking high-priority user input?",
                    question_type="mcq",
                    options=["useTransition / startTransition", "componentWillMount", "forceUpdate", "useLayoutSync"],
                    correct_answer="useTransition / startTransition",
                    explanation="startTransition marks UI updates as non-urgent transitions that yield to high-priority browser input events.",
                    points=25,
                ),
                AssessmentQuestion(
                    assessment_id=react_ass.id,
                    question_text="In TypeScript React applications, what is the best practice for typing component children?",
                    question_type="mcq",
                    options=["React.ReactNode", "any", "object", "string"],
                    correct_answer="React.ReactNode",
                    explanation="React.ReactNode accommodates JSX elements, arrays, strings, numbers, fragments, and nulls.",
                    points=25,
                ),
            ])

            # Assessment 3: Workplace Situational Judgment & Soft Skills
            soft_ass = Assessment(
                title="Workplace Situational Judgment & Soft Skills",
                canonical_skill_name="Leadership & Collaboration",
                category="Soft Skills",
                difficulty="intermediate",
                duration_minutes=20,
                passing_score=70,
            )
            session.add(soft_ass)
            await session.flush()

            session.add_all([
                AssessmentQuestion(
                    assessment_id=soft_ass.id,
                    question_text="A critical production release is scheduled for tomorrow, but your code review reveals a minor security vulnerability. What is the most responsible action?",
                    question_type="mcq",
                    options=[
                        "Document the finding, notify the tech lead and release manager immediately, and propose a hotfix before deployment",
                        "Ignore it since the ticket is marked high priority by marketing",
                        "Secretly push a patch after production deployment without informing teammates",
                        "Blame the junior engineer who authored the module",
                    ],
                    correct_answer="Document the finding, notify the tech lead and release manager immediately, and propose a hotfix before deployment",
                    explanation="Proactive risk communication, ownership, and collaborative solutioning demonstrate senior engineering maturity.",
                    points=25,
                ),
                AssessmentQuestion(
                    assessment_id=soft_ass.id,
                    question_text="During a cross-functional sprint planning meeting, product and engineering disagree sharply on scope. How do you facilitate alignment?",
                    question_type="mcq",
                    options=[
                        "Deconstruct requirements into essential MVP milestones and negotiate trade-offs using objective technical effort estimates",
                        "Walk out of the meeting in protest",
                        "Agree to all demands without reviewing capacity",
                        "Insist engineering makes all decisions unilaterally",
                    ],
                    correct_answer="Deconstruct requirements into essential MVP milestones and negotiate trade-offs using objective technical effort estimates",
                    explanation="Effective cross-functional communication balances product goals with engineering feasibility through clear scoping.",
                    points=25,
                ),
                AssessmentQuestion(
                    assessment_id=soft_ass.id,
                    question_text="You discover a teammate is struggling to meet a milestone due to unfamiliarity with Docker. What demonstrates positive teamwork?",
                    question_type="mcq",
                    options=[
                        "Offer a 30-minute pair-programming session to share onboarding templates and debug together",
                        "Complain to the engineering manager during daily standup",
                        "Take over the ticket and do it yourself in silence",
                        "Refuse to assist because it is outside your assigned tickets",
                    ],
                    correct_answer="Offer a 30-minute pair-programming session to share onboarding templates and debug together",
                    explanation="Peer mentoring fosters psychological safety and accelerates team-wide velocity.",
                    points=25,
                ),
                AssessmentQuestion(
                    assessment_id=soft_ass.id,
                    question_text="You receive constructive but critical feedback on your architectural proposal during design review. What is the best response?",
                    question_type="mcq",
                    options=[
                        "Thank the reviewer, objectively evaluate their trade-off arguments, and update the proposal with benchmarked justifications",
                        "Take it personally and argue defensively",
                        "Ignore all review comments and proceed with the initial design",
                        "Delete the document in frustration",
                    ],
                    correct_answer="Thank the reviewer, objectively evaluate their trade-off arguments, and update the proposal with benchmarked justifications",
                    explanation="Receptiveness to constructive feedback is foundational to collaborative technical excellence.",
                    points=25,
                ),
            ])

            # Assessment 4: Quantitative & Analytical Reasoning
            apt_ass = Assessment(
                title="Quantitative & Analytical Reasoning Diagnostic",
                canonical_skill_name="Aptitude & Analytical Reasoning",
                category="Aptitude",
                difficulty="intermediate",
                duration_minutes=20,
                passing_score=70,
            )
            session.add(apt_ass)
            await session.flush()

            session.add_all([
                AssessmentQuestion(
                    assessment_id=apt_ass.id,
                    question_text="A server processing pipeline handles 1,200 requests/sec with a 15% annual growth rate. In 2 years, what capacity is required?",
                    question_type="mcq",
                    options=["~1,587 req/sec", "~1,380 req/sec", "~2,400 req/sec", "~1,230 req/sec"],
                    correct_answer="~1,587 req/sec",
                    explanation="1200 * (1.15)^2 = 1200 * 1.3225 = ~1587 req/sec.",
                    points=25,
                ),
                AssessmentQuestion(
                    assessment_id=apt_ass.id,
                    question_text="If all Microservices are Distributed Systems, and some Distributed Systems are Fault-Tolerant, which deduction is logically valid?",
                    question_type="mcq",
                    options=[
                        "Some Distributed Systems are Microservices",
                        "All Microservices are Fault-Tolerant",
                        "No Microservices are Fault-Tolerant",
                        "All Fault-Tolerant systems are Microservices",
                    ],
                    correct_answer="Some Distributed Systems are Microservices",
                    explanation="If all A are B, then by subalternation and conversion, some B are A.",
                    points=25,
                ),
                AssessmentQuestion(
                    assessment_id=apt_ass.id,
                    question_text="In a code repository, 40% of files are Python, 35% are TypeScript, and 10% contain both. What percentage contains either Python or TypeScript?",
                    question_type="mcq",
                    options=["65%", "75%", "85%", "55%"],
                    correct_answer="65%",
                    explanation="P(A U B) = P(A) + P(B) - P(A ∩ B) = 40 + 35 - 10 = 65%.",
                    points=25,
                ),
                AssessmentQuestion(
                    assessment_id=apt_ass.id,
                    question_text="A database query takes 120ms with table scan. Adding a B-Tree index reduces execution time by 85%. What is the new query time?",
                    question_type="mcq",
                    options=["18ms", "24ms", "35ms", "12ms"],
                    correct_answer="18ms",
                    explanation="120ms * (1 - 0.85) = 120 * 0.15 = 18ms.",
                    points=25,
                ),
            ])

        # 2. Seed Learning Courses & Training Programs
        existing_course = (await session.scalars(select(LearningCourse))).first()
        if not existing_course:
            session.add_all([
                LearningCourse(
                    title="Production-Grade FastAPI & PostgreSQL Microservices",
                    provider="NPTEL / Coursera",
                    category="Backend",
                    difficulty="intermediate",
                    duration_hours=14,
                    url="https://nptel.ac.in/courses/fastapi-postgres",
                    rating=4.9,
                    description="Build asynchronous, scalable RESTful architectures using SQLAlchemy 2.0, pgvector embeddings, and Redis caching.",
                    skills=["FastAPI", "Python", "PostgreSQL", "REST API", "Docker"],
                ),
                LearningCourse(
                    title="Modern Frontend Engineering with React & TypeScript",
                    provider="Industry Academy",
                    category="Frontend",
                    difficulty="all_levels",
                    duration_hours=18,
                    url="https://swayam.gov.in/courses/react-typescript",
                    rating=4.8,
                    description="Master React 18 concurrencies, Tailwind design systems, accessible components, and state management architectures.",
                    skills=["React", "TypeScript", "Tailwind CSS", "JavaScript"],
                ),
                LearningCourse(
                    title="Deep Learning & Applied Generative AI Pipelines",
                    provider="AICTE Industry Partner",
                    category="AI",
                    difficulty="advanced",
                    duration_hours=24,
                    url="https://aicte-india.org/courses/generative-ai",
                    rating=4.9,
                    description="Hands-on neural networks, PyTorch model fine-tuning, embedding spaces, and retrieval augmented generation workflows.",
                    skills=["Machine Learning", "Python", "PyTorch", "Data Analysis"],
                ),
                LearningCourse(
                    title="Cloud-Native DevOps: Kubernetes & Automated CI/CD",
                    provider="Cloud Native Foundation",
                    category="DevOps",
                    difficulty="intermediate",
                    duration_hours=12,
                    url="https://cncf.io/training/kubernetes-fundamentals",
                    rating=4.7,
                    description="Container orchestration, Docker multi-stage builds, GitHub Actions CI pipelines, and production release strategies.",
                    skills=["Docker", "Kubernetes", "CI/CD", "Linux", "Git"],
                ),
            ])

        # 3. Seed Campus Placement Drives
        existing_drive = (await session.scalars(select(PlacementDrive))).first()
        if not existing_drive:
            session.add_all([
                PlacementDrive(
                    company_name="Google Cloud Technologies",
                    title="Software Development Engineer - Campus 2025",
                    description="Full-time campus placement for graduating engineers. Role spans distributed cloud systems, backend services, and scalable infrastructure.",
                    role_type="Full Time",
                    ctc_lpa=24.0,
                    eligible_departments=["Computer Science & Engineering", "Information Technology", "Electronics"],
                    minimum_cgpa=7.5,
                    passing_year=2025,
                    drive_date=_NOW + timedelta(days=14),
                    status="upcoming",
                    required_skills=["Python", "FastAPI", "PostgreSQL", "Docker", "Algorithms"],
                ),
                PlacementDrive(
                    company_name="Microsoft India R&D",
                    title="Full Stack Cloud Software Engineer",
                    description="Campus recruitment drive for core engineering division focusing on enterprise cloud experiences and intelligence platform components.",
                    role_type="Full Time",
                    ctc_lpa=22.5,
                    eligible_departments=["Computer Science & Engineering", "Information Technology"],
                    minimum_cgpa=7.0,
                    passing_year=2025,
                    drive_date=_NOW + timedelta(days=21),
                    status="upcoming",
                    required_skills=["React", "TypeScript", "Node.js", "PostgreSQL", "Cloud Computing"],
                ),
                PlacementDrive(
                    company_name="Goldman Sachs",
                    title="Technology Analyst - Engineering Division",
                    description="Campus placement for quantitative technology analysts. Involves high-throughput computational frameworks and secure data pipelines.",
                    role_type="Full Time",
                    ctc_lpa=20.0,
                    eligible_departments=["Computer Science & Engineering", "Information Technology", "Electronics & Communication"],
                    minimum_cgpa=7.2,
                    passing_year=2025,
                    drive_date=_NOW + timedelta(days=30),
                    status="upcoming",
                    required_skills=["Python", "SQL", "Data Analysis", "System Design", "Git"],
                ),
            ])

        # 4. Seed Faculty Opportunities
        existing_faculty_opp = (await session.scalars(select(FacultyOpportunity))).first()
        if not existing_faculty_opp:
            session.add_all([
                FacultyOpportunity(
                    title="Advanced AI Engineering Faculty Immersion Program",
                    opportunity_type="industrial_immersion",
                    organization_name="TechNova AI Labs",
                    description="4-week industrial immersion program for engineering faculty to collaborate directly with industrial AI architects on production Generative AI, MLOps, and scalable model inference pipelines.",
                    domain="Machine Learning & MLOps",
                    stipend_or_grant=180000.0,
                    duration_weeks=4,
                    deadline=_NOW + timedelta(days=30),
                    status="open",
                    required_expertise=["Machine Learning", "MLOps", "Generative AI", "Python"],
                ),
                FacultyOpportunity(
                    title="Cloud Computing and Modern Software Architecture FDP",
                    opportunity_type="fdp",
                    organization_name="CloudSphere Technologies",
                    description="Comprehensive 5-day hybrid Faculty Development Program covering modern microservices design, container orchestration, event-driven architectures, and curriculum modernization.",
                    domain="Cloud & Distributed Systems",
                    stipend_or_grant=35000.0,
                    duration_weeks=1,
                    deadline=_NOW + timedelta(days=25),
                    status="open",
                    required_expertise=["Cloud Architecture", "Distributed Systems", "Docker", "DevOps"],
                ),
                FacultyOpportunity(
                    title="Applied AI Research Partnership",
                    opportunity_type="research_grant",
                    organization_name="Vision Analytics Labs",
                    description="Sponsored research grant supporting faculty teams developing predictive analytics frameworks, student skill progression trajectories, and automated competency evaluation systems.",
                    domain="Applied Artificial Intelligence",
                    stipend_or_grant=1500000.0,
                    duration_weeks=24,
                    deadline=_NOW + timedelta(days=60),
                    status="open",
                    required_expertise=["Artificial Intelligence", "Predictive Analytics", "Deep Learning", "FastAPI"],
                ),
                FacultyOpportunity(
                    title="Industrial Consultancy Request: High-Concurrency Vector Index Optimization",
                    opportunity_type="consultancy_request",
                    organization_name="HyperScale Technologies",
                    description="Seeking senior faculty / domain experts to evaluate and optimize high-dimensional vector search indexing on PostgreSQL pgvector with HNSW similarity benchmarking.",
                    domain="Database & Search Architectures",
                    stipend_or_grant=300000.0,
                    duration_weeks=12,
                    deadline=_NOW + timedelta(days=30),
                    status="open",
                    required_expertise=["PostgreSQL", "pgvector", "System Design", "Algorithms"],
                ),
                FacultyOpportunity(
                    title="AICTE-Industry Immersion Sabbatical: Cloud Distributed Systems",
                    opportunity_type="industrial_immersion",
                    organization_name="Intel Research Laboratories",
                    description="6-week industrial sabbatical program for faculty to work alongside industrial architects on distributed systems & low-latency execution.",
                    domain="Distributed Systems",
                    stipend_or_grant=150000.0,
                    duration_weeks=6,
                    deadline=_NOW + timedelta(days=45),
                    status="open",
                    required_expertise=["Distributed Systems", "Python", "Linux"],
                ),
                FacultyOpportunity(
                    title="National Faculty Development Program (FDP) on Explainable AI",
                    opportunity_type="fdp",
                    organization_name="AICTE & IIT Kharagpur",
                    description="Comprehensive FDP covering transparent machine learning, auditable AI pipelines, and curriculum design best practices.",
                    domain="Artificial Intelligence",
                    stipend_or_grant=25000.0,
                    duration_weeks=2,
                    deadline=_NOW + timedelta(days=20),
                    status="open",
                    required_expertise=["Machine Learning", "Explainable AI"],
                ),
            ])

        # Collaboration & Funding Hub catalog. Titles are stable idempotency keys
        # so rerunning the demo seed adds new catalog entries without duplicating them.
        hub_catalog = [
            {
                "title": "IEEE Computer Society Academic Chapter Partnership",
                "opportunity_type": "society_partnership",
                "discovery_type": "society",
                "organization_name": "IEEE Computer Society",
                "description": "Establish or strengthen an academic chapter with expert talks, student technical activities, standards awareness, and research-community access.",
                "domain": "Computing & Electrical Engineering",
                "required_expertise": ["Computer Science", "Artificial Intelligence", "Cloud Computing"],
                "collaboration_types": ["chapter_partnership", "expert_speaker", "student_workshop"],
                "website_url": "https://www.computer.org/",
                "profile_metadata": {"membership_model": "Institutional chapter", "benefits": ["Distinguished visitors", "Technical communities", "Student chapter support"]},
                "stipend_or_grant": None,
            },
            {
                "title": "ACM SIGCSE Computing Education Collaboration",
                "opportunity_type": "society_partnership",
                "discovery_type": "society",
                "organization_name": "Association for Computing Machinery",
                "description": "Connect computing faculty with education researchers, curriculum exchange, invited speakers, and teaching-practice working groups.",
                "domain": "Computer Science Education",
                "required_expertise": ["Software Engineering", "Data Science", "Computer Science Education"],
                "collaboration_types": ["professional_society", "curriculum_collaboration", "expert_speaker"],
                "website_url": "https://www.acm.org/",
                "profile_metadata": {"community": "SIGCSE", "benefits": ["Curriculum resources", "Peer network", "Conference community"]},
                "stipend_or_grant": None,
            },
            {
                "title": "CSI Institutional Chapter & Expert Lecture Network",
                "opportunity_type": "society_partnership",
                "discovery_type": "society",
                "organization_name": "Computer Society of India",
                "description": "Institutional chapter collaboration for technical lectures, faculty networking, student contests, and regional computing events.",
                "domain": "Information Technology",
                "required_expertise": ["Information Technology", "Cybersecurity", "Software Engineering"],
                "collaboration_types": ["institutional_chapter", "expert_speaker", "technical_event"],
                "website_url": "https://www.csi-india.org/",
                "profile_metadata": {"coverage": "India", "engagement": "Faculty and student chapter activities"},
                "stipend_or_grant": None,
            },
            {
                "title": "ISTE Faculty Training & Institutional Membership Network",
                "opportunity_type": "society_partnership",
                "discovery_type": "society",
                "organization_name": "Indian Society for Technical Education",
                "description": "Discover faculty development, institutional networking, technical education workshops, and training partnerships.",
                "domain": "Engineering Education",
                "required_expertise": ["Engineering Education", "Curriculum Design", "Faculty Development"],
                "collaboration_types": ["professional_society", "faculty_training", "workshop"],
                "website_url": "https://www.isteonline.in/",
                "profile_metadata": {"coverage": "India", "audience": "Engineering faculty and institutions"},
                "stipend_or_grant": None,
            },
            {
                "title": "Explainable AI Expert Speaker & Faculty Trainer",
                "opportunity_type": "expert_engagement",
                "discovery_type": "expert",
                "organization_name": "Responsible AI Practice Network",
                "description": "Invite an industry research leader for a keynote, hands-on faculty clinic, or multi-session trainer engagement on explainable and responsible AI.",
                "domain": "Artificial Intelligence",
                "required_expertise": ["Machine Learning", "Explainable AI", "Responsible AI"],
                "collaboration_types": ["expert_speaker", "trainer", "faculty_workshop"],
                "website_url": "https://responsible-ai-practice.example.demo/experts/meera-iyer",
                "profile_metadata": {"expert_name": "Dr. Meera Iyer", "expert_title": "Principal Responsible AI Scientist", "delivery_modes": ["On-site", "Hybrid"]},
                "stipend_or_grant": 75000.0,
            },
            {
                "title": "Cloud & MLOps Industry Co-Innovation Partner",
                "opportunity_type": "industry_collaboration",
                "discovery_type": "collaborator",
                "organization_name": "TechNova AI Solutions",
                "description": "Co-design applied research, student labs, faculty immersion, and proof-of-concept programs with cloud and MLOps engineering teams.",
                "domain": "Cloud Computing & MLOps",
                "required_expertise": ["MLOps", "Cloud Architecture", "Machine Learning", "DevOps"],
                "collaboration_types": ["joint_research", "lab_sponsorship", "faculty_immersion"],
                "website_url": "https://technova.example.demo/academic-partnerships",
                "profile_metadata": {"partner_type": "Industry R&D", "available_support": ["Technical mentors", "Cloud credits", "Prototype reviews"]},
                "stipend_or_grant": 500000.0,
            },
            {
                "title": "National Applied AI Research Catalyst Grant",
                "opportunity_type": "research_grant",
                "discovery_type": "funding",
                "organization_name": "Innovation Research Council (Demo)",
                "description": "Competitive grant for transparent applied AI, education analytics, and deployable public-interest research prototypes.",
                "domain": "Applied Artificial Intelligence",
                "required_expertise": ["Artificial Intelligence", "Explainable AI", "Data Analytics"],
                "collaboration_types": ["research_grant", "multi_institution_research"],
                "website_url": "https://innovation-research-council.example.demo/grants/applied-ai-catalyst",
                "profile_metadata": {"funding_type": "Grant", "eligible_applicants": "Faculty principal investigators", "cost_share_required": False},
                "stipend_or_grant": 2000000.0,
            },
            {
                "title": "Industry-Sponsored Emerging Technology Lab",
                "opportunity_type": "sponsorship",
                "discovery_type": "funding",
                "organization_name": "Future Systems Foundation (Demo)",
                "description": "Institutional sponsorship for equipment, cloud credits, expert trainers, and student upskilling in identified emerging-technology gaps.",
                "domain": "Cloud, Cybersecurity & Data Engineering",
                "required_expertise": ["Cloud Computing", "Cybersecurity", "Data Engineering"],
                "collaboration_types": ["lab_sponsorship", "student_training", "expert_trainer"],
                "website_url": "https://future-systems-foundation.example.demo/programs/emerging-tech-lab",
                "profile_metadata": {"funding_type": "Sponsorship", "support": ["Equipment", "Cloud credits", "Trainer hours"]},
                "stipend_or_grant": 1000000.0,
            },
            {
                "title": "SIAM Academic Chapter on Applied Mathematics & ML",
                "opportunity_type": "society_partnership",
                "discovery_type": "society",
                "organization_name": "Society for Industrial and Applied Mathematics",
                "description": "Launch an interdisciplinary SIAM chapter bridging Mathematics, Data Science, Computational Optimization, and Machine Learning research.",
                "domain": "Applied Mathematics & Computational Science",
                "required_expertise": ["Data Science", "Algorithms", "Machine Learning", "Applied Mathematics"],
                "collaboration_types": ["chapter_partnership", "student_workshop", "joint_research"],
                "website_url": "https://www.siam.org/",
                "profile_metadata": {"community": "SIAM Activity Groups", "benefits": ["Free student memberships", "Research travel awards", "Colloquium funding"]},
                "stipend_or_grant": None,
            },
            {
                "title": "ACM-W Women in Computing Mentorship & Institutional Chapter",
                "opportunity_type": "society_partnership",
                "discovery_type": "society",
                "organization_name": "ACM Women (ACM-W)",
                "description": "Empower female scholars and researchers through national mentorship cohorts, celebrate women in computing summits, and dedicated leadership scholarships.",
                "domain": "Diversity & Computing Leadership",
                "required_expertise": ["Computer Science", "Artificial Intelligence", "Mentorship"],
                "collaboration_types": ["chapter_partnership", "expert_speaker", "student_workshop"],
                "website_url": "https://women.acm.org/",
                "profile_metadata": {"community": "ACM-W India", "benefits": ["Scholarships for international conferences", "Executive speaker series"]},
                "stipend_or_grant": None,
            },
            {
                "title": "High-Performance Distributed Systems & Raft Consensus Masterclass",
                "opportunity_type": "expert_engagement",
                "discovery_type": "expert",
                "organization_name": "HyperScale Architecture Group",
                "description": "Book Prof. Rajesh Nair for a 3-day deep dive into distributed transaction semantics, consensus protocols (Raft/Paxos), low-latency RPCs, and multi-region replication.",
                "domain": "Distributed Systems & Cloud",
                "required_expertise": ["Distributed Systems", "Go", "Cloud Architecture", "System Design"],
                "collaboration_types": ["expert_speaker", "faculty_workshop", "curriculum_review"],
                "website_url": "https://hyperscale-arch.example.demo/experts/rajesh-nair",
                "profile_metadata": {"expert_name": "Prof. Rajesh Nair", "expert_title": "Distinguished Cloud Architect", "delivery_modes": ["On-Campus 3-Day Workshop", "Executive Lab Review"]},
                "stipend_or_grant": 120000.0,
            },
            {
                "title": "Post-Quantum Cryptography & Zero-Trust Security Seminar",
                "opportunity_type": "expert_engagement",
                "discovery_type": "expert",
                "organization_name": "National Cyber Defense Academy",
                "description": "Engage Dr. Sunita Kulkarni for an advanced technical lecture and faculty workshop on NIST-standardized Post-Quantum Cryptography (Kyber, Dilithium) and Zero-Trust architecture.",
                "domain": "Cybersecurity & Cryptography",
                "required_expertise": ["Cybersecurity", "Post-Quantum Cryptography", "Zero Trust", "Algorithms"],
                "collaboration_types": ["expert_speaker", "faculty_workshop"],
                "website_url": "https://cyberdefense-academy.example.demo/experts/sunita-kulkarni",
                "profile_metadata": {"expert_name": "Dr. Sunita Kulkarni", "expert_title": "Chief Cryptographer & IEEE Senior Member", "delivery_modes": ["Hybrid", "On-site"]},
                "stipend_or_grant": 90000.0,
            },
            {
                "title": "Generative AI, Model Quantization & LLMOps Clinic",
                "opportunity_type": "expert_engagement",
                "discovery_type": "expert",
                "organization_name": "Silicon Valley AI Research Exchange",
                "description": "Virtual clinic series on parameter-efficient fine-tuning (LoRA/QLoRA), 4-bit quantization, vLLM high-throughput serving, and GPU optimization with Dr. Andrew Chen.",
                "domain": "Generative AI & MLOps",
                "required_expertise": ["Generative AI", "PyTorch", "MLOps", "Model Quantization"],
                "collaboration_types": ["expert_speaker", "trainer", "curriculum_collaboration"],
                "website_url": "https://sv-ai-exchange.example.demo/experts/andrew-chen",
                "profile_metadata": {"expert_name": "Dr. Andrew Chen", "expert_title": "Senior Director of Applied AI Research", "delivery_modes": ["Live Interactive Zoom Series", "Code Clinic"]},
                "stipend_or_grant": 150000.0,
            },
            {
                "title": "CloudSphere Technologies: Edge AI & Microservices Research Cell",
                "opportunity_type": "industry_collaboration",
                "discovery_type": "collaborator",
                "organization_name": "CloudSphere Technologies",
                "description": "Establish a sponsored Edge AI and microservices sandbox on campus. CloudSphere engineers collaborate weekly with faculty on low-latency inference on edge hardware.",
                "domain": "Edge Computing & IoT",
                "required_expertise": ["Edge AI", "Kubernetes", "IoT", "C++", "Python"],
                "collaboration_types": ["joint_research", "lab_sponsorship", "student_training"],
                "website_url": "https://cloudsphere.example.demo/edge-ai-partner",
                "profile_metadata": {"partner_type": "Cloud & Edge Hyper-scaler", "available_support": ["Edge Hardware Kits (NVIDIA Jetson)", "Cloud Credits", "Internship PPO Pool"]},
                "stipend_or_grant": 400000.0,
            },
            {
                "title": "HyperScale Research Labs: Vector Search & Database Indexing Co-Op",
                "opportunity_type": "industry_collaboration",
                "discovery_type": "collaborator",
                "organization_name": "HyperScale Labs",
                "description": "Partner with database kernel developers to research Approximate Nearest Neighbor (ANN) vector indexing, SIMD optimizations, and distributed pgvector clusters.",
                "domain": "Database Systems & pgvector",
                "required_expertise": ["PostgreSQL", "pgvector", "System Design", "Algorithms", "C++"],
                "collaboration_types": ["joint_research", "faculty_immersion"],
                "website_url": "https://hyperscalelabs.example.demo/academic-coop",
                "profile_metadata": {"partner_type": "Database Infrastructure Provider", "available_support": ["High Memory GPU Clusters", "Direct Mentorship with Core Committers", "₹6.5L Grant"]},
                "stipend_or_grant": 650000.0,
            },
            {
                "title": "CyberShield Defense: Zero-Trust Security Operations Simulation Lab",
                "opportunity_type": "industry_collaboration",
                "discovery_type": "collaborator",
                "organization_name": "CyberShield Defense Networks",
                "description": "Build an active Cyber Security Operations Center (SOC) simulation environment on campus. Includes threat-intelligence feeds, malware sandboxes, and purple-team exercises.",
                "domain": "Cybersecurity & SOC Operations",
                "required_expertise": ["Cybersecurity", "Network Security", "Zero Trust", "Linux"],
                "collaboration_types": ["lab_sponsorship", "student_training", "joint_research"],
                "website_url": "https://cybershield.example.demo/campus-soc",
                "profile_metadata": {"partner_type": "Enterprise Security Provider", "available_support": ["Commercial Threat Intelligence Feeds", "Live Attack Simulation Software", "Industry Certifications"]},
                "stipend_or_grant": 350000.0,
            },
            {
                "title": "DST-SERB Core Research Grant in Auditable Verification Systems",
                "opportunity_type": "research_grant",
                "discovery_type": "funding",
                "organization_name": "Department of Science and Technology (DST-SERB)",
                "description": "Premier government research grant supporting basic and applied research in deterministic evidence provenance, cryptographic passports, and bias-free evaluation engines.",
                "domain": "Verification Systems & Cryptography",
                "required_expertise": ["PostgreSQL", "FastAPI", "Verification Systems", "Algorithms"],
                "collaboration_types": ["research_grant", "multi_institution_research"],
                "website_url": "https://serbonline.in/SERB/crg",
                "profile_metadata": {"funding_type": "Government Apex Research Grant", "tenure_years": 3, "fellowships_included": 2},
                "stipend_or_grant": 3500000.0,
            },
            {
                "title": "AICTE Clean Energy & Smart Computing Innovation Grant",
                "opportunity_type": "research_grant",
                "discovery_type": "funding",
                "organization_name": "AICTE National R&D Cell",
                "description": "Scheme for promoting research in smart energy grids, green computing algorithms, carbon-aware cloud scheduling, and IoT intelligence.",
                "domain": "Green Computing & Smart Energy",
                "required_expertise": ["Cloud Architecture", "IoT", "Machine Learning", "System Design"],
                "collaboration_types": ["research_grant", "student_training"],
                "website_url": "https://www.aicte-india.org/schemes/research-innovations-development-schemes",
                "profile_metadata": {"funding_type": "AICTE R&D Grant", "scheme": "RPS (Research Promotion Scheme)"},
                "stipend_or_grant": 1500000.0,
            },
            {
                "title": "Microsoft Research AI for Accessibility Academic Challenge Grant",
                "opportunity_type": "research_grant",
                "discovery_type": "funding",
                "organization_name": "Microsoft Research India",
                "description": "Grants, Azure Cognitive Services credits, and Microsoft engineering mentorship for faculty teams developing assistive AI tools for accessibility.",
                "domain": "Assistive Artificial Intelligence",
                "required_expertise": ["Artificial Intelligence", "Deep Learning", "Python", "Cloud Architecture"],
                "collaboration_types": ["research_grant", "joint_research"],
                "website_url": "https://www.microsoft.com/en-us/research/academic-programs/ai-for-accessibility/",
                "profile_metadata": {"funding_type": "Corporate Academic Research Grant", "benefits": ["$25,000 Azure Compute Credits", "Microsoft Research Mentorship"]},
                "stipend_or_grant": 1800000.0,
            },
        ]
        existing_hub_opportunities = {
            opportunity.title: opportunity
            for opportunity in (await session.scalars(select(FacultyOpportunity))).all()
        }
        for item in hub_catalog:
            opportunity = existing_hub_opportunities.get(item["title"])
            if opportunity is None:
                opportunity = FacultyOpportunity(title=item["title"], opportunity_type=item["opportunity_type"], organization_name=item["organization_name"], description=item["description"], domain=item["domain"])
                session.add(opportunity)
            for field, value in item.items():
                setattr(opportunity, field, value)
            opportunity.duration_weeks = 12
            opportunity.deadline = _NOW + timedelta(days=90)
            opportunity.status = "open"
            opportunity.objectives = [
                f"Establish a measurable {item['discovery_type']} engagement",
                "Address priority student skill gaps through faculty-led activity",
                "Produce auditable academic and industry outcomes",
            ]
            opportunity.mode = "hybrid"
            opportunity.location = "Bengaluru / Remote"
            opportunity.eligibility = "Full-time faculty members with relevant teaching, research, or program-lead experience."
            opportunity.deliverables = [
                "Signed collaboration or participation plan",
                "Faculty-led student engagement activity",
                "Outcome and impact report",
            ]
            opportunity.required_documents = ["Faculty profile", "Concept note", "Institution approval letter", "Indicative budget"]
            opportunity.contact_email = "faculty-partnerships@example.demo"
            opportunity.contact_person = "Aarav Menon, Academic Partnerships Lead"
        await session.flush()

        # Classify legacy faculty opportunities for the unified hub.
        legacy_opportunities = (await session.scalars(select(FacultyOpportunity))).all()
        for opportunity in legacy_opportunities:
            if opportunity.opportunity_type == "research_grant":
                opportunity.discovery_type = "funding"
                opportunity.collaboration_types = opportunity.collaboration_types or ["research_grant"]
            elif opportunity.opportunity_type == "consultancy_request":
                opportunity.discovery_type = "collaborator"
                opportunity.collaboration_types = opportunity.collaboration_types or ["consultancy"]
            elif opportunity.opportunity_type in {"fdp", "industrial_training"}:
                opportunity.discovery_type = "expert"
                opportunity.collaboration_types = opportunity.collaboration_types or ["faculty_training"]
            elif opportunity.opportunity_type in {"industrial_immersion", "faculty_internship"}:
                opportunity.discovery_type = "collaborator"
                opportunity.collaboration_types = opportunity.collaboration_types or ["faculty_immersion"]

        # 5. Seed Mentorship Sessions & Challenges
        existing_mentor = (await session.scalars(select(MentorshipSession))).first()
        if not existing_mentor:
            session.add_all([
                MentorshipSession(
                    mentor_name="Dr. Arvind Narayanan",
                    mentor_company="Google Research",
                    mentor_role="Principal Research Scientist",
                    domain="AI & Systems Architecture",
                    scheduled_at=_NOW + timedelta(days=3, hours=4),
                    duration_minutes=45,
                    meeting_link="https://meet.google.com/demo-mentorship-1",
                    max_participants=25,
                    description="Interactive 1-on-1 and cohort session on career trajectories in AI research, open problems in model explainability, and preparing for top industrial R&D roles.",
                ),
                MentorshipSession(
                    mentor_name="Priya Sundaram",
                    mentor_company="Atlassian",
                    mentor_role="Senior Engineering Manager",
                    domain="Full Stack & Distributed Cloud",
                    scheduled_at=_NOW + timedelta(days=6, hours=2),
                    duration_minutes=45,
                    meeting_link="https://meet.google.com/demo-mentorship-2",
                    max_participants=20,
                    description="Deep dive on mastering technical interviews, systems design case studies, and building production-ready open source projects.",
                ),
            ])

        existing_challenge = (await session.scalars(select(InnovationChallenge))).first()
        if not existing_challenge:
            session.add_all([
                InnovationChallenge(
                    challenge_type="hackathon",
                    title="Smart India Innovation Challenge: Verifiable Credit Exchange",
                    host_company="National Skill Development Agency",
                    problem_statement="Design an auditable, decentralized micro-credential validation network that links university student projects directly with verified corporate hiring portals.",
                    prize_pool="₹2,50,000",
                    team_size=4,
                    duration_weeks=4,
                    mentor_name="Vikram Sethi (VP Engineering, NSDA)",
                    deliverables=["Architecture Document", "FastAPI Service", "React Demo Dashboard"],
                    milestones=[
                        {"id": "m1", "title": "Protocol Architecture Specification", "status": "completed"},
                        {"id": "m2", "title": "Smart Contract / Cryptographic Engine", "status": "in_progress"},
                        {"id": "m3", "title": "Final Pilot Demo", "status": "pending"},
                    ],
                    deadline=_NOW + timedelta(days=28),
                    tags=["FinTech", "Blockchain", "FastAPI", "React", "Zero-Knowledge"],
                    status="active",
                ),
                InnovationChallenge(
                    challenge_type="live_industry_project",
                    title="Live Industry Project: High-Concurrency Redis Caching & Queue Optimization",
                    host_company="Razorpay Tech Labs",
                    problem_statement="Build an intelligent request-collapsing cache proxy that reduces database connection saturation during peak flash sales by 85%.",
                    prize_pool="₹75,000 Stipend + Pre-Placement Interview",
                    team_size=3,
                    duration_weeks=8,
                    mentor_name="Ananya Roy (Staff SRE, Razorpay)",
                    deliverables=["Benchmarking Suite", "Redis Queue Proxy", "Load Test Report"],
                    milestones=[
                        {"id": "m1", "title": "Benchmark baseline database queries", "status": "completed"},
                        {"id": "m2", "title": "Redis cluster integration & async fallback", "status": "completed"},
                        {"id": "m3", "title": "100k RPS Load testing & report", "status": "in_progress"},
                    ],
                    deadline=_NOW + timedelta(days=45),
                    tags=["Redis", "Python", "Distributed Systems", "Performance Tuning"],
                    status="active",
                ),
                InnovationChallenge(
                    challenge_type="workshop",
                    title="Hands-on Workshop: Production pgvector & RAG Architectures",
                    host_company="Postgres Enterprise Guild",
                    problem_statement="Intensive 2-day technical workshop on deploying HNSW vector indexes, cosine similarity tuning, and low-latency embeddings search in production.",
                    prize_pool="Certificate + Cloud Credits",
                    team_size=1,
                    duration_weeks=1,
                    mentor_name="Dr. Rajiv Mehta (Principal Architect)",
                    deliverables=["Working pgvector Sandbox", "Hybrid Search Query Script"],
                    milestones=[],
                    deadline=_NOW + timedelta(days=14),
                    tags=["PostgreSQL", "pgvector", "Embeddings", "AI Systems"],
                    status="active",
                ),
            ])

        # 7. Seed Demo Accounts & 8 Candidate Profiles for Hackathon Judging

        # Skill taxonomy lookup
        all_skills_list = (await session.scalars(select(Skill))).all()
        skill_map = {s.canonical_name: s for s in all_skills_list}

        # Ensure required skills exist in DB
        required_taxa = [
            ("Python", "Programming Language"),
            ("Machine Learning", "AI & ML"),
            ("FastAPI", "Backend"),
            ("SQL", "Programming Language"),
            ("Data Processing", "Data"),
            ("React", "Frontend"),
            ("TypeScript", "Programming Language"),
            ("Node.js", "Backend"),
            ("PostgreSQL", "Data"),
            ("AWS", "Cloud & DevOps"),
            ("Docker", "Cloud & DevOps"),
            ("Kubernetes", "Cloud & DevOps"),
            ("PyTorch", "AI & ML"),
            ("TensorFlow", "AI & ML"),
            ("Redis", "Backend"),
            ("Cybersecurity", "Security"),
            ("OAuth", "Security"),
            ("Generative AI", "AI & ML"),
            ("NLP", "AI & ML"),
            ("Distributed Systems", "Engineering"),
            ("CI/CD", "Engineering"),
            ("Linux", "Cloud & DevOps"),
        ]
        for name, category in required_taxa:
            if name not in skill_map:
                sk = Skill(canonical_name=name, category=category)
                session.add(sk)
                await session.flush()
                skill_map[name] = sk

        # Seed 8 Candidate Profiles
        candidate_definitions = [
            {
                "email": "rahul.sharma@demo.student",
                "full_name": "Rahul Sharma",
                "university": "National Institute of Technology Demo University",
                "role": "AI Engineer Intern",
                "github": "rahul-sharma-ml",
                "skills": [
                    ("Python", VerificationTier.verified, 0.95),
                    ("Machine Learning", VerificationTier.verified, 0.92),
                    ("TensorFlow", VerificationTier.verified, 0.90),
                    ("SQL", VerificationTier.verified, 0.88),
                    ("Data Processing", VerificationTier.verified, 0.85),
                ],
                "evidence": [
                    ("Medical Image Classification System", "Deep Learning pipeline for CT/X-ray multi-class pathology classification.", EvidenceType.project),
                    ("GitHub ML Repositories (3 repos)", "Over 180 commits across 3 reproducible machine learning model pipelines.", EvidenceType.project),
                    ("Proctored Machine Learning Assessment", "Proctored ML benchmark score: 91% (Passed with Distinction).", EvidenceType.certification),
                ],
            },
            {
                "email": "maya@example.demo",
                "full_name": "Maya Rivera",
                "university": "Harbor Polytechnic University",
                "role": "Full-Stack & Distributed Systems",
                "github": "demo-maya",
                "skills": [
                    ("Python", VerificationTier.verified, 0.96),
                    ("FastAPI", VerificationTier.verified, 0.94),
                    ("PostgreSQL", VerificationTier.verified, 0.92),
                    ("React", VerificationTier.verified, 0.90),
                    ("Docker", VerificationTier.verified, 0.88),
                    ("Machine Learning", VerificationTier.verified, 0.86),
                ],
                "evidence": [
                    ("Reliable Microservices Platform", "Async REST APIs with sub-10ms response times and deterministic schemas.", EvidenceType.project),
                    ("Video AI Analytics Engine", "Computer vision pipeline streaming frames with YOLO and TensorRT.", EvidenceType.project),
                    ("Advanced Python & AsyncIO Assessment", "Score: 96% (96/100 pts) · Proctored Sandbox Execution.", EvidenceType.certification),
                ],
            },
            {
                "email": "noah@example.demo",
                "full_name": "Noah Chen",
                "university": "Northwind Institute",
                "role": "Backend & Distributed Systems",
                "github": "noah-chen-backend",
                "skills": [
                    ("Python", VerificationTier.verified, 0.90),
                    ("FastAPI", VerificationTier.verified, 0.91),
                    ("PostgreSQL", VerificationTier.verified, 0.89),
                    ("Redis", VerificationTier.verified, 0.88),
                    ("Distributed Systems", VerificationTier.verified, 0.86),
                ],
                "evidence": [
                    ("Distributed Stream Engine", "High-throughput pub/sub cluster with partition rebalancing.", EvidenceType.project),
                    ("Backend Concurrency Benchmark", "Score: 88% on concurrent load testing and transactional integrity.", EvidenceType.certification),
                ],
            },
            {
                "email": "aria@example.demo",
                "full_name": "Aria Patel",
                "university": "Eastlake College",
                "role": "Cloud Infrastructure & DevOps",
                "github": "aria-patel-cloud",
                "skills": [
                    ("AWS", VerificationTier.verified, 0.94),
                    ("Docker", VerificationTier.verified, 0.92),
                    ("Kubernetes", VerificationTier.verified, 0.90),
                    ("CI/CD", VerificationTier.verified, 0.88),
                    ("Linux", VerificationTier.verified, 0.86),
                ],
                "evidence": [
                    ("Multi-Cluster Kubernetes CI/CD", "GitOps deployment pipelines with automated canary rollouts.", EvidenceType.project),
                    ("Cloud Architecture Proctored Exam", "Score: 92% · Validated container orchestration and security.", EvidenceType.certification),
                ],
            },
            {
                "email": "priya.sharma@demo.student",
                "full_name": "Priya Sharma",
                "university": "National Institute of Technology Demo University",
                "role": "Frontend & Design Systems",
                "github": "priya-ui-dev",
                "skills": [
                    ("React", VerificationTier.verified, 0.94),
                    ("TypeScript", VerificationTier.verified, 0.92),
                    ("Node.js", VerificationTier.verified, 0.88),
                    ("SQL", VerificationTier.verified, 0.80),
                ],
                "evidence": [
                    ("Accessible Component Library", "Design system with 100% WCAG 2.1 AA accessibility compliance.", EvidenceType.project),
                    ("Frontend Engineering Assessment", "Score: 89% on state management, bundle optimization, and DOM performance.", EvidenceType.certification),
                ],
            },
            {
                "email": "blake@example.demo",
                "full_name": "Blake Morgan",
                "university": "Summit University",
                "role": "Data Engineering & Pipelines",
                "github": "blake-morgan-data",
                "skills": [
                    ("SQL", VerificationTier.verified, 0.92),
                    ("PostgreSQL", VerificationTier.verified, 0.90),
                    ("Python", VerificationTier.verified, 0.86),
                    ("Data Processing", VerificationTier.verified, 0.88),
                ],
                "evidence": [
                    ("Real-Time Telemetry ETL", "Streaming pipeline processing 50k events/sec with fault tolerance.", EvidenceType.project),
                    ("Data Processing Benchmark", "Score: 85% on window functions, indexing, and query plan optimization.", EvidenceType.certification),
                ],
            },
            {
                "email": "vikram.reddy@demo.student",
                "full_name": "Vikram Reddy",
                "university": "National Institute of Technology Demo University",
                "role": "Cybersecurity & Systems Security",
                "github": "vikram-reddy-sec",
                "skills": [
                    ("Cybersecurity", VerificationTier.verified, 0.93),
                    ("OAuth", VerificationTier.verified, 0.90),
                    ("Linux", VerificationTier.verified, 0.88),
                    ("Python", VerificationTier.verified, 0.84),
                    ("Docker", VerificationTier.verified, 0.82),
                ],
                "evidence": [
                    ("Zero-Trust PKI Audit Engine", "Cryptographic authorization gateway with mutual TLS and JWT validation.", EvidenceType.project),
                    ("Application Security Assessment", "Score: 86% on OWASP Top 10 mitigation and cryptographic defense.", EvidenceType.certification),
                ],
            },
            {
                "email": "elena.rostova@demo.student",
                "full_name": "Elena Rostova",
                "university": "National Institute of Technology Demo University",
                "role": "Generative AI & NLP Engineer",
                "github": "elena-rostova-ai",
                "skills": [
                    ("Python", VerificationTier.verified, 0.95),
                    ("Machine Learning", VerificationTier.verified, 0.94),
                    ("Generative AI", VerificationTier.verified, 0.92),
                    ("PyTorch", VerificationTier.verified, 0.90),
                    ("FastAPI", VerificationTier.verified, 0.88),
                ],
                "evidence": [
                    ("RAG Vector Search & Evaluation", "Production retrieval-augmented generation engine with grounded hallucination checks.", EvidenceType.project),
                    ("Applied NLP Assessment", "Score: 93% on transformer fine-tuning, vector embeddings, and semantic search.", EvidenceType.certification),
                ],
            },
        ]

        seeded_students = []
        for cand in candidate_definitions:
            st = (await session.scalars(select(Student).where(Student.email == cand["email"]))).first()
            if not st:
                st = Student(
                    email=cand["email"],
                    password_hash=DEMO_PASSWORD_HASH,
                    full_name=cand["full_name"],
                    university=cand["university"],
                    github_username=cand["github"],
                    recruiter_evidence_consent=True,
                    career_goals={"target_roles": [cand["role"]]},
                )
                session.add(st)
                await session.flush()
            else:
                st.password_hash = DEMO_PASSWORD_HASH
                st.full_name = cand["full_name"]
                st.university = cand["university"]
                st.recruiter_evidence_consent = True
                await session.flush()
            await _ensure_account_email(session, st.email, st.id, Role.student)

            seeded_students.append(st)

            # Seed evidence and student skills
            for ev_title, ev_desc, ev_type in cand["evidence"]:
                existing_ev = (await session.scalars(select(Evidence).where(Evidence.student_id == st.id, Evidence.title == ev_title))).first()
                if not existing_ev:
                    session.add(
                        Evidence(
                            student_id=st.id,
                            evidence_type=ev_type,
                            title=ev_title,
                            description=ev_desc,
                        )
                    )
            await session.flush()

            # Seed student skills
            for s_name, s_tier, s_conf in cand["skills"]:
                if s_name in skill_map:
                    s_obj = skill_map[s_name]
                    existing_ss = (await session.scalars(select(StudentSkill).where(StudentSkill.student_id == st.id, StudentSkill.skill_id == s_obj.id))).first()
                    if not existing_ss:
                        ev_rec = (await session.scalars(select(Evidence).where(Evidence.student_id == st.id))).first()
                        if ev_rec:
                            session.add(
                                StudentSkill(
                                    student_id=st.id,
                                    skill_id=s_obj.id,
                                    source_evidence_id=ev_rec.id,
                                    verification_tier=s_tier,
                                    extraction_confidence=s_conf,
                                    proficiency_hint="advanced",
                                    evidence_span=f"Demonstrated proficiency in {s_name} with {int(s_conf * 100)}% verified benchmark score.",
                                )
                            )
            await session.flush()

        # Maya Rivera student alias
        if not await session.scalar(select(Student.id).where(Student.email == "maya@poly.demo")):
            st_poly = Student(
                email="maya@poly.demo",
                password_hash=DEMO_PASSWORD_HASH,
                full_name="Maya Rivera",
                university="Harbor Polytechnic University",
                github_username="demo-maya",
                recruiter_evidence_consent=True,
            )
            session.add(st_poly)
            await session.flush()
            await _ensure_account_email(session, st_poly.email, st_poly.id, Role.student)

        # 1. RECRUITER DEMO ACCOUNT: Arjun Mehta (recruiter.demo@technova.com / demo123)
        rec_demo = (await session.scalars(select(Recruiter).where(Recruiter.email == "recruiter.demo@technova.com"))).first()
        if not rec_demo:
            rec_demo = Recruiter(
                email="recruiter.demo@technova.com",
                password_hash=DEMO_PASSWORD_HASH,
                company_name="TechNova AI Solutions",
            )
            session.add(rec_demo)
            await session.flush()
        else:
            rec_demo.password_hash = DEMO_PASSWORD_HASH
            rec_demo.company_name = "TechNova AI Solutions"
            await session.flush()
        await _ensure_account_email(session, rec_demo.email, rec_demo.id, Role.recruiter)

        rec_ex = (await session.scalars(select(Recruiter).where(Recruiter.email == "recruiter@example.demo"))).first()
        if not rec_ex:
            rec_ex = Recruiter(
                email="recruiter@example.demo",
                password_hash=DEMO_PASSWORD_HASH,
                company_name="TechNova AI Solutions",
            )
            session.add(rec_ex)
            await session.flush()
        else:
            rec_ex.password_hash = DEMO_PASSWORD_HASH
            await session.flush()
        await _ensure_account_email(session, rec_ex.email, rec_ex.id, Role.recruiter)

        # Seed TechNova Internships
        existing_internships = (await session.scalars(select(Internship).where(Internship.recruiter_id == rec_demo.id))).all()
        if not existing_internships:
            ai_intern = Internship(
                recruiter_id=rec_demo.id,
                title="AI Engineering Intern",
                description="Design production AI microservices, train predictive neural networks, and deploy high-performance FastAPI backends with PostgreSQL and vector embeddings.",
                opportunity_type="internship",
                mode="hybrid",
                stipend_amount=35000.0,
                duration_weeks=24,
                location="Bangalore, India",
                is_published=True,
            )
            fs_intern = Internship(
                recruiter_id=rec_demo.id,
                title="Full Stack Developer Intern",
                description="Build scalable client dashboards, real-time collaboration canvas, and performant backend services with React, TypeScript, Node.js, and PostgreSQL.",
                opportunity_type="internship",
                mode="hybrid",
                stipend_amount=30000.0,
                duration_weeks=24,
                location="Bangalore, India",
                is_published=True,
            )
            cloud_intern = Internship(
                recruiter_id=rec_demo.id,
                title="Cloud Engineering Trainee",
                description="Manage Kubernetes container clusters, automate CI/CD pipelines, and optimize AWS cloud resources.",
                opportunity_type="internship",
                mode="hybrid",
                stipend_amount=28000.0,
                duration_weeks=24,
                location="Bangalore, India",
                is_published=True,
            )
            session.add_all([ai_intern, fs_intern, cloud_intern])
            await session.flush()

            # Requirements
            for internship, req_list in [
                (ai_intern, [("Python", True, 1.0), ("Machine Learning", True, 1.0), ("FastAPI", True, 1.0), ("SQL", False, 0.8), ("Data Processing", False, 0.8)]),
                (fs_intern, [("React", True, 1.0), ("TypeScript", True, 1.0), ("Node.js", True, 1.0), ("PostgreSQL", False, 0.8)]),
                (cloud_intern, [("AWS", True, 1.0), ("Docker", True, 1.0), ("Kubernetes", True, 1.0)]),
            ]:
                for s_name, is_req, wt in req_list:
                    if s_name in skill_map:
                        session.add(
                            InternshipRequirement(
                                internship_id=internship.id,
                                skill_id=skill_map[s_name].id,
                                is_required=is_req,
                                weight=wt,
                            )
                        )
            await session.flush()

            for intern in (ai_intern, fs_intern, cloud_intern):
                await recompute_matches_for_internship(session, intern.id)

        # 2. FACULTY DEMO ACCOUNT: Dr. Ananya Sharma (faculty.demo@example.com / demo123)
        fac_demo = (await session.scalars(select(Academician).where(Academician.email == "faculty.demo@example.com"))).first()
        if not fac_demo:
            fac_demo = Academician(
                email="faculty.demo@example.com",
                password_hash=DEMO_PASSWORD_HASH,
                full_name="Dr. Ananya Sharma",
                institution_name="National Institute of Technology Demo University",
                department="Computer Science Engineering",
                designation="Associate Professor",
                research_areas=["Artificial Intelligence", "Machine Learning", "Data Analytics", "Software Engineering"],
                bio="Associate Professor in Computer Science & Engineering with 8 years of academic and research experience. Focuses on Deep Learning, Explainable AI, Predictive Analytics, and industry-academic bridge programs. Active mentor for student capstone teams and PI on AI skill mapping research initiatives.",
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
            session.add(fac_demo)
            await session.flush()
        else:
            fac_demo.password_hash = DEMO_PASSWORD_HASH
            await session.flush()

        # Refresh the judge-facing faculty passport on every seed run so an
        # existing demo database receives the same complete account as a fresh
        # checkout. These are display/profile records only and never enter the
        # student matching pipeline.
        fac_demo.full_name = "Dr. Ananya Sharma"
        fac_demo.institution_name = "National Institute of Technology Demo University"
        fac_demo.department = "Computer Science and Engineering"
        fac_demo.designation = "Associate Professor and Faculty Innovation Lead"
        fac_demo.research_areas = [
            "Explainable Artificial Intelligence",
            "Machine Learning Systems",
            "Skill Analytics",
            "Cloud and Distributed Systems",
            "Industry-Academia Collaboration",
        ]
        fac_demo.bio = (
            "Associate Professor and Faculty Innovation Lead with 12 years of academic, "
            "research, and industry-collaboration experience. Leads sponsored projects in "
            "explainable AI, verifiable skill intelligence, cloud-native systems, and "
            "outcome-driven student readiness programs."
        )
        fac_demo.years_experience = 12
        fac_demo.technical_skills = [
            "Artificial Intelligence", "Machine Learning", "Explainable AI", "Python",
            "PyTorch", "MLOps", "Generative AI", "FastAPI", "PostgreSQL", "pgvector",
            "Docker", "Kubernetes", "Cloud Architecture", "Data Analytics",
        ]
        fac_demo.certifications = [
            {"name": "AWS Certified Cloud Practitioner", "issuer": "Amazon Web Services", "year": "2024", "credential_url": "https://credentials.example.demo/ananya/aws-cloud-practitioner"},
            {"name": "Machine Learning Specialization", "issuer": "DeepLearning.AI and Stanford Online", "year": "2023", "credential_url": "https://credentials.example.demo/ananya/ml-specialization"},
            {"name": "Professional Cloud Architect", "issuer": "Google Cloud", "year": "2025", "credential_url": "https://credentials.example.demo/ananya/cloud-architect"},
            {"name": "Responsible AI Practitioner", "issuer": "IEEE Computer Society", "year": "2026", "credential_url": "https://credentials.example.demo/ananya/responsible-ai"},
        ]
        fac_demo.publications = [
            {"title": "Deep Learning Approaches for Predictive Analytics", "journal_or_conf": "International AI Research Journal", "year": "2025", "doi_or_url": "https://doi.org/10.0000/demo.2025.101"},
            {"title": "Industry-Academia Collaboration Models for Skill Development", "journal_or_conf": "Journal of Engineering Education and Industry Practice", "year": "2024", "doi_or_url": "https://doi.org/10.0000/demo.2024.212"},
            {"title": "Automated Skill Verification and Provenance Telemetry", "journal_or_conf": "IEEE Transactions on Learning Technologies", "year": "2025", "doi_or_url": "https://doi.org/10.0000/demo.2025.314"},
            {"title": "Explainable Vector Embeddings for Student Competency Mapping", "journal_or_conf": "ACM SIGCSE", "year": "2024", "doi_or_url": "https://doi.org/10.0000/demo.2024.415"},
            {"title": "Zero-Demographic-Bias Talent Pipelines", "journal_or_conf": "ACM KDD Workshop", "year": "2023", "doi_or_url": "https://doi.org/10.0000/demo.2023.516"},
        ]
        fac_demo.patents = [
            {"title": "System and Method for Provable Skill Provenance Verification", "patent_number": "IN-2024-99881", "status": "Granted", "year": "2024"},
            {"title": "Deterministic Competency Graph Generator for Multi-Tenant Workspaces", "patent_number": "IN-2025-10293", "status": "Published", "year": "2025"},
            {"title": "Evidence-Linked Workforce Readiness Analytics", "patent_number": "IN-2026-11842", "status": "Filed", "year": "2026"},
        ]
        fac_demo.past_industry_experience = [
            {"company": "TechNova AI Solutions", "role": "AI Consulting Lead", "duration_years": 2, "description": "Advised production ML delivery, model observability, and explainability programs."},
            {"company": "Vision Analytics Labs", "role": "Research Collaboration Advisor", "duration_years": 3, "description": "Directed joint R&D on privacy-preserving student readiness analytics."},
            {"company": "CloudSphere Technologies", "role": "Industry Mentorship Director", "duration_years": 3, "description": "Co-designed cloud-native laboratories, faculty immersion, and student capstones."},
        ]
        fac_demo.completed_fdps = [
            {"title": "Cloud Architecture FDP", "organizer": "CloudSphere Technologies", "year": "2025", "mode": "5-day Hybrid", "certificate_url": "https://credentials.example.demo/ananya/cloud-fdp"},
            {"title": "National FDP on Explainable Artificial Intelligence", "organizer": "IIT Bombay and AICTE", "year": "2024", "mode": "2-week Online", "certificate_url": "https://credentials.example.demo/ananya/xai-fdp"},
            {"title": "Outcome-Based Engineering Education", "organizer": "ISTE", "year": "2026", "mode": "3-day On-site", "certificate_url": "https://credentials.example.demo/ananya/obe-fdp"},
        ]
        fac_demo.completed_trainings = [
            {"title": "Industry 4.0 Faculty Training", "company": "TechNova AI Solutions", "duration_weeks": 3, "year": "2025", "skills": ["AI Systems", "Cloud Architecture", "DevOps"]},
            {"title": "AI Faculty Immersion Program", "company": "TechNova AI Solutions", "duration_weeks": 4, "year": "2026", "skills": ["Machine Learning", "MLOps", "Generative AI"]},
            {"title": "Secure Data Engineering Practicum", "company": "Future Systems Foundation", "duration_weeks": 2, "year": "2026", "skills": ["Data Engineering", "Cloud Security", "PostgreSQL"]},
        ]
        fac_demo.collaboration_availability = "available"
        fac_demo.phone = "+91 98765 43210"
        fac_demo.linkedin_url = "https://linkedin.com/in/demo-dr-ananya-sharma"
        fac_demo.google_scholar_url = "https://scholar.google.com/citations?user=demo_ananya_sharma"
        await session.flush()
        await _ensure_account_email(session, fac_demo.email, fac_demo.id, Role.academician)
        await _ensure_account_email(session, "faculty@example.demo", fac_demo.id, Role.academician)
        await _ensure_account_email(session, "faculty.advisor@university.demo", fac_demo.id, Role.academician)

        fac_ex = (await session.scalars(select(Academician).where(Academician.email == "faculty@example.demo"))).first()
        if not fac_ex:
            fac_ex = Academician(
                email="faculty@example.demo",
                password_hash=DEMO_PASSWORD_HASH,
                full_name="Dr. Ananya Sharma",
                institution_name="National Institute of Technology Demo University",
                department="Computer Science Engineering",
                designation="Associate Professor",
                years_experience=8,
                research_areas=["Artificial Intelligence", "Machine Learning", "Data Analytics", "Software Engineering"],
                technical_skills=["Artificial Intelligence", "Machine Learning", "Data Analytics", "Software Engineering", "Python", "PyTorch", "MLOps", "Generative AI", "FastAPI"],
                certifications=fac_demo.certifications,
                publications=fac_demo.publications,
                patents=fac_demo.patents,
                past_industry_experience=fac_demo.past_industry_experience,
                completed_fdps=fac_demo.completed_fdps,
                completed_trainings=fac_demo.completed_trainings,
            )
            session.add(fac_ex)
            await session.flush()

        # Seed Faculty Applications and Workspaces if not present
        existing_apps = (await session.scalars(select(FacultyApplication).where(FacultyApplication.faculty_id == fac_demo.id))).all()
        if not existing_apps:
            opps = (await session.scalars(select(FacultyOpportunity))).all()

            # 1. Accepted Research Grant -> Spawns Collaboration Workspace
            grant_opp = next((o for o in opps if o.opportunity_type == "research_grant"), None)
            if grant_opp:
                grant_app = FacultyApplication(
                    faculty_id=fac_demo.id,
                    opportunity_id=grant_opp.id,
                    status="accepted",
                    application_type="research_grant",
                    proposal_title="AI Based Student Skill Prediction Model",
                    proposal_text="A machine learning and predictive analytics research framework to model student competency trajectories, forecast skill readiness for high-demand technical roles, and generate early-intervention pedagogy recommendations for faculty advisors.",
                    problem_statement="Traditional academic evaluation relies on static semester examinations which fail to capture continuous skill progression or project-based telemetry.",
                    methodology="Implement async FastAPI predictive microservices leveraging PostgreSQL pgvector embeddings and transformer-based skill progression models.",
                    deliverables=["AI Skill Prediction Model", "Validation Benchmark Suite", "Interactive Faculty Advising Dashboard"],
                    milestones=[
                        {"id": "m1", "title": "Literature Review & Problem Formulation", "status": "completed", "due_date": "Month 1"},
                        {"id": "m2", "title": "Dataset Preparation & Anonymization Pipeline", "status": "completed", "due_date": "Month 2"},
                        {"id": "m3", "title": "Model Development & Predictive Benchmarking", "status": "in_progress", "due_date": "Month 4"},
                        {"id": "m4", "title": "Pilot Validation & Industrial Dissemination", "status": "pending", "due_date": "Month 6"},
                    ],
                    timeline_weeks=24,
                    budget_requested=1500000.0,
                    industry_mentor_name="Vikram Sethi (Senior AI Architect)",
                    industry_mentor_email="vikram.sethi@technova.demo",
                    engagement_status="active",
                    start_date=_NOW - timedelta(days=60),
                )
                session.add(grant_app)
                await session.flush()

                grant_ws = CollaborationWorkspace(
                    application_id=grant_app.id,
                    title="AI Skill Mapping Research Project",
                    collaboration_type="research_collaboration",
                    organization_name=grant_opp.organization_name,
                    faculty_lead_id=fac_demo.id,
                    industry_lead_name="Vikram Sethi",
                    industry_lead_email="vikram.sethi@technova.demo",
                    status="active",
                    progress_percentage=72,
                    objectives=grant_app.deliverables,
                    participants=[
                        {"id": str(fac_demo.id), "name": fac_demo.full_name, "role": "Principal Investigator & Faculty Lead", "department": fac_demo.department},
                        {"name": "Vikram Sethi", "role": "Industry Research Lead & Mentor", "company": grant_opp.organization_name},
                        {"name": "Maya Rivera", "role": "Student Researcher (ML Pipeline)", "department": "Computer Science"},
                        {"name": "Noah Chen", "role": "Student Researcher (Backend & Vector DB)", "department": "Information Technology"},
                    ],
                    milestones=grant_app.milestones,
                    tasks=[
                        {"id": "t1", "title": "Literature review on skill telemetry graph models", "assigned_to": "Dr. Ananya Sharma", "status": "done", "priority": "high"},
                        {"id": "t2", "title": "Synthesize benchmarking datasets across student cohorts", "assigned_to": "Maya Rivera", "status": "done", "priority": "high"},
                        {"id": "t3", "title": "Train baseline transformer model for competency prediction", "assigned_to": "Noah Chen", "status": "in_progress", "priority": "high"},
                        {"id": "t4", "title": "Draft interim research findings report", "assigned_to": "Dr. Ananya Sharma", "status": "in_progress", "priority": "medium"},
                    ],
                    meetings=[
                        {"id": "mt1", "title": "Weekly R&D Sync with TechNova AI Labs", "date": "Every Wednesday 3:30 PM IST", "link": "https://meet.google.com/demo-ai-skill-map"},
                    ],
                    discussion_posts=[
                        {
                            "id": "dp1",
                            "author_name": "Vikram Sethi",
                            "author_role": "industry_mentor",
                            "content": "The dataset anonymization pipeline passed compliance review. Preliminary ROC-AUC is 0.89 on the validation cohort. Outstanding work on milestone 2.",
                            "created_at": (_NOW - timedelta(days=5)).isoformat(),
                        },
                        {
                            "id": "dp2",
                            "author_name": "Dr. Ananya Sharma",
                            "author_role": "faculty_lead",
                            "content": "Thank you Vikram. Maya and Noah have integrated the vector similarity metrics. We are now running the transformer fine-tuning loop.",
                            "created_at": (_NOW - timedelta(days=2)).isoformat(),
                        },
                    ],
                    deliverables=[
                        {"id": "d1", "title": "Dataset Preparation and Anonymization Protocol", "deliverable_type": "technical_report", "url_or_key": "https://docs.example.demo/dataset-protocol-v1.pdf", "submitted_at": (_NOW - timedelta(days=30)).isoformat()},
                        {"id": "d2", "title": "Model Architecture & Benchmark Specification", "deliverable_type": "code_repo", "url_or_key": "https://github.com/demo-ananya/ai-skill-prediction-model", "submitted_at": (_NOW - timedelta(days=10)).isoformat()},
                    ],
                    feedback=[
                        {"author_name": "Vikram Sethi", "author_role": "industry_mentor", "rating": 5, "comments": "Exceptional rigor and seamless student mentorship. The predictive skill models exceed initial accuracy targets.", "created_at": (_NOW - timedelta(days=3)).isoformat()}
                    ],
                    start_date=_NOW - timedelta(days=60),
                )
                session.add(grant_ws)

            # 2. Accepted Industrial Immersion Application
            imm_opp = next((o for o in opps if o.opportunity_type == "industrial_immersion"), None)
            if imm_opp:
                session.add(
                    FacultyApplication(
                        faculty_id=fac_demo.id,
                        opportunity_id=imm_opp.id,
                        status="accepted",
                        application_type="industrial_immersion",
                        proposal_title="Advanced AI Faculty Immersion Program",
                        proposal_text="Hands-on 4-week industrial immersion participating in production Generative AI deployments, automated MLOps evaluation frameworks, and high-throughput vector index fine-tuning.",
                        timeline_weeks=4,
                        budget_requested=180000.0,
                        engagement_status="active",
                        start_date=_NOW - timedelta(days=20),
                    )
                )

            # 3. Completed FDP
            fdp_opp = next((o for o in opps if o.opportunity_type == "fdp"), None)
            if fdp_opp:
                session.add(
                    FacultyApplication(
                        faculty_id=fac_demo.id,
                        opportunity_id=fdp_opp.id,
                        status="completed",
                        application_type="fdp",
                        proposal_title="Cloud Architecture FDP",
                        proposal_text="Completed national 5-day hybrid faculty development program on modern cloud distributed architectures and microservices design.",
                        timeline_weeks=1,
                        engagement_status="completed",
                        completion_report="Successfully completed all hands-on labs and integrated cloud distributed computing modules into university curriculum.",
                        start_date=_NOW - timedelta(days=120),
                        end_date=_NOW - timedelta(days=115),
                    )
                )

            # Notifications
            session.add_all([
                FacultyNotification(
                    faculty_id=fac_demo.id,
                    title="R&D Grant Proposal Accepted (₹15 Lakhs) 🎉",
                    message="Your research proposal 'AI Based Student Skill Prediction Model' has been accepted by Vision Analytics Labs & Consortium. Collaboration workspace activated.",
                    category="application",
                    is_read=True,
                ),
                FacultyNotification(
                    faculty_id=fac_demo.id,
                    title="Milestone 2 Endorsed by TechNova AI Solutions",
                    message="Vikram Sethi endorsed Milestone 2: Dataset Preparation & Anonymization Pipeline (ROC-AUC 0.89).",
                    category="workspace",
                    is_read=False,
                ),
                FacultyNotification(
                    faculty_id=fac_demo.id,
                    title="Upcoming Industry Guest Lecture",
                    message="Industry Expert Guest Lecture on 'Building Production AI Systems' is scheduled for next week.",
                    category="general",
                    is_read=False,
                ),
            ])

            # Event Registrations & Mentorship Events
            session.add_all([
                FacultyEventRegistration(
                    faculty_id=fac_demo.id,
                    event_id=uuid.uuid4(),
                    event_type="guest_lecture",
                    event_title="Industry Expert Guest Lecture: Production AI Systems",
                    host_organization="TechNova AI Solutions",
                    role="organizer",
                    status="upcoming",
                    feedback="Guest lecture featuring Senior AI Architect Vikram Sethi on LLM orchestration and vector search latency.",
                    scheduled_at=_NOW + timedelta(days=5),
                ),
                FacultyEventRegistration(
                    faculty_id=fac_demo.id,
                    event_id=uuid.uuid4(),
                    event_type="workshop",
                    event_title="Production pgvector & RAG Architectures Workshop",
                    host_organization="Postgres Enterprise Guild",
                    role="speaker",
                    status="completed",
                    feedback="Delivered keynote lecture on High-Dimensional Vector Search and Academic Credit Verification.",
                    scheduled_at=_NOW - timedelta(days=14),
                ),
            ])

            # Seed Student Project Applications for Advising Tab
            challenges = (await session.scalars(select(InnovationChallenge))).all()
            if challenges:
                c1 = challenges[0]
                student_maya = (await session.scalars(select(Student).where(Student.email == "maya@example.demo"))).first()
                if student_maya:
                    session.add(
                        ProjectApplication(
                            challenge_id=c1.id,
                            student_id=student_maya.id,
                            team_members=["Maya Rivera", "Noah Chen", "Aria Patel"],
                            status="submitted",
                            submission_url="https://github.com/demo-maya/ai-resume-intel-engine",
                            feedback="[Academic Advisor Feedback by Dr. Ananya Sharma]: Strong architectural foundation with robust zero-PII data sanitization and deterministic vector search metrics.",
                            score_or_grade="A+ (Outstanding)",
                        )
                    )
                if len(challenges) > 1:
                    c2 = challenges[1]
                    session.add(
                        ProjectApplication(
                            challenge_id=c2.id,
                            student_id=student_maya.id,
                            team_members=["Rahul Sharma", "Priya Sharma", "Elena Rostova", "Vikram Reddy"],
                            status="completed",
                            submission_url="https://github.com/demo-rahul/smart-skill-recommender",
                            feedback="[Academic Advisor Feedback by Dr. Ananya Sharma]: Completed project demonstrating real-time caching and recommendation inference.",
                            score_or_grade="A (Excellent)",
                        )
                    )

            # Seed Document Vault entries for Dr. Ananya Sharma
            session.add_all([
                UserDocument(
                    user_id=fac_demo.id,
                    user_role="academician",
                    document_type="certificate",
                    title="FDP Certificate - Cloud Architecture FDP",
                    file_name="CloudArchitecture_FDP_Certificate.pdf",
                    file_size_bytes=198000,
                    mime_type="application/pdf",
                    file_url="https://credentials.technova.demo/certs/fdp-cert-2025.pdf",
                    verification_status="verified",
                    metadata_payload={"issuer": "CloudSphere Technologies", "mode": "Hybrid", "year": "2025"},
                ),
                UserDocument(
                    user_id=fac_demo.id,
                    user_role="academician",
                    document_type="research_document",
                    title="Research Proposal - AI Based Student Skill Prediction Model",
                    file_name="AI_Skill_Prediction_Grant_Proposal_Approved.pdf",
                    file_size_bytes=890000,
                    mime_type="application/pdf",
                    file_url="https://research.nit.demo/proposals/ai-skill-predict-grant-2026.pdf",
                    verification_status="verified",
                    metadata_payload={"grant_amount_inr": 1500000.0, "grantor": "Vision Analytics Labs", "status": "Approved"},
                ),
                UserDocument(
                    user_id=fac_demo.id,
                    user_role="academician",
                    document_type="collaboration_agreement",
                    title="Industry Collaboration Agreement - TechNova AI Solutions",
                    file_name="MoU_TechNova_NIT_2026.pdf",
                    file_size_bytes=420000,
                    mime_type="application/pdf",
                    file_url="https://contracts.nit.demo/agreements/technova-mou-2026.pdf",
                    verification_status="verified",
                    metadata_payload={"partner": "TechNova AI Solutions", "agreement_type": "MoU R&D Partnership"},
                ),
                UserDocument(
                    user_id=fac_demo.id,
                    user_role="academician",
                    document_type="publication",
                    title="Publication Record - Deep Learning Approaches for Predictive Analytics",
                    file_name="Deep_Learning_Predictive_Analytics_Preprint.pdf",
                    file_size_bytes=640000,
                    mime_type="application/pdf",
                    file_url="https://doi.org/10.1016/j.aij.2025.04.019",
                    verification_status="verified",
                    metadata_payload={"journal": "International AI Research Journal", "year": "2025", "peer_reviewed": True},
                ),
            ])

        # Complete legacy faculty lifecycle records independently of the initial
        # fixture guard so rerunning the seed upgrades an existing demo account.
        faculty_applications_by_title = {
            application.proposal_title: application
            for application in (
                await session.scalars(
                    select(FacultyApplication).where(FacultyApplication.faculty_id == fac_demo.id)
                )
            ).all()
        }
        immersion_application = faculty_applications_by_title.get("Advanced AI Faculty Immersion Program")
        if immersion_application:
            immersion_application.problem_statement = "Faculty need production exposure to translate current AI engineering practices into laboratory and capstone curricula."
            immersion_application.objectives = ["Shadow production AI teams", "Build an observable MLOps pipeline", "Translate findings into two curriculum modules"]
            immersion_application.methodology = "Four-week mentor-led immersion combining architecture reviews, paired engineering sprints, weekly demonstrations, and a faculty reflection report."
            immersion_application.team_members = [{"name": "Dr. Ananya Sharma", "role": "Faculty Fellow", "department": "Computer Science and Engineering"}]
            immersion_application.student_researchers = [{"name": "Maya Rivera", "roll_no": "CSE-2026-041", "skill": "MLOps benchmarking"}]
            immersion_application.deliverables = ["Production MLOps reference architecture", "Faculty immersion reflection report", "Cloud-native curriculum module"]
            immersion_application.milestones = [
                {"id": "imm-1", "title": "Mentor alignment and environment access", "status": "completed", "due_date": "Week 1"},
                {"id": "imm-2", "title": "Production pipeline shadowing", "status": "completed", "due_date": "Week 2"},
                {"id": "imm-3", "title": "Observability prototype", "status": "in_progress", "due_date": "Week 3"},
                {"id": "imm-4", "title": "Curriculum transfer workshop", "status": "pending", "due_date": "Week 4"},
            ]
            immersion_application.industry_support_required = "Cloud sandbox, architecture mentor, model monitoring stack, and production-readiness review."
            immersion_application.industry_mentor_name = "Aarav Menon, Principal MLOps Architect"
            immersion_application.industry_mentor_email = "aarav.menon@technova.demo"
            immersion_application.attachments = [{"name": "Faculty Immersion Charter", "url": "https://documents.example.demo/faculty/immersion-charter.pdf", "type": "charter"}]
            immersion_application.reviewer_notes = "Selected for strong alignment with institutional cloud and AI readiness priorities."
            immersion_application.feedback = "Week-two review completed; the observability prototype is ahead of schedule."
            immersion_application.end_date = _NOW + timedelta(days=8)
            immersion_application.outcome_type = "curriculum_update"
            immersion_application.outcome_details = {"modules_planned": 2, "faculty_reached": 18, "student_beneficiaries": 240}

        grant_application = faculty_applications_by_title.get("AI Based Student Skill Prediction Model")
        if grant_application:
            grant_application.objectives = ["Build an auditable readiness model", "Validate across three cohorts", "Publish a reproducible benchmark"]
            grant_application.team_members = [
                {"name": "Dr. Ananya Sharma", "role": "Principal Investigator", "department": "Computer Science and Engineering"},
                {"name": "Dr. Rohan Banerjee", "role": "Co-Investigator", "department": "Information Technology"},
            ]
            grant_application.student_researchers = [
                {"name": "Maya Rivera", "roll_no": "CSE-2026-041", "skill": "Machine Learning"},
                {"name": "Noah Chen", "roll_no": "IT-2026-019", "skill": "Vector Databases"},
            ]
            grant_application.industry_support_required = "Anonymized evaluation sandbox, cloud credits, quarterly architecture reviews, and dissemination support."
            grant_application.attachments = [
                {"name": "Approved Research Proposal", "url": "https://documents.example.demo/faculty/ai-skill-grant.pdf", "type": "proposal"},
                {"name": "Ethics and Fairness Protocol", "url": "https://documents.example.demo/faculty/fairness-protocol.pdf", "type": "protocol"},
            ]
            grant_application.reviewer_notes = "Approved subject to quarterly fairness audits and evidence-provenance reporting."
            grant_application.feedback = "First two milestones accepted; proceed with benchmark validation."
            grant_application.end_date = _NOW + timedelta(days=120)
            grant_application.outcome_type = "prototype"
            grant_application.outcome_details = {"grant_awarded_inr": 1500000, "prototype_readiness": 72, "cohorts_in_pilot": 3, "students_in_scope": 420}

        fdp_application = faculty_applications_by_title.get("Cloud Architecture FDP")
        if fdp_application:
            fdp_application.objectives = ["Modernize cloud curriculum", "Complete distributed-systems laboratories", "Train departmental faculty"]
            fdp_application.deliverables = ["Five completed laboratories", "Cloud architecture teaching plan", "Faculty completion certificate"]
            fdp_application.milestones = [
                {"id": "fdp-1", "title": "Architecture foundations", "status": "completed", "due_date": "Day 1"},
                {"id": "fdp-2", "title": "Container orchestration laboratory", "status": "completed", "due_date": "Day 3"},
                {"id": "fdp-3", "title": "Curriculum integration plan", "status": "completed", "due_date": "Day 5"},
            ]
            fdp_application.industry_mentor_name = "Neha Kapoor, Cloud Education Lead"
            fdp_application.completion_certificate_url = "https://credentials.example.demo/ananya/cloud-architecture-fdp"
            fdp_application.rating_or_grade = "Distinction"
            fdp_application.outcome_type = "certificate"
            fdp_application.outcome_details = {"labs_completed": 5, "assessment_score": 94, "curriculum_modules_updated": 2}

        existing_event_titles = set(
            (
                await session.scalars(
                    select(FacultyEventRegistration.event_title).where(FacultyEventRegistration.faculty_id == fac_demo.id)
                )
            ).all()
        )
        additional_events = [
            {"event_type": "mentorship", "event_title": "Faculty-Industry Mentorship Roundtable on AI Careers", "host_organization": "ACM India and TechNova AI Solutions", "role": "coordinator", "status": "upcoming", "feedback": "Agenda finalized with eight industry mentors and 60 student participants.", "certificate_url": None, "scheduled_at": _NOW + timedelta(days=12)},
            {"event_type": "fdp", "event_title": "Outcome-Based Education and Skill Evidence FDP", "host_organization": "Indian Society for Technical Education", "role": "speaker", "status": "registered", "feedback": "Session proposal accepted: evidence-backed assessment without attendance-based verification.", "certificate_url": None, "scheduled_at": _NOW + timedelta(days=24)},
            {"event_type": "challenge", "event_title": "National Verifiable Skills Innovation Challenge", "host_organization": "National Skill Development Agency", "role": "academic_advisor", "status": "upcoming", "feedback": "Advising three interdisciplinary student teams through prototype evaluation.", "certificate_url": None, "scheduled_at": _NOW + timedelta(days=18)},
            {"event_type": "workshop", "event_title": "Responsible AI Curriculum Design Studio", "host_organization": "IEEE Computer Society", "role": "attendee", "status": "completed", "feedback": "Completed all design exercises and adopted the model-card assessment template.", "certificate_url": "https://credentials.example.demo/ananya/responsible-ai-studio", "scheduled_at": _NOW - timedelta(days=35)},
        ]
        for event_data in additional_events:
            if event_data["event_title"] not in existing_event_titles:
                session.add(FacultyEventRegistration(faculty_id=fac_demo.id, event_id=uuid.uuid4(), **event_data))

        existing_document_titles = set(
            (
                await session.scalars(
                    select(UserDocument.title).where(
                        UserDocument.user_id == fac_demo.id,
                        UserDocument.user_role == "academician",
                    )
                )
            ).all()
        )
        additional_documents = [
            {"document_type": "patent", "title": "Granted Patent - Skill Provenance Verification", "file_name": "Patent_IN_2024_99881.pdf", "file_size_bytes": 512000, "file_url": "https://documents.example.demo/faculty/patent-99881.pdf", "verification_status": "verified", "metadata_payload": {"patent_number": "IN-2024-99881", "status": "Granted", "year": 2024}},
            {"document_type": "industrial_training_report", "title": "Faculty Immersion Interim Report - Production MLOps", "file_name": "MLOps_Immersion_Interim_Report.pdf", "file_size_bytes": 734000, "file_url": "https://documents.example.demo/faculty/mlops-immersion-report.pdf", "verification_status": "verified", "metadata_payload": {"partner": "TechNova AI Solutions", "review_status": "Mentor endorsed"}},
            {"document_type": "research_dataset_protocol", "title": "Anonymized Cohort Benchmark and Fairness Protocol", "file_name": "Cohort_Benchmark_Fairness_Protocol.pdf", "file_size_bytes": 428000, "file_url": "https://documents.example.demo/faculty/cohort-fairness-protocol.pdf", "verification_status": "verified", "metadata_payload": {"cohorts": 3, "students_in_scope": 420, "contains_personal_data": False}},
            {"document_type": "speaker_certificate", "title": "IEEE Responsible AI Workshop Speaker Certificate", "file_name": "IEEE_Responsible_AI_Speaker_Certificate.pdf", "file_size_bytes": 186000, "file_url": "https://credentials.example.demo/ananya/ieee-speaker-certificate", "verification_status": "verified", "metadata_payload": {"issuer": "IEEE Computer Society", "year": 2026}},
        ]
        for document_data in additional_documents:
            if document_data["title"] not in existing_document_titles:
                session.add(UserDocument(user_id=fac_demo.id, user_role="academician", mime_type="application/pdf", **document_data))

        existing_notification_titles = set(
            (
                await session.scalars(
                    select(FacultyNotification.title).where(FacultyNotification.faculty_id == fac_demo.id)
                )
            ).all()
        )
        additional_notifications = [
            {"title": "Certification Cohort Reached 84 Registrations", "message": "The AWS Cloud Practitioner certification cohort has exceeded its target and the overflow lab plan is ready.", "category": "event", "is_read": False, "link_url": "/faculty/training-planner"},
            {"title": "Research Grant Milestone Review Scheduled", "message": "The quarterly fairness and evidence-provenance review is scheduled with the industry research panel.", "category": "milestone", "is_read": False, "link_url": "/faculty/workspaces"},
        ]
        for notification_data in additional_notifications:
            if notification_data["title"] not in existing_notification_titles:
                session.add(FacultyNotification(faculty_id=fac_demo.id, **notification_data))

        # Account-scoped Collaboration & Funding Hub demo state. Keep this
        # independent from the legacy faculty fixture guard so existing demo
        # databases receive the complete hub lifecycle on the next seed run.
        hub_opportunities = {
            opportunity.title: opportunity
            for opportunity in (await session.scalars(select(FacultyOpportunity))).all()
        }
        saved_hub_titles = {
            "IEEE Computer Society Academic Chapter Partnership",
            "Explainable AI Expert Speaker & Faculty Trainer",
            "Cloud & MLOps Industry Co-Innovation Partner",
            "National Applied AI Research Catalyst Grant",
        }
        existing_saved_ids = set(
            (
                await session.scalars(
                    select(SavedFacultyOpportunity.opportunity_id).where(
                        SavedFacultyOpportunity.faculty_id == fac_demo.id
                    )
                )
            ).all()
        )
        for title in saved_hub_titles:
            opportunity = hub_opportunities.get(title)
            if opportunity and opportunity.id not in existing_saved_ids:
                session.add(
                    SavedFacultyOpportunity(
                        faculty_id=fac_demo.id,
                        opportunity_id=opportunity.id,
                    )
                )

        proposal_fixtures = [
            {
                "opportunity_title": "IEEE Computer Society Academic Chapter Partnership",
                "status": "draft",
                "proposal_title": "IEEE Student Chapter and Distinguished Speaker Series",
                "proposal_text": "Launch an IEEE Computer Society student chapter with a year-long calendar of distinguished lectures, standards awareness sessions, and student-led technical activities.",
                "problem_statement": "Students need sustained access to professional communities, technical standards, and practicing computing leaders beyond one-off campus events.",
                "objectives": ["Establish an IEEE student chapter", "Host four expert talks", "Enroll 60 student members"],
                "methodology": "Form a faculty-student steering committee, complete chapter registration, publish a quarterly activity plan, and measure participation and learning outcomes.",
                "timeline_weeks": 16,
                "budget_requested": 120000.0,
                "industry_support_required": "Distinguished speakers, chapter onboarding support, and access to technical-community resources.",
            },
            {
                "opportunity_title": "ACM SIGCSE Computing Education Collaboration",
                "status": "submitted",
                "proposal_title": "Evidence-Based Computing Curriculum Exchange",
                "proposal_text": "Create a SIGCSE-aligned curriculum exchange focused on evidence-backed assessment, project-based learning, and responsible use of AI in computing education.",
                "problem_statement": "The current curriculum needs stronger alignment between classroom assessment, authentic project evidence, and rapidly changing industry practices.",
                "objectives": ["Review six core computing courses", "Pilot two evidence-based modules", "Publish reusable teaching resources"],
                "methodology": "Run faculty working groups, map course outcomes to SIGCSE practices, pilot revised modules, and compare pre/post student competency evidence.",
                "timeline_weeks": 20,
                "budget_requested": 275000.0,
                "industry_support_required": "Curriculum reviewers, teaching-practice workshops, and peer-institution benchmarking support.",
            },
            {
                "opportunity_title": "Explainable AI Expert Speaker & Faculty Trainer",
                "status": "under_review",
                "proposal_title": "Responsible AI Faculty Clinic and Student Masterclass",
                "proposal_text": "Engage Dr. Meera Iyer for a keynote, two faculty clinics, and a student masterclass on explainability, model governance, and responsible deployment.",
                "problem_statement": "Faculty and capstone teams need practical methods to explain, audit, and govern AI systems used in academic and industry projects.",
                "objectives": ["Train 35 faculty members", "Mentor 10 student teams", "Produce an explainability lab handbook"],
                "methodology": "Use case-based clinics, hands-on model-card exercises, project reviews, and a post-program implementation assessment.",
                "timeline_weeks": 6,
                "budget_requested": 75000.0,
                "industry_support_required": "Expert facilitation, case-study material, lab templates, and two remote follow-up reviews.",
                "reviewer_notes": "Academic partnerships panel is validating the proposed clinic schedule and cohort size.",
            },
            {
                "opportunity_title": "Industry-Sponsored Emerging Technology Lab",
                "status": "rejected",
                "proposal_title": "Secure Cloud and Data Engineering Teaching Lab",
                "proposal_text": "Establish a teaching lab combining cloud credits, cybersecurity tooling, data engineering sandboxes, and industry-led student challenges.",
                "problem_statement": "Existing shared laboratories cannot support realistic cloud security and large-scale data pipeline exercises for multiple cohorts.",
                "objectives": ["Provision a 40-seat lab", "Train eight faculty coordinators", "Deliver three industry challenge cycles"],
                "methodology": "Deploy isolated cloud sandboxes, train faculty, integrate guided labs into three courses, and assess student skill-gap closure.",
                "timeline_weeks": 28,
                "budget_requested": 950000.0,
                "industry_support_required": "Cloud credits, security licenses, trainer hours, and quarterly architecture reviews.",
                "reviewer_notes": "The panel requested a revised sustainability and recurring-cost plan before resubmission.",
                "feedback": "Not selected in this cycle; resubmission is encouraged with a three-year operating-cost commitment.",
            },
            {
                "opportunity_title": "National Applied AI Research Catalyst Grant",
                "status": "shortlisted",
                "proposal_title": "Explainable AI Readiness Observatory for Engineering Education",
                "proposal_text": "Build an institution-scale observatory that connects aggregate skill-gap analytics, explainable intervention recommendations, and longitudinal training outcomes.",
                "problem_statement": "Engineering institutions lack an auditable way to connect cohort readiness gaps with funded interventions and measurable post-training outcomes.",
                "objectives": ["Deploy an explainable readiness observatory", "Pilot across three engineering departments", "Publish an intervention impact playbook"],
                "methodology": "Use persisted cohort aggregates, deterministic recommendation rules, controlled pre/post diagnostics, and faculty-reviewed impact reports without exposing protected student attributes.",
                "timeline_weeks": 36,
                "budget_requested": 2000000.0,
                "industry_support_required": "Research cloud credits, independent responsible-AI review, program evaluation support, and national dissemination partners.",
                "reviewer_notes": "Shortlisted for the final technical presentation and institutional capability review.",
            },
            {
                "opportunity_title": "Cloud & MLOps Industry Co-Innovation Partner",
                "status": "accepted",
                "proposal_title": "Campus MLOps Co-Innovation and Student Readiness Program",
                "proposal_text": "Co-design an applied MLOps lab where faculty and students build, evaluate, deploy, and monitor responsible machine-learning services with industry mentors.",
                "problem_statement": "Student teams can train models but lack production experience in reproducible deployment, monitoring, cloud operations, and model governance.",
                "objectives": ["Launch an MLOps reference lab", "Mentor four capstone teams", "Deploy two production-grade prototypes"],
                "methodology": "Run architecture workshops, fortnightly mentor reviews, shared prototype sprints, operational-readiness assessments, and an outcomes showcase.",
                "timeline_weeks": 24,
                "budget_requested": 500000.0,
                "industry_support_required": "Cloud credits, solution architects, MLOps tooling, security review, and prototype showcase support.",
                "reviewer_notes": "Approved by the joint academic-industry steering committee.",
                "feedback": "Accepted with full technical mentoring and cloud-credit support.",
            },
        ]
        applications_by_opportunity_id = {
            application.opportunity_id: application
            for application in (
                await session.scalars(
                    select(FacultyApplication).where(FacultyApplication.faculty_id == fac_demo.id)
                )
            ).all()
        }
        seeded_hub_applications: dict[str, FacultyApplication] = {}
        for fixture in proposal_fixtures:
            opportunity = hub_opportunities.get(fixture["opportunity_title"])
            if opportunity is None:
                continue
            application = applications_by_opportunity_id.get(opportunity.id)
            if application is None:
                application = FacultyApplication(
                    faculty_id=fac_demo.id,
                    opportunity_id=opportunity.id,
                    status=fixture["status"],
                    application_type=opportunity.opportunity_type,
                    proposal_title=fixture["proposal_title"],
                    proposal_text=fixture["proposal_text"],
                    problem_statement=fixture["problem_statement"],
                    objectives=fixture["objectives"],
                    methodology=fixture["methodology"],
                    team_members=[
                        {"name": "Dr. Ananya Sharma", "role": "Faculty Lead", "department": "Computer Science Engineering"},
                        {"name": "Dr. Rohan Banerjee", "role": "Faculty Co-Investigator", "department": "Information Technology"},
                    ],
                    student_researchers=[
                        {"name": "Maya Rivera", "roll_no": "CSE-2026-041", "skill": "Machine Learning"},
                        {"name": "Noah Chen", "roll_no": "IT-2026-019", "skill": "Cloud Engineering"},
                    ],
                    deliverables=["Approved engagement charter", "Faculty and student activity report", "Measured outcome dashboard"],
                    milestones=[
                        {"id": "hub-m1", "title": "Discovery and program design", "status": "completed", "due_date": "Week 2"},
                        {"id": "hub-m2", "title": "Faculty and student delivery", "status": "in_progress", "due_date": "Week 12"},
                        {"id": "hub-m3", "title": "Outcome evaluation and showcase", "status": "pending", "due_date": "Final week"},
                    ],
                    timeline_weeks=fixture["timeline_weeks"],
                    budget_requested=fixture["budget_requested"],
                    industry_support_required=fixture["industry_support_required"],
                    attachments=[
                        {"name": "Detailed concept note", "url": "https://documents.example.demo/faculty-hub/concept-note.pdf", "type": "application/pdf"},
                        {"name": "Institution approval letter", "url": "https://documents.example.demo/faculty-hub/approval-letter.pdf", "type": "application/pdf"},
                        {"name": "Indicative budget", "url": "https://documents.example.demo/faculty-hub/budget.xlsx", "type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
                    ],
                    reviewer_notes=fixture.get("reviewer_notes"),
                    feedback=fixture.get("feedback"),
                    industry_mentor_name="Aarav Menon",
                    industry_mentor_email="aarav.menon@example.demo",
                    engagement_status="active" if fixture["status"] == "accepted" else "not_started",
                    start_date=_NOW - timedelta(days=14) if fixture["status"] == "accepted" else None,
                    outcome_details={"success_metrics": ["Faculty participation", "Student skill-gap reduction", "Industry-reviewed outputs"]},
                )
                session.add(application)
                await session.flush()
            seeded_hub_applications[fixture["status"]] = application

        accepted_hub_application = seeded_hub_applications.get("accepted")
        if accepted_hub_application:
            existing_hub_workspace = await session.scalar(
                select(CollaborationWorkspace).where(
                    CollaborationWorkspace.application_id == accepted_hub_application.id
                )
            )
            if existing_hub_workspace is None:
                accepted_opportunity = hub_opportunities["Cloud & MLOps Industry Co-Innovation Partner"]
                session.add(
                    CollaborationWorkspace(
                        application_id=accepted_hub_application.id,
                        title="Campus MLOps Co-Innovation Lab",
                        collaboration_type="joint_research",
                        organization_name=accepted_opportunity.organization_name,
                        faculty_lead_id=fac_demo.id,
                        industry_lead_name="Aarav Menon",
                        industry_lead_email="aarav.menon@example.demo",
                        status="active",
                        progress_percentage=38,
                        objectives=accepted_hub_application.objectives,
                        participants=accepted_hub_application.team_members + [
                            {"name": "Aarav Menon", "role": "Industry Program Lead", "company": accepted_opportunity.organization_name},
                            {"name": "Maya Rivera", "role": "Student MLOps Researcher", "department": "Computer Science Engineering"},
                        ],
                        milestones=accepted_hub_application.milestones,
                        tasks=[
                            {"id": "hub-t1", "title": "Finalize reference architecture", "assigned_to": "Dr. Ananya Sharma", "status": "done", "priority": "high"},
                            {"id": "hub-t2", "title": "Provision cloud training environment", "assigned_to": "Aarav Menon", "status": "in_progress", "priority": "high"},
                            {"id": "hub-t3", "title": "Select capstone pilot teams", "assigned_to": "Dr. Rohan Banerjee", "status": "todo", "priority": "medium"},
                        ],
                        meetings=[
                            {"id": "hub-meeting-1", "title": "Fortnightly MLOps Architecture Review", "date": "Alternate Fridays, 4:00 PM IST", "link": "https://meet.example.demo/campus-mlops-review"}
                        ],
                        discussion_posts=[
                            {"id": "hub-post-1", "author_name": "Aarav Menon", "author_role": "industry_lead", "content": "Cloud-credit allocation is approved and the reference environment is ready for faculty review.", "created_at": (_NOW - timedelta(days=2)).isoformat()}
                        ],
                        deliverables=[
                            {"id": "hub-d1", "title": "MLOps Reference Architecture", "deliverable_type": "architecture", "url_or_key": "https://documents.example.demo/faculty-hub/mlops-reference-architecture.pdf", "submitted_at": (_NOW - timedelta(days=4)).isoformat()}
                        ],
                        feedback=[
                            {"author_name": "Aarav Menon", "author_role": "industry_lead", "rating": 5, "comments": "Strong kickoff with clear governance, measurable student outcomes, and realistic prototype milestones.", "created_at": (_NOW - timedelta(days=1)).isoformat()}
                        ],
                        outcome_summary="Active collaboration establishing a reusable MLOps teaching and prototyping environment.",
                        start_date=_NOW - timedelta(days=14),
                        end_date=_NOW + timedelta(weeks=22),
                    )
                )

        # Account-scoped Training & Workshop Planner demo records.
        training_titles = set((await session.scalars(select(TrainingProgram.title).where(TrainingProgram.faculty_id == fac_demo.id))).all())
        common_marketing = {
            "poster_content": "Register now through the Lumina Intel faculty training portal.",
            "email_announcement": "Subject: Faculty training registration is now open.",
            "whatsapp_announcement": "Training registrations are open. Seats are limited.",
            "linkedin_caption": "Closing measured skill gaps through faculty-industry training.",
            "registration_page_copy": "Review prerequisites and reserve your seat.",
        }
        if "Applied MLOps & Production Deployment Workshop" not in training_titles:
            session.add(TrainingProgram(
                faculty_id=fac_demo.id, title="Applied MLOps & Production Deployment Workshop",
                objective="Close measured gaps in containerized model serving, CI/CD, monitoring, and production operations.",
                program_type="Hands-on Workshop", target_cohort="CSE placement-ready cohort",
                target_department="Computer Science Engineering", target_year="3rd & 4th Year",
                target_skills=["MLOps", "Docker", "Cloud Deployment"], expected_participants=80,
                prerequisites=["Python", "Git", "Machine Learning fundamentals"], trainer_type="Industry Professional",
                trainer_name="Aarav Menon", trainer_organization="TechNova AI Solutions",
                infrastructure_requirements=[
                    {"item": "Computer Lab", "required": 80, "available": 60, "gap": 20, "status": "GAP"},
                    {"item": "GPU Lab", "required": 1, "available": 12, "gap": 0, "status": "AVAILABLE"},
                    {"item": "High-speed Internet", "required": 1, "available": 1, "gap": 0, "status": "AVAILABLE"},
                ],
                budget_breakdown={"trainer_fee": 20000, "venue": 5000, "food": 10000, "certificates": 2000, "marketing": 3000, "equipment": 5000, "software": 5000},
                total_estimated_budget=50000, confirmed_funding=25000, funding_gap=25000,
                start_date=_NOW + timedelta(days=35), end_date=_NOW + timedelta(days=37), notice_period_days=35, notice_status="GOOD",
                preparation_tasks=[
                    {"id": "approval", "title": "Institution approval", "status": "completed"},
                    {"id": "trainer", "title": "Trainer confirmation", "status": "completed"},
                    {"id": "infrastructure", "title": "Provision overflow cloud workstations", "status": "in_progress"},
                    {"id": "marketing", "title": "Launch publicity", "status": "pending"},
                    {"id": "registration", "title": "Confirm participant list", "status": "pending"},
                ],
                marketing_kit=common_marketing,
                campaign_metrics={"emails_sent": 240, "whatsapp_recipients": 190, "linkedin_views": 820, "poster_scans": 74, "registrations": 68, "confirmed_participants": 61},
                execution_metrics={"registered_count": 68, "attended_count": 0, "completed_count": 0, "attendance_rate": 0, "average_feedback_rating": 0, "certificates_issued": 0},
                status="registration_open",
            ))
        if "Explainable AI Faculty Development Program" not in training_titles:
            fdp_training = TrainingProgram(
                faculty_id=fac_demo.id, title="Explainable AI Faculty Development Program",
                objective="Enable faculty to design auditable AI coursework and supervise responsible student projects.",
                program_type="FDP", target_cohort="Engineering faculty", target_department="All Engineering Departments",
                target_year="Faculty", target_skills=["Explainable AI", "Responsible AI"], expected_participants=45,
                prerequisites=["Machine Learning fundamentals"], trainer_type="Professional Society",
                trainer_name="Dr. Meera Iyer", trainer_organization="IEEE Computer Society",
                infrastructure_requirements=[{"item": "Auditorium", "required": 1, "available": 1, "gap": 0, "status": "AVAILABLE"}],
                budget_breakdown={"trainer_fee": 30000, "venue": 5000, "food": 12000, "certificates": 3000, "marketing": 2000, "equipment": 0, "software": 3000},
                total_estimated_budget=55000, confirmed_funding=55000, funding_gap=0,
                start_date=_NOW - timedelta(days=45), end_date=_NOW - timedelta(days=43), notice_period_days=0, notice_status="CRITICAL",
                preparation_tasks=[{"id": "complete", "title": "Program delivered", "status": "completed"}],
                marketing_kit=common_marketing,
                campaign_metrics={"emails_sent": 130, "whatsapp_recipients": 85, "linkedin_views": 420, "poster_scans": 31, "registrations": 45, "confirmed_participants": 43},
                execution_metrics={"registered_count": 45, "attended_count": 43, "completed_count": 41, "attendance_rate": 95.6, "average_feedback_rating": 4.7, "certificates_issued": 41},
                status="completed",
            )
            session.add(fdp_training)
            await session.flush()
            session.add(TrainingOutcomeMetric(training_id=fdp_training.id, skill_name="Explainable AI", cohort_name="Engineering faculty", pre_readiness_score=46, post_readiness_score=78, improvement_percentage=32, attendance_count=43, feedback_rating=4.7, evidence_records_created=0))

        if "Python and Data Engineering Foundation Training" not in training_titles:
            session.add(TrainingProgram(
                faculty_id=fac_demo.id, title="Python and Data Engineering Foundation Training",
                objective="Build a common Python, SQL, and data-pipeline foundation for second-year students before advanced analytics coursework.",
                program_type="Training Program", target_cohort="CSE and IT foundation cohort",
                target_department="Computer Science and Information Technology", target_year="2nd Year",
                target_skills=["Python", "SQL", "Data Engineering"], expected_participants=120,
                prerequisites=["Programming fundamentals"], trainer_type="Internal Faculty",
                trainer_name="Dr. Ananya Sharma", trainer_organization="National Institute of Technology Demo University",
                infrastructure_requirements=[
                    {"item": "Computer Lab", "required": 120, "available": 120, "gap": 0, "status": "AVAILABLE"},
                    {"item": "Python and PostgreSQL software image", "required": 120, "available": 120, "gap": 0, "status": "AVAILABLE"},
                    {"item": "High-speed Internet", "required": 1, "available": 1, "gap": 0, "status": "AVAILABLE"},
                ],
                budget_breakdown={"trainer_fee": 0, "venue": 6000, "food": 18000, "certificates": 3600, "marketing": 1400, "equipment": 5000, "software": 0},
                total_estimated_budget=34000, confirmed_funding=34000, funding_gap=0,
                start_date=_NOW + timedelta(days=52), end_date=_NOW + timedelta(days=57), notice_period_days=52, notice_status="GOOD",
                preparation_tasks=[
                    {"id": "curriculum", "title": "Freeze five-day curriculum", "status": "completed"},
                    {"id": "lab-image", "title": "Validate lab software image", "status": "completed"},
                    {"id": "diagnostic", "title": "Schedule pre-training diagnostic", "status": "in_progress"},
                    {"id": "registration", "title": "Open cohort registration", "status": "pending"},
                ],
                marketing_kit={**common_marketing, "poster_content": "Five-day Python, SQL, and Data Engineering foundation training for second-year CSE and IT students."},
                campaign_metrics={"emails_sent": 210, "whatsapp_recipients": 180, "linkedin_views": 390, "poster_scans": 48, "registrations": 36, "confirmed_participants": 28},
                execution_metrics={"registered_count": 36, "attended_count": 0, "completed_count": 0, "attendance_rate": 0, "average_feedback_rating": 0, "certificates_issued": 0},
                status="scheduled",
            ))

        if "Responsible AI in Production Industry Talk" not in training_titles:
            session.add(TrainingProgram(
                faculty_id=fac_demo.id, title="Responsible AI in Production Industry Talk",
                objective="Expose students and faculty to model governance, explainability, monitoring, and responsible deployment practices used in industry.",
                program_type="Industry Talk", target_cohort="AI specialization students and faculty",
                target_department="Computer Science and Engineering", target_year="3rd Year, 4th Year, and Faculty",
                target_skills=["Responsible AI", "Explainable AI", "Model Governance"], expected_participants=180,
                prerequisites=["Machine Learning fundamentals"], trainer_type="Industry Expert",
                trainer_name="Vikram Sethi", trainer_organization="Vision Analytics Labs",
                infrastructure_requirements=[
                    {"item": "Auditorium", "required": 1, "available": 1, "gap": 0, "status": "AVAILABLE"},
                    {"item": "Projector and audio system", "required": 1, "available": 1, "gap": 0, "status": "AVAILABLE"},
                    {"item": "Live-stream connection", "required": 1, "available": 1, "gap": 0, "status": "AVAILABLE"},
                ],
                budget_breakdown={"trainer_fee": 15000, "venue": 5000, "food": 16000, "certificates": 0, "marketing": 3000, "equipment": 1000, "software": 0},
                total_estimated_budget=40000, confirmed_funding=40000, funding_gap=0,
                start_date=_NOW - timedelta(days=18), end_date=_NOW - timedelta(days=18), notice_period_days=0, notice_status="CRITICAL",
                preparation_tasks=[{"id": "delivered", "title": "Industry talk delivered and feedback archived", "status": "completed"}],
                marketing_kit={**common_marketing, "linkedin_caption": "Responsible AI in Production: faculty-industry insights on explainability, governance, and deployment monitoring."},
                campaign_metrics={"emails_sent": 420, "whatsapp_recipients": 310, "linkedin_views": 1460, "poster_scans": 126, "registrations": 192, "confirmed_participants": 180},
                execution_metrics={"registered_count": 192, "attended_count": 176, "completed_count": 176, "attendance_rate": 91.7, "average_feedback_rating": 4.8, "certificates_issued": 0},
                status="completed",
            ))

        if "AWS Cloud Practitioner Certification Program" not in training_titles:
            session.add(TrainingProgram(
                faculty_id=fac_demo.id, title="AWS Cloud Practitioner Certification Program",
                objective="Prepare placement-focused students for a recognized cloud fundamentals certification through guided labs and mock assessments.",
                program_type="Certification Program", target_cohort="Cloud career and placement cohort",
                target_department="Computer Science, IT, and Electronics", target_year="3rd and 4th Year",
                target_skills=["AWS", "Cloud Computing", "Cloud Security"], expected_participants=75,
                prerequisites=["Networking fundamentals", "Linux basics"], trainer_type="External Certified Trainer",
                trainer_name="Neha Kapoor", trainer_organization="CloudSphere Technologies",
                infrastructure_requirements=[
                    {"item": "Computer Lab", "required": 75, "available": 60, "gap": 15, "status": "GAP"},
                    {"item": "AWS Academy learner seats", "required": 75, "available": 75, "gap": 0, "status": "AVAILABLE"},
                    {"item": "Certification exam vouchers", "required": 75, "available": 50, "gap": 25, "status": "GAP"},
                ],
                budget_breakdown={"trainer_fee": 35000, "venue": 8000, "food": 15000, "certificates": 0, "marketing": 2500, "equipment": 4500, "software": 75000},
                total_estimated_budget=140000, confirmed_funding=90000, funding_gap=50000,
                start_date=_NOW + timedelta(days=21), end_date=_NOW + timedelta(days=49), notice_period_days=21, notice_status="TIGHT",
                preparation_tasks=[
                    {"id": "trainer", "title": "Confirm certified trainer", "status": "completed"},
                    {"id": "vouchers", "title": "Secure remaining exam vouchers", "status": "in_progress"},
                    {"id": "overflow", "title": "Provision overflow cloud laboratory", "status": "pending"},
                    {"id": "mock", "title": "Publish mock assessment schedule", "status": "completed"},
                ],
                marketing_kit={**common_marketing, "registration_page_copy": "Register for guided AWS labs, weekly mock assessments, and certification readiness mentoring."},
                campaign_metrics={"emails_sent": 260, "whatsapp_recipients": 230, "linkedin_views": 880, "poster_scans": 94, "registrations": 84, "confirmed_participants": 72},
                execution_metrics={"registered_count": 84, "attended_count": 0, "completed_count": 0, "attendance_rate": 0, "average_feedback_rating": 0, "certificates_issued": 0},
                status="registration_open",
            ))

        if "Backend Engineering Placement Readiness Sprint" not in training_titles:
            placement_training = TrainingProgram(
                faculty_id=fac_demo.id, title="Backend Engineering Placement Readiness Sprint",
                objective="Improve placement readiness through API design, SQL diagnostics, system-design interviews, coding practice, and evidence-backed capstones.",
                program_type="Placement Preparation", target_cohort="Placement-eligible backend engineering cohort",
                target_department="Computer Science and Information Technology", target_year="Final Year",
                target_skills=["Python", "FastAPI", "PostgreSQL", "System Design"], expected_participants=64,
                prerequisites=["Python", "Data Structures", "Database fundamentals"], trainer_type="Internal Faculty and Industry Panel",
                trainer_name="Dr. Ananya Sharma and Aarav Menon", trainer_organization="NIT Demo University and TechNova AI Solutions",
                infrastructure_requirements=[
                    {"item": "Computer Lab", "required": 64, "available": 64, "gap": 0, "status": "AVAILABLE"},
                    {"item": "Interview rooms", "required": 6, "available": 6, "gap": 0, "status": "AVAILABLE"},
                    {"item": "Assessment platform licenses", "required": 64, "available": 64, "gap": 0, "status": "AVAILABLE"},
                ],
                budget_breakdown={"trainer_fee": 24000, "venue": 4000, "food": 12000, "certificates": 2000, "marketing": 1000, "equipment": 2000, "software": 15000},
                total_estimated_budget=60000, confirmed_funding=60000, funding_gap=0,
                start_date=_NOW - timedelta(days=70), end_date=_NOW - timedelta(days=56), notice_period_days=0, notice_status="CRITICAL",
                preparation_tasks=[{"id": "complete", "title": "Sprint completed and outcome report approved", "status": "completed"}],
                marketing_kit={**common_marketing, "email_announcement": "Subject: Backend Engineering Placement Readiness Sprint registration and diagnostic schedule."},
                campaign_metrics={"emails_sent": 170, "whatsapp_recipients": 145, "linkedin_views": 610, "poster_scans": 52, "registrations": 69, "confirmed_participants": 64},
                execution_metrics={"registered_count": 69, "attended_count": 64, "completed_count": 59, "attendance_rate": 92.8, "average_feedback_rating": 4.6, "certificates_issued": 59, "mock_interviews_completed": 128, "students_shortlisted": 31},
                status="completed",
            )
            session.add(placement_training)
            await session.flush()
            session.add(TrainingOutcomeMetric(training_id=placement_training.id, skill_name="Backend Engineering Readiness", cohort_name="Final-year placement cohort", pre_readiness_score=52, post_readiness_score=81, improvement_percentage=29, attendance_count=64, feedback_rating=4.6, evidence_records_created=0))

        # Keep reruns deterministic and clean previously seeded account data.
        seeded_training_titles = {
            "Applied MLOps & Production Deployment Workshop",
            "Explainable AI Faculty Development Program",
            "Python and Data Engineering Foundation Training",
            "Responsible AI in Production Industry Talk",
            "AWS Cloud Practitioner Certification Program",
            "Backend Engineering Placement Readiness Sprint",
        }
        seeded_trainings = (
            await session.scalars(
                select(TrainingProgram).where(
                    TrainingProgram.faculty_id == fac_demo.id,
                    TrainingProgram.title.in_(seeded_training_titles),
                )
            )
        ).all()
        for seeded_training in seeded_trainings:
            marketing_kit = dict(seeded_training.marketing_kit or {})
            marketing_kit["whatsapp_announcement"] = "Training registrations are open. Seats are limited."
            seeded_training.marketing_kit = marketing_kit

        # Seed Faculty Video Masterclasses
        existing_videos = (await session.scalars(select(FacultyVideo))).all()
        if not existing_videos:
            session.add_all([
                FacultyVideo(
                    faculty_id=fac_demo.id,
                    faculty_name="Dr. Ananya Sharma",
                    faculty_institution="National Institute of Technology Demo University",
                    faculty_designation="Associate Professor, Computer Science",
                    title="Advanced Asynchronous Microservices & FastAPI Architecture",
                    description="Deep dive into production asynchronous backend development in Python, non-blocking I/O event loops, database connection pooling with SQLAlchemy 2.0 async, and high-throughput API gateway patterns.",
                    video_url="https://www.youtube.com/watch?v=kCgGjBG6i10",
                    thumbnail_url="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80",
                    duration_minutes=42,
                    subject="Backend Engineering",
                    department="Computer Science Engineering",
                    skills_covered=["Python", "FastAPI", "AsyncIO", "REST APIs", "Microservices Architecture"],
                    notes_markdown="""# Lecture Notes: Advanced FastAPI Microservices

### 1. Asynchronous I/O Fundamentals
- Python `asyncio` runs single-threaded concurrent cooperative multitasking.
- Use `async def` for I/O bound tasks (DB queries, network calls, filesystem I/O).
- Keep CPU-intensive computations in background thread pools or Celery workers.

### 2. SQLAlchemy 2.0 Async Session Patterns
```python
async with SessionLocal() as session:
    result = await session.execute(select(Student).where(Student.is_active == True))
    students = result.scalars().all()
```

### 3. Pydantic v2 Serialization Performance
- Native C++ core engine `pydantic-core` provides 5x-10x throughput enhancement.
- Always use `Annotated` with FastAPI dependencies for strict type safety.
""",
                    views_count=184,
                    is_published=True,
                ),
                FacultyVideo(
                    faculty_id=fac_demo.id,
                    faculty_name="Dr. Ananya Sharma",
                    faculty_institution="National Institute of Technology Demo University",
                    faculty_designation="Associate Professor, Computer Science",
                    title="Vector Search & Cosine Embeddings with PostgreSQL pgvector",
                    description="Comprehensive masterclass exploring high-dimensional embedding spaces, cosine similarity indexing with HNSW and IVFFlat, semantic skill matching algorithms, and SQL vector optimization.",
                    video_url="https://www.youtube.com/watch?v=F0dU_Jg_u0U",
                    thumbnail_url="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
                    duration_minutes=38,
                    subject="Artificial Intelligence",
                    department="Computer Science Engineering",
                    skills_covered=["pgvector", "PostgreSQL", "Machine Learning", "Embeddings", "Vector Search"],
                    notes_markdown="""# Lecture Notes: Vector Search with pgvector

### 1. High-Dimensional Vector Distance Metrics
- **Cosine Distance (`<=>`)**: $1 - \\frac{u \\cdot v}{\\|u\\| \\|v\\|}$
- **Euclidean Distance (`<->`)**: $\\sqrt{\\sum (u_i - v_i)^2}$
- **Inner Product (`<#>`)**: $- (u \\cdot v)$

### 2. Creating HNSW Indexes in PostgreSQL
```sql
CREATE INDEX ON skill_embeddings USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```
""",
                    views_count=246,
                    is_published=True,
                ),
                FacultyVideo(
                    faculty_id=fac_demo.id,
                    faculty_name="Dr. Ananya Sharma",
                    faculty_institution="National Institute of Technology Demo University",
                    faculty_designation="Associate Professor, Computer Science",
                    title="Explainable AI & Fair Competency Graph Evaluation",
                    description="Mathematical exploration of deterministic skill scoring formulas, removing demographic proxy bias, verifiable evidence provenance, and transparent human-auditable explanation templates.",
                    video_url="https://www.youtube.com/watch?v=0h62p9VjNvg",
                    thumbnail_url="https://images.unsplash.com/photo-1507146426996-ef05306b995a?w=800&q=80",
                    duration_minutes=35,
                    subject="Explainable AI",
                    department="Computer Science Engineering",
                    skills_covered=["Explainable AI", "Data Ethics", "Competency Mapping", "Algorithmic Fairness"],
                    notes_markdown="""# Lecture Notes: Algorithmic Fairness in Skill Matching

### 1. Deterministic Multi-Component Scoring
$$\\text{Final Score} = \\text{clamp}(0.65 \\cdot D + 0.25 \\cdot S + 0.10 \\cdot V, 0, 1)$$
- $D$: Exact required skill overlap.
- $S$: Semantic embedding similarity (threshold $\\ge 0.75$).
- $V$: External verification multiplier.

### 2. Protected Attribute Isolation
- Demographic features (Gender, Name, University Prestige) are completely isolated from scoring pipelines.
""",
                    views_count=312,
                    is_published=True,
                ),
                FacultyVideo(
                    faculty_id=fac_demo.id,
                    faculty_name="Prof. Rajesh Kumar",
                    faculty_institution="Indian Institute of Science & Technology",
                    faculty_designation="Visiting Professor, Cloud Systems",
                    title="Cloud Native DevOps & Distributed Container Orchestration",
                    description="End-to-end containerization with Docker, multi-stage builds, Kubernetes pod lifecycle management, horizontal autoscaling, and resilient zero-downtime CI/CD deployment pipelines.",
                    video_url="https://www.youtube.com/watch?v=X48VuDVv0do",
                    thumbnail_url="https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&q=80",
                    duration_minutes=48,
                    subject="Cloud & DevOps",
                    department="Information Technology",
                    skills_covered=["Docker", "Kubernetes", "DevOps", "CI/CD Pipelines", "Cloud Infrastructure"],
                    notes_markdown="""# Lecture Notes: Container Orchestration

### 1. Multi-Stage Dockerfile Best Practices
- Keep runtime images minimal using Alpine or Slim base images.
- Cache dependencies (`package.json`, `requirements.txt`) in separate build layers.

### 2. Kubernetes Resiliency Patterns
- Configure `livenessProbe` and `readinessProbe` on all backend API services.
- Define resource requests and limits to prevent noisy neighbor memory starvation.
""",
                    views_count=198,
                    is_published=True,
                ),
                FacultyVideo(
                    faculty_id=fac_demo.id,
                    faculty_name="Dr. Vikram Rao",
                    faculty_institution="National Institute of Technology Demo University",
                    faculty_designation="Professor & Dean of Computing",
                    title="System Design: Distributed Caching & Event-Driven Message Queues",
                    description="Mastering Redis caching strategies (cache-aside, write-through), cache stampede mitigation, Redis Streams pub/sub architectures, and scalable real-time job processing workers.",
                    video_url="https://www.youtube.com/watch?v=jgpVdJB2sKQ",
                    thumbnail_url="https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80",
                    duration_minutes=45,
                    subject="Distributed Systems",
                    department="Computer Science Engineering",
                    skills_covered=["Redis", "System Design", "Caching Strategies", "Distributed Systems", "Message Queues"],
                    notes_markdown="""# Lecture Notes: Scalable Caching & Redis

### 1. Cache-Aside Pattern
1. App checks Redis cache for key.
2. If hit: return immediately.
3. If miss: query Postgres, write to Redis with TTL, return response.

### 2. Cache Stampede Prevention
- Use probabilistic early expiration (XFetch algorithm) or mutex locks on cache misses.
""",
                    views_count=275,
                    is_published=True,
                ),
            ])

        # 3. INSTITUTION DEMO ACCOUNT: Dr. Vikram Rao (institution.demo@example.com / demo123)
        inst_demo = (await session.scalars(select(Institution).where(Institution.email == "institution.demo@example.com"))).first()
        if not inst_demo:
            inst_demo = Institution(
                email="institution.demo@example.com",
                password_hash=DEMO_PASSWORD_HASH,
                institution_name="National Institute of Technology Demo University",
                institution_code="NIT-DEMO-2026",
                state="Karnataka",
                departments=["Computer Science", "Information Technology", "Electronics", "Mechanical"],
            )
            session.add(inst_demo)
            await session.flush()
        else:
            inst_demo.password_hash = DEMO_PASSWORD_HASH
            inst_demo.institution_name = "National Institute of Technology Demo University"
            inst_demo.departments = ["Computer Science", "Information Technology", "Electronics", "Mechanical"]
            await session.flush()
        await _ensure_account_email(session, inst_demo.email, inst_demo.id, Role.institution)

        inst_dean = (await session.scalars(select(Institution).where(Institution.email == "dean@example.demo"))).first()
        if not inst_dean:
            inst_dean = Institution(
                email="dean@example.demo",
                password_hash=DEMO_PASSWORD_HASH,
                institution_name="National Institute of Technology Demo University",
                institution_code="HPU-DEMO",
                state="Karnataka",
                departments=["Computer Science", "Information Technology", "Electronics", "Mechanical"],
            )
            session.add(inst_dean)
            await session.flush()
        else:
            inst_dean.password_hash = DEMO_PASSWORD_HASH
            await session.flush()
        await _ensure_account_email(session, inst_dean.email, inst_dean.id, Role.institution)

        # 4. RECRUITER & STUDENT PROJECT ASSESSMENTS
        recruiter_obj = (await session.scalars(select(Recruiter))).first()
        students_list = (await session.scalars(select(Student))).all()
        student_map = {s.full_name: s for s in students_list}

        existing_assessments = (await session.scalars(select(ProjectAssessment))).all()
        if not existing_assessments and recruiter_obj:
            s1 = student_map.get("Rahul Sharma") or (students_list[0] if students_list else None)
            s2 = student_map.get("Aarav Singh") or (students_list[1] if len(students_list) > 1 else None)
            s3 = student_map.get("Aria Patel") or (students_list[2] if len(students_list) > 2 else None)

            pa1 = ProjectAssessment(
                student_id=s1.id if s1 else None,
                recruiter_id=recruiter_obj.id,
                project_title="Scalable Microservices API Gateway",
                repository_url="https://github.com/rahulsharma-dev/microservices-gateway",
                repository_provider="github",
                status=ProjectAssessmentStatus.ready,
                overall_score=0,
                assessment_summary="Comprehensive multi-category technical evaluation generated for repository 'rahulsharma-dev/microservices-gateway'. 5 tailored questions covering rate limiting, gRPC proxies, distributed tracing, and Docker optimization.",
                strengths=[
                    "Well-structured modular packages with clear separation of HTTP handlers and gRPC clients.",
                    "Robust token bucket rate limiter implementation using Redis key expiration semantics.",
                    "Comprehensive Dockerfile multi-stage builds reducing image size to under 25MB.",
                    "Integrated OpenTelemetry middleware for distributed tracing across downstream services.",
                ],
                improvements=[
                    "Add automated integration tests with Testcontainers to verify Redis failover behavior.",
                    "Implement circuit breaking pattern for flaky downstream RPC calls.",
                    "Define explicit timeouts and context cancellation handling across all reverse-proxy routes.",
                ],
                technologies=["Go", "Docker", "gRPC", "Kubernetes", "Redis", "OpenTelemetry"],
                repository_metadata={
                    "stars": 42,
                    "forks": 11,
                    "open_issues": 2,
                    "primary_language": "Go",
                    "questions": [
                        {
                            "id": "q-001-1",
                            "question": "In your Redis token-bucket rate limiter, what happens if the Redis instance encounters transient network latency exceeding 200ms during an incoming burst?",
                            "options": [
                                "A) The gateway drops the request immediately with HTTP 429 Too Many Requests.",
                                "B) The limiter falls back to an in-memory local token bucket with a bounded timeout, preventing request starvation.",
                                "C) The connection pool blocks indefinitely until Redis responds, causing goroutine exhaustion.",
                                "D) The gateway switches all routes to HTTP 503 Service Unavailable without attempting RPC execution.",
                            ],
                            "category": "System Design & Resilience",
                            "difficulty": "hard",
                            "correct_answer": "B",
                            "explanation": "Production reverse proxies use a bounded Redis timeout with an in-memory token bucket fallback to preserve gateway availability during Redis degradation.",
                        },
                        {
                            "id": "q-001-2",
                            "question": "How does your gRPC reverse-proxy middleware convert streaming gRPC errors (e.g., Status UNAVAILABLE) into standard HTTP JSON responses?",
                            "options": [
                                "A) It wraps the gRPC status code in a standard RFC 7807 Problem Details JSON with appropriate HTTP 503 status.",
                                "B) It silently swallows the error and returns an empty HTTP 200 OK array.",
                                "C) It terminates the TCP connection abruptly without sending any HTTP headers.",
                                "D) It converts all non-OK gRPC codes directly to HTTP 400 Bad Request.",
                            ],
                            "category": "Technical Implementation",
                            "difficulty": "medium",
                            "correct_answer": "A",
                            "explanation": "Standard gRPC gateways translate status.Code(err) into HTTP error mappings using standard RFC 7807 problem details payloads.",
                        },
                        {
                            "id": "q-001-3",
                            "question": "In the multi-stage Dockerfile for the microservices gateway, why is CGO_ENABLED=0 specified during the go build step?",
                            "options": [
                                "A) To enable dynamic linking against libc in the final Debian base image.",
                                "B) To produce a statically linked binary that runs seamlessly inside a minimal scratch or alpine image.",
                                "C) To optimize CPU vectorization instructions for Intel AVX-512.",
                                "D) To disable garbage collection during high-throughput benchmarks.",
                            ],
                            "category": "DevOps & Deployment",
                            "difficulty": "medium",
                            "correct_answer": "B",
                            "explanation": "Disabling CGO creates a purely static binary without C standard library dependencies, allowing deployment on minimal scratch containers.",
                        },
                        {
                            "id": "q-001-4",
                            "question": "When propagating OpenTelemetry trace contexts through downstream HTTP microservices, which HTTP header is utilized?",
                            "options": [
                                "A) X-Custom-Trace-Id",
                                "B) traceparent (W3C Trace Context standard)",
                                "C) X-B3-TraceId-Only",
                                "D) Authorization",
                            ],
                            "category": "Observability & Tracing",
                            "difficulty": "easy",
                            "correct_answer": "B",
                            "explanation": "W3C Trace Context uses the standard 'traceparent' header (version-traceid-parentid-traceflags) for vendor-neutral distributed tracing.",
                        },
                        {
                            "id": "q-001-5",
                            "question": "What approach should be used in the gateway router to prevent goroutine memory leaks when clients cancel upstream HTTP requests?",
                            "options": [
                                "A) Ignore client cancellation and let background goroutines run until process restart.",
                                "B) Pass r.Context() to all downstream gRPC/HTTP calls so cancellations propagate immediately.",
                                "C) Use runtime.Goexit() inside every active HTTP handler.",
                                "D) Increase the operating system TCP keepalive interval to 600 seconds.",
                            ],
                            "category": "Concurrency & Memory Safety",
                            "difficulty": "medium",
                            "correct_answer": "B",
                            "explanation": "Propagating request contexts allows downstream network calls and database queries to abort immediately when an upstream client disconnects.",
                        },
                    ],
                },
                is_shortlisted=False,
            )

            pa2 = ProjectAssessment(
                student_id=s2.id if s2 else None,
                recruiter_id=recruiter_obj.id,
                project_title="Foundation Model Multi-Agent Orchestrator",
                repository_url="https://github.com/aarav-ml/multi-agent-orchestrator",
                repository_provider="github",
                status=ProjectAssessmentStatus.completed,
                overall_score=94,
                assessment_summary="Candidate completed the repository assessment with an exceptional score of 94/100 (5 of 5 questions correct). Demonstrated deep mastery of LLM tool calling, deterministic state graphs, and asynchronous pgvector semantic search.",
                strengths=[
                    "State-of-the-art async agent loop with cyclic graph execution and checkpointing.",
                    "Deterministic fallback paths when LLM tool calling returns malformed JSON.",
                    "Optimized HNSW vector index queries with cosine distance thresholds on pgvector.",
                    "Clean Pydantic V2 schema validation at every tool interface boundary.",
                ],
                improvements=[
                    "Add token rate-limit budgeting to prevent exceeding model context windows during multi-turn loops.",
                    "Implement prompt injection sanitization filters on user-provided input variables.",
                ],
                technologies=["Python", "FastAPI", "PyTorch", "pgvector", "LangChain", "Docker"],
                repository_metadata={
                    "stars": 89,
                    "forks": 24,
                    "open_issues": 1,
                    "primary_language": "Python",
                    "student_answers": {"q-002-1": "A", "q-002-2": "A"},
                },
                is_shortlisted=True,
                shortlist_notes="Outstanding multi-agent architecture, clean pgvector integration, and 94% quiz score. Recommend immediate technical interview round.",
                completed_at=_NOW - timedelta(days=1),
            )

            pa3 = ProjectAssessment(
                student_id=s3.id if s3 else None,
                recruiter_id=recruiter_obj.id,
                project_title="Distributed Fault-Tolerant Raft Consensus Engine",
                repository_url="https://github.com/priyapatel-tech/raft-consensus-engine",
                repository_provider="github",
                status=ProjectAssessmentStatus.ready,
                overall_score=0,
                assessment_summary="Automated code evaluation for 'priyapatel-tech/raft-consensus-engine'. 5 in-depth questions evaluating leader election, log replication, snapshotting, and network partition recovery.",
                strengths=[
                    "Rigorous implementation of Raft leader election with randomized election timers.",
                    "Asynchronous log append entries with memory-mapped write-ahead logging (WAL).",
                    "Comprehensive test matrix simulating network partitions and delayed RPCs.",
                ],
                improvements=[
                    "Implement log compaction and install snapshot RPC for long-running clusters.",
                    "Add dynamic cluster membership changes (joint consensus).",
                ],
                technologies=["Rust", "Distributed Systems", "gRPC", "Tokio", "Raft"],
                repository_metadata={"stars": 124, "forks": 38, "primary_language": "Rust"},
                is_shortlisted=False,
            )

            session.add_all([pa1, pa2, pa3])
            await session.flush()

            # Add category scores for pa1 & pa2
            cat_scores = [
                AssessmentCategoryScore(assessment_id=pa1.id, category_name="Technical Implementation", score=92, feedback="Clean Go idioms and idiomatic package layouts."),
                AssessmentCategoryScore(assessment_id=pa1.id, category_name="Code Comprehension", score=88, feedback="Solid grasp of asynchronous context propagation."),
                AssessmentCategoryScore(assessment_id=pa1.id, category_name="Architecture & Design", score=90, feedback="Modular reverse-proxy pipeline with decoupled middleware."),
                AssessmentCategoryScore(assessment_id=pa1.id, category_name="Best Practices", score=86, feedback="Multi-stage Docker builds and environment-based configuration."),
                AssessmentCategoryScore(assessment_id=pa1.id, category_name="Testing & Quality", score=80, feedback="Good unit tests; needs Testcontainers integration tests."),

                AssessmentCategoryScore(assessment_id=pa2.id, category_name="Technical Implementation", score=96, feedback="Flawless async Python 3.12 and FastAPI endpoints."),
                AssessmentCategoryScore(assessment_id=pa2.id, category_name="Code Comprehension", score=94, feedback="Precise understanding of agentic state graphs and tool bindings."),
                AssessmentCategoryScore(assessment_id=pa2.id, category_name="Architecture & Design", score=95, feedback="Excellent decoupling of LLM drivers and persistence layers."),
                AssessmentCategoryScore(assessment_id=pa2.id, category_name="Best Practices", score=92, feedback="Strict Pydantic models, typed signatures, and structured logging."),
                AssessmentCategoryScore(assessment_id=pa2.id, category_name="Testing & Quality", score=90, feedback="Comprehensive pytest-asyncio coverage with mock LLM responses."),
            ]
            session.add_all(cat_scores)
            await session.flush()

        await session.commit()
        print("SIH Ecosystem seed completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_sih_ecosystem())

