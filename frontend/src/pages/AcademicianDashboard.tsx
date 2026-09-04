import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GraduationCap,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Briefcase,
  FileText,
  Users,
  Award,
  BookOpen,
  Sparkles,
  Search,
  ArrowUpRight,
  AlertCircle,
  MessageSquare,
  CheckSquare,
  Layers,
  ExternalLink,
  Edit3,
  Bell,
  X,
  Video,
  Play,
  Trash2,
  Plus,
  Eye,
  UploadCloud,
  Film,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type {
  FacultyOpportunity,
  FacultyApplication,
  FacultyPassport,
  FacultyPassportUpdate,
  CollaborationWorkspace,
  FacultyEventRegistration,
  FacultyNotification,
  FacultyCollaborationHistoryItem,
  FacultyAdvisedProject,
  UserDocument,
  FacultyVideo,
} from "../api/types";
import { toast } from "sonner";
import { CollaborationFundingHub } from "../components/faculty/CollaborationFundingHub";
import { TrainingPlannerHub } from "../components/faculty/TrainingPlannerHub";

export interface AcademicianDashboardProps {
  token: string;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export type AcademicianTabType =
  | "opportunities"
  | "collaboration_funding"
  | "training_planner"
  | "videos"
  | "applications"
  | "workspaces"
  | "passport"
  | "internships"
  | "proposals"
  | "mentorship_events"
  | "advising"
  | "documents"
  | "history";

type TabType = AcademicianTabType;

export function AcademicianDashboard({ token, activeTab: propTab, onTabChange }: AcademicianDashboardProps) {
  const [internalTab, setInternalTab] = useState<TabType>("opportunities");
  const activeTab = propTab ?? internalTab;
  const setActiveTab = useCallback(
    (tab: TabType) => {
      if (onTabChange) onTabChange(tab);
      else setInternalTab(tab);
    },
    [onTabChange]
  );
  const [loading, setLoading] = useState(true);

  // Core Data
  const [passport, setPassport] = useState<FacultyPassport | null>(null);
  const [opportunities, setOpportunities] = useState<FacultyOpportunity[]>([]);
  const [applications, setApplications] = useState<FacultyApplication[]>([]);
  const [workspaces, setWorkspaces] = useState<CollaborationWorkspace[]>([]);
  const [events, setEvents] = useState<FacultyEventRegistration[]>([]);
  const [notifications, setNotifications] = useState<FacultyNotification[]>([]);
  const [historyItems, setHistoryItems] = useState<FacultyCollaborationHistoryItem[]>([]);
  const [advisedProjects, setAdvisedProjects] = useState<FacultyAdvisedProject[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);

  // Filters & State
  const [oppTypeFilter, setOppTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOppDetail, setSelectedOppDetail] = useState<FacultyOpportunity | null>(null);
  const [selectedAppDetail, setSelectedAppDetail] = useState<FacultyApplication | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<CollaborationWorkspace | null>(null);

  // Proposal / Application Modal Form
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyingOpportunity, setApplyingOpportunity] = useState<FacultyOpportunity | null>(null);
  const [proposalForm, setProposalForm] = useState({
    proposal_title: "",
    proposal_text: "",
    application_type: "general",
    problem_statement: "",
    methodology: "",
    timeline_weeks: 4,
    budget_requested: 0,
    industry_support_required: "",
    deliverables: ["Initial technical milestone", "Final report & implementation"],
    team_members: [] as Array<{ name: string; role: string; department?: string }>,
    student_researchers: [] as Array<{ name: string; roll_no?: string; skill?: string }>,
    is_draft: false,
  });
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // Passport Edit Form
  const [isEditingPassport, setIsEditingPassport] = useState(false);
  const [passportForm, setPassportForm] = useState<FacultyPassportUpdate>({});
  const [savingPassport, setSavingPassport] = useState(false);

  // Workspace Action Forms
  const [newDiscussionText, setNewDiscussionText] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("Faculty Lead");
  const [advisingFeedbackMap, setAdvisingFeedbackMap] = useState<Record<string, string>>({});

  // Document Upload State
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState("research_document");
  const [docUrl, setDocUrl] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  // Faculty Video Lectures State & Drag-and-Drop
  const [ownVideos, setOwnVideos] = useState<FacultyVideo[]>([]);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [videoForm, setVideoForm] = useState({
    title: "",
    description: "",
    video_url: "",
    thumbnail_url: "",
    duration_minutes: 30,
    subject: "Computer Science",
    department: "",
    skills_covered_str: "",
    notes_markdown: "",
  });
  const [savingVideo, setSavingVideo] = useState(false);
  const [activePreviewVideo, setActivePreviewVideo] = useState<FacultyVideo | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        passRes,
        oppRes,
        appRes,
        wsRes,
        evRes,
        notifRes,
        histRes,
        advRes,
        docsRes,
        vidsRes,
      ] = await Promise.allSettled([
        api.getFacultyPassport(token),
        api.getFacultyOpportunities(token),
        api.getFacultyApplications(token),
        api.getFacultyWorkspaces(token),
        api.getMyFacultyEvents(token),
        api.getFacultyNotifications(token),
        api.getFacultyCollaborationHistory(token),
        api.getFacultyAdvisedProjects(token),
        api.getUserDocuments(token),
        api.getOwnFacultyVideos(token),
      ]);

      if (passRes.status === "fulfilled") {
        setPassport(passRes.value);
        setPassportForm(passRes.value);
      }
      if (oppRes.status === "fulfilled") setOpportunities(oppRes.value);
      if (appRes.status === "fulfilled") setApplications(appRes.value);
      if (wsRes.status === "fulfilled") setWorkspaces(wsRes.value);
      if (evRes.status === "fulfilled") setEvents(evRes.value);
      if (notifRes.status === "fulfilled") setNotifications(notifRes.value);
      if (histRes.status === "fulfilled") setHistoryItems(histRes.value);
      if (advRes.status === "fulfilled") setAdvisedProjects(advRes.value);
      if (docsRes.status === "fulfilled") setDocuments(docsRes.value);
      if (vidsRes.status === "fulfilled") setOwnVideos(vidsRes.value);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load faculty portal data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  async function refreshOpportunities() {
    try {
      const data = await api.getFacultyOpportunities(token, oppTypeFilter === "all" ? undefined : oppTypeFilter);
      setOpportunities(data);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to refresh opportunities"));
    }
  }

  async function refreshApplications() {
    try {
      const data = await api.getFacultyApplications(token);
      setApplications(data);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to refresh applications"));
    }
  }

  async function refreshWorkspaces() {
    try {
      const data = await api.getFacultyWorkspaces(token);
      setWorkspaces(data);
      if (selectedWorkspace) {
        const updated = data.find((w) => w.id === selectedWorkspace.id);
        if (updated) setSelectedWorkspace(updated);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Failed to refresh workspaces"));
    }
  }

  // Handle Application Submit / Draft
  async function handleSubmitProposal(isDraft: boolean) {
    if (!applyingOpportunity) return;
    if (!isDraft && (!proposalForm.proposal_title.trim() || !proposalForm.proposal_text.trim())) {
      toast.error("Please provide both a proposal title and a detailed description.");
      return;
    }

    try {
      setSubmittingProposal(true);
      await api.createFacultyApplication(
        {
          opportunity_id: applyingOpportunity.id,
          proposal_title: proposalForm.proposal_title || applyingOpportunity.title,
          proposal_text: proposalForm.proposal_text,
          application_type: proposalForm.application_type || applyingOpportunity.opportunity_type,
          problem_statement: proposalForm.problem_statement,
          methodology: proposalForm.methodology,
          timeline_weeks: proposalForm.timeline_weeks,
          budget_requested: proposalForm.budget_requested,
          industry_support_required: proposalForm.industry_support_required,
          deliverables: proposalForm.deliverables,
          team_members: proposalForm.team_members,
          student_researchers: proposalForm.student_researchers,
          is_draft: isDraft,
        },
        token
      );

      toast.success(isDraft ? "Draft saved successfully" : "Proposal submitted to industry partner!");
      setShowApplyModal(false);
      setApplyingOpportunity(null);
      await refreshOpportunities();
      await refreshApplications();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to submit proposal"));
    } finally {
      setSubmittingProposal(false);
    }
  }

  // Handle Application Withdraw
  async function handleWithdrawApplication(appId: string) {
    try {
      await api.withdrawFacultyApplication(appId, token);
      toast.success("Application withdrawn.");
      await refreshApplications();
      if (selectedAppDetail?.id === appId) {
        setSelectedAppDetail(null);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Failed to withdraw application"));
    }
  }

  // Handle Passport Save
  async function handleSavePassport() {
    try {
      setSavingPassport(true);
      const updated = await api.updateFacultyPassport(passportForm, token);
      setPassport(updated);
      setIsEditingPassport(false);
      toast.success("Faculty Academic Passport updated successfully!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update passport"));
    } finally {
      setSavingPassport(false);
    }
  }

  // Handle Workspace Milestone Status Update
  async function handleToggleMilestone(workspaceId: string, milestoneId: string, currentStatus: string) {
    const nextStatus = currentStatus === "completed" ? "in_progress" : "completed";
    try {
      const updated = await api.updateWorkspaceMilestones(
        workspaceId,
        { milestone_id: milestoneId, status: nextStatus },
        token
      );
      setSelectedWorkspace(updated);
      await refreshWorkspaces();
      toast.success(`Milestone status updated to ${nextStatus.replace("_", " ")}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update milestone"));
    }
  }

  // Handle Workspace Task Add
  async function handleAddTask(workspaceId: string) {
    if (!newTaskTitle.trim()) return;
    try {
      const updated = await api.createWorkspaceTask(
        workspaceId,
        { title: newTaskTitle, assigned_to: newTaskAssignee, priority: "medium", status: "todo" },
        token
      );
      setSelectedWorkspace(updated);
      setNewTaskTitle("");
      await refreshWorkspaces();
      toast.success("Action item added to workspace");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add task"));
    }
  }

  // Handle Workspace Discussion Post
  async function handleAddDiscussion(workspaceId: string) {
    if (!newDiscussionText.trim()) return;
    try {
      const updated = await api.createWorkspaceDiscussion(
        workspaceId,
        {
          author_name: passport?.full_name || "Faculty Lead",
          author_role: "faculty",
          content: newDiscussionText,
        },
        token
      );
      setSelectedWorkspace(updated);
      setNewDiscussionText("");
      await refreshWorkspaces();
      toast.success("Update posted to workspace");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to post message"));
    }
  }

  // Handle Workspace Complete
  async function handleCompleteWorkspace(workspaceId: string) {
    try {
      const updated = await api.completeWorkspace(workspaceId, token, "Completed with all deliverables and evaluation finalized.");
      setSelectedWorkspace(updated);
      await refreshWorkspaces();
      toast.success("Collaboration workspace completed and recorded in history!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to complete workspace"));
    }
  }

  // Handle Advising Feedback on Student Live Project
  async function handleSubmitAdvisingFeedback(projectAppId: string) {
    const feedback = advisingFeedbackMap[projectAppId];
    if (!feedback || !feedback.trim()) {
      toast.error("Please enter feedback notes");
      return;
    }
    try {
      await api.submitFacultyProjectFeedback(projectAppId, feedback, "Endorsed", token);
      toast.success("Academic Advisor endorsement and feedback submitted!");
      const updatedAdv = await api.getFacultyAdvisedProjects(token);
      setAdvisedProjects(updatedAdv);
      setAdvisingFeedbackMap((prev) => ({ ...prev, [projectAppId]: "" }));
    } catch (err) {
      toast.error(errorMessage(err, "Failed to submit feedback"));
    }
  }

  // Handle Document Upload
  async function handleUploadDoc(e: React.FormEvent) {
    e.preventDefault();
    if (!docTitle.trim() || !docUrl.trim()) {
      toast.error("Please provide document title and URL");
      return;
    }
    try {
      setUploadingDoc(true);
      const res = await api.uploadUserDocument(
        {
          document_type: docType,
          title: docTitle,
          file_name: `${docTitle.toLowerCase().replace(/\s+/g, "_")}.pdf`,
          file_size_bytes: 1024 * 250,
          mime_type: "application/pdf",
          file_url: docUrl,
        },
        token
      );
      setDocuments((prev) => [res, ...prev]);
      setDocTitle("");
      setDocUrl("");
      toast.success("Document stored securely in vault");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to upload document"));
    } finally {
      setUploadingDoc(false);
    }
  }

  // Status Badge Colors
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "accepted":
      case "completed":
        return "bg-emerald-50 dark:bg-[rgba(79,111,90,0.10)] text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-[rgba(79,111,90,0.25)]";
      case "active":
      case "in_progress":
        return "bg-[rgba(176,141,87,0.08)] text-[#B08D57] border-[#B08D57]/30";
      case "shortlisted":
      case "discussion":
        return "bg-[#F7F5F0] text-[#475569] border-[#E5E1D8]";
      case "submitted":
      case "under_review":
        return "bg-amber-50 dark:bg-[rgba(166,124,58,0.10)] text-amber-700 dark:text-amber-300 border-amber-200 dark:border-[rgba(166,124,58,0.25)]";
      case "draft":
        return "bg-[#F7F5F0] text-[#475569] border-[#E5E1D8]";
      case "rejected":
      case "withdrawn":
        return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40";
      default:
        return "bg-[#F7F5F0] text-[#64748B] border-[#E5E1D8]";
    }
  };

  // Handle Video File Selection (Drag & Drop or File Picker)
  function handleVideoFileSelect(file: File) {
    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|webm|ogg|mov|mkv|avi)$/i)) {
      toast.error("Please select a valid video file (.mp4, .webm, .mov, .mkv)");
      return;
    }
    setVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objectUrl);

    // Auto-detect video duration from metadata
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.src = objectUrl;
    tempVideo.onloadedmetadata = () => {
      const minutes = Math.max(1, Math.round(tempVideo.duration / 60));
      setVideoForm((prev) => ({
        ...prev,
        duration_minutes: minutes,
        title: prev.title.trim() ? prev.title : file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      }));
    };
    tempVideo.onerror = () => {
      // fallback to filename if metadata parse fails
      setVideoForm((prev) => ({
        ...prev,
        title: prev.title.trim() ? prev.title : file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      }));
    };
  }

  // Handle Video Upload (Form Submit)
  async function handleCreateVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!videoFile && !videoForm.video_url.trim()) {
      toast.error("Please drag & drop a video file or provide a video URL");
      return;
    }
    if (!videoForm.title.trim()) {
      toast.error("Please provide a lecture title");
      return;
    }
    try {
      setSavingVideo(true);
      const skillsArray = videoForm.skills_covered_str
        ? videoForm.skills_covered_str.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      let created: FacultyVideo;
      if (videoFile) {
        const fd = new FormData();
        fd.append("file", videoFile);
        fd.append("title", videoForm.title.trim());
        fd.append("description", videoForm.description.trim());
        fd.append("subject", videoForm.subject.trim() || "General");
        fd.append("department", videoForm.department.trim() || passport?.department || "Computer Science");
        fd.append("duration_minutes", String(Number(videoForm.duration_minutes) || 30));
        fd.append("skills_covered", videoForm.skills_covered_str || "");
        if (videoForm.notes_markdown?.trim()) {
          fd.append("notes_markdown", videoForm.notes_markdown.trim());
        }
        created = await api.uploadFacultyVideoFile(fd, token);
      } else {
        created = await api.createFacultyVideo(
          {
            title: videoForm.title.trim(),
            description: videoForm.description.trim(),
            video_url: videoForm.video_url.trim(),
            thumbnail_url: videoForm.thumbnail_url?.trim() || undefined,
            duration_minutes: Number(videoForm.duration_minutes) || 30,
            subject: videoForm.subject.trim() || "General",
            department: videoForm.department.trim() || passport?.department || "Computer Science",
            skills_covered: skillsArray,
            notes_markdown: videoForm.notes_markdown.trim() || undefined,
            is_published: true,
          },
          token
        );
      }

      setOwnVideos((prev) => [created, ...prev]);
      setShowVideoModal(false);
      setVideoFile(null);
      setVideoPreviewUrl(null);
      setVideoForm({
        title: "",
        description: "",
        video_url: "",
        thumbnail_url: "",
        duration_minutes: 30,
        subject: "Computer Science",
        department: "",
        skills_covered_str: "",
        notes_markdown: "",
      });
      toast.success("Faculty video lecture published! Students can now access it in the Student Portal.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to publish video lecture"));
    } finally {
      setSavingVideo(false);
    }
  }

  async function handleDeleteVideo(videoId: string) {
    if (!window.confirm("Are you sure you want to remove this video lecture?")) return;
    try {
      await api.deleteFacultyVideo(videoId, token);
      setOwnVideos((prev) => prev.filter((v) => v.id !== videoId));
      toast.success("Video lecture removed.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete video"));
    }
  }

  function getEmbedUrl(rawUrl: string): string {
    if (!rawUrl) return "";
    try {
      if (rawUrl.includes("youtube.com/watch")) {
        const urlObj = new URL(rawUrl);
        const v = urlObj.searchParams.get("v");
        if (v) return `https://www.youtube.com/embed/${v}?autoplay=1`;
      }
      if (rawUrl.includes("youtu.be/")) {
        const id = rawUrl.split("youtu.be/")[1]?.split("?")[0];
        if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
      }
      if (rawUrl.includes("vimeo.com/")) {
        const id = rawUrl.split("vimeo.com/")[1]?.split("?")[0];
        if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
      }
    } catch {
      // fallback
    }
    return rawUrl;
  }

  const navTabs = [
    { id: "opportunities", label: "Opportunities", icon: Briefcase, count: opportunities.length },
    { id: "collaboration_funding", label: "Collaboration & Funding", icon: Sparkles },
    { id: "training_planner", label: "Training Planner", icon: Award },
    { id: "videos", label: "Video Lectures", icon: Video, count: ownVideos.length },
    { id: "applications", label: "My Applications", icon: FileText, count: applications.length },
    { id: "workspaces", label: "Workspaces", icon: Layers, count: workspaces.length },
    { id: "passport", label: "Academic Passport", icon: GraduationCap },
    { id: "internships", label: "Industrial Training", icon: Building2 },
    { id: "proposals", label: "R&D & Grants", icon: Sparkles },
    { id: "mentorship_events", label: "Mentorship & Events", icon: Users },
    { id: "advising", label: "Live Project Advising", icon: Award },
    { id: "documents", label: "Vault Documents", icon: BookOpen, count: documents.length },
    { id: "history", label: "History & Outcomes", icon: Clock, count: historyItems.length },
  ];

  if (loading && !passport) {
    return (
      <div className="p-12 text-center max-w-7xl mx-auto">
        <div className="inline-block animate-spin h-8 w-8 border-2 border-[#B08D57] border-t-transparent rounded-full mb-3" />
        <p className="text-sm text-[#64748B]">Loading Faculty & Academician Portal...</p>
      </div>
    );
  }

  return (
    <div className="faculty-portal p-6 md:p-10 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="border border-[#E5E1D8] bg-[#FFFFFF] rounded-md p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#64748B] mb-2">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Faculty & Academician Portal</span>
            </div>
            <h1
              className="text-3xl md:text-4xl font-normal text-[#111827]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {passport?.full_name || "Faculty Fellow"}
            </h1>
            <p className="font-mono text-xs text-[#475569] mt-1">
              {passport?.designation} · {passport?.department} · <span className="text-[#B08D57]">{passport?.institution_name}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNotificationsModal(true)}
              className="p-2.5 border border-[#E5E1D8] bg-[#F7F5F0] hover:bg-[#F7F5F0] text-[#111827] rounded-md relative cursor-pointer transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-[#9CC7D8] text-[#021522] rounded-full text-[9px] font-bold flex items-center justify-center">
                  {notifications.filter((n) => !n.is_read).length}
                </span>
              )}
            </button>
            <span
              className={`px-3 py-1 rounded-sm text-xs font-mono border ${
                passport?.collaboration_availability === "available"
                  ? "bg-[rgba(79,111,90,0.10)] text-[#4F6F5A] border-[rgba(79,111,90,0.25)]"
                  : "bg-[rgba(166,124,58,0.10)] text-[#B08D57] border-[#E5E1D8]"
              }`}
            >
              ● {passport?.collaboration_availability?.replace("_", " ").toUpperCase()}
            </span>
            <button
              onClick={() => setActiveTab("passport")}
              className="px-4 py-2 border border-[#E5E1D8] bg-[#FFFFFF] hover:bg-[#F7F5F0] text-[#0f172a] font-mono text-xs font-bold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Passport</span>
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6 border-t border-[#E5E1D8]">
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Active Workspaces</span>
            <p className="text-2xl font-normal text-[#B08D57] mt-1" style={{ fontFamily: "var(--font-display)" }}>
              {workspaces.filter((w) => w.status === "active").length}
            </p>
          </div>
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Total Proposals</span>
            <p className="text-2xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>{applications.length}</p>
          </div>
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Grants Secured</span>
            <p className="text-2xl font-normal text-[#4F6F5A] mt-1" style={{ fontFamily: "var(--font-display)" }}>
              ₹{((passport?.total_grants_secured || 0) / 100000).toFixed(1)} L
            </p>
          </div>
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Live Advising</span>
            <p className="text-2xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>{advisedProjects.length}</p>
          </div>
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Completed Collabs</span>
            <p className="text-2xl font-normal text-[#B08D57] mt-1" style={{ fontFamily: "var(--font-display)" }}>{historyItems.length}</p>
          </div>
        </div>
      </div>

      {/* Active Section Header Badge */}
      <div className="flex items-center justify-between pb-2 border-b border-[#E5E1D8]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#64748B]">Active View:</span>
          <span className="px-3 py-1 rounded-sm text-xs font-mono bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30 flex items-center gap-1.5">
            {navTabs.find((t) => t.id === activeTab)?.label || "Faculty Hub"}
          </span>
        </div>
        <span className="hidden sm:inline text-[11px] text-[#64748B]">Navigate anytime via the left sidebar</span>
      </div>

      {/* TAB 1: OPPORTUNITIES & DISCOVERY */}
      {activeTab === "opportunities" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-2 md:pb-0">
              {[
                { id: "all", label: "All Programs" },
                { id: "industrial_immersion", label: "Industry Immersion" },
                { id: "research_grant", label: "Research Grants" },
                { id: "consultancy", label: "Consultancy" },
                { id: "guest_lecture", label: "Guest Lectures" },
                { id: "advising", label: "Advising" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOppTypeFilter(t.id)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    oppTypeFilter === t.id
                      ? "bg-[#0B0B0A] text-[#FFFFFF] font-medium"
                      : "border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search domain, corporate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full font-mono text-xs pl-9 pr-4 py-2 rounded-md bg-[#FFFFFF] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B] focus:border-[#B08D57] focus:outline-none"
              />
            </div>
          </div>

          {/* Opportunities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {opportunities
              .filter((opp) => oppTypeFilter === "all" || opp.opportunity_type === oppTypeFilter)
              .filter(
                (opp) =>
                  !searchQuery ||
                  opp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  opp.organization_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  opp.domain.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((opp) => (
                <div
                  key={opp.id}
                  className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] flex flex-col justify-between space-y-4 hover:border-[#E5E1D8] transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2 font-mono">
                      <span className="text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-xs border border-[#E5E1D8] text-[#B08D57]">
                        {opp.opportunity_type.replace("_", " ")}
                      </span>
                      {opp.stipend_or_grant && (
                        <span className="text-xs text-[#4F6F5A] bg-[rgba(79,111,90,0.10)] px-2.5 py-0.5 rounded-xs border border-[rgba(79,111,90,0.25)]">
                          Grant: ₹{(opp.stipend_or_grant / 1000).toFixed(0)}k
                        </span>
                      )}
                    </div>

                    <h3
                      className="text-xl font-normal text-[#111827]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {opp.title}
                    </h3>
                    <p className="text-xs text-[#475569] mt-1 flex items-center gap-1 font-mono">
                      <Building2 className="h-3.5 w-3.5 text-[#64748B]" />
                      <span>{opp.organization_name}</span> · Domain: <span className="text-[#B08D57]">{opp.domain}</span>
                    </p>

                    <p className="text-xs text-[#475569] mt-3 line-clamp-3 leading-relaxed">
                      {opp.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-4 text-xs font-mono text-[#64748B]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {opp.duration_weeks} Weeks
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Mode: <strong className="capitalize text-[#475569]">{opp.mode || "Hybrid"}</strong>
                      </span>
                      {opp.deadline && (
                        <span className="flex items-center gap-1 text-[#B08D57]">
                          <AlertCircle className="h-3.5 w-3.5" /> Deadline: {new Date(opp.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-between gap-3">
                    <button
                      onClick={() => setSelectedOppDetail(opp)}
                      className="px-3.5 py-2 text-xs font-mono text-[#475569] hover:text-[#111827] bg-[#F7F5F0] border border-[#E5E1D8] rounded-md cursor-pointer transition-colors"
                    >
                      View Details
                    </button>

                    {opp.has_applied ? (
                      <div className="p-2 px-3 rounded-md bg-[rgba(79,111,90,0.10)] border border-[rgba(79,111,90,0.25)] flex items-center gap-1.5 text-xs font-mono text-[#4F6F5A]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Proposal {opp.application_status?.toUpperCase() || "SUBMITTED"}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setApplyingOpportunity(opp);
                          setProposalForm({
                            proposal_title: `Proposal for ${opp.title}`,
                            proposal_text: "",
                            application_type: opp.opportunity_type,
                            problem_statement: "",
                            methodology: "",
                            timeline_weeks: opp.duration_weeks || 12,
                            budget_requested: opp.stipend_or_grant || 0,
                            industry_support_required: "",
                            deliverables: opp.deliverables?.length ? opp.deliverables : ["Initial Research Charter", "Final Technical Deliverable"],
                            team_members: [],
                            student_researchers: [],
                            is_draft: false,
                          });
                          setShowApplyModal(true);
                        }}
                        className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs font-mono rounded-md transition-colors cursor-pointer"
                      >
                        Submit Proposal
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB: COLLABORATION & FUNDING HUB */}
      {activeTab === "collaboration_funding" && (
        <CollaborationFundingHub
          token={token}
          onNavigateToTrainingPlanner={(_trainingTitle) => {
            setActiveTab("training_planner");
          }}
        />
      )}

      {/* TAB: TRAINING & WORKSHOP PLANNER */}
      {activeTab === "training_planner" && (
        <TrainingPlannerHub
          token={token}
          onNavigateToFundingHub={(_partnerOrFunding) => {
            setActiveTab("collaboration_funding");
          }}
        />
      )}

      {/* TAB 1.5: FACULTY VIDEO LECTURES & MASTERCLASSES (MATCHES RESUME INTELLIGENCE) */}
      {activeTab === "videos" && (
        <div className="space-y-8">
          <section className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 rounded-[16px] text-[#111827] font-sans space-y-6 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
            {/* Header Bar */}
            <div className="border-b border-[#E5E1D8] pb-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold mb-1 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
                  <span>FACULTY MASTERCLASS ARCHITECTURE</span>
                </div>
                <h2 className="text-2xl font-normal text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                  <Video className="h-5 w-5 text-[#B08D57]" />
                  <span>Video Lecture Intelligence</span>
                </h2>
                <p className="text-xs text-[#475569] mt-0.5">
                  Turn your masterclasses and lecture videos into evidence-backed skills with automatic cryptographic verification.
                </p>
              </div>

              {ownVideos.length > 0 && (
                <span className="badge-success flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{ownVideos.length} Masterclasses Published</span>
                </span>
              )}
            </div>

            <input
              ref={videoFileInputRef}
              aria-label="Video lecture file"
              type="file"
              accept=".mp4,.webm,.mov,.mkv,.avi,video/mp4,video/webm,video/quicktime"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) handleVideoFileSelect(selected);
              }}
              className="hidden"
            />

            {/* 1. EMPTY / UPLOAD DROPZONE */}
            {!videoFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleVideoFileSelect(file);
                }}
                onClick={() => videoFileInputRef.current?.click()}
                className={`border border-dashed p-10 rounded-[16px] flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)] scale-[1.005]"
                    : "border-[#E5E1D8] bg-[#F7F5F0] hover:border-[#B08D57]/60 hover:bg-[#EFEBE3]"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E1D8] bg-[#FFFFFF] text-[#B08D57] mb-3 shadow-2xs">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-[#111827]">
                  Drag & drop your lecture video here, or <span className="underline underline-offset-4 text-[#B08D57]">choose a file</span>
                </p>
                <p className="text-xs text-[#475569] mt-1">
                  Supports video formats (<span className="text-[#111827] font-medium">MP4</span>, <span className="text-[#111827] font-medium">WebM</span>, <span className="text-[#111827] font-medium">MOV</span>, and <span className="text-[#111827] font-medium">MKV</span> up to 500MB)
                </p>
              </div>
            ) : (
              /* 2. SELECTED FILE CONFIGURATION CARD */
              <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-6 sm:p-7 rounded-[16px] space-y-5 font-sans">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <Film className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#111827]">{videoFile.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-[#64748B]">
                          {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        <span className="text-[#CBD5E1]">·</span>
                        <span className="font-mono text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                          ~{videoForm.duration_minutes} mins detected
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoFile(null);
                      setVideoPreviewUrl(null);
                    }}
                    className="font-mono text-xs text-rose-600 hover:text-rose-800 underline cursor-pointer"
                  >
                    Change video
                  </button>
                </div>

                {videoPreviewUrl && (
                  <div className="max-w-md mx-auto rounded-lg overflow-hidden border border-[#E5E1D8] bg-black">
                    <video src={videoPreviewUrl} controls className="w-full aspect-video" />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-[#1E293B] block mb-1">Lecture Title *</label>
                    <input
                      type="text"
                      required
                      value={videoForm.title}
                      onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                      placeholder="e.g. Distributed Systems & Microservices Architecture"
                      className="w-full text-sm p-2.5 rounded-md bg-[#FFFFFF] border border-[#CBD5E1] text-[#0F172A] focus:ring-2 focus:ring-[#B08D57]/20 focus:border-[#B08D57] outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#1E293B] block mb-1">Subject / Domain *</label>
                    <input
                      type="text"
                      required
                      value={videoForm.subject}
                      onChange={(e) => setVideoForm({ ...videoForm, subject: e.target.value })}
                      placeholder="e.g. Backend Engineering / AI / DevOps"
                      className="w-full text-sm p-2.5 rounded-md bg-[#FFFFFF] border border-[#CBD5E1] text-[#0F172A] focus:ring-2 focus:ring-[#B08D57]/20 focus:border-[#B08D57] outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#1E293B] block mb-1">Duration (Minutes) *</label>
                    <input
                      type="number"
                      min={1}
                      max={600}
                      required
                      value={videoForm.duration_minutes}
                      onChange={(e) => setVideoForm({ ...videoForm, duration_minutes: parseInt(e.target.value) || 30 })}
                      className="w-full text-sm p-2.5 rounded-md bg-[#FFFFFF] border border-[#CBD5E1] text-[#0F172A] focus:ring-2 focus:ring-[#B08D57]/20 focus:border-[#B08D57] outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-[#1E293B] block mb-1">Skills Covered (Comma Separated)</label>
                    <input
                      type="text"
                      value={videoForm.skills_covered_str}
                      onChange={(e) => setVideoForm({ ...videoForm, skills_covered_str: e.target.value })}
                      placeholder="Python, FastAPI, Docker, Microservices, PostgreSQL"
                      className="w-full text-sm p-2.5 rounded-md bg-[#FFFFFF] border border-[#CBD5E1] text-[#0F172A] focus:ring-2 focus:ring-[#B08D57]/20 focus:border-[#B08D57] outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-[#1E293B] block mb-1">Professor's Study Notes & Key References (Markdown)</label>
                    <textarea
                      rows={3}
                      value={videoForm.notes_markdown}
                      onChange={(e) => setVideoForm({ ...videoForm, notes_markdown: e.target.value })}
                      placeholder="# Lecture Notes&#10;&#10;### 1. Key Concepts...&#10;### 2. Suggested Practice..."
                      className="w-full text-sm p-2.5 rounded-md bg-[#FFFFFF] border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:ring-2 focus:ring-[#B08D57]/20 focus:border-[#B08D57] outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVideoFile(null);
                      setVideoPreviewUrl(null);
                    }}
                    className="px-4 py-2 text-sm text-[#64748B] hover:text-[#111827] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateVideo}
                    disabled={savingVideo}
                    className="px-5 py-2.5 bg-[#B08D57] hover:bg-[#9A7B4A] disabled:opacity-50 text-white text-sm font-medium rounded-md shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                  >
                    {savingVideo ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Uploading Video File...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4" />
                        <span>Upload & Publish to Student Hub</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Footer Provenance Note */}
            <div className="flex items-center gap-2 text-xs text-[#64748B] pt-2 border-t border-[#E5E1D8]">
              <ShieldCheck className="h-4 w-4 text-[#B08D57]" />
              <span>Deterministic academic provenance · Indexed for Student Learning Hub</span>
            </div>
          </section>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-[#E5E1D8] bg-[#FFFFFF]">
              <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Lectures Published</span>
              <p className="text-2xl font-normal text-[#0F172A] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                {ownVideos.length}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-[#E5E1D8] bg-[#FFFFFF]">
              <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Total Student Views</span>
              <p className="text-2xl font-normal text-[#B08D57] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                {ownVideos.reduce((acc, v) => acc + (v.views_count || 0), 0)}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-[#E5E1D8] bg-[#FFFFFF]">
              <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Total Content Duration</span>
              <p className="text-2xl font-normal text-[#166534] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                {Math.round(ownVideos.reduce((acc, v) => acc + (v.duration_minutes || 0), 0) / 60 * 10) / 10} Hours
              </p>
            </div>
          </div>

          {/* Videos Grid */}
          {ownVideos.length === 0 ? (
            <div className="p-12 text-center border border-[#E5E1D8] bg-[#FFFFFF] rounded-lg space-y-3">
              <Video className="h-10 w-10 text-[#94A3B8] mx-auto" />
              <h3 className="text-base font-semibold text-[#0F172A]">No Video Lectures Uploaded Yet</h3>
              <p className="text-xs text-[#64748B] max-w-md mx-auto">
                Share your academic expertise by publishing lecture videos with syllabus notes, allowing students to learn directly from you.
              </p>
              <button
                type="button"
                onClick={() => setShowVideoModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-white text-xs font-mono rounded-md cursor-pointer transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Upload First Video</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ownVideos.map((video) => (
                <div
                  key={video.id}
                  className="border border-[#E2E8F0] bg-[#FFFFFF] rounded-lg overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow group"
                >
                  <div>
                    {/* Thumbnail */}
                    <div
                      onClick={() => setActivePreviewVideo(video)}
                      className="relative h-44 bg-[#0F172A] cursor-pointer overflow-hidden group/thumb"
                    >
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300 opacity-90"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-[#1E293B] to-[#0F172A]">
                          <Video className="h-12 w-12 text-[#64748B]" />
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/thumb:bg-black/45 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-[#2563EB] text-white flex items-center justify-center shadow-lg group-hover/thumb:scale-110 transition-transform">
                          <Play className="h-5 w-5 fill-white ml-0.5" />
                        </div>
                      </div>

                      <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white text-xs px-2.5 py-1 rounded font-medium">
                        {video.subject}
                      </div>
                      <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-xs text-white text-xs px-2 py-0.5 rounded font-mono flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{video.duration_minutes}m</span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 space-y-3">
                      <h3
                        onClick={() => setActivePreviewVideo(video)}
                        className="text-base font-semibold text-[#0F172A] leading-snug line-clamp-2 cursor-pointer group-hover:text-[#2563EB] transition-colors"
                      >
                        {video.title}
                      </h3>

                      <p className="text-xs text-[#475569] leading-relaxed line-clamp-2">
                        {video.description}
                      </p>

                      {video.skills_covered && video.skills_covered.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {video.skills_covered.slice(0, 3).map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F1F5F9] text-[#334155] border border-[#E2E8F0]"
                            >
                              {skill}
                            </span>
                          ))}
                          {video.skills_covered.length > 3 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-[#64748B]">
                              +{video.skills_covered.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-5 pt-0">
                    <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                        <Eye className="h-3.5 w-3.5" />
                        <span>{video.views_count} views</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActivePreviewVideo(video)}
                          className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteVideo(video.id)}
                          className="text-xs font-medium text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 cursor-pointer"
                          title="Delete Video Lecture"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY APPLICATIONS & PROPOSALS */}
      {activeTab === "applications" && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 text-[#111827] flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#B08D57]" />
                  My Applications & Proposal Lifecycle Tracking
                </h2>
                <p className="text-xs text-slate-500 text-[#475569] mt-0.5">
                  Track proposal review status, industry feedback, discussion schedules, and milestone activations.
                </p>
              </div>

              <span className="text-xs text-slate-400 font-bold">
                Total Submissions: {applications.length}
              </span>
            </div>

            {applications.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                No applications submitted yet. Browse active opportunities to apply.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 border-[#E5E1D8] rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 bg-[#FFFFFF] text-slate-400 uppercase font-bold tracking-wider">
                    <tr>
                      <th className="p-3.5">Opportunity / Proposal</th>
                      <th className="p-3.5">Organization</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5">Applied Date</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Next Action</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] font-medium text-slate-700 text-[#475569]">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/60 dark:hover:bg-[#F7F5F0] transition-colors">
                        <td className="p-3.5 font-bold text-slate-900 text-[#111827]">
                          {app.proposal_title || app.opportunity_title}
                        </td>
                        <td className="p-3.5">{app.organization_name}</td>
                        <td className="p-3.5">
                          <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 bg-[#F7F5F0]">
                            {app.application_type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3.5">{new Date(app.applied_at).toLocaleDateString()}</td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border uppercase ${getStatusBadge(app.status)}`}>
                            {app.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500">
                          {app.status === "accepted" ? (
                            <span className="text-emerald-600 font-bold">Workspace Active</span>
                          ) : app.status === "discussion" ? (
                            <span className="text-[#B08D57] font-bold">Schedule Sync</span>
                          ) : app.status === "draft" ? (
                            <span className="text-amber-600 font-bold">Ready to Submit</span>
                          ) : (
                            "Under Review"
                          )}
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => setSelectedAppDetail(app)}
                            className="px-3 py-1 bg-slate-100 bg-[#F7F5F0] hover:bg-slate-200 text-slate-800 text-[#111827] font-bold rounded-lg text-xs cursor-pointer"
                          >
                            View
                          </button>
                          {app.status !== "accepted" && app.status !== "completed" && app.status !== "withdrawn" && (
                            <button
                              onClick={() => handleWithdrawApplication(app.id)}
                              className="px-2.5 py-1 text-rose-500 hover:text-rose-700 font-bold text-xs cursor-pointer"
                            >
                              Withdraw
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: COLLABORATION WORKSPACES */}
      {activeTab === "workspaces" && (
        <div className="space-y-6">
          {selectedWorkspace ? (
            /* Workspace Room Detail View */
            <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 border border-[#E5E1D8] space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 border-[#E5E1D8]">
                <div>
                  <button
                    onClick={() => setSelectedWorkspace(null)}
                    className="text-xs text-[#B08D57] font-medium hover:underline mb-2 block cursor-pointer"
                  >
                    ← Back to All Workspaces
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">
                      {selectedWorkspace.collaboration_type.replace("_", " ")}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${getStatusBadge(selectedWorkspace.status)}`}>
                      {selectedWorkspace.status}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 text-[#111827] mt-1">
                    {selectedWorkspace.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Industry Partner: <strong>{selectedWorkspace.organization_name}</strong> • Lead: {selectedWorkspace.industry_lead_name}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-bold">Progress</span>
                    <p className="text-lg font-black text-emerald-600">{selectedWorkspace.progress_percentage}%</p>
                  </div>
                  {selectedWorkspace.status !== "completed" && (
                    <button
                      onClick={() => handleCompleteWorkspace(selectedWorkspace.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                    >
                      Complete Collaboration
                    </button>
                  )}
                </div>
              </div>

              {/* Workspace Sections Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Milestones & Action Items */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Milestones Checkoff */}
                  <div className="p-6 rounded-2xl bg-slate-50 bg-[#FFFFFF] border border-slate-200/70 border-[#E5E1D8] space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 text-[#111827] flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-[#B08D57]" />
                      Milestones & Technical Deliverables
                    </h3>
                    <div className="space-y-3">
                      {selectedWorkspace.milestones.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3.5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={m.status === "completed"}
                              onChange={() => handleToggleMilestone(selectedWorkspace.id, m.id, m.status)}
                              className="h-4 w-4 rounded-xs text-[#B08D57] cursor-pointer"
                            />
                            <div>
                              <p className={`text-xs font-semibold ${m.status === "completed" ? "line-through text-[#64748B]" : "text-[#111827]"}`}>
                                {m.title}
                              </p>
                              {m.due_date && <span className="text-[10px] text-[#64748B]">Due: {m.due_date}</span>}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-xs text-[10px] uppercase font-mono border ${getStatusBadge(m.status)}`}>
                            {m.status.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tasks / Action Items */}
                  <div className="p-6 rounded-md bg-[#FFFFFF] border border-[#E5E1D8] space-y-4">
                    <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[#B08D57]" />
                      Sprint Tasks & Action Items
                    </h3>
                    <div className="space-y-2">
                      {selectedWorkspace.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]"
                        >
                          <div>
                            <p className="text-xs font-semibold text-[#111827]">{t.title}</p>
                            <span className="text-[10px] text-[#64748B]">Assigned: {t.assigned_to}</span>
                          </div>
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded-xs bg-[#F7F5F0] text-[#475569]">
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="Add new collaboration task..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="flex-1 text-xs px-3 py-2 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B]"
                      />
                      <select
                        value={newTaskAssignee}
                        onChange={(e) => setNewTaskAssignee(e.target.value)}
                        className="text-xs px-3 py-2 rounded-md bg-[#FFFFFF] border border-[#E5E1D8] text-[#111827]"
                      >
                        <option value="Faculty Lead">Faculty Lead</option>
                        <option value="Industry Lead">Industry Lead</option>
                        <option value="Research Scholar">Research Scholar</option>
                        <option value="Joint Team">Joint Team</option>
                      </select>
                      <button
                        onClick={() => handleAddTask(selectedWorkspace.id)}
                        className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs rounded-md cursor-pointer"
                      >
                        Add Task
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Col: Discussion Stream & Participants */}
                <div className="space-y-6">
                  {/* Participants */}
                  <div className="p-6 rounded-md bg-[#FFFFFF] border border-[#E5E1D8] space-y-3">
                    <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#B08D57]" /> Workspace Team
                    </h3>
                    <div className="space-y-2">
                      {selectedWorkspace.participants.map((p, idx) => (
                        <div key={idx} className="p-2.5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs">
                          <p className="font-semibold text-[#111827]">{p.name}</p>
                          <p className="text-[10px] text-[#64748B]">{p.role} • {p.company || p.department}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Discussion Thread */}
                  <div className="p-6 rounded-md bg-[#FFFFFF] border border-[#E5E1D8] space-y-3">
                    <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[#B08D57]" /> Industry Updates & Chat
                    </h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {selectedWorkspace.discussion_posts.map((post) => (
                        <div key={post.id} className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#111827]">{post.author_name}</span>
                            <span className="text-[10px] text-[#64748B] uppercase">{post.author_role}</span>
                          </div>
                          <p className="text-[#475569]">{post.content}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2">
                      <textarea
                        rows={2}
                        placeholder="Write update to industry team..."
                        value={newDiscussionText}
                        onChange={(e) => setNewDiscussionText(e.target.value)}
                        className="w-full text-xs p-3 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B]"
                      />
                      <button
                        onClick={() => handleAddDiscussion(selectedWorkspace.id)}
                        className="w-full py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs rounded-md cursor-pointer"
                      >
                        Send Update
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Workspaces List Grid */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 text-[#111827]">
                    Active Academia–Industry Collaboration Rooms
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dedicated collaborative project rooms generated automatically on proposal acceptance.
                  </p>
                </div>
              </div>

              {workspaces.length === 0 ? (
                <div className="p-12 text-center bg-[#FFFFFF] rounded-md border border-[#E5E1D8] text-sm font-mono text-[#64748B]">
                  No active workspaces yet. Once an industry partner accepts your proposal, a collaboration workspace is instantiated here.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] space-y-4 hover:border-[#E5E1D8] transition-colors cursor-pointer"
                      onClick={() => setSelectedWorkspace(ws)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase px-2.5 py-0.5 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">
                          {ws.collaboration_type.replace("_", " ")}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-xs text-[10px] border uppercase ${getStatusBadge(ws.status)}`}>
                          {ws.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-semibold text-[#111827]">{ws.title}</h3>
                        <p className="text-xs text-[#64748B] mt-0.5 flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" /> <strong>{ws.organization_name}</strong> • Lead: {ws.industry_lead_name}
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#64748B]">Milestone Progress</span>
                          <span className="text-[#4F6F5A]">{ws.progress_percentage}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-xs bg-[#F7F5F0] overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-xs transition-all duration-500"
                            style={{ width: `${ws.progress_percentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#E5E1D8] flex items-center justify-between text-xs text-[#64748B]">
                        <span>{ws.milestones?.length || 0} Milestones</span>
                        <span className="text-[#B08D57] flex items-center gap-1">
                          Open Room <ArrowUpRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FACULTY ACADEMIC PASSPORT */}
      {activeTab === "passport" && (
        <div className="space-y-6 font-mono">
          <div className="bg-[#FFFFFF] rounded-md p-8 border border-[#E5E1D8] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 border-[#E5E1D8]">
              <div>
                <h2 className="text-xl font-bold text-slate-900 text-[#111827] flex items-center gap-2">
                  <GraduationCap className="h-6 w-6 text-[#B08D57]" />
                  Faculty Professional Academic Passport
                </h2>
                <p className="text-xs text-slate-500 text-[#475569] mt-0.5">
                  Verifiable professional profile showcasing research expertise, publications, patents, past industry training, and collaboration availability.
                </p>
              </div>

              <button
                onClick={() => setIsEditingPassport(!isEditingPassport)}
                className="px-4 py-2 bg-slate-100 bg-[#F7F5F0] hover:bg-slate-200 text-slate-900 text-[#111827] text-xs font-bold rounded-xl cursor-pointer"
              >
                {isEditingPassport ? "Cancel Editing" : "Edit Profile"}
              </button>
            </div>

            {isEditingPassport ? (
              /* Edit Form */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={passportForm.full_name || ""}
                      onChange={(e) => setPassportForm({ ...passportForm, full_name: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 bg-[#F7F5F0] border border-slate-200 border-[#E5E1D8] text-slate-900 text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Designation</label>
                    <input
                      type="text"
                      value={passportForm.designation || ""}
                      onChange={(e) => setPassportForm({ ...passportForm, designation: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 bg-[#F7F5F0] border border-slate-200 border-[#E5E1D8] text-slate-900 text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Department</label>
                    <input
                      type="text"
                      value={passportForm.department || ""}
                      onChange={(e) => setPassportForm({ ...passportForm, department: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 bg-[#F7F5F0] border border-slate-200 border-[#E5E1D8] text-slate-900 text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Years of Experience</label>
                    <input
                      type="number"
                      value={passportForm.years_experience || 0}
                      onChange={(e) => setPassportForm({ ...passportForm, years_experience: parseInt(e.target.value) || 0 })}
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 bg-[#F7F5F0] border border-slate-200 border-[#E5E1D8] text-slate-900 text-[#111827]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Professional Bio</label>
                  <textarea
                    rows={3}
                    value={passportForm.bio || ""}
                    onChange={(e) => setPassportForm({ ...passportForm, bio: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 bg-[#F7F5F0] border border-slate-200 border-[#E5E1D8] text-slate-900 text-[#111827]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Collaboration Availability</label>
                  <select
                    value={passportForm.collaboration_availability || "available"}
                    onChange={(e) => setPassportForm({ ...passportForm, collaboration_availability: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 bg-[#F7F5F0] border border-slate-200 border-[#E5E1D8] text-slate-900 text-[#111827]"
                  >
                    <option value="available">Available for Industry Projects & Grants</option>
                    <option value="busy">Active Collaborations Only</option>
                    <option value="sabbatical_only">Sabbatical / Immersion Only</option>
                    <option value="not_available">Not Available Currently</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setIsEditingPassport(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePassport}
                    disabled={savingPassport}
                    className="px-5 py-2 bg-[#F7F5F0] text-[#111827] text-xs font-medium border border-[#E5E1D8] rounded-md cursor-pointer"
                  >
                    {savingPassport ? "Saving..." : "Save Passport"}
                  </button>
                </div>
              </div>
            ) : (
              /* View Passport */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-slate-50 bg-[#FFFFFF] border border-slate-200/70 border-[#E5E1D8] space-y-3">
                    <span className="text-xs text-slate-400 uppercase font-bold">Research Areas</span>
                    <div className="flex flex-wrap gap-1.5">
                      {passport?.research_areas?.map((r, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-xs text-xs font-mono bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 bg-[#FFFFFF] border border-slate-200/70 border-[#E5E1D8] space-y-3">
                    <span className="text-xs text-slate-400 uppercase font-bold">Technical Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {passport?.technical_skills?.map((s, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 bg-[#F7F5F0] text-slate-700 text-[#475569]">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                  <div className="p-5 rounded-2xl bg-slate-50 bg-[#FFFFFF] border border-slate-200/70 border-[#E5E1D8] space-y-2">
                    <span className="text-xs text-slate-400 uppercase font-bold">Academic & Industrial Biography</span>
                    <p className="text-xs text-slate-700 text-[#475569] leading-relaxed">
                      {passport?.bio || "Professor with over a decade of research in distributed computing and applied artificial intelligence. Active PI on sponsored research and corporate immersion programs."}
                    </p>
                  </div>

                  {/* Publications & Patents Cards */}
                  <div className="p-5 rounded-2xl bg-slate-50 bg-[#FFFFFF] border border-slate-200/70 border-[#E5E1D8] space-y-3">
                    <span className="text-xs text-slate-400 uppercase font-bold">Selected Research Publications & Patents</span>
                    <div className="space-y-2">
                      {passport?.publications && passport.publications.length > 0 ? (
                        passport.publications.map((p, idx) => (
                          <div key={idx} className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs">
                            <p className="font-semibold text-[#111827]">{p.title}</p>
                            <p className="text-[10px] text-[#64748B]">{p.journal_or_conf} • {p.year}</p>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400">Add publications via Edit Profile.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: INDUSTRIAL TRAINING & FACULTY INTERNSHIPS */}
      {activeTab === "internships" && (
        <div className="space-y-6 font-mono">
          <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 border border-[#E5E1D8] space-y-4">
            <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#B08D57]" />
              Faculty Industrial Training & Sabbatical Immersion Lifecycle
            </h2>
            <p className="text-xs text-[#64748B] max-w-3xl">
              Dedicated track for AICTE / corporate industrial training, faculty summer internships, and sabbaticals with milestones, mentor feedback, and reflection reports.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                <span className="text-xs text-[#B08D57] font-bold uppercase">1. Selection & Mentor Alignment</span>
                <p className="text-xs text-[#64748B] mt-1">Corporate mentor assignment and kickoff charter agreement.</p>
              </div>
              <div className="p-4 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                <span className="text-xs text-[#B08D57] font-bold uppercase">2. Milestone Execution</span>
                <p className="text-xs text-[#64748B] mt-1">Hands-on industrial sprint completion and weekly sync reviews.</p>
              </div>
              <div className="p-4 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                <span className="text-xs text-[#4F6F5A] font-bold uppercase">3. Outcome & Certification</span>
                <p className="text-xs text-[#64748B] mt-1">Completion report submission and academic credential endorsement.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: R&D PROPOSALS */}
      {activeTab === "proposals" && (
        <div className="space-y-6 font-mono">
          <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 border border-[#E5E1D8] space-y-4">
            <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#B08D57]" />
              Applied Research Grants & Joint R&D Proposal Hub
            </h2>
            <p className="text-xs text-[#64748B] max-w-3xl">
              Construct structured research proposals with methodology, budget breakdowns, student research assistants, and industry deliverables.
            </p>

            <div className="pt-4">
              <button
                onClick={() => {
                  setActiveTab("opportunities");
                  setOppTypeFilter("research_grant");
                }}
                className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs font-mono rounded-md cursor-pointer"
              >
                Browse Open R&D Grants
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: MENTORSHIP & EVENTS */}
      {activeTab === "mentorship_events" && (
        <div className="space-y-6 font-mono">
          <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 border border-[#E5E1D8] space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                <Users className="h-5 w-5 text-[#B08D57]" />
                Industry Mentorship, Masterclasses & Faculty Workshops
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Registrations loaded from your persisted faculty event records.
              </p>
            </div>

            {/* Event Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {events.length === 0 ? (
                <div className="md:col-span-2 p-8 text-center text-xs text-[#64748B]">
                  No faculty event registrations are available.
                </div>
              ) : events.map((ev) => {
                return (
                  <div key={ev.id} className="p-6 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">
                          {ev.event_type.toUpperCase()}
                        </span>
                        <h3 className="text-sm font-semibold text-[#111827] mt-1.5">{ev.event_title}</h3>
                        <p className="text-xs text-[#64748B]">Host: <strong>{ev.host_organization}</strong> • {ev.scheduled_at ? new Date(ev.scheduled_at).toLocaleDateString() : "Date pending"}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#475569]">Role: {ev.role} • Status: {ev.status}</p>
                    <div className="pt-2 flex justify-end">
                      <span className="text-xs text-[#4F6F5A] font-bold flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> {ev.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: LIVE PROJECT ADVISING */}
      {activeTab === "advising" && (
        <div className="space-y-6 font-mono">
          <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 border border-[#E5E1D8] space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                <Award className="h-5 w-5 text-[#B08D57]" />
                Live Industry Projects — Faculty Advisor Hub
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Review student innovation teams, monitor challenge milestones, and provide verifiable academic feedback.
              </p>
            </div>

            <div className="space-y-4">
              {advisedProjects.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#64748B]">No active student challenges currently assigned for advising.</div>
              ) : (
                advisedProjects.map((p) => (
                  <div key={p.challenge_id} className="p-6 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-semibold text-[#111827]">{p.title}</h3>
                        <p className="text-xs text-[#64748B]">Corporate Host: {p.host_company} • {p.duration_weeks} Weeks</p>
                      </div>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs bg-emerald-950 text-[#4F6F5A] border border-[rgba(79,111,90,0.25)]">
                        {p.status}
                      </span>
                    </div>

                    <p className="text-xs text-[#475569]">{p.problem_statement}</p>

                    {/* Student Teams */}
                    <div className="space-y-3 pt-2">
                      <span className="text-xs font-mono uppercase text-[#64748B]">Enrolled Student Teams</span>
                      {p.student_teams?.map((st) => (
                        <div key={st.id} className="p-4 rounded-sm bg-[#FFFFFF] border border-[#E5E1D8] space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-[#111827]">Team: {st.team_members.join(", ")}</span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">{st.status}</span>
                          </div>

                          {st.feedback && (
                            <p className="text-xs text-[#64748B] italic bg-[#F7F5F0] p-2 rounded-xs">
                              {st.feedback}
                            </p>
                          )}

                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Add academic advisor endorsement / feedback..."
                              value={advisingFeedbackMap[st.id] || ""}
                              onChange={(e) => setAdvisingFeedbackMap({ ...advisingFeedbackMap, [st.id]: e.target.value })}
                              className="flex-1 text-xs px-3 py-1.5 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B]"
                            />
                            <button
                              onClick={() => handleSubmitAdvisingFeedback(st.id)}
                              className="px-3 py-1.5 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs font-mono rounded-md cursor-pointer"
                            >
                              Submit Endorsement
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: DOCUMENTS VAULT */}
      {activeTab === "documents" && (
        <div className="space-y-6 font-mono">
          <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 border border-[#E5E1D8] space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#B08D57]" />
                  Faculty Secure Document Vault
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Store CVs, detailed research proposals, FDP completion certificates, and consultancy deliverables.
                </p>
              </div>
            </div>

            {/* Document Upload Form */}
            <form onSubmit={handleUploadDoc} className="p-4 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] uppercase font-mono text-[#64748B] block mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. CV 2026 / Grant Proposal"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full text-xs p-2 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B]"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-[#64748B] block mb-1">Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full text-xs p-2 rounded-md bg-[#FFFFFF] border border-[#E5E1D8] text-[#111827]"
                >
                  <option value="research_document">Research Document / Proposal</option>
                  <option value="fdp_certificate">FDP / Training Certificate</option>
                  <option value="resume">Academic CV / Resume</option>
                  <option value="internship_report">Consultancy Report</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-mono text-[#64748B] block mb-1">URL / Storage Link</label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/..."
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  className="w-full text-xs p-2 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={uploadingDoc}
                  className="w-full py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs font-mono rounded-md cursor-pointer"
                >
                  {uploadingDoc ? "Saving..." : "Upload Document"}
                </button>
              </div>
            </form>

            {/* Documents List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] space-y-2">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">
                    {doc.document_type.replace("_", " ")}
                  </span>
                  <h4 className="text-xs font-semibold text-[#111827] truncate">{doc.title}</h4>
                  <p className="text-[10px] text-[#64748B]">{doc.file_name} • {(doc.file_size_bytes / 1024).toFixed(0)} KB</p>
                  {doc.file_url && (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#B08D57] flex items-center gap-1 hover:underline pt-1"
                    >
                      View File <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: HISTORY & OUTCOMES */}
      {activeTab === "history" && (
        <div className="space-y-6 font-mono">
          <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 border border-[#E5E1D8] space-y-6">
            <div>
              <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#B08D57]" />
                Completed Collaborations & Verifiable Outcomes
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Archived track record of completed corporate research, consultancy contracts, FDPs, and industrial immersions.
              </p>
            </div>

            {historyItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#64748B]">No completed collaborations archived yet.</div>
            ) : (
              <div className="space-y-4">
                {historyItems.map((item) => (
                  <div key={item.id} className="p-5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs bg-emerald-950 text-[#4F6F5A] border border-[rgba(79,111,90,0.25)]">
                          {item.collaboration_type.replace("_", " ")}
                        </span>
                        <h3 className="text-sm font-semibold text-[#111827] mt-1">{item.title}</h3>
                        <p className="text-xs text-[#64748B]">Organization: <strong>{item.organization_name}</strong> • Role: {item.role}</p>
                      </div>
                      <span className="text-xs text-[#4F6F5A] font-mono">
                        COMPLETED
                      </span>
                    </div>
                    {item.outcome_summary && (
                      <p className="text-xs text-[#475569] pt-1">{item.outcome_summary}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: OPPORTUNITY DETAIL MODAL */}
      {selectedOppDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E5E1D8] shadow-2xl space-y-6 text-[#111827] font-sans">
            <div className="flex justify-between items-start pb-4 border-b border-[#E5E1D8]">
              <div>
                <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">
                  {selectedOppDetail.opportunity_type.replace("_", " ")}
                </span>
                <h2 className="text-xl font-normal text-[#111827] mt-2" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedOppDetail.title}
                </h2>
                <p className="text-xs text-[#64748B] font-mono">
                  {selectedOppDetail.organization_name} • Domain: {selectedOppDetail.domain}
                </p>
              </div>
              <button
                onClick={() => setSelectedOppDetail(null)}
                className="p-1 rounded-sm text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <h4 className="uppercase text-[10px] text-[#64748B] mb-1">Description</h4>
                <p className="text-[#475569] leading-relaxed font-sans">{selectedOppDetail.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                <div>
                  <span className="text-[10px] uppercase text-[#64748B] block">Duration</span>
                  <span className="text-[#111827]">{selectedOppDetail.duration_weeks} Weeks</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#64748B] block">Funding / Stipend</span>
                  <span className="text-[#4F6F5A]">
                    {selectedOppDetail.stipend_or_grant ? `₹${selectedOppDetail.stipend_or_grant.toLocaleString()}` : "Honorary / Academic"}
                  </span>
                </div>
              </div>

              {selectedOppDetail.required_expertise && selectedOppDetail.required_expertise.length > 0 && (
                <div>
                  <h4 className="uppercase text-[10px] text-[#64748B] mb-1">Required Faculty Expertise</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOppDetail.required_expertise.map((exp, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E1D8] font-mono">
              <button
                onClick={() => setSelectedOppDetail(null)}
                className="px-4 py-2 text-xs text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const opp = selectedOppDetail;
                  setSelectedOppDetail(null);
                  setApplyingOpportunity(opp);
                  setProposalForm({
                    proposal_title: `Proposal for ${opp.title}`,
                    proposal_text: "",
                    application_type: opp.opportunity_type,
                    problem_statement: "",
                    methodology: "",
                    timeline_weeks: opp.duration_weeks,
                    budget_requested: opp.stipend_or_grant || 0,
                    industry_support_required: "",
                    deliverables: opp.deliverables?.length ? opp.deliverables : ["Initial Research Charter", "Final Technical Deliverable"],
                    team_members: [],
                    student_researchers: [],
                    is_draft: false,
                  });
                  setShowApplyModal(true);
                }}
                className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs rounded-md cursor-pointer"
              >
                Apply / Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: APPLY / PROPOSAL SUBMISSION MODAL */}
      {showApplyModal && applyingOpportunity && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-[#E5E1D8] shadow-2xl space-y-6 text-[#111827] font-sans my-auto">
            <div className="flex justify-between items-start pb-4 border-b border-[#E5E1D8]">
              <div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">
                  {applyingOpportunity.opportunity_type.replace("_", " ")}
                </span>
                <h2 className="text-xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                  Submit Proposal: {applyingOpportunity.title}
                </h2>
                <p className="text-xs text-[#64748B] font-mono">Corporate Partner: {applyingOpportunity.organization_name}</p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1 rounded-sm text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 font-mono">
              <div>
                <label className="text-xs text-[#475569] block mb-1">Proposal Title *</label>
                <input
                  type="text"
                  value={proposalForm.proposal_title}
                  onChange={(e) => setProposalForm({ ...proposalForm, proposal_title: e.target.value })}
                  className="w-full text-xs p-3 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B]"
                />
              </div>

              <div>
                <label className="text-xs text-[#475569] block mb-1">Executive Summary / Proposal Text *</label>
                <textarea
                  rows={4}
                  placeholder="Outline problem understanding, faculty expertise fit, research goals, or consultancy scope..."
                  value={proposalForm.proposal_text}
                  onChange={(e) => setProposalForm({ ...proposalForm, proposal_text: e.target.value })}
                  className="w-full text-xs p-3 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#475569] block mb-1">Methodology / Technical Approach</label>
                  <textarea
                    rows={3}
                    placeholder="Algorithms, experimental setup, or training modules..."
                    value={proposalForm.methodology}
                    onChange={(e) => setProposalForm({ ...proposalForm, methodology: e.target.value })}
                    className="w-full text-xs p-3 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#475569] block mb-1">Industry Support Required</label>
                  <textarea
                    rows={3}
                    placeholder="Cloud credits, hardware datasets, mentor review cadence..."
                    value={proposalForm.industry_support_required}
                    onChange={(e) => setProposalForm({ ...proposalForm, industry_support_required: e.target.value })}
                    className="w-full text-xs p-3 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#475569] block mb-1">Timeline (Weeks)</label>
                  <input
                    type="number"
                    value={proposalForm.timeline_weeks}
                    onChange={(e) => setProposalForm({ ...proposalForm, timeline_weeks: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs p-3 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#475569] block mb-1">Requested Budget / Grant (₹)</label>
                  <input
                    type="number"
                    value={proposalForm.budget_requested}
                    onChange={(e) => setProposalForm({ ...proposalForm, budget_requested: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs p-3 rounded-md bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E1D8] font-mono">
              <button
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 text-xs text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmitProposal(true)}
                disabled={submittingProposal}
                className="px-4 py-2 bg-white/[0.05] hover:bg-[#F7F5F0] border border-[#E5E1D8] text-[#111827] text-xs rounded-md cursor-pointer"
              >
                Save Draft
              </button>
              <button
                onClick={() => handleSubmitProposal(false)}
                disabled={submittingProposal}
                className="px-5 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs rounded-md cursor-pointer"
              >
                {submittingProposal ? "Submitting..." : "Submit to Industry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: APPLICATION DETAIL VIEW */}
      {selectedAppDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#E5E1D8] shadow-2xl space-y-6 text-[#111827] font-sans my-auto">
            <div className="flex justify-between items-start pb-4 border-b border-[#E5E1D8]">
              <div>
                <span className={`px-2.5 py-0.5 rounded-xs text-[10px] font-mono border uppercase ${getStatusBadge(selectedAppDetail.status)}`}>
                  {selectedAppDetail.status}
                </span>
                <h2 className="text-xl font-normal text-[#111827] mt-2" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedAppDetail.proposal_title || selectedAppDetail.opportunity_title}
                </h2>
                <p className="text-xs text-[#64748B] font-mono">Corporate Partner: {selectedAppDetail.organization_name}</p>
              </div>
              <button
                onClick={() => setSelectedAppDetail(null)}
                className="p-1 rounded-sm text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <h4 className="uppercase text-[10px] text-[#64748B] mb-1">Proposal Overview</h4>
                <p className="text-[#475569] leading-relaxed bg-[#F7F5F0] border border-[#E5E1D8] p-3.5 rounded-sm font-sans">
                  {selectedAppDetail.proposal_text || "No detailed proposal text provided."}
                </p>
              </div>

              {selectedAppDetail.reviewer_notes && (
                <div className="p-3.5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                  <span className="text-[#B08D57] uppercase text-[10px] block mb-1">Industry Reviewer Notes</span>
                  <p className="text-[#475569] font-sans">{selectedAppDetail.reviewer_notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E1D8] font-mono">
              {selectedAppDetail.status !== "accepted" && selectedAppDetail.status !== "completed" && selectedAppDetail.status !== "withdrawn" && (
                <button
                  onClick={() => handleWithdrawApplication(selectedAppDetail.id)}
                  className="px-4 py-2 text-[#B4534B] text-xs cursor-pointer"
                >
                  Withdraw Application
                </button>
              )}
              <button
                onClick={() => setSelectedAppDetail(null)}
                className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs rounded-md cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: NOTIFICATIONS MODAL */}
      {showNotificationsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-md p-6 max-w-lg w-full border border-[#E5E1D8] shadow-2xl space-y-4 text-[#111827] font-sans my-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[#E5E1D8]">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 font-mono">
                <Bell className="h-4 w-4 text-[#B08D57]" /> Notifications & Alerts
              </h3>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="p-1 text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto font-mono">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#64748B]">No notifications at this time.</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-sm border text-xs space-y-1 ${
                      n.is_read
                        ? "bg-[#F7F5F0] border-[#E5E1D8]"
                        : "bg-[rgba(176,141,87,0.08)] border-[#B08D57]/30"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-[#111827]">{n.title}</span>
                      <span className="text-[10px] text-[#64748B]">{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[#475569] text-[11px]">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right font-mono">
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs rounded-md cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 5: PUBLISH NEW FACULTY VIDEO LECTURE */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] rounded-xl max-w-2xl w-full border border-[#CBD5E1] shadow-2xl overflow-hidden my-auto animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-[#2563EB]" />
                <h3 className="text-base font-semibold text-[#0F172A]">Publish Video Lecture & Masterclass</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="p-1 text-[#64748B] hover:text-[#0F172A] rounded-md hover:bg-[#E2E8F0] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVideo} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* DRAG & DROP VIDEO DROPZONE (MATCHES RESUME INTELLIGENCE) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleVideoFileSelect(file);
                }}
                className={`border border-dashed p-8 rounded-[16px] flex flex-col items-center justify-center text-center cursor-pointer transition-all relative ${
                  isDragging
                    ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)] scale-[1.01]"
                    : videoFile
                    ? "border-emerald-500 bg-emerald-50/50"
                    : "border-[#E5E1D8] bg-[#F7F5F0] hover:border-[#B08D57]/60 hover:bg-[#EFEBE3]"
                }`}
              >
                <input
                  type="file"
                  accept=".mp4,.webm,.mov,.mkv,.avi,video/mp4,video/webm,video/quicktime"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoFileSelect(file);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                {videoFile ? (
                  <div className="space-y-3 w-full">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-emerald-700 mx-auto shadow-2xs">
                      <Film className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#111827] break-all">{videoFile.name}</h4>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <span className="font-mono text-xs text-[#475569]">
                          {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        <span className="text-[#94A3B8]">·</span>
                        <span className="font-mono text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                          ~{videoForm.duration_minutes} mins duration
                        </span>
                      </div>
                    </div>

                    {videoPreviewUrl && (
                      <div className="max-w-xs mx-auto rounded-lg overflow-hidden border border-[#E5E1D8] bg-black mt-2">
                        <video src={videoPreviewUrl} controls className="w-full aspect-video" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVideoFile(null);
                        setVideoPreviewUrl(null);
                      }}
                      className="mt-2 font-mono text-xs text-rose-600 hover:text-rose-800 underline cursor-pointer"
                    >
                      Remove and choose different video file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 py-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E1D8] bg-[#FFFFFF] text-[#B08D57] mb-2 shadow-2xs mx-auto">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-[#111827]">
                      Drag & drop your video lecture here, or <span className="underline underline-offset-4 text-[#B08D57]">choose a file</span>
                    </p>
                    <p className="text-xs text-[#475569] mt-1">
                      Supports <span className="text-[#111827] font-medium">MP4</span>, <span className="text-[#111827] font-medium">WebM</span>, <span className="text-[#111827] font-medium">MOV</span>, and <span className="text-[#111827] font-medium">MKV</span> video files (up to 500MB)
                    </p>
                  </div>
                )}
              </div>

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-[#E5E1D8]" />
                <span className="shrink mx-4 text-[11px] font-mono uppercase text-[#64748B]">Lecture Metadata</span>
                <div className="grow border-t border-[#E5E1D8]" />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1E293B] block mb-1">Lecture Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Systems & Microservices Architecture"
                  value={videoForm.title}
                  onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })}
                  className="w-full text-sm p-2.5 rounded-md bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#1E293B] block mb-1">Subject / Domain *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Backend Engineering / AI / Cloud"
                    value={videoForm.subject}
                    onChange={(e) => setVideoForm({ ...videoForm, subject: e.target.value })}
                    className="w-full text-sm p-2.5 rounded-md bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1E293B] block mb-1">Duration (Minutes) *</label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    required
                    value={videoForm.duration_minutes}
                    onChange={(e) => setVideoForm({ ...videoForm, duration_minutes: parseInt(e.target.value) || 30 })}
                    className="w-full text-sm p-2.5 rounded-md bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1E293B] block mb-1">Skills Covered (Comma Separated)</label>
                <input
                  type="text"
                  placeholder="Python, FastAPI, Docker, Microservices, PostgreSQL"
                  value={videoForm.skills_covered_str}
                  onChange={(e) => setVideoForm({ ...videoForm, skills_covered_str: e.target.value })}
                  className="w-full text-sm p-2.5 rounded-md bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1E293B] block mb-1">Lecture Description & Overview</label>
                <textarea
                  rows={2}
                  placeholder="Describe key topics and takeaways of this masterclass..."
                  value={videoForm.description}
                  onChange={(e) => setVideoForm({ ...videoForm, description: e.target.value })}
                  className="w-full text-sm p-2.5 rounded-md bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1E293B] block mb-1">Professor's Study Notes & Key References (Markdown)</label>
                <textarea
                  rows={3}
                  placeholder="# Lecture Notes&#10;&#10;### 1. Key Concepts...&#10;### 2. Suggested Practice Exercises..."
                  value={videoForm.notes_markdown}
                  onChange={(e) => setVideoForm({ ...videoForm, notes_markdown: e.target.value })}
                  className="w-full text-sm p-2.5 rounded-md bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] placeholder:text-[#94A3B8] font-mono text-xs focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-hidden"
                />
              </div>

              <div className="pt-4 border-t border-[#E2E8F0] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowVideoModal(false);
                    setVideoFile(null);
                    setVideoPreviewUrl(null);
                  }}
                  className="px-4 py-2 text-sm text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVideo || !videoFile}
                  className="px-5 py-2.5 bg-[#B08D57] hover:bg-[#9A7B4A] disabled:opacity-50 text-white text-sm font-medium rounded-md shadow-xs transition-colors cursor-pointer flex items-center gap-2"
                >
                  {savingVideo ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading Video & Publishing...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      <span>Upload & Publish Video Lecture</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: PREVIEW VIDEO PLAYER */}
      {activePreviewVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl max-w-3xl w-full overflow-hidden shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-[#2563EB]" />
                <h3 className="text-base font-semibold text-[#0F172A] line-clamp-1">{activePreviewVideo.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewVideo(null)}
                className="text-[#64748B] hover:text-[#0F172A] p-1.5 rounded-md hover:bg-[#E2E8F0] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={getEmbedUrl(activePreviewVideo.video_url)}
                title={activePreviewVideo.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span className="font-semibold text-[#0F172A]">{activePreviewVideo.subject} · {activePreviewVideo.duration_minutes} mins</span>
                <span>{activePreviewVideo.views_count} total views</span>
              </div>
              <p className="text-xs text-[#334155] leading-relaxed">{activePreviewVideo.description}</p>
            </div>

            <div className="p-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex justify-end">
              <button
                type="button"
                onClick={() => setActivePreviewVideo(null)}
                className="px-4 py-2 bg-[#0F172A] text-white text-xs font-medium rounded-md cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
