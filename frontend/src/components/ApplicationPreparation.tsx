import { useEffect, useState } from "react";

import { ApiError, api } from "../api";
import type { Application, ApplicationField, ApplicationForm } from "../api";

const EXECUTION_STATES = ["needs_input", "prepared", "ready_to_submit"];

function valueForField(field: ApplicationField): string | boolean {
  if (field.field_type === "boolean") return field.answer === true;
  return typeof field.answer === "string" || typeof field.answer === "number" ? String(field.answer) : "";
}

function FieldInput({ field, value, onChange }: { field: ApplicationField; value: string | boolean | undefined; onChange: (value: string | boolean) => void }) {
  const common = { id: field.field_id, name: field.field_id, className: "mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm" };
  if (field.field_type === "select") return <select {...common} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}><option value="">Select an answer</option>{field.allowed_values.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  if (field.field_type === "boolean") return <input id={field.field_id} name={field.field_id} type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} className="mt-2" />;
  if (field.field_type === "textarea") return <textarea {...common} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} rows={3} />;
  return <input {...common} type={field.field_type === "phone" ? "tel" : field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : field.field_type === "email" ? "email" : field.field_type === "url" ? "url" : "text"} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />;
}

export function ApplicationPreparation({ application, token, onChanged }: { application: Application; token: string; onChanged: (application: Application) => void }) {
  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!EXECUTION_STATES.includes(application.status)) return;
    void api.applicationForm(application.id, token).then((next) => { setForm(next); setDraft(Object.fromEntries(next.fields.filter((field) => !field.sensitive && field.answer !== null).map((field) => [field.field_id, valueForField(field)]))); }).catch((caught) => setError(caught instanceof ApiError ? caught.detail : "The prepared application could not be loaded."));
  }, [application.id, application.status, token]);
  async function prepare() {
    try {
      setBusy(true); setError(null);
      const next = await api.prepareApplication(application.id, token);
      setForm(next); setDraft(Object.fromEntries(next.fields.filter((field) => !field.sensitive && field.answer !== null).map((field) => [field.field_id, valueForField(field)])));
      onChanged({ ...application, status: next.unresolved_field_ids.length ? "needs_input" : "prepared", execution_payload_fingerprint: next.payload_fingerprint });
    } catch (caught) { setError(caught instanceof ApiError ? caught.detail : "Preparation could not be completed."); }
    finally { setBusy(false); }
  }
  async function saveAnswers() {
    if (!form || !Object.keys(draft).length) return;
    try {
      setBusy(true); setError(null);
      const next = await api.updateApplicationAnswers(application.id, draft, token);
      setForm(next); setDraft({});
      onChanged({ ...application, status: next.unresolved_field_ids.length ? "needs_input" : "prepared", execution_payload_fingerprint: next.payload_fingerprint, ready_payload_fingerprint: null });
    } catch (caught) { setError(caught instanceof ApiError ? caught.detail : "Answers could not be saved."); }
    finally { setBusy(false); }
  }
  async function ready() {
    try { setBusy(true); setError(null); onChanged(await api.readyApplication(application.id, token)); }
    catch (caught) { setError(caught instanceof ApiError ? caught.detail : "The application could not be marked ready."); }
    finally { setBusy(false); }
  }
  async function submit() {
    try { setBusy(true); setError(null); onChanged(await api.submitApplication(application.id, token)); }
    catch (caught) { setError(caught instanceof ApiError ? caught.detail : "The submission could not be completed."); }
    finally { setBusy(false); }
  }
  if (application.status === "approved" && !form) return <div className="mt-4 rounded border border-indigo-200 bg-white p-3"><h4 className="font-medium text-slate-950">Application preparation</h4><p className="mt-1 text-sm text-slate-600">Prepare the provider-neutral field list and review exactly what can be used. Sensitive questions always require your direct input.</p><button type="button" disabled={busy} onClick={() => void prepare()} className="mt-3 rounded bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white">{busy ? "Preparing…" : "Prepare application"}</button>{error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}</div>;
  if (!form) return null;
  return <section aria-label="Application preparation" className="mt-4 rounded border border-indigo-200 bg-white p-4"><h4 className="font-medium text-slate-950">Application preparation</h4><p className="mt-1 text-sm text-slate-600">Provider: {form.provider} · {form.submission_capability.submission_ready ? "Automatic submission supported for this employer" : form.submission_capability.credentials_configured ? "Provider integration connected, but assisted application is required" : "Provider integration is not connected"}</p><p className="mt-1 text-xs text-slate-500">{form.submission_capability.reason}</p><p className="mt-1 text-sm text-slate-600">Resume: {application.application_snapshot.resume.original_filename}</p>{form.unresolved_field_ids.length ? <p className="mt-2 rounded bg-amber-100 p-2 text-sm text-amber-900">{form.unresolved_field_ids.length} required field{form.unresolved_field_ids.length === 1 ? "" : "s"} need direct input.</p> : <p className="mt-2 text-sm text-emerald-700">All required fields are resolved. Review before marking ready.</p>}<div className="mt-3 space-y-3">{form.fields.map((field) => <div key={field.field_id} className="rounded border border-slate-200 p-3"><label htmlFor={field.field_id} className="text-sm font-medium text-slate-900">{field.sensitive ? "⚠ " : field.is_answered ? "✓ " : "△ "}{field.label}{field.required ? " (required)" : ""}</label><p className="mt-0.5 text-xs text-slate-500">{field.sensitive ? "Sensitive — answer directly; its value is not shown again." : field.requires_user_input ? "Requires your direct input." : field.answer_source ? `Prefilled from ${field.answer_source}.` : "No answer yet."}</p>{field.sensitive && field.is_answered && draft[field.field_id] === undefined ? <p className="mt-2 text-sm text-emerald-700">Direct answer recorded</p> : <FieldInput field={field} value={draft[field.field_id] ?? valueForField(field)} onChange={(value) => setDraft((current) => ({ ...current, [field.field_id]: value }))} />}</div>)}</div>{error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}<div className="mt-4 flex flex-wrap gap-2">{Object.keys(draft).length ? <button type="button" disabled={busy} onClick={() => void saveAnswers()} className="rounded border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700">Save answers</button> : null}{form.is_assisted ? <a href={application.manual_apply_url ?? application.application_snapshot.job.source_url} target="_blank" rel="noreferrer" className="rounded bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white">Continue on provider site</a> : application.status === "prepared" ? <button type="button" disabled={busy || form.unresolved_field_ids.length > 0} onClick={() => void ready()} className="rounded bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white">Mark ready to submit</button> : application.status === "ready_to_submit" ? <button type="button" disabled={busy} onClick={() => void submit()} className="rounded bg-indigo-700 px-3 py-1.5 text-sm font-medium text-white">Submit application</button> : null}</div><p className="mt-3 text-xs text-slate-500">No browser automation is used. Provider credentials are never shown in this application.</p></section>;
}
