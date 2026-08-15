from datetime import datetime
from typing import Literal
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


class EvidenceResponse(APIModel):
    id: UUID
    evidence_type: str
    title: str
    description: str
    external_url: str | None
    extraction_status: str
    submitted_at: datetime


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


class VerificationRequest(APIModel):
    check_type: Literal["github_commit_match"]


class VerificationResponse(APIModel):
    result: str
    details: dict[str, object]


class SkillResponse(APIModel):
    id: UUID
    canonical_name: str
    category: str
    aliases: list[str]


class InternshipRequirementCreate(APIModel):
    skill_id: UUID
    is_required: bool = True
    weight: float = Field(default=1.0, gt=0, le=10)


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


class InternshipResponse(APIModel):
    id: UUID
    title: str
    description: str
    recruiter_id: UUID
    created_at: datetime


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


class ExplanationItem(APIModel):
    skill_id: UUID
    skill_name: str
    status: str
    contribution: float
    evidence_id: UUID | None
    evidence_title: str | None


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
