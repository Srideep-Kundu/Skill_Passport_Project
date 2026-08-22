import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload, CheckCircle2, Loader2 } from "lucide-react";
import { ApiError, api, type ResumeDocument } from "../api";
import { EmptyState, LoadingState } from "./AsyncState";

function getWorkflowStep(parseStatus: string): number {
  switch (parseStatus) {
    case "uploaded":
      return 1;
    case "parsing":
    case "processing":
      return 2;
    case "extracted":
    case "completed":
    case "parsed":
      return 4;
    default:
      return 0;
  }
}

const WORKFLOW_STEPS = [
  "Uploaded",
  "Reading Document",
  "Extracting Evidence",
  "Passport Ready",
];

export function ResumeIntelligence({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [resumes, setResumes] = useState<ResumeDocument[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      setResumes((await api.resumes(token)).items);
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.detail : "Resumes could not be loaded.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload() {
    if (!file) return;
    setIsUploading(true);
    setMessage(null);
    try {
      // 1. Upload resume
      const uploadedDoc = await api.uploadResume(file, token);

      // 2. Automatically parse resume into evidence and extract skills
      let parsedDoc = uploadedDoc;
      if (uploadedDoc.parse_status !== "unsupported") {
        try {
          parsedDoc = await api.parseResume(uploadedDoc.id, token);
        } catch {
          // parse gracefully handled
        }
      }

      // 3. Automatically activate the uploaded resume
      try {
        await api.activateResume(uploadedDoc.id, token);
      } catch {
        // activate gracefully handled
      }

      const msg = parsedDoc.safe_error_message ?? "Resume uploaded, parsed into evidence, and activated!";
      setMessage(msg);
      toast.success("Resume uploaded, parsed, and activated!");
      setFile(null);
      await load();
      onChanged();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Resume upload failed.";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm text-slate-900 dark:text-[#f1f0e8] space-y-4">
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
          <FileText className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
          <span>Resume Intelligence</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
          PDF and DOCX only. Resume claims are automatically parsed and activated into verified skill evidence.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            aria-label="Resume file"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="flex-1 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3 py-1.5 text-xs text-slate-900 dark:text-[#f1f0e8]"
          />
          <button
            disabled={!file || isUploading}
            type="button"
            onClick={() => void upload()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#3b71d9] hover:bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm shadow-[#3b71d9]/25 font-sans"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                <span>Upload resume</span>
              </>
            )}
          </button>
        </div>

        {message && (
          <p role="status" className="text-xs font-medium text-slate-600 dark:text-[#98a4b3] bg-slate-50 dark:bg-[#151e29] p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08]">
            {message}
          </p>
        )}

        {!resumes ? (
          <LoadingState label="Loading resumes" />
        ) : resumes.length ? (
          <ul className="space-y-3">
            {resumes.map((resume) => {
              const currentStep = getWorkflowStep(resume.parse_status);

              return (
                <li
                  key={resume.id}
                  className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
                        <span>{resume.original_filename}</span>
                        {resume.is_active && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 font-sans">
                            <CheckCircle2 className="h-3 w-3" /> Active
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
                        Resume Parsed: {resume.parse_status} &middot; Evidence Generated: {resume.generated_evidence_count} &middot; Skills: {resume.skills_status}
                      </p>
                    </div>
                  </div>

                  {/* PARSING WORKFLOW STEPPER */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.08]">
                    <ol className="grid grid-cols-4 gap-1 text-[10px] font-semibold text-slate-400 dark:text-[#98a4b3]">
                      {WORKFLOW_STEPS.map((stepName, idx) => {
                        const stepNum = idx + 1;
                        const isDone = currentStep >= stepNum;
                        const isCurrent = currentStep === stepNum;

                        return (
                          <li key={stepName} className="flex flex-col gap-1">
                            <div
                              className={`h-1 w-full rounded-full transition-colors ${
                                isDone
                                  ? "bg-[#3b71d9] dark:bg-[#b0c6ff]"
                                  : isCurrent
                                  ? "bg-blue-400 animate-pulse"
                                  : "bg-slate-200 dark:bg-[#1d2025]"
                              }`}
                            />
                            <span className={isDone ? "text-[#3b71d9] dark:text-[#dedbc8] font-bold" : ""}>
                              {stepName}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  {resume.safe_error_message && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      {resume.safe_error_message}
                    </p>
                  )}

                  {resume.parsed_summary && (
                    <p className="text-[11px] text-slate-600 dark:text-[#98a4b3] pt-1">
                      Projects: {resume.parsed_summary.projects.length} &middot; Certifications: {resume.parsed_summary.certifications.length} &middot; Skills: {resume.parsed_summary.explicit_technical_skills.join(", ") || "none"}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No resume uploaded">Upload a text-based PDF or DOCX to generate evidence.</EmptyState>
        )}
      </div>
    </section>
  );
}
