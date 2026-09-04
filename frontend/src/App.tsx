import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Toaster } from "sonner";
import {
  LayoutDashboard,
  BadgeCheck,
  FileText,
  Target,
  MoreHorizontal,
  X,
  LogOut,
  Menu,
  Search,
  Code2,
  Compass,
  Users,
  BookOpen,
  ShieldCheck,
  Briefcase,
  Users2,
  TrendingUp,
  GraduationCap,
  Building2,
  Sparkles,
  Award,
  Clock,
  Layers,
  FileSpreadsheet,
  Download,
  BarChart3,
  Video,
  Handshake,
} from "lucide-react";
import { LandingPage } from "./pages/LandingPage";
import { useAuth } from "./auth/AuthContext";
import { CommandPalette } from "./components/CommandPalette";
import { SkillPassportCopilot } from "./components/SkillPassportCopilot";
import { PostLoginTransition } from "./components/PostLoginTransition";

const RecruiterDashboard = lazy(async () => ({
  default: (await import("./pages/RecruiterDashboard")).RecruiterDashboard,
}));
const StudentDashboard = lazy(async () => ({
  default: (await import("./pages/StudentDashboard")).StudentDashboard,
}));
const AcademicianDashboard = lazy(async () => ({
  default: (await import("./pages/AcademicianDashboard")).AcademicianDashboard,
}));
const InstitutionDashboard = lazy(async () => ({
  default: (await import("./pages/InstitutionDashboard")).InstitutionDashboard,
}));

function DashboardVideoBackground() {
  const prefersReduced = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* Full-viewport Background Video Layer (100% High Visibility) */}
      {!prefersReduced ? (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed inset-0 h-full w-full object-cover z-[-2] opacity-100"
          src="https://designerstephen.github.io/public-assets/videos/serene-art-hero.mp4"
        />
      ) : (
        <div className="fixed inset-0 bg-[#F7F5F0] z-[-2]" />
      )}

      {/* Subtle Non-Obtrusive Legibility Overlay (Maximizes Video Visibility) */}
      <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-white/20 via-transparent to-white/20" />
    </div>
  );
}

export type StudentTab =
  | "overview"
  | "passport"
  | "evidence"
  | "gaps"
  | "assessments"
  | "learning"
  | "placements"
  | "collaborations"
  | "github"
  | "matches"
  | "discovery"
  | "teams";
export type RecruiterTab =
  | "overview"
  | "evidence_graph"
  | "discovery"
  | "matches"
  | "candidates"
  | "comparison"
  | "skills"
  | "pipeline"
  | "internships"
  | "post_job"
  | "applications"
  | "analytics";
export type AcademicianTab =
  | "collaboration_funding_hub"
  | "opportunities"
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
export type InstitutionTab =
  | "overview"
  | "departments"
  | "cohorts"
  | "skills"
  | "internships"
  | "placements"
  | "faculty"
  | "partnerships"
  | "interventions"
  | "reports";

export function App() {
  const { session, signOut, justLoggedIn, completePostLoginTransition } = useAuth();
  const prefersReduced = useReducedMotion();
  const [studentTab, setStudentTab] = useState<StudentTab>("overview");
  const [recruiterTab, setRecruiterTab] = useState<RecruiterTab>("overview");
  const [academicianTab, setAcademicianTab] = useState<AcademicianTab>("opportunities");
  const [institutionTab, setInstitutionTab] = useState<InstitutionTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("skill_passport_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("skill_passport_sidebar_collapsed", String(isCollapsed));
  }, [isCollapsed]);

  // Keyboard shortcut (Ctrl+B / Cmd+B) to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Ensure every tab change automatically scrolls to the top of the viewport
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [studentTab, recruiterTab, academicianTab, institutionTab]);

  if (!session) {
    return <LandingPage />;
  }

  if (justLoggedIn) {
    return (
      <PostLoginTransition
        role={session.role}
        userEmail={session.email}
        onComplete={() => {
          setStudentTab("overview");
          setRecruiterTab("overview");
          completePostLoginTransition();
        }}
      />
    );
  }

  const isStudent = session.role === "student";
  const isRecruiter = session.role === "recruiter";
  const isAcademician = session.role === "academician";
  const isInstitution = session.role === "institution";

  // Core student navigation tabs
  const studentNavItems: { id: StudentTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "passport", label: "Lumina Intel", icon: <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "gaps", label: "Skill Gaps & Goals", icon: <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "assessments", label: "Skill Assessments", icon: <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "learning", label: "Learning Hub", icon: <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "placements", label: "Campus Placements", icon: <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "collaborations", label: "Mentorship & Events", icon: <Users2 className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "evidence", label: "Evidence & Resumes", icon: <FileText className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "github", label: "GitHub Verification", icon: <Code2 className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "matches", label: "Internship Matches", icon: <Target className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "discovery", label: "Job Discovery Market", icon: <Compass className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "teams", label: "Team Formation", icon: <Users className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  ];

  // 10 Lumina Intel Recruiter navigation tabs
  const recruiterNavItems: { id: RecruiterTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "evidence_graph", label: "Evidence Graph", icon: <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "discovery", label: "Talent Discovery", icon: <Compass className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "matches", label: "Explainable Matches", icon: <Target className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "comparison", label: "Candidate Comparison", icon: <Users2 className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "skills", label: "Skill Intelligence", icon: <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "pipeline", label: "Talent Pipeline", icon: <Layers className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "internships", label: "Internship Management", icon: <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "applications", label: "Candidate Applications", icon: <FileText className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "analytics", label: "Analytics & Insights", icon: <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  ];

  // 11 Faculty / Academician Portal navigation tabs
  const academicianNavItems: { id: AcademicianTab; label: string; icon: React.ReactNode }[] = [
    { id: "collaboration_funding_hub", label: "Collaboration & Funding", icon: <Handshake className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "opportunities", label: "Opportunities", icon: <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "videos", label: "Video Lectures", icon: <Video className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "applications", label: "My Applications", icon: <FileText className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "workspaces", label: "Workspaces", icon: <Layers className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "passport", label: "Academic Passport", icon: <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "internships", label: "Industrial Training", icon: <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "proposals", label: "R&D & Grants", icon: <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "mentorship_events", label: "Mentorship & Events", icon: <Users className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "advising", label: "Project Advising", icon: <Award className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "documents", label: "Vault Documents", icon: <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "history", label: "History & Outcomes", icon: <Clock className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  ];

  // 10 University / Institution Intelligence navigation tabs
  const institutionNavItems: { id: InstitutionTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Executive Overview", icon: <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "departments", label: "Department Drill-Down", icon: <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "cohorts", label: "Cohorts & At-Risk", icon: <Users className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "skills", label: "Skill & Curriculum Gap", icon: <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "internships", label: "Internship Funnel", icon: <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "placements", label: "Placement Outcomes", icon: <Award className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "faculty", label: "Faculty Immersion", icon: <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "partnerships", label: "Corporate Partnerships", icon: <Layers className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "interventions", label: "Action Plans", icon: <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "reports", label: "Institutional Reports", icon: <Download className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  ];

  const currentTabName = isStudent
    ? studentTab
    : isRecruiter
    ? recruiterTab
    : isAcademician
    ? academicianTab
    : institutionTab;

  return (
    <div className="min-h-screen relative flex text-[#111827] font-sans selection:bg-[rgba(176,141,87,0.2)] selection:text-[#111827]">
      {/* Shared Full-Viewport Animated Background Video Layer */}
      <DashboardVideoBackground />

      {/* Toast Notifications */}
      <Toaster position="bottom-right" theme="light" closeButton />

      {/* Command Palette */}
      {(isStudent || isRecruiter) && (
        <CommandPalette
          open={cmdOpen}
          onOpenChange={setCmdOpen}
          role={isStudent ? "student" : "recruiter"}
          onSelectStudentTab={setStudentTab}
          onSelectRecruiterTab={setRecruiterTab}
        />
      )}

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0F172A]/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Rail / Sidebar (Translucent Glassmorphism with Subtle Border) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 h-screen md:sticky md:top-0 bg-white/20 md:bg-white/20 backdrop-blur-md border-r border-[#E5E1D8]/60 flex flex-col justify-between transition-all duration-200 md:translate-x-0 shrink-0 ${
          isCollapsed ? "md:w-20" : "md:w-64"
        } w-64 ${mobileMenuOpen ? "translate-x-0 shadow-2xl bg-white/95" : "-translate-x-full"}`}
      >
        {/* Top Header & Nav Items */}
        <div className={`flex-1 min-h-0 ${isCollapsed ? "p-3 overflow-hidden" : "p-5 overflow-y-auto no-scrollbar"}`}>
          {/* Logo */}
          <div className={`flex items-center ${isCollapsed ? "flex-col gap-3" : "justify-between"} pb-6 border-b border-[#E5E1D8]/40 mb-4`}>
            <a href="/" className="flex items-center gap-2.5 text-[#111827] min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#B08D57]/40 bg-white/30 font-mono text-xs text-[#B08D57] font-semibold">
                LI
              </span>
              {!isCollapsed && (
                <div className="overflow-hidden whitespace-nowrap">
                  <span
                    className="text-lg font-normal tracking-tight block leading-none text-[#111827]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Lumina Intel<sup className="text-[10px] ml-0.5 text-[#B08D57]">®</sup>
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#B08D57] block mt-1 font-semibold">
                    {session.role}
                  </span>
                </div>
              )}
            </a>

            {/* Sidebar Collapse Toggle */}
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#E5E1D8]/40 bg-white/20 text-[#64748B] hover:text-[#111827] hover:border-[#B08D57]/50 transition-colors cursor-pointer"
            >
              <MoreHorizontal className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "rotate-90" : ""}`} />
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              className="md:hidden text-[#64748B] hover:text-[#111827] p-1"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {!isCollapsed && (
              <div className="text-xs font-mono uppercase tracking-wider text-[#0f172a] px-3 py-1.5 mb-1.5 font-bold">
                Workspace
              </div>
            )}

            {isStudent &&
              studentNavItems.map((item) => {
                const isActive = studentTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setStudentTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-lg text-[13.5px] leading-snug transition-all duration-200 cursor-pointer ${
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5 gap-3"
                    } ${
                      isActive
                        ? "bg-white/80 text-[#000000] font-bold border-l-3 border-[#935f18] shadow-xs"
                        : "text-[#0f172a] font-medium hover:bg-white/40 hover:text-[#000000] hover:font-semibold"
                    }`}
                  >
                    <span className={`shrink-0 ${isActive ? "text-[#935f18]" : "text-[#1e293b]"}`}>{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}

            {isRecruiter &&
              recruiterNavItems.map((item) => {
                const isActive = recruiterTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setRecruiterTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-lg text-[13.5px] leading-snug transition-all duration-200 cursor-pointer ${
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5 gap-3"
                    } ${
                      isActive
                        ? "bg-white/80 text-[#000000] font-bold border-l-3 border-[#935f18] shadow-xs"
                        : "text-[#0f172a] font-medium hover:bg-white/40 hover:text-[#000000] hover:font-semibold"
                    }`}
                  >
                    <span className={`shrink-0 ${isActive ? "text-[#935f18]" : "text-[#1e293b]"}`}>{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}

            {isAcademician &&
              academicianNavItems.map((item) => {
                const isActive = academicianTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setAcademicianTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-lg text-[13.5px] leading-snug transition-all duration-200 cursor-pointer ${
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5 gap-3"
                    } ${
                      isActive
                        ? "bg-white/80 text-[#000000] font-bold border-l-3 border-[#935f18] shadow-xs"
                        : "text-[#0f172a] font-medium hover:bg-white/40 hover:text-[#000000] hover:font-semibold"
                    }`}
                  >
                    <span className={`shrink-0 ${isActive ? "text-[#935f18]" : "text-[#1e293b]"}`}>{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}

            {isInstitution &&
              institutionNavItems.map((item) => {
                const isActive = institutionTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setInstitutionTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-lg text-[13.5px] leading-snug transition-all duration-200 cursor-pointer ${
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5 gap-3"
                    } ${
                      isActive
                        ? "bg-white/80 text-[#000000] font-bold border-l-3 border-[#935f18] shadow-xs"
                        : "text-[#0f172a] font-medium hover:bg-white/40 hover:text-[#000000] hover:font-semibold"
                    }`}
                  >
                    <span className={`shrink-0 ${isActive ? "text-[#935f18]" : "text-[#1e293b]"}`}>{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
          </nav>
        </div>

        {/* Footer / User Profile & Logout (Translucent Glass) */}
        <div className={`border-t border-[#E5E1D8]/60 bg-white/20 p-3.5 space-y-2`}>
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[#E5E1D8]/60 bg-white/40 backdrop-blur-xs shadow-2xs">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-[#000000] truncate font-bold">{session.email}</div>
                <div className="font-mono text-[10px] uppercase text-[#935f18] mt-0.5 font-bold">{session.role}</div>
              </div>
              <button
                type="button"
                onClick={signOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-1.5 text-[#0f172a] hover:text-[#b91c1c] transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-9 w-full items-center justify-center rounded-lg border border-[#E5E1D8]/60 bg-white/40 text-[#0f172a] hover:text-[#b91c1c] transition-colors cursor-pointer shadow-2xs"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Desktop Top Status Bar (Translucent Glassmorphism) */}
        <header className="sticky top-0 z-30 border-b border-[#E5E1D8]/50 bg-white/25 md:bg-white/25 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open sidebar menu"
              className="md:hidden p-1.5 rounded-lg border border-[#E5E1D8]/50 text-[#0f172a] hover:text-[#000000] hover:bg-white/40"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="font-mono text-xs uppercase tracking-wider hidden sm:block text-[#334155] font-semibold">
              {session.role} / <span className="text-[#000000] font-bold">{currentTabName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(isStudent || isRecruiter) && (
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="pill-btn-outline px-3.5 py-1 text-xs text-[#0f172a] font-medium hover:text-[#000000] hover:font-semibold gap-2 shadow-2xs border-[#E5E1D8]/60 bg-white/40 hover:bg-white/60"
              >
                <Search className="h-3.5 w-3.5 text-[#0f172a]" />
                <span>Search actions</span>
                <kbd className="font-mono text-[10px] text-[#0f172a] font-bold border border-[#CBD5E1] bg-white/60 px-1.5 py-0.5 rounded-sm">
                  ⌘K
                </kbd>
              </button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-6 sm:p-8 lg:p-10 w-full max-w-7xl mx-auto animate-fade-rise">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTabName}
              initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {isStudent ? (
                <Suspense
                  fallback={
                    <div className="flex flex-col items-center justify-center py-24 text-center font-mono text-xs text-[#64748B]">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent mb-3" />
                      Loading Student Dossier...
                    </div>
                  }
                >
                  <StudentDashboard token={session.access_token} activeTab={studentTab} onNavigateTab={setStudentTab} />
                </Suspense>
              ) : isRecruiter ? (
                <Suspense
                  fallback={
                    <div className="flex flex-col items-center justify-center py-24 text-center font-mono text-xs text-[#64748B]">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent mb-3" />
                      Loading Recruiter Workspace...
                    </div>
                  }
                >
                  <RecruiterDashboard token={session.access_token} activeTab={recruiterTab} onSelectTab={setRecruiterTab} />
                </Suspense>
              ) : isAcademician ? (
                <Suspense
                  fallback={
                    <div className="flex flex-col items-center justify-center py-24 text-center font-mono text-xs text-[#64748B]">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent mb-3" />
                      Loading Academician Portal...
                    </div>
                  }
                >
                  <AcademicianDashboard
                    token={session.access_token}
                    activeTab={academicianTab}
                    onTabChange={setAcademicianTab}
                  />
                </Suspense>
              ) : isInstitution ? (
                <Suspense
                  fallback={
                    <div className="flex flex-col items-center justify-center py-24 text-center font-mono text-xs text-[#64748B]">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent mb-3" />
                      Loading University Intelligence...
                    </div>
                  }
                >
                  <InstitutionDashboard
                    token={session.access_token}
                    activeTab={institutionTab}
                    onTabChange={setInstitutionTab}
                  />
                </Suspense>
              ) : (
                <section className="border border-[#E5E1D8] bg-[#FFFFFF] p-8 rounded-[16px] shadow-[0_8px_30px_rgba(17,24,39,0.04)] text-[#111827]">
                  <h1 className="text-2xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                    Administrator Access
                  </h1>
                  <p className="mt-2 text-xs text-[#475569] font-sans">
                    Administrative taxonomy and fairness controls remain server-authorized endpoints.
                  </p>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Bottom-Right Copilot Assistant */}
      {(isStudent || isRecruiter) && (
        <SkillPassportCopilot
          token={session.access_token}
          onNavigate={(tab: string) => {
            if (isStudent) setStudentTab(tab as StudentTab);
            else if (isRecruiter) setRecruiterTab(tab as RecruiterTab);
          }}
        />
      )}
    </div>
  );
}
