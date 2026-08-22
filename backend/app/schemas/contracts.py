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


class StudentRegistration(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    university: str | None = Field(default=None, max_length=255)
    graduation_year: int | None = Field(default=None, ge=2020, le=2100)


class RecruiterRegistration(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=10, max_length=128)
    company_name: str = Field(min_length=1, max_length=255)


class LoginRequest(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class GoogleAuthRequest(APIModel):
    credential: str = Field(min_length=10)
    role: Literal["student", "recruiter", "academician", "institution"] = "student"
    company_name: str | None = Field(default=None, max_length=255)


class AcademicianRegistration(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    institution_name: str = Field(min_length=1, max_length=255)
    department: str = Field(min_length=1, max_length=120)
    designation: str = Field(min_length=1, max_length=120)
    research_areas: list[str] = Field(default_factory=list)


class InstitutionRegistration(APIModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=10, max_length=128)
    institution_name: str = Field(min_length=1, max_length=255)
    institution_code: str = Field(min_length=1, max_length=64)
    state: str | None = Field(default=None, max_length=100)
    departments: list[str] = Field(default_factory=list)


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

    @field_validator("github_username")
    @classmethod
    def github_username_is_plain_handle(cls, value: str) -> str:
        import re

        normalized = value.strip()
        if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})", normalized):
            raise ValueError("GitHub username is invalid")
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
    target_skill_set: list[UUID] = Field(min_length=1, max_length=30)
    pool: list[UUID] = Field(min_length=1, max_length=100)


class TeamSuggestion(APIModel):
    pair: tuple[UUID, UUID]
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


class FacultyOpportunityResponse(APIModel):
    id: UUID
    title: str
    opportunity_type: str
    organization_name: str
    description: str
    domain: str
    stipend_or_grant: float | None
    duration_weeks: int
    deadline: datetime | None
    status: str
    has_applied: bool = False
    application_status: str | None = None


class FacultyApplicationRequest(APIModel):
    opportunity_id: UUID
    proposal_text: str = Field(min_length=10)


class FacultyApplicationResponse(APIModel):
    id: UUID
    opportunity_id: UUID
    opportunity_title: str
    organization_name: str
    opportunity_type: str
    status: str
    proposal_text: str | None
    applied_at: datetime


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


