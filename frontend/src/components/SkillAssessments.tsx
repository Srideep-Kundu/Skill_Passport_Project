import { useCallback, useEffect, useState } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { Assessment, AssessmentAttempt, ProjectAssessment } from "../api/types";
import { toast } from "sonner";
import { EditorialButton } from "./ui/EditorialPrimitives";

interface Props {
  token: string;
  onAssessmentCompleted?: () => void;
  defaultMode?: "projects" | "diagnostics";
}

export function SkillAssessments({ token, onAssessmentCompleted, defaultMode }: Props) {
  // Mode switcher: "projects" = Recruiter Assessments, "diagnostics" = Diagnostic Skill Tests
  const [assessmentMode, setAssessmentMode] = useState<"projects" | "diagnostics">(defaultMode || "projects");

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

  // Load Diagnostic assessments
  const loadDiagnostics = useCallback(async () => {
    try {
      setLoadingDiagnostics(true);
      const data = await api.getAssessments(token);
      setAssessments(data);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load skill assessments"));
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
      setProjectAssessments(items);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load recruiter assessments"));
      setProjectAssessments([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDiagnostics();
    void loadProjectAssessments();
  }, [loadDiagnostics, loadProjectAssessments]);

  // =========================================================================
  // Diagnostic Quiz Handlers
  // =========================================================================

  async function handleStartDiagnostic(assessmentId: string) {
    try {
      setLoadingDiagnostics(true);
      const details = await api.getAssessment(assessmentId, token);
      setActiveAssessment(details);
      setDiagnosticAnswers({});
      setCurrentQuestionIdx(0);
      setAttemptResult(null);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load assessment questions"));
    } finally {
      setLoadingDiagnostics(false);
    }
  }

  function handleSelectDiagnosticOption(questionId: string, option: string) {
    setDiagnosticAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  async function handleSubmitDiagnostic() {
    if (!activeAssessment) return;
    try {
      setSubmittingDiagnostic(true);
      const result = await api.submitAssessment(activeAssessment.id, diagnosticAnswers, token);
      setAttemptResult(result);
      if (result.passed) {
        toast.success(`Passed with ${result.percentage}%! Added to Lumina Intel as Verified Evidence.`);
        if (onAssessmentCompleted) onAssessmentCompleted();
      } else {
        toast.error(`Score: ${result.percentage}%. Passing score is ${activeAssessment.passing_score}%. Review courses and retry!`);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Failed to submit assessment"));
    } finally {
      setSubmittingDiagnostic(false);
    }
  }

  // =========================================================================
  // Recruiter Project Quiz Handlers
  // =========================================================================

  const handleStartProjectQuiz = async (assessmentId: string) => {
    setIsLoadingProjectQuiz(true);
    try {
      const detail = await api.getStudentProjectAssessmentDetail(assessmentId, token);
      if (!detail) throw new Error("Assessment not found");
      setTakingProjectAssessment(detail);
      setProjectQuizAnswers({});
      setProjectCurrentQIdx(0);
    } catch {
      toast.error("Failed to load repository assessment questions");
    } finally {
      setIsLoadingProjectQuiz(false);
    }
  };

  const handleSelectProjectOption = (questionId: string, optionKey: string) => {
    setProjectQuizAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const handleSubmitProjectQuiz = async () => {
    if (!takingProjectAssessment) return;
    const questions = takingProjectAssessment.questions || [];
    const answeredCount = Object.keys(projectQuizAnswers).length;
    if (answeredCount < questions.length) {
      const confirmSubmit = window.confirm(
        `You have answered ${answeredCount} of ${questions.length} questions. Are you ready to submit your assessment?`
      );
      if (!confirmSubmit) return;
    }

    setIsSubmittingProjectQuiz(true);
    try {
      const updated = await api.submitStudentProjectAssessment(
        takingProjectAssessment.id,
        { answers: projectQuizAnswers },
        token
      );
      toast.success(`Assessment completed! Your Score: ${updated.overall_score ?? 0}/100`);
      setTakingProjectAssessment(null);
      void loadProjectAssessments();
      setDetailProjectAssessment(updated);
      if (onAssessmentCompleted) onAssessmentCompleted();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit assessment answers");
    } finally {
      setIsSubmittingProjectQuiz(false);
    }
  };

  const handleOpenProjectDetail = async (assessmentId: string) => {
    try {
      const detail = await api.getStudentProjectAssessmentDetail(assessmentId, token);
      setDetailProjectAssessment(detail || null);
    } catch {
      toast.error("Failed to load assessment report");
    }
  };

  const readyProjectCount = projectAssessments.filter((a) => a.status === "ready").length;

  // =========================================================================
  // Diagnostic Active Quiz Screen
  // =========================================================================
  if (activeAssessment && activeAssessment.questions && activeAssessment.questions.length > 0) {
    const questions = activeAssessment.questions;
    const currentQ = questions[currentQuestionIdx];
    const answeredCount = Object.keys(diagnosticAnswers).length;

    if (attemptResult) {
      return (
        <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-8 rounded-md text-center max-w-xl mx-auto space-y-6 font-sans">
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

          <div className="p-4 border border-[#E5E1D8] bg-[#F7F5F0] rounded-sm text-left font-mono text-xs space-y-1 text-[#334155]">
            <p><strong>Correct Answers:</strong> {attemptResult.score} / {questions.length}</p>
            <p><strong>Status:</strong> {attemptResult.passed ? "Evidence record generated & verified" : "Did not meet passing criteria"}</p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <EditorialButton
              variant="secondary"
              onClick={() => {
                setActiveAssessment(null);
                setAttemptResult(null);
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
      <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-md space-y-6 font-sans">
        <div className="flex items-center justify-between pb-4 border-b border-[#E5E1D8]">
          <div>
            <h2
              className="text-xl font-normal text-[#111827]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {activeAssessment.title}
            </h2>
            <span className="font-mono text-xs text-[#64748B]">
              Question {currentQuestionIdx + 1} of {questions.length} · {answeredCount} Answered
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="border border-[#E5E1D8] bg-[#F7F5F0] px-2.5 py-1 text-[#B08D57] rounded-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{activeAssessment.duration_minutes} Mins</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveAssessment(null)}
              className="text-[#64748B] hover:text-[#111827] cursor-pointer"
            >
              Quit
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-base text-[#111827] leading-relaxed">
            {currentQ.question_text}
          </p>

          <div className="grid grid-cols-1 gap-2.5 pt-2 font-mono text-xs">
            {currentQ.options.map((opt) => {
              const isSelected = diagnosticAnswers[currentQ.id] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelectDiagnosticOption(currentQ.id, opt)}
                  className={`p-3.5 rounded-sm text-left transition-colors cursor-pointer border ${
                    isSelected
                      ? "border-[#B08D57] bg-[rgba(176,141,87,0.12)] text-[#111827]"
                      : "border-[#E5E1D8] bg-[#F7F5F0] text-[#475569] hover:border-[#E5E1D8] hover:text-[#111827]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt}</span>
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#E5E1D8]">
          <button
            type="button"
            onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
            disabled={currentQuestionIdx === 0}
            className="font-mono text-xs text-[#64748B] hover:text-[#111827] disabled:opacity-30 cursor-pointer"
          >
            Previous Question
          </button>

          {currentQuestionIdx < questions.length - 1 ? (
            <EditorialButton
              variant="primary"
              onClick={() => setCurrentQuestionIdx((p) => Math.min(questions.length - 1, p + 1))}
            >
              Next Question
            </EditorialButton>
          ) : (
            <EditorialButton
              variant="primary"
              onClick={handleSubmitDiagnostic}
              disabled={submittingDiagnostic || answeredCount === 0}
            >
              {submittingDiagnostic ? "Grading..." : "Submit Assessment"}
            </EditorialButton>
          )}
        </div>
      </div>
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
                      {isCompleted ? (
                        <EditorialButton
                          variant="secondary"
                          onClick={() => handleOpenProjectDetail(item.id)}
                        >
                          <span>View Report</span>
                        </EditorialButton>
                      ) : (
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
      {/* MODAL 1: RECRUITER ASSESSMENT QUIZ (Taking Assessment)                 */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {takingProjectAssessment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-[24px] border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xl relative text-[#111827] space-y-6 my-8"
            >
              {/* Close confirmation button */}
              <button
                type="button"
                onClick={() => {
                  if (Object.keys(projectQuizAnswers).length > 0) {
                    if (!window.confirm("Are you sure you want to exit? Your answers will not be saved until submitted.")) {
                      return;
                    }
                  }
                  setTakingProjectAssessment(null);
                }}
                className="absolute top-6 right-6 p-2 rounded-full border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Stepper Header */}
              <div className="border-b border-[#E5E1D8] pb-4 pr-12">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>RECRUITER PROJECT ASSESSMENT</span>
                </div>
                <h2
                  className="text-2xl font-normal text-[#111827] mt-1 truncate"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {takingProjectAssessment.project_title}
                </h2>
                <div className="flex items-center justify-between text-xs font-mono text-[#64748B] mt-2">
                  <span>
                    Question {projectCurrentQIdx + 1} of {takingProjectAssessment.questions?.length || 5}
                  </span>
                  <span>
                    {Object.keys(projectQuizAnswers).length} of {takingProjectAssessment.questions?.length || 5} Answered
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-[#F7F5F0] rounded-full overflow-hidden mt-2 border border-[#E5E1D8]">
                  <div
                    className="h-full bg-[#B08D57] transition-all duration-300 rounded-full"
                    style={{
                      width: `${(((projectCurrentQIdx + 1) / (takingProjectAssessment.questions?.length || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Current Question */}
              {takingProjectAssessment.questions && takingProjectAssessment.questions.length > 0 && takingProjectAssessment.questions[projectCurrentQIdx] ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[rgba(176,141,87,0.12)] text-[#854D0E] border border-[#B08D57]/30">
                      {takingProjectAssessment.questions[projectCurrentQIdx].category || "Technical Implementation"}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
                      {takingProjectAssessment.questions[projectCurrentQIdx].difficulty || "Intermediate"}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-[#111827] leading-relaxed">
                    {takingProjectAssessment.questions[projectCurrentQIdx].question}
                  </h3>

                  {/* Options list */}
                  <div className="space-y-3 pt-1">
                    {takingProjectAssessment.questions[projectCurrentQIdx].options.map((optionText, optIdx) => {
                      const optKey = ["A", "B", "C", "D"][optIdx] || String.fromCharCode(65 + optIdx);
                      const qId = takingProjectAssessment.questions![projectCurrentQIdx].id;
                      const isSelected = projectQuizAnswers[qId] === optKey;

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectProjectOption(qId, optKey)}
                          className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                            isSelected
                              ? "border-[#B08D57] bg-[rgba(176,141,87,0.08)] shadow-xs ring-1 ring-[#B08D57]"
                              : "border-[#E5E1D8] bg-[#F7F5F0]/50 hover:bg-[#FFFFFF] hover:border-[#B08D57]/50"
                          }`}
                        >
                          <div
                            className={`h-6 w-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-colors ${
                              isSelected
                                ? "bg-[#B08D57] text-white"
                                : "border border-[#E5E1D8] bg-white text-[#64748B]"
                            }`}
                          >
                            {optKey}
                          </div>
                          <span
                            className={`text-xs sm:text-sm pt-0.5 leading-snug ${
                              isSelected ? "font-medium text-[#111827]" : "text-[#334155]"
                            }`}
                          >
                            {optionText}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Stepper Navigation Controls */}
                  <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-between gap-3">
                    <EditorialButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setProjectCurrentQIdx((prev) => Math.max(0, prev - 1))}
                      disabled={projectCurrentQIdx === 0}
                    >
                      Previous
                    </EditorialButton>

                    <div className="flex items-center gap-2">
                      {projectCurrentQIdx < (takingProjectAssessment.questions?.length || 1) - 1 ? (
                        <EditorialButton
                          variant="primary"
                          size="sm"
                          onClick={() => setProjectCurrentQIdx((prev) => prev + 1)}
                        >
                          <span>Next Question</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </EditorialButton>
                      ) : (
                        <EditorialButton
                          variant="accent"
                          size="md"
                          onClick={handleSubmitProjectQuiz}
                          disabled={isSubmittingProjectQuiz}
                        >
                          {isSubmittingProjectQuiz ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          <span>{isSubmittingProjectQuiz ? "Submitting..." : "Submit Assessment"}</span>
                        </EditorialButton>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs font-mono text-[#64748B]">
                  No questions loaded for this assessment.
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* MODAL 2: RECRUITER ASSESSMENT REPORT (Detail View)                     */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {detailProjectAssessment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl rounded-[24px] border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xl relative text-[#111827] space-y-6 my-8 max-h-[90vh] overflow-y-auto"
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

              <div className="pt-4 border-t border-[#E5E1D8] flex justify-end">
                <EditorialButton
                  variant="primary"
                  onClick={() => setDetailProjectAssessment(null)}
                >
                  Close Report
                </EditorialButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
