import { motion, useReducedMotion } from "framer-motion";
import type { MatchExplanation, MatchExplanationLine } from "../api";
import { AlertCircle, CheckCircle2, ShieldCheck, Sparkles, XCircle, X } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import { modalVariants } from "../theme/motion";

function ExplanationRow({ line }: { line: MatchExplanationLine }) {
  const isExact = line.status.startsWith("matched_");
  const isSemantic = line.status === "semantic_near_match";
  const isMissing = line.status === "missing";

  return (
    <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E1D8] py-3 last:border-0 font-sans">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isExact && <CheckCircle2 className="h-4 w-4 text-[#4F6F5A] shrink-0" />}
          {isSemantic && <Sparkles className="h-4 w-4 text-[#B08D57] shrink-0" />}
          {isMissing && <XCircle className="h-4 w-4 text-[#B4534B] shrink-0" />}

          <span className="font-medium text-xs text-[#111827]">{line.skill_name}</span>

          {isSemantic && line.matched_skill_name && (
            <span className="font-mono text-[10px] uppercase text-[#B08D57] border border-[#B08D57]/30 bg-[rgba(176,141,87,0.08)] px-2 py-0.5 rounded-full font-semibold">
              Semantic ⇄ {line.matched_skill_name} ({Math.round((line.semantic_similarity ?? 0) * 100)}%)
            </span>
          )}

          {isMissing && (
            <span className="font-mono text-[10px] uppercase text-[#B4534B] border border-[#B4534B]/30 bg-[rgba(180,83,75,0.08)] px-2 py-0.5 rounded-full font-semibold">
              Missing
            </span>
          )}
        </div>

        {line.evidence_title && (
          <p className="font-mono text-[11px] text-[#64748B] pl-6">
            Supported by evidence: <span className="text-[#111827] font-medium">&quot;{line.evidence_title}&quot;</span>
          </p>
        )}
      </div>

      <div className="pl-6 sm:pl-0 shrink-0 text-right">
        <span className="inline-block font-mono border border-[#E5E1D8] bg-[#FFFFFF] px-2.5 py-0.5 text-xs text-[#4F6F5A] font-semibold rounded-full shadow-2xs">
          +<AnimatedNumber value={Math.round(line.total_contribution * 100)} /> pts
        </span>
      </div>
    </li>
  );
}

export function MatchExplanationPanel({
  explanation,
  onClose,
}: {
  explanation: MatchExplanation;
  onClose?: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const items = Array.isArray(explanation?.items) ? explanation.items : [];
  const exactItems = items.filter((i) => i?.status?.startsWith("matched_"));
  const semanticItems = items.filter((i) => i?.status === "semantic_near_match");
  const missingItems = items.filter((i) => i?.status === "missing");

  return (
    <motion.section
      aria-label="Deterministic match explanation"
      variants={prefersReducedMotion ? undefined : modalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-7 rounded-[16px] space-y-5 text-[#111827] font-sans shadow-[0_20px_50px_rgba(17,24,39,0.15)] relative"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[#E5E1D8] pb-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold mb-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
            <span>ALGORITHMIC PROVENANCE BREAKDOWN</span>
          </div>
          <h3 className="text-2xl font-normal text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <ShieldCheck className="h-5 w-5 text-[#B08D57]" />
            <span>Deterministic Match Formula Audit</span>
          </h3>
          <p className="text-xs text-[#475569] mt-0.5">
            Rendered directly from persisted database evidence records and exact scoring formulas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] border border-[#E5E1D8] bg-[#F7F5F0] px-2.5 py-0.5 rounded-full font-semibold">
            v{explanation.score_version}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#64748B] hover:text-[#111827] hover:bg-[#EFEBE3] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metric Breakdown Cards */}
      <dl className="grid grid-cols-3 gap-3 text-center font-mono">
        <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[12px]">
          <dt className="text-[10px] uppercase text-[#64748B] font-semibold">Exact Overlap (D)</dt>
          <dd className="text-2xl font-normal text-[#111827] mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
            <AnimatedNumber value={Math.round(explanation.deterministic_score * 100)} formatter={(v) => `${v}%`} />
          </dd>
        </div>
        <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[12px]">
          <dt className="text-[10px] uppercase text-[#64748B] font-semibold">Semantic Match (S)</dt>
          <dd className="text-2xl font-normal text-[#111827] mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
            <AnimatedNumber value={Math.round(explanation.semantic_score * 100)} formatter={(v) => `${v}%`} />
          </dd>
        </div>
        <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[12px]">
          <dt className="text-[10px] uppercase text-[#64748B] font-semibold">Verified Bonus (V)</dt>
          <dd className="text-2xl font-normal text-[#4F6F5A] mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
            +<AnimatedNumber value={Math.round(explanation.verification_bonus * 100)} formatter={(v) => `${v}%`} />
          </dd>
        </div>
      </dl>

      {/* Semantic Notice */}
      {semanticItems.length > 0 && (
        <div className="flex items-start gap-2.5 border border-[#E5E1D8] bg-[#F7F5F0] p-3.5 rounded-[12px] text-xs font-mono text-[#475569]">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#B08D57]" />
          <span>
            <strong className="text-[#111827]">Note on Semantic Near-Matches:</strong> Semantic similarity indicates conceptual closeness based on vector embeddings. It does <em>not</em> imply exact verified possession of the required skill.
          </span>
        </div>
      )}

      {/* Item Breakdown */}
      <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-5 rounded-[14px] space-y-4">
        {exactItems.length > 0 && (
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] font-semibold mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#4F6F5A]" />
              <span>Verified & Exact Matched Skills ({exactItems.length})</span>
            </h4>
            <ul className="divide-y divide-[#E5E1D8]">
              {exactItems.map((line) => (
                <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />
              ))}
            </ul>
          </div>
        )}

        {semanticItems.length > 0 && (
          <div className="pt-3 border-t border-[#E5E1D8]">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#B08D57]" />
              <span>Semantic Near-Matches ({semanticItems.length})</span>
            </h4>
            <ul className="divide-y divide-[#E5E1D8]">
              {semanticItems.map((line) => (
                <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />
              ))}
            </ul>
          </div>
        )}

        {missingItems.length > 0 && (
          <div className="pt-3 border-t border-[#E5E1D8]">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-[#B4534B] font-semibold mb-2 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-[#B4534B]" />
              <span>Missing Skill Requirements ({missingItems.length})</span>
            </h4>
            <ul className="divide-y divide-[#E5E1D8]">
              {missingItems.map((line) => (
                <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between border-t border-[#E5E1D8] pt-3.5">
        <span className="font-mono text-xs uppercase text-[#64748B] font-semibold">Final Audit Score</span>
        <span className="font-mono text-lg font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
          <AnimatedNumber value={Math.round(explanation.final_score * 100)} formatter={(v) => `${v}% Final Score`} />
        </span>
      </div>
    </motion.section>
  );
}
