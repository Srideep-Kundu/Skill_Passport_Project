import { useCallback, useEffect, useState } from "react";
import {
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  Filter,
  Handshake,
  Lightbulb,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { errorMessage } from "../../api/client";
import { api } from "../../api/service";
import type {
  FacultyApplication,
  FacultyHubFilters,
  FacultyOpportunity,
} from "../../api/types";

interface FacultyCollaborationFundingHubProps {
  token: string;
  proposals: FacultyApplication[];
  onCreateProposal: (opportunity: FacultyOpportunity) => void;
  onOpenWorkspace: (workspaceId: string) => void;
}

const discoveryTabs = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "society", label: "Societies", icon: Users },
  { id: "expert", label: "Experts", icon: Lightbulb },
  { id: "collaborator", label: "Collaborators", icon: Handshake },
  { id: "funding", label: "Funding", icon: CircleDollarSign },
];

const proposalStages = ["draft", "submitted", "under_review", "accepted"];

function formatMoney(amount?: number | null) {
  if (amount == null) return "Non-monetary";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function proposalStageIndex(status: string) {
  if (status === "rejected") return 3;
  if (["active", "completed"].includes(status)) return 3;
  return Math.max(0, proposalStages.indexOf(status));
}

export function FacultyCollaborationFundingHub({
  token,
  proposals,
  onCreateProposal,
  onOpenWorkspace,
}: FacultyCollaborationFundingHubProps) {
  const [items, setItems] = useState<FacultyOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FacultyOpportunity | null>(null);
  const [filters, setFilters] = useState<FacultyHubFilters>({
    discovery_type: "all",
    limit: 100,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const catalog = await api.getFacultyHubOpportunities(token, filters);
      setItems(catalog);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load the Collaboration & Funding Hub"));
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleSaved(opportunity: FacultyOpportunity) {
    try {
      if (opportunity.is_saved) {
        await api.unsaveFacultyHubOpportunity(opportunity.id, token);
      } else {
        await api.saveFacultyHubOpportunity(opportunity.id, token);
      }
      setItems((current) =>
        current.map((item) =>
          item.id === opportunity.id ? { ...item, is_saved: !item.is_saved } : item
        )
      );
      setSelected((current) =>
        current?.id === opportunity.id
          ? { ...current, is_saved: !current.is_saved }
          : current
      );
      toast.success(opportunity.is_saved ? "Removed from saved opportunities" : "Opportunity saved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not update saved opportunities"));
    }
  }

  return (
    <div className="space-y-6 font-mono" data-testid="faculty-collaboration-funding-hub">
      <section className="rounded-md border border-[#E5E1D8] bg-[#FFFFFF] p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#B08D57]">
              Faculty ecosystem / deterministic discovery
            </span>
            <h2 className="mt-2 text-2xl font-semibold text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
              Collaboration &amp; Funding Hub
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#64748B]">
              Discover professional societies, expert speakers and trainers, industry partners,
              grants, and sponsorships. Recommendations use only faculty expertise, recorded
              student skill-gap plans, and institution priorities.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-2 text-xs text-[#475569]">
            <input
              type="checkbox"
              checked={Boolean(filters.saved_only)}
              onChange={(event) =>
                setFilters((current) => ({ ...current, saved_only: event.target.checked }))
              }
            />
            <Bookmark className="h-3.5 w-3.5" /> Saved only
          </label>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-5">
          {discoveryTabs.map(({ id, label, icon: Icon }) => {
            const active = (filters.discovery_type || "all") === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFilters((current) => ({ ...current, discovery_type: id }))}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs transition-colors ${
                  active
                    ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)] text-[#8A6D3F]"
                    : "border-[#E5E1D8] bg-white text-[#64748B] hover:border-[#B08D57]/50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative xl:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input
              aria-label="Search hub"
              value={filters.search || ""}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search societies, experts, funders..."
              className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] py-2 pl-9 pr-3 text-xs text-[#111827] outline-none focus:border-[#B08D57]"
            />
          </label>
          <input
            aria-label="Domain filter"
            value={filters.domain || ""}
            onChange={(event) => setFilters((current) => ({ ...current, domain: event.target.value }))}
            placeholder="Domain (AI, cloud...)"
            className="rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-2 text-xs outline-none focus:border-[#B08D57]"
          />
          <input
            aria-label="Expertise filter"
            value={filters.expertise || ""}
            onChange={(event) => setFilters((current) => ({ ...current, expertise: event.target.value }))}
            placeholder="Expertise"
            className="rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-2 text-xs outline-none focus:border-[#B08D57]"
          />
          <input
            aria-label="Collaboration type filter"
            value={filters.collaboration_type || ""}
            onChange={(event) => setFilters((current) => ({ ...current, collaboration_type: event.target.value }))}
            placeholder="Collaboration type"
            className="rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-2 text-xs outline-none focus:border-[#B08D57]"
          />
          <input
            aria-label="Minimum funding"
            type="number"
            min={0}
            value={filters.minimum_funding ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, minimum_funding: event.target.value ? Number(event.target.value) : undefined }))}
            placeholder="Minimum funding (₹)"
            className="rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-2 text-xs outline-none focus:border-[#B08D57]"
          />
          <input
            aria-label="Maximum funding"
            type="number"
            min={0}
            value={filters.maximum_funding ?? ""}
            onChange={(event) => setFilters((current) => ({ ...current, maximum_funding: event.target.value ? Number(event.target.value) : undefined }))}
            placeholder="Maximum funding (₹)"
            className="rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-2 text-xs outline-none focus:border-[#B08D57]"
          />
          <label className="relative">
            <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
            <input
              aria-label="Deadline before"
              type="date"
              value={filters.deadline_to || ""}
              onChange={(event) => setFilters((current) => ({ ...current, deadline_to: event.target.value || undefined }))}
              className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] py-2 pl-9 pr-3 text-xs outline-none focus:border-[#B08D57]"
            />
          </label>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
            <Filter className="h-4 w-4 text-[#B08D57]" /> Recommended catalog
          </h3>
          <span className="text-[10px] uppercase tracking-wider text-[#64748B]">
            {items.length} results · faculty-hub-v1
          </span>
        </div>

        {loading ? (
          <div className="rounded-md border border-[#E5E1D8] bg-white p-10 text-center text-xs text-[#64748B]">
            Loading collaboration intelligence...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#CBD5E1] bg-white p-10 text-center text-xs text-[#64748B]">
            No opportunities match these filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <article key={item.id} className="rounded-md border border-[#E5E1D8] bg-[#FFFFFF] p-5 shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-xs border border-[#B08D57]/30 bg-[rgba(176,141,87,0.08)] px-2 py-0.5 text-[10px] uppercase text-[#8A6D3F]">
                        {titleCase(item.discovery_type)}
                      </span>
                      <span className="text-[10px] uppercase text-[#64748B]">{item.domain}</span>
                    </div>
                    <h4 className="mt-2 text-base font-semibold text-[#111827]">{item.title}</h4>
                    <p className="mt-1 text-xs text-[#64748B]">{item.organization_name}</p>
                  </div>
                  <button
                    type="button"
                    aria-label={item.is_saved ? `Unsave ${item.title}` : `Save ${item.title}`}
                    onClick={() => void toggleSaved(item)}
                    className="rounded-md border border-[#E5E1D8] p-2 text-[#64748B] hover:border-[#B08D57] hover:text-[#B08D57]"
                  >
                    {item.is_saved ? <BookmarkCheck className="h-4 w-4 text-[#B08D57]" /> : <Bookmark className="h-4 w-4" />}
                  </button>
                </div>

                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#475569]">{item.description}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-sm bg-[#F7F5F0] p-2">
                    <span className="block text-[9px] uppercase text-[#94A3B8]">Funding / Fee</span>
                    <span className="text-[#111827]">{formatMoney(item.stipend_or_grant)}</span>
                  </div>
                  <div className="rounded-sm bg-[#F7F5F0] p-2">
                    <span className="block text-[9px] uppercase text-[#94A3B8]">Deadline</span>
                    <span className="text-[#111827]">{item.deadline ? new Date(item.deadline).toLocaleDateString("en-IN") : "Rolling"}</span>
                  </div>
                </div>

                <div className="mt-4 rounded-sm border border-[rgba(79,111,90,0.22)] bg-[rgba(79,111,90,0.06)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-[#4F6F5A]">
                      <Sparkles className="h-3.5 w-3.5" /> Why recommended?
                    </span>
                    <span className="text-[10px] text-[#4F6F5A]">{Math.round(item.recommendation_score * 100)}% relevance</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-[10px] leading-relaxed text-[#475569]">
                    {item.why_recommended.map((reason) => <li key={reason}>• {reason}</li>)}
                  </ul>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#E5E1D8] pt-3">
                  <button type="button" onClick={() => setSelected(item)} className="text-xs text-[#475569] hover:text-[#111827]">
                    View details
                  </button>
                  {item.has_applied ? (
                    <span className="rounded-xs bg-[#F7F5F0] px-2 py-1 text-[10px] uppercase text-[#475569]">
                      {titleCase(item.application_status || "submitted")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onCreateProposal(item)}
                      className="flex items-center gap-1 rounded-md bg-[#0B0B0A] px-3 py-2 text-xs text-white hover:bg-[#111827]"
                    >
                      Create proposal <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-md border border-[#E5E1D8] bg-white p-6">
        <h3 className="text-sm font-semibold text-[#111827]">Proposal tracker</h3>
        <p className="mt-1 text-[10px] text-[#64748B]">Draft → Submitted → Under Review → Accepted / Rejected → Active Collaboration</p>
        <div className="mt-4 space-y-3">
          {proposals.length === 0 ? (
            <p className="rounded-sm bg-[#F7F5F0] p-4 text-xs text-[#64748B]">No collaboration proposals yet.</p>
          ) : proposals.map((proposal) => {
            const stage = proposalStageIndex(proposal.status);
            return (
              <div key={proposal.id} className="rounded-sm border border-[#E5E1D8] p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">{proposal.proposal_title || proposal.opportunity_title}</p>
                    <p className="text-[10px] text-[#64748B]">{proposal.organization_name}</p>
                  </div>
                  <span className={`w-fit rounded-xs border px-2 py-1 text-[10px] uppercase ${proposal.status === "rejected" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-[#B08D57]/30 bg-[rgba(176,141,87,0.08)] text-[#8A6D3F]"}`}>
                    {titleCase(proposal.status)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1">
                  {proposalStages.map((label, index) => (
                    <div key={label}>
                      <div className={`h-1 rounded-full ${index <= stage ? proposal.status === "rejected" && index === 3 ? "bg-rose-400" : "bg-[#B08D57]" : "bg-[#E5E1D8]"}`} />
                      <span className="mt-1 block text-[8px] uppercase text-[#64748B]">{index === 3 && proposal.status === "rejected" ? "Rejected" : titleCase(label)}</span>
                    </div>
                  ))}
                </div>
                {proposal.workspace_id && (
                  <button type="button" onClick={() => onOpenWorkspace(proposal.workspace_id!)} className="mt-3 flex items-center gap-1 text-[10px] font-semibold uppercase text-[#4F6F5A]">
                    <Building2 className="h-3.5 w-3.5" /> Open active collaboration
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Hub opportunity details">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-[#E5E1D8] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#B08D57]">{titleCase(selected.discovery_type)} · {selected.domain}</span>
                <h3 className="mt-2 text-xl font-semibold text-[#111827]">{selected.title}</h3>
                <p className="mt-1 text-xs text-[#64748B]">{selected.organization_name}</p>
              </div>
              <button type="button" aria-label="Close details" onClick={() => setSelected(null)} className="rounded-md p-2 text-[#64748B] hover:bg-[#F7F5F0]"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-[#475569]">{selected.description}</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-sm bg-[#F7F5F0] p-3 text-xs"><span className="block text-[9px] uppercase text-[#94A3B8]">Funding / Fee</span>{formatMoney(selected.stipend_or_grant)}</div>
              <div className="rounded-sm bg-[#F7F5F0] p-3 text-xs"><span className="block text-[9px] uppercase text-[#94A3B8]">Deadline</span>{selected.deadline ? new Date(selected.deadline).toLocaleDateString("en-IN") : "Rolling"}</div>
            </div>
            <div className="mt-5">
              <span className="text-[10px] uppercase text-[#94A3B8]">Expertise</span>
              <div className="mt-2 flex flex-wrap gap-2">{selected.required_expertise?.map((value) => <span key={value} className="rounded-xs border border-[#E5E1D8] bg-[#F7F5F0] px-2 py-1 text-[10px] text-[#475569]">{value}</span>)}</div>
            </div>
            <div className="mt-5">
              <span className="text-[10px] uppercase text-[#94A3B8]">Collaboration formats</span>
              <div className="mt-2 flex flex-wrap gap-2">{selected.collaboration_types.map((value) => <span key={value} className="rounded-xs border border-[#B08D57]/30 bg-[rgba(176,141,87,0.08)] px-2 py-1 text-[10px] text-[#8A6D3F]">{titleCase(value)}</span>)}</div>
            </div>
            {Object.keys(selected.profile_metadata).length > 0 && (
              <div className="mt-5 rounded-sm border border-[#E5E1D8] p-4">
                <span className="text-[10px] uppercase text-[#94A3B8]">Program / partner details</span>
                <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(selected.profile_metadata).map(([key, value]) => (
                    <div key={key} className="rounded-xs bg-[#F7F5F0] p-2">
                      <dt className="text-[9px] uppercase text-[#94A3B8]">{titleCase(key)}</dt>
                      <dd className="mt-0.5 text-[10px] text-[#475569]">
                        {Array.isArray(value) ? value.join(", ") : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="mt-5 rounded-sm border border-[rgba(79,111,90,0.22)] bg-[rgba(79,111,90,0.06)] p-4 text-xs text-[#475569]">
              <p className="font-semibold text-[#4F6F5A]">Why Recommended?</p>
              {selected.why_recommended.map((reason) => <p key={reason} className="mt-1">• {reason}</p>)}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[#E5E1D8] pt-4">
              {selected.website_url && <a href={selected.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md border border-[#E5E1D8] px-3 py-2 text-xs text-[#475569]">Website <ExternalLink className="h-3.5 w-3.5" /></a>}
              <button type="button" onClick={() => void toggleSaved(selected)} className="rounded-md border border-[#E5E1D8] px-3 py-2 text-xs text-[#475569]">{selected.is_saved ? "Unsave" : "Save"}</button>
              {!selected.has_applied && <button type="button" onClick={() => { setSelected(null); onCreateProposal(selected); }} className="rounded-md bg-[#0B0B0A] px-4 py-2 text-xs text-white">Create proposal</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
