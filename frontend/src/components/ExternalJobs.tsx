import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  ListFilter,
  FileCheck2,
} from "lucide-react";
import { motion } from "framer-motion";
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
import { EditorialButton } from "./ui/EditorialPrimitives";

function syncedLabel(value: string | null): string {
  if (!value) return "Just now";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "Recently synced";
  const minutesAgo = Math.floor((Date.now() - parsed.getTime()) / (1000 * 60));
  if (minutesAgo < 1) return "Just now";
  if (minutesAgo === 1) return "1m ago";
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
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
      border: "border-[#E5E1D8] text-[#B08D57]",
    };
  }
  if (norm.includes("greenhouse")) {
    return {
      label: "GREENHOUSE",
      border: "border-[#E5E1D8] text-[#4F6F5A]",
    };
  }
  if (norm.includes("lever")) {
    return {
      label: "LEVER",
      border: "border-[#E5E1D8] text-[#475569]",
    };
  }
  if (norm.includes("ashby")) {
    return {
      label: "ASHBY",
      border: "border-[#E5E1D8] text-[#475569]",
    };
  }
  return {
    label: provider.toUpperCase(),
    border: "border-[#E5E1D8] text-[#64748B]",
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
  const [freshnessDays, setFreshnessDays] = useState<number>(0);

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
        const matchMap: Record<string, ExternalJobMatch> = {};
        matchesRes.items.forEach((m) => {
          matchMap[m.external_job_id] = m;
        });
        setMatchesByJobId(matchMap);
        setProviders(providersRes);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Could not load market opportunities.");
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
      toast.info("Ingesting fresh opportunities from configured provider APIs...");
      await api.syncAllExternalJobs(token);
      toast.success("Live opportunities refreshed successfully.");
      await loadData(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not sync provider opportunities.");
      setRefreshing(false);
    }
  };

  const handleToggleSave = (jobId: string) => {
    setSavedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
        toast.info("Opportunity removed from saved bookmarks.");
      } else {
        next.add(jobId);
        toast.success("Opportunity saved to your watchlist.");
      }
      try {
        localStorage.setItem("saved_market_job_ids", JSON.stringify(Array.from(next)));
      } catch {
        // local storage quota or privacy mode fallback
      }
      return next;
    });
  };

  const handlePrepareApplication = async (job: ExternalJob) => {
    try {
      setPreparingJobId(job.id);
      const match = matchesByJobId[job.id];
      const matchId = match ? match.id : job.id;
      const app = await api.createApplication(job.id, matchId, token);
      setApplicationInReview(app);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.detail : "Could not initialize application.");
    } finally {
      setPreparingJobId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-end gap-3">
        <EditorialButton
          variant="secondary"
          onClick={() => setShowSavedRules(true)}
        >
          <ListFilter className="h-3.5 w-3.5 mr-1" />
          <span>Discovery Rules</span>
        </EditorialButton>
        <EditorialButton
          variant="primary"
          disabled={refreshing || loading}
          onClick={handleSyncAllSources}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          <span>{refreshing ? "Ingesting..." : "Refresh Opportunities"}</span>
        </EditorialButton>
      </div>

      {/* MAIN DISCOVERY SECTION */}
      <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-md space-y-6">
        {/* PROVIDER STATUS STRIP */}
        <div className="space-y-3">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
            <span>Opportunity Provider Status</span>
            <span className="text-[#B08D57]">
              {providers.filter((p) => p.status === "live").length} Verified Live
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {providers.map((p) => {
              const isLive = p.status === "live";
              return (
                <div
                  key={p.provider}
                  title={p.reason || `${p.name}: configured sync recorded`}
                  className={`rounded-sm border p-3 flex flex-col justify-between font-mono text-xs ${
                    isLive
                      ? "border-[#E5E1D8] bg-[#F7F5F0]"
                      : "border-[#E5E1D8] bg-white/[0.005] opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-[#111827] truncate">
                      {p.name.replace(" Jobs", "")}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full shrink-0">
                      <span className={`block h-1.5 w-1.5 rounded-full ${isLive ? "bg-emerald-400" : "bg-[#8796A2]"}`} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#64748B] pt-2">
                    <span>{p.active_jobs_count ? `${p.active_jobs_count} jobs` : "0 jobs"}</span>
                    <span className="text-[#475569]">{isLive ? syncedLabel(p.last_synced_at) : p.status.replaceAll("_", " ")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="pt-4 border-t border-[#E5E1D8] space-y-3">
          <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-4">
            {/* Search Input */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by role, required skills (e.g. Python, React)..."
                className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] pl-9 pr-8 py-2 font-mono text-xs text-[#111827] placeholder:text-[#64748B] focus:border-[#B08D57] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#111827]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Location Input */}
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="Location (e.g. Remote, India)..."
                className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] pl-9 pr-3 py-2 font-mono text-xs text-[#111827] placeholder:text-[#64748B] focus:border-[#B08D57] focus:outline-none"
              />
            </div>

            {/* Provider Selector */}
            <div>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                aria-label="Filter by provider"
                className="w-full rounded-md border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 font-mono text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none cursor-pointer"
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
          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
            <button
              type="button"
              onClick={() => setRemoteOnly((v) => !v)}
              className={`rounded-xs border px-3 py-1 text-xs transition-colors cursor-pointer ${
                remoteOnly
                  ? "border-[#B08D57]/40 bg-[rgba(176,141,87,0.08)] text-[#B08D57]"
                  : "border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
              }`}
            >
              Remote Only
            </button>

            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              aria-label="Employment type filter"
              className="rounded-xs border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-1 text-xs text-[#475569] focus:outline-none cursor-pointer"
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
              className="rounded-xs border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-1 text-xs text-[#475569] focus:outline-none cursor-pointer"
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
                className="text-xs text-[#B08D57] hover:text-[#111827] ml-auto cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* JOBS CATALOG */}
      {loading ? (
        <LoadingState label="Loading persisted opportunities and configured provider status..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadData()} />
      ) : jobs.length === 0 ? (
        <div className="rounded-md border border-[#E5E1D8] bg-[#FFFFFF] p-12 text-center space-y-3 font-sans">
          <h3
            className="text-xl font-normal text-[#111827]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            No live jobs discovered yet
          </h3>
          <p className="font-mono text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
            Configure job board discovery filters or click discover to fetch fresh tech roles directly from Greenhouse, Lever, and Ashby APIs.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {jobs.map((job) => {
            const providerBadge = getProviderBadge(job.provider);
            const match = matchesByJobId[job.id];
            const isSaved = savedJobIds.has(job.id);

            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-md border border-[#E5E1D8] bg-[#FFFFFF] p-6 flex flex-col justify-between space-y-4 hover:border-[#E5E1D8] transition-colors"
              >
                <div className="space-y-3">
                  {/* Top Bar: Provider & Match Score */}
                  <div className="flex items-center justify-between gap-2 font-mono text-xs">
                    <span className={`border px-2 py-0.5 rounded-xs uppercase text-[10px] ${providerBadge.border}`}>
                      {providerBadge.label}
                    </span>

                    {match ? (
                      <button
                        type="button"
                        onClick={() => setActiveExplanationMatch(match)}
                        className="rounded-xs border border-[#B08D57]/30 bg-[rgba(176,141,87,0.08)] px-2.5 py-0.5 text-xs text-[#B08D57] hover:text-[#111827] transition-colors cursor-pointer"
                      >
                        {Math.round(match.final_score * 100)}% Match
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#64748B]">
                        Live posting
                      </span>
                    )}
                  </div>

                  {/* Title & Company */}
                  <div className="space-y-1">
                    <h3
                      className="text-xl font-normal text-[#111827] leading-tight"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {job.title}
                    </h3>
                    <p className="text-xs text-[#475569] flex items-center gap-1.5 font-mono">
                      <Building2 className="h-3.5 w-3.5 text-[#64748B]" />
                      <span>{job.company_name}</span>
                    </p>
                  </div>

                  {/* Location & Metadata */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-[#64748B]">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{job.location}</span>
                      </span>
                    )}
                    {job.remote_status && (
                      <span className="text-[#4F6F5A]">
                        · {job.remote_status.replace("_", " ")}
                      </span>
                    )}
                    <span className="text-[#64748B]">
                      · {formatDate(job.posted_at)}
                    </span>
                  </div>

                  {/* Requirements Tags */}
                  {job.requirements && job.requirements.length > 0 && (
                    <div className="pt-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] block mb-1">
                        Requirements
                      </span>
                      <p className="font-mono text-xs text-[#475569]">
                        {job.requirements.map((r) => r.skill_name).join(" · ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <a
                      href={job.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="border border-[#E5E1D8] bg-[#F7F5F0] p-2 rounded-md text-[#64748B] hover:text-[#111827] transition-colors"
                      title="View original posting"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleToggleSave(job.id)}
                      className={`border p-2 rounded-md transition-colors cursor-pointer ${
                        isSaved
                          ? "border-[#B08D57]/40 bg-[rgba(176,141,87,0.08)] text-[#B08D57]"
                          : "border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                      }`}
                      title={isSaved ? "Saved" : "Save opportunity"}
                    >
                      {isSaved ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <EditorialButton
                    variant="primary"
                    disabled={preparingJobId === job.id}
                    onClick={() => handlePrepareApplication(job)}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    <span>{preparingJobId === job.id ? "Preparing..." : "Apply / Prepare"}</span>
                  </EditorialButton>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* SAVED DISCOVERY RULES MODAL */}
      {showSavedRules &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="w-full max-w-2xl rounded-md border border-[#E5E1D8] bg-[#FFFFFF] shadow-2xl p-6 space-y-5 text-[#111827] my-auto">
              <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                <div className="flex items-center gap-2">
                  <ListFilter className="h-4 w-4 text-[#B08D57]" />
                  <h3
                    className="text-xl font-normal text-[#111827]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Saved Discovery Rules & Cadence
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSavedRules(false)}
                  className="text-[#64748B] hover:text-[#111827] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <SavedDiscoveries token={token} />

              <div className="pt-3 border-t border-[#E5E1D8] flex justify-end">
                <EditorialButton
                  variant="primary"
                  onClick={() => setShowSavedRules(false)}
                >
                  Done
                </EditorialButton>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MATCH EXPLANATION MODAL */}
      {activeExplanationMatch &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="w-full max-w-xl rounded-md border border-[#E5E1D8] bg-[#FFFFFF] shadow-2xl p-6 space-y-5 text-[#111827] my-auto">
              <div className="flex items-start justify-between border-b border-[#E5E1D8] pb-4">
                <div className="space-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
                    Match Explanation
                  </span>
                  <h3
                    className="text-xl font-normal text-[#111827]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {activeExplanationMatch.title}
                  </h3>
                  <p className="font-mono text-xs text-[#475569]">
                    {activeExplanationMatch.company_name} · Score: {Math.round(activeExplanationMatch.final_score * 100)}%
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveExplanationMatch(null)}
                  className="text-[#64748B] hover:text-[#111827] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] p-3">
                  <span className="text-[10px] uppercase text-[#64748B] block">Exact</span>
                  <strong className="text-base font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                    {Math.round(activeExplanationMatch.deterministic_score * 100)}%
                  </strong>
                </div>
                <div className="rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] p-3">
                  <span className="text-[10px] uppercase text-[#64748B] block">Semantic</span>
                  <strong className="text-base font-normal text-[#B08D57]" style={{ fontFamily: "var(--font-display)" }}>
                    {Math.round(activeExplanationMatch.semantic_score * 100)}%
                  </strong>
                </div>
                <div className="rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] p-3">
                  <span className="text-[10px] uppercase text-[#64748B] block">Verification</span>
                  <strong className="text-base font-normal text-[#4F6F5A]" style={{ fontFamily: "var(--font-display)" }}>
                    +{Math.round(activeExplanationMatch.verification_bonus * 100)}%
                  </strong>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {activeExplanationMatch.explanation?.items?.map((item) => (
                  <div
                    key={item.skill_id}
                    className="flex items-start gap-2.5 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] p-3 text-xs font-mono"
                  >
                    {item.status === "missing" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-[#B08D57] shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#4F6F5A] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="text-[#111827]">
                        {item.skill_name}
                      </span>
                      <span className="text-[#64748B] ml-2">
                        {item.status === "missing"
                          ? "Missing from Lumina Intel"
                          : item.evidence_title
                          ? `✓ Proven in: ${item.evidence_title}`
                          : "✓ Verified in Lumina Intel"}
                      </span>
                    </div>
                  </div>
                ))}
                {(!activeExplanationMatch.explanation?.items ||
                  activeExplanationMatch.explanation.items.length === 0) && (
                  <p className="text-xs font-mono text-[#64748B] p-3 bg-[#F7F5F0] rounded-[12px] border border-[#E5E1D8]">
                    No exact matched skills currently registered. Upload project evidence or transcripts to match requirements.
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <EditorialButton
                  variant="primary"
                  onClick={() => setActiveExplanationMatch(null)}
                >
                  Close
                </EditorialButton>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* APPLICATION PREPARATION MODAL */}
      {applicationInReview &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-[#0F172A]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="w-full max-w-2xl rounded-md border border-[#E5E1D8] bg-[#FFFFFF] shadow-2xl p-6 space-y-4 text-[#111827] my-auto">
              <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-[#B08D57]" />
                  <h3
                    className="text-xl font-normal text-[#111827]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Application Review & Verification
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setApplicationInReview(null)}
                  className="text-[#64748B] hover:text-[#111827] p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ApplicationPreparation
                application={applicationInReview}
                token={token}
                onChanged={(updated) => setApplicationInReview(updated)}
              />

              <div className="pt-3 border-t border-[#E5E1D8] flex justify-end">
                <EditorialButton
                  variant="secondary"
                  onClick={() => setApplicationInReview(null)}
                >
                  Done Reviewing
                </EditorialButton>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
