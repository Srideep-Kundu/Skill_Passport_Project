import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "../api";
import type { ExternalJob, ExternalJobMatch, MatchExplanation } from "../api";
import { EmptyState, ErrorState, LoadingState } from "./AsyncState";

function syncedLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "Sync time unavailable" : `Synced ${parsed.toLocaleString()}`;
}

function locationLabel(job: Pick<ExternalJob, "location" | "remote_status">): string {
  return `${job.location ? ` · ${job.location}` : ""}${job.remote_status === "remote" && !job.location?.toLowerCase().includes("remote") ? " · Remote" : ""}`;
}

function Explanation({ explanation }: { explanation: MatchExplanation }) {
  return <details className="mt-3 rounded border border-indigo-100 bg-indigo-50/40 p-3"><summary className="cursor-pointer font-medium text-indigo-800">Why this match?</summary><div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><span>Exact<br /><strong>{Math.round(explanation.deterministic_score * 100)}%</strong></span><span>Semantic<br /><strong>{Math.round(explanation.semantic_score * 100)}%</strong></span><span>Verified<br /><strong>{Math.round(explanation.verification_bonus * 100)}%</strong></span></div><ul className="mt-3 space-y-2 text-sm">{explanation.items.map((item) => <li key={item.skill_id}><span className={item.status === "missing" ? "text-amber-700" : "text-emerald-700"}>{item.status === "missing" ? "△" : item.status === "semantic_near_match" ? "≈" : "✓"}</span> <strong>{item.skill_name}</strong>{item.status === "missing" ? ` — missing ${item.is_required === false ? "preferred" : "required"} skill` : item.status === "semantic_near_match" ? ` — near match with ${item.matched_skill_name ?? "related skill"} (${Math.round((item.semantic_similarity ?? 0) * 100)}%)` : ""}{item.evidence_title ? <span className="text-slate-600"> · {item.evidence_title}</span> : null}{item.verification_tier ? <span className="text-slate-500"> · {item.verification_tier.replaceAll("_", " ")}</span> : null}<span className="block text-xs text-slate-500">Exact {Math.round(item.deterministic_contribution * 100)}% · Semantic {Math.round(item.semantic_contribution * 100)}% · Verification {Math.round(item.verification_contribution * 100)}%</span></li>)}</ul></details>;
}

function RecommendedJob({ job }: { job: ExternalJobMatch }) {
  return <li className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{job.title}</h3><p className="text-sm text-slate-600">{job.company_name}{locationLabel(job)}</p></div><strong className="text-xl text-indigo-700">{Math.round(job.final_score * 100)}%</strong></div><p className="mt-2 text-xs text-slate-600">Source: {job.provider}{job.posted_at ? ` · Posted ${new Date(job.posted_at).toLocaleDateString()}` : ""}{job.is_stale ? " · Match needs refresh" : ""}</p><Explanation explanation={job.explanation} /><a href={job.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-indigo-700 underline">Open original listing</a></li>;
}

export function ExternalJobs({ token }: { token: string }) {
  const [jobs, setJobs] = useState<ExternalJob[] | null>(null);
  const [recommended, setRecommended] = useState<ExternalJobMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try {
      setError(null);
      const [jobPage, matchPage] = await Promise.all([api.externalJobs(token), api.externalJobMatches(token)]);
      setJobs(jobPage.items);
      setRecommended(matchPage.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "External jobs could not be loaded.");
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function refreshRecommendations() {
    try {
      setRefreshing(true);
      await api.recomputeExternalJobMatches(token);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Recommendations could not be refreshed.");
    } finally {
      setRefreshing(false);
    }
  }
  if ((!jobs || !recommended) && !error) return <LoadingState label="Loading external jobs" />;
  return <section aria-label="External jobs" className="space-y-4 rounded-xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Recommended jobs</h2><p className="mt-1 text-sm text-slate-600">Persisted evidence-backed matches. Location and remote preferences filter jobs but never alter skill-fit scores.</p></div><button type="button" onClick={() => void refreshRecommendations()} disabled={refreshing} className="rounded border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700 disabled:text-slate-400">{refreshing ? "Refreshing…" : "Refresh recommendations"}</button></div>{error ? <ErrorState message={error} onRetry={() => void load()} /> : recommended?.length ? <ul className="space-y-3">{recommended.map((job) => <RecommendedJob key={job.id} job={job} />)}</ul> : <EmptyState title="No recommended jobs yet">Refresh recommendations after jobs with canonical required skills have been synced. Jobs below the configured recommendation threshold remain searchable.</EmptyState>}<div className="border-t border-slate-200 pt-4"><h3 className="font-semibold">All synced external jobs</h3>{jobs?.length ? <ul className="mt-3 space-y-3">{jobs.map((job) => <li key={job.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold text-slate-950">{job.title}</h4><p className="text-sm text-slate-600">{job.company_name}{locationLabel(job)}</p></div><span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">Source: {job.provider}</span></div><p className="mt-2 text-sm text-slate-600">{syncedLabel(job.last_synced_at)}{job.requirements.some((item) => item.is_required) ? "" : " · Requirements not yet sufficient for matching"}</p><a href={job.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-indigo-700 underline">Open original listing</a></li>)}</ul> : <EmptyState title="No synced external jobs">An administrator can sync a configured public job source. Check back after the next sync.</EmptyState>}</div></section>;
}
