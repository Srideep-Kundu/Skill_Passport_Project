import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface TypewriterRevealProps {
  children: React.ReactNode;
  delay?: number; // Delay before scanning/typing begins
  duration?: number; // How long the typing scan takes from left to right
  className?: string;
  showBeam?: boolean; // Whether to show the glowing cursor beam at the leading edge
  beamColor?: "indigo" | "emerald" | "amber";
}

export function TypewriterReveal({
  children,
  delay = 0,
  duration = 0.44,
  className = "",
  showBeam = true,
  beamColor = "indigo",
}: TypewriterRevealProps) {
  const prefersReducedMotion = useReducedMotion();
  const [beamFinished, setBeamFinished] = useState(false);

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const beamGradientMap = {
    indigo: "via-indigo-500 shadow-[0_0_14px_rgba(99,102,241,0.9)] dark:via-indigo-400 dark:shadow-[0_0_16px_rgba(129,140,248,0.9)]",
    emerald: "via-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.9)] dark:via-emerald-400 dark:shadow-[0_0_16px_rgba(52,211,153,0.9)]",
    amber: "via-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.9)] dark:via-amber-400 dark:shadow-[0_0_16px_rgba(251,191,36,0.9)]",
  };

  return (
    <div className={`relative ${beamFinished ? "overflow-visible" : "overflow-hidden"} ${className}`}>
      {/* The content unveiled from left to right */}
      <motion.div
        initial={{
          clipPath: "inset(0% 100% 0% 0%)",
          opacity: 0.3,
          x: -6,
        }}
        animate={{
          clipPath: "inset(0% 0% 0% 0%)",
          opacity: 1,
          x: 0,
        }}
        transition={{
          duration,
          delay,
          ease: [0.16, 1, 0.3, 1],
        }}
        onAnimationComplete={() => setBeamFinished(true)}
        className="w-full h-full"
      >
        {children}
      </motion.div>

      {/* Glowing Typing Beam Cursor at the leading reveal edge */}
      {showBeam && !beamFinished && (
        <motion.div
          initial={{
            left: "0%",
            opacity: 0,
          }}
          animate={{
            left: "100%",
            opacity: [0, 1, 1, 0.8, 0],
          }}
          transition={{
            duration,
            delay,
            ease: [0.16, 1, 0.3, 1],
          }}
          className={`pointer-events-none absolute top-0 bottom-0 z-40 w-[2.5px] bg-gradient-to-b from-transparent ${beamGradientMap[beamColor]} to-transparent`}
        />
      )}
    </div>
  );
}
