import { type FormEvent, useCallback, useEffect, useState } from "react";

import { ApiError, api } from "../api";
import type { AutomationPolicy, AutomationQueueItem } from "../api";
import { EmptyState, ErrorState, LoadingState } from "./AsyncState";

const safeDefaultPolicy = {
  name: "My review queue",
  enabled: false,
  priority: 100,
  minimum_match_score: 0.2,
  allowed_providers: [] as ("greenhouse" | "lever")[],
  allowed_locations: [],
  remote_preference: null,
  employment_types: [],
  experience_levels: [],
  required_skills_any: [],
  required_skills_all: [],
  excluded_skills: [],
  excluded_companies: [],
  excluded_keywords: [],
  maximum_jobs_per_run: 25,
  maximum_review_intents_per_run: 5,
  maximum_review_intents_per_day: 5,
  maximum_pending_review_queue_size: 25,
  auto_create_review_intent: true,
};

function QueueItem({ item }: { item: AutomationQueueItem }) {
  const missing = item.explanation.items.filter((entry) => entry.status === "missing").map((entry) => entry.skill_name);
  return <li className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{item.title}</strong><p className="text-sm text-slate-600">{item.company_name} · {item.provider} · selected by {item.policy_name}</p></div><strong className="text-indigo-700">{Math.round(item.final_score * 100)}%</strong></div><p className="mt-2 text-xs text-slate-600">Why it matched: {item.policy_reason.join(", ").replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-600">Missing skills: {missing.length ? missing.join(", ") : "None recorded"}</p><p className="mt-1 text-xs text-slate-600">Active resume: {item.active_resume_filename ?? "No active resume selected"}</p><p className="mt-1 text-xs font-medium text-slate-700">{item.application_status ? `Application: ${item.application_status.replaceAll("_", " ")}` : "Recommendation surfaced for review"}</p></li>;
}

const csv = (value: string): string[] => value.split(",").map((item) => item.trim()).filter(Boolean);

function PolicyEditor({ policy, token, onSaved }: { policy: AutomationPolicy; token: string; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(policy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function set<K extends keyof AutomationPolicy>(key: K, value: AutomationPolicy[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { setBusy(true); setError(null); await api.updateAutomationPolicy(policy.id, { minimum_match_score: draft.minimum_match_score, allowed_providers: draft.allowed_providers, allowed_locations: draft.allowed_locations, remote_preference: draft.remote_preference, employment_types: draft.employment_types, experience_levels: draft.experience_levels, required_skills_any: draft.required_skills_any, required_skills_all: draft.required_skills_all, excluded_skills: draft.excluded_skills, excluded_companies: draft.excluded_companies, excluded_keywords: draft.excluded_keywords, maximum_jobs_per_run: draft.maximum_jobs_per_run, maximum_review_intents_per_run: draft.maximum_review_intents_per_run, maximum_review_intents_per_day: draft.maximum_review_intents_per_day, maximum_pending_review_queue_size: draft.maximum_pending_review_queue_size, auto_create_review_intent: draft.auto_create_review_intent }, token); await onSaved(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.detail : "The automation policy could not be saved."); }
    finally { setBusy(false); }
  }
  return <details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-indigo-700">Configure filters and limits</summary><form onSubmit={(event) => void save(event)} className="mt-3 grid gap-3 text-sm md:grid-cols-2"><label>Minimum match <input aria-label={`${policy.name} minimum match`} type="number" min="0" max="1" step="0.05" value={draft.minimum_match_score} onChange={(event) => set("minimum_match_score", Number(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Providers (greenhouse, lever)<input value={draft.allowed_providers.join(", ")} onChange={(event) => set("allowed_providers", csv(event.target.value).filter((item): item is "greenhouse" | "lever" => item === "greenhouse" || item === "lever"))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Locations<input value={draft.allowed_locations.join(", ")} onChange={(event) => set("allowed_locations", csv(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Remote preference<select value={draft.remote_preference === null ? "any" : String(draft.remote_preference)} onChange={(event) => set("remote_preference", event.target.value === "any" ? null : event.target.value === "true")} className="mt-1 block w-full rounded border p-1.5"><option value="any">Any</option><option value="true">Remote only</option><option value="false">Not remote</option></select></label><label>Employment types<input value={draft.employment_types.join(", ")} onChange={(event) => set("employment_types", csv(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Experience levels<input value={draft.experience_levels.join(", ")} onChange={(event) => set("experience_levels", csv(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Require any skill IDs<input value={draft.required_skills_any.join(", ")} onChange={(event) => set("required_skills_any", csv(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Require all skill IDs<input value={draft.required_skills_all.join(", ")} onChange={(event) => set("required_skills_all", csv(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Exclude skill IDs<input value={draft.excluded_skills.join(", ")} onChange={(event) => set("excluded_skills", csv(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Excluded companies<input value={draft.excluded_companies.join(", ")} onChange={(event) => set("excluded_companies", csv(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Excluded keywords<input value={draft.excluded_keywords.join(", ")} onChange={(event) => set("excluded_keywords", csv(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Jobs per run<input type="number" min="1" max="100" value={draft.maximum_jobs_per_run} onChange={(event) => set("maximum_jobs_per_run", Number(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Review intents per run<input type="number" min="0" max="10" value={draft.maximum_review_intents_per_run} onChange={(event) => set("maximum_review_intents_per_run", Number(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Review intents per day<input type="number" min="0" max="10" value={draft.maximum_review_intents_per_day} onChange={(event) => set("maximum_review_intents_per_day", Number(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label>Pending review limit<input type="number" min="0" max="100" value={draft.maximum_pending_review_queue_size} onChange={(event) => set("maximum_pending_review_queue_size", Number(event.target.value))} className="mt-1 block w-full rounded border p-1.5" /></label><label className="flex items-center gap-2"><input type="checkbox" checked={draft.auto_create_review_intent} onChange={(event) => set("auto_create_review_intent", event.target.checked)} />Automatically add eligible jobs to review queue</label>{error ? <p role="alert" className="text-red-700">{error}</p> : null}<button type="submit" disabled={busy} className="w-fit rounded bg-indigo-700 px-3 py-1.5 font-medium text-white disabled:bg-slate-400">{busy ? "Saving…" : "Save policy"}</button></form></details>;
}

export function AutomationPreferences({ token }: { token: string }) {
  const [policies, setPolicies] = useState<AutomationPolicy[] | null>(null);
  const [queue, setQueue] = useState<AutomationQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { setError(null); const [policyPage, reviewQueue] = await Promise.all([api.automationPolicies(token), api.automationReviewQueue(token)]); setPolicies(policyPage.items); setQueue(reviewQueue.items); }
    catch (caught) { setError(caught instanceof ApiError ? caught.detail : "Automation preferences could not be loaded."); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function addPolicy() {
    try { setBusy(true); setError(null); await api.createAutomationPolicy(safeDefaultPolicy, token); await load(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.detail : "The automation policy could not be created."); }
    finally { setBusy(false); }
  }
  async function setEnabled(policy: AutomationPolicy, enabled: boolean) {
    try { setBusy(true); setError(null); await api.updateAutomationPolicy(policy.id, { enabled }, token); await load(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.detail : "The automation policy could not be updated."); }
    finally { setBusy(false); }
  }
  if ((!policies || !queue) && !error) return <LoadingState label="Loading automation preferences" />;
  return <section aria-label="Automation preferences" className="space-y-4 rounded-xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Job review automation</h2><p className="mt-1 text-sm text-slate-600">Automatically add matching jobs to my review queue. This does not approve or submit applications.</p></div><button type="button" disabled={busy} onClick={() => void addPolicy()} className="rounded border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700 disabled:text-slate-400">Add review policy</button></div>{error ? <ErrorState message={error} onRetry={() => void load()} /> : null}<div><h3 className="font-medium">Policies</h3>{policies?.length ? <ul className="mt-2 space-y-2">{policies.map((policy) => <li key={policy.id} className="rounded border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><div><strong>{policy.name}</strong><p className="text-xs text-slate-600">Minimum match {Math.round(policy.minimum_match_score * 100)}% · up to {policy.maximum_review_intents_per_day} review intents/day</p></div><button type="button" disabled={busy} onClick={() => void setEnabled(policy, !policy.enabled)} className="rounded border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700">{policy.enabled ? "Disable" : "Enable"}</button></div><PolicyEditor policy={policy} token={token} onSaved={load} /></li>)}</ul> : <EmptyState title="No automation policies">Policies start disabled. Add one, review its limits, then enable it when ready.</EmptyState>}</div><div><h3 className="font-medium">Ready for review</h3>{queue?.length ? <ul className="mt-2 space-y-2">{queue.map((item) => <QueueItem key={`${item.policy_id}-${item.match_id}`} item={item} />)}</ul> : <p className="mt-2 text-sm text-slate-600">No policy-selected recommendations yet.</p>}</div></section>;
}
