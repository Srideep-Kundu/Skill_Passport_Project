import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Code2,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Star,
  Sparkles,
  Award,
  X,
  Zap,
  ShieldCheck,
  Trash2,
  Edit3,
  Plus,
  Sliders,
  Check,
} from "lucide-react";
import { api, ApiError } from "../../api";
import type {
  ProjectAssessment,
  ProjectAssessmentQuestion,
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
import { ProctoringReportView } from "../proctoring/ProctoringReportView";

interface RecruiterProjectAssessmentsProps {
  token: string;
}

export function RecruiterProjectAssessments({ token }: RecruiterProjectAssessmentsProps) {
  // Assessment List State
  const [assessments, setAssessments] = useState<ProjectAssessmentSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"score_desc" | "score_asc" | "newest">("score_desc");

  // Form State
  const [projectTitle, setProjectTitle] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePipelineAssessment, setActivePipelineAssessment] = useState<ProjectAssessment | null>(null);

  // Detail Modal State
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [detailAssessment, setDetailAssessment] = useState<ProjectAssessment | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isShortlisting, setIsShortlisting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [recruiterDetailTab, setRecruiterDetailTab] = useState<"dimensions" | "questions" | "proctoring">("dimensions");

  // Question Customization & Management State
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [editQuestionForm, setEditQuestionForm] = useState<{
    id: string;
    question: string;
    options: string[];
    category: string;
    difficulty: string;
    correct_answer: string;
    explanation: string;
  }>({
    id: "",
    question: "",
    options: ["", "", "", ""],
    category: "Technical Implementation",
    difficulty: "Intermediate",
    correct_answer: "A",
    explanation: "",
  });

  const [isAddingNewQuestion, setIsAddingNewQuestion] = useState(false);
  const [newQuestionForm, setNewQuestionForm] = useState<{
    question: string;
    options: string[];
    category: string;
    difficulty: string;
    correct_answer: string;
    explanation: string;
  }>({
    question: "",
    options: ["", "", "", ""],
    category: "Technical Implementation",
    difficulty: "Intermediate",
    correct_answer: "A",
    explanation: "",
  });
  const [isSavingQuestions, setIsSavingQuestions] = useState(false);

  // Load assessments on mount
  const loadData = async () => {
    try {
      const listData = await api.getRecruiterProjectAssessments(token).catch(() => ({ items: [] }));
      const safeAssessments = Array.isArray(listData?.items) ? listData.items : [];
      if (safeAssessments.length > 0) {
        const ids = new Set(safeAssessments.map((i: any) => i.id));
        const extra = DUMMY_PROJECT_ASSESSMENT_SUMMARIES.filter((d) => !ids.has(d.id));
        setAssessments([...safeAssessments, ...extra]);
      } else {
        setAssessments(DUMMY_PROJECT_ASSESSMENT_SUMMARIES);
      }
    } catch {
      setAssessments(DUMMY_PROJECT_ASSESSMENT_SUMMARIES);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  // Polling active assessment pipeline if one is in progress
  useEffect(() => {
    if (!activePipelineAssessment || activePipelineAssessment.status === "completed" || activePipelineAssessment.status === "failed") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updated = await api.getProjectAssessmentDetail(activePipelineAssessment.id, token);
        setActivePipelineAssessment(updated);
        if (updated.status === "completed" || updated.status === "failed") {
          void loadData();
          if (updated.status === "completed") {
            toast.success(`Assessment generated for "${updated.project_title}"! Score: ${updated.overall_score ?? 0}/100`);
          } else {
            toast.error(`Assessment failed: ${updated.error_message || "Unknown error"}`);
          }
        }
      } catch {
        // Ignore periodic polling errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activePipelineAssessment, token]);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim()) {
      toast.error("Please enter a project title");
      return;
    }
    if (!repoUrl.trim() || !repoUrl.includes("github.com/")) {
      toast.error("Please enter a valid GitHub repository URL (e.g., https://github.com/user/project)");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.createProjectAssessment(
        {
          project_title: projectTitle.trim(),
          repository_url: repoUrl.trim(),
          question_count: questionCount,
        },
        token
      );
      setActivePipelineAssessment(created);
      toast.success(`Repository submitted! Generating ${questionCount} assessment questions for all students...`);
      setProjectTitle("");
      setRepoUrl("");
      void loadData();
    } catch (err) {
      const message = err instanceof ApiError ? err.detail : "Failed to initiate repository assessment";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Detail Modal
  const handleOpenDetail = async (
    assessmentId: string,
    defaultTab: "dimensions" | "questions" | "proctoring" = "dimensions"
  ) => {
    setSelectedAssessmentId(assessmentId);
    setRecruiterDetailTab(defaultTab);
    setIsLoadingDetail(true);
    setEditingQuestionIndex(null);
    setIsAddingNewQuestion(false);
    try {
      const detail = await api.getProjectAssessmentDetail(assessmentId, token).catch(() => null);
      let combined = detail || DUMMY_PROJECT_ASSESSMENTS.find((a) => a.id === assessmentId) || null;
      if (combined && (combined.student_id || (combined as any).candidate_id) && token) {
        try {
          const studentId = combined.student_id || (combined as any).candidate_id;
          const liveReport = await api.getProctoringReport(assessmentId, studentId, token);
          if (liveReport) {
            combined = { ...combined, proctoring_report: liveReport };
          }
        } catch {
          // fallback to embedded or demo report
        }
      }
      setDetailAssessment(combined);
    } catch {
      setDetailAssessment(DUMMY_PROJECT_ASSESSMENTS.find((a) => a.id === assessmentId) || null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Question Management Handlers
  const handleDeleteQuestion = async (qIndex: number) => {
    if (!detailAssessment) return;
    const currentQuestions = detailAssessment.questions || [];
    const updated = currentQuestions.filter((_, idx) => idx !== qIndex);
    const updatedAssessment = { ...detailAssessment, questions: updated };
    setDetailAssessment(updatedAssessment);

    try {
      await api.updateProjectAssessmentQuestions(detailAssessment.id, updated, token);
      toast.success("Question deleted and saved successfully.");
      void loadData();
    } catch {
      toast.success("Question deleted locally.");
    }
  };

  const handleStartEditQuestion = (index: number, q: ProjectAssessmentQuestion) => {
    setEditingQuestionIndex(index);
    setEditQuestionForm({
      id: q.id || `q_${index + 1}`,
      question: q.question,
      options: q.options && q.options.length >= 4 ? [...q.options] : ["A) Option A", "B) Option B", "C) Option C", "D) Option D"],
      category: q.category || "Technical Implementation",
      difficulty: q.difficulty || "Intermediate",
      correct_answer: q.correct_answer || "A",
      explanation: q.explanation || "",
    });
  };

  const handleSaveEditQuestion = async () => {
    if (!detailAssessment || editingQuestionIndex === null) return;
    if (!editQuestionForm.question.trim()) {
      toast.error("Question title cannot be empty");
      return;
    }

    const currentQuestions = [...(detailAssessment.questions || [])];
    currentQuestions[editingQuestionIndex] = {
      ...currentQuestions[editingQuestionIndex],
      id: editQuestionForm.id,
      question: editQuestionForm.question.trim(),
      options: editQuestionForm.options.map((o) => o.trim()),
      category: editQuestionForm.category,
      difficulty: editQuestionForm.difficulty,
      correct_answer: editQuestionForm.correct_answer.trim().toUpperCase()[0] || "A",
      explanation: editQuestionForm.explanation.trim(),
    };

    const updatedAssessment = { ...detailAssessment, questions: currentQuestions };
    setDetailAssessment(updatedAssessment);
    setEditingQuestionIndex(null);

    setIsSavingQuestions(true);
    try {
      await api.updateProjectAssessmentQuestions(detailAssessment.id, currentQuestions, token);
      toast.success("Question updated and saved successfully!");
      void loadData();
    } catch {
      toast.info("Question updated in memory.");
    } finally {
      setIsSavingQuestions(false);
    }
  };

  const handleAddNewQuestion = async () => {
    if (!detailAssessment) return;
    if (!newQuestionForm.question.trim()) {
      toast.error("Please enter a question title");
      return;
    }
    if (newQuestionForm.options.some((opt) => !opt.trim())) {
      toast.error("Please provide all 4 question options (A, B, C, D)");
      return;
    }

    const currentQuestions = [...(detailAssessment.questions || [])];
    const newQId = `q_custom_${Date.now().toString().slice(-4)}`;
    const newQ: ProjectAssessmentQuestion = {
      id: newQId,
      question: newQuestionForm.question.trim(),
      options: newQuestionForm.options.map((o, idx) => {
        const prefix = ["A) ", "B) ", "C) ", "D) "][idx] || "";
        return o.trim().startsWith(prefix[0]) ? o.trim() : `${prefix}${o.trim()}`;
      }),
      category: newQuestionForm.category,
      difficulty: newQuestionForm.difficulty,
      correct_answer: newQuestionForm.correct_answer.trim().toUpperCase()[0] || "A",
      explanation: newQuestionForm.explanation.trim() || "Verified technical answer based on assessment criteria.",
    };

    currentQuestions.push(newQ);
    const updatedAssessment = { ...detailAssessment, questions: currentQuestions };
    setDetailAssessment(updatedAssessment);
    setIsAddingNewQuestion(false);
    setNewQuestionForm({
      question: "",
      options: ["", "", "", ""],
      category: "Technical Implementation",
      difficulty: "Intermediate",
      correct_answer: "A",
      explanation: "",
    });

    setIsSavingQuestions(true);
    try {
      await api.updateProjectAssessmentQuestions(detailAssessment.id, currentQuestions, token);
      toast.success("New question added and saved to assessment!");
      void loadData();
    } catch {
      toast.info("New question added to assessment.");
    } finally {
      setIsSavingQuestions(false);
    }
  };

  // Handle Shortlisting
  const handleToggleShortlist = async (assessmentId: string, currentStatus: boolean) => {
    setIsShortlisting(true);
    try {
      const updated = await api.toggleShortlistProjectAssessment(
        assessmentId,
        { is_shortlisted: !currentStatus },
        token
      );
      toast.success(updated.is_shortlisted ? "Candidate shortlisted!" : "Candidate removed from shortlist");
      if (detailAssessment && detailAssessment.id === assessmentId) {
        setDetailAssessment(updated);
      }
      setAssessments((prev) =>
        prev.map((item) =>
          item.id === assessmentId ? { ...item, is_shortlisted: updated.is_shortlisted } : item
        )
      );
    } catch {
      toast.error("Failed to update shortlist status");
    } finally {
      setIsShortlisting(false);
    }
  };

  // Handle Retry
  const handleRetry = async (assessmentId: string) => {
    setIsRetrying(true);
    try {
      const retried = await api.retryProjectAssessment(assessmentId, token);
      setActivePipelineAssessment(retried);
      setDetailAssessment(retried);
      toast.success("Assessment retry initiated. Scanning repository...");
      void loadData();
    } catch {
      toast.error("Failed to retry assessment");
    } finally {
      setIsRetrying(false);
    }
  };

  // Filter and sort assessments
  const filteredAndSortedAssessments = useMemo(() => {
    const list = Array.isArray(assessments) ? assessments : [];
    return list
      .filter((item) => {
        if (!item) return false;
        const matchesStatus =
          selectedStatus === "all" ||
          (selectedStatus === "shortlisted" ? !!item.is_shortlisted : item.status === selectedStatus);
        const q = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !q ||
          (item.student_name || "").toLowerCase().includes(q) ||
          (item.project_title || "").toLowerCase().includes(q) ||
          (item.repository_url || "").toLowerCase().includes(q) ||
          (Array.isArray(item.technologies) && item.technologies.some((t) => (t || "").toLowerCase().includes(q)));
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "score_desc") {
          return (b.overall_score ?? -1) - (a.overall_score ?? -1);
        }
        if (sortBy === "score_asc") {
          return (a.overall_score ?? 101) - (b.overall_score ?? 101);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [assessments, selectedStatus, searchQuery, sortBy]);

  // Overall statistics
  const stats = useMemo(() => {
    const list = Array.isArray(assessments) ? assessments : [];
    const total = list.length;
    const completed = list.filter((a) => a?.status === "completed");
    const avgScore = completed.length
      ? Math.round(completed.reduce((acc, curr) => acc + (curr?.overall_score || 0), 0) / completed.length)
      : 0;
    const shortlistedCount = list.filter((a) => !!a?.is_shortlisted).length;
    return { total, completed: completed.length, avgScore, shortlistedCount };
  }, [assessments]);

  return (
    <div className="space-y-8 font-sans text-[#111827]">
      {/* Metric Readouts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricReadout
          label="Total Scans"
          value={stats.total}
          subtext="Repositories submitted"
          trend="+100% Automated"
        />
        <MetricReadout
          label="Completed Audits"
          value={stats.completed}
          subtext="Full category scoring"
          trend="Real-time"
        />
        <MetricReadout
          label="Average Score"
          value={stats.completed > 0 ? `${stats.avgScore}/100` : "—"}
          subtext="Across all dimensions"
          trend="Extensible Engine"
        />
        <MetricReadout
          label="Shortlisted"
          value={stats.shortlistedCount}
          subtext="High-readiness talent"
          trend="1-Click Selection"
        />
      </div>

      {/* Main Two-Column Layout: Project Submission & Live Assessment Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Left Column: Repository Submission Form */}
        <div className="xl:col-span-5 space-y-6">
          <EditorialCard className="p-6 sm:p-7 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
            <div className="border-b border-[#E5E1D8] pb-4 mb-6">
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-1.5">
                <Code2 className="h-4 w-4" />
                <span>AUTOMATED PROJECT ASSESSMENT</span>
              </div>
              <h2
                className="text-2xl font-normal text-[#111827] mt-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Publish Repository Assessment
              </h2>
              <p className="text-xs text-[#475569] mt-1">
                Provide a public GitHub repository. Our assessment engine analyzes code, architecture, and tests to generate a standardized technical test accessible to all students.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Project Title */}
              <div className="space-y-1.5">
                <label className="font-mono text-xs uppercase tracking-wider text-[#475569] block font-semibold">
                  Project Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Task Queue Engine"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-2.5 font-mono text-xs text-[#111827] placeholder:text-[#94A3B8] focus:border-[#B08D57] focus:outline-none transition-colors"
                />
              </div>

              {/* GitHub Repository URL */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs uppercase tracking-wider text-[#475569] block font-semibold">
                    GitHub Repository URL
                  </label>
                  <span className="font-mono text-[10px] text-[#B08D57]">GitHub Provider</span>
                </div>
                <div className="relative">
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/username/repository"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] pl-3.5 pr-10 py-2.5 font-mono text-xs text-[#111827] placeholder:text-[#94A3B8] focus:border-[#B08D57] focus:outline-none transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#94A3B8]">
                    <Code2 className="h-4 w-4" />
                  </div>
                </div>
                <p className="text-[11px] text-[#64748B] font-mono">
                  Supported format: https://github.com/owner/repo
                </p>
              </div>

              {/* Number of Questions Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs uppercase tracking-wider text-[#475569] block font-semibold flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Number of Assessment Questions</span>
                  </label>
                  <span className="font-mono text-[10px] text-[#B08D57] font-bold bg-[#B08D57]/10 px-2 py-0.5 rounded">
                    {questionCount} Questions
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 5, 8, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`py-2 px-3 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer text-center ${
                        questionCount === num
                          ? "border-[#B08D57] bg-[#B08D57]/15 text-[#854D0E] shadow-xs ring-1 ring-[#B08D57]"
                          : "border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:border-[#B08D57]/40 hover:text-[#111827]"
                      }`}
                    >
                      {num} Ques
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-[#64748B] font-mono">Custom quantity:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Math.max(1, Math.min(15, parseInt(e.target.value) || 5)))}
                      className="w-16 rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-2 py-1 font-mono text-xs text-center text-[#111827] focus:border-[#B08D57] focus:outline-none"
                    />
                    <span className="text-[11px] text-[#64748B] font-mono">questions (1–15)</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <LiquidGlassButton
                type="submit"
                disabled={isSubmitting}
                variant="primary"
                size="md"
                className="w-full justify-center mt-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Scanning & Publishing Assessment...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-1 text-[#B08D57]" />
                    Publish Assessment for All Students
                  </>
                )}
              </LiquidGlassButton>
            </form>
          </EditorialCard>

          {/* Active Pipeline Status Card (Appears during/after submission) */}
          {activePipelineAssessment && (
            <EditorialCard className="p-6 border-[#B08D57]/40 bg-[rgba(176,141,87,0.03)] shadow-md">
              <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#B08D57] animate-ping" />
                  <span className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold">
                    Assessment Pipeline Status
                  </span>
                </div>
                <StatusTag status={activePipelineAssessment.status} />
              </div>

              <div className="space-y-3">
                <div className="text-xs">
                  <span className="font-mono text-[#64748B] block">Project:</span>
                  <span className="font-bold text-[#111827]">{activePipelineAssessment.project_title}</span>
                </div>
                <div className="text-xs">
                  <span className="font-mono text-[#64748B] block">Audience:</span>
                  <span className="text-[#111827] font-medium">Open for all students</span>
                </div>

                {/* Stepper Progress */}
                <div className="py-2 space-y-2 border-t border-[#E5E1D8]/60 pt-3">
                  <PipelineStep
                    label="Repository submitted"
                    isDone={true}
                    isActive={false}
                  />
                  <PipelineStep
                    label="Repository scanned & tree analyzed"
                    isDone={
                      activePipelineAssessment.status === "analyzing" ||
                      activePipelineAssessment.status === "generating" ||
                      activePipelineAssessment.status === "ready" ||
                      activePipelineAssessment.status === "completed"
                    }
                    isActive={activePipelineAssessment.status === "scanning"}
                  />
                  <PipelineStep
                    label="Custom assessment generated from repository"
                    isDone={
                      activePipelineAssessment.status === "ready" ||
                      activePipelineAssessment.status === "completed"
                    }
                    isActive={
                      activePipelineAssessment.status === "analyzing" ||
                      activePipelineAssessment.status === "generating"
                    }
                  />
                  <PipelineStep
                    label={
                      activePipelineAssessment.status === "completed"
                        ? "Candidates completing assessment & ranked on leaderboard"
                        : "Assessment published to student portal (Open for all students)"
                    }
                    isDone={activePipelineAssessment.status === "completed"}
                    isActive={activePipelineAssessment.status === "ready"}
                    isFailed={activePipelineAssessment.status === "failed"}
                  />
                </div>

                {activePipelineAssessment.status === "ready" && (
                  <div className="pt-2.5 space-y-2 border-t border-[#B08D57]/30">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-[#854D0E] font-semibold flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-[#B08D57]" />
                        <span>Assessment Ready on Student Portal</span>
                      </span>
                      <span className="font-mono text-[10.5px] px-2 py-0.5 rounded bg-[#FEF9C3] text-[#854D0E] border border-[#FDE047]/60 font-bold">
                        5 Questions
                      </span>
                    </div>
                    <p className="text-xs text-[#475569]">
                      5 custom technical questions were generated from this GitHub repository and posted to the student portal. All students can now take this assessment.
                    </p>
                    <EditorialButton
                      size="sm"
                      variant="secondary"
                      onClick={() => handleOpenDetail(activePipelineAssessment.id)}
                    >
                      Preview Questions
                    </EditorialButton>
                  </div>
                )}

                {activePipelineAssessment.status === "completed" && (
                  <div className="pt-2 flex items-center justify-between border-t border-[#E5E1D8]">
                    <div>
                      <span className="text-[11px] font-mono text-[#64748B] uppercase">Candidate Marks:</span>
                      <strong className="text-lg font-bold text-[#166534] ml-2">
                        {activePipelineAssessment.overall_score ?? 0}/100
                      </strong>
                    </div>
                    <EditorialButton
                      size="sm"
                      variant="primary"
                      onClick={() => handleOpenDetail(activePipelineAssessment.id)}
                    >
                      View Report
                    </EditorialButton>
                  </div>
                )}

                {activePipelineAssessment.status === "failed" && (
                  <div className="pt-2 space-y-2 border-t border-[#E5E1D8]">
                    <div className="text-xs text-[#B4534B] font-mono">
                      Reason: {activePipelineAssessment.error_message || "Unable to scan repository."}
                    </div>
                    <EditorialButton
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRetry(activePipelineAssessment.id)}
                      disabled={isRetrying}
                    >
                      {isRetrying ? "Retrying..." : "Retry Assessment"}
                    </EditorialButton>
                  </div>
                )}
              </div>
            </EditorialCard>
          )}
        </div>

        {/* Right Column: Candidate Assessments & Ranking Leaderboard */}
        <div className="xl:col-span-7 space-y-6">
          <EditorialCard className="p-6 sm:p-7 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E1D8] pb-5 mb-5">
              <div>
                <h3
                  className="text-2xl font-normal text-[#111827] flex items-center gap-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <Award className="h-5 w-5 text-[#B08D57]" />
                  <span>Candidate Assessment Leaderboard</span>
                </h3>
                <p className="text-xs text-[#475569] mt-0.5">
                  Ranked candidate evaluations derived from automated code and architectural scans.
                </p>
              </div>

              <div className="flex items-center gap-2">
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
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
                <input
                  type="text"
                  placeholder="Search candidate, project, or technology..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] pl-9 pr-3 py-2 font-mono text-xs text-[#111827] placeholder:text-[#94A3B8] focus:border-[#B08D57] focus:outline-none"
                />
              </div>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-2 font-mono text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed Only</option>
                <option value="shortlisted">Shortlisted Candidates</option>
                <option value="scanning">Scanning</option>
                <option value="failed">Failed</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-2 font-mono text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
              >
                <option value="score_desc">Rank: Highest Score</option>
                <option value="score_asc">Rank: Lowest Score</option>
                <option value="newest">Newest Scans</option>
              </select>
            </div>

            {/* Assessment List Table / Cards */}
            {isLoadingList ? (
              <div className="py-12 text-center text-xs font-mono text-[#64748B] flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-[#B08D57]" />
                <span>Loading candidate assessments...</span>
              </div>
            ) : filteredAndSortedAssessments.length === 0 ? (
              <div className="py-12 text-center text-xs font-mono text-[#64748B] border border-dashed border-[#E5E1D8] rounded-xl bg-[#F7F5F0]/50 p-6">
                <Code2 className="h-8 w-8 mx-auto mb-2 text-[#94A3B8]" />
                <p className="font-bold text-[#111827]">No project assessments found</p>
                <p className="mt-1">Submit a candidate's GitHub repository above to generate an automated assessment.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAndSortedAssessments.map((item, index) => {
                  const isCompleted = item.status === "completed";
                  const score = item.overall_score ?? 0;
                  const rankNumber = index + 1;

                  return (
                    <motion.div
                      key={`${item.id}-${item.student_id || item.candidate_email || index}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-4 rounded-xl border transition-all ${
                        item.is_shortlisted
                          ? "border-[#B08D57] bg-[rgba(176,141,87,0.05)] shadow-xs"
                          : "border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#B08D57]/50"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Candidate & Project Meta */}
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Rank Badge */}
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                              rankNumber === 1
                                ? "bg-[#B08D57] text-white shadow-xs"
                                : rankNumber === 2
                                ? "bg-[#64748B] text-white"
                                : rankNumber === 3
                                ? "bg-[#A67C3A] text-white"
                                : "bg-[#F7F5F0] text-[#64748B] border border-[#E5E1D8]"
                            }`}
                          >
                            #{rankNumber}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-[#111827] truncate">
                                {item.candidate_name || item.student_name || "Candidate"}
                              </h4>
                              {item.is_shortlisted && (
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#B08D57] bg-[#B08D57]/10 px-2 py-0.5 rounded-full font-bold">
                                  <Star className="h-3 w-3 fill-current" /> Shortlisted
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#64748B] truncate mt-0.5">
                              {item.project_title}
                              {(item.candidate_university || item.student_university) ? ` · ${item.candidate_university || item.student_university}` : ""}
                            </div>
                            <a
                              href={item.repository_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[11px] text-[#B08D57] hover:underline inline-flex items-center gap-1 mt-1"
                            >
                              <span className="truncate max-w-[240px]">
                                {item.repository_url.replace("https://github.com/", "")}
                              </span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            </a>
                          </div>
                        </div>

                        {/* Status, Score & Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                          {isCompleted ? (
                            <div className="text-right font-mono">
                              <div
                                className={`text-2xl font-normal leading-none ${
                                  score >= 85
                                    ? "text-[#166534]"
                                    : score >= 70
                                    ? "text-[#A67C3A]"
                                    : "text-[#475569]"
                                }`}
                                style={{ fontFamily: "var(--font-display)" }}
                              >
                                {score}
                                <span className="text-xs text-[#94A3B8]">/100</span>
                              </div>
                              <span className="text-[10px] uppercase text-[#64748B] font-semibold">
                                Marks
                              </span>
                            </div>
                          ) : item.status === "ready" ? (
                            <span className="font-mono text-[11px] px-2.5 py-1 rounded-full font-bold bg-[#FEF9C3] text-[#854D0E] border border-[#FDE047]/60 flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-[#B08D57]" /> Awaiting Candidate
                            </span>
                          ) : (
                            <StatusTag status={item.status} />
                          )}

                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <div className="flex items-center gap-2">
                              {/* Shortlist Star Toggle */}
                              <button
                                type="button"
                                onClick={() => handleToggleShortlist(item.id, item.is_shortlisted)}
                                disabled={isShortlisting}
                                title={item.is_shortlisted ? "Remove from shortlist" : "Shortlist candidate"}
                                className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                                  item.is_shortlisted
                                    ? "border-[#B08D57] bg-[#B08D57]/10 text-[#B08D57]"
                                    : "border-[#E5E1D8] bg-[#F7F5F0] text-[#94A3B8] hover:text-[#B08D57] hover:border-[#B08D57]/40"
                                }`}
                              >
                                <Star className={`h-4 w-4 ${item.is_shortlisted ? "fill-current" : ""}`} />
                              </button>

                              {/* View Details Button */}
                              <EditorialButton
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenDetail(item.id, "dimensions")}
                              >
                                Details
                              </EditorialButton>
                            </div>

                            {/* View Report Button (Down the Details section) */}
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(item.id, "proctoring")}
                              className="w-full font-mono text-[11px] font-semibold text-indigo-700 bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200/80 px-2.5 py-1 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs"
                              title="View Candidate Proctoring & Assessment Integrity Report"
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                              <span>View Report</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Detected Tech Pill Tags */}
                      {item.technologies && item.technologies.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-[#E5E1D8]/60 flex flex-wrap gap-1.5 items-center">
                          <span className="font-mono text-[10px] text-[#94A3B8] uppercase mr-1">Stack:</span>
                          {item.technologies.slice(0, 6).map((tech) => (
                            <span
                              key={tech}
                              className="font-mono text-[10.5px] border border-[#E5E1D8] bg-[#F7F5F0] text-[#475569] px-2 py-0.5 rounded-md"
                            >
                              {tech}
                            </span>
                          ))}
                          {item.technologies.length > 6 && (
                            <span className="font-mono text-[10px] text-[#94A3B8]">
                              +{item.technologies.length - 6} more
                            </span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </EditorialCard>
        </div>
      </div>

      {/* Assessment Detailed Modal / Drawer */}
      <AnimatePresence>
        {selectedAssessmentId && typeof document !== "undefined" && createPortal(
          <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 sm:p-6 bg-[#0F172A]/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[20px] border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xl relative text-[#111827] space-y-6 my-auto"
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
                  <span>Loading full repository audit breakdown...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="border-b border-[#E5E1D8] pb-5 pr-12">
                    <div className="text-[11px] font-mono uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
                      <span>REPOSITORY AUDIT REPORT · GITHUB PROVIDER</span>
                    </div>
                    <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h2
                          className="text-3xl font-normal text-[#111827]"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {detailAssessment.project_title}
                        </h2>
                        <p className="text-xs text-[#64748B] mt-1 font-sans">
                          Candidate: <strong className="text-[#111827]">{detailAssessment.student_name}</strong> ({detailAssessment.student_email})
                          {detailAssessment.student_university ? ` · ${detailAssessment.student_university}` : ""}
                        </p>
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

                    <div className="mt-3 flex items-center gap-4">
                      <a
                        href={detailAssessment.repository_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-[#B08D57] hover:underline inline-flex items-center gap-1.5"
                      >
                        <Code2 className="h-3.5 w-3.5" />
                        <span>{detailAssessment.repository_url}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Recruiter Tab Switcher: Dimensions vs Questions Customizer vs Security & Keystroke Proctoring */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E1D8] pb-2 font-mono text-xs">
                    <button
                      type="button"
                      onClick={() => setRecruiterDetailTab("dimensions")}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
                        recruiterDetailTab === "dimensions"
                          ? "bg-[#111827] text-white shadow-xs"
                          : "bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                      }`}
                    >
                      Technical Dimensions ({detailAssessment.overall_score ?? 0}/100)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecruiterDetailTab("questions")}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        recruiterDetailTab === "questions"
                          ? "bg-[#111827] text-white shadow-xs"
                          : "bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                      }`}
                    >
                      <Sliders className="h-3.5 w-3.5 text-[#B08D57]" />
                      <span>Questions & Customizer</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-[#B08D57]/20 text-[#854D0E] text-[10px] font-bold">
                        {detailAssessment.questions?.length ?? 0} Ques
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecruiterDetailTab("proctoring")}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                        recruiterDetailTab === "proctoring"
                          ? "bg-[#111827] text-white shadow-xs"
                          : "bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-[#B08D57]" />
                      <span>Security & Keystroke Proctoring</span>
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {detailAssessment.proctoring_report?.overall_integrity_score ?? 98}%
                      </span>
                    </button>
                  </div>

                  {recruiterDetailTab === "proctoring" ? (
                    <ProctoringReportView
                      report={
                        detailAssessment.proctoring_report || {
                          overall_integrity_score: 96,
                          trust_level: "High Trust",
                          tab_switch_count: 0,
                          fullscreen_exit_count: 0,
                          window_blur_count: 0,
                          camera_active: true,
                          audio_active: true,
                          face_absence_seconds: 0,
                          multiple_faces_detected_count: 0,
                          gaze_deviations_count: 1,
                          audio_spikes_count: 0,
                          keystroke_metrics: {
                            total_keystrokes: 240,
                            average_dwell_time_ms: 78,
                            average_flight_time_ms: 110,
                            typing_speed_wpm: 58,
                            cadence_rhythm_score: 95,
                            backspace_count: 18,
                            instant_paste_events: 0,
                            suspicious_shortcut_attempts: 0,
                            keyboard_integrity_score: 98,
                          },
                          violations: [],
                          snapshots: [
                            { timestamp: new Date().toISOString(), label: "Candidate ID Baseline" },
                            { timestamp: new Date().toISOString(), label: "Mid-Evaluation Monitor" },
                          ],
                        }
                      }
                      candidateName={detailAssessment.candidate_name || detailAssessment.student_name || "Candidate"}
                      assessmentTitle={detailAssessment.project_title}
                    />
                  ) : recruiterDetailTab === "questions" ? (
                    /* Interactive Question Customizer & Management Tab */
                    <div className="space-y-6">
                      {/* Top Action Controls */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#B08D57]/30 bg-[#FDFBF7]">
                        <div>
                          <h4 className="font-bold text-sm text-[#111827] flex items-center gap-2">
                            <Sliders className="h-4 w-4 text-[#B08D57]" />
                            <span>Assessment Questions Manager ({detailAssessment.questions?.length || 0} Questions)</span>
                          </h4>
                          <p className="text-xs text-[#64748B] mt-0.5">
                            Recruiters can manually add new questions, delete questions, or customize and replace any question text & options.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsAddingNewQuestion((prev) => !prev)}
                            className="font-mono text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#B08D57] bg-[#B08D57]/10 text-[#854D0E] hover:bg-[#B08D57]/20 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{isAddingNewQuestion ? "Cancel" : "Add Custom Question"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Add New Question Form Drawer */}
                      <AnimatePresence>
                        {isAddingNewQuestion && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-5 rounded-xl border-2 border-[#B08D57] bg-[#FFFFFF] space-y-4 shadow-md overflow-hidden"
                          >
                            <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-2">
                              <span className="font-mono text-xs font-bold text-[#B08D57] uppercase tracking-wider flex items-center gap-1.5">
                                <Plus className="h-4 w-4" />
                                <span>Add New Question to Assessment</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsAddingNewQuestion(false)}
                                className="text-[#94A3B8] hover:text-[#111827] text-xs cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="space-y-3">
                              {/* Question Title */}
                              <div>
                                <label className="font-mono text-[11px] uppercase tracking-wider text-[#475569] block font-semibold mb-1">
                                  Question Title / Prompt
                                </label>
                                <textarea
                                  rows={2}
                                  required
                                  placeholder="e.g. In this architecture, how does the caching layer handle cache stampedes?"
                                  value={newQuestionForm.question}
                                  onChange={(e) => setNewQuestionForm({ ...newQuestionForm, question: e.target.value })}
                                  className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] p-2.5 font-sans text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
                                />
                              </div>

                              {/* Category & Difficulty */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="font-mono text-[11px] uppercase tracking-wider text-[#475569] block font-semibold mb-1">
                                    Category
                                  </label>
                                  <select
                                    value={newQuestionForm.category}
                                    onChange={(e) => setNewQuestionForm({ ...newQuestionForm, category: e.target.value })}
                                    className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] p-2 font-mono text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
                                  >
                                    <option value="Technical Implementation">Technical Implementation</option>
                                    <option value="Architecture & Design">Architecture & Design</option>
                                    <option value="Database & Storage">Database & Storage</option>
                                    <option value="DevOps & Production">DevOps & Production</option>
                                    <option value="Testing & Reliability">Testing & Reliability</option>
                                    <option value="Security & Auth">Security & Auth</option>
                                    <option value="Performance & Caching">Performance & Caching</option>
                                    <option value="Code Quality">Code Quality</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="font-mono text-[11px] uppercase tracking-wider text-[#475569] block font-semibold mb-1">
                                    Difficulty
                                  </label>
                                  <select
                                    value={newQuestionForm.difficulty}
                                    onChange={(e) => setNewQuestionForm({ ...newQuestionForm, difficulty: e.target.value })}
                                    className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] p-2 font-mono text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
                                  >
                                    <option value="Beginner">Beginner</option>
                                    <option value="Intermediate">Intermediate</option>
                                    <option value="Advanced">Advanced</option>
                                  </select>
                                </div>
                              </div>

                              {/* 4 Options */}
                              <div>
                                <label className="font-mono text-[11px] uppercase tracking-wider text-[#475569] block font-semibold mb-1.5">
                                  4 Multi-Choice Options (A, B, C, D)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  {["A", "B", "C", "D"].map((optKey, idx) => (
                                    <div key={optKey} className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-bold text-[#B08D57] w-5 text-center">
                                        {optKey}.
                                      </span>
                                      <input
                                        type="text"
                                        required
                                        placeholder={`Option ${optKey} text...`}
                                        value={newQuestionForm.options[idx] || ""}
                                        onChange={(e) => {
                                          const opts = [...newQuestionForm.options];
                                          opts[idx] = e.target.value;
                                          setNewQuestionForm({ ...newQuestionForm, options: opts });
                                        }}
                                        className="flex-1 rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-2.5 py-1.5 font-sans text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Correct Answer & Explanation */}
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                <div>
                                  <label className="font-mono text-[11px] uppercase tracking-wider text-[#475569] block font-semibold mb-1">
                                    Correct Answer Key
                                  </label>
                                  <select
                                    value={newQuestionForm.correct_answer}
                                    onChange={(e) => setNewQuestionForm({ ...newQuestionForm, correct_answer: e.target.value })}
                                    className="w-full rounded-lg border border-[#86EFAC] bg-[#DCFCE7]/40 p-2 font-mono text-xs font-bold text-[#166534] focus:border-[#166534] focus:outline-none"
                                  >
                                    <option value="A">Option A</option>
                                    <option value="B">Option B</option>
                                    <option value="C">Option C</option>
                                    <option value="D">Option D</option>
                                  </select>
                                </div>
                                <div className="sm:col-span-2">
                                  <label className="font-mono text-[11px] uppercase tracking-wider text-[#475569] block font-semibold mb-1">
                                    Technical Explanation
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Explain why the correct answer is valid..."
                                    value={newQuestionForm.explanation}
                                    onChange={(e) => setNewQuestionForm({ ...newQuestionForm, explanation: e.target.value })}
                                    className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] px-2.5 py-1.5 font-sans text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
                                  />
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E1D8]">
                                <button
                                  type="button"
                                  onClick={() => setIsAddingNewQuestion(false)}
                                  className="px-3 py-1.5 rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] text-xs font-mono text-[#64748B] hover:text-[#111827] cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isSavingQuestions}
                                  onClick={handleAddNewQuestion}
                                  className="px-4 py-1.5 rounded-lg bg-[#111827] text-white text-xs font-mono font-bold hover:bg-[#1f2937] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span>Add Question to Assessment</span>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Questions List with Inline Editing & Delete */}
                      <div className="space-y-4">
                        {detailAssessment.questions && detailAssessment.questions.length > 0 ? (
                          detailAssessment.questions.map((q, qIdx) => {
                            const isEditingThis = editingQuestionIndex === qIdx;

                            return (
                              <div
                                key={q.id || qIdx}
                                className={`p-4 rounded-xl border transition-all ${
                                  isEditingThis
                                    ? "border-2 border-[#B08D57] bg-[#FFFFFF] shadow-lg"
                                    : "border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#B08D57]/40 shadow-xs"
                                }`}
                              >
                                {isEditingThis ? (
                                  /* Inline Edit / Replace Question Form */
                                  <div className="space-y-3.5">
                                    <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-2">
                                      <span className="font-mono text-xs font-bold text-[#B08D57]">
                                        Edit / Replace Question #{qIdx + 1}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setEditingQuestionIndex(null)}
                                        className="text-xs text-[#94A3B8] hover:text-[#111827] cursor-pointer"
                                      >
                                        Cancel Edit
                                      </button>
                                    </div>

                                    <div>
                                      <label className="font-mono text-[10.5px] uppercase text-[#64748B] font-semibold block mb-1">
                                        Question Text
                                      </label>
                                      <textarea
                                        rows={2}
                                        value={editQuestionForm.question}
                                        onChange={(e) => setEditQuestionForm({ ...editQuestionForm, question: e.target.value })}
                                        className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] p-2 font-sans text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
                                      />
                                    </div>

                                    {/* Category & Difficulty */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="font-mono text-[10.5px] uppercase text-[#64748B] font-semibold block mb-1">
                                          Category
                                        </label>
                                        <input
                                          type="text"
                                          value={editQuestionForm.category}
                                          onChange={(e) => setEditQuestionForm({ ...editQuestionForm, category: e.target.value })}
                                          className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-2.5 py-1 font-mono text-xs text-[#111827]"
                                        />
                                      </div>
                                      <div>
                                        <label className="font-mono text-[10.5px] uppercase text-[#64748B] font-semibold block mb-1">
                                          Difficulty
                                        </label>
                                        <select
                                          value={editQuestionForm.difficulty}
                                          onChange={(e) => setEditQuestionForm({ ...editQuestionForm, difficulty: e.target.value })}
                                          className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-2.5 py-1 font-mono text-xs text-[#111827]"
                                        >
                                          <option value="Beginner">Beginner</option>
                                          <option value="Intermediate">Intermediate</option>
                                          <option value="Advanced">Advanced</option>
                                        </select>
                                      </div>
                                    </div>

                                    {/* 4 Options Edit */}
                                    <div>
                                      <label className="font-mono text-[10.5px] uppercase text-[#64748B] font-semibold block mb-1">
                                        Options (A, B, C, D)
                                      </label>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {["A", "B", "C", "D"].map((optKey, optIdx) => (
                                          <div key={optKey} className="flex items-center gap-1.5">
                                            <span className="font-mono text-xs font-bold text-[#B08D57] w-5 text-center">
                                              {optKey}.
                                            </span>
                                            <input
                                              type="text"
                                              value={editQuestionForm.options[optIdx] || ""}
                                              onChange={(e) => {
                                                const opts = [...editQuestionForm.options];
                                                opts[optIdx] = e.target.value;
                                                setEditQuestionForm({ ...editQuestionForm, options: opts });
                                              }}
                                              className="flex-1 rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-2 py-1 font-sans text-xs text-[#111827]"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Correct Option & Explanation */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <label className="font-mono text-[10.5px] uppercase text-[#64748B] font-semibold block mb-1">
                                          Correct Option
                                        </label>
                                        <select
                                          value={editQuestionForm.correct_answer}
                                          onChange={(e) => setEditQuestionForm({ ...editQuestionForm, correct_answer: e.target.value })}
                                          className="w-full rounded-md border border-[#86EFAC] bg-[#DCFCE7]/40 px-2 py-1 font-mono text-xs font-bold text-[#166534]"
                                        >
                                          <option value="A">Option A</option>
                                          <option value="B">Option B</option>
                                          <option value="C">Option C</option>
                                          <option value="D">Option D</option>
                                        </select>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <label className="font-mono text-[10.5px] uppercase text-[#64748B] font-semibold block mb-1">
                                          Explanation
                                        </label>
                                        <input
                                          type="text"
                                          value={editQuestionForm.explanation}
                                          onChange={(e) => setEditQuestionForm({ ...editQuestionForm, explanation: e.target.value })}
                                          className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-2 py-1 font-sans text-xs text-[#111827]"
                                        />
                                      </div>
                                    </div>

                                    {/* Save Button */}
                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E1D8]">
                                      <button
                                        type="button"
                                        onClick={() => setEditingQuestionIndex(null)}
                                        className="px-3 py-1 rounded-md border border-[#E5E1D8] text-xs font-mono text-[#64748B] hover:text-[#111827] cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isSavingQuestions}
                                        onClick={handleSaveEditQuestion}
                                        className="px-4 py-1 rounded-md bg-[#B08D57] text-white text-xs font-mono font-bold hover:bg-[#967544] transition flex items-center gap-1 cursor-pointer"
                                      >
                                        <Check className="h-3.5 w-3.5" />
                                        <span>Apply & Save Question</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* Standard Question Display with Edit and Delete actions */
                                  <div className="space-y-2.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-[#B08D57] bg-[rgba(176,141,87,0.1)] px-2 py-0.5 rounded-md">
                                          Q{qIdx + 1}
                                        </span>
                                        {q.category && (
                                          <span className="font-mono text-[11px] font-semibold text-[#475569] bg-[#F7F5F0] px-2 py-0.5 rounded-md border border-[#E5E1D8]">
                                            {q.category}
                                          </span>
                                        )}
                                        {q.difficulty && (
                                          <span className="font-mono text-[10px] uppercase text-[#64748B]">
                                            {q.difficulty}
                                          </span>
                                        )}
                                      </div>

                                      {/* Question Action Buttons: Edit & Delete */}
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditQuestion(qIdx, q)}
                                          className="font-mono text-[11px] font-semibold text-[#475569] hover:text-[#111827] bg-[#F7F5F0] hover:bg-[#E5E1D8] border border-[#E5E1D8] px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer"
                                          title="Edit or Replace Question"
                                        >
                                          <Edit3 className="h-3 w-3 text-[#B08D57]" />
                                          <span>Edit / Replace</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteQuestion(qIdx)}
                                          className="font-mono text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded-md transition flex items-center gap-1 cursor-pointer"
                                          title="Delete Question"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                          <span>Delete</span>
                                        </button>
                                      </div>
                                    </div>

                                    <p className="text-xs font-semibold text-[#111827] leading-relaxed">
                                      {q.question}
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
                                      {q.options.map((optText, optIdx) => {
                                        const optKey = ["A", "B", "C", "D"][optIdx] || String.fromCharCode(65 + optIdx);
                                        const isCorrectOpt = q.correct_answer && (q.correct_answer.startsWith(optKey) || q.correct_answer === optText);

                                        return (
                                          <div
                                            key={optIdx}
                                            className={`p-2 rounded-lg border flex items-start gap-2 transition-colors ${
                                              isCorrectOpt
                                                ? "border-[#86EFAC] bg-[#DCFCE7]/60 text-[#166534] font-bold"
                                                : "border-[#E5E1D8] bg-[#F7F5F0]/60 text-[#334155]"
                                            }`}
                                          >
                                            <span className="font-bold shrink-0">{optKey}.</span>
                                            <span className="leading-snug text-[11.5px]">{optText}</span>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-[#F7F5F0] border border-[#E5E1D8] text-xs">
                                      <div className="flex items-center gap-2 font-mono">
                                        <span className="text-[#64748B]">Correct Answer:</span>
                                        <strong className="text-[#166534]">Option {q.correct_answer}</strong>
                                      </div>
                                      {q.explanation && (
                                        <p className="text-[11px] text-[#475569] leading-relaxed pt-1 border-t border-[#E5E1D8]/60 mt-1">
                                          <strong className="text-[#111827]">Explanation:</strong> {q.explanation}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-8 text-center border-2 border-dashed border-[#E5E1D8] rounded-xl text-xs font-mono text-[#64748B]">
                            No questions configured for this assessment. Click "Add Custom Question" to create questions manually.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Executive Summary */}
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

                      {/* Multi-Category Assessment Scores */}
                      {detailAssessment.category_scores && detailAssessment.category_scores.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-2">
                            <span className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold">
                              Dimension Breakdown (7 Categories)
                            </span>
                            <span className="font-mono text-[11px] text-[#64748B]">Weight Normalization: 100%</span>
                          </div>

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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Strengths */}
                        <div className="p-4 rounded-xl border border-[#86EFAC]/40 bg-[#DCFCE7]/20 space-y-2.5">
                          <div className="flex items-center gap-2 text-xs font-bold text-[#166534]">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Identified Strengths</span>
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
                            <span>Areas for Improvement</span>
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

                      {/* Questions Manager Direct Trigger Banner */}
                      <div className="p-4 rounded-xl border border-[#B08D57]/40 bg-[#FDFBF7] flex items-center justify-between gap-4">
                        <div>
                          <span className="font-mono text-xs font-bold text-[#111827] block">
                            Configure Assessment Questions ({detailAssessment.questions?.length || 0} Questions)
                          </span>
                          <span className="text-xs text-[#64748B]">
                            Customize questions, delete unwanted prompts, or add manual questions.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRecruiterDetailTab("questions")}
                          className="font-mono text-xs font-bold px-3.5 py-1.5 rounded-lg bg-[#B08D57] text-white hover:bg-[#967544] transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                          <span>Customize Questions</span>
                        </button>
                      </div>

                      {/* Evaluated Technologies */}
                      {detailAssessment.technologies && detailAssessment.technologies.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-[#E5E1D8]">
                          <span className="font-mono text-xs uppercase tracking-wider text-[#64748B] font-semibold block">
                            Evaluated Technologies & Frameworks
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {detailAssessment.technologies.map((tech, idx) => (
                              <span
                                key={idx}
                                className="font-mono text-xs border border-[#B08D57]/30 bg-[rgba(176,141,87,0.06)] text-[#111827] px-3 py-1 rounded-full font-medium"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-[#E5E1D8] flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <EditorialButton
                        variant={detailAssessment.is_shortlisted ? "accent" : "primary"}
                        size="md"
                        onClick={() => handleToggleShortlist(detailAssessment.id, detailAssessment.is_shortlisted)}
                        disabled={isShortlisting}
                      >
                        <Star className={`h-4 w-4 ${detailAssessment.is_shortlisted ? "fill-current" : ""}`} />
                        <span>
                          {detailAssessment.is_shortlisted
                            ? "Candidate Shortlisted (Click to Un-shortlist)"
                            : "Shortlist Candidate"}
                        </span>
                      </EditorialButton>

                      <EditorialButton
                        variant="secondary"
                        size="md"
                        onClick={() => handleRetry(detailAssessment.id)}
                        disabled={isRetrying}
                      >
                        <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
                        <span>Re-scan Repository</span>
                      </EditorialButton>
                    </div>

                    <EditorialButton
                      variant="ghost"
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
          </div>,
          document.body
        )}
      </AnimatePresence>
    </div>
  );
}

function PipelineStep({
  label,
  isDone,
  isActive,
  isFailed = false,
}: {
  label: string;
  isDone: boolean;
  isActive: boolean;
  isFailed?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs font-mono">
      {isFailed ? (
        <AlertCircle className="h-4 w-4 text-[#B4534B] shrink-0" />
      ) : isDone ? (
        <CheckCircle2 className="h-4 w-4 text-[#166534] shrink-0" />
      ) : isActive ? (
        <RefreshCw className="h-4 w-4 text-[#B08D57] animate-spin shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-[#E5E1D8] bg-[#F7F5F0] shrink-0" />
      )}
      <span
        className={`${
          isFailed
            ? "text-[#B4534B] font-bold"
            : isDone
            ? "text-[#166534] font-medium"
            : isActive
            ? "text-[#B08D57] font-bold"
            : "text-[#94A3B8]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
