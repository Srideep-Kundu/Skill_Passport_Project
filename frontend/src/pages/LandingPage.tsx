import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { DotMatrixHeroHeader } from "../components/DotMatrixHero";
import { DynamicAnimatedBackground } from "../components/DynamicAnimatedBackground";
import { AuthPage } from "./AuthPage";

interface LandingPageProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  defaultAuthOpen?: boolean;
}

export function LandingPage({
  isDarkMode,
  defaultAuthOpen = false,
}: LandingPageProps) {
  const [authModalOpen, setAuthModalOpen] = useState(defaultAuthOpen);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && authModalOpen) {
        setAuthModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authModalOpen]);

  return (
    <div className="min-h-screen w-full bg-[#070a10] text-white flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Dynamic Animated Wave, Particle & Energy Glow Background */}
      <DynamicAnimatedBackground isDarkMode={isDarkMode} />

      {/* Radial particle overlay texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:28px_28px] opacity-20 pointer-events-none z-0" />

      {/* Top Subtle Ambient Glow */}
      <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-indigo-500/20 via-cyan-500/10 to-transparent rounded-full blur-3xl pointer-events-none z-0" />

      {/* ========================================================================= */}
      {/* HERO MAIN BODY (No Top Navbar - Pure Clean Hero Focus)                    */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center max-w-5xl mx-auto w-full my-auto">
        {/* Top Trust / Verified Pill Badge */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2.5 rounded-full bg-black/50 backdrop-blur-xl border border-white/15 px-4 py-1.5 text-xs font-medium text-slate-200 mb-6 sm:mb-8 shadow-xl shadow-black/40 hover:border-cyan-400/40 transition-colors"
        >
          <div className="flex items-center -space-x-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 border border-white/30 text-[10px] font-black text-white shadow-xs">
              ⬡
            </span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 border border-white/30 text-[10px] font-black text-white shadow-xs">
              ⌘
            </span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 border border-white/30 text-[10px] font-black text-white shadow-xs">
              ✓
            </span>
          </div>
          <span className="text-slate-300 font-semibold tracking-wide">
            Trusted by 2000+ Enterprises
          </span>
        </motion.div>

        {/* Digital Dot-Matrix Headline */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full flex justify-center py-2"
        >
          <DotMatrixHeroHeader
            line1="INTELLIGENCE"
            line2="DESIGNED TO EVOLVE"
          />
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-2xl text-sm sm:text-base md:text-lg text-slate-300 font-normal leading-relaxed mt-4 sm:mt-6 px-4 font-sans"
        >
          Build applications that reason, adapt and collaborate using a modular AI platform designed for production.
        </motion.p>

        {/* Centered "Get Started" Action Button */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 sm:mt-10 flex items-center justify-center gap-3"
        >
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="group relative inline-flex items-center justify-center px-8 py-3.5 rounded-full text-xs sm:text-sm font-bold bg-white text-slate-950 shadow-[0_0_30px_rgba(255,255,255,0.35)] hover:shadow-[0_0_45px_rgba(56,189,248,0.65)] hover:bg-slate-100 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer font-sans"
          >
            <span>Get Started</span>
            <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </main>

      {/* ========================================================================= */}
      {/* BOTTOM METRICS / STAT BAR                                                 */}
      {/* ========================================================================= */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 border-t border-white/10 pt-6 sm:pt-8"
        >
          {/* Stat 1 */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-1">
            <div className="flex items-center gap-1.5 text-lg sm:text-xl font-extrabold text-white tracking-tight font-sans">
              <span className="text-[#38bdf8] font-bold">&lt;</span>
              <span>120ms</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-sans">
              Inference Time
            </span>
          </div>

          {/* Stat 2 */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-1">
            <div className="flex items-center gap-1.5 text-lg sm:text-xl font-extrabold text-white tracking-tight font-sans">
              <span className="text-[#38bdf8] font-bold">⁒</span>
              <span>99.99%</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-sans">
              Platform Uptime
            </span>
          </div>

          {/* Stat 3 */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-1">
            <div className="flex items-center gap-1.5 text-lg sm:text-xl font-extrabold text-white tracking-tight font-sans">
              <span className="text-[#38bdf8] font-bold">✱</span>
              <span>24/7</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-sans">
              Autonomous Runtime
            </span>
          </div>

          {/* Stat 4 */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-1">
            <div className="flex items-center gap-1.5 text-lg sm:text-xl font-extrabold text-white tracking-tight font-sans">
              <span className="text-[#38bdf8] font-bold">#</span>
              <span>2.4M</span>
            </div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider font-sans">
              Context Windows
            </span>
          </div>
        </motion.div>
      </footer>

      {/* ========================================================================= */}
      {/* 70%–80% AUTH MODAL POPUP                                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8">
            {/* Frosted Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setAuthModalOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
              aria-hidden="true"
            />

            {/* 70%–80% Viewport Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              role="dialog"
              aria-modal="true"
              aria-label="Account Authentication"
              className="relative z-10 w-[94vw] sm:w-[86vw] lg:w-[78vw] max-w-5xl h-[90vh] sm:h-[82vh] max-h-[850px] rounded-3xl border border-white/20 dark:border-white/[0.12] bg-slate-50 dark:bg-[#101319] shadow-2xl shadow-indigo-950/60 overflow-hidden flex flex-col"
            >
              <div className="flex-1 overflow-y-auto">
                <AuthPage isModal={true} onClose={() => setAuthModalOpen(false)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
