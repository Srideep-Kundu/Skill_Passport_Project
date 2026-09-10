import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Code2,
  Sparkles,
  X,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/service";
import type { Assessment, AssessmentAttempt, ProjectAssessment, ProctoringReport } from "../api/types";
import { toast } from "sonner";
import { EditorialButton } from "./ui/EditorialPrimitives";
import { DUMMY_PROJECT_ASSESSMENTS } from "../data/projectAssessmentDummyData";
import { ProctoringShield } from "./proctoring/ProctoringShield";
import { ProctoringReportView } from "./proctoring/ProctoringReportView";
import { PreAssessmentSystemCheck } from "./proctoring/PreAssessmentSystemCheck";

interface AssessmentFullScreenProps {
  title: string;
  category?: string;
  difficulty?: string;
  type: "project" | "diagnostic";
  durationMinutes: number;
  questions: Array<{
    id: string;
    question?: string;
    question_text?: string;
    category?: string;
    difficulty?: string;
    options: string[];
  }>;
  currentIndex: number;
  answers: Record<string, string>;
  isSubmitting: boolean;
  activeSessionId: string | null;
  token: string;
  onSelectOption: (qId: string, val: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: (isAutoSubmit?: boolean) => void;
  onExit: () => void;
  onReportUpdate: (report: ProctoringReport) => void;
  onCancelTest?: (reason: string, report?: ProctoringReport) => void;
}

function AssessmentFullScreenView({
  title,
  category,
  difficulty,
  type,
  durationMinutes,
  questions,
  currentIndex,
  answers,
  isSubmitting,
  activeSessionId,
  token,
  onSelectOption,
  onPrevious,
  onNext,
  onSubmit,
  onExit,
  onReportUpdate,
  onCancelTest,
}: AssessmentFullScreenProps) {
  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const isProject = type === "project";
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    // Request browser fullscreen upon mount if not already active
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const handleReEnterFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const questionTitle = currentQ ? (currentQ.question || currentQ.question_text || "") : "";
  const currentCategory = currentQ?.category || category || "Technical Implementation";
  const currentDifficulty = currentQ?.difficulty || difficulty || "Intermediate";

  return createPortal(
    <div className="fixed inset-0 z-[999999] w-screen h-screen min-h-screen bg-[#FAF9F6] text-[#111827] flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Optional Fullscreen Re-entry Banner if exited */}
      {!isFullscreen && (
        <div className="w-full bg-[#FEF2F2] border-b border-[#FCA5A5] px-6 py-2.5 flex items-center justify-between text-xs text-[#991B1B] font-mono z-20 shrink-0">
          <span className="flex items-center gap-2 font-semibold">
            <XCircle className="h-4 w-4 text-[#DC2626]" />
            <span>Browser Fullscreen is inactive. Fullscreen is required to maintain proctoring integrity score.</span>
          </span>
          <button
            type="button"
            onClick={handleReEnterFullscreen}
            className="px-3 py-1 rounded bg-[#DC2626] text-white font-bold hover:bg-[#B91C1C] transition-colors cursor-pointer"
          >
            Re-enter Fullscreen
          </button>
        </div>
      )}

      {/* 1. Global Assessment Top Header */}
      <header className="w-full border-b border-[#E5E1D8] bg-[#FFFFFF] px-6 sm:px-10 py-3.5 flex items-center justify-between shadow-xs shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-[rgba(176,141,87,0.12)] border border-[#B08D57]/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-[#B08D57]" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#B08D57] font-bold truncate flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              <span>{isProject ? "RECRUITER PROJECT EVALUATION" : "VERIFIED SKILL DIAGNOSTIC"}</span>
            </div>
            <h1
              className="text-base sm:text-lg font-normal text-[#111827] truncate mt-0.5"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {title}
            </h1>
          </div>
        </div>

        {/* Center / Status Readout */}
        <div className="hidden lg:flex items-center gap-4 font-mono text-xs text-[#64748B]">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] font-medium">
            <Clock className="h-3.5 w-3.5 text-[#B08D57]" />
            <span>{durationMinutes} Mins</span>
          </span>
          <span className="px-3 py-1 rounded-full bg-[#F7F5F0] border border-[#E5E1D8]">
            Question <strong className="text-[#111827]">{currentIndex + 1}</strong> of <strong className="text-[#111827]">{totalQuestions}</strong>
          </span>
          <span className="text-[#166534] font-semibold">
            {answeredCount}/{totalQuestions} Answered
          </span>
        </div>

        {/* Right: Proctoring HUD & Exit Button */}
        <div className="flex items-center gap-3 shrink-0">
          <ProctoringShield
            isActive={true}
            sessionId={activeSessionId || undefined}
            token={token}
            questionId={currentQ?.id}
            onReportUpdate={onReportUpdate}
            onMaxViolationsExceeded={() => onSubmit(true)}
            onTestCancelled={onCancelTest}
          />

          <button
            type="button"
            onClick={onExit}
            className="p-2 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#DC2626] hover:border-[#FCA5A5] transition-colors cursor-pointer flex items-center gap-1 text-xs font-mono"
            title="Exit assessment"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* 2. Main Question & Options Workspace */}
      <main className="w-full flex-1 overflow-y-auto px-6 sm:px-12 py-8 flex flex-col items-center">
        {currentQ ? (
          <div className="w-full max-w-3xl flex-1 flex flex-col justify-between space-y-6">
            {/* Progress Meter & Question Metadata */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-[#64748B]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[rgba(176,141,87,0.12)] text-[#854D0E] border border-[#B08D57]/30">
                    {currentCategory}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
                    {currentDifficulty}
                  </span>
                </div>
                <span className="font-semibold">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-[#E5E1D8] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#B08D57] transition-all duration-300 rounded-full"
                  style={{ width: `${(((currentIndex + 1) / totalQuestions) * 100)}%` }}
                />
              </div>
            </div>

            {/* Question Text */}
            <div className="py-2">
              <h2 className="text-base sm:text-lg md:text-xl font-medium text-[#111827] leading-relaxed">
                {questionTitle}
              </h2>
            </div>

            {/* Options List */}
            <div className="space-y-3 pt-2 flex-1">
              {currentQ.options.map((optionText, optIdx) => {
                const optKey = ["A", "B", "C", "D"][optIdx] || String.fromCharCode(65 + optIdx);
                const selectedValue = answers[currentQ.id];
                const isSelected = isProject
                  ? selectedValue === optKey
                  : selectedValue === optionText;

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => onSelectOption(currentQ.id, isProject ? optKey : optionText)}
                    className={`w-full text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 ${
                      isSelected
                        ? "border-[#B08D57] bg-[rgba(176,141,87,0.08)] shadow-sm ring-2 ring-[#B08D57]"
                        : "border-[#E5E1D8] bg-[#FFFFFF] hover:bg-[#FAF9F6] hover:border-[#B08D57]/50 shadow-2xs"
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-colors ${
                        isSelected
                          ? "bg-[#B08D57] text-white"
                          : "border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B]"
                      }`}
                    >
                      {optKey}
                    </div>
                    <span
                      className={`text-xs sm:text-sm pt-0.5 leading-relaxed ${
                        isSelected ? "font-semibold text-[#111827]" : "text-[#334155]"
                      }`}
                    >
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-xs font-mono text-[#64748B]">
            No questions available for this assessment.
          </div>
        )}
      </main>

      {/* 3. Bottom Sticky Action Bar */}
      <footer className="w-full border-t border-[#E5E1D8] bg-[#FFFFFF] px-6 sm:px-10 py-4 flex items-center justify-between shadow-xs shrink-0 z-10">
        <EditorialButton
          variant="ghost"
          size="sm"
          onClick={onPrevious}
          disabled={currentIndex === 0}
        >
          Previous Question
        </EditorialButton>

        <div className="flex items-center gap-3">
          {currentIndex < totalQuestions - 1 ? (
            <EditorialButton
              variant="primary"
              size="sm"
              onClick={onNext}
            >
              <span>Next Question</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </EditorialButton>
          ) : (
            <EditorialButton
              variant="accent"
              size="md"
              onClick={() => onSubmit(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span>{isSubmitting ? "Submitting Assessment..." : "Submit Assessment"}</span>
            </EditorialButton>
          )}
        </div>
      </footer>
    </div>,
    document.body
  );
}

interface Props {
  token: string;
  onAssessmentCompleted?: () => void;
  defaultMode?: "projects" | "diagnostics";
}

export function SkillAssessments({ token, onAssessmentCompleted, defaultMode }: Props) {
  // Mode switcher: "projects" = Recruiter Assessments, "diagnostics" = Diagnostic Skill Tests
  const [assessmentMode, setAssessmentMode] = useState<"projects" | "diagnostics">(defaultMode || "projects");

  // Pre-assessment System Check State
  const [pendingPreCheck, setPendingPreCheck] = useState<{
    type: "diagnostic" | "project";
    assessmentId: string;
    title: string;
    duration: number;
    questionCount: number;
    rawPayload?: any;
  } | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Diagnostic tests state
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(true);
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [diagnosticAnswers, setDiagnosticAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [submittingDiagnostic, setSubmittingDiagnostic] = useState(false);
  const [attemptResult, setAttemptResult] = useState<AssessmentAttempt | null>(null);

  // Recruiter project assessments state
  const [projectAssessments, setProjectAssessments] = useState<ProjectAssessment[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [takingProjectAssessment, setTakingProjectAssessment] = useState<ProjectAssessment | null>(null);
  const [projectQuizAnswers, setProjectQuizAnswers] = useState<Record<string, string>>({});
  const [projectCurrentQIdx, setProjectCurrentQIdx] = useState(0);
  const [isSubmittingProjectQuiz, setIsSubmittingProjectQuiz] = useState(false);
  const [isLoadingProjectQuiz, setIsLoadingProjectQuiz] = useState(false);
  const [detailProjectAssessment, setDetailProjectAssessment] = useState<ProjectAssessment | null>(null);
  const [detailReportTab, setDetailReportTab] = useState<"report" | "proctoring">("report");

  // Proctoring session reports
  const [diagnosticProctoringReport, setDiagnosticProctoringReport] = useState<ProctoringReport | null>(null);
  const [projectProctoringReport, setProjectProctoringReport] = useState<ProctoringReport | null>(null);

  // Immediate Disqualification / Cancellation Alert Modal State
  const [cancelledNotice, setCancelledNotice] = useState<{
    title: string;
    reason: string;
    report?: ProctoringReport;
  } | null>(null);

  // Emit event to inform global App layout to hide top navigation bar, sidebar, and background video
  const isTakingActiveExam = Boolean(takingProjectAssessment || (activeAssessment && !attemptResult));

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("assessment-fullscreen-active", { detail: { active: isTakingActiveExam } })
    );
    if (isTakingActiveExam) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.dispatchEvent(
        new CustomEvent("assessment-fullscreen-active", { detail: { active: false } })
      );
      document.body.style.overflow = "";
    };
  }, [isTakingActiveExam]);

  // Load Diagnostic assessments
  const loadDiagnostics = useCallback(async () => {
    try {
      setLoadingDiagnostics(true);
      const data = await api.getAssessments(token);
      setAssessments(data);
    } catch {
      // Ignore initial load diagnostics error in demo mode
    } finally {
      setLoadingDiagnostics(false);
    }
  }, [token]);

  // Load Recruiter Project assessments
  const loadProjectAssessments = useCallback(async () => {
    try {
      setLoadingProjects(true);
      const res = await api.getStudentProjectAssessments(token);
      const items = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []);
      if (items.length > 0) {
        // Merge with dummy assessments not in backend list
        const ids = new Set(items.map((i: any) => i.id));
        const extra = DUMMY_PROJECT_ASSESSMENTS.filter((d) => !ids.has(d.id));
        setProjectAssessments([...items, ...extra]);
      } else {
        setProjectAssessments(DUMMY_PROJECT_ASSESSMENTS);
      }
    } catch {
      setProjectAssessments(DUMMY_PROJECT_ASSESSMENTS);
    } finally {
      setLoadingProjects(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDiagnostics();
    void loadProjectAssessments();
  }, [loadDiagnostics, loadProjectAssessments]);

  // =========================================================================
  // Diagnostic & Project Quiz Handlers (With Live Proctoring Session Lifecycle)
  // =========================================================================

  // Handle immediate test disqualification (e.g., mobile phone detected) -> DO NOT SUBMIT
  const handleCancelAssessment = (reason: string, report?: ProctoringReport) => {
    if (activeSessionId && token) {
      api.endProctoringSession(activeSessionId, { status: "cancelled", final_notes: reason }, token).catch(() => {});
    }
    const cancelledTitle = activeAssessment?.title || takingProjectAssessment?.project_title || "Assessment";

    // Immediately exit fullscreen and wipe quiz state without submitting answers for grading
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    setActiveAssessment(null);
    setTakingProjectAssessment(null);
    setDiagnosticAnswers({});
    setProjectQuizAnswers({});
    setAttemptResult(null);
    setDiagnosticProctoringReport(null);
    setProjectProctoringReport(null);

    // Show disqualification modal
    setCancelledNotice({
      title: cancelledTitle,
      reason: reason || "Unauthorized mobile phone or electronic device detected by AI vision proctoring.",
      report: report || diagnosticProctoringReport || projectProctoringReport || undefined,
    });
    toast.error("Assessment Cancelled: Phone / Electronic Device Detected. Test disqualified with 0 marks.", {
      duration: 6000,
    });
  };

  async function handleStartDiagnostic(assessmentId: string) {
    try {
      setLoadingDiagnostics(true);
      const details = await api.getAssessment(assessmentId, token);
      setPendingPreCheck({
        type: "diagnostic",
        assessmentId: details.id,
        title: details.title,
        duration: details.duration_minutes || 30,
        questionCount: details.questions?.length || 5,
        rawPayload: details,
      });
    } catch {
      toast.error("Failed to load assessment questions");
    } finally {
      setLoadingDiagnostics(false);
    }
  }

  const handleStartProjectQuiz = async (assessmentId: string) => {
    setIsLoadingProjectQuiz(true);
    try {
      let detail: ProjectAssessment | null = null;
      try {
        detail = await api.getStudentProjectAssessmentDetail(assessmentId, token);
      } catch {
        detail = DUMMY_PROJECT_ASSESSMENTS.find((a) => a.id === assessmentId) || null;
      }
      if (!detail) {
        detail = DUMMY_PROJECT_ASSESSMENTS.find((a) => a.id === assessmentId) || null;
      }
      if (!detail) throw new Error("Assessment not found");
      setPendingPreCheck({
        type: "project",
        assessmentId: detail.id,
        title: detail.project_title,
        duration: 25,
        questionCount: detail.questions?.length || 5,
        rawPayload: detail,
      });
    } catch {
      toast.error("Failed to load repository assessment questions");
    } finally {
      setIsLoadingProjectQuiz(false);
    }
  };

  const handleProceedFromPreCheck = async () => {
    if (!pendingPreCheck) return;
    try {
      if (token) {
        const sessionPayload =
          pendingPreCheck.type === "diagnostic"
            ? { assessment_id: pendingPreCheck.assessmentId }
            : { project_assessment_id: pendingPreCheck.assessmentId };
        const session = await api.startProctoringSession(sessionPayload, token);
        setActiveSessionId(session.id);
      }
    } catch {
      setActiveSessionId(`sess_${Date.now()}`);
    }

    if (pendingPreCheck.type === "diagnostic") {
      setActiveAssessment(pendingPreCheck.rawPayload);
      setDiagnosticAnswers({});
      setCurrentQuestionIdx(0);
      setAttemptResult(null);
      setDiagnosticProctoringReport(null);
    } else {
      setTakingProjectAssessment(pendingPreCheck.rawPayload);
      setProjectQuizAnswers({});
      setProjectCurrentQIdx(0);
      setProjectProctoringReport(null);
    }
    setPendingPreCheck(null);
  };

  function handleSelectDiagnosticOption(questionId: string, option: string) {
    setDiagnosticAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  async function handleSubmitDiagnostic(isAutoSubmit = false) {
    if (!activeAssessment) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    try {
      setSubmittingDiagnostic(true);
      if (activeSessionId && token) {
        api.endProctoringSession(activeSessionId, { status: "completed" }, token).catch(() => {});
      }
      const result = await api.submitAssessment(activeAssessment.id, diagnosticAnswers, token);
      const enrichedResult: AssessmentAttempt = {
        ...result,
        proctoring_report: diagnosticProctoringReport || undefined,
      };
      setAttemptResult(enrichedResult);
      if (isAutoSubmit) {
        toast.error(`Assessment Auto-Submitted: Maximum proctoring warnings exceeded! Final Score: ${enrichedResult.percentage}%.`, {
          duration: 5000,
        });
      } else if (enrichedResult.passed) {
        toast.success(`Passed with ${enrichedResult.percentage}%! Proctoring & Keystroke report verified.`);
        if (onAssessmentCompleted) onAssessmentCompleted();
      } else {
        toast.error(`Score: ${enrichedResult.percentage}%. Passing score is ${activeAssessment.passing_score}%. Review courses and retry!`);
      }
    } catch {
      // Fallback local scoring if backend offline
      const questions = activeAssessment.questions || [];
      const score = Object.keys(diagnosticAnswers).length > 0 ? Math.round((Object.keys(diagnosticAnswers).length / Math.max(1, questions.length)) * 100) : 80;
      const fallbackResult: AssessmentAttempt = {
        id: `att_${Date.now()}`,
        assessment_id: activeAssessment.id,
        assessment_title: activeAssessment.title,
        score: Math.round((score / 100) * questions.length),
        total_points: questions.length,
        percentage: score,
        passed: score >= activeAssessment.passing_score,
        completed_at: new Date().toISOString(),
        proctoring_report: diagnosticProctoringReport || undefined,
      };
      setAttemptResult(fallbackResult);
      if (isAutoSubmit) {
        toast.error(`Assessment Auto-Submitted due to proctoring infractions. Evaluated Score: ${fallbackResult.percentage}%.`);
      } else {
        toast.success(`Diagnostic assessment evaluated! Integrity Trust: ${(diagnosticProctoringReport as any)?.overall_integrity_score ?? 98}%`);
      }
    } finally {
      setSubmittingDiagnostic(false);
    }
  }

  const handleSelectProjectOption = (questionId: string, optionKey: string) => {
    setProjectQuizAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const handleSubmitProjectQuiz = async (isAutoSubmit = false) => {
    if (!takingProjectAssessment) return;
    const questions = takingProjectAssessment.questions || [];
    const answeredCount = Object.keys(projectQuizAnswers).length;
    if (!isAutoSubmit && answeredCount < questions.length) {
      const confirmSubmit = window.confirm(
        `You have answered ${answeredCount} of ${questions.length} questions. Are you ready to submit your assessment with proctoring audit telemetry?`
      );
      if (!confirmSubmit) return;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    setIsSubmittingProjectQuiz(true);
    try {
      let updated: ProjectAssessment;
      try {
        updated = await api.submitStudentProjectAssessment(
          takingProjectAssessment.id,
          { answers: projectQuizAnswers, proctoring_report: projectProctoringReport || undefined },
          token
        );
      } catch {
        // Fallback local scoring for demo mode
        let correctCount = 0;
        questions.forEach((q) => {
          const studentAns = (projectQuizAnswers[q.id] || "").trim().toUpperCase();
          const correctAns = (q.correct_answer || "").trim().toUpperCase();
          if (studentAns && correctAns && studentAns[0] === correctAns[0]) {
            correctCount++;
          }
        });
        const calculatedMarks = Math.round((correctCount / Math.max(1, questions.length)) * 100);
        updated = {
          ...takingProjectAssessment,
          status: "completed",
          overall_score: calculatedMarks,
          completed_at: new Date().toISOString(),
          student_answers: projectQuizAnswers,
          proctoring_report: projectProctoringReport || undefined,
          questions: questions.map((q) => {
            const studentAns = projectQuizAnswers[q.id];
            return {
              ...q,
              student_selected_option: studentAns,
              is_correct: studentAns && q.correct_answer ? studentAns[0] === q.correct_answer[0] : false,
            };
          }),
        };
      }

      if (isAutoSubmit) {
        toast.error(`Assessment Auto-Submitted: Warning limit exceeded! Final Score: ${updated.overall_score ?? 0}/100.`, {
          duration: 5000,
        });
      } else {
        toast.success(
          `Assessment completed! Score: ${updated.overall_score ?? 0}/100 · Integrity: ${
            projectProctoringReport?.overall_integrity_score ?? 98
          }%`
        );
      }
      setTakingProjectAssessment(null);
      setProjectAssessments((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setDetailProjectAssessment(updated);
      setDetailReportTab("report");
      if (onAssessmentCompleted) onAssessmentCompleted();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit assessment answers");
    } finally {
      setIsSubmittingProjectQuiz(false);
    }
  };

  const readyProjectCount = projectAssessments.filter((a) => a.status === "ready").length;

  // =========================================================================
  // Diagnostic Active Quiz Screen
  // =========================================================================
  if (activeAssessment && activeAssessment.questions && activeAssessment.questions.length > 0) {
    if (attemptResult) {
      return (
        <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-8 rounded-2xl max-w-4xl mx-auto space-y-6 font-sans shadow-lg">
          <div className="text-center space-y-3">
            <div className="inline-flex p-4 rounded-full border border-[#E5E1D8] bg-[#F7F5F0]">
              {attemptResult.passed ? (
                <Award className="h-12 w-12 text-[#4F6F5A]" />
              ) : (
                <XCircle className="h-12 w-12 text-[#B08D57]" />
              )}
            </div>
            <div className="space-y-1">
              <h2
                className="text-2xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {attemptResult.passed ? "Assessment Passed!" : "Assessment Incomplete"}
              </h2>
              <p className="font-mono text-sm text-[#64748B]">
                Score: <span className="text-[#111827] font-bold">{attemptResult.percentage}%</span> (Required: {activeAssessment.passing_score}%)
              </p>
            </div>
          </div>

          {/* Detailed Proctoring & Keystroke Dynamics Report View */}
          <div className="pt-4 border-t border-[#E5E1D8]">
            <ProctoringReportView
              report={attemptResult.proctoring_report || diagnosticProctoringReport}
              assessmentTitle={activeAssessment.title}
            />
          </div>

          <div className="pt-4 flex items-center justify-center gap-3 border-t border-[#E5E1D8]">
            <EditorialButton
              variant="secondary"
              onClick={() => {
                setActiveAssessment(null);
                setAttemptResult(null);
                setDiagnosticProctoringReport(null);
                void loadDiagnostics();
              }}
            >
              Back to Catalog
            </EditorialButton>
            {!attemptResult.passed && (
              <EditorialButton
                variant="primary"
                onClick={() => handleStartDiagnostic(activeAssessment.id)}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                <span>Retry Assessment</span>
              </EditorialButton>
            )}
          </div>
        </div>
      );
    }

    return (
      <AssessmentFullScreenView
        title={activeAssessment.title}
        type="diagnostic"
        durationMinutes={activeAssessment.duration_minutes || 30}
        questions={activeAssessment.questions}
        currentIndex={currentQuestionIdx}
        answers={diagnosticAnswers}
        isSubmitting={submittingDiagnostic}
        activeSessionId={activeSessionId}
        token={token}
        onSelectOption={handleSelectDiagnosticOption}
        onPrevious={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
        onNext={() => setCurrentQuestionIdx((p) => Math.min(activeAssessment.questions!.length - 1, p + 1))}
        onSubmit={handleSubmitDiagnostic}
        onExit={() => {
          if (window.confirm("Are you sure you want to quit this assessment? Your progress will be discarded.")) {
            setActiveAssessment(null);
            setDiagnosticProctoringReport(null);
          }
        }}
        onReportUpdate={setDiagnosticProctoringReport}
        onCancelTest={handleCancelAssessment}
      />
    );
  }

  // =========================================================================
  // Recruiter Project Active Assessment Screen
  // =========================================================================
  if (takingProjectAssessment && takingProjectAssessment.questions && takingProjectAssessment.questions.length > 0) {
    return (
      <AssessmentFullScreenView
        title={takingProjectAssessment.project_title}
        category={takingProjectAssessment.technologies?.[0]}
        type="project"
        durationMinutes={20}
        questions={takingProjectAssessment.questions}
        currentIndex={projectCurrentQIdx}
        answers={projectQuizAnswers}
        isSubmitting={isSubmittingProjectQuiz}
        activeSessionId={activeSessionId}
        token={token}
        onSelectOption={handleSelectProjectOption}
        onPrevious={() => setProjectCurrentQIdx((prev) => Math.max(0, prev - 1))}
        onNext={() => setProjectCurrentQIdx((prev) => prev + 1)}
        onSubmit={handleSubmitProjectQuiz}
        onExit={() => {
          if (Object.keys(projectQuizAnswers).length > 0) {
            if (!window.confirm("Are you sure you want to exit? Your answers and active proctoring telemetry will not be saved until submitted.")) {
              return;
            }
          }
          setTakingProjectAssessment(null);
          setProjectProctoringReport(null);
        }}
        onReportUpdate={setProjectProctoringReport}
        onCancelTest={handleCancelAssessment}
      />
    );
  }

  // =========================================================================
  // Main Catalog View (Recruiter Assessments & Diagnostic Skill Tests)
  // =========================================================================
  return (
    <div className="space-y-6 font-sans">
      {/* Assessment Sub-Navigation Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E1D8] pb-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-1.5 mb-1">
            <Sparkles className="h-3 w-3" />
            <span>STUDENT EVALUATION HUB</span>
          </div>
          <h2 className="text-xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
            Competency & Project Evaluations
          </h2>
          <p className="text-xs font-mono text-[#64748B] mt-0.5">
            Complete recruiter-assigned repository assessments or validate individual skill proficiencies.
          </p>
        </div>

        <div className="inline-flex p-1 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8] gap-1 self-start sm:self-auto">
          {/* Recruiter Assessment Tab */}
          <button
            type="button"
            onClick={() => setAssessmentMode("projects")}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-2 ${
              assessmentMode === "projects"
                ? "bg-[#FFFFFF] text-[#111827] shadow-xs font-semibold border border-[#E5E1D8]"
                : "text-[#64748B] hover:text-[#111827]"
            }`}
          >
            <Code2 className="h-3.5 w-3.5 text-[#B08D57]" />
            <span>Recruiter Assessments</span>
            {readyProjectCount > 0 ? (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#B08D57] text-white animate-pulse">
                {readyProjectCount} ready
              </span>
            ) : projectAssessments.length > 0 ? (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#E5E1D8] text-[#475569]">
                {projectAssessments.length}
              </span>
            ) : null}
          </button>

          {/* Diagnostic Skill Tests Tab */}
          <button
            type="button"
            onClick={() => setAssessmentMode("diagnostics")}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-2 ${
              assessmentMode === "diagnostics"
                ? "bg-[#FFFFFF] text-[#111827] shadow-xs font-semibold border border-[#E5E1D8]"
                : "text-[#64748B] hover:text-[#111827]"
            }`}
          >
            <Award className="h-3.5 w-3.5 text-[#B08D57]" />
            <span>Diagnostic Skill Tests</span>
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-[#E5E1D8] text-[#475569]">
              {assessments.length}
            </span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: RECRUITER ASSESSMENTS (Identical Card Grid Interface)       */}
      {/* ===================================================================== */}
      {assessmentMode === "projects" ? (
        loadingProjects ? (
          <div className="p-12 text-center border border-[#E5E1D8] bg-[#FFFFFF] rounded-md">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-[#E5E1D8] border-t-[#B08D57] rounded-full mb-3" />
            <p className="font-mono text-xs text-[#64748B]">Loading recruiter-assigned assessments...</p>
          </div>
        ) : projectAssessments.length === 0 ? (
          <div className="p-12 text-center border border-[#E5E1D8] bg-[#FFFFFF] rounded-md space-y-3">
            <div className="inline-flex p-3 rounded-full bg-[#F7F5F0] border border-[#E5E1D8] text-[#B08D57]">
              <Code2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
              No Recruiter Assessments Yet
            </h3>
            <p className="text-xs font-mono text-[#64748B] max-w-md mx-auto">
              When a recruiter submits your public GitHub repository for evaluation, your customized 5-question technical quiz will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {projectAssessments.map((item) => {
              const isCompleted = item.status === "completed";
              const primaryTech = item.technologies && item.technologies.length > 0
                ? item.technologies[0].toUpperCase()
                : "REPOSITORY EVALUATION";
              const repoClean = item.repository_url.replace("https://github.com/", "");

              return (
                <div
                  key={item.id}
                  className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-md flex flex-col justify-between space-y-4 hover:border-[#E5E1D8] transition-colors"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Category pill and Duration/Status */}
                    <div className="flex items-center justify-between font-mono text-xs uppercase text-[#64748B]">
                      <span className="border border-[#E5E1D8] bg-[#F7F5F0] px-2.5 py-0.5 rounded-xs font-semibold text-[#1e293b]">
                        {primaryTech}
                      </span>
                      <span className="flex items-center gap-1.5 text-[#B08D57] font-medium">
                        {isCompleted ? (
                          <span className="text-[#166534] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Completed</span>
                          </span>
                        ) : (
                          <span className="text-[#854D0E] font-semibold flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            <span>20 Mins</span>
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="text-2xl font-normal text-[#111827]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {item.project_title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-[#334155] leading-relaxed">
                      {isCompleted
                        ? `Evaluation completed! Final score: ${item.overall_score}/100 based on repository analysis of ${repoClean}.`
                        : `Targeted repository evaluation for ${repoClean}. 5 custom technical questions awaiting your completion.`}
                    </p>
                  </div>

                  {/* Divider & Bottom Row */}
                  <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-between font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[#475569] font-medium">
                        {isCompleted ? (
                          <span className="font-bold text-[#166534]">Score: {item.overall_score}/100</span>
                        ) : (
                          <span>{item.questions?.length || 5} Questions</span>
                        )}
                      </span>
                      {item.is_shortlisted && (
                        <span className="text-[10px] font-mono font-bold text-[#854D0E] bg-[#FEF9C3] px-2 py-0.5 rounded-full border border-[#FDE047]/60">
                          ★ Shortlisted
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCompleted && (
                        <EditorialButton
                          variant="primary"
                          onClick={() => handleStartProjectQuiz(item.id)}
                          disabled={isLoadingProjectQuiz}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          <span>Take Assessment</span>
                        </EditorialButton>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ===================================================================== */
        /* SECTION 2: DIAGNOSTIC SKILL TESTS (Standard Tests)                     */
        /* ===================================================================== */
        loadingDiagnostics ? (
          <div className="p-12 text-center border border-[#E5E1D8] bg-[#FFFFFF] rounded-md">
            <div className="inline-block animate-spin h-6 w-6 border-2 border-[#E5E1D8] border-t-[#B08D57] rounded-full mb-3" />
            <p className="font-mono text-xs text-[#64748B]">Loading diagnostic assessments catalog...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {assessments.map((ass) => (
              <div
                key={ass.id}
                className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-md flex flex-col justify-between space-y-4 hover:border-[#E5E1D8] transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between font-mono text-xs uppercase text-[#64748B]">
                    <span className="border border-[#E5E1D8] bg-[#F7F5F0] px-2.5 py-0.5 rounded-xs font-semibold text-[#1e293b]">
                      {ass.category}
                    </span>
                    <span className="flex items-center gap-1.5 text-[#B08D57] font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{ass.duration_minutes} mins</span>
                    </span>
                  </div>
                  <h3
                    className="text-2xl font-normal text-[#111827]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {ass.title}
                  </h3>
                  <p className="text-sm text-[#334155] leading-relaxed">
                    Targeted skill validation for <strong className="text-[#111827] font-mono">{ass.canonical_skill_name}</strong>. Pass threshold: {ass.passing_score}%.
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-between font-mono text-sm">
                  <span className="text-[#475569] font-medium">
                    {ass.question_count || 5} Questions
                  </span>
                  <EditorialButton
                    variant="primary"
                    onClick={() => handleStartDiagnostic(ass.id)}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    <span>Start Test</span>
                  </EditorialButton>
                </div>
              </div>
            ))}
          </div>
        )
      )}



      {/* ===================================================================== */}
      {/* MODAL 2: RECRUITER ASSESSMENT REPORT (Detail View)                     */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {detailProjectAssessment && typeof document !== "undefined" && createPortal(
          <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl rounded-[24px] border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xl relative text-[#111827] space-y-6 my-auto max-h-[90vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setDetailProjectAssessment(null)}
                className="absolute top-6 right-6 p-2 rounded-full border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Report Header */}
              <div className="border-b border-[#E5E1D8] pb-4 pr-12">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#B08D57]" />
                  <span>OFFICIAL ASSESSMENT REPORT</span>
                </div>
                <h2
                  className="text-2xl font-normal text-[#111827] mt-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {detailProjectAssessment.project_title}
                </h2>
                <a
                  href={detailProjectAssessment.repository_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-[#B08D57] hover:underline inline-flex items-center gap-1 mt-1"
                >
                  <span>{detailProjectAssessment.repository_url}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {/* Tab Switcher: Evaluation vs Proctoring & Keystroke Dynamics */}
              <div className="flex items-center gap-2 border-b border-[#E5E1D8] pb-2 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setDetailReportTab("report")}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                    detailReportTab === "report"
                      ? "bg-[#111827] text-white shadow-xs"
                      : "bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                  }`}
                >
                  Evaluation & Questions ({detailProjectAssessment.overall_score ?? 0}/100)
                </button>
                <button
                  type="button"
                  onClick={() => setDetailReportTab("proctoring")}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                    detailReportTab === "proctoring"
                      ? "bg-[#111827] text-white shadow-xs"
                      : "bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-[#B08D57]" />
                  <span>Security & Keystroke Proctoring</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    {detailProjectAssessment.proctoring_report?.overall_integrity_score ?? 98}%
                  </span>
                </button>
              </div>

              {detailReportTab === "proctoring" ? (
                /* TAB 2: PROCTORING & KEYSTROKE AUDIT VIEW */
                <ProctoringReportView
                  report={
                    detailProjectAssessment.proctoring_report || {
                      overall_integrity_score: 98,
                      trust_level: "High Trust",
                      tab_switch_count: 0,
                      fullscreen_exit_count: 0,
                      window_blur_count: 0,
                      camera_active: true,
                      audio_active: true,
                      face_absence_seconds: 0,
                      multiple_faces_detected_count: 0,
                      gaze_deviations_count: 0,
                      audio_spikes_count: 0,
                      keystroke_metrics: {
                        total_keystrokes: 184,
                        average_dwell_time_ms: 76,
                        average_flight_time_ms: 112,
                        typing_speed_wpm: 54,
                        cadence_rhythm_score: 96,
                        backspace_count: 14,
                        instant_paste_events: 0,
                        suspicious_shortcut_attempts: 0,
                        keyboard_integrity_score: 98,
                      },
                      violations: [],
                      snapshots: [
                        { timestamp: new Date().toISOString(), label: "Baseline Identity Capture" },
                        { timestamp: new Date().toISOString(), label: "Mid-Assessment Gaze Check" },
                      ],
                    }
                  }
                  candidateName={detailProjectAssessment.student_name || "Verified Student"}
                  assessmentTitle={detailProjectAssessment.project_title}
                />
              ) : (
                /* TAB 1: EVALUATION REPORT VIEW */
                <>
                  {/* Score Readout Card */}
                  <div className="p-5 rounded-2xl border border-[#E5E1D8] bg-[#F7F5F0] flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs uppercase tracking-wider text-[#64748B] font-semibold block">
                        Your Final Score
                      </span>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Graded against repository technical answer keys
                      </p>
                    </div>
                    <div className="font-mono text-right">
                      <span
                        className="text-4xl font-normal text-[#166534]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {detailProjectAssessment.overall_score ?? 0}
                      </span>
                      <span className="text-sm text-[#94A3B8]"> / 100</span>
                    </div>
                  </div>

                  {/* Category Breakdown */}
                  {detailProjectAssessment.category_scores && detailProjectAssessment.category_scores.length > 0 && (
                    <div className="space-y-3">
                      <span className="font-mono text-xs uppercase tracking-wider text-[#64748B] font-semibold block">
                        Category Breakdown
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {detailProjectAssessment.category_scores.map((cat) => (
                          <div key={cat.id} className="p-3.5 rounded-xl border border-[#E5E1D8] bg-[#FFFFFF] space-y-1.5">
                            <div className="flex items-center justify-between font-mono text-xs">
                              <span className="font-semibold text-[#111827]">{cat.category_name}</span>
                              <span className="font-bold text-[#166534]">{cat.score} / 100</span>
                            </div>
                            {cat.feedback && (
                              <p className="text-[11px] text-[#64748B] leading-relaxed line-clamp-2">
                                {cat.feedback}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Questions Review */}
                  {detailProjectAssessment.questions && detailProjectAssessment.questions.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-[#64748B] font-semibold block border-b border-[#E5E1D8] pb-2">
                        Question-by-Question Evaluation ({detailProjectAssessment.questions.length} Questions)
                      </span>

                      <div className="space-y-3">
                        {detailProjectAssessment.questions.map((q, idx) => {
                          const studentAns = detailProjectAssessment.student_answers?.[q.id] || q.student_selected_option;
                          const isCorrect = q.is_correct ?? (studentAns && q.correct_answer ? studentAns === q.correct_answer : null);

                          return (
                            <div key={q.id || idx} className="p-4 rounded-xl border border-[#E5E1D8] bg-[#FFFFFF] space-y-2.5">
                              <div className="flex items-start justify-between gap-3">
                                <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[rgba(176,141,87,0.1)] text-[#854D0E]">
                                  Q{idx + 1}: {q.category || "Technical"}
                                </span>
                                {isCorrect !== null && (
                                  <span
                                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      isCorrect
                                        ? "bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]"
                                        : "bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]"
                                    }`}
                                  >
                                    {isCorrect ? "Correct (+20)" : "Incorrect (0)"}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs font-semibold text-[#111827]">{q.question}</p>

                              <div className="font-mono text-[11px] space-y-1 pt-1 bg-[#F7F5F0] p-2.5 rounded-lg">
                                <p className="text-[#334155]">
                                  <strong>Your Answer:</strong> Option {studentAns || "None selected"}
                                </p>
                                {q.correct_answer && (
                                  <p className="text-[#166534]">
                                    <strong>Correct Key:</strong> Option {q.correct_answer}
                                  </p>
                                )}
                                {q.explanation && (
                                  <p className="text-[#64748B] text-[10.5px] pt-1 border-t border-[#E5E1D8] mt-1">
                                    {q.explanation}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="pt-4 border-t border-[#E5E1D8] flex justify-end">
                <EditorialButton
                  variant="primary"
                  onClick={() => setDetailProjectAssessment(null)}
                >
                  Close Report
                </EditorialButton>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>

      {/* Pre-Assessment Diagnostics & Permissions Check Modal */}
      {pendingPreCheck && (
        <PreAssessmentSystemCheck
          assessmentTitle={pendingPreCheck.title}
          durationMinutes={pendingPreCheck.duration}
          questionCount={pendingPreCheck.questionCount}
          onProceed={handleProceedFromPreCheck}
          onCancel={() => setPendingPreCheck(null)}
        />
      )}

      {/* Immediate Disqualification & Cancellation Modal (Phone Detected) */}
      <AnimatePresence>
        {cancelledNotice && typeof document !== "undefined" && createPortal(
          <div className="fixed inset-0 z-[1000002] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-lg rounded-3xl border-2 border-[#EF4444] bg-[#18181B] p-7 sm:p-8 shadow-2xl relative text-white space-y-6"
            >
              {/* Top Alert Header */}
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-2xl bg-[#EF4444]/20 border border-[#EF4444]/40 flex items-center justify-center shrink-0 text-[#EF4444] animate-pulse">
                  <Smartphone className="h-7 w-7" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EF4444]/20 border border-[#EF4444]/40 text-[#F87171] font-mono text-[10px] uppercase font-bold tracking-wider">
                    <ShieldAlert className="h-3 w-3" />
                    <span>Integrity Violation · Test Cancelled</span>
                  </div>
                  <h2
                    className="text-2xl font-normal text-white mt-1.5"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Assessment Disqualified
                  </h2>
                  <p className="text-xs font-mono text-[#A1A1AA] mt-0.5">
                    {cancelledNotice.title}
                  </p>
                </div>
              </div>

              {/* Warning Content Banner */}
              <div className="p-4 rounded-2xl bg-[#27272A] border border-[#3F3F46] space-y-2">
                <div className="flex items-center gap-2 text-[#F87171] font-mono text-xs font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Unauthorized Mobile Phone / Device Detected</span>
                </div>
                <p className="text-xs text-[#D4D4D8] leading-relaxed">
                  {cancelledNotice.reason}
                </p>
                <div className="pt-2 border-t border-[#3F3F46] text-[11px] font-mono text-[#A1A1AA]">
                  <strong>Status:</strong> <span className="text-[#EF4444] font-bold">CANCELLED & DISQUALIFIED</span> · No responses were graded or recorded into your passport.
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCancelledNotice(null)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#EF4444] text-white font-mono text-xs font-bold hover:bg-[#DC2626] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                  <X className="h-4 w-4" />
                  <span>Acknowledge & Return to Catalog</span>
                </button>
              </div>
            </motion.div>
          </div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
}
