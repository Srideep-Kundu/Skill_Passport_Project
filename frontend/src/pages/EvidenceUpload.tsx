import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ApiError, api } from "../api";
import type { EvidenceDetail } from "../api";
import { LiquidGlassButton } from "../components/ui/EditorialPrimitives";

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
    <section className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 rounded-[16px] text-[#111827] space-y-5 font-sans shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
      <div className="border-b border-[#E5E1D8] pb-4">
        <div className="font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold mb-1 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
          <span>TECHNICAL ARTIFACT REGISTRATION</span>
        </div>
        <h2 className="text-2xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
          Add Technical Evidence
        </h2>
        <p className="text-xs text-[#475569] mt-0.5">
          Projects and certifications are asynchronously parsed into verified skills
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-xs font-mono uppercase tracking-wider text-[#475569]">
            Evidence Type
            <select
              {...register("type")}
              className="mt-1.5 w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-2.5 text-xs text-[#111827] focus:border-[#B08D57]"
            >
              <option value="project">Project Evidence</option>
              <option value="certification">Certification</option>
            </select>
          </label>

          <label className="block text-xs font-mono uppercase tracking-wider text-[#475569]">
            Title
            <input
              {...register("title")}
              placeholder="e.g. Distributed Task Queue"
              className="mt-1.5 w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-2.5 text-xs text-[#111827] focus:border-[#B08D57]"
            />
            {errors.title && <span className="text-[11px] text-[#B4534B] mt-1 block">{errors.title.message}</span>}
          </label>
        </div>

        <label className="block text-xs font-mono uppercase tracking-wider text-[#475569]">
          Technical Details & Description
          <textarea
            {...register("description")}
            maxLength={10000}
            rows={3}
            placeholder="Explain architecture, tools used, key algorithms, tests, or achievements..."
            className="mt-1.5 w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-2.5 text-xs text-[#111827] focus:border-[#B08D57]"
          />
          {errors.description && <span className="text-[11px] text-[#B4534B] mt-1 block">{errors.description.message}</span>}
        </label>

        <label className="block text-xs font-mono uppercase tracking-wider text-[#475569]">
          GitHub or Public URL <span className="text-[#64748B] lowercase">(optional)</span>
          <input
            {...register("externalUrl")}
            type="url"
            placeholder="https://github.com/username/repo"
            className="mt-1.5 w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-2.5 text-xs text-[#111827] focus:border-[#B08D57]"
          />
          {errors.externalUrl && <span className="text-[11px] text-[#B4534B] mt-1 block">{errors.externalUrl.message}</span>}
        </label>

        {error && (
          <div role="alert" className="p-2.5 text-xs text-[#B4534B] border border-[#B4534B]/30 bg-[#FFF5F5] rounded-sm font-mono">
            {error}
          </div>
        )}

        {status && (
          <div role="status" className="p-2.5 text-xs font-mono text-[#475569] border border-[#E5E1D8] bg-[#F8F9FA] rounded-sm">
            {status}
          </div>
        )}

        {trackedEvidence?.extraction_status === "extracted" && trackedEvidence.extracted_skills.length > 0 && (
          <div className="p-3 text-xs font-mono border border-[#E5E1D8] bg-[#F7F5F0] rounded-sm">
            <span className="text-[#64748B] font-semibold">Extracted skills: </span>
            <span className="text-[#111827]">{trackedEvidence.extracted_skills.map((skill) => skill.canonical_name).join(", ")}</span>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          {canRetry && (
            <button
              type="button"
              onClick={() => void retry()}
              className="rounded-full border border-[#E5E1D8] bg-[#FFFFFF] px-4 py-2 font-mono text-xs text-[#0f172a] font-bold hover:bg-[#F7F5F0] hover:text-[#000000] transition-colors cursor-pointer shadow-2xs"
            >
              Retry Extraction
            </button>
          )}
          <LiquidGlassButton type="submit" disabled={isSubmitting} size="sm">
            {isSubmitting ? "Saving Evidence..." : "Save and Extract Skills"}
          </LiquidGlassButton>
        </div>
      </form>
    </section>
  );
}
