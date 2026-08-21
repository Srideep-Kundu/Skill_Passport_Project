import { motion, useReducedMotion } from "framer-motion";
import { LuminaWaves } from "./LuminaWaves";

export function AntigravityBackground() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden z-0 select-none opacity-40 dark:opacity-30"
    >
      {/* Top subtle radial highlight */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-[#3b71d9]/15 via-[#b0c6ff]/5 to-transparent blur-3xl rounded-full" />

      {/* Lumina Organic Ambient Waves */}
      <LuminaWaves opacity={0.35} speed={0.7} interactive={false} />

      {/* Floating Ambient Glow Orbs */}
      <motion.div
        animate={{
          x: [0, 25, -20, 0],
          y: [0, -20, 15, 0],
          scale: [1, 1.06, 0.96, 1],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-10 left-1/5 h-80 w-80 rounded-full bg-gradient-to-tr from-[#3b71d9]/15 to-[#b0c6ff]/15 blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, -25, 20, 0],
          y: [0, 20, -15, 0],
          scale: [1, 0.94, 1.05, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/3 -right-16 h-96 w-96 rounded-full bg-gradient-to-br from-[#38bdf8]/10 to-[#3b71d9]/10 blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, 15, -15, 0],
          y: [0, -15, 20, 0],
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute bottom-10 left-1/3 h-72 w-72 rounded-full bg-gradient-to-r from-[#1d2025]/20 to-[#3b71d9]/10 blur-3xl"
      />
    </div>
  );
}


