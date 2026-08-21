import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  FileCheck,
  ChevronRight,
  Check,
} from "lucide-react";
import { ApiError, api } from "../api";
import type { Application, ApplicationStatusEvent } from "../api";
import { containerStaggerVariants, cardItemVariants } from "../theme/motion";

function label(value: string) {
  return value.replaceAll("_", " ");
}

const STEPPER_STAGES = [
  { id: "recommendation", name: "Recommendation" },
  { id: "review", name: "Review" },
  { id: "approval", name: "Approval" },
  { id: "preparation", name: "Preparation" },
  { id: "needs_input", name: "Required Input" },
  { id: "submission", name: "Submission" },
  { id: "tracking", name: "Tracking" },
];

function getStageIndex(status: Application["status"]): number {
  switch (status) {
    case "approval_pending":
      return 1;
    case "approved":
    case "preparing":
      return 2;
    case "needs_input":
      return 4;
    case "prepared":
    case "ready_to_submit":
      return 5;
    case "submitting":
    case "submitted":
    case "manual_apply":
      return 5;
    case "unknown_submission_state":
    case "failed":
      return 5;
    case "withdrawn":
      return 6;
    default:
      return 0;
  }
}

export function ApplicationTracking({
  application,
  token,
  onChanged,
}: {
  application: Application;
  token: string;
  onChanged: (application: Application) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [events, setEvents] = useState<ApplicationStatusEvent[] | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      api
        .applicationTimeline(application.id, token)
        .then(setEvents)
        .catch((caught) =>
          setError(caught instanceof ApiError ? caught.detail : "The application timeline could not be loaded.")
        ),
    [application.id, token]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<Application>, successMessage: string) {
    try {
      setBusy(true);
      setError(null);
      const updated = await action();
      onChanged(updated);
      await refresh();
      toast.success(successMessage);
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "The application tracking action could not be completed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const currentStageIdx = getStageIndex(application.status);
  const canRecordManual = application.status === "manual_apply" || application.status === "unknown_submission_state";
  const isUnknown = application.status === "unknown_submission_state";

  return (
    <section
      aria-label="Application tracking timeline"
      className="space-y-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm text-slate-900 dark:text-[#f1f0e8]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <div>
          <h4 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
            <FileCheck className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>{(application as any).job?.title || "Application"}</span>
          </h4>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
            {(application as any).job?.company_name || "Unknown Company"} &middot; Lifecycle: {label(application.status)}
          </p>
        </div>

        <span className="rounded-full bg-blue-50 dark:bg-[#151e29] border border-blue-200/60 dark:border-white/10 px-3 py-1 text-xs font-bold text-[#3b71d9] dark:text-[#b0c6ff] uppercase tracking-wider shrink-0 font-sans">
          {application.status}
        </span>
      </div>

      {/* STEPPER / TIMELINE COMPONENT */}
      <div className="overflow-x-auto pb-2">
        <ol className="flex items-center w-full min-w-[600px] text-xs font-semibold">
          {STEPPER_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;
            return (
              <li key={stage.id} className="flex items-center flex-1">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors font-sans ${
                    isCurrent
                      ? "bg-[#3b71d9] text-white shadow-xs"
                      : isCompleted
                      ? "text-emerald-700 dark:text-emerald-400 font-bold"
                      : "text-slate-400 dark:text-[#98a4b3]"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      isCurrent
                        ? "bg-white text-[#3b71d9] font-black"
                        : isCompleted
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-100 dark:bg-[#151e29] text-slate-400"
                    }`}
                  >
                    {isCompleted ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : idx + 1}
                  </span>
                  <span className="whitespace-nowrap text-[11px]">{stage.name}</span>
                </div>

                {idx < STEPPER_STAGES.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-700 mx-1 shrink-0" />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* UNKNOWN SUBMISSION STATE WARNING BANNER */}
      {isUnknown && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs font-medium text-amber-900 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold text-sm block font-sans">Submission status could not be confirmed.</strong>
            <p className="leading-relaxed font-sans">
              This application intent will not be resubmitted automatically to avoid duplicate postings. You can check status again, record a manual confirmation reference below, or leave it unresolved.
            </p>
          </div>
        </div>
      )}

      {/* MANUAL ACTIONS & RECONCILIATION */}
      {canRecordManual && (
        <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-4 space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#98a4b3] font-sans">
            Manual Submission Confirmation
          </h5>

          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Provider confirmation reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={255}
              placeholder="Optional confirmation reference (e.g. #GH-8921)"
              className="flex-1 min-w-[200px] rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#111821] px-3 py-1.5 text-xs focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    api.markManualSubmission(application.id, token, {
                      submitted_at: new Date().toISOString(),
                      provider_reference: reference || undefined,
                    }),
                  "Application marked as manually submitted"
                )
              }
              className="rounded-lg bg-[#3b71d9] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2563eb] disabled:opacity-50 transition-colors cursor-pointer font-sans shadow-sm shadow-[#3b71d9]/25"
            >
              Mark submitted manually
            </button>

            {isUnknown && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => api.reconcileApplication(application.id, token),
                    "Reconciled status with provider"
                  )
                }
                className="rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#111821] px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-slate-50 dark:hover:bg-[#1a2430] disabled:opacity-50 transition-colors cursor-pointer font-sans"
              >
                Check status again
              </button>
            )}
          </div>
        </div>
      )}

      {application.status !== "withdrawn" && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void run(
              () => api.withdrawApplication(application.id, token),
              "Application intent withdrawn"
            )
          }
          className="rounded-lg border border-slate-300 dark:border-white/10 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-slate-100 dark:hover:bg-[#151e29] transition-colors cursor-pointer font-sans"
        >
          Mark Withdrawn Locally
        </button>
      )}

      {error && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400 font-sans">
          {error}
        </p>
      )}

      {/* EVENT HISTORY TIMELINE WITH STAGGERED ENTRANCE */}
      <div className="pt-2 font-sans">
        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-[#98a4b3] mb-3">
          Event History & Provenance Logs
        </h5>

        {events ? (
          <motion.ol
            variants={prefersReducedMotion ? undefined : containerStaggerVariants}
            initial="hidden"
            animate="visible"
            className="relative border-l border-slate-200 dark:border-white/[0.08] ml-2 space-y-4 pl-4"
          >
            {events.map((event) => (
              <motion.li
                key={event.id}
                variants={prefersReducedMotion ? undefined : cardItemVariants}
                className="relative space-y-0.5"
              >
                <span className="absolute -left-[21px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-100 dark:bg-[#182337] border border-blue-300 dark:border-blue-700 text-[#3b71d9] dark:text-[#b0c6ff] font-bold text-[9px]">
                  •
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900 dark:text-[#f1f0e8]">{label(event.event_type)}</span>
                  {event.status && (
                    <span className="rounded bg-slate-100 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-[#dedbc8]">
                      {label(event.status)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-[#98a4b3]">
                  Source: <span className="font-medium text-slate-700 dark:text-[#dedbc8]">{label(event.source)}</span> &middot;{" "}
                  {new Date(event.created_at).toLocaleString()}
                </p>
              </motion.li>
            ))}
          </motion.ol>
        ) : (
          <p className="text-xs text-slate-400 italic font-sans">Loading event history timeline...</p>
        )}
      </div>
    </section>
  );
}
