import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";

import { ApiError, api } from "../api";
import type { Application, ExternalJob, ExternalJobMatch, MatchExplanation } from "../api";
import { ApplicationPreparation } from "./ApplicationPreparation";
import { AutomationPreferences } from "./AutomationPreferences";
import { SavedDiscoveries } from "./SavedDiscoveries";
import { EmptyState, ErrorState, LoadingState } from "./AsyncState";

function syncedLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "Sync time unavailable" : `Synced ${parsed.toLocaleString()}`;
}

function locationLabel(job: Pick<ExternalJob, "location" | "remote_status">): string {
  return `${job.location ? ` · ${job.location}` : ""}${job.remote_status === "remote" && !job.location?.toLowerCase().includes("remote") ? " · Remote" : ""}`;
}

function Explanation({ explanation }: { explanation: MatchExplanation }) {
  return (
    <details className="mt-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#151e29] p-3.5 text-xs text-slate-900 dark:text-[#f1f0e8]">
      <summary className="cursor-pointer font-bold text-[#3b71d9] dark:text-[#b0c6ff] hover:underline font-sans">
        Why this match?
      </summary>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-slate-50 dark:bg-[#111821] border border-slate-200/60 dark:border-white/[0.08] p-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#98a4b3] block font-sans">Exact</span>
          <strong className="text-sm font-black text-[#3b71d9] dark:text-[#b0c6ff] font-sans">
            {Math.round(explanation.deterministic_score * 100)}%
          </strong>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-[#111821] border border-slate-200/60 dark:border-white/[0.08] p-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#98a4b3] block font-sans">Semantic</span>
          <strong className="text-sm font-black text-purple-600 dark:text-purple-400 font-sans">
            {Math.round(explanation.semantic_score * 100)}%
          </strong>
        </div>
        <div className="rounded-lg bg-slate-50 dark:bg-[#111821] border border-slate-200/60 dark:border-white/[0.08] p-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#98a4b3] block font-sans">Verified</span>
          <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-sans">
            {Math.round(explanation.verification_bonus * 100)}%
          </strong>
        </div>
      </div>
      <ul className="mt-3 space-y-2 text-xs">
        {explanation.items.map((item) => (
          <li key={item.skill_id} className="flex items-start gap-1.5 text-slate-700 dark:text-[#98a4b3] font-sans">
            <span className="shrink-0 mt-0.5">
              {item.status === "missing" ? (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              )}
            </span>
            <span>
              <strong className="text-slate-900 dark:text-[#f1f0e8]">{item.skill_name}</strong>
              {item.status === "missing" ? ` — missing ${item.is_required === false ? "preferred" : "required"} skill` : ""}
              {item.evidence_title ? ` · ${item.evidence_title}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function ApprovalScreen({
  application,
  token,
  onChanged,
  onClose,
}: {
  application: Application;
  token: string;
  onChanged: (application: Application) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapshot = application.application_snapshot;

  async function run(action: () => Promise<Application>) {
    try {
      setBusy(true);
      setError(null);
      onChanged(await action());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "The application action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  const preSubmission = ["approval_pending", "approved", "needs_input", "prepared", "ready_to_submit"];

  return (
    <section
      aria-label="Application approval"
      className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-5 sm:p-6 shadow-sm space-y-4 text-slate-900 dark:text-[#f1f0e8]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/60 dark:border-white/[0.08] pb-3.5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#3b71d9] dark:text-[#b0c6ff] font-sans">Application Review</p>
          <h3 className="text-lg font-bold text-slate-900 dark:text-[#f1f0e8] mt-0.5 font-sans">{snapshot.job.title}</h3>
          <p className="text-xs text-slate-600 dark:text-[#98a4b3] font-sans">
            {snapshot.job.company_name} · {snapshot.job.provider}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 dark:bg-[#111821] border border-blue-200/60 dark:border-white/10 px-3 py-1 text-xs font-bold text-[#3b71d9] dark:text-[#b0c6ff] font-sans">
          {application.status.replaceAll("_", " ")}
        </span>
      </div>

      <p className="text-xs text-slate-700 dark:text-[#98a4b3] font-sans">
        Match score: <strong className="text-[#3b71d9] dark:text-[#b0c6ff]">{Math.round(snapshot.recommendation.final_score * 100)}%</strong>. This approval applies only to this job, recommendation, resume, and profile snapshot.
      </p>

      <a
        href={snapshot.job.source_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] underline hover:text-blue-700 font-sans"
      >
        <span>View job source</span>
        <ExternalLink className="h-3 w-3" />
      </a>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821] p-3.5 space-y-1.5">
          <h4 className="font-bold text-xs text-slate-900 dark:text-[#f1f0e8] font-sans">Evidence supporting this match</h4>
          {snapshot.recommendation.supporting_evidence.length ? (
            <ul className="list-disc pl-4 text-xs space-y-1 text-slate-700 dark:text-[#98a4b3] font-sans">
              {snapshot.recommendation.supporting_evidence.map((item) => (
                <li key={`${item.skill_name}-${item.evidence_id}`}>
                  {item.skill_name}
                  {item.evidence_title ? ` — ${item.evidence_title}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 dark:text-[#98a4b3] italic font-sans">No evidence references were persisted.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821] p-3.5 space-y-1.5">
          <h4 className="font-bold text-xs text-slate-900 dark:text-[#f1f0e8] font-sans">Missing skills</h4>
          {snapshot.recommendation.missing_skills.length ? (
            <ul className="list-disc pl-4 text-xs space-y-1 text-slate-700 dark:text-[#98a4b3] font-sans">
              {snapshot.recommendation.missing_skills.map((item) => (
                <li key={item.skill_name}>
                  {item.skill_name} ({item.is_required ? "required" : "preferred"})
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 dark:text-[#98a4b3] italic font-sans">No missing skills recorded.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821] p-3.5 text-xs text-slate-700 dark:text-[#98a4b3] space-y-1 font-sans">
        <h4 className="font-bold text-slate-900 dark:text-[#f1f0e8]">Application-safe profile</h4>
        <p>Resume: {snapshot.resume.original_filename}</p>
        <p>
          {snapshot.application_profile.full_name} · {snapshot.application_profile.email}
          {snapshot.application_profile.phone ? ` · ${snapshot.application_profile.phone}` : ""}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] pt-0.5">
          Sensitive demographic and legal questions always require your direct input and are never inferred.
        </p>
      </div>

      {application.is_approval_stale ? (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 p-3 text-xs text-amber-900 dark:text-amber-300 font-sans">
          Your approved inputs changed. Review and approve the updated application again.
        </p>
      ) : null}

      <ApplicationPreparation application={application} token={token} onChanged={onChanged} />

      {error ? (
        <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400 font-sans">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2 font-sans">
        {application.status === "approval_pending" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api.requestApplicationApproval(application.id, token);
                return api.approveApplication(application.id, token);
              })
            }
            className="rounded-lg bg-[#3b71d9] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] transition-colors disabled:opacity-50 cursor-pointer font-sans"
          >
            Approve application
          </button>
        ) : null}

        {application.status === "approved" && application.is_approval_stale ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => api.requestApplicationApproval(application.id, token))}
            className="rounded-lg bg-[#3b71d9] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] transition-colors disabled:opacity-50 cursor-pointer font-sans"
          >
            Refresh approval review
          </button>
        ) : null}

        {application.status === "approved" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => api.revokeApplicationApproval(application.id, token))}
            className="rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-white dark:bg-[#111821] px-3.5 py-1.5 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-[#1a2430] transition-colors cursor-pointer font-sans"
          >
            Revoke approval
          </button>
        ) : null}

        {preSubmission.includes(application.status) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => api.selectManualApplication(application.id, token))}
            className="rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-white dark:bg-[#111821] px-3.5 py-1.5 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-[#1a2430] transition-colors cursor-pointer font-sans"
          >
            Apply manually
          </button>
        ) : null}

        {application.status === "manual_apply" && application.manual_apply_url ? (
          <a
            href={application.manual_apply_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-white dark:bg-[#111821] px-3.5 py-1.5 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-[#1a2430] transition-colors font-sans"
          >
            Open manual application page
          </a>
        ) : null}

        {preSubmission.includes(application.status) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => api.withdrawApplication(application.id, token))}
            className="rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#111821] px-3.5 py-1.5 text-xs font-medium text-slate-700 dark:text-[#98a4b3] hover:bg-slate-50 dark:hover:bg-[#1a2430] transition-colors cursor-pointer font-sans"
          >
            Cancel application
          </button>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-[#98a4b3] hover:text-slate-900 dark:hover:text-[#f1f0e8] transition-colors cursor-pointer font-sans"
        >
          Close
        </button>
      </div>

      <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] pt-1 font-sans">
        No external application is submitted by this product for assisted providers. No browser automation is used; submission appears only for a provider that explicitly declares that capability.
      </p>
    </section>
  );
}

function RecommendedJob({
  job,
  application,
  onApply,
}: {
  job: ExternalJobMatch;
  application: Application | undefined;
  onApply: () => void;
}) {
  return (
    <li className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-4.5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 text-slate-900 dark:text-[#f1f0e8]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{job.title}</h3>
          <p className="text-xs text-slate-600 dark:text-[#98a4b3] mt-0.5 font-sans">
            {job.company_name}
            {locationLabel(job)}
          </p>
        </div>
        <strong className="text-xl font-black text-[#3b71d9] dark:text-[#b0c6ff] font-sans">
          {Math.round(job.final_score * 100)}%
        </strong>
      </div>
      <p className="mt-2 text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
        Source: {job.provider}
        {job.posted_at ? ` · Posted ${new Date(job.posted_at).toLocaleDateString()}` : ""}
        {job.is_stale ? " · Match needs refresh" : ""}
      </p>
      <Explanation explanation={job.explanation} />
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold font-sans">
        <a
          href={job.source_url}
          target="_blank"
          rel="noreferrer"
          className="text-[#3b71d9] dark:text-[#b0c6ff] underline hover:text-blue-700"
        >
          Open original listing
        </a>
        <button
          type="button"
          disabled={job.is_stale}
          onClick={onApply}
          className="text-[#3b71d9] dark:text-[#b0c6ff] underline hover:text-blue-700 disabled:text-slate-400 cursor-pointer font-sans"
        >
          {application ? "Review application" : "Apply"}
        </button>
      </div>
    </li>
  );
}

function ExternalJobsContent({ token }: { token: string }) {
  const [jobs, setJobs] = useState<ExternalJob[] | null>(null);
  const [recommended, setRecommended] = useState<ExternalJobMatch[] | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const applicationsByJob = useMemo(
    () => new Map(applications.map((application) => [application.external_job_id, application])),
    [applications]
  );

  const load = useCallback(async () => {
    try {
      setError(null);
      const [jobPage, matchPage, applicationPage] = await Promise.all([
        api.externalJobs(token),
        api.externalJobMatches(token),
        api.applications(token),
      ]);
      setJobs(jobPage.items);
      setRecommended(matchPage.items);
      setApplications(applicationPage.items);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "External jobs could not be loaded.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateApplication(next: Application) {
    setSelectedApplication(next);
    setApplications((current) => current.map((item) => (item.id === next.id ? next : item)));
  }

  async function beginApplication(job: ExternalJobMatch) {
    const existing = applicationsByJob.get(job.external_job_id);
    if (existing) {
      setSelectedApplication(existing);
      return;
    }
    try {
      setError(null);
      const created = await api.createApplication(job.external_job_id, job.id, token);
      setApplications((current) => [created, ...current]);
      setSelectedApplication(created);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "The application could not be created.");
    }
  }

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

  return (
    <section
      aria-label="External jobs"
      className="space-y-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm text-slate-900 dark:text-[#f1f0e8]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
            <Briefcase className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>Recommended jobs</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
            Persisted evidence-backed matches. Location and remote preferences filter jobs but never alter skill-fit scores.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshRecommendations()}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-white dark:bg-[#151e29] px-3 py-1.5 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-[#1a2430] disabled:opacity-50 transition-colors cursor-pointer font-sans"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Refreshing…" : "Refresh recommendations"}</span>
        </button>
      </div>

      {selectedApplication ? (
        <ApprovalScreen
          application={selectedApplication}
          token={token}
          onChanged={updateApplication}
          onClose={() => setSelectedApplication(null)}
        />
      ) : null}

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : recommended?.length ? (
        <ul className="space-y-3">
          {recommended.map((job) => (
            <RecommendedJob
              key={job.id}
              job={job}
              application={applicationsByJob.get(job.external_job_id)}
              onApply={() => void beginApplication(job)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState title="No recommended jobs yet">
          Refresh recommendations after jobs with canonical required skills have been synced. Jobs below the configured recommendation threshold remain searchable.
        </EmptyState>
      )}

      <div className="border-t border-slate-100 dark:border-white/[0.08] pt-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">All synced external jobs</h3>
        {jobs?.length ? (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-4 text-slate-900 dark:text-[#f1f0e8]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{job.title}</h4>
                    <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
                      {job.company_name}
                      {locationLabel(job)}
                    </p>
                  </div>
                  <span className="rounded-md bg-slate-100 dark:bg-[#111821] border border-slate-200/60 dark:border-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-[#dedbc8] font-sans">
                    Source: {job.provider}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
                  {syncedLabel(job.last_synced_at)}
                  {job.requirements.some((item) => item.is_required)
                    ? ""
                    : " · Requirements not yet sufficient for matching"}
                </p>
                <a
                  href={job.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] underline hover:text-blue-700 font-sans"
                >
                  <span>Open original listing</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No synced external jobs">
            An administrator can sync a configured public job source. Check back after the next sync.
          </EmptyState>
        )}
      </div>
    </section>
  );
}

export function ExternalJobs({ token }: { token: string }) {
  return (
    <div className="space-y-6">
      <AutomationPreferences token={token} />
      <SavedDiscoveries token={token} />
      <ExternalJobsContent token={token} />
    </div>
  );
}
