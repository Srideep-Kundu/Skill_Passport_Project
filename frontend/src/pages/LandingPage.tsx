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
    <div className="relative flex min-h-screen w-full select-none flex-col overflow-hidden bg-[#070a10] font-sans text-white">
      {/* Lumina Horizon Animated Wave Canvas */}
      <LuminaAmbientHorizon className="opacity-90" />

      {/* Grid Overlay & Glow */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:28px_28px] opacity-15" />
      <div className="pointer-events-none absolute -top-36 left-1/2 z-0 h-[350px] w-[700px] -translate-x-1/2 rounded-full bg-gradient-to-b from-indigo-500/20 via-cyan-500/10 to-transparent blur-3xl" />

      {/* Header Bar */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#3b71d9] to-[#6366f1] text-white shadow-md shadow-indigo-500/30">
            <span className="text-sm font-black tracking-wider">SP</span>
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-white">Skill Passport</span>
            <span className="ml-2 hidden rounded-full bg-cyan-950/80 border border-cyan-800/50 px-2 py-0.5 text-[10px] font-bold text-cyan-300 sm:inline-block">
              Verifiable Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {isDarkMode ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-slate-300" />}
          </button>

          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-950/40 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-900/60 transition-all cursor-pointer backdrop-blur-md shadow-xs"
          >
            <span>Sign In</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/70 px-4 py-1.5 text-xs font-semibold text-cyan-100 backdrop-blur-xl shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5 text-cyan-300 animate-pulse" aria-hidden="true" />
          <span>Verifiable Skill Passport & Multi-Persona Ecosystem</span>
        </motion.div>

        {/* Illuminated 5x7 Dot-Matrix Hero Typography */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="my-3"
        >
          <DotMatrixHeroHeader line1="INTELLIGENCE" line2="DESIGNED TO EVOLVE" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base"
        >
          Students construct evidence-backed skill graphs. Recruiters, academicians, and institutions receive auditable, deterministic matching without black-box bias.
        </motion.p>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-[0_0_25px_rgba(56,189,248,0.35)] transition-all hover:scale-105 hover:shadow-[0_0_35px_rgba(56,189,248,0.5)] cursor-pointer"
          >
            <span>Get Started</span>
            <ArrowRight className="h-4 w-4 text-slate-950 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </button>
        </motion.div>



        {/* 3 Value Pillars */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="mt-8 grid w-full gap-4 text-left md:grid-cols-3"
        >
          {capabilities.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 backdrop-blur-xl transition-transform hover:-translate-y-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 mb-3 shadow-xs">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-bold text-white">{title}</h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">{text}</p>
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
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
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
              className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#0b0f19] shadow-2xl p-4 sm:p-6 text-white no-scrollbar"
            >
              <AuthPage isModal onClose={() => setAuthModalOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
