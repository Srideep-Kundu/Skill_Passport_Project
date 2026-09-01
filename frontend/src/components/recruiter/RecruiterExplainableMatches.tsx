import { useState } from "react";
import {
  Target,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { EditorialCard } from "../ui/EditorialPrimitives";
import type { Internship, CandidateMatch } from "../../api";

interface ExplainableCandidate {
  id: string;
  name: string;
  role: string;
  university: string;
  matchScore: number;
  deterministicScore: number;
  semanticScore: number;
  verificationBonus: number;
  matchedSkills: Array<{
    name: string;
    verified: boolean;
    evidenceSummary: string;
  }>;
  missingSkills: Array<{
    name: string;
    criticality: "required" | "preferred";
    learningPath: string;
  }>;
  matchReasoning: string;
}

const DEMO_EXPLAINABLE_CANDIDATES: Record<string, ExplainableCandidate[]> = {
  default: [
    {
      id: "exp-cand-1",
      name: "Maya Rivera",
      role: "Backend & Systems Intern",
      university: "Harbor Polytechnic University",
      matchScore: 92,
      deterministicScore: 90,
      semanticScore: 85,
      verificationBonus: 10,
      matchedSkills: [
        {
          name: "Python",
          verified: true,
          evidenceSummary: "3 GitHub microservices (148 commits) + 98% Proctored Algorithm Score",
        },
        {
          name: "FastAPI",
          verified: true,
          evidenceSummary: "Production REST Gateway with OpenAPI specs + Faculty Lab Capstone",
        },
        {
          name: "PostgreSQL & pgvector",
          verified: true,
          evidenceSummary: "NPTEL Certified (92% Gold) + Vector indexing repository",
        },
        {
          name: "Docker",
          verified: true,
          evidenceSummary: "Multi-stage Alpine Dockerfile & Docker Compose stacks",
        },
      ],
      missingSkills: [
        {
          name: "Kubernetes Orchestration",
          criticality: "preferred",
          learningPath: "Cloud-native microservice deployment workshop",
        },
      ],
      matchReasoning:
        "Candidate demonstrates exceptional verifiable proficiency in async Python backend development and database design with 100% verified evidence coverage, but has not yet completed container orchestration certification.",
    },
    {
      id: "exp-cand-2",
      name: "Rahul Sharma",
      role: "Backend Intern",
      university: "IIIT Hyderabad",
      matchScore: 86,
      deterministicScore: 82,
      semanticScore: 80,
      verificationBonus: 10,
      matchedSkills: [
        {
          name: "Python",
          verified: true,
          evidenceSummary: "5 repositories on concurrency & task processing systems",
        },
        {
          name: "PostgreSQL",
          verified: true,
          evidenceSummary: "Financial transaction ledger architecture with ACID constraints",
        },
        {
          name: "Redis",
          verified: true,
          evidenceSummary: "Distributed rate-limiting token bucket project",
        },
      ],
      missingSkills: [
        {
          name: "Cloud Deployment (AWS/GCP)",
          criticality: "required",
          learningPath: "AWS Certified Cloud Practitioner or terraform lab",
        },
      ],
      matchReasoning:
        "Strong backend concurrency algorithms and data modeling foundation with proctored assessment evidence; missing production cloud infrastructure deployment proof.",
    },
    {
      id: "exp-cand-3",
      name: "Aarav Singh",
      role: "AI / ML Engineer",
      university: "NIT Trichy",
      matchScore: 81,
      deterministicScore: 78,
      semanticScore: 88,
      verificationBonus: 8,
      matchedSkills: [
        {
          name: "Machine Learning & PyTorch",
          verified: true,
          evidenceSummary: "Vision Transformer fine-tuning project + ONNX acceleration",
        },
        {
          name: "Python",
          verified: true,
          evidenceSummary: "Linear algebra & vector calculus benchmark passed (92%)",
        },
      ],
      missingSkills: [
        {
          name: "FastAPI REST Integration",
          criticality: "preferred",
          learningPath: "Model serving with async API endpoints",
        },
        {
          name: "Production MLOps Pipeline",
          criticality: "required",
          learningPath: "MLflow / DVC experiment tracking repository",
        },
      ],
      matchReasoning:
        "Strong mathematical and neural network training evidence; requires additional scaffolding for model serving APIs and MLOps deployment pipelines.",
    },
  ],
};

export function RecruiterExplainableMatches({
  internships,
  selectedInternship,
  onSelectInternship,
  liveMatches,
  onViewLiveExplanation,
}: {
  internships: Internship[] | null;
  selectedInternship: Internship | null;
  onSelectInternship: (internship: Internship) => void;
  liveMatches?: CandidateMatch[] | null;
  onViewLiveExplanation?: (match: CandidateMatch) => void;
}) {
  const [selectedCandidate, setSelectedCandidate] = useState<ExplainableCandidate>(
    DEMO_EXPLAINABLE_CANDIDATES.default[0]
  );
  const [activeFilter, setActiveFilter] = useState<"all" | "high_match" | "verified_only">("all");

  const candidatesList = DEMO_EXPLAINABLE_CANDIDATES.default.filter((cand) => {
    if (activeFilter === "high_match") return cand.matchScore >= 85;
    if (activeFilter === "verified_only")
      return cand.matchedSkills.every((s) => s.verified);
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <EditorialCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#B08D57]/10 text-[#B08D57]">
                <Target className="h-3.5 w-3.5" />
              </span>
              <h2
                className="text-xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Explainable Candidate Matching Engine
              </h2>
            </div>
            <p className="text-xs text-[#475569] max-w-2xl leading-relaxed">
              Every match score is fully deconstructed into deterministic skill overlap, semantic embedding alignment, and cryptographically verified evidence bonuses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-[#64748B] border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-1.5 rounded-full font-semibold">
              Deterministic Weights: 60% Overlap · 30% Semantic · 10% Verification
            </span>
          </div>
        </div>
      </EditorialCard>

      {/* Internship Role Filter Strip */}
      {internships && internships.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E1D8] pb-3">
          <span className="font-mono text-xs text-[#64748B] mr-2">Target Opportunity:</span>
          {internships.map((int) => {
            const isSelected = selectedInternship?.id === int.id;
            return (
              <button
                key={int.id}
                type="button"
                onClick={() => onSelectInternship(int)}
                className={`rounded-full px-3 py-1 font-mono text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#111827] text-white font-semibold"
                    : "border border-[#E5E1D8] bg-[#FFFFFF] text-[#475569] hover:border-[#B08D57]"
                }`}
              >
                {int.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`rounded-lg px-3 py-1 text-xs font-mono transition-colors cursor-pointer ${
              activeFilter === "all"
                ? "bg-[#B08D57] text-white font-bold"
                : "border border-[#E5E1D8] bg-[#FFFFFF] text-[#475569]"
            }`}
          >
            All Ranked ({candidatesList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("high_match")}
            className={`rounded-lg px-3 py-1 text-xs font-mono transition-colors cursor-pointer ${
              activeFilter === "high_match"
                ? "bg-[#B08D57] text-white font-bold"
                : "border border-[#E5E1D8] bg-[#FFFFFF] text-[#475569]"
            }`}
          >
            High Match (&gt;85%)
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("verified_only")}
            className={`rounded-lg px-3 py-1 text-xs font-mono transition-colors cursor-pointer ${
              activeFilter === "verified_only"
                ? "bg-[#B08D57] text-white font-bold"
                : "border border-[#E5E1D8] bg-[#FFFFFF] text-[#475569]"
            }`}
          >
            100% Verified Proofs
          </button>
        </div>

        <span className="font-mono text-xs text-[#64748B]">
          Ordered strictly by explainable fit
        </span>
      </div>

      {/* Two Column Layout: Candidates List on Left, Deep Explainability Breakdown on Right */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.3fr]">
        {/* Candidates List */}
        <div className="space-y-3">
          {candidatesList.map((cand, idx) => {
            const isSelected = cand.id === selectedCandidate.id;
            return (
              <div
                key={cand.id}
                onClick={() => setSelectedCandidate(cand)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? "border-[#B08D57] bg-[#FFFFFF] shadow-md ring-1 ring-[#B08D57]/40"
                    : "border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#B08D57]/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[#B08D57] font-bold">
                        #{idx + 1}
                      </span>
                      <h3
                        className="text-base font-normal text-[#111827]"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {cand.name}
                      </h3>
                    </div>
                    <p className="text-xs text-[#475569]">{cand.role}</p>
                    <div className="font-mono text-[10px] text-[#64748B]">
                      {cand.university}
                    </div>
                  </div>

                  {/* Match Score Badge */}
                  <div className="text-right shrink-0">
                    <div
                      className="text-2xl font-normal text-[#111827]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {cand.matchScore}%
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[#166534] font-semibold block">
                      MATCH SCORE
                    </span>
                  </div>
                </div>

                {/* Score Breakdown Pills */}
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5 font-mono text-[10px] border-t border-[#E5E1D8]/60 pt-2.5">
                  <span className="border border-[#E5E1D8] bg-[#F7F5F0] px-2 py-0.5 rounded-md text-[#475569]">
                    Exact: {cand.deterministicScore}%
                  </span>
                  <span className="border border-[#E5E1D8] bg-[#F7F5F0] px-2 py-0.5 rounded-md text-[#475569]">
                    Semantic: {cand.semanticScore}%
                  </span>
                  <span className="bg-[#DCFCE7] text-[#166534] font-bold px-2 py-0.5 rounded-md">
                    +{cand.verificationBonus}% Bonus
                  </span>
                  <span className="ml-auto text-[#B08D57] font-bold flex items-center gap-1">
                    <span>Inspect</span>
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}

          {/* If there are live matches from active selected internship */}
          {liveMatches && liveMatches.length > 0 && (
            <div className="border-t border-[#E5E1D8] pt-4 space-y-2">
              <h4 className="font-mono text-xs font-bold text-[#64748B] uppercase tracking-wider">
                Live Calculated Pool ({liveMatches.length})
              </h4>
              {liveMatches.map((lm) => (
                <div
                  key={lm.id}
                  className="p-3.5 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-[#111827]">{lm.candidate_label}</span>
                    <div className="font-mono text-[10px] text-[#64748B]">
                      Deterministic Match
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-[#111827]">
                      {Math.round(lm.final_score * 100)}%
                    </span>
                    {onViewLiveExplanation && (
                      <button
                        type="button"
                        onClick={() => onViewLiveExplanation(lm)}
                        className="font-mono text-[11px] text-[#B08D57] hover:underline cursor-pointer"
                      >
                        Explain
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Explainability Breakdown Panel */}
        <EditorialCard className="p-6 space-y-6">
          {/* Header Score Header */}
          <div className="flex items-start justify-between border-b border-[#E5E1D8] pb-5">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold">
                Match Explainability Audit
              </span>
              <h3
                className="text-2xl font-normal text-[#111827] mt-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {selectedCandidate.name}
              </h3>
              <p className="text-xs text-[#475569] mt-0.5">
                {selectedCandidate.role} · {selectedCandidate.university}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-[rgba(176,141,87,0.08)] border border-[#B08D57]/30 text-center shrink-0">
              <span
                className="text-3xl font-normal text-[#111827] block leading-none"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {selectedCandidate.matchScore}%
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[#B08D57] font-bold mt-1 block">
                MATCH SCORE
              </span>
            </div>
          </div>

          {/* Algorithmic Reason Summary */}
          <div className="p-4 rounded-xl border border-[#B08D57]/30 bg-[rgba(176,141,87,0.05)] space-y-1.5">
            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#B08D57]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>WHY THIS CANDIDATE RANKED HIGH</span>
            </div>
            <p className="text-xs text-[#111827] leading-relaxed font-sans font-medium">
              "{selectedCandidate.matchReasoning}"
            </p>
          </div>

          {/* Section 1: MATCHED SKILLS & EVIDENCE CONTRIBUTION */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[#166534]" />
                <span>MATCHED SKILLS ({selectedCandidate.matchedSkills.length})</span>
              </h4>
              <span className="font-mono text-[10px] text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-full font-semibold">
                Verified Provenance
              </span>
            </div>

            <div className="space-y-2.5">
              {selectedCandidate.matchedSkills.map((skill) => (
                <div
                  key={skill.name}
                  className="p-3 rounded-xl border border-[#E5E1D8] bg-[#FFFFFF] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#111827]">
                      <span>✓</span>
                      <span>{skill.name}</span>
                    </div>
                    <span className="font-mono text-[9px] uppercase text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-sm font-semibold">
                      Verified Evidence
                    </span>
                  </div>
                  <p className="text-xs text-[#475569] font-sans pl-4 leading-relaxed">
                    <strong className="text-[#111827]">Evidence:</strong> {skill.evidenceSummary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: MISSING SKILLS & UPSKILLING PATHWAY */}
          <div className="space-y-3 pt-2 border-t border-[#E5E1D8]">
            <h4 className="font-mono text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-[#B08D57]" />
              <span>SKILL GAPS & GROWTH PATHWAY ({selectedCandidate.missingSkills.length})</span>
            </h4>

            <div className="space-y-2.5">
              {selectedCandidate.missingSkills.map((gap) => (
                <div
                  key={gap.name}
                  className="p-3 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#111827] flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
                      {gap.name}
                    </span>
                    <span className="font-mono text-[9px] uppercase text-[#475569] border border-[#E5E1D8] bg-[#FFFFFF] px-2 py-0.5 rounded-sm">
                      {gap.criticality}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B] pl-3 leading-relaxed">
                    <strong className="text-[#475569]">Suggested Path:</strong> {gap.learningPath}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </EditorialCard>
      </div>
    </div>
  );
}
