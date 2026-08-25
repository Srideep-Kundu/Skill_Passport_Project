import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Layers,
  ShieldCheck,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileCheck,
  Database,
  Code2,
  Cloud,
  Terminal,
} from "lucide-react";
import { ApiError, api, type ResumeDocument, type ResumeParsedData } from "../api";

export type ProcessingPhase =
  | "idle"
  | "uploading"
  | "reading"
  | "discovering"
  | "categorizing"
  | "building_passport"
  | "partial_failure"
  | "complete"
  | "error";

const SKILL_CATEGORY_MAP: Record<string, string> = {
  python: "Languages",
  javascript: "Languages",
  typescript: "Languages",
  java: "Languages",
  "c++": "Languages",
  c: "Languages",
  "c#": "Languages",
  golang: "Languages",
  go: "Languages",
  rust: "Languages",
  ruby: "Languages",
  php: "Languages",
  swift: "Languages",
  kotlin: "Languages",
  sql: "Languages",
  html: "Frontend",
  css: "Frontend",
  react: "Frontend",
  "react.js": "Frontend",
  vue: "Frontend",
  "vue.js": "Frontend",
  angular: "Frontend",
  "next.js": "Frontend",
  tailwind: "Frontend",
  "tailwind css": "Frontend",
  fastapi: "Backend",
  django: "Backend",
  flask: "Backend",
  express: "Backend",
  "node.js": "Backend",
  nodejs: "Backend",
  spring: "Backend",
  "spring boot": "Backend",
  "rest apis": "Backend",
  graphql: "Backend",
  postgresql: "Databases",
  postgres: "Databases",
  mysql: "Databases",
  mongodb: "Databases",
  redis: "Databases",
  sqlite: "Databases",
  cassandra: "Databases",
  docker: "Cloud & DevOps",
  kubernetes: "Cloud & DevOps",
  aws: "Cloud & DevOps",
  azure: "Cloud & DevOps",
  gcp: "Cloud & DevOps",
  ci_cd: "Cloud & DevOps",
  git: "Cloud & DevOps",
  linux: "Cloud & DevOps",
  pytorch: "AI & Machine Learning",
  tensorflow: "AI & Machine Learning",
  keras: "AI & Machine Learning",
  scikit_learn: "AI & Machine Learning",
  pandas: "AI & Machine Learning",
  numpy: "AI & Machine Learning",
  opencv: "AI & Machine Learning",
  nlp: "AI & Machine Learning",
};

function getSkillCategory(skillName: string): string {
  const normalized = skillName.trim().toLowerCase();
  return SKILL_CATEGORY_MAP[normalized] || "Technical Skills";
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "Languages":
      return <Code2 className="h-3.5 w-3.5 text-white/70" />;
    case "Frontend":
      return <Layers className="h-3.5 w-3.5 text-white/70" />;
    case "Backend":
      return <Terminal className="h-3.5 w-3.5 text-white/70" />;
    case "Databases":
      return <Database className="h-3.5 w-3.5 text-white/70" />;
    case "Cloud & DevOps":
      return <Cloud className="h-3.5 w-3.5 text-white/70" />;
    case "AI & Machine Learning":
      return <Cpu className="h-3.5 w-3.5 text-white/70" />;
    default:
      return <FileCheck className="h-3.5 w-3.5 text-white/70" />;
  }
}

export function ResumeIntelligence({
  token,
  onChanged,
}: {
  token: string;
  onChanged: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [, setResumes] = useState<ResumeDocument[] | null>(null);
  const [activeResume, setActiveResume] = useState<ResumeDocument | null>(null);
  const [phase, setPhase] = useState<ProcessingPhase>("idle");
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"upload" | "parse" | "extraction" | "activate" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [showExtractedDetails, setShowExtractedDetails] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await api.resumes(token);
      const items = response.items || [];
      setResumes(items);
      const active = items.find((r) => r.is_active) || items[0] || null;
      setActiveResume(active);

      if (active) {
        if (active.skills_status === "partial_failure") {
          setPhase("partial_failure");
          setErrorMessage(null);
          setErrorType(null);
        } else if (active.skills_status === "failed") {
          setPhase("error");
          setErrorType("extraction");
          setErrorMessage(
            "Your file is safe. Retry when the extraction service is available.",
          );
        } else if (
          (active.parse_status === "completed" || active.parse_status === "parsed" || active.parse_status === "processing_skills") &&
          (active.skills_status === "ready" || (active.completed_jobs > 0 && active.pending_jobs === 0 && active.failed_jobs === 0))
        ) {
          stopPolling();
          setPhase("complete");
        } else if (active.parse_status === "failed") {
          stopPolling();
          setPhase("error");
          setErrorMessage(active.safe_error_message || "Resume analysis encountered an error.");
          setErrorType("parse");
        } else if (active.parse_status === "unsupported") {
          stopPolling();
          setPhase("error");
          setErrorMessage(active.safe_error_message || "This resume format is unsupported or contains non-extractable text.");
          setErrorType("parse");
        } else if (
          active.skills_status === "processing" ||
          active.parse_status === "parsing" ||
          active.parse_status === "processing_skills"
        ) {
          setPhase("discovering");
          if (!pollingRef.current) {
            pollingRef.current = setInterval(async () => {
              try {
                const res = await api.resumes(token);
                const latest = (res.items || []).find((r) => r.id === active.id);
                if (latest) {
                  setActiveResume(latest);
                  if (
                    latest.skills_status === "ready" ||
                    (latest.completed_jobs > 0 && latest.pending_jobs === 0 && latest.failed_jobs === 0)
                  ) {
                    stopPolling();
                    setPhase("complete");
                    onChanged();
                  } else if (latest.skills_status === "partial_failure") {
                    stopPolling();
                    setPhase("partial_failure");
                    onChanged();
                  } else if (latest.skills_status === "failed" || latest.parse_status === "failed") {
                    stopPolling();
                    setPhase("error");
                    setErrorType("extraction");
                    setErrorMessage("Your file is safe. Retry when the extraction service is available.");
                  }
                }
              } catch {
                stopPolling();
              }
            }, 500);
          }
        } else if (active.parse_status === "uploaded") {
          setPhase("reading");
        }
      } else {
        stopPolling();
        setPhase("idle");
      }
    } catch (caught) {
      setResumes([]);
      setErrorMessage(caught instanceof ApiError ? caught.detail : "Resumes could not be loaded.");
    }
  }, [token, stopPolling, onChanged]);

  useEffect(() => {
    void load();
    return () => stopPolling();
  }, [load, stopPolling]);

  async function waitForExtraction(documentId: string) {
    stopPolling();
    return new Promise<"ready" | "partial_failure" | "failed" | "timeout" | "unavailable">((resolve) => {
      let attempts = 0;
      pollingRef.current = setInterval(async () => {
        attempts += 1;
        try {
          const response = await api.resumes(token);
          const latest = response.items.find((item) => item.id === documentId);
          if (!latest) {
            if (attempts >= 15) {
              stopPolling();
              resolve("timeout");
            }
            return;
          }

          setActiveResume(latest);
          if (latest.skills_status === "ready") {
            stopPolling();
            resolve("ready");
          } else if (latest.skills_status === "partial_failure") {
            stopPolling();
            resolve("partial_failure");
          } else if (latest.skills_status === "failed" || latest.parse_status === "failed") {
            stopPolling();
            resolve("failed");
          } else if (attempts >= 15) {
            stopPolling();
            resolve("timeout");
          }
        } catch {
          stopPolling();
          resolve("unavailable");
        }
      }, 1200);
    });
  }

  async function processResumeFile(file: File) {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".pdf") && !lowerName.endsWith(".docx")) {
      toast.error("Please upload a PDF or DOCX file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Resume file exceeds 10MB size limit.");
      return;
    }

    setCurrentFileName(file.name);
    setErrorMessage(null);
    setErrorType(null);
    setPhase("uploading");

    let uploadedDoc: ResumeDocument;
    try {
      uploadedDoc = await api.uploadResume(file, token);
      setActiveResume(uploadedDoc);
      toast.info("Resume uploaded. Extracting skills...");
      setPhase("reading");
    } catch (caught) {
      setPhase("error");
      setErrorType("upload");
      const msg = caught instanceof ApiError ? caught.detail : "Upload failed. Please check network.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    let parsedDoc: ResumeDocument;
    try {
      setPhase("discovering");
      parsedDoc = await api.parseResume(uploadedDoc.id, token);
      setActiveResume(parsedDoc);
      setPhase("categorizing");
    } catch (caught) {
      setPhase("error");
      setErrorType("parse");
      const msg = caught instanceof ApiError ? caught.detail : "Resume analysis failed.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (parsedDoc.parse_status === "unsupported" || parsedDoc.parse_status === "failed") {
      setPhase("error");
      setErrorType("parse");
      setErrorMessage(parsedDoc.safe_error_message || "This resume could not be analyzed safely.");
      return;
    }

    if (parsedDoc.skills_status !== "ready") {
      setPhase("discovering");
      const outcome = await waitForExtraction(parsedDoc.id);
      if (outcome !== "ready") {
        setPhase(outcome === "partial_failure" ? "partial_failure" : outcome === "failed" ? "error" : "discovering");
        setErrorType(outcome === "failed" ? "extraction" : null);
        setErrorMessage(
          outcome === "failed"
            ? "Your file is safe. Retry when the extraction service is available."
            : "Your resume is still processing. It has not yet updated your passport."
        );
        toast.info(outcome === "partial_failure" ? "Some resume evidence could not be processed." : "Resume uploaded; skill extraction is still processing.");
        return;
      }
    }

    try {
      setPhase("building_passport");
      const activeDoc = await api.activateResume(parsedDoc.id, token);
      setActiveResume(activeDoc);
      setPhase("complete");
      setIsReplacing(false);
      toast.success("Skill Passport successfully updated with verified resume claims!");
      onChanged();
    } catch (caught) {
      setPhase("error");
      setErrorType("activate");
      const msg = caught instanceof ApiError ? caught.detail : "Passport update failed.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  async function retryAnalysis() {
    if (!activeResume) return;
    setIsReanalyzing(true);
    setErrorMessage(null);
    setErrorType(null);
    setPhase("discovering");

    try {
      const parsed = await api.parseResume(activeResume.id, token);
      setActiveResume(parsed);
      setPhase("categorizing");

      if (parsed.skills_status !== "ready") {
        setPhase("discovering");
        const outcome = await waitForExtraction(parsed.id);
        if (outcome !== "ready") {
          setPhase(outcome === "partial_failure" ? "partial_failure" : outcome === "failed" ? "error" : "discovering");
          setErrorType(outcome === "failed" ? "extraction" : null);
          setErrorMessage("Re-analysis is still processing. Your passport has not been updated yet.");
          toast.info("Resume re-analysis has not reached a ready state yet.");
          return;
        }
      }

      const activated = await api.activateResume(parsed.id, token);
      setActiveResume(activated);
      setPhase("complete");
      toast.success("Resume analysis successfully completed!");
      onChanged();
    } catch (caught) {
      setPhase("error");
      setErrorType("parse");
      const msg = caught instanceof ApiError ? caught.detail : "Re-analysis failed.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsReanalyzing(false);
    }
  }

  async function retryFailedItems() {
    if (!activeResume) return;
    setIsRetryingFailed(true);
    setErrorMessage(null);
    try {
      const updated = await api.retryFailedResume(activeResume.id, token);
      setActiveResume(updated);
      toast.info("Retrying pending skill extraction items...");
      setPhase("discovering");
      const outcome = await waitForExtraction(updated.id);
      if (outcome === "ready") {
        const activated = await api.activateResume(updated.id, token);
        setActiveResume(activated);
        setPhase("complete");
        toast.success("Remaining resume evidence processed successfully!");
        onChanged();
      } else if (outcome === "partial_failure") {
        setPhase("partial_failure");
        toast.info("Some resume evidence still could not be processed.");
      } else if (outcome === "failed") {
        setPhase("error");
        setErrorType("extraction");
        setErrorMessage("Your file is safe. Retry when the extraction service is available.");
      } else {
        setPhase("discovering");
        setErrorMessage("Your resume is still processing. Check back shortly.");
      }
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Could not retry failed items.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsRetryingFailed(false);
    }
  }

  async function retryPassportUpdate() {
    if (!activeResume) return;
    if (activeResume.skills_status !== "ready") {
      setPhase("discovering");
      setErrorMessage("Skill extraction is still processing. Passport activation is not available yet.");
      return;
    }
    setErrorMessage(null);
    setErrorType(null);
    try {
      const activeDoc = await api.activateResume(activeResume.id, token);
      setActiveResume(activeDoc);
      setPhase("complete");
      toast.success("Passport successfully updated!");
      onChanged();
    } catch (caught) {
      setPhase("error");
      setErrorType("activate");
      const msg = caught instanceof ApiError ? caught.detail : "Passport update failed.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  async function handleDeleteResume() {
    if (!activeResume) return;
    setIsDeleting(true);
    try {
      await api.deleteResume(activeResume.id, token);
      toast.success("Resume removed from profile.");
      setActiveResume(null);
      setPhase("idle");
      setIsReplacing(false);
      await load();
      onChanged();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Failed to delete resume.");
    } finally {
      setIsDeleting(false);
    }
  }

  const categorizedSkills = useMemo(() => {
    if (!activeResume?.parsed_summary?.explicit_technical_skills) return {};
    const groups: Record<string, string[]> = {};
    activeResume.parsed_summary.explicit_technical_skills.forEach((skill) => {
      const cat = getSkillCategory(skill);
      if (!groups[cat]) groups[cat] = [];
      if (!groups[cat].includes(skill)) groups[cat].push(skill);
    });
    return groups;
  }, [activeResume]);

  const allExtractedSkills = useMemo(() => {
    return activeResume?.parsed_summary?.explicit_technical_skills || [];
  }, [activeResume]);

  const topSkills = useMemo(() => {
    return allExtractedSkills.slice(0, 8);
  }, [allExtractedSkills]);

  const remainingSkillsCount = Math.max(0, allExtractedSkills.length - topSkills.length);

  const parsedSummary: ResumeParsedData | null = activeResume?.parsed_summary || null;
  const projectCount = parsedSummary?.projects?.length || 0;
  const certCount = parsedSummary?.certifications?.length || 0;
  const achievementCount = parsedSummary?.achievements?.length || 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      void processResumeFile(droppedFile);
    }
  };

  const isProcessing =
    phase === "uploading" ||
    phase === "reading" ||
    phase === "discovering" ||
    phase === "categorizing" ||
    phase === "building_passport";

  return (
    <section className="border border-white/10 bg-[#061524] p-6 rounded-md text-white font-sans space-y-6">
      {/* Header Bar */}
      <div className="border-b border-white/10 pb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-normal text-white flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <FileText className="h-4 w-4 text-white/80" />
            <span>Resume Intelligence</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Turn your resume into evidence-backed skills with automatic cryptographic verification.
          </p>
        </div>

        {activeResume && phase === "complete" && !isReplacing && (
          <span className="font-mono text-xs uppercase tracking-wider text-white border border-white/20 px-2.5 py-0.5 rounded-xs flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-white" />
            <span>Active Resume</span>
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        aria-label="Resume file"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) void processResumeFile(selected);
        }}
        className="hidden"
      />

      <div className="min-h-[160px] flex flex-col justify-center">
        <AnimatePresence initial={false}>
          {/* 1. EMPTY / UPLOAD DROPZONE */}
          {(phase === "idle" || isReplacing) && (
            <motion.div
              key="empty-dropzone"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed p-8 rounded-md flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragOver
                  ? "border-white bg-white/5"
                  : "border-white/20 bg-white/[0.02] hover:border-white/40 hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white mb-3">
                <Upload className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-white">
                Drag & drop your resume here, or <span className="underline underline-offset-4">choose a file</span>
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Supports text-based <span className="text-neutral-300">PDF</span> and <span className="text-neutral-300">DOCX</span> documents (up to 10MB)
              </p>

              {isReplacing && activeResume && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReplacing(false);
                    setPhase("complete");
                  }}
                  className="mt-4 font-mono text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel replace
                </button>
              )}
            </motion.div>
          )}

          {/* 2. PROCESSING STATE */}
          {isProcessing && (
            <motion.div
              key="processing-state"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="border border-white/15 bg-white/[0.03] p-6 rounded-md space-y-4 font-mono text-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-white" />
                  <span className="text-white truncate">
                    {currentFileName || activeResume?.original_filename || "Resume Document"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  <span>Analyzing</span>
                </div>
              </div>

              <div className="space-y-1.5 text-neutral-300">
                <p>
                  {phase === "uploading" && "01 / Uploading document..."}
                  {phase === "reading" && "02 / Reading document structure..."}
                  {phase === "discovering" && "03 / Extracting technical claims and spans..."}
                  {phase === "categorizing" && "04 / Normalizing into canonical taxonomy..."}
                  {phase === "building_passport" && "05 / Generating cryptographic Skill Passport..."}
                </p>
              </div>

              <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                <motion.div
                  className="bg-white h-full"
                  initial={{ width: "20%" }}
                  animate={{
                    width:
                      phase === "uploading"
                        ? "35%"
                        : phase === "reading"
                        ? "60%"
                        : phase === "discovering"
                        ? "80%"
                        : "95%",
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {errorMessage && phase === "discovering" && (
                <p className="text-red-400">{errorMessage}</p>
              )}
            </motion.div>
          )}

          {/* PARTIAL FAILURE STATE */}
          {phase === "partial_failure" && activeResume && (
            <motion.div
              key="partial-failure-state"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              className="border border-white/15 bg-white/[0.03] p-5 rounded-md space-y-3 font-mono text-xs"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-white mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">Resume partially analyzed</p>
                  <p className="text-neutral-300">
                    {activeResume.completed_jobs} of {activeResume.total_jobs} evidence items processed successfully.
                  </p>
                  <p className="text-neutral-400">
                    {activeResume.failed_jobs} items could not be processed because the extraction service was temporarily unavailable.
                  </p>
                  {errorMessage && <p className="text-red-400">{errorMessage}</p>}
                </div>
              </div>
              <button
                type="button"
                disabled={isRetryingFailed}
                onClick={() => void retryFailedItems()}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/20 bg-white/10 text-white font-mono text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isRetryingFailed ? "animate-spin" : ""}`} />
                <span>{isRetryingFailed ? "Retrying..." : "Retry failed items"}</span>
              </button>
            </motion.div>
          )}

          {/* 3. COMPLETE / VERIFIED STATE */}
          {phase === "complete" && activeResume && !isReplacing && (
            <motion.div
              key="complete-state"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Document Banner */}
              <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileCheck className="h-5 w-5 text-white/80 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {activeResume.original_filename}
                    </p>
                    <p className="font-mono text-xs text-neutral-400 mt-0.5">
                      {(activeResume.size_bytes / 1024).toFixed(1)} KB · Verified via {activeResume.parser_version}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReplacing(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.03] text-xs font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => void handleDeleteResume()}
                    className="p-1.5 rounded-full border border-white/10 text-neutral-400 hover:text-red-400 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-50"
                    title="Remove resume"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="border border-white/10 bg-white/[0.02] p-3 text-center rounded-sm">
                  <p className="text-2xl font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {allExtractedSkills.length}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400 mt-0.5">
                    Skills Extracted
                  </p>
                </div>

                <div className="border border-white/10 bg-white/[0.02] p-3 text-center rounded-sm">
                  <p className="text-2xl font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {activeResume.generated_evidence_count}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400 mt-0.5">
                    Evidence Records
                  </p>
                </div>

                <div className="border border-white/10 bg-white/[0.02] p-3 text-center rounded-sm">
                  <p className="text-2xl font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
                    {Object.keys(categorizedSkills).length}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-neutral-400 mt-0.5">
                    Categories
                  </p>
                </div>
              </div>

              {/* Categorized Skills View */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                    Extracted Competencies
                  </span>
                  {allExtractedSkills.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowAllSkills((prev) => !prev)}
                      className="font-mono text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showAllSkills ? "Show top skills" : `View all (${allExtractedSkills.length})`}</span>
                      {showAllSkills ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}
                </div>

                {showAllSkills ? (
                  <div className="space-y-3 pt-1 max-h-56 overflow-y-auto pr-1">
                    {Object.entries(categorizedSkills).map(([catName, skills]) => (
                      <div
                        key={catName}
                        className="border border-white/10 bg-white/[0.02] p-3 rounded-sm space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-mono text-neutral-300">
                          <span className="flex items-center gap-1.5 uppercase tracking-wider">
                            {getCategoryIcon(catName)}
                            <span>{catName}</span>
                          </span>
                          <span className="text-neutral-400">
                            {skills.length} {skills.length === 1 ? "skill" : "skills"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {skills.map((skill) => (
                            <span
                              key={skill}
                              className="font-mono text-xs border border-white/15 bg-white/5 px-2 py-0.5 rounded-xs text-white"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {topSkills.map((skill) => (
                      <span
                        key={skill}
                        className="font-mono text-xs border border-white/15 bg-white/5 px-2 py-0.5 rounded-xs text-white"
                      >
                        {skill}
                      </span>
                    ))}
                    {remainingSkillsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllSkills(true)}
                        className="font-mono text-xs border border-white/10 bg-white/[0.02] px-2 py-0.5 rounded-xs text-neutral-400 hover:text-white cursor-pointer"
                      >
                        +{remainingSkillsCount} more
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Claims & Projects Accordion */}
              {(projectCount > 0 || certCount > 0 || achievementCount > 0) && (
                <div className="border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowExtractedDetails((prev) => !prev)}
                    className="w-full flex items-center justify-between text-xs font-mono text-neutral-400 hover:text-white py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 uppercase">
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>Extracted Claims ({projectCount + certCount + achievementCount})</span>
                    </span>
                    {showExtractedDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {showExtractedDetails && parsedSummary && (
                    <div className="space-y-2 pt-2 text-xs text-neutral-300 max-h-40 overflow-y-auto">
                      {parsedSummary.projects?.map((proj, i) => (
                        <div key={i} className="border border-white/5 bg-white/[0.02] p-2.5 rounded-sm">
                          <p className="font-medium text-white">{proj.title}</p>
                          <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-2">{proj.description}</p>
                        </div>
                      ))}
                      {parsedSummary.certifications?.map((cert, i) => (
                        <div key={i} className="border border-white/5 bg-white/[0.02] p-2.5 rounded-sm">
                          <p className="font-medium text-white">{cert.name}</p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{cert.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* 4. ERROR STATE */}
          {phase === "error" && (
            <motion.div
              key="error-state"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              className="border border-red-500/30 bg-red-950/20 p-5 rounded-md space-y-4 text-center font-sans"
            >
              <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full border border-red-500/40 bg-red-900/30 text-red-300">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {errorType === "upload" && "Resume upload failed"}
                  {errorType === "parse" && "We couldn't fully analyze this resume"}
                  {errorType === "extraction" && "We couldn't finish analyzing your resume"}
                  {errorType === "activate" && "Skill Passport update pending"}
                  {!errorType && "Resume analysis notice"}
                </p>
                <p className="text-xs text-red-300 mt-1 max-w-md mx-auto">
                  {errorMessage || "An unexpected error occurred during processing."}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {errorType === "upload" && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-red-500/40 bg-red-900/30 text-white text-xs font-mono transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Retry Upload</span>
                  </button>
                )}

                {errorType === "parse" && (
                  <>
                    <button
                      type="button"
                      disabled={isReanalyzing}
                      onClick={() => void retryAnalysis()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-white text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isReanalyzing ? "animate-spin" : ""}`} />
                      <span>{isReanalyzing ? "Analyzing..." : "Retry Analysis"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 bg-white/[0.02] text-xs font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Upload different file</span>
                    </button>
                  </>
                )}

                {errorType === "extraction" && (
                  <button
                    type="button"
                    disabled={isRetryingFailed}
                    onClick={() => void retryFailedItems()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-white text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRetryingFailed ? "animate-spin" : ""}`} />
                    <span>{isRetryingFailed ? "Retrying..." : "Retry analysis"}</span>
                  </button>
                )}

                {errorType === "activate" && (
                  <button
                    type="button"
                    onClick={() => void retryPassportUpdate()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/20 bg-white/10 text-white text-xs font-mono transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Retry Passport Update</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="border-t border-white/10 pt-3 flex items-center justify-between font-mono text-[10px] text-neutral-400">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-white/80" />
          <span>Deterministic provenance · Protected attributes never extracted</span>
        </span>
      </div>
    </section>
  );
}
