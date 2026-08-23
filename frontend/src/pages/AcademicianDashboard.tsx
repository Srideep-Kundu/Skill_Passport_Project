import React, { useCallback, useEffect, useState } from "react";
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
} from "../api/types";
import { toast } from "sonner";

interface Props {
  token: string;
}

type TabType =
  | "opportunities"
  | "applications"
  | "workspaces"
  | "passport"
  | "internships"
  | "proposals"
  | "mentorship_events"
  | "advising"
  | "documents"
  | "history";

export function AcademicianDashboard({ token }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("opportunities");
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
        return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40";
      case "active":
      case "in_progress":
        return "bg-blue-50 dark:bg-blue-950/40 text-[#3b71d9] dark:text-[#b0c6ff] border-blue-200 dark:border-blue-800/40";
      case "shortlisted":
      case "discussion":
        return "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40";
      case "submitted":
      case "under_review":
        return "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40";
      case "draft":
        return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700";
      case "rejected":
      case "withdrawn":
        return "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/40";
      default:
        return "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800";
    }
  };

  const navTabs = [
    { id: "opportunities", label: "Opportunities", icon: Briefcase, count: opportunities.length },
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
        <div className="inline-block animate-spin h-8 w-8 border-4 border-[#3b71d9] border-t-transparent rounded-full mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading Faculty & Academician Portal...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 font-['Manrope']">
      {/* Welcome Banner */}
      <div className="bg-white dark:bg-[#151921] rounded-3xl p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#3b71d9]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9] dark:text-[#b0c6ff] text-xs font-bold mb-3">
                <GraduationCap className="h-3.5 w-3.5" />
                Faculty & Academician Portal • Phase 1 & 2
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
                {passport?.full_name || "Faculty Fellow"}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                {passport?.designation} • {passport?.department} • <strong>{passport?.institution_name}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNotificationsModal(true)}
                className="p-2 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl relative cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter((n) => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-rose-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {notifications.filter((n) => !n.is_read).length}
                  </span>
                )}
              </button>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  passport?.collaboration_availability === "available"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                    : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200"
                }`}
              >
                ● Availability: {passport?.collaboration_availability?.replace("_", " ").toUpperCase()}
              </span>
              <button
                onClick={() => setActiveTab("passport")}
                className="px-4 py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit Passport
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-white/[0.06]">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
              <span className="text-xs text-slate-400 uppercase font-semibold">Active Workspaces</span>
              <p className="text-2xl font-black text-[#3b71d9] mt-0.5">
                {workspaces.filter((w) => w.status === "active").length}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
              <span className="text-xs text-slate-400 uppercase font-semibold">Total Proposals</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{applications.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
              <span className="text-xs text-slate-400 uppercase font-semibold">Grants Secured</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{((passport?.total_grants_secured || 0) / 100000).toFixed(1)} L
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
              <span className="text-xs text-slate-400 uppercase font-semibold">Live Advising</span>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5">{advisedProjects.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
              <span className="text-xs text-slate-400 uppercase font-semibold">Completed Collabs</span>
              <p className="text-2xl font-black text-amber-500 mt-0.5">{historyItems.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200 dark:border-white/[0.08]">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? "bg-[#3b71d9] text-white shadow-xs"
                  : "bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {typeof tab.count === "number" && tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full font-extrabold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-white/[0.1] text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OPPORTUNITIES & DISCOVERY */}
      {activeTab === "opportunities" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: "all", label: "All Programs" },
                { id: "industrial_immersion", label: "Industry Immersion" },
                { id: "industrial_training", label: "Industrial Training" },
                { id: "faculty_internship", label: "Faculty Internships" },
                { id: "fdp", label: "FDP & Workshops" },
                { id: "research_grant", label: "R&D Grants" },
                { id: "consultancy_request", label: "Consultancy" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOppTypeFilter(t.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    oppTypeFilter === t.id
                      ? "bg-[#3b71d9] text-white shadow-xs"
                      : "bg-slate-100 dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search domain, corporate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
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
                  className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-white/[0.15] transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9] dark:text-[#b0c6ff]">
                        {opp.opportunity_type.replace("_", " ")}
                      </span>
                      {opp.stipend_or_grant && (
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
                          Grant: ₹{(opp.stipend_or_grant / 1000).toFixed(0)}k
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{opp.title}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      <strong>{opp.organization_name}</strong> • Domain: {opp.domain}
                    </p>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 line-clamp-3">
                      {opp.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {opp.duration_weeks} Weeks
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Mode: <strong className="capitalize">{opp.mode || "Hybrid"}</strong>
                      </span>
                      {opp.deadline && (
                        <span className="flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Deadline: {new Date(opp.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-3">
                    <button
                      onClick={() => setSelectedOppDetail(opp)}
                      className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-white/[0.04] rounded-xl cursor-pointer"
                    >
                      View Details
                    </button>

                    {opp.has_applied ? (
                      <div className="p-2 px-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
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
                        className="px-4 py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shadow-[#3b71d9]/20"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Apply / Submit Proposal
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 2: MY APPLICATIONS & PROPOSALS */}
      {activeTab === "applications" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#3b71d9]" />
                  My Applications & Proposal Lifecycle Tracking
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
              <div className="overflow-x-auto border border-slate-100 dark:border-white/[0.06] rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-400 uppercase font-bold tracking-wider">
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
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] font-medium text-slate-700 dark:text-slate-300">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {app.proposal_title || app.opportunity_title}
                        </td>
                        <td className="p-3.5">{app.organization_name}</td>
                        <td className="p-3.5">
                          <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04]">
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
                            <span className="text-purple-600 font-bold">Schedule Sync</span>
                          ) : app.status === "draft" ? (
                            <span className="text-amber-600 font-bold">Ready to Submit</span>
                          ) : (
                            "Under Review"
                          )}
                        </td>
                        <td className="p-3.5 text-right space-x-2">
                          <button
                            onClick={() => setSelectedAppDetail(app)}
                            className="px-3 py-1 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 text-slate-800 dark:text-white font-bold rounded-lg text-xs cursor-pointer"
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
            <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-white/[0.06]">
                <div>
                  <button
                    onClick={() => setSelectedWorkspace(null)}
                    className="text-xs text-[#3b71d9] font-bold hover:underline mb-2 block cursor-pointer"
                  >
                    ← Back to All Workspaces
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9]">
                      {selectedWorkspace.collaboration_type.replace("_", " ")}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${getStatusBadge(selectedWorkspace.status)}`}>
                      {selectedWorkspace.status}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
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
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-[#3b71d9]" />
                      Milestones & Technical Deliverables
                    </h3>
                    <div className="space-y-3">
                      {selectedWorkspace.milestones.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08]"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={m.status === "completed"}
                              onChange={() => handleToggleMilestone(selectedWorkspace.id, m.id, m.status)}
                              className="h-4 w-4 rounded text-[#3b71d9] cursor-pointer"
                            />
                            <div>
                              <p className={`text-xs font-bold ${m.status === "completed" ? "line-through text-slate-400" : "text-slate-900 dark:text-white"}`}>
                                {m.title}
                              </p>
                              {m.due_date && <span className="text-[10px] text-slate-400">Due: {m.due_date}</span>}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusBadge(m.status)}`}>
                            {m.status.replace("_", " ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tasks / Action Items */}
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[#3b71d9]" />
                      Sprint Tasks & Action Items
                    </h3>
                    <div className="space-y-2">
                      {selectedWorkspace.tasks.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08]"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">{t.title}</p>
                            <span className="text-[10px] text-slate-400">Assigned: {t.assigned_to}</span>
                          </div>
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] font-bold">
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
                        className="flex-1 text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                      />
                      <select
                        value={newTaskAssignee}
                        onChange={(e) => setNewTaskAssignee(e.target.value)}
                        className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                      >
                        <option value="Faculty Lead">Faculty Lead</option>
                        <option value="Industry Lead">Industry Lead</option>
                        <option value="Research Scholar">Research Scholar</option>
                        <option value="Joint Team">Joint Team</option>
                      </select>
                      <button
                        onClick={() => handleAddTask(selectedWorkspace.id)}
                        className="px-4 py-2 bg-[#3b71d9] text-white text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Add Task
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Col: Discussion Stream & Participants */}
                <div className="space-y-6">
                  {/* Participants */}
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#3b71d9]" /> Workspace Team
                    </h3>
                    <div className="space-y-2">
                      {selectedWorkspace.participants.map((p, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-xs">
                          <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                          <p className="text-[10px] text-slate-400">{p.role} • {p.company || p.department}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Discussion Thread */}
                  <div className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[#3b71d9]" /> Industry Updates & Chat
                    </h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {selectedWorkspace.discussion_posts.map((post) => (
                        <div key={post.id} className="p-3 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white">{post.author_name}</span>
                            <span className="text-[10px] text-slate-400 uppercase">{post.author_role}</span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">{post.content}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 pt-2">
                      <textarea
                        rows={2}
                        placeholder="Write update to industry team..."
                        value={newDiscussionText}
                        onChange={(e) => setNewDiscussionText(e.target.value)}
                        className="w-full text-xs p-3 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                      />
                      <button
                        onClick={() => handleAddDiscussion(selectedWorkspace.id)}
                        className="w-full py-2 bg-[#3b71d9] text-white text-xs font-bold rounded-xl cursor-pointer"
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
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Active Academia–Industry Collaboration Rooms
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dedicated collaborative project rooms generated automatically on proposal acceptance.
                  </p>
                </div>
              </div>

              {workspaces.length === 0 ? (
                <div className="p-12 text-center bg-white dark:bg-[#151921] rounded-3xl border border-slate-200 dark:border-white/[0.08] text-sm text-slate-400">
                  No active workspaces yet. Once an industry partner accepts your proposal, a collaboration workspace is instantiated here.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {workspaces.map((ws) => (
                    <div
                      key={ws.id}
                      className="bg-white dark:bg-[#151921] rounded-3xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4 hover:border-slate-300 dark:hover:border-white/[0.15] transition-all cursor-pointer"
                      onClick={() => setSelectedWorkspace(ws)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9]">
                          {ws.collaboration_type.replace("_", " ")}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${getStatusBadge(ws.status)}`}>
                          {ws.status}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{ws.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" /> <strong>{ws.organization_name}</strong> • Lead: {ws.industry_lead_name}
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-slate-400">Milestone Progress</span>
                          <span className="text-emerald-600">{ws.progress_percentage}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${ws.progress_percentage}%` }}
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs text-slate-500 font-bold">
                        <span>{ws.milestones?.length || 0} Milestones</span>
                        <span className="text-[#3b71d9] flex items-center gap-1">
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
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="h-6 w-6 text-[#3b71d9]" />
                  Faculty Professional Academic Passport
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Verifiable professional profile showcasing research expertise, publications, patents, past industry training, and collaboration availability.
                </p>
              </div>

              <button
                onClick={() => setIsEditingPassport(!isEditingPassport)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 text-slate-900 dark:text-white text-xs font-bold rounded-xl cursor-pointer"
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
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Designation</label>
                    <input
                      type="text"
                      value={passportForm.designation || ""}
                      onChange={(e) => setPassportForm({ ...passportForm, designation: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Department</label>
                    <input
                      type="text"
                      value={passportForm.department || ""}
                      onChange={(e) => setPassportForm({ ...passportForm, department: e.target.value })}
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Years of Experience</label>
                    <input
                      type="number"
                      value={passportForm.years_experience || 0}
                      onChange={(e) => setPassportForm({ ...passportForm, years_experience: parseInt(e.target.value) || 0 })}
                      className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Professional Bio</label>
                  <textarea
                    rows={3}
                    value={passportForm.bio || ""}
                    onChange={(e) => setPassportForm({ ...passportForm, bio: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Collaboration Availability</label>
                  <select
                    value={passportForm.collaboration_availability || "available"}
                    onChange={(e) => setPassportForm({ ...passportForm, collaboration_availability: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
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
                    className="px-5 py-2 bg-[#3b71d9] text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    {savingPassport ? "Saving..." : "Save Passport"}
                  </button>
                </div>
              </div>
            ) : (
              /* View Passport */
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-6">
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-3">
                    <span className="text-xs text-slate-400 uppercase font-bold">Research Areas</span>
                    <div className="flex flex-wrap gap-1.5">
                      {passport?.research_areas?.map((r, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9]">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-3">
                    <span className="text-xs text-slate-400 uppercase font-bold">Technical Skills</span>
                    <div className="flex flex-wrap gap-1.5">
                      {passport?.technical_skills?.map((s, i) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-2">
                    <span className="text-xs text-slate-400 uppercase font-bold">Academic & Industrial Biography</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {passport?.bio || "Professor with over a decade of research in distributed computing and applied artificial intelligence. Active PI on sponsored research and corporate immersion programs."}
                    </p>
                  </div>

                  {/* Publications & Patents Cards */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/[0.06] space-y-3">
                    <span className="text-xs text-slate-400 uppercase font-bold">Selected Research Publications & Patents</span>
                    <div className="space-y-2">
                      {passport?.publications && passport.publications.length > 0 ? (
                        passport.publications.map((p, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-xs">
                            <p className="font-bold text-slate-900 dark:text-white">{p.title}</p>
                            <p className="text-[10px] text-slate-400">{p.journal_or_conf} • {p.year}</p>
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
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#3b71d9]" />
              Faculty Industrial Training & Sabbatical Immersion Lifecycle
            </h2>
            <p className="text-xs text-slate-500 max-w-3xl">
              Dedicated track for AICTE / corporate industrial training, faculty summer internships, and sabbaticals with milestones, mentor feedback, and reflection reports.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                <span className="text-xs text-blue-600 font-bold uppercase">1. Selection & Mentor Alignment</span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Corporate mentor assignment and kickoff charter agreement.</p>
              </div>
              <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                <span className="text-xs text-purple-600 font-bold uppercase">2. Milestone Execution</span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Hands-on industrial sprint completion and weekly sync reviews.</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                <span className="text-xs text-emerald-600 font-bold uppercase">3. Outcome & Certification</span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Completion report submission and academic credential endorsement.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: R&D PROPOSALS */}
      {activeTab === "proposals" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#3b71d9]" />
              Applied Research Grants & Joint R&D Proposal Hub
            </h2>
            <p className="text-xs text-slate-500 max-w-3xl">
              Construct structured research proposals with methodology, budget breakdowns, student research assistants, and industry deliverables.
            </p>

            <div className="pt-4">
              <button
                onClick={() => {
                  setActiveTab("opportunities");
                  setOppTypeFilter("research_grant");
                }}
                className="px-4 py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Browse Open R&D Grants
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: MENTORSHIP & EVENTS */}
      {activeTab === "mentorship_events" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-[#3b71d9]" />
                Industry Mentorship, Masterclasses & Faculty Workshops
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Registrations loaded from your persisted faculty event records.
              </p>
            </div>

            {/* Event Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {events.length === 0 ? (
                <div className="md:col-span-2 p-8 text-center text-xs text-slate-400">
                  No faculty event registrations are available.
                </div>
              ) : events.map((ev) => {
                return (
                  <div key={ev.id} className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-600">
                          {ev.event_type.toUpperCase()}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{ev.event_title}</h3>
                        <p className="text-xs text-slate-500">Host: <strong>{ev.host_organization}</strong> • {ev.scheduled_at ? new Date(ev.scheduled_at).toLocaleDateString() : "Date pending"}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">Role: {ev.role} • Status: {ev.status}</p>
                    <div className="pt-2 flex justify-end">
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
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
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-[#3b71d9]" />
                Live Industry Projects — Faculty Advisor Hub
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Review student innovation teams, monitor challenge milestones, and provide verifiable academic feedback.
              </p>
            </div>

            <div className="space-y-4">
              {advisedProjects.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No active student challenges currently assigned for advising.</div>
              ) : (
                advisedProjects.map((p) => (
                  <div key={p.challenge_id} className="p-6 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{p.title}</h3>
                        <p className="text-xs text-slate-500">Corporate Host: {p.host_company} • {p.duration_weeks} Weeks</p>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                        {p.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300">{p.problem_statement}</p>

                    {/* Student Teams */}
                    <div className="space-y-3 pt-2">
                      <span className="text-xs font-bold text-slate-400 uppercase">Enrolled Student Teams</span>
                      {p.student_teams?.map((st) => (
                        <div key={st.id} className="p-4 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-900 dark:text-white">Team: {st.team_members.join(", ")}</span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-[#3b71d9]">{st.status}</span>
                          </div>

                          {st.feedback && (
                            <p className="text-xs text-slate-500 italic bg-slate-50 dark:bg-white/[0.02] p-2 rounded-lg">
                              {st.feedback}
                            </p>
                          )}

                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Add academic advisor endorsement / feedback..."
                              value={advisingFeedbackMap[st.id] || ""}
                              onChange={(e) => setAdvisingFeedbackMap({ ...advisingFeedbackMap, [st.id]: e.target.value })}
                              className="flex-1 text-xs px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                            />
                            <button
                              onClick={() => handleSubmitAdvisingFeedback(st.id)}
                              className="px-3 py-1.5 bg-[#3b71d9] text-white text-xs font-bold rounded-xl cursor-pointer"
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
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#3b71d9]" />
                  Faculty Secure Document Vault
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Store CVs, detailed research proposals, FDP completion certificates, and consultancy deliverables.
                </p>
              </div>
            </div>

            {/* Document Upload Form */}
            <form onSubmit={handleUploadDoc} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Title</label>
                <input
                  type="text"
                  placeholder="e.g. CV 2026 / Grant Proposal"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                >
                  <option value="research_document">Research Document / Proposal</option>
                  <option value="fdp_certificate">FDP / Training Certificate</option>
                  <option value="resume">Academic CV / Resume</option>
                  <option value="internship_report">Consultancy Report</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">URL / Storage Link</label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/..."
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={uploadingDoc}
                  className="w-full py-2 bg-[#3b71d9] text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  {uploadingDoc ? "Saving..." : "Upload Document"}
                </button>
              </div>
            </form>

            {/* Documents List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-2">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-[#3b71d9]">
                    {doc.document_type.replace("_", " ")}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{doc.title}</h4>
                  <p className="text-[10px] text-slate-400">{doc.file_name} • {(doc.file_size_bytes / 1024).toFixed(0)} KB</p>
                  {doc.file_url && (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#3b71d9] font-bold flex items-center gap-1 hover:underline pt-1"
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
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#3b71d9]" />
                Completed Collaborations & Verifiable Outcomes
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Archived track record of completed corporate research, consultancy contracts, FDPs, and industrial immersions.
              </p>
            </div>

            {historyItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400">No completed collaborations archived yet.</div>
            ) : (
              <div className="space-y-4">
                {historyItems.map((item) => (
                  <div key={item.id} className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-600">
                          {item.collaboration_type.replace("_", " ")}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{item.title}</h3>
                        <p className="text-xs text-slate-500">Organization: <strong>{item.organization_name}</strong> • Role: {item.role}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                        COMPLETED
                      </span>
                    </div>
                    {item.outcome_summary && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">{item.outcome_summary}</p>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/[0.08] shadow-2xl space-y-6">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9]">
                  {selectedOppDetail.opportunity_type.replace("_", " ")}
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
                  {selectedOppDetail.title}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedOppDetail.organization_name} • Domain: {selectedOppDetail.domain}
                </p>
              </div>
              <button
                onClick={() => setSelectedOppDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white uppercase text-[10px] mb-1">Description</h4>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{selectedOppDetail.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02]">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Duration</span>
                  <span className="font-bold text-slate-900 dark:text-white">{selectedOppDetail.duration_weeks} Weeks</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">Funding / Stipend</span>
                  <span className="font-bold text-emerald-600">
                    {selectedOppDetail.stipend_or_grant ? `₹${selectedOppDetail.stipend_or_grant.toLocaleString()}` : "Honorary / Academic"}
                  </span>
                </div>
              </div>

              {selectedOppDetail.required_expertise && selectedOppDetail.required_expertise.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase text-[10px] mb-1">Required Faculty Expertise</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOppDetail.required_expertise.map((exp, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-blue-50 text-[#3b71d9] font-bold">
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                onClick={() => setSelectedOppDetail(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 cursor-pointer"
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
                className="px-4 py-2 bg-[#3b71d9] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Apply / Submit Proposal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: APPLY / PROPOSAL SUBMISSION MODAL */}
      {showApplyModal && applyingOpportunity && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/[0.08] shadow-2xl space-y-6">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-50 text-[#3b71d9]">
                  {applyingOpportunity.opportunity_type.replace("_", " ")}
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  Submit Proposal: {applyingOpportunity.title}
                </h2>
                <p className="text-xs text-slate-500">Corporate Partner: {applyingOpportunity.organization_name}</p>
              </div>
              <button
                onClick={() => setShowApplyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Proposal Title *</label>
                <input
                  type="text"
                  value={proposalForm.proposal_title}
                  onChange={(e) => setProposalForm({ ...proposalForm, proposal_title: e.target.value })}
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Executive Summary / Proposal Text *</label>
                <textarea
                  rows={4}
                  placeholder="Outline problem understanding, faculty expertise fit, research goals, or consultancy scope..."
                  value={proposalForm.proposal_text}
                  onChange={(e) => setProposalForm({ ...proposalForm, proposal_text: e.target.value })}
                  className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Methodology / Technical Approach</label>
                  <textarea
                    rows={3}
                    placeholder="Algorithms, experimental setup, or training modules..."
                    value={proposalForm.methodology}
                    onChange={(e) => setProposalForm({ ...proposalForm, methodology: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Industry Support Required</label>
                  <textarea
                    rows={3}
                    placeholder="Cloud credits, hardware datasets, mentor review cadence..."
                    value={proposalForm.industry_support_required}
                    onChange={(e) => setProposalForm({ ...proposalForm, industry_support_required: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Timeline (Weeks)</label>
                  <input
                    type="number"
                    value={proposalForm.timeline_weeks}
                    onChange={(e) => setProposalForm({ ...proposalForm, timeline_weeks: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Requested Budget / Grant (₹)</label>
                  <input
                    type="number"
                    value={proposalForm.budget_requested}
                    onChange={(e) => setProposalForm({ ...proposalForm, budget_requested: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
              <button
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSubmitProposal(true)}
                disabled={submittingProposal}
                className="px-4 py-2 bg-slate-100 dark:bg-white/[0.05] hover:bg-slate-200 text-slate-800 dark:text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Save Draft
              </button>
              <button
                onClick={() => handleSubmitProposal(false)}
                disabled={submittingProposal}
                className="px-5 py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                {submittingProposal ? "Submitting..." : "Submit to Industry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: APPLICATION DETAIL VIEW */}
      {selectedAppDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-white/[0.08] shadow-2xl space-y-6">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase ${getStatusBadge(selectedAppDetail.status)}`}>
                  {selectedAppDetail.status}
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
                  {selectedAppDetail.proposal_title || selectedAppDetail.opportunity_title}
                </h2>
                <p className="text-xs text-slate-500">Corporate Partner: {selectedAppDetail.organization_name}</p>
              </div>
              <button
                onClick={() => setSelectedAppDetail(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-slate-400 uppercase text-[10px] mb-1">Proposal Overview</h4>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-white/[0.02] p-3.5 rounded-xl">
                  {selectedAppDetail.proposal_text || "No detailed proposal text provided."}
                </p>
              </div>

              {selectedAppDetail.reviewer_notes && (
                <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40">
                  <span className="font-bold text-purple-700 dark:text-purple-300 uppercase text-[10px] block mb-1">Industry Reviewer Notes</span>
                  <p className="text-slate-700 dark:text-slate-300">{selectedAppDetail.reviewer_notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
              {selectedAppDetail.status !== "accepted" && selectedAppDetail.status !== "completed" && selectedAppDetail.status !== "withdrawn" && (
                <button
                  onClick={() => handleWithdrawApplication(selectedAppDetail.id)}
                  className="px-4 py-2 text-rose-600 text-xs font-bold cursor-pointer"
                >
                  Withdraw Application
                </button>
              )}
              <button
                onClick={() => setSelectedAppDetail(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/[0.05] text-slate-800 dark:text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: NOTIFICATIONS MODAL */}
      {showNotificationsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 max-w-lg w-full border border-slate-200 dark:border-white/[0.08] shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#3b71d9]" /> Notifications & Alerts
              </h3>
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No notifications at this time.</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      n.is_read
                        ? "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06]"
                        : "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-900 dark:text-white">{n.title}</span>
                      <span className="text-[10px] text-slate-400">{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowNotificationsModal(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-white/[0.05] text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
