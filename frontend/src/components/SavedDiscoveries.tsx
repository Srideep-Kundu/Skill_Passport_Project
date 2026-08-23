import { useCallback, useEffect, useState } from "react";
import { Compass, Plus, Play } from "lucide-react";

import { ApiError, api } from "../api";
import type { JobDiscovery } from "../api";

export function SavedDiscoveries({ token }: { token: string }) {
  const [discoveries, setDiscoveries] = useState<JobDiscovery[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setDiscoveries((await api.jobDiscoveries(token)).items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Saved discoveries could not be loaded.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    try {
      setBusy(true);
      await api.createJobDiscovery(
        {
          name: "Daily internship search",
          enabled: true,
          query: null,
          location: null,
          remote_preference: true,
          employment_type: null,
          experience_level: null,
          providers: ["greenhouse"],
          freshness_days: 30,
          minimum_match_score: 0.2,
          cadence_hours: 24,
        },
        token
      );
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Saved discovery could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function run(discovery: JobDiscovery) {
    try {
      setBusy(true);
      await api.runJobDiscovery(discovery.id, token);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Discovery run could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Saved job searches"
      className="space-y-4 rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-5 sm:p-6 shadow-lg text-slate-900 dark:text-[#f1f0e8]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
            <Compass className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>Saved job searches</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
            Recurring discovery refreshes jobs and recommendations only. It never applies for you.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void create()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-white dark:bg-[#151e29] px-3 py-1.5 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-[#1a2430] disabled:opacity-50 transition-colors cursor-pointer font-sans"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add daily search</span>
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {discoveries?.length ? (
        <ul className="space-y-2.5">
          {discoveries.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-3.5 text-slate-900 dark:text-[#f1f0e8]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{item.name}</p>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider font-sans ${
                        item.enabled
                          ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                          : "bg-slate-100 dark:bg-[#111821] text-slate-500 dark:text-[#98a4b3]"
                      }`}
                    >
                      {item.enabled ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
                    {item.providers.join(", ")} · every {item.cadence_hours}h · minimum {Math.round(item.minimum_match_score * 100)}%
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-[#98a4b3] font-sans">
                    Last checked: {item.last_run_at ? new Date(item.last_run_at).toLocaleString() : "not yet"} · Next:{" "}
                    {item.next_run_at ? new Date(item.next_run_at).toLocaleString() : "disabled"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !item.enabled}
                  onClick={() => void run(item)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] underline hover:text-blue-700 dark:hover:text-blue-300 disabled:text-slate-400 cursor-pointer font-sans"
                >
                  <Play className="h-3 w-3" />
                  <span>Run now</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 dark:text-[#98a4b3] italic py-2 font-sans">
          No saved searches yet. Add one to check approved public providers on a safe cadence.
        </p>
      )}
    </section>
  );
}
