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
    academician = "academician"
    institution = "institution"


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


class LinkedInParseStatus(str, enum.Enum):
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


class DiscoveryRunStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    partial = "partial"
    failed = "failed"


class AutomationPolicy(Base):
    __tablename__ = "automation_policies"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    minimum_match_score: Mapped[float] = mapped_column(Numeric(5, 4), default=0.2, nullable=False)
    allowed_providers: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    allowed_locations: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    remote_preference: Mapped[bool | None] = mapped_column(Boolean)
    employment_types: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    experience_levels: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    required_skills_any: Mapped[list[uuid.UUID]] = mapped_column(Json, default=list, nullable=False)
    required_skills_all: Mapped[list[uuid.UUID]] = mapped_column(Json, default=list, nullable=False)
    excluded_skills: Mapped[list[uuid.UUID]] = mapped_column(Json, default=list, nullable=False)
    excluded_companies: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    excluded_keywords: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    maximum_jobs_per_run: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    maximum_review_intents_per_run: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    maximum_review_intents_per_day: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    maximum_pending_review_queue_size: Mapped[int] = mapped_column(Integer, default=25, nullable=False)
    auto_create_review_intent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


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
    career_goals: Mapped[dict[str, Any] | None] = mapped_column(Json)
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


class Academician(Timestamped, Base):
    __tablename__ = "academicians"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(200))
    institution_name: Mapped[str] = mapped_column(String(255))
    department: Mapped[str] = mapped_column(String(120))
    designation: Mapped[str] = mapped_column(String(120))
    research_areas: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text)
    years_experience: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    technical_skills: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    certifications: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    publications: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    patents: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    past_industry_experience: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    completed_fdps: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    completed_trainings: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    collaboration_availability: Mapped[str] = mapped_column(String(64), default="available", nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    linkedin_url: Mapped[str | None] = mapped_column(String(512))
    google_scholar_url: Mapped[str | None] = mapped_column(String(512))
    role = Role.academician.value


class Institution(Timestamped, Base):
    __tablename__ = "institutions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    institution_name: Mapped[str] = mapped_column(String(255))
    institution_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    state: Mapped[str | None] = mapped_column(String(100))
    departments: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    role = Role.institution.value


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
    linkedin_import_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("linkedin_imports.id", ondelete="SET NULL"), index=True)
    linkedin_category: Mapped[str | None] = mapped_column(String(40))
    linkedin_source_hash: Mapped[str | None] = mapped_column(String(64))
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


class LinkedInImport(Base):
    __tablename__ = "linkedin_imports"
    __table_args__ = (UniqueConstraint("student_id", "checksum", name="uq_linkedin_import_student_checksum"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    parse_status: Mapped[LinkedInParseStatus] = mapped_column(Enum(LinkedInParseStatus), default=LinkedInParseStatus.uploaded, nullable=False, index=True)
    parser_version: Mapped[str] = mapped_column(String(32), nullable=False)
    parsed_data: Mapped[dict[str, Any] | None] = mapped_column(Json)
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


class ExtractionCacheEntry(Base):
    """Student-scoped validated extraction output; never stores raw evidence text."""

    __tablename__ = "extraction_cache_entries"
    __table_args__ = (
        UniqueConstraint(
            "student_id",
            "evidence_type",
            "content_fingerprint",
            "config_fingerprint",
            name="uq_extraction_cache_scope",
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    evidence_type: Mapped[str] = mapped_column(String(40), nullable=False)
    content_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    config_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(Json, nullable=False)
    source_provider: Mapped[str] = mapped_column(String(32), nullable=False)
    source_model: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ExtractionAttempt(Base):
    """Safe per-stage accounting for extraction work and provider calls."""

    __tablename__ = "extraction_attempts"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    extraction_job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("extraction_jobs.id", ondelete="CASCADE"), index=True
    )
    resume_document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("resume_documents.id", ondelete="SET NULL"), index=True
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(32))
    model: Mapped[str | None] = mapped_column(String(120))
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    request_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    error_code: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


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
    opportunity_type: Mapped[str] = mapped_column(String(32), default="internship", nullable=False)  # internship, apprenticeship
    mode: Mapped[str | None] = mapped_column(String(32), default="hybrid")  # remote, onsite, hybrid
    stipend_amount: Mapped[float | None] = mapped_column(Numeric(10, 2))
    duration_weeks: Mapped[int | None] = mapped_column(Integer, default=12)
    location: Mapped[str | None] = mapped_column(String(255))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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


class JobDiscovery(Base):
    __tablename__ = "job_discoveries"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    query: Mapped[str | None] = mapped_column(String(200))
    location: Mapped[str | None] = mapped_column(String(255))
    remote_preference: Mapped[bool | None] = mapped_column(Boolean)
    employment_type: Mapped[str | None] = mapped_column(String(64))
    experience_level: Mapped[str | None] = mapped_column(String(64))
    providers: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    freshness_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    minimum_match_score: Mapped[float] = mapped_column(Numeric(5, 4), default=0.2, nullable=False)
    cadence_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class JobDiscoveryRun(Base):
    __tablename__ = "job_discovery_runs"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    discovery_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_discoveries.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[DiscoveryRunStatus] = mapped_column(Enum(DiscoveryRunStatus), nullable=False, index=True)
    providers_requested: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    provider_results: Mapped[dict[str, Any]] = mapped_column(Json, default=dict, nullable=False)
    jobs_seen: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    jobs_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    jobs_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    recommendations_created: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    recommendations_changed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    safe_error: Mapped[str | None] = mapped_column(String(240))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DiscoveryRecommendation(Base):
    __tablename__ = "discovery_recommendations"
    __table_args__ = (UniqueConstraint("discovery_id", "external_job_id", name="uq_discovery_recommendation_job"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    discovery_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("job_discoveries.id", ondelete="CASCADE"), nullable=False, index=True)
    external_job_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("external_jobs.id"), nullable=False, index=True)
    match_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    first_recommended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_recommended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


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


# =========================================================================
# SIH 26044 Ecosystem Models: Assessments, Learning, Placement, Faculty, Collaboration
# =========================================================================

class Assessment(Timestamped, Base):
    __tablename__ = "assessments"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    canonical_skill_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    skill_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("skills.id"), index=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(32), default="intermediate", nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    passing_score: Mapped[int] = mapped_column(Integer, default=70, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    questions: Mapped[list["AssessmentQuestion"]] = relationship(back_populates="assessment", cascade="all, delete-orphan")


class AssessmentQuestion(Base):
    __tablename__ = "assessment_questions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[str] = mapped_column(String(32), default="mcq", nullable=False)
    options: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    correct_answer: Mapped[str] = mapped_column(String(255), nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    points: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    assessment: Mapped[Assessment] = relationship(back_populates="questions")


class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    assessment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assessments.id"), nullable=False, index=True)
    score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    total_points: Mapped[int] = mapped_column(Integer, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answers: Mapped[dict[str, Any]] = mapped_column(Json, default=dict, nullable=False)
    breakdown: Mapped[dict[str, Any]] = mapped_column(Json, default=dict, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    assessment: Mapped[Assessment] = relationship()


class LearningCourse(Timestamped, Base):
    __tablename__ = "learning_courses"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    recruiter_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("recruiters.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    program_type: Mapped[str] = mapped_column(String(64), default="course", nullable=False)  # course, training_program, bootcamp, certification, workshop, mentorship_program, industry_orientation
    difficulty: Mapped[str] = mapped_column(String(32), default="all_levels", nullable=False)
    duration_hours: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivery_mode: Mapped[str] = mapped_column(String(32), default="online", nullable=False)  # online, hybrid, in_person
    capacity: Mapped[int | None] = mapped_column(Integer)
    certificate_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=4.8, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    skills: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    recruiter: Mapped[Recruiter | None] = relationship()



class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"
    __table_args__ = (UniqueConstraint("student_id", "course_id", name="uq_student_course_enrollment"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("learning_courses.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="enrolled", nullable=False)
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    course: Mapped[LearningCourse] = relationship()


class InternshipEngagement(Timestamped, Base):
    __tablename__ = "internship_engagements"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    internship_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("internships.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    recruiter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recruiters.id", ondelete="CASCADE"), nullable=False, index=True)
    mentor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    mentor_name: Mapped[str | None] = mapped_column(String(120))
    mentor_email: Mapped[str | None] = mapped_column(String(120))
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="applied", nullable=False)  # applied, shortlisted, selected, active, completed, rejected, withdrawn
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    milestones: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    mentor_feedback: Mapped[dict[str, Any] | None] = mapped_column(Json)
    final_rating: Mapped[float | None] = mapped_column(Numeric(3, 2))
    completion_notes: Mapped[str | None] = mapped_column(Text)
    completion_evidence_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("evidence.id", ondelete="SET NULL"))

    internship: Mapped[Internship] = relationship()
    student: Mapped[Student] = relationship()
    recruiter: Mapped[Recruiter] = relationship()
    completion_evidence: Mapped[Evidence | None] = relationship()


class PlacementDrive(Timestamped, Base):
    __tablename__ = "placement_drives"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    recruiter_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("recruiters.id", ondelete="SET NULL"), index=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    role_type: Mapped[str] = mapped_column(String(80), nullable=False)
    ctc_lpa: Mapped[float] = mapped_column(Numeric(6, 2), default=12.0, nullable=False)
    eligible_departments: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    minimum_cgpa: Mapped[float] = mapped_column(Numeric(3, 2), default=7.0, nullable=False)
    passing_year: Mapped[int] = mapped_column(Integer, default=2025, nullable=False)
    drive_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="upcoming", nullable=False)
    required_skills: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)


class PlacementRegistration(Base):
    __tablename__ = "placement_registrations"
    __table_args__ = (UniqueConstraint("student_id", "placement_drive_id", name="uq_student_placement_drive"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    placement_drive_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("placement_drives.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="registered", nullable=False)  # registered, shortlisted, interview_scheduled, interviewed, offered, accepted, rejected, withdrawn
    match_score: Mapped[float] = mapped_column(Numeric(5, 4), default=0.0, nullable=False)
    deterministic_score: Mapped[float] = mapped_column(Numeric(5, 4), default=0.0, nullable=False)
    semantic_score: Mapped[float] = mapped_column(Numeric(5, 4), default=0.0, nullable=False)
    verification_bonus: Mapped[float] = mapped_column(Numeric(5, 4), default=0.0, nullable=False)
    interview_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    interview_notes: Mapped[str | None] = mapped_column(Text)
    offer_details: Mapped[dict[str, Any] | None] = mapped_column(Json)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(255))
    drive: Mapped[PlacementDrive] = relationship()
    student: Mapped[Student] = relationship()


class FacultyOpportunity(Timestamped, Base):
    __tablename__ = "faculty_opportunities"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    opportunity_type: Mapped[str] = mapped_column(String(64), nullable=False)  # fdp, industrial_immersion, industrial_training, faculty_internship, research_grant, consultancy_request
    organization_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str] = mapped_column(String(120), nullable=False)
    stipend_or_grant: Mapped[float | None] = mapped_column(Numeric(12, 2))
    duration_weeks: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)
    objectives: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    mode: Mapped[str] = mapped_column(String(32), default="hybrid", nullable=False)  # remote, on_site, hybrid
    location: Mapped[str | None] = mapped_column(String(255))
    eligibility: Mapped[str | None] = mapped_column(Text)
    required_expertise: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    deliverables: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    required_documents: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    contact_email: Mapped[str | None] = mapped_column(String(320))
    contact_person: Mapped[str | None] = mapped_column(String(200))
    created_by_recruiter_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("recruiters.id", ondelete="SET NULL"), index=True)


class FacultyApplication(Base):
    __tablename__ = "faculty_applications"
    __table_args__ = (UniqueConstraint("faculty_id", "opportunity_id", name="uq_faculty_opportunity_app"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    faculty_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academicians.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("faculty_opportunities.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="submitted", nullable=False)  # draft, submitted, under_review, shortlisted, discussion, accepted, rejected, withdrawn, active, completed
    application_type: Mapped[str] = mapped_column(String(64), default="general", nullable=False)
    proposal_title: Mapped[str | None] = mapped_column(String(255))
    proposal_text: Mapped[str | None] = mapped_column(Text)
    problem_statement: Mapped[str | None] = mapped_column(Text)
    objectives: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    methodology: Mapped[str | None] = mapped_column(Text)
    team_members: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    student_researchers: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    deliverables: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    milestones: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    timeline_weeks: Mapped[int | None] = mapped_column(Integer)
    budget_requested: Mapped[float | None] = mapped_column(Numeric(12, 2))
    industry_support_required: Mapped[str | None] = mapped_column(Text)
    attachments: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    reviewer_notes: Mapped[str | None] = mapped_column(Text)
    feedback: Mapped[str | None] = mapped_column(Text)
    industry_mentor_name: Mapped[str | None] = mapped_column(String(200))
    industry_mentor_email: Mapped[str | None] = mapped_column(String(320))
    engagement_status: Mapped[str] = mapped_column(String(32), default="not_started", nullable=False)  # not_started, active, completed, cancelled
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completion_report: Mapped[str | None] = mapped_column(Text)
    completion_certificate_url: Mapped[str | None] = mapped_column(String(2048))
    rating_or_grade: Mapped[str | None] = mapped_column(String(32))
    outcome_type: Mapped[str | None] = mapped_column(String(64))  # publication, patent, prototype, report, curriculum_update, certificate
    outcome_details: Mapped[dict[str, Any]] = mapped_column(Json, default=dict, nullable=False)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    opportunity: Mapped[FacultyOpportunity] = relationship()
    faculty: Mapped[Academician] = relationship()


class CollaborationWorkspace(Base):
    __tablename__ = "collaboration_workspaces"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("faculty_applications.id", ondelete="SET NULL"), index=True)
    challenge_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("innovation_challenges.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    collaboration_type: Mapped[str] = mapped_column(String(64), nullable=False)  # research_collaboration, consultancy, faculty_internship, industrial_training, live_project, fdp
    organization_name: Mapped[str] = mapped_column(String(255), nullable=False)
    faculty_lead_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academicians.id", ondelete="CASCADE"), nullable=False, index=True)
    industry_lead_name: Mapped[str] = mapped_column(String(200), nullable=False)
    industry_lead_email: Mapped[str | None] = mapped_column(String(320))
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)  # active, completed, paused, cancelled
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    objectives: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    participants: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    milestones: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    tasks: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    meetings: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    discussion_posts: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    deliverables: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    feedback: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    outcome_summary: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    faculty_lead: Mapped[Academician] = relationship()
    application: Mapped[FacultyApplication | None] = relationship()


class FacultyEventRegistration(Base):
    __tablename__ = "faculty_event_registrations"
    __table_args__ = (UniqueConstraint("faculty_id", "event_id", "event_type", name="uq_faculty_event_reg"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    faculty_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academicians.id", ondelete="CASCADE"), nullable=False, index=True)
    event_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), default="workshop", nullable=False)  # workshop, guest_lecture, mentorship, fdp, challenge
    event_title: Mapped[str] = mapped_column(String(255), nullable=False)
    host_organization: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="attendee", nullable=False)  # attendee, speaker, coordinator
    status: Mapped[str] = mapped_column(String(32), default="registered", nullable=False)  # registered, attended, completed, cancelled
    feedback: Mapped[str | None] = mapped_column(Text)
    certificate_url: Mapped[str | None] = mapped_column(String(2048))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    faculty: Mapped[Academician] = relationship()


class FacultyNotification(Base):
    __tablename__ = "faculty_notifications"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    faculty_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("academicians.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(64), default="application", nullable=False)  # application, workspace, milestone, mentorship, event
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    link_url: Mapped[str | None] = mapped_column(String(1024))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    faculty: Mapped[Academician] = relationship()


class MentorshipSession(Timestamped, Base):
    __tablename__ = "mentorship_sessions"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    mentor_name: Mapped[str] = mapped_column(String(200), nullable=False)
    mentor_company: Mapped[str] = mapped_column(String(200), nullable=False)
    mentor_role: Mapped[str] = mapped_column(String(120), nullable=False)
    domain: Mapped[str] = mapped_column(String(120), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=45, nullable=False)
    meeting_link: Mapped[str | None] = mapped_column(String(2048))
    max_participants: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)


class InnovationChallenge(Timestamped, Base):
    __tablename__ = "innovation_challenges"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    challenge_type: Mapped[str] = mapped_column(String(64), default="hackathon", nullable=False)  # hackathon, live_industry_project, workshop, guest_lecture, research_collaboration
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    host_company: Mapped[str] = mapped_column(String(255), nullable=False)
    problem_statement: Mapped[str] = mapped_column(Text, nullable=False)
    prize_pool: Mapped[str] = mapped_column(String(100), default="₹1,00,000", nullable=False)
    team_size: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    duration_weeks: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    mentor_name: Mapped[str | None] = mapped_column(String(120))
    deliverables: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    milestones: Mapped[list[dict[str, Any]]] = mapped_column(Json, default=list, nullable=False)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    tags: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)


class ProjectApplication(Base):
    __tablename__ = "project_applications"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    challenge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("innovation_challenges.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    team_members: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="applied", nullable=False)  # applied, selected, in_progress, submitted, completed, rejected
    submission_url: Mapped[str | None] = mapped_column(String(2048))
    submission_notes: Mapped[str | None] = mapped_column(Text)
    feedback: Mapped[str | None] = mapped_column(Text)
    score_or_grade: Mapped[str | None] = mapped_column(String(32))
    completion_evidence_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("evidence.id", ondelete="SET NULL"))
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    challenge: Mapped[InnovationChallenge] = relationship()
    student: Mapped[Student] = relationship()
    completion_evidence: Mapped[Evidence | None] = relationship()


class UserDocument(Timestamped, Base):
    __tablename__ = "user_documents"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    user_role: Mapped[str] = mapped_column(String(32), default="student", nullable=False)
    document_type: Mapped[str] = mapped_column(String(64), nullable=False)  # resume, certificate, academic_record, internship_report, offer_letter, internship_completion_certificate, fdp_certificate, research_document, achievement_proof
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), default="application/pdf", nullable=False)
    file_url: Mapped[str | None] = mapped_column(String(2048))
    verification_status: Mapped[str] = mapped_column(String(32), default="uploaded", nullable=False)  # uploaded, verified, rejected, pending_review
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    metadata_payload: Mapped[dict[str, Any]] = mapped_column(Json, default=dict, nullable=False)


class StudentAchievement(Timestamped, Base):
    __tablename__ = "student_achievements"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    achievement_type: Mapped[str] = mapped_column(String(64), nullable=False)  # hackathon, competition, award, publication, leadership, extracurricular
    issuer_organization: Mapped[str] = mapped_column(String(255), nullable=False)
    issue_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    proof_url: Mapped[str | None] = mapped_column(String(2048))
    verification_status: Mapped[str] = mapped_column(String(32), default="self_reported", nullable=False)  # self_reported, verified, endorsed
    evidence_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("evidence.id", ondelete="SET NULL"))

    student: Mapped[Student] = relationship()
    evidence: Mapped[Evidence | None] = relationship()


class InstitutionInterventionPlan(Timestamped, Base):
    __tablename__ = "institution_intervention_plans"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    skill_cluster: Mapped[str] = mapped_column(String(120), nullable=False)
    department: Mapped[str] = mapped_column(String(120), default="All", nullable=False)
    target_students_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    baseline_supply_index: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    target_supply_index: Mapped[float] = mapped_column(Numeric(5, 2), default=80.0, nullable=False)
    selected_learning_programs: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    selected_workshops: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    selected_mentorship: Mapped[list[str]] = mapped_column(Json, default=list, nullable=False)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    target_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)  # draft, planned, in_progress, completed, measured
    notes: Mapped[str | None] = mapped_column(Text)


class InstitutionActionPlan(Timestamped, Base):
    __tablename__ = "institution_action_plans"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("institutions.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)  # curriculum, workshop, placement_prep, faculty_immersion, mentorship_drive, skill_intervention
    related_department: Mapped[str] = mapped_column(String(120), default="All", nullable=False)
    source_insight: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(32), default="medium", nullable=False)  # critical, high, medium, low
    owner: Mapped[str] = mapped_column(String(120), default="Dean of Academics", nullable=False)
    target_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(32), default="planned", nullable=False)  # planned, in_progress, completed, measured
    linked_intervention_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("institution_intervention_plans.id", ondelete="SET NULL"))
    outcome_notes: Mapped[str | None] = mapped_column(Text)



