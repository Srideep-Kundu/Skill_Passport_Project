import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { Role } from "../api";

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
  { id: "s-skills", text: "Skills", depth: "foreground", type: "indigo", origin: { x: -320, y: -80, rotate: -6 }, delay: 0.1 },
  { id: "s-evidence", text: "Evidence", depth: "foreground", type: "cyan", origin: { x: -280, y: 110, rotate: 4 }, delay: 0.15 },
  { id: "s-opps", text: "Opportunities", depth: "foreground", type: "indigo", origin: { x: 340, y: -70, rotate: 5 }, delay: 0.18 },
  { id: "s-intern", text: "Internships", depth: "midground", type: "text", origin: { x: 300, y: 100, rotate: -5 }, delay: 0.22 },
  { id: "s-verified", text: "Verified", depth: "foreground", type: "cyan", origin: { x: -40, y: -220, rotate: -4 }, delay: 0.25 },
  { id: "s-talent", text: "Talent", depth: "midground", type: "text", origin: { x: 120, y: -210, rotate: 5 }, delay: 0.28 },
  { id: "s-growth", text: "Growth", depth: "midground", type: "indigo", origin: { x: -80, y: 220, rotate: 4 }, delay: 0.32 },
  { id: "s-career", text: "Career", depth: "midground", type: "text", origin: { x: 80, y: 210, rotate: -5 }, delay: 0.35 },
  { id: "s-projects", text: "Projects", depth: "background", type: "muted", origin: { x: -270, y: -190, rotate: -7 }, delay: 0.38 },
  { id: "s-exp", text: "Experience", depth: "midground", type: "text", origin: { x: 260, y: -180, rotate: 6 }, delay: 0.42 },
  { id: "s-potential", text: "Potential", depth: "background", type: "muted", origin: { x: -230, y: 190, rotate: 5 }, delay: 0.45 },
  { id: "s-teams", text: "Teams", depth: "background", type: "muted", origin: { x: 240, y: 180, rotate: -6 }, delay: 0.48 },
];

const RECRUITER_WORDS: WordItem[] = [
  { id: "r-talent", text: "Talent", depth: "foreground", type: "indigo", origin: { x: -320, y: -70, rotate: -6 }, delay: 0.1 },
  { id: "r-skills", text: "Skills", depth: "foreground", type: "indigo", origin: { x: 330, y: -80, rotate: 5 }, delay: 0.15 },
  { id: "r-evidence", text: "Evidence", depth: "foreground", type: "cyan", origin: { x: -290, y: 100, rotate: 4 }, delay: 0.18 },
  { id: "r-candidates", text: "Candidates", depth: "foreground", type: "text", origin: { x: 310, y: 90, rotate: -5 }, delay: 0.22 },
  { id: "r-projects", text: "Projects", depth: "midground", type: "muted", origin: { x: -50, y: -220, rotate: -4 }, delay: 0.25 },
  { id: "r-verified", text: "Verified", depth: "foreground", type: "cyan", origin: { x: 100, y: -210, rotate: 6 }, delay: 0.28 },
  { id: "r-fit", text: "Fit", depth: "midground", type: "indigo", origin: { x: -80, y: 220, rotate: 3 }, delay: 0.32 },
  { id: "r-potential", text: "Potential", depth: "midground", type: "text", origin: { x: 100, y: 210, rotate: -4 }, delay: 0.35 },
  { id: "r-teams", text: "Teams", depth: "background", type: "muted", origin: { x: -250, y: -180, rotate: -7 }, delay: 0.38 },
  { id: "r-internships", text: "Internships", depth: "midground", type: "text", origin: { x: 250, y: 180, rotate: 7 }, delay: 0.42 },
];

const ACADEMICIAN_WORDS: WordItem[] = [
  { id: "a-research", text: "Research", depth: "foreground", type: "indigo", origin: { x: -320, y: -70, rotate: -6 }, delay: 0.1 },
  { id: "a-mentorship", text: "Mentorship", depth: "foreground", type: "cyan", origin: { x: 330, y: -80, rotate: 5 }, delay: 0.15 },
  { id: "a-sabbatical", text: "Sabbaticals", depth: "foreground", type: "indigo", origin: { x: -290, y: 100, rotate: 4 }, delay: 0.18 },
  { id: "a-grants", text: "Grants & FDP", depth: "foreground", type: "text", origin: { x: 310, y: 90, rotate: -5 }, delay: 0.22 },
  { id: "a-skills", text: "Skills", depth: "midground", type: "cyan", origin: { x: 100, y: -210, rotate: 6 }, delay: 0.28 },
  { id: "a-innovation", text: "Innovation", depth: "midground", type: "indigo", origin: { x: -80, y: 220, rotate: 3 }, delay: 0.32 },
];

const INSTITUTION_WORDS: WordItem[] = [
  { id: "i-analytics", text: "Analytics", depth: "foreground", type: "indigo", origin: { x: -320, y: -70, rotate: -6 }, delay: 0.1 },
  { id: "i-placements", text: "Placements", depth: "foreground", type: "cyan", origin: { x: 330, y: -80, rotate: 5 }, delay: 0.15 },
  { id: "i-outcomes", text: "Outcomes", depth: "foreground", type: "indigo", origin: { x: -290, y: 100, rotate: 4 }, delay: 0.18 },
  { id: "i-readiness", text: "Employability", depth: "foreground", type: "text", origin: { x: 310, y: 90, rotate: -5 }, delay: 0.22 },
  { id: "i-curriculum", text: "Curriculum", depth: "midground", type: "cyan", origin: { x: 100, y: -210, rotate: 6 }, delay: 0.28 },
  { id: "i-industry", text: "Industry Linkage", depth: "midground", type: "indigo", origin: { x: -80, y: 220, rotate: 3 }, delay: 0.32 },
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#031322] text-white select-none"
    >
      {/* Background Subtle Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#031322] via-[#061524] to-[#031322]" />

      {/* Floating incoming terms with subtle motion */}
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
              }}
              animate={{
                x: [word.origin.x, word.origin.x * 0.3, 0],
                y: [word.origin.y, word.origin.y * 0.3, 0],
                rotate: [word.origin.rotate, 0],
                opacity: [0, 0.7, 0],
              }}
              transition={{
                duration: 1.3,
                delay: word.delay,
                ease: "easeOut",
              }}
              className="absolute font-mono text-xs uppercase tracking-widest text-neutral-400"
            >
              {word.text}
            </motion.div>
          ))}
        </div>
      )}

      {/* Resolved Statement */}
      <AnimatePresence>
        {(phase === "resolved" || phase === "exiting") && (
          <motion.div
            key="final-message"
            initial={{ opacity: 0, y: 16 }}
            animate={{
              opacity: phase === "exiting" ? 0 : 1,
              y: phase === "exiting" ? -8 : 0,
            }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative z-10 mx-auto max-w-2xl px-6 text-center"
          >
            <p className="mb-3 font-mono text-xs uppercase tracking-widest text-neutral-400">
              {isStudent && resolvedName ? `Welcome back, ${resolvedName}` : "Welcome back"}
            </p>

            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {role === "student" ? (
                <>
                  Find <em className="not-italic text-neutral-400">opportunities</em> that fit you.
                </>
              ) : role === "academician" ? (
                <>
                  Empower <em className="not-italic text-neutral-400">academic excellence</em>.
                </>
              ) : role === "institution" ? (
                <>
                  Institutional <em className="not-italic text-neutral-400">intelligence</em>.
                </>
              ) : (
                <>
                  Find <em className="not-italic text-neutral-400">talent</em> that fits.
                </>
              )}
            </h1>

            <p className="mt-4 text-sm font-normal text-neutral-300 leading-relaxed max-w-md mx-auto">
              {role === "student"
                ? "Your verified skills are ready to work for you."
                : role === "academician"
                ? "Manage research grants, student mentorship, and industry sabbaticals."
                : role === "institution"
                ? "Track university placement analytics, skill distributions, and corporate linkages."
                : "Discover candidates through evidence-backed skills."}
            </p>

            <div className="mt-8 inline-flex items-center gap-2 border border-white/10 px-3 py-1 rounded-sm font-mono text-[11px] uppercase tracking-wider text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              <span>Verifiable compute engine active</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip action */}
      <div className="absolute bottom-6 right-6 z-20">
        <button
          type="button"
          onClick={() => onComplete()}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs text-neutral-400 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
        >
          Skip (Esc)
        </button>
      </div>
    </div>
  );
}
