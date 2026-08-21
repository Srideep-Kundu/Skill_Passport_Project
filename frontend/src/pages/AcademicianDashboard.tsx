import { useEffect, useState } from "react";
import {
  GraduationCap,
  Send,
  Building2,
  Calendar,
  CheckCircle2,
  Sparkles,
  Clock,
} from "lucide-react";
import { api } from "../api/service";
import type { FacultyOpportunity } from "../api/types";
import { toast } from "sonner";

interface Props {
  token: string;
}

export function AcademicianDashboard({ token }: Props) {
  const [opportunities, setOpportunities] = useState<FacultyOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [proposalText, setProposalText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOpportunities();
  }, [token, selectedType]);

  async function loadOpportunities() {
    try {
      setLoading(true);
      const typeParam = selectedType === "all" ? undefined : selectedType;
      const data = await api.getFacultyOpportunities(token, typeParam);
      setOpportunities(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load faculty opportunities");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply(opportunityId: string) {
    if (!proposalText.trim() || proposalText.trim().length < 10) {
      toast.error("Please provide a proposal with at least 10 characters.");
      return;
    }
    try {
      setSubmitting(true);
      await api.applyFacultyOpportunity(opportunityId, proposalText, token);
      toast.success("Faculty application / proposal submitted successfully!");
      setApplyingId(null);
      setProposalText("");
      loadOpportunities();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  }

  const types = [
    { id: "all", label: "All Opportunities" },
    { id: "fdp", label: "FDP & Workshops" },
    { id: "industrial_immersion", label: "Industry Immersion" },
    { id: "research_grant", label: "R&D Grants" },
    { id: "consultancy_request", label: "Consultancy Requests" },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="bg-white dark:bg-[#151921] rounded-3xl p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#3b71d9]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9] dark:text-[#b0c6ff] text-xs font-bold mb-3">
            <GraduationCap className="h-3.5 w-3.5" />
            Faculty & Academician Portal
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
            Industry Collaboration & Research Portal
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl">
            Access sponsored Faculty Development Programs (FDPs), industry sabbaticals, consultancy bidding opportunities, and joint applied research grants.
          </p>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-white/[0.06]">
            <div>
              <span className="text-xs text-slate-400">Active Programs</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{opportunities.length}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Applied Proposals</span>
              <p className="text-xl font-black text-[#3b71d9] mt-0.5">
                {opportunities.filter((o) => o.has_applied).length}
              </p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Total Grant Pool</span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">₹12.25 L</p>
            </div>
            <div>
              <span className="text-xs text-slate-400">Partner Corporates</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">18+</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedType(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedType === t.id
                ? "bg-[#3b71d9] text-white shadow-xs shadow-[#3b71d9]/30"
                : "bg-white dark:bg-[#151921] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Opportunities List */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-[#151921] rounded-2xl border border-slate-200 dark:border-white/[0.08]">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-[#3b71d9] border-t-transparent rounded-full mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading faculty opportunities...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-white/[0.15] transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9] dark:text-[#b0c6ff]">
                    {opp.opportunity_type.replace("_", " ")}
                  </span>
                  {opp.stipend_or_grant && (
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
                      Grant: ₹{(opp.stipend_or_grant / 1000).toFixed(0)}k
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white">{opp.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <strong>{opp.organization_name}</strong> • Domain: {opp.domain}
                </p>

                <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 line-clamp-3">
                  {opp.description}
                </p>

                <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Duration: {opp.duration_weeks} Weeks
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Status: <strong className="capitalize text-slate-700 dark:text-slate-300">{opp.status}</strong>
                  </span>
                </div>
              </div>

              {/* Action / Proposal Submission */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                {opp.has_applied ? (
                  <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      Proposal Submitted
                    </span>
                    <span className="uppercase text-[10px] bg-white dark:bg-emerald-900/50 px-2 py-0.5 rounded-md">
                      {opp.application_status || "In Review"}
                    </span>
                  </div>
                ) : (
                  <div>
                    {applyingId === opp.id ? (
                      <div className="space-y-2">
                        <textarea
                          placeholder="Outline your research focus, curriculum proposal, or consultancy scope..."
                          value={proposalText}
                          onChange={(e) => setProposalText(e.target.value)}
                          rows={3}
                          className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setApplyingId(null)}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleApply(opp.id)}
                            disabled={submitting}
                            className="px-4 py-1.5 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Send className="h-3 w-3" />
                            Submit Proposal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setApplyingId(opp.id)}
                        className="w-full py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-[#3b71d9]/20"
                      >
                        <Sparkles className="h-4 w-4" />
                        Apply / Submit Proposal
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
