import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Target,
  Search,
  Sparkles,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Send,
  Building2,
  MapPin,
  Clock,
  X,
  SlidersHorizontal,
  FileCheck2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { ApiError, api } from "../api";
import type { Application, ExternalJobMatch } from "../api";
import { ApplicationPreparation } from "./ApplicationPreparation";
import { LoadingState, ErrorState } from "./AsyncState";

interface InternshipMatchesProps {
  token: string;
  onNavigateToDiscovery?: () => void;
}

type ProviderFilter = "all" | "yc" | "greenhouse" | "lever" | "ashby";
type SortOption = "best_match" | "newest" | "recently_added";

function getProviderBadge(provider: string) {
  const norm = provider.toLowerCase();
  if (norm.includes("yc")) {
    return {
      label: "YC STARTUP",
      bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
    };
  }
  if (norm.includes("greenhouse")) {
    return {
      label: "GREENHOUSE",
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    };
  }
  if (norm.includes("lever")) {
    return {
      label: "LEVER",
      bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    };
  }
  if (norm.includes("ashby")) {
    return {
      label: "ASHBY",
      bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    };
  }
  return {
    label: provider.toUpperCase(),
    bg: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30",
  };
}

function getEvidenceStrength(match: ExternalJobMatch): { label: "Strong" | "Good" | "Partial"; color: string } {
  if (match.verification_bonus >= 0.08 || match.deterministic_score >= 0.8) {
    return { label: "Strong", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/30" };
  }
  if (match.verification_bonus >= 0.04 || match.deterministic_score >= 0.5) {
    return { label: "Good", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-500/30" };
  }
  return { label: "Partial", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-500/30" };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Recently posted";
  const date = new Date(dateStr);
  if (Number.isNaN(date.valueOf())) return "Recently posted";
  const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 0) return "Posted today";
  if (daysAgo === 1) return "Posted yesterday";
  return `Posted ${daysAgo}d ago`;
}

export function InternshipMatches({ token, onNavigateToDiscovery }: InternshipMatchesProps) {
  const [matches, setMatches] = useState<ExternalJobMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [indiaOnly, setIndiaOnly] = useState(false);
  const [internshipOnly, setInternshipOnly] = useState(false);
  const [entryLevelOnly, setEntryLevelOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("best_match");

  // Interaction States
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("saved_matched_job_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [activeExplanationMatch, setActiveExplanationMatch] = useState<ExternalJobMatch | null>(null);
  const [applicationInReview, setApplicationInReview] = useState<Application | null>(null);
  const [preparingMatchId, setPreparingMatchId] = useState<string | null>(null);

  const loadMatches = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const response = await api.externalJobMatches(token, {
          page: 1,
          pageSize: 50,
          provider: providerFilter === "all" ? undefined : providerFilter,
          remote: remoteOnly ? true : undefined,
          location: indiaOnly ? "India" : undefined,
          employmentType: internshipOnly ? "internship" : undefined,
          query: searchQuery.trim() || undefined,
          sortBy,
        });

        setMatches(response.items);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Failed to load internship matches.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, providerFilter, remoteOnly, indiaOnly, internshipOnly, searchQuery, sortBy]
  );

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const handleToggleSave = (jobId: string) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
        toast.info("Removed from saved opportunities");
      } else {
        next.add(jobId);
        toast.success("Opportunity saved to your watchlist");
      }
      try {
        localStorage.setItem("saved_matched_job_ids", JSON.stringify(Array.from(next)));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const handleSyncAndRecompute = async () => {
    try {
      setRefreshing(true);
      toast.loading("Discovering fresh opportunities across YC, Greenhouse, Lever, and Ashby...");
      await api.syncAllExternalJobs(token);
      toast.dismiss();
      toast.success("Live opportunities refreshed & ranked!");
      await loadMatches(true);
    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof ApiError ? err.detail : "Failed to refresh opportunities.");
      setRefreshing(false);
    }
  };

  const handlePrepareApplication = async (match: ExternalJobMatch) => {
    try {
      setPreparingMatchId(match.id);
      const app = await api.createApplication(match.external_job_id, match.id, token);
      setApplicationInReview(app);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not initialize application preparation.");
    } finally {
      setPreparingMatchId(null);
    }
  };

  const filteredMatches = useMemo(() => {
    let result = matches;
    if (entryLevelOnly) {
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes("intern") ||
          m.title.toLowerCase().includes("entry") ||
          m.title.toLowerCase().includes("junior") ||
          m.title.toLowerCase().includes("graduate")
      );
    }
    return result;
  }, [matches, entryLevelOnly]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#111821]/80 backdrop-blur-md p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-[#4f46e5] dark:text-[#38bdf8]">
                <Target className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#4f46e5] dark:text-[#38bdf8] font-sans">
                Deterministic Recommendation Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-[#f1f0e8] tracking-tight font-sans">
              Ranked Internship Opportunities
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#98a4b3] font-sans">
              Live opportunities ranked against your verified Skill Passport evidence.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={refreshing || loading}
              onClick={handleSyncAndRecompute}
              className="flex items-center gap-2 rounded-xl bg-[#4f46e5] dark:bg-[#38bdf8] px-4 py-2.5 text-xs font-bold text-white dark:text-slate-950 shadow-md shadow-indigo-500/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Refreshing..." : "Discover & Refresh"}</span>
            </button>
          </div>
        </div>

        {/* TOP CONTROLS & FILTER CHIPS */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/[0.08] space-y-4">
          {/* Search and Sort Bar */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-[#8ea2c6]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search opportunities by title, company, or keywords..."
                className="w-full rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#151e29] pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-[#f1f0e8] placeholder:text-slate-400 focus:border-[#4f46e5] focus:outline-none transition-all font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-slate-400 dark:text-[#8ea2c6] hidden sm:block" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort opportunities"
                className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#151e29] px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] focus:border-[#4f46e5] focus:outline-none cursor-pointer font-sans"
              >
                <option value="best_match">Sort by: Best Match</option>
                <option value="newest">Sort by: Newest</option>
                <option value="recently_added">Sort by: Recently Added</option>
              </select>
            </div>
          </div>

          {/* Source Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
              Source:
            </span>
            {[
              { id: "all", label: "All Sources" },
              { id: "yc", label: "YC" },
              { id: "greenhouse", label: "Greenhouse" },
              { id: "lever", label: "Lever" },
              { id: "ashby", label: "Ashby" },
            ].map((source) => {
              const active = providerFilter === source.id;
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setProviderFilter(source.id as ProviderFilter)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-sans ${
                    active
                      ? "bg-[#4f46e5] dark:bg-[#182337] text-white dark:text-[#38bdf8] border border-transparent dark:border-[#38bdf8]/40 shadow-xs"
                      : "bg-slate-100 dark:bg-[#151e29] text-slate-600 dark:text-[#8ea2c6] hover:bg-slate-200/70 dark:hover:bg-[#1c2838] border border-slate-200/60 dark:border-white/[0.06]"
                  }`}
                >
                  {source.label}
                </button>
              );
            })}

            <div className="hidden sm:block h-4 w-[1px] bg-slate-200 dark:bg-white/10 mx-1" />

            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
              Filter:
            </span>
            <button
              type="button"
              onClick={() => setRemoteOnly((v) => !v)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-sans ${
                remoteOnly
                  ? "bg-[#4f46e5] dark:bg-[#182337] text-white dark:text-[#38bdf8] border border-transparent dark:border-[#38bdf8]/40"
                  : "bg-slate-100 dark:bg-[#151e29] text-slate-600 dark:text-[#8ea2c6] hover:bg-slate-200/70 dark:hover:bg-[#1c2838] border border-slate-200/60 dark:border-white/[0.06]"
              }`}
            >
              Remote
            </button>
            <button
              type="button"
              onClick={() => setIndiaOnly((v) => !v)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-sans ${
                indiaOnly
                  ? "bg-[#4f46e5] dark:bg-[#182337] text-white dark:text-[#38bdf8] border border-transparent dark:border-[#38bdf8]/40"
                  : "bg-slate-100 dark:bg-[#151e29] text-slate-600 dark:text-[#8ea2c6] hover:bg-slate-200/70 dark:hover:bg-[#1c2838] border border-slate-200/60 dark:border-white/[0.06]"
              }`}
            >
              India
            </button>
            <button
              type="button"
              onClick={() => setInternshipOnly((v) => !v)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-sans ${
                internshipOnly
                  ? "bg-[#4f46e5] dark:bg-[#182337] text-white dark:text-[#38bdf8] border border-transparent dark:border-[#38bdf8]/40"
                  : "bg-slate-100 dark:bg-[#151e29] text-slate-600 dark:text-[#8ea2c6] hover:bg-slate-200/70 dark:hover:bg-[#1c2838] border border-slate-200/60 dark:border-white/[0.06]"
              }`}
            >
              Internship
            </button>
            <button
              type="button"
              onClick={() => setEntryLevelOnly((v) => !v)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-sans ${
                entryLevelOnly
                  ? "bg-[#4f46e5] dark:bg-[#182337] text-white dark:text-[#38bdf8] border border-transparent dark:border-[#38bdf8]/40"
                  : "bg-slate-100 dark:bg-[#151e29] text-slate-600 dark:text-[#8ea2c6] hover:bg-slate-200/70 dark:hover:bg-[#1c2838] border border-slate-200/60 dark:border-white/[0.06]"
              }`}
            >
              Entry Level
            </button>
          </div>
        </div>
      </div>

      {/* MATCH CARDS LIST */}
      {loading ? (
        <LoadingState label="Computing deterministic match scores against verified Skill Passport..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadMatches()} />
      ) : filteredMatches.length === 0 ? (
        /* ACTIONABLE EMPTY STATE */
        <div className="rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#111821]/80 backdrop-blur-md p-10 sm:p-14 text-center space-y-4 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-[#151e29] text-[#4f46e5] dark:text-[#38bdf8] border border-indigo-200/60 dark:border-white/10">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">
              Find opportunities matched to your skills
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
              Synchronize real startup and tech postings from YC, Greenhouse, Lever, and Ashby to discover personalized, verified recommendations.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSyncAndRecompute}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl bg-[#4f46e5] dark:bg-[#38bdf8] px-5 py-2.5 text-xs font-bold text-white dark:text-slate-950 shadow-md shadow-indigo-500/20 hover:opacity-90 transition-all cursor-pointer font-sans"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>Discover internships</span>
            </button>
            {onNavigateToDiscovery && (
              <button
                type="button"
                onClick={onNavigateToDiscovery}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#151e29] px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-[#f1f0e8] hover:bg-slate-100 dark:hover:bg-[#1c2838] transition-all cursor-pointer font-sans"
              >
                Browse Job Market
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-5">
          {filteredMatches.map((match) => {
            const providerBadge = getProviderBadge(match.provider);
            const strength = getEvidenceStrength(match);
            const isSaved = savedJobIds.has(match.external_job_id);

            // Separate matched vs missing from explanation items if available
            const matchedSkills = match.explanation?.items?.filter((i) => i.status !== "missing") || [];
            const missingSkills = match.explanation?.items?.filter((i) => i.status === "missing") || [];

            return (
              <motion.article
                key={match.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-slate-200/80 dark:border-white/[0.08] bg-white/90 dark:bg-[#111821]/90 backdrop-blur-md p-6 sm:p-7 shadow-sm hover:border-[#4f46e5]/40 dark:hover:border-[#38bdf8]/40 transition-all duration-300 relative overflow-hidden group"
              >
                {/* Ambient glow accent */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#4f46e5]/40 dark:via-[#38bdf8]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  {/* Left Column: Job Info */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${providerBadge.bg}`}>
                        {providerBadge.label}
                      </span>
                      <span className={`rounded-lg border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${strength.color}`}>
                        {strength.label} Evidence
                      </span>
                    </div>

                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-[#f1f0e8] group-hover:text-[#4f46e5] dark:group-hover:text-[#38bdf8] transition-colors font-sans">
                        {match.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-600 dark:text-[#98a4b3] font-sans">
                        <span className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {match.company_name}
                        </span>
                        {match.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {match.location}
                          </span>
                        )}
                        {match.remote_status && (
                          <span className="capitalize text-emerald-600 dark:text-emerald-400 font-semibold">
                            &bull; {match.remote_status.replace("_", " ")}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(match.posted_at)}
                        </span>
                      </div>
                    </div>

                    {/* Matched Skills */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-[#8ea2c6] uppercase tracking-wider font-sans">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Matched Skills ({matchedSkills.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {matchedSkills.length > 0 ? (
                          matchedSkills.map((item) => (
                            <span
                              key={item.skill_id}
                              className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 font-sans"
                            >
                              {item.skill_name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">No exact requirements matched yet.</span>
                        )}
                      </div>
                    </div>

                    {/* Missing Skills */}
                    {missingSkills.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-sans">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <span>Missing Skills ({missingSkills.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {missingSkills.map((item) => (
                            <span
                              key={item.skill_id}
                              className="rounded-lg bg-slate-100 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/[0.06] px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-[#8ea2c6] font-sans"
                            >
                              {item.skill_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Score & Action Buttons */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-4 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-white/[0.08]">
                    {/* Large Match Badge */}
                    <div className="text-left lg:text-right">
                      <div className="inline-flex items-baseline gap-1 rounded-2xl bg-indigo-50 dark:bg-[#182337] border border-indigo-200/60 dark:border-[#38bdf8]/30 px-4 py-2 text-indigo-700 dark:text-[#38bdf8] shadow-xs">
                        <span className="text-2xl sm:text-3xl font-black font-sans">
                          {Math.round(match.final_score * 100)}%
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider font-sans">MATCH</span>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-[#8ea2c6] mt-1 font-sans">
                        Exact: {Math.round(match.deterministic_score * 100)}% · Bonus: +{Math.round(match.verification_bonus * 100)}%
                      </p>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveExplanationMatch(match)}
                        className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#151e29] px-3.5 py-2 text-xs font-bold text-[#4f46e5] dark:text-[#38bdf8] hover:bg-slate-100 dark:hover:bg-[#1c2838] transition-colors cursor-pointer font-sans"
                      >
                        Why this match?
                      </button>

                      <a
                        href={match.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#151e29] p-2 text-slate-600 dark:text-[#8ea2c6] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1c2838] transition-colors"
                        title="View original job post"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleToggleSave(match.external_job_id)}
                        className={`rounded-xl border p-2 transition-colors cursor-pointer ${
                          isSaved
                            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-600 dark:text-amber-400"
                            : "border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#151e29] text-slate-500 dark:text-[#8ea2c6] hover:text-slate-900 dark:hover:text-white"
                        }`}
                        title={isSaved ? "Saved" : "Save opportunity"}
                      >
                        {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                      </button>

                      <button
                        type="button"
                        disabled={preparingMatchId === match.id}
                        onClick={() => handlePrepareApplication(match)}
                        className="flex items-center gap-1.5 rounded-xl bg-[#4f46e5] dark:bg-[#38bdf8] px-3.5 py-2 text-xs font-bold text-white dark:text-slate-950 shadow-sm shadow-indigo-500/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer font-sans disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{preparingMatchId === match.id ? "Preparing..." : "Prepare application"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {/* WHY THIS MATCH EXPLANATION MODAL */}
      <AnimatePresence>
        {activeExplanationMatch && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-3xl border border-slate-200/80 dark:border-white/[0.12] bg-white dark:bg-[#111821] shadow-2xl p-6 sm:p-8 space-y-6 text-slate-900 dark:text-[#f1f0e8]"
            >
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/[0.08] pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4f46e5] dark:text-[#38bdf8] font-sans">
                    Deterministic Explainability Breakdown
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-[#f1f0e8] mt-0.5 font-sans">
                    Why You Match: {activeExplanationMatch.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
                    {activeExplanationMatch.company_name} · Matched against your verified Skill Passport
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveExplanationMatch(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#151e29]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Score Breakdown Cards */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/[0.08] p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#8ea2c6] block font-sans">
                    Exact Skills
                  </span>
                  <strong className="text-base sm:text-lg font-black text-[#4f46e5] dark:text-[#38bdf8] font-sans">
                    {Math.round(activeExplanationMatch.deterministic_score * 100)}%
                  </strong>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/[0.08] p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#8ea2c6] block font-sans">
                    Semantic Fit
                  </span>
                  <strong className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400 font-sans">
                    {Math.round(activeExplanationMatch.semantic_score * 100)}%
                  </strong>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/[0.08] p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#8ea2c6] block font-sans">
                    Verification
                  </span>
                  <strong className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-sans">
                    +{Math.round(activeExplanationMatch.verification_bonus * 100)}%
                  </strong>
                </div>
                <div className="rounded-2xl bg-indigo-50 dark:bg-[#182337] border border-indigo-200 dark:border-[#38bdf8]/40 p-3">
                  <span className="text-[10px] uppercase font-bold text-[#4f46e5] dark:text-[#38bdf8] block font-sans">
                    Overall
                  </span>
                  <strong className="text-base sm:text-lg font-black text-[#4f46e5] dark:text-[#38bdf8] font-sans">
                    {Math.round(activeExplanationMatch.final_score * 100)}%
                  </strong>
                </div>
              </div>

              {/* Matched Skills with Evidence */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-sans">
                  Matched Skills & Evidence Provenance
                </h4>
                <div className="space-y-2">
                  {activeExplanationMatch.explanation?.items
                    ?.filter((i) => i.status !== "missing")
                    .map((item) => (
                      <div
                        key={item.skill_id}
                        className="flex items-start gap-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-[#151e29] p-3.5"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 flex-1 min-w-0 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">
                              {item.skill_name}
                            </span>
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              +{Math.round((item.total_contribution || item.contribution || 0) * 100)}% Fit
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] font-sans">
                            {item.evidence_title
                              ? `✓ Demonstrated in: ${item.evidence_title}`
                              : "✓ Verified in student skill passport"}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Missing Skills Section */}
              {activeExplanationMatch.explanation?.items?.some((i) => i.status === "missing") && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-sans">
                    Skills to Learn / Evidence Missing
                  </h4>
                  <div className="space-y-2">
                    {activeExplanationMatch.explanation.items
                      .filter((i) => i.status === "missing")
                      .map((item) => (
                        <div
                          key={item.skill_id}
                          className="flex items-start gap-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-[#151e29] p-3.5"
                        >
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 flex-1 min-w-0 text-xs">
                            <span className="font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">
                              {item.skill_name}
                            </span>
                            <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] font-sans">
                              Not currently verified in your Skill Passport. Upload evidence or take a skill assessment to boost your match score.
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveExplanationMatch(null)}
                  className="rounded-xl bg-[#4f46e5] dark:bg-[#38bdf8] px-5 py-2.5 text-xs font-bold text-white dark:text-slate-950 hover:opacity-90 cursor-pointer font-sans"
                >
                  Close Explanation
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* APPLICATION PREPARATION MODAL */}
      <AnimatePresence>
        {applicationInReview && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-3xl border border-slate-200/80 dark:border-white/[0.12] bg-white dark:bg-[#111821] shadow-2xl p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-[#4f46e5] dark:text-[#38bdf8]" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">
                    Application Review & Verification
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setApplicationInReview(null)}
                  className="rounded-xl p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <ApplicationPreparation
                application={applicationInReview}
                token={token}
                onChanged={(updated) => setApplicationInReview(updated)}
              />

              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex justify-end">
                <button
                  type="button"
                  onClick={() => setApplicationInReview(null)}
                  className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-2 text-xs font-bold text-slate-700 dark:text-[#f1f0e8] hover:bg-slate-100 dark:hover:bg-[#151e29] cursor-pointer font-sans"
                >
                  Done Reviewing
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
