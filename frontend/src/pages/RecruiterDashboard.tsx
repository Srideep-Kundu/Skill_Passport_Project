import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Briefcase,
  Users,
  PlusCircle,
  Search,
  Edit3,
  Trash2,
  GitBranch,
  Target,
  TrendingUp,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { ApiError, api } from "../api";
import type { CandidateMatch, Internship, InternshipRequirementInput, MatchExplanation, Skill } from "../api";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState";
import { MatchExplanationPanel } from "../components/MatchExplanationPanel";
import { TypewriterText } from "../components/TypewriterText";
import { TypewriterReveal } from "../components/TypewriterReveal";
import { diagonalPageVariants, reducedMotionVariants, pageAssemblyItemVariants } from "../theme/motion";
import type { RecruiterTab } from "../App";
import { EditorialCard, EditorialButton, LiquidGlassButton } from "../components/ui/EditorialPrimitives";

import { RecruiterEvidenceGraph } from "../components/recruiter/RecruiterEvidenceGraph";
import { RecruiterExplainableMatches } from "../components/recruiter/RecruiterExplainableMatches";
import { RecruiterCandidateComparison } from "../components/recruiter/RecruiterCandidateComparison";
import { RecruiterSkillIntelligence } from "../components/recruiter/RecruiterSkillIntelligence";
import { RecruiterTalentPipeline } from "../components/recruiter/RecruiterTalentPipeline";
import { RecruiterTalentDiscovery } from "../components/recruiter/RecruiterTalentDiscovery";
import { RecruiterApplications } from "../components/recruiter/RecruiterApplications";
import { RecruiterAnalytics } from "../components/recruiter/RecruiterAnalytics";

const recruiterHeaderMap: Record<RecruiterTab, { title: string; subtitle: string }> = {
  overview: {
    title: "Evidence-Based Talent Intelligence Platform",
    subtitle: "Real-time candidate discovery, verified skill provenance, and deterministic matching without demographic bias.",
  },
  evidence_graph: {
    title: "Candidate Evidence Graph & Provenance",
    subtitle: "Inspect multi-source verification trails linking code commits, assessments, and university credentials.",
  },
  discovery: {
    title: "Talent Discovery & Verification Market",
    subtitle: "Filter pre-audited student candidates across partner universities with verified skill thresholds.",
  },
  matches: {
    title: "Explainable Algorithmic Matches",
    subtitle: "Deconstruct match scores into deterministic overlap, semantic embeddings, and verifiable proof bonuses.",
  },
  candidates: {
    title: "Explainable Algorithmic Matches",
    subtitle: "Deconstruct match scores into deterministic overlap, semantic embeddings, and verifiable proof bonuses.",
  },
  comparison: {
    title: "Candidate Evidence Comparison",
    subtitle: "Side-by-side evaluation of candidates on evidence depth, project relevance, assessment scores, and gaps.",
  },
  skills: {
    title: "Skill Gap & High-Potential Intelligence",
    subtitle: "Identify near-ready candidates, evaluate target role gaps, and sponsor structured guided upskilling pathways.",
  },
  pipeline: {
    title: "Proactive Talent Pipeline Builder",
    subtitle: "Build continuous talent pools, track institutional cohorts, and convert candidates before graduation.",
  },
  internships: {
    title: "Internship & Opportunity Management",
    subtitle: "Define required skill taxonomies, manage active opportunity listings, and review candidate applications.",
  },
  post_job: {
    title: "Post New Internship Opportunity",
    subtitle: "Define precise skill taxonomy requirements to seed algorithmic matching pipelines.",
  },
  applications: {
    title: "Candidate Applications & Staged Pipeline",
    subtitle: "Track candidate lifecycle from initial application through technical interviews to final offer.",
  },
  analytics: {
    title: "Recruiter Analytics & Market Insights",
    subtitle: "Macro intelligence on skill demand velocity, supply-to-demand ratios, and recruitment conversion funnels.",
  },
};

interface RequirementDraft extends InternshipRequirementInput {
  name: string;
}

export function RecruiterDashboard({
  token,
  activeTab = "overview",
  onSelectTab,
}: {
  token: string;
  activeTab?: RecruiterTab;
  onSelectTab?: (tab: RecruiterTab) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [internships, setInternships] = useState<Internship[] | null>(null);
  const [selected, setSelected] = useState<Internship | null>(null);
  const [matches, setMatches] = useState<CandidateMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<MatchExplanation | null>(null);
  const [internshipPage, setInternshipPage] = useState(1);
  const [internshipTotal, setInternshipTotal] = useState(0);

  const loadInternships = useCallback(async () => {
    try {
      setError(null);
      const response = await api.internships(token, internshipPage);
      setInternships(response.items);
      setInternshipTotal(response.total);
      if (response.items.length > 0 && !selected) {
        setSelected(response.items[0]);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Internships could not be loaded.");
    }
  }, [internshipPage, token, selected]);

  useEffect(() => {
    void loadInternships();
  }, [loadInternships]);

  async function selectInternship(internship: Internship) {
    setSelected(internship);
    setMatches(null);
    setExplanation(null);
    try {
      setMatches((await api.internshipMatches(internship.id, token)).items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Candidates could not be loaded.");
    }
  }

  async function showExplanation(match: CandidateMatch) {
    try {
      setExplanation(match.explanation ?? (await api.explanation(match.id, token)));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Explanation could not be loaded.");
    }
  }

  async function editInternship(internship: Internship) {
    const title = window.prompt("Internship title", internship.title);
    if (title === null || !title.trim()) return;
    const description = window.prompt("Internship description", internship.description);
    if (description === null || !description.trim()) return;
    try {
      const updated = await api.updateInternship(internship.id, { title, description }, token);
      setSelected((current) => (current?.id === updated.id ? updated : current));
      await loadInternships();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Internship could not be updated.");
    }
  }

  async function removeInternship(internship: Internship) {
    if (!window.confirm(`Delete ${internship.title}? Candidate matches will be removed.`)) return;
    try {
      await api.deleteInternship(internship.id, token);
      if (selected?.id === internship.id) {
        setSelected(null);
        setMatches(null);
      }
      await loadInternships();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Internship could not be deleted.");
    }
  }

  if (error && !internships) return <ErrorState message={error} onRetry={() => void loadInternships()} />;
  if (!internships) return <LoadingState label="Loading Lumina Intel workstation" />;

  return (
    <div className="relative w-full min-h-[calc(100vh-8rem)] text-[#111827] font-sans">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={activeTab}
          variants={prefersReducedMotion ? reducedMotionVariants : diagonalPageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ transformOrigin: "50% 30vh" }}
          className="w-full relative space-y-8"
        >
          {/* Header */}
          <motion.header variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants} className="space-y-1">
            <div className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold">
              <Briefcase className="h-3.5 w-3.5 text-[#B08D57]" />
              <span>Lumina Intel · Recruiter Talent Intelligence</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
              <TypewriterText
                key={`${activeTab}-rec-title`}
                text={recruiterHeaderMap[activeTab]?.title || "Evidence-Based Talent Intelligence"}
                speed={16}
                delay={0.02}
              />
            </h1>
            <p className="text-xs text-[#475569]">
              <TypewriterText
                key={`${activeTab}-rec-sub`}
                text={
                  recruiterHeaderMap[activeTab]?.subtitle ||
                  "Candidate rankings expose only authorized, persisted match records with zero demographic bias."
                }
                speed={12}
                delay={0.08}
              />
            </p>
          </motion.header>

          {error && <ErrorState message={error} onRetry={() => void loadInternships()} />}

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Top KPI Metrics */}
              <div className="grid gap-4 sm:grid-cols-4">
                <EditorialCard className="p-5 space-y-1">
                  <span className="font-mono text-[10px] uppercase text-[#64748B] tracking-wider block">
                    Candidates Analyzed
                  </span>
                  <div className="text-3xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                    1,280
                  </div>
                  <span className="text-[11px] text-[#166534] font-mono">100% Audited Profiles</span>
                </EditorialCard>

                <EditorialCard className="p-5 space-y-1">
                  <span className="font-mono text-[10px] uppercase text-[#64748B] tracking-wider block">
                    Evidence Verified
                  </span>
                  <div className="text-3xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                    340
                  </div>
                  <span className="text-[11px] text-[#166534] font-mono">Cryptographic Commits & Certs</span>
                </EditorialCard>

                <EditorialCard className="p-5 space-y-1">
                  <span className="font-mono text-[10px] uppercase text-[#64748B] tracking-wider block">
                    Average Skill Match
                  </span>
                  <div className="text-3xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                    86%
                  </div>
                  <span className="text-[11px] text-[#B08D57] font-mono">Deterministic Fit Score</span>
                </EditorialCard>

                <EditorialCard className="p-5 space-y-1">
                  <span className="font-mono text-[10px] uppercase text-[#64748B] tracking-wider block">
                    Internship-Ready
                  </span>
                  <div className="text-3xl font-normal text-[#166534]" style={{ fontFamily: "var(--font-display)" }}>
                    42
                  </div>
                  <span className="text-[11px] text-[#166534] font-mono">Immediate Onboarding</span>
                </EditorialCard>
              </div>

              {/* Quick Feature Navigation Cards */}
              <div className="grid gap-4 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => onSelectTab && onSelectTab("evidence_graph")}
                  className="p-5 rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#B08D57] transition-all text-left group cursor-pointer shadow-xs"
                >
                  <GitBranch className="h-5 w-5 text-[#B08D57] mb-2 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-bold text-[#111827] flex items-center justify-between">
                    <span>Evidence Graph</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#64748B] group-hover:text-[#B08D57]" />
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1">Audit multi-source proofs</p>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab && onSelectTab("discovery")}
                  className="p-5 rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#B08D57] transition-all text-left group cursor-pointer shadow-xs"
                >
                  <Search className="h-5 w-5 text-[#B08D57] mb-2 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-bold text-[#111827] flex items-center justify-between">
                    <span>Talent Discovery</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#64748B] group-hover:text-[#B08D57]" />
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1">Search verified student pools</p>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab && onSelectTab("matches")}
                  className="p-5 rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#B08D57] transition-all text-left group cursor-pointer shadow-xs"
                >
                  <Target className="h-5 w-5 text-[#B08D57] mb-2 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-bold text-[#111827] flex items-center justify-between">
                    <span>Explainable Matches</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#64748B] group-hover:text-[#B08D57]" />
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1">Understand why candidates rank</p>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab && onSelectTab("pipeline")}
                  className="p-5 rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#B08D57] transition-all text-left group cursor-pointer shadow-xs"
                >
                  <Layers className="h-5 w-5 text-[#B08D57] mb-2 group-hover:scale-110 transition-transform" />
                  <h3 className="text-sm font-bold text-[#111827] flex items-center justify-between">
                    <span>Talent Pipeline</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[#64748B] group-hover:text-[#B08D57]" />
                  </h3>
                  <p className="text-xs text-[#64748B] mt-1">Manage proactive cohorts</p>
                </button>
              </div>

              {/* Sections: Recent Candidate Matches & Skill Demand Trends */}
              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                {/* Recent Candidate Matches Preview */}
                <EditorialCard className="p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
                    <h3
                      className="text-lg font-normal text-[#111827] flex items-center gap-2"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      <Target className="h-4 w-4 text-[#B08D57]" />
                      <span>Recent Candidate Matches</span>
                    </h3>
                    <span className="font-mono text-xs text-[#64748B]">Top Fit Profiles</span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                          MR
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#111827]">Maya Rivera</h4>
                          <p className="text-[11px] text-[#64748B]">Backend & Systems Intern · Harbor Poly</p>
                        </div>
                      </div>
                      <div className="font-mono text-right">
                        <strong className="text-base text-[#166534]">92%</strong>
                        <span className="text-[10px] text-[#64748B] block">Match Fit</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                          RS
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#111827]">Rahul Sharma</h4>
                          <p className="text-[11px] text-[#64748B]">Backend Concurrency · IIIT Hyderabad</p>
                        </div>
                      </div>
                      <div className="font-mono text-right">
                        <strong className="text-base text-[#166534]">86%</strong>
                        <span className="text-[10px] text-[#64748B] block">Match Fit</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                          AS
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#111827]">Aarav Singh</h4>
                          <p className="text-[11px] text-[#64748B]">AI / ML Neural Networks · NIT Trichy</p>
                        </div>
                      </div>
                      <div className="font-mono text-right">
                        <strong className="text-base text-[#166534]">81%</strong>
                        <span className="text-[10px] text-[#64748B] block">Match Fit</span>
                      </div>
                    </div>
                  </div>
                </EditorialCard>

                {/* Skill Demand Trends & Upcoming Hiring */}
                <EditorialCard className="p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
                    <h3
                      className="text-lg font-normal text-[#111827] flex items-center gap-2"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      <TrendingUp className="h-4 w-4 text-[#B08D57]" />
                      <span>Skill Demand Trends</span>
                    </h3>
                    <span className="font-mono text-xs text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-full font-bold">
                      Live Velocity
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-[#111827]">
                        <span>Python (AsyncIO / FastAPI)</span>
                        <span className="font-mono text-[#166534]">4.6x Supply</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F7F5F0] overflow-hidden border border-[#E5E1D8]">
                        <div className="h-full bg-[#B08D57] rounded-full w-[85%]" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-[#111827]">
                        <span>PostgreSQL & pgvector</span>
                        <span className="font-mono text-[#166534]">4.5x Supply</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F7F5F0] overflow-hidden border border-[#E5E1D8]">
                        <div className="h-full bg-[#B08D57] rounded-full w-[75%]" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-[#111827]">
                        <span>PyTorch & Transformers</span>
                        <span className="font-mono text-[#166534]">6.0x Supply</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F7F5F0] overflow-hidden border border-[#E5E1D8]">
                        <div className="h-full bg-[#B08D57] rounded-full w-[65%]" />
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#B08D57]/30 bg-[rgba(176,141,87,0.08)] flex items-center justify-between mt-4">
                    <div className="text-xs">
                      <strong className="text-[#111827] block">Upcoming Hiring Needs</strong>
                      <span className="text-[#64748B]">3 active postings accepting applications</span>
                    </div>
                    <EditorialButton
                      onClick={() => onSelectTab && onSelectTab("internships")}
                      variant="secondary"
                      size="sm"
                    >
                      Manage Roles
                    </EditorialButton>
                  </div>
                </EditorialCard>
              </div>
            </div>
          )}

          {/* TAB 2: EVIDENCE GRAPH */}
          {activeTab === "evidence_graph" && <RecruiterEvidenceGraph />}

          {/* TAB 3: TALENT DISCOVERY */}
          {activeTab === "discovery" && <RecruiterTalentDiscovery />}

          {/* TAB 4: EXPLAINABLE MATCHES */}
          {(activeTab === "matches" || activeTab === "candidates") && (
            <RecruiterExplainableMatches
              internships={internships}
              selectedInternship={selected}
              onSelectInternship={(int) => void selectInternship(int)}
              liveMatches={matches}
              onViewLiveExplanation={(match) => void showExplanation(match)}
            />
          )}

          {/* TAB 5: CANDIDATE COMPARISON */}
          {activeTab === "comparison" && <RecruiterCandidateComparison />}

          {/* TAB 6: SKILL INTELLIGENCE */}
          {activeTab === "skills" && <RecruiterSkillIntelligence />}

          {/* TAB 7: TALENT PIPELINE */}
          {activeTab === "pipeline" && <RecruiterTalentPipeline />}

          {/* TAB 8: INTERNSHIP MANAGEMENT */}
          {(activeTab === "internships" || activeTab === "post_job") && (
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
                {/* Form */}
                <InternshipForm token={token} onCreated={() => void loadInternships()} />

                {/* Internships List */}
                <TypewriterReveal
                  delay={0.12}
                  duration={0.52}
                  className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] flex flex-col text-[#111827] shadow-[0_8px_30px_rgba(17,24,39,0.04)]"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                    <div>
                      <h2
                        className="text-2xl font-normal text-[#111827] flex items-center gap-2"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        <Briefcase className="h-5 w-5 text-[#B08D57]" />
                        <span>Your Posted Internships</span>
                      </h2>
                      <p className="text-xs text-[#475569] mt-0.5">
                        Select an opportunity to inspect ranked candidate pools
                      </p>
                    </div>
                    <span className="font-mono text-xs text-[#475569] border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-1 rounded-full font-semibold">
                      {internships.length} listings
                    </span>
                  </div>

                  <div className="mt-4 flex-1">
                    {internships.length ? (
                      <>
                        <ul className="space-y-3">
                          {internships.map((internship) => {
                            const isSelected = selected?.id === internship.id;
                            return (
                              <li
                                key={internship.id}
                                className={`border p-4 rounded-[12px] transition-all ${
                                  isSelected
                                    ? "border-[#B08D57] bg-[rgba(176,141,87,0.08)]"
                                    : "border-[#E5E1D8] bg-[#F7F5F0] hover:border-[#B08D57]/60"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => void selectInternship(internship)}
                                  className="w-full text-left cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span
                                      className="text-lg font-normal text-[#111827]"
                                      style={{ fontFamily: "var(--font-display)" }}
                                    >
                                      {internship.title}
                                    </span>
                                    {isSelected && (
                                      <span className="font-mono text-[9px] uppercase tracking-wider text-white bg-[#0B0B0A] px-2.5 py-0.5 rounded-full font-semibold">
                                        Active View
                                      </span>
                                    )}
                                  </div>
                                  <span className="mt-1 block text-xs text-[#475569] line-clamp-2 leading-relaxed font-sans">
                                    {internship.description}
                                  </span>
                                </button>

                                <div className="mt-3 flex items-center justify-between border-t border-[#E5E1D8] pt-2.5 font-mono text-xs">
                                  <span className="text-[11px] text-[#64748B]">
                                    {internship.requirements.length} required skill
                                    {internship.requirements.length === 1 ? "" : "s"}
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => void editInternship(internship)}
                                      className="text-[#475569] hover:text-[#111827] transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      <Edit3 className="h-3 w-3" />
                                      <span>Edit</span>
                                    </button>
                                    <span className="text-[#E5E1D8]">·</span>
                                    <button
                                      type="button"
                                      onClick={() => void removeInternship(internship)}
                                      className="text-[#64748B] hover:text-[#B4534B] transition-colors cursor-pointer flex items-center gap-1"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                        {internshipTotal > 20 && (
                          <div className="mt-4 flex items-center justify-between border-t border-[#E5E1D8] pt-3 font-mono text-xs">
                            <button
                              disabled={internshipPage === 1}
                              onClick={() => setInternshipPage((page) => page - 1)}
                              className="pill-btn-outline px-3.5 py-1 text-[#475569] disabled:opacity-30 cursor-pointer"
                            >
                              Previous
                            </button>
                            <span className="text-[#64748B]">Page {internshipPage}</span>
                            <button
                              disabled={internshipPage * 20 >= internshipTotal}
                              onClick={() => setInternshipPage((page) => page + 1)}
                              className="pill-btn-outline px-3.5 py-1 text-[#475569] disabled:opacity-30 cursor-pointer"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <EmptyState title="No internships yet">
                        Create your first internship posting to begin deterministic candidate matching.
                      </EmptyState>
                    )}
                  </div>
                </TypewriterReveal>
              </div>

              {/* Selected Internship Candidate Matches */}
              {selected && (
                <TypewriterReveal
                  delay={0.18}
                  duration={0.52}
                  className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-7 rounded-[16px] space-y-4 text-[#111827] shadow-[0_8px_30px_rgba(17,24,39,0.04)]"
                >
                  <div className="flex items-baseline justify-between border-b border-[#E5E1D8] pb-4">
                    <div>
                      <h2
                        className="text-2xl font-normal text-[#111827] flex items-center gap-2"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        <Users className="h-5 w-5 text-[#B08D57]" />
                        <span>
                          Ranked Candidates for{" "}
                          <span className="underline underline-offset-4 text-[#B08D57]">
                            {selected.title}
                          </span>
                        </span>
                      </h2>
                      <p className="text-xs text-[#475569] mt-0.5">
                        Candidates ordered purely by verifiable skill overlap, embeddings, and evidence depth.
                      </p>
                    </div>
                  </div>

                  {!matches ? (
                    <LoadingState label="Computing persisted candidate matches" />
                  ) : matches.length ? (
                    <ol className="space-y-3">
                      {matches.map((match, index) => (
                        <li
                          key={match.id}
                          className="flex flex-wrap items-center justify-between gap-4 border border-[#E5E1D8] bg-[#F7F5F0] p-5 rounded-[14px] hover:border-[#B08D57]/60 transition-all shadow-2xs"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-[#B08D57] font-bold">
                                #{index + 1}
                              </span>
                              <h3
                                className="text-lg font-normal text-[#111827]"
                                style={{ fontFamily: "var(--font-display)" }}
                              >
                                {match.candidate_label}
                              </h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                              <span className="border border-[#E5E1D8] bg-[#FFFFFF] px-2.5 py-0.5 text-[#475569] rounded-full">
                                Exact: {Math.round(match.deterministic_score * 100)}%
                              </span>
                              <span className="border border-[#E5E1D8] bg-[#FFFFFF] px-2.5 py-0.5 text-[#475569] rounded-full">
                                Semantic: {Math.round(match.semantic_score * 100)}%
                              </span>
                              <span className="badge-premium">
                                Verified Bonus: +{Math.round(match.verification_bonus * 100)}%
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right font-mono">
                              <strong
                                className="text-3xl font-normal text-[#111827] block leading-none"
                                style={{ fontFamily: "var(--font-display)" }}
                              >
                                {Math.round(match.final_score * 100)}%
                              </strong>
                              <span className="text-[10px] uppercase text-[#64748B] font-semibold">
                                Fit Score
                              </span>
                            </div>
                            <LiquidGlassButton onClick={() => void showExplanation(match)} size="sm">
                              View Breakdown
                            </LiquidGlassButton>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <EmptyState title="No candidate matches yet">
                      No candidate profiles match the current requirement criteria.
                    </EmptyState>
                  )}
                </TypewriterReveal>
              )}
            </div>
          )}

          {/* TAB 9: CANDIDATE APPLICATIONS */}
          {activeTab === "applications" && <RecruiterApplications />}

          {/* TAB 10: ANALYTICS & INSIGHTS */}
          {activeTab === "analytics" && <RecruiterAnalytics token={token} />}

          {/* Match Explanation Modal */}
          {explanation && <MatchExplanationPanel explanation={explanation} onClose={() => setExplanation(null)} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function InternshipForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [requirements, setRequirements] = useState<RequirementDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function searchSkills(query: string) {
    setSkillQuery(query);
    if (query.trim().length < 2) {
      setSkills([]);
      return;
    }
    try {
      setSkills(await api.searchSkills(query, token));
    } catch {
      setSkills([]);
    }
  }

  function addRequirement(skill: Skill) {
    if (!requirements.some((requirement) => requirement.skill_id === skill.id)) {
      setRequirements((current) => [
        ...current,
        { skill_id: skill.id, name: skill.canonical_name, is_required: true, weight: 1 },
      ]);
    }
    setSkillQuery("");
    setSkills([]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!requirements.length) {
      setError("Add at least one canonical skill requirement.");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.createInternship({ title, description, requirements }, token);
      setTitle("");
      setDescription("");
      setRequirements([]);
      onCreated();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Internship could not be created.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-7 rounded-[16px] text-[#111827] font-sans space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
      <div className="border-b border-[#E5E1D8] pb-4">
        <h2
          className="text-2xl font-normal text-[#111827] flex items-center gap-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <PlusCircle className="h-5 w-5 text-[#B08D57]" />
          <span>Post New Internship</span>
        </h2>
        <p className="text-xs text-[#475569] mt-0.5">
          Define role details and canonical skill requirements
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wider text-[#475569] block font-semibold">
            Role Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Backend Distributed Systems Intern"
            className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] p-2.5 font-mono text-xs text-[#111827] placeholder:text-[#64748B] focus:border-[#B08D57] focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wider text-[#475569] block font-semibold">
            Role Description & Criteria
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe project responsibilities and engineering expectations..."
            className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] p-2.5 font-mono text-xs text-[#111827] placeholder:text-[#64748B] focus:border-[#B08D57] focus:outline-none leading-relaxed"
          />
        </div>

        {/* Skill Search & Autocomplete */}
        <div className="space-y-1 relative">
          <label className="font-mono text-xs uppercase tracking-wider text-[#475569] block font-semibold">
            Add Required Taxonomy Skills
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
            <input
              type="text"
              value={skillQuery}
              onChange={(e) => void searchSkills(e.target.value)}
              placeholder="Search taxonomy (e.g. Python, FastAPI, PostgreSQL, PyTorch)..."
              className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] pl-8 pr-3 py-2 font-mono text-xs text-[#111827] placeholder:text-[#64748B] focus:border-[#B08D57] focus:outline-none"
            />
          </div>

          {skills.length > 0 && (
            <ul className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto rounded-md border border-[#E5E1D8] bg-[#FFFFFF] shadow-lg divide-y divide-[#E5E1D8]">
              {skills.map((skill) => (
                <li key={skill.id}>
                  <button
                    type="button"
                    onClick={() => addRequirement(skill)}
                    className="w-full text-left px-3 py-2 text-xs font-mono text-[#111827] hover:bg-[rgba(176,141,87,0.08)] flex items-center justify-between cursor-pointer"
                  >
                    <span>{skill.canonical_name}</span>
                    <span className="text-[10px] text-[#64748B] uppercase">{skill.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected Requirements List */}
        {requirements.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#E5E1D8]">
            <span className="font-mono text-[11px] text-[#64748B] block">Selected Requirements ({requirements.length}):</span>
            <div className="flex flex-wrap gap-1.5">
              {requirements.map((req) => (
                <span
                  key={req.skill_id}
                  className="font-mono text-xs border border-[#B08D57]/40 bg-[rgba(176,141,87,0.08)] text-[#111827] px-2.5 py-1 rounded-md flex items-center gap-1.5"
                >
                  <span>{req.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setRequirements(requirements.filter((r) => r.skill_id !== req.skill_id))
                    }
                    className="text-[#64748B] hover:text-[#B4534B] ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {error && <div className="p-3 rounded-md bg-[#FEE2E2] text-xs text-[#B4534B] font-mono">{error}</div>}

        <EditorialButton
          type="submit"
          disabled={isSubmitting}
          variant="primary"
          className="w-full justify-center"
        >
          {isSubmitting ? "Publishing Opportunity..." : "Publish Opportunity"}
        </EditorialButton>
      </form>
    </section>
  );
}
