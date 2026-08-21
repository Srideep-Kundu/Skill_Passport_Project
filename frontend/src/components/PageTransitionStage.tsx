import type { ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { crossfadePageVariants, reducedMotionVariants } from "../theme/motion";

interface PageTransitionStageProps {
  pageKey: string;
  children: ReactNode;
  className?: string;
}

/**
 * PageTransitionStage:
 * Provides a clean modern website-style crossfade page transition (Fade Out → Fade In).
 */
export function PageTransitionStage({
  pageKey,
  children,
  className = "",
}: PageTransitionStageProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`relative w-full min-h-[calc(100vh-8rem)] ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={pageKey}
          variants={prefersReducedMotion ? reducedMotionVariants : crossfadePageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ transformOrigin: "50% 30vh" }}
          className="w-full relative space-y-8 text-slate-900 dark:text-slate-100"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
