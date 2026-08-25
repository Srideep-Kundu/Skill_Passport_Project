import { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AuthPage } from "./AuthPage";
import { LiquidGlassButton } from "../components/ui/EditorialPrimitives";

export interface LandingPageProps {
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  defaultAuthOpen?: boolean;
}

export function LandingPage({ defaultAuthOpen = false }: LandingPageProps) {
  const prefersReducedMotion = useReducedMotion();
  const [authModalOpen, setAuthModalOpen] = useState(defaultAuthOpen);
  const [authRole, setAuthRole] = useState<"student" | "recruiter" | "academician" | "institution">("student");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeSection, setActiveSection] = useState<string>("home");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && authModalOpen) setAuthModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authModalOpen]);

  const openAuth = (mode: "login" | "register" = "login", role: "student" | "recruiter" | "academician" | "institution" = "student") => {
    setAuthMode(mode);
    setAuthRole(role);
    setAuthModalOpen(true);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#031322] text-white selection:bg-white/20 selection:text-white">
      {/* 1. HERO SECTION WITH FULLSCREEN BACKGROUND VIDEO */}
      <div className="relative min-h-screen w-full overflow-hidden flex flex-col justify-between">
        {/* Background Video */}
        <video
          autoPlay={!prefersReducedMotion}
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover z-0"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
        />

        {/* Subtle Dark Vignette for Typography Readability */}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-[#031322]/80 via-transparent to-[#031322]" />

        {/* Glassmorphic Navigation Bar */}
        <nav className="relative z-20 flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-8 mx-auto">
          <div className="flex items-center gap-3">
            <a
              href="#home"
              className="text-2xl sm:text-3xl tracking-tight text-white font-normal cursor-pointer"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Skill Passport<sup className="text-xs font-mono ml-0.5 opacity-80">®</sup>
            </a>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-normal text-neutral-400">
            <a
              href="#problem"
              onClick={() => setActiveSection("problem")}
              className={`transition-colors hover:text-white ${activeSection === "problem" ? "text-white" : ""}`}
            >
              The Problem
            </a>
            <a
              href="#pipeline"
              onClick={() => setActiveSection("pipeline")}
              className={`transition-colors hover:text-white ${activeSection === "pipeline" ? "text-white" : ""}`}
            >
              Verification Engine
            </a>
            <a
              href="#matching"
              onClick={() => setActiveSection("matching")}
              className={`transition-colors hover:text-white ${activeSection === "matching" ? "text-white" : ""}`}
            >
              Explainable Matching
            </a>
            <a
              href="#ecosystem"
              onClick={() => setActiveSection("ecosystem")}
              className={`transition-colors hover:text-white ${activeSection === "ecosystem" ? "text-white" : ""}`}
            >
              Ecosystem
            </a>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="text-xs sm:text-sm text-neutral-300 hover:text-white px-3 py-1.5 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <LiquidGlassButton size="sm" onClick={() => openAuth("register")}>
              Begin Journey
            </LiquidGlassButton>
          </div>
        </nav>

        {/* Cinematic Centered Hero Content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center px-6 py-20 max-w-5xl mx-auto my-auto">
          <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-400 animate-fade-rise">
            VERIFIABLE PROFESSIONAL IDENTITY & MATCHING
          </div>

          <h1
            className="text-5xl sm:text-7xl md:text-8xl leading-[0.95] tracking-[-2.46px] max-w-5xl font-normal text-white animate-fade-rise"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Where evidence becomes <em className="not-italic text-neutral-400">opportunity.</em>
          </h1>

          <p className="mt-8 max-w-2xl text-base sm:text-lg leading-relaxed text-neutral-300 font-normal animate-fade-rise-delay">
            We build digital verification systems for deep thinkers, engineers, and quiet innovators. Transform code repositories, resumes, and assessments into evidence-linked skill records with explainable, deterministic matching.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 animate-fade-rise-delay-2">
            <LiquidGlassButton size="lg" onClick={() => openAuth("register")}>
              Begin Journey
            </LiquidGlassButton>
            <a
              href="#pipeline"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base text-neutral-300 backdrop-blur-xs transition-all hover:border-white/40 hover:text-white cursor-pointer"
            >
              Explore Verification
            </a>
          </div>
        </div>

        {/* Subtle Bottom Status Bar */}
        <div className="relative z-10 border-t border-white/10 px-8 py-4 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-neutral-400 gap-2">
          <span>DETERMINISTIC COMPUTE ENGINE · PERSISTED FORMULA VERSION</span>
          <span>PGVECTOR COSINE EMBEDDINGS + EVIDENCE PROVENANCE</span>
        </div>
      </div>

      {/* 2. SECTION 01: THE PROBLEM */}
      <section id="problem" className="relative z-10 border-b border-white/10 px-6 py-28 sm:px-12 max-w-7xl mx-auto">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
          SECTION 01 / RECRUITMENT CRISIS
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-6">
            <h2
              className="text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Claims are easy. <br />
              <em className="not-italic text-neutral-400">Evidence is harder.</em>
            </h2>
          </div>
          <div className="lg:col-span-6 space-y-6 text-neutral-300 text-sm sm:text-base leading-relaxed">
            <p>
              Traditional hiring relies on unverified resume claims, self-declared buzzwords, and opaque AI screeners that discard qualified talent or introduce demographic proxy bias.
            </p>
            <p>
              Skill Passport replaces resume noise with an auditable evidence graph. Every technical competency claimed by a student is anchored to concrete source artifacts: GitHub commit histories, verified project repositories, diagnostic assessments, and certification records.
            </p>
            <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-6 font-mono text-xs">
              <div>
                <div className="text-white text-2xl font-normal" style={{ fontFamily: "var(--font-display)" }}>
                  0%
                </div>
                <div className="text-neutral-400 mt-1 uppercase">Black-Box LLM Scoring</div>
              </div>
              <div>
                <div className="text-white text-2xl font-normal" style={{ fontFamily: "var(--font-display)" }}>
                  100%
                </div>
                <div className="text-neutral-400 mt-1 uppercase">Evidence Provenance</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SECTION 02: EVIDENCE TO SKILL PIPELINE */}
      <section id="pipeline" className="relative z-10 border-b border-white/10 px-6 py-28 sm:px-12 max-w-7xl mx-auto">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
          SECTION 02 / PROVENANCE ARCHITECTURE
        </div>
        <h2
          className="text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight text-white mb-16"
          style={{ fontFamily: "var(--font-display)" }}
        >
          From raw artifacts to <em className="not-italic text-neutral-400">verifiable skills.</em>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="border-t border-white/20 pt-6">
            <div className="font-mono text-xs text-neutral-400 mb-3">01 / SUBMISSION</div>
            <h3 className="text-xl font-normal text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Raw Evidence Ingestion
            </h3>
            <p className="text-xs leading-relaxed text-neutral-400">
              PDF resumes, LinkedIn archive exports, GitHub commit audits, and technical assessment records stored securely with SHA-256 fingerprints.
            </p>
          </div>

          <div className="border-t border-white/20 pt-6">
            <div className="font-mono text-xs text-neutral-400 mb-3">02 / EXTRACTION</div>
            <h3 className="text-xl font-normal text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Structured Schema Extraction
            </h3>
            <p className="text-xs leading-relaxed text-neutral-400">
              Async Redis workers extract explicit technical competencies with exact text span evidence, strictly bounded against hallucination.
            </p>
          </div>

          <div className="border-t border-white/20 pt-6">
            <div className="font-mono text-xs text-neutral-400 mb-3">03 / NORMALIZATION</div>
            <h3 className="text-xl font-normal text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Canonical Taxonomy
            </h3>
            <p className="text-xs leading-relaxed text-neutral-400">
              Extracted labels are mapped into canonical skill entities with pgvector semantic embeddings, normalizing aliases across languages and frameworks.
            </p>
          </div>

          <div className="border-t border-white/20 pt-6">
            <div className="font-mono text-xs text-neutral-400 mb-3">04 / VERIFICATION</div>
            <h3 className="text-xl font-normal text-white mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Tiered Verification Multiplier
            </h3>
            <p className="text-xs leading-relaxed text-neutral-400">
              Tier multipliers scale effective confidence: Verified (1.00x), Partially Verified (0.85x), and Unverified (0.65x).
            </p>
          </div>
        </div>
      </section>

      {/* 4. SECTION 03: EXPLAINABLE DETERMINISTIC MATCHING */}
      <section id="matching" className="relative z-10 border-b border-white/10 px-6 py-28 sm:px-12 max-w-7xl mx-auto">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
          SECTION 03 / DETERMINISTIC COMPUTATION
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <h2
              className="text-4xl sm:text-5xl font-normal leading-[1.05] tracking-tight text-white mb-6"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Auditable scoring. <br />
              <em className="not-italic text-neutral-400">Zero black-box decisions.</em>
            </h2>
            <p className="text-sm leading-relaxed text-neutral-300 mb-6">
              Our matching pipeline is a pure mathematical calculation. Every match score is broken down into three verifiable scoring components persisted directly to the database.
            </p>
            <div className="p-4 rounded-md border border-white/10 bg-[#061524]/60 font-mono text-xs text-neutral-300">
              <div className="text-neutral-400 mb-2 font-semibold">// SCORING SPECIFICATION</div>
              <div className="text-white">final_score = clamp(0.65 * D + 0.25 * S + 0.10 * V, 0, 1)</div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4 font-mono text-xs">
            <div className="border border-white/10 p-5 rounded-md bg-[#061524]/40">
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>D = EXACT OVERLAP</span>
                <span className="text-white">65% WEIGHT</span>
              </div>
              <p className="text-neutral-300 font-sans text-xs">
                Weighted intersection of required canonical skills possessed by candidate with effective confidence weighting.
              </p>
            </div>

            <div className="border border-white/10 p-5 rounded-md bg-[#061524]/40">
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>S = SEMANTIC SIMILARITY</span>
                <span className="text-white">25% WEIGHT</span>
              </div>
              <p className="text-neutral-300 font-sans text-xs">
                Cosine distance across unmatched required skills using 768-dim taxonomy embeddings, with similarity below 0.75 clamped to zero.
              </p>
            </div>

            <div className="border border-white/10 p-5 rounded-md bg-[#061524]/40">
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>V = VERIFICATION ADJUSTMENT</span>
                <span className="text-white">10% WEIGHT</span>
              </div>
              <p className="text-neutral-300 font-sans text-xs">
                Independent adjustment derived from the persisted verification tiers of matched, evidence-backed skills.
              </p>
            </div>

            <div className="border border-white/10 p-5 rounded-md bg-[#061524]/40">
              <div className="flex justify-between text-neutral-400 mb-1">
                <span>FAIRNESS GUARANTEE</span>
                <span className="text-white">RESTRICTED VIEW</span>
              </div>
              <p className="text-neutral-300 font-sans text-xs">
                Protected attributes (name, gender, age, college tier, GPA) are physically excluded from the matching query via restricted PostgreSQL view.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. SECTION 04: FOUR-PERSONA ECOSYSTEM */}
      <section id="ecosystem" className="relative z-10 border-b border-white/10 px-6 py-28 sm:px-12 max-w-7xl mx-auto">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-neutral-400">
          SECTION 04 / COLLABORATIVE ECOSYSTEM
        </div>
        <h2
          className="text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight text-white mb-16"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Built for the entire <em className="not-italic text-neutral-400">academic-industry lifecycle.</em>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="border border-white/10 p-6 rounded-md bg-[#061524]/40 flex flex-col justify-between h-full">
            <div>
              <div className="font-mono text-xs text-neutral-400 mb-2">01 / CANDIDATES</div>
              <h3 className="text-2xl font-normal text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>
                Student
              </h3>
              <p className="text-xs leading-relaxed text-neutral-400 mb-6 font-sans">
                Build an undeniable, evidence-backed skill dossier. Discover matched internships, identify skill gaps, and form complementary project teams.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAuth("register", "student")}
              className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white text-left transition-colors cursor-pointer"
            >
              Enter as Student →
            </button>
          </div>

          <div className="border border-white/10 p-6 rounded-md bg-[#061524]/40 flex flex-col justify-between h-full">
            <div>
              <div className="font-mono text-xs text-neutral-400 mb-2">02 / HIRING</div>
              <h3 className="text-2xl font-normal text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>
                Recruiter
              </h3>
              <p className="text-xs leading-relaxed text-neutral-400 mb-6 font-sans">
                Post technical internships with weighted requirements. Review ranked candidates with full mathematical score breakdowns and verified evidence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAuth("register", "recruiter")}
              className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white text-left transition-colors cursor-pointer"
            >
              Enter as Recruiter →
            </button>
          </div>

          <div className="border border-white/10 p-6 rounded-md bg-[#061524]/40 flex flex-col justify-between h-full">
            <div>
              <div className="font-mono text-xs text-neutral-400 mb-2">03 / SCHOLARS</div>
              <h3 className="text-2xl font-normal text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>
                Faculty
              </h3>
              <p className="text-xs leading-relaxed text-neutral-400 mb-6 font-sans">
                Engage in industrial training, submit R&D grant proposals, manage joint student research workspaces, and advise student project capstones.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAuth("register", "academician")}
              className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white text-left transition-colors cursor-pointer"
            >
              Enter as Faculty →
            </button>
          </div>

          <div className="border border-white/10 p-6 rounded-md bg-[#061524]/40 flex flex-col justify-between h-full">
            <div>
              <div className="font-mono text-xs text-neutral-400 mb-2">04 / LEADERSHIP</div>
              <h3 className="text-2xl font-normal text-white mb-3" style={{ fontFamily: "var(--font-display)" }}>
                Institution
              </h3>
              <p className="text-xs leading-relaxed text-neutral-400 mb-6 font-sans">
                Real-time institutional intelligence: cohort readiness, curriculum gap analysis, placement outcome funnels, and corporate partnership tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAuth("register", "institution")}
              className="text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white text-left transition-colors cursor-pointer"
            >
              Enter as Institution →
            </button>
          </div>
        </div>
      </section>

      {/* 6. CLOSING CTA & FOOTER */}
      <footer className="relative z-10 px-6 py-24 sm:px-12 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2
            className="text-4xl sm:text-6xl font-normal leading-[1.0] text-white mb-6"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Ready to make your skills <em className="not-italic text-neutral-400">undeniable?</em>
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed mb-8">
            Build an evidence-backed Skill Passport from submitted records, or sign in to access your institutional workspace.
          </p>
          <LiquidGlassButton size="lg" onClick={() => openAuth("register")}>
            Begin Journey Now
          </LiquidGlassButton>
        </div>

        <div className="grid gap-4 border-t border-white/10 pt-8 md:grid-cols-3">
          <section id="privacy" className="border border-white/10 p-4 text-xs text-neutral-400">
            <h3 className="font-mono text-white">Privacy notice placeholder</h3>
            <p className="mt-2 leading-relaxed">A production privacy notice must document evidence retention, recruiter consent, and account-data controls before launch.</p>
          </section>
          <section id="terms" className="border border-white/10 p-4 text-xs text-neutral-400">
            <h3 className="font-mono text-white">Terms placeholder</h3>
            <p className="mt-2 leading-relaxed">Production terms must define account responsibilities, evidence ownership, and acceptable platform use before launch.</p>
          </section>
          <section id="security" className="border border-white/10 p-4 text-xs text-neutral-400">
            <h3 className="font-mono text-white">Security overview</h3>
            <p className="mt-2 leading-relaxed">Authentication, role-based access, evidence provenance, and restricted matching inputs are enforced by the application API.</p>
          </section>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 font-mono gap-4">
          <div>
            © {new Date().getFullYear()} Skill Passport Platform. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="#privacy" className="hover:text-white transition-colors">Privacy placeholder</a>
            <a href="#terms" className="hover:text-white transition-colors">Terms placeholder</a>
            <a href="#security" className="hover:text-white transition-colors">Security Provenance</a>
          </div>
        </div>
      </footer>

      {/* AUTH MODAL */}
      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthModalOpen(false)}
              className="fixed inset-0 bg-[#031322]/85 backdrop-blur-md"
              aria-hidden="true"
            />

            {/* Modal Container */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-label="Authentication"
              className="relative z-10 w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl border border-white/15 bg-[#061524] shadow-2xl p-6 sm:p-8 text-white no-scrollbar"
            >
              <AuthPage
                isModal
                initialMode={authMode}
                initialRole={authRole}
                onClose={() => setAuthModalOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
