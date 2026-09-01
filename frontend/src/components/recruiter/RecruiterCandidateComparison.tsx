import { useState } from "react";
import {
  Check,
  ShieldCheck,
  ArrowRightLeft,
} from "lucide-react";
import { EditorialCard } from "../ui/EditorialPrimitives";

interface CompareCandidateProfile {
  id: string;
  name: string;
  avatar: string;
  university: string;
  overallFitScore: number;
  deterministicScore: number;
  semanticScore: number;
  verificationBonus: number;
  evidenceStrength: "High (Cryptographic & Proctored)" | "Medium" | "Developing";
  projectRelevanceScore: number;
  assessmentAvgScore: number;
  verifiedSkillsCount: number;
  topSkills: string[];
  keyStrength: string;
  primaryGap: string;
  experienceSummary: string;
  githubReposVerified: number;
}

const COMPARISON_CANDIDATE_POOL: CompareCandidateProfile[] = [
  {
    id: "cand-maya",
    name: "Maya Rivera",
    avatar: "MR",
    university: "Harbor Polytechnic University",
    overallFitScore: 92,
    deterministicScore: 90,
    semanticScore: 85,
    verificationBonus: 10,
    evidenceStrength: "High (Cryptographic & Proctored)",
    projectRelevanceScore: 94,
    assessmentAvgScore: 98,
    verifiedSkillsCount: 8,
    topSkills: ["Python", "FastAPI", "PostgreSQL", "pgvector", "Docker"],
    keyStrength: "End-to-end async backend microservices & vector embeddings",
    primaryGap: "Kubernetes cluster orchestration",
    experienceSummary: "148 verified commits across 3 production repositories",
    githubReposVerified: 3,
  },
  {
    id: "cand-rahul",
    name: "Rahul Sharma",
    avatar: "RS",
    university: "IIIT Hyderabad",
    overallFitScore: 86,
    deterministicScore: 82,
    semanticScore: 80,
    verificationBonus: 10,
    evidenceStrength: "High (Cryptographic & Proctored)",
    projectRelevanceScore: 88,
    assessmentAvgScore: 94,
    verifiedSkillsCount: 6,
    topSkills: ["Python", "PostgreSQL", "Redis", "Distributed Locks"],
    keyStrength: "High-throughput financial ledger and database sharding",
    primaryGap: "Cloud infrastructure provisioning (AWS/Terraform)",
    experienceSummary: "200+ commits on asynchronous task processing systems",
    githubReposVerified: 5,
  },
  {
    id: "cand-aarav",
    name: "Aarav Singh",
    avatar: "AS",
    university: "NIT Trichy",
    overallFitScore: 81,
    deterministicScore: 78,
    semanticScore: 88,
    verificationBonus: 8,
    evidenceStrength: "High (Cryptographic & Proctored)",
    projectRelevanceScore: 85,
    assessmentAvgScore: 92,
    verifiedSkillsCount: 5,
    topSkills: ["Machine Learning", "PyTorch", "Vision Transformers", "Python"],
    keyStrength: "Deep learning model fine-tuning & ONNX tensor acceleration",
    primaryGap: "Production MLOps & API serving pipelines",
    experienceSummary: "2 open source machine learning vision libraries",
    githubReposVerified: 2,
  },
  {
    id: "cand-priya",
    name: "Priya Patel",
    avatar: "PP",
    university: "IIT Bombay",
    overallFitScore: 84,
    deterministicScore: 80,
    semanticScore: 82,
    verificationBonus: 8,
    evidenceStrength: "Medium",
    projectRelevanceScore: 86,
    assessmentAvgScore: 89,
    verifiedSkillsCount: 6,
    topSkills: ["Python", "Django", "React", "SQLAlchemy", "Redis"],
    keyStrength: "Full-stack web application development & responsive UI",
    primaryGap: "Advanced vector indexing & performance benchmarks",
    experienceSummary: "Full-stack campus portal capstone project",
    githubReposVerified: 2,
  },
];

export function RecruiterCandidateComparison() {
  const [selectedIds, setSelectedIds] = useState<string[]>([
    "cand-maya",
    "cand-rahul",
    "cand-aarav",
  ]);

  const toggleSelectCandidate = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 2) {
        setSelectedIds(selectedIds.filter((item) => item !== id));
      }
    } else {
      if (selectedIds.length < 4) {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const selectedCandidates = COMPARISON_CANDIDATE_POOL.filter((c) =>
    selectedIds.includes(c.id)
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner */}
      <EditorialCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#B08D57]/10 text-[#B08D57]">
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </span>
              <h2
                className="text-xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Multi-Candidate Evidence Comparison
              </h2>
            </div>
            <p className="text-xs text-[#475569] max-w-2xl leading-relaxed">
              Compare shortlisted candidates side-by-side on evidence quality, verified skill depth, proctored assessment scores, and specific capability gaps.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-[#64748B]">
            <span>Comparing {selectedCandidates.length} Candidates</span>
            <span className="text-[#E5E1D8]">·</span>
            <span>Max 4</span>
          </div>
        </div>
      </EditorialCard>

      {/* Candidate Selector Strip */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs text-[#64748B] font-semibold">
          Select to Compare:
        </span>
        {COMPARISON_CANDIDATE_POOL.map((c) => {
          const isSelected = selectedIds.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleSelectCandidate(c.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono transition-all cursor-pointer ${
                isSelected
                  ? "border-[#B08D57] bg-[#B08D57] text-white font-bold shadow-xs"
                  : "border-[#E5E1D8] bg-[#FFFFFF] text-[#475569] hover:border-[#B08D57]"
              }`}
            >
              <span>{c.name}</span>
              {isSelected ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="text-[10px] opacity-60">Add</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Comparison Matrix Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#E5E1D8] bg-[#F7F5F0]">
              <th className="p-4 font-mono text-[11px] uppercase tracking-wider text-[#64748B] w-48 font-bold">
                Evaluation Metric
              </th>
              {selectedCandidates.map((cand) => (
                <th key={cand.id} className="p-4 min-w-[240px] border-l border-[#E5E1D8]">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                      {cand.avatar}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#111827]">{cand.name}</h4>
                      <p className="font-mono text-[10px] text-[#64748B] truncate">
                        {cand.university}
                      </p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E1D8]">
            {/* Row 1: Overall Fit Score */}
            <tr className="hover:bg-[#F7F5F0]/50 transition-colors">
              <td className="p-4 font-mono font-bold text-[#111827] bg-[#F7F5F0]/30">
                Overall Match Score
              </td>
              {selectedCandidates.map((cand) => (
                <td key={cand.id} className="p-4 border-l border-[#E5E1D8]">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-2xl font-normal text-[#111827]"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {cand.overallFitScore}%
                    </span>
                    <span className="font-mono text-[10px] text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-sm font-bold">
                      +{cand.verificationBonus}% Bonus
                    </span>
                  </div>
                </td>
              ))}
            </tr>

            {/* Row 2: Skill Alignment */}
            <tr className="hover:bg-[#F7F5F0]/50 transition-colors">
              <td className="p-4 font-mono font-bold text-[#111827] bg-[#F7F5F0]/30">
                Skill Alignment
              </td>
              {selectedCandidates.map((cand) => (
                <td key={cand.id} className="p-4 border-l border-[#E5E1D8]">
                  <div className="flex flex-wrap gap-1.5">
                    {cand.topSkills.map((s) => (
                      <span
                        key={s}
                        className="font-mono text-[10px] border border-[#E5E1D8] bg-[#F7F5F0] px-2 py-0.5 rounded-md text-[#475569]"
                      >
                        ✓ {s}
                      </span>
                    ))}
                  </div>
                </td>
              ))}
            </tr>

            {/* Row 3: Evidence Strength */}
            <tr className="hover:bg-[#F7F5F0]/50 transition-colors">
              <td className="p-4 font-mono font-bold text-[#111827] bg-[#F7F5F0]/30">
                Evidence Provenance
              </td>
              {selectedCandidates.map((cand) => (
                <td key={cand.id} className="p-4 border-l border-[#E5E1D8]">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#166534] font-bold">
                    <ShieldCheck className="h-4 w-4" />
                    <span>{cand.evidenceStrength}</span>
                  </div>
                  <p className="font-mono text-[10px] text-[#64748B] mt-1">
                    {cand.verifiedSkillsCount} verified skills across {cand.githubReposVerified} git repos
                  </p>
                </td>
              ))}
            </tr>

            {/* Row 4: Assessment Performance */}
            <tr className="hover:bg-[#F7F5F0]/50 transition-colors">
              <td className="p-4 font-mono font-bold text-[#111827] bg-[#F7F5F0]/30">
                Proctored Assessment
              </td>
              {selectedCandidates.map((cand) => (
                <td key={cand.id} className="p-4 border-l border-[#E5E1D8]">
                  <div className="font-mono">
                    <span className="text-sm font-bold text-[#111827]">
                      {cand.assessmentAvgScore}% Average
                    </span>
                    <span className="block text-[10px] text-[#64748B]">
                      Deterministic Sandbox Execution
                    </span>
                  </div>
                </td>
              ))}
            </tr>

            {/* Row 5: Project Relevance */}
            <tr className="hover:bg-[#F7F5F0]/50 transition-colors">
              <td className="p-4 font-mono font-bold text-[#111827] bg-[#F7F5F0]/30">
                Project Relevance
              </td>
              {selectedCandidates.map((cand) => (
                <td key={cand.id} className="p-4 border-l border-[#E5E1D8]">
                  <p className="text-xs text-[#475569] leading-relaxed">
                    {cand.experienceSummary}
                  </p>
                </td>
              ))}
            </tr>

            {/* Row 6: Core Strength */}
            <tr className="hover:bg-[#F7F5F0]/50 transition-colors">
              <td className="p-4 font-mono font-bold text-[#111827] bg-[#F7F5F0]/30">
                Standout Strength
              </td>
              {selectedCandidates.map((cand) => (
                <td key={cand.id} className="p-4 border-l border-[#E5E1D8]">
                  <div className="p-2.5 rounded-lg bg-[#DCFCE7]/60 border border-[#86EFAC]/40 text-xs text-[#166534] font-medium leading-relaxed">
                    "{cand.keyStrength}"
                  </div>
                </td>
              ))}
            </tr>

            {/* Row 7: Identified Gap */}
            <tr className="hover:bg-[#F7F5F0]/50 transition-colors">
              <td className="p-4 font-mono font-bold text-[#111827] bg-[#F7F5F0]/30">
                Primary Gap
              </td>
              {selectedCandidates.map((cand) => (
                <td key={cand.id} className="p-4 border-l border-[#E5E1D8]">
                  <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#991B1B] font-medium leading-relaxed">
                    "{cand.primaryGap}"
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
