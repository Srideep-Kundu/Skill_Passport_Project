import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Toaster } from "sonner";
import {
  LayoutDashboard,
  BadgeCheck,
  FileText,
  Target,
  ClipboardList,
  PlusCircle,
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
} from "lucide-react";
import { LandingPage } from "./pages/LandingPage";
import { useAuth } from "./auth/AuthContext";
import { CommandPalette } from "./components/CommandPalette";
import { SkillPassportCopilot } from "./components/SkillPassportCopilot";
import { PostLoginTransition } from "./components/PostLoginTransition";
import { AuthBackground } from "./components/AuthBackground";

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
export type RecruiterTab = "overview" | "internships" | "post_job" | "candidates";
export type AcademicianTab =
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
  const [copilotOpen, setCopilotOpen] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("skill_passport_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("skill_passport_sidebar_collapsed", String(isCollapsed));
  }, [isCollapsed]);

  // Keyboard shortcut (Ctrl+B / Cmd+B) to toggle sidebar, and (Ctrl+J / Cmd+J) for Copilot
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setCopilotOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    { id: "passport", label: "Skill Passport", icon: <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> },
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

  // Exact 4 core recruiter navigation tabs
  const recruiterNavItems: { id: RecruiterTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Dashboard Overview", icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "internships", label: "Your Internships", icon: <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "post_job", label: "Post New Internship", icon: <PlusCircle className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "candidates", label: "Ranked Candidates", icon: <Target className="h-4 w-4 shrink-0" aria-hidden="true" /> },
  ];

  // 10 Faculty / Academician Portal navigation tabs
  const academicianNavItems: { id: AcademicianTab; label: string; icon: React.ReactNode }[] = [
    { id: "opportunities", label: "Opportunities", icon: <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" /> },
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
    <div className="dark auth-background-shell min-h-screen bg-[#021522] flex text-white relative font-sans selection:bg-white/20 selection:text-white">
      <AuthBackground />

      {/* Toast Notifications */}
      <Toaster position="bottom-right" theme="dark" closeButton />

      {/* Command Palette */}
      {(isStudent || isRecruiter) && (
        <CommandPalette
          open={cmdOpen}
          onOpenChange={setCmdOpen}
          role={isStudent ? "student" : "recruiter"}
          onSelectStudentTab={setStudentTab}
          onSelectRecruiterTab={setRecruiterTab}
          onOpenCopilot={() => setCopilotOpen(true)}
        />
      )}

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#031322]/80 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Rail / Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 h-screen md:sticky md:top-0 bg-[#061524] border-r border-white/10 flex flex-col justify-between transition-all duration-200 md:translate-x-0 shrink-0 ${
          isCollapsed ? "md:w-20" : "md:w-64"
        } w-64 ${mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
      >
        {/* Top Header & Nav Items */}
        <div className={`flex-1 min-h-0 ${isCollapsed ? "p-3 overflow-hidden" : "p-5 overflow-y-auto no-scrollbar"}`}>
          {/* Logo */}
          <div className={`flex items-center ${isCollapsed ? "flex-col gap-3" : "justify-between"} pb-6 border-b border-white/10 mb-4`}>
            <a href="/" className="flex items-center gap-2.5 text-white min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-white/20 bg-white/10 font-mono text-xs text-white">
                SP
              </span>
              {!isCollapsed && (
                <div className="overflow-hidden whitespace-nowrap">
                  <span
                    className="text-lg font-normal tracking-tight block leading-none text-white"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Skill Passport<sup className="text-[10px] ml-0.5 opacity-70">®</sup>
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block mt-1">
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
              className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
            >
              <MoreHorizontal className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? "rotate-90" : ""}`} />
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              className="md:hidden text-neutral-400 hover:text-white p-1"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {!isCollapsed && (
              <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 px-3 py-1.5 mb-1">
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
                    className={`w-full flex items-center rounded-sm text-xs transition-colors cursor-pointer ${
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2 gap-3"
                    } ${
                      isActive
                        ? "bg-white/10 text-white font-medium border-l-2 border-white"
                        : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200"
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
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
                    className={`w-full flex items-center rounded-sm text-xs transition-colors cursor-pointer ${
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2 gap-3"
                    } ${
                      isActive
                        ? "bg-white/10 text-white font-medium border-l-2 border-white"
                        : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200"
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
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
                    className={`w-full flex items-center rounded-sm text-xs transition-colors cursor-pointer ${
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2 gap-3"
                    } ${
                      isActive
                        ? "bg-white/10 text-white font-medium border-l-2 border-white"
                        : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200"
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
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
                    className={`w-full flex items-center rounded-sm text-xs transition-colors cursor-pointer ${
                      isCollapsed ? "justify-center p-2.5" : "px-3 py-2 gap-3"
                    } ${
                      isActive
                        ? "bg-white/10 text-white font-medium border-l-2 border-white"
                        : "text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200"
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
          </nav>
        </div>

        {/* Footer / User Profile & Logout */}
        <div className={`border-t border-white/10 bg-[#061524] p-3.5 space-y-2`}>
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2 p-2 rounded-sm border border-white/10 bg-white/[0.02]">
              <div className="min-w-0 flex-1">
                <div className="text-xs text-white truncate font-medium">{session.email}</div>
                <div className="font-mono text-[10px] uppercase text-neutral-400 mt-0.5">{session.role}</div>
              </div>
              <button
                type="button"
                onClick={signOut}
                title="Sign out"
                aria-label="Sign out"
                className="p-1 text-neutral-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-9 w-full items-center justify-center rounded-sm border border-white/10 text-neutral-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0 bg-transparent">
        {/* Desktop Top Status Bar */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#031322]/[0.92] backdrop-blur-[2px] px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open sidebar menu"
              className="md:hidden p-1.5 rounded-sm border border-white/10 text-neutral-400 hover:text-white"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="font-mono text-xs text-neutral-400 uppercase tracking-wider hidden sm:block">
              {session.role} / <span className="text-white">{currentTabName}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(isStudent || isRecruiter) && (
              <button
                type="button"
                onClick={() => setCmdOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-xs text-neutral-400 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search actions</span>
                <kbd className="font-mono text-[10px] text-neutral-400 border border-white/10 px-1 py-0.5 rounded-xs">
                  ⌘K
                </kbd>
              </button>
            )}

            {(isStudent || isRecruiter) && (
              <button
                type="button"
                onClick={() => setCopilotOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-medium text-white hover:bg-white/15 transition-colors cursor-pointer"
              >
                <span>Copilot</span>
                <kbd className="font-mono text-[10px] text-neutral-400 border border-white/10 px-1 py-0.5 rounded-xs">
                  ⌘J
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
                    <div className="flex flex-col items-center justify-center py-24 text-center font-mono text-xs text-neutral-400">
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
                    <div className="flex flex-col items-center justify-center py-24 text-center font-mono text-xs text-neutral-400">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent mb-3" />
                      Loading Recruiter Workspace...
                    </div>
                  }
                >
                  <RecruiterDashboard token={session.access_token} activeTab={recruiterTab} />
                </Suspense>
              ) : isAcademician ? (
                <Suspense
                  fallback={
                    <div className="flex flex-col items-center justify-center py-24 text-center font-mono text-xs text-neutral-400">
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
                    <div className="flex flex-col items-center justify-center py-24 text-center font-mono text-xs text-neutral-400">
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
                <section className="border border-white/10 bg-[#061524] p-8 rounded-md">
                  <h1 className="text-2xl font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
                    Administrator Access
                  </h1>
                  <p className="mt-2 text-xs text-neutral-400 font-sans">
                    Administrative taxonomy and fairness controls remain server-authorized endpoints.
                  </p>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Copilot Drawer */}
      {(isStudent || isRecruiter) && (
        <SkillPassportCopilot
          token={session.access_token}
          isOpen={copilotOpen}
          onOpen={() => setCopilotOpen(true)}
          onClose={() => setCopilotOpen(false)}
          onNavigate={(tab) => {
            if (isStudent) setStudentTab(tab as StudentTab);
            else if (isRecruiter) setRecruiterTab(tab as RecruiterTab);
          }}
        />
      )}
    </div>
  );
}
