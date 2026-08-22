"""Digital Portfolio & Student Achievements Service.

Records competitions, hackathons, academic awards, publications, and extracurriculars
with verified links into the student's Skill Passport.
"""
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Evidence, EvidenceType, ExtractionStatus, StudentAchievement
from app.schemas.contracts import APIModel


class StudentAchievementCreate(APIModel):
    title: str
    achievement_type: str  # hackathon, competition, award, publication, leadership, extracurricular
    issuer_organization: str
    issue_date: datetime
    description: str
    proof_url: str | None = None


class StudentAchievementResponse(APIModel):
    id: UUID
    student_id: UUID
    title: str
    achievement_type: str
    issuer_organization: str
    issue_date: datetime
    description: str
    proof_url: str | None
    verification_status: str
    evidence_id: UUID | None
    created_at: str


async def list_student_achievements(
    session: AsyncSession,
    student_id: UUID,
) -> list[StudentAchievementResponse]:
    stmt = (
        select(StudentAchievement)
        .where(StudentAchievement.student_id == student_id)
        .order_by(StudentAchievement.issue_date.desc())
    )
    rows = (await session.scalars(stmt)).all()
    return [
        StudentAchievementResponse(
            id=a.id,
            student_id=a.student_id,
            title=a.title,
            achievement_type=a.achievement_type,
            issuer_organization=a.issuer_organization,
            issue_date=a.issue_date,
            description=a.description,
            proof_url=a.proof_url,
            verification_status=a.verification_status,
            evidence_id=a.evidence_id,
            created_at=a.created_at.isoformat(),
        )
        for a in rows
    ]


async def create_student_achievement(
    session: AsyncSession,
    student_id: UUID,
    payload: StudentAchievementCreate,
) -> StudentAchievementResponse:
    # Generate an Evidence record in passport
    evidence = Evidence(
        student_id=student_id,
        evidence_type=EvidenceType.competition if payload.achievement_type in ("hackathon", "competition") else EvidenceType.project,
        title=f"Achievement: {payload.title}",
        description=f"{payload.achievement_type.title()} from {payload.issuer_organization}. {payload.description}",
        external_url=payload.proof_url,
        raw_metadata={
            "achievement_type": payload.achievement_type,
            "issuer": payload.issuer_organization,
            "issue_date": payload.issue_date.isoformat(),
        },
        extraction_status=ExtractionStatus.extracted,
    )
    session.add(evidence)
    await session.flush()

    achievement = StudentAchievement(
        student_id=student_id,
        title=payload.title,
        achievement_type=payload.achievement_type,
        issuer_organization=payload.issuer_organization,
        issue_date=payload.issue_date,
        description=payload.description,
        proof_url=payload.proof_url,
        verification_status="verified" if payload.proof_url else "self_reported",
        evidence_id=evidence.id,
    )
    session.add(achievement)
    await session.commit()
    await session.refresh(achievement)

    return StudentAchievementResponse(
        id=achievement.id,
        student_id=achievement.student_id,
        title=achievement.title,
        achievement_type=achievement.achievement_type,
        issuer_organization=achievement.issuer_organization,
        issue_date=achievement.issue_date,
        description=achievement.description,
        proof_url=achievement.proof_url,
        verification_status=achievement.verification_status,
        evidence_id=achievement.evidence_id,
        created_at=achievement.created_at.isoformat(),
    )
