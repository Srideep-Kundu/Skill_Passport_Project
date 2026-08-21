import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Send, ExternalLink, AlertCircle } from "lucide-react";

import { ApiError, api } from "../api";
import type { Application, ApplicationField, ApplicationForm } from "../api";
import { ApplicationTracking } from "./ApplicationTracking";

const EXECUTION_STATES = ["needs_input", "prepared", "ready_to_submit"];

function valueForField(field: ApplicationField): string | boolean {
  if (field.field_type === "boolean") return field.answer === true;
  return typeof field.answer === "string" || typeof field.answer === "number" ? String(field.answer) : "";
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ApplicationField;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const common = {
    id: field.field_id,
    name: field.field_id,
    className:
      "mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#111821] px-3 py-1.5 text-xs text-slate-900 dark:text-[#f1f0e8] focus:border-[#3b71d9] focus:outline-none font-sans",
  };

  if (field.field_type === "select")
    return (
      <select
        {...common}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className={`${common.className} cursor-pointer`}
      >
        <option value="">Select an answer</option>
        {field.allowed_values.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );

  if (field.field_type === "boolean")
    return (
      <input
        id={field.field_id}
        name={field.field_id}
        type="checkbox"
        checked={value === true}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-2 rounded border-slate-300 text-[#3b71d9] focus:ring-[#3b71d9]"
      />
    );

  if (field.field_type === "textarea")
    return (
      <textarea
        {...common}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
      />
    );

  return (
    <input
      {...common}
      type={
        field.field_type === "phone"
          ? "tel"
          : field.field_type === "number"
            ? "number"
            : field.field_type === "date"
              ? "date"
              : field.field_type === "email"
                ? "email"
                : field.field_type === "url"
                  ? "url"
                  : "text"
      }
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function ApplicationPreparation({
  application,
  token,
  onChanged,
}: {
  application: Application;
  token: string;
  onChanged: (application: Application) => void;
}) {
  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!EXECUTION_STATES.includes(application.status)) return;
    void api
      .applicationForm(application.id, token)
      .then((next) => {
        setForm(next);
        setDraft(
          Object.fromEntries(
            next.fields
              .filter((field) => !field.sensitive && field.answer !== null)
              .map((field) => [field.field_id, valueForField(field)])
          )
        );
      })
      .catch((caught) =>
        setError(caught instanceof ApiError ? caught.detail : "The prepared application could not be loaded.")
      );
  }, [application.id, application.status, token]);

  async function prepare() {
    try {
      setBusy(true);
      setError(null);
      const next = await api.prepareApplication(application.id, token);
      setForm(next);
      setDraft(
        Object.fromEntries(
          next.fields
            .filter((field) => !field.sensitive && field.answer !== null)
            .map((field) => [field.field_id, valueForField(field)])
        )
      );
      onChanged({
        ...application,
        status: next.unresolved_field_ids.length ? "needs_input" : "prepared",
        execution_payload_fingerprint: next.payload_fingerprint,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Preparation could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAnswers() {
    if (!form || !Object.keys(draft).length) return;
    try {
      setBusy(true);
      setError(null);
      const next = await api.updateApplicationAnswers(application.id, draft, token);
      setForm(next);
      setDraft({});
      onChanged({
        ...application,
        status: next.unresolved_field_ids.length ? "needs_input" : "prepared",
        execution_payload_fingerprint: next.payload_fingerprint,
        ready_payload_fingerprint: null,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Answers could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function ready() {
    try {
      setBusy(true);
      setError(null);
      onChanged(await api.readyApplication(application.id, token));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "The application could not be marked ready.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    try {
      setBusy(true);
      setError(null);
      onChanged(await api.submitApplication(application.id, token));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "The submission could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (application.status === "approved" && !form)
    return (
      <div className="mt-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#151e29] p-4 text-slate-900 dark:text-[#f1f0e8] space-y-2 font-sans">
        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-[#f1f0e8] flex items-center gap-1.5 font-sans">
          <FileText className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
          <span>Application preparation</span>
        </h4>
        <p className="text-xs text-slate-600 dark:text-[#98a4b3] font-sans">
          Prepare the provider-neutral field list and review exactly what can be used. Sensitive questions always require your direct input.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void prepare()}
          className="mt-2 rounded-lg bg-[#3b71d9] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] disabled:opacity-50 transition-colors cursor-pointer font-sans"
        >
          {busy ? "Preparing…" : "Prepare application"}
        </button>
        {error ? (
          <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400 font-sans">
            {error}
          </p>
        ) : null}
      </div>
    );

  if (!form) return <ApplicationTracking application={application} token={token} onChanged={onChanged} />;

  return (
    <>
      <section
        aria-label="Application preparation"
        className="mt-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#111821] p-4 sm:p-5 text-slate-900 dark:text-[#f1f0e8] space-y-3"
      >
        <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3">
          <h4 className="font-bold text-sm text-slate-900 dark:text-[#f1f0e8] flex items-center gap-1.5 font-sans">
            <FileText className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>Application preparation</span>
          </h4>
          <p className="mt-1 text-xs text-slate-600 dark:text-[#98a4b3] font-sans">
            Provider: {form.provider} ·{" "}
            {form.submission_capability.submission_ready
              ? "Automatic submission supported for this employer"
              : form.submission_capability.credentials_configured
                ? "Provider integration connected, but assisted application is required"
                : "Provider integration is not connected"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] font-sans">{form.submission_capability.reason}</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-[#98a4b3] font-sans">
            Resume: {application.application_snapshot.resume.original_filename}
          </p>
        </div>

        {form.unresolved_field_ids.length ? (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 p-2.5 text-xs text-amber-900 dark:text-amber-300 font-medium font-sans">
            {form.unresolved_field_ids.length} required field{form.unresolved_field_ids.length === 1 ? "" : "s"} need direct input.
          </p>
        ) : (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 font-sans">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>All required fields are resolved. Review before marking ready.</span>
          </p>
        )}

        <div className="space-y-3 pt-1">
          {form.fields.map((field) => (
            <div
              key={field.field_id}
              className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-3.5"
            >
              <label htmlFor={field.field_id} className="text-xs font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-1.5 font-sans">
                {field.sensitive ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                ) : field.is_answered ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                )}
                <span>
                  {field.label}
                  {field.required ? " (required)" : ""}
                </span>
              </label>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-[#98a4b3] font-sans">
                {field.sensitive
                  ? "Sensitive — answer directly; its value is not shown again."
                  : field.requires_user_input
                    ? "Requires your direct input."
                    : field.answer_source
                      ? `Prefilled from ${field.answer_source}.`
                      : "No answer yet."}
              </p>
              {field.sensitive && field.is_answered && draft[field.field_id] === undefined ? (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-sans">Direct answer recorded</p>
              ) : (
                <FieldInput
                  field={field}
                  value={draft[field.field_id] ?? valueForField(field)}
                  onChange={(value) => setDraft((current) => ({ ...current, [field.field_id]: value }))}
                />
              )}
            </div>
          ))}
        </div>

        {error ? (
          <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400 font-sans">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2 font-sans">
          {Object.keys(draft).length ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveAnswers()}
              className="rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-white dark:bg-[#111821] px-3.5 py-1.5 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-[#1a2430] transition-colors cursor-pointer"
            >
              Save answers
            </button>
          ) : null}

          {form.is_assisted ? (
            <a
              href={application.manual_apply_url ?? application.application_snapshot.job.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-[#3b71d9] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] transition-colors"
            >
              <span>Continue on provider site</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : application.status === "prepared" ? (
            <button
              type="button"
              disabled={busy || form.unresolved_field_ids.length > 0}
              onClick={() => void ready()}
              className="rounded-lg bg-[#3b71d9] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] disabled:opacity-50 transition-colors cursor-pointer"
            >
              Mark ready to submit
            </button>
          ) : application.status === "ready_to_submit" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b71d9] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Send className="h-3 w-3" />
              <span>Submit application</span>
            </button>
          ) : null}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          No browser automation is used. Provider credentials are never shown in this application.
        </p>
      </section>
      <ApplicationTracking application={application} token={token} onChanged={onChanged} />
    </>
  );
}
