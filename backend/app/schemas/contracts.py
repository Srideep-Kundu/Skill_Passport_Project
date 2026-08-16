from datetime import datetime
from typing import Generic, Literal, TypeVar
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(APIModel):
    access_token: str
    token_type: str = "bearer"
    role: Literal["student", "recruiter", "admin"]


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


class EvidenceCreate(APIModel):
    evidence_type: Literal["coursework", "project", "competition", "certification", "micro_credential"]
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=20_000)
    external_url: AnyHttpUrl | None = None


class EvidenceUpdate(APIModel):
    evidence_type: Literal["coursework", "project", "competition", "certification", "micro_credential"] | None = None
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


class VerificationRequest(APIModel):
    # Legacy values remain accepted while every request runs the complete GitHub check suite.
    check_type: Literal["github_repository_accessibility", "github_commit_match", "github_project"] = "github_project"


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
    def unique_requirement_skills(cls, values: list[InternshipRequirementCreate]) -> list[InternshipRequirementCreate]:
        if len({value.skill_id for value in values}) != len(values):
            raise ValueError("Each skill may appear only once in requirements")
        return values


class InternshipUpdate(APIModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=20_000)
    requirements: list[InternshipRequirementCreate] | None = Field(default=None, min_length=1, max_length=50)

    @field_validator("requirements")
    @classmethod
    def unique_updated_requirement_skills(cls, values: list[InternshipRequirementCreate] | None) -> list[InternshipRequirementCreate] | None:
        if values is not None and len({value.skill_id for value in values}) != len(values):
            raise ValueError("Each skill may appear only once in requirements")
        return values


class InternshipResponse(APIModel):
    id: UUID
    title: str
    description: str
    recruiter_id: UUID
    created_at: datetime
    requirements: list[InternshipRequirementResponse] = Field(default_factory=list)


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


class ExplanationResponse(APIModel):
    lines: list[str]
    items: list[ExplanationItem]
    deterministic_score: float
    semantic_score: float
    verification_bonus: float
    final_score: float
    score_version: str


class TeamSuggestionRequest(APIModel):
    target_skill_set: list[UUID] = Field(min_length=1, max_length=30)
    pool: list[UUID] = Field(min_length=1, max_length=100)


class TeamSuggestion(APIModel):
    pair: tuple[UUID, UUID]
    complementarity_score: float


class PassportResponse(APIModel):
    skills: list[ExtractedSkillResponse]
    evidence: list[EvidenceResponse]
