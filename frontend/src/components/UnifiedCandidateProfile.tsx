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
      return <GitBranch className="h-3.5 w-3.5 text-[#B08D57]" />;
    case "linkedin_export":
      return <FileArchive className="h-3.5 w-3.5 text-[#B08D57]" />;
    case "resume":
      return <FileText className="h-3.5 w-3.5 text-[#B08D57]" />;
    case "project":
      return <Sparkles className="h-3.5 w-3.5 text-[#B08D57]" />;
    default:
      return <Layers className="h-3.5 w-3.5 text-[#64748B]" />;
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
      <section className="border border-[#B4534B]/30 bg-[rgba(180,83,75,0.10)] p-5 rounded-[16px]">
        <p role="alert" className="text-xs text-[#B4534B] font-mono">
          {error}
        </p>
      </section>
    );
  }

  if (loading || !profile) {
    return (
      <section className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] space-y-4 animate-pulse shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
        <div className="h-6 w-1/3 bg-[#EFEBE3] rounded-lg"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-[#F7F5F0] rounded-lg"></div>
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
    <section className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 rounded-[16px] space-y-6 text-[#111827] font-sans shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E1D8] pb-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold mb-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
            PROVENANCE DOSSIER
          </div>
          <h2 className="text-2xl font-normal text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <Award className="h-5 w-5 text-[#B08D57]" />
            <span>Verified Candidate Dossier</span>
          </h2>
          <p className="text-xs text-[#475569] mt-0.5">
            Aggregated, evidence-backed skill provenance with non-bias guarantees.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {profile.active_resume && (
            <span className="border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-1 rounded-full text-[#475569]">
              Resume: {profile.active_resume.original_filename}
            </span>
          )}
          {profile.active_linkedin_import && (
            <span className="border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-1 rounded-full text-[#475569]">
              LinkedIn: {profile.active_linkedin_import.original_filename}
            </span>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
        <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[14px]">
          <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-semibold">Total Skills</span>
          <p className="text-3xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>{totalSkills}</p>
        </div>

        <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[14px]">
          <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-semibold">Verified Skills</span>
          <p className="text-3xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>{verifiedSkills}</p>
        </div>

        <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[14px]">
          <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-semibold">Evidence Sources</span>
          <p className="text-3xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>{totalSources} Types</p>
        </div>

        <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[14px]">
          <span className="text-[10px] uppercase tracking-wider text-[#64748B] font-semibold">Completeness</span>
          <p className="text-3xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>{completenessPercent}%</p>
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
        <div className="border border-dashed border-[#E5E1D8] bg-[#F7F5F0] p-8 text-center rounded-[16px]">
          <Info className="h-6 w-6 text-[#64748B] mx-auto mb-2" />
          <h3 className="text-base font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>No evidence-backed skills found</h3>
          <p className="text-xs text-[#475569] mt-1">
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
    <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-5 rounded-[14px] transition-all hover:border-[#B08D57]/60">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>{skill.canonical_name}</h3>
            <span className="font-mono text-xs text-[#64748B]">· {skill.category}</span>
            <SkillBadge name="" tier={skill.highest_verification_tier} />
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[#475569] pt-0.5">
            <span className="text-[#111827] font-medium">
              {confidencePercent}% conservative confidence
            </span>
            <span>·</span>
            <span>{skill.supporting_evidence_count} evidence records</span>
            <span>·</span>
            <div className="flex items-center gap-1">
              {skill.source_types.map((st) => (
                <span
                  key={st}
                  className="inline-flex items-center gap-1 border border-[#E5E1D8] bg-[#FFFFFF] px-2 py-0.5 text-[10px] text-[#475569] rounded-full"
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
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-1.5 font-mono text-xs text-[#475569] hover:text-[#111827] hover:border-[#B08D57] transition-all shrink-0 cursor-pointer shadow-2xs"
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
            className="overflow-hidden pt-4 border-t border-[#E5E1D8] mt-4"
          >
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold mb-3">
              Cryptographic Supporting Evidence ({skill.supports.length})
            </h4>

            <ul className="space-y-2.5">
              {skill.supports.map((support) => (
                <li
                  key={support.evidence_id}
                  className="border border-[#E5E1D8] bg-[#FFFFFF] p-3.5 rounded-[10px] space-y-1 font-mono text-xs text-[#111827]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[#111827] font-semibold">{support.title}</span>
                    <span className="text-[10px] uppercase border border-[#E5E1D8] bg-[#F7F5F0] px-2 py-0.5 rounded-full text-[#475569]">
                      Origin: {support.origin}
                    </span>
                  </div>

                  <p className="text-[#475569] text-[11px] font-sans">
                    Span: &quot;{support.evidence_span}&quot;
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-[#64748B] pt-1">
                    <span>Effective Confidence: {Math.round(support.effective_confidence * 100)}%</span>
                    <span>·</span>
                    <span>Tier: {support.verification_tier}</span>
                  </div>

                  {support.likely_duplicate_of && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#A67C3A] border border-[#A67C3A]/20 bg-[rgba(166,124,58,0.08)] p-2 rounded-md mt-1">
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
