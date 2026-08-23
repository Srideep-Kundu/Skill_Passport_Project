import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ExternalLink,
  Search,
  MapPin,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Send,
  X,
  Compass,
  ListFilter,
  FileCheck2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { ApiError, api } from "../api";
import type {
  Application,
  ExternalJob,
  ExternalJobMatch,
  ProviderStatusItem,
} from "../api";
import { ApplicationPreparation } from "./ApplicationPreparation";
import { SavedDiscoveries } from "./SavedDiscoveries";
import { ErrorState, LoadingState } from "./AsyncState";

function syncedLabel(value: string | null): string {
  if (!value) return "Just now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "Recently synced";
  const minutesAgo = Math.floor((Date.now() - parsed.getTime()) / (1000 * 60));
  if (minutesAgo < 1) return "Just now";
  if (minutesAgo === 1) return "1 min ago";
  if (minutesAgo < 60) return `${minutesAgo} mins ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  return `${hoursAgo}h ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Recent";
  const date = new Date(dateStr);
  if (Number.isNaN(date.valueOf())) return "Recent";
  const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return `${daysAgo}d ago`;
}

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

export function ExternalJobs({ token }: { token: string }) {
  const [jobs, setJobs] = useState<ExternalJob[]>([]);
  const [matchesByJobId, setMatchesByJobId] = useState<Record<string, ExternalJobMatch>>({});
  const [providers, setProviders] = useState<ProviderStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [locationQuery, setLocationQuery] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [employmentType, setEmploymentType] = useState<string>("all");
  const [freshnessDays, setFreshnessDays] = useState<number>(0); // 0 = anytime

  // Drawer / Modals
  const [showSavedRules, setShowSavedRules] = useState(false);
  const [applicationInReview, setApplicationInReview] = useState<Application | null>(null);
  const [preparingJobId, setPreparingJobId] = useState<string | null>(null);
  const [activeExplanationMatch, setActiveExplanationMatch] = useState<ExternalJobMatch | null>(null);

  // Saved Bookmarks
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("saved_market_job_ids");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const loadData = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);

        // Fetch jobs, matches, and provider health simultaneously
        const [jobsRes, matchesRes, providersRes] = await Promise.all([
          api.externalJobs(token, {
            page: 1,
            pageSize: 50,
            provider: selectedProvider === "all" ? undefined : selectedProvider,
            location: locationQuery.trim() || undefined,
            remote: remoteOnly ? true : undefined,
            query: searchQuery.trim() || undefined,
            employmentType: employmentType === "all" ? undefined : employmentType,
            postedWithinDays: freshnessDays > 0 ? freshnessDays : undefined,
          }),
          api.externalJobMatches(token, { page: 1, pageSize: 100 }),
          api.providers(token).catch(() => []),
        ]);

        setJobs(jobsRes.items);
        setProviders(providersRes);

        const matchMap: Record<string, ExternalJobMatch> = {};
        for (const match of matchesRes.items) {
          matchMap[match.external_job_id] = match;
        }
        setMatchesByJobId(matchMap);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Failed to load the opportunity market.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, selectedProvider, locationQuery, remoteOnly, searchQuery, employmentType, freshnessDays]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSyncAllSources = async () => {
    try {
      setRefreshing(true);
      toast.loading("Ingesting fresh postings from YC, Greenhouse, Lever, and Ashby...");
      await api.syncAllExternalJobs(token);
      toast.dismiss();
      toast.success("Job discovery feed synchronized!");
      await loadData(true);
    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof ApiError ? err.detail : "Failed to sync external providers.");
      setRefreshing(false);
    }
  };

  const handleToggleSave = (jobId: string) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
        toast.info("Removed from saved list");
      } else {
        next.add(jobId);
        toast.success("Saved opportunity");
      }
      try {
        localStorage.setItem("saved_market_job_ids", JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handlePrepareApplication = async (job: ExternalJob) => {
    try {
      setPreparingJobId(job.id);
      const match = matchesByJobId[job.id];
      if (!match) {
        // Recompute match if not ready yet
        toast.info("Calculating match verification for this role...");
        await api.recomputeExternalJobMatches(token);
        const refreshed = await api.externalJobMatches(token, { page: 1, pageSize: 100 });
        const found = refreshed.items.find((m) => m.external_job_id === job.id);
        if (found) {
          const app = await api.createApplication(job.id, found.id, token);
          setApplicationInReview(app);
          return;
        }
      }
      const matchId = match ? match.id : job.id; // fallback if computed
      const app = await api.createApplication(job.id, matchId, token);
      setApplicationInReview(app);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not initialize application.");
    } finally {
      setPreparingJobId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-6 sm:p-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-[#4f46e5] dark:text-[#38bdf8]">
                <Compass className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#4f46e5] dark:text-[#38bdf8] font-sans">
                Real-Time Opportunity Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-[#f1f0e8] tracking-tight font-sans">
              Live Opportunity Discovery
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#98a4b3] font-sans">
              Discover startup, internship, and engineering opportunities from real external ATS boards and YC networks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowSavedRules(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#151e29] px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-[#f1f0e8] hover:bg-slate-100 dark:hover:bg-[#1c2838] transition-all cursor-pointer font-sans"
            >
              <ListFilter className="h-4 w-4 text-[#4f46e5] dark:text-[#38bdf8]" />
              <span>Discovery Rules</span>
            </button>

            <button
              type="button"
              disabled={refreshing || loading}
              onClick={handleSyncAllSources}
              className="flex items-center gap-2 rounded-xl bg-[#4f46e5] dark:bg-[#38bdf8] px-4 py-2 text-xs font-bold text-white dark:text-slate-950 shadow-md shadow-indigo-500/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 font-sans"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Ingesting..." : "Refresh Opportunities"}</span>
            </button>
          </div>
        </div>

        {/* PROVIDER HEALTH & STATUS STRIP */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Opportunity provider status:
            </span>
            <span className="text-[11px] font-medium text-slate-400 dark:text-[#8ea2c6]">
              {providers.filter((p) => p.status === "live").length} verified live
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {providers.map((p) => {
              const isLive = p.status === "live";
              return (
                <div
                  key={p.provider}
                  title={p.reason || `${p.name}: successful configured sync recorded`}
                  className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                    isLive
                      ? "bg-slate-50/70 dark:bg-[#151e29]/70 border-slate-200/60 dark:border-white/[0.08]"
                      : "bg-slate-50/40 dark:bg-[#111821]/40 border-dashed border-slate-200 dark:border-white/[0.06] opacity-75"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 font-sans truncate">
                      {p.name.replace(" Jobs", "")}
                    </span>
                    <span className="flex h-2 w-2 relative">
                      {isLive && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          isLive ? "bg-emerald-500" : "bg-slate-400 dark:bg-slate-600"
                        }`}
                      />
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-2 text-slate-500 dark:text-[#8ea2c6]">
                    <span className="font-semibold">{p.active_jobs_count ? `${p.active_jobs_count} jobs` : "No jobs"}</span>
                    <span>{isLive ? syncedLabel(p.last_synced_at) : p.status.replaceAll("_", " ")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SEARCH & MULTI-CRITERIA FILTERS */}
        <div className="mt-5 pt-5 border-t border-slate-100 dark:border-white/[0.08] space-y-3">
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-4">
            {/* Search Input */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by role, required skills (e.g. Python, React)..."
                className="w-full rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#151e29] pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-[#f1f0e8] placeholder:text-slate-400 focus:border-[#4f46e5] focus:outline-none font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Location Input */}
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Location (e.g. India, SF)..."
                className="w-full rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#151e29] pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-[#f1f0e8] placeholder:text-slate-400 focus:border-[#4f46e5] focus:outline-none font-sans"
              />
            </div>

            {/* Provider Selector */}
            <div>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                aria-label="Filter by provider"
                className="w-full rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#151e29] px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-[#f1f0e8] focus:border-[#4f46e5] focus:outline-none cursor-pointer font-sans"
              >
                <option value="all">All Providers</option>
                <option value="yc">YC Startup Jobs</option>
                <option value="greenhouse">Greenhouse</option>
                <option value="lever">Lever</option>
                <option value="ashby">Ashby</option>
              </select>
            </div>
          </div>

          {/* Quick Filter Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setRemoteOnly((v) => !v)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer font-sans ${
                remoteOnly
                  ? "bg-[#4f46e5] dark:bg-[#182337] text-white dark:text-[#38bdf8] border border-transparent dark:border-[#38bdf8]/40"
                  : "bg-slate-100 dark:bg-[#151e29] text-slate-600 dark:text-[#8ea2c6] hover:bg-slate-200/70 dark:hover:bg-[#1c2838] border border-slate-200/60 dark:border-white/[0.06]"
              }`}
            >
              Remote Only
            </button>

            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              aria-label="Employment type filter"
              className="rounded-full border border-slate-200/60 dark:border-white/[0.06] bg-slate-100 dark:bg-[#151e29] px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-[#8ea2c6] focus:outline-none cursor-pointer font-sans"
            >
              <option value="all">Type: All</option>
              <option value="internship">Internship</option>
              <option value="full_time">Full-Time</option>
              <option value="contract">Contract</option>
            </select>

            <select
              value={freshnessDays}
              onChange={(e) => setFreshnessDays(Number(e.target.value))}
              aria-label="Posted date freshness filter"
              className="rounded-full border border-slate-200/60 dark:border-white/[0.06] bg-slate-100 dark:bg-[#151e29] px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-[#8ea2c6] focus:outline-none cursor-pointer font-sans"
            >
              <option value={0}>Posted: Anytime</option>
              <option value={1}>Posted: Last 24 hours</option>
              <option value={3}>Posted: Last 3 days</option>
              <option value={7}>Posted: Last 7 days</option>
              <option value={30}>Posted: Last 30 days</option>
            </select>

            {(searchQuery || locationQuery || selectedProvider !== "all" || remoteOnly || employmentType !== "all" || freshnessDays > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setLocationQuery("");
                  setSelectedProvider("all");
                  setRemoteOnly(false);
                  setEmploymentType("all");
                  setFreshnessDays(0);
                }}
                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline ml-auto font-sans"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* JOBS GRID */}
      {loading ? (
        <LoadingState label="Loading persisted opportunities and configured provider status..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadData()} />
      ) : jobs.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-10 sm:p-14 text-center space-y-4 shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-[#4f46e5] dark:text-[#38bdf8]">
            <Compass className="h-7 w-7 animate-pulse" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">
              No live jobs discovered yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans leading-relaxed">
              Configure job board discovery filters or click discover to fetch fresh tech roles directly from Greenhouse, Lever, and Ashby APIs.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {jobs.map((job) => {
            const providerBadge = getProviderBadge(job.provider);
            const match = matchesByJobId[job.id];
            const isSaved = savedJobIds.has(job.id);

            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-5 sm:p-6 flex flex-col justify-between shadow-lg hover:border-[#4f46e5]/40 dark:hover:border-white/[0.18] transition-all group"
              >
                <div className="space-y-3">
                  {/* Top Bar: Provider & Match Score */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-lg border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${providerBadge.bg}`}>
                      {providerBadge.label}
                    </span>

                    {match ? (
                      <button
                        type="button"
                        onClick={() => setActiveExplanationMatch(match)}
                        className="rounded-xl bg-indigo-50 dark:bg-[#182337] border border-indigo-200/60 dark:border-[#38bdf8]/40 px-2.5 py-1 text-[11px] font-black text-[#4f46e5] dark:text-[#38bdf8] hover:scale-105 transition-transform cursor-pointer font-sans"
                      >
                        {Math.round(match.final_score * 100)}% Match
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 font-sans">
                        Live posting
                      </span>
                    )}
                  </div>

                  {/* Title & Company */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] group-hover:text-[#4f46e5] dark:group-hover:text-[#38bdf8] transition-colors font-sans line-clamp-2">
                      {job.title}
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 dark:text-[#8ea2c6] mt-1 flex items-center gap-1 font-sans">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" />
                      <span>{job.company_name}</span>
                    </p>
                  </div>

                  {/* Location & Metadata */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {job.location}
                      </span>
                    )}
                    {job.remote_status && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold capitalize">
                        &bull; {job.remote_status.replace("_", " ")}
                      </span>
                    )}
                    <span className="text-slate-400 text-[11px]">
                      &bull; {formatDate(job.posted_at)}
                    </span>
                  </div>

                  {/* Normalized Requirements Tags */}
                  {job.requirements && job.requirements.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">
                        Required & Preferred Skills
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {job.requirements.slice(0, 4).map((req) => (
                          <span
                            key={req.id}
                            className={`rounded-lg px-2 py-0.5 text-[11px] font-medium font-sans ${
                              req.is_required
                                ? "bg-indigo-50 dark:bg-[#182337] text-indigo-700 dark:text-[#38bdf8] border border-indigo-200/50 dark:border-[#38bdf8]/30"
                                : "bg-slate-100 dark:bg-[#151e29] text-slate-600 dark:text-[#8ea2c6] border border-slate-200/40 dark:border-white/[0.06]"
                            }`}
                          >
                            {req.skill_name}
                          </span>
                        ))}
                        {job.requirements.length > 4 && (
                          <span className="text-[10px] text-slate-400 font-medium self-center">
                            +{job.requirements.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#151e29] p-2 text-slate-600 dark:text-[#8ea2c6] hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="View original posting"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleToggleSave(job.id)}
                      className={`rounded-xl border p-2 transition-colors cursor-pointer ${
                        isSaved
                          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-600 dark:text-amber-400"
                          : "border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#151e29] text-slate-500 dark:text-[#8ea2c6] hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title={isSaved ? "Saved" : "Save opportunity"}
                    >
                      {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={preparingJobId === job.id}
                    onClick={() => handlePrepareApplication(job)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#4f46e5] dark:bg-[#38bdf8] px-3.5 py-1.5 text-xs font-bold text-white dark:text-slate-950 shadow-sm shadow-indigo-500/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer font-sans disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" />
                    <span>{preparingJobId === job.id ? "Preparing..." : "Apply / Prepare"}</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* SAVED DISCOVERY RULES MODAL */}
      <AnimatePresence>
        {showSavedRules && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-3xl border border-slate-200/80 dark:border-white/[0.12] bg-white dark:bg-[#111821] shadow-2xl p-6 sm:p-8 space-y-5 text-slate-900 dark:text-[#f1f0e8]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
                <div className="flex items-center gap-2">
                  <ListFilter className="h-5 w-5 text-[#4f46e5] dark:text-[#38bdf8]" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">
                    Saved Discovery Rules & Cadence
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSavedRules(false)}
                  className="rounded-xl p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <SavedDiscoveries token={token} />

              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSavedRules(false)}
                  className="rounded-xl bg-[#4f46e5] dark:bg-[#38bdf8] px-5 py-2 text-xs font-bold text-white dark:text-slate-950 hover:opacity-90 cursor-pointer font-sans"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WHY THIS MATCH EXPLANATION MODAL */}
      <AnimatePresence>
        {activeExplanationMatch && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-3xl border border-slate-200/80 dark:border-white/[0.12] bg-white dark:bg-[#111821] shadow-2xl p-6 sm:p-8 space-y-5 text-slate-900 dark:text-[#f1f0e8]"
            >
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4f46e5] dark:text-[#38bdf8] font-sans">
                    Match Explanation
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-[#f1f0e8] mt-0.5 font-sans">
                    {activeExplanationMatch.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
                    {activeExplanationMatch.company_name} · Score: {Math.round(activeExplanationMatch.final_score * 100)}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveExplanationMatch(null)}
                  className="rounded-xl p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/[0.08] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Exact</span>
                  <strong className="text-base font-black text-[#4f46e5] dark:text-[#38bdf8] font-sans">
                    {Math.round(activeExplanationMatch.deterministic_score * 100)}%
                  </strong>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/[0.08] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Semantic</span>
                  <strong className="text-base font-black text-purple-600 dark:text-purple-400 font-sans">
                    {Math.round(activeExplanationMatch.semantic_score * 100)}%
                  </strong>
                </div>
                <div className="rounded-2xl bg-slate-50 dark:bg-[#151e29] border border-slate-200/60 dark:border-white/[0.08] p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Verification</span>
                  <strong className="text-base font-black text-emerald-600 dark:text-emerald-400 font-sans">
                    +{Math.round(activeExplanationMatch.verification_bonus * 100)}%
                  </strong>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {activeExplanationMatch.explanation?.items?.map((item) => (
                  <div
                    key={item.skill_id}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#151e29] p-2.5 text-xs"
                  >
                    {item.status === "missing" ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">
                        {item.skill_name}
                      </span>
                      <span className="text-slate-500 dark:text-[#98a4b3] ml-1.5 font-sans">
                        {item.status === "missing"
                          ? "Missing from Skill Passport"
                          : item.evidence_title
                          ? `✓ Proven in: ${item.evidence_title}`
                          : "✓ Verified in Skill Passport"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveExplanationMatch(null)}
                  className="rounded-xl bg-[#4f46e5] dark:bg-[#38bdf8] px-5 py-2 text-xs font-bold text-white dark:text-slate-950 hover:opacity-90 cursor-pointer font-sans"
                >
                  Close
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
