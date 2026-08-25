import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, FileCheck2, Scale, ShieldCheck, Sparkles, Sun, Moon } from "lucide-react";

import { LuminaAmbientHorizon } from "../components/LuminaAmbientHorizon";
import { DotMatrixHeroHeader } from "../components/DotMatrixHero";
import { AuthPage } from "./AuthPage";

interface LandingPageProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  defaultAuthOpen?: boolean;
}

const capabilities = [
  { icon: FileCheck2, title: "Evidence-Backed Skills", text: "Every passport skill traces to concrete code, repositories, and verified records." },
  { icon: Scale, title: "Deterministic Matching", text: "Mathematical multi-component scoring without unexplainable AI bias or black-box rankings." },
  { icon: ShieldCheck, title: "Fair by Construction", text: "Protected attributes and demographic proxies are isolated from matching queries." },
];

export function LandingPage({ isDarkMode, onToggleTheme, defaultAuthOpen = false }: LandingPageProps) {
  const [authModalOpen, setAuthModalOpen] = useState(defaultAuthOpen);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && authModalOpen) setAuthModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authModalOpen]);

  return (
    <div className="relative flex min-h-dvh w-full min-w-0 select-none flex-col overflow-x-clip bg-slate-50 font-sans text-slate-900 transition-colors duration-200 dark:bg-[#070a10] dark:text-white">
      {/* Lumina Horizon Animated Wave Canvas */}
      <LuminaAmbientHorizon className="opacity-90" />

      {/* Grid Overlay & Glow */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:28px_28px] opacity-25 dark:bg-[radial-gradient(#38bdf8_1px,transparent_1px)] dark:opacity-15" />
      <div className="pointer-events-none absolute -top-36 left-1/2 z-0 h-[350px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-300/30 via-sky-200/20 to-transparent blur-3xl dark:from-indigo-500/20 dark:via-cyan-500/10" />

      {/* Header Bar */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#3b71d9] to-[#6366f1] text-white shadow-md shadow-indigo-500/25">
            <span className="text-sm font-black tracking-wider">SP</span>
          </div>
          <div className="flex min-w-0 items-center">
            <span className="whitespace-nowrap text-xs font-bold tracking-tight text-slate-900 sm:text-sm dark:text-white">Skill Passport</span>
            <span className="ml-2 hidden whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 md:inline-block dark:border-cyan-800/50 dark:bg-cyan-950/80 dark:text-cyan-300">
              Verifiable Engine
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 shadow-xs backdrop-blur-md transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </button>

          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-sky-200/80 bg-white/80 px-3 py-2 text-[11px] font-bold text-indigo-600 shadow-xs backdrop-blur-md transition-all hover:bg-sky-50 sm:gap-1.5 sm:px-4 sm:text-xs cursor-pointer dark:border-cyan-400/30 dark:bg-cyan-950/40 dark:text-cyan-200 dark:hover:bg-cyan-900/60"
          >
            <span>Sign In</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="relative z-10 mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col items-center justify-start px-3 py-5 text-center sm:px-6 sm:py-8 lg:justify-center lg:px-8 lg:py-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-sky-200/80 bg-white/80 px-3 py-1.5 text-[10px] font-semibold leading-4 text-sky-800 shadow-sm backdrop-blur-xl sm:px-4 sm:text-xs dark:border-cyan-300/25 dark:bg-slate-950/70 dark:text-cyan-100"
        >
          <Sparkles className="h-3.5 w-3.5 text-sky-600 animate-pulse dark:text-cyan-300" aria-hidden="true" />
          <span>Verifiable Skill Passport & Multi-Persona Ecosystem</span>
        </motion.div>

        {/* Illuminated 5x7 Dot-Matrix Hero Typography */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="my-3 w-full max-w-full overflow-hidden px-1 sm:px-2"
        >
          <DotMatrixHeroHeader line1="LUMINA INTEL" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-3 max-w-2xl px-1 text-xs leading-5 text-slate-600 sm:px-0 sm:text-sm sm:leading-6 lg:text-base dark:text-slate-300"
        >
          Students construct evidence-backed skill graphs. Recruiters, academicians, and institutions receive auditable, deterministic matching without black-box bias.
        </motion.p>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mt-6 flex w-full flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="group relative isolate inline-flex min-h-12 w-full max-w-xs cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border border-indigo-200/80 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 px-6 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(79,70,229,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(79,70,229,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 active:translate-y-0 active:scale-[0.985] sm:w-auto sm:px-7 sm:py-3.5 dark:border-cyan-100/25 dark:bg-slate-950/20 dark:bg-gradient-to-r dark:from-cyan-300/15 dark:via-sky-400/20 dark:to-indigo-400/25 dark:text-cyan-50 dark:shadow-[0_8px_28px_rgba(14,165,233,0.14),inset_0_1px_0_rgba(255,255,255,0.18)] dark:ring-1 dark:ring-inset dark:ring-white/15 dark:backdrop-blur-2xl dark:backdrop-saturate-150 dark:before:pointer-events-none dark:before:absolute dark:before:inset-x-3 dark:before:top-px dark:before:h-px dark:before:bg-gradient-to-r dark:before:from-transparent dark:before:via-white/60 dark:before:to-transparent dark:hover:border-cyan-100/45 dark:hover:from-cyan-300/25 dark:hover:via-sky-400/30 dark:hover:to-indigo-400/35 dark:hover:shadow-[0_10px_32px_rgba(34,211,238,0.22),0_0_20px_rgba(99,102,241,0.14),inset_0_1px_0_rgba(255,255,255,0.24)] dark:focus-visible:ring-cyan-200/70"
          >
            <span className="relative z-10 font-bold">Get Started</span>
            <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </button>
        </motion.div>

        {/* 3 Value Pillars */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="mt-8 grid w-full min-w-0 grid-cols-1 gap-4 text-left lg:grid-cols-3"
        >
          {capabilities.map(({ icon: Icon, title, text }) => (
            <article key={title} className="min-w-0 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-lg shadow-slate-100/80 backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-xl hover:border-slate-300 sm:p-5 dark:border-white/10 dark:bg-slate-950/50 dark:shadow-none dark:hover:border-white/20">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 border border-sky-200 text-sky-700 mb-3 shadow-xs dark:bg-cyan-950/60 dark:border-cyan-800/50 dark:text-cyan-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">{text}</p>
            </article>
          ))}
        </motion.div>
      </main>

      {/* 70%–80% Auth Modal Dialog */}
      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthModalOpen(false)}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-md dark:bg-slate-950/80"
              aria-hidden="true"
            />

            {/* Modal Dialog Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              role="dialog"
              aria-modal="true"
              className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 text-slate-900 shadow-2xl p-4 sm:p-6 no-scrollbar dark:border-white/15 dark:bg-[#0b0f19] dark:text-white"
            >
              <AuthPage isModal onClose={() => setAuthModalOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
