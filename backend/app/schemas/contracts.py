from datetime import datetime
from typing import Any, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(APIModel):
    access_token: str
    token_type: str = "bearer"
    role: Literal["student", "recruiter", "admin", "academician", "institution"]


import re

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

TYPO_DOMAINS = {
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gmaul.com": "gmail.com",
    "gamil.co": "gmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yhaoo.com": "yahoo.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "outlok.com": "outlook.com",
    "outloo.com": "outlook.com",
    "icoud.com": "icloud.com",
}


def _validate_email_field(value: str) -> str:
    if not isinstance(value, str):
        raise ValueError("Not a valid email ID. Email must be a string.")
    normalized = value.strip().casefold()
    if not EMAIL_REGEX.match(normalized):
        raise ValueError("Not a valid email ID. Please check the email format (e.g. name@domain.com).")
    parts = normalized.split("@")
    if len(parts) != 2:
        raise ValueError("Not a valid email ID. Must contain username and domain.")
    user, domain = parts
    if domain in TYPO_DOMAINS:
        raise ValueError(f"Not a valid email ID. Did you mean @{TYPO_DOMAINS[domain]}?")
    if ".." in user or ".." in domain or domain.startswith(".") or domain.endswith("."):
        raise ValueError("Not a valid email ID.")
    domain_parts = domain.split(".")
    if len(domain_parts) < 2 or any(len(p) == 0 for p in domain_parts):
        raise ValueError("Not a valid email ID. Domain must contain a valid extension (e.g., .com, .edu).")
    tld = domain_parts[-1]
    if len(tld) < 2 or not tld.isalpha():
        raise ValueError("Not a valid email ID. Top-level domain must be valid.")
    return normalized


class StudentRegistration(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    university: str | None = Field(default=None, max_length=255)
    graduation_year: int | None = Field(default=None, ge=2020, le=2100)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_field(v)


class RecruiterRegistration(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    company_name: str = Field(min_length=1, max_length=255)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_field(v)


class LoginRequest(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_field(v)


class GoogleAuthRequest(APIModel):
    credential: str = Field(min_length=10)
    role: Literal["student", "recruiter", "academician", "institution"] = "student"
    company_name: str | None = Field(default=None, max_length=255)


class AcademicianRegistration(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    institution_name: str = Field(min_length=1, max_length=255)
    department: str = Field(min_length=1, max_length=120)
    designation: str = Field(min_length=1, max_length=120)
    research_areas: list[str] = Field(default_factory=list)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_field(v)


class InstitutionRegistration(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)
    institution_name: str = Field(min_length=1, max_length=255)
    institution_code: str = Field(min_length=1, max_length=64)
    state: str | None = Field(default=None, max_length=100)
    departments: list[str] = Field(default_factory=list)

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: str) -> str:
        return _validate_email_field(v)


class EvidenceCreate(APIModel):
    evidence_type: Literal[
        "coursework", "project", "competition", "certification", "micro_credential"
    ]
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=20_000)
    external_url: AnyHttpUrl | None = None


class EvidenceUpdate(APIModel):
    evidence_type: (
        Literal[
            "coursework", "project", "competition", "certification", "micro_credential"
        ]
        | None
    ) = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=20_000)
    external_url: AnyHttpUrl | None = None


class EvidenceResponse(APIModel):
    id: UUID
    evidence_type: str
    title: str
    description: str
    external_url: str | None
    extraction_status: str
    submitted_at: datetime


class ExtractionJobResponse(APIModel):
    status: str
    attempt_count: int
    max_attempts: int
    next_retry_at: datetime | None
    user_message: str | None
    provider: str | None


class ExtractedSkillResponse(APIModel):
    id: UUID
    skill_id: UUID
    canonical_name: str
    extraction_confidence: float
    verification_tier: str
    source_evidence_id: UUID
    evidence_span: str | None = None


class EvidenceDetail(EvidenceResponse):
    extracted_skills: list[ExtractedSkillResponse]
    extraction_job: ExtractionJobResponse | None = None


class CandidateContact(APIModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    github_links: list[str] = Field(default_factory=list)
    portfolio_links: list[str] = Field(default_factory=list)


class EducationEntry(APIModel):
    institution: str
    detail: str
    source_span: str


class ExperienceEntry(APIModel):
    title: str
    description: str
    source_span: str


class ProjectEntry(APIModel):
    title: str
    description: str
    source_span: str


class CertificationEntry(APIModel):
    name: str
    detail: str
    source_span: str


class AchievementEntry(APIModel):
    title: str
    detail: str
    source_span: str


class ResumeParsedData(APIModel):
    contact: CandidateContact = Field(default_factory=CandidateContact)
    education: list[EducationEntry] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    certifications: list[CertificationEntry] = Field(default_factory=list)
    achievements: list[AchievementEntry] = Field(default_factory=list)
    explicit_technical_skills: list[str] = Field(default_factory=list)
    prohibited_attribute_labels: list[str] = Field(default_factory=list)


class ResumeDocumentResponse(APIModel):
    id: UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    checksum: str
    parse_status: str
    parser_version: str
    uploaded_at: datetime
    parsed_at: datetime | None
    is_active: bool
    safe_error_message: str | None
    parsed_summary: ResumeParsedData | None = None
    generated_evidence_count: int = 0
    skills_status: str = "not_started"
    completed_jobs: int = 0
    failed_jobs: int = 0
    pending_jobs: int = 0
    total_jobs: int = 0


class LinkedInCounts(APIModel):
    positions: int = 0
    projects: int = 0
    certifications: int = 0
    skills: int = 0
    education: int = 0
    publications: int = 0
    courses: int = 0
    languages: int = 0


class LinkedInParsedSummary(APIModel):
    counts: LinkedInCounts = Field(default_factory=LinkedInCounts)
    discovered_skills: list[str] = Field(default_factory=list)
    categories_present: list[str] = Field(default_factory=list)
    total_records: int = 0


class LinkedInImportResponse(APIModel):
    id: UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    checksum: str
    parse_status: str
    parser_version: str
    uploaded_at: datetime
    parsed_at: datetime | None
    is_active: bool
    safe_error_message: str | None
    parsed_summary: LinkedInParsedSummary | None = None
    generated_evidence_count: int = 0
    skills_status: str = "not_started"


class VerificationRequest(APIModel):
    # Legacy values remain accepted while every request runs the complete GitHub check suite.
    check_type: Literal[
        "github_repository_accessibility", "github_commit_match", "github_project"
    ] = "github_project"


class VerificationCheckResponse(APIModel):
    check_type: str
    result: Literal["pass", "partial", "fail", "not_applicable"]
    details: dict[str, object]
    checked_at: datetime | None


class VerificationResponse(APIModel):
    result: str
    details: dict[str, object]
    verification_tier: Literal["verified", "partially_verified", "unverified"]
    checks: list[VerificationCheckResponse]


class GitHubIdentityUpdate(APIModel):
    github_username: str = Field(min_length=1, max_length=39)

    @field_validator("github_username", mode="before")
    @classmethod
    def github_username_is_plain_handle(cls, value: str) -> str:
        import re

        if not isinstance(value, str):
            raise ValueError("GitHub username is invalid")
        normalized = value.strip().rstrip("/")
        if "github.com/" in normalized:
            normalized = normalized.split("github.com/")[-1].split("/")[0].strip()
        elif normalized.startswith("@"):
            normalized = normalized.lstrip("@").strip()

        if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})", normalized):
            raise ValueError("GitHub username is invalid. Please provide a valid username like 'itisnik' or 'octocat'.")
        return normalized


class GitHubIdentityResponse(APIModel):
    github_username: str | None
    association_status: Literal["not_linked", "claimed"]
    identity_authenticated: bool = False


class RecruiterEvidenceConsentUpdate(APIModel):
    recruiter_evidence_consent: bool


class RecruiterEvidenceConsentResponse(APIModel):
    recruiter_evidence_consent: bool


class SkillResponse(APIModel):
    id: UUID
    canonical_name: str
    category: str
    aliases: list[str]


class InternshipRequirementCreate(APIModel):
    skill_id: UUID
    is_required: bool = True
    weight: float = Field(default=1.0, gt=0, le=10)


class InternshipRequirementResponse(InternshipRequirementCreate):
    id: UUID


class InternshipCreate(APIModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=20_000)
    requirements: list[InternshipRequirementCreate] = Field(min_length=1, max_length=50)

    @field_validator("requirements")
    @classmethod
    def unique_requirement_skills(
        cls, values: list[InternshipRequirementCreate]
    ) -> list[InternshipRequirementCreate]:
        if len({value.skill_id for value in values}) != len(values):
            raise ValueError("Each skill may appear only once in requirements")
        return values


class InternshipUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=20_000)
    requirements: list[InternshipRequirementCreate] | None = Field(
        default=None, min_length=1, max_length=50
    )

    @field_validator("requirements")
    @classmethod
    def unique_updated_requirement_skills(
        cls, values: list[InternshipRequirementCreate] | None
    ) -> list[InternshipRequirementCreate] | None:
        if values is not None and len({value.skill_id for value in values}) != len(
            values
        ):
            raise ValueError("Each skill may appear only once in requirements")
        return values


class InternshipResponse(APIModel):
    id: UUID
    title: str
    description: str
    recruiter_id: UUID
    created_at: datetime
    requirements: list[InternshipRequirementResponse] = Field(default_factory=list)


class ExternalJobRequirementResponse(APIModel):
    id: UUID
    skill_id: UUID
    skill_name: str
    is_required: bool
    weight: float
    confidence: float
    source_span: str


class ExternalJobResponse(APIModel):
    id: UUID
    provider: str
    provider_source: str
    external_id: str
    title: str
    company_name: str
    description: str
    location: str | None
    remote_status: str | None
    employment_type: str | None
    experience_level: str | None
    salary_min: float | None
    salary_max: float | None
    salary_currency: str | None
    apply_url: str | None
    source_url: str
    posted_at: datetime | None
    expires_at: datetime | None
    first_seen_at: datetime
    last_seen_at: datetime
    last_synced_at: datetime
    is_active: bool
    requirements: list[ExternalJobRequirementResponse] = Field(default_factory=list)


class ExternalJobSyncRequest(APIModel):
    provider: str = Field(min_length=1, max_length=64, pattern="^[a-z0-9_-]+$")
    source_key: str = Field(min_length=1, max_length=120, pattern="^[A-Za-z0-9_-]+$")


class ExternalJobSyncResponse(APIModel):
    provider: str
    provider_source: str
    created: int
    updated: int
    marked_inactive: int
    synced: int
    synced_at: datetime


class ProviderStatusItem(APIModel):
    provider: str
    name: str
    status: str  # "disabled" | "configured" | "fixture" | "degraded" | "live" | "unavailable"
    badge_label: str
    search_supported: bool
    status_tracking_supported: bool
    active_jobs_count: int = 0
    last_synced_at: datetime | None = None
    reason: str | None = None


class ExternalJobSyncAllResponse(APIModel):
    total_created: int
    total_updated: int
    total_synced: int
    providers: dict[str, Any]
    synced_at: datetime


ItemT = TypeVar("ItemT")


class PaginatedResponse(APIModel, Generic[ItemT]):
    page: int
    page_size: int
    total: int
    items: list[ItemT]


class MatchResponse(APIModel):
    id: UUID
    student_id: UUID
    internship_id: UUID
    deterministic_score: float
    semantic_score: float
    verification_bonus: float
    final_score: float
    score_version: str
    internship_title: str | None = None
    candidate_label: str | None = None
    is_stale: bool = False


class ExplanationItem(APIModel):
    skill_id: UUID
    skill_name: str
    is_required: bool = True
    status: str
    contribution: float
    evidence_id: UUID | None
    evidence_title: str | None
    matched_skill_id: UUID | None = None
    matched_skill_name: str | None = None
    semantic_similarity: float | None = None
    deterministic_contribution: float = 0.0
    semantic_contribution: float = 0.0
    verification_contribution: float = 0.0
    total_contribution: float = 0.0
    extraction_confidence: float | None = None
    verification_tier: str | None = None


class ExplanationResponse(APIModel):
    lines: list[str]
    items: list[ExplanationItem]
    deterministic_score: float
    semantic_score: float
    verification_bonus: float
    final_score: float
    score_version: str


class ExternalJobMatchResponse(APIModel):
    id: UUID
    student_id: UUID
    external_job_id: UUID
    title: str
    company_name: str
    provider: str
    external_id: str
    source_url: str
    location: str | None
    remote_status: str | None
    posted_at: datetime | None
    is_active: bool
    deterministic_score: float
    semantic_score: float
    verification_bonus: float
    final_score: float
    score_version: str
    is_stale: bool
    explanation: ExplanationResponse


class ExternalJobMatchStateResponse(APIModel):
    matching_status: Literal[
        "ready", "not_computed", "insufficient_requirements", "inactive"
    ]
    match: ExternalJobMatchResponse | None = None


class ApplicationCreate(APIModel):
    external_job_id: UUID
    external_job_match_id: UUID


class ApplicationResponse(APIModel):
    id: UUID
    student_id: UUID
    external_job_id: UUID
    external_job_match_id: UUID
    resume_document_id: UUID
    status: Literal[
        "approval_pending",
        "approved",
        "preparing",
        "needs_input",
        "prepared",
        "ready_to_submit",
        "submitting",
        "submitted",
        "failed",
        "unknown_submission_state",
        "manual_apply",
        "withdrawn",
    ]
    application_snapshot: dict[str, object]
    application_fingerprint: str
    approved_fingerprint: str | None
    provider_capabilities: dict[str, bool]
    provider_schema_version: str | None
    execution_payload_fingerprint: str | None
    ready_payload_fingerprint: str | None
    manual_apply_url: str | None
    approved_at: datetime | None
    approval_revoked_at: datetime | None
    prepared_at: datetime | None
    ready_at: datetime | None
    submitted_at: datetime | None
    withdrawn_at: datetime | None
    tracking_status: (
        Literal[
            "submitted",
            "received",
            "in_review",
            "rejected",
            "interview",
            "offer",
            "hired",
            "withdrawn",
            "unknown",
        ]
        | None
    )
    tracking_status_source: Literal["system", "provider", "user", "admin"] | None
    tracking_updated_at: datetime | None
    created_at: datetime
    updated_at: datetime
    is_approval_stale: bool = False


class ApplicationFieldResponse(APIModel):
    field_id: str
    label: str
    field_type: str
    required: bool
    category: str
    allowed_values: list[str]
    sensitive: bool
    source: str
    answer: object | None = None
    answer_source: str | None
    requires_user_input: bool
    is_answered: bool


class ApplicationFormResponse(APIModel):
    application_id: UUID
    provider: str
    provider_auto_apply: bool
    provider_schema_version: str | None
    payload_fingerprint: str | None
    unresolved_field_ids: list[str]
    is_assisted: bool
    submission_capability: dict[str, bool | str]
    fields: list[ApplicationFieldResponse]


class ApplicationAnswersUpdate(APIModel):
    answers: dict[str, Any] = Field(min_length=1, max_length=100)


class JobDiscoveryCreate(APIModel):
    name: str = Field(min_length=1, max_length=80)
    enabled: bool = True
    query: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=255)
    remote_preference: bool | None = None
    employment_type: str | None = Field(default=None, max_length=64)
    experience_level: str | None = Field(default=None, max_length=64)
    providers: list[Literal["greenhouse", "lever", "ashby"]] = Field(
        min_length=1, max_length=3
    )
    freshness_days: int = Field(default=30, ge=1, le=90)
    minimum_match_score: float = Field(default=0.2, ge=0.0, le=1.0)
    cadence_hours: Literal[6, 12, 24] = 24


class JobDiscoveryUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    enabled: bool | None = None
    query: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=255)
    remote_preference: bool | None = None
    employment_type: str | None = Field(default=None, max_length=64)
    experience_level: str | None = Field(default=None, max_length=64)
    providers: list[Literal["greenhouse", "lever", "ashby"]] | None = Field(
        default=None, min_length=1, max_length=3
    )
    freshness_days: int | None = Field(default=None, ge=1, le=90)
    minimum_match_score: float | None = Field(default=None, ge=0.0, le=1.0)
    cadence_hours: Literal[6, 12, 24] | None = None


class JobDiscoveryResponse(APIModel):
    id: UUID
    student_id: UUID
    name: str
    enabled: bool
    query: str | None
    location: str | None
    remote_preference: bool | None
    employment_type: str | None
    experience_level: str | None
    providers: list[str]
    freshness_days: int
    minimum_match_score: float
    cadence_hours: int
    last_run_at: datetime | None
    next_run_at: datetime | None
    created_at: datetime
    updated_at: datetime


class JobDiscoveryRunResponse(APIModel):
    id: UUID
    discovery_id: UUID
    status: Literal["queued", "running", "completed", "partial", "failed"]
    providers_requested: list[str]
    provider_results: dict[str, object]
    jobs_seen: int
    jobs_created: int
    jobs_updated: int
    recommendations_created: int
    recommendations_changed: int
    safe_error: str | None
    started_at: datetime
    completed_at: datetime | None


class AutomationPolicyInput(APIModel):
    name: str = Field(min_length=1, max_length=80)
    enabled: bool = False
    priority: int = Field(default=100, ge=0, le=1000)
    minimum_match_score: float = Field(default=0.2, ge=0.0, le=1.0)
    allowed_providers: list[Literal["greenhouse", "lever", "ashby"]] = Field(
        default_factory=list, max_length=3
    )
    allowed_locations: list[str] = Field(default_factory=list, max_length=20)
    remote_preference: bool | None = None
    employment_types: list[str] = Field(default_factory=list, max_length=10)
    experience_levels: list[str] = Field(default_factory=list, max_length=10)
    required_skills_any: list[UUID] = Field(default_factory=list, max_length=30)
    required_skills_all: list[UUID] = Field(default_factory=list, max_length=30)
    excluded_skills: list[UUID] = Field(default_factory=list, max_length=30)
    excluded_companies: list[str] = Field(default_factory=list, max_length=20)
    excluded_keywords: list[str] = Field(default_factory=list, max_length=20)
    maximum_jobs_per_run: int = Field(default=25, ge=1, le=100)
    maximum_review_intents_per_run: int = Field(default=5, ge=0, le=10)
    maximum_review_intents_per_day: int = Field(default=5, ge=0, le=10)
    maximum_pending_review_queue_size: int = Field(default=25, ge=0, le=100)
    auto_create_review_intent: bool = False


class AutomationPolicyUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    enabled: bool | None = None
    priority: int | None = Field(default=None, ge=0, le=1000)
    minimum_match_score: float | None = Field(default=None, ge=0.0, le=1.0)
    allowed_providers: list[Literal["greenhouse", "lever", "ashby"]] | None = Field(
        default=None, max_length=3
    )
    allowed_locations: list[str] | None = Field(default=None, max_length=20)
    remote_preference: bool | None = None
    employment_types: list[str] | None = Field(default=None, max_length=10)
    experience_levels: list[str] | None = Field(default=None, max_length=10)
    required_skills_any: list[UUID] | None = Field(default=None, max_length=30)
    required_skills_all: list[UUID] | None = Field(default=None, max_length=30)
    excluded_skills: list[UUID] | None = Field(default=None, max_length=30)
    excluded_companies: list[str] | None = Field(default=None, max_length=20)
    excluded_keywords: list[str] | None = Field(default=None, max_length=20)
    maximum_jobs_per_run: int | None = Field(default=None, ge=1, le=100)
    maximum_review_intents_per_run: int | None = Field(default=None, ge=0, le=10)
    maximum_review_intents_per_day: int | None = Field(default=None, ge=0, le=10)
    maximum_pending_review_queue_size: int | None = Field(default=None, ge=0, le=100)
    auto_create_review_intent: bool | None = None


class AutomationPolicyResponse(AutomationPolicyInput):
    id: UUID
    student_id: UUID
    last_applied_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AutomationQueueItem(APIModel):
    external_job_id: UUID
    match_id: UUID
    title: str
    company_name: str
    provider: str
    final_score: float
    policy_id: UUID
    policy_name: str
    policy_reason: list[str]
    application_id: UUID | None = None
    application_status: str | None = None
    active_resume_filename: str | None = None
    explanation: ExplanationResponse


class ManualSubmissionRecord(APIModel):
    submitted_at: datetime | None = None
    provider_reference: str | None = Field(
        default=None, max_length=255, pattern=r"^[A-Za-z0-9._:-]+$"
    )


class ApplicationStatusEventResponse(APIModel):
    id: UUID
    application_id: UUID
    event_type: str
    status: (
        Literal[
            "submitted",
            "received",
            "in_review",
            "rejected",
            "interview",
            "offer",
            "hired",
            "withdrawn",
            "unknown",
        ]
        | None
    )
    source: Literal["system", "provider", "user", "admin"]
    provider_status: str | None
    safe_metadata: dict[str, object]
    created_at: datetime


class ApplicationSubmissionAttemptResponse(APIModel):
    id: UUID
    application_id: UUID
    payload_fingerprint: str
    status: Literal[
        "submitting",
        "submitted",
        "retryable_failure",
        "failed",
        "unknown_submission_state",
    ]
    attempt_count: int
    started_at: datetime
    completed_at: datetime | None
    provider_response_id: str | None
    result_type: str | None
    safe_error: str | None


class TeamSuggestionRequest(APIModel):
    target_skill_set: list[str] = Field(min_length=1, max_length=50)
    pool: list[str] = Field(min_length=2, max_length=100)


class TeamSuggestion(APIModel):
    pair: tuple[str, str]
    complementarity_score: float


class PassportResponse(APIModel):
    skills: list[ExtractedSkillResponse]
    evidence: list[EvidenceResponse]


class ProfileEvidenceSupport(APIModel):
    evidence_id: UUID
    title: str
    evidence_type: str
    origin: Literal["manual", "resume", "linkedin_export"]
    verification_tier: Literal["verified", "partially_verified", "unverified"]
    extraction_confidence: float
    effective_confidence: float
    evidence_span: str
    source_types: list[str]
    likely_duplicate_of: UUID | None = None


class ProfileSkill(APIModel):
    skill_id: UUID
    canonical_name: str
    category: str
    supports: list[ProfileEvidenceSupport]
    supporting_evidence_count: int
    independent_evidence_count: int
    source_types: list[str]
    source_diversity: int
    highest_verification_tier: Literal["verified", "partially_verified", "unverified"]
    verification_summary: str
    summary_confidence: float


class ActiveResumeReference(APIModel):
    id: UUID
    original_filename: str
    parse_status: str
    parsed_at: datetime | None


class ActiveLinkedInReference(APIModel):
    id: UUID
    original_filename: str
    parse_status: str
    parsed_at: datetime | None


class ProfileCompleteness(APIModel):
    has_active_resume: bool
    has_linkedin_import: bool = False
    has_project_evidence: bool
    has_verified_evidence: bool
    has_evidence_backed_skills: bool
    has_github_identity: bool


class CandidateProfileResponse(APIModel):
    student_id: UUID
    skills: list[ProfileSkill]
    active_resume: ActiveResumeReference | None
    active_linkedin_import: ActiveLinkedInReference | None = None
    github_identity_status: Literal["not_linked", "claimed"]
    profile_completeness: ProfileCompleteness


class MatchingProfileSkill(APIModel):
    skill_id: UUID
    evidence_id: UUID
    effective_confidence: float
    verification_tier: Literal["verified", "partially_verified", "unverified"]


class MatchingProfileResponse(APIModel):
    """Narrow fairness-safe representation; this is not an API candidate dossier."""

    student_id: UUID
    skills: list[MatchingProfileSkill]


# =========================================================================
# SIH 26044 Ecosystem Contracts: Career Goals, Assessments, Learning, Placement, Faculty, Collaboration, Analytics
# =========================================================================

class CareerGoalsUpdate(APIModel):
    target_roles: list[str] = Field(default_factory=list)
    target_industry: str | None = None
    target_skills: list[str] = Field(default_factory=list)
    target_salary_lpa: float | None = None
    ambition_level: str = "entry_level"


class CareerGoalsResponse(APIModel):
    target_roles: list[str] = Field(default_factory=list)
    target_industry: str | None = None
    target_skills: list[str] = Field(default_factory=list)
    target_salary_lpa: float | None = None
    ambition_level: str = "entry_level"


class SkillGapItem(APIModel):
    skill_name: str
    category: str
    status: Literal["verified", "assessed", "missing", "in_progress"]
    proficiency_score: float  # 0.0 to 1.0
    importance: Literal["critical", "high", "medium", "optional"]
    recommended_action: str


class SkillGapAnalysisResponse(APIModel):
    target_role: str
    overall_readiness_score: float  # 0.0 to 100.0
    matched_skills_count: int
    missing_skills_count: int
    gap_items: list[SkillGapItem]
    top_recommended_courses: list[str]


class AssessmentQuestionResponse(APIModel):
    id: UUID
    question_text: str
    question_type: str
    options: list[str]
    points: int


class AssessmentResponse(APIModel):
    id: UUID
    title: str
    canonical_skill_name: str
    category: str
    difficulty: str
    duration_minutes: int
    passing_score: int
    questions: list[AssessmentQuestionResponse] = Field(default_factory=list)


class AssessmentSummaryResponse(APIModel):
    id: UUID
    title: str
    canonical_skill_name: str
    category: str
    difficulty: str
    duration_minutes: int
    passing_score: int
    question_count: int


class AssessmentSubmitRequest(APIModel):
    answers: dict[str, str]  # question_id -> selected option or answer string


class AssessmentAttemptResponse(APIModel):
    id: UUID
    assessment_id: UUID
    assessment_title: str
    score: float
    total_points: int
    percentage: float
    passed: bool
    breakdown: dict[str, Any] = Field(default_factory=dict)
    completed_at: datetime



class LearningCourseResponse(APIModel):
    id: UUID
    title: str
    provider: str
    category: str
    difficulty: str
    duration_hours: int
    url: str
    rating: float
    description: str
    skills: list[str]
    is_enrolled: bool = False
    progress: int = 0
    recommendation_reason: str | None = None


class CourseEnrollmentResponse(APIModel):
    id: UUID
    course_id: UUID
    course_title: str
    provider: str
    status: str
    progress: int
    enrolled_at: datetime
    completed_at: datetime | None = None


class CourseProgressUpdate(APIModel):
    progress: int = Field(ge=0, le=100)


class PlacementDriveResponse(APIModel):
    id: UUID
    company_name: str
    title: str
    description: str
    role_type: str
    ctc_lpa: float
    eligible_departments: list[str]
    minimum_cgpa: float
    passing_year: int
    drive_date: datetime
    status: str
    required_skills: list[str]
    is_registered: bool = False
    registration_status: str | None = None


class PlacementRegistrationRequest(APIModel):
    placement_drive_id: UUID
    notes: str | None = None


class FacultyPassportResponse(APIModel):
    id: UUID
    email: str
    full_name: str
    institution_name: str
    department: str
    designation: str
    research_areas: list[str] = Field(default_factory=list)
    bio: str | None = None
    years_experience: int = 0
    technical_skills: list[str] = Field(default_factory=list)
    certifications: list[dict[str, Any]] = Field(default_factory=list)
    publications: list[dict[str, Any]] = Field(default_factory=list)
    patents: list[dict[str, Any]] = Field(default_factory=list)
    past_industry_experience: list[dict[str, Any]] = Field(default_factory=list)
    completed_fdps: list[dict[str, Any]] = Field(default_factory=list)
    completed_trainings: list[dict[str, Any]] = Field(default_factory=list)
    collaboration_availability: str = "available"
    phone: str | None = None
    linkedin_url: str | None = None
    google_scholar_url: str | None = None
    active_collaborations_count: int = 0
    completed_collaborations_count: int = 0
    total_grants_secured: float = 0.0


class FacultyPassportUpdateRequest(APIModel):
    full_name: str | None = None
    institution_name: str | None = None
    department: str | None = None
    designation: str | None = None
    research_areas: list[str] | None = None
    bio: str | None = None
    years_experience: int | None = None
    technical_skills: list[str] | None = None
    certifications: list[dict[str, Any]] | None = None
    publications: list[dict[str, Any]] | None = None
    patents: list[dict[str, Any]] | None = None
    past_industry_experience: list[dict[str, Any]] | None = None
    completed_fdps: list[dict[str, Any]] | None = None
    completed_trainings: list[dict[str, Any]] | None = None
    collaboration_availability: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    google_scholar_url: str | None = None


class FacultyOpportunityResponse(APIModel):
    id: UUID
    title: str
    opportunity_type: str
    organization_name: str
    description: str
    domain: str
    stipend_or_grant: float | None = None
    duration_weeks: int
    deadline: datetime | None = None
    status: str
    objectives: list[str] = Field(default_factory=list)
    mode: str = "hybrid"
    location: str | None = None
    eligibility: str | None = None
    required_expertise: list[str] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    required_documents: list[str] = Field(default_factory=list)
    contact_email: str | None = None
    contact_person: str | None = None
    has_applied: bool = False
    application_status: str | None = None
    application_id: UUID | None = None


class FacultyApplicationRequest(APIModel):
    opportunity_id: UUID
    proposal_text: str = Field(default="", min_length=0)
    proposal_title: str | None = None
    application_type: str = "general"
    problem_statement: str | None = None
    objectives: list[str] = Field(default_factory=list)
    methodology: str | None = None
    team_members: list[dict[str, Any]] = Field(default_factory=list)
    student_researchers: list[dict[str, Any]] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    milestones: list[dict[str, Any]] = Field(default_factory=list)
    timeline_weeks: int | None = None
    budget_requested: float | None = None
    industry_support_required: str | None = None
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    is_draft: bool = False


class FacultyApplicationUpdateRequest(APIModel):
    proposal_title: str | None = None
    proposal_text: str | None = None
    problem_statement: str | None = None
    objectives: list[str] | None = None
    methodology: str | None = None
    team_members: list[dict[str, Any]] | None = None
    student_researchers: list[dict[str, Any]] | None = None
    deliverables: list[str] | None = None
    milestones: list[dict[str, Any]] | None = None
    timeline_weeks: int | None = None
    budget_requested: float | None = None
    industry_support_required: str | None = None
    attachments: list[dict[str, Any]] | None = None
    status: str | None = None
    completion_report: str | None = None


class FacultyApplicationResponse(APIModel):
    id: UUID
    opportunity_id: UUID
    opportunity_title: str
    organization_name: str
    opportunity_type: str
    status: str
    application_type: str = "general"
    proposal_title: str | None = None
    proposal_text: str | None = None
    problem_statement: str | None = None
    objectives: list[str] = Field(default_factory=list)
    methodology: str | None = None
    team_members: list[dict[str, Any]] = Field(default_factory=list)
    student_researchers: list[dict[str, Any]] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    milestones: list[dict[str, Any]] = Field(default_factory=list)
    timeline_weeks: int | None = None
    budget_requested: float | None = None
    industry_support_required: str | None = None
    attachments: list[dict[str, Any]] = Field(default_factory=list)
    reviewer_notes: str | None = None
    feedback: str | None = None
    industry_mentor_name: str | None = None
    industry_mentor_email: str | None = None
    engagement_status: str = "not_started"
    start_date: datetime | None = None
    end_date: datetime | None = None
    completion_report: str | None = None
    completion_certificate_url: str | None = None
    rating_or_grade: str | None = None
    outcome_type: str | None = None
    outcome_details: dict[str, Any] = Field(default_factory=dict)
    applied_at: datetime
    updated_at: datetime | None = None
    workspace_id: UUID | None = None
    faculty_name: str | None = None
    faculty_department: str | None = None
    faculty_institution: str | None = None


class FacultyApplicationStatusUpdateRequest(APIModel):
    status: str
    reviewer_notes: str | None = None
    feedback: str | None = None
    industry_mentor_name: str | None = None
    industry_mentor_email: str | None = None


class CollaborationWorkspaceResponse(APIModel):
    id: UUID
    application_id: UUID | None = None
    challenge_id: UUID | None = None
    title: str
    collaboration_type: str
    organization_name: str
    faculty_lead_id: UUID
    faculty_lead_name: str | None = None
    faculty_lead_department: str | None = None
    industry_lead_name: str
    industry_lead_email: str | None = None
    status: str
    progress_percentage: int = 0
    objectives: list[str] = Field(default_factory=list)
    participants: list[dict[str, Any]] = Field(default_factory=list)
    milestones: list[dict[str, Any]] = Field(default_factory=list)
    tasks: list[dict[str, Any]] = Field(default_factory=list)
    meetings: list[dict[str, Any]] = Field(default_factory=list)
    discussion_posts: list[dict[str, Any]] = Field(default_factory=list)
    deliverables: list[dict[str, Any]] = Field(default_factory=list)
    feedback: list[dict[str, Any]] = Field(default_factory=list)
    outcome_summary: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    created_at: datetime
    updated_at: datetime


class WorkspaceMilestoneUpdate(APIModel):
    milestone_id: str
    title: str | None = None
    status: str  # pending, in_progress, completed
    due_date: str | None = None
    notes: str | None = None


class WorkspaceTaskCreate(APIModel):
    title: str
    assigned_to: str
    due_date: str | None = None
    priority: str = "medium"
    status: str = "todo"


class WorkspaceTaskUpdate(APIModel):
    task_id: str
    status: str  # todo, in_progress, done


class WorkspaceDiscussionPostCreate(APIModel):
    author_name: str
    author_role: str  # faculty, industry_mentor, student
    content: str


class WorkspaceDeliverableSubmit(APIModel):
    title: str
    deliverable_type: str  # report, code, dataset, paper, presentation
    url_or_key: str
    notes: str | None = None


class WorkspaceFeedbackSubmit(APIModel):
    author_name: str
    author_role: str
    rating: int = 5
    comments: str


class FacultyEventRegistrationCreate(APIModel):
    event_id: UUID
    event_type: str = "workshop"  # workshop, guest_lecture, mentorship, fdp, challenge
    event_title: str
    host_organization: str
    role: str = "attendee"  # attendee, speaker, coordinator
    scheduled_at: datetime | None = None


class FacultyEventRegistrationResponse(APIModel):
    id: UUID
    faculty_id: UUID
    event_id: UUID
    event_type: str
    event_title: str
    host_organization: str
    role: str
    status: str
    feedback: str | None = None
    certificate_url: str | None = None
    scheduled_at: datetime | None = None
    registered_at: datetime


class FacultyNotificationResponse(APIModel):
    id: UUID
    faculty_id: UUID
    title: str
    message: str
    category: str
    is_read: bool
    link_url: str | None = None
    created_at: datetime


class FacultyCollaborationHistoryItem(APIModel):
    id: UUID
    title: str
    collaboration_type: str
    organization_name: str
    role: str
    duration_weeks: int | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: str
    outcome_summary: str | None = None
    outcome_type: str | None = None
    certificate_url: str | None = None
    stipend_or_grant: float | None = None


class FacultyAdvisedProjectResponse(APIModel):
    challenge_id: UUID
    title: str
    host_company: str
    problem_statement: str
    duration_weeks: int
    milestones: list[dict[str, Any]] = Field(default_factory=list)
    student_teams: list[dict[str, Any]] = Field(default_factory=list)
    advisor_feedback: list[dict[str, Any]] = Field(default_factory=list)
    status: str


class FacultyProjectFeedbackRequest(APIModel):
    project_application_id: UUID
    feedback: str
    grade_or_endorsement: str | None = None


class MentorshipSessionResponse(APIModel):
    id: UUID
    mentor_name: str
    mentor_company: str
    mentor_role: str
    domain: str
    scheduled_at: datetime
    duration_minutes: int
    meeting_link: str | None
    max_participants: int
    description: str


class InnovationChallengeResponse(APIModel):
    id: UUID
    challenge_type: str = "hackathon"
    title: str
    host_company: str
    problem_statement: str
    prize_pool: str
    team_size: int = 1
    duration_weeks: int = 4
    mentor_name: str | None = None
    deliverables: list[str] = Field(default_factory=list)
    milestones: list[dict[str, Any]] = Field(default_factory=list)
    deadline: datetime
    tags: list[str]
    status: str



class InstitutionSkillDistribution(APIModel):
    skill_name: str
    student_count: int
    average_proficiency: float
    verified_ratio: float


class DepartmentMetric(APIModel):
    department: str
    total_students: int
    verified_skills_average: float
    placement_rate: float
    internship_rate: float


class InstitutionAnalyticsOverview(APIModel):
    institution_name: str
    total_students: int
    total_verified_skills: int
    active_internships: int
    placements_secured: int
    overall_employability_index: float
    department_metrics: list[DepartmentMetric]
    top_skills_distribution: list[InstitutionSkillDistribution]
    market_skill_demand_gaps: list[dict[str, Any]]


# =========================================================================
# Internship Engagement & Mentor Feedback Contracts
# =========================================================================

class InternshipEngagementCreate(APIModel):
    internship_id: UUID
    student_id: UUID
    mentor_name: str | None = None
    mentor_email: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    milestones: list[dict[str, Any]] | None = None


class InternshipEngagementUpdate(APIModel):
    status: str | None = None  # applied, shortlisted, selected, active, completed, rejected, withdrawn
    progress_percentage: int | None = Field(default=None, ge=0, le=100)
    mentor_name: str | None = None
    mentor_email: str | None = None
    completion_notes: str | None = None
    final_rating: float | None = Field(default=None, ge=1.0, le=5.0)


class MilestoneUpdateRequest(APIModel):
    milestone_id: str
    status: str  # pending, submitted, completed, rejected
    submission_text: str | None = None
    feedback: str | None = None


class MentorFeedbackRequest(APIModel):
    technical_skills_rating: float = Field(ge=1.0, le=5.0)
    communication_rating: float = Field(ge=1.0, le=5.0)
    teamwork_rating: float = Field(ge=1.0, le=5.0)
    problem_solving_rating: float = Field(ge=1.0, le=5.0)
    overall_rating: float = Field(ge=1.0, le=5.0)
    comments: str = Field(min_length=5)


class InternshipEngagementResponse(APIModel):
    id: UUID
    internship_id: UUID
    student_id: UUID
    recruiter_id: UUID
    internship_title: str
    company_name: str
    student_name: str | None = None
    mentor_id: UUID | None = None
    mentor_name: str | None = None
    mentor_email: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    status: str
    progress_percentage: int
    milestones: list[dict[str, Any]]
    mentor_feedback: dict[str, Any] | None = None
    final_rating: float | None = None
    completion_notes: str | None = None
    created_at: datetime


# =========================================================================
# Placement Drive Recruiter Management Contracts
# =========================================================================

class PlacementDriveCreate(APIModel):
    company_name: str = Field(min_length=2, max_length=255)
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=10)
    role_type: str = Field(default="Software Engineer", max_length=80)
    ctc_lpa: float = Field(default=12.0, ge=1.0, le=200.0)
    eligible_departments: list[str] = Field(default_factory=list)
    minimum_cgpa: float = Field(default=7.0, ge=0.0, le=10.0)
    passing_year: int = Field(default=2025, ge=2020, le=2030)
    drive_date: datetime
    required_skills: list[str] = Field(min_length=1)


class PlacementRegistrationStageUpdate(APIModel):
    stage: str  # registered, shortlisted, interview_scheduled, interviewed, offered, accepted, rejected, withdrawn
    interview_date: datetime | None = None
    interview_notes: str | None = None
    offer_details: dict[str, Any] | None = None


class PlacementCandidateRanking(APIModel):
    registration_id: UUID
    student_id: UUID
    student_name: str
    student_email: str
    stage: str
    match_score: float
    deterministic_score: float
    semantic_score: float
    verification_bonus: float
    matched_skills: list[str]
    missing_skills: list[str]
    registered_at: datetime
    interview_date: datetime | None = None
    offer_details: dict[str, Any] | None = None


# =========================================================================
# Live Industry Projects & Extended Challenges Contracts
# =========================================================================

class ProjectApplicationCreate(APIModel):
    challenge_id: UUID
    team_members: list[str] = Field(default_factory=list)
    submission_notes: str | None = None


class ProjectApplicationResponse(APIModel):
    id: UUID
    challenge_id: UUID
    challenge_title: str
    student_id: UUID
    team_members: list[str]
    status: str
    submission_url: str | None = None
    submission_notes: str | None = None
    feedback: str | None = None
    score_or_grade: str | None = None
    applied_at: datetime


# =========================================================================
# Phase 1 & Phase 2 Institution Decision-Support Portal Contracts
# =========================================================================

class DepartmentDetailAnalytics(APIModel):
    department: str
    total_students: int
    verified_skills_average: float
    assessment_completion_rate: float
    average_readiness: float
    internship_participation_rate: float
    internship_completion_rate: float
    placement_eligibility_rate: float
    placement_conversion_rate: float
    active_applications: int
    top_verified_skills: list[dict[str, Any]]
    top_technical_gaps: list[dict[str, Any]]
    top_soft_skill_gaps: list[dict[str, Any]]
    curriculum_vs_industry_demand: list[dict[str, Any]]
    learning_participation: dict[str, Any]
    faculty_industry_engagement: dict[str, Any]
    recommended_actions: list[str]


class CohortSummaryItem(APIModel):
    cohort_id: str
    cohort_name: str
    department: str
    graduation_year: str | int
    readiness_band: str
    total_students: int
    average_readiness: float
    assessment_completion_pct: float
    verified_skills_average: float
    internship_participation_pct: float
    placement_eligibility_pct: float
    placement_conversion_pct: float
    active_learning_enrollment: int
    critical_skill_gaps: list[str]


class CohortAnalyticsResponse(APIModel):
    total_cohorts: int
    total_students_monitored: int
    cohorts: list[CohortSummaryItem]


class InterventionRecommendation(APIModel):
    skill: str
    skill_cluster: str
    industry_demand_index: float
    student_supply_index: float
    gap_severity: str
    affected_student_count: int
    affected_departments: list[str]
    recommended_courses: list[dict[str, Any]]
    recommended_workshops: list[dict[str, Any]]
    recommended_mentorship: list[dict[str, Any]]


class InterventionPlanCreate(APIModel):
    title: str = Field(min_length=3, max_length=255)
    skill_cluster: str = Field(min_length=2, max_length=120)
    department: str = "All"
    target_students_count: int = 0
    baseline_supply_index: float = 0.0
    target_supply_index: float = 80.0
    selected_learning_programs: list[str] = Field(default_factory=list)
    selected_workshops: list[str] = Field(default_factory=list)
    selected_mentorship: list[str] = Field(default_factory=list)
    start_date: datetime | None = None
    target_date: datetime | None = None
    status: str = "draft"
    notes: str | None = None


class InterventionPlanUpdate(APIModel):
    title: str | None = None
    target_students_count: int | None = None
    target_supply_index: float | None = None
    selected_learning_programs: list[str] | None = None
    selected_workshops: list[str] | None = None
    selected_mentorship: list[str] | None = None
    start_date: datetime | None = None
    target_date: datetime | None = None
    status: str | None = None
    notes: str | None = None


class InterventionPlanResponse(APIModel):
    id: UUID
    institution_id: UUID | None = None
    title: str
    skill_cluster: str
    department: str
    target_students_count: int
    baseline_supply_index: float
    target_supply_index: float
    selected_learning_programs: list[str]
    selected_workshops: list[str]
    selected_mentorship: list[str]
    start_date: datetime | None = None
    target_date: datetime | None = None
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class InternshipMonitoringOverview(APIModel):
    eligible_students: int
    applicants: int
    selected_students: int
    active_internships: int
    completed_internships: int
    completion_rate: float
    mentor_feedback_completion_rate: float
    ppo_conversions: int
    ppo_conversion_rate: float
    by_department: list[dict[str, Any]]
    by_graduation_year: list[dict[str, Any]]
    by_opportunity_type: list[dict[str, Any]]
    by_industry: list[dict[str, Any]]
    by_skill_cluster: list[dict[str, Any]]


class PlacementMonitoringOverview(APIModel):
    eligible_students: int
    applications: int
    shortlisted: int
    interviews_scheduled: int
    offers_extended: int
    placements_secured: int
    conversion_rate: float
    average_readiness: float
    average_compatibility: float
    top_placement_skill_gaps: list[dict[str, Any]]
    top_recruiting_skill_demand: list[dict[str, Any]]
    by_department: list[dict[str, Any]]
    by_role: list[dict[str, Any]]
    by_company: list[dict[str, Any]]
    by_graduation_year: list[dict[str, Any]]


class FacultyEngagementOverview(APIModel):
    total_participating_faculty: int
    active_faculty_internships: int
    active_industrial_training: int
    active_fdps: int
    research_collaborations: int
    consultancy_projects: int
    workshops_guest_lectures: int
    total_research_grant_value: float
    active_industry_partners_count: int
    by_department: list[dict[str, Any]]
    by_opportunity_type: list[dict[str, Any]]
    by_industry_partner: list[dict[str, Any]]
    by_status: list[dict[str, Any]]


class CurriculumRecommendationItem(APIModel):
    id: str
    skill_area: str
    industry_demand_index: float
    student_supply_index: float
    gap_size: float
    gap_severity: str
    departments_affected: list[str]
    recommended_modules: list[str]
    suggested_labs: list[str]
    bootcamp_tracks: list[str]
    linked_intervention_id: str | None = None


class IndustryPartnerSummary(APIModel):
    partner_name: str
    domain: str
    partner_types: list[str]
    internships_posted: int
    students_selected: int
    placements_offered: int
    learning_programs_count: int
    faculty_engagements_count: int
    research_collaborations_count: int
    status: str


class IndustryPartnershipOverview(APIModel):
    total_partners: int
    internship_partners: int
    placement_partners: int
    training_partners: int
    research_partners: int
    mentorship_partners: int
    partners: list[IndustryPartnerSummary]


class IndustryPartnerDetail(APIModel):
    partner_name: str
    domain: str
    partner_overview: str
    student_engagements: list[dict[str, Any]]
    faculty_engagements: list[dict[str, Any]]
    posted_opportunities: list[dict[str, Any]]
    placement_drives: list[dict[str, Any]]
    research_and_consultancy: list[dict[str, Any]]
    outcome_metrics: dict[str, Any]


class CourseEffectivenessMetric(APIModel):
    course_id: str
    title: str
    category: str
    provider: str
    enrolled_count: int
    completed_count: int
    completion_rate: float
    targeted_skills: list[str]
    baseline_readiness_avg: float
    post_completion_readiness_avg: float
    readiness_gain: float
    placement_correlation_rate: float
    department_participation: list[dict[str, Any]]


class LearningEffectivenessOverview(APIModel):
    total_enrolled: int
    total_completed: int
    overall_completion_rate: float
    average_readiness_gain: float
    courses: list[CourseEffectivenessMetric]


class AtRiskCohortGroup(APIModel):
    risk_category: str
    severity: str
    affected_students_count: int
    department: str
    graduation_year: str | int
    key_signals: list[str]
    recommended_action: str


class AtRiskCohortSummary(APIModel):
    total_at_risk_students: int
    risk_groups: list[AtRiskCohortGroup]


class ActionPlanCreate(APIModel):
    title: str = Field(min_length=3, max_length=255)
    action_type: str = Field(min_length=2, max_length=64)
    related_department: str = "All"
    source_insight: str = Field(min_length=5)
    priority: str = "medium"
    owner: str = "Dean of Academics"
    target_date: datetime | None = None
    status: str = "planned"
    linked_intervention_id: UUID | None = None
    outcome_notes: str | None = None


class ActionPlanUpdate(APIModel):
    title: str | None = None
    priority: str | None = None
    owner: str | None = None
    target_date: datetime | None = None
    status: str | None = None
    outcome_notes: str | None = None


class ActionPlanResponse(APIModel):
    id: UUID
    institution_id: UUID | None = None
    title: str
    action_type: str
    related_department: str
    source_insight: str
    priority: str
    owner: str
    target_date: datetime | None = None
    status: str
    linked_intervention_id: UUID | None = None
    outcome_notes: str | None = None
    created_at: datetime
    updated_at: datetime


class InstitutionAlertItem(APIModel):
    id: str
    alert_type: str
    severity: str
    title: str
    message: str
    department: str | None = None
    target_tab: str
    action_label: str


class InstitutionAlertsResponse(APIModel):
    alerts: list[InstitutionAlertItem]


class CollaborationRelationshipItem(APIModel):
    id: str
    industry_partner: str
    faculty_lead: str
    faculty_department: str
    student_team_or_cohort: str
    initiative_title: str
    initiative_type: str
    status: str
    outcome_metric: str


class CollaborationRelationshipsResponse(APIModel):
    total_collaborations: int
    relationships: list[CollaborationRelationshipItem]


class InstitutionReportResponse(APIModel):
    report_type: str
    report_title: str
    generated_at: datetime
    columns: list[str]
    rows: list[dict[str, Any]]
    csv_export_url: str | None = None



