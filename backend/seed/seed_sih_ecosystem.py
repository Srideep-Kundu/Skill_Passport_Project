"""Seed data for SIH Ecosystem: Assessments, Learning Courses, Placement Drives, Faculty Opportunities, Mentorship, Challenges."""
import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    Academician,
    AccountEmail,
    Assessment,
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
    Recruiter,
    Role,
    Skill,
    Student,
    StudentSkill,
    UserDocument,
    VerificationTier,
)
from app.services.matching_service import recompute_matches_for_internship

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

        await session.commit()
        print("SIH Ecosystem seed completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_sih_ecosystem())

