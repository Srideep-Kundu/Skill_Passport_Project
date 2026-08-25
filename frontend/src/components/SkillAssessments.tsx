import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { Assessment, AssessmentAttempt } from "../api/types";
import { toast } from "sonner";
import { EditorialButton, EditorialPageHeader } from "./ui/EditorialPrimitives";

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
      <div className="p-12 text-center border border-white/10 bg-[#071E2B] rounded-md">
        <div className="inline-block animate-spin h-6 w-6 border-2 border-white/20 border-t-white rounded-full mb-3" />
        <p className="font-mono text-xs text-[#8796A2]">Loading diagnostic assessments catalog...</p>
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
        <div className="border border-white/10 bg-[#071E2B] p-8 rounded-md text-center max-w-xl mx-auto space-y-6 font-sans">
          <div className="inline-flex p-4 rounded-full border border-white/10 bg-white/[0.02]">
            {attemptResult.passed ? (
              <Award className="h-12 w-12 text-emerald-400" />
            ) : (
              <XCircle className="h-12 w-12 text-[#9CC7D8]" />
            )}
          </div>
          <div className="space-y-1">
            <h2
              className="text-2xl font-normal text-[#F7F8F8]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {attemptResult.passed ? "Assessment Passed" : "Needs Improvement"}
            </h2>
            <p className="font-mono text-xs text-[#8796A2]">
              {attemptResult.assessment_title}
            </p>
          </div>

          <div className="p-4 rounded-sm border border-white/10 bg-white/[0.02] flex items-center justify-around font-mono">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#8796A2] block">Your Score</span>
              <p className="text-2xl font-normal text-[#F7F8F8] mt-0.5">{attemptResult.percentage}%</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#8796A2] block">Threshold</span>
              <p className="text-2xl font-normal text-[#F7F8F8] mt-0.5">{activeAssessment.passing_score}%</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#8796A2] block">Status</span>
              <p className={`text-sm font-semibold mt-1 ${attemptResult.passed ? "text-emerald-400" : "text-[#9CC7D8]"}`}>
                {attemptResult.passed ? "Verified" : "Retake"}
              </p>
            </div>
          </div>

          {attemptResult.passed && (
            <div className="p-4 rounded-sm border border-white/15 bg-white/5 text-left text-xs font-mono text-[#BEC8CF]">
              <span className="text-[#F7F8F8] font-bold">Passport Updated: </span>
              A certified evidence record with tier VERIFIED has been registered under your Skill Passport.
            </div>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <EditorialButton
              variant="secondary"
              onClick={() => setActiveAssessment(null)}
            >
              Back to Catalog
            </EditorialButton>
            {!attemptResult.passed && (
              <EditorialButton
                variant="primary"
                onClick={() => {
                  setAnswers({});
                  setCurrentQuestionIdx(0);
                  setAttemptResult(null);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Retry Assessment
              </EditorialButton>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-6 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2
              className="text-xl font-normal text-[#F7F8F8]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {activeAssessment.title}
            </h2>
            <span className="font-mono text-xs text-[#8796A2]">
              Question {currentQuestionIdx + 1} of {questions.length} · {answeredCount} Answered
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="border border-white/10 bg-white/[0.02] px-2.5 py-1 text-[#9CC7D8] rounded-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{activeAssessment.duration_minutes} Mins</span>
            </span>
            <button
              type="button"
              onClick={() => setActiveAssessment(null)}
              className="text-[#8796A2] hover:text-[#F7F8F8] cursor-pointer"
            >
              Quit
            </button>
          </div>
        </div>

        {/* Question body */}
        <div className="space-y-4">
          <p className="text-base text-[#F7F8F8] leading-relaxed">
            {currentQ.question_text}
          </p>

          <div className="grid grid-cols-1 gap-2.5 pt-2 font-mono text-xs">
            {currentQ.options.map((opt) => {
              const isSelected = answers[currentQ.id] === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelectOption(currentQ.id, opt)}
                  className={`p-3.5 rounded-sm text-left transition-colors cursor-pointer border ${
                    isSelected
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/10 bg-white/[0.02] text-[#BEC8CF] hover:border-white/20 hover:text-white"
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

        {/* Navigation & Submit */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
            disabled={currentQuestionIdx === 0}
            className="font-mono text-xs text-[#8796A2] hover:text-white disabled:opacity-30 cursor-pointer"
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
              onClick={handleSubmit}
              disabled={submitting || answeredCount === 0}
            >
              {submitting ? "Grading..." : "Submit Assessment"}
            </EditorialButton>
          )}
        </div>
      </div>
    );
  }

  // Catalog view
  return (
    <div className="space-y-6 font-sans">
      <EditorialPageHeader
        category="STUDENT"
        index="DIAGNOSTIC"
        title="Diagnostic Skill Assessments"
        subtitle="Standardized technical assessments validating core capabilities into your Skill Passport with verifiable evidence records."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {assessments.map((ass) => (
          <div
            key={ass.id}
            className="border border-white/10 bg-[#071E2B] p-6 rounded-md flex flex-col justify-between space-y-4 hover:border-white/20 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase text-[#8796A2]">
                <span className="border border-white/10 px-2 py-0.5 rounded-xs">{ass.category}</span>
                <span className="flex items-center gap-1 text-[#9CC7D8]">
                  <Clock className="h-3 w-3" />
                  <span>{ass.duration_minutes} mins</span>
                </span>
              </div>
              <h3
                className="text-xl font-normal text-[#F7F8F8]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {ass.title}
              </h3>
              <p className="text-xs text-[#BEC8CF] leading-relaxed">
                Targeted skill validation for <strong className="text-white font-mono">{ass.canonical_skill_name}</strong>. Pass threshold: {ass.passing_score}%.
              </p>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs">
              <span className="text-[#8796A2]">
                {ass.question_count || 5} Questions
              </span>
              <EditorialButton
                variant="primary"
                onClick={() => handleStartAssessment(ass.id)}
              >
                <Play className="h-3 w-3 mr-1" />
                <span>Start Test</span>
              </EditorialButton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
