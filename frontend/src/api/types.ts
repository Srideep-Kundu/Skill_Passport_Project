export type Role = "student" | "recruiter" | "admin" | "academician" | "institution";

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

export interface GoogleAuthRequest {
  credential: string;
  role?: Role;
  company_name?: string;
}

export interface AcademicianRegistration {
  email: string;
  password: string;
  full_name: string;
  institution_name: string;
  department: string;
  designation: string;
  research_areas?: string[];
}

export interface InstitutionRegistration {
  email: string;
  password: string;
  institution_name: string;
  institution_code: string;
  state?: string;
  departments?: string[];
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
  origin: "manual" | "resume" | "linkedin_export";
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
  active_linkedin_import?: { id: string; original_filename: string; parse_status: string; parsed_at: string | null } | null;
  github_identity_status: "not_linked" | "claimed";
  profile_completeness: {
    has_active_resume: boolean;
    has_linkedin_import?: boolean;
    has_project_evidence: boolean;
    has_verified_evidence: boolean;
    has_evidence_backed_skills: boolean;
    has_github_identity: boolean;
  };
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

export interface ProviderStatusItem {
  provider: string;
  name: string;
  status: "live" | "api_required" | "integration_status" | "not_configured";
  badge_label: string;
  search_supported: boolean;
  status_tracking_supported: boolean;
  active_jobs_count: number;
  last_synced_at: string | null;
  reason?: string | null;
}

export interface ExternalJobSyncAllResponse {
  total_created: number;
  total_updated: number;
  total_synced: number;
  providers: Record<string, unknown>;
  synced_at: string;
}

export type ApplicationStatus = "approval_pending" | "approved" | "preparing" | "needs_input" | "prepared" | "ready_to_submit" | "submitting" | "submitted" | "failed" | "unknown_submission_state" | "manual_apply" | "withdrawn";
export type ApplicationTrackingStatus = "submitted" | "received" | "in_review" | "rejected" | "interview" | "offer" | "hired" | "withdrawn" | "unknown";
export type ApplicationStatusSource = "system" | "provider" | "user" | "admin";

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
  tracking_status?: ApplicationTrackingStatus | null;
  tracking_status_source?: ApplicationStatusSource | null;
  tracking_updated_at?: string | null;
  created_at: string;
  updated_at: string;
  is_approval_stale: boolean;
}

export interface ApplicationStatusEvent {
  id: string;
  application_id: string;
  event_type: string;
  status: ApplicationTrackingStatus | null;
  source: ApplicationStatusSource;
  provider_status: string | null;
  safe_metadata: Record<string, unknown>;
  created_at: string;
}

export interface ApplicationSubmissionAttempt {
  id: string;
  application_id: string;
  payload_fingerprint: string;
  status: "submitting" | "submitted" | "retryable_failure" | "failed" | "unknown_submission_state";
  attempt_count: number;
  started_at: string;
  completed_at: string | null;
  provider_response_id: string | null;
  result_type: string | null;
  safe_error: string | null;
}

export interface JobDiscovery {
  id: string; student_id: string; name: string; enabled: boolean; query: string | null; location: string | null; remote_preference: boolean | null;
  employment_type: string | null; experience_level: string | null; providers: ("greenhouse" | "lever" | "ashby")[]; freshness_days: number; minimum_match_score: number; cadence_hours: 6 | 12 | 24;
  last_run_at: string | null; next_run_at: string | null; created_at: string; updated_at: string;
}

export interface JobDiscoveryRun {
  id: string; discovery_id: string; status: "queued" | "running" | "completed" | "partial" | "failed"; providers_requested: string[]; provider_results: Record<string, unknown>;
  jobs_seen: number; jobs_created: number; jobs_updated: number; recommendations_created: number; recommendations_changed: number; safe_error: string | null; started_at: string; completed_at: string | null;
}

export interface AutomationPolicy {
  id: string; student_id: string; name: string; enabled: boolean; priority: number; minimum_match_score: number;
  allowed_providers: ("greenhouse" | "lever" | "ashby")[]; allowed_locations: string[]; remote_preference: boolean | null;
  employment_types: string[]; experience_levels: string[]; required_skills_any: string[]; required_skills_all: string[]; excluded_skills: string[];
  excluded_companies: string[]; excluded_keywords: string[]; maximum_jobs_per_run: number; maximum_review_intents_per_run: number;
  maximum_review_intents_per_day: number; maximum_pending_review_queue_size: number; auto_create_review_intent: boolean; last_applied_at: string | null; created_at: string; updated_at: string;
}

export interface AutomationQueueItem {
  external_job_id: string; match_id: string; title: string; company_name: string; provider: string; final_score: number;
  policy_id: string; policy_name: string; policy_reason: string[]; application_id: string | null; application_status: ApplicationStatus | null; active_resume_filename: string | null;
  explanation: MatchExplanation;
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
  achievements?: { title: string; detail: string }[];
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
  skills_status: "not_started" | "processing" | "ready" | "partial_failure" | "failed";
  completed_jobs: number;
  failed_jobs: number;
  pending_jobs: number;
  total_jobs: number;
}

export interface LinkedInCounts {
  positions: number;
  projects: number;
  certifications: number;
  skills: number;
  education: number;
  publications: number;
  courses: number;
  languages: number;
}

export interface LinkedInParsedSummary {
  counts: LinkedInCounts;
  discovered_skills: string[];
  categories_present: string[];
  total_records: number;
}

export interface LinkedInImport {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  checksum: string;
  parse_status: "uploaded" | "parsing" | "parsed" | "processing_skills" | "completed" | "failed" | "unsupported";
  parser_version: string;
  uploaded_at: string;
  parsed_at: string | null;
  is_active: boolean;
  safe_error_message: string | null;
  parsed_summary: LinkedInParsedSummary | null;
  generated_evidence_count: number;
  skills_status: "not_started" | "queued" | "processing" | "completed" | "has_failures";
}

// =========================================================================
// SIH 26044 Ecosystem Frontend Types
// =========================================================================

export interface CareerGoals {
  target_roles: string[];
  target_industry?: string | null;
  target_skills: string[];
  target_salary_lpa?: number | null;
  ambition_level: string;
}

export interface SkillGapItem {
  skill_name: string;
  category: string;
  status: "verified" | "assessed" | "missing" | "in_progress";
  proficiency_score: number;
  importance: "critical" | "high" | "medium" | "optional";
  recommended_action: string;
}

export interface SkillGapAnalysis {
  target_role: string;
  overall_readiness_score: number;
  matched_skills_count: number;
  missing_skills_count: number;
  gap_items: SkillGapItem[];
  top_recommended_courses: string[];
}

export interface AssessmentQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  points: number;
}

export interface Assessment {
  id: string;
  title: string;
  canonical_skill_name: string;
  category: string;
  difficulty: string;
  duration_minutes: number;
  passing_score: number;
  questions?: AssessmentQuestion[];
  question_count?: number;
}

export interface AssessmentAttempt {
  id: string;
  assessment_id: string;
  assessment_title: string;
  score: number;
  total_points: number;
  percentage: number;
  passed: boolean;
  completed_at: string;
}

export interface LearningCourse {
  id: string;
  title: string;
  provider: string;
  category: string;
  difficulty: string;
  duration_hours: number;
  url: string;
  rating: number;
  description: string;
  skills: string[];
  is_enrolled: boolean;
  progress: number;
  recommendation_reason?: string | null;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  course_title: string;
  provider: string;
  status: string;
  progress: number;
  enrolled_at: string;
  completed_at: string | null;
}

export interface PlacementDrive {
  id: string;
  company_name: string;
  title: string;
  description: string;
  role_type: string;
  ctc_lpa: number;
  eligible_departments: string[];
  minimum_cgpa: number;
  passing_year: number;
  drive_date: string;
  status: string;
  required_skills: string[];
  is_registered: boolean;
  registration_status?: string | null;
}

export interface PlacementCandidateRanking {
  registration_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  stage: string;
  match_score: number;
  deterministic_score: number;
  semantic_score: number;
  verification_bonus: number;
  matched_skills: string[];
  missing_skills: string[];
  registered_at: string;
  interview_date?: string | null;
  offer_details?: Record<string, unknown> | null;
}

export interface FacultyPassport {
  id: string;
  email: string;
  full_name: string;
  institution_name: string;
  department: string;
  designation: string;
  research_areas: string[];
  bio?: string | null;
  years_experience: number;
  technical_skills: string[];
  certifications: Array<{ name: string; issuer?: string; year?: string | number; credential_url?: string }>;
  publications: Array<{ title: string; journal_or_conf?: string; year?: string | number; doi_or_url?: string }>;
  patents: Array<{ title: string; patent_number?: string; status?: string; year?: string | number }>;
  past_industry_experience: Array<{ company: string; role: string; duration_years?: number; description?: string }>;
  completed_fdps: Array<{ title: string; organizer?: string; year?: string | number; certificate_url?: string }>;
  completed_trainings: Array<{ title: string; company?: string; duration_weeks?: number; year?: string | number }>;
  collaboration_availability: "available" | "busy" | "sabbatical_only" | "not_available" | string;
  phone?: string | null;
  linkedin_url?: string | null;
  google_scholar_url?: string | null;
  active_collaborations_count: number;
  completed_collaborations_count: number;
  total_grants_secured: number;
}

export interface FacultyPassportUpdate {
  full_name?: string;
  institution_name?: string;
  department?: string;
  designation?: string;
  research_areas?: string[];
  bio?: string | null;
  years_experience?: number;
  technical_skills?: string[];
  certifications?: Array<Record<string, unknown>>;
  publications?: Array<Record<string, unknown>>;
  patents?: Array<Record<string, unknown>>;
  past_industry_experience?: Array<Record<string, unknown>>;
  completed_fdps?: Array<Record<string, unknown>>;
  completed_trainings?: Array<Record<string, unknown>>;
  collaboration_availability?: string;
  phone?: string | null;
  linkedin_url?: string | null;
  google_scholar_url?: string | null;
}

export interface FacultyOpportunity {
  id: string;
  title: string;
  opportunity_type: "fdp" | "industrial_immersion" | "industrial_training" | "faculty_internship" | "research_grant" | "consultancy_request" | string;
  organization_name: string;
  description: string;
  domain: string;
  stipend_or_grant?: number | null;
  duration_weeks: number;
  deadline?: string | null;
  status: string;
  objectives?: string[];
  mode?: "remote" | "on_site" | "hybrid" | string;
  location?: string | null;
  eligibility?: string | null;
  required_expertise?: string[];
  deliverables?: string[];
  required_documents?: string[];
  contact_email?: string | null;
  contact_person?: string | null;
  has_applied: boolean;
  application_status?: string | null;
  application_id?: string | null;
}

export interface FacultyApplication {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  organization_name: string;
  opportunity_type: string;
  status: "draft" | "submitted" | "under_review" | "shortlisted" | "discussion" | "accepted" | "rejected" | "withdrawn" | "active" | "completed" | string;
  application_type: string;
  proposal_title?: string | null;
  proposal_text?: string | null;
  problem_statement?: string | null;
  objectives?: string[];
  methodology?: string | null;
  team_members?: Array<{ name: string; role: string; department?: string; email?: string }>;
  student_researchers?: Array<{ name: string; roll_no?: string; skill?: string }>;
  deliverables?: string[];
  milestones?: Array<{ id: string; title: string; due_week?: number; due_date?: string; status: string; notes?: string }>;
  timeline_weeks?: number | null;
  budget_requested?: number | null;
  industry_support_required?: string | null;
  attachments?: Array<{ name: string; url: string; type?: string }>;
  reviewer_notes?: string | null;
  feedback?: string | null;
  industry_mentor_name?: string | null;
  industry_mentor_email?: string | null;
  engagement_status?: string;
  start_date?: string | null;
  end_date?: string | null;
  completion_report?: string | null;
  completion_certificate_url?: string | null;
  rating_or_grade?: string | null;
  outcome_type?: string | null;
  outcome_details?: Record<string, unknown>;
  applied_at: string;
  updated_at?: string | null;
  workspace_id?: string | null;
  faculty_name?: string | null;
  faculty_department?: string | null;
  faculty_institution?: string | null;
}

export interface FacultyApplicationCreate {
  opportunity_id: string;
  proposal_text?: string;
  proposal_title?: string;
  application_type?: string;
  problem_statement?: string;
  objectives?: string[];
  methodology?: string;
  team_members?: Array<Record<string, unknown>>;
  student_researchers?: Array<Record<string, unknown>>;
  deliverables?: string[];
  milestones?: Array<Record<string, unknown>>;
  timeline_weeks?: number;
  budget_requested?: number;
  industry_support_required?: string;
  attachments?: Array<Record<string, unknown>>;
  is_draft?: boolean;
}

export interface CollaborationWorkspace {
  id: string;
  application_id?: string | null;
  challenge_id?: string | null;
  title: string;
  collaboration_type: string;
  organization_name: string;
  faculty_lead_id: string;
  faculty_lead_name?: string | null;
  faculty_lead_department?: string | null;
  industry_lead_name: string;
  industry_lead_email?: string | null;
  status: "active" | "completed" | "paused" | "cancelled" | string;
  progress_percentage: number;
  objectives: string[];
  participants: Array<{ id?: string; name: string; role: string; company?: string; department?: string }>;
  milestones: Array<{ id: string; title: string; due_date?: string; status: "pending" | "in_progress" | "completed" | string; notes?: string }>;
  tasks: Array<{ id: string; title: string; assigned_to: string; due_date?: string; priority: "high" | "medium" | "low" | string; status: "todo" | "in_progress" | "done" | string }>;
  meetings: Array<{ id: string; title: string; date: string; link?: string }>;
  discussion_posts: Array<{ id: string; author_name: string; author_role: string; content: string; created_at: string }>;
  deliverables: Array<{ id: string; title: string; deliverable_type: string; url_or_key: string; notes?: string; submitted_at: string }>;
  feedback: Array<{ author_name: string; author_role: string; rating: number; comments: string; created_at: string }>;
  outcome_summary?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FacultyEventRegistration {
  id: string;
  faculty_id: string;
  event_id: string;
  event_type: "workshop" | "guest_lecture" | "mentorship" | "fdp" | "challenge" | string;
  event_title: string;
  host_organization: string;
  role: "attendee" | "speaker" | "coordinator" | string;
  status: "registered" | "attended" | "completed" | "cancelled" | string;
  feedback?: string | null;
  certificate_url?: string | null;
  scheduled_at?: string | null;
  registered_at: string;
}

export interface FacultyNotification {
  id: string;
  faculty_id: string;
  title: string;
  message: string;
  category: "application" | "workspace" | "milestone" | "mentorship" | "event" | string;
  is_read: boolean;
  link_url?: string | null;
  created_at: string;
}

export interface FacultyCollaborationHistoryItem {
  id: string;
  title: string;
  collaboration_type: string;
  organization_name: string;
  role: string;
  duration_weeks?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  outcome_summary?: string | null;
  outcome_type?: string | null;
  certificate_url?: string | null;
  stipend_or_grant?: number | null;
}

export interface FacultyAdvisedProject {
  challenge_id: string;
  title: string;
  host_company: string;
  problem_statement: string;
  duration_weeks: number;
  milestones: Array<Record<string, unknown>>;
  student_teams: Array<{
    id: string;
    student_id: string;
    team_members: string[];
    status: string;
    submission_url?: string | null;
    feedback?: string | null;
    score_or_grade?: string | null;
  }>;
  advisor_feedback: Array<Record<string, unknown>>;
  status: string;
}

export interface MentorshipSession {
  id: string;
  mentor_name: string;
  mentor_company: string;
  mentor_role: string;
  domain: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link?: string | null;
  max_participants: number;
  description: string;
}

export interface InnovationChallenge {
  id: string;
  challenge_type?: string;
  title: string;
  host_company: string;
  problem_statement: string;
  prize_pool: string;
  team_size?: number;
  duration_weeks?: number;
  mentor_name?: string | null;
  deliverables?: string[];
  milestones?: Array<{ id: string; title: string; due_date?: string; status: string }>;
  deadline: string;
  tags: string[];
  status: string;
}

export interface ProjectApplication {
  id: string;
  challenge_id: string;
  challenge_title: string;
  student_id: string;
  team_members: string[];
  status: string;
  submission_url?: string | null;
  submission_notes?: string | null;
  feedback?: string | null;
  score_or_grade?: string | null;
  applied_at: string;
}

export interface InternshipEngagement {
  id: string;
  internship_id: string;
  student_id: string;
  recruiter_id: string;
  internship_title: string;
  company_name: string;
  student_name?: string | null;
  mentor_id?: string | null;
  mentor_name?: string | null;
  mentor_email?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: string; // applied, shortlisted, selected, active, completed, rejected, withdrawn
  progress_percentage: number;
  milestones: Array<{ id: string; title: string; description: string; due_date?: string | null; status: string; submitted_at?: string | null; feedback?: string | null }>;
  mentor_feedback?: {
    technical_skills_rating: number;
    communication_rating: number;
    teamwork_rating: number;
    problem_solving_rating: number;
    overall_rating: number;
    comments: string;
    submitted_at: string;
  } | null;
  final_rating?: number | null;
  completion_notes?: string | null;
  created_at: string;
}

export interface MentorFeedbackRequest {
  technical_skills_rating: number;
  communication_rating: number;
  teamwork_rating: number;
  problem_solving_rating: number;
  overall_rating: number;
  comments: string;
}

export interface InstitutionSkillDistribution {
  skill_name: string;
  student_count: number;
  average_proficiency: number;
  verified_ratio: number;
}

export interface DepartmentMetric {
  department: string;
  total_students: number;
  verified_skills_average: number;
  placement_rate: number;
  internship_rate: number;
}

export interface InstitutionAnalyticsOverview {
  institution_name: string;
  total_students: number;
  total_verified_skills: number;
  active_internships: number;
  placements_secured: number;
  overall_employability_index: number;
  department_metrics: DepartmentMetric[];
  top_skills_distribution: InstitutionSkillDistribution[];
  market_skill_demand_gaps: { skill: string; industry_demand_index: number; student_supply_index: number; gap_severity: string }[];
}

export interface RoleGuidance {
  role_name: string;
  readiness_percentage: number;
  status: "ready" | "next_step" | "exploratory" | string;
  matched_skills: string[];
  missing_critical_skills: string[];
  why_explanation: string;
  recommended_next_step: string;
  target_industries: string[];
}

export interface CareerGuidanceOverview {
  target_role: string;
  target_role_readiness: number;
  ready_roles: RoleGuidance[];
  next_step_roles: RoleGuidance[];
  top_skill_priorities: string[];
  aligning_industry_sectors: string[];
  learning_action_plan: Array<{ priority: string; action: string; impact: string }>;
}

export interface UserDocument {
  id: string;
  user_id: string;
  user_role: string;
  document_type: string;
  title: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  file_url?: string | null;
  verification_status: string;
  related_entity_id?: string | null;
  metadata_payload?: Record<string, unknown>;
  created_at: string;
}

export interface UserDocumentCreate {
  document_type: string;
  title: string;
  file_name: string;
  file_size_bytes?: number;
  mime_type?: string;
  file_url?: string;
  related_entity_id?: string;
  metadata_payload?: Record<string, unknown>;
}

export interface StudentAchievement {
  id: string;
  student_id: string;
  title: string;
  achievement_type: string;
  issuer_organization: string;
  issue_date: string;
  description: string;
  proof_url?: string | null;
  verification_status: string;
  evidence_id?: string | null;
  created_at: string;
}

export interface StudentAchievementCreate {
  title: string;
  achievement_type: string;
  issuer_organization: string;
  issue_date: string;
  description: string;
  proof_url?: string;
}

export interface RecruiterSkillMetric {
  skill_name: string;
  required_in_postings_count: number;
  applicant_pool_count: number;
  supply_demand_ratio: number;
  market_status: "high_demand_shortage" | "balanced" | "abundant_supply" | string;
}

export interface RecruiterAnalyticsOverview {
  company_name: string;
  active_postings: number;
  total_applicants: number;
  shortlisted_candidates: number;
  interviews_scheduled: number;
  offers_extended: number;
  offers_accepted: number;
  top_demanded_skills: RecruiterSkillMetric[];
  most_common_applicant_gaps: Array<{ skill: string; gap_percentage: string; impact: string }>;
  recruitment_funnel: Array<{ stage: string; count: number }>;
}

export interface CopilotAction {
  label: string;
  target_tab: string;
  action_type: string;
  payload?: Record<string, unknown>;
}

export interface CopilotResponse {
  message: string;
  sources: string[];
  actions: CopilotAction[];
  grounding_data: Record<string, unknown>;
}

export interface ProfessionalProfile {
  full_name: string;
  headline: string;
  summary: string;
  current_position: string;
  experiences: Array<{ title: string; company: string; duration: string; description: string }>;
  education: Array<{ institution: string; degree: string; years: string }>;
  skills: string[];
  certifications: Array<{ name: string; issuer: string; year: string }>;
  projects: Array<{ title: string; description: string }>;
  source: string;
  source_confidence: number;
  persistable: boolean;
  is_demo_fixture: boolean;
  disclaimer: string;
}

// =========================================================================
// Phase 1 & Phase 2 Institution Decision-Support Portal Interfaces
// =========================================================================

export interface DepartmentDetailAnalytics {
  department: string;
  total_students: number;
  verified_skills_average: number;
  assessment_completion_rate: number;
  average_readiness: number;
  internship_participation_rate: number;
  internship_completion_rate: number;
  placement_eligibility_rate: number;
  placement_conversion_rate: number;
  active_applications: number;
  top_verified_skills: Array<{ skill: string; students: number; avg_proficiency: number }>;
  top_technical_gaps: Array<{ skill: string; industry_demand: number; student_supply: number; gap_severity: string; affected_students: number }>;
  top_soft_skill_gaps: Array<{ skill: string; cohort_avg: number; industry_benchmark: number; gap: number }>;
  curriculum_vs_industry_demand: Array<{ skill: string; curriculum_coverage: number; industry_demand: number }>;
  learning_participation: { enrolled_students: number; completed_students: number; completion_rate: number; active_programs: number };
  faculty_industry_engagement: { active_faculty: number; research_grants_count: number; total_grant_value: number; industry_fdps: number };
  recommended_actions: string[];
}

export interface CohortSummaryItem {
  cohort_id: string;
  cohort_name: string;
  department: string;
  graduation_year: string | number;
  readiness_band: string;
  total_students: number;
  average_readiness: number;
  assessment_completion_pct: number;
  verified_skills_average: number;
  internship_participation_pct: number;
  placement_eligibility_pct: number;
  placement_conversion_pct: number;
  active_learning_enrollment: number;
  critical_skill_gaps: string[];
}

export interface CohortAnalyticsResponse {
  total_cohorts: number;
  total_students_monitored: number;
  cohorts: CohortSummaryItem[];
}

export interface InterventionRecommendation {
  skill: string;
  skill_cluster: string;
  industry_demand_index: number;
  student_supply_index: number;
  gap_severity: string;
  affected_student_count: number;
  affected_departments: string[];
  recommended_courses: Array<{ title: string; provider: string; duration_weeks: number; format: string }>;
  recommended_workshops: Array<{ title: string; duration_hours: number; mentor_company: string }>;
  recommended_mentorship: Array<{ mentor_name: string; role: string; company: string }>;
}

export interface InterventionPlan {
  id: string;
  institution_id?: string | null;
  title: string;
  skill_cluster: string;
  department: string;
  target_students_count: number;
  baseline_supply_index: number;
  target_supply_index: number;
  selected_learning_programs: string[];
  selected_workshops: string[];
  selected_mentorship: string[];
  start_date?: string | null;
  target_date?: string | null;
  status: "draft" | "planned" | "in_progress" | "completed" | "measured" | string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterventionPlanPayload {
  title: string;
  skill_cluster: string;
  department?: string;
  target_students_count?: number;
  baseline_supply_index?: number;
  target_supply_index?: number;
  selected_learning_programs?: string[];
  selected_workshops?: string[];
  selected_mentorship?: string[];
  start_date?: string | null;
  target_date?: string | null;
  status?: string;
  notes?: string | null;
}

export interface InternshipMonitoringOverview {
  eligible_students: number;
  applicants: number;
  selected_students: number;
  active_internships: number;
  completed_internships: number;
  completion_rate: number;
  mentor_feedback_completion_rate: number;
  ppo_conversions: number;
  ppo_conversion_rate: number;
  by_department: Array<{ department: string; eligible: number; active: number; completed: number; rate: number }>;
  by_graduation_year: Array<{ year: string; eligible: number; active: number; completed: number; rate: number }>;
  by_opportunity_type: Array<{ type: string; count: number; avg_stipend: number }>;
  by_industry: Array<{ industry: string; selected: number; companies: string[] }>;
  by_skill_cluster: Array<{ cluster: string; demand_share: number }>;
}

export interface PlacementMonitoringOverview {
  eligible_students: number;
  applications: number;
  shortlisted: number;
  interviews_scheduled: number;
  offers_extended: number;
  placements_secured: number;
  conversion_rate: number;
  average_readiness: number;
  average_compatibility: number;
  top_placement_skill_gaps: Array<{ skill: string; frequency_flagged: number }>;
  top_recruiting_skill_demand: Array<{ skill: string; openings_count: number }>;
  by_department: Array<{ department: string; eligible: number; offers: number; placed_pct: number; avg_ctc: string }>;
  by_role: Array<{ role: string; count: number; max_ctc: string }>;
  by_company: Array<{ company: string; drives: number; offers: number; highest_ctc: string }>;
  by_graduation_year: Array<{ year: number; placed_count: number; target_count: number; completion_pct: number }>;
}

export interface FacultyEngagementOverview {
  total_participating_faculty: number;
  active_faculty_internships: number;
  active_industrial_training: number;
  active_fdps: number;
  research_collaborations: number;
  consultancy_projects: number;
  workshops_guest_lectures: number;
  total_research_grant_value: number;
  active_industry_partners_count: number;
  by_department: Array<{ department: string; faculty_count: number; grants_value: number; fdps: number }>;
  by_opportunity_type: Array<{ type: string; count: number; partner_funded: number }>;
  by_industry_partner: Array<{ partner: string; engagements: number; focus: string }>;
  by_status: Array<{ status: string; count: number }>;
}

export interface CurriculumRecommendationItem {
  id: string;
  skill_area: string;
  industry_demand_index: number;
  student_supply_index: number;
  gap_size: number;
  gap_severity: string;
  departments_affected: string[];
  recommended_modules: string[];
  suggested_labs: string[];
  bootcamp_tracks: string[];
  linked_intervention_id?: string | null;
}

export interface IndustryPartnerSummary {
  partner_name: string;
  domain: string;
  partner_types: string[];
  internships_posted: number;
  students_selected: number;
  placements_offered: number;
  learning_programs_count: number;
  faculty_engagements_count: number;
  research_collaborations_count: number;
  status: string;
}

export interface IndustryPartnershipOverview {
  total_partners: number;
  internship_partners: number;
  placement_partners: number;
  training_partners: number;
  research_partners: number;
  mentorship_partners: number;
  partners: IndustryPartnerSummary[];
}

export interface IndustryPartnerDetail {
  partner_name: string;
  domain: string;
  partner_overview: string;
  student_engagements: Array<{ program: string; students_enrolled: number; status: string; avg_rating: number }>;
  faculty_engagements: Array<{ faculty: string; department: string; role: string; status: string }>;
  posted_opportunities: Array<{ title: string; type: string; stipend?: string; ctc?: string; location: string }>;
  placement_drives: Array<{ drive_title: string; passing_year: number; offers_made: number; status: string }>;
  research_and_consultancy: Array<{ title: string; grant_amount: string; duration_months: number; status: string }>;
  outcome_metrics: Record<string, number>;
}

export interface CourseEffectivenessMetric {
  course_id: string;
  title: string;
  category: string;
  provider: string;
  enrolled_count: number;
  completed_count: number;
  completion_rate: number;
  targeted_skills: string[];
  baseline_readiness_avg: number;
  post_completion_readiness_avg: number;
  readiness_gain: number;
  placement_correlation_rate: number;
  department_participation: Array<{ department: string; students: number }>;
}

export interface LearningEffectivenessOverview {
  total_enrolled: number;
  total_completed: number;
  overall_completion_rate: number;
  average_readiness_gain: number;
  courses: CourseEffectivenessMetric[];
}

export interface AtRiskCohortGroup {
  risk_category: string;
  severity: string;
  affected_students_count: number;
  department: string;
  graduation_year: string | number;
  key_signals: string[];
  recommended_action: string;
}

export interface AtRiskCohortSummary {
  total_at_risk_students: number;
  risk_groups: AtRiskCohortGroup[];
}

export interface InstitutionActionPlan {
  id: string;
  institution_id?: string | null;
  title: string;
  action_type: string;
  related_department: string;
  source_insight: string;
  priority: "critical" | "high" | "medium" | "low" | string;
  owner: string;
  target_date?: string | null;
  status: "planned" | "in_progress" | "completed" | "measured" | string;
  linked_intervention_id?: string | null;
  outcome_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionPlanPayload {
  title: string;
  action_type: string;
  related_department?: string;
  source_insight: string;
  priority?: string;
  owner?: string;
  target_date?: string | null;
  status?: string;
  linked_intervention_id?: string | null;
  outcome_notes?: string | null;
}

export interface InstitutionAlertItem {
  id: string;
  alert_type: string;
  severity: "critical" | "warning" | "info" | string;
  title: string;
  message: string;
  department?: string | null;
  target_tab: string;
  action_label: string;
}

export interface InstitutionAlertsResponse {
  alerts: InstitutionAlertItem[];
}

export interface CollaborationRelationshipItem {
  id: string;
  industry_partner: string;
  faculty_lead: string;
  faculty_department: string;
  student_team_or_cohort: string;
  initiative_title: string;
  initiative_type: string;
  status: string;
  outcome_metric: string;
}

export interface CollaborationRelationshipsResponse {
  total_collaborations: number;
  relationships: CollaborationRelationshipItem[];
}

export interface InstitutionReportResponse {
  report_type: string;
  report_title: string;
  generated_at: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  csv_export_url?: string | null;
}

export interface DigiLockerDocMetadata {
  issuer_id: string;
  issuer_name: string;
  doc_type: string;
  doc_id: string;
  doc_name: string;
  issued_date: string;
  signature_verified: boolean;
  cert_sha256: string;
  apaar_id_hash?: string | null;
}

export interface DigiLockerDocument {
  doc_id: string;
  issuer_id: string;
  issuer_name: string;
  doc_type: string;
  title: string;
  issued_date: string;
  sample_preview: string;
  verifiable_skills: string[];
  metadata: DigiLockerDocMetadata;
}

export interface DigiLockerStatus {
  is_linked: boolean;
  linked_at?: string | null;
  last_sync_at?: string | null;
  masked_aadhaar?: string | null;
  available_documents_count: number;
  imported_credentials_count: number;
}

export interface DigiLockerAuthParams {
  auth_url: string;
  state: string;
  client_id: string;
}

export interface AadhaarOtpGenerateResponse {
  reference_id: string;
  masked_aadhaar: string;
  message: string;
}

export interface DigiLockerImportResult {
  evidence_id: string;
  title: string;
  status: string;
  verification_tier: string;
  signature_verified: boolean;
  message: string;
}


