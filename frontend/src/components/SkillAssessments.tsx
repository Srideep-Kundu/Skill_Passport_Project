import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { Assessment, AssessmentAttempt } from "../api/types";
import { toast } from "sonner";

interface Props {
  token: string;
  onAssessmentCompleted?: () => void;
}

export function SkillAssessments({ token, onAssessmentCompleted }: Props) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAssessment, setActiveAssessment] = useState<Assessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [attemptResult, setAttemptResult] = useState<AssessmentAttempt | null>(null);

  const loadAssessments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAssessments(token);
      setAssessments(data);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load skill assessments"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAssessments();
  }, [loadAssessments]);

  async function handleStartAssessment(assessmentId: string) {
    try {
      setLoading(true);
      const details = await api.getAssessment(assessmentId, token);
      setActiveAssessment(details);
      setAnswers({});
      setCurrentQuestionIdx(0);
      setAttemptResult(null);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load assessment questions"));
    } finally {
      setLoading(false);
    }
  }

  function handleSelectOption(questionId: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  async function handleSubmit() {
    if (!activeAssessment) return;
    try {
      setSubmitting(true);
      const result = await api.submitAssessment(activeAssessment.id, answers, token);
      setAttemptResult(result);
      if (result.passed) {
        toast.success(`Passed with ${result.percentage}%! Added to Skill Passport as Verified Evidence.`);
        if (onAssessmentCompleted) onAssessmentCompleted();
      } else {
        toast.error(`Score: ${result.percentage}%. Passing score is ${activeAssessment.passing_score}%. Review courses and retry!`);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Failed to submit assessment"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !activeAssessment) {
    return (
      <div className="p-8 text-center bg-white dark:bg-[#151921] rounded-2xl border border-slate-200 dark:border-white/[0.08] shadow-xs">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-[#3b71d9] border-t-transparent rounded-full mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading diagnostic assessments catalog...</p>
      </div>
    );
  }

  // Active quiz screen
  if (activeAssessment && activeAssessment.questions && activeAssessment.questions.length > 0) {
    const questions = activeAssessment.questions;
    const currentQ = questions[currentQuestionIdx];
    const answeredCount = Object.keys(answers).length;

    if (attemptResult) {
      return (
        <div className="bg-white dark:bg-[#151921] rounded-2xl p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs text-center max-w-xl mx-auto space-y-6">
          <div className="inline-flex p-4 rounded-full bg-slate-50 dark:bg-white/[0.05]">
            {attemptResult.passed ? (
              <Award className="h-16 w-16 text-emerald-500" />
            ) : (
              <XCircle className="h-16 w-16 text-amber-500" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {attemptResult.passed ? "Assessment Passed!" : "Needs Improvement"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {attemptResult.assessment_title}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.06] flex items-center justify-around">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500">Your Score</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{attemptResult.percentage}%</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500">Passing Threshold</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{activeAssessment.passing_score}%</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-500">Status</span>
              <p className={`text-base font-bold ${attemptResult.passed ? "text-emerald-600" : "text-amber-600"}`}>
                {attemptResult.passed ? "Verified" : "Retake"}
              </p>
            </div>
          </div>

          {attemptResult.passed && (
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-left text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Passport Updated:</strong> A certified evidence badge with extraction confidence 0.95 and tier <code className="font-bold">VERIFIED</code> has been registered under your Skill Passport.
              </span>
            </div>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setActiveAssessment(null)}
              className="px-5 py-2.5 bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-sm font-semibold rounded-xl cursor-pointer"
            >
              Back to Catalog
            </button>
            {!attemptResult.passed && (
              <button
                onClick={() => {
                  setAnswers({});
                  setCurrentQuestionIdx(0);
                  setAttemptResult(null);
                }}
                className="px-5 py-2.5 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Retry Assessment
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{activeAssessment.title}</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Question {currentQuestionIdx + 1} of {questions.length} • {answeredCount} Answered
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9] dark:text-[#b0c6ff] text-xs font-bold rounded-lg flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {activeAssessment.duration_minutes} Mins
            </span>
            <button
              onClick={() => setActiveAssessment(null)}
              className="px-3 py-1 bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Quit
            </button>
          </div>
        </div>

        {/* Question body */}
        <div className="space-y-4">
          <p className="text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
            {currentQ.question_text}
          </p>

          <div className="grid grid-cols-1 gap-2.5 pt-2">
            {currentQ.options.map((opt) => {
              const isSelected = answers[currentQ.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => handleSelectOption(currentQ.id, opt)}
                  className={`p-4 rounded-xl text-left text-sm font-medium transition-all cursor-pointer border ${
                    isSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/40 border-[#3b71d9] text-[#3b71d9] dark:text-[#b0c6ff] shadow-xs"
                      : "bg-slate-50/60 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{opt}</span>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-[#3b71d9] shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation & Submit */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/[0.06]">
          <button
            onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
            disabled={currentQuestionIdx === 0}
            className="px-4 py-2 bg-slate-100 dark:bg-white/[0.08] hover:bg-slate-200 disabled:opacity-40 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
          >
            Previous
          </button>

          {currentQuestionIdx < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestionIdx((p) => Math.min(questions.length - 1, p + 1))}
              className="px-4 py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              Next Question
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || answeredCount === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? "Grading..." : "Submit Assessment"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Catalog view
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-5 w-5 text-[#3b71d9]" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Diagnostic Skill Assessments</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Standardized technical assessments validating core capabilities into your Skill Passport with verifiable evidence records.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {assessments.map((ass) => (
          <div
            key={ass.id}
            className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-white/[0.15] transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9] dark:text-[#b0c6ff]">
                  {ass.category}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {ass.duration_minutes} mins
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{ass.title}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Targeted skill validation for <strong>{ass.canonical_skill_name}</strong>. Pass score: {ass.passing_score}%.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {ass.question_count || 5} Interactive Questions
              </span>
              <button
                onClick={() => handleStartAssessment(ass.id)}
                className="px-4 py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shadow-[#3b71d9]/20"
              >
                <Play className="h-3.5 w-3.5" />
                Start Test
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
