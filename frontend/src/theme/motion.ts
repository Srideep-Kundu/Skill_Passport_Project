// Centralized Motion Design Tokens for Skill Passport
// Hybrid Crossfade + Prominent Center-Collapse / Center-Expansion Page Transitions
import type { Variants, Transition } from "framer-motion";

export const MOTION_DURATIONS = {
  micro: 0.18, // 180ms micro-interactions (press, hover, badges)
  fast: 0.28, // 280ms small UI transitions
  normal: 0.45, // 450ms panels & cards
  page: 1.25, // 1.25s incoming center-expansion & fade-in (clearly visible to naked eye)
  pageExit: 1.10, // 1.10s outgoing center-collapse & fade-out
  sidebarIndicator: 0.45, // 450ms sidebar indicator glide
  slow: 0.60, // 600ms charts
} as const;

export const MOTION_EASINGS = {
  standard: [0.16, 1, 0.3, 1] as const, // Smooth cubic-bezier ease-out (gentle deceleration)
  centerExpand: [0.16, 1, 0.3, 1] as const, // Smooth expansion from center to scale 1
  centerCollapse: [0.4, 0, 0.2, 1] as const, // Controlled ease-in-out shrinkage to scale 0.94
  springSmooth: { type: "spring", stiffness: 240, damping: 26, mass: 0.9 } as const,
};

// Synchronized sidebar navigation active indicator transition
export const sidebarIndicatorTransition: Transition = {
  duration: MOTION_DURATIONS.sidebarIndicator,
  ease: [0.22, 1, 0.36, 1],
};

// ==================================================
// 🌟 HYBRID CROSSFADE + CENTER-COLLAPSE / EXPANSION
// Outgoing Page A:
//   - Opacity: 1 → 0
//   - Scale: 1 → 0.94 (gently shrinks toward main-content viewport center)
//   - Blur: 0px → 2px
//   - Duration: 1.10s, ease: [0.4, 0, 0.2, 1]
// Incoming Page B:
//   - Opacity: 0 → 1
//   - Scale: 0.94 → 1 (gently expands outward from main-content viewport center)
//   - Blur: 2px → 0px (micro depth resolution)
//   - Delay: 0.06s, Duration: 1.25s, ease: [0.16, 1, 0.3, 1]
// Total Sequence Duration: ~1.25s with prominent smooth crossfade overlap
// ==================================================
export const hybridCenterVariants: Variants = {
  initial: {
    transformOrigin: "50% 30vh",
    opacity: 0,
    scale: 0.94,
    filter: "blur(2px)",
    x: 0,
    y: 0,
  },
  animate: {
    transformOrigin: "50% 30vh",
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    x: 0,
    y: 0,
    transition: {
      duration: 1.25,
      delay: 0.06, // Smoothly overlaps right as outgoing begins collapsing
      ease: [0.16, 1, 0.3, 1], // Gentle deceleration into clean final resting state
    },
  },
  exit: {
    transformOrigin: "50% 30vh",
    opacity: 0,
    scale: 0.94,
    filter: "blur(2px)",
    x: 0,
    y: 0,
    transition: {
      duration: 1.10,
      ease: [0.4, 0, 0.2, 1], // Controlled shrink toward center
    },
  },
};

// Universal aliases ensuring all navigation components use the hybrid center transition
export const crossfadePageVariants: Variants = hybridCenterVariants;
export const diagonalPageVariants: Variants = hybridCenterVariants;
export const spatialPageVariants: Variants = hybridCenterVariants;
export const pageCollapseFormVariants: Variants = hybridCenterVariants;

// Accessibility Reduced Motion (Immediate gentle fade without scale)
export const reducedMotionVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.99,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.18,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.99,
    transition: {
      duration: 0.12,
      ease: "easeIn",
    },
  },
};

export const pageAssemblyItemVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.24,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.1 },
  },
};

export const typewriterCardVariants: Variants = pageAssemblyItemVariants;
export const typewriterItemVariants: Variants = pageAssemblyItemVariants;

export const containerStaggerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.01,
    },
  },
};

export const cardItemVariants: Variants = typewriterItemVariants;

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, filter: "blur(2px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.24,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    filter: "blur(2px)",
    transition: {
      duration: 0.18,
      ease: [0.4, 0, 1, 1],
    },
  },
};

export const shakeVariants: Variants = {
  shake: {
    x: [0, -3, 3, -3, 3, 0],
    transition: { duration: 0.3 },
  },
};
