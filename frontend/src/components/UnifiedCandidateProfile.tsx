import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  FileText,
  FileArchive,
  GitBranch,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  Info,
} from "lucide-react";
import { ApiError, api, type CandidateProfile, type ProfileSkill } from "../api";
import { SkillBadge } from "./SkillBadge";

function sourceIcon(type: string) {
  switch (type) {
    case "github":
    case "github_verified":
      return <GitBranch className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />;
    case "linkedin_export":
      return <FileArchive className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />;
    case "resume":
      return <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
    case "project":
      return <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />;
    default:
      return <Layers className="h-3.5 w-3.5 text-slate-500" />;
  }
}

export function UnifiedCandidateProfile({
  token,
  refreshKey,
}: {
  token: string;
  refreshKey: number;
}) {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api
      .candidateProfile(token)
      .then((result) => {
        if (!cancelled) {
          setProfile(result);
          setLoading(false);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.detail : "Profile could not be loaded.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, token]);

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-5 shadow-sm">
        <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      </section>
    );
  }

  if (loading || !profile) {
    return (
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4 animate-pulse">
        <div className="h-6 w-1/3 bg-slate-200 dark:bg-slate-800 rounded"></div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          ))}
        </div>
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      </section>
    );
  }

  const completeness = profile.profile_completeness;
  const passedCount = Object.values(completeness).filter(Boolean).length;
  const totalChecks = Object.keys(completeness).length || 5;
  const completenessPercent = Math.round((passedCount / totalChecks) * 100);

  const totalSkills = profile.skills.length;
  const verifiedSkills = profile.skills.filter((s) => s.highest_verification_tier === "verified").length;
  const totalSources = Array.from(new Set(profile.skills.flatMap((s) => s.source_types))).length;

  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm space-y-6 text-slate-900 dark:text-[#f1f0e8]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.08] pb-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
            <Award className="h-5 w-5 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>Skill Passport & Candidate Profile</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
            Aggregated, evidence-backed skill provenance with non-bias guarantees.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile.active_resume && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200/60 dark:border-emerald-800/60 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0 font-sans">
              <FileText className="h-3.5 w-3.5" />
              <span>Active Resume: {profile.active_resume.original_filename}</span>
            </span>
          )}
          {profile.active_linkedin_import && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-[#151e29] border border-blue-200/60 dark:border-white/10 px-3 py-1 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] shrink-0 font-sans">
              <FileArchive className="h-3.5 w-3.5" />
              <span>Active LinkedIn: {profile.active_linkedin_import.original_filename}</span>
            </span>
          )}
        </div>
      </div>

      {/* SUMMARY METRICS TOP GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-[#151e29] p-3.5 space-y-1 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#98a4b3] font-sans">Total Skills</span>
          <p className="text-xl font-black text-slate-900 dark:text-[#f1f0e8] font-sans">{totalSkills}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-[#151e29] p-3.5 space-y-1 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#98a4b3] font-sans">Verified Skills</span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-sans">{verifiedSkills}</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-[#151e29] p-3.5 space-y-1 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#98a4b3] font-sans">Evidence Sources</span>
          <p className="text-xl font-black text-[#3b71d9] dark:text-[#b0c6ff] font-sans">{totalSources} Types</p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-[#151e29] p-3.5 space-y-1 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#98a4b3] font-sans">Completeness</span>
          <p className="text-xl font-black text-slate-900 dark:text-[#f1f0e8] font-sans">{completenessPercent}%</p>
        </div>
      </div>

      {/* SKILL CARDS WITH PROGRESSIVE DISCLOSURE */}
      {profile.skills.length ? (
        <div className="space-y-3">
          {profile.skills.map((skill) => (
            <PolishedSkillCard key={skill.skill_id} skill={skill} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/10 p-8 text-center">
          <Info className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <h3 className="font-bold text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">No evidence-backed skills found</h3>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-1 font-sans">
            Upload your resume or technical project evidence above to generate verified skills.
          </p>
        </div>
      )}
    </section>
  );
}

function PolishedSkillCard({ skill }: { skill: ProfileSkill }) {
  const [expanded, setExpanded] = useState(false);
  const confidencePercent = Math.round(skill.summary_confidence * 100);

  return (
    <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/40 dark:bg-[#151e29] p-4 transition-all hover:border-[#3b71d9]/40 dark:hover:border-blue-500/40">
      {/* Skill Primary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{skill.canonical_name}</h3>
            <span className="text-xs text-slate-400 dark:text-[#98a4b3]">&middot; {skill.category}</span>
            <SkillBadge name="" tier={skill.highest_verification_tier} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-[#98a4b3] pt-0.5 font-sans">
            <span className="font-medium text-slate-700 dark:text-[#dedbc8]">
              {confidencePercent}% conservative confidence
            </span>
            <span>&middot;</span>
            <span>{skill.supporting_evidence_count} evidence records</span>
            <span>&middot;</span>
            <div className="flex items-center gap-1">
              {skill.source_types.map((st) => (
                <span
                  key={st}
                  className="inline-flex items-center gap-1 rounded bg-white dark:bg-[#111821] border border-slate-200/80 dark:border-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-[#f1f0e8]"
                >
                  {sourceIcon(st)}
                  <span>{st}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Expandable Disclosure Toggle Button */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#111a2e] px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-[#18233d] transition-colors shrink-0 cursor-pointer"
        >
          <span>{expanded ? "Hide provenance" : "View supporting evidence"}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Progressive Disclosure */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden pt-3.5 border-t border-slate-200/60 dark:border-slate-800 mt-3.5"
          >
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Cryptographic Supporting Evidence ({skill.supports.length})
            </h4>

            <ul className="space-y-2">
              {skill.supports.map((support) => (
                <li
                  key={support.evidence_id}
                  className="rounded-lg bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800/80 p-3 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{support.title}</span>
                    <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/60 dark:border-indigo-800/60 px-2 py-0.5 rounded">
                      Origin: {support.origin}
                    </span>
                  </div>

                  <p className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    Span: &quot;{support.evidence_span}&quot;
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span>Effective Confidence: {Math.round(support.effective_confidence * 100)}%</span>
                    <span>&middot;</span>
                    <span>Tier: {support.verification_tier}</span>
                  </div>

                  {support.likely_duplicate_of && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 p-2 rounded-md mt-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>Potential duplicate source detected; deduplicated to prevent score inflation.</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
