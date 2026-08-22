import { lazy, Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
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
  Sun,
  Moon,
  LogOut,
  Menu,
  Search,
  Code2,
  Compass,
  Users,
  Sparkles,
} from "lucide-react";
import { LandingPage } from "./pages/LandingPage";
import { useAuth } from "./auth/AuthContext";
import { CommandPalette } from "./components/CommandPalette";
import { CopilotSidebar } from "./components/CopilotSidebar";
import { PostLoginTransition } from "./components/PostLoginTransition";
import { LuminaAmbientHorizon } from "./components/LuminaAmbientHorizon";
import { sidebarIndicatorTransition } from "./theme/motion";

const RecruiterDashboard = lazy(async () => ({
  default: (await import("./pages/RecruiterDashboard")).RecruiterDashboard,
}));
const StudentDashboard = lazy(async () => ({
  default: (await import("./pages/StudentDashboard")).StudentDashboard,
}));

export type StudentTab = "overview" | "passport" | "evidence" | "github" | "matches" | "discovery" | "teams";
export type RecruiterTab = "overview" | "internships" | "post_job" | "candidates";

export function App() {
  const { session, signOut, justLoggedIn, completePostLoginTransition } = useAuth();
  const [studentTab, setStudentTab] = useState<StudentTab>("overview");
  const [recruiterTab, setRecruiterTab] = useState<RecruiterTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("skill-passport.theme");
    return saved ? saved === "dark" : false;
  });
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("skill_passport_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("skill-passport.theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("skill-passport.theme", "light");
    }
  }, [isDarkMode]);

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

  function toggleTheme() {
    setIsDarkMode((prev) => !prev);
  }

  if (!session) {
    return <LandingPage isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />;
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

  // Exact 7 core student navigation tabs
  const studentNavItems: { id: StudentTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" /> },
    { id: "passport", label: "Skill Passport", icon: <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" /> },
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

  return (
    <div className="min-h-screen bg-transparent flex font-sans text-slate-900 dark:text-[#f1f0e8] relative">
      {/* Dynamic Ambient Horizon Background Animation */}
      <LuminaAmbientHorizon />

      {/* Sonner Toast Notifications Container */}
      <Toaster position="bottom-right" richColors closeButton />

      {/* Cmd+K Command Palette Modal */}
      <CommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        role={session.role as "student" | "recruiter"}
        onSelectStudentTab={setStudentTab}
        onSelectRecruiterTab={setRecruiterTab}
        onOpenCopilot={() => setCopilotOpen(true)}
      />

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sticky Left Sidebar (Pinned to top on desktop with ultra-transparent frosted glass) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 h-screen md:sticky md:top-0 bg-white/20 dark:bg-black/25 backdrop-blur-md border-r border-slate-200/40 dark:border-white/[0.05] flex flex-col justify-between transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none md:translate-x-0 shrink-0 shadow-lg shadow-black/10 ${
          isCollapsed ? "md:w-20" : "md:w-72"
        } w-72 ${mobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
      >
        {/* Top Header & Scrollable Menu (Scrollbar hidden when collapsed) */}
        <div
          className={`space-y-4 flex-1 min-h-0 transition-all duration-300 ${isCollapsed
              ? "p-3 overflow-hidden [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
              : "p-4 sm:p-5 overflow-y-auto"
            }`}
        >
          {/* Logo & Brand Header with Three-Dot Sidebar Toggle Button */}
          <div className={`flex items-center ${isCollapsed ? "flex-col gap-3" : "justify-between"} pt-1`}>
            <a href="/" className="flex items-center gap-3 text-slate-900 dark:text-[#f1f0e8] group min-w-0">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#4338ca] to-[#6366f1] font-black text-white shadow-md shadow-indigo-500/20 text-sm tracking-wider font-sans">
                SP
              </span>
              <div
                className={`whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? "max-w-0 opacity-0 pointer-events-none" : "max-w-xs opacity-100"
                  }`}
              >
                <span className="font-extrabold tracking-tight text-slate-900 dark:text-white block leading-tight text-base font-sans">
                  Skill Passport
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-[#8ea2c6] block leading-tight mt-0.5 truncate font-sans">
                  Verifiable Match Engine
                </span>
              </div>
            </a>

            {/* THREE-DOT SIDEBAR TOGGLE BUTTON */}
            <button
              type="button"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
              className="hidden md:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white/40 dark:bg-[#151e29]/40 backdrop-blur-md text-slate-500 dark:text-[#98a4b3] hover:bg-white/70 dark:hover:bg-[#1a2430]/70 hover:text-[#4f46e5] dark:hover:text-white active:scale-95 transition-all duration-200 cursor-pointer"
            >
              <MoreHorizontal className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? "rotate-90" : "rotate-0"}`} />
            </button>

            {/* Mobile Close Button */}
            <button
              type="button"
              className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="space-y-1 pt-1">
            <p
              className={`text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-2 whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? "max-h-0 opacity-0 mb-0" : "max-h-6 opacity-100"
                }`}
            >
              Navigation Menu
            </p>

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
                    className={`relative w-full flex items-center rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:outline-none ${isCollapsed ? "justify-center px-0 py-3" : "px-3.5 py-2.5 gap-3"
                      } ${isActive
                        ? "text-white font-bold"
                        : "text-slate-600 dark:text-[#8ea2c6] hover:bg-slate-100/80 dark:hover:bg-[#151e29] hover:text-slate-900 dark:hover:text-[#f1f0e8]"
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-student-nav"
                        className="absolute inset-0 rounded-xl bg-[#4f46e5] dark:bg-[#182337] dark:border dark:border-[#38bdf8]/30 shadow-md shadow-indigo-500/25 dark:shadow-[0_0_15px_rgba(56,189,248,0.15)] z-0 overflow-hidden"
                        transition={sidebarIndicatorTransition}
                      >
                        <div className="hidden dark:block absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]" />
                      </motion.div>
                    )}
                    <span className={`relative z-10 text-base shrink-0 flex items-center justify-center w-5 h-5 ${isActive ? "text-white dark:text-[#38bdf8]" : "text-slate-500 dark:text-[#8ea2c6]"}`}>
                      {item.icon}
                    </span>
                    <span
                      className={`relative z-10 whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out font-sans ${isCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
                        }`}
                    >
                      {item.label}
                    </span>
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
                    className={`relative w-full flex items-center rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#4f46e5] focus-visible:outline-none ${isCollapsed ? "justify-center px-0 py-3" : "px-3.5 py-2.5 gap-3"
                      } ${isActive
                        ? "text-white font-bold"
                        : "text-slate-600 dark:text-[#8ea2c6] hover:bg-slate-100/80 dark:hover:bg-[#151e29] hover:text-slate-900 dark:hover:text-[#f1f0e8]"
                      }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-recruiter-nav"
                        className="absolute inset-0 rounded-xl bg-[#4f46e5] dark:bg-[#182337] dark:border dark:border-[#38bdf8]/30 shadow-md shadow-indigo-500/25 dark:shadow-[0_0_15px_rgba(56,189,248,0.15)] z-0 overflow-hidden"
                        transition={sidebarIndicatorTransition}
                      >
                        <div className="hidden dark:block absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]" />
                      </motion.div>
                    )}
                    <span className={`relative z-10 text-base shrink-0 flex items-center justify-center w-5 h-5 ${isActive ? "text-white dark:text-[#38bdf8]" : "text-slate-500 dark:text-[#8ea2c6]"}`}>
                      {item.icon}
                    </span>
                    <span
                      className={`relative z-10 whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out font-sans ${isCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
                        }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* ALWAYS VISIBLE FOOTER (Skill Copilot + Account Card + Dark Theme Toggle + Sign Out with Frosted Glass) */}
        <div className={`shrink-0 border-t border-slate-200/60 dark:border-white/[0.06] bg-white/40 dark:bg-[#0b0e13]/40 backdrop-blur-2xl space-y-2.5 sticky bottom-0 z-20 shadow-md transition-all duration-300 ${isCollapsed ? "p-2" : "p-3.5"}`}>
          {/* AI Skill Copilot in Bottom Section */}
          <button
            type="button"
            onClick={() => {
              setCopilotOpen((prev) => !prev);
              setMobileMenuOpen(false);
            }}
            title={isCollapsed ? "Skill Copilot (AI Assistant) • Ctrl+J" : undefined}
            className={`relative w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer border ${
              copilotOpen
                ? "bg-gradient-to-r from-[#4338ca] to-[#6366f1] text-white border-indigo-500/80 shadow-md shadow-indigo-500/25 dark:shadow-[0_0_16px_rgba(99,102,241,0.25)]"
                : "bg-indigo-50/70 dark:bg-[#131a27]/90 border-indigo-200/70 dark:border-[#38bdf8]/20 text-indigo-700 dark:text-[#93c5fd] hover:bg-indigo-100/80 dark:hover:bg-[#1a253a] hover:border-indigo-300 dark:hover:border-[#38bdf8]/40"
            } ${isCollapsed ? "justify-center p-2.5" : "px-3 py-2.5 gap-2.5"}`}
          >
            <span
              className={`relative z-10 text-base shrink-0 flex items-center justify-center w-5 h-5 ${
                copilotOpen ? "text-white" : "text-indigo-600 dark:text-[#38bdf8]"
              }`}
            >
              <Sparkles className="h-4 w-4 animate-pulse" />
            </span>
            <span
              className={`relative z-10 whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out font-sans flex-1 text-left ${
                isCollapsed ? "max-w-0 opacity-0" : "max-w-xs opacity-100"
              }`}
            >
              Skill Copilot
            </span>
            {!isCollapsed && (
              <span
                className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ${
                  copilotOpen
                    ? "bg-white/20 text-white"
                    : "bg-indigo-200/70 text-indigo-800 dark:bg-indigo-950/80 dark:text-[#38bdf8] border border-indigo-300/40 dark:border-[#38bdf8]/30"
                }`}
              >
                AI
              </span>
            )}
          </button>

          {/* User Profile Card */}
          {isCollapsed ? (
            <div
              className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-blue-50/70 dark:bg-[#151e29]/70 backdrop-blur-md font-bold text-[#3b71d9] dark:text-[#b0c6ff] text-xs shadow-xs border border-blue-200/60 dark:border-white/[0.08]"
              title={`${session.email} (${session.role})`}
            >
              {session.email[0].toUpperCase()}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#111821]/50 backdrop-blur-md p-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100/80 dark:bg-[#151e29]/80 font-bold text-[#3b71d9] dark:text-[#b0c6ff] text-xs border border-blue-200/60 dark:border-blue-400/20 shadow-xs">
                {session.email[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 whitespace-nowrap overflow-hidden">
                <p className="text-xs font-bold text-slate-900 dark:text-[#f1f0e8] truncate">{session.email}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#3b71d9] dark:text-[#b0c6ff]">
                    {session.role}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Theme Toggle & Sign Out Buttons */}
          {isCollapsed ? (
            <div className="flex flex-col gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex h-9 w-full items-center justify-center rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white/40 dark:bg-[#111821]/40 backdrop-blur-md text-xs text-slate-700 dark:text-[#f1f0e8] hover:bg-white/70 dark:hover:bg-[#151e29]/70 transition-colors cursor-pointer"
                title={`Switch to ${isDarkMode ? "Light" : "Dark"} Mode`}
                aria-label={`Switch to ${isDarkMode ? "Light" : "Dark"} Mode`}
              >
                {isDarkMode ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
              </button>

              <button
                type="button"
                onClick={signOut}
                className="flex h-9 w-full items-center justify-center rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white/40 dark:bg-[#111821]/40 backdrop-blur-md text-xs text-slate-700 dark:text-[#f1f0e8] hover:bg-rose-50/80 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white/40 dark:bg-[#111821]/40 backdrop-blur-md py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-white/70 dark:hover:bg-[#151e29]/70 transition-colors cursor-pointer"
                title="Toggle Dark / Light Mode"
              >
                {isDarkMode ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{isDarkMode ? "Light" : "Dark"}</span>
              </button>

              <button
                type="button"
                onClick={signOut}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white/40 dark:bg-[#111821]/40 backdrop-blur-md py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-rose-50/80 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Right Content Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header Bar */}
        <header className="md:hidden sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">Lumina Intel</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-600 dark:text-[#38bdf8] text-xs cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
              aria-label="Open Skill Copilot"
              title="Skill Copilot"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open quick navigation search"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle theme mode"
            >
              {isDarkMode ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-full 2xl:max-w-[1700px] mx-auto overflow-x-clip transition-all duration-300">
          {isStudent ? (
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-3"></div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading student passport dashboard...</p>
                </div>
              }
            >
              <StudentDashboard token={session.access_token} activeTab={studentTab} onNavigateTab={setStudentTab} />
            </Suspense>
          ) : isRecruiter ? (
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-3"></div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Loading recruiter workspace...</p>
                </div>
              }
            >
              <RecruiterDashboard token={session.access_token} activeTab={recruiterTab} />
            </Suspense>
          ) : (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Administrator Access</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Administrative taxonomy and fairness controls remain server-authorized endpoints.
              </p>
            </section>
          )}
        </main>
      </div>

      {/* Right Slide-in Copilot Sidebar */}
      <CopilotSidebar
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        role={session.role as "student" | "recruiter"}
        onNavigateStudentTab={setStudentTab}
        onNavigateRecruiterTab={setRecruiterTab}
      />
    </div>
  );
}
