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
      return <GitBranch className="h-3.5 w-3.5 text-white/70" />;
    case "linkedin_export":
      return <FileArchive className="h-3.5 w-3.5 text-white/70" />;
    case "resume":
      return <FileText className="h-3.5 w-3.5 text-white/70" />;
    case "project":
      return <Sparkles className="h-3.5 w-3.5 text-white/70" />;
    default:
      return <Layers className="h-3.5 w-3.5 text-neutral-400" />;
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
      <section className="border border-red-500/30 bg-red-950/20 p-5 rounded-md">
        <p role="alert" className="text-xs text-red-300 font-mono">
          {error}
        </p>
      </section>
    );
  }

  if (loading || !profile) {
    return (
      <section className="border border-white/10 bg-[#061524] p-6 rounded-md space-y-4 animate-pulse">
        <div className="h-6 w-1/3 bg-white/10 rounded"></div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded"></div>
          ))}
        </div>
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
    <section className="border border-white/10 bg-[#061524] p-6 rounded-md space-y-6 text-white font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-normal text-white flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <Award className="h-4 w-4 text-white/80" />
            <span>Verified Candidate Dossier</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Aggregated, evidence-backed skill provenance with non-bias guarantees.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {profile.active_resume && (
            <span className="border border-white/15 bg-white/5 px-2.5 py-1 rounded-xs text-neutral-300">
              Resume: {profile.active_resume.original_filename}
            </span>
          )}
          {profile.active_linkedin_import && (
            <span className="border border-white/15 bg-white/5 px-2.5 py-1 rounded-xs text-neutral-300">
              LinkedIn: {profile.active_linkedin_import.original_filename}
            </span>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
        <div className="border border-white/10 bg-white/[0.02] p-3.5 rounded-sm">
          <span className="text-[10px] uppercase text-neutral-400">Total Skills</span>
          <p className="text-2xl font-normal text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>{totalSkills}</p>
        </div>

        <div className="border border-white/10 bg-white/[0.02] p-3.5 rounded-sm">
          <span className="text-[10px] uppercase text-neutral-400">Verified Skills</span>
          <p className="text-2xl font-normal text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>{verifiedSkills}</p>
        </div>

        <div className="border border-white/10 bg-white/[0.02] p-3.5 rounded-sm">
          <span className="text-[10px] uppercase text-neutral-400">Evidence Sources</span>
          <p className="text-2xl font-normal text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>{totalSources} Types</p>
        </div>

        <div className="border border-white/10 bg-white/[0.02] p-3.5 rounded-sm">
          <span className="text-[10px] uppercase text-neutral-400">Completeness</span>
          <p className="text-2xl font-normal text-white mt-1" style={{ fontFamily: "var(--font-display)" }}>{completenessPercent}%</p>
        </div>
      </div>

      {/* Structured Skill Cards */}
      {profile.skills.length ? (
        <div className="space-y-3">
          {profile.skills.map((skill) => (
            <PolishedSkillCard key={skill.skill_id} skill={skill} />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-white/10 p-8 text-center rounded-sm">
          <Info className="h-6 w-6 text-neutral-400 mx-auto mb-2" />
          <h3 className="text-sm font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>No evidence-backed skills found</h3>
          <p className="text-xs text-neutral-400 mt-1">
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
    <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm transition-colors hover:border-white/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>{skill.canonical_name}</h3>
            <span className="font-mono text-xs text-neutral-400">· {skill.category}</span>
            <SkillBadge name="" tier={skill.highest_verification_tier} />
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-neutral-400 pt-0.5">
            <span className="text-neutral-200">
              {confidencePercent}% conservative confidence
            </span>
            <span>·</span>
            <span>{skill.supporting_evidence_count} evidence records</span>
            <span>·</span>
            <div className="flex items-center gap-1">
              {skill.source_types.map((st) => (
                <span
                  key={st}
                  className="inline-flex items-center gap-1 border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-neutral-300 rounded-xs"
                >
                  {sourceIcon(st)}
                  <span>{st}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 font-mono text-xs text-neutral-300 hover:text-white transition-colors shrink-0 cursor-pointer"
        >
          <span>{expanded ? "Hide provenance" : "View supporting evidence"}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pt-3 border-t border-white/10 mt-3"
          >
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 mb-2">
              Cryptographic Supporting Evidence ({skill.supports.length})
            </h4>

            <ul className="space-y-2">
              {skill.supports.map((support) => (
                <li
                  key={support.evidence_id}
                  className="border border-white/10 bg-white/[0.02] p-3 rounded-xs space-y-1 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{support.title}</span>
                    <span className="text-[10px] uppercase border border-white/15 px-1.5 py-0.5 rounded-xs text-neutral-300">
                      Origin: {support.origin}
                    </span>
                  </div>

                  <p className="text-neutral-400 text-[11px]">
                    Span: &quot;{support.evidence_span}&quot;
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-neutral-400 pt-0.5">
                    <span>Effective Confidence: {Math.round(support.effective_confidence * 100)}%</span>
                    <span>·</span>
                    <span>Tier: {support.verification_tier}</span>
                  </div>

                  {support.likely_duplicate_of && (
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-300 border border-white/10 bg-white/[0.02] p-2 rounded-xs mt-1">
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
