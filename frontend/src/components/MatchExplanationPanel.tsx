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
    <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 py-3 last:border-0 font-sans">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isExact && <CheckCircle2 className="h-4 w-4 text-white shrink-0" />}
          {isSemantic && <Sparkles className="h-4 w-4 text-neutral-300 shrink-0" />}
          {isMissing && <XCircle className="h-4 w-4 text-red-400 shrink-0" />}

          <span className="font-medium text-xs text-white">{line.skill_name}</span>

          {isSemantic && line.matched_skill_name && (
            <span className="font-mono text-[10px] uppercase text-neutral-300 border border-white/15 px-1.5 py-0.5 rounded-xs">
              Semantic ⇄ {line.matched_skill_name} ({Math.round((line.semantic_similarity ?? 0) * 100)}%)
            </span>
          )}

          {isMissing && (
            <span className="font-mono text-[10px] uppercase text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-xs">
              Missing
            </span>
          )}
        </div>

        {line.evidence_title && (
          <p className="font-mono text-[11px] text-neutral-400 pl-6">
            Supported by evidence: <span className="text-white">&quot;{line.evidence_title}&quot;</span>
          </p>
        )}
      </div>

      <div className="pl-6 sm:pl-0 shrink-0 text-right">
        <span className="inline-block font-mono border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-white rounded-xs">
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
  const exactItems = explanation.items.filter((i) => i.status.startsWith("matched_"));
  const semanticItems = explanation.items.filter((i) => i.status === "semantic_near_match");
  const missingItems = explanation.items.filter((i) => i.status === "missing");

  return (
    <motion.section
      aria-label="Deterministic match explanation"
      variants={prefersReducedMotion ? undefined : modalVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="border border-white/15 bg-[#061524] p-6 rounded-md space-y-5 text-white font-sans relative"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="text-xl font-normal text-white flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <ShieldCheck className="h-5 w-5 text-white/80" />
            <span>Deterministic Match Formula Audit</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Rendered directly from persisted database evidence records and exact scoring formulas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-300 border border-white/15 px-2 py-0.5 rounded-xs">
            v{explanation.score_version}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-full text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metric Breakdown Cards */}
      <dl className="grid grid-cols-3 gap-3 text-center font-mono">
        <div className="border border-white/10 bg-white/[0.02] p-3 rounded-sm">
          <dt className="text-[10px] uppercase text-neutral-400">Exact Overlap (D)</dt>
          <dd className="text-xl font-normal text-white mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
            <AnimatedNumber value={Math.round(explanation.deterministic_score * 100)} formatter={(v) => `${v}%`} />
          </dd>
        </div>
        <div className="border border-white/10 bg-white/[0.02] p-3 rounded-sm">
          <dt className="text-[10px] uppercase text-neutral-400">Semantic Match (S)</dt>
          <dd className="text-xl font-normal text-white mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
            <AnimatedNumber value={Math.round(explanation.semantic_score * 100)} formatter={(v) => `${v}%`} />
          </dd>
        </div>
        <div className="border border-white/10 bg-white/[0.02] p-3 rounded-sm">
          <dt className="text-[10px] uppercase text-neutral-400">Verified Bonus (V)</dt>
          <dd className="text-xl font-normal text-white mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
            +<AnimatedNumber value={Math.round(explanation.verification_bonus * 100)} formatter={(v) => `${v}%`} />
          </dd>
        </div>
      </dl>

      {/* Semantic Notice */}
      {semanticItems.length > 0 && (
        <div className="flex items-start gap-2.5 border border-white/10 bg-white/[0.02] p-3 rounded-sm text-xs font-mono text-neutral-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-neutral-300" />
          <span>
            <strong className="text-white">Note on Semantic Near-Matches:</strong> Semantic similarity indicates conceptual closeness based on vector embeddings. It does <em>not</em> imply exact verified possession of the required skill.
          </span>
        </div>
      )}

      {/* Item Breakdown */}
      <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm space-y-4">
        {exactItems.length > 0 && (
          <div>
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span>Verified & Exact Matched Skills ({exactItems.length})</span>
            </h4>
            <ul className="divide-y divide-white/10">
              {exactItems.map((line) => (
                <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />
              ))}
            </ul>
          </div>
        )}

        {semanticItems.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-neutral-300" />
              <span>Semantic Near-Matches ({semanticItems.length})</span>
            </h4>
            <ul className="divide-y divide-white/10">
              {semanticItems.map((line) => (
                <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />
              ))}
            </ul>
          </div>
        )}

        {missingItems.length > 0 && (
          <div className="pt-2 border-t border-white/10">
            <h4 className="font-mono text-[10px] uppercase tracking-wider text-red-400 mb-2 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-red-400" />
              <span>Missing Skill Requirements ({missingItems.length})</span>
            </h4>
            <ul className="divide-y divide-white/10">
              {missingItems.map((line) => (
                <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="font-mono text-xs uppercase text-neutral-400">Final Audit Score</span>
        <span className="font-mono text-base font-medium text-white">
          <AnimatedNumber value={Math.round(explanation.final_score * 100)} formatter={(v) => `${v}% Final Score`} />
        </span>
      </div>
    </motion.section>
  );
}
