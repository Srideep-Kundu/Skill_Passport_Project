import enum
import uuid
from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON, Uuid

from app.core.db import Base

Json = JSON().with_variant(JSONB, "postgresql")
Embedding = JSON().with_variant(Vector(768), "postgresql")


class Role(str, enum.Enum):
    student = "student"
    recruiter = "recruiter"
    admin = "admin"


class EvidenceType(str, enum.Enum):
    coursework = "coursework"
    project = "project"
    competition = "competition"
    certification = "certification"
    micro_credential = "micro_credential"


class ExtractionStatus(str, enum.Enum):
    pending_extraction = "pending_extraction"
    queued = "queued"
    processing = "processing"
    retry_scheduled = "retry_scheduled"
    extracted = "extracted"
    failed = "failed"
    dead_lettered = "dead_lettered"


class ExtractionJobStatus(str, enum.Enum):
    pending = "pending"
    queued = "queued"
    processing = "processing"
    retry_scheduled = "retry_scheduled"
    completed = "completed"
    failed = "failed"
    dead_lettered = "dead_lettered"


class VerificationTier(str, enum.Enum):
    verified = "verified"
    partially_verified = "partially_verified"
    unverified = "unverified"


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Student(Timestamped, Base):
    __tablename__ = "students"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    university: Mapped[str | None] = mapped_column(String(255))
    graduation_year: Mapped[int | None] = mapped_column(Integer)
    github_username: Mapped[str | None] = mapped_column(String(39), unique=True, index=True)
    recruiter_evidence_consent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    role = Role.student.value
    evidence: Mapped[list["Evidence"]] = relationship(back_populates="student", cascade="all, delete-orphan")


class Recruiter(Timestamped, Base):
    __tablename__ = "recruiters"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    company_name: Mapped[str] = mapped_column(String(255))
    role = Role.recruiter.value
    internships: Mapped[list["Internship"]] = relationship(back_populates="recruiter", cascade="all, delete-orphan")


class Admin(Timestamped, Base):
    __tablename__ = "admins"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role = Role.admin.value


class Skill(Timestamped, Base):
    __tablename__ = "skills"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    canonical_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(120))
    embedding: Mapped[list[float] | None] = mapped_column(Embedding)
    aliases: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)


class Evidence(Base):
    __tablename__ = "evidence"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    evidence_type: Mapped[EvidenceType] = mapped_column(Enum(EvidenceType), nullable=False)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    external_url: Mapped[str | None] = mapped_column(String(2048))
    raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(Json)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    extraction_status: Mapped[ExtractionStatus] = mapped_column(Enum(ExtractionStatus), default=ExtractionStatus.pending_extraction)
    student: Mapped[Student] = relationship(back_populates="evidence")
    extracted_skills: Mapped[list["StudentSkill"]] = relationship(back_populates="source_evidence", cascade="all, delete-orphan")
    extraction_job: Mapped["ExtractionJob | None"] = relationship(back_populates="evidence", cascade="all, delete-orphan", uselist=False)


class ExtractionJob(Base):
    __tablename__ = "extraction_jobs"
    __table_args__ = (
        UniqueConstraint("evidence_id", name="uq_extraction_job_evidence"),
        UniqueConstraint("idempotency_key", name="uq_extraction_job_idempotency_key"),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    evidence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[ExtractionJobStatus] = mapped_column(Enum(ExtractionJobStatus), default=ExtractionJobStatus.pending, nullable=False, index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    last_error: Mapped[str | None] = mapped_column(String(240))
    user_message: Mapped[str | None] = mapped_column(String(240))
    provider: Mapped[str | None] = mapped_column(String(32))
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    queued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    evidence: Mapped[Evidence] = relationship(back_populates="extraction_job")


class StudentSkill(Timestamped, Base):
    __tablename__ = "student_skills"
    __table_args__ = (UniqueConstraint("student_id", "skill_id", "source_evidence_id", name="uq_student_skill_evidence"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"), index=True)
    source_evidence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False, index=True)
    extraction_confidence: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    verification_tier: Mapped[VerificationTier] = mapped_column(Enum(VerificationTier), default=VerificationTier.unverified, nullable=False)
    proficiency_hint: Mapped[str | None] = mapped_column(String(32))
    evidence_span: Mapped[str] = mapped_column(String(500), nullable=False)
    source_evidence: Mapped[Evidence] = relationship(back_populates="extracted_skills")
    skill: Mapped[Skill] = relationship()


class VerificationCheck(Base):
    __tablename__ = "verification_checks"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    evidence_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("evidence.id", ondelete="CASCADE"), index=True)
    check_type: Mapped[str] = mapped_column(String(80))
    result: Mapped[str] = mapped_column(String(32))
    details: Mapped[dict[str, Any] | None] = mapped_column(Json)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Internship(Timestamped, Base):
    __tablename__ = "internships"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    recruiter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recruiters.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list[float] | None] = mapped_column(Embedding)
    recruiter: Mapped[Recruiter] = relationship(back_populates="internships")
    requirements: Mapped[list["InternshipRequirement"]] = relationship(back_populates="internship", cascade="all, delete-orphan")


class InternshipRequirement(Base):
    __tablename__ = "internship_requirements"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    internship_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internships.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"), index=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(3, 2), default=1.0, nullable=False)
    internship: Mapped[Internship] = relationship(back_populates="requirements")
    skill: Mapped[Skill] = relationship()


class Match(Timestamped, Base):
    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("student_id", "internship_id", "score_version", name="uq_match_score_version"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    internship_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internships.id", ondelete="CASCADE"), index=True)
    deterministic_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    semantic_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    verification_bonus: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    final_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False, index=True)
    score_version: Mapped[str] = mapped_column(String(32), default="v1", nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    explanations: Mapped[list["MatchExplanation"]] = relationship(back_populates="match", cascade="all, delete-orphan")


class MatchExplanation(Base):
    __tablename__ = "match_explanations"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"), index=True)
    status: Mapped[str] = mapped_column(String(40))
    contribution: Mapped[float] = mapped_column(Numeric(6, 5), nullable=False)
    contributing_evidence_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("evidence.id"))
    match: Mapped[Match] = relationship(back_populates="explanations")
    skill: Mapped[Skill] = relationship()
    evidence: Mapped[Evidence | None] = relationship()


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    details: Mapped[dict[str, Any] | None] = mapped_column(Json)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
