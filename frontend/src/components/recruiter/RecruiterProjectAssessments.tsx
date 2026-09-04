import { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import { api, ApiError } from "../../api";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePipelineAssessment, setActivePipelineAssessment] = useState<ProjectAssessment | null>(null);

  // Detail Modal State
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [detailAssessment, setDetailAssessment] = useState<ProjectAssessment | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isShortlisting, setIsShortlisting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Load assessments on mount
  const loadData = async () => {
    try {
      const listData = await api.getRecruiterProjectAssessments(token).catch(() => ({ items: [] }));
      const safeAssessments = Array.isArray(listData?.items) ? listData.items : [];
      setAssessments(safeAssessments);
    } catch {
      toast.error("Failed to load assessments");
      setAssessments([]);
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
        },
        token
      );
      setActivePipelineAssessment(created);
      toast.success("Repository submitted! Scanning and publishing open assessment for all students...");
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
  const handleOpenDetail = async (assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    setIsLoadingDetail(true);
    try {
      const detail = await api.getProjectAssessmentDetail(assessmentId, token);
      setDetailAssessment(detail);
    } catch {
      toast.error("Failed to fetch assessment details");
      setSelectedAssessmentId(null);
    } finally {
      setIsLoadingDetail(false);
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
                              onClick={() => handleOpenDetail(item.id)}
                            >
                              Details
                            </EditorialButton>
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
        {selectedAssessmentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#0F172A]/50 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[20px] border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xl relative text-[#111827] space-y-6"
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

                  {/* Generated Questions & Candidate Performance Review */}
                  {detailAssessment.questions && detailAssessment.questions.length > 0 && (
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-2">
                        <span className="font-mono text-xs uppercase tracking-wider text-[#111827] font-semibold">
                          Repository Assessment Questions ({detailAssessment.questions.length} Questions)
                        </span>
                        {detailAssessment.status === "completed" ? (
                          <span className="font-mono text-xs text-[#166534] font-bold">
                            Candidate Marks: {detailAssessment.overall_score ?? 0} / 100
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] font-bold text-[#854D0E] bg-[#FEF9C3] px-2.5 py-0.5 rounded-full border border-[#FDE047]/60">
                            Awaiting Candidate Submission
                          </span>
                        )}
                      </div>

                      {detailAssessment.status === "ready" && (
                        <div className="p-3.5 rounded-xl border border-[#B08D57]/30 bg-[rgba(176,141,87,0.05)] text-xs text-[#334155] space-y-1">
                          <p className="font-bold text-[#854D0E] flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Questions Posted to Student Portal</span>
                          </p>
                          <p>
                            These 5 technical questions were automatically formulated from the student's repository. Once the candidate answers and submits, their responses, marks, and evaluation will appear here.
                          </p>
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
                                  const isCandidateChoice = studentAns === optLetter;
                                  const isCorrectOption = q.correct_answer === optLetter;

                                  return (
                                    <div
                                      key={oIdx}
                                      className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                                        isCorrectOption
                                          ? "border-[#166534] bg-[#DCFCE7]/30 text-[#166534] font-medium"
                                          : isCandidateChoice && !isCorrect
                                          ? "border-[#B91C1C] bg-[#FEE2E2]/30 text-[#B91C1C]"
                                          : "border-[#E5E1D8] bg-[#F7F5F0]/40 text-[#475569]"
                                      }`}
                                    >
                                      <span className="font-mono font-bold">{optLetter})</span>
                                      <span>{opt.replace(/^[A-D]\)\s*/, "")}</span>
                                      {isCandidateChoice && (
                                        <span className="ml-auto font-mono text-[10px] px-2 py-0.5 rounded bg-white border border-[#E5E1D8] text-[#111827] font-semibold">
                                          Candidate Chose ({optLetter})
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {q.explanation && (
                                <div className="p-3 rounded-lg bg-[#F7F5F0] border border-[#E5E1D8] text-[11px] text-[#334155] leading-relaxed">
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
                        Detected Technologies & Ecosystem
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
          </div>
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
