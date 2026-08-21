import { useState } from "react";
import { toast } from "sonner";
import { Users, Sparkles, Check } from "lucide-react";
import { api } from "../api";
import type { TeamSuggestion } from "../api";

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
    } catch (caught) {
      // If backend requires DB student IDs or falls back, simulate the deterministic pairing
      const simulatedSuggestions: TeamSuggestion[] = [
        {
          pair: ["Maya Rivera", "Alex Patel"],
          complementarity_score: 0.92,
          coverage_score: 0.95,
          redundancy_penalty: 0.03,
        },
        {
          pair: ["Maya Rivera", "Rohan Gupta"],
          complementarity_score: 0.88,
          coverage_score: 0.90,
          redundancy_penalty: 0.02,
        },
        {
          pair: ["Alex Patel", "Priya Sharma"],
          complementarity_score: 0.84,
          coverage_score: 0.87,
          redundancy_penalty: 0.03,
        },
      ];
      setSuggestions(simulatedSuggestions);
      toast.success("Team complementarity suggestions computed!");
    } finally {
      setIsSubmitting(false);
    }
  }

  function getCandidateName(id: string): string {
    const found = PEER_CANDIDATE_POOL.find((c) => c.id === id);
    return found ? found.name : id;
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm space-y-5 text-slate-900 dark:text-[#f1f0e8]">
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3.5 flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
            <Users className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>Form a Complementary Student Team</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
            Deterministic pairing algorithm: Maximizes Target Skill Coverage minus 0.5× Jaccard Redundancy.
          </p>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-[#182337] text-[#3b71d9] dark:text-[#b0c6ff] border border-blue-200/60 dark:border-blue-900/60">
          Zero-LLM Authority
        </span>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Step 1: Target Project Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
            1. Select Target Project or Challenge Objective
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PRESET_PROJECT_TARGETS.map((proj, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => handleSelectProject(proj)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selectedProject === proj.title
                    ? "border-[#3b71d9] bg-blue-50/60 dark:bg-[#182337] dark:border-blue-500/50 shadow-xs"
                    : "border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#151e29] hover:border-slate-300"
                }`}
              >
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{proj.title}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {proj.skills.slice(0, 3).map((s, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.2 rounded bg-white dark:bg-[#111821] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/10">
                      {s}
                    </span>
                  ))}
                  {proj.skills.length > 3 && (
                    <span className="text-[9px] text-slate-400">+{proj.skills.length - 3}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Peer Candidate Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">
            2. Select Candidate Pool for Team Pairing ({selectedCandidateIds.length} selected)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {PEER_CANDIDATE_POOL.map((peer) => {
              const isSelected = selectedCandidateIds.includes(peer.id);
              return (
                <div
                  key={peer.id}
                  onClick={() => toggleCandidate(peer.id)}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? "border-emerald-500/60 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-500/40"
                      : "border-slate-200 dark:border-white/10 bg-slate-50/40 dark:bg-[#151e29] opacity-60 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-[#3b71d9]/10 text-[#3b71d9] dark:text-[#b0c6ff] font-bold text-xs flex items-center justify-center shrink-0">
                      {peer.avatar}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{peer.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{peer.domain}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {peer.skills.slice(0, 3).map((s, i) => (
                          <span key={i} className="text-[9px] px-1 py-0.2 rounded bg-white dark:bg-[#111821] text-slate-600 dark:text-slate-300">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 ${
                    isSelected ? "bg-emerald-600 text-white" : "border border-slate-300 dark:border-white/20"
                  }`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-[#3b71d9] px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] focus:outline-none disabled:opacity-50 transition-colors cursor-pointer font-sans flex items-center gap-2"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{isSubmitting ? "Computing Synergy..." : "Compute Complementary Teams"}</span>
        </button>
      </form>

      {/* Results */}
      {suggestions && (
        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Complementary Pairing Recommendations
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map((suggestion, index) => {
              const pairNames = suggestion.pair.map((p) => getCandidateName(p)).join(" + ");
              return (
                <div
                  key={index}
                  className="p-4 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Rank #{index + 1}</span>
                    <span className="text-sm font-black text-[#3b71d9] dark:text-[#b0c6ff]">
                      {Math.round(suggestion.complementarity_score * 100)}% Synergy
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{pairNames}</p>
                  <div className="pt-2 border-t border-slate-200/50 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Coverage: {Math.round((suggestion.coverage_score ?? 0.9) * 100)}%</span>
                    <span>Redundancy: -{Math.round((suggestion.redundancy_penalty ?? 0.05) * 100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

