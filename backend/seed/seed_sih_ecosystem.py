"""Seed data for SIH Ecosystem: Assessments, Learning Courses, Placement Drives, Faculty Opportunities, Mentorship, Challenges."""
import asyncio
from datetime import UTC, datetime, timedelta
import uuid

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    Academician,
    AccountEmail,
    Assessment,
    AssessmentQuestion,
    CollaborationWorkspace,
    FacultyApplication,
    FacultyEventRegistration,
    FacultyNotification,
    FacultyOpportunity,
    InnovationChallenge,
    Institution,
    LearningCourse,
    MentorshipSession,
    PlacementDrive,
    ProjectApplication,
    Recruiter,
    Role,
    Skill,
    Student,
)

_NOW = datetime.now(UTC)
DEMO_PASSWORD_HASH = hash_password("password123")


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
                    title="AICTE-Industry Immersion Sabbatical: Cloud Distributed Systems",
                    opportunity_type="industrial_immersion",
                    organization_name="Intel Research Laboratories",
                    description="6-week industrial sabbatical program for faculty to work alongside industrial architects on distributed systems & low-latency execution.",
                    domain="Distributed Systems",
                    stipend_or_grant=150000.0,
                    duration_weeks=6,
                    deadline=_NOW + timedelta(days=45),
                    status="open",
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
                ),
                FacultyOpportunity(
                    title="Industrial Consultancy Request: Real-Time Vector Search Optimization",
                    opportunity_type="consultancy_request",
                    organization_name="HyperScale Technologies",
                    description="Seeking senior faculty / domain experts to evaluate and optimize high-dimensional vector search indexing on PostgreSQL pgvector.",
                    domain="Database & Search Architectures",
                    stipend_or_grant=300000.0,
                    duration_weeks=12,
                    deadline=_NOW + timedelta(days=30),
                    status="open",
                ),
                FacultyOpportunity(
                    title="Applied R&D Grant: Verifiable Educational Credential Architectures",
                    opportunity_type="research_grant",
                    organization_name="Ministry of Education & Industry Consortium",
                    description="Research grant supporting faculty teams developing tamper-proof, cryptographic verification algorithms for national academic credits.",
                    domain="Educational Technology & Security",
                    stipend_or_grant=750000.0,
                    duration_weeks=24,
                    deadline=_NOW + timedelta(days=60),
                    status="open",
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

        # 7. Seed Demo Accounts for 4 Personas
        # Student
        if not await session.scalar(select(Student.id).where(Student.email == "maya@poly.demo")):
            st = Student(
                email="maya@poly.demo",
                password_hash=DEMO_PASSWORD_HASH,
                full_name="Maya Rivera",
                university="Harbor Polytechnic",
                github_username="demo-maya",
                recruiter_evidence_consent=True,
                career_goals={"target_roles": ["Full Stack Developer", "Backend Engineer"], "target_industries": ["FinTech", "Cloud Systems"]},
            )
            session.add(st)
            await session.flush()
            session.add(AccountEmail(email=st.email, account_id=st.id, role=Role.student))

        # Recruiter
        if not await session.scalar(select(Recruiter.id).where(Recruiter.email == "recruiter@techcorp.demo")):
            rec = Recruiter(
                email="recruiter@techcorp.demo",
                password_hash=DEMO_PASSWORD_HASH,
                company_name="TechCorp India Labs",
            )
            session.add(rec)
            await session.flush()
            session.add(AccountEmail(email=rec.email, account_id=rec.id, role=Role.recruiter))

        # Academician / Faculty (Canonical SIH & Demo)
        fac_demo = (await session.scalars(select(Academician).where(Academician.email == "faculty@example.demo"))).first()
        if not fac_demo:
            fac_demo = Academician(
                email="faculty@example.demo",
                password_hash=hash_password("DemoPassword123"),
                full_name="Dr. Arvind Rao",
                institution_name="Harbor Polytechnic University",
                department="Computer Science & Engineering",
                designation="Professor & Placement Dean",
                research_areas=["Distributed Systems", "Explainable AI", "Verification Systems"],
                bio="Professor with 14+ years of academic research and industry consulting experience in scalable microservices, cryptographic verification pipelines, and explainable ML models. Senior IEEE Member and Dean of Industry Partnerships.",
                years_experience=14,
                technical_skills=["Python", "FastAPI", "Distributed Systems", "PostgreSQL", "PyTorch", "Docker", "Explainable AI"],
                certifications=[
                    {"name": "Google Cloud Professional Architect", "issuer": "Google Cloud", "year": "2024"},
                    {"name": "AICTE Advanced Industry Immersion Fellow", "issuer": "AICTE India", "year": "2023"},
                ],
                publications=[
                    {"title": "Deterministic and Auditable Match Verification in Heterogeneous Workspaces", "journal_or_conf": "IEEE Trans. Services Computing", "year": "2025"},
                    {"title": "Zero-Demographic Bias Talent Pipelines via Cryptographic Competency Spans", "journal_or_conf": "ACM SIGKDD Workshop", "year": "2024"},
                ],
                patents=[
                    {"title": "System and Method for Provable Skill Provenance Verification", "patent_number": "IN-2024-99881", "status": "Granted", "year": "2024"},
                ],
                past_industry_experience=[
                    {"company": "Intel India R&D", "role": "Visiting Research Scientist", "duration_years": 2, "description": "Researched low-latency vector indexing acceleration on multi-core clusters."},
                ],
                completed_fdps=[
                    {"title": "National FDP on Explainable Artificial Intelligence", "organizer": "IIT Bombay", "year": "2024"},
                ],
                completed_trainings=[
                    {"title": "Cloud-Native Infrastructure Immersion", "company": "Microsoft India", "duration_weeks": 4, "year": "2023"},
                ],
                collaboration_availability="available",
                phone="+91 98765 43210",
                linkedin_url="https://linkedin.com/in/demo-dr-arvind-rao",
                google_scholar_url="https://scholar.google.com/citations?user=demo_arvind_rao",
            )
            session.add(fac_demo)
            await session.flush()
            session.add(AccountEmail(email=fac_demo.email, account_id=fac_demo.id, role=Role.academician))
        else:
            if not fac_demo.technical_skills:
                fac_demo.technical_skills = ["Python", "FastAPI", "Distributed Systems", "PostgreSQL", "PyTorch", "Docker", "Explainable AI"]
                fac_demo.bio = "Professor with 14+ years of academic research and industry consulting experience in scalable microservices, cryptographic verification pipelines, and explainable ML models."
                fac_demo.years_experience = 14
                fac_demo.certifications = [{"name": "Google Cloud Professional Architect", "issuer": "Google Cloud", "year": "2024"}]
                fac_demo.publications = [{"title": "Deterministic and Auditable Match Verification", "journal_or_conf": "IEEE TSC", "year": "2025"}]
                fac_demo.patents = [{"title": "System and Method for Provable Skill Provenance", "patent_number": "IN-2024-99881", "status": "Granted", "year": "2024"}]
                fac_demo.collaboration_availability = "available"
                await session.flush()

        # Seed Faculty Applications and Workspaces if not present
        existing_apps = (await session.scalars(select(FacultyApplication).where(FacultyApplication.faculty_id == fac_demo.id))).all()
        if not existing_apps:
            opps = (await session.scalars(select(FacultyOpportunity))).all()
            opp_by_type = {o.opportunity_type: o for o in opps}

            # 1. Accepted Research Grant -> Spawns Collaboration Workspace
            if "research_grant" in opp_by_type:
                grant_opp = opp_by_type["research_grant"]
                grant_app = FacultyApplication(
                    faculty_id=fac_demo.id,
                    opportunity_id=grant_opp.id,
                    status="accepted",
                    application_type="research_grant",
                    proposal_title="Cryptographic Verification Engine for National Academic Passports",
                    proposal_text="A deterministic, privacy-preserving microservices framework to mathematically verify student skill provenance across heterogeneous assessment registries without transmitting raw demographic identifiers.",
                    problem_statement="Centralized credentialing systems either compromise candidate privacy or lack verifiable source evidence spans.",
                    methodology="Implement async FastAPI microservices tied to PostgreSQL pgvector and cryptographic evidence fingerprints.",
                    deliverables=["Core Verification Engine", "PostgreSQL pgvector Schema", "Audit & Explanation Benchmark Suite"],
                    milestones=[
                        {"id": "m1", "title": "Protocol Specification & Threat Modeling", "status": "completed", "due_date": "Month 1"},
                        {"id": "m2", "title": "Engine Implementation & pgvector Sandbox", "status": "completed", "due_date": "Month 3"},
                        {"id": "m3", "title": "Live Pilot Integration & Stress Testing", "status": "in_progress", "due_date": "Month 5"},
                        {"id": "m4", "title": "Final Technical Report & Open Standard Release", "status": "pending", "due_date": "Month 6"},
                    ],
                    timeline_weeks=24,
                    budget_requested=750000.0,
                    industry_mentor_name="Dr. Vikram Sethi (Principal Architect)",
                    industry_mentor_email="vikram.sethi@consortium.demo",
                    engagement_status="active",
                    start_date=_NOW - timedelta(days=60),
                )
                session.add(grant_app)
                await session.flush()

                # Create active workspace
                grant_ws = CollaborationWorkspace(
                    application_id=grant_app.id,
                    title="Cryptographic Verification Engine R&D Workspace",
                    collaboration_type="research_collaboration",
                    organization_name=grant_opp.organization_name,
                    faculty_lead_id=fac_demo.id,
                    industry_lead_name="Dr. Vikram Sethi",
                    industry_lead_email="vikram.sethi@consortium.demo",
                    status="active",
                    progress_percentage=50,
                    objectives=grant_app.deliverables,
                    participants=[
                        {"id": str(fac_demo.id), "name": fac_demo.full_name, "role": "Principal Investigator", "department": fac_demo.department},
                        {"name": "Dr. Vikram Sethi", "role": "Industry Research Lead", "company": grant_opp.organization_name},
                    ],
                    milestones=grant_app.milestones,
                    tasks=[
                        {"id": "t1", "title": "Benchmark cryptographic hash verification latency", "assigned_to": "Dr. Arvind Rao", "status": "done", "priority": "high"},
                        {"id": "t2", "title": "Deploy pgvector index tuning in sandbox", "assigned_to": "Research Team", "status": "in_progress", "priority": "medium"},
                    ],
                    meetings=[
                        {"id": "mt1", "title": "Weekly Research Progress Review", "date": "Every Tuesday 4:00 PM IST", "link": "https://meet.google.com/verif-r-d"},
                    ],
                    discussion_posts=[
                        {
                            "id": "dp1",
                            "author_name": "Dr. Vikram Sethi",
                            "author_role": "industry_mentor",
                            "content": "Preliminary benchmarks on pgvector cosine similarity show 8x throughput improvements. Proceeding with milestone 3.",
                            "created_at": (_NOW - timedelta(days=2)).isoformat(),
                        }
                    ],
                    deliverables=[
                        {"id": "d1", "title": "Architecture Specification Document", "deliverable_type": "paper", "url_or_key": "https://docs.example.demo/arch-v1.pdf", "submitted_at": (_NOW - timedelta(days=30)).isoformat()}
                    ],
                    feedback=[
                        {"author_name": "Dr. Vikram Sethi", "author_role": "industry_mentor", "rating": 5, "comments": "Outstanding technical execution and rigorous cryptographic design.", "created_at": (_NOW - timedelta(days=10)).isoformat()}
                    ],
                    start_date=_NOW - timedelta(days=60),
                )
                session.add(grant_ws)

            # 2. Submitted Industrial Immersion Application
            if "industrial_immersion" in opp_by_type:
                imm_opp = opp_by_type["industrial_immersion"]
                session.add(
                    FacultyApplication(
                        faculty_id=fac_demo.id,
                        opportunity_id=imm_opp.id,
                        status="submitted",
                        application_type="industrial_immersion",
                        proposal_title="Low-Latency Distributed Stream Processing Immersion",
                        proposal_text="Hands-on 6-week sabbatical to collaborate with Intel systems architects on optimizing lock-free ring buffers and async I/O drivers.",
                        timeline_weeks=6,
                        budget_requested=150000.0,
                    )
                )

            # 3. Completed FDP / Workshop
            if "fdp" in opp_by_type:
                fdp_opp = opp_by_type["fdp"]
                session.add(
                    FacultyApplication(
                        faculty_id=fac_demo.id,
                        opportunity_id=fdp_opp.id,
                        status="completed",
                        application_type="fdp",
                        proposal_title="Curriculum Alignment on Explainable AI and Fairness Metrics",
                        proposal_text="Completed national faculty development program with certified curriculum module adoption.",
                        timeline_weeks=2,
                        engagement_status="completed",
                        completion_report="Successfully completed all hands-on labs and integrated deterministic fairness scoring modules into departmental coursework.",
                        start_date=_NOW - timedelta(days=90),
                        end_date=_NOW - timedelta(days=76),
                    )
                )

            # Notifications
            session.add_all([
                FacultyNotification(
                    faculty_id=fac_demo.id,
                    title="Research Grant Proposal Accepted 🎉",
                    message="Your proposal 'Cryptographic Verification Engine' has been accepted by the Ministry of Education & Industry Consortium. Collaboration workspace activated.",
                    category="application",
                    is_read=True,
                ),
                FacultyNotification(
                    faculty_id=fac_demo.id,
                    title="Milestone 2 Verified by Industry Lead",
                    message="Dr. Vikram Sethi endorsed Milestone 2: Engine Implementation & pgvector Sandbox.",
                    category="workspace",
                    is_read=False,
                ),
            ])

            # Event Registrations
            session.add(
                FacultyEventRegistration(
                    faculty_id=fac_demo.id,
                    event_id=uuid.uuid4(),
                    event_type="workshop",
                    event_title="Production pgvector & RAG Architectures Workshop",
                    host_organization="Postgres Enterprise Guild",
                    role="speaker",
                    status="completed",
                    feedback="Delivered keynote on Deterministic Skill Embeddings and Cosine Distance Thresholding.",
                    scheduled_at=_NOW - timedelta(days=14),
                )
            )

        if not await session.scalar(select(Academician.id).where(Academician.email == "faculty@poly.demo")):
            fac = Academician(
                email="faculty@poly.demo",
                password_hash=DEMO_PASSWORD_HASH,
                full_name="Dr. Aris Thorne",
                institution_name="Harbor Polytechnic",
                department="Computer Science & Engineering",
                designation="Associate Professor & Placement Chair",
                research_areas=["Distributed Systems", "AI & Knowledge Graphs", "Deterministic Verification"],
            )
            session.add(fac)
            await session.flush()
            session.add(AccountEmail(email=fac.email, account_id=fac.id, role=Role.academician))

        # Institution (Canonical SIH & Demo)
        if not await session.scalar(select(Institution.id).where(Institution.email == "dean@example.demo")):
            inst_demo = Institution(
                email="dean@example.demo",
                password_hash=hash_password("DemoPassword123"),
                institution_name="Harbor Polytechnic University",
                institution_code="HPU-DEMO",
                state="Maharashtra",
                departments=["Computer Science", "Information Technology", "Electronics"],
            )
            session.add(inst_demo)
            await session.flush()
            session.add(AccountEmail(email=inst_demo.email, account_id=inst_demo.id, role=Role.institution))

        if not await session.scalar(select(Institution.id).where(Institution.email == "admin@poly.demo")):
            inst = Institution(
                email="admin@poly.demo",
                password_hash=DEMO_PASSWORD_HASH,
                institution_name="Harbor Polytechnic University",
                institution_code="HP-2026",
                state="Maharashtra",
            )
            session.add(inst)
            await session.flush()
            session.add(AccountEmail(email=inst.email, account_id=inst.id, role=Role.institution))

        await session.commit()
        print("SIH Ecosystem seed completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_sih_ecosystem())

