import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Briefcase, Users, PlusCircle, Search } from "lucide-react";
import { ApiError, api } from "../api";
import type { CandidateMatch, Internship, InternshipRequirementInput, MatchExplanation, Skill } from "../api";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState";
import { MatchExplanationPanel } from "../components/MatchExplanationPanel";
import { TypewriterText } from "../components/TypewriterText";
import { TypewriterReveal } from "../components/TypewriterReveal";
import { diagonalPageVariants, reducedMotionVariants, pageAssemblyItemVariants } from "../theme/motion";
import type { RecruiterTab } from "../App";

const recruiterHeaderMap: Record<RecruiterTab, { title: string; subtitle: string }> = {
  overview: {
    title: "Evidence-Backed Candidate Matching",
    subtitle: "Candidate rankings expose only authorized, persisted match records with zero demographic bias.",
  },
  internships: {
    title: "Manage Your Posted Internships",
    subtitle: "Inspect active candidate pools, edit required taxonomies, and manage deterministic criteria.",
  },
  post_job: {
    title: "Post New Opportunity",
    subtitle: "Define precise skill taxonomy requirements to seed algorithmic matching pipelines.",
  },
  candidates: {
    title: "Ranked Candidate Pool & Proof Audits",
    subtitle: "Review cryptographic skill overlap, semantic embeddings, and verifiable commit evidence.",
  },
};

interface RequirementDraft extends InternshipRequirementInput {
  name: string;
}

export function RecruiterDashboard({
  token,
  activeTab = "overview",
}: {
  token: string;
  activeTab?: RecruiterTab;
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
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Internships could not be loaded.");
    }
  }, [internshipPage, token]);

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
  if (!internships) return <LoadingState label="Loading internships" />;

  const showAll = activeTab === "overview";

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
        {/* Header */}
        <motion.header variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants} className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            <Briefcase className="h-3.5 w-3.5" />
            <span>Recruiter Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 capitalize">
            <TypewriterText
              key={`${activeTab}-rec-title`}
              text={recruiterHeaderMap[activeTab]?.title || "Evidence-Backed Candidate Matching"}
              speed={16}
              delay={0.02}
            />
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <TypewriterText
              key={`${activeTab}-rec-sub`}
              text={recruiterHeaderMap[activeTab]?.subtitle || "Candidate rankings expose only authorized, persisted match records with zero demographic bias."}
              speed={12}
              delay={0.08}
            />
          </p>
        </motion.header>

        {error && <ErrorState message={error} onRetry={() => void loadInternships()} />}

        {/* Main Grid: Form + List */}
        <motion.div variants={prefersReducedMotion ? undefined : pageAssemblyItemVariants} className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
          {(showAll || activeTab === "post_job") && (
            <InternshipForm token={token} onCreated={() => void loadInternships()} />
          )}

          {/* Internships List */}
          {(showAll || activeTab === "internships" || activeTab === "candidates") && (
            <TypewriterReveal delay={0.12} duration={0.52} className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-5 sm:p-6 shadow-lg flex flex-col text-slate-900 dark:text-[#f1f0e8]">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
                    <Briefcase className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
                    <span>Your Internships</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">Select an opportunity to inspect ranked candidates</p>
                </div>
                <span className="rounded-full bg-slate-100/80 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.08] px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:text-[#dedbc8] backdrop-blur-xs">
                  {internships.length} listings
                </span>
              </div>

              <div className="mt-4 flex-1">
                {internships.length ? (
                  <>
                    <ul className="space-y-2.5">
                      {internships.map((internship) => {
                        const isSelected = selected?.id === internship.id;
                        return (
                          <li
                            key={internship.id}
                            className={`rounded-2xl border p-4 transition-all backdrop-blur-md ${
                              isSelected
                                ? "border-[#3b71d9] dark:border-[#3b71d9] bg-blue-50/60 dark:bg-[#3b71d9]/20 shadow-xs ring-1 ring-[#3b71d9]/30"
                                : "border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.03] hover:border-slate-300 dark:hover:border-white/[0.16]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => void selectInternship(internship)}
                              className="w-full text-left cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={`font-bold text-sm sm:text-base font-sans ${
                                    isSelected
                                      ? "text-blue-950 dark:text-[#dedbc8]"
                                      : "text-slate-900 dark:text-[#f1f0e8]"
                                  }`}
                                >
                                  {internship.title}
                                </span>
                                {isSelected && (
                                  <span className="rounded-full bg-[#3b71d9] text-white text-[10px] font-bold px-2 py-0.5 shrink-0">
                                    Active View
                                  </span>
                                )}
                              </div>
                              <span className="mt-1 block text-xs text-slate-600 dark:text-[#98a4b3] line-clamp-2 leading-relaxed font-sans">
                                {internship.description}
                              </span>
                            </button>

                            <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 dark:border-white/[0.08] pt-2.5">
                              <span className="text-[11px] font-medium text-slate-500 dark:text-[#98a4b3] font-sans">
                                {internship.requirements.length} required skill
                                {internship.requirements.length === 1 ? "" : "s"}
                              </span>
                              <div className="flex items-center gap-3 text-xs font-semibold">
                                <button
                                  type="button"
                                  onClick={() => void editInternship(internship)}
                                  className="text-[#3b71d9] dark:text-[#b0c6ff] hover:text-blue-800 dark:hover:text-white transition-colors cursor-pointer font-sans"
                                >
                                  Edit
                                </button>
                                <span className="text-slate-300 dark:text-slate-700">·</span>
                                <button
                                  type="button"
                                  onClick={() => void removeInternship(internship)}
                                  className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 transition-colors cursor-pointer font-sans"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {internshipTotal > 20 && (
                      <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs font-semibold">
                        <button
                          disabled={internshipPage === 1}
                          onClick={() => setInternshipPage((page) => page - 1)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3 py-1.5 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                        >
                          Previous
                        </button>
                        <span className="text-slate-500 dark:text-slate-400">Page {internshipPage}</span>
                        <button
                          disabled={internshipPage * 20 >= internshipTotal}
                          onClick={() => setInternshipPage((page) => page + 1)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3 py-1.5 text-slate-700 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
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
          )}
        </motion.div>

        {/* Selected Internship Candidate Matches */}
        {(showAll || activeTab === "candidates") && selected && (
          <TypewriterReveal
            delay={0.18}
            duration={0.52}
            className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-5 sm:p-6 shadow-lg space-y-4 text-slate-900 dark:text-[#f1f0e8]"
          >
            <div className="flex items-baseline justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
                  <Users className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
                  <span>
                    Ranked Candidates for <span className="text-[#3b71d9] dark:text-[#b0c6ff]">{selected.title}</span>
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
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
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.03] backdrop-blur-md p-4.5 hover:border-[#3b71d9]/50 dark:hover:border-blue-500/50 transition-all text-slate-900 dark:text-[#f1f0e8]"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-5 items-center justify-center rounded bg-blue-100 dark:bg-[#3b71d9]/25 border border-blue-200/60 dark:border-blue-500/30 px-1.5 text-[11px] font-extrabold text-[#3b71d9] dark:text-[#b0c6ff]">
                          #{index + 1}
                        </span>
                        <h3 className="font-bold text-slate-900 dark:text-[#f1f0e8] text-sm sm:text-base font-sans">
                          {match.candidate_label}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-slate-100/80 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/10 px-2 py-0.5 font-medium text-slate-700 dark:text-[#f1f0e8] backdrop-blur-xs">
                          Exact: {Math.round(match.deterministic_score * 100)}%
                        </span>
                        <span className="rounded bg-slate-100/80 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/10 px-2 py-0.5 font-medium text-slate-700 dark:text-[#f1f0e8] backdrop-blur-xs">
                          Semantic: {Math.round(match.semantic_score * 100)}%
                        </span>
                        <span className="rounded bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-300 backdrop-blur-xs">
                          Verified Bonus: +{Math.round(match.verification_bonus * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <strong className="text-2xl font-black text-[#3b71d9] dark:text-[#b0c6ff] block leading-none font-sans">
                          {Math.round(match.final_score * 100)}%
                        </strong>
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-[#98a4b3] uppercase tracking-wider font-sans">
                          Fit Score
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void showExplanation(match)}
                        className="rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-blue-50/50 dark:bg-[#3b71d9]/20 px-3.5 py-2 text-xs font-bold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-[#3b71d9] hover:text-white transition-colors cursor-pointer font-sans"
                      >
                        View Breakdown
                      </button>
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

        {/* Match Explanation Modal / Drawer */}
        {explanation && <MatchExplanationPanel explanation={explanation} />}
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
    <section className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-5 sm:p-6 shadow-lg text-slate-900 dark:text-[#f1f0e8]">
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
          <PlusCircle className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
          <span>Post New Internship</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">Define criteria with canonical taxonomy skills</p>
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3.5">
        <label className="block text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] font-sans">
          Job / Internship Title
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Backend Platform Engineer Intern"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3.5 py-2 text-xs text-slate-900 dark:text-[#f1f0e8] focus:border-[#3b71d9] focus:outline-none"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] font-sans">
          Role Description & Scope
          <textarea
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the internship responsibilities, stack, and project goals..."
            className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3.5 py-2 text-xs text-slate-900 dark:text-[#f1f0e8] focus:border-[#3b71d9] focus:outline-none"
          />
        </label>

        <div className="relative">
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] font-sans">
            Canonical Skill Requirement
            <div className="relative mt-1">
              <input
                value={skillQuery}
                onChange={(event) => void searchSkills(event.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md pl-9 pr-3.5 py-2 text-xs text-slate-900 dark:text-[#f1f0e8] focus:border-[#3b71d9] focus:outline-none"
                placeholder="Search taxonomy (e.g. Python, React, PostgreSQL)..."
              />
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </label>

          {skills.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151e29] shadow-lg">
              {skills.map((skill) => (
                <li key={skill.id} className="border-b border-slate-50 dark:border-white/[0.04] last:border-0">
                  <button
                    type="button"
                    onClick={() => addRequirement(skill)}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-blue-50 dark:hover:bg-[#1a2430] transition-colors cursor-pointer"
                  >
                    <span className="font-semibold text-slate-900 dark:text-[#f1f0e8]">{skill.canonical_name}</span>
                    <span className="text-[11px] text-slate-400 dark:text-[#dedbc8] uppercase tracking-wider">{skill.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected Requirements Pills */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-[#98a4b3] uppercase tracking-wider block font-sans">
            Selected Requirements ({requirements.length})
          </span>
          <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/40 dark:bg-white/[0.02]">
            {requirements.length ? (
              requirements.map((requirement) => (
                <span
                  key={requirement.skill_id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/60 dark:border-blue-900/60 bg-blue-50 dark:bg-[#182337] px-2.5 py-1 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff]"
                >
                  {requirement.name}
                  <button
                    type="button"
                    aria-label={`Remove ${requirement.name}`}
                    onClick={() =>
                      setRequirements((current) =>
                        current.filter((item) => item.skill_id !== requirement.skill_id)
                      )
                    }
                    className="font-bold text-[#3b71d9] hover:text-blue-700 dark:hover:text-blue-200 cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 dark:text-slate-500 italic py-0.5 px-1 font-sans">
                No skills selected yet. Search above to add.
              </span>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-[#3b71d9] py-2.5 text-xs font-semibold text-white shadow-md shadow-[#3b71d9]/25 hover:bg-[#2563eb] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors cursor-pointer font-sans"
        >
          {isSubmitting ? "Posting Opportunity..." : "Publish Internship"}
        </button>
      </form>
    </section>
  );
}
