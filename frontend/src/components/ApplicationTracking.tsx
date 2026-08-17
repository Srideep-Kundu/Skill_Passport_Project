import { useCallback, useEffect, useState } from "react";

import { ApiError, api } from "../api";
import type { Application, ApplicationStatusEvent } from "../api";

function label(value: string) { return value.replaceAll("_", " "); }
function category(status: Application["status"]): string {
  if (status === "unknown_submission_state") return "Status Unknown";
  if (status === "manual_apply") return "Manual";
  if (status === "submitted") return "Submitted";
  if (status === "withdrawn") return "Withdrawn";
  if (status === "failed") return "Failed";
  if (status === "ready_to_submit") return "Ready";
  return "Needs Action";
}

export function ApplicationTracking({ application, token, onChanged }: { application: Application; token: string; onChanged: (application: Application) => void }) {
  const [events, setEvents] = useState<ApplicationStatusEvent[] | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => api.applicationTimeline(application.id, token).then(setEvents).catch((caught) => setError(caught instanceof ApiError ? caught.detail : "The application timeline could not be loaded.")), [application.id, token]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function run(action: () => Promise<Application>) { try { setBusy(true); setError(null); onChanged(await action()); await refresh(); } catch (caught) { setError(caught instanceof ApiError ? caught.detail : "The application tracking action could not be completed."); } finally { setBusy(false); } }
  const canRecordManual = application.status === "manual_apply" || application.status === "unknown_submission_state";
  const unknown = application.status === "unknown_submission_state";
  return <section aria-label="Application tracking" className="mt-4 rounded border border-slate-200 bg-white p-4"><h4 className="font-medium text-slate-950">Application tracking</h4><p className="mt-1 text-sm text-slate-600">Dashboard category: <strong>{category(application.status)}</strong> · Current tracking status: {application.tracking_status ? label(application.tracking_status) : "not submitted"}{application.tracking_status_source ? ` · ${label(application.tracking_status_source)} reported` : ""}</p>{unknown ? <div className="mt-3 rounded bg-amber-100 p-3 text-sm text-amber-950"><strong>Submission status could not be confirmed.</strong><p className="mt-1">This application will not be resubmitted automatically. You can check status, record a manual confirmation, or leave it unresolved.</p></div> : null}{canRecordManual ? <div className="mt-3 flex flex-wrap gap-2"><input aria-label="Provider confirmation reference" value={reference} onChange={(event) => setReference(event.target.value)} maxLength={255} placeholder="Optional confirmation reference" className="rounded border border-slate-300 px-2 py-1.5 text-sm" /><button type="button" disabled={busy} onClick={() => void run(() => api.markManualSubmission(application.id, token, { submitted_at: new Date().toISOString(), provider_reference: reference || undefined }))} className="rounded border border-indigo-600 px-3 py-1.5 text-sm text-indigo-700">Mark submitted manually</button>{unknown ? <button type="button" disabled={busy} onClick={() => void run(() => api.reconcileApplication(application.id, token))} className="rounded border border-indigo-600 px-3 py-1.5 text-sm text-indigo-700">Check status again</button> : null}</div> : null}{application.status !== "withdrawn" ? <button type="button" disabled={busy} onClick={() => void run(() => api.withdrawApplication(application.id, token))} className="mt-3 rounded border border-slate-400 px-3 py-1.5 text-sm text-slate-700">Mark withdrawn locally</button> : null}{error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}<ol className="mt-4 space-y-2 border-l border-slate-200 pl-4">{events?.map((event) => <li key={event.id} className="text-sm text-slate-700"><strong>{label(event.event_type)}</strong>{event.status ? ` · ${label(event.status)}` : ""}{event.provider_status ? ` (${event.provider_status})` : ""}<span className="text-slate-500"> · {label(event.source)} · {new Date(event.created_at).toLocaleString()}</span></li>) ?? <li className="text-sm text-slate-500">Loading timeline…</li>}</ol><p className="mt-3 text-xs text-slate-500">User-reported updates are never presented as provider-confirmed. Provider-side withdrawal is not attempted by this release.</p></section>;
}
