import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "../api";
import type { ExternalJob } from "../api";
import { EmptyState, ErrorState, LoadingState } from "./AsyncState";

function syncedLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "Sync time unavailable" : `Synced ${parsed.toLocaleString()}`;
}

export function ExternalJobs({ token }: { token: string }) {
  const [jobs, setJobs] = useState<ExternalJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setError(null);
      setJobs((await api.externalJobs(token)).items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "External jobs could not be loaded.");
    }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  if (!jobs && !error) return <LoadingState label="Loading external jobs" />;
  return <section aria-label="External jobs" className="rounded-xl bg-white p-5 shadow-sm"><div><h2 className="text-lg font-semibold">External jobs</h2><p className="mt-1 text-sm text-slate-600">Synced public listings. Applying happens on the original source; automatic applications are not available.</p></div>{error ? <ErrorState message={error} onRetry={() => void load()} /> : jobs?.length ? <ul className="mt-4 space-y-3">{jobs.map((job) => <li key={job.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{job.title}</h3><p className="text-sm text-slate-600">{job.company_name}{job.location ? ` · ${job.location}` : ""}{job.remote_status === "remote" ? " · Remote" : ""}</p></div><span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">Source: {job.provider}</span></div><p className="mt-2 text-sm text-slate-600">{syncedLabel(job.last_synced_at)}</p><a href={job.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-indigo-700 underline">View source listing</a></li>)}</ul> : <EmptyState title="No synced external jobs">An administrator can sync a configured public job source. Check back after the next sync.</EmptyState>}</section>;
}
