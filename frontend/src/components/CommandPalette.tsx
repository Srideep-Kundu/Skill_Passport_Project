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
}

export function CommandPalette({
  open,
  onOpenChange,
  role,
  onSelectStudentTab,
  onSelectRecruiterTab,
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-[#0F172A]/40 backdrop-blur-xs transition-all font-sans">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-[16px] border border-[#E5E1D8] bg-[#FFFFFF] shadow-[0_20px_50px_rgba(17,24,39,0.12)] z-10 text-[#111827]" role="dialog" aria-modal="true" aria-label="Command palette">
        <Command className="w-full">
          <div className="flex items-center border-b border-[#E5E1D8] px-4 py-3.5">
            <Search className="h-4 w-4 shrink-0 text-[#64748B] mr-2.5" />
            <Command.Input
              placeholder="Type a command or jump to page... (Esc to close)"
              className="w-full bg-transparent text-xs placeholder:text-[#64748B] focus:outline-none text-[#111827] font-sans"
            />
          </div>

          <Command.List className="max-h-72 overflow-y-auto p-2 space-y-1">
            <Command.Empty className="py-6 text-center text-xs text-[#64748B] font-mono">
              No matching pages or actions found.
            </Command.Empty>

            <Command.Group heading="Navigation Pages" className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] font-semibold px-2 py-1">
              {role === "student" ? (
                <>
                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("overview");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Dashboard Overview</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("passport");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <Award className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Skills & Passport</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("evidence");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Evidence & Resumes</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("github");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <Award className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>GitHub Verification</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("matches");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <Briefcase className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Internship Matches</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("discovery");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <Compass className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Job Discovery Market</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("gaps");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <Activity className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Skill Gaps & Goals</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("assessments");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <Award className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Diagnostic Assessments</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("learning");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <ListTodo className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Adaptive Learning Hub</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("placements");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <Briefcase className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Campus Placement Drives</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("collaborations");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <User className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Mentorship & Hackathons</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectStudentTab("teams");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <User className="h-3.5 w-3.5 text-[#B08D57]" />
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
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Dashboard Overview</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("internships");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <ListTodo className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Your Internships</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("post_job");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <Send className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Post New Internship</span>
                  </Command.Item>

                  <Command.Item
                    onSelect={() => {
                      onSelectRecruiterTab("candidates");
                      onOpenChange(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#475569] hover:text-[#111827] hover:bg-[#F7F5F0] cursor-pointer transition-colors"
                  >
                    <Activity className="h-3.5 w-3.5 text-[#B08D57]" />
                    <span>Ranked Candidates</span>
                  </Command.Item>
                </>
              )}
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-[#E5E1D8] bg-[#F7F5F0] px-4 py-2.5 font-mono text-[10px] text-[#64748B]">
            <span>Use ↑↓ keys to navigate, Enter to select</span>
            <kbd className="rounded-sm border border-[#E5E1D8] bg-[#FFFFFF] px-1.5 py-0.5 text-[#475569]">
              ESC
            </kbd>
          </div>
        </Command>
      </div>
    </div>
  );
}
