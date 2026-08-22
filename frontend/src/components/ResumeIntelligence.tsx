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
  Sparkles,
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
  | "complete"
  | "error";

// Common category mapping helper based on skill names
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
      return <Code2 className="h-3.5 w-3.5 text-indigo-400" />;
    case "Frontend":
      return <Layers className="h-3.5 w-3.5 text-cyan-400" />;
    case "Backend":
      return <Terminal className="h-3.5 w-3.5 text-emerald-400" />;
    case "Databases":
      return <Database className="h-3.5 w-3.5 text-amber-400" />;
    case "Cloud & DevOps":
      return <Cloud className="h-3.5 w-3.5 text-sky-400" />;
    case "AI & Machine Learning":
      return <Cpu className="h-3.5 w-3.5 text-purple-400" />;
    default:
      return <Sparkles className="h-3.5 w-3.5 text-blue-400" />;
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
  const [errorType, setErrorType] = useState<"upload" | "parse" | "activate" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [showExtractedDetails, setShowExtractedDetails] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);

  // Polling tracker
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
        if (
          (active.parse_status === "completed" || active.parse_status === "parsed") &&
          active.skills_status === "ready"
        ) {
          setPhase("complete");
        } else if (active.parse_status === "failed") {
          setPhase("error");
          setErrorMessage(active.safe_error_message || "Resume analysis encountered an error.");
          setErrorType("parse");
        } else if (active.parse_status === "unsupported") {
          setPhase("error");
          setErrorMessage(active.safe_error_message || "This resume format is unsupported or contains non-extractable text.");
          setErrorType("parse");
        } else if (active.parse_status === "parsing" || active.parse_status === "processing_skills") {
          setPhase("discovering");
        } else if (active.parse_status === "uploaded") {
          setPhase("reading");
        }
      } else {
        setPhase("idle");
      }
    } catch (caught) {
      setResumes([]);
      setErrorMessage(caught instanceof ApiError ? caught.detail : "Resumes could not be loaded.");
    }
  }, [token]);

  useEffect(() => {
    void load();
    return () => stopPolling();
  }, [load, stopPolling]);

  // Orchestrated upload and multi-stage automated processing
  async function processResumeFile(file: File) {
    if (!file) return;

    // Client-side file extension check
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "pdf" && ext !== "docx") {
      toast.error("Please upload a valid PDF or DOCX resume document.");
      return;
    }

    setIsReplacing(false);
    setCurrentFileName(file.name);
    setErrorMessage(null);
    setErrorType(null);
    setPhase("uploading");

    try {
      // 1. Upload
      const uploadedDoc = await api.uploadResume(file, token);
      setActiveResume(uploadedDoc);

      if (uploadedDoc.parse_status === "unsupported") {
        setPhase("error");
        setErrorMessage(uploadedDoc.safe_error_message || "Resume format is unsupported.");
        setErrorType("parse");
        toast.error("Resume unsupported.");
        await load();
        onChanged();
        return;
      }

      // 2. Reading phase
      setPhase("reading");

      // 3. Automated Parsing & Extraction
      let parsedDoc = uploadedDoc;
      if (uploadedDoc.parse_status !== "completed") {
        try {
          parsedDoc = await api.parseResume(uploadedDoc.id, token);
          setActiveResume(parsedDoc);
        } catch (parseErr) {
          setPhase("error");
          setErrorType("parse");
          setErrorMessage(parseErr instanceof ApiError ? parseErr.detail : "Analysis failed.");
          toast.error("We couldn't fully analyze this resume.");
          return;
        }
      }

      // 4. Discovering & Categorizing skills
      setPhase("discovering");

      // Check if background worker is still processing skills
      if (parsedDoc.parse_status === "processing_skills" || parsedDoc.skills_status === "extracting") {
        // Poll status until completed or terminal
        const outcome = await new Promise<"ready" | "failed" | "timeout" | "unavailable">((resolve) => {
          let attempts = 0;
          pollingRef.current = setInterval(async () => {
            attempts++;
            try {
              const res = await api.resumes(token);
              const latest = (res.items || []).find((r) => r.id === parsedDoc.id);
              if (latest) {
                setActiveResume(latest);
                if (latest.skills_status === "ready") {
                  stopPolling();
                  resolve("ready");
                } else if (latest.parse_status === "failed") {
                  stopPolling();
                  resolve("failed");
                } else if (attempts > 15) {
                  stopPolling();
                  resolve("timeout");
                }
              }
            } catch {
              stopPolling();
              resolve("unavailable");
            }
          }, 1200);
        });

        if (outcome !== "ready") {
          setPhase(outcome === "failed" ? "error" : "discovering");
          setErrorType(outcome === "failed" ? "parse" : null);
          setErrorMessage(
            outcome === "failed"
              ? "Resume skill extraction failed. You can retry the analysis."
              : "Your resume is still processing. Check back shortly; it has not yet updated your passport.",
          );
          if (outcome === "failed") {
            toast.error("Resume skill extraction failed.");
          } else {
            toast.info("Resume uploaded; skill extraction is still processing.");
          }
          await load();
          return;
        }
      } else if (parsedDoc.skills_status !== "ready") {
        setPhase("discovering");
        setErrorMessage("Your resume is still processing. It has not yet updated your passport.");
        return;
      }

      // 5. Automated Skill Passport Update (Internal Activation)
      setPhase("building_passport");
      try {
        await api.activateResume(uploadedDoc.id, token);
      } catch (caught) {
        setPhase("error");
        setErrorType("activate");
        setErrorMessage(caught instanceof ApiError ? caught.detail : "Passport update failed.");
        toast.error("Resume analysis finished, but the passport update failed.");
        return;
      }

      // 6. Complete
      setPhase("complete");
      toast.success("Resume analyzed and Skill Passport updated!");
      await load();
      onChanged();
    } catch (caught) {
      setPhase("error");
      setErrorType("upload");
      const msg = caught instanceof ApiError ? caught.detail : "Resume upload failed.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  // Retry failed parsing without re-upload
  async function retryAnalysis() {
    if (!activeResume) return;
    setIsReanalyzing(true);
    setErrorMessage(null);
    setErrorType(null);
    setPhase("reading");

    try {
      const parsedDoc = await api.parseResume(activeResume.id, token);
      setActiveResume(parsedDoc);
      setPhase("discovering");

      if (parsedDoc.skills_status !== "ready") {
        setErrorMessage("Re-analysis is still processing. Your passport has not been updated yet.");
        toast.info("Resume re-analysis is still processing.");
        return;
      }

      await api.activateResume(activeResume.id, token);
      setPhase("building_passport");
      await load();
      setPhase("complete");
      toast.success("Resume re-analyzed successfully!");
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

  // Retry passport update without re-upload or re-parsing
  async function retryPassportUpdate() {
    if (!activeResume) return;
    if (activeResume.skills_status !== "ready") {
      setPhase("discovering");
      setErrorMessage("Skill extraction is still processing. Passport activation is not available yet.");
      return;
    }
    setErrorMessage(null);
    setErrorType(null);
    setPhase("building_passport");

    try {
      await api.activateResume(activeResume.id, token);
      setPhase("complete");
      toast.success("Skill Passport updated!");
      await load();
      onChanged();
    } catch (caught) {
      setPhase("error");
      setErrorType("activate");
      const msg = caught instanceof ApiError ? caught.detail : "Passport update failed.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  // Safe delete resume
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

  // Group real extracted skills into categories
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

  // Drag and drop handlers
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

  // Determine current active view state
  const isProcessing =
    phase === "uploading" ||
    phase === "reading" ||
    phase === "discovering" ||
    phase === "categorizing" ||
    phase === "building_passport";

  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white/90 dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm text-slate-900 dark:text-[#f1f0e8] flex flex-col justify-between transition-all duration-300 relative overflow-hidden">
      {/* Ambient background glow for active/complete states */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3.5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
            <FileText className="h-4.5 w-4.5 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>Resume Intelligence</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
            Turn your resume into evidence-backed skills with automatic cryptographic verification.
          </p>
        </div>

        {activeResume && phase === "complete" && !isReplacing && (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 border border-emerald-200/80 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 font-sans shadow-xs">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span>Active Resume</span>
            </span>
          </div>
        )}
      </div>

      {/* Hidden File Input for Clean File Selection */}
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

      {/* Main Dynamic Stateful Content Area */}
      <div className="my-auto py-4 min-h-[220px] flex flex-col justify-center">
        <AnimatePresence initial={false}>
          {/* 1. EMPTY / UPLOAD DROPZONE STATE */}
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
              className={`group relative rounded-xl border-2 border-dashed transition-all duration-300 p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer ${
                isDragOver
                  ? "border-[#4f46e5] bg-indigo-50/50 dark:bg-indigo-950/30 scale-[0.99]"
                  : "border-slate-300/80 dark:border-white/10 bg-slate-50/40 dark:bg-[#151e29]/40 hover:border-[#4f46e5]/60 hover:bg-slate-50/80 dark:hover:bg-[#182337]/60"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100/80 dark:bg-indigo-950/80 text-[#4f46e5] dark:text-[#93c5fd] shadow-sm mb-3 group-hover:scale-110 group-hover:shadow-indigo-500/20 transition-all duration-300">
                <Upload className="h-5 w-5" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-[#f1f0e8] font-sans">
                Drag & drop your resume here, or <span className="text-[#3b71d9] dark:text-[#93c5fd] underline underline-offset-2">choose a file</span>
              </p>
              <p className="text-xs text-slate-500 dark:text-[#8ea2c6] mt-1 font-sans">
                Supports text-based <span className="font-semibold">PDF</span> and <span className="font-semibold">DOCX</span> documents (up to 10MB)
              </p>

              <div className="flex items-center gap-2 mt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                  PDF
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400">
                  DOCX
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                  Zero-Effort Auto-Sync
                </span>
              </div>

              {isReplacing && activeResume && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReplacing(false);
                    setPhase("complete");
                  }}
                  className="mt-4 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  Cancel replace
                </button>
              )}
            </motion.div>
          )}

          {/* 2. ACTIVE PROCESSING STATE (Reading, Discovering, Categorizing, Building) */}
          {isProcessing && (
            <motion.div
              key="processing-state"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 bg-gradient-to-b from-indigo-50/40 to-slate-50/50 dark:from-[#131a27]/90 dark:to-[#111821]/90 p-5 sm:p-6 space-y-5"
            >
              {/* Filename & Progress Pulse Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950 text-[#4f46e5] dark:text-[#93c5fd]">
                    <FileText className="h-4 w-4 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {currentFileName || activeResume?.original_filename || "Resume Document"}
                    </p>
                    <p className="text-[11px] text-indigo-600 dark:text-[#93c5fd] font-medium">
                      {phase === "uploading" && "Uploading document safely..."}
                      {phase === "reading" && "Reading and understanding structure..."}
                      {phase === "discovering" && "Identifying evidence & extracting claims..."}
                      {phase === "categorizing" && "Organizing competencies..."}
                      {phase === "building_passport" && "Updating verified Skill Passport..."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-2 w-2 rounded-full bg-[#4f46e5] dark:bg-[#38bdf8] animate-ping" />
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-[#38bdf8] uppercase tracking-wider">
                    Analyzing
                  </span>
                </div>
              </div>

              {/* Animated Laser Scanning Shimmer Container */}
              <div className="relative rounded-lg overflow-hidden border border-slate-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-[#151e29]/70 p-4">
                {!prefersReducedMotion && (
                  <motion.div
                    initial={{ top: "-10%" }}
                    animate={{ top: "110%" }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: "linear" }}
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#4f46e5] dark:via-[#38bdf8] to-transparent shadow-[0_0_12px_rgba(56,189,248,0.8)] pointer-events-none z-10"
                  />
                )}

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">
                      ✓
                    </span>
                    <span>Document integrity verified</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {phase === "uploading" || phase === "reading" ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-white text-[10px] animate-spin">
                        •
                      </span>
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">
                        ✓
                      </span>
                    )}
                    <span>Technical text & provenance extracted</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {phase === "building_passport" ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-white text-[10px] animate-spin">
                        •
                      </span>
                    ) : (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 dark:bg-slate-700 text-transparent text-[10px]">
                        •
                      </span>
                    )}
                    <span>Skill Passport record generation</span>
                  </div>
                </div>
              </div>

              {/* Progress Line */}
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <motion.div
                  className="bg-gradient-to-r from-[#4f46e5] to-[#38bdf8] h-full"
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
              {/* Document Banner Card */}
              <div className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-[#151e29]/70 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100/80 dark:bg-indigo-950/80 text-[#4f46e5] dark:text-[#93c5fd] shadow-xs">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {activeResume.original_filename}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] mt-0.5">
                      {(activeResume.size_bytes / 1024).toFixed(1)} KB &middot; Verified via {activeResume.parser_version}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReplacing(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111821] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1a2432] transition-colors cursor-pointer"
                  >
                    <Upload className="h-3 w-3" />
                    <span>Replace</span>
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => void handleDeleteResume()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer disabled:opacity-50"
                    title="Remove resume"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Discovered Real Metrics Row */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-[#151e29]/40 p-3 text-center">
                  <p className="text-lg sm:text-xl font-extrabold text-[#4f46e5] dark:text-[#93c5fd]">
                    {allExtractedSkills.length}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8ea2c6] mt-0.5">
                    Skills Extracted
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-[#151e29]/40 p-3 text-center">
                  <p className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                    {activeResume.generated_evidence_count}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8ea2c6] mt-0.5">
                    Evidence Records
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-[#151e29]/40 p-3 text-center">
                  <p className="text-lg sm:text-xl font-extrabold text-sky-600 dark:text-sky-400">
                    {Object.keys(categorizedSkills).length}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8ea2c6] mt-0.5">
                    Categories
                  </p>
                </div>
              </div>

              {/* Categorized Skills / Top Skills Preview */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Extracted Competencies
                  </span>
                  {allExtractedSkills.length > 8 && (
                    <button
                      type="button"
                      onClick={() => setShowAllSkills((prev) => !prev)}
                      className="text-xs font-semibold text-[#3b71d9] dark:text-[#93c5fd] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showAllSkills ? "Show top skills" : `View all (${allExtractedSkills.length})`}</span>
                      {showAllSkills ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  )}
                </div>

                {showAllSkills ? (
                  /* Full Categorized View */
                  <div className="space-y-3 pt-1 max-h-56 overflow-y-auto pr-1">
                    {Object.entries(categorizedSkills).map(([catName, skills], idx) => (
                      <motion.div
                        key={catName}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="rounded-lg border border-slate-200/60 dark:border-white/[0.06] bg-white/40 dark:bg-[#131a27]/60 p-2.5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                          <span className="flex items-center gap-1.5">
                            {getCategoryIcon(catName)}
                            <span>{catName}</span>
                          </span>
                          <span className="text-[10px] font-normal text-slate-400">
                            {skills.length} {skills.length === 1 ? "skill" : "skills"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {skills.map((skill) => (
                            <span
                              key={skill}
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-200/50 dark:border-indigo-800/40 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-[#93c5fd]"
                            >
                              <span>{skill}</span>
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  /* Compact Top Skills Chips */
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {topSkills.map((skill, idx) => (
                      <motion.span
                        key={skill}
                        initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-[#93c5fd] shadow-2xs"
                      >
                        <span>{skill}</span>
                      </motion.span>
                    ))}
                    {remainingSkillsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllSkills(true)}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <span>+{remainingSkillsCount} more</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Real Evidence Details Accordion (Projects & Certifications) */}
              {(projectCount > 0 || certCount > 0 || achievementCount > 0) && (
                <div className="border-t border-slate-100 dark:border-white/[0.06] pt-2">
                  <button
                    type="button"
                    onClick={() => setShowExtractedDetails((prev) => !prev)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-[#8ea2c6] hover:text-slate-800 dark:hover:text-white py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>Extracted Experience & Claims ({projectCount + certCount + achievementCount})</span>
                    </span>
                    {showExtractedDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {showExtractedDetails && parsedSummary && (
                    <div className="space-y-2 pt-2 text-xs text-slate-600 dark:text-[#98a4b3] max-h-40 overflow-y-auto">
                      {parsedSummary.projects?.map((proj, i) => (
                        <div key={i} className="rounded-lg bg-slate-50 dark:bg-[#151e29] p-2 border border-slate-200/60 dark:border-white/[0.06]">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{proj.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{proj.description}</p>
                        </div>
                      ))}
                      {parsedSummary.certifications?.map((cert, i) => (
                        <div key={i} className="rounded-lg bg-slate-50 dark:bg-[#151e29] p-2 border border-slate-200/60 dark:border-white/[0.06]">
                          <p className="font-bold text-slate-800 dark:text-slate-200">{cert.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{cert.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* 4. ERROR & ACTIONABLE RETRY STATE */}
          {phase === "error" && (
            <motion.div
              key="error-state"
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              className="rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-5 space-y-4 text-center"
            >
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  {errorType === "upload" && "Resume upload failed"}
                  {errorType === "parse" && "We couldn't fully analyze this resume"}
                  {errorType === "activate" && "Skill Passport update pending"}
                  {!errorType && "Resume analysis notice"}
                </p>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 max-w-md mx-auto">
                  {errorMessage || "An unexpected error occurred during processing."}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {errorType === "upload" && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
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
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3b71d9] hover:bg-[#2563eb] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isReanalyzing ? "animate-spin" : ""}`} />
                      <span>{isReanalyzing ? "Analyzing..." : "Retry Analysis"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111821] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <span>Upload different file</span>
                    </button>
                  </>
                )}

                {errorType === "activate" && (
                  <button
                    type="button"
                    onClick={() => void retryPassportUpdate()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3b71d9] hover:bg-[#2563eb] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
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

      {/* Footer Helper Note */}
      <div className="border-t border-slate-100 dark:border-white/[0.06] pt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8ea2c6]">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span>Deterministic provenance &bull; Protected attributes never extracted</span>
        </span>
      </div>
    </section>
  );
}
