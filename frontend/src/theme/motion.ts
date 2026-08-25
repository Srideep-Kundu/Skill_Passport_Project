// Centralized Motion Design Tokens for Skill Passport
// Coordinated Cinematic Page Entry, Light Arriving, and Tab Transitions
import type { Variants, Transition } from "framer-motion";

export const MOTION_DURATIONS = {
  micro: 0.18,
  fast: 0.28,
  normal: 0.45,
  slow: 0.60,
  pageEntry: 0.55,
  tabTransition: 0.32,
  sidebarIndicator: 0.35,
  metricCount: 0.65,
} as const;

export const MOTION_EASINGS = {
  standard: [0.16, 1, 0.3, 1] as const,
  gentle: [0.22, 1, 0.36, 1] as const,
  exit: [0.4, 0, 0.2, 1] as const,
};

// Synchronized sidebar navigation active indicator transition
export const sidebarIndicatorTransition: Transition = {
  duration: MOTION_DURATIONS.sidebarIndicator,
  ease: [0.22, 1, 0.36, 1],
};

// ==================================================
// 🌟 COORDINATED PAGE ENTRY SEQUENCE
// Eyebrow -> Title -> Meta -> Content (stagger 60ms)
// ==================================================
export const pageContainerVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.24,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export const pageEyebrowVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: "brightness(0.92)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "brightness(1)",
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

export const pageTitleVariants: Variants = {
  initial: { opacity: 0, y: 18, filter: "brightness(0.90)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "brightness(1)",
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
};

export const pageMetaVariants: Variants = {
  initial: { opacity: 0, y: 14, filter: "brightness(0.92)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "brightness(1)",
    transition: { duration: 0.48, ease: [0.16, 1, 0.3, 1] },
  },
};

export const pageContentVariants: Variants = {
  initial: { opacity: 0, y: 20, filter: "brightness(0.92)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "brightness(1)",
    transition: { duration: 0.60, ease: [0.16, 1, 0.3, 1] },
  },
};

// ==================================================
// 🌟 TAB / ROUTE LIGHT-ARRIVING TRANSITION
// ==================================================
export const tabContentVariants: Variants = {
  initial: {
    opacity: 0,
    y: 14,
    filter: "brightness(0.92)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "brightness(1)",
    transition: {
      duration: 0.32,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.22,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export const hybridCenterVariants: Variants = tabContentVariants;
export const crossfadePageVariants: Variants = tabContentVariants;
export const diagonalPageVariants: Variants = tabContentVariants;
export const spatialPageVariants: Variants = tabContentVariants;
export const pageCollapseFormVariants: Variants = tabContentVariants;

// Accessibility Reduced Motion (Immediate gentle fade without translate/brightness)
export const reducedMotionVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.12,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.10,
      ease: "easeIn",
    },
  },
};

export const pageAssemblyItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.38,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

export const typewriterCardVariants: Variants = pageAssemblyItemVariants;
export const typewriterItemVariants: Variants = pageAssemblyItemVariants;

export const containerStaggerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

export const cardItemVariants: Variants = typewriterItemVariants;

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.98, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.26,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 6,
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
