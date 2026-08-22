import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Role } from "../api";
import { LuminaWaves } from "./LuminaWaves";

interface WordItem {
  id: string;
  text: string;
  depth: "foreground" | "midground" | "background";
  type: "indigo" | "cyan" | "text" | "muted";
  origin: {
    x: number;
    y: number;
    rotate: number;
  };
  delay: number;
}

const STUDENT_WORDS: WordItem[] = [
  { id: "s-skills", text: "Skills", depth: "foreground", type: "indigo", origin: { x: -360, y: -90, rotate: -8 }, delay: 0.12 },
  { id: "s-evidence", text: "Evidence", depth: "foreground", type: "cyan", origin: { x: -320, y: 130, rotate: 6 }, delay: 0.16 },
  { id: "s-opps", text: "Opportunities", depth: "foreground", type: "indigo", origin: { x: 380, y: -80, rotate: 7 }, delay: 0.20 },
  { id: "s-intern", text: "Internships", depth: "midground", type: "text", origin: { x: 340, y: 110, rotate: -6 }, delay: 0.24 },
  { id: "s-verified", text: "Verified", depth: "foreground", type: "cyan", origin: { x: -50, y: -260, rotate: -5 }, delay: 0.28 },
  { id: "s-talent", text: "Talent", depth: "midground", type: "text", origin: { x: 140, y: -250, rotate: 6 }, delay: 0.32 },
  { id: "s-growth", text: "Growth", depth: "midground", type: "indigo", origin: { x: -100, y: 260, rotate: 5 }, delay: 0.36 },
  { id: "s-career", text: "Career", depth: "midground", type: "text", origin: { x: 90, y: 250, rotate: -6 }, delay: 0.40 },
  { id: "s-projects", text: "Projects", depth: "background", type: "muted", origin: { x: -310, y: -220, rotate: -9 }, delay: 0.44 },
  { id: "s-exp", text: "Experience", depth: "midground", type: "text", origin: { x: 300, y: -210, rotate: 8 }, delay: 0.48 },
  { id: "s-potential", text: "Potential", depth: "background", type: "muted", origin: { x: -270, y: 230, rotate: 7 }, delay: 0.52 },
  { id: "s-teams", text: "Teams", depth: "background", type: "muted", origin: { x: 280, y: 220, rotate: -7 }, delay: 0.56 },
];

const RECRUITER_WORDS: WordItem[] = [
  { id: "r-talent", text: "Talent", depth: "foreground", type: "indigo", origin: { x: -360, y: -80, rotate: -7 }, delay: 0.12 },
  { id: "r-skills", text: "Skills", depth: "foreground", type: "indigo", origin: { x: 370, y: -90, rotate: 6 }, delay: 0.16 },
  { id: "r-evidence", text: "Evidence", depth: "foreground", type: "cyan", origin: { x: -330, y: 120, rotate: 5 }, delay: 0.20 },
  { id: "r-candidates", text: "Candidates", depth: "foreground", type: "text", origin: { x: 350, y: 100, rotate: -6 }, delay: 0.24 },
  { id: "r-projects", text: "Projects", depth: "midground", type: "muted", origin: { x: -60, y: -260, rotate: -5 }, delay: 0.28 },
  { id: "r-verified", text: "Verified", depth: "foreground", type: "cyan", origin: { x: 110, y: -250, rotate: 7 }, delay: 0.32 },
  { id: "r-fit", text: "Fit", depth: "midground", type: "indigo", origin: { x: -90, y: 260, rotate: 4 }, delay: 0.36 },
  { id: "r-potential", text: "Potential", depth: "midground", type: "text", origin: { x: 120, y: 250, rotate: -5 }, delay: 0.40 },
  { id: "r-teams", text: "Teams", depth: "background", type: "muted", origin: { x: -290, y: -210, rotate: -8 }, delay: 0.44 },
  { id: "r-internships", text: "Internships", depth: "midground", type: "text", origin: { x: 290, y: 210, rotate: 8 }, delay: 0.48 },
];

const ACADEMICIAN_WORDS: WordItem[] = [
  { id: "a-research", text: "Research", depth: "foreground", type: "indigo", origin: { x: -360, y: -80, rotate: -7 }, delay: 0.12 },
  { id: "a-mentorship", text: "Mentorship", depth: "foreground", type: "cyan", origin: { x: 370, y: -90, rotate: 6 }, delay: 0.16 },
  { id: "a-sabbatical", text: "Sabbaticals", depth: "foreground", type: "indigo", origin: { x: -330, y: 120, rotate: 5 }, delay: 0.20 },
  { id: "a-grants", text: "Grants & FDP", depth: "foreground", type: "text", origin: { x: 350, y: 100, rotate: -6 }, delay: 0.24 },
  { id: "a-skills", text: "Skills", depth: "midground", type: "cyan", origin: { x: 110, y: -250, rotate: 7 }, delay: 0.32 },
  { id: "a-innovation", text: "Innovation", depth: "midground", type: "indigo", origin: { x: -90, y: 260, rotate: 4 }, delay: 0.36 },
];

const INSTITUTION_WORDS: WordItem[] = [
  { id: "i-analytics", text: "Analytics", depth: "foreground", type: "indigo", origin: { x: -360, y: -80, rotate: -7 }, delay: 0.12 },
  { id: "i-placements", text: "Placements", depth: "foreground", type: "cyan", origin: { x: 370, y: -90, rotate: 6 }, delay: 0.16 },
  { id: "i-outcomes", text: "Outcomes", depth: "foreground", type: "indigo", origin: { x: -330, y: 120, rotate: 5 }, delay: 0.20 },
  { id: "i-readiness", text: "Employability", depth: "foreground", type: "text", origin: { x: 350, y: 100, rotate: -6 }, delay: 0.24 },
  { id: "i-curriculum", text: "Curriculum", depth: "midground", type: "cyan", origin: { x: 110, y: -250, rotate: 7 }, delay: 0.32 },
  { id: "i-industry", text: "Industry Linkage", depth: "midground", type: "indigo", origin: { x: -90, y: 260, rotate: 4 }, delay: 0.36 },
];

function extractFirstName(email?: string): string {
  if (!email) return "";
  const namePart = email.split("@")[0] || "";
  const first = namePart.split(/[._-]/)[0];
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export interface PostLoginTransitionProps {
  role?: Role;
  userEmail?: string;
  displayName?: string;
  onComplete: () => void;
}

// Style helpers based on depth & color type
function getDepthStyle(depth: WordItem["depth"]) {
  switch (depth) {
    case "foreground":
      return "text-base sm:text-lg font-bold tracking-tight opacity-95";
    case "midground":
      return "text-xs sm:text-sm font-semibold tracking-normal opacity-85";
    case "background":
      return "text-[11px] sm:text-xs font-medium tracking-wide opacity-65 blur-[0.4px]";
  }
}

function getTypeColor(type: WordItem["type"]) {
  switch (type) {
    case "indigo":
      return "text-[#b0c6ff] drop-shadow-[0_0_12px_rgba(59,113,217,0.5)]";
    case "cyan":
      return "text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.4)]";
    case "text":
      return "text-[#f1f0e8]";
    case "muted":
      return "text-[#98a4b3]";
  }
}

export function PostLoginTransition({
  role = "student",
  userEmail,
  displayName,
  onComplete,
}: PostLoginTransitionProps) {
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState<"converging" | "resolved" | "exiting">("converging");

  const isStudent = role === "student";
  const words = useMemo(() => {
    if (role === "student") return STUDENT_WORDS;
    if (role === "academician") return ACADEMICIAN_WORDS;
    if (role === "institution") return INSTITUTION_WORDS;
    return RECRUITER_WORDS;
  }, [role]);

  const resolvedName = useMemo(() => {
    if (displayName) return displayName;
    return extractFirstName(userEmail);
  }, [displayName, userEmail]);

  useEffect(() => {
    if (prefersReduced) {
      const t1 = setTimeout(() => setPhase("resolved"), 100);
      const t2 = setTimeout(() => setPhase("exiting"), 1200);
      const t3 = setTimeout(() => onComplete(), 1500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }

    const tResolved = setTimeout(() => {
      setPhase("resolved");
    }, 1300);

    const tExiting = setTimeout(() => {
      setPhase("exiting");
    }, 4000);

    const tComplete = setTimeout(() => {
      onComplete();
    }, 4500);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " " || e.key === "Enter") {
        onComplete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(tResolved);
      clearTimeout(tExiting);
      clearTimeout(tComplete);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onComplete, prefersReduced]);

  return (
    <div
      role="region"
      aria-label="Post login transition"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#101319] text-[#f1f0e8] select-none font-sans"
    >
      {/* BACKGROUND LAYER: Lumina Intel Dark Midnight Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0e13] via-[#101319] to-[#151e29]" />

      {/* LUMINA WAVE ANIMATION FLOW */}
      {!prefersReduced && (
        <LuminaWaves opacity={0.65} speed={1.1} interactive={false} />
      )}

      {/* Atmospheric Haze and Soft Central Convergence Glow */}
      <motion.div
        initial={{ opacity: 0.25, scale: 0.8 }}
        animate={{
          opacity: phase === "resolved" ? 0.75 : 0.45,
          scale: phase === "resolved" ? 1.15 : 1,
        }}
        transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none absolute h-[540px] w-[540px] rounded-full bg-radial from-[#3b71d9]/25 via-[#b0c6ff]/10 to-transparent blur-3xl"
      />

      {/* Secondary subtle cyan/teal atmospheric aura */}
      <motion.div
        initial={{ opacity: 0.15 }}
        animate={{ opacity: phase === "resolved" ? 0.4 : 0.2 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-12 h-96 w-96 rounded-full bg-radial from-[#38bdf8]/15 via-[#3b71d9]/5 to-transparent blur-3xl"
      />

      {/* Ambient Micro-Particles */}
      {!prefersReduced && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30">
          {[
            { top: "20%", left: "15%", d: 18, size: 2 },
            { top: "25%", right: "20%", d: 22, size: 3 },
            { bottom: "30%", left: "25%", d: 20, size: 2 },
            { bottom: "20%", right: "18%", d: 24, size: 2.5 },
            { top: "60%", left: "12%", d: 16, size: 2 },
            { top: "45%", right: "14%", d: 21, size: 3 },
          ].map((pt, i) => (
            <motion.div
              key={i}
              style={{
                top: pt.top,
                left: pt.left,
                right: pt.right,
                bottom: pt.bottom,
                width: pt.size,
                height: pt.size,
              }}
              animate={{
                y: [0, -14, 10, 0],
                x: [0, 8, -6, 0],
                opacity: [0.2, 0.6, 0.3, 0.2],
              }}
              transition={{
                duration: pt.d,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute rounded-full bg-[#b0c6ff]"
            />
          ))}
        </div>
      )}

      {/* STAGES 2–5: INCOMING WORDS CONVERGING WITH ANTIGRAVITY DRIFT */}
      {!prefersReduced && phase === "converging" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {words.map((word) => (
            <motion.div
              key={word.id}
              initial={{
                x: word.origin.x,
                y: word.origin.y,
                rotate: word.origin.rotate,
                opacity: 0,
                scale: word.depth === "foreground" ? 1.05 : word.depth === "midground" ? 0.95 : 0.82,
              }}
              animate={{
                x: [word.origin.x, word.origin.x * 0.35, 0],
                y: [word.origin.y, word.origin.y * 0.35, 0],
                rotate: [word.origin.rotate, word.origin.rotate * 0.3, 0],
                opacity: [0, 0.85, 0.95, 0],
                scale: [
                  word.depth === "foreground" ? 1.05 : 0.95,
                  word.depth === "foreground" ? 1.0 : 0.9,
                  0.45,
                ],
                filter: ["blur(0px)", "blur(0px)", "blur(3px)"],
              }}
              transition={{
                duration: 1.45,
                delay: word.delay,
                times: [0, 0.65, 1],
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`absolute flex items-center justify-center whitespace-nowrap px-3 py-1.5 ${getDepthStyle(
                word.depth,
              )} ${getTypeColor(word.type)}`}
            >
              {word.text}
            </motion.div>
          ))}

          {/* Central Magnetic Bloom Pulse */}
          <motion.div
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{
              scale: [0.3, 1.4, 0.9],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 0.6,
              delay: 1.35,
              ease: "easeOut",
            }}
            className="absolute h-40 w-40 rounded-full bg-radial from-[#3b71d9]/40 via-[#b0c6ff]/20 to-transparent blur-xl"
          />
        </div>
      )}

      {/* STAGE 6: FINAL UNIFIED MESSAGE */}
      <AnimatePresence>
        {(phase === "resolved" || phase === "exiting") && (
          <motion.div
            key="final-message"
            initial={{ opacity: 0, scale: 0.94, y: 8, filter: "blur(5px)" }}
            animate={{
              opacity: phase === "exiting" ? 0 : 1,
              scale: phase === "exiting" ? 0.98 : 1,
              y: phase === "exiting" ? -6 : 0,
              filter: phase === "exiting" ? "blur(2px)" : "blur(0px)",
            }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{
              duration: phase === "exiting" ? 0.32 : 0.48,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="relative z-10 mx-auto max-w-xl px-6 text-center"
          >
            {/* Optional Personalized Greeting */}
            {isStudent && resolvedName ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="mb-2.5 text-xs sm:text-sm font-semibold tracking-widest text-[#b0c6ff] uppercase"
              >
                Welcome back, {resolvedName}
              </motion.p>
            ) : (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="mb-2.5 text-xs sm:text-sm font-semibold tracking-widest text-[#b0c6ff] uppercase"
              >
                Welcome back
              </motion.p>
            )}

            {/* Primary Headline with Restrained Accent Emphasis */}
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#f1f0e8] leading-snug sm:leading-tight">
              {role === "student" ? (
                <>
                  Find <span className="text-[#3b71d9] font-black drop-shadow-[0_0_16px_rgba(59,113,217,0.5)]">opportunities</span> that fit you.
                </>
              ) : role === "academician" ? (
                <>
                  Empower <span className="text-[#3b71d9] font-black drop-shadow-[0_0_16px_rgba(59,113,217,0.5)]">academic excellence</span>.
                </>
              ) : role === "institution" ? (
                <>
                  Institutional <span className="text-[#3b71d9] font-black drop-shadow-[0_0_16px_rgba(59,113,217,0.5)]">intelligence</span>.
                </>
              ) : (
                <>
                  Find <span className="text-[#3b71d9] font-black drop-shadow-[0_0_16px_rgba(59,113,217,0.5)]">talent</span> that fits.
                </>
              )}
            </h1>

            {/* Supporting Subtitle with Source Serif 4 italic */}
            <p className="mt-3 text-xs sm:text-sm font-medium text-[#98a4b3] leading-relaxed max-w-md mx-auto">
              {role === "student"
                ? "Your verified skills are ready to work for you."
                : role === "academician"
                ? "Manage research grants, student mentorship, and industry sabbaticals."
                : role === "institution"
                ? "Track university placement analytics, skill distributions, and corporate linkages."
                : "Discover candidates through evidence-backed skills."}
            </p>

            {/* Subtle verification badge indicator */}
            <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[#dedbc8]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#dedbc8] animate-pulse"></span>
              <span>Verifiable match engine active</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Skip button in bottom corner */}
      <div className="absolute bottom-5 right-5 z-20">
        <button
          type="button"
          onClick={() => onComplete()}
          className="rounded-lg px-3 py-1.5 text-[11px] font-medium text-[#98a4b3] hover:text-[#f1f0e8] bg-[#151e29]/60 hover:bg-[#151e29] border border-white/[0.08] transition-all cursor-pointer backdrop-blur-xs"
        >
          Skip (Esc)
        </button>
      </div>
    </div>
  );
}
