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


class ResumeParseStatus(str, enum.Enum):
    uploaded = "uploaded"
    parsing = "parsing"
    parsed = "parsed"
    evidence_created = "evidence_created"
    processing_skills = "processing_skills"
    completed = "completed"
    failed = "failed"
    unsupported = "unsupported"


class VerificationTier(str, enum.Enum):
    verified = "verified"
    partially_verified = "partially_verified"
    unverified = "unverified"


class ApplicationStatus(str, enum.Enum):
    approval_pending = "approval_pending"
    approved = "approved"
    preparing = "preparing"
    needs_input = "needs_input"
    prepared = "prepared"
    ready_to_submit = "ready_to_submit"
    submitting = "submitting"
    submitted = "submitted"
    failed = "failed"
    unknown_submission_state = "unknown_submission_state"
    manual_apply = "manual_apply"
    withdrawn = "withdrawn"


class SubmissionAttemptStatus(str, enum.Enum):
    submitting = "submitting"
    submitted = "submitted"
    retryable_failure = "retryable_failure"
    failed = "failed"
    unknown_submission_state = "unknown_submission_state"


class ApplicationTrackingStatus(str, enum.Enum):
    submitted = "submitted"
    received = "received"
    in_review = "in_review"
    rejected = "rejected"
    interview = "interview"
    offer = "offer"
    hired = "hired"
    withdrawn = "withdrawn"
    unknown = "unknown"


class ApplicationStatusSource(str, enum.Enum):
    system = "system"
    provider = "provider"
    user = "user"
    admin = "admin"


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


class AccountEmail(Timestamped, Base):
    """Global account-email registry used to enforce cross-role uniqueness."""

    __tablename__ = "account_emails"
    email: Mapped[str] = mapped_column(String(320), primary_key=True)
    account_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False)


class Skill(Timestamped, Base):
    __tablename__ = "skills"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    canonical_name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(120))
    embedding: Mapped[list[float] | None] = mapped_column(Embedding)
    embedding_provider: Mapped[str | None] = mapped_column(String(32))
    embedding_model: Mapped[str | None] = mapped_column(String(80))
    embedding_dimension: Mapped[int | None] = mapped_column(Integer)
    embedding_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    embedding_fingerprint: Mapped[str | None] = mapped_column(String(64), index=True)
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
    resume_document_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("resume_documents.id"), index=True)
    resume_section: Mapped[str | None] = mapped_column(String(40))
    resume_source_hash: Mapped[str | None] = mapped_column(String(64))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    extraction_status: Mapped[ExtractionStatus] = mapped_column(Enum(ExtractionStatus), default=ExtractionStatus.pending_extraction)
    student: Mapped[Student] = relationship(back_populates="evidence")
    extracted_skills: Mapped[list["StudentSkill"]] = relationship(back_populates="source_evidence", cascade="all, delete-orphan")
    extraction_job: Mapped["ExtractionJob | None"] = relationship(back_populates="evidence", cascade="all, delete-orphan", uselist=False)


class ResumeDocument(Base):
    __tablename__ = "resume_documents"
    __table_args__ = (UniqueConstraint("student_id", "checksum", name="uq_resume_document_student_checksum"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    parse_status: Mapped[ResumeParseStatus] = mapped_column(Enum(ResumeParseStatus), default=ResumeParseStatus.uploaded, nullable=False, index=True)
    parser_version: Mapped[str] = mapped_column(String(32), nullable=False)
    parsed_data: Mapped[dict[str, Any] | None] = mapped_column(Json)
    extracted_text: Mapped[str | None] = mapped_column(Text)
    safe_error_message: Mapped[str | None] = mapped_column(String(240))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    parsed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)


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


class ExternalJob(Base):
    """Provider-neutral, persisted representation of a public job posting."""

    __tablename__ = "external_jobs"
    __table_args__ = (UniqueConstraint("provider", "external_id", name="uq_external_job_provider_external_id"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    provider_source: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(160), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    remote_status: Mapped[str | None] = mapped_column(String(32))
    employment_type: Mapped[str | None] = mapped_column(String(64))
    experience_level: Mapped[str | None] = mapped_column(String(64))
    salary_min: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_max: Mapped[float | None] = mapped_column(Numeric(12, 2))
    salary_currency: Mapped[str | None] = mapped_column(String(8))
    apply_url: Mapped[str | None] = mapped_column(String(2048))
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    raw_metadata: Mapped[dict[str, Any] | None] = mapped_column(Json)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    requirements: Mapped[list["ExternalJobRequirement"]] = relationship(back_populates="external_job", cascade="all, delete-orphan")


class ExternalJobRequirement(Base):
    __tablename__ = "external_job_requirements"
    __table_args__ = (UniqueConstraint("external_job_id", "skill_id", name="uq_external_job_requirement_skill"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    external_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("external_jobs.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"), index=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    weight: Mapped[float] = mapped_column(Numeric(3, 2), default=1.0, nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(4, 3), nullable=False)
    source_span: Mapped[str] = mapped_column(String(500), nullable=False)
    external_job: Mapped[ExternalJob] = relationship(back_populates="requirements")
    skill: Mapped[Skill] = relationship()


class ExternalJobMatch(Timestamped, Base):
    """Persisted student-to-external-job score using the shared deterministic formula."""

    __tablename__ = "external_job_matches"
    __table_args__ = (UniqueConstraint("student_id", "external_job_id", name="uq_external_job_match_student_job"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True)
    external_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("external_jobs.id", ondelete="CASCADE"), index=True)
    deterministic_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    semantic_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    verification_bonus: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    final_score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False, index=True)
    score_version: Mapped[str] = mapped_column(String(32), nullable=False)
    input_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    explanations: Mapped[list["ExternalJobMatchExplanation"]] = relationship(back_populates="match", cascade="all, delete-orphan")


class ExternalJobMatchExplanation(Base):
    __tablename__ = "external_job_match_explanations"
    __table_args__ = (UniqueConstraint("external_job_match_id", "skill_id", name="uq_external_job_match_explanation_skill"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    external_job_match_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("external_job_matches.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"), index=True)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False)
    contribution: Mapped[float] = mapped_column(Numeric(6, 5), nullable=False)
    deterministic_contribution: Mapped[float] = mapped_column(Numeric(6, 5), nullable=False)
    semantic_contribution: Mapped[float] = mapped_column(Numeric(6, 5), nullable=False)
    verification_contribution: Mapped[float] = mapped_column(Numeric(6, 5), nullable=False)
    matched_skill_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("skills.id"))
    semantic_similarity: Mapped[float | None] = mapped_column(Numeric(5, 4))
    contributing_evidence_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("evidence.id", ondelete="SET NULL"))
    extraction_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3))
    verification_tier: Mapped[VerificationTier | None] = mapped_column(Enum(VerificationTier))
    match: Mapped[ExternalJobMatch] = relationship(back_populates="explanations")
    skill: Mapped[Skill] = relationship(foreign_keys=[skill_id])
    matched_skill: Mapped[Skill | None] = relationship(foreign_keys=[matched_skill_id])
    evidence: Mapped[Evidence | None] = relationship()


class Application(Base):
    """Student-owned application intent, preparation state, and provider submission outcome."""

    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("student_id", "external_job_id", name="uq_application_student_external_job"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    external_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("external_jobs.id"), nullable=False, index=True)
    external_job_match_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("external_job_matches.id"), nullable=False, index=True)
    resume_document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resume_documents.id"), nullable=False, index=True)
    status: Mapped[ApplicationStatus] = mapped_column(Enum(ApplicationStatus), default=ApplicationStatus.approval_pending, nullable=False, index=True)
    application_snapshot: Mapped[dict[str, Any]] = mapped_column(Json, nullable=False)
    application_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    approved_fingerprint: Mapped[str | None] = mapped_column(String(64))
    provider_capabilities: Mapped[dict[str, bool]] = mapped_column(Json, nullable=False)
    provider_schema_version: Mapped[str | None] = mapped_column(String(64))
    execution_payload_fingerprint: Mapped[str | None] = mapped_column(String(64), index=True)
    ready_payload_fingerprint: Mapped[str | None] = mapped_column(String(64))
    manual_apply_url: Mapped[str | None] = mapped_column(String(2048))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approval_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    prepared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    withdrawn_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    external_application_id: Mapped[str | None] = mapped_column(String(255))
    failure_reason: Mapped[str | None] = mapped_column(String(240))
    tracking_status: Mapped[ApplicationTrackingStatus | None] = mapped_column(Enum(ApplicationTrackingStatus), index=True)
    tracking_status_source: Mapped[ApplicationStatusSource | None] = mapped_column(Enum(ApplicationStatusSource))
    tracking_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ApplicationField(Base):
    """Normalized provider-form field; sensitive answers are persisted but never returned or audited."""

    __tablename__ = "application_fields"
    __table_args__ = (UniqueConstraint("application_id", "field_id", name="uq_application_field_id"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    field_id: Mapped[str] = mapped_column(String(120), nullable=False)
    provider_field_id: Mapped[str | None] = mapped_column(String(160))
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[str] = mapped_column(String(32), nullable=False)
    required: Mapped[bool] = mapped_column(Boolean, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    allowed_values: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    sensitive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    answer: Mapped[Any | None] = mapped_column(Json)
    answer_source: Mapped[str | None] = mapped_column(String(32))
    requires_user_input: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class ApplicationSubmissionAttempt(Base):
    __tablename__ = "application_submission_attempts"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_application_submission_idempotency_key"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    payload_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[SubmissionAttemptStatus] = mapped_column(Enum(SubmissionAttemptStatus), nullable=False, index=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    provider_response_id: Mapped[str | None] = mapped_column(String(255))
    result_type: Mapped[str | None] = mapped_column(String(64))
    safe_error: Mapped[str | None] = mapped_column(String(240))


class ApplicationStatusEvent(Base):
    """Append-only, non-sensitive application tracking timeline."""

    __tablename__ = "application_status_events"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[ApplicationTrackingStatus | None] = mapped_column(Enum(ApplicationTrackingStatus), index=True)
    source: Mapped[ApplicationStatusSource] = mapped_column(Enum(ApplicationStatusSource), nullable=False)
    provider_status: Mapped[str | None] = mapped_column(String(80))
    safe_metadata: Mapped[dict[str, Any]] = mapped_column(Json, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


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
    input_fingerprint: Mapped[str] = mapped_column(String(64), default="legacy", nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    explanations: Mapped[list["MatchExplanation"]] = relationship(back_populates="match", cascade="all, delete-orphan")


class MatchExplanation(Base):
    __tablename__ = "match_explanations"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), index=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"), index=True)
    status: Mapped[str] = mapped_column(String(40))
    contribution: Mapped[float] = mapped_column(Numeric(6, 5), nullable=False)
    deterministic_contribution: Mapped[float] = mapped_column(Numeric(6, 5), default=0.0, nullable=False)
    semantic_contribution: Mapped[float] = mapped_column(Numeric(6, 5), default=0.0, nullable=False)
    verification_contribution: Mapped[float] = mapped_column(Numeric(6, 5), default=0.0, nullable=False)
    matched_skill_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("skills.id"))
    semantic_similarity: Mapped[float | None] = mapped_column(Numeric(5, 4))
    contributing_evidence_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("evidence.id", ondelete="SET NULL"))
    match: Mapped[Match] = relationship(back_populates="explanations")
    skill: Mapped[Skill] = relationship(foreign_keys=[skill_id])
    matched_skill: Mapped[Skill | None] = relationship(foreign_keys=[matched_skill_id])
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
