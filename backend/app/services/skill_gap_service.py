"""Career Goal & Skill Gap Intelligence Engine.

Computes role readiness, identifies missing vs verified skills, and prioritizes closure actions.
"""
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Evidence, Skill, Student, StudentSkill, VerificationTier
from app.schemas.contracts import (
    CareerGoalsResponse,
    CareerGoalsUpdate,
    SkillGapAnalysisResponse,
    SkillGapItem,
)

# Standard industry role skill expectations mapping (canonical skills)
ROLE_SKILL_PROFILES: dict[str, list[dict[str, Any]]] = {
    "Full Stack Developer": [
        {"name": "React", "category": "Frontend", "importance": "critical"},
        {"name": "TypeScript", "category": "Languages", "importance": "critical"},
        {"name": "Node.js", "category": "Backend", "importance": "high"},
        {"name": "PostgreSQL", "category": "Databases", "importance": "critical"},
        {"name": "Docker", "category": "DevOps", "importance": "high"},
        {"name": "REST API", "category": "Architecture", "importance": "critical"},
        {"name": "Git", "category": "Tools", "importance": "high"},
        {"name": "FastAPI", "category": "Backend", "importance": "medium"},
    ],
    "AI / Machine Learning Engineer": [
        {"name": "Python", "category": "Languages", "importance": "critical"},
        {"name": "Machine Learning", "category": "AI", "importance": "critical"},
        {"name": "PyTorch", "category": "AI", "importance": "critical"},
        {"name": "PostgreSQL", "category": "Databases", "importance": "medium"},
        {"name": "Docker", "category": "DevOps", "importance": "high"},
        {"name": "FastAPI", "category": "Backend", "importance": "high"},
        {"name": "Data Analysis", "category": "Analytics", "importance": "high"},
    ],
    "Data Scientist": [
        {"name": "Python", "category": "Languages", "importance": "critical"},
        {"name": "SQL", "category": "Databases", "importance": "critical"},
        {"name": "Machine Learning", "category": "AI", "importance": "critical"},
        {"name": "Data Analysis", "category": "Analytics", "importance": "critical"},
        {"name": "Statistics", "category": "Core", "importance": "high"},
    ],
    "DevOps / Cloud Engineer": [
        {"name": "Docker", "category": "DevOps", "importance": "critical"},
        {"name": "Kubernetes", "category": "DevOps", "importance": "critical"},
        {"name": "CI/CD", "category": "DevOps", "importance": "critical"},
        {"name": "Linux", "category": "Core", "importance": "high"},
        {"name": "Git", "category": "Tools", "importance": "high"},
    ],
}


async def get_student_career_goals(session: AsyncSession, student_id: UUID) -> CareerGoalsResponse:
    student = await session.get(Student, student_id)
    if not student or not student.career_goals:
        return CareerGoalsResponse(
            target_roles=["Full Stack Developer"],
            target_industry="Technology",
            target_skills=["React", "Python", "PostgreSQL"],
            target_salary_lpa=12.0,
            ambition_level="entry_level",
        )
    return CareerGoalsResponse(**student.career_goals)


async def update_student_career_goals(session: AsyncSession, student_id: UUID, payload: CareerGoalsUpdate) -> CareerGoalsResponse:
    student = await session.get(Student, student_id)
    if not student:
        raise ValueError("Student not found")
    data = payload.model_dump()
    student.career_goals = data
    await session.commit()
    return CareerGoalsResponse(**data)


async def analyze_skill_gaps(session: AsyncSession, student_id: UUID, target_role: str | None = None) -> SkillGapAnalysisResponse:
    # 1. Get student career goals or default
    goals = await get_student_career_goals(session, student_id)
    chosen_role = target_role or (goals.target_roles[0] if goals.target_roles else "Full Stack Developer")
    required_profile = ROLE_SKILL_PROFILES.get(chosen_role, ROLE_SKILL_PROFILES["Full Stack Developer"])

    # 2. Query student's verified skills
    student_skills_stmt = (
        select(StudentSkill, Skill)
        .join(Skill, StudentSkill.skill_id == Skill.id)
        .where(StudentSkill.student_id == student_id)
    )
    results = (await session.execute(student_skills_stmt)).all()

    student_skill_map: dict[str, tuple[float, VerificationTier]] = {}
    for st_skill, sk in results:
        canonical = sk.canonical_name.casefold()
        conf = float(st_skill.extraction_confidence)
        tier = st_skill.verification_tier
        if canonical not in student_skill_map or conf > student_skill_map[canonical][0]:
            student_skill_map[canonical] = (conf, tier)

    # 3. Compute gap items
    gap_items: list[SkillGapItem] = []
    matched_count = 0
    total_score = 0.0

    for req in required_profile:
        name = req["name"]
        cat = req["category"]
        imp = req["importance"]
        name_lower = name.casefold()

        if name_lower in student_skill_map:
            conf, tier = student_skill_map[name_lower]
            tier_mult = 1.0 if tier == VerificationTier.verified else (0.85 if tier == VerificationTier.partially_verified else 0.65)
            eff_prof = round(conf * tier_mult, 2)
            matched_count += 1
            total_score += eff_prof
            gap_items.append(
                SkillGapItem(
                    skill_name=name,
                    category=cat,
                    status="verified" if tier == VerificationTier.verified else "assessed",
                    proficiency_score=eff_prof,
                    importance=imp,
                    recommended_action="Verified in Skill Passport — maintain active projects.",
                )
            )
        else:
            gap_items.append(
                SkillGapItem(
                    skill_name=name,
                    category=cat,
                    status="missing",
                    proficiency_score=0.0,
                    importance=imp,
                    recommended_action=f"High-priority gap. Take diagnostic assessment or complete recommended course.",
                )
            )

    readiness = round((total_score / max(len(required_profile), 1)) * 100.0, 1)

    top_courses = [
        f"Mastering {item.skill_name} for Industry"
        for item in gap_items
        if item.status == "missing"
    ][:3]

    return SkillGapAnalysisResponse(
        target_role=chosen_role,
        overall_readiness_score=min(readiness, 100.0),
        matched_skills_count=matched_count,
        missing_skills_count=len(required_profile) - matched_count,
        gap_items=gap_items,
        top_recommended_courses=top_courses,
    )
