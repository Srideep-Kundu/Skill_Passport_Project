import { useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { ApiError, api } from "../api";
import type { TeamSuggestion } from "../api";
import { EmptyState } from "../components/AsyncState";

export function TeamSuggestions({
  token,
  availableSkillIds,
}: {
  token: string;
  availableSkillIds: string[];
}) {
  const [targets, setTargets] = useState("");
  const [pool, setPool] = useState("");
  const [suggestions, setSuggestions] = useState<TeamSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const targetSkillSet = targets
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const studentPool = pool
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    try {
      const result = await api.suggestTeams(
        {
          target_skill_set: targetSkillSet.length ? targetSkillSet : availableSkillIds,
          pool: studentPool,
        },
        token
      );
      setSuggestions(result);
      toast.success("Team complementarity suggestions computed!");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Team suggestions could not be computed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-md p-5 sm:p-6 shadow-sm space-y-4 text-slate-900 dark:text-[#f1f0e8]">
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
          <Users className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
          <span>Form a Complementary Team</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
          Deterministic pairing that maximizes coverage across required skill sets while penalizing redundancy.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] font-sans">
          Target Skill Identifiers{" "}
          <span className="font-normal text-slate-400 dark:text-[#98a4b3] text-[11px]">(comma separated; leave blank to use your passport skills)</span>
          <input
            value={targets}
            onChange={(event) => setTargets(event.target.value)}
            placeholder="e.g. skill-python, skill-react, skill-docker"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3 py-1.5 text-xs focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
          />
        </label>

        <label className="block text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] font-sans">
          Student Identifiers in Candidate Pool
          <input
            required
            value={pool}
            onChange={(event) => setPool(event.target.value)}
            placeholder="e.g. student-id-1, student-id-2, student-id-3"
            className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3 py-1.5 text-xs focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
          />
        </label>

        {error && (
          <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[#3b71d9] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-[#3b71d9]/25 hover:bg-[#2563eb] focus:outline-none disabled:opacity-50 transition-colors cursor-pointer font-sans"
        >
          {isSubmitting ? "Computing Pairs..." : "Generate Team Suggestions"}
        </button>
      </form>

      {suggestions &&
        (suggestions.length ? (
          <ol className="space-y-2 pt-2">
            {suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.pair.join("-")}-${index}`}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-3.5 text-slate-900 dark:text-[#f1f0e8]"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-[#f1f0e8] block font-sans">
                    {suggestion.pair.join(" + ")}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-[#98a4b3] font-sans">
                    Pairing Rank #{index + 1}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-[#3b71d9] dark:text-[#b0c6ff] block font-sans">
                    {Math.round(suggestion.complementarity_score * 100)}%
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-[#98a4b3] font-semibold uppercase font-sans">
                    Synergy Score
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No complementary teams found">
            Try expanding the candidate pool with more student IDs.
          </EmptyState>
        ))}
    </section>
  );
}
