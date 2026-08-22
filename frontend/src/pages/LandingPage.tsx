import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, FileCheck2, Scale, ShieldCheck } from "lucide-react";

import { DynamicAnimatedBackground } from "../components/DynamicAnimatedBackground";
import { AuthPage } from "./AuthPage";

interface LandingPageProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  defaultAuthOpen?: boolean;
}

const capabilities = [
  { icon: FileCheck2, title: "Evidence-backed skills", text: "Every passport skill links to a submitted evidence record." },
  { icon: Scale, title: "Deterministic matching", text: "Persisted score components make every ranking reproducible." },
  { icon: ShieldCheck, title: "Fair by construction", text: "Names, universities, and protected attributes never enter scoring." },
];

export function LandingPage({ isDarkMode, defaultAuthOpen = false }: LandingPageProps) {
  const [authModalOpen, setAuthModalOpen] = useState(defaultAuthOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && authModalOpen) setAuthModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authModalOpen]);

  return (
    <div className="relative flex min-h-screen w-full select-none flex-col overflow-hidden bg-[#070a10] font-sans text-white">
      <DynamicAnimatedBackground isDarkMode={isDarkMode} />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:28px_28px] opacity-15" />
      <div className="pointer-events-none absolute -top-36 left-1/2 z-0 h-[350px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-500/20 via-cyan-500/10 to-transparent blur-3xl" />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/60 px-4 py-2 text-xs font-semibold text-cyan-100 backdrop-blur-xl"
        >
          <BadgeCheck className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          Verifiable Skill Passport
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-6xl"
        >
          Skills that carry proof. Matches that explain themselves.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          className="mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-lg"
        >
          Students build evidence-backed passports. Recruiters and institutions receive transparent decision support from deterministic, auditable records—not black-box rankings.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="group mt-9 inline-flex items-center rounded-full bg-white px-8 py-3.5 text-sm font-bold text-slate-950 shadow-[0_0_30px_rgba(255,255,255,0.25)] transition hover:scale-105 hover:bg-cyan-50"
        >
          Sign in or create an account
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="mt-14 grid w-full gap-4 text-left md:grid-cols-3"
        >
          {capabilities.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-slate-950/45 p-5 backdrop-blur-xl">
              <Icon className="mb-3 h-5 w-5 text-cyan-300" aria-hidden="true" />
              <h2 className="text-sm font-bold text-white">{title}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-400">{text}</p>
            </article>
          ))}
        </motion.div>
      </main>

      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthModalOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              role="dialog"
              aria-modal="true"
              aria-label="Account Authentication"
              className="relative z-10 flex h-[90vh] max-h-[850px] w-[94vw] max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-slate-50 shadow-2xl dark:bg-[#101319] sm:h-[82vh] sm:w-[86vw] lg:w-[78vw]"
            >
              <div className="flex-1 overflow-y-auto">
                <AuthPage isModal onClose={() => setAuthModalOpen(false)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
