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
      {/* STATIC GHOST SLOT */}
      <div className="invisible pointer-events-none p-5 rounded-md border border-transparent flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase">{title}</span>
            <div className="w-4 h-4" />
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-normal" style={{ fontFamily: "var(--font-display)" }}>{mainValue}</span>
          </div>
        </div>
        {progressBar && <div className="mt-2 h-1.5 w-full" />}
        {footerText && <p className="text-[11px] mt-1">{footerText}</p>}
      </div>

      {/* EXPANDABLE CARD */}
      <motion.div
        initial={false}
        animate={
          prefersReducedMotion
            ? {}
            : isHovered
            ? {
                scale: 1.02,
                y: -4,
                zIndex: 50,
              }
            : {
                scale: 1,
                y: 0,
                zIndex: 10,
              }
        }
        transition={{
          duration: 0.22,
          ease: [0.16, 1, 0.3, 1],
        }}
        className={`absolute top-0 left-0 right-0 w-full origin-center rounded-[16px] border p-5 transition-all cursor-pointer ${
          isHovered
            ? "z-50 border-[#B08D57] bg-[#FFFFFF] shadow-[0_12px_40px_rgba(17,24,39,0.12)]"
            : "z-10 border-[#E5E1D8] bg-[#FFFFFF] shadow-[0_8px_30px_rgba(17,24,39,0.04)]"
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748B] font-semibold">
            {title}
          </span>
          <div className="flex items-center gap-1.5 text-[#B08D57]">
            {icon}
          </div>
        </div>

        {/* Primary Numbers & Progress */}
        <div className="mt-2">
          <div className="flex items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span
                className="text-3xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {mainValue}
              </span>
              {badge && (
                <span className={badge.className ?? "text-xs font-mono text-[#4F6F5A]"}>
                  {badge.text}
                </span>
              )}
            </div>
            {subValue && (
              <span className="font-mono text-xs text-[#64748B] shrink-0">
                {subValue}
              </span>
            )}
          </div>

          {progressBar && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-[#F7F5F0] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, progressBar.value))}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={progressBar.color ?? "h-full rounded-full bg-[#B08D57]"}
              />
            </div>
          )}

          {footerText && (
            <p className="font-mono text-[11px] text-[#64748B] mt-1">
              {footerText}
            </p>
          )}
        </div>

        {/* Enlarged Internal Details */}
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
                marginTop: 12,
              }}
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, height: 0, marginTop: 0 }
              }
              transition={{
                duration: 0.20,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="border-t border-[#E5E1D8] pt-3 overflow-hidden text-xs text-[#475569]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase text-[#B08D57]">
                  {hoverTitle}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#64748B] border border-[#E5E1D8] px-1.5 py-0.5 rounded-xs">
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
