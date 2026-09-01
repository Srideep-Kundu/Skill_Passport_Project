"""Private-by-default, revocable Skill Passport presentation layer."""

from __future__ import annotations

import hashlib
import hmac
import io
import secrets
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from xml.sax.saxutils import escape

import qrcode
from qrcode.image.svg import SvgPathImage
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from reportlab.platypus.flowables import Flowable
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Assessment,
    AssessmentAttempt,
    AuditLog,
    CourseEnrollment,
    Evidence,
    InnovationChallenge,
    Internship,
    InternshipEngagement,
    LearningCourse,
    PassportShare,
    ProjectApplication,
    Skill,
    Student,
    StudentAchievement,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    PassportShareCreate,
    PassportShareCreated,
    PassportShareResponse,
    PublicEvidenceSummary,
    PublicOutcomeSummary,
    PublicPassportResponse,
    PublicProvenanceSummary,
    PublicSkillSummary,
)

TOKEN_BYTES = 32


class ShareNotFoundError(Exception):
    """Share is absent or inactive; intentionally indistinguishable."""


def hash_share_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def share_status(share: PassportShare, now: datetime | None = None) -> str:
    current = now or datetime.now(UTC)
    if share.revoked_at is not None:
        return "revoked"
    expires_at = share.expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at is not None and expires_at <= current:
        return "expired"
    return "active"


def management_response(share: PassportShare) -> PassportShareResponse:
    return PassportShareResponse(
        id=share.id,
        label=share.label,
        visibility_allowlist=share.visibility_allowlist,
        expires_at=share.expires_at,
        revoked_at=share.revoked_at,
        created_at=share.created_at,
        last_accessed_at=share.last_accessed_at,
        access_count=share.access_count,
        status=share_status(share),
    )


async def create_share(
    session: AsyncSession,
    student: Student,
    payload: PassportShareCreate,
    public_url_builder,
) -> PassportShareCreated:
    now = datetime.now(UTC)
    if payload.expires_at is not None and payload.expires_at <= now:
        raise ValueError("expires_at must be in the future")
    raw_token = secrets.token_urlsafe(TOKEN_BYTES)
    share = PassportShare(
        student_id=student.id,
        token_hash=hash_share_token(raw_token),
        visibility_allowlist=list(payload.visibility_allowlist),
        expires_at=payload.expires_at,
        label=payload.label,
    )
    session.add(share)
    await session.flush()
    session.add(
        AuditLog(
            actor_id=student.id,
            action="passport_share_created",
            entity_type="passport_share",
            entity_id=share.id,
            details={
                "visibility": share.visibility_allowlist,
                "has_expiry": share.expires_at is not None,
            },
        )
    )
    await session.commit()
    await session.refresh(share)
    base = management_response(share).model_dump()
    return PassportShareCreated(
        **base,
        public_url=public_url_builder(raw_token),
        raw_token=raw_token,
    )


async def list_shares(
    session: AsyncSession, student_id: uuid.UUID
) -> list[PassportShareResponse]:
    shares = list(
        (
            await session.scalars(
                select(PassportShare)
                .where(PassportShare.student_id == student_id)
                .order_by(PassportShare.created_at.desc())
            )
        ).all()
    )
    return [management_response(share) for share in shares]


async def owned_share(
    session: AsyncSession, student_id: uuid.UUID, share_id: uuid.UUID
) -> PassportShare:
    share = await session.get(PassportShare, share_id)
    if share is None or share.student_id != student_id:
        raise ShareNotFoundError
    return share


async def revoke_share(
    session: AsyncSession, student: Student, share_id: uuid.UUID
) -> PassportShareResponse:
    share = await owned_share(session, student.id, share_id)
    if share.revoked_at is None:
        share.revoked_at = datetime.now(UTC)
        session.add(
            AuditLog(
                actor_id=student.id,
                action="passport_share_revoked",
                entity_type="passport_share",
                entity_id=share.id,
                details={},
            )
        )
        await session.commit()
        await session.refresh(share)
    return management_response(share)


async def resolve_active_share(
    session: AsyncSession, raw_token: str, *, record_access: bool
) -> PassportShare:
    if len(raw_token) < 40 or len(raw_token) > 128:
        raise ShareNotFoundError
    expected_hash = hash_share_token(raw_token)
    share = await session.scalar(
        select(PassportShare).where(PassportShare.token_hash == expected_hash)
    )
    if share is None or not hmac.compare_digest(share.token_hash, expected_hash):
        raise ShareNotFoundError
    if share_status(share) != "active":
        raise ShareNotFoundError
    if record_access:
        share.last_accessed_at = datetime.now(UTC)
        share.access_count += 1
        await session.commit()
    return share


def _safe_evidence_label(evidence: Evidence) -> str:
    if evidence.resume_document_id is not None:
        return "Resume evidence"
    if evidence.linkedin_import_id is not None:
        return "LinkedIn export evidence"
    return evidence.title[:160]


def _outcome(
    title: str, category: str, status: str, completed_at=None, summary=None
) -> PublicOutcomeSummary:
    return PublicOutcomeSummary(
        title=title[:255],
        category=category,
        status=status,
        completed_at=completed_at,
        summary=summary[:500] if summary else None,
    )


async def build_public_passport(
    session: AsyncSession, share: PassportShare
) -> PublicPassportResponse:
    allowed = set(share.visibility_allowlist)
    student = await session.get(Student, share.student_id)
    if student is None:
        raise ShareNotFoundError

    response = PublicPassportResponse(
        display_name=student.full_name if "display_identity" in allowed else None,
        generated_at=datetime.now(UTC),
        visible_sections=share.visibility_allowlist,
    )
    skill_rows = (
        await session.execute(
            select(StudentSkill, Skill, Evidence)
            .join(Skill, Skill.id == StudentSkill.skill_id)
            .join(Evidence, Evidence.id == StudentSkill.source_evidence_id)
            .where(StudentSkill.student_id == student.id)
            .order_by(Skill.canonical_name, Evidence.submitted_at)
        )
    ).all()

    if "verified_skills" in allowed:
        grouped: dict[str, list[tuple[StudentSkill, Evidence]]] = {}
        for student_skill, skill, evidence in skill_rows:
            if student_skill.verification_tier == VerificationTier.verified:
                grouped.setdefault(skill.canonical_name, []).append(
                    (student_skill, evidence)
                )
        response.skills = []
        for canonical_name, supports in grouped.items():
            strongest = max(
                supports, key=lambda item: float(item[0].extraction_confidence)
            )[0]
            response.skills.append(
                PublicSkillSummary(
                    canonical_name=canonical_name,
                    verification_tier="verified",
                    confidence=float(strongest.extraction_confidence),
                    provenance=[
                        PublicProvenanceSummary(
                            source_type=evidence.evidence_type.value,
                            source_label=_safe_evidence_label(evidence),
                        )
                        for _, evidence in supports
                    ],
                )
            )

    evidence_rows = list(
        (
            await session.scalars(
                select(Evidence)
                .where(Evidence.student_id == student.id)
                .order_by(Evidence.submitted_at.desc())
            )
        ).all()
    )
    if "selected_evidence_summaries" in allowed:
        response.evidence = [
            PublicEvidenceSummary(
                evidence_type=item.evidence_type.value,
                title=_safe_evidence_label(item),
                verification_summary="Supports verified passport skills"
                if any(
                    row.source_evidence_id == item.id
                    and row.verification_tier == VerificationTier.verified
                    for row, _, _ in skill_rows
                )
                else "Student-submitted evidence",
            )
            for item in evidence_rows
        ]
    if "projects" in allowed:
        response.projects = [
            _outcome(
                _safe_evidence_label(item), "project", item.extraction_status.value
            )
            for item in evidence_rows
            if item.evidence_type.value == "project"
        ]
    if "certifications" in allowed:
        response.certifications = [
            _outcome(
                _safe_evidence_label(item),
                "certification",
                item.extraction_status.value,
            )
            for item in evidence_rows
            if item.evidence_type.value == "certification"
        ]
    if "achievements" in allowed:
        achievements = list(
            (
                await session.scalars(
                    select(StudentAchievement).where(
                        StudentAchievement.student_id == student.id
                    )
                )
            ).all()
        )
        response.achievements = [
            _outcome(
                item.title,
                item.achievement_type,
                item.verification_status,
                item.issue_date,
                item.issuer_organization,
            )
            for item in achievements
        ]
    if "internship_outcomes" in allowed:
        internship_rows = (
            await session.execute(
                select(InternshipEngagement, Internship)
                .join(Internship, Internship.id == InternshipEngagement.internship_id)
                .where(
                    InternshipEngagement.student_id == student.id,
                    InternshipEngagement.status == "completed",
                )
            )
        ).all()
        response.internship_outcomes = [
            _outcome(
                internship.title,
                "internship",
                engagement.status,
                engagement.completed_at,
            )
            for engagement, internship in internship_rows
        ]
    if "learning_outcomes" in allowed:
        learning_rows = (
            await session.execute(
                select(CourseEnrollment, LearningCourse)
                .join(LearningCourse, LearningCourse.id == CourseEnrollment.course_id)
                .where(
                    CourseEnrollment.student_id == student.id,
                    CourseEnrollment.status == "completed",
                )
            )
        ).all()
        response.learning_outcomes = [
            _outcome(
                course.title,
                course.program_type,
                enrollment.status,
                enrollment.completed_at,
                course.provider,
            )
            for enrollment, course in learning_rows
        ]
    if "assessment_competencies" in allowed:
        assessment_rows = (
            await session.execute(
                select(AssessmentAttempt, Assessment)
                .join(Assessment, Assessment.id == AssessmentAttempt.assessment_id)
                .where(
                    AssessmentAttempt.student_id == student.id,
                    AssessmentAttempt.passed.is_(True),
                )
            )
        ).all()
        response.assessment_competencies = [
            _outcome(
                assessment.title,
                assessment.assessment_type,
                "passed",
                attempt.completed_at,
                f"Score {float(attempt.score):.0f}%",
            )
            for attempt, assessment in assessment_rows
        ]
    if "collaboration_outcomes" in allowed:
        collaboration_rows = (
            await session.execute(
                select(ProjectApplication, InnovationChallenge)
                .join(
                    InnovationChallenge,
                    InnovationChallenge.id == ProjectApplication.challenge_id,
                )
                .where(
                    ProjectApplication.student_id == student.id,
                    ProjectApplication.status == "completed",
                )
            )
        ).all()
        response.collaboration_outcomes = [
            _outcome(
                challenge.title,
                challenge.challenge_type,
                application.status,
                application.completed_at,
            )
            for application, challenge in collaboration_rows
        ]
    if "verification_summaries" in allowed:
        counts = {"verified": 0, "partially_verified": 0, "unverified": 0}
        for student_skill, _, _ in skill_rows:
            counts[student_skill.verification_tier.value] += 1
        response.verification_summary = counts
    return response


def render_pdf(passport: PublicPassportResponse, public_url: str) -> bytes:
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Shared Skill Passport",
        author="Skill Passport",
    )
    styles = getSampleStyleSheet()
    story: list[Flowable] = [
        Paragraph(
            escape(passport.display_name or "Shared Skill Passport"), styles["Title"]
        )
    ]
    story.extend(
        [Paragraph("Verifiable Skill Passport", styles["Heading2"]), Spacer(1, 6)]
    )
    if passport.skills is not None:
        story.append(Paragraph("Verified skills", styles["Heading2"]))
        for skill in passport.skills:
            sources = ", ".join(
                escape(source.source_label) for source in skill.provenance
            )
            story.append(
                Paragraph(
                    f"<b>{escape(skill.canonical_name)}</b> — verified<br/>Evidence: {sources}",
                    styles["BodyText"],
                )
            )
    section_values: Iterable[tuple[str, list[PublicOutcomeSummary] | None]] = (
        ("Projects", passport.projects),
        ("Certifications", passport.certifications),
        ("Achievements", passport.achievements),
        ("Internship outcomes", passport.internship_outcomes),
        ("Learning outcomes", passport.learning_outcomes),
        ("Assessment competencies", passport.assessment_competencies),
        ("Collaboration outcomes", passport.collaboration_outcomes),
    )
    for heading, values in section_values:
        if values is not None:
            story.append(Spacer(1, 8))
            story.append(Paragraph(heading, styles["Heading2"]))
            for item in values:
                story.append(
                    Paragraph(
                        f"<b>{escape(item.title)}</b> — {escape(item.status)}",
                        styles["BodyText"],
                    )
                )
    story.extend(
        [
            Spacer(1, 12),
            Paragraph(
                f"Generated {passport.generated_at.isoformat()}", styles["BodyText"]
            ),
            Paragraph(
                f"Verify this revocable passport: {escape(public_url)}",
                styles["BodyText"],
            ),
        ]
    )
    document.build(story)
    return buffer.getvalue()


def render_qr_svg(public_url: str) -> bytes:
    image = qrcode.make(public_url, image_factory=SvgPathImage, box_size=8, border=4)
    output = io.BytesIO()
    image.save(output)
    return output.getvalue()
