import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { ApiError, api } from "../api";
import type { AutomationPolicy, AutomationQueueItem } from "../api";
import { EmptyState, ErrorState, LoadingState } from "./AsyncState";
import { EditorialButton } from "./ui/EditorialPrimitives";

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
    <li className="rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] p-4 space-y-2 text-[#111827] font-sans">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <strong className="font-semibold text-sm text-[#111827]">{item.title}</strong>
          <p className="font-mono text-xs text-[#64748B] mt-0.5">
            {item.company_name} · {item.provider} · selected by {item.policy_name}
          </p>
        </div>
        <strong
          className="text-lg font-normal text-[#B08D57]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {Math.round(item.final_score * 100)}%
        </strong>
      </div>
      <p className="font-mono text-xs text-[#475569]">
        Why it matched: {item.policy_reason.join(", ").replaceAll("_", " ")}
      </p>
      <p className="font-mono text-xs text-[#64748B]">
        Missing skills: {missing.length ? missing.join(", ") : "None recorded"}
      </p>
      <p className="font-mono text-xs text-[#64748B]">
        Active resume: {item.active_resume_filename ?? "No active resume selected"}
      </p>
      <p className="pt-1 font-mono text-xs text-[#B08D57]">
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
      setError(caught instanceof ApiError ? caught.detail : "The automation policy could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-1.5 font-mono text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none";

  return (
    <details className="mt-3 border-t border-[#E5E1D8] pt-3 text-xs font-mono">
      <summary className="cursor-pointer font-mono text-[#B08D57] hover:text-[#111827]">
        Edit policy filters and review limits
      </summary>
      <form onSubmit={save} className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1 block">
          <span className="text-[#64748B]">Minimum match score (0.0 to 1.0)</span>
          <input
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
          <span className="text-[#64748B]">Allowed locations (comma-separated)</span>
          <input
            value={draft.allowed_locations.join(", ")}
            onChange={(event) => set("allowed_locations", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[#64748B]">Require any skill IDs</span>
          <input
            value={draft.required_skills_any.join(", ")}
            onChange={(event) => set("required_skills_any", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[#64748B]">Require all skill IDs</span>
          <input
            value={draft.required_skills_all.join(", ")}
            onChange={(event) => set("required_skills_all", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[#64748B]">Exclude skill IDs</span>
          <input
            value={draft.excluded_skills.join(", ")}
            onChange={(event) => set("excluded_skills", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[#64748B]">Excluded companies</span>
          <input
            value={draft.excluded_companies.join(", ")}
            onChange={(event) => set("excluded_companies", csv(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[#64748B]">Jobs per run</span>
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
          <span className="text-[#64748B]">Review intents per day</span>
          <input
            type="number"
            min="0"
            max="10"
            value={draft.maximum_review_intents_per_day}
            onChange={(event) => set("maximum_review_intents_per_day", Number(event.target.value))}
            className={inputClass}
          />
        </label>

        <label className="flex items-center gap-2 md:col-span-2 pt-1 text-[#111827]">
          <input
            type="checkbox"
            checked={draft.auto_create_review_intent}
            onChange={(event) => set("auto_create_review_intent", event.target.checked)}
            className="rounded-xs border-[#E5E1D8] text-[#B08D57]"
          />
          <span>Automatically add eligible jobs to review queue</span>
        </label>

        {error ? (
          <p role="alert" className="text-red-300 md:col-span-2">
            {error}
          </p>
        ) : null}

        <div className="md:col-span-2 pt-2">
          <EditorialButton
            variant="primary"
            type="submit"
            disabled={busy}
          >
            {busy ? "Saving…" : "Save policy"}
          </EditorialButton>
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
      className="space-y-6 rounded-md border border-[#E5E1D8] bg-[#FFFFFF] p-6 text-[#111827] font-sans"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E1D8] pb-4">
        <div>
          <h2
            className="text-xl font-normal text-[#111827]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Job Review Automation
          </h2>
          <p className="font-mono text-xs text-[#64748B] mt-0.5">
            Automatically add matching jobs to my review queue. This does not approve or submit applications.
          </p>
        </div>
        <EditorialButton
          variant="primary"
          disabled={busy}
          onClick={() => void addPolicy()}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          <span>Add review policy</span>
        </EditorialButton>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      <div className="space-y-3">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">Active Policies</h3>
        {policies?.length ? (
          <ul className="space-y-3">
            {policies.map((policy) => (
              <li
                key={policy.id}
                className="rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] p-4 text-[#111827]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong className="font-semibold text-sm text-[#111827]">{policy.name}</strong>
                    <p className="font-mono text-xs text-[#64748B] mt-0.5">
                      Minimum match {Math.round(policy.minimum_match_score * 100)}% · up to {policy.maximum_review_intents_per_day} review intents/day
                    </p>
                  </div>
                  <EditorialButton
                    variant={policy.enabled ? "secondary" : "primary"}
                    disabled={busy}
                    onClick={() => void setEnabled(policy, !policy.enabled)}
                  >
                    {policy.enabled ? "Disable" : "Enable"}
                  </EditorialButton>
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

      <div className="border-t border-[#E5E1D8] pt-4 space-y-3">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">Ready for Review</h3>
        {queue?.length ? (
          <ul className="space-y-3">
            {queue.map((item) => (
              <QueueItem key={`${item.policy_id}-${item.match_id}`} item={item} />
            ))}
          </ul>
        ) : (
          <p className="font-mono text-xs text-[#64748B] italic py-1">No policy-selected recommendations yet.</p>
        )}
      </div>
    </section>
  );
}
