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

export interface ExtractedSkill {
  id: string;
  skill_id: string;
  canonical_name: string;
  extraction_confidence: number;
  effective_confidence: number;
  verification_tier: VerificationTier;
  evidence_span?: string;
  source_evidence_id: string;
}

export interface Evidence {
  id: string;
  evidence_type: EvidenceType;
  title: string;
  description: string;
  external_url?: string;
  extraction_status: "pending_extraction" | "extracted" | "failed";
  submitted_at: string;
  extracted_skills: ExtractedSkill[];
}

export interface Passport {
  skills: ExtractedSkill[];
  evidence: Evidence[];
}

export interface Skill {
  id: string;
  canonical_name: string;
  category: string;
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

export interface Internship {
  id: string;
  title: string;
  description: string;
  created_at?: string;
}

export interface MatchExplanationLine {
  skill_id: string;
  skill_name: string;
  status: "matched_verified" | "matched_partially_verified" | "matched_unverified" | "semantic_near_match" | "missing";
  contribution: number;
  evidence_id?: string;
  evidence_title?: string;
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
  internship_id: string;
  internship_title: string;
  final_score: number;
  deterministic_score: number;
  semantic_score: number;
  verification_bonus: number;
  explanation?: MatchExplanation;
}

export interface CandidateMatch {
  id: string;
  student_id: string;
  candidate_label: string;
  final_score: number;
  deterministic_score: number;
  semantic_score: number;
  verification_bonus: number;
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
  total?: number;
}
