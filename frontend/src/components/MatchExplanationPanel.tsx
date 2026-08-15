import type { MatchExplanation, MatchExplanationLine } from "../api";

function ExplanationRow({ line }: { line: MatchExplanationLine }) {
  const matched = line.status !== "missing";
  return <li className="flex justify-between gap-3 border-b border-slate-100 py-2 last:border-0"><span><span aria-hidden="true" className={matched ? "text-emerald-600" : "text-amber-600"}>{matched ? "✓" : "△"}</span> {line.skill_name}{line.evidence_title ? <span className="text-slate-500"> — {line.evidence_title}</span> : null}</span><span className="shrink-0 text-slate-600">{Math.round(line.contribution * 100)} pts</span></li>;
}

export function MatchExplanationPanel({ explanation }: { explanation: MatchExplanation }) {
  return <section aria-label="Deterministic match explanation" className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4"><h3 className="font-semibold text-slate-900">Why this match</h3><p className="mt-1 text-sm text-slate-600">Rendered from persisted evidence and score records.</p><dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm"><div className="rounded bg-white p-2"><dt className="text-slate-500">Exact</dt><dd className="font-semibold">{Math.round(explanation.deterministic_score * 100)}%</dd></div><div className="rounded bg-white p-2"><dt className="text-slate-500">Semantic</dt><dd className="font-semibold">{Math.round(explanation.semantic_score * 100)}%</dd></div><div className="rounded bg-white p-2"><dt className="text-slate-500">Verified</dt><dd className="font-semibold">{Math.round(explanation.verification_bonus * 100)}%</dd></div></dl><ul className="mt-4 text-sm">{explanation.items.map((line) => <ExplanationRow key={`${line.skill_id}-${line.status}`} line={line} />)}</ul><p className="mt-4 font-semibold text-slate-900">Persisted final score: {Math.round(explanation.final_score * 100)}%</p><p className="text-xs text-slate-500">Score version: {explanation.score_version}</p></section>;
}
