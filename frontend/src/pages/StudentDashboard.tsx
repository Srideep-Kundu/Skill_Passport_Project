import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CheckCircle2,
  Briefcase,
  Sparkles,
  Clock,
  ShieldCheck,
  TrendingUp,
  BarChart3,
  UserCheck,
  Compass,
  Target,
  Layers,
  FileCheck,
  BadgeCheck,
  FileText,
  RefreshCw,
} from "lucide-react";
import { LuminaWaves } from "../components/LuminaWaves";
import { ApiError, api } from "../api";
import type {
  MatchExplanation,
  Passport,
  StudentMatch,
  CandidateProfile,
  ExternalJobMatch,
  Application,
  JobDiscovery,
  AutomationQueueItem,
} from "../api";
import { ErrorState } from "../components/AsyncState";
import { EvidenceUpload } from "./EvidenceUpload";
import { EvidenceLifecycle } from "../components/EvidenceLifecycle";
import { ExternalJobs } from "../components/ExternalJobs";
import { ResumeIntelligence } from "../components/ResumeIntelligence";
import { LinkedInIntelligence } from "../components/LinkedInIntelligence";
import { UnifiedCandidateProfile } from "../components/UnifiedCandidateProfile";
import { GitHubVerification } from "./GitHubVerification";
import { MatchExplanationPanel } from "../components/MatchExplanationPanel";
import { SkillBadge } from "../components/SkillBadge";
import { TeamSuggestions } from "./TeamSuggestions";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { ExpandableStatCard } from "../components/ExpandableStatCard";
import { CircularReadinessGauge } from "../components/CircularReadinessGauge";
import { TypewriterText } from "../components/TypewriterText";
import { TypewriterReveal } from "../components/TypewriterReveal";
import { diagonalPageVariants, reducedMotionVariants, pageAssemblyItemVariants } from "../theme/motion";
import type { StudentTab } from "../App";

const headerContentMap: Record<StudentTab, { title: string; subtitle: string }> = {
  overview: {
    title: "Welcome back to your Passport",
    subtitle: "Every match is mathematically derived from cryptographically verified project evidence.",
  },
  passport: {
    title: "Unified Evidence-Backed Profile",
    subtitle: "Consolidated verifiable skill records, evidence graph, and deterministic profile completeness.",
  },
  evidence: {
    title: "Technical Evidence & Verification Engine",
    subtitle: "Upload project repositories, certifications, and code artifacts to extract validated skills.",
  },
  github: {
    title: "GitHub Repository & Activity Verification",
    subtitle: "Cryptographic commit hash audits, code ownership proof, and contribution verification.",
  },
  discovery: {
    title: "Autonomous Job Discovery Market",
    subtitle: "Intelligent job search automation, background polling, and recruiter evidence controls.",
  },
  teams: {
    title: "Deterministic Team Formation Engine",
    subtitle: "Assemble balanced engineering teams based on verifiable complementary skill coverage.",
  },
  matches: {
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
  const prefersReducedMotion = useReducedMotion();

  // Primary API states
  const [passport, setPassport] = useState<Passport | null>(null);
  const [matches, setMatches] = useState<StudentMatch[] | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [queueItems, setQueueItems] = useState<AutomationQueueItem[]>([]);
  const [discoveries, setDiscoveries] = useState<JobDiscovery[]>([]);
  const [recruiterConsent, setRecruiterConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Explanation Modal state
  const [selectedExplanation, setSelectedExplanation] = useState<MatchExplanation | null>(null);
  const [loadingExplanationId, setLoadingExplanationId] = useState<string | null>(null);
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
      setMatches(nextMatchPage.items);
      setRecruiterConsent(nextConsent.recruiter_evidence_consent);
      if (nextProfile) setCandidateProfile(nextProfile);
      setApplications(nextApps.items);
      setQueueItems(nextQueue.items);
      setDiscoveries(nextDiscoveries.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function showExplanation(match: StudentMatch | ExternalJobMatch) {
    if (match.explanation) {
      setSelectedExplanation(match.explanation);
      return;
    }
    setLoadingExplanationId(match.id);
    try {
      setSelectedExplanation(await api.explanation(match.id, token));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "The explanation could not be loaded.");
    } finally {
      setLoadingExplanationId(null);
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

  // Completeness calculation
  const completeness = candidateProfile?.profile_completeness;
  const completenessChecks = [
    { label: "Active Resume Uploaded", ok: !!completeness?.has_active_resume },
    { label: "Project Evidence Added", ok: !!completeness?.has_project_evidence },
    { label: "Verified Skill Evidence", ok: !!completeness?.has_verified_evidence },
    { label: "Evidence-Backed Skills", ok: !!completeness?.has_evidence_backed_skills },
    { label: "GitHub Handle Linked", ok: !!completeness?.has_github_identity },
  ];
  const passedCount = completenessChecks.filter((c) => c.ok).length;
  const completenessPercent = Math.round((passedCount / completenessChecks.length) * 100);

  // Skill metrics
  const allSkills = passport?.skills ?? [];
  const totalSkillsCount = allSkills.length;
  const verifiedSkillsCount = allSkills.filter((s) => s.verification_tier === "verified").length;
  const verifiedRatio = totalSkillsCount ? Math.round((verifiedSkillsCount / totalSkillsCount) * 100) : 0;

  // Job Match metrics
  const allMatchesList = matches ?? [];
  const strongMatchesCount = allMatchesList.filter((m) => m.final_score >= 0.7).length;
  const topMatchScore = allMatchesList.length
    ? Math.round(Math.max(...allMatchesList.map((m) => m.final_score)) * 100)
    : 0;

  // Pending applications
  const pendingReviewsCount = applications.filter((a) => a.status === "approval_pending").length + queueItems.length;

  // Skill strength category breakdown
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

  // Recharts Match Breakdown Data
  const matchChartData = allMatchesList.slice(0, 5).map((m) => ({
    name: m.internship_title.length > 18 ? `${m.internship_title.slice(0, 16)}...` : m.internship_title,
    Exact: Math.round(m.deterministic_score * 100),
    Semantic: Math.round(m.semantic_score * 100),
    Bonus: Math.round(m.verification_bonus * 100),
  }));

  const isOverview = activeTab === "overview";

  return (
    <div className="relative w-full min-h-[calc(100vh-8rem)]">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={activeTab}
          variants={prefersReducedMotion ? reducedMotionVariants : diagonalPageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ transformOrigin: "50% 30vh" }}
          className="w-full relative space-y-8 text-slate-900 dark:text-slate-100"
        >
      {/* SECTION 1: GREETING & HEADER */}
      <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Student Skill Passport</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Deterministic Match Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            <TypewriterText
              key={`${activeTab}-title`}
              text={headerContentMap[activeTab]?.title || "Welcome back to your Passport"}
              speed={16}
              delay={0.02}
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <TypewriterText
              key={`${activeTab}-sub`}
              text={headerContentMap[activeTab]?.subtitle || "Every match is mathematically derived from cryptographically verified project evidence."}
              speed={12}
              delay={0.08}
            />
          </p>
        </div>

        {/* Quick Consent Toggle */}
        <button
          type="button"
          onClick={() => void toggleConsent()}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xs transition-all border cursor-pointer shrink-0 ${
            recruiterConsent
              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300"
          }`}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>{recruiterConsent ? "Raw Evidence Access: Enabled" : "Raw Evidence Access: Restricted"}</span>
        </button>
      </motion.div>

      {/* LUMINA INTEL SIGNATURE HERO CARD (Overview Tab - Light & Dark Modes) */}
      {isOverview && (
        <motion.div
          variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants}
          className="relative overflow-hidden rounded-[28px] border border-indigo-100/90 dark:border-white/[0.08] p-6 sm:p-9 bg-gradient-to-br from-[#f8faff] via-white to-[#eef4ff] dark:bg-none dark:bg-[#0b101b]/95 backdrop-blur-xl shadow-xl shadow-indigo-100/40 dark:shadow-2xl dark:shadow-blue-950/20"
        >
          {/* Dynamic Flowing Organic Waves Canvas */}
          {!prefersReducedMotion && (
            <LuminaWaves opacity={0.8} speed={1.0} interactive={true} />
          )}

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
            <div className="space-y-4 max-w-xl">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#4f46e5] dark:text-[#8ea2c6] font-sans">
                  — CAREER INTELLIGENCE
                </span>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-[#8ea2c6] mb-1 font-sans">
                  Good morning, Candidate.
                </p>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-[#f1f0e8] tracking-tight leading-tight font-sans">
                  Your career,
                  <span className="block font-serif italic text-[#4f46e5] dark:text-[#dedbc8] font-normal mt-0.5">
                    made visible.
                  </span>
                </h2>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-[#8ea2c6] pl-2.5 border-l border-indigo-200 dark:border-white/15 font-sans">
                <p>Every skill traced to evidence. Every opportunity explained.</p>
              </div>

              {/* Verification floating pill */}
              <div className="pt-0.5 font-sans">
                <span className="inline-flex items-center rounded-full bg-white/80 dark:bg-[#121927]/90 px-3 py-1 text-[11px] font-medium text-slate-700 dark:text-[#a5b4cb] border border-indigo-200/60 dark:border-white/10 backdrop-blur-md shadow-xs">
                  Verification: {verifiedRatio}%
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("evidence")}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8] text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-indigo-500/25 dark:shadow-[0_4px_20px_rgba(37,99,235,0.4)] active:scale-95 transition-all cursor-pointer font-sans"
                >
                  <FileText className="h-4 w-4" />
                  <span>Upload Resume</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab?.("evidence")}
                  className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 dark:bg-[#121926]/90 dark:hover:bg-[#182338] dark:border-[#232f42] dark:text-[#e2e8f0] px-4.5 py-2.5 text-xs font-semibold shadow-xs active:scale-95 transition-all cursor-pointer font-sans"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Import LinkedIn</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center shrink-0 lg:pr-6">
              <CircularReadinessGauge
                readinessScore={topMatchScore > 0 ? topMatchScore : completenessPercent}
                verificationScore={verifiedRatio}
                label="READINESS"
                size={200}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* DASHBOARD STATS GRID (SECTIONS 2 - 6) */}
      {(isOverview || activeTab === "passport") && (
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants} className="relative z-30 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* SECTION 2: Passport Completeness */}
          <ExpandableStatCard
            className="col-span-1 sm:col-span-2 lg:col-span-1"
            title="Completeness"
            revealDelay={0.04}
            icon={<UserCheck className="h-4 w-4 text-[#4f46e5] dark:text-[#b0c6ff]" />}
            mainValue={<AnimatedNumber value={completenessPercent} formatter={(v) => `${v}%`} />}
            subValue={`${passedCount}/5 Checks`}
            progressBar={{ value: completenessPercent, color: "h-full rounded-full bg-[#4f46e5] dark:bg-[#3b71d9]" }}
            hoverTitle="Completeness Breakdown"
            hoverDetails={
              <ul className="space-y-2 pt-0.5">
                {completenessChecks.map((check) => (
                  <li key={check.label} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-600 dark:text-slate-300 truncate">{check.label}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 font-bold shrink-0 ${
                        check.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"
                      }`}
                    >
                      {check.ok ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          <span>Complete</span>
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>Pending</span>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            }
          />

          {/* SECTION 3: Total Skills */}
          <ExpandableStatCard
            title="Total Skills"
            revealDelay={0.09}
            icon={<Layers className="h-4 w-4 text-[#4f46e5] dark:text-[#b0c6ff]" />}
            mainValue={<AnimatedNumber value={totalSkillsCount} />}
            footerText="Extracted from evidence"
            hoverTitle="Extracted Skills Preview"
            hoverDetails={
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
                  {allSkills.length ? (
                    allSkills.slice(0, 10).map((s) => (
                      <span
                        key={s.skill_id}
                        className="rounded-md bg-slate-100 dark:bg-[#111a2e] border border-slate-200/60 dark:border-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {s.canonical_name}
                      </span>
                    ))
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">No skills extracted yet.</p>
                  )}
                  {allSkills.length > 10 && (
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 self-center">
                      +{allSkills.length - 10} more
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
                  Skills parsed asynchronously from active resume & project evidence.
                </p>
              </div>
            }
          />

          {/* SECTION 4: Verified Skills */}
          <ExpandableStatCard
            title="Verified Skills"
            revealDelay={0.14}
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            mainValue={<AnimatedNumber value={verifiedSkillsCount} />}
            badge={{
              text: <>({<AnimatedNumber value={verifiedRatio} formatter={(v) => `${v}%`} />})</>,
              className: "text-xs font-bold text-emerald-600 dark:text-emerald-400",
            }}
            footerText="Backed by code/repo activity"
            hoverTitle="Cryptographically Verified Skills"
            hoverDetails={
              <div className="space-y-2">
                {verifiedSkillsCount > 0 ? (
                  <ul className="space-y-1 max-h-36 overflow-y-auto">
                    {allSkills
                      .filter((s) => s.verification_tier === "verified")
                      .map((s) => (
                        <li
                          key={s.skill_id}
                          className="flex items-center justify-between text-[11px] bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200/40 dark:border-emerald-900/40 rounded px-2 py-1"
                        >
                          <span className="font-semibold text-emerald-900 dark:text-emerald-200">{s.canonical_name}</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                            <span>Verified Tier</span>
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No verified skills yet. Connect GitHub to verify commits.</p>
                )}
                <p className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-1">
                  Verified skills earn bonus weight in deterministic match calculations.
                </p>
              </div>
            }
          />

          {/* SECTION 5: Strong Job Matches */}
          <ExpandableStatCard
            title="High Fit Matches"
            revealDelay={0.19}
            icon={<Target className="h-4 w-4 text-[#4f46e5] dark:text-[#b0c6ff]" />}
            mainValue={<span className="text-[#4f46e5] dark:text-[#b0c6ff]">{<AnimatedNumber value={strongMatchesCount} />}</span>}
            subValue={topMatchScore > 0 ? <>Top {<AnimatedNumber value={topMatchScore} formatter={(v) => `${v}%`} />}</> : undefined}
            footerText="≥70% deterministic fit"
            hoverTitle="Top Recommended Opportunities"
            hoverDetails={
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {allMatchesList.length ? (
                  allMatchesList.slice(0, 3).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 text-[11px] border-b border-slate-100 dark:border-slate-800/80 pb-1.5 last:border-0"
                    >
                      <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{m.internship_title}</span>
                      <strong className="text-indigo-600 dark:text-indigo-400 shrink-0">
                        {Math.round(m.final_score * 100)}%
                      </strong>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No match recommendations computed yet.</p>
                )}
              </div>
            }
          />

          {/* SECTION 6: Pending Application Reviews */}
          <ExpandableStatCard
            title="Pending Reviews"
            revealDelay={0.24}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            mainValue={<AnimatedNumber value={pendingReviewsCount} />}
            footerText="Awaiting intent approval"
            hoverTitle="Pending Application Intents"
            hoverDetails={
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {applications.filter((a) => a.status === "approval_pending").length > 0 || queueItems.length > 0 ? (
                  <>
                    {applications
                      .filter((a) => a.status === "approval_pending")
                      .map((app) => (
                        <div key={app.id} className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {app.application_snapshot?.job?.title || "Application"}
                          </span>
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                            Approval Pending
                          </span>
                        </div>
                      ))}
                    {queueItems.map((q) => (
                      <div key={`${q.policy_id}-${q.match_id}`} className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{q.title}</span>
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                          In Review Queue
                        </span>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-[11px] text-slate-400 italic">No applications currently pending your review.</p>
                )}
              </div>
            }
          />
        </motion.div>
      )}

      {/* VISUALIZATIONS GRID (SECTIONS 7 & 8) */}
      {(isOverview || activeTab === "matches" || activeTab === "passport") && (
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants} className="relative z-10 grid gap-6 lg:grid-cols-2">
          {/* SECTION 7: Skill-strength visualization */}
          <TypewriterReveal delay={0.12} duration={0.52} className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
                  <BarChart3 className="h-4 w-4 text-[#4f46e5] dark:text-[#b0c6ff]" />
                  <span>Skill Breakdown & Verification</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">Total vs Verified skills by category</p>
              </div>
            </div>

            {skillStrengthData.length ? (
              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={skillStrengthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#98a4b3" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#98a4b3" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        fontSize: "12px",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        backgroundColor: "#151e29",
                        color: "#f1f0e8",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                      }}
                      itemStyle={{ color: "#f1f0e8" }}
                      labelStyle={{ color: "#98a4b3", fontWeight: 600 }}
                    />
                    <Bar dataKey="total" name="Total Skills" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="verified" name="Verified" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400 italic">
                No skill data to display. Upload a resume or project evidence to populate.
              </div>
            )}
          </TypewriterReveal>

          {/* SECTION 8: Recharts Match Breakdown Chart */}
          <TypewriterReveal delay={0.16} duration={0.52} className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
                  <TrendingUp className="h-4 w-4 text-[#4f46e5] dark:text-[#b0c6ff]" />
                  <span>Match Score Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">Exact overlap, semantic, and verification bonus</p>
              </div>
            </div>

            {matchChartData.length ? (
              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={matchChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#98a4b3" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#98a4b3" }} domain={[0, 100]} unit="%" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        fontSize: "12px",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        backgroundColor: "#151e29",
                        color: "#f1f0e8",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                      }}
                      itemStyle={{ color: "#f1f0e8" }}
                      labelStyle={{ color: "#98a4b3", fontWeight: 600 }}
                    />
                    <Bar dataKey="Exact" name="Exact Match" stackId="a" fill="#6366f1" />
                    <Bar dataKey="Semantic" name="Semantic Match" stackId="a" fill="#818cf8" />
                    <Bar dataKey="Bonus" name="Verified Bonus" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400 italic">
                No active internship matches to compare.
              </div>
            )}
          </TypewriterReveal>
        </motion.div>
      )}

      {/* RECENT RECOMMENDED JOBS & APPLICATION STATUS (SECTIONS 9 & 10) */}
      {(isOverview || activeTab === "matches" || activeTab === "discovery") && (
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants} className="grid gap-6 lg:grid-cols-2">
          {/* SECTION 9: Recent recommended jobs */}
          <TypewriterReveal delay={0.24} duration={0.52} className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
                  <Briefcase className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
                  <span>Recent Recommended Opportunities</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">Deterministic job recommendations</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{allMatchesList.length} matches</span>
            </div>

            {allMatchesList.length ? (
              <ul className="space-y-3">
                {allMatchesList.slice(0, 4).map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-3.5 hover:border-[#3b71d9]/50 dark:hover:border-[#3b71d9]/50 transition-all"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{m.internship_title}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-[#98a4b3]">
                        <span>Exact: {Math.round(m.deterministic_score * 100)}%</span>
                        <span>&middot;</span>
                        <span className="text-[#dedbc8] dark:text-[#dedbc8] font-medium">Verified +{Math.round(m.verification_bonus * 100)}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-[#3b71d9] dark:text-[#b0c6ff] font-sans">
                        {Math.round(m.final_score * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => void showExplanation(m)}
                        className="rounded-lg border border-[#3b71d9] dark:border-[#b0c6ff]/40 px-2.5 py-1 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-[#1a2430] transition-colors cursor-pointer font-sans"
                      >
                        {loadingExplanationId === m.id ? "Loading..." : "Why this match"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-xs text-slate-400 italic">No recommendations found yet.</p>
            )}
          </TypewriterReveal>

          {/* SECTION 10: Recent application status */}
          <TypewriterReveal delay={0.30} duration={0.52} className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
                  <FileCheck className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
                  <span>Recent Applications Timeline</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">Track application lifecycle</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{applications.length} applications</span>
            </div>

            {applications.length ? (
              <ul className="space-y-3">
                {applications.slice(0, 4).map((app) => (
                  <li
                    key={app.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-3.5"
                  >
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">
                        {app.application_snapshot?.job?.title || "Application"}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] font-sans">
                        {app.application_snapshot?.job?.company_name || "Company"} &middot; {app.status.replaceAll("_", " ")}
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-50 dark:bg-[#1a2430] border border-blue-200/60 dark:border-blue-400/20 px-2.5 py-1 text-[11px] font-bold text-[#3b71d9] dark:text-[#b0c6ff] uppercase tracking-wider font-sans">
                      {app.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                No active job applications found. Select a match to generate an application intent.
              </div>
            )}
          </TypewriterReveal>
        </motion.div>
      )}

      {/* SECTION 11: SAVED DISCOVERY SUMMARY */}
      {(isOverview || activeTab === "discovery") && (
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants} className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
              <Compass className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
              <span>Saved Job Discovery Rules</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400 dark:text-[#98a4b3]">{discoveries.length} active rules</span>
          </div>

          {discoveries.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1">
              {discoveries.map((disc) => (
                <div
                  key={disc.id}
                  className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-[#f1f0e8] font-sans">{disc.name}</span>
                    <span className="rounded bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5">
                      {disc.enabled ? "Active" : "Paused"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] font-sans">
                    Providers: {disc.providers.join(", ")} &middot; Min Fit: {Math.round(disc.minimum_match_score * 100)}%
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic py-2">
              No saved discovery rules configured yet. Discovery automatically monitors Greenhouse, Lever, and Ashby job boards.
            </p>
          )}
        </motion.div>
      )}

      {/* EMBEDDED PASSPORT MANAGEMENT SUB-VIEWS */}
      {(isOverview || activeTab === "passport") && (
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants}>
          {/* Skill Badges Overview Container */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Passport Skill Badges</h3>
                <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">Verified and self-reported skills in your portfolio</p>
              </div>
              <span className="rounded-full bg-blue-50 dark:bg-[#151e29] border border-blue-200/60 dark:border-white/10 px-2.5 py-0.5 text-xs font-bold text-[#3b71d9] dark:text-[#b0c6ff] font-sans">
                {allSkills.length} skills
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {allSkills.map((skill) => (
                <SkillBadge key={skill.id} name={skill.canonical_name} tier={skill.verification_tier} />
              ))}
            </div>
          </div>

          <UnifiedCandidateProfile token={token} refreshKey={evidenceRefresh} />
        </motion.div>
      )}

      {(isOverview || activeTab === "evidence") && (
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <EvidenceUpload
              token={token}
              onSubmitted={() => {
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
          </div>
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
        </motion.div>
      )}

      {(isOverview || activeTab === "github") && (
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants}>
          <GitHubVerification
            token={token}
            evidence={passport?.evidence ?? []}
            onVerified={() => void loadData()}
          />
        </motion.div>
      )}

      {(isOverview || activeTab === "discovery") && (
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants}>
          <ExternalJobs token={token} />
        </motion.div>
      )}

      {(isOverview || activeTab === "teams") && (
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants}>
          <TeamSuggestions token={token} availableSkillIds={allSkills.map((s) => s.skill_id)} />
        </motion.div>
      )}

      {/* Match Explanation Modal / Drawer */}
      {selectedExplanation && <MatchExplanationPanel explanation={selectedExplanation} />}
    </motion.div>
  </AnimatePresence>
  </div>
  );
}

// SECTION SKELETON LOADER MATCHING FINAL CARD SHAPES
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-16 w-3/4 rounded-2xl bg-slate-200 dark:bg-slate-800"></div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
        <div className="h-72 rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-60 rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
        <div className="h-60 rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      </div>
    </div>
  );
}
