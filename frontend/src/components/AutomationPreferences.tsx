import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Sliders, Plus } from "lucide-react";

import { ApiError, api } from "../api";
import type { AutomationPolicy, AutomationQueueItem } from "../api";
import { EmptyState, ErrorState, LoadingState } from "./AsyncState";

const safeDefaultPolicy = {
  name: "My review queue",
  enabled: false,
  priority: 100,
  minimum_match_score: 0.2,
  allowed_providers: [] as ("greenhouse" | "lever" | "ashby")[],
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
  return (
    <li className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-3.5 space-y-1 text-slate-900 dark:text-[#f1f0e8]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <strong className="font-bold text-xs sm:text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{item.title}</strong>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
            {item.company_name} · {item.provider} · selected by {item.policy_name}
          </p>
        </div>
        <strong className="text-sm font-black text-[#3b71d9] dark:text-[#b0c6ff] font-sans">
          {Math.round(item.final_score * 100)}%
        </strong>
      </div>
      <p className="mt-1 text-xs text-slate-600 dark:text-[#98a4b3] font-sans">
        Why it matched: {item.policy_reason.join(", ").replaceAll("_", " ")}
      </p>
      <p className="text-xs text-slate-600 dark:text-[#98a4b3] font-sans">
        Missing skills: {missing.length ? missing.join(", ") : "None recorded"}
      </p>
      <p className="text-xs text-slate-600 dark:text-[#98a4b3] font-sans">
        Active resume: {item.active_resume_filename ?? "No active resume selected"}
      </p>
      <p className="pt-1 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] font-sans">
        {item.application_status ? `Application: ${item.application_status.replaceAll("_", " ")}` : "Recommendation surfaced for review"}
      </p>
    </li>
  );
}

const csv = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function PolicyEditor({
  policy,
  token,
  onSaved,
}: {
  policy: AutomationPolicy;
  token: string;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(policy);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AutomationPolicy>(key: K, value: AutomationPolicy[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      setError(null);
      await api.updateAutomationPolicy(
        policy.id,
        {
          minimum_match_score: draft.minimum_match_score,
          allowed_providers: draft.allowed_providers,
          allowed_locations: draft.allowed_locations,
          remote_preference: draft.remote_preference,
          employment_types: draft.employment_types,
          experience_levels: draft.experience_levels,
          required_skills_any: draft.required_skills_any,
          required_skills_all: draft.required_skills_all,
          excluded_skills: draft.excluded_skills,
          excluded_companies: draft.excluded_companies,
          excluded_keywords: draft.excluded_keywords,
          maximum_jobs_per_run: draft.maximum_jobs_per_run,
          maximum_review_intents_per_run: draft.maximum_review_intents_per_run,
          maximum_review_intents_per_day: draft.maximum_review_intents_per_day,
          maximum_pending_review_queue_size: draft.maximum_pending_review_queue_size,
          auto_create_review_intent: draft.auto_create_review_intent,
        },
        token
      );
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "The automation policy could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#111821] px-2.5 py-1.5 text-xs text-slate-900 dark:text-[#f1f0e8] focus:border-[#3b71d9] focus:outline-none";

  return (
    <details className="mt-3 border-t border-slate-200/60 dark:border-white/[0.08] pt-3">
      <summary className="cursor-pointer text-xs font-bold text-[#3b71d9] dark:text-[#b0c6ff] hover:underline font-sans">
        Configure filters and limits
      </summary>
      <form onSubmit={(event) => void save(event)} className="mt-3 grid gap-3 text-xs md:grid-cols-2 text-slate-700 dark:text-[#98a4b3] font-sans">
        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Minimum match</span>
          <input
            aria-label={`${policy.name} minimum match`}
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={draft.minimum_match_score}
            onChange={(event) => set("minimum_match_score", Number(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Providers (greenhouse, lever)</span>
          <input
            value={draft.allowed_providers.join(", ")}
            onChange={(event) =>
              set(
                "allowed_providers",
                csv(event.target.value).filter(
                  (item): item is "greenhouse" | "lever" => item === "greenhouse" || item === "lever"
                )
              )
            }
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Locations</span>
          <input
            value={draft.allowed_locations.join(", ")}
            onChange={(event) => set("allowed_locations", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Remote preference</span>
          <select
            value={draft.remote_preference === null ? "any" : String(draft.remote_preference)}
            onChange={(event) => set("remote_preference", event.target.value === "any" ? null : event.target.value === "true")}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="any">Any</option>
            <option value="true">Remote only</option>
            <option value="false">Not remote</option>
          </select>
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Employment types</span>
          <input
            value={draft.employment_types.join(", ")}
            onChange={(event) => set("employment_types", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Experience levels</span>
          <input
            value={draft.experience_levels.join(", ")}
            onChange={(event) => set("experience_levels", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Require any skill IDs</span>
          <input
            value={draft.required_skills_any.join(", ")}
            onChange={(event) => set("required_skills_any", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Require all skill IDs</span>
          <input
            value={draft.required_skills_all.join(", ")}
            onChange={(event) => set("required_skills_all", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Exclude skill IDs</span>
          <input
            value={draft.excluded_skills.join(", ")}
            onChange={(event) => set("excluded_skills", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Excluded companies</span>
          <input
            value={draft.excluded_companies.join(", ")}
            onChange={(event) => set("excluded_companies", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Excluded keywords</span>
          <input
            value={draft.excluded_keywords.join(", ")}
            onChange={(event) => set("excluded_keywords", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Jobs per run</span>
          <input
            type="number"
            min="1"
            max="100"
            value={draft.maximum_jobs_per_run}
            onChange={(event) => set("maximum_jobs_per_run", Number(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Review intents per run</span>
          <input
            type="number"
            min="0"
            max="10"
            value={draft.maximum_review_intents_per_run}
            onChange={(event) => set("maximum_review_intents_per_run", Number(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Review intents per day</span>
          <input
            type="number"
            min="0"
            max="10"
            value={draft.maximum_review_intents_per_day}
            onChange={(event) => set("maximum_review_intents_per_day", Number(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="font-semibold text-slate-700 dark:text-[#f1f0e8]">Pending review limit</span>
          <input
            type="number"
            min="0"
            max="100"
            value={draft.maximum_pending_review_queue_size}
            onChange={(event) => set("maximum_pending_review_queue_size", Number(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="flex items-center gap-2 md:col-span-2 pt-1 font-medium text-slate-700 dark:text-[#f1f0e8]">
          <input
            type="checkbox"
            checked={draft.auto_create_review_intent}
            onChange={(event) => set("auto_create_review_intent", event.target.checked)}
            className="rounded border-slate-300 text-[#3b71d9] focus:ring-[#3b71d9]"
          />
          <span>Automatically add eligible jobs to review queue</span>
        </label>

        {error ? (
          <p role="alert" className="text-red-600 dark:text-red-400 font-semibold md:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="md:col-span-2 pt-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[#3b71d9] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] disabled:opacity-50 transition-colors cursor-pointer font-sans"
          >
            {busy ? "Saving…" : "Save policy"}
          </button>
        </div>
      </form>
    </details>
  );
}

export function AutomationPreferences({ token }: { token: string }) {
  const [policies, setPolicies] = useState<AutomationPolicy[] | null>(null);
  const [queue, setQueue] = useState<AutomationQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [policyPage, reviewQueue] = await Promise.all([
        api.automationPolicies(token),
        api.automationReviewQueue(token),
      ]);
      setPolicies(policyPage.items);
      setQueue(reviewQueue.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Automation preferences could not be loaded.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPolicy() {
    try {
      setBusy(true);
      setError(null);
      await api.createAutomationPolicy(safeDefaultPolicy, token);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "The automation policy could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function setEnabled(policy: AutomationPolicy, enabled: boolean) {
    try {
      setBusy(true);
      setError(null);
      await api.updateAutomationPolicy(policy.id, { enabled }, token);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "The automation policy could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  if ((!policies || !queue) && !error) return <LoadingState label="Loading automation preferences" />;

  return (
    <section
      aria-label="Automation preferences"
      className="space-y-4 rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-5 sm:p-6 shadow-lg text-slate-900 dark:text-[#f1f0e8]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
            <Sliders className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>Job review automation</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
            Automatically add matching jobs to my review queue. This does not approve or submit applications.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void addPolicy()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#3b71d9] dark:border-blue-500 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-white/[0.08] disabled:opacity-50 transition-colors cursor-pointer font-sans"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add review policy</span>
        </button>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="space-y-2.5">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-[#98a4b3] font-sans">Policies</h3>
        {policies?.length ? (
          <ul className="space-y-2.5">
            {policies.map((policy) => (
              <li
                key={policy.id}
                className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.03] backdrop-blur-md p-4 text-slate-900 dark:text-[#f1f0e8]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong className="font-bold text-xs sm:text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{policy.name}</strong>
                    <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
                      Minimum match {Math.round(policy.minimum_match_score * 100)}% · up to {policy.maximum_review_intents_per_day} review intents/day
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setEnabled(policy, !policy.enabled)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer font-sans backdrop-blur-xs ${
                      policy.enabled
                        ? "border border-amber-600/70 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        : "border border-emerald-600/70 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    }`}
                  >
                    {policy.enabled ? "Disable" : "Enable"}
                  </button>
                </div>
                <PolicyEditor policy={policy} token={token} onSaved={load} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No automation policies">
            Policies start disabled. Add one, review its limits, then enable it when ready.
          </EmptyState>
        )}
      </div>

      <div className="border-t border-slate-100 dark:border-white/[0.08] pt-4 space-y-2.5">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 dark:text-[#98a4b3] font-sans">Ready for review</h3>
        {queue?.length ? (
          <ul className="space-y-2.5">
            {queue.map((item) => (
              <QueueItem key={`${item.policy_id}-${item.match_id}`} item={item} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] italic py-1 font-sans">No policy-selected recommendations yet.</p>
        )}
      </div>
    </section>
  );
}
