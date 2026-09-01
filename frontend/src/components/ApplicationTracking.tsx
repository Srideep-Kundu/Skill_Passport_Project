import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronRight,
  Check,
} from "lucide-react";
import { ApiError, api } from "../api";
import type { Application, ApplicationStatusEvent } from "../api";
import { containerStaggerVariants, cardItemVariants } from "../theme/motion";
import { EditorialButton } from "./ui/EditorialPrimitives";

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
      className="space-y-6 rounded-md border border-[#E5E1D8] bg-[#FFFFFF] p-6 text-[#111827] font-sans"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E1D8] pb-4">
        <div>
          <h4
            className="text-xl font-normal text-[#111827]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {application.application_snapshot?.job?.title || "Application"}
          </h4>
          <p className="font-mono text-xs text-[#64748B] mt-0.5">
            {application.application_snapshot?.job?.company_name || "Unknown Company"} · Lifecycle: {label(application.status)}
          </p>
        </div>

        <span className="font-mono text-xs uppercase px-2.5 py-0.5 border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] rounded-xs">
          {application.status}
        </span>
      </div>

      {/* STEPPER / TIMELINE */}
      <div className="overflow-x-auto pb-2">
        <ol className="flex items-center w-full min-w-[600px] text-xs font-mono">
          {STEPPER_STAGES.map((stage, idx) => {
            const isCompleted = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;
            return (
              <li key={stage.id} className="flex items-center flex-1">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-sm transition-colors ${
                    isCurrent
                      ? "border border-[#B08D57]/40 bg-[rgba(176,141,87,0.08)] text-[#B08D57]"
                      : isCompleted
                      ? "text-[#4F6F5A] font-semibold"
                      : "text-[#64748B]"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-xs text-[10px] ${
                      isCurrent
                        ? "bg-[#9CC7D8] text-[#021522] font-bold"
                        : isCompleted
                        ? "bg-emerald-950 text-[#4F6F5A] border border-[rgba(79,111,90,0.25)]"
                        : "bg-[#F7F5F0] text-[#64748B] border border-[#E5E1D8]"
                    }`}
                  >
                    {isCompleted ? <Check className="h-2.5 w-2.5" aria-hidden="true" /> : idx + 1}
                  </span>
                  <span className="whitespace-nowrap text-[11px]">{stage.name}</span>
                </div>

                {idx < STEPPER_STAGES.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-white/20 mx-1 shrink-0" />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* UNKNOWN SUBMISSION STATE WARNING BANNER */}
      {isUnknown && (
        <div className="flex items-start gap-3 rounded-sm border border-[#B08D57]/30 bg-[rgba(176,141,87,0.05)] p-4 text-xs text-[#111827]">
          <AlertTriangle className="h-4 w-4 text-[#B08D57] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-semibold block">Submission status could not be confirmed.</strong>
            <p className="text-[#475569] leading-relaxed font-sans">
              This application intent will not be resubmitted automatically to avoid duplicate postings. You can check status again, record a manual confirmation reference below, or leave it unresolved.
            </p>
          </div>
        </div>
      )}

      {/* MANUAL ACTIONS & RECONCILIATION */}
      {canRecordManual && (
        <div className="rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] p-4 space-y-3">
          <h5 className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
            Manual Submission Confirmation
          </h5>

          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Provider confirmation reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={255}
              placeholder="Optional confirmation reference (e.g. #GH-8921)"
              className="flex-1 min-w-[200px] rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-1.5 font-mono text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
            />
            <EditorialButton
              variant="primary"
              disabled={busy}
              onClick={() =>
                void run(
                  () => api.markManualSubmission(application.id, token, { provider_reference: reference.trim() || undefined }),
                  "Manual submission recorded."
                )
              }
            >
              Mark submitted manually
            </EditorialButton>
            <EditorialButton
              variant="secondary"
              disabled={busy}
              onClick={() => void run(() => api.reconcileApplication(application.id, token), "Status refreshed.")}
            >
              Check status again
            </EditorialButton>
          </div>
        </div>
      )}

      {application.status !== "withdrawn" && (
        <EditorialButton
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(
              () => api.withdrawApplication(application.id, token),
              "Application intent withdrawn."
            )
          }
        >
          Mark Withdrawn Locally
        </EditorialButton>
      )}

      {/* TIMELINE AUDIT EVENTS LIST */}
      <div className="space-y-3 pt-2">
        <h5 className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
          Audit Timeline Events
        </h5>

        {!events ? (
          <div className="p-4 text-center font-mono text-xs text-[#64748B]">Loading timeline events...</div>
        ) : events.length === 0 ? (
          <p className="font-mono text-xs text-[#64748B] italic py-2">No lifecycle events recorded yet.</p>
        ) : (
          <motion.ol
            variants={prefersReducedMotion ? undefined : containerStaggerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {events.map((event) => (
              <motion.li
                key={event.id}
                variants={prefersReducedMotion ? undefined : cardItemVariants}
                className="flex items-center justify-between border border-[#E5E1D8] bg-[#F7F5F0] p-3 rounded-sm font-mono text-xs"
              >
                <div>
                  <span className="text-[#111827]">{label(event.event_type)}</span>
                  <span className="text-[#64748B] ml-2 font-sans">({event.source})</span>
                  {event.status && (
                    <span className="ml-2 border border-[#E5E1D8] px-1.5 py-0.5 text-[10px] text-[#475569]">
                      {label(event.status)}
                    </span>
                  )}
                </div>
                <time className="text-[11px] text-[#64748B]">
                  {new Date(event.created_at).toLocaleString()}
                </time>
              </motion.li>
            ))}
          </motion.ol>
        )}
      </div>

      {error && (
        <div role="alert" className="p-3 text-xs text-red-300 font-mono border border-[rgba(180,83,75,0.25)] bg-red-950/20 rounded-sm">
          {error}
        </div>
      )}
    </section>
  );
}
