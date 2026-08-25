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
import { LiquidGlassButton } from "./ui/EditorialPrimitives";

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
      bg: "border-white/20 bg-white/5 text-white",
    };
  }
  if (norm.includes("greenhouse")) {
    return {
      label: "GREENHOUSE",
      bg: "border-white/20 bg-white/5 text-white",
    };
  }
  if (norm.includes("lever")) {
    return {
      label: "LEVER",
      bg: "border-white/20 bg-white/5 text-white",
    };
  }
  if (norm.includes("ashby")) {
    return {
      label: "ASHBY",
      bg: "border-white/20 bg-white/5 text-white",
    };
  }
  return {
    label: provider.toUpperCase(),
    bg: "border-white/10 bg-white/[0.02] text-neutral-300",
  };
}

function getEvidenceStrength(match: ExternalJobMatch): { label: "Strong" | "Good" | "Partial"; color: string } {
  if (match.verification_bonus >= 0.08 || match.deterministic_score >= 0.8) {
    return { label: "Strong", color: "border-white/20 bg-white/10 text-white" };
  }
  if (match.verification_bonus >= 0.04 || match.deterministic_score >= 0.5) {
    return { label: "Good", color: "border-white/15 bg-white/5 text-neutral-200" };
  }
  return { label: "Partial", color: "border-white/10 bg-white/[0.02] text-neutral-400" };
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
        // ignore
      }
      return next;
    });
  };

  const handlePrepareApplication = async (match: ExternalJobMatch) => {
    setPreparingMatchId(match.id);
    try {
      const apps = await api.applications(token);
      let app = apps.items.find((a) => a.external_job_id === match.external_job_id);

      if (!app) {
        app = await api.createApplication(match.external_job_id, match.id, token);
        toast.success("Created new application dossier for review.");
      }

      setApplicationInReview(app);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Failed to initiate application.");
    } finally {
      setPreparingMatchId(null);
    }
  };

  const handleSyncAndRecompute = async () => {
    setRefreshing(true);
    try {
      await api.syncAllExternalJobs(token);
      toast.success("Discovered live opportunities and recomputed deterministic match scores!");
      await loadMatches(true);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.detail : "Failed to refresh matches.");
      setRefreshing(false);
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
    <div className="space-y-6 text-white font-sans">
      {/* HEADER */}
      <div className="border border-white/10 bg-[#061524] p-6 rounded-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white">
                <Target className="h-3.5 w-3.5" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                Deterministic Recommendation Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
              Ranked Internship Opportunities
            </h1>
            <p className="text-xs text-neutral-400">
              Live opportunities ranked against your verified Skill Passport evidence.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <LiquidGlassButton
              disabled={refreshing || loading}
              onClick={handleSyncAndRecompute}
              size="sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Refreshing..." : "Discover & Refresh"}</span>
            </LiquidGlassButton>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search opportunities by title, company, or keywords..."
                className="w-full rounded-md border border-white/15 bg-white/[0.03] pl-9 pr-8 py-2 text-xs text-white placeholder:text-neutral-400 focus:border-white focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-400 hidden sm:block" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort opportunities"
                className="rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-white focus:outline-none font-mono"
              >
                <option value="best_match" className="bg-[#061524]">Sort by: Best Match</option>
                <option value="newest" className="bg-[#061524]">Sort by: Newest</option>
                <option value="recently_added" className="bg-[#061524]">Sort by: Recently Added</option>
              </select>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="text-[10px] uppercase tracking-wider text-neutral-400 mr-1">
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
                  className={`rounded-full px-3 py-1 text-xs transition-colors cursor-pointer ${
                    active
                      ? "bg-white text-black font-medium"
                      : "border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white"
                  }`}
                >
                  {source.label}
                </button>
              );
            })}

            <div className="hidden sm:block h-3 w-[1px] bg-white/10 mx-1" />

            <span className="text-[10px] uppercase tracking-wider text-neutral-400 mr-1">
              Filter:
            </span>
            <button
              type="button"
              onClick={() => setRemoteOnly((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs transition-colors cursor-pointer ${
                remoteOnly
                  ? "bg-white text-black font-medium"
                  : "border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white"
              }`}
            >
              Remote
            </button>
            <button
              type="button"
              onClick={() => setIndiaOnly((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs transition-colors cursor-pointer ${
                indiaOnly
                  ? "bg-white text-black font-medium"
                  : "border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white"
              }`}
            >
              India
            </button>
            <button
              type="button"
              onClick={() => setInternshipOnly((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs transition-colors cursor-pointer ${
                internshipOnly
                  ? "bg-white text-black font-medium"
                  : "border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white"
              }`}
            >
              Internship
            </button>
            <button
              type="button"
              onClick={() => setEntryLevelOnly((v) => !v)}
              className={`rounded-full px-3 py-1 text-xs transition-colors cursor-pointer ${
                entryLevelOnly
                  ? "bg-white text-black font-medium"
                  : "border border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white"
              }`}
            >
              Entry Level
            </button>
          </div>
        </div>
      </div>

      {/* MATCH CARDS */}
      {loading ? (
        <LoadingState label="Computing deterministic match scores against verified Skill Passport..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadMatches()} />
      ) : filteredMatches.length === 0 ? (
        <div className="border border-dashed border-white/10 p-12 text-center space-y-4 rounded-md">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
              Find opportunities matched to your skills
            </h3>
            <p className="text-xs text-neutral-400">
              Synchronize real startup and tech postings from YC, Greenhouse, Lever, and Ashby to discover personalized, verified recommendations.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <LiquidGlassButton
              onClick={handleSyncAndRecompute}
              disabled={refreshing}
              size="sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Discover internships</span>
            </LiquidGlassButton>
            {onNavigateToDiscovery && (
              <button
                type="button"
                onClick={onNavigateToDiscovery}
                className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-xs font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                Browse Job Market
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredMatches.map((match) => {
            const providerBadge = getProviderBadge(match.provider);
            const strength = getEvidenceStrength(match);
            const isSaved = savedJobIds.has(match.external_job_id);

            const matchedSkills = match.explanation?.items?.filter((i) => i.status !== "missing") || [];
            const missingSkills = match.explanation?.items?.filter((i) => i.status === "missing") || [];

            return (
              <article
                key={match.id}
                className="border border-white/10 bg-[#061524] p-6 rounded-md transition-colors hover:border-white/20 relative"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  {/* Left Column */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span className={`border px-2 py-0.5 rounded-xs uppercase tracking-wider ${providerBadge.bg}`}>
                        {providerBadge.label}
                      </span>
                      <span className={`border px-2 py-0.5 rounded-xs uppercase tracking-wider ${strength.color}`}>
                        {strength.label} Evidence
                      </span>
                    </div>

                    <div>
                      <h2 className="text-xl font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
                        {match.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-neutral-400 font-sans">
                        <span className="flex items-center gap-1.5 text-neutral-200">
                          <Building2 className="h-3.5 w-3.5 text-neutral-400" />
                          {match.company_name}
                        </span>
                        {match.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-neutral-400" />
                            {match.location}
                          </span>
                        )}
                        {match.remote_status && (
                          <span className="capitalize text-neutral-300">
                            • {match.remote_status.replace("_", " ")}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-neutral-400">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(match.posted_at)}
                        </span>
                      </div>
                    </div>

                    {/* Matched Skills */}
                    <div className="space-y-1 pt-1 font-mono">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
                        <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                        <span>Matched Skills ({matchedSkills.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {matchedSkills.length > 0 ? (
                          matchedSkills.map((item) => (
                            <span
                              key={item.skill_id}
                              className="border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white rounded-xs"
                            >
                              {item.skill_name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-neutral-400 italic">No exact requirements matched yet.</span>
                        )}
                      </div>
                    </div>

                    {/* Missing Skills */}
                    {missingSkills.length > 0 && (
                      <div className="space-y-1 pt-1 font-mono">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
                          <AlertTriangle className="h-3.5 w-3.5 text-neutral-400" />
                          <span>Missing Skills ({missingSkills.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {missingSkills.map((item) => (
                            <span
                              key={item.skill_id}
                              className="border border-white/5 bg-white/[0.02] px-2 py-0.5 text-xs text-neutral-400 rounded-xs"
                            >
                              {item.skill_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Score & Actions */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-4 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-white/10 font-mono">
                    <div className="text-left lg:text-right">
                      <div className="inline-flex items-baseline gap-1 border border-white/20 bg-white/5 px-3 py-1.5 rounded-xs">
                        <span className="text-2xl font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
                          {Math.round(match.final_score * 100)}%
                        </span>
                        <span className="text-[10px] uppercase text-neutral-400">MATCH</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Exact: {Math.round(match.deterministic_score * 100)}% · Bonus: +{Math.round(match.verification_bonus * 100)}%
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveExplanationMatch(match)}
                        className="rounded-full border border-white/15 bg-white/[0.03] px-3.5 py-1.5 text-xs font-mono text-neutral-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Why this match?
                      </button>

                      <a
                        href={match.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/15 bg-white/[0.03] p-2 text-neutral-400 hover:text-white transition-colors"
                        title="View original job post"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleToggleSave(match.external_job_id)}
                        className={`rounded-full border p-2 transition-colors cursor-pointer ${
                          isSaved
                            ? "border-white bg-white text-black"
                            : "border-white/15 bg-white/[0.03] text-neutral-400 hover:text-white"
                        }`}
                        title={isSaved ? "Saved" : "Save opportunity"}
                      >
                        {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                      </button>

                      <LiquidGlassButton
                        disabled={preparingMatchId === match.id}
                        onClick={() => handlePrepareApplication(match)}
                        size="sm"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{preparingMatchId === match.id ? "Preparing..." : "Prepare application"}</span>
                      </LiquidGlassButton>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* WHY THIS MATCH MODAL */}
      <AnimatePresence>
        {activeExplanationMatch && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl border border-white/15 bg-[#061524] shadow-2xl p-6 sm:p-8 space-y-6 text-white rounded-md"
            >
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                    Deterministic Explainability Breakdown
                  </span>
                  <h3 className="text-xl font-normal text-white mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                    Why You Match: {activeExplanationMatch.title}
                  </h3>
                  <p className="text-xs text-neutral-400 font-sans">
                    {activeExplanationMatch.company_name} · Matched against your verified Skill Passport
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveExplanationMatch(null)}
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Score Breakdown Cards */}
              <div className="grid grid-cols-4 gap-2 text-center font-mono">
                <div className="border border-white/10 bg-white/[0.02] p-2.5 rounded-sm">
                  <span className="text-[10px] uppercase text-neutral-400 block">
                    Exact Skills
                  </span>
                  <strong className="text-lg font-normal text-white mt-0.5 block" style={{ fontFamily: "var(--font-display)" }}>
                    {Math.round(activeExplanationMatch.deterministic_score * 100)}%
                  </strong>
                </div>
                <div className="border border-white/10 bg-white/[0.02] p-2.5 rounded-sm">
                  <span className="text-[10px] uppercase text-neutral-400 block">
                    Semantic Fit
                  </span>
                  <strong className="text-lg font-normal text-white mt-0.5 block" style={{ fontFamily: "var(--font-display)" }}>
                    {Math.round(activeExplanationMatch.semantic_score * 100)}%
                  </strong>
                </div>
                <div className="border border-white/10 bg-white/[0.02] p-2.5 rounded-sm">
                  <span className="text-[10px] uppercase text-neutral-400 block">
                    Verification
                  </span>
                  <strong className="text-lg font-normal text-white mt-0.5 block" style={{ fontFamily: "var(--font-display)" }}>
                    +{Math.round(activeExplanationMatch.verification_bonus * 100)}%
                  </strong>
                </div>
                <div className="border border-white/20 bg-white/5 p-2.5 rounded-sm">
                  <span className="text-[10px] uppercase text-white block">
                    Overall
                  </span>
                  <strong className="text-lg font-normal text-white mt-0.5 block" style={{ fontFamily: "var(--font-display)" }}>
                    {Math.round(activeExplanationMatch.final_score * 100)}%
                  </strong>
                </div>
              </div>

              {/* Matched Skills with Evidence */}
              <div className="space-y-3 font-sans">
                <h4 className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  Matched Skills & Evidence Provenance
                </h4>
                <div className="space-y-2">
                  {activeExplanationMatch.explanation?.items
                    ?.filter((i) => i.status !== "missing")
                    .map((item) => (
                      <div
                        key={item.skill_id}
                        className="flex items-start gap-3 border border-white/10 bg-white/[0.02] p-3 rounded-xs"
                      >
                        <CheckCircle2 className="h-4 w-4 text-white shrink-0 mt-0.5" />
                        <div className="space-y-0.5 flex-1 min-w-0 text-xs">
                          <div className="flex items-center justify-between font-mono">
                            <span className="font-medium text-white">
                              {item.skill_name}
                            </span>
                            <span className="text-neutral-300">
                              +{Math.round((item.total_contribution || item.contribution || 0) * 100)}% Fit
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 font-mono">
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
                <div className="space-y-3 font-sans">
                  <h4 className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                    Skills to Learn / Evidence Missing
                  </h4>
                  <div className="space-y-2">
                    {activeExplanationMatch.explanation.items
                      .filter((i) => i.status === "missing")
                      .map((item) => (
                        <div
                          key={item.skill_id}
                          className="flex items-start gap-3 border border-white/5 bg-white/[0.02] p-3 rounded-xs"
                        >
                          <AlertTriangle className="h-4 w-4 text-neutral-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 flex-1 min-w-0 text-xs font-mono">
                            <span className="text-neutral-300">
                              {item.skill_name}
                            </span>
                            <p className="text-[11px] text-neutral-400">
                              Not currently verified in your Skill Passport. Upload evidence or complete projects to boost match score.
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <LiquidGlassButton
                  onClick={() => setActiveExplanationMatch(null)}
                  size="sm"
                >
                  Close Explanation
                </LiquidGlassButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* APPLICATION PREPARATION MODAL */}
      <AnimatePresence>
        {applicationInReview && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl border border-white/15 bg-[#061524] shadow-2xl p-6 sm:p-8 space-y-4 rounded-md"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-white" />
                  <h3 className="text-lg font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
                    Application Review & Verification
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setApplicationInReview(null)}
                  className="p-1 text-neutral-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ApplicationPreparation
                application={applicationInReview}
                token={token}
                onChanged={(updated) => setApplicationInReview(updated)}
              />

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setApplicationInReview(null)}
                  className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-1.5 font-mono text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer"
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
