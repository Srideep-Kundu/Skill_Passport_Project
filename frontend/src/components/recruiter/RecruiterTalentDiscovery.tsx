import { useState } from "react";
import {
  Search,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { EditorialCard, EditorialButton } from "../ui/EditorialPrimitives";

interface DiscoveredCandidate {
  id: string;
  name: string;
  avatar: string;
  university: string;
  targetRole: string;
  overallScore: number;
  verificationRate: number;
  skills: Array<{ name: string; category: string; verified: boolean; confidence: number }>;
  primaryEvidence: string;
  githubRepos: number;
}

const DISCOVERED_CANDIDATES: DiscoveredCandidate[] = [
  {
    id: "cand-maya",
    name: "Maya Rivera",
    avatar: "MR",
    university: "Harbor Polytechnic University",
    targetRole: "Full-Stack & Distributed Systems",
    overallScore: 94,
    verificationRate: 100,
    skills: [
      { name: "Python", category: "Languages", verified: true, confidence: 96 },
      { name: "FastAPI", category: "Frameworks", verified: true, confidence: 93 },
      { name: "PostgreSQL", category: "Databases", verified: true, confidence: 91 },
      { name: "pgvector", category: "Databases", verified: true, confidence: 91 },
      { name: "Docker", category: "DevOps", verified: true, confidence: 86 },
    ],
    primaryEvidence: "148 verified commits across 3 production repositories + 98% Proctored Algorithm Score",
    githubRepos: 3,
  },
  {
    id: "cand-rahul",
    name: "Rahul Sharma",
    avatar: "RS",
    university: "IIIT Hyderabad",
    targetRole: "Backend Systems Architect",
    overallScore: 91,
    verificationRate: 95,
    skills: [
      { name: "Python", category: "Languages", verified: true, confidence: 95 },
      { name: "PostgreSQL", category: "Databases", verified: true, confidence: 92 },
      { name: "Redis", category: "Databases", verified: true, confidence: 89 },
    ],
    primaryEvidence: "200+ commits on asynchronous task processing systems + ACID ledger schema",
    githubRepos: 5,
  },
  {
    id: "cand-aarav",
    name: "Aarav Singh",
    avatar: "AS",
    university: "NIT Trichy",
    targetRole: "AI / ML Systems Engineer",
    overallScore: 90,
    verificationRate: 92,
    skills: [
      { name: "PyTorch", category: "AI/ML", verified: true, confidence: 94 },
      { name: "Transformers", category: "AI/ML", verified: true, confidence: 92 },
      { name: "Python", category: "Languages", verified: true, confidence: 92 },
    ],
    primaryEvidence: "Vision Transformer fine-tuning project + ONNX tensor runtime benchmark",
    githubRepos: 2,
  },
  {
    id: "cand-priya",
    name: "Priya Patel",
    avatar: "PP",
    university: "IIT Bombay",
    targetRole: "Full-Stack Web Engineer",
    overallScore: 87,
    verificationRate: 88,
    skills: [
      { name: "React", category: "Frontend", verified: true, confidence: 90 },
      { name: "TypeScript", category: "Languages", verified: true, confidence: 88 },
      { name: "Python", category: "Languages", verified: true, confidence: 85 },
      { name: "Django", category: "Frameworks", verified: true, confidence: 86 },
    ],
    primaryEvidence: "Campus placement web portal capstone + 2 open source npm libraries",
    githubRepos: 2,
  },
];

export function RecruiterTalentDiscovery() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUniversity, setSelectedUniversity] = useState("all");
  const [minConfidence, setMinConfidence] = useState(80);
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const filteredCandidates = DISCOVERED_CANDIDATES.filter((cand) => {
    const matchesSearch =
      cand.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cand.targetRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cand.skills.some((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesUni =
      selectedUniversity === "all" || cand.university === selectedUniversity;
    const matchesConfidence = cand.overallScore >= minConfidence;
    const matchesVerified = !verifiedOnly || cand.verificationRate === 100;
    return matchesSearch && matchesUni && matchesConfidence && matchesVerified;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Banner */}
      <EditorialCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#B08D57]/10 text-[#B08D57]">
                <Search className="h-3.5 w-3.5" />
              </span>
              <h2
                className="text-xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Talent Discovery & Verification Market
              </h2>
            </div>
            <p className="text-xs text-[#475569] max-w-2xl leading-relaxed">
              Discover verified candidates across partner institutions using audited skill criteria, proof depth, and direct cryptographic provenance.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-[#64748B]">
            <span className="font-bold text-[#111827]">{filteredCandidates.length}</span> candidates found
          </div>
        </div>
      </EditorialCard>

      {/* Filter Control Bar */}
      <div className="p-4 rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] space-y-3">
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-4">
          {/* Search Input */}
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, skill taxonomy (e.g. Python, FastAPI, PyTorch)..."
              className="w-full rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] pl-9 pr-4 py-2 font-mono text-xs text-[#111827] placeholder:text-[#64748B] focus:border-[#B08D57] focus:outline-none"
            />
          </div>

          {/* University Selector */}
          <div>
            <select
              value={selectedUniversity}
              onChange={(e) => setSelectedUniversity(e.target.value)}
              className="w-full rounded-xl border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 font-mono text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none cursor-pointer"
            >
              <option value="all">All Partner Universities</option>
              <option value="Harbor Polytechnic University">Harbor Polytechnic University</option>
              <option value="IIIT Hyderabad">IIIT Hyderabad</option>
              <option value="NIT Trichy">NIT Trichy</option>
              <option value="IIT Bombay">IIT Bombay</option>
            </select>
          </div>

          {/* Verification Only Checkbox */}
          <div className="flex items-center gap-2 pl-2">
            <input
              type="checkbox"
              id="verifiedFilter"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="rounded border-[#E5E1D8] text-[#B08D57] focus:ring-[#B08D57] cursor-pointer"
            />
            <label
              htmlFor="verifiedFilter"
              className="font-mono text-xs text-[#475569] cursor-pointer select-none"
            >
              100% Cryptographically Verified
            </label>
          </div>
        </div>

        {/* Confidence Slider */}
        <div className="flex items-center gap-4 pt-2 border-t border-[#E5E1D8] font-mono text-xs text-[#64748B]">
          <span>Min Confidence: <strong className="text-[#111827]">{minConfidence}%</strong></span>
          <input
            type="range"
            min={70}
            max={95}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className="w-48 accent-[#B08D57] cursor-pointer"
          />
        </div>
      </div>

      {/* Candidates Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {filteredCandidates.map((cand) => (
          <EditorialCard key={cand.id} className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  {cand.avatar}
                </div>
                <div>
                  <h3 className="text-base font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                    {cand.name}
                  </h3>
                  <p className="text-xs text-[#475569]">{cand.targetRole}</p>
                  <div className="font-mono text-[10px] text-[#64748B] flex items-center gap-1.5 mt-0.5">
                    <GraduationCap className="h-3 w-3 text-[#B08D57]" />
                    <span>{cand.university}</span>
                  </div>
                </div>
              </div>

              <div className="text-right font-mono shrink-0">
                <span className="text-2xl font-normal text-[#111827] block leading-none" style={{ fontFamily: "var(--font-display)" }}>
                  {cand.overallScore}%
                </span>
                <span className="text-[9px] uppercase text-[#166534] font-bold">
                  Verified Score
                </span>
              </div>
            </div>

            {/* Verified Skills */}
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] uppercase text-[#64748B] tracking-wider block">
                Verified Skill Competencies
              </span>
              <div className="flex flex-wrap gap-1.5">
                {cand.skills.map((s) => (
                  <span
                    key={s.name}
                    className="font-mono text-[10px] border border-[#E5E1D8] bg-[#F7F5F0] px-2 py-0.5 rounded-md text-[#111827] flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 text-[#166534]" />
                    <span>{s.name}</span>
                    <span className="text-[9px] text-[#64748B]">({s.confidence}%)</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Evidence Provenance Snippet */}
            <div className="p-3 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] text-xs text-[#475569] font-sans leading-relaxed">
              <strong className="text-[#111827] font-mono text-[10px] uppercase tracking-wider block mb-0.5">
                Primary Audited Evidence:
              </strong>
              {cand.primaryEvidence}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-[#E5E1D8]">
              <span className="font-mono text-[10px] text-[#166534] bg-[#DCFCE7] px-2 py-0.5 rounded-sm font-bold flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                <span>100% Audited</span>
              </span>

              <EditorialButton variant="secondary" size="sm">
                Add to Pipeline
              </EditorialButton>
            </div>
          </EditorialCard>
        ))}
      </div>
    </div>
  );
}
