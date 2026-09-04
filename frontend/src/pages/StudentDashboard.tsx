import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { ApiError, api } from "../api";
import type {
  Passport,
  StudentMatch,
  CandidateProfile,
  Application,
  JobDiscovery,
  AutomationQueueItem,
} from "../api";
import { ErrorState } from "../components/AsyncState";
import { EvidenceUpload } from "./EvidenceUpload";
import { DigiLockerVerification } from "../components/DigiLockerVerification";
import { EvidenceLifecycle } from "../components/EvidenceLifecycle";
import { ExternalJobs } from "../components/ExternalJobs";
import { InternshipMatches } from "../components/InternshipMatches";
import { ResumeIntelligence } from "../components/ResumeIntelligence";
import { LinkedInIntelligence } from "../components/LinkedInIntelligence";
import { UnifiedCandidateProfile } from "../components/UnifiedCandidateProfile";
import { GitHubVerification } from "./GitHubVerification";
import { SkillBadge } from "../components/SkillBadge";
import { TeamSuggestions } from "./TeamSuggestions";
import { SkillGapAnalyzer } from "../components/SkillGapAnalyzer";
import { SkillAssessments } from "../components/SkillAssessments";
import { LearningHub } from "../components/LearningHub";
import { PlacementDrives } from "../components/PlacementDrives";
import { CollaborationHub } from "../components/CollaborationHub";
import { EditorialPageHeader, MetricReadout, LiquidGlassButton } from "../components/ui/EditorialPrimitives";
import type { StudentTab } from "../App";

const headerContentMap: Record<StudentTab, { title: string; subtitle: string; category: string }> = {
  overview: {
    category: "STUDENT / 01",
    title: "Your career, made visible.",
    subtitle: "Every passport skill traces to concrete evidence records and deterministic matching.",
  },
  passport: {
    category: "STUDENT / 02",
    title: "Unified Lumina Intel Passport",
    subtitle: "Consolidated verifiable skill records, cryptographic evidence graph, and verified competencies.",
  },
  project_assessments: {
    category: "STUDENT / 04",
    title: "Skill & Project Assessments",
    subtitle: "Complete recruiter-assigned GitHub repository evaluations and standardized diagnostic tests.",
  },
  gaps: {
    category: "STUDENT / 03",
    title: "Career Goals & Skill Gap Analysis",
    subtitle: "Compare your verified passport against target roles to identify critical missing competencies.",
  },
  assessments: {
    category: "STUDENT / 04",
    title: "Skill & Project Assessments",
    subtitle: "Complete recruiter-assigned GitHub repository evaluations and standardized diagnostic tests.",
  },
  learning: {
    category: "STUDENT / 05",
    title: "Adaptive Learning Hub",
    subtitle: "Curated coursework and resources directly addressing your career readiness gaps.",
  },
  placements: {
    category: "STUDENT / 06",
    title: "Campus Placement Drives",
    subtitle: "Apply directly to verified institutional placement opportunities with full evidence portfolios.",
  },
  collaborations: {
    category: "STUDENT / 07",
    title: "Mentorship & Collaborative Ecosystem",
    subtitle: "Book 1-on-1 industry mentorship slots and enter innovation challenges.",
  },
  evidence: {
    category: "STUDENT / 08",
    title: "Evidence & Verification Engine",
    subtitle: "Upload project repositories, certifications, and code artifacts to extract validated skills.",
  },
  github: {
    category: "STUDENT / 09",
    title: "GitHub Verification & Audit",
    subtitle: "Cryptographic commit hash audits, code ownership proof, and contribution verification.",
  },
  discovery: {
    category: "STUDENT / 10",
    title: "Job Discovery Market",
    subtitle: "Intelligent job search automation, background polling, and recruiter evidence controls.",
  },
  teams: {
    category: "STUDENT / 11",
    title: "Deterministic Team Formation",
    subtitle: "Assemble balanced engineering teams based on verifiable complementary skill coverage.",
  },
  matches: {
    category: "STUDENT / 12",
    title: "Ranked Internship Opportunities",
    subtitle: "Audit match scores, exact taxonomical overlaps, and semantic embedding proximity.",
  },
};

export function StudentDashboard({
  token,
  activeTab = "overview",
  onNavigateTab,
}: {
  token: string;
  activeTab?: StudentTab;
  onNavigateTab?: (tab: StudentTab) => void;
}) {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [matches, setMatches] = useState<StudentMatch[] | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [queueItems, setQueueItems] = useState<AutomationQueueItem[]>([]);
  const [discoveries, setDiscoveries] = useState<JobDiscovery[]>([]);
  const [recruiterConsent, setRecruiterConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [evidenceRefresh, setEvidenceRefresh] = useState(0);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [
        nextPassport,
        nextMatchPage,
        nextConsent,
        nextProfile,
        nextApps,
        nextQueue,
        nextDiscoveries,
      ] = await Promise.all([
        api.passport(token).catch(() => null),
        api.studentMatches(token).catch(() => ({ items: [] })),
        api.recruiterEvidenceConsent(token).catch(() => ({ recruiter_evidence_consent: false })),
        api.candidateProfile(token).catch(() => null),
        api.applications(token).catch(() => ({ items: [] })),
        api.automationReviewQueue(token).catch(() => ({ items: [] })),
        api.jobDiscoveries(token).catch(() => ({ items: [] })),
      ]);

      if (nextPassport) setPassport(nextPassport);
      setMatches(Array.isArray(nextMatchPage?.items) ? nextMatchPage.items : []);
      setRecruiterConsent(!!nextConsent?.recruiter_evidence_consent);
      if (nextProfile) setCandidateProfile(nextProfile);
      setApplications(Array.isArray(nextApps?.items) ? nextApps.items : []);
      setQueueItems(Array.isArray(nextQueue?.items) ? nextQueue.items : []);
      setDiscoveries(Array.isArray(nextDiscoveries?.items) ? nextDiscoveries.items : []);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const [recomputingInternshipMatches, setRecomputingInternshipMatches] = useState(false);

  async function handleRecomputeInternshipMatches() {
    try {
      setRecomputingInternshipMatches(true);
      setError(null);
      await api.recomputeStudentMatches(token);
      await loadData();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Matches could not be recomputed.");
    } finally {
      setRecomputingInternshipMatches(false);
    }
  }

  async function toggleConsent() {
    setError(null);
    try {
      const next = await api.setRecruiterEvidenceConsent(!recruiterConsent, token);
      setRecruiterConsent(next.recruiter_evidence_consent);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Evidence consent could not be updated.");
    }
  }

  if (error && !passport && !loading) {
    return <ErrorState message={error} onRetry={() => void loadData()} />;
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  const completeness = candidateProfile?.profile_completeness;
  const completenessChecks = [
    { label: "Active Resume", ok: !!completeness?.has_active_resume },
    { label: "Project Evidence", ok: !!completeness?.has_project_evidence },
    { label: "Verified Evidence", ok: !!completeness?.has_verified_evidence },
    { label: "Evidence-Backed Skills", ok: !!completeness?.has_evidence_backed_skills },
    { label: "GitHub Linked", ok: !!completeness?.has_github_identity },
  ];
  const passedCount = completenessChecks.filter((c) => c.ok).length;
  const completenessPercent = Math.round((passedCount / completenessChecks.length) * 100);

  const allSkills = passport?.skills ?? [];
  const totalSkillsCount = allSkills.length;
  const verifiedSkillsCount = allSkills.filter((s) => s.verification_tier === "verified").length;
  const verifiedRatio = totalSkillsCount ? Math.round((verifiedSkillsCount / totalSkillsCount) * 100) : 0;

  const allMatchesList = matches ?? [];
  const strongMatchesCount = allMatchesList.filter((m) => m.final_score >= 0.7).length;
  const topMatchScore = allMatchesList.length
    ? Math.round(Math.max(...allMatchesList.map((m) => m.final_score)) * 100)
    : 0;

  const pendingReviewsCount = applications.filter((a) => a.status === "approval_pending").length + queueItems.length;

  const categoryMap: Record<string, { total: number; verified: number }> = {};
  allSkills.forEach((s) => {
    const cat = s.canonical_name.split(" ")[0] || "General";
    if (!categoryMap[cat]) categoryMap[cat] = { total: 0, verified: 0 };
    categoryMap[cat].total += 1;
    if (s.verification_tier === "verified") categoryMap[cat].verified += 1;
  });
  const skillStrengthData = Object.entries(categoryMap).slice(0, 6).map(([name, data]) => ({
    name,
    total: data.total,
    verified: data.verified,
  }));

  const matchChartData = allMatchesList.slice(0, 5).map((m) => ({
    name: m.internship_title.length > 16 ? `${m.internship_title.slice(0, 14)}...` : m.internship_title,
    Exact: Math.round(m.deterministic_score * 100),
    Semantic: Math.round(m.semantic_score * 100),
    Bonus: Math.round(m.verification_bonus * 100),
  }));

  const headerInfo = headerContentMap[activeTab] || headerContentMap.overview;

  return (
    <div className="relative w-full space-y-8">
      {/* Global Editorial Page Header */}
      <EditorialPageHeader
        category={headerInfo.category}
        title={headerInfo.title}
        subtitle={headerInfo.subtitle}
        lastUpdated="Active Compute"
        action={
          <button
            type="button"
            onClick={() => void toggleConsent()}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs border transition-all cursor-pointer ${
              recruiterConsent
                ? "border-[#4F6F5A]/40 bg-[rgba(79,111,90,0.10)] text-[#4F6F5A] font-semibold"
                : "border-[#E5E1D8] bg-[#FFFFFF] text-[#64748B] hover:text-[#111827]"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{recruiterConsent ? "Evidence: Shared" : "Evidence: Restricted"}</span>
          </button>
        }
      />

      {/* 1. OVERVIEW TAB: ANALYTICAL DOSSIER */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Readiness Dossier Header Box */}
          <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 rounded-[16px] flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
            <div className="space-y-2 max-w-xl">
              <div className="font-mono text-xs uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
                VERIFIABLE CAREER READINESS
              </div>
              <h2
                className="text-3xl sm:text-4xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Every skill backed by proof.
              </h2>
              <p className="text-sm text-[#475569] leading-relaxed">
                Your portfolio holds {totalSkillsCount} total skills, with {verifiedSkillsCount} cryptographically verified through repository activity and assessments.
              </p>
              <div className="pt-3 flex flex-wrap gap-3">
                <LiquidGlassButton size="sm" onClick={() => onNavigateTab?.("evidence")}>
                  Upload Evidence
                </LiquidGlassButton>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("matches")}
                  className="pill-btn-outline px-5 py-2 text-xs font-medium text-[#111827] cursor-pointer"
                >
                  View Ranked Matches
                </button>
              </div>
            </div>

            <div className="border-t md:border-t-0 md:border-l border-[#E5E1D8] pt-6 md:pt-0 md:pl-8 flex flex-col items-center justify-center text-center">
              <div className="font-mono text-xs uppercase tracking-wider text-[#64748B] mb-1 font-semibold">
                TOP READINESS SCORE
              </div>
              <div
                className="text-5xl sm:text-6xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {topMatchScore > 0 ? `${topMatchScore}%` : `${completenessPercent}%`}
              </div>
              <div className="mt-2 font-mono text-[11px] text-[#64748B]">
                Verification Ratio: <span className="text-[#B08D57] font-bold">{verifiedRatio}%</span>
              </div>
            </div>
          </div>

          {/* 5 Core Metric Readouts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricReadout
              label="PROFILE COMPLETENESS"
              value={`${completenessPercent}%`}
              subtext={`${passedCount} of 5 checkpoints`}
            />
            <MetricReadout
              label="TOTAL SKILLS"
              value={totalSkillsCount}
              subtext="Extracted from evidence"
            />
            <MetricReadout
              label="VERIFIED SKILLS"
              value={verifiedSkillsCount}
              subtext={`${verifiedRatio}% verified tier`}
            />
            <MetricReadout
              label="HIGH FIT MATCHES"
              value={strongMatchesCount}
              subtext={`${discoveries.length} market opportunities`}
            />
            <MetricReadout
              label="PENDING ACTIONS"
              value={pendingReviewsCount}
              subtext="Applications & queue"
            />
          </div>

          {/* Data Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Skill Breakdown Chart */}
            <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
                <div className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold">
                  Skill Breakdown by Category
                </div>
                <div className="font-mono text-[11px] text-[#64748B]">Total vs Verified</div>
              </div>
              {skillStrengthData.length ? (
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={skillStrengthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} stroke="#E5E1D8" />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} stroke="#E5E1D8" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          fontSize: "12px",
                          border: "1px solid #E5E1D8",
                          backgroundColor: "#FFFFFF",
                          color: "#111827",
                          boxShadow: "0 8px 30px rgba(17,24,39,0.06)",
                        }}
                      />
                      <Bar dataKey="total" name="Total Skills" fill="#111827" opacity={0.25} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="verified" name="Verified" fill="#B08D57" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-xs font-mono text-[#64748B]">
                  No skill evidence registered yet.
                </div>
              )}
            </div>

            {/* Match Breakdown Chart */}
            <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
                <div className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold">
                  Opportunity Score Decomposition
                </div>
                <div className="font-mono text-[11px] text-[#64748B]">Exact / Semantic / Bonus</div>
              </div>
              {matchChartData.length ? (
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={matchChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} stroke="#E5E1D8" />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} stroke="#E5E1D8" domain={[0, 100]} unit="%" />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          fontSize: "12px",
                          border: "1px solid #E5E1D8",
                          backgroundColor: "#FFFFFF",
                          color: "#111827",
                          boxShadow: "0 8px 30px rgba(17,24,39,0.06)",
                        }}
                      />
                      <Bar dataKey="Exact" name="Exact Match" stackId="a" fill="#111827" />
                      <Bar dataKey="Semantic" name="Semantic Match" stackId="a" fill="#64748B" />
                      <Bar dataKey="Bonus" name="Verified Bonus" stackId="a" fill="#B08D57" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-xs font-mono text-[#64748B]">
                  No active match computations available.
                </div>
              )}
            </div>
          </div>

          {/* Top Opportunities & Applications Index */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Opportunities Table */}
            <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
                <div className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold">
                  Top Recommended Opportunities
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("matches")}
                  className="font-mono text-xs text-[#B08D57] hover:text-[#111827] font-medium transition-colors cursor-pointer"
                >
                  View All ({allMatchesList.length}) →
                </button>
              </div>

              {allMatchesList.length ? (
                <div className="space-y-3">
                  {allMatchesList.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[12px] flex items-center justify-between gap-4 hover:border-[#B08D57]/60 transition-all"
                    >
                      <div className="min-w-0">
                        <div
                          className="text-base text-[#111827] font-normal truncate"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {m.internship_title}
                        </div>
                        <div className="font-mono text-xs text-[#64748B] mt-0.5">
                          Exact: {Math.round(m.deterministic_score * 100)}% · Bonus: <span className="text-[#B08D57]">+{Math.round(m.verification_bonus * 100)}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className="text-2xl text-[#111827] font-normal"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {Math.round(m.final_score * 100)}%
                        </div>
                        <div className="font-mono text-[10px] uppercase text-[#64748B]">Fit Score</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-mono text-[#64748B]">
                  No ranked matches available.
                </div>
              )}
            </div>

            {/* Applications Table */}
            <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
                <div className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold">
                  Applications & Review Queue
                </div>
                <div className="font-mono text-xs text-[#64748B]">{applications.length} Records</div>
              </div>

              {applications.length ? (
                <div className="space-y-3">
                  {applications.slice(0, 4).map((app) => (
                    <div
                      key={app.id}
                      className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[12px] flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div
                          className="text-base text-[#111827] font-normal truncate"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {app.application_snapshot?.job?.title || "Internship Application"}
                        </div>
                        <div className="text-xs text-[#64748B] mt-0.5">
                          {app.application_snapshot?.job?.company_name || "Partner Company"}
                        </div>
                      </div>
                      <span className="font-mono text-[11px] uppercase tracking-wider border border-[#E5E1D8] bg-[#FFFFFF] px-2.5 py-1 rounded-full text-[#475569]">
                        {app.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs font-mono text-[#64748B]">
                  No application records filed yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. PASSPORT TAB */}
      {activeTab === "passport" && (
        <div className="space-y-6">
          <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
            <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
              <div className="font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
                <span>VERIFIED SKILL INVENTORY ({allSkills.length})</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5 pt-2">
              {allSkills.map((skill) => (
                <SkillBadge key={skill.id} name={skill.canonical_name} tier={skill.verification_tier} />
              ))}
            </div>
          </div>

          <UnifiedCandidateProfile token={token} refreshKey={evidenceRefresh} />
        </div>
      )}


      {/* 3. EVIDENCE & RESUMES TAB */}
      {activeTab === "evidence" && (
        <div className="space-y-8">
          <DigiLockerVerification
            token={token}
            onEvidenceImported={() => {
              setEvidenceRefresh((v) => v + 1);
              void loadData();
            }}
          />
          <ResumeIntelligence
            token={token}
            onChanged={() => {
              setEvidenceRefresh((v) => v + 1);
              void loadData();
            }}
          />
          <EvidenceUpload
            token={token}
            onSubmitted={() => {
              setEvidenceRefresh((v) => v + 1);
              void loadData();
            }}
          />
          <LinkedInIntelligence
            token={token}
            onChanged={() => {
              setEvidenceRefresh((v) => v + 1);
              void loadData();
            }}
          />
          <EvidenceLifecycle
            token={token}
            refreshKey={evidenceRefresh}
            onChanged={() => void loadData()}
          />
        </div>
      )}

      {/* 4. GITHUB VERIFICATION TAB */}
      {activeTab === "github" && (
        <GitHubVerification
          token={token}
          evidence={passport?.evidence ?? []}
          onVerified={() => void loadData()}
        />
      )}

      {/* 5. INTERNSHIP MATCHES TAB */}
      {activeTab === "matches" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleRecomputeInternshipMatches()}
              disabled={recomputingInternshipMatches}
              className="inline-flex items-center gap-2 rounded-full border border-[#E5E1D8] bg-[#FFFFFF] px-4 py-2 font-mono text-xs text-[#0f172a] font-bold hover:bg-[#F7F5F0] hover:text-[#000000] transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${recomputingInternshipMatches ? "animate-spin" : ""}`} />
              <span>{recomputingInternshipMatches ? "Recomputing..." : "Recompute Matches"}</span>
            </button>
          </div>
          <InternshipMatches
            token={token}
            onNavigateToDiscovery={() => onNavigateTab?.("discovery")}
          />
        </div>
      )}

      {/* 6. JOB DISCOVERY TAB */}
      {activeTab === "discovery" && <ExternalJobs token={token} />}

      {/* 7. TEAM FORMATION TAB */}
      {activeTab === "teams" && (
        <TeamSuggestions token={token} availableSkillIds={allSkills.map((s) => s.skill_id)} />
      )}

      {/* 8. SKILL GAPS & GOALS TAB */}
      {activeTab === "gaps" && (
        <SkillGapAnalyzer
          token={token}
          onNavigateToLearning={() => onNavigateTab?.("learning")}
          onNavigateToAssessment={() => onNavigateTab?.("assessments")}
        />
      )}

      {/* 9. SKILL ASSESSMENTS TAB (includes both GitHub Project Assessments & Diagnostic Quizzes) */}
      {(activeTab === "assessments" || activeTab === "project_assessments") && (
        <SkillAssessments
          token={token}
          defaultMode={activeTab === "project_assessments" ? "projects" : undefined}
          onAssessmentCompleted={() => {
            void loadData();
          }}
        />
      )}

      {/* 10. LEARNING HUB TAB */}
      {activeTab === "learning" && (
        <LearningHub
          token={token}
          onCourseCompleted={() => {
            void loadData();
          }}
        />
      )}

      {/* 11. PLACEMENT DRIVES TAB */}
      {activeTab === "placements" && <PlacementDrives token={token} />}

      {/* 12. COLLABORATIONS TAB */}
      {activeTab === "collaborations" && <CollaborationHub token={token} />}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse font-mono text-xs text-[#64748B]">
      <div className="h-20 w-1/2 border border-[#E5E1D8] bg-[#FFFFFF] rounded-[16px]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 border border-[#E5E1D8] bg-[#FFFFFF] rounded-[16px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-72 border border-[#E5E1D8] bg-[#FFFFFF] rounded-[16px]" />
        <div className="h-72 border border-[#E5E1D8] bg-[#FFFFFF] rounded-[16px]" />
      </div>
    </div>
  );
}
