import { useState, useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface ExpandableStatCardProps {
  title: string;
  icon: ReactNode;
  mainValue: ReactNode;
  subValue?: ReactNode;
  footerText?: string;
  progressBar?: {
    value: number;
    color?: string;
  };
  badge?: {
    text: ReactNode;
    className?: string;
  };
  hoverTitle: string;
  hoverDetails: ReactNode;
  className?: string;
  revealDelay?: number;
}

export function ExpandableStatCard({
  title,
  icon,
  mainValue,
  subValue,
  footerText,
  progressBar,
  badge,
  hoverTitle,
  hoverDetails,
  className = "",
}: ExpandableStatCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const closeTimeoutRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  return (
    <div
      className={`relative min-h-[142px] select-none ${isHovered ? "z-50" : "z-10"} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      tabIndex={0}
      role="region"
      aria-label={`${title} details`}
    >
      {/* 
        STATIC GHOST SLOT:
        Preserves rock-solid grid geometry so hovering NEVER causes surrounding cards or page to shake.
      */}
      <div className="invisible pointer-events-none p-4.5 rounded-2xl border border-transparent flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase">{title}</span>
            <div className="w-4 h-4" />
          </div>
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-black">{mainValue}</span>
          </div>
        </div>
        {progressBar && <div className="mt-2 h-2 w-full" />}
        {footerText && <p className="text-[11px] mt-1">{footerText}</p>}
      </div>

      {/* 
        OMNIDIRECTIONAL ENLARGING CARD:
        Scales smoothly outward from center with elevated z-index and glowing focus ring.
        Stays within safe bounds to prevent any edge clipping or cut-offs.
      */}
      <motion.div
        initial={false}
        animate={
          prefersReducedMotion
            ? {}
            : isHovered
            ? {
                scale: 1.04,
                y: -6,
                zIndex: 50,
              }
            : {
                scale: 1,
                y: 0,
                zIndex: 10,
              }
        }
        transition={{
          duration: 0.24,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={`absolute top-0 left-0 right-0 w-full origin-center rounded-3xl border p-5 transition-all duration-200 cursor-pointer ${
          isHovered
            ? "z-50 border-[#3b71d9]/80 dark:border-[#3b71d9]/80 bg-white/85 dark:bg-[#0c121e]/75 backdrop-blur-xl shadow-2xl dark:shadow-[0_12px_35px_rgba(0,0,0,0.6)] ring-2 ring-[#3b71d9]/30"
            : "z-10 border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl shadow-lg hover:border-slate-300 dark:hover:border-white/[0.18]"
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-[#98a4b3] uppercase tracking-wider font-sans">
            {title}
          </span>
          <div className="flex items-center gap-1.5 text-[#3b71d9] dark:text-[#b0c6ff]">
            {icon}
          </div>
        </div>

        {/* Primary Numbers & Progress */}
        <div className="mt-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-[#f1f0e8] font-sans">
                {mainValue}
              </span>
              {badge && (
                <span className={badge.className ?? "text-xs font-bold text-emerald-600 dark:text-emerald-400"}>
                  {badge.text}
                </span>
              )}
            </div>
            {subValue && (
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#98a4b3] shrink-0 font-sans">
                {subValue}
              </span>
            )}
          </div>

          {progressBar && (
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 dark:bg-[#1d2025] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, progressBar.value))}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className={progressBar.color ?? "h-full rounded-full bg-[#3b71d9]"}
              />
            </div>
          )}

          {footerText && (
            <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] mt-1 font-sans">
              {footerText}
            </p>
          )}
        </div>

        {/* Enlarged Internal Details (Unfolds smoothly inside the card) */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, height: 0, marginTop: 0 }
              }
              animate={{
                opacity: 1,
                height: "auto",
                marginTop: 14,
              }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, height: 0, marginTop: 0 }
              }
              transition={{
                duration: 0.24,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="border-t border-slate-100 dark:border-slate-800/80 pt-3 overflow-hidden text-xs text-slate-700 dark:text-slate-300"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {hoverTitle}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  Expanded
                </span>
              </div>
              {hoverDetails}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
