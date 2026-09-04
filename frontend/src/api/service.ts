import { request } from "./client";
import type {
  AcademicianRegistration,
  Application,
  ApplicationForm,
  ApplicationStatusEvent,
  ApplicationSubmissionAttempt,
  Assessment,
  AssessmentAttempt,
  AuthSession,
  AutomationPolicy,
  AutomationQueueItem,
  CandidateMatch,
  CandidateProfile,
  CareerGoals,
  CareerGuidanceOverview,
  CourseEnrollment,
  AadhaarOtpGenerateResponse,
  DigiLockerAuthParams,
  DigiLockerDocument,
  DigiLockerImportResult,
  DigiLockerStatus,
  EvidenceDetail,
  EvidenceSubmission,
  EvidenceSummary,
  EvidenceUpdate,
  CollaborationWorkspace,
  ExternalJob,
  ExternalJobMatch,
  ExternalJobSyncAllResponse,
  FacultyAdvisedProject,
  FacultyApplication,
  FacultyApplicationCreate,
  FacultyCollaborationHistoryItem,
  FacultyEventRegistration,
  FacultyNotification,
  FacultyOpportunity,
  FacultyHubFilters,
  FacultyPassport,
  FacultyPassportUpdate,
  FacultyVideo,
  FacultyVideoCreateInput,
  FacultyVideoListResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  GitHubIdentity,
  GoogleAuthRequest,
  InnovationChallenge,
  InstitutionAnalyticsOverview,
  InstitutionRegistration,
  Internship,
  InternshipCreate,
  InternshipEngagement,
  InternshipUpdate,
  JobDiscovery,
  JobDiscoveryRun,
  LearningCourse,
  LinkedInImport,
  LoginRequest,
  MatchExplanation,
  MentorFeedbackRequest,
  MentorshipSession,
  PaginatedResponse,
  Passport,
  PlacementCandidateRanking,
  PlacementDrive,
  ProjectApplication,
  ProviderStatusItem,
  RecruiterAnalyticsOverview,
  RecruiterEvidenceConsent,
  RecruiterRegistration,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ResumeDocument,
  StudentAchievement,
  StudentAchievementCreate,
  UserDocument,
  UserDocumentCreate,
  Skill,
  SkillGapAnalysis,
  StudentMatch,
  StudentRegistration,
  TeamSuggestion,
  TeamSuggestionRequest,
  VerificationResult,
  VerifyResetTokenRequest,
  VerifyResetTokenResponse,
  CopilotResponse,
  ProfessionalProfile,
  ActionPlanPayload,
  AtRiskCohortSummary,
  CohortAnalyticsResponse,
  CollaborationRelationshipsResponse,
  CurriculumRecommendationItem,
  DepartmentDetailAnalytics,
  FacultyEngagementOverview,
  IndustryPartnerDetail,
  IndustryPartnershipOverview,
  InstitutionActionPlan,
  InstitutionAlertsResponse,
  InstitutionReportResponse,
  InternshipMonitoringOverview,
  InterventionPlan,
  InterventionPlanPayload,
  InterventionRecommendation,
  LearningEffectivenessOverview,
  PlacementMonitoringOverview,
} from "./types";

export const api = {
  registerStudent: (input: StudentRegistration) => request<AuthSession>("/auth/register/student", { method: "POST", body: JSON.stringify(input) }),
  registerRecruiter: (input: RecruiterRegistration) => request<AuthSession>("/auth/register/recruiter", { method: "POST", body: JSON.stringify(input) }),
  registerAcademician: (input: AcademicianRegistration) => request<AuthSession>("/auth/register/academician", { method: "POST", body: JSON.stringify(input) }),
  registerInstitution: (input: InstitutionRegistration) => request<AuthSession>("/auth/register/institution", { method: "POST", body: JSON.stringify(input) }),
  login: (input: LoginRequest) => request<AuthSession>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  loginGoogle: (input: GoogleAuthRequest) => request<AuthSession>("/auth/google", { method: "POST", body: JSON.stringify(input) }),
  forgotPassword: (input: ForgotPasswordRequest) => request<ForgotPasswordResponse>("/auth/forgot-password", { method: "POST", body: JSON.stringify(input) }),
  verifyResetToken: (input: VerifyResetTokenRequest) => request<VerifyResetTokenResponse>("/auth/verify-reset-token", { method: "POST", body: JSON.stringify(input) }),
  resetPassword: (input: ResetPasswordRequest) => request<ResetPasswordResponse>("/auth/reset-password", { method: "POST", body: JSON.stringify(input) }),
  passport: (token: string) => request<Passport>("/passport/me", {}, token),
  candidateProfile: (token: string) => request<CandidateProfile>("/passport/profile", {}, token),
  submitEvidence: (input: EvidenceSubmission, token: string) => request<EvidenceSummary>("/evidence", { method: "POST", body: JSON.stringify(input) }, token),
  evidence: (id: string, token: string) => request<EvidenceDetail>(`/evidence/${encodeURIComponent(id)}`, {}, token),
  evidences: (token: string, page = 1, pageSize = 20) => request<PaginatedResponse<EvidenceSummary>>(`/evidence?page=${page}&page_size=${pageSize}`, {}, token),
  updateEvidence: (id: string, input: EvidenceUpdate, token: string) => request<EvidenceDetail>(`/evidence/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }, token),
  deleteEvidence: (id: string, token: string) => request<void>(`/evidence/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
  resumes: (token: string) => request<PaginatedResponse<ResumeDocument>>("/resumes", {}, token),
  uploadResume: (file: File, token: string) => { const body = new FormData(); body.append("file", file); return request<ResumeDocument>("/resumes", { method: "POST", body }, token); },
  parseResume: (id: string, token: string) => request<ResumeDocument>(`/resumes/${encodeURIComponent(id)}/parse`, { method: "POST" }, token),
  retryFailedResume: (id: string, token: string) => request<ResumeDocument>(`/resumes/${encodeURIComponent(id)}/retry-failed`, { method: "POST" }, token),
  activateResume: (id: string, token: string) => request<ResumeDocument>(`/resumes/${encodeURIComponent(id)}/activate`, { method: "PUT" }, token),
  deleteResume: (id: string, token: string) => request<void>(`/resumes/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
  linkedinImports: (token: string) => request<PaginatedResponse<LinkedInImport>>("/linkedin/imports", {}, token),
  uploadLinkedInExport: (file: File, token: string) => { const body = new FormData(); body.append("file", file); return request<LinkedInImport>("/linkedin/imports", { method: "POST", body }, token); },
  parseLinkedInExport: (id: string, token: string) => request<LinkedInImport>(`/linkedin/imports/${encodeURIComponent(id)}/parse`, { method: "POST" }, token),
  activateLinkedInExport: (id: string, token: string) => request<LinkedInImport>(`/linkedin/imports/${encodeURIComponent(id)}/activate`, { method: "PUT" }, token),
  deleteLinkedInExport: (id: string, token: string) => request<void>(`/linkedin/imports/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
  requeueEvidence: (id: string, token: string) => request<EvidenceDetail>(`/evidence/${encodeURIComponent(id)}/requeue`, { method: "POST" }, token),
  verifyEvidence: (id: string, token: string) => request<VerificationResult>(`/evidence/${encodeURIComponent(id)}/verify`, { method: "POST", body: JSON.stringify({ check_type: "github_project" }) }, token),
  searchSkills: (query: string, token: string) => request<Skill[]>(`/skills/search?q=${encodeURIComponent(query)}`, {}, token),
  createInternship: (input: InternshipCreate, token: string) => request<Internship>("/internships", { method: "POST", body: JSON.stringify(input) }, token),
  internship: (id: string, token: string) => request<Internship>(`/internships/${encodeURIComponent(id)}`, {}, token),
  updateInternship: (id: string, input: InternshipUpdate, token: string) => request<Internship>(`/internships/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }, token),
  deleteInternship: (id: string, token: string) => request<void>(`/internships/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
  internshipMatches: (id: string, token: string, page = 1, pageSize = 20) => request<PaginatedResponse<CandidateMatch>>(`/internships/${encodeURIComponent(id)}/matches?page=${page}&page_size=${pageSize}`, {}, token),
  internships: (token: string, page = 1, pageSize = 20) => request<PaginatedResponse<Internship>>(`/internships?page=${page}&page_size=${pageSize}`, {}, token),
  externalJobs: (
    token: string,
    options?: {
      page?: number;
      pageSize?: number;
      provider?: string;
      location?: string;
      remote?: boolean;
      query?: string;
      employmentType?: string;
      experienceLevel?: string;
      postedWithinDays?: number;
    }
  ) => {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (options?.provider && options.provider !== "all") params.append("provider", options.provider);
    if (options?.location) params.append("location", options.location);
    if (options?.remote !== undefined) params.append("remote", String(options.remote));
    if (options?.query) params.append("query", options.query);
    if (options?.employmentType) params.append("employment_type", options.employmentType);
    if (options?.experienceLevel) params.append("experience_level", options.experienceLevel);
    if (options?.postedWithinDays) params.append("posted_within_days", String(options.postedWithinDays));
    return request<PaginatedResponse<ExternalJob>>(`/external-jobs?${params.toString()}`, {}, token);
  },
  providers: (token: string) => request<ProviderStatusItem[]>("/external-jobs/providers", {}, token),
  syncAllExternalJobs: (token: string) => request<ExternalJobSyncAllResponse>("/external-jobs/sync-all", { method: "POST" }, token),
  externalJobMatches: (
    token: string,
    options?: {
      page?: number;
      pageSize?: number;
      provider?: string;
      location?: string;
      remote?: boolean;
      employmentType?: string;
      query?: string;
      sortBy?: "best_match" | "newest" | "recently_added";
    }
  ) => {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (options?.provider && options.provider !== "all") params.append("provider", options.provider);
    if (options?.location) params.append("location", options.location);
    if (options?.remote !== undefined) params.append("remote", String(options.remote));
    if (options?.employmentType) params.append("employment_type", options.employmentType);
    if (options?.query) params.append("query", options.query);
    if (options?.sortBy) params.append("sort_by", options.sortBy);
    return request<PaginatedResponse<ExternalJobMatch>>(`/external-jobs/matches?${params.toString()}`, {}, token);
  },
  recomputeExternalJobMatches: (token: string) => request<ExternalJobMatch[]>("/external-jobs/matches/recompute", { method: "POST" }, token),
  applications: (token: string, page = 1, pageSize = 20) => request<PaginatedResponse<Application>>(`/applications?page=${page}&page_size=${pageSize}`, {}, token),
  createApplication: (externalJobId: string, externalJobMatchId: string, token: string) => request<Application>("/applications", { method: "POST", body: JSON.stringify({ external_job_id: externalJobId, external_job_match_id: externalJobMatchId }) }, token),
  requestApplicationApproval: (id: string, token: string) => request<Application>(`/applications/${encodeURIComponent(id)}/request-approval`, { method: "POST" }, token),
  approveApplication: (id: string, token: string) => request<Application>(`/applications/${encodeURIComponent(id)}/approve`, { method: "POST" }, token),
  revokeApplicationApproval: (id: string, token: string) => request<Application>(`/applications/${encodeURIComponent(id)}/revoke-approval`, { method: "POST" }, token),
  selectManualApplication: (id: string, token: string) => request<Application>(`/applications/${encodeURIComponent(id)}/manual`, { method: "POST" }, token),
  withdrawApplication: (id: string, token: string) => request<Application>(`/applications/${encodeURIComponent(id)}/withdraw`, { method: "POST" }, token),
  prepareApplication: (id: string, token: string) => request<ApplicationForm>(`/applications/${encodeURIComponent(id)}/prepare`, { method: "POST" }, token),
  applicationForm: (id: string, token: string) => request<ApplicationForm>(`/applications/${encodeURIComponent(id)}/form`, {}, token),
  updateApplicationAnswers: (id: string, answers: Record<string, unknown>, token: string) => request<ApplicationForm>(`/applications/${encodeURIComponent(id)}/answers`, { method: "PUT", body: JSON.stringify({ answers }) }, token),
  readyApplication: (id: string, token: string) => request<Application>(`/applications/${encodeURIComponent(id)}/ready`, { method: "POST" }, token),
  submitApplication: (id: string, token: string) => request<Application>(`/applications/${encodeURIComponent(id)}/submit`, { method: "POST" }, token),
  applicationTimeline: (id: string, token: string) => request<ApplicationStatusEvent[]>(`/applications/${encodeURIComponent(id)}/timeline`, {}, token),
  applicationAttempts: (id: string, token: string) => request<ApplicationSubmissionAttempt[]>(`/applications/${encodeURIComponent(id)}/attempts`, {}, token),
  markManualSubmission: (id: string, token: string, input: { submitted_at?: string; provider_reference?: string }) => request<Application>(`/applications/${encodeURIComponent(id)}/mark-manual-submitted`, { method: "POST", body: JSON.stringify(input) }, token),
  reconcileApplication: (id: string, token: string) => request<Application>(`/applications/${encodeURIComponent(id)}/reconcile`, { method: "POST" }, token),
  jobDiscoveries: (token: string) => request<PaginatedResponse<JobDiscovery>>("/job-discoveries", {}, token),
  createJobDiscovery: (input: Omit<JobDiscovery, "id" | "student_id" | "last_run_at" | "next_run_at" | "created_at" | "updated_at">, token: string) => request<JobDiscovery>("/job-discoveries", { method: "POST", body: JSON.stringify(input) }, token),
  updateJobDiscovery: (id: string, input: Partial<JobDiscovery>, token: string) => request<JobDiscovery>(`/job-discoveries/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }, token),
  deleteJobDiscovery: (id: string, token: string) => request<void>(`/job-discoveries/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
  runJobDiscovery: (id: string, token: string) => request<JobDiscoveryRun>(`/job-discoveries/${encodeURIComponent(id)}/run`, { method: "POST" }, token),
  jobDiscoveryRuns: (id: string, token: string) => request<PaginatedResponse<JobDiscoveryRun>>(`/job-discoveries/${encodeURIComponent(id)}/runs`, {}, token),
  automationPolicies: (token: string) => request<PaginatedResponse<AutomationPolicy>>("/automation-policies", {}, token),
  createAutomationPolicy: (input: Omit<AutomationPolicy, "id" | "student_id" | "last_applied_at" | "created_at" | "updated_at">, token: string) => request<AutomationPolicy>("/automation-policies", { method: "POST", body: JSON.stringify(input) }, token),
  updateAutomationPolicy: (id: string, input: Partial<AutomationPolicy>, token: string) => request<AutomationPolicy>(`/automation-policies/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }, token),
  automationReviewQueue: (token: string) => request<PaginatedResponse<AutomationQueueItem>>("/automation-review-queue", {}, token),
  studentMatches: (token: string, page = 1, pageSize = 20) => request<PaginatedResponse<StudentMatch>>(`/students/me/matches?page=${page}&page_size=${pageSize}`, {}, token),
  recomputeStudentMatches: (token: string) => request<StudentMatch[]>("/students/me/matches/recompute", { method: "POST" }, token),
  recomputeInternshipMatches: (id: string, token: string) => request<CandidateMatch[]>(`/internships/${encodeURIComponent(id)}/matches/recompute`, { method: "POST" }, token),
  explanation: (id: string, token: string) => request<MatchExplanation>(`/matches/${encodeURIComponent(id)}/explanation`, {}, token),
  recruiterEvidenceConsent: (token: string) => request<RecruiterEvidenceConsent>("/passport/consent", {}, token),
  setRecruiterEvidenceConsent: (recruiterEvidenceConsent: boolean, token: string) => request<RecruiterEvidenceConsent>("/passport/consent", { method: "PUT", body: JSON.stringify({ recruiter_evidence_consent: recruiterEvidenceConsent }) }, token),
  githubIdentity: (token: string) => request<GitHubIdentity>("/passport/github-identity", {}, token),
  setGithubIdentity: (githubUsername: string, token: string) => request<GitHubIdentity>("/passport/github-identity", { method: "PUT", body: JSON.stringify({ github_username: githubUsername }) }, token),
  suggestTeams: (input: TeamSuggestionRequest, token: string) => request<TeamSuggestion[]>("/teams/suggest", { method: "POST", body: JSON.stringify(input) }, token),

  // Career Goals & Skill Gaps
  getCareerGoals: (token: string) => request<CareerGoals>("/career-goals", {}, token),
  updateCareerGoals: (input: CareerGoals, token: string) => request<CareerGoals>("/career-goals", { method: "PUT", body: JSON.stringify(input) }, token),
  getSkillGapAnalysis: (token: string, targetRole?: string) => request<SkillGapAnalysis>(`/skill-gaps/analyze${targetRole ? `?target_role=${encodeURIComponent(targetRole)}` : ""}`, {}, token),

  // Skill Assessments
  getAssessments: (token?: string) => request<Assessment[]>("/assessments", {}, token),
  getAssessment: (id: string, token?: string) => request<Assessment>(`/assessments/${encodeURIComponent(id)}`, {}, token),
  submitAssessment: (id: string, answers: Record<string, string>, token: string) => request<AssessmentAttempt>(`/assessments/${encodeURIComponent(id)}/submit`, { method: "POST", body: JSON.stringify({ answers }) }, token),

  // Learning Hub
  getCourses: (token: string, category?: string, skill?: string) => {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    if (skill) params.append("skill", skill);
    return request<LearningCourse[]>(`/learning/courses?${params.toString()}`, {}, token);
  },
  enrollCourse: (courseId: string, token: string) => request<CourseEnrollment>(`/learning/courses/${encodeURIComponent(courseId)}/enroll`, { method: "POST" }, token),
  updateCourseProgress: (courseId: string, progress: number, token: string) => request<CourseEnrollment>(`/learning/courses/${encodeURIComponent(courseId)}/progress`, { method: "PUT", body: JSON.stringify({ progress }) }, token),

  // Campus Placement Drives
  getPlacementDrives: (token: string) => request<PlacementDrive[]>("/placements/drives", {}, token),
  createPlacementDrive: (input: Omit<PlacementDrive, "id" | "is_registered" | "registration_status">, token: string) => request<PlacementDrive>("/placements/drives", { method: "POST", body: JSON.stringify(input) }, token),
  registerPlacement: (placementDriveId: string, token: string, notes?: string) => request<PlacementDrive>("/placements/register", { method: "POST", body: JSON.stringify({ placement_drive_id: placementDriveId, notes }) }, token),
  getPlacementCandidates: (driveId: string, token: string) => request<PlacementCandidateRanking[]>(`/placements/drives/${encodeURIComponent(driveId)}/candidates`, {}, token),
  updatePlacementStage: (registrationId: string, stage: string, token: string, extra?: { interview_date?: string; interview_notes?: string; offer_details?: Record<string, unknown> }) => request<PlacementCandidateRanking>(`/placements/registrations/${encodeURIComponent(registrationId)}/stage`, { method: "PATCH", body: JSON.stringify({ stage, ...extra }) }, token),

  // Internship Engagements & Mentorship Lifecycle
  getMyInternshipEngagements: (token: string) => request<InternshipEngagement[]>("/internship-engagements/me", {}, token),
  getRecruiterInternshipEngagements: (token: string, internshipId?: string) => request<InternshipEngagement[]>(`/internship-engagements/recruiter${internshipId ? `?internship_id=${encodeURIComponent(internshipId)}` : ""}`, {}, token),
  createInternshipEngagement: (input: { internship_id: string; student_id: string; mentor_name?: string; mentor_email?: string; start_date?: string; end_date?: string }, token: string) => request<InternshipEngagement>("/internship-engagements", { method: "POST", body: JSON.stringify(input) }, token),
  updateInternshipEngagementStatus: (id: string, input: { status?: string; progress_percentage?: number; mentor_name?: string; mentor_email?: string; completion_notes?: string; final_rating?: number }, token: string) => request<InternshipEngagement>(`/internship-engagements/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify(input) }, token),
  submitMentorFeedback: (id: string, feedback: MentorFeedbackRequest, token: string) => request<InternshipEngagement>(`/internship-engagements/${encodeURIComponent(id)}/feedback`, { method: "POST", body: JSON.stringify(feedback) }, token),

  // Academician & Faculty Ecosystem (Phase 1 & Phase 2)
  getFacultyPassport: (token: string) => request<FacultyPassport>("/academician/passport/me", {}, token),
  updateFacultyPassport: (input: FacultyPassportUpdate, token: string) => request<FacultyPassport>("/academician/passport/me", { method: "PUT", body: JSON.stringify(input) }, token),
  getFacultyPublicPassport: (facultyId: string, token: string) => request<FacultyPassport>(`/academician/passport/${encodeURIComponent(facultyId)}`, {}, token),
  getFacultyOpportunities: (token: string, opportunityType?: string) => request<FacultyOpportunity[]>(`/academician/opportunities${opportunityType && opportunityType !== "all" ? `?opportunity_type=${encodeURIComponent(opportunityType)}` : ""}`, {}, token),
  getFacultyOpportunityDetail: (id: string, token: string) => request<FacultyOpportunity>(`/academician/opportunities/${encodeURIComponent(id)}`, {}, token),
  getFacultyHubOpportunities: (token: string, filters: FacultyHubFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        const normalizedValue =
          key === "deadline_from" && /^\d{4}-\d{2}-\d{2}$/.test(String(value))
            ? `${value}T00:00:00Z`
            : key === "deadline_to" && /^\d{4}-\d{2}-\d{2}$/.test(String(value))
              ? `${value}T23:59:59Z`
              : String(value);
        params.set(key, normalizedValue);
      }
    });
    const query = params.toString();
    return request<FacultyOpportunity[]>(`/academician/hub/opportunities${query ? `?${query}` : ""}`, {}, token);
  },
  getFacultyHubOpportunity: (id: string, token: string) => request<FacultyOpportunity>(`/academician/hub/opportunities/${encodeURIComponent(id)}`, {}, token),
  saveFacultyHubOpportunity: (id: string, token: string) => request<FacultyOpportunity>(`/academician/hub/opportunities/${encodeURIComponent(id)}/saved`, { method: "PUT" }, token),
  unsaveFacultyHubOpportunity: (id: string, token: string) => request<void>(`/academician/hub/opportunities/${encodeURIComponent(id)}/saved`, { method: "DELETE" }, token),
  getFacultyApplications: (token: string, status?: string) => request<FacultyApplication[]>(`/academician/applications/me${status ? `?status=${encodeURIComponent(status)}` : ""}`, {}, token),
  createFacultyApplication: (input: FacultyApplicationCreate, token: string) => request<FacultyApplication>("/academician/applications", { method: "POST", body: JSON.stringify(input) }, token),
  applyFacultyOpportunity: (opportunityId: string, proposalText: string, token: string) => request<FacultyApplication>("/academician/apply", { method: "POST", body: JSON.stringify({ opportunity_id: opportunityId, proposal_text: proposalText }) }, token),
  getFacultyApplicationDetail: (id: string, token: string) => request<FacultyApplication>(`/academician/applications/${encodeURIComponent(id)}`, {}, token),
  updateFacultyApplication: (id: string, input: Partial<FacultyApplicationCreate>, token: string) => request<FacultyApplication>(`/academician/applications/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) }, token),
  submitFacultyApplication: (id: string, token: string) => request<FacultyApplication>(`/academician/applications/${encodeURIComponent(id)}/submit`, { method: "POST" }, token),
  withdrawFacultyApplication: (id: string, token: string) => request<FacultyApplication>(`/academician/applications/${encodeURIComponent(id)}/withdraw`, { method: "POST" }, token),

  // Workspaces
  getFacultyWorkspaces: (token: string) => request<CollaborationWorkspace[]>("/academician/workspaces", {}, token),
  getFacultyWorkspace: (id: string, token: string) => request<CollaborationWorkspace>(`/academician/workspaces/${encodeURIComponent(id)}`, {}, token),
  updateWorkspaceMilestones: (workspaceId: string, payload: { milestone_id: string; title?: string; status: string; due_date?: string; notes?: string }, token: string) => request<CollaborationWorkspace>(`/academician/workspaces/${encodeURIComponent(workspaceId)}/milestones`, { method: "PUT", body: JSON.stringify(payload) }, token),
  createWorkspaceTask: (workspaceId: string, payload: { title: string; assigned_to: string; due_date?: string; priority?: string; status?: string }, token: string) => request<CollaborationWorkspace>(`/academician/workspaces/${encodeURIComponent(workspaceId)}/tasks`, { method: "POST", body: JSON.stringify(payload) }, token),
  updateWorkspaceTask: (workspaceId: string, payload: { task_id: string; status: string }, token: string) => request<CollaborationWorkspace>(`/academician/workspaces/${encodeURIComponent(workspaceId)}/tasks`, { method: "PUT", body: JSON.stringify(payload) }, token),
  createWorkspaceDiscussion: (workspaceId: string, payload: { author_name: string; author_role: string; content: string }, token: string) => request<CollaborationWorkspace>(`/academician/workspaces/${encodeURIComponent(workspaceId)}/discussions`, { method: "POST", body: JSON.stringify(payload) }, token),
  submitWorkspaceDeliverable: (workspaceId: string, payload: { title: string; deliverable_type: string; url_or_key: string; notes?: string }, token: string) => request<CollaborationWorkspace>(`/academician/workspaces/${encodeURIComponent(workspaceId)}/deliverables`, { method: "POST", body: JSON.stringify(payload) }, token),
  submitWorkspaceFeedback: (workspaceId: string, payload: { author_name: string; author_role: string; rating: number; comments: string }, token: string) => request<CollaborationWorkspace>(`/academician/workspaces/${encodeURIComponent(workspaceId)}/feedback`, { method: "POST", body: JSON.stringify(payload) }, token),
  completeWorkspace: (workspaceId: string, token: string, outcomeSummary?: string) => request<CollaborationWorkspace>(`/academician/workspaces/${encodeURIComponent(workspaceId)}/complete${outcomeSummary ? `?outcome_summary=${encodeURIComponent(outcomeSummary)}` : ""}`, { method: "POST" }, token),

  // Events, Mentorship & History
  registerFacultyEvent: (input: { event_id: string; event_type: string; event_title: string; host_organization: string; role?: string; scheduled_at?: string }, token: string) => request<FacultyEventRegistration>("/academician/events/register", { method: "POST", body: JSON.stringify(input) }, token),
  getMyFacultyEvents: (token: string) => request<FacultyEventRegistration[]>("/academician/events/me", {}, token),
  getFacultyNotifications: (token: string) => request<FacultyNotification[]>("/academician/notifications", {}, token),
  markFacultyNotificationRead: (id: string, token: string) => request<void>(`/academician/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" }, token),
  getFacultyCollaborationHistory: (token: string) => request<FacultyCollaborationHistoryItem[]>("/academician/history/me", {}, token),

  // Live Project Advising
  getFacultyAdvisedProjects: (token: string) => request<FacultyAdvisedProject[]>("/academician/live-projects/advising", {}, token),
  submitFacultyProjectFeedback: (projectApplicationId: string, feedback: string, grade: string | undefined, token: string) => request<{ status: string; message: string }>("/academician/live-projects/feedback", { method: "POST", body: JSON.stringify({ project_application_id: projectApplicationId, feedback, grade_or_endorsement: grade }) }, token),

  // Recruiter Faculty Application Review
  getRecruiterFacultyApplications: (token: string) => request<FacultyApplication[]>("/academician/recruiter/applications", {}, token),
  updateRecruiterFacultyApplicationStatus: (applicationId: string, payload: { status: string; reviewer_notes?: string; feedback?: string; industry_mentor_name?: string; industry_mentor_email?: string }, token: string) => request<FacultyApplication>(`/academician/recruiter/applications/${encodeURIComponent(applicationId)}/status`, { method: "PUT", body: JSON.stringify(payload) }, token),

  // Institution Decision-Support Portal & Analytics
  getInstitutionAnalytics: (token: string) => request<InstitutionAnalyticsOverview>("/institution/analytics", {}, token),
  getDepartmentDetail: (dept: string, token: string) => request<DepartmentDetailAnalytics>(`/institution/departments/${encodeURIComponent(dept)}`, {}, token),
  getCohorts: (token: string, filters?: { department?: string; graduation_year?: string; readiness_band?: string; internship_status?: string; placement_status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.department) params.append("department", filters.department);
    if (filters?.graduation_year) params.append("graduation_year", filters.graduation_year);
    if (filters?.readiness_band) params.append("readiness_band", filters.readiness_band);
    if (filters?.internship_status) params.append("internship_status", filters.internship_status);
    if (filters?.placement_status) params.append("placement_status", filters.placement_status);
    const qs = params.toString();
    return request<CohortAnalyticsResponse>(`/institution/cohorts${qs ? `?${qs}` : ""}`, {}, token);
  },
  getInterventionRecommendations: (token: string) => request<InterventionRecommendation[]>("/institution/interventions/recommendations", {}, token),
  getInterventionPlans: (token: string) => request<InterventionPlan[]>("/institution/interventions", {}, token),
  createInterventionPlan: (input: InterventionPlanPayload, token: string) => request<InterventionPlan>("/institution/interventions", { method: "POST", body: JSON.stringify(input) }, token),
  updateInterventionPlan: (id: string, input: Partial<InterventionPlanPayload>, token: string) => request<InterventionPlan>(`/institution/interventions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }, token),
  deleteInterventionPlan: (id: string, token: string) => request<{ ok: boolean }>(`/institution/interventions/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
  getInternshipMonitoring: (token: string) => request<InternshipMonitoringOverview>("/institution/internships/monitoring", {}, token),
  getPlacementMonitoring: (token: string) => request<PlacementMonitoringOverview>("/institution/placements/monitoring", {}, token),
  getFacultyEngagement: (token: string) => request<FacultyEngagementOverview>("/institution/faculty-engagement", {}, token),
  getCurriculumRecommendations: (token: string) => request<CurriculumRecommendationItem[]>("/institution/curriculum-recommendations", {}, token),
  getIndustryPartnerships: (token: string) => request<IndustryPartnershipOverview>("/institution/partnerships", {}, token),
  getIndustryPartnerDetail: (partnerName: string, token: string) => request<IndustryPartnerDetail>(`/institution/partnerships/${encodeURIComponent(partnerName)}`, {}, token),
  getLearningEffectiveness: (token: string) => request<LearningEffectivenessOverview>("/institution/learning-effectiveness", {}, token),
  getAtRiskCohorts: (token: string) => request<AtRiskCohortSummary>("/institution/at-risk-cohorts", {}, token),
  getActionPlans: (token: string) => request<InstitutionActionPlan[]>("/institution/action-plans", {}, token),
  createActionPlan: (input: ActionPlanPayload, token: string) => request<InstitutionActionPlan>("/institution/action-plans", { method: "POST", body: JSON.stringify(input) }, token),
  updateActionPlan: (id: string, input: Partial<ActionPlanPayload>, token: string) => request<InstitutionActionPlan>(`/institution/action-plans/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }, token),
  deleteActionPlan: (id: string, token: string) => request<{ ok: boolean }>(`/institution/action-plans/${encodeURIComponent(id)}`, { method: "DELETE" }, token),
  getInstitutionAlerts: (token: string) => request<InstitutionAlertsResponse>("/institution/alerts", {}, token),
  getCollaborationRelationships: (token: string) => request<CollaborationRelationshipsResponse>("/institution/relationships", {}, token),
  getInstitutionReport: (reportType: string, token: string) => request<InstitutionReportResponse>(`/institution/reports/${encodeURIComponent(reportType)}`, {}, token),

  // Collaborations & Live Industry Projects
  getMentorshipSessions: (token: string) => request<MentorshipSession[]>("/collaborations/mentorship", {}, token),
  getInnovationChallenges: (token: string, challengeType?: string) => request<InnovationChallenge[]>(`/collaborations/challenges${challengeType ? `?challenge_type=${encodeURIComponent(challengeType)}` : ""}`, {}, token),
  applyProjectApplication: (challengeId: string, teamMembers: string[], token: string, submissionNotes?: string) => request<ProjectApplication>("/collaborations/projects/apply", { method: "POST", body: JSON.stringify({ challenge_id: challengeId, team_members: teamMembers, submission_notes: submissionNotes }) }, token),
  getMyProjectApplications: (token: string) => request<ProjectApplication[]>("/collaborations/projects/me", {}, token),

  // Career Guidance Module
  getCareerGuidance: (token: string) => request<CareerGuidanceOverview>("/career-guidance/overview", {}, token),

  // Secure Document Management Vault
  getUserDocuments: (token: string, documentType?: string) => request<UserDocument[]>(`/documents${documentType ? `?document_type=${encodeURIComponent(documentType)}` : ""}`, {}, token),
  uploadUserDocument: (input: UserDocumentCreate, token: string) => request<UserDocument>("/documents", { method: "POST", body: JSON.stringify(input) }, token),
  deleteUserDocument: (id: string, token: string) => request<void>(`/documents/${encodeURIComponent(id)}`, { method: "DELETE" }, token),

  // Student Digital Portfolio Achievements
  getStudentAchievements: (token: string) => request<StudentAchievement[]>("/achievements/me", {}, token),
  addStudentAchievement: (input: StudentAchievementCreate, token: string) => request<StudentAchievement>("/achievements", { method: "POST", body: JSON.stringify(input) }, token),

  // Recruiter / Industry Skill Demand Analytics
  getRecruiterAnalytics: (token: string) => request<RecruiterAnalyticsOverview>("/recruiter-analytics/me", {}, token),

  // Lumina Intel Copilot
  queryCopilot: (query: string, token: string) => request<CopilotResponse>("/copilot/query", { method: "POST", body: JSON.stringify({ query }) }, token),

  // LinkedIn Direct URL Import
  importLinkedInUrl: (profile_url: string, token: string) => request<ProfessionalProfile>("/linkedin/imports/import-url", { method: "POST", body: JSON.stringify({ profile_url }) }, token),
  saveLinkedInProfile: (profile: ProfessionalProfile, token: string) => request<EvidenceSummary>("/linkedin/imports/save-profile", { method: "POST", body: JSON.stringify(profile) }, token),

  // DigiLocker Verifiable Credential Engine
  getDigiLockerAuthUrl: (token: string, redirectUri?: string) => request<DigiLockerAuthParams>(`/digilocker/auth-url${redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : ""}`, {}, token),
  submitDigiLockerCallback: (code: string, state: string, token: string, aadhaar_number?: string, apaar_id?: string) => request<DigiLockerStatus>("/digilocker/callback", { method: "POST", body: JSON.stringify({ code, state, aadhaar_number, apaar_id }) }, token),
  generateAadhaarOtp: (aadhaar_number: string, token: string) => request<AadhaarOtpGenerateResponse>("/digilocker/aadhaar/generate-otp", { method: "POST", body: JSON.stringify({ aadhaar_number }) }, token),
  verifyAadhaarOtp: (reference_id: string, otp: string, token: string, aadhaar_number?: string) => request<DigiLockerStatus>("/digilocker/aadhaar/verify-otp", { method: "POST", body: JSON.stringify({ reference_id, otp, aadhaar_number }) }, token),
  getDigiLockerStatus: (token: string) => request<DigiLockerStatus>("/digilocker/status", {}, token),
  getDigiLockerDocuments: (token: string) => request<DigiLockerDocument[]>("/digilocker/documents", {}, token),
  importDigiLockerCredential: (doc_id: string, token: string, custom_title?: string) => request<DigiLockerImportResult>("/digilocker/import", { method: "POST", body: JSON.stringify({ doc_id, custom_title }) }, token),
  unlinkDigiLocker: (token: string) => request<DigiLockerStatus>("/digilocker/unlink", { method: "DELETE" }, token),

  // Faculty Video Lectures & Student Discovery
  getFacultyVideosCatalog: (token?: string, filters?: { faculty_name?: string; subject?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.faculty_name && filters.faculty_name !== "All") params.append("faculty_name", filters.faculty_name);
    if (filters?.subject && filters.subject !== "All") params.append("subject", filters.subject);
    if (filters?.search) params.append("search", filters.search);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return request<FacultyVideoListResponse>(`/learning/faculty-videos${qs}`, {}, token);
  },
  recordFacultyVideoView: (videoId: string, token?: string) => request<{ views_count: number }>(`/learning/faculty-videos/${encodeURIComponent(videoId)}/view`, { method: "POST" }, token),
  getOwnFacultyVideos: (token: string) => request<FacultyVideo[]>("/academician/videos", {}, token),
  createFacultyVideo: (input: FacultyVideoCreateInput, token: string) => request<FacultyVideo>("/academician/videos", { method: "POST", body: JSON.stringify(input) }, token),
  uploadFacultyVideoFile: async (formData: FormData, token: string) => {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    const res = await fetch(`${apiBase}/academician/videos/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Failed to upload video" }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json() as Promise<FacultyVideo>;
  },
  deleteFacultyVideo: (videoId: string, token: string) => request<void>(`/academician/videos/${encodeURIComponent(videoId)}`, { method: "DELETE" }, token),
};
