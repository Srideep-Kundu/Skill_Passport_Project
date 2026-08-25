import { useCallback, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
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

const QUICK_PROMPTS = [
  "What is my role readiness score?",
  "Why is Python partially verified?",
  "What should I learn next?",
  "Which internships match me best?",
  "What is my placement status?",
];

export function SkillPassportCopilot({
  token,
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
      {/* Global Viewport-Fixed Floating Launcher */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-[9990] pointer-events-auto select-none">
          <motion.button
            type="button"
            initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={prefersReducedMotion ? false : { scale: 1, opacity: 1 }}
            onClick={handleToggle}
            aria-label="Open Skill Passport Copilot"
            title="Open Skill Passport Copilot"
            className="h-12 w-12 rounded-full border border-white/20 bg-[#0B2634] text-white flex items-center justify-center cursor-pointer transition-colors hover:border-white/35"
          >
            <Bot className="h-5 w-5" aria-hidden="true" />
          </motion.button>
        </div>
      )}

      {/* Slide-over Copilot Dialog Panel */}
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
              className="w-full h-full bg-[#061524] border border-white/15 rounded-lg shadow-2xl flex flex-col overflow-hidden text-white font-sans"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-md border border-white/15 bg-white/5 flex items-center justify-center text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-normal text-white flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                      <span>Platform Copilot</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-300 border border-white/15 px-1.5 py-0.2 rounded-xs">
                        Grounded
                      </span>
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-mono">
                      Deterministic record grounding & audit assistance
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close Copilot"
                  className="p-1 rounded-md text-neutral-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${
                      m.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.sender === "copilot" && (
                      <div className="h-6 w-6 rounded-md border border-white/10 bg-white/5 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <span className="font-mono text-[9px]" aria-hidden="true">SP</span>
                      </div>
                    )}

                    <div
                      className={`max-w-[84%] rounded-sm p-3.5 space-y-2 leading-relaxed ${
                        m.sender === "user"
                          ? "border border-white/20 bg-white/10 text-white font-medium"
                          : "border border-white/10 bg-white/[0.02] text-neutral-200"
                      }`}
                    >
                      <p className="whitespace-pre-line text-xs">{m.text}</p>

                      {/* Sources grounding badges */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1 font-mono">
                          {m.sources.map((s, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] uppercase px-1.5 py-0.5 rounded-xs border border-white/15 bg-white/5 text-neutral-300 flex items-center gap-1"
                            >
                              <ShieldCheck className="h-2.5 w-2.5 text-white/80" />
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Action buttons */}
                      {m.actions && m.actions.length > 0 && (
                        <div className="pt-2 flex flex-wrap gap-1.5 font-mono">
                          {m.actions.map((act, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleActionClick(act)}
                              className="text-[10px] px-2.5 py-1 rounded-full border border-white/20 bg-white/5 text-neutral-200 hover:text-white hover:border-white/40 transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <span>{act.label}</span>
                              <ArrowRight className="h-2.5 w-2.5" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {m.sender === "user" && (
                      <div className="h-6 w-6 rounded-md border border-white/10 bg-white/5 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2 items-center text-[#8796A2] text-xs font-mono">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span>Retrieving verified records...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts */}
              <div className="px-4 py-2 border-t border-white/10 flex gap-1.5 overflow-x-auto text-[10px] font-mono shrink-0">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => void handleSend(qp)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:border-white/25 transition-colors cursor-pointer shrink-0"
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-3 border-t border-white/10 shrink-0 bg-white/[0.02]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    aria-label="Ask Skill Passport Copilot"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Copilot about skills, readiness, jobs..."
                    className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/15 rounded-md text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white"
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={!input.trim() || loading}
                    className="h-8 w-8 rounded-md border border-white/20 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
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
