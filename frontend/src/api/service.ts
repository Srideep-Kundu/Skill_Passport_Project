import { request } from "./client";
import type {
  AuthSession, CandidateMatch, EvidenceDetail, EvidenceSubmission, EvidenceSummary, Internship, InternshipCreate,
  LoginRequest, MatchExplanation, PaginatedResponse, Passport, RecruiterRegistration, Skill,
  StudentMatch, StudentRegistration, TeamSuggestion, TeamSuggestionRequest, VerificationResult, RecruiterEvidenceConsent,
} from "./types";

export const api = {
  registerStudent: (input: StudentRegistration) => request<AuthSession>("/auth/register/student", { method: "POST", body: JSON.stringify(input) }),
  registerRecruiter: (input: RecruiterRegistration) => request<AuthSession>("/auth/register/recruiter", { method: "POST", body: JSON.stringify(input) }),
  login: (input: LoginRequest) => request<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  passport: (token: string) => request<Passport>("/passport/me", {}, token),
  submitEvidence: (input: EvidenceSubmission, token: string) => request<EvidenceSummary>("/evidence", { method: "POST", body: JSON.stringify(input) }, token),
  evidence: (id: string, token: string) => request<EvidenceDetail>(`/evidence/${encodeURIComponent(id)}`, {}, token),
  requeueEvidence: (id: string, token: string) => request<EvidenceDetail>(`/evidence/${encodeURIComponent(id)}/requeue`, { method: "POST" }, token),
  verifyEvidence: (id: string, checkType: string, token: string) => request<VerificationResult>(`/evidence/${encodeURIComponent(id)}/verify`, { method: "POST", body: JSON.stringify({ check_type: checkType }) }, token),
  searchSkills: (query: string, token: string) => request<Skill[]>(`/skills/search?q=${encodeURIComponent(query)}`, {}, token),
  createInternship: (input: InternshipCreate, token: string) => request<Internship>("/internships", { method: "POST", body: JSON.stringify(input) }, token),
  internshipMatches: async (id: string, token: string): Promise<CandidateMatch[]> => {
    const response = await request<CandidateMatch[] | PaginatedResponse<CandidateMatch>>(`/internships/${encodeURIComponent(id)}/matches`, {}, token);
    return Array.isArray(response) ? response : response.items;
  },
  internships: async (token: string): Promise<Internship[]> => {
    const response = await request<Internship[] | PaginatedResponse<Internship>>("/internships", {}, token);
    return Array.isArray(response) ? response : response.items;
  },
  studentMatches: async (token: string): Promise<StudentMatch[]> => {
    const response = await request<StudentMatch[] | PaginatedResponse<StudentMatch>>("/students/me/matches", {}, token);
    return Array.isArray(response) ? response : response.items;
  },
  explanation: (id: string, token: string) => request<MatchExplanation>(`/matches/${encodeURIComponent(id)}/explanation`, {}, token),
  recruiterEvidenceConsent: (token: string) => request<RecruiterEvidenceConsent>("/passport/consent", {}, token),
  setRecruiterEvidenceConsent: (recruiterEvidenceConsent: boolean, token: string) => request<RecruiterEvidenceConsent>("/passport/consent", { method: "PUT", body: JSON.stringify({ recruiter_evidence_consent: recruiterEvidenceConsent }) }, token),
  suggestTeams: (input: TeamSuggestionRequest, token: string) => request<TeamSuggestion[]>("/teams/suggest", { method: "POST", body: JSON.stringify(input) }, token),
};
