import { useEffect } from "react";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  FileText,
  Award,
  User,
  Briefcase,
  Sparkles,
  Compass,
  ListTodo,
  Send,
  Activity,
  Search,
} from "lucide-react";
import type { StudentTab, RecruiterTab } from "../App";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: "student" | "recruiter";
  onSelectStudentTab: (tab: StudentTab) => void;
  onSelectRecruiterTab: (tab: RecruiterTab) => void;
  onOpenCopilot?: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  role,
  onSelectStudentTab,
  onSelectRecruiterTab,
  onOpenCopilot,
}: CommandPaletteProps) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-xs transition-all">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#111821] shadow-2xl z-10 text-slate-900 dark:text-[#f1f0e8]">
        <Command className="w-full">
          <div className="flex items-center border-b border-slate-100 dark:border-white/[0.08] px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-[#98a4b3] mr-2.5" />
            <Command.Input
              placeholder="Type a command or jump to page... (Esc to close)"
              className="w-full bg-transparent text-xs font-semibold placeholder:text-slate-400 dark:placeholder:text-[#98a4b3] focus:outline-none text-slate-900 dark:text-[#f1f0e8] font-sans"
            />
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-6 text-center text-xs text-slate-400 dark:text-[#98a4b3]">
              No matching pages or actions found.
            </Command.Empty>

            {onOpenCopilot && (
              <Command.Group heading="AI Tools" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#98a4b3] px-2 py-1 font-sans">
                <Command.Item
                  onSelect={() => {
                    onOpenCopilot();
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-[#7dd3fc] hover:bg-indigo-100/80 dark:hover:bg-[#1b2738] cursor-pointer transition-colors font-sans border border-indigo-200/50 dark:border-[#38bdf8]/20"
                >
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-[#38bdf8] animate-pulse" />
                  <span className="flex-1">Open Skill Copilot (AI Assistant)</span>
                  <span className="text-[10px] font-extrabold uppercase bg-indigo-200/60 dark:bg-indigo-900/60 text-indigo-800 dark:text-[#38bdf8] px-1.5 py-0.5 rounded">
                    Ctrl+J
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            <Command.Group heading="Navigation Pages" className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#98a4b3] px-2 py-1 font-sans">
              {role === "student" ? (
                <>
                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("overview");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard Overview</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("passport");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Award className="h-4 w-4" />
                    <span>Skills & Passport</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("evidence");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <FileText className="h-4 w-4" />
                    <span>Evidence & Resumes</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("github");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>GitHub Verification</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("matches");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span>Internship Matches</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("discovery");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Compass className="h-4 w-4" />
                    <span>Job Discovery Market</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("gaps");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Activity className="h-4 w-4" />
                    <span>Skill Gaps & Goals</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("assessments");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Award className="h-4 w-4" />
                    <span>Diagnostic Assessments</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("learning");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <ListTodo className="h-4 w-4" />
                    <span>Adaptive Learning Hub</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("placements");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span>Campus Placement Drives</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("collaborations");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <User className="h-4 w-4" />
                    <span>Mentorship & Hackathons</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("teams");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Team Formation Engine</span>
                  </Command.Item>
                </>
              ) : (
                <>
                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("overview");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard Overview</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("internships");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <ListTodo className="h-4 w-4" />
                    <span>Your Internships</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("post_job");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Send className="h-4 w-4" />
                    <span>Post New Internship</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("candidates");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] hover:bg-blue-50 dark:hover:bg-[#151e29] hover:text-[#3b71d9] dark:hover:text-[#b0c6ff] cursor-pointer transition-colors font-sans"
                  >
                    <Activity className="h-4 w-4" />
                    <span>Ranked Candidates</span>
                  </Command.Item>
                </>
              )}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0a0f14] px-3 py-2 text-[11px] text-slate-400 dark:text-[#98a4b3]">
            <span>Use ↑↓ keys to navigate, Enter to select</span>
            <kbd className="rounded border border-slate-200 dark:border-[#2a3441] bg-white dark:bg-[#1b2531] px-1.5 py-0.5 text-[10px] font-bold">
              ESC
            </kbd>
          </div>
        </Command>
      </div>
    </div>
  );
}
