import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  X,
  Star,
  ChevronRight,
  Zap,
} from "lucide-react";
import { api } from "../../api";
import type {
  ProjectAssessment,
  ProjectAssessmentSummary,
} from "../../api/types";
import {
  EditorialCard,
  EditorialButton,
  StatusTag,
  MetricReadout,
  LiquidGlassButton,
} from "../ui/EditorialPrimitives";
import { toast } from "sonner";
import {
  DUMMY_PROJECT_ASSESSMENTS,
  DUMMY_PROJECT_ASSESSMENT_SUMMARIES,
} from "../../data/projectAssessmentDummyData";

interface StudentProjectAssessmentsProps {
  token: string;
}

export function StudentProjectAssessments({ token }: StudentProjectAssessmentsProps) {
  const [assessments, setAssessments] = useState<ProjectAssessmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Detail Modal State
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [detailAssessment, setDetailAssessment] = useState<ProjectAssessment | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Taking Assessment Quiz State
  const [takingAssessment, setTakingAssessment] = useState<ProjectAssessment | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getStudentProjectAssessments(token);
      const safeList = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      if (safeList.length > 0) {
        const ids = new Set(safeList.map((i: any) => i.id));
        const extra = DUMMY_PROJECT_ASSESSMENT_SUMMARIES.filter((d) => !ids.has(d.id));
        setAssessments([...safeList, ...extra]);
      } else {
        setAssessments(DUMMY_PROJECT_ASSESSMENT_SUMMARIES);
      }
    } catch {
      setAssessments(DUMMY_PROJECT_ASSESSMENT_SUMMARIES);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const handleOpenDetail = async (assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    setIsLoadingDetail(true);
    try {
      const detail = await api.getStudentProjectAssessmentDetail(assessmentId, token).catch(() => null);
      setDetailAssessment(detail || DUMMY_PROJECT_ASSESSMENTS.find((a) => a.id === assessmentId) || null);
    } catch {
      setDetailAssessment(DUMMY_PROJECT_ASSESSMENTS.find((a) => a.id === assessmentId) || null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleStartAssessment = async (assessmentId: string) => {
    setIsLoadingQuiz(true);
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
      setTakingAssessment(detail);
      setQuizAnswers({});
      setCurrentQuestionIndex(0);
    } catch {
      toast.error("Failed to load assessment questions");
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  const handleSelectOption = (questionId: string, optionKey: string) => {
    setQuizAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));
  };

  const handleSubmitAssessment = async () => {
    if (!takingAssessment) return;
    const questions = takingAssessment.questions || [];
    const answeredCount = Object.keys(quizAnswers).length;
    if (answeredCount < questions.length) {
      const confirmSubmit = window.confirm(
        `You have answered ${answeredCount} of ${questions.length} questions. Are you ready to submit your assessment?`
      );
      if (!confirmSubmit) return;
    }

    setIsSubmittingQuiz(true);
    try {
      const updated = await api.submitStudentProjectAssessment(
        takingAssessment.id,
        { answers: quizAnswers },
        token
      );
      toast.success(`Assessment completed! Your Score: ${updated.overall_score ?? 0}/100`);
      setTakingAssessment(null);
      void loadData();
      setDetailAssessment(updated);
      setSelectedAssessmentId(updated.id);
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit assessment answers");
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // Metrics
  const stats = useMemo(() => {
    const list = Array.isArray(assessments) ? assessments : [];
    const total = list.length;
    const completed = list.filter((a) => a?.status === "completed");
    const avgScore = completed.length
      ? Math.round(completed.reduce((acc, curr) => acc + (curr?.overall_score || 0), 0) / completed.length)
      : 0;
    const shortlistedCount = list.filter((a) => !!a?.is_shortlisted).length;
    const allTechs = new Set<string>();
    list.forEach((a) => {
      if (Array.isArray(a?.technologies)) {
        a.technologies.forEach((t) => {
          if (t) allTechs.add(t);
        });
      }
    });
    return { total, completed: completed.length, avgScore, shortlistedCount, techCount: allTechs.size };
  }, [assessments]);

  return (
    <div className="space-y-8 font-sans text-[#111827]">
      {/* Metric Readouts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricReadout
          label="Evaluated Projects"
          value={stats.total}
          subtext="Audited repositories"
          trend="Automated"
        />
        <MetricReadout
          label="Average Score"
          value={stats.completed > 0 ? `${stats.avgScore}/100` : "—"}
          subtext="Overall code quality"
          trend="Multi-Category"
        />
        <MetricReadout
          label="Recruiter Shortlists"
          value={stats.shortlistedCount}
          subtext="High-interest projects"
          trend={stats.shortlistedCount > 0 ? "★ Top Tier" : "In Review"}
        />
        <MetricReadout
          label="Verified Tech Stack"
          value={stats.techCount}
          subtext="Languages & frameworks"
          trend="Code-Proven"
        />
      </div>

      {/* Projects List Card */}
      <EditorialCard className="p-6 sm:p-8 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E1D8] pb-5 mb-6">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-1.5">
              <Code2 className="h-4 w-4" />
              <span>VERIFIABLE PROJECT EVALUATIONS</span>
            </div>
            <h2
              className="text-2xl font-normal text-[#111827] mt-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Your GitHub Project Assessments
            </h2>
            <p className="text-xs text-[#475569] mt-1">
              Automated multi-dimensional evaluations conducted on your submitted code repositories by hiring partners.
            </p>
          </div>

          <EditorialButton
            variant="ghost"
            size="sm"
            onClick={() => void loadData()}
            title="Refresh Assessments"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </EditorialButton>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-xs font-mono text-[#64748B] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-[#B08D57]" />
            <span>Loading your project assessments...</span>
          </div>
        ) : assessments.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-[#64748B] border border-dashed border-[#E5E1D8] rounded-xl bg-[#F7F5F0]/50 p-8 space-y-3">
            <Code2 className="h-10 w-10 mx-auto text-[#94A3B8]" />
            <h3 className="text-base font-bold text-[#111827]">No project assessments yet</h3>
            <p className="max-w-md mx-auto text-[#64748B]">
              When recruiters evaluate your GitHub repositories, your detailed code quality reports, category scores, and improvement recommendations will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {assessments.map((item) => {
              const isCompleted = item.status === "completed";
              const score = item.overall_score ?? 0;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0]/60 hover:border-[#B08D57] hover:bg-[#FFFFFF] transition-all flex flex-col justify-between space-y-4 shadow-2xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3
                            className="text-xl font-normal text-[#111827]"
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {item.project_title}
                          </h3>
                          {item.is_shortlisted && (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#B08D57] bg-[#B08D57]/10 px-2 py-0.5 rounded-full font-bold">
                              <Star className="h-3 w-3 fill-current" /> Shortlisted
                            </span>
                          )}
                        </div>
                        <a
                          href={item.repository_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-[#B08D57] hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          <span className="truncate max-w-[260px]">
                            {item.repository_url.replace("https://github.com/", "")}
                          </span>
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        </a>
                      </div>

                      <StatusTag status={item.status} />
                    </div>

                    {/* Overall Score Readout or Ready Action Banner */}
                    {isCompleted ? (
                      <div className="p-3.5 rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] flex items-center justify-between">
                        <span className="font-mono text-xs uppercase tracking-wider text-[#64748B] font-semibold">
                          Overall Assessment Score
                        </span>
                        <div className="font-mono text-right">
                          <span
                            className={`text-2xl font-normal ${
                              score >= 85
                                ? "text-[#166534]"
                                : score >= 70
                                ? "text-[#A67C3A]"
                                : "text-[#475569]"
                            }`}
                            style={{ fontFamily: "var(--font-display)" }}
                          >
                            {score}
                          </span>
                          <span className="text-xs text-[#94A3B8]"> / 100</span>
                        </div>
                      </div>
                    ) : item.status === "ready" ? (
                      <div className="p-3.5 rounded-lg border border-[#B08D57]/40 bg-[#FFFFFF] space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs uppercase tracking-wider text-[#B08D57] font-semibold flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-[#B08D57]" />
                            <span>Assessment Ready</span>
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#854D0E] bg-[#FEF9C3] px-2 py-0.5 rounded-full border border-[#FDE047]/60">
                            5 Questions
                          </span>
                        </div>
                        <p className="text-xs text-[#475569]">
                          A recruiter submitted your project repository. Take the 5 repository-tailored questions to record your official score.
                        </p>
                      </div>
                    ) : null}

                    {/* Tech stack */}
                    {item.technologies && item.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.technologies.slice(0, 5).map((tech) => (
                          <span
                            key={tech}
                            className="font-mono text-[10.5px] border border-[#E5E1D8] bg-[#FFFFFF] text-[#475569] px-2 py-0.5 rounded-md"
                          >
                            {tech}
                          </span>
                        ))}
                        {item.technologies.length > 5 && (
                          <span className="font-mono text-[10px] text-[#94A3B8]">
                            +{item.technologies.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {item.status === "ready" ? (
                    <div className="pt-3 border-t border-[#B08D57]/30 flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-[#854D0E] font-medium flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5 fill-current text-[#B08D57]" />
                        <span>Action Required</span>
                      </span>
                      <div className="flex items-center gap-2">
                        <EditorialButton
                          variant="accent"
                          size="sm"
                          onClick={() => handleStartAssessment(item.id)}
                          disabled={isLoadingQuiz}
                        >
                          <Zap className="h-3.5 w-3.5 fill-current" />
                          <span>Take Assessment</span>
                        </EditorialButton>
                        <EditorialButton
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDetail(item.id)}
                        >
                          <span>Details</span>
                        </EditorialButton>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-[#E5E1D8]/60 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-[#64748B]">
                        {item.completed_at
                          ? `Evaluated on ${new Date(item.completed_at).toLocaleDateString()}`
                          : "Evaluation in progress"}
                      </span>

                      <LiquidGlassButton
                        size="sm"
                        variant="primary"
                        onClick={() => handleOpenDetail(item.id)}
                      >
                        <span>{isCompleted ? "View Results" : "View Assessment"}</span>
                        <ChevronRight className="h-3 w-3" />
                      </LiquidGlassButton>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </EditorialCard>

      {/* Assessment Detailed Modal */}
      <AnimatePresence>
        {selectedAssessmentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0F172A]/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[20px] border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xl relative text-[#111827] space-y-6"
            >
              {/* Modal Close Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedAssessmentId(null);
                  setDetailAssessment(null);
                }}
                className="absolute top-6 right-6 p-2 rounded-full border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {isLoadingDetail || !detailAssessment ? (
                <div className="py-24 text-center text-xs font-mono text-[#64748B] flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-[#B08D57]" />
                  <span>Loading assessment report...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="border-b border-[#E5E1D8] pb-5 pr-12">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
                      <span>AUTOMATED PROJECT ASSESSMENT REPORT</span>
                    </div>

                    <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2
                          className="text-3xl font-normal text-[#111827]"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {detailAssessment.project_title}
                        </h2>
                        <a
                          href={detailAssessment.repository_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-[#B08D57] hover:underline inline-flex items-center gap-1.5 mt-1"
                        >
                          <Code2 className="h-3.5 w-3.5" />
                          <span>{detailAssessment.repository_url}</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>

                      {/* Overall Score Readout */}
                      {detailAssessment.overall_score !== null && (
                        <div className="p-3.5 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] flex items-center gap-4 shrink-0">
                          <div className="text-right font-mono">
                            <span className="text-[10px] uppercase text-[#64748B] block font-semibold">
                              Overall Score
                            </span>
                            <div
                              className="text-3xl font-normal text-[#166534] leading-none mt-1"
                              style={{ fontFamily: "var(--font-display)" }}
                            >
                              {detailAssessment.overall_score}
                              <span className="text-xs text-[#94A3B8]">/100</span>
                            </div>
                          </div>
                          <StatusTag status={detailAssessment.status} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary */}
                  {detailAssessment.assessment_summary && (
                    <div className="p-4 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0]/60">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-[#64748B] block font-semibold mb-1">
                        Executive Summary
                      </span>
                      <p className="text-xs text-[#334155] leading-relaxed font-sans">
                        {detailAssessment.assessment_summary}
                      </p>
                    </div>
                  )}

                  {/* Category Scores */}
                  {detailAssessment.category_scores && detailAssessment.category_scores.length > 0 && (
                    <div className="space-y-3">
                      <span className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold block border-b border-[#E5E1D8] pb-2">
                        Dimension Breakdown (7 Categories)
                      </span>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {detailAssessment.category_scores.map((cat) => {
                          const maxScore = cat.max_score || 100;
                          const percentage = Math.min(100, Math.round((cat.score / maxScore) * 100));
                          return (
                            <div
                              key={cat.id || cat.category_name}
                              className="p-3.5 rounded-xl border border-[#E5E1D8] bg-[#FFFFFF] space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#111827]">{cat.category_name}</span>
                                <span className="font-mono text-xs font-bold text-[#166534]">
                                  {cat.score} / {maxScore}
                                </span>
                              </div>

                              <div className="h-1.5 rounded-full bg-[#F7F5F0] overflow-hidden border border-[#E5E1D8]">
                                <div
                                  className="h-full bg-[#B08D57] rounded-full transition-all duration-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>

                              {cat.feedback && (
                                <p className="text-[11px] text-[#64748B] leading-tight pt-0.5">
                                  {cat.feedback}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Strengths & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Strengths */}
                    <div className="p-4 rounded-xl border border-[#86EFAC]/40 bg-[#DCFCE7]/20 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#166534]">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Strengths</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-[#334155]">
                        {detailAssessment.strengths && detailAssessment.strengths.length > 0 ? (
                          detailAssessment.strengths.map((str, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-[#166534] font-bold mt-0.5">✓</span>
                              <span>{str}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-[#64748B] italic">No specific strengths recorded.</li>
                        )}
                      </ul>
                    </div>

                    {/* Improvements */}
                    <div className="p-4 rounded-xl border border-[#FDE047]/40 bg-[#FEF9C3]/20 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#854D0E]">
                        <Sparkles className="h-4 w-4" />
                        <span>Actionable Recommendations</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-[#334155]">
                        {detailAssessment.improvements && detailAssessment.improvements.length > 0 ? (
                          detailAssessment.improvements.map((imp, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-[#854D0E] font-bold mt-0.5">•</span>
                              <span>{imp}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-[#64748B] italic">No significant improvements needed.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Questions & Performance Review */}
                  {detailAssessment.questions && detailAssessment.questions.length > 0 && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-2">
                        <span className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold">
                          Assessment Questions & Review ({detailAssessment.questions.length} Questions)
                        </span>
                        {detailAssessment.status === "completed" && (
                          <span className="font-mono text-xs text-[#166534] font-bold">
                            Marks: {detailAssessment.overall_score ?? 0} / 100
                          </span>
                        )}
                      </div>

                      {detailAssessment.status === "ready" && (
                        <div className="p-4 rounded-xl border border-[#B08D57]/40 bg-[rgba(176,141,87,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <span className="font-mono text-xs uppercase tracking-wider text-[#854D0E] font-bold block">
                              Assessment Ready to Take
                            </span>
                            <p className="text-xs text-[#334155] mt-0.5">
                              5 technical questions tailored to this repository are prepared. Take the test now to record your score!
                            </p>
                          </div>
                          <EditorialButton
                            variant="accent"
                            size="md"
                            onClick={() => {
                              const targetId = detailAssessment.id;
                              setSelectedAssessmentId(null);
                              setDetailAssessment(null);
                              void handleStartAssessment(targetId);
                            }}
                          >
                            <Zap className="h-4 w-4 fill-current" />
                            <span>Start Test Now</span>
                          </EditorialButton>
                        </div>
                      )}

                      <div className="space-y-3">
                        {detailAssessment.questions.map((q, idx) => {
                          const studentAns = detailAssessment.student_answers?.[q.id] || q.student_selected_option;
                          const isCorrect = q.is_correct ?? (studentAns && q.correct_answer ? studentAns === q.correct_answer : null);

                          return (
                            <div key={q.id || idx} className="p-4 rounded-xl border border-[#E5E1D8] bg-[#FFFFFF] space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <span className="font-mono text-[10px] uppercase font-bold text-[#B08D57]">
                                    Question {idx + 1} · {q.category || "Technical"}
                                  </span>
                                  <p className="text-xs font-medium text-[#111827]">{q.question}</p>
                                </div>

                                {detailAssessment.status === "completed" && isCorrect !== null && (
                                  <span
                                    className={`inline-flex items-center gap-1 font-mono text-[11px] px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                                      isCorrect
                                        ? "bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]"
                                        : "bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5]"
                                    }`}
                                  >
                                    {isCorrect ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3" /> Correct
                                      </>
                                    ) : (
                                      <>
                                        <X className="h-3 w-3" /> Incorrect
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>

                              {/* Options List */}
                              <div className="grid grid-cols-1 gap-1.5 pt-1">
                                {q.options.map((opt, oIdx) => {
                                  const optLetter = ["A", "B", "C", "D"][oIdx] || String.fromCharCode(65 + oIdx);
                                  const isSelected = studentAns === optLetter;
                                  const isAnswer = q.correct_answer === optLetter;

                                  return (
                                    <div
                                      key={oIdx}
                                      className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                                        detailAssessment.status === "completed" && isAnswer
                                          ? "border-[#166534] bg-[#DCFCE7]/40 text-[#166534] font-medium"
                                          : detailAssessment.status === "completed" && isSelected && !isCorrect
                                          ? "border-[#B91C1C] bg-[#FEE2E2]/40 text-[#B91C1C]"
                                          : isSelected
                                          ? "border-[#B08D57] bg-[rgba(176,141,87,0.08)] text-[#111827] font-medium"
                                          : "border-[#E5E1D8] bg-[#F7F5F0]/40 text-[#475569]"
                                      }`}
                                    >
                                      <span className="font-mono font-bold">{optLetter})</span>
                                      <span>{opt.replace(/^[A-D]\)\s*/, "")}</span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Explanation if completed */}
                              {detailAssessment.status === "completed" && q.explanation && (
                                <div className="p-3 rounded-lg bg-[#F7F5F0] border border-[#E5E1D8] text-[11.5px] text-[#334155] leading-relaxed">
                                  <span className="font-bold text-[#854D0E] block mb-0.5">Explanation:</span>
                                  {q.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Detected Technologies */}
                  {detailAssessment.technologies && detailAssessment.technologies.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold block">
                        Technologies Detected
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {detailAssessment.technologies.map((tech) => (
                          <span
                            key={tech}
                            className="font-mono text-xs border border-[#B08D57]/30 bg-[rgba(176,141,87,0.06)] text-[#111827] px-3 py-1 rounded-full font-medium"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Close button */}
                  <div className="pt-4 border-t border-[#E5E1D8] flex justify-end">
                    <EditorialButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedAssessmentId(null);
                        setDetailAssessment(null);
                      }}
                    >
                      Close Report
                    </EditorialButton>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Quiz Taking Modal */}
      <AnimatePresence>
        {takingAssessment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0F172A]/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-[24px] border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xl relative text-[#111827] space-y-6"
            >
              {/* Close confirmation button */}
              <button
                type="button"
                onClick={() => {
                  if (Object.keys(quizAnswers).length > 0) {
                    if (!window.confirm("Are you sure you want to exit? Your answers will not be saved until submitted.")) {
                      return;
                    }
                  }
                  setTakingAssessment(null);
                }}
                className="absolute top-6 right-6 p-2 rounded-full border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827] transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Stepper Header */}
              <div className="border-b border-[#E5E1D8] pb-4 pr-12">
                <div className="text-[11px] font-mono uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>REPOSITORY TECHNICAL ASSESSMENT</span>
                </div>
                <h2
                  className="text-2xl font-normal text-[#111827] mt-1 truncate"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {takingAssessment.project_title}
                </h2>
                <div className="flex items-center justify-between text-xs font-mono text-[#64748B] mt-2">
                  <span>
                    Question {currentQuestionIndex + 1} of {takingAssessment.questions?.length || 5}
                  </span>
                  <span>
                    {Object.keys(quizAnswers).length} of {takingAssessment.questions?.length || 5} Answered
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-[#F7F5F0] rounded-full overflow-hidden mt-2 border border-[#E5E1D8]">
                  <div
                    className="h-full bg-[#B08D57] transition-all duration-300 rounded-full"
                    style={{
                      width: `${(((currentQuestionIndex + 1) / (takingAssessment.questions?.length || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Current Question */}
              {takingAssessment.questions && takingAssessment.questions.length > 0 && takingAssessment.questions[currentQuestionIndex] ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[rgba(176,141,87,0.12)] text-[#854D0E] border border-[#B08D57]/30">
                      {takingAssessment.questions[currentQuestionIndex].category || "Technical Implementation"}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
                      {takingAssessment.questions[currentQuestionIndex].difficulty || "Intermediate"}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-[#111827] leading-relaxed">
                    {takingAssessment.questions[currentQuestionIndex].question}
                  </h3>

                  {/* Options list */}
                  <div className="space-y-3 pt-1">
                    {takingAssessment.questions[currentQuestionIndex].options.map((optionText, optIdx) => {
                      const optKey = ["A", "B", "C", "D"][optIdx] || String.fromCharCode(65 + optIdx);
                      const qId = takingAssessment.questions![currentQuestionIndex].id;
                      const isSelected = quizAnswers[qId] === optKey;

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSelectOption(qId, optKey)}
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
                      onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                      disabled={currentQuestionIndex === 0}
                    >
                      Previous
                    </EditorialButton>

                    <div className="flex items-center gap-2">
                      {currentQuestionIndex < (takingAssessment.questions?.length || 1) - 1 ? (
                        <EditorialButton
                          variant="primary"
                          size="sm"
                          onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                        >
                          <span>Next Question</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </EditorialButton>
                      ) : (
                        <EditorialButton
                          variant="accent"
                          size="md"
                          onClick={handleSubmitAssessment}
                          disabled={isSubmittingQuiz}
                        >
                          {isSubmittingQuiz ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          <span>{isSubmittingQuiz ? "Submitting..." : "Submit Assessment"}</span>
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
    </div>
  );
}
