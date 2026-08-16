import asyncio

from sqlalchemy import select

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models import (
    AccountEmail,
    Evidence,
    EvidenceType,
    Internship,
    InternshipRequirement,
    Recruiter,
    Role,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from seed.seed_skills import seed_skills


async def seed_demo_data() -> None:
    await seed_skills()
    async with SessionLocal() as session:
        if (await session.scalars(select(Student).limit(1))).first():
            return
        recruiter = Recruiter(email="recruiter@example.test", password_hash=hash_password("DemoPassword123"), company_name="Skill Passport Labs")
        students = [
            Student(email="ada@example.test", password_hash=hash_password("DemoPassword123"), full_name="Ada Example", university="University A", recruiter_evidence_consent=True),
            Student(email="ben@example.test", password_hash=hash_password("DemoPassword123"), full_name="Ben Example", university="University B", recruiter_evidence_consent=True),
        ]
        session.add_all([recruiter, *students])
        await session.flush()
        session.add_all(
            [
                AccountEmail(email=recruiter.email, account_id=recruiter.id, role=Role.recruiter),
                *(AccountEmail(email=student.email, account_id=student.id, role=Role.student) for student in students),
            ]
        )
        skills = {skill.canonical_name: skill for skill in (await session.scalars(select(Skill).where(Skill.canonical_name.in_(["Python", "FastAPI", "PostgreSQL", "React"])))).all()}
        for student in students:
            evidence = Evidence(student_id=student.id, evidence_type=EvidenceType.project, title="API project", description="Built a Python FastAPI service using PostgreSQL.", extraction_status="extracted")
            session.add(evidence)
            await session.flush()
            for name in ("Python", "FastAPI", "PostgreSQL"):
                session.add(StudentSkill(student_id=student.id, skill_id=skills[name].id, source_evidence_id=evidence.id, extraction_confidence=0.9, verification_tier=VerificationTier.verified, evidence_span=name))
        internship = Internship(recruiter_id=recruiter.id, title="Backend Intern", description="Build Python FastAPI services with PostgreSQL.")
        session.add(internship)
        await session.flush()
        for name, weight in (("Python", 1.0), ("FastAPI", 1.0), ("PostgreSQL", 1.0)):
            session.add(InternshipRequirement(internship_id=internship.id, skill_id=skills[name].id, is_required=True, weight=weight))
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
