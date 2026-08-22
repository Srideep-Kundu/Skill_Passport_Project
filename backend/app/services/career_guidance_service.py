"""Explainable Career Guidance Service.

Synthesizes student's verified skills, assessment benchmarks, internship matches,
and curriculum gaps into actionable, transparent career recommendations without black-box ML.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Student, StudentSkill, VerificationTier
from app.schemas.contracts import APIModel
from app.services.skill_gap_service import (
    ROLE_SKILL_PROFILES,
    analyze_skill_gaps,
)


class RoleGuidance(APIModel):
    role_name: str
    readiness_percentage: float
    status: str  # ready, next_step, exploratory
    matched_skills: list[str]
    missing_critical_skills: list[str]
    why_explanation: str
    recommended_next_step: str
    target_industries: list[str]


class CareerGuidanceOverview(APIModel):
    target_role: str
    target_role_readiness: float
    ready_roles: list[RoleGuidance]
    next_step_roles: list[RoleGuidance]
    top_skill_priorities: list[str]
    aligning_industry_sectors: list[str]
    learning_action_plan: list[dict[str, str]]


ROLE_INDUSTRIES_MAP = {
    "Backend Engineer": ["FinTech", "Cloud Infrastructure", "Enterprise SaaS", "E-Commerce"],
    "Frontend Engineer": ["Consumer Tech", "EdTech", "Media & Entertainment", "Digital Agencies"],
    "Full Stack Developer": ["Startups & Scaleups", "FinTech", "HealthTech", "Consulting"],
    "DevOps / Cloud Engineer": ["Cloud Hosting", "Telecom & Networking", "Cybersecurity", "Banking"],
    "AI / Machine Learning Engineer": ["Artificial Intelligence", "Autonomous Systems", "BioTech", "Quantitative Finance"],
    "Data Scientist": ["Analytics", "Enterprise Software", "Healthcare", "Finance"],
    "Mobile Application Developer": ["Consumer Apps", "Gaming", "FinTech Payments", "Logistics"],
    "Security Analyst": ["Cybersecurity Operations", "Defense & Aerospace", "Government Systems", "Banking"],
}


async def generate_career_guidance(
    session: AsyncSession,
    student_id: UUID,
) -> CareerGuidanceOverview:
    student = await session.get(Student, student_id)
    career_goals = student.career_goals if student and student.career_goals else {}
    target_roles = career_goals.get("target_roles", ["Backend Engineer"])
    primary_target = target_roles[0] if target_roles else "Backend Engineer"

    # Evaluate student across all canonical taxonomy roles
    role_evaluations: list[RoleGuidance] = []

    for role_name in ROLE_SKILL_PROFILES:
        gap_res = await analyze_skill_gaps(session, student_id, role_name)
        readiness = gap_res.overall_readiness_score
        status = "ready" if readiness >= 70 else "next_step" if readiness >= 40 else "exploratory"

        possessed_skills = [
            item.skill_name for item in gap_res.gap_items if item.status in ("verified", "assessed")
        ]

        missing_critical = [
            item.skill_name
            for item in gap_res.gap_items
            if item.status == "missing" and item.importance in ("critical", "high")
        ]

        why = (
            f"You possess {len(possessed_skills)} verified core competencies with {readiness}% curriculum alignment."
            if readiness >= 70
            else f"You have strong foundations in {', '.join(possessed_skills[:2]) if possessed_skills else 'software fundamentals'}, but need {len(missing_critical)} key requirements."
        )

        next_step = (
            f"Apply to junior {role_name} openings and placement drives."
            if readiness >= 70
            else f"Complete coursework/project in {missing_critical[0] if missing_critical else 'system architecture'}."
        )

        industries = ROLE_INDUSTRIES_MAP.get(role_name, ["Technology", "Enterprise Software"])

        role_evaluations.append(
            RoleGuidance(
                role_name=role_name,
                readiness_percentage=readiness,
                status=status,
                matched_skills=possessed_skills,
                missing_critical_skills=missing_critical,
                why_explanation=why,
                recommended_next_step=next_step,
                target_industries=industries,
            )
        )

    # Sort role evaluations by readiness descending
    role_evaluations.sort(key=lambda x: x.readiness_percentage, reverse=True)

    ready_roles = [r for r in role_evaluations if r.readiness_percentage >= 70]
    next_step_roles = [r for r in role_evaluations if 40 <= r.readiness_percentage < 70]

    # Primary target evaluation
    primary_eval = next((r for r in role_evaluations if r.role_name == primary_target), role_evaluations[0])

    top_priorities = primary_eval.missing_critical_skills[:4]
    if not top_priorities:
        top_priorities = ["Advanced System Design", "Production Monitoring"]

    action_plan = [
        {
            "priority": "1",
            "action": f"Master {top_priorities[0]} via curated coursework in Learning Hub",
            "impact": "Closes primary target role gap by +15%",
        }
    ]
    if len(top_priorities) > 1:
        action_plan.append({
            "priority": "2",
            "action": f"Take diagnostic assessment in {top_priorities[1]} to credit Skill Passport",
            "impact": "Validates technical proficiency for recruiters",
        })
    action_plan.append({
        "priority": "3",
        "action": "Participate in a Live Industry Challenge or Hackathon to generate project evidence",
        "impact": "Adds verifiable milestone portfolio proof",
    })

    return CareerGuidanceOverview(
        target_role=primary_target,
        target_role_readiness=primary_eval.readiness_percentage,
        ready_roles=ready_roles,
        next_step_roles=next_step_roles,
        top_skill_priorities=top_priorities,
        aligning_industry_sectors=primary_eval.target_industries,
        learning_action_plan=action_plan,
    )
