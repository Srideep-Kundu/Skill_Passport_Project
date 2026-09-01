import { useState } from "react";
import { motion } from "framer-motion";
import {
  GitBranch,
  ShieldCheck,
  Award,
  FileCode2,
  FileCheck2,
  Search,
  CheckCircle2,
  Building2,
  Lock,
  Layers,
  ChevronRight,
} from "lucide-react";
import { EditorialCard, EditorialBadge } from "../ui/EditorialPrimitives";

export interface CandidateEvidenceNode {
  id: string;
  candidate_name: string;
  candidate_role: string;
  university: string;
  avatar_initials: string;
  overall_confidence: number;
  privacy_status: "authorized_audit" | "anonymized_pool";
  skills: Array<{
    name: string;
    category: "Languages" | "Frameworks" | "Databases" | "DevOps" | "AI/ML";
    confidence: number;
    verification_tier: "verified" | "institutional" | "self_reported";
    evidence_sources: Array<{
      id: string;
      source_type: "github" | "assessment" | "project" | "digilocker" | "internship";
      title: string;
      details: string;
      confidence_contrib: number;
      date?: string;
      proof_hash?: string;
    }>;
  }>;
}

const DEMO_CANDIDATE_GRAPH_DATA: CandidateEvidenceNode[] = [
  {
    id: "cand-maya",
    candidate_name: "Maya Rivera",
    candidate_role: "Full-Stack & Distributed Systems",
    university: "Harbor Polytechnic University",
    avatar_initials: "MR",
    overall_confidence: 94,
    privacy_status: "authorized_audit",
    skills: [
      {
        name: "Python",
        category: "Languages",
        confidence: 96,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-py-1",
            source_type: "github",
            title: "Async Microservice Engine (3 repos)",
            details: "148 verified commits across 3 production repositories with clean CI pipelines",
            confidence_contrib: 95,
            proof_hash: "sha256:8f2a...19e4",
          },
          {
            id: "ev-py-2",
            source_type: "assessment",
            title: "Python Advanced Algorithms Assessment",
            details: "Score: 98% (98/100 pts) · Proctored Sandbox Execution",
            confidence_contrib: 98,
            date: "2026-02-15",
          },
          {
            id: "ev-py-3",
            source_type: "project",
            title: "Skill Passport Core API Service",
            details: "FastAPI + SQLAlchemy async ORM with zero regression suite",
            confidence_contrib: 92,
          },
        ],
      },
      {
        name: "FastAPI",
        category: "Frameworks",
        confidence: 93,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-fa-1",
            source_type: "github",
            title: "REST & WebSocket Gateway",
            details: "OpenAPI compliant async router with JWT auth & rate limiters",
            confidence_contrib: 94,
          },
          {
            id: "ev-fa-2",
            source_type: "internship",
            title: "Lumina Labs Cloud Engineering Lab",
            details: "Backend engineering capstone verified by Faculty Advisor",
            confidence_contrib: 92,
            date: "2026-01-20",
          },
        ],
      },
      {
        name: "PostgreSQL & pgvector",
        category: "Databases",
        confidence: 91,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-pg-1",
            source_type: "project",
            title: "Vector Embedding Semantic Match Storage",
            details: "HNSW indexed cosine similarity search over 50,000 skill vectors",
            confidence_contrib: 93,
          },
          {
            id: "ev-pg-2",
            source_type: "digilocker",
            title: "NPTEL Advanced Database Systems Certificate",
            details: "Cryptographically verified digital credential (Score: 92% Elite)",
            confidence_contrib: 96,
            proof_hash: "digilocker:in.gov.nptel:dbms-2025",
          },
        ],
      },
      {
        name: "Machine Learning & Embeddings",
        category: "AI/ML",
        confidence: 88,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-ml-1",
            source_type: "project",
            title: "Deterministic Skill Extractor & NLP Pipeline",
            details: "Transformer-based skill entity recognition with cosine scoring",
            confidence_contrib: 89,
          },
          {
            id: "ev-ml-2",
            source_type: "assessment",
            title: "AI/ML Applied Model Evaluation",
            details: "Score: 90% · Practical classification & clustering benchmark",
            confidence_contrib: 90,
          },
        ],
      },
      {
        name: "Docker & Containerization",
        category: "DevOps",
        confidence: 86,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-dk-1",
            source_type: "github",
            title: "Multi-stage Compose Stacks",
            details: "Alpine-based lean Docker images with isolated network bridges",
            confidence_contrib: 88,
          },
        ],
      },
    ],
  },
  {
    id: "cand-rahul",
    candidate_name: "Rahul Sharma",
    candidate_role: "Backend & Systems Architect",
    university: "Indian Institute of Information Technology",
    avatar_initials: "RS",
    overall_confidence: 91,
    privacy_status: "authorized_audit",
    skills: [
      {
        name: "Python",
        category: "Languages",
        confidence: 95,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-rs-py1",
            source_type: "github",
            title: "High-Throughput Order Engine (5 repos)",
            details: "Over 200 commits on asynchronous task processing systems",
            confidence_contrib: 96,
          },
          {
            id: "ev-rs-py2",
            source_type: "assessment",
            title: "Backend Concurrency Benchmark",
            details: "Score: 94% · Passed proctored concurrency & memory test",
            confidence_contrib: 94,
          },
        ],
      },
      {
        name: "PostgreSQL",
        category: "Databases",
        confidence: 92,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-rs-db1",
            source_type: "project",
            title: "Financial Ledger Schema & Sharding",
            details: "ACID compliant transactional database design with write-ahead logs",
            confidence_contrib: 93,
          },
        ],
      },
      {
        name: "Redis & Caching",
        category: "Databases",
        confidence: 89,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-rs-rd1",
            source_type: "project",
            title: "Distributed Token Bucket Rate Limiter",
            details: "Atomic Lua script execution under high request load",
            confidence_contrib: 91,
          },
        ],
      },
    ],
  },
  {
    id: "cand-aarav",
    candidate_name: "Aarav Singh",
    candidate_role: "AI & Neural Networks Engineer",
    university: "National Institute of Technology",
    avatar_initials: "AS",
    overall_confidence: 90,
    privacy_status: "authorized_audit",
    skills: [
      {
        name: "Machine Learning & PyTorch",
        category: "AI/ML",
        confidence: 94,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-as-ml1",
            source_type: "github",
            title: "Vision Transformer Fine-Tuning",
            details: "Trained on synthetic medical image classification datasets",
            confidence_contrib: 95,
          },
          {
            id: "ev-as-ml2",
            source_type: "project",
            title: "Real-Time Object Detection Pipeline",
            details: "ONNX runtime deployment with TensorRT acceleration",
            confidence_contrib: 92,
          },
        ],
      },
      {
        name: "Python",
        category: "Languages",
        confidence: 92,
        verification_tier: "verified",
        evidence_sources: [
          {
            id: "ev-as-py1",
            source_type: "assessment",
            title: "Data Structures & ML Math Assessment",
            details: "Score: 92% · Linear Algebra & Vector Calculus Benchmark",
            confidence_contrib: 92,
          },
        ],
      },
    ],
  },
];

export function RecruiterEvidenceGraph() {
  const [candidates] = useState<CandidateEvidenceNode[]>(DEMO_CANDIDATE_GRAPH_DATA);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(DEMO_CANDIDATE_GRAPH_DATA[0].id);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const currentCandidate =
    candidates.find((c) => c.id === selectedCandidateId) || candidates[0];

  const filteredSkills = currentCandidate.skills.filter((skill) => {
    const matchesSearch =
      skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.evidence_sources.some((ev) =>
        ev.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const matchesCategory =
      filterCategory === "all" || skill.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const activeSkill =
    filteredSkills.find((s) => s.name === selectedSkillName) ||
    filteredSkills[0] ||
    currentCandidate.skills[0];

  return (
    <div className="space-y-6">
      {/* Top Banner / Explainer */}
      <EditorialCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#B08D57]/10 text-[#B08D57]">
                <GitBranch className="h-3.5 w-3.5" />
              </span>
              <h2
                className="text-xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Evidence Graph & Provenance Explorer
              </h2>
            </div>
            <p className="text-xs text-[#475569] max-w-2xl leading-relaxed font-sans">
              Evaluate verified candidate skill claims backed by cryptographic code commits, proctored assessments, and official university credentials instead of passive resume keywords.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-2 rounded-xl text-right">
              <div className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider">
                Audited Provenance
              </div>
              <div className="font-mono text-xs font-bold text-[#111827] flex items-center justify-end gap-1.5 mt-0.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#166534]" />
                <span>Zero Demographic Bias</span>
              </div>
            </div>
          </div>
        </div>
      </EditorialCard>

      {/* Candidate Selector Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {candidates.map((c) => {
          const isSelected = c.id === currentCandidate.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedCandidateId(c.id);
                setSelectedSkillName(null);
              }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "border-[#B08D57] bg-[#FFFFFF] shadow-sm ring-1 ring-[#B08D57]/30"
                  : "border-[#E5E1D8] bg-[#FFFFFF]/70 hover:bg-[#FFFFFF] hover:border-[#B08D57]/40"
              }`}
            >
              <div className="h-9 w-9 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                {c.avatar_initials}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                  <span>{c.candidate_name}</span>
                  {isSelected && <CheckCircle2 className="h-3 w-3 text-[#B08D57]" />}
                </div>
                <div className="text-[11px] text-[#64748B] truncate max-w-[150px]">
                  {c.university}
                </div>
              </div>
              <div className="ml-2 pl-2 border-l border-[#E5E1D8] font-mono text-xs text-[#166534] font-bold">
                {c.overall_confidence}%
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Graph & Drill-down Grid */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.3fr]">
        {/* Left Column: Skill Nodes List */}
        <EditorialCard className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
            <div>
              <h3
                className="text-base font-normal text-[#111827] flex items-center gap-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <Layers className="h-4 w-4 text-[#B08D57]" />
                <span>Verified Skills ({currentCandidate.skills.length})</span>
              </h3>
              <p className="text-[11px] text-[#64748B]">
                Select a skill node to inspect its evidence trail
              </p>
            </div>
            <EditorialBadge variant="gold">
              {currentCandidate.overall_confidence}% Avg Confidence
            </EditorialBadge>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter skills or evidence keywords..."
                className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] pl-8 pr-3 py-1.5 font-mono text-xs text-[#111827] placeholder:text-[#64748B] focus:border-[#B08D57] focus:outline-none"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-2.5 py-1.5 font-mono text-xs text-[#475569] focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Languages">Languages</option>
              <option value="Frameworks">Frameworks</option>
              <option value="Databases">Databases</option>
              <option value="AI/ML">AI / ML</option>
              <option value="DevOps">DevOps</option>
            </select>
          </div>

          {/* Skill List Items */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredSkills.map((skill) => {
              const isSelected = skill.name === activeSkill?.name;
              return (
                <div
                  key={skill.name}
                  onClick={() => setSelectedSkillName(skill.name)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-[#B08D57] bg-[rgba(176,141,87,0.06)] shadow-xs"
                      : "border-[#E5E1D8] bg-[#F7F5F0] hover:border-[#B08D57]/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#B08D57]" />
                      <span className="text-sm font-semibold text-[#111827]">
                        {skill.name}
                      </span>
                      <span className="font-mono text-[10px] text-[#64748B] border border-[#E5E1D8] bg-[#FFFFFF] px-2 py-0.5 rounded-md">
                        {skill.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-[#166534] font-bold">
                        {skill.confidence}%
                      </span>
                      <ChevronRight
                        className={`h-3.5 w-3.5 text-[#64748B] transition-transform ${
                          isSelected ? "rotate-90 text-[#B08D57]" : ""
                        }`}
                      />
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#64748B] border-t border-[#E5E1D8]/60 pt-2">
                    <span className="flex items-center gap-1 font-mono">
                      <FileCheck2 className="h-3 w-3 text-[#B08D57]" />
                      {skill.evidence_sources.length} evidence source
                      {skill.evidence_sources.length === 1 ? "" : "s"}
                    </span>
                    <span className="text-[10px] uppercase font-mono font-semibold text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-sm">
                      {skill.verification_tier}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </EditorialCard>

        {/* Right Column: Visual Evidence Provenance Hierarchy */}
        <EditorialCard className="p-6 space-y-5">
          <div className="border-b border-[#E5E1D8] pb-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold">
                Evidence Provenance Trail
              </span>
              <span className="font-mono text-xs text-[#64748B]">
                Confidence: <strong className="text-[#166534]">{activeSkill?.confidence}%</strong>
              </span>
            </div>
            <h3
              className="text-2xl font-normal text-[#111827] mt-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {activeSkill?.name}
            </h3>
            <p className="text-xs text-[#64748B] mt-1">
              Direct verification records linked to candidate <strong className="text-[#111827]">{currentCandidate.candidate_name}</strong>
            </p>
          </div>

          {/* Visual Provenance Tree */}
          <div className="space-y-4">
            {/* Root Node */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E1D8] bg-[#F7F5F0]">
              <div className="h-8 w-8 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                {currentCandidate.avatar_initials}
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold text-[#111827]">
                  {currentCandidate.candidate_name}
                </div>
                <div className="text-[10px] font-mono text-[#64748B]">
                  {currentCandidate.university}
                </div>
              </div>
              <EditorialBadge variant="default">Verified Profile</EditorialBadge>
            </div>

            {/* Tree Branch Visual Connector */}
            <div className="pl-6 border-l-2 border-[#B08D57]/40 space-y-3 ml-4">
              <div className="font-mono text-[11px] text-[#B08D57] font-bold flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3" />
                <span>Extracted Skill: {activeSkill?.name}</span>
              </div>

              {/* Child Evidence Nodes */}
              <div className="space-y-2.5">
                {activeSkill?.evidence_sources.map((ev) => {
                  let icon = <FileCode2 className="h-4 w-4 text-[#B08D57]" />;
                  let typeLabel = "Project Artifact";
                  if (ev.source_type === "github") {
                    icon = <FileCode2 className="h-4 w-4 text-[#2563EB]" />;
                    typeLabel = "GitHub Repository Commits";
                  } else if (ev.source_type === "assessment") {
                    icon = <Award className="h-4 w-4 text-[#D97706]" />;
                    typeLabel = "Proctored Skill Assessment";
                  } else if (ev.source_type === "digilocker") {
                    icon = <Building2 className="h-4 w-4 text-[#166534]" />;
                    typeLabel = "DigiLocker Verified Credential";
                  } else if (ev.source_type === "internship") {
                    icon = <Building2 className="h-4 w-4 text-[#9333EA]" />;
                    typeLabel = "Faculty / Industry Capstone";
                  }

                  return (
                    <motion.div
                      key={ev.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-xl border border-[#E5E1D8] bg-[#FFFFFF] space-y-2 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-md bg-[#F7F5F0]">{icon}</span>
                          <div>
                            <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] block">
                              {typeLabel}
                            </span>
                            <h4 className="text-xs font-bold text-[#111827]">
                              {ev.title}
                            </h4>
                          </div>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-md shrink-0">
                          +{ev.confidence_contrib}% weight
                        </span>
                      </div>

                      <p className="text-xs text-[#475569] leading-relaxed font-sans pl-7">
                        {ev.details}
                      </p>

                      {ev.proof_hash && (
                        <div className="flex items-center gap-2 pl-7 pt-1 font-mono text-[10px] text-[#64748B]">
                          <Lock className="h-3 w-3 text-[#B08D57]" />
                          <span className="truncate">Proof Hash: {ev.proof_hash}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </EditorialCard>
      </div>
    </div>
  );
}
