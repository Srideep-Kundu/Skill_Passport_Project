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
      text: "Hello! I am your Lumina Intel Copilot. Ask me about your verified skills, role readiness, recommended courses, or placement status.",
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
      {/* Global Viewport-Fixed Floating Launcher in Bottom Right (Round Shape) */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-[9990] pointer-events-auto select-none">
          <motion.button
            type="button"
            initial={prefersReducedMotion ? false : { scale: 0.8, opacity: 0 }}
            animate={prefersReducedMotion ? false : { scale: 1, opacity: 1 }}
            onClick={handleToggle}
            aria-label="Open Lumina Intel Copilot"
            title="Open Lumina Intel Copilot"
            className="h-13 w-13 rounded-full border border-[#E5E1D8] bg-[#0B0B0A] text-[#FFFFFF] flex items-center justify-center cursor-pointer transition-all hover:scale-108 shadow-[0_10px_35px_rgba(17,24,39,0.25)] hover:border-[#B08D57]"
          >
            <Bot className="h-6 w-6 text-[#B08D57]" aria-hidden="true" />
          </motion.button>
        </div>
      )}

      {/* Slide-over Copilot Dialog Panel */}
      <AnimatePresence>
        {isOpen && (
          <aside
            aria-label="Lumina Intel Copilot Assistant"
            className="fixed bottom-[88px] right-4 sm:right-6 z-[9999] w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] h-[580px] max-h-[75vh] flex flex-col pointer-events-auto"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full bg-[#FFFFFF] border border-[#E5E1D8] rounded-[16px] shadow-[0_20px_50px_rgba(17,24,39,0.15)] flex flex-col overflow-hidden text-[#111827] font-sans"
            >
              {/* Header */}
              <div className="p-4 border-b border-[#E5E1D8] flex items-center justify-between shrink-0 bg-[#F7F5F0]">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full border border-[#B08D57]/40 bg-[rgba(176,141,87,0.12)] flex items-center justify-center text-[#B08D57]">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-normal text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                      <span>Platform Copilot</span>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[#4F6F5A] border border-[#4F6F5A]/30 bg-[rgba(79,111,90,0.10)] px-2 py-0.5 rounded-full font-semibold">
                        Grounded
                      </span>
                    </h3>
                    <p className="text-[10px] text-[#64748B] font-mono">
                      Deterministic record grounding & audit assistance
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close Copilot"
                  className="p-1.5 rounded-full text-[#64748B] hover:text-[#111827] hover:bg-[#EFEBE3] cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Chat Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans bg-[#FFFFFF]">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex gap-2.5 ${
                      m.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {m.sender === "copilot" && (
                      <div className="h-6 w-6 rounded-full border border-[#B08D57]/40 bg-[rgba(176,141,87,0.12)] text-[#B08D57] flex items-center justify-center shrink-0 mt-0.5 font-bold">
                        <span className="font-mono text-[8px]" aria-hidden="true">SP</span>
                      </div>
                    )}

                    <div
                      className={`max-w-[84%] rounded-[14px] p-3.5 space-y-2 leading-relaxed ${
                        m.sender === "user"
                          ? "bg-[#0B0B0A] text-[#FFFFFF] font-medium"
                          : "border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827]"
                      }`}
                    >
                      <p className="whitespace-pre-line text-xs">{m.text}</p>

                      {/* Sources grounding badges */}
                      {m.sources && m.sources.length > 0 && (
                        <div className="pt-2 border-t border-[#E5E1D8] flex flex-wrap gap-1 font-mono">
                          {m.sources.map((s, idx) => (
                            <span
                              key={idx}
                              className="text-[9px] uppercase px-2 py-0.5 rounded-full border border-[#E5E1D8] bg-[#FFFFFF] text-[#64748B] flex items-center gap-1 font-semibold"
                            >
                              <ShieldCheck className="h-2.5 w-2.5 text-[#4F6F5A]" />
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
                              className="text-[10px] px-3 py-1 rounded-full border border-[#E5E1D8] bg-[#FFFFFF] text-[#111827] hover:border-[#B08D57] transition-colors cursor-pointer flex items-center gap-1 font-medium shadow-2xs"
                            >
                              <span>{act.label}</span>
                              <ArrowRight className="h-2.5 w-2.5 text-[#B08D57]" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {m.sender === "user" && (
                      <div className="h-6 w-6 rounded-full border border-[#E5E1D8] bg-[#0B0B0A] text-white flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2 items-center text-[#64748B] text-xs font-mono">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-[#B08D57] border-t-transparent animate-spin" />
                    <span>Retrieving verified records...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts */}
              <div className="px-4 py-2.5 border-t border-[#E5E1D8] bg-[#F7F5F0] flex gap-1.5 overflow-x-auto text-[10px] font-mono shrink-0">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => void handleSend(qp)}
                    className="whitespace-nowrap px-3 py-1 rounded-full border border-[#E5E1D8] bg-[#FFFFFF] text-[#475569] hover:text-[#111827] hover:border-[#B08D57] transition-all cursor-pointer shrink-0 shadow-2xs"
                  >
                    {qp}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-3 border-t border-[#E5E1D8] shrink-0 bg-[#FFFFFF]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    aria-label="Ask Lumina Intel Copilot"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Copilot about skills, readiness, jobs..."
                    className="flex-1 px-3.5 py-2 bg-[#F7F5F0] border border-[#E5E1D8] rounded-lg text-xs text-[#111827] placeholder:text-[#64748B] focus:outline-none focus:border-[#B08D57]"
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={!input.trim() || loading}
                    className="h-8 w-8 rounded-lg bg-[#0B0B0A] hover:bg-[#111827] disabled:opacity-40 text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
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

export { SkillPassportCopilot as LuminaIntelCopilot };
