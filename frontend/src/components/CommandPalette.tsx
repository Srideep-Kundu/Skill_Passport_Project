import { useEffect } from "react";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  FileText,
  Award,
  User,
  Briefcase,
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-xs transition-all font-sans">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-md border border-white/15 bg-[#061524] shadow-2xl z-10 text-white" role="dialog" aria-modal="true" aria-label="Command palette">
        <Command className="w-full">
          <div className="flex items-center border-b border-white/10 px-3.5 py-3">
            <Search className="h-4 w-4 shrink-0 text-neutral-400 mr-2.5" />
            <Command.Input
              placeholder="Type a command or jump to page... (Esc to close)"
              className="w-full bg-transparent text-xs placeholder:text-neutral-500 focus:outline-none text-white font-sans"
            />
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-6 text-center text-xs text-neutral-400 font-mono">
              No matching pages or actions found.
            </Command.Empty>

            {onOpenCopilot && (
              <Command.Group heading="AI Tools" className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 px-2 py-1">
                <Command.Item
                  onSelect={() => {
                    onOpenCopilot();
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-white hover:bg-white/10 cursor-pointer transition-colors border border-white/10 bg-white/[0.02]"
                >
                  <span className="font-mono text-[9px] text-white" aria-hidden="true">SP</span>
                  <span className="flex-1">Open Skill Copilot (AI Assistant)</span>
                  <span className="font-mono text-[9px] uppercase border border-white/20 px-1.5 py-0.5 rounded-xs text-neutral-300">
                    Ctrl+J
                  </span>
                </Command.Item>
              </Command.Group>
            )}

            <Command.Group heading="Navigation Pages" className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 px-2 py-1">
              {role === "student" ? (
                <>
                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("overview");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>Dashboard Overview</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("passport");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>Skills & Passport</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("evidence");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Evidence & Resumes</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("github");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>GitHub Verification</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("matches");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>Internship Matches</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("discovery");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <Compass className="h-3.5 w-3.5" />
                    <span>Job Discovery Market</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("gaps");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>Skill Gaps & Goals</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("assessments");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>Diagnostic Assessments</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("learning");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <ListTodo className="h-3.5 w-3.5" />
                    <span>Adaptive Learning Hub</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("placements");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>Campus Placement Drives</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("collaborations");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>Mentorship & Hackathons</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("teams");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
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
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>Dashboard Overview</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("internships");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <ListTodo className="h-3.5 w-3.5" />
                    <span>Your Internships</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("post_job");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Post New Internship</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("candidates");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-xs px-3 py-2 text-xs text-neutral-300 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>Ranked Candidates</span>
                  </Command.Item>
                </>
              )}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-white/10 bg-white/[0.02] px-3.5 py-2 font-mono text-[10px] text-neutral-400">
            <span>Use ↑↓ keys to navigate, Enter to select</span>
            <kbd className="rounded-xs border border-white/15 bg-white/5 px-1.5 py-0.5 text-neutral-300">
              ESC
            </kbd>
          </div>
        </Command>
      </div>
    </div>
  );
}
