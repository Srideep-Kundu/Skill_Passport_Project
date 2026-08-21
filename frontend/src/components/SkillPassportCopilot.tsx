import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import type { CopilotAction, CopilotResponse } from "../api/types";
import { toast } from "sonner";

interface Props {
  token: string;
  onNavigate?: (tab: string) => void;
}

interface Message {
  id: string;
  sender: "user" | "copilot";
  text: string;
  sources?: string[];
  actions?: CopilotAction[];
}

const QUICK_PROMPTS = [
  "What is my role readiness score?",
  "Why is Python partially verified?",
  "What should I learn next?",
  "Which internships match me best?",
  "What is my placement status?",
];

export function SkillPassportCopilot({ token, onNavigate }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "copilot",
      text: "Hello! I am your Skill Passport Copilot. Ask me about your verified skills, role readiness, recommended courses, or placement status.",
      actions: [
        { label: "Analyze Skill Gaps", target_tab: "gaps", action_type: "navigate" },
        { label: "View Passport", target_tab: "passport", action_type: "navigate" },
      ],
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  async function handleSend(queryText?: string) {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: String(Date.now()),
      sender: "user",
      text: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInput("");
    setLoading(true);

    try {
      const res: CopilotResponse = await api.queryCopilot(userMsg.text, token);
      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: "copilot",
        text: res.message,
        sources: res.sources,
        actions: res.actions,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      toast.error("Copilot could not process query");
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
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

  return (
    <aside aria-label="Skill Passport Copilot Assistant" className="fixed bottom-6 right-6 z-50">
      {/* Floating trigger button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#3b71d9] hover:bg-[#2f5db3] text-white shadow-lg shadow-[#3b71d9]/30 font-bold text-xs cursor-pointer border border-white/20 backdrop-blur-md transition-all"
        >
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span>Skill Passport Copilot</span>
        </motion.button>
      )}

      {/* Slide-over Copilot Dialog Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="w-[360px] sm:w-[420px] h-[580px] max-h-[85vh] bg-white dark:bg-[#111821] border border-slate-200 dark:border-white/[0.12] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-[#f1f0e8]"
          >
            {/* Header */}
            <div className="p-4 bg-slate-50 dark:bg-[#151921] border-b border-slate-200 dark:border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[#3b71d9]/10 dark:bg-[#3b71d9]/20 border border-[#3b71d9]/30 flex items-center justify-center text-[#3b71d9] dark:text-[#b0c6ff]">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Platform Copilot</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                      Grounded
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Contextual navigation & verified insights</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 rounded-lg hover:bg-slate-200 dark:hover:bg-white/[0.08] flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.sender === "user" ? "justify-end" : "justify-start"}`}
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
                        : "bg-slate-100 dark:bg-[#18202c] text-slate-800 dark:text-[#f1f0e8] rounded-bl-xs border border-slate-200/60 dark:border-white/[0.06]"
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>

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
                      <div className="pt-2 flex flex-wrap gap-1.5">
                        {m.actions.map((act, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleActionClick(act)}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-[#121720] text-[#3b71d9] dark:text-[#b0c6ff] border border-[#3b71d9]/30 hover:bg-[#3b71d9] hover:text-white dark:hover:bg-[#3b71d9] dark:hover:text-white transition-all cursor-pointer flex items-center gap-1 shadow-xs"
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
                <div className="flex gap-2.5 items-center text-slate-400 text-[11px] italic">
                  <div className="h-6 w-6 rounded-lg bg-[#3b71d9]/15 text-[#3b71d9] flex items-center justify-center shrink-0 animate-spin">
                    <Sparkles className="h-3 w-3" />
                  </div>
                  <span>Retrieving platform grounding...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts Carousel */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-[#151921] border-t border-slate-200/80 dark:border-white/[0.06] flex gap-1.5 overflow-x-auto no-scrollbar text-[10px]">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => void handleSend(qp)}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-[#1b222d] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#3b71d9] hover:text-[#3b71d9] transition-colors cursor-pointer shrink-0"
                >
                  {qp}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white dark:bg-[#111821] border-t border-slate-200 dark:border-white/[0.08]">
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
                  placeholder="Ask Copilot about skills, readiness, jobs..."
                  className="flex-1 px-3.5 py-2 bg-slate-100 dark:bg-[#18202c] border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#3b71d9]"
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
        )}
      </AnimatePresence>
    </aside>
  );
}
