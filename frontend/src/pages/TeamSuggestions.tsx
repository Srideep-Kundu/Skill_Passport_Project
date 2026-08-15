import { useState } from "react";
import { ApiError, api } from "../api";
import type { TeamSuggestion } from "../api";
import { EmptyState } from "../components/AsyncState";

export function TeamSuggestions({ token, availableSkillIds }: { token: string; availableSkillIds: string[] }) {
  const [targets, setTargets] = useState("");
  const [pool, setPool] = useState("");
  const [suggestions, setSuggestions] = useState<TeamSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    const targetSkillSet = targets.split(",").map((value) => value.trim()).filter(Boolean);
    const studentPool = pool.split(",").map((value) => value.trim()).filter(Boolean);
    try { setSuggestions(await api.suggestTeams({ target_skill_set: targetSkillSet.length ? targetSkillSet : availableSkillIds, pool: studentPool }, token)); }
    catch (caught) { setError(caught instanceof ApiError ? caught.detail : "Team suggestions could not be computed."); }
  }
  return <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Form a complementary team</h2><p className="mt-1 text-sm text-slate-600">Suggestions maximize target-skill coverage and subtract 0.5 × skill redundancy. They are not ML judgments.</p><form onSubmit={submit} className="mt-4 grid gap-3"><label className="text-sm font-medium">Target skill IDs <span className="font-normal text-slate-500">(comma separated; blank uses your passport skills)</span><input value={targets} onChange={(event) => setTargets(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium">Student IDs in pool <input required value={pool} onChange={(event) => setPool(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" /></label><button className="w-fit rounded bg-indigo-600 px-4 py-2 font-medium text-white">Suggest teams</button></form>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{suggestions && (suggestions.length ? <ol className="mt-4 space-y-2">{suggestions.map((suggestion, index) => <li key={`${suggestion.pair.join("-")}-${index}`} className="rounded border border-slate-200 p-3"><strong>{suggestion.pair.join(" + ")}</strong><p className="text-sm text-slate-600">Complementarity: {Math.round(suggestion.complementarity_score * 100)}%</p></li>)}</ol> : <EmptyState title="No complementary teams found">Try a larger candidate pool.</EmptyState>)}</section>;
}
