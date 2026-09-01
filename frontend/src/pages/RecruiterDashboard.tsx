import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Briefcase, Users, PlusCircle, Search, Edit3, Trash2 } from "lucide-react";
import { ApiError, api } from "../api";
import type { CandidateMatch, Internship, InternshipRequirementInput, MatchExplanation, Skill } from "../api";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState";
import { MatchExplanationPanel } from "../components/MatchExplanationPanel";
import { TypewriterText } from "../components/TypewriterText";
import { TypewriterReveal } from "../components/TypewriterReveal";
import { diagonalPageVariants, reducedMotionVariants, pageAssemblyItemVariants } from "../theme/motion";
import type { RecruiterTab } from "../App";
import { LiquidGlassButton } from "../components/ui/EditorialPrimitives";

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
              <span>Recruiter Workstation</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
              <TypewriterText
                key={`${activeTab}-rec-title`}
                text={recruiterHeaderMap[activeTab]?.title || "Evidence-Backed Candidate Matching"}
                speed={16}
                delay={0.02}
              />
            </h1>
            <p className="text-xs text-[#475569]">
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
              <TypewriterReveal delay={0.12} duration={0.52} className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] flex flex-col text-[#111827] shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
                <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                  <div>
                    <h2 className="text-2xl font-normal text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                      <Briefcase className="h-5 w-5 text-[#B08D57]" />
                      <span>Your Posted Internships</span>
                    </h2>
                    <p className="text-xs text-[#475569] mt-0.5">Select an opportunity to inspect ranked candidate pools</p>
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
                                  <span className="text-lg font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
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
                                  {internship.requirements.length} required skill{internship.requirements.length === 1 ? "" : "s"}
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
            )}
          </motion.div>

          {/* Selected Internship Candidate Matches */}
          {(showAll || activeTab === "candidates") && selected && (
            <TypewriterReveal
              delay={0.18}
              duration={0.52}
              className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-7 rounded-[16px] space-y-4 text-[#111827] shadow-[0_8px_30px_rgba(17,24,39,0.04)]"
            >
              <div className="flex items-baseline justify-between border-b border-[#E5E1D8] pb-4">
                <div>
                  <h2 className="text-2xl font-normal text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                    <Users className="h-5 w-5 text-[#B08D57]" />
                    <span>
                      Ranked Candidates for <span className="underline underline-offset-4 text-[#B08D57]">{selected.title}</span>
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
                          <h3 className="text-lg font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
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
                          <strong className="text-3xl font-normal text-[#111827] block leading-none" style={{ fontFamily: "var(--font-display)" }}>
                            {Math.round(match.final_score * 100)}%
                          </strong>
                          <span className="text-[10px] uppercase text-[#64748B] font-semibold">
                            Fit Score
                          </span>
                        </div>
                        <LiquidGlassButton
                          onClick={() => void showExplanation(match)}
                          size="sm"
                        >
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
        <h2 className="text-2xl font-normal text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
          <PlusCircle className="h-5 w-5 text-[#B08D57]" />
          <span>Post New Internship</span>
        </h2>
        <p className="text-xs text-[#475569] mt-0.5">Define criteria with canonical taxonomy skills</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#475569] mb-1 font-semibold">
            Job / Internship Title
          </label>
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Backend Platform Engineer Intern"
            className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-2.5 text-xs text-[#111827] focus:border-[#B08D57]"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#475569] mb-1 font-semibold">
            Role Description & Scope
          </label>
          <textarea
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the internship responsibilities, stack, and project goals..."
            rows={3}
            className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-2.5 text-xs text-[#111827] focus:border-[#B08D57]"
          />
        </div>

        <div className="relative">
          <label className="block font-mono text-[10px] uppercase tracking-wider text-[#475569] mb-1 font-semibold">
            Canonical Skill Requirement
          </label>
          <div className="relative">
            <input
              value={skillQuery}
              onChange={(event) => void searchSkills(event.target.value)}
              className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] pl-9 pr-3.5 py-2.5 text-xs text-[#111827] focus:border-[#B08D57]"
              placeholder="Search taxonomy (e.g. Python, React, PostgreSQL)..."
            />
            <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-[#64748B] pointer-events-none" />
          </div>

          {skills.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-[12px] border border-[#E5E1D8] bg-[#FFFFFF] shadow-xl">
              {skills.map((skill) => (
                <li key={skill.id} className="border-b border-[#E5E1D8] last:border-0">
                  <button
                    type="button"
                    onClick={() => addRequirement(skill)}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-[#F7F5F0] transition-colors cursor-pointer"
                  >
                    <span className="font-mono text-xs text-[#111827] font-semibold">{skill.canonical_name}</span>
                    <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider">{skill.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Selected Requirements Pills */}
        <div className="space-y-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] block font-semibold">
            Selected Requirements ({requirements.length})
          </span>
          <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2.5 rounded-[12px] border border-dashed border-[#E5E1D8] bg-[#F7F5F0]">
            {requirements.length ? (
              requirements.map((requirement) => (
                <span
                  key={requirement.skill_id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-1 font-mono text-xs text-[#111827] shadow-2xs"
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
                    className="text-[#64748B] hover:text-[#B4534B] cursor-pointer ml-1 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-[#64748B] font-mono py-1 px-1">
                No skills selected yet. Search above to add.
              </span>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs text-[#B4534B] font-mono bg-[rgba(180,83,75,0.08)] border border-[#B4534B]/30 p-2.5 rounded-lg">
            {error}
          </p>
        )}

        <LiquidGlassButton
          type="submit"
          disabled={isSubmitting}
          className="w-full justify-center"
        >
          {isSubmitting ? "Posting Opportunity..." : "Publish Internship"}
        </LiquidGlassButton>
      </form>
    </section>
  );
}
