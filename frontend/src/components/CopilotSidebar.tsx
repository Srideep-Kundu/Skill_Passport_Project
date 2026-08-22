import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Bot,
  User,
  ArrowRight,
  ShieldCheck,
  Zap,
  Users,
  Code2,
  Target,
} from "lucide-react";
import type { StudentTab, RecruiterTab } from "../App";

export interface CopilotSidebarProps {
  open: boolean;
  onClose: () => void;
  role: "student" | "recruiter";
  onNavigateStudentTab?: (tab: StudentTab) => void;
  onNavigateRecruiterTab?: (tab: RecruiterTab) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "copilot";
  text: string;
  timestamp: string;
  actions?: { label: string; tab?: StudentTab | RecruiterTab; description?: string }[];
  highlight?: string;
}

let messageSequence = 0;
function createChatMessage(sender: "user" | "copilot", text: string): ChatMessage {
  messageSequence += 1;
  const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return {
    id: `${sender}-${messageSequence}`,
    sender,
    text,
    timestamp: timeStr,
  };
}

const STUDENT_SUGGESTIONS = [
  {
    icon: <Zap className="h-3.5 w-3.5 text-amber-400" />,
    text: "How is my match score calculated?",
    query: "Explain the deterministic matching formula and score breakdown.",
  },
  {
    icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />,
    text: "What are the verification tiers?",
    query: "What are the 3 verification tiers and their confidence multipliers?",
  },
  {
    icon: <Code2 className="h-3.5 w-3.5 text-cyan-400" />,
    text: "How do I verify GitHub repositories?",
    query: "How does GitHub verification work and how do I connect my repos?",
  },
  {
    icon: <Users className="h-3.5 w-3.5 text-indigo-400" />,
    text: "How does team complementarity work?",
    query: "Explain the team formation algorithm and Jaccard redundancy.",
  },
  {
    icon: <Target className="h-3.5 w-3.5 text-purple-400" />,
    text: "How to get matched with top internships?",
    query: "How can I improve my candidate ranking for open internships?",
  },
];

const RECRUITER_SUGGESTIONS = [
  {
    icon: <Target className="h-3.5 w-3.5 text-purple-400" />,
    text: "How are candidates ranked?",
    query: "Explain how candidate rankings and deterministic scores work.",
  },
  {
    icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />,
    text: "How does evidence verification protect hiring?",
    query: "Explain evidence provenance and verification safeguards.",
  },
  {
    icon: <Zap className="h-3.5 w-3.5 text-amber-400" />,
    text: "Setting up skill weights for postings",
    query: "How should I configure required skills and weights when posting an internship?",
  },
];

export function CopilotSidebar({
  open,
  onClose,
  role,
  onNavigateStudentTab,
  onNavigateRecruiterTab,
}: CopilotSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "welcome-1",
      sender: "copilot",
      text:
        role === "student"
          ? "👋 Welcome to **Skill Copilot**! I can help you understand your skill passport, boost deterministic match scores, verify GitHub evidence, or discover complementary team members."
          : "👋 Welcome to **Recruiter Copilot**! I can help you calibrate internship requirement weights, analyze candidate verification tiers, and understand deterministic ranking criteria.",
      timestamp: "Just now",
      actions:
        role === "student"
          ? [
              { label: "View Passport", tab: "passport", description: "Audit your extracted skills" },
              { label: "Check Matches", tab: "matches", description: "View internship compatibility" },
              { label: "Verify GitHub", tab: "github", description: "Connect repositories" },
            ]
          : [
              { label: "View Internships", tab: "internships", description: "Manage your postings" },
              { label: "Post New Role", tab: "post_job", description: "Create weighted requirements" },
              { label: "Ranked Candidates", tab: "candidates", description: "Audit candidate pool" },
            ],
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [messages, open]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query) return;

    const userMsg = createChatMessage("user", query);

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setIsTyping(true);

    // Simulate intelligent response generation
    setTimeout(() => {
      const response = generateCopilotResponse(query, role);
      setMessages((prev) => [...prev, response]);
      setIsTyping(false);
    }, 600);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome-reset",
        sender: "copilot",
        text: "🧹 Conversation history cleared. Ask me anything about your skills, matches, or evidence!",
        timestamp: "Just now",
      },
    ]);
  };

  const handleTabClick = (tab?: StudentTab | RecruiterTab) => {
    if (!tab) return;
    if (role === "student" && onNavigateStudentTab) {
      onNavigateStudentTab(tab as StudentTab);
      onClose();
    } else if (role === "recruiter" && onNavigateRecruiterTab) {
      onNavigateRecruiterTab(tab as RecruiterTab);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop for mobile & desktop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs lg:bg-transparent lg:pointer-events-none"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Right Slide-in Copilot Sidebar */}
          <motion.aside
            initial={{ x: "100%", opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.8 }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] lg:w-[440px] bg-white/95 dark:bg-[#0e1218]/95 backdrop-blur-xl border-l border-slate-200/80 dark:border-white/[0.08] shadow-2xl flex flex-col justify-between font-sans overflow-hidden"
          >
            {/* Ambient top glow */}
            <div className="absolute top-0 right-0 left-0 h-32 bg-gradient-to-b from-indigo-500/10 via-cyan-500/5 to-transparent pointer-events-none" />

            {/* Header */}
            <div className="relative shrink-0 px-4 py-3.5 border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between bg-white/60 dark:bg-[#111821]/60">
              <div className="flex items-center gap-3">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] via-[#6366f1] to-[#38bdf8] text-white shadow-md shadow-indigo-500/25">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#0e1218]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                      Skill Copilot
                    </h2>
                    <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-[#38bdf8] border border-indigo-200 dark:border-[#38bdf8]/30">
                      AI Assist
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-[#8ea2c6] font-medium">
                    Evidence-backed & Deterministic Match Guide
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleClearChat}
                  title="Clear conversation"
                  aria-label="Clear conversation"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182337] transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  title="Close Copilot (Esc)"
                  aria-label="Close Copilot (Esc)"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182337] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chat Content Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 [scrollbar-width:thin]">
              {/* Context Banner */}
              <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 dark:from-[#131b2c] dark:to-[#111929] p-3 text-xs text-indigo-950 dark:text-[#c7d7f9]">
                <div className="flex items-center gap-2 font-semibold mb-1">
                  <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-[#38bdf8]" />
                  <span>Fairness & Provenance Guarantee</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-[#9bb3de]">
                  Scores are computed deterministically from verified skills and weights. Demographic attributes, names, and universities are strictly excluded.
                </p>
              </div>

              {/* Messages */}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-2.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.sender === "copilot" && (
                    <div className="h-7 w-7 shrink-0 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center text-xs shadow-xs mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-[#4f46e5] text-white rounded-br-xs shadow-md shadow-indigo-500/20"
                        : "bg-slate-100/90 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/[0.08] text-slate-800 dark:text-[#e4e7ec] rounded-bl-xs shadow-xs"
                    }`}
                  >
                    <div className="whitespace-pre-line font-sans space-y-1.5">
                      {renderFormattedMessage(msg.text)}
                    </div>

                    {/* Action navigation chips */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-white/[0.08] flex flex-wrap gap-1.5">
                        {msg.actions.map((act, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleTabClick(act.tab)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-[#1b2738] border border-slate-200 dark:border-[#38bdf8]/20 text-indigo-600 dark:text-[#38bdf8] hover:bg-indigo-50 dark:hover:bg-[#22334a] transition-all shadow-2xs"
                          >
                            <span>{act.label}</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    )}

                    <span
                      className={`block text-[9px] mt-1.5 ${
                        msg.sender === "user" ? "text-indigo-200 text-right" : "text-slate-400 dark:text-slate-500"
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {msg.sender === "user" && (
                    <div className="h-7 w-7 shrink-0 rounded-lg bg-slate-200 dark:bg-[#202938] text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs mt-0.5">
                      <User className="h-3.5 w-3.5" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-2.5 items-center">
                  <div className="h-7 w-7 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="bg-slate-100 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/[0.08] px-3.5 py-2.5 rounded-2xl rounded-bl-xs flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="px-4 py-2 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#0d121a]/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-indigo-500" />
                <span>Suggested Questions</span>
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(role === "student" ? STUDENT_SUGGESTIONS : RECRUITER_SUGGESTIONS).map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(sug.query)}
                    className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white dark:bg-[#151e29] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-[#c4d4eb] hover:border-indigo-400 dark:hover:border-[#38bdf8]/40 hover:text-indigo-600 dark:hover:text-white transition-all shadow-2xs cursor-pointer"
                  >
                    {sug.icon}
                    <span>{sug.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="relative flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    role === "student"
                      ? "Ask Copilot about skills, matches, evidence..."
                      : "Ask Copilot about candidate rankings, weights..."
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-[#151e29] px-3.5 py-2.5 text-xs text-slate-900 dark:text-[#f1f0e8] placeholder:text-slate-400 dark:placeholder:text-[#8ea2c6] focus:border-indigo-500 dark:focus:border-[#38bdf8] focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all font-sans"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#4f46e5] to-[#6366f1] text-white shadow-md shadow-indigo-500/20 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                <span>Deterministic AI Assistant</span>
                <span>Press Enter ↵ to send</span>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Intelligent helper to format copilot response text with bolding and badges
 */
function renderFormattedMessage(text: string) {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    // Process markdown-style bolding **text**
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={idx} className="leading-relaxed">
        {parts.map((part, pIdx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={pIdx} className="font-bold text-indigo-700 dark:text-[#7dd3fc]">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        })}
      </p>
    );
  });
}

/**
 * Deterministic local intelligence engine for Copilot answers
 */
function generateCopilotResponse(query: string, role: "student" | "recruiter"): ChatMessage {
  const q = query.toLowerCase();
  const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (q.includes("match score") || q.includes("formula") || q.includes("calculate") || q.includes("algorithm")) {
    return {
      id: `copilot-${Date.now()}`,
      sender: "copilot",
      text:
        "📊 **Deterministic Matching Formula:**\n\n" +
        "Final Score = **clamp(0.65 × D + 0.25 × S + 0.10 × V, 0, 1)**\n\n" +
        "• **D (Exact Overlap):** Weighted overlap of your canonical skills against required internship skills.\n" +
        "• **S (Semantic Similarity):** Embeddings similarity for unmatched skills (thresholded at ≥ 0.75).\n" +
        "• **V (Verification Bonus):** Bonus adjustment based on verified proof (up to +0.10).\n\n" +
        "💡 *Tip: Connect verified GitHub repos or upload certificates to boost both D and V!*",
      timestamp,
      actions: [
        { label: "Internship Matches", tab: "matches" },
        { label: "Skill Passport", tab: "passport" },
      ],
    };
  }

  if (q.includes("verification") || q.includes("tier") || q.includes("verified") || q.includes("confidence")) {
    return {
      id: `copilot-${Date.now()}`,
      sender: "copilot",
      text:
        "🛡️ **Evidence Verification Tiers:**\n\n" +
        "1. **Verified (1.00× Multiplier):** Direct API confirmation (e.g. GitHub public repos, direct commit logs, credential issuers).\n" +
        "2. **Partially Verified (0.85× Multiplier):** Structured resumes or project code without full direct commit history.\n" +
        "3. **Unverified (0.65× Multiplier):** Self-reported or text-only evidence lacking third-party verification.\n\n" +
        "✨ *Verification discounts unproven claims rather than deleting them.*",
      timestamp,
      actions: [
        { label: "GitHub Verification", tab: "github" },
        { label: "Evidence Upload", tab: "evidence" },
      ],
    };
  }

  if (q.includes("github") || q.includes("repo") || q.includes("commit")) {
    return {
      id: `copilot-${Date.now()}`,
      sender: "copilot",
      text:
        "🐙 **GitHub Automated Verification:**\n\n" +
        "1. Enter your GitHub username in the **GitHub Verification** tab.\n" +
        "2. Our worker inspects your top public repositories, languages, and commit history.\n" +
        "3. Skills found in codebases (e.g. Python, TypeScript, Docker) are automatically promoted to **Verified Tier (1.00×)**.",
      timestamp,
      actions: [{ label: "Open GitHub Verification", tab: "github" }],
    };
  }

  if (q.includes("team") || q.includes("complementary") || q.includes("jaccard") || q.includes("group")) {
    return {
      id: `copilot-${Date.now()}`,
      sender: "copilot",
      text:
        "👥 **Team Formation Algorithm:**\n\n" +
        "The engine maximizes **Skill Complementarity** while penalizing redundancy:\n\n" +
        "**Score = Target Skill Coverage - (0.5 × Jaccard Redundancy)**\n\n" +
        "It groups peers whose strengths cover your skill gaps without duplicate overhead.",
      timestamp,
      actions: [{ label: "Explore Team Formation", tab: "teams" }],
    };
  }

  if (q.includes("fairness") || q.includes("privacy") || q.includes("bias") || q.includes("name") || q.includes("university")) {
    return {
      id: `copilot-${Date.now()}`,
      sender: "copilot",
      text:
        "🔒 **Zero-Bias & Explainability Standards:**\n\n" +
        "• Names, gender, ethnicity, age, photos, universities, and GPA are **100% excluded** from matching queries.\n" +
        "• The matching service queries a restricted `matching_view` containing only `student_id`, `skill_id`, and effective confidence.\n" +
        "• Explanations are rendered from database templates, never generated by an ungrounded LLM.",
      timestamp,
    };
  }

  if (q.includes("resume") || q.includes("evidence") || q.includes("upload") || q.includes("pdf")) {
    return {
      id: `copilot-${Date.now()}`,
      sender: "copilot",
      text:
        "📄 **Resume & Evidence Extraction:**\n\n" +
        "• Upload PDF/text resumes or project links in the **Evidence & Resumes** tab.\n" +
        "• Structured skill extraction maps your explicit mentions to our canonical taxonomy.\n" +
        "• Every extracted skill maintains strict provenance linking back to exact text spans in your file.",
      timestamp,
      actions: [{ label: "Upload Evidence", tab: "evidence" }],
    };
  }

  if (role === "recruiter" && (q.includes("weight") || q.includes("post") || q.includes("job") || q.includes("requirement"))) {
    return {
      id: `copilot-${Date.now()}`,
      sender: "copilot",
      text:
        "💼 **Internship Requirement Calibration:**\n\n" +
        "• Assign higher weights (1.5× – 2.0×) to critical core skills (e.g. PostgreSQL, FastAPI).\n" +
        "• Assign standard weights (1.0×) to auxiliary skills (e.g. Docker, Git).\n" +
        "• The engine automatically computes exact overlap and semantic similarity against the verified student pool.",
      timestamp,
      actions: [
        { label: "Post Internship", tab: "post_job" },
        { label: "View Postings", tab: "internships" },
      ],
    };
  }

  // Fallback intelligent contextual answer
  return {
    id: `copilot-${Date.now()}`,
    sender: "copilot",
    text:
      `🤖 I have analyzed your request regarding **"${query}"**.\n\n` +
      `Here are recommended actions you can take right now:\n` +
      `• Audit and verify evidence in your **Skill Passport**\n` +
      `• Review your calculated match breakdown in **Internship Matches**\n` +
      `• Connect external repositories in **GitHub Verification**\n\n` +
      `Need more specific details? Try asking about *"match score"*, *"verification tiers"*, or *"team formation"*.`,
    timestamp,
    actions:
      role === "student"
        ? [
            { label: "Skill Passport", tab: "passport" },
            { label: "Internship Matches", tab: "matches" },
            { label: "Team Formation", tab: "teams" },
          ]
        : [
            { label: "Your Internships", tab: "internships" },
            { label: "Ranked Candidates", tab: "candidates" },
          ],
  };
}
