import { useEffect, useState } from "react";
import { ApiError, api } from "../api";
import type { EvidenceDetail } from "../api";

const terminalStatuses = new Set(["extracted", "failed", "dead_lettered"]);

export function statusLabel(evidence: EvidenceDetail): string {
  const job = evidence.extraction_job;
  if (evidence.extraction_status === "extracted") return `Extraction completed${job?.provider ? ` with ${job.provider}` : ""}.`;
  if (job?.user_message) return job.user_message;
  if (job && evidence.extraction_status === "retry_scheduled") return `Extraction is retrying (${job.attempt_count}/${job.max_attempts}).`;
  return `Extraction is ${evidence.extraction_status.replaceAll("_", " ")}.`;
}

export function EvidenceUpload({ token, onSubmitted }: { token: string; onSubmitted: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [type, setType] = useState<"project" | "certification">("project");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackedEvidence, setTrackedEvidence] = useState<EvidenceDetail | null>(null);

  useEffect(() => {
    if (!trackedEvidence || terminalStatuses.has(trackedEvidence.extraction_status)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api.evidence(trackedEvidence.id, token).then((next) => {
        if (cancelled) return;
        setTrackedEvidence(next);
        setStatus(statusLabel(next));
        if (terminalStatuses.has(next.extraction_status)) onSubmitted();
      }).catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.detail : "Extraction status could not be refreshed.");
      });
    }, 2_000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [onSubmitted, token, trackedEvidence]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus(null); setError(null);
    try {
      const result = await api.submitEvidence({ evidence_type: type, title, description, external_url: externalUrl || undefined }, token);
      setTrackedEvidence({ ...result, extracted_skills: [], extraction_job: null });
      setStatus(`Evidence saved. Extraction is ${result.extraction_status.replaceAll("_", " ")}.`);
      setTitle(""); setDescription(""); setExternalUrl(""); onSubmitted();
    } catch (caught) { setError(caught instanceof ApiError ? caught.detail : "Evidence could not be submitted."); }
  }

  async function retry() {
    if (!trackedEvidence) return;
    setError(null);
    try {
      const next = await api.requeueEvidence(trackedEvidence.id, token);
      setTrackedEvidence(next);
      setStatus(statusLabel(next));
    } catch (caught) { setError(caught instanceof ApiError ? caught.detail : "Evidence could not be requeued."); }
  }

  const canRetry = trackedEvidence?.extraction_status === "failed" || trackedEvidence?.extraction_status === "dead_lettered";
  return <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Add evidence</h2><p className="mt-1 text-sm text-slate-600">Only submit technical evidence. Extraction runs asynchronously after it is saved.</p><form onSubmit={submit} className="mt-4 grid gap-3"><label className="text-sm font-medium">Evidence type<select value={type} onChange={(event) => setType(event.target.value as "project" | "certification")} className="mt-1 w-full rounded border border-slate-300 px-3 py-2"><option value="project">Project</option><option value="certification">Certification</option></select></label><label className="text-sm font-medium">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium">Technical description<textarea required maxLength={10000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-28 w-full rounded border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium">GitHub or certificate URL <span className="font-normal text-slate-500">(optional)</span><input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{status && <p role="status" className="text-sm text-emerald-700">{status}</p>}{trackedEvidence?.extraction_status === "extracted" && trackedEvidence.extracted_skills.length > 0 && <p className="text-sm text-slate-700">Extracted skills: {trackedEvidence.extracted_skills.map((skill) => skill.canonical_name).join(", ")}</p>}{canRetry && <button type="button" onClick={() => void retry()} className="w-fit rounded border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700">Retry extraction</button>}<button className="rounded bg-indigo-600 px-4 py-2 font-medium text-white">Save and extract skills</button></form></section>;
}
