import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { api } from "../api/service";
import type { CopilotAction, CopilotResponse, Role } from "../api/types";
import { toast } from "sonner";

interface Props {
  token: string;
  role?: Role | string;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onNavigate?: (tab: string) => void;
}

interface Message {
  id: string;
  sender: "user" | "copilot";
  text: string;
  sources?: string[];
  actions?: CopilotAction[];
}

const STUDENT_PROMPTS = [
  "What is my role readiness score?",
  "Why is Python partially verified?",
  "What should I learn next?",
  "Which internships match me best?",
  "What is my placement status?",
];

const RECRUITER_PROMPTS = [
  "Show top matched candidates",
  "Which candidates have verified Python?",
  "Explain deterministic match score",
  "Post a new internship",
  "Review applicant pipelines",
];

const ACADEMICIAN_PROMPTS = [
  "Find research grant opportunities",
  "Check industrial sabbatical openings",
  "View student mentorship requests",
  "Review faculty research proposals",
  "Industrial training linkages",
];

const INSTITUTION_PROMPTS = [
  "What is our university placement rate?",
  "Which student cohorts are at-risk?",
  "Analyze curriculum skill gaps",
  "View corporate partner linkages",
  "Download institutional reports",
];

export function SkillPassportCopilot({
  token,
  role = "student",
  isOpen: controlledIsOpen,
  onOpen,
  onClose,
  onNavigate,
}: Props) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const messageSequence = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = useCallback(() => {
    if (isControlled && onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [isControlled, onClose]);

  const nextMessageId = () => {
    messageSequence.current += 1;
    return String(messageSequence.current);
  };

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
    } else if (isControlled && onOpen) {
      onOpen();
    } else {
      setInternalIsOpen(true);
    }
  };

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const defaultWelcomeMessage = useMemo<Message>(() => {
    if (role === "academician") {
      return {
        id: "welcome",
        sender: "copilot",
        text: "Welcome, Professor. I am your Faculty & Academic Copilot. Ask me about R&D grants, industrial sabbaticals, student advising, or mentorship events.",
        actions: [
          { label: "Explore Opportunities", target_tab: "opportunities", action_type: "navigate" },
          { label: "R&D & Grants", target_tab: "proposals", action_type: "navigate" },
          { label: "Mentorship & Events", target_tab: "mentorship_events", action_type: "navigate" },
        ],
      };
    }
    if (role === "institution") {
      return {
        id: "welcome",
        sender: "copilot",
        text: "Welcome to University Intelligence Copilot. Ask me about cohort placements, department analytics, curriculum skill gaps, or institutional reports.",
        actions: [
          { label: "Executive Overview", target_tab: "overview", action_type: "navigate" },
          { label: "Cohorts & At-Risk", target_tab: "cohorts", action_type: "navigate" },
          { label: "Curriculum Skill Gaps", target_tab: "skills", action_type: "navigate" },
        ],
      };
    }
    if (role === "recruiter") {
      return {
        id: "welcome",
        sender: "copilot",
        text: "Hello! I am your Talent Acquisition Copilot. Ask me about candidate skill distributions, verified code proof, or internship matches.",
        actions: [
          { label: "Ranked Candidates", target_tab: "candidates", action_type: "navigate" },
          { label: "Post New Internship", target_tab: "post_job", action_type: "navigate" },
        ],
      };
    }
    return {
      id: "welcome",
      sender: "copilot",
      text: "Hello! I am your Skill Passport Copilot. Ask me about your verified skills, role readiness, recommended courses, or placement status.",
      actions: [
        { label: "Analyze Skill Gaps", target_tab: "gaps", action_type: "navigate" },
        { label: "View Passport", target_tab: "passport", action_type: "navigate" },
      ],
    };
  }, [role]);

  const [messages, setMessages] = useState<Message[]>([defaultWelcomeMessage]);

  useEffect(() => {
    setMessages([defaultWelcomeMessage]);
  }, [defaultWelcomeMessage]);

  const quickPrompts = useMemo(() => {
    if (role === "academician") return ACADEMICIAN_PROMPTS;
    if (role === "institution") return INSTITUTION_PROMPTS;
    if (role === "recruiter") return RECRUITER_PROMPTS;
    return STUDENT_PROMPTS;
  }, [role]);

  const inputPlaceholder = useMemo(() => {
    if (role === "academician") return "Ask about grants, sabbaticals, research proposals, advising...";
    if (role === "institution") return "Ask about cohorts, placements, curriculum gaps, departments...";
    if (role === "recruiter") return "Ask about candidates, required skills, internships...";
    return "Ask Copilot about skills, readiness, jobs...";
  }, [role]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, isOpen]);

  async function handleSend(queryText?: string) {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: nextMessageId(),
      sender: "user",
      text: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput("");
    setLoading(true);

    try {
      const res: CopilotResponse = await api.queryCopilot(userMsg.text, token);
      const botMsg: Message = {
        id: nextMessageId(),
        sender: "copilot",
        text: res.message,
        sources: res.sources,
        actions: res.actions,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      toast.error("Copilot could not process query");
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          sender: "copilot",
          text: "I could not retrieve your records at this moment. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleActionClick(action: CopilotAction) {
    if (onNavigate && action.target_tab) {
      onNavigate(action.target_tab);
      toast.info(`Navigated to ${action.label}`);
    }
  }

  const content = (
    <>
      {/* 1. Global Viewport-Fixed Floating Icon-Only Launcher */}
      <div className="fixed bottom-6 right-6 z-[9990] pointer-events-auto select-none">
        <motion.button
          type="button"
          initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={prefersReducedMotion ? false : { scale: 1, opacity: 1 }}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.08, y: -2 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
          onClick={handleToggle}
          aria-label={isOpen ? "Close Skill Passport Copilot" : "Open Skill Passport Copilot"}
          title={isOpen ? "Close Copilot" : "Open Skill Passport Copilot"}
          className={`h-12 w-12 sm:h-13 sm:w-13 rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-200 border border-white/20 backdrop-blur-md focus-visible:ring-2 focus-visible:ring-[#38bdf8] focus-visible:ring-offset-2 focus-visible:outline-none ${
            isOpen
              ? "bg-[#182337] text-white hover:bg-[#202f4a] shadow-black/40"
              : "bg-gradient-to-tr from-[#3b71d9] via-[#4f46e5] to-[#6366f1] text-white shadow-indigo-950/40 hover:shadow-indigo-500/40"
          }`}
        >
          {isOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
          )}
        </motion.button>
      </div>

      {/* 2. Global Viewport-Fixed Slide-over Copilot Dialog Panel */}
      <AnimatePresence>
        {isOpen && (
          <aside
            aria-label="Skill Passport Copilot Assistant"
            className="fixed bottom-[88px] right-4 sm:right-6 z-[9999] w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] h-[580px] max-h-[75vh] flex flex-col pointer-events-auto"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full bg-white/75 dark:bg-[#0c121e]/80 backdrop-blur-2xl border border-slate-200/80 dark:border-white/[0.12] rounded-3xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden text-slate-900 dark:text-[#f1f0e8]"
            >
              {/* Header */}
              <div className="p-4 bg-slate-50/80 dark:bg-white/[0.03] backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-[#3b71d9]/15 dark:bg-[#3b71d9]/25 border border-[#3b71d9]/30 flex items-center justify-center text-[#3b71d9] dark:text-[#b0c6ff]">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-1.5 font-sans">
                      <span>Platform Copilot</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50/80 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 backdrop-blur-xs">
                        Grounded
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-[#98a4b3] font-sans">
                      Contextual navigation & verified insights
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close Copilot"
                  className="h-7 w-7 rounded-lg hover:bg-slate-200/80 dark:hover:bg-white/[0.08] flex items-center justify-center text-slate-500 dark:text-[#98a4b3] cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${
                      m.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.sender === "copilot" && (
                      <div className="h-6 w-6 rounded-lg bg-[#3b71d9]/15 text-[#3b71d9] dark:text-[#b0c6ff] flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="h-3 w-3" />
                      </div>
                    )}

                    <div
                      className={`max-w-[82%] rounded-2xl p-3.5 space-y-2 leading-relaxed ${
                        m.sender === "user"
                          ? "bg-[#3b71d9] text-white rounded-br-xs font-medium"
                          : "bg-slate-100/80 dark:bg-white/[0.05] backdrop-blur-md text-slate-800 dark:text-[#f1f0e8] rounded-bl-xs border border-slate-200/60 dark:border-white/[0.06]"
                      }`}
                    >
                      <p className="whitespace-pre-line font-sans">{m.text}</p>

                      {/* Sources grounding badges */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/50 dark:border-white/[0.06] flex flex-wrap gap-1">
                          {m.sources.map((s, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1"
                            >
                              <ShieldCheck className="h-2.5 w-2.5 text-emerald-500" />
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      {m.actions && m.actions.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-1.5 font-sans">
                          {m.actions.map((act, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleActionClick(act)}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/90 dark:bg-white/[0.06] backdrop-blur-xs text-[#3b71d9] dark:text-[#b0c6ff] border border-[#3b71d9]/30 hover:bg-[#3b71d9] hover:text-white dark:hover:bg-[#3b71d9] dark:hover:text-white transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                            >
                              <span>{act.label}</span>
                              <ArrowRight className="h-2.5 w-2.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {m.sender === "user" && (
                      <div className="h-6 w-6 rounded-lg bg-slate-300 dark:bg-white/[0.15] text-slate-700 dark:text-white flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2.5 items-center text-slate-400 dark:text-[#98a4b3] text-[11px] italic font-sans">
                    <div className="h-6 w-6 rounded-lg bg-[#3b71d9]/15 text-[#3b71d9] flex items-center justify-center shrink-0 animate-spin">
                      <Sparkles className="h-3 w-3" />
                    </div>
                    <span>Retrieving platform grounding...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts Carousel */}
              <div className="px-4 py-2 bg-slate-50/80 dark:bg-white/[0.03] backdrop-blur-md border-t border-slate-200/80 dark:border-white/[0.06] flex gap-1.5 overflow-x-auto no-scrollbar text-[10px] shrink-0 font-sans">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => void handleSend(qp)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white/80 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#3b71d9] hover:text-[#3b71d9] transition-colors cursor-pointer shrink-0 backdrop-blur-xs"
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-3 bg-white/80 dark:bg-white/[0.03] backdrop-blur-md border-t border-slate-200/80 dark:border-white/[0.08] shrink-0 font-sans">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={inputPlaceholder}
                    className="flex-1 px-3.5 py-2 bg-slate-100/80 dark:bg-white/[0.04] backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#3b71d9]"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="h-9 w-9 rounded-xl bg-[#3b71d9] hover:bg-[#2f5db3] disabled:opacity-40 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-all"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          </aside>
        )}
      </AnimatePresence>
    </>
  );

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(content, document.body);
}
