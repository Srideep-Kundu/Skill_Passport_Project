export type Role = "student" | "recruiter" | "admin";

export interface AuthSession {
  access_token: string;
  token_type: "bearer";
  role: Role;
}

export interface StudentRegistration {
  email: string;
  password: string;
  full_name: string;
  university?: string;
}

export interface RecruiterRegistration {
  email: string;
  password: string;
  company_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type EvidenceType = "coursework" | "project" | "competition" | "certification" | "micro_credential";
export type VerificationTier = "verified" | "partially_verified" | "unverified";

export interface EvidenceSubmission {
  evidence_type: EvidenceType;
  title: string;
  description: string;
  external_url?: string;
}

export type EvidenceUpdate = Partial<EvidenceSubmission>;

export interface ExtractedSkill {
  id: string;
  skill_id: string;
  canonical_name: string;
  extraction_confidence: number;
  verification_tier: VerificationTier;
  evidence_span: string | null;
  source_evidence_id: string;
}

export interface EvidenceSummary {
  id: string;
  evidence_type: EvidenceType;
  title: string;
  description: string;
  external_url: string | null;
  extraction_status: "pending_extraction" | "queued" | "processing" | "retry_scheduled" | "extracted" | "failed" | "dead_lettered";
  submitted_at: string;
}

export interface ExtractionJob {
  status: "pending" | "queued" | "processing" | "retry_scheduled" | "completed" | "failed" | "dead_lettered";
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  user_message: string | null;
  provider: string | null;
}

export interface EvidenceDetail extends EvidenceSummary {
  extracted_skills: ExtractedSkill[];
  extraction_job: ExtractionJob | null;
}

export interface Passport {
  skills: ExtractedSkill[];
  evidence: EvidenceSummary[];
}

export interface ProfileEvidenceSupport {
  evidence_id: string;
  title: string;
  evidence_type: EvidenceType;
  origin: "manual" | "resume";
  verification_tier: VerificationTier;
  extraction_confidence: number;
  effective_confidence: number;
  evidence_span: string;
  source_types: string[];
  likely_duplicate_of: string | null;
}

export interface ProfileSkill {
  skill_id: string;
  canonical_name: string;
  category: string;
  supports: ProfileEvidenceSupport[];
  supporting_evidence_count: number;
  independent_evidence_count: number;
  source_types: string[];
  source_diversity: number;
  highest_verification_tier: VerificationTier;
  verification_summary: string;
  summary_confidence: number;
}

export interface CandidateProfile {
  student_id: string;
  skills: ProfileSkill[];
  active_resume: { id: string; original_filename: string; parse_status: string; parsed_at: string | null } | null;
  github_identity_status: "not_linked" | "claimed";
  profile_completeness: { has_active_resume: boolean; has_project_evidence: boolean; has_verified_evidence: boolean; has_evidence_backed_skills: boolean; has_github_identity: boolean };
}

export interface Skill {
  id: string;
  canonical_name: string;
  category: string;
  aliases: string[];
}

export interface InternshipRequirementInput {
  skill_id: string;
  is_required: boolean;
  weight: number;
}

export interface InternshipCreate {
  title: string;
  description: string;
  requirements: InternshipRequirementInput[];
}

export type InternshipUpdate = Partial<InternshipCreate>;

export interface InternshipRequirement extends InternshipRequirementInput {
  id: string;
}

export interface Internship {
  id: string;
  title: string;
  description: string;
  recruiter_id: string;
  created_at: string;
  requirements: InternshipRequirement[];
}

export interface ExternalJobRequirement {
  id: string;
  skill_id: string;
  skill_name: string;
  is_required: boolean;
  weight: number;
  confidence: number;
  source_span: string;
}

export interface ExternalJob {
  id: string;
  provider: string;
  provider_source: string;
  external_id: string;
  title: string;
  company_name: string;
  description: string;
  location: string | null;
  remote_status: string | null;
  employment_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  apply_url: string | null;
  source_url: string;
  posted_at: string | null;
  expires_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_synced_at: string;
  is_active: boolean;
  requirements: ExternalJobRequirement[];
}

export interface ExternalJobMatch {
  id: string;
  student_id: string;
  external_job_id: string;
  title: string;
  company_name: string;
  provider: string;
  external_id: string;
  source_url: string;
  location: string | null;
  remote_status: string | null;
  posted_at: string | null;
  is_active: boolean;
  deterministic_score: number;
  semantic_score: number;
  verification_bonus: number;
  final_score: number;
  score_version: string;
  is_stale: boolean;
  explanation: MatchExplanation;
}

export interface ExternalJobMatchState {
  matching_status: "ready" | "not_computed" | "insufficient_requirements" | "inactive";
  match: ExternalJobMatch | null;
}

export type ApplicationStatus = "approval_pending" | "approved" | "preparing" | "needs_input" | "prepared" | "ready_to_submit" | "submitting" | "submitted" | "failed" | "unknown_submission_state" | "manual_apply" | "withdrawn";

export interface ApplicationSnapshot {
  schema_version: string;
  job: { id: string; provider: string; provider_source: string; external_id: string; title: string; company_name: string; source_url: string; manual_apply_url: string; content_fingerprint: string };
  recommendation: { match_id: string; final_score: number; supporting_evidence: { skill_name: string; evidence_id: string | null; evidence_title: string | null }[]; missing_skills: { skill_name: string; is_required: boolean }[] };
  resume: { id: string; original_filename: string; checksum: string; parser_version: string; parsed_at: string | null };
  application_profile: { full_name: string; email: string; phone: string | null; github_links: string[]; portfolio_links: string[]; education: unknown[]; experience: unknown[] };
  sensitive_question_policy: "requires_direct_user_input";
}

export interface Application {
  id: string;
  student_id: string;
  external_job_id: string;
  external_job_match_id: string;
  resume_document_id: string;
  status: ApplicationStatus;
  application_snapshot: ApplicationSnapshot;
  application_fingerprint: string;
  approved_fingerprint: string | null;
  provider_capabilities: { search: boolean; detail_fetch: boolean; auto_apply: boolean; status_tracking: boolean };
  provider_schema_version?: string | null;
  execution_payload_fingerprint?: string | null;
  ready_payload_fingerprint?: string | null;
  manual_apply_url: string | null;
  approved_at: string | null;
  approval_revoked_at: string | null;
  prepared_at?: string | null;
  ready_at?: string | null;
  submitted_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
  is_approval_stale: boolean;
}

export interface ApplicationField {
  field_id: string;
  label: string;
  field_type: "text" | "textarea" | "email" | "phone" | "url" | "select" | "multi_select" | "boolean" | "file" | "date" | "number";
  required: boolean;
  category: string;
  allowed_values: string[];
  sensitive: boolean;
  source: string;
  answer: unknown | null;
  answer_source: string | null;
  requires_user_input: boolean;
  is_answered: boolean;
}

export interface ApplicationForm {
  application_id: string;
  provider: string;
  provider_auto_apply: boolean;
  provider_schema_version: string | null;
  payload_fingerprint: string | null;
  unresolved_field_ids: string[];
  is_assisted: boolean;
  submission_capability: {
    provider_supports_submission: boolean;
    credentials_configured: boolean;
    posting_supports_submission: boolean;
    application_schema_available: boolean;
    submission_ready: boolean;
    fallback: string;
    reason: string;
  };
  fields: ApplicationField[];
}

export interface VerificationResult {
  result: string;
  details: Record<string, unknown>;
  verification_tier: VerificationTier;
  checks: VerificationCheck[];
}

export interface VerificationCheck {
  check_type: "repository_accessible" | "repository_owner_match" | "commit_author_match" | "language_consistency" | "timeline_consistency";
  result: "pass" | "partial" | "fail" | "not_applicable";
  details: Record<string, unknown>;
  checked_at: string | null;
}

export interface GitHubIdentity {
  github_username: string | null;
  association_status: "not_linked" | "claimed";
  identity_authenticated: false;
}

export interface RecruiterEvidenceConsent {
  recruiter_evidence_consent: boolean;
}

export interface MatchExplanationLine {
  skill_id: string;
  skill_name: string;
  is_required?: boolean;
  status: "matched_verified" | "matched_partially_verified" | "matched_unverified" | "semantic_near_match" | "missing";
  contribution: number;
  evidence_id: string | null;
  evidence_title: string | null;
  matched_skill_id: string | null;
  matched_skill_name: string | null;
  semantic_similarity: number | null;
  deterministic_contribution: number;
  semantic_contribution: number;
  verification_contribution: number;
  total_contribution: number;
  extraction_confidence?: number | null;
  verification_tier?: VerificationTier | null;
}

export interface MatchExplanation {
  lines: string[];
  items: MatchExplanationLine[];
  deterministic_score: number;
  semantic_score: number;
  verification_bonus: number;
  final_score: number;
  score_version: string;
}

export interface StudentMatch {
  id: string;
  student_id: string;
  internship_id: string;
  internship_title: string;
  final_score: number;
  deterministic_score: number;
  semantic_score: number;
  verification_bonus: number;
  is_stale: boolean;
  explanation?: MatchExplanation;
}

export interface CandidateMatch {
  id: string;
  student_id: string;
  internship_id: string;
  candidate_label: string;
  final_score: number;
  deterministic_score: number;
  semantic_score: number;
  verification_bonus: number;
  is_stale: boolean;
  explanation?: MatchExplanation;
}

export interface TeamSuggestionRequest {
  target_skill_set: string[];
  pool: string[];
}

export interface TeamSuggestion {
  pair: string[];
  complementarity_score: number;
  coverage_score?: number;
  redundancy_penalty?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface ResumeParsedData {
  contact: { name: string | null; email: string | null; phone: string | null; github_links: string[]; portfolio_links: string[] };
  projects: { title: string; description: string }[];
  certifications: { name: string; detail: string }[];
  explicit_technical_skills: string[];
}

export interface ResumeDocument {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  checksum: string;
  parse_status: "uploaded" | "parsing" | "parsed" | "evidence_created" | "processing_skills" | "completed" | "failed" | "unsupported";
  parser_version: string;
  uploaded_at: string;
  parsed_at: string | null;
  is_active: boolean;
  safe_error_message: string | null;
  parsed_summary: ResumeParsedData | null;
  generated_evidence_count: number;
  skills_status: "not_started" | "extracting" | "ready";
}
