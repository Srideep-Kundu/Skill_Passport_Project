import { motion, useReducedMotion } from "framer-motion";
import type { MatchExplanation, MatchExplanationLine } from "../api";
import { AlertCircle, CheckCircle2, ShieldCheck, Sparkles, XCircle, X } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";
import { containerStaggerVariants, cardItemVariants, modalVariants } from "../theme/motion";

function ExplanationRow({ line }: { line: MatchExplanationLine }) {
  const prefersReducedMotion = useReducedMotion();
  const isExact = line.status.startsWith("matched_");
  const isSemantic = line.status === "semantic_near_match";
  const isMissing = line.status === "missing";

  return (
    <motion.li
      variants={prefersReducedMotion ? undefined : cardItemVariants}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 py-3 last:border-0"
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isExact && <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
          {isSemantic && <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />}
          {isMissing && <XCircle className="h-4 w-4 text-rose-500 shrink-0" />}

          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{line.skill_name}</span>

          {isSemantic && line.matched_skill_name && (
            <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/80 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-900">
              Semantic match ⇄ {line.matched_skill_name} ({Math.round((line.semantic_similarity ?? 0) * 100)}%)
            </span>
          )}

          {isMissing && (
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/80 px-2 py-0.5 rounded uppercase">
              Missing
            </span>
          )}
        </div>

        {line.evidence_title && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-6">
            Supported by evidence: <span className="font-semibold text-slate-700 dark:text-slate-300">&quot;{line.evidence_title}&quot;</span>
          </p>
        )}
      </div>

      <div className="pl-6 sm:pl-0 shrink-0 text-right">
        <span className="inline-block rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-black text-slate-900 dark:text-slate-100">
          +<AnimatedNumber value={Math.round(line.total_contribution * 100)} /> pts
        </span>
      </div>
    </motion.li>
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
      className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/75 backdrop-blur-2xl p-5 sm:p-6 shadow-2xl space-y-5 text-slate-900 dark:text-[#f1f0e8] relative"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
            <ShieldCheck className="h-5 w-5 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>Deterministic Match Formula Audit</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-[#98a4b3] mt-0.5 font-sans">
            Rendered directly from persisted evidence hashes and exact scoring formulas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-[#98a4b3] bg-white/80 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200 dark:border-white/10 px-2.5 py-1 rounded-full font-sans">
            v{explanation.score_version}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Metric Breakdown Cards */}
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.03] backdrop-blur-md p-3.5 shadow-xs">
          <dt className="text-[10px] font-bold text-slate-400 dark:text-[#98a4b3] uppercase tracking-wider font-sans">Exact Overlap</dt>
          <dd className="text-xl font-black text-slate-900 dark:text-[#f1f0e8] mt-0.5 font-sans">
            <AnimatedNumber value={Math.round(explanation.deterministic_score * 100)} formatter={(v) => `${v}%`} />
          </dd>
        </div>
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.03] backdrop-blur-md p-3.5 shadow-xs">
          <dt className="text-[10px] font-bold text-slate-400 dark:text-[#98a4b3] uppercase tracking-wider font-sans">Semantic Match</dt>
          <dd className="text-xl font-black text-[#3b71d9] dark:text-[#b0c6ff] mt-0.5 font-sans">
            <AnimatedNumber value={Math.round(explanation.semantic_score * 100)} formatter={(v) => `${v}%`} />
          </dd>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#151e29] p-3.5 shadow-xs">
          <dt className="text-[10px] font-bold text-slate-400 dark:text-[#98a4b3] uppercase tracking-wider font-sans">Verified Bonus</dt>
          <dd className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-sans">
            +<AnimatedNumber value={Math.round(explanation.verification_bonus * 100)} formatter={(v) => `${v}%`} />
          </dd>
        </div>
      </dl>

      {/* MANDATORY DISCLAIMER FOR SEMANTIC NEAR-MATCHES */}
      {semanticItems.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs font-medium text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Note on Semantic Near-Matches:</strong> Semantic similarity indicates conceptual closeness based on embeddings. It does <em>not</em> imply exact verified possession of the required skill.
          </span>
        </div>
      )}

      {/* Item List Categories with Staggered Entrance */}
      <motion.div
        variants={prefersReducedMotion ? undefined : containerStaggerVariants}
        initial="hidden"
        animate="visible"
        className="rounded-xl bg-white dark:bg-[#111a2e] border border-indigo-100/80 dark:border-slate-800/80 p-4 shadow-xs space-y-4"
      >
        {/* Exact Matched Skills */}
        {exactItems.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Verified & Exact Matched Skills ({exactItems.length})</span>
            </h4>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {exactItems.map((line) => (
                <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />
              ))}
            </ul>
          </div>
        )}

        {/* Semantic Near Matches */}
        {semanticItems.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Semantic Near-Matches ({semanticItems.length})</span>
            </h4>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {semanticItems.map((line) => (
                <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />
              ))}
            </ul>
          </div>
        )}

        {/* Missing Skills */}
        {missingItems.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" />
              <span>Missing Skill Requirements ({missingItems.length})</span>
            </h4>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {missingItems.map((line) => (
                <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      {/* Summary Footer */}
      <div className="flex items-center justify-between border-t border-indigo-100 dark:border-slate-800 pt-3">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Final Audit Score</span>
        <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
          <AnimatedNumber value={Math.round(explanation.final_score * 100)} formatter={(v) => `${v}% Final Score`} />
        </span>
      </div>
    </motion.section>
  );
}
