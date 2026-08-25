import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { api } from "../api";
import type { TeamSuggestion } from "../api";
import { EditorialButton, EditorialPageHeader } from "../components/ui/EditorialPrimitives";

interface CandidatePeer {
  id: string;
  name: string;
  avatar: string;
  domain: string;
  skills: string[];
}

const PEER_CANDIDATE_POOL: CandidatePeer[] = [
  {
    id: "maya-rivera",
    name: "Maya Rivera (You)",
    avatar: "MR",
    domain: "Backend Systems",
    skills: ["Python", "FastAPI", "PostgreSQL", "Docker", "REST API"],
  },
  {
    id: "alex-patel",
    name: "Alex Patel",
    avatar: "AP",
    domain: "Frontend Architecture",
    skills: ["React", "TypeScript", "Tailwind CSS", "Recharts", "Next.js"],
  },
  {
    id: "rohan-gupta",
    name: "Rohan Gupta",
    avatar: "RG",
    domain: "Cloud & DevOps",
    skills: ["Kubernetes", "AWS", "CI/CD", "Docker", "Terraform"],
  },
  {
    id: "priya-sharma",
    name: "Priya Sharma",
    avatar: "PS",
    domain: "Data & ML Platform",
    skills: ["Python", "PyTorch", "pgvector", "Embeddings", "FastAPI"],
  },
  {
    id: "ananya-deshmukh",
    name: "Ananya Deshmukh",
    avatar: "AD",
    domain: "Security & Testing",
    skills: ["OAuth", "JWT", "Pytest", "PostgreSQL", "Linux"],
  },
];

const PRESET_PROJECT_TARGETS = [
  {
    title: "National Smart India Hackathon Challenge",
    skills: ["Python", "FastAPI", "React", "TypeScript", "PostgreSQL"],
  },
  {
    title: "High-Concurrency Cloud & Cache Proxy",
    skills: ["Python", "Redis", "Docker", "Kubernetes", "AWS"],
  },
  {
    title: "Production pgvector & Vector Search Engine",
    skills: ["PostgreSQL", "pgvector", "Python", "Embeddings", "FastAPI"],
  },
];

export function TeamSuggestions({
  token,
  availableSkillIds,
}: {
  token: string;
  availableSkillIds: string[];
}) {
  const [selectedProject, setSelectedProject] = useState(PRESET_PROJECT_TARGETS[0].title);
  const [targetSkills, setTargetSkills] = useState<string[]>(PRESET_PROJECT_TARGETS[0].skills);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([
    "maya-rivera",
    "alex-patel",
    "rohan-gupta",
    "priya-sharma",
  ]);
  const [suggestions, setSuggestions] = useState<TeamSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleCandidate(id: string) {
    if (selectedCandidateIds.includes(id)) {
      if (selectedCandidateIds.length <= 2) {
        toast.error("Pool must contain at least 2 candidates for team complementarity.");
        return;
      }
      setSelectedCandidateIds((prev) => prev.filter((item) => item !== id));
    } else {
      setSelectedCandidateIds((prev) => [...prev, id]);
    }
  }

  function handleSelectProject(proj: typeof PRESET_PROJECT_TARGETS[0]) {
    setSelectedProject(proj.title);
    setTargetSkills(proj.skills);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await api.suggestTeams(
        {
          target_skill_set: targetSkills.length ? targetSkills : availableSkillIds,
          pool: selectedCandidateIds,
        },
        token
      );
      setSuggestions(result);
      toast.success("Team complementarity suggestions computed!");
    } catch {
      setSuggestions([]);
      toast.error("Team suggestions could not be computed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getCandidateName(id: string): string {
    const found = PEER_CANDIDATE_POOL.find((c) => c.id === id);
    return found ? found.name : id;
  }

  return (
    <div className="space-y-6 font-sans">
      <EditorialPageHeader
        category="STUDENT"
        index="TEAM"
        title="Form a Complementary Student Team"
        subtitle="Deterministic pairing algorithm: Maximizes Target Skill Coverage minus 0.5× Jaccard Redundancy."
      />

      <form onSubmit={submit} className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-6">
        {/* Step 1: Target Project Selector */}
        <div className="space-y-3">
          <label className="block font-mono text-xs text-[#8796A2] uppercase tracking-wider">
            1. Select Target Project or Challenge Objective
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PRESET_PROJECT_TARGETS.map((proj, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => handleSelectProject(proj)}
                className={`p-4 rounded-sm border text-left transition-colors cursor-pointer ${
                  selectedProject === proj.title
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-white/10 bg-white/[0.01] text-[#BEC8CF] hover:border-white/20 hover:text-white"
                }`}
              >
                <p className="font-mono text-xs font-semibold leading-snug">{proj.title}</p>
                <div className="pt-2 font-mono text-[11px] text-[#8796A2]">
                  {proj.skills.join(" · ")}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Peer Candidate Selector */}
        <div className="space-y-3">
          <label className="block font-mono text-xs text-[#8796A2] uppercase tracking-wider">
            2. Select Candidate Pool ({selectedCandidateIds.length} selected)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PEER_CANDIDATE_POOL.map((peer) => {
              const isSelected = selectedCandidateIds.includes(peer.id);
              return (
                <div
                  key={peer.id}
                  onClick={() => toggleCandidate(peer.id)}
                  className={`p-4 rounded-sm border flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? "border-[#9CC7D8]/40 bg-[#9CC7D8]/10 text-white"
                      : "border-white/10 bg-white/[0.01] text-[#8796A2] hover:border-white/20 hover:text-[#BEC8CF]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-7 w-7 rounded-sm border border-white/15 bg-white/5 text-white font-mono text-xs flex items-center justify-center shrink-0">
                      {peer.avatar}
                    </div>
                    <div>
                      <p className="font-mono text-xs font-semibold text-[#F7F8F8] leading-tight">{peer.name}</p>
                      <p className="font-mono text-[10px] text-[#8796A2] mt-0.5">{peer.domain}</p>
                      <p className="font-mono text-[10px] text-[#BEC8CF] pt-1">
                        {peer.skills.join(" · ")}
                      </p>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-xs flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-[#9CC7D8] text-[#021522]" : "border border-white/20"
                  }`}>
                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="font-mono text-xs text-red-300">
            {error}
          </p>
        )}

        <EditorialButton
          variant="primary"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Computing Synergy..." : "Compute Complementary Teams"}
        </EditorialButton>
      </form>

      {/* Results */}
      {suggestions && (
        <div className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-4">
          <h3
            className="text-lg font-normal text-[#F7F8F8] border-b border-white/10 pb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Complementary Pairing Recommendations
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map((suggestion, index) => {
              const pairNames = suggestion.pair.map((p) => getCandidateName(p)).join(" + ");
              return (
                <div
                  key={index}
                  className="p-4 rounded-sm border border-white/10 bg-white/[0.01] space-y-2 font-mono"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase text-[#8796A2]">Rank #{index + 1}</span>
                    <span className="text-xs text-[#9CC7D8] font-bold">
                      {Math.round(suggestion.complementarity_score * 100)}% Synergy
                    </span>
                  </div>
                  <p className="text-xs text-[#F7F8F8] font-semibold font-sans">{pairNames}</p>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-[#8796A2]">
                    <span>Coverage: {Math.round((suggestion.coverage_score ?? 0.9) * 100)}%</span>
                    <span>Redundancy: -{Math.round((suggestion.redundancy_penalty ?? 0.05) * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
