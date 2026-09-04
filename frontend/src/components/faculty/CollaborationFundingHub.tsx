import React, { useEffect, useState } from "react";
import {
  Building2,
  Users,
  Award,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Plus,
  HelpCircle,
  X,
  FileText,
  Globe,
  ChevronRight,
  DollarSign,
} from "lucide-react";
import { api } from "../../api/service";
import { errorMessage } from "../../api/client";
import type {
  ProfessionalSociety,
  IndustryExpert,
  FundingOpportunity,
  FundingRecommendation,
  FacultyProposal,
  ProposalCreateInput,
} from "../../api/types";
import { toast } from "sonner";

interface CollaborationFundingHubProps {
  token: string;
  onNavigateToTrainingPlanner?: (trainingTitle?: string) => void;
  initialSubTab?: "societies" | "experts" | "funding" | "proposals";
}

export function CollaborationFundingHub({
  token,
  onNavigateToTrainingPlanner,
  initialSubTab = "societies",
}: CollaborationFundingHubProps) {
  const [subTab, setSubTab] = useState<"societies" | "experts" | "funding" | "proposals">(initialSubTab);
  const [loading, setLoading] = useState(true);

  // Data States
  const [societies, setSocieties] = useState<ProfessionalSociety[]>([]);
  const [experts, setExperts] = useState<IndustryExpert[]>([]);
  const [fundingOpps, setFundingOpps] = useState<FundingOpportunity[]>([]);
  const [recommendations, setRecommendations] = useState<FundingRecommendation[]>([]);
  const [proposals, setProposals] = useState<FacultyProposal[]>([]);

  // Search & Filter
  const [domainFilter, setDomainFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Selected items
  const [selectedSociety, setSelectedSociety] = useState<ProfessionalSociety | null>(null);
  const [selectedExpert, setSelectedExpert] = useState<IndustryExpert | null>(null);
  const [selectedFunding, setSelectedFunding] = useState<FundingOpportunity | null>(null);
  const [selectedProposal, setSelectedProposal] = useState<FacultyProposal | null>(null);

  // Proposal Builder Modal Form
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [proposalForm, setProposalForm] = useState<ProposalCreateInput>({
    partner_organization: "",
    proposal_type: "Workshop Grant",
    title: "",
    objective: "",
    target_cohort: "B.Tech Computer Science & Engineering (3rd & 4th Year)",
    expected_participants: 80,
    duration_days: 2,
    required_infrastructure: "Computer Lab with 60 workstations, 100 Mbps Internet, Projector, and AWS Cloud Lab Credits.",
    budget_requested: 45000,
    expected_outcomes: "80+ Students achieve verified competencies; prototype models deployed; co-branded certificates issued.",
  });

  useEffect(() => {
    void loadData();
  }, [token]);

  async function loadData() {
    try {
      setLoading(true);
      const [socRes, expRes, fundRes, recRes, propRes] = await Promise.allSettled([
        api.getProfessionalSocieties(token),
        api.getIndustryExperts(token),
        api.getFundingOpportunities(token),
        api.getRecommendedFunding(token),
        api.getFacultyProposals(token),
      ]);

      if (socRes.status === "fulfilled") setSocieties(socRes.value);
      if (expRes.status === "fulfilled") setExperts(expRes.value);
      if (fundRes.status === "fulfilled") setFundingOpps(fundRes.value);
      if (recRes.status === "fulfilled") setRecommendations(recRes.value);
      if (propRes.status === "fulfilled") setProposals(propRes.value);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load Collaboration & Funding Hub data"));
    } finally {
      setLoading(false);
    }
  }

  function openProposalForSociety(soc: ProfessionalSociety) {
    setProposalForm((prev) => ({
      ...prev,
      society_id: soc.id,
      partner_organization: soc.name,
      proposal_type: "Society Technical Workshop / Chapter Grant",
      title: `Collaboration Proposal: ${soc.name} Faculty-Led Workshop`,
      objective: `Organize technical skill workshops and student chapter activities in partnership with ${soc.name}.`,
    }));
    setShowProposalModal(true);
  }

  function openProposalForExpert(expert: IndustryExpert) {
    setProposalForm((prev) => ({
      ...prev,
      expert_id: expert.id,
      partner_organization: `${expert.organization} (Expert: ${expert.name})`,
      proposal_type: "Expert Lecture & Hands-on Masterclass",
      title: `Expert Session Proposal: ${expert.topics_offered[0] || expert.name}`,
      objective: `Invite ${expert.name} (${expert.designation}) to conduct hands-on training for students and faculty.`,
    }));
    setShowProposalModal(true);
  }

  function openProposalForFunding(fund: FundingOpportunity) {
    setProposalForm((prev) => ({
      ...prev,
      funding_id: fund.id,
      partner_organization: fund.organization,
      proposal_type: fund.funding_type,
      title: `Grant Application: ${fund.title}`,
      objective: `Institutional proposal seeking grant support under ${fund.title} to modernize labs and train students.`,
      budget_requested: fund.amount_numeric,
    }));
    setShowProposalModal(true);
  }

  async function handleCreateProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!proposalForm.title.trim() || !proposalForm.partner_organization.trim()) {
      toast.error("Please provide proposal title and partner organization.");
      return;
    }
    try {
      setSubmittingProposal(true);
      const created = await api.createFacultyProposal(proposalForm, token);
      setProposals((prev) => [created, ...prev]);
      setShowProposalModal(false);
      setSubmittingProposal(false);
      setSelectedProposal(created);
      setSubTab("proposals");
      toast.success("Proposal draft created successfully!");
    } catch (err) {
      setSubmittingProposal(false);
      toast.error(errorMessage(err, "Failed to create proposal"));
    }
  }

  async function handleStatusTransition(proposalId: string, newStatus: string) {
    try {
      const updated = await api.updateFacultyProposalStatus(
        proposalId,
        newStatus,
        `Status progressed to ${newStatus.replace("_", " ")} by faculty coordinator.`,
        token
      );
      setProposals((prev) => prev.map((p) => (p.id === proposalId ? updated : p)));
      if (selectedProposal?.id === proposalId) {
        setSelectedProposal(updated);
      }
      toast.success(`Proposal moved to: ${newStatus.replace("_", " ").toUpperCase()}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update status"));
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "collaboration_active":
      case "accepted":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "under_review":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "submitted":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "draft":
        return "bg-stone-50 text-stone-700 border-stone-200";
      default:
        return "bg-stone-100 text-stone-600 border-stone-200";
    }
  };

  const domainOptions = ["All", "AI & Machine Learning", "Cloud Computing", "Cybersecurity", "Robotics", "IoT", "Software Engineering"];

  const filteredSocieties = societies.filter((s) => {
    const matchesDomain = domainFilter === "All" || s.domains.some((d) => d.toLowerCase().includes(domainFilter.toLowerCase()));
    const matchesQuery = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesQuery;
  });

  const filteredExperts = experts.filter((e) => {
    const matchesDomain = domainFilter === "All" || e.expertise.some((x) => x.toLowerCase().includes(domainFilter.toLowerCase()));
    const matchesQuery = !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.organization.toLowerCase().includes(searchQuery.toLowerCase()) || e.expertise.join(" ").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesQuery;
  });

  const filteredFunding = fundingOpps.filter((f) => {
    const matchesDomain = domainFilter === "All" || f.domains.some((d) => d.toLowerCase().includes(domainFilter.toLowerCase()));
    const matchesQuery = !searchQuery || f.title.toLowerCase().includes(searchQuery.toLowerCase()) || f.organization.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDomain && matchesQuery;
  });

  if (loading) {
    return (
      <div className="p-12 text-center max-w-6xl mx-auto">
        <div className="inline-block animate-spin h-7 w-7 border-2 border-[#B08D57] border-t-transparent rounded-full mb-3" />
        <p className="text-xs font-mono text-[#64748B]">Loading Collaboration & Funding Hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Header Banner */}
      <div className="border border-[#E5E1D8] bg-[#FFFFFF] rounded-md p-6 md:p-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#B08D57] mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Institutional Partnerships & Capital</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
              Collaboration & Funding Hub
            </h1>
            <p className="text-xs text-[#475569] mt-1 font-mono">
              From intent to execution: <span className="text-[#B08D57]">Find Partners</span> → <span className="text-[#B08D57]">Secure Grants</span> → <span className="text-[#B08D57]">Send Proposals</span> → <span className="text-[#4F6F5A]">Active Collaboration</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToTrainingPlanner && (
              <button
                type="button"
                onClick={() => onNavigateToTrainingPlanner()}
                className="px-3.5 py-2 border border-[#E5E1D8] bg-[#F7F5F0] hover:bg-[#EAE6DF] text-[#111827] font-mono text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Training Planner</span>
                <ChevronRight className="h-3.5 w-3.5 text-[#B08D57]" />
              </button>
            )}
            <button
              onClick={() => {
                setProposalForm({
                  partner_organization: "",
                  proposal_type: "Workshop Grant",
                  title: "",
                  objective: "",
                  target_cohort: "B.Tech CSE / IT Cohort",
                  expected_participants: 80,
                  duration_days: 2,
                  required_infrastructure: "Computer Lab & Internet",
                  budget_requested: 35000,
                  expected_outcomes: "Students receive verified credentials.",
                });
                setShowProposalModal(true);
              }}
              className="px-4 py-2 border border-[#B08D57] bg-[#B08D57] hover:bg-[#9a7b4c] text-white font-mono text-xs font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Proposal</span>
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-[#E5E1D8]">
          {[
            { id: "societies", label: "Professional Societies", icon: Building2, count: societies.length },
            { id: "experts", label: "Industry Experts", icon: Users, count: experts.length },
            { id: "funding", label: "Funding Explorer", icon: DollarSign, count: fundingOpps.length },
            { id: "proposals", label: "Proposal Workspace", icon: FileText, count: proposals.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-md font-mono text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#0B0B0A] text-[#FFFFFF] font-medium shadow-xs"
                    : "border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-[#E5E1D8] text-[#475569]"}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-[#64748B] uppercase">Domain:</span>
          {domainOptions.map((dom) => (
            <button
              key={dom}
              onClick={() => setDomainFilter(dom)}
              className={`px-3 py-1 rounded-sm text-xs font-mono transition-colors cursor-pointer ${
                domainFilter === dom
                  ? "bg-[#B08D57] text-white"
                  : "border border-[#E5E1D8] bg-[#FFFFFF] text-[#64748B] hover:text-[#111827]"
              }`}
            >
              {dom}
            </button>
          ))}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search partners, experts, grants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full font-mono text-xs pl-9 pr-4 py-2 rounded-md bg-[#FFFFFF] border border-[#E5E1D8] text-[#111827] placeholder:text-[#64748B] focus:border-[#B08D57] focus:outline-none"
          />
        </div>
      </div>

      {/* SUBTAB 1: PROFESSIONAL SOCIETIES */}
      {subTab === "societies" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredSocieties.map((soc) => (
              <div
                key={soc.id}
                className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] flex flex-col justify-between space-y-5 hover:border-[#B08D57]/50 transition-colors shadow-2xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-xs border border-[#E5E1D8] text-[#B08D57]">
                        Accredited Society
                      </span>
                      <h3 className="text-xl font-normal text-[#111827] mt-1.5" style={{ fontFamily: "var(--font-display)" }}>
                        {soc.name}
                      </h3>
                    </div>
                    {soc.website && (
                      <a
                        href={soc.website}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 border border-[#E5E1D8] rounded-md text-[#64748B] hover:text-[#111827] transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-[#475569] leading-relaxed line-clamp-3">{soc.description}</p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {soc.domains.map((dom) => (
                      <span key={dom} className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-[#F7F5F0] text-[#475569] border border-[#E5E1D8]">
                        {dom}
                      </span>
                    ))}
                  </div>

                  {/* Highlights Box */}
                  <div className="bg-[#F7F5F0] p-3.5 rounded-sm border border-[#E5E1D8] space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#111827]">
                      <span className="text-[#64748B]">Membership Fee:</span>
                      <span className="font-bold">{soc.membership_fee}</span>
                    </div>
                    {soc.funding_sponsorship_details && (
                      <div className="text-[11px] text-[#4F6F5A] pt-1 border-t border-[#E5E1D8]/60 flex items-start gap-1.5">
                        <Award className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{soc.funding_sponsorship_details}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-[#E5E1D8] flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedSociety(soc)}
                    className="px-3 py-1.5 border border-[#E5E1D8] hover:bg-[#F7F5F0] text-[#111827] text-xs font-mono rounded-md transition-colors cursor-pointer"
                  >
                    View Full Profile
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openProposalForSociety(soc)}
                      className="px-3.5 py-1.5 bg-[#0B0B0A] hover:bg-[#262626] text-white text-xs font-mono rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="h-3 w-3" />
                      <span>Create Proposal</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 2: INDUSTRY EXPERTS DIRECTORY */}
      {subTab === "experts" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExperts.map((exp) => (
              <div
                key={exp.id}
                className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] flex flex-col justify-between space-y-4 hover:border-[#B08D57]/50 transition-colors shadow-2xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-[#B08D57] uppercase tracking-wider block">
                        {exp.experience_years}+ Years Experience
                      </span>
                      <h3 className="text-lg font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                        {exp.name}
                      </h3>
                      <p className="text-xs font-mono text-[#475569] mt-0.5">{exp.designation}</p>
                      <p className="text-xs text-[#B08D57] font-mono">{exp.organization}</p>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <span className="text-amber-600 font-bold flex items-center gap-1 justify-end">
                        ★ {exp.rating}
                      </span>
                      <span className="text-[10px] text-[#64748B] block">{exp.sessions_delivered} Sessions</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#475569] leading-relaxed line-clamp-3">{exp.bio}</p>

                  <div className="flex flex-wrap gap-1">
                    {exp.expertise.map((sk) => (
                      <span key={sk} className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-[#F7F5F0] text-[#475569] border border-[#E5E1D8]">
                        {sk}
                      </span>
                    ))}
                  </div>

                  <div className="p-3 bg-[#F7F5F0] rounded-sm border border-[#E5E1D8] text-[11px] font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Honorarium:</span>
                      <span className="text-[#111827] font-bold">{exp.speaking_fee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#64748B]">Availability:</span>
                      <span className="text-[#4F6F5A]">{exp.availability}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5E1D8] flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedExpert(exp)}
                    className="px-2.5 py-1.5 border border-[#E5E1D8] hover:bg-[#F7F5F0] text-[#111827] text-xs font-mono rounded-md"
                  >
                    Topics ({exp.topics_offered.length})
                  </button>
                  <button
                    onClick={() => openProposalForExpert(exp)}
                    className="px-3.5 py-1.5 bg-[#B08D57] hover:bg-[#9a7b4c] text-white text-xs font-mono rounded-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Invite Expert</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: FUNDING EXPLORER */}
      {subTab === "funding" && (
        <div className="space-y-6">
          {/* Explainable Recommendations Banner */}
          {recommendations.length > 0 && (
            <div className="border border-[#B08D57]/40 bg-[#FAF7F2] rounded-md p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-[#B08D57] font-bold uppercase tracking-wider">
                <Sparkles className="h-4 w-4" />
                <span>Explainable Funding Matches for Your Department</span>
              </div>
              <p className="text-xs text-[#475569]">
                These grant opportunities match student skill gaps (e.g. Model Deployment, Cloud Sandboxes) and your verified research domain.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredFunding.map((fund) => (
              <div
                key={fund.id}
                className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] flex flex-col justify-between space-y-4 hover:border-[#B08D57]/50 transition-colors shadow-2xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-[#B08D57] uppercase tracking-wider px-2 py-0.5 rounded-xs border border-[#E5E1D8]">
                        {fund.funding_type}
                      </span>
                      <h3 className="text-xl font-normal text-[#111827] mt-1.5" style={{ fontFamily: "var(--font-display)" }}>
                        {fund.title}
                      </h3>
                      <p className="text-xs font-mono text-[#475569] mt-0.5">{fund.organization}</p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-base font-bold text-[#4F6F5A] block">{fund.amount}</span>
                      {fund.deadline && (
                        <span className="text-[10px] text-amber-700 flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" /> Due {new Date(fund.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Explainability Rationale */}
                  {fund.why_recommended && (
                    <div className="p-3 bg-[#FAF7F2] border border-[#B08D57]/30 rounded-sm text-xs space-y-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-bold flex items-center gap-1">
                        <HelpCircle className="h-3.5 w-3.5" /> Why Recommended?
                      </span>
                      <p className="text-stone-700 leading-relaxed italic">{fund.why_recommended}</p>
                    </div>
                  )}

                  <div className="text-xs font-mono text-[#64748B] space-y-1 pt-1">
                    <p>
                      <strong>Eligibility:</strong> {fund.eligibility}
                    </p>
                    <p>
                      <strong>Supported Events:</strong> {fund.supported_event_types.join(", ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {fund.domains.map((dom) => (
                      <span key={dom} className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-[#F7F5F0] text-[#475569] border border-[#E5E1D8]">
                        {dom}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5E1D8] flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedFunding(fund)}
                    className="px-3 py-1.5 border border-[#E5E1D8] hover:bg-[#F7F5F0] text-[#111827] text-xs font-mono rounded-md"
                  >
                    Required Docs ({fund.required_documents.length})
                  </button>
                  <button
                    onClick={() => openProposalForFunding(fund)}
                    className="px-3.5 py-1.5 bg-[#0B0B0A] hover:bg-[#262626] text-white text-xs font-mono rounded-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    <span>Apply / Draft Proposal</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 4: PROPOSAL WORKSPACE & TRACKING */}
      {subTab === "proposals" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
              Active Proposals & Collaboration Lifecycle
            </h3>
            <span className="text-xs font-mono text-[#64748B]">{proposals.length} Total Records</span>
          </div>

          {proposals.length === 0 ? (
            <div className="p-12 text-center border border-[#E5E1D8] rounded-md bg-white space-y-3">
              <FileText className="h-8 w-8 text-[#64748B] mx-auto" />
              <p className="text-sm font-medium text-[#111827]">No active proposals yet</p>
              <p className="text-xs text-[#64748B] max-w-md mx-auto font-mono">
                Select any professional society, expert, or grant opportunity to generate your first structured collaboration proposal.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {proposals.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] hover:border-[#B08D57]/50 transition-colors shadow-2xs space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-xs border ${getStatusColor(prop.status)}`}>
                          ● {prop.status.replace("_", " ")}
                        </span>
                        <span className="text-xs font-mono text-[#64748B]">{prop.proposal_type}</span>
                      </div>
                      <h4 className="text-lg font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                        {prop.title}
                      </h4>
                      <p className="text-xs font-mono text-[#475569] mt-0.5">
                        Partner: <strong className="text-[#B08D57]">{prop.partner_organization}</strong> · Budget: ₹
                        {prop.budget_requested.toLocaleString()}
                      </p>
                    </div>

                    {/* Lifecycle Progress Bar */}
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      {["draft", "submitted", "under_review", "accepted", "collaboration_active"].map((st, idx) => {
                        const statusOrder = ["draft", "submitted", "under_review", "accepted", "collaboration_active"];
                        const currentIdx = statusOrder.indexOf(prop.status);
                        const isDone = currentIdx >= idx;
                        return (
                          <div key={st} className="flex items-center gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-xs border ${
                                isDone ? "bg-[#0B0B0A] text-white border-[#0B0B0A]" : "bg-[#F7F5F0] text-[#64748B] border-[#E5E1D8]"
                              }`}
                            >
                              {st.replace("_", " ")}
                            </span>
                            {idx < 4 && <ChevronRight className="h-3 w-3 text-[#CBD5E1]" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-xs text-[#475569] leading-relaxed line-clamp-2">{prop.objective}</p>

                  {/* Actions & Lifecycle Simulator */}
                  <div className="pt-3 border-t border-[#E5E1D8] flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] font-mono text-[#64748B]">
                      {prop.events.length} audit events logged · Created {new Date(prop.created_at).toLocaleDateString()}
                    </div>

                    <div className="flex items-center gap-2">
                      {prop.status === "draft" && (
                        <button
                          onClick={() => handleStatusTransition(prop.id, "submitted")}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-mono rounded-md cursor-pointer"
                        >
                          Submit to Partner
                        </button>
                      )}
                      {prop.status === "submitted" && (
                        <button
                          onClick={() => handleStatusTransition(prop.id, "under_review")}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-mono rounded-md cursor-pointer"
                        >
                          Mark Under Review
                        </button>
                      )}
                      {prop.status === "under_review" && (
                        <button
                          onClick={() => handleStatusTransition(prop.id, "accepted")}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono rounded-md cursor-pointer"
                        >
                          Accept Proposal
                        </button>
                      )}
                      {prop.status === "accepted" && (
                        <button
                          onClick={() => handleStatusTransition(prop.id, "collaboration_active")}
                          className="px-3 py-1 bg-[#B08D57] hover:bg-[#9a7b4c] text-white text-xs font-mono rounded-md cursor-pointer"
                        >
                          Activate Collaboration
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedProposal(prop)}
                        className="px-3 py-1 border border-[#E5E1D8] hover:bg-[#F7F5F0] text-[#111827] text-xs font-mono rounded-md cursor-pointer"
                      >
                        View Full Details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROPOSAL BUILDER MODAL */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-md max-w-2xl w-full p-6 md:p-8 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
              <div>
                <span className="text-[10px] font-mono text-[#B08D57] uppercase tracking-wider">Draft Proposal Workflow</span>
                <h3 className="text-xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                  Institutional Collaboration & Grant Proposal
                </h3>
              </div>
              <button onClick={() => setShowProposalModal(false)} className="text-[#64748B] hover:text-[#111827]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProposal} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#64748B] mb-1">Partner Organization *</label>
                  <input
                    type="text"
                    required
                    value={proposalForm.partner_organization}
                    onChange={(e) => setProposalForm({ ...proposalForm, partner_organization: e.target.value })}
                    className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Proposal / Program Type</label>
                  <select
                    value={proposalForm.proposal_type}
                    onChange={(e) => setProposalForm({ ...proposalForm, proposal_type: e.target.value })}
                    className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  >
                    <option value="Workshop Grant">Workshop Grant</option>
                    <option value="Research Sponsorship">Research Sponsorship</option>
                    <option value="Faculty Development Program">Faculty Development Program</option>
                    <option value="Expert Guest Lecture">Expert Guest Lecture</option>
                    <option value="Student Chapter Activity">Student Chapter Activity</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#64748B] mb-1">Proposal Title *</label>
                <input
                  type="text"
                  required
                  value={proposalForm.title}
                  onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                  className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  placeholder="e.g. Applied Machine Learning & MLOps 2-Day Intensive Hands-on Workshop"
                />
              </div>

              <div>
                <label className="block text-[#64748B] mb-1">Objective & Problem Statement *</label>
                <textarea
                  required
                  rows={3}
                  value={proposalForm.objective}
                  onChange={(e) => setProposalForm({ ...proposalForm, objective: e.target.value })}
                  className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  placeholder="Describe target skill competencies, curriculum modernization goals, and alignment with industry standards..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#64748B] mb-1">Target Cohort</label>
                  <input
                    type="text"
                    value={proposalForm.target_cohort || ""}
                    onChange={(e) => setProposalForm({ ...proposalForm, target_cohort: e.target.value })}
                    className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Expected Participants</label>
                  <input
                    type="number"
                    value={proposalForm.expected_participants || 80}
                    onChange={(e) => setProposalForm({ ...proposalForm, expected_participants: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Requested Budget (₹)</label>
                  <input
                    type="number"
                    value={proposalForm.budget_requested || 45000}
                    onChange={(e) => setProposalForm({ ...proposalForm, budget_requested: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#64748B] mb-1">Required Infrastructure</label>
                <input
                  type="text"
                  value={proposalForm.required_infrastructure || ""}
                  onChange={(e) => setProposalForm({ ...proposalForm, required_infrastructure: e.target.value })}
                  className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  placeholder="e.g. Computer Lab with 60 workstations, 100 Mbps Internet, Projector"
                />
              </div>

              <div>
                <label className="block text-[#64748B] mb-1">Expected Outcomes</label>
                <input
                  type="text"
                  value={proposalForm.expected_outcomes || ""}
                  onChange={(e) => setProposalForm({ ...proposalForm, expected_outcomes: e.target.value })}
                  className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  placeholder="e.g. 80+ Students earn verified credentials; 15 models deployed"
                />
              </div>

              <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="px-4 py-2 border border-[#E5E1D8] hover:bg-[#F7F5F0] rounded-md text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingProposal}
                  className="px-5 py-2 bg-[#0B0B0A] hover:bg-[#262626] text-white rounded-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{submittingProposal ? "Creating..." : "Save & Generate Draft"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SOCIETY DETAIL DRAWER / MODAL */}
      {selectedSociety && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-md max-w-2xl w-full p-6 md:p-8 space-y-5 my-8 font-sans">
            <div className="flex items-start justify-between border-b border-[#E5E1D8] pb-4">
              <div>
                <span className="text-[10px] font-mono text-[#B08D57] uppercase tracking-wider">Professional Society Dossier</span>
                <h3 className="text-2xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedSociety.name}
                </h3>
              </div>
              <button onClick={() => setSelectedSociety(null)} className="text-[#64748B] hover:text-[#111827]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono text-[#475569]">
              <p className="text-sm font-sans text-[#111827] leading-relaxed">{selectedSociety.description}</p>

              <div>
                <h5 className="font-bold text-[#111827] uppercase text-[11px] mb-2">Available Programs & Fellowships:</h5>
                <ul className="list-disc pl-5 space-y-1">
                  {selectedSociety.available_programs.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h5 className="font-bold text-[#111827] uppercase text-[11px] mb-2">Institutional Benefits:</h5>
                <ul className="list-disc pl-5 space-y-1">
                  {selectedSociety.benefits.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>

              {selectedSociety.expert_speakers.length > 0 && (
                <div>
                  <h5 className="font-bold text-[#111827] uppercase text-[11px] mb-2">Distinguished Speakers:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedSociety.expert_speakers.map((spk) => (
                      <div key={spk.name} className="p-2.5 bg-[#F7F5F0] rounded-sm border border-[#E5E1D8]">
                        <span className="font-bold text-[#111827] block">{spk.name}</span>
                        <span className="text-[10px] text-[#64748B]">{spk.topic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3.5 bg-[#F7F5F0] rounded-sm border border-[#E5E1D8] space-y-1">
                <span className="font-bold text-[#111827] block">Proposal Requirements:</span>
                <p className="text-[#475569]">{selectedSociety.proposal_requirements || "Standard workshop grant form with itemized budget."}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedSociety(null)}
                className="px-4 py-2 border border-[#E5E1D8] hover:bg-[#F7F5F0] rounded-md text-[#64748B] font-mono text-xs"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const s = selectedSociety;
                  setSelectedSociety(null);
                  openProposalForSociety(s);
                }}
                className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#262626] text-white rounded-md font-mono text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Create Proposal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPERT TOPICS MODAL */}
      {selectedExpert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-md max-w-lg w-full p-6 space-y-4 font-mono text-xs">
            <div className="flex items-start justify-between border-b border-[#E5E1D8] pb-3">
              <div>
                <span className="text-[10px] text-[#B08D57] uppercase tracking-wider">Speaker Topics</span>
                <h3 className="text-lg font-normal text-[#111827] mt-1 font-sans" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedExpert.name}
                </h3>
              </div>
              <button onClick={() => setSelectedExpert(null)} className="text-[#64748B] hover:text-[#111827]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-[#111827] block">Hands-on Workshops & Keynote Topics:</span>
              <ul className="space-y-2">
                {selectedExpert.topics_offered.map((top, idx) => (
                  <li key={idx} className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm text-[#111827]">
                    📌 {top}
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-[#E5E1D8] flex items-center justify-end gap-2">
              <button onClick={() => setSelectedExpert(null)} className="px-3 py-1.5 border border-[#E5E1D8] rounded-md">
                Close
              </button>
              <button
                onClick={() => {
                  const exp = selectedExpert;
                  setSelectedExpert(null);
                  openProposalForExpert(exp);
                }}
                className="px-3.5 py-1.5 bg-[#B08D57] hover:bg-[#9a7b4c] text-white rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Invite to Program</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FUNDING DOCS MODAL */}
      {selectedFunding && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-md max-w-lg w-full p-6 space-y-4 font-mono text-xs">
            <div className="flex items-start justify-between border-b border-[#E5E1D8] pb-3">
              <div>
                <span className="text-[10px] text-[#B08D57] uppercase tracking-wider">Required Documentation</span>
                <h3 className="text-lg font-normal text-[#111827] mt-1 font-sans" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedFunding.title}
                </h3>
              </div>
              <button onClick={() => setSelectedFunding(null)} className="text-[#64748B] hover:text-[#111827]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-[#111827] block">Required Application Dossier:</span>
              <ul className="space-y-2">
                {selectedFunding.required_documents.map((doc, idx) => (
                  <li key={idx} className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm text-[#111827] flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#4F6F5A] shrink-0 mt-0.5" />
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-[#E5E1D8] flex items-center justify-end gap-2">
              <button onClick={() => setSelectedFunding(null)} className="px-3 py-1.5 border border-[#E5E1D8] rounded-md">
                Close
              </button>
              <button
                onClick={() => {
                  const fund = selectedFunding;
                  setSelectedFunding(null);
                  openProposalForFunding(fund);
                }}
                className="px-3.5 py-1.5 bg-[#0B0B0A] hover:bg-[#262626] text-white rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="h-3 w-3" />
                <span>Apply / Draft Proposal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROPOSAL DETAIL MODAL */}
      {selectedProposal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-md max-w-2xl w-full p-6 md:p-8 space-y-5 my-8 font-mono text-xs">
            <div className="flex items-start justify-between border-b border-[#E5E1D8] pb-4">
              <div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-xs border ${getStatusColor(selectedProposal.status)}`}>
                  ● {selectedProposal.status.replace("_", " ")}
                </span>
                <h3 className="text-xl font-normal text-[#111827] mt-1.5 font-sans" style={{ fontFamily: "var(--font-display)" }}>
                  {selectedProposal.title}
                </h3>
                <p className="text-[#64748B] mt-0.5">Partner: {selectedProposal.partner_organization}</p>
              </div>
              <button onClick={() => setSelectedProposal(null)} className="text-[#64748B] hover:text-[#111827]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-[#475569]">
              <div>
                <span className="font-bold text-[#111827] block mb-1">Objective:</span>
                <p className="leading-relaxed bg-[#F7F5F0] p-3 rounded-sm border border-[#E5E1D8]">{selectedProposal.objective}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-[#F7F5F0] rounded-sm border border-[#E5E1D8]">
                  <span className="text-[#64748B] block text-[10px]">Target Cohort</span>
                  <span className="font-bold text-[#111827]">{selectedProposal.target_cohort || "CSE Cohort"}</span>
                </div>
                <div className="p-3 bg-[#F7F5F0] rounded-sm border border-[#E5E1D8]">
                  <span className="text-[#64748B] block text-[10px]">Expected Participants</span>
                  <span className="font-bold text-[#111827]">{selectedProposal.expected_participants}</span>
                </div>
                <div className="p-3 bg-[#F7F5F0] rounded-sm border border-[#E5E1D8]">
                  <span className="text-[#64748B] block text-[10px]">Requested Budget</span>
                  <span className="font-bold text-[#4F6F5A]">₹{selectedProposal.budget_requested.toLocaleString()}</span>
                </div>
              </div>

              {selectedProposal.required_infrastructure && (
                <div>
                  <span className="font-bold text-[#111827] block mb-1">Infrastructure Needed:</span>
                  <p>{selectedProposal.required_infrastructure}</p>
                </div>
              )}

              {selectedProposal.expected_outcomes && (
                <div>
                  <span className="font-bold text-[#111827] block mb-1">Expected Deliverables & Outcomes:</span>
                  <p>{selectedProposal.expected_outcomes}</p>
                </div>
              )}

              {selectedProposal.events.length > 0 && (
                <div className="pt-2 border-t border-[#E5E1D8]">
                  <span className="font-bold text-[#111827] block mb-2">Audit Timeline:</span>
                  <div className="space-y-1.5">
                    {selectedProposal.events.map((ev) => (
                      <div key={ev.id} className="p-2 bg-[#F7F5F0] border border-[#E5E1D8] rounded-xs text-[11px] flex justify-between">
                        <span>
                          <strong>{ev.status.toUpperCase()}:</strong> {ev.notes || "Status updated"}
                        </span>
                        <span className="text-[#64748B]">{new Date(ev.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-end gap-3">
              <button onClick={() => setSelectedProposal(null)} className="px-4 py-2 border border-[#E5E1D8] rounded-md">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
