import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Send, ExternalLink, AlertCircle } from "lucide-react";

import { ApiError, api } from "../api";
import type { Application, ApplicationField, ApplicationForm } from "../api";
import { ApplicationTracking } from "./ApplicationTracking";
import { EditorialButton } from "./ui/EditorialPrimitives";

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
      "mt-1 w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-[#F7F8F8] focus:border-white focus:outline-none",
  };

  if (field.field_type === "select")
    return (
      <select
        {...common}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className={`${common.className} cursor-pointer`}
      >
        <option value="" className="bg-[#071E2B] text-[#BEC8CF]">Select an answer</option>
        {field.allowed_values.map((option) => (
          <option key={option} value={option} className="bg-[#071E2B] text-[#F7F8F8]">
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
        className="mt-2 rounded-xs border-white/20 text-[#9CC7D8] focus:ring-0"
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
      <div className="mt-4 rounded-md border border-white/10 bg-[#071E2B] p-5 space-y-3 font-sans">
        <h4
          className="text-lg font-normal text-[#F7F8F8]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Application Preparation
        </h4>
        <p className="text-xs text-[#BEC8CF] leading-relaxed">
          Prepare the provider-neutral field list and review exactly what can be used. Sensitive questions always require your direct input.
        </p>
        <EditorialButton
          variant="primary"
          disabled={busy}
          onClick={() => void prepare()}
        >
          {busy ? "Preparing…" : "Prepare application"}
        </EditorialButton>
        {error ? (
          <p role="alert" className="mt-2 text-xs font-mono text-red-300">
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
        className="mt-4 rounded-md border border-white/10 bg-[#071E2B] p-6 text-[#F7F8F8] space-y-4 font-sans"
      >
        <div className="border-b border-white/10 pb-4">
          <h4
            className="text-xl font-normal text-[#F7F8F8]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Application Preparation
          </h4>
          <p className="mt-1 font-mono text-xs text-[#8796A2]">
            Provider: {form.provider} ·{" "}
            {form.submission_capability.submission_ready
              ? "Automatic submission supported for this employer"
              : form.submission_capability.credentials_configured
                ? "Provider integration connected, but assisted application is required"
                : "Provider integration is not connected"}
          </p>
          <p className="font-mono text-[11px] text-[#8796A2] mt-0.5">{form.submission_capability.reason}</p>
          <p className="font-mono text-xs text-[#9CC7D8] mt-1">
            Resume: {application.application_snapshot.resume.original_filename}
          </p>
        </div>

        {form.unresolved_field_ids.length ? (
          <p className="rounded-sm bg-[#9CC7D8]/10 border border-[#9CC7D8]/30 p-3 text-xs text-[#9CC7D8] font-mono">
            {form.unresolved_field_ids.length} required field{form.unresolved_field_ids.length === 1 ? "" : "s"} need direct input.
          </p>
        ) : (
          <p className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>All required fields are resolved. Review before marking ready.</span>
          </p>
        )}

        <div className="space-y-3 pt-1">
          {form.fields.map((field) => (
            <div
              key={field.field_id}
              className="rounded-sm border border-white/10 bg-white/[0.01] p-4 space-y-1.5"
            >
              <label htmlFor={field.field_id} className="text-xs font-semibold text-[#F7F8F8] flex items-center gap-1.5">
                {field.sensitive ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-[#9CC7D8]" />
                ) : field.is_answered ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 text-[#9CC7D8]" aria-hidden="true" />
                )}
                <span>
                  {field.label}
                  {field.required ? " (required)" : ""}
                </span>
              </label>
              <p className="text-[11px] text-[#8796A2] font-mono">
                {field.sensitive
                  ? "Sensitive — answer directly; its value is not shown again."
                  : field.requires_user_input
                    ? "Requires your direct input."
                    : field.answer_source
                      ? `Prefilled from ${field.answer_source}.`
                      : "No answer yet."}
              </p>
              {field.sensitive && field.is_answered && draft[field.field_id] === undefined ? (
                <p className="mt-2 text-xs text-emerald-400 font-mono">Direct answer recorded</p>
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
          <p role="alert" className="text-xs font-mono text-red-300">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          {Object.keys(draft).length ? (
            <EditorialButton
              variant="secondary"
              disabled={busy}
              onClick={() => void saveAnswers()}
            >
              Save answers
            </EditorialButton>
          ) : null}

          {form.is_assisted ? (
            <a
              href={application.manual_apply_url ?? application.application_snapshot.job.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-4 py-2 font-mono text-xs text-[#F7F8F8] hover:bg-white/15 transition-colors"
            >
              <span>Continue on provider site</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : application.status === "prepared" ? (
            <EditorialButton
              variant="primary"
              disabled={busy || form.unresolved_field_ids.length > 0}
              onClick={() => void ready()}
            >
              Mark ready to submit
            </EditorialButton>
          ) : application.status === "ready_to_submit" ? (
            <EditorialButton
              variant="primary"
              disabled={busy}
              onClick={() => void submit()}
            >
              <Send className="h-3 w-3 mr-1" />
              <span>Submit application</span>
            </EditorialButton>
          ) : null}
        </div>

        <p className="font-mono text-[11px] text-[#8796A2] pt-1">
          No browser automation is used. Provider credentials are never shown in this application.
        </p>
      </section>
      <ApplicationTracking application={application} token={token} onChanged={onChanged} />
    </>
  );
}
