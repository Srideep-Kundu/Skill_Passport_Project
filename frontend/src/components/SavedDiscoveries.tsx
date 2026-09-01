import { useCallback, useEffect, useState } from "react";
import { Plus, Play } from "lucide-react";

import { ApiError, api } from "../api";
import type { JobDiscovery } from "../api";
import { EditorialButton } from "./ui/EditorialPrimitives";

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
      className="space-y-6 rounded-md border border-[#E5E1D8] bg-[#FFFFFF] p-6 text-[#111827] font-sans"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E1D8] pb-4">
        <div>
          <h2
            className="text-xl font-normal text-[#111827]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Saved Job Searches
          </h2>
          <p className="font-mono text-xs text-[#64748B] mt-0.5">
            Recurring discovery refreshes jobs and recommendations only. It never applies for you.
          </p>
        </div>
        <EditorialButton
          variant="primary"
          disabled={busy}
          onClick={() => void create()}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          <span>Add daily search</span>
        </EditorialButton>
      </div>

      {error ? (
        <p role="alert" className="font-mono text-xs text-red-300">
          {error}
        </p>
      ) : null}

      {discoveries?.length ? (
        <ul className="space-y-3">
          {discoveries.map((item) => (
            <li
              key={item.id}
              className="rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] p-4 text-[#111827]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-[#111827]">{item.name}</p>
                    <span
                      className={`rounded-xs px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        item.enabled
                          ? "border border-[#B08D57]/30 bg-[rgba(176,141,87,0.08)] text-[#B08D57]"
                          : "border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B]"
                      }`}
                    >
                      {item.enabled ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-[#475569]">
                    {item.providers.join(", ")} · every {item.cadence_hours}h · minimum {Math.round(item.minimum_match_score * 100)}%
                  </p>
                  <p className="font-mono text-[11px] text-[#64748B]">
                    Last checked: {item.last_run_at ? new Date(item.last_run_at).toLocaleString() : "not yet"} · Next:{" "}
                    {item.next_run_at ? new Date(item.next_run_at).toLocaleString() : "disabled"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || !item.enabled}
                  onClick={() => void run(item)}
                  className="font-mono text-xs text-[#B08D57] hover:text-[#111827] flex items-center gap-1 disabled:opacity-30 cursor-pointer"
                >
                  <Play className="h-3 w-3" />
                  <span>Run now</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-mono text-xs text-[#64748B] italic py-2">
          No saved searches yet. Add one to check approved public providers on a safe cadence.
        </p>
      )}
    </section>
  );
}
