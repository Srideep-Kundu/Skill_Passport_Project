import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ApiError, api } from "../api";
import type { EvidenceDetail } from "../api";

const evidenceSchema = z.object({
  type: z.enum(["project", "certification"]),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  externalUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
});

type EvidenceFormData = z.infer<typeof evidenceSchema>;

const terminalStatuses = new Set(["extracted", "failed", "dead_lettered"]);

export function statusLabel(evidence: EvidenceDetail): string {
  const job = evidence.extraction_job;
  if (evidence.extraction_status === "extracted") {
    return `Extraction completed${job?.provider ? ` with ${job.provider}` : ""}.`;
  }
  if (job?.user_message) return job.user_message;
  if (job && evidence.extraction_status === "retry_scheduled") {
    return `Extraction is retrying (${job.attempt_count}/${job.max_attempts}).`;
  }
  return `Extraction is ${evidence.extraction_status.replaceAll("_", " ")}.`;
}

export function EvidenceUpload({
  token,
  onSubmitted,
}: {
  token: string;
  onSubmitted: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackedEvidence, setTrackedEvidence] = useState<EvidenceDetail | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EvidenceFormData>({
    resolver: zodResolver(evidenceSchema),
    defaultValues: {
      type: "project",
      title: "",
      description: "",
      externalUrl: "",
    },
  });

  useEffect(() => {
    if (!trackedEvidence || terminalStatuses.has(trackedEvidence.extraction_status)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void api
        .evidence(trackedEvidence.id, token)
        .then((next) => {
          if (cancelled) return;
          setTrackedEvidence(next);
          setStatus(statusLabel(next));
          if (terminalStatuses.has(next.extraction_status)) onSubmitted();
        })
        .catch((caught: unknown) => {
          if (!cancelled) {
            setError(caught instanceof ApiError ? caught.detail : "Extraction status could not be refreshed.");
          }
        });
    }, 2_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [onSubmitted, token, trackedEvidence]);

  async function onSubmitForm(data: EvidenceFormData) {
    setStatus(null);
    setError(null);
    try {
      const result = await api.submitEvidence(
        {
          evidence_type: data.type,
          title: data.title,
          description: data.description,
          external_url: data.externalUrl || undefined,
        },
        token
      );
      setTrackedEvidence({ ...result, extracted_skills: [], extraction_job: null });
      setStatus(`Evidence saved. Extraction is ${result.extraction_status.replaceAll("_", " ")}.`);
      reset({ type: "project", title: "", description: "", externalUrl: "" });
      onSubmitted();
      toast.success("Technical evidence uploaded and extraction queued!");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Evidence could not be submitted.";
      setError(msg);
      toast.error(msg);
    }
  }

  async function retry() {
    if (!trackedEvidence) return;
    setError(null);
    try {
      const next = await api.requeueEvidence(trackedEvidence.id, token);
      setTrackedEvidence(next);
      setStatus(statusLabel(next));
      toast.info("Requeued skill extraction job.");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Evidence could not be requeued.";
      setError(msg);
      toast.error(msg);
    }
  }

  const canRetry =
    trackedEvidence?.extraction_status === "failed" ||
    trackedEvidence?.extraction_status === "dead_lettered";

  return (
    <section className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-5 sm:p-6 shadow-lg text-slate-900 dark:text-[#f1f0e8] space-y-4">
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Add Technical Evidence</h2>
        <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
          Projects and certifications are asynchronously parsed into verified skills
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] col-span-2 sm:col-span-1 font-sans">
            Evidence Type
            <select
              {...register("type")}
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1.5 text-xs focus:border-[#3b71d9] focus:outline-none bg-white/80 dark:bg-white/[0.04] backdrop-blur-md text-slate-900 dark:text-[#f1f0e8] cursor-pointer"
            >
              <option value="project" className="dark:bg-[#0c121e]">Project Evidence</option>
              <option value="certification" className="dark:bg-[#0c121e]">Certification</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] col-span-2 sm:col-span-1 font-sans">
            Title
            <input
              {...register("title")}
              placeholder="e.g. Distributed Task Queue"
              className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3 py-1.5 text-xs focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
            />
            {errors.title && <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 block">{errors.title.message}</span>}
          </label>
        </div>

        <label className="block text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] font-sans">
          Technical Details & Description
          <textarea
            {...register("description")}
            maxLength={10000}
            placeholder="Explain architecture, tools used, key algorithms, tests, or achievements..."
            className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3 py-1.5 text-xs focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
          />
          {errors.description && <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 block">{errors.description.message}</span>}
        </label>

        <label className="block text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] font-sans">
          GitHub or Public URL <span className="font-normal text-slate-400 dark:text-[#98a4b3] text-[11px]">(optional)</span>
          <input
            {...register("externalUrl")}
            type="url"
            placeholder="https://github.com/username/repo"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3 py-1.5 text-xs focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
          />
          {errors.externalUrl && <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 block">{errors.externalUrl.message}</span>}
        </label>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {status && (
          <div role="status" className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 backdrop-blur-md border border-emerald-100 dark:border-emerald-900/60 p-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 font-sans">
            {status}
          </div>
        )}

        {trackedEvidence?.extraction_status === "extracted" && trackedEvidence.extracted_skills.length > 0 && (
          <div className="rounded-xl bg-blue-50/60 dark:bg-[#3b71d9]/15 backdrop-blur-md border border-blue-100 dark:border-blue-900/60 p-2 text-xs text-[#3b71d9] dark:text-[#b0c6ff] font-sans">
            <span className="font-bold">Extracted skills: </span>
            {trackedEvidence.extracted_skills.map((skill) => skill.canonical_name).join(", ")}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1 font-sans">
          {canRetry && (
            <button
              type="button"
              onClick={() => void retry()}
              className="rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3 py-2 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              Retry Extraction
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-[#3b71d9] py-2 text-xs font-semibold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] focus:outline-none disabled:opacity-50 transition-colors cursor-pointer font-sans"
          >
            {isSubmitting ? "Saving Evidence..." : "Save and Extract Skills"}
          </button>
        </div>
      </form>
    </section>
  );
}
