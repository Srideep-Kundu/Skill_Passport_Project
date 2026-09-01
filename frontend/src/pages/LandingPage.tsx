import { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AuthPage } from "./AuthPage";

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

  const openAuth = (
    mode: "login" | "register" = "login",
    role: "student" | "recruiter" | "academician" | "institution" = "student"
  ) => {
    setAuthMode(mode);
    setAuthRole(role);
    setAuthModalOpen(true);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#021A2F] dark:bg-[#0B0F17] text-[#FFFFFF] selection:bg-[#FFFFFF] selection:text-[#0B0F17] font-['Inter',sans-serif] transition-colors duration-250">
      {/* ========================================================================= */}
      {/* 1. CINEMATIC EDITORIAL HERO SECTION                                       */}
      {/* ========================================================================= */}
      <div className="relative min-h-screen w-full overflow-hidden flex flex-col justify-between">
        {/* Fullscreen Looping Background Video */}
        <video
          autoPlay={!prefersReducedMotion}
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover z-0 opacity-90 dark:opacity-40 transition-opacity duration-300 pointer-events-none"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
        />

        {/* Subtle Dark Legibility Overlay (Alpha 0.2) */}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-black/20 dark:bg-black/45 transition-colors duration-300" />

        {/* 3-Column Distributed Navigation Bar */}
        <header className="relative z-20 w-full">
          <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-8 py-6">
            {/* Left Column: Brand logo in Instrument Serif */}
            <div className="flex items-center justify-start">
              <a
                href="#home"
                className="text-[30px] font-normal tracking-tight text-white leading-none flex items-center select-none"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Velorah<sup className="text-xs font-mono ml-0.5 text-slate-300">®</sup>
              </a>
            </div>

            {/* Center Column: 5 Nav Links */}
            <div className="hidden md:flex items-center justify-center gap-10 text-sm font-medium text-slate-300">
              <a
                href="#home"
                onClick={() => setActiveSection("home")}
                className={`transition-colors hover:text-white ${activeSection === "home" ? "text-white font-semibold" : ""}`}
              >
                Home
              </a>
              <a
                href="#problem"
                onClick={() => setActiveSection("problem")}
                className={`transition-colors hover:text-white ${activeSection === "problem" ? "text-white font-semibold" : ""}`}
              >
                Studio
              </a>
              <a
                href="#pipeline"
                onClick={() => setActiveSection("pipeline")}
                className={`transition-colors hover:text-white ${activeSection === "pipeline" ? "text-white font-semibold" : ""}`}
              >
                About
              </a>
              <a
                href="#matching"
                onClick={() => setActiveSection("matching")}
                className={`transition-colors hover:text-white ${activeSection === "matching" ? "text-white font-semibold" : ""}`}
              >
                Journal
              </a>
              <a
                href="#ecosystem"
                onClick={() => setActiveSection("ecosystem")}
                className={`transition-colors hover:text-white ${activeSection === "ecosystem" ? "text-white font-semibold" : ""}`}
              >
                Reach Us
              </a>
            </div>

            {/* Right Column: Sign In + Liquid Glass CTA */}
            <div className="flex items-center justify-end gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => openAuth("login")}
                className="text-sm font-medium text-slate-200 hover:text-white px-2 py-1.5 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => openAuth("register")}
                className="liquid-glass rounded-full px-6 py-2.5 text-sm text-white hover:scale-[1.03] transition-all duration-200 cursor-pointer font-medium"
              >
                Begin Journey
              </button>
            </div>
          </nav>
        </header>

        {/* Hero Section: Vertically & Horizontally Centered */}
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center text-center px-6 pt-24 pb-32 max-w-7xl mx-auto my-auto w-full">
          {/* Staggered Entrance 01: H1 */}
          <div className="animate-fade-rise flex flex-col items-center">
            <h1
              className="text-5xl sm:text-7xl md:text-8xl leading-[0.95] tracking-[-2.46px] max-w-7xl font-normal text-white text-balance"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Where <em className="not-italic text-slate-300">dreams</em> rise <em className="not-italic text-slate-300">through the silence.</em>
            </h1>
          </div>

          {/* Staggered Entrance 02: Paragraph */}
          <p
            className="animate-fade-rise-delay mt-8 max-w-2xl text-base sm:text-lg font-normal leading-relaxed text-slate-300 text-balance"
          >
            We're designing tools for deep thinkers, bold creators, and quiet rebels. Amid the chaos, we build digital spaces for sharp focus and inspired work.
          </p>

          {/* Staggered Entrance 03: Main CTA Button */}
          <div className="animate-fade-rise-delay-2 mt-12 flex items-center justify-center">
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="liquid-glass rounded-full px-14 py-5 text-base text-white hover:scale-[1.03] shadow-2xl transition-all duration-200 cursor-pointer font-medium"
            >
              Begin Journey
            </button>
          </div>
        </main>

        {/* Bottom Editorial Status Bar */}
        <div className="relative z-10 border-t border-white/10 px-8 py-4 max-w-7xl mx-auto w-full flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-300 gap-2">
          <span>DETERMINISTIC COMPUTE ENGINE · PERSISTED FORMULA VERSION</span>
          <span>PGVECTOR COSINE EMBEDDINGS + EVIDENCE PROVENANCE</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SECTION 01: THE RECRUITMENT CRISIS (WARM EDITORIAL LUXURY)             */}
      {/* ========================================================================= */}
      <section id="problem" className="relative z-10 bg-[#F7F5F0] border-b border-[#E5E1D8] px-6 py-28 sm:px-12">
        <div className="max-w-[1280px] mx-auto">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
            SECTION 01 / RECRUITMENT CRISIS
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-6">
              <h2 className="font-['Inter',sans-serif] text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight text-[#111827]">
                Claims are easy. <br />
                <em className="not-italic text-[#475569]">Evidence is harder.</em>
              </h2>
            </div>
            <div className="lg:col-span-6 space-y-6 text-[#475569] text-sm sm:text-base leading-relaxed">
              <p>
                Traditional hiring relies on unverified resume claims, self-declared buzzwords, and opaque AI screeners that discard qualified talent or introduce demographic proxy bias.
              </p>
              <p>
                Lumina Intel replaces resume noise with an auditable evidence graph. Every technical competency claimed by a student is anchored to concrete source artifacts: GitHub commit histories, verified project repositories, diagnostic assessments, and certification records.
              </p>
              <div className="pt-6 border-t border-[#E5E1D8] grid grid-cols-2 gap-6 font-mono text-xs">
                <div className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-[16px] p-5 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
                  <div className="font-['Inter',sans-serif] text-[#111827] text-3xl font-normal">
                    0%
                  </div>
                  <div className="text-[#64748B] mt-1 uppercase text-[11px] tracking-wide">Black-Box LLM Scoring</div>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-[16px] p-5 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
                  <div className="font-['Inter',sans-serif] text-[#111827] text-3xl font-normal">
                    100%
                  </div>
                  <div className="text-[#64748B] mt-1 uppercase text-[11px] tracking-wide">Evidence Provenance</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. SECTION 02: EVIDENCE TO SKILL PIPELINE                                 */}
      {/* ========================================================================= */}
      <section id="pipeline" className="relative z-10 bg-[#FFFFFF] border-b border-[#E5E1D8] px-6 py-28 sm:px-12">
        <div className="max-w-[1280px] mx-auto">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
            SECTION 02 / PROVENANCE ARCHITECTURE
          </div>
          <h2 className="font-['Inter',sans-serif] text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight text-[#111827] mb-16">
            From raw artifacts to <em className="not-italic text-[#475569]">verifiable skills.</em>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#F7F5F0] border border-[#E5E1D8] rounded-[16px] p-6 shadow-[0_8px_30px_rgba(17,24,39,0.04)] hover:border-[#B08D57]/50 transition-all duration-300">
              <div className="font-mono text-xs text-[#B08D57] mb-3 font-semibold tracking-wider">01 / SUBMISSION</div>
              <h3 className="font-['Inter',sans-serif] text-2xl font-normal text-[#111827] mb-2">
                Raw Evidence Ingestion
              </h3>
              <p className="text-xs leading-relaxed text-[#475569] font-sans">
                PDF resumes, LinkedIn exports, GitHub commit audits, and technical assessment records stored securely with SHA-256 fingerprints.
              </p>
            </div>

            <div className="bg-[#F7F5F0] border border-[#E5E1D8] rounded-[16px] p-6 shadow-[0_8px_30px_rgba(17,24,39,0.04)] hover:border-[#B08D57]/50 transition-all duration-300">
              <div className="font-mono text-xs text-[#B08D57] mb-3 font-semibold tracking-wider">02 / EXTRACTION</div>
              <h3 className="font-['Inter',sans-serif] text-2xl font-normal text-[#111827] mb-2">
                Structured Schema Extraction
              </h3>
              <p className="text-xs leading-relaxed text-[#475569] font-sans">
                Async Redis workers extract explicit technical competencies with exact text span evidence, strictly bounded against hallucination.
              </p>
            </div>

            <div className="bg-[#F7F5F0] border border-[#E5E1D8] rounded-[16px] p-6 shadow-[0_8px_30px_rgba(17,24,39,0.04)] hover:border-[#B08D57]/50 transition-all duration-300">
              <div className="font-mono text-xs text-[#B08D57] mb-3 font-semibold tracking-wider">03 / NORMALIZATION</div>
              <h3 className="font-['Inter',sans-serif] text-2xl font-normal text-[#111827] mb-2">
                Canonical Taxonomy
              </h3>
              <p className="text-xs leading-relaxed text-[#475569] font-sans">
                Extracted labels map into canonical skill entities with pgvector semantic embeddings, normalizing aliases across languages and frameworks.
              </p>
            </div>

            <div className="bg-[#F7F5F0] border border-[#E5E1D8] rounded-[16px] p-6 shadow-[0_8px_30px_rgba(17,24,39,0.04)] hover:border-[#B08D57]/50 transition-all duration-300">
              <div className="font-mono text-xs text-[#B08D57] mb-3 font-semibold tracking-wider">04 / VERIFICATION</div>
              <h3 className="font-['Inter',sans-serif] text-2xl font-normal text-[#111827] mb-2">
                Tiered Multipliers
              </h3>
              <p className="text-xs leading-relaxed text-[#475569] font-sans">
                Tier multipliers scale effective confidence: Verified (1.00x), Partially Verified (0.85x), and Unverified (0.65x).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SECTION 03: EXPLAINABLE DETERMINISTIC MATCHING                         */}
      {/* ========================================================================= */}
      <section id="matching" className="relative z-10 bg-[#F7F5F0] border-b border-[#E5E1D8] px-6 py-28 sm:px-12">
        <div className="max-w-[1280px] mx-auto">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
            SECTION 03 / DETERMINISTIC COMPUTATION
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5">
              <h2 className="font-['Inter',sans-serif] text-4xl sm:text-5xl font-normal leading-[1.05] tracking-tight text-[#111827] mb-6">
                Auditable scoring. <br />
                <em className="not-italic text-[#475569]">Zero black-box decisions.</em>
              </h2>
              <p className="text-sm leading-relaxed text-[#475569] mb-6">
                Our matching pipeline is a pure mathematical calculation. Every match score is broken down into three verifiable scoring components persisted directly to the database.
              </p>
              <div className="p-5 rounded-[16px] border border-[#111827] bg-[#111827] font-mono text-xs text-[#FFFFFF] shadow-lg">
                <div className="text-[#B08D57] mb-2 font-semibold tracking-wider">// SCORING SPECIFICATION</div>
                <div className="text-[#EFEBE3] font-mono">final_score = clamp(0.65 * D + 0.25 * S + 0.10 * V, 0, 1)</div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4 font-mono text-xs">
              <div className="border border-[#E5E1D8] p-5 rounded-[16px] bg-[#FFFFFF] shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
                <div className="flex justify-between text-[#64748B] mb-1 font-semibold">
                  <span className="text-[#111827]">D = EXACT OVERLAP</span>
                  <span className="text-[#B08D57]">65% WEIGHT</span>
                </div>
                <p className="text-[#475569] font-sans text-xs">
                  Weighted intersection of required canonical skills possessed by candidate with effective confidence weighting.
                </p>
              </div>

              <div className="border border-[#E5E1D8] p-5 rounded-[16px] bg-[#FFFFFF] shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
                <div className="flex justify-between text-[#64748B] mb-1 font-semibold">
                  <span className="text-[#111827]">S = SEMANTIC SIMILARITY</span>
                  <span className="text-[#B08D57]">25% WEIGHT</span>
                </div>
                <p className="text-[#475569] font-sans text-xs">
                  Cosine distance across unmatched required skills using 768-dim taxonomy embeddings, with similarity below 0.75 clamped to zero.
                </p>
              </div>

              <div className="border border-[#E5E1D8] p-5 rounded-[16px] bg-[#FFFFFF] shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
                <div className="flex justify-between text-[#64748B] mb-1 font-semibold">
                  <span className="text-[#111827]">V = VERIFICATION ADJUSTMENT</span>
                  <span className="text-[#B08D57]">10% WEIGHT</span>
                </div>
                <p className="text-[#475569] font-sans text-xs">
                  Independent adjustment derived from the persisted verification tiers of matched, evidence-backed skills.
                </p>
              </div>

              <div className="border border-[#E5E1D8] p-5 rounded-[16px] bg-[#FFFFFF] shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
                <div className="flex justify-between text-[#64748B] mb-1 font-semibold">
                  <span className="text-[#111827]">FAIRNESS GUARANTEE</span>
                  <span className="text-[#4F6F5A] font-bold">RESTRICTED VIEW</span>
                </div>
                <p className="text-[#475569] font-sans text-xs">
                  Protected attributes (name, gender, age, college tier, GPA) are physically excluded from the matching query via restricted PostgreSQL view.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SECTION 04: FOUR-PERSONA ECOSYSTEM                                     */}
      {/* ========================================================================= */}
      <section id="ecosystem" className="relative z-10 bg-[#FFFFFF] border-b border-[#E5E1D8] px-6 py-28 sm:px-12">
        <div className="max-w-[1280px] mx-auto">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
            SECTION 04 / COLLABORATIVE ECOSYSTEM
          </div>
          <h2 className="font-['Inter',sans-serif] text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight text-[#111827] mb-16">
            Built for the entire <em className="not-italic text-[#475569]">academic-industry lifecycle.</em>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#F7F5F0] border border-[#E5E1D8] rounded-[16px] p-7 shadow-[0_8px_30px_rgba(17,24,39,0.04)] hover:shadow-[0_12px_35px_rgba(17,24,39,0.08)] hover:border-[#B08D57]/60 transition-all duration-300 flex flex-col justify-between h-full">
              <div>
                <div className="font-mono text-xs text-[#B08D57] mb-2 font-semibold tracking-wider">01 / CANDIDATES</div>
                <h3 className="font-['Inter',sans-serif] text-2xl font-normal text-[#111827] mb-3">
                  Student
                </h3>
                <p className="text-xs leading-relaxed text-[#475569] mb-6 font-sans">
                  Build an undeniable, evidence-backed skill dossier. Discover matched internships, identify skill gaps, and form complementary project teams.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAuth("register", "student")}
                className="text-xs font-mono uppercase tracking-wider text-[#111827] hover:text-[#B08D57] font-semibold text-left transition-colors cursor-pointer"
              >
                Enter as Student →
              </button>
            </div>

            <div className="bg-[#F7F5F0] border border-[#E5E1D8] rounded-[16px] p-7 shadow-[0_8px_30px_rgba(17,24,39,0.04)] hover:shadow-[0_12px_35px_rgba(17,24,39,0.08)] hover:border-[#B08D57]/60 transition-all duration-300 flex flex-col justify-between h-full">
              <div>
                <div className="font-mono text-xs text-[#B08D57] mb-2 font-semibold tracking-wider">02 / HIRING</div>
                <h3 className="font-['Inter',sans-serif] text-2xl font-normal text-[#111827] mb-3">
                  Recruiter
                </h3>
                <p className="text-xs leading-relaxed text-[#475569] mb-6 font-sans">
                  Post technical internships with weighted requirements. Review ranked candidates with full mathematical score breakdowns and verified evidence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAuth("register", "recruiter")}
                className="text-xs font-mono uppercase tracking-wider text-[#111827] hover:text-[#B08D57] font-semibold text-left transition-colors cursor-pointer"
              >
                Enter as Recruiter →
              </button>
            </div>

            <div className="bg-[#F7F5F0] border border-[#E5E1D8] rounded-[16px] p-7 shadow-[0_8px_30px_rgba(17,24,39,0.04)] hover:shadow-[0_12px_35px_rgba(17,24,39,0.08)] hover:border-[#B08D57]/60 transition-all duration-300 flex flex-col justify-between h-full">
              <div>
                <div className="font-mono text-xs text-[#B08D57] mb-2 font-semibold tracking-wider">03 / SCHOLARS</div>
                <h3 className="font-['Inter',sans-serif] text-2xl font-normal text-[#111827] mb-3">
                  Faculty
                </h3>
                <p className="text-xs leading-relaxed text-[#475569] mb-6 font-sans">
                  Engage in industrial training, submit R&D grant proposals, manage joint student research workspaces, and advise student project capstones.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAuth("register", "academician")}
                className="text-xs font-mono uppercase tracking-wider text-[#111827] hover:text-[#B08D57] font-semibold text-left transition-colors cursor-pointer"
              >
                Enter as Faculty →
              </button>
            </div>

            <div className="bg-[#F7F5F0] border border-[#E5E1D8] rounded-[16px] p-7 shadow-[0_8px_30px_rgba(17,24,39,0.04)] hover:shadow-[0_12px_35px_rgba(17,24,39,0.08)] hover:border-[#B08D57]/60 transition-all duration-300 flex flex-col justify-between h-full">
              <div>
                <div className="font-mono text-xs text-[#B08D57] mb-2 font-semibold tracking-wider">04 / LEADERSHIP</div>
                <h3 className="font-['Inter',sans-serif] text-2xl font-normal text-[#111827] mb-3">
                  Institution
                </h3>
                <p className="text-xs leading-relaxed text-[#475569] mb-6 font-sans">
                  Real-time institutional intelligence: cohort readiness, curriculum gap analysis, placement outcome funnels, and corporate partnership tracking.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openAuth("register", "institution")}
                className="text-xs font-mono uppercase tracking-wider text-[#111827] hover:text-[#B08D57] font-semibold text-left transition-colors cursor-pointer"
              >
                Enter as Institution →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. CLOSING CALL TO ACTION & FOOTER                                        */}
      {/* ========================================================================= */}
      <footer className="relative z-10 bg-[#F7F5F0] px-6 py-24 sm:px-12 border-t border-[#E5E1D8]">
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-['Inter',sans-serif] text-4xl sm:text-6xl font-normal leading-[1.0] text-[#111827] mb-6">
              Ready to make your skills <em className="not-italic text-[#475569]">undeniable?</em>
            </h2>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed mb-8">
              Build an evidence-backed Lumina Intel from submitted records, or sign in to access your institutional workspace.
            </p>
            <button
              type="button"
              onClick={() => openAuth("register")}
              className="pill-btn pill-btn-hero text-[16px] font-medium cursor-pointer shadow-xl hover:shadow-2xl transition-all"
            >
              Find my dream
            </button>
          </div>

          <div className="grid gap-4 border-t border-[#E5E1D8] pt-8 md:grid-cols-3">
            <section id="privacy" className="border border-[#E5E1D8] bg-[#FFFFFF] rounded-[16px] p-5 text-xs text-[#475569] shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <h3 className="font-mono text-[#111827] font-semibold">Privacy notice</h3>
              <p className="mt-2 leading-relaxed">Evidence records, student verification profiles, and recruiter consent boundaries are cryptographically auditable.</p>
            </section>
            <section id="terms" className="border border-[#E5E1D8] bg-[#FFFFFF] rounded-[16px] p-5 text-xs text-[#475569] shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <h3 className="font-mono text-[#111827] font-semibold">Platform terms</h3>
              <p className="mt-2 leading-relaxed">Evidence provenance, account identity authorization, and deterministic matching standards are strictly enforced.</p>
            </section>
            <section id="security" className="border border-[#E5E1D8] bg-[#FFFFFF] rounded-[16px] p-5 text-xs text-[#475569] shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <h3 className="font-mono text-[#111827] font-semibold">Security overview</h3>
              <p className="mt-2 leading-relaxed">Role-based access, evidence SHA-256 provenance, and restricted matching views protect student data at all times.</p>
            </section>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-[#64748B] font-mono gap-4">
            <div>
              © {new Date().getFullYear()} Lumina Intel Platform. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <a href="#privacy" className="hover:text-[#111827] transition-colors">Privacy</a>
              <a href="#terms" className="hover:text-[#111827] transition-colors">Terms</a>
              <a href="#security" className="hover:text-[#111827] transition-colors">Security Provenance</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 7. MODAL AUTH DIALOG                                                      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAuthModalOpen(false)}
              className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm"
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
              className="relative z-10 w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-[16px] border border-[#E5E1D8] bg-[#FFFFFF] shadow-[0_8px_30px_rgba(17,24,39,0.08)] p-6 sm:p-8 text-[#111827] no-scrollbar"
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
