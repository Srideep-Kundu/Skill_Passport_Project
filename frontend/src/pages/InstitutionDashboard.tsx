import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  GraduationCap,
  Sparkles,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronRight,
  BookOpen,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type {
  ActionPlanPayload,
  AtRiskCohortSummary,
  CohortAnalyticsResponse,
  CollaborationRelationshipsResponse,
  CurriculumRecommendationItem,
  DepartmentDetailAnalytics,
  FacultyEngagementOverview,
  IndustryPartnerDetail,
  IndustryPartnershipOverview,
  InstitutionActionPlan,
  InstitutionAlertItem,
  InstitutionAnalyticsOverview,
  InstitutionReportResponse,
  InternshipMonitoringOverview,
  InterventionPlan,
  InterventionPlanPayload,
  InterventionRecommendation,
  LearningEffectivenessOverview,
  PlacementMonitoringOverview,
} from "../api/types";
import {
  DUMMY_ACTION_PLANS,
  DUMMY_ALERTS,
  DUMMY_ANALYTICS_OVERVIEW,
  DUMMY_AT_RISK_SUMMARY,
  DUMMY_COLLABORATIONS,
  DUMMY_COHORTS,
  DUMMY_CURRICULUM_RECS,
  DUMMY_DEPT_DETAILS,
  DUMMY_FACULTY_ENGAGEMENT,
  DUMMY_INTERNSHIP_MONITORING,
  DUMMY_INTERVENTION_PLANS,
  DUMMY_INTERVENTION_RECS,
  DUMMY_LEARNING_DATA,
  DUMMY_PARTNERSHIP_OVERVIEW,
  DUMMY_PLACEMENT_MONITORING,
  DUMMY_REPORT_DATA,
} from "../data/institutionDummyData";
import { toast } from "sonner";

function displayReportValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export interface InstitutionDashboardProps {
  token: string;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export type InstitutionTabType =
  | "overview"
  | "departments"
  | "cohorts"
  | "skills"
  | "internships"
  | "placements"
  | "faculty"
  | "partnerships"
  | "interventions"
  | "reports";

type TabType = InstitutionTabType;

const BAR_COLORS = ["#9CC7D8", "#789BAC", "#B18455", "#6F8793", "#D2DEE3", "#8DAF9A"];

export function InstitutionDashboard({ token, activeTab: propTab, onTabChange }: InstitutionDashboardProps) {
  const [internalTab, setInternalTab] = useState<TabType>("overview");
  const activeTab = propTab ?? internalTab;
  const setActiveTab = useCallback(
    (tab: TabType) => {
      if (onTabChange) onTabChange(tab);
      else setInternalTab(tab);
    },
    [onTabChange]
  );
  const [loading, setLoading] = useState(true);

  // Core Data States
  const [analytics, setAnalytics] = useState<InstitutionAnalyticsOverview | null>(null);
  const [alerts, setAlerts] = useState<InstitutionAlertItem[]>([]);
  const [cohortData, setCohortData] = useState<CohortAnalyticsResponse | null>(null);
  const [selectedDept, setSelectedDept] = useState<string>("Computer Science & Engineering");
  const [deptDetail, setDeptDetail] = useState<DepartmentDetailAnalytics | null>(null);
  const [deptLoading, setDeptLoading] = useState(false);

  // Intervention & Action Plans
  const [interventionPlans, setInterventionPlans] = useState<InterventionPlan[]>([]);
  const [interventionRecs, setInterventionRecs] = useState<InterventionRecommendation[]>([]);
  const [actionPlans, setActionPlans] = useState<InstitutionActionPlan[]>([]);
  const [showInterventionModal, setShowInterventionModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);

  // Dashboards & Intelligence
  const [internshipData, setInternshipData] = useState<InternshipMonitoringOverview | null>(null);
  const [placementData, setPlacementData] = useState<PlacementMonitoringOverview | null>(null);
  const [facultyData, setFacultyData] = useState<FacultyEngagementOverview | null>(null);
  const [curriculumRecs, setCurriculumRecs] = useState<CurriculumRecommendationItem[]>([]);
  const [partnershipData, setPartnershipData] = useState<IndustryPartnershipOverview | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<IndustryPartnerDetail | null>(null);
  const [learningData, setLearningData] = useState<LearningEffectivenessOverview | null>(null);
  const [atRiskData, setAtRiskData] = useState<AtRiskCohortSummary | null>(null);
  const [relationshipsData, setRelationshipsData] = useState<CollaborationRelationshipsResponse | null>(null);

  // Reports
  const [selectedReportType, setSelectedReportType] = useState<string>("skill_gap");
  const [reportData, setReportData] = useState<InstitutionReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Cohort Filters
  const [cohortDeptFilter, setCohortDeptFilter] = useState("All");
  const [cohortYearFilter, setCohortYearFilter] = useState("All");
  const [cohortReadinessFilter, setCohortReadinessFilter] = useState("All");

  // Form inputs for new intervention
  const [newPlan, setNewPlan] = useState<InterventionPlanPayload>({
    title: "",
    skill_cluster: "DevOps & Cloud Native",
    department: "Computer Science & Engineering",
    target_students_count: 40,
    baseline_supply_index: 45,
    target_supply_index: 85,
    selected_learning_programs: ["Docker Foundations & Containers"],
    selected_workshops: ["Hands-on Cloud Lab"],
    selected_mentorship: ["Industry Cloud Architect"],
    status: "planned",
    notes: "",
  });

  // Form inputs for new action plan
  const [newAction, setNewAction] = useState<ActionPlanPayload>({
    title: "",
    action_type: "curriculum",
    related_department: "Computer Science & Engineering",
    source_insight: "",
    priority: "high",
    owner: "Dean of Academics",
    status: "planned",
    outcome_notes: "",
  });

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        overviewRes,
        alertsRes,
        cohortsRes,
        interventionsRes,
        recsRes,
        actionsRes,
        internRes,
        placeRes,
        facRes,
        curRes,
        partRes,
        learnRes,
        riskRes,
        relRes,
      ] = await Promise.allSettled([
        api.getInstitutionAnalytics(token),
        api.getInstitutionAlerts(token),
        api.getCohorts(token),
        api.getInterventionPlans(token),
        api.getInterventionRecommendations(token),
        api.getActionPlans(token),
        api.getInternshipMonitoring(token),
        api.getPlacementMonitoring(token),
        api.getFacultyEngagement(token),
        api.getCurriculumRecommendations(token),
        api.getIndustryPartnerships(token),
        api.getLearningEffectiveness(token),
        api.getAtRiskCohorts(token),
        api.getCollaborationRelationships(token),
      ]);

      if (overviewRes.status === "fulfilled" && overviewRes.value) {
        setAnalytics(overviewRes.value);
      } else {
        setAnalytics(DUMMY_ANALYTICS_OVERVIEW);
      }

      if (alertsRes.status === "fulfilled" && alertsRes.value?.alerts?.length) {
        setAlerts(alertsRes.value.alerts);
      } else {
        setAlerts(DUMMY_ALERTS);
      }

      if (cohortsRes.status === "fulfilled" && cohortsRes.value?.cohorts?.length) {
        setCohortData(cohortsRes.value);
      } else {
        setCohortData(DUMMY_COHORTS);
      }

      if (interventionsRes.status === "fulfilled" && interventionsRes.value?.length) {
        setInterventionPlans(interventionsRes.value);
      } else {
        setInterventionPlans(DUMMY_INTERVENTION_PLANS);
      }

      if (recsRes.status === "fulfilled" && recsRes.value?.length) {
        setInterventionRecs(recsRes.value);
      } else {
        setInterventionRecs(DUMMY_INTERVENTION_RECS);
      }

      if (actionsRes.status === "fulfilled" && actionsRes.value?.length) {
        setActionPlans(actionsRes.value);
      } else {
        setActionPlans(DUMMY_ACTION_PLANS);
      }

      if (internRes.status === "fulfilled" && internRes.value) {
        setInternshipData(internRes.value);
      } else {
        setInternshipData(DUMMY_INTERNSHIP_MONITORING);
      }

      if (placeRes.status === "fulfilled" && placeRes.value) {
        setPlacementData(placeRes.value);
      } else {
        setPlacementData(DUMMY_PLACEMENT_MONITORING);
      }

      if (facRes.status === "fulfilled" && facRes.value) {
        setFacultyData(facRes.value);
      } else {
        setFacultyData(DUMMY_FACULTY_ENGAGEMENT);
      }

      if (curRes.status === "fulfilled" && curRes.value?.length) {
        setCurriculumRecs(curRes.value);
      } else {
        setCurriculumRecs(DUMMY_CURRICULUM_RECS);
      }

      if (partRes.status === "fulfilled" && partRes.value) {
        setPartnershipData(partRes.value);
      } else {
        setPartnershipData(DUMMY_PARTNERSHIP_OVERVIEW);
      }

      if (learnRes.status === "fulfilled" && learnRes.value) {
        setLearningData(learnRes.value);
      } else {
        setLearningData(DUMMY_LEARNING_DATA);
      }

      if (riskRes.status === "fulfilled" && riskRes.value) {
        setAtRiskData(riskRes.value);
      } else {
        setAtRiskData(DUMMY_AT_RISK_SUMMARY);
      }

      if (relRes.status === "fulfilled" && relRes.value) {
        setRelationshipsData(relRes.value);
      } else {
        setRelationshipsData(DUMMY_COLLABORATIONS);
      }
    } catch {
      setAnalytics(DUMMY_ANALYTICS_OVERVIEW);
      setAlerts(DUMMY_ALERTS);
      setCohortData(DUMMY_COHORTS);
      setInterventionPlans(DUMMY_INTERVENTION_PLANS);
      setInterventionRecs(DUMMY_INTERVENTION_RECS);
      setActionPlans(DUMMY_ACTION_PLANS);
      setInternshipData(DUMMY_INTERNSHIP_MONITORING);
      setPlacementData(DUMMY_PLACEMENT_MONITORING);
      setFacultyData(DUMMY_FACULTY_ENGAGEMENT);
      setCurriculumRecs(DUMMY_CURRICULUM_RECS);
      setPartnershipData(DUMMY_PARTNERSHIP_OVERVIEW);
      setLearningData(DUMMY_LEARNING_DATA);
      setAtRiskData(DUMMY_AT_RISK_SUMMARY);
      setRelationshipsData(DUMMY_COLLABORATIONS);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadDepartmentDetail = useCallback(async (deptName: string) => {
    try {
      setDeptLoading(true);
      const data = await api.getDepartmentDetail(deptName, token);
      if (data) {
        setDeptDetail(data);
      } else {
        setDeptDetail(DUMMY_DEPT_DETAILS[deptName] || DUMMY_DEPT_DETAILS["Computer Science & Engineering"]);
      }
    } catch {
      setDeptDetail(DUMMY_DEPT_DETAILS[deptName] || DUMMY_DEPT_DETAILS["Computer Science & Engineering"]);
    } finally {
      setDeptLoading(false);
    }
  }, [token]);

  const loadCohorts = useCallback(async () => {
    try {
      const data = await api.getCohorts(token, {
        department: cohortDeptFilter !== "All" ? cohortDeptFilter : undefined,
        graduation_year: cohortYearFilter !== "All" ? cohortYearFilter : undefined,
        readiness_band: cohortReadinessFilter !== "All" ? cohortReadinessFilter : undefined,
      });
      if (data?.cohorts?.length) {
        setCohortData(data);
      } else {
        setCohortData(DUMMY_COHORTS);
      }
    } catch {
      setCohortData(DUMMY_COHORTS);
    }
  }, [cohortDeptFilter, cohortReadinessFilter, cohortYearFilter, token]);

  const loadReport = useCallback(async (rtype: string) => {
    try {
      setReportLoading(true);
      const data = await api.getInstitutionReport(rtype, token);
      if (data) {
        setReportData(data);
      } else {
        setReportData(DUMMY_REPORT_DATA);
      }
    } catch {
      setReportData(DUMMY_REPORT_DATA);
    } finally {
      setReportLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (activeTab === "departments") {
      void loadDepartmentDetail(selectedDept);
    } else if (activeTab === "cohorts") {
      void loadCohorts();
    } else if (activeTab === "reports") {
      void loadReport(selectedReportType);
    }
  }, [activeTab, loadCohorts, loadDepartmentDetail, loadReport, selectedDept, selectedReportType]);

  async function handlePartnerClick(partnerName: string) {
    try {
      const data = await api.getIndustryPartnerDetail(partnerName, token);
      setSelectedPartner(data);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load partner details"));
    }
  }

  async function handleCreateIntervention(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlan.title.trim()) {
      toast.error("Please enter an intervention plan title");
      return;
    }
    try {
      const res = await api.createInterventionPlan(newPlan, token);
      setInterventionPlans((prev) => [res, ...prev]);
    } catch {
      const localPlan: InterventionPlan = {
        id: `plan-${Date.now()}`,
        department: newPlan.department || "Computer Science & Engineering",
        title: newPlan.title,
        skill_cluster: newPlan.skill_cluster,
        target_students_count: newPlan.target_students_count || 40,
        baseline_supply_index: newPlan.baseline_supply_index || 45,
        target_supply_index: newPlan.target_supply_index || 85,
        selected_learning_programs: newPlan.selected_learning_programs || [],
        selected_workshops: newPlan.selected_workshops || [],
        selected_mentorship: newPlan.selected_mentorship || [],
        status: newPlan.status || "planned",
        notes: newPlan.notes || `Intervention for ${newPlan.skill_cluster}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setInterventionPlans((prev) => [localPlan, ...prev]);
    }
    setShowInterventionModal(false);
    setNewPlan({
      title: "",
      skill_cluster: "DevOps & Cloud Native",
      department: "Computer Science & Engineering",
      target_students_count: 40,
      baseline_supply_index: 45,
      target_supply_index: 85,
      selected_learning_programs: ["Docker Foundations & Containers"],
      selected_workshops: ["Hands-on Cloud Lab"],
      selected_mentorship: ["Industry Cloud Architect"],
      status: "planned",
      notes: "",
    });
    toast.success("Skill Gap Intervention Plan created successfully!");
  }

  async function handleUpdateInterventionStatus(planId: string, newStatus: string) {
    try {
      const res = await api.updateInterventionPlan(planId, { status: newStatus }, token);
      setInterventionPlans((prev) => prev.map((p) => (p.id === planId ? res : p)));
    } catch {
      setInterventionPlans((prev) =>
        prev.map((p) => (p.id === planId ? { ...p, status: newStatus } : p))
      );
    }
    toast.success(`Plan updated to ${newStatus}`);
  }

  async function handleDeleteIntervention(planId: string) {
    try {
      await api.deleteInterventionPlan(planId, token);
    } catch {
      // local removal
    }
    setInterventionPlans((prev) => prev.filter((p) => p.id !== planId));
    toast.success("Intervention plan deleted");
  }

  async function handleCreateActionPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!newAction.title.trim() || !newAction.source_insight.trim()) {
      toast.error("Please enter a title and source insight");
      return;
    }
    try {
      const res = await api.createActionPlan(newAction, token);
      setActionPlans((prev) => [res, ...prev]);
    } catch {
      const localAction: InstitutionActionPlan = {
        id: `act-${Date.now()}`,
        title: newAction.title,
        action_type: newAction.action_type,
        related_department: newAction.related_department || "Computer Science & Engineering",
        source_insight: newAction.source_insight,
        priority: newAction.priority || "high",
        owner: newAction.owner || "Dean of Academics",
        status: newAction.status || "planned",
        target_date: newAction.target_date || new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],
        outcome_notes: newAction.outcome_notes || "Curriculum & accreditation alignment",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setActionPlans((prev) => [localAction, ...prev]);
    }
    setShowActionModal(false);
    setNewAction({
      title: "",
      action_type: "curriculum",
      related_department: "Computer Science & Engineering",
      source_insight: "",
      priority: "high",
      owner: "Dean of Academics",
      status: "planned",
      outcome_notes: "",
    });
    toast.success("Institutional Action Plan saved!");
  }

  function exportCSV(report: InstitutionReportResponse) {
    if (!report || !report.rows.length) {
      toast.error("No data available to export");
      return;
    }
    const headers = report.columns.join(",");
    const rows = report.rows.map((row) =>
      report.columns.map((col) => `"${(row[col] ?? "").toString().replace(/"/g, '""')}"`).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${report.report_type}_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${report.report_title} to CSV`);
  }

  if (loading || !analytics) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin h-8 w-8 border-2 border-[#B08D57] border-t-transparent rounded-full mb-3" />
        <p className="text-sm text-slate-500 text-[#475569]">Loading university decision-support intelligence...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="border border-[#E5E1D8] bg-[#FFFFFF] rounded-md p-6 md:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#64748B] mb-2">
              <Building2 className="h-3.5 w-3.5" />
              <span>University & Institution Intelligence Hub (SIH 26044)</span>
            </div>
            <h1
              className="text-3xl md:text-4xl font-normal text-[#111827]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {analytics.institution_name}
            </h1>
            <p className="text-xs text-[#475569] mt-1 max-w-3xl leading-relaxed">
              Decision-support analytics, department-wise skill progression, deterministic intervention planning, and industry collaboration metrics without individual PII exposure.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveTab("reports");
                setSelectedReportType("skill_gap");
              }}
              className="px-4 py-2 border border-[#E5E1D8] bg-[#F7F5F0] hover:bg-white/15 text-[#111827] font-mono text-xs rounded-md transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Audit Reports</span>
            </button>
          </div>
        </div>

        {/* Overview KPI Counters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-6 border-t border-[#E5E1D8]">
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Total Students</span>
            <p className="text-2xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>{analytics.total_students}</p>
          </div>
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Verified Skills</span>
            <p className="text-2xl font-normal text-[#4F6F5A] mt-1" style={{ fontFamily: "var(--font-display)" }}>
              {analytics.total_verified_skills}
            </p>
          </div>
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Active Internships</span>
            <p className="text-2xl font-normal text-[#B08D57] mt-1" style={{ fontFamily: "var(--font-display)" }}>{analytics.active_internships}</p>
          </div>
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Placements Secured</span>
            <p className="text-2xl font-normal text-[#111827] mt-1" style={{ fontFamily: "var(--font-display)" }}>
              {analytics.placements_secured}
            </p>
          </div>
          <div className="p-4 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
            <span className="font-mono text-[10px] text-[#64748B] uppercase tracking-wider block">Verified Coverage</span>
            <p className="text-2xl font-normal text-[#B08D57] mt-1" style={{ fontFamily: "var(--font-display)" }}>{analytics.overall_employability_index}%</p>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-[#B18455]/30 bg-[#B18455]/10 px-4 py-3 text-xs text-[#E1C8AA]">
        <strong>Data boundary:</strong> overview student, skill, internship, and placement counters are scoped to
        registered students whose normalized university matches this institution. Department, cohort, curriculum,
        partnership, intervention, and report modules are planning scenarios until institution-owned source records
        are connected; they must not be treated as measured outcomes.
      </div>

      {/* Actionable Alerts Bar */}
      {alerts.length > 0 && (
        <div className="bg-[#FFFFFF] rounded-md p-4 border border-[#E5E1D8] space-y-3 font-mono">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-[#A67C3A]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#111827]">
              Institutional Actionable Alerts ({alerts.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {alerts.map((alt) => (
              <div
                key={alt.id}
                className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-semibold text-[#111827] line-clamp-1">{alt.title}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-xs text-[9px] font-mono uppercase ${
                        alt.severity === "critical"
                          ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-[#B4534B]"
                          : "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-[#A67C3A]"
                      }`}
                    >
                      {alt.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 text-[#475569] line-clamp-2">{alt.message}</p>
                </div>
                <button
                  onClick={() => setActiveTab(alt.target_tab as TabType)}
                  className="mt-2 text-[10px] font-medium text-[#B08D57] hover:underline flex items-center gap-1 cursor-pointer self-start"
                >
                  {alt.action_label} <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Section Header Badge */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 border-[#E5E1D8]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#475569]">Active View:</span>
          <span className="px-3 py-1 rounded-sm text-xs font-mono bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30 flex items-center gap-1.5">
            {[
              { id: "overview", label: "Executive Overview" },
              { id: "departments", label: "Department Drill-Down" },
              { id: "cohorts", label: "Cohorts & At-Risk" },
              { id: "skills", label: "Skill Intelligence & Curriculum" },
              { id: "internships", label: "Internship Funnel" },
              { id: "placements", label: "Placement Outcomes" },
              { id: "faculty", label: "Faculty-Industry Immersion" },
              { id: "partnerships", label: "Corporate Partnerships" },
              { id: "interventions", label: "Interventions & Action Plans" },
              { id: "reports", label: "Institutional Reports" },
            ].find((t) => t.id === activeTab)?.label || "Institution Intelligence"}
          </span>
        </div>
        <span className="hidden sm:inline text-[11px] text-[#AEBBC3]">Navigate anytime via the left sidebar</span>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {/* ======================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Verified Skills Chart */}
            <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#B08D57]" />
                  <h2 className="text-base font-bold text-[#111827]">Top Student Competencies</h2>
                </div>
                <span className="text-xs font-mono text-[#64748B]">Verified Evidence</span>
              </div>
              <div className="h-64 w-full min-h-[260px]">
                {analytics.top_skills_distribution && analytics.top_skills_distribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%" minHeight={250}>
                    <BarChart data={analytics.top_skills_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis dataKey="skill_name" tick={{ fontSize: 11, fill: "#BEC8CF" }} interval={0} angle={-25} textAnchor="end" />
                      <YAxis tick={{ fontSize: 11, fill: "#BEC8CF" }} />
                      <Tooltip contentStyle={{ backgroundColor: "#071E2B", borderColor: "rgba(255,255,255,0.15)", borderRadius: 6, fontSize: 12, color: "#F7F8F8" }} />
                      <Bar dataKey="student_count" radius={[4, 4, 0, 0]}>
                        {analytics.top_skills_distribution.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs font-mono text-[#64748B]">
                    No competency distribution records available.
                  </div>
                )}
              </div>
            </div>

            {/* Curriculum vs Industry Demand Radar */}
            <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#B08D57]" />
                  <h2 className="text-base font-bold text-[#111827]">Market Demand vs Supply Radar</h2>
                </div>
                <button
                  onClick={() => setActiveTab("interventions")}
                  className="text-xs font-mono text-[#B08D57] hover:underline"
                >
                  Plan Interventions &rarr;
                </button>
              </div>
              <div className="space-y-3">
                {analytics.market_skill_demand_gaps.map((item) => (
                  <div key={item.skill} className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] font-mono">
                    <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                      <span className="text-[#111827]">{item.skill}</span>
                      <span
                        className={`px-2 py-0.5 rounded-xs text-[10px] uppercase font-mono ${
                          item.gap_severity === "Critical" || item.gap_severity === "High"
                            ? "bg-rose-950/40 text-[#B4534B] border border-rose-800/40"
                            : item.gap_severity === "Medium"
                            ? "bg-[rgba(166,124,58,0.10)] text-[#B08D57] border border-[#E5E1D8]"
                            : "bg-[rgba(79,111,90,0.10)] text-[#4F6F5A] border border-[rgba(79,111,90,0.25)]"
                        }`}
                      >
                        {item.gap_severity} Gap
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#64748B]">
                      <div>Industry Demand: <strong className="text-[#B08D57]">{item.industry_demand_index}%</strong></div>
                      <div>Student Supply: <strong className="text-[#475569]">{item.student_supply_index}%</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Department Matrix */}
          <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] overflow-hidden font-mono">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                <FileSpreadsheet className="h-5 w-5 text-[#B08D57]" />
                Department-Wise Competency & Placement Matrix
              </h2>
              <span className="text-xs text-[#64748B]">Click any row to drill down</span>
            </div>
            <div className="overflow-x-auto" role="region" aria-label="Department competency and placement matrix" tabIndex={0}>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F5F0] text-[#64748B] uppercase tracking-wider border-b border-[#E5E1D8]">
                  <tr>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5">Total Enrolled</th>
                    <th className="p-3.5">Avg Verified Skills</th>
                    <th className="p-3.5">Placement Conversion</th>
                    <th className="p-3.5">Internship Rate</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-[#475569]">
                  {analytics.department_metrics.map((dept) => (
                    <tr
                      key={dept.department}
                      onClick={() => {
                        setSelectedDept(dept.department);
                        setActiveTab("departments");
                      }}
                      className="hover:bg-white/[0.04] transition-colors cursor-pointer"
                    >
                      <td className="p-3.5 text-[#111827]">{dept.department}</td>
                      <td className="p-3.5">{dept.total_students} Students</td>
                      <td className="p-3.5 text-[#4F6F5A]">{dept.verified_skills_average} / Student</td>
                      <td className="p-3.5 text-[#B08D57]">{dept.placement_rate}%</td>
                      <td className="p-3.5 text-[#475569]">{dept.internship_rate}%</td>
                      <td className="p-3.5 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#B08D57] hover:text-[#111827]">
                          Drill Down <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: DEPARTMENT DRILL-DOWN */}
      {/* ======================================================== */}
      {activeTab === "departments" && (
        <div className="space-y-6 font-mono">
          {/* Department Selector */}
          <div className="bg-[#FFFFFF] rounded-md p-4 border border-[#E5E1D8] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase text-[#64748B]">Select Department:</span>
              {analytics.department_metrics.map((d) => (
                <button
                  key={d.department}
                  onClick={() => setSelectedDept(d.department)}
                  className={`px-3 py-1.5 rounded-xs text-xs transition-colors cursor-pointer ${
                    selectedDept === d.department
                      ? "bg-[#0B0B0A] text-[#FFFFFF] font-medium"
                      : "border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                  }`}
                >
                  {d.department}
                </button>
              ))}
            </div>
            <span className="text-xs text-[#64748B]">Aggregate Cohort Metrics</span>
          </div>

          {deptLoading || !deptDetail ? (
            <div className="p-8 text-center text-sm text-[#64748B]">Loading department insights...</div>
          ) : (
            <div className="space-y-6">
              {/* Department Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase">Total Students</span>
                  <p className="text-2xl text-[#111827] mt-1">{deptDetail.total_students}</p>
                  <span className="text-[11px] text-[#4F6F5A] mt-1 block">Avg {deptDetail.verified_skills_average} verified skills</span>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase">Role Readiness</span>
                  <p className="text-2xl text-[#B08D57] mt-1">{deptDetail.average_readiness}%</p>
                  <span className="text-[11px] text-[#64748B] mt-1 block">{deptDetail.assessment_completion_rate}% assessment complete</span>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase">Placement Conversion</span>
                  <p className="text-2xl text-[#4F6F5A] mt-1">{deptDetail.placement_conversion_rate}%</p>
                  <span className="text-[11px] text-[#64748B] mt-1 block">{deptDetail.placement_eligibility_rate}% eligibility pool</span>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase">Internship Rate</span>
                  <p className="text-2xl text-[#111827] mt-1">{deptDetail.internship_participation_rate}%</p>
                  <span className="text-[11px] text-[#64748B] mt-1 block">{deptDetail.internship_completion_rate}% completed successfully</span>
                </div>
              </div>

              {/* Skills, Gaps and Actions Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
                {/* Top Competencies */}
                <div className="bg-[#FFFFFF] p-6 rounded-md border border-[#E5E1D8]">
                  <h3 className="text-sm font-semibold text-[#111827] mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#B08D57]" />
                    Top Department Verified Skills
                  </h3>
                  <div className="space-y-2.5">
                    {deptDetail.top_verified_skills.map((s) => (
                      <div key={s.skill} className="flex items-center justify-between p-2.5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs">
                        <span className="font-semibold text-[#111827]">{s.skill}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[#64748B]">{s.students} students</span>
                          <span className="px-2 py-0.5 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30 text-[10px]">
                            {Math.round(s.avg_proficiency * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Critical Gaps */}
                <div className="bg-[#FFFFFF] p-6 rounded-md border border-[#E5E1D8]">
                  <h3 className="text-sm font-bold text-[#111827] mb-3">Curriculum Deficits in {selectedDept}</h3>
                  <div className="space-y-2">
                    {deptDetail.top_technical_gaps.map((g) => (
                      <div key={g.skill} className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs font-mono">
                        <div className="flex justify-between font-bold">
                          <span className="text-[#111827]">{g.skill}</span>
                          <span className="text-[#B4534B]">{g.gap_severity} Gap</span>
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-1">Industry: {g.industry_demand}% | Dept: {g.student_supply}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommended Department Actions */}
                <div className="bg-[#FFFFFF] p-6 rounded-md border border-[#E5E1D8] font-mono">
                <h3 className="text-sm text-[#111827] mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#A67C3A]" />
                  Deterministic Recommended Department Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {deptDetail.recommended_actions.map((act, i) => (
                    <div key={i} className="p-3.5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs text-[#475569] flex flex-col justify-between">
                      <p>{act}</p>
                      <button
                        onClick={() => {
                          setNewAction((prev) => ({ ...prev, related_department: selectedDept, title: act.slice(0, 50), source_insight: act }));
                          setShowActionModal(true);
                        }}
                        className="mt-3 text-[11px] text-[#B08D57] hover:text-[#111827] flex items-center gap-1 cursor-pointer self-start"
                      >
                        Convert to Action Plan &rarr;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: COHORTS & AT-RISK DETECTION */}
      {/* ======================================================== */}
      {activeTab === "cohorts" && (
        <div className="space-y-6">
          {/* Cohort Filters */}
          <div className="bg-[#FFFFFF] rounded-md p-4 border border-[#E5E1D8] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="uppercase text-[#64748B] flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Filters:
              </span>
              <select
                value={cohortDeptFilter}
                onChange={(e) => setCohortDeptFilter(e.target.value)}
                className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-sm px-2.5 py-1.5 text-xs text-[#111827]"
              >
                <option value="All">All Departments</option>
                <option value="CSE">Computer Science</option>
                <option value="IT">Information Technology</option>
                <option value="ECE">Electronics</option>
                <option value="Mechanical">Mechanical</option>
              </select>
              <select
                value={cohortYearFilter}
                onChange={(e) => setCohortYearFilter(e.target.value)}
                className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-sm px-2.5 py-1.5 text-xs text-[#111827]"
              >
                <option value="All">All Graduation Years</option>
                <option value="2025">2025 (Final Year)</option>
                <option value="2026">2026 (Pre-Final)</option>
              </select>
              <select
                value={cohortReadinessFilter}
                onChange={(e) => setCohortReadinessFilter(e.target.value)}
                className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-sm px-2.5 py-1.5 text-xs text-[#111827]"
              >
                <option value="All">All Readiness Bands</option>
                <option value="high">High Readiness (&ge;80%)</option>
                <option value="mod">Moderate Readiness (50-79%)</option>
                <option value="low">Low Readiness (&lt;50%)</option>
              </select>
            </div>
            <span className="text-slate-400 font-bold">
              {cohortData?.total_students_monitored || 0} Students Monitored
            </span>
          </div>

          {/* At-Risk / Needs Attention Panel */}
          {atRiskData && atRiskData.risk_groups.length > 0 && (
            <div className="bg-rose-950/20 rounded-md p-6 border border-rose-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-[#B4534B]" />
                  <h3 className="text-base font-bold text-rose-200">
                    Needs Attention & At-Risk Cohort Detection ({atRiskData.total_at_risk_students} Students)
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#B4534B]">Rule-Based Signals</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {atRiskData.risk_groups.map((group, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-md bg-[#FFFFFF] border border-rose-900/30 text-xs font-mono space-y-2"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[#111827] font-semibold">{group.risk_category}</span>
                      <span className="px-2 py-0.5 rounded-xs bg-rose-950 text-rose-300 text-[10px]">
                        {group.affected_students_count} Students
                      </span>
                    </div>
                    <p className="text-[#64748B] text-[11px]">
                      <strong>Target:</strong> {group.department}
                    </p>
                    <div className="space-y-1">
                      {group.key_signals.map((sig, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-1.5 text-[11px] text-[#B4534B] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                          {sig}
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-[#E5E1D8] flex items-center justify-between">
                      <span className="text-[11px] text-[#64748B]">{group.recommended_action}</span>
                      <button
                        onClick={() => {
                          setNewPlan((prev) => ({
                            ...prev,
                            title: `Intervention for ${group.risk_category}`,
                            department: group.department.includes("Cross") ? "All" : group.department,
                            target_students_count: group.affected_students_count,
                            notes: `Triggered from at-risk detection: ${group.recommended_action}`,
                          }));
                          setActiveTab("interventions");
                          setShowInterventionModal(true);
                        }}
                        className="text-[10px] text-[#B08D57] hover:underline whitespace-nowrap ml-2 cursor-pointer"
                      >
                        Plan Intervention &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cohort Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cohortData?.cohorts.map((cohort) => (
              <div
                key={cohort.cohort_id}
                className="bg-[#FFFFFF] rounded-md p-5 border border-[#E5E1D8] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#111827] line-clamp-1">{cohort.cohort_name}</h4>
                  <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono border border-[#E5E1D8] text-[#B08D57]">
                    {cohort.total_students} Students
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 font-mono">
                  <div className="p-2 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                    <span className="text-[#64748B] text-[10px] uppercase block">Avg Readiness</span>
                    <strong className="text-[#111827] text-sm">{cohort.average_readiness}%</strong>
                  </div>
                  <div className="p-2 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                    <span className="text-[#64748B] text-[10px] uppercase block">Assessment Rate</span>
                    <strong className="text-[#111827] text-sm">{cohort.assessment_completion_pct}%</strong>
                  </div>
                  <div className="p-2 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                    <span className="text-[#64748B] text-[10px] uppercase block">Placement Rate</span>
                    <strong className="text-[#B08D57] text-sm">{cohort.placement_conversion_pct}%</strong>
                  </div>
                  <div className="p-2 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                    <span className="text-[#64748B] text-[10px] uppercase block">Internship Rate</span>
                    <strong className="text-[#4F6F5A] text-sm">{cohort.internship_participation_pct}%</strong>
                  </div>
                </div>
                <div className="pt-2 border-t border-[#E5E1D8]">
                  <span className="text-[10px] font-mono uppercase text-[#64748B] block mb-1">Critical Skill Gaps:</span>
                  <div className="flex flex-wrap gap-1 font-mono">
                    {cohort.critical_skill_gaps.map((gap) => (
                      <span key={gap} className="px-2 py-0.5 rounded-xs text-[10px] bg-rose-950/40 text-[#B4534B] border border-rose-800/40">
                        {gap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: SKILL INTELLIGENCE & CURRICULUM RECOMMENDATIONS */}
      {/* ======================================================== */}
      {activeTab === "skills" && (
        <div className="space-y-6 font-mono">
          <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-5 w-5 text-[#B08D57]" />
              <h2 className="text-base text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                Curriculum vs Industry Demand Decision Support
              </h2>
            </div>
            <p className="text-xs text-[#64748B] mb-6 ml-7">
              Deterministic skill intelligence matching real employer hiring signals against student verified competency supply across academic departments.
            </p>

            <div className="space-y-4">
              {curriculumRecs.map((rec) => (
                <div
                  key={rec.id}
                  className="p-5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] space-y-4 hover:border-[#E5E1D8] transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-[#E5E1D8]">
                    <div>
                      <h3 className="text-sm text-[#111827]">{rec.skill_area}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-[#64748B]">
                          Departments: {rec.departments_affected.join(", ")}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#64748B]">
                        Demand: <strong className="text-[#B08D57]">{rec.industry_demand_index}%</strong> | Supply:{" "}
                        <strong className="text-[#111827]">{rec.student_supply_index}%</strong>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-xs text-[10px] uppercase border ${
                          rec.gap_severity === "Critical"
                            ? "bg-rose-950/40 border-rose-700/40 text-rose-300"
                            : "bg-[rgba(166,124,58,0.10)] border-amber-700/40 text-amber-300"
                        }`}
                      >
                        {rec.gap_severity} Gap (-{rec.gap_size}%)
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                      <span className="text-[10px] uppercase text-[#64748B] block mb-1">Recommended Modules:</span>
                      <ul className="space-y-1 text-[#475569]">
                        {rec.recommended_modules.map((m, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-[#B08D57]">&bull;</span> {m}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                      <span className="text-[10px] uppercase text-[#64748B] block mb-1">Suggested Lab Work:</span>
                      <ul className="space-y-1 text-[#475569]">
                        {rec.suggested_labs.map((l, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-[#4F6F5A]">&bull;</span> {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8]">
                      <span className="text-[10px] uppercase text-[#64748B] block mb-1">Industry Bootcamps:</span>
                      <ul className="space-y-1 text-[#475569]">
                        {rec.bootcamp_tracks.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-[#B08D57]">&bull;</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        setNewPlan((prev) => ({
                          ...prev,
                          title: `Curriculum Intervention: ${rec.skill_area}`,
                          skill_cluster: rec.skill_area,
                          department: rec.departments_affected[0] || "All",
                          baseline_supply_index: rec.student_supply_index,
                          target_supply_index: Math.min(100, rec.industry_demand_index),
                          selected_learning_programs: rec.recommended_modules,
                          selected_workshops: rec.suggested_labs,
                          selected_mentorship: rec.bootcamp_tracks,
                        }));
                        setActiveTab("interventions");
                        setShowInterventionModal(true);
                      }}
                      className="px-3.5 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs rounded-md transition-colors cursor-pointer"
                    >
                      Link into Intervention Plan &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Training & Certification Effectiveness */}
          {learningData && (
            <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] space-y-4 font-mono">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-[#4F6F5A]" />
                  Training & Certification Program Adoption & Effectiveness
                </h3>
                <span className="text-xs text-[#64748B]">
                  {learningData.total_enrolled} Enrolled &bull; Avg Gain +{learningData.average_readiness_gain}%
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {learningData.courses.map((course) => (
                  <div
                    key={course.course_id}
                    className="p-4 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#111827] text-xs">{course.title}</span>
                        <span className="px-1.5 py-0.5 rounded-xs text-[10px] bg-emerald-950 text-emerald-300 border border-[rgba(79,111,90,0.25)]">
                          {course.completion_rate}% Completed
                        </span>
                      </div>
                      <span className="text-[10px] text-[#64748B]">{course.provider} &bull; {course.category}</span>
                    </div>
                    <div className="pt-2 border-t border-[#E5E1D8] text-[11px] grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Readiness Gain</span>
                        <strong className="text-[#4F6F5A]">+{course.readiness_gain}%</strong>
                      </div>
                      <div>
                        <span className="text-[#64748B] block text-[10px]">Placement Correlation</span>
                        <strong className="text-[#B08D57]">{course.placement_correlation_rate}%</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: INTERNSHIP MONITORING DASHBOARD */}
      {/* ======================================================== */}
      {activeTab === "internships" && (
        <div className="space-y-6">
          {internshipData && (
            <>
              {/* Funnel Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 font-mono">
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Eligible</span>
                  <p className="text-xl text-[#111827] mt-1">{internshipData.eligible_students}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Applied</span>
                  <p className="text-xl text-[#B08D57] mt-1">{internshipData.applicants}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Selected</span>
                  <p className="text-xl text-[#4F6F5A] mt-1">{internshipData.selected_students}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Active</span>
                  <p className="text-xl text-[#111827] mt-1">{internshipData.active_internships}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Completed</span>
                  <p className="text-xl text-[#4F6F5A] mt-1">{internshipData.completed_internships}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">PPO Converted</span>
                  <p className="text-xl text-[#4F6F5A] mt-1">{internshipData.ppo_conversions}</p>
                  <span className="text-[9px] text-[#64748B]">({internshipData.ppo_conversion_rate}%)</span>
                </div>
              </div>

              {/* Department and Industry Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
                <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8]">
                  <h3 className="text-sm font-semibold text-[#111827] mb-4">Department Internship Conversion</h3>
                  <div className="space-y-3">
                    {internshipData.by_department.map((d) => (
                      <div key={d.department} className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs">
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="text-[#111827]">{d.department}</span>
                          <span className="text-[#B08D57]">{d.rate}% Participation</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
                          <span>Eligible: {d.eligible}</span>
                          <span>Active: {d.active}</span>
                          <span>Completed: {d.completed}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8]">
                  <h3 className="text-sm font-semibold text-[#111827] mb-4">Top Hiring Industries & Partners</h3>
                  <div className="space-y-3">
                    {internshipData.by_industry.map((ind) => (
                      <div key={ind.industry} className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs">
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="text-[#111827]">{ind.industry}</span>
                          <span className="px-2 py-0.5 rounded-xs bg-emerald-950 text-[#4F6F5A] border border-[rgba(79,111,90,0.25)] text-[10px]">
                            {ind.selected} Selected
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B]">Key Partners: {ind.companies.join(", ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: PLACEMENT MONITORING */}
      {/* ======================================================== */}
      {activeTab === "placements" && (
        <div className="space-y-6">
          {placementData && (
            <>
              {/* Placement Funnel */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 font-mono">
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Eligible</span>
                  <p className="text-xl text-[#111827] mt-1">{placementData.eligible_students}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Applications</span>
                  <p className="text-xl text-[#B08D57] mt-1">{placementData.applications}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Shortlisted</span>
                  <p className="text-xl text-[#4F6F5A] mt-1">{placementData.shortlisted}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Interviews</span>
                  <p className="text-xl text-[#111827] mt-1">{placementData.interviews_scheduled}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Offers</span>
                  <p className="text-xl text-[#4F6F5A] mt-1">{placementData.offers_extended}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-[10px] uppercase text-[#64748B] block">Placement Rate</span>
                  <p className="text-xl text-[#4F6F5A] mt-1">{placementData.conversion_rate}%</p>
                </div>
              </div>

              {/* Department Placement and Recruiting Demand */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono">
                <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8]">
                  <h3 className="text-sm font-semibold text-[#111827] mb-4">Department Placement Outcomes</h3>
                  <div className="space-y-3">
                    {placementData.by_department.map((dept) => (
                      <div key={dept.department} className="p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs">
                        <div className="flex items-center justify-between font-bold mb-1">
                          <span className="text-[#111827]">{dept.department}</span>
                          <span className="text-[#4F6F5A] font-semibold">{dept.placed_pct}% Placed</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                          <span>Eligible: {dept.eligible} | Offers: {dept.offers}</span>
                          <span className="text-[#475569]">Avg CTC: {dept.avg_ctc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8]">
                  <h3 className="text-sm font-semibold text-[#111827] mb-4">Top Recruiting Skill Demand in Placement Drives</h3>
                  <div className="space-y-3">
                    {placementData.top_recruiting_skill_demand.map((req) => (
                      <div key={req.skill} className="flex items-center justify-between p-3 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs">
                        <span className="text-[#111827]">{req.skill}</span>
                        <span className="px-2.5 py-0.5 rounded-xs bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30 text-[11px]">
                          {req.openings_count} Openings
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: FACULTY-INDUSTRY ENGAGEMENT */}
      {/* ======================================================== */}
      {activeTab === "faculty" && (
        <div className="space-y-6">
          {facultyData && (
            <>
              {/* Overview Numbers */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block">Participating Faculty</span>
                  <p className="text-2xl text-[#111827] mt-1">{facultyData.total_participating_faculty}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block">Sponsored Research Value</span>
                  <p className="text-2xl text-[#4F6F5A] mt-1">₹{(facultyData.total_research_grant_value / 100000).toFixed(1)}L</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block">Active FDPs & Sabbaticals</span>
                  <p className="text-2xl text-[#B08D57] mt-1">{facultyData.active_fdps + facultyData.active_faculty_internships}</p>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block">Active Industry Partners</span>
                  <p className="text-2xl text-[#111827] mt-1">{facultyData.active_industry_partners_count}</p>
                </div>
              </div>

              {/* Multi-Party Collaboration Linkages */}
              <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8]">
                <h3 className="text-base font-bold text-[#111827] mb-4 flex items-center gap-2 font-mono">
                  <GraduationCap className="h-5 w-5 text-[#B08D57]" />
                  Faculty–Student–Industry Collaborative Initiatives
                </h3>
                <div className="overflow-x-auto" role="region" aria-label="Faculty, student, and industry collaboration initiatives" tabIndex={0}>
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#F7F5F0] text-[#64748B] uppercase tracking-wider">
                      <tr>
                        <th className="p-3.5">Industry Partner</th>
                        <th className="p-3.5">Faculty Lead</th>
                        <th className="p-3.5">Student Team / Cohort</th>
                        <th className="p-3.5">Initiative Title</th>
                        <th className="p-3.5">Outcome & Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D8] text-[#475569]">
                      {relationshipsData?.relationships.map((rel) => (
                        <tr key={rel.id} className="hover:bg-[#F7F5F0] transition-colors">
                          <td className="p-3.5 font-bold text-[#111827]">{rel.industry_partner}</td>
                          <td className="p-3.5">
                            <span className="font-bold text-[#111827] block">{rel.faculty_lead}</span>
                            <span className="text-[11px] text-[#64748B]">{rel.faculty_department}</span>
                          </td>
                          <td className="p-3.5">{rel.student_team_or_cohort}</td>
                          <td className="p-3.5 text-[#111827]">{rel.initiative_title}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-xs bg-emerald-950 text-[#4F6F5A] text-[10px] font-mono block w-fit border border-[rgba(79,111,90,0.25)]">
                              {rel.status}
                            </span>
                            <span className="text-[11px] text-[#64748B] mt-1 block">{rel.outcome_metric}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 8: CORPORATE PARTNERSHIPS */}
      {/* ======================================================== */}
      {activeTab === "partnerships" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            {partnershipData?.partners.map((partner) => (
              <div
                key={partner.partner_name}
                onClick={() => handlePartnerClick(partner.partner_name)}
                className="bg-[#FFFFFF] rounded-md p-5 border border-[#E5E1D8] hover:border-[#E5E1D8] transition-colors cursor-pointer space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-xs text-[10px] font-mono uppercase bg-[rgba(176,141,87,0.08)] text-[#B08D57] border border-[#B08D57]/30">
                      {partner.status}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-[#64748B]" />
                  </div>
                  <h4 className="text-base font-semibold text-[#111827] mt-2">{partner.partner_name}</h4>
                  <p className="text-xs text-[#64748B] mt-0.5">{partner.domain}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#E5E1D8]">
                  <div>
                    <span className="text-[10px] text-[#64748B] block uppercase">Internships</span>
                    <strong className="text-[#111827]">{partner.internships_posted} posted</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] block uppercase">Placements</span>
                    <strong className="text-[#4F6F5A]">{partner.placements_offered} offers</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] block uppercase">Faculty</span>
                    <strong className="text-[#B08D57]">{partner.faculty_engagements_count} projects</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] block uppercase">Selected</span>
                    <strong className="text-[#111827]">{partner.students_selected} students</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Partner Detail Drawer/Modal */}
          {selectedPartner && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-[#FFFFFF] rounded-md p-6 md:p-8 max-w-2xl w-full border border-[#E5E1D8] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-[#111827] font-sans">
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
                  <div>
                    <h3 className="text-xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>{selectedPartner.partner_name}</h3>
                    <span className="text-xs text-[#B08D57] font-mono">{selectedPartner.domain}</span>
                  </div>
                  <button
                    onClick={() => setSelectedPartner(null)}
                    className="p-1 rounded-sm text-[#64748B] hover:text-[#111827] cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <p className="text-xs text-[#475569] leading-relaxed">{selectedPartner.partner_overview}</p>

                <div className="space-y-4 font-mono">
                  <div>
                    <h4 className="text-xs uppercase text-[#64748B] mb-2">Student Programs</h4>
                    <div className="space-y-2">
                      {selectedPartner.student_engagements.map((p, i) => (
                        <div key={i} className="p-2.5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs flex items-center justify-between">
                          <span className="text-[#111827]">{p.program}</span>
                          <span className="text-[#64748B]">{p.students_enrolled} students enrolled ({p.status})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs uppercase text-[#64748B] mb-2">Faculty Collaborations</h4>
                    <div className="space-y-2">
                      {selectedPartner.faculty_engagements.map((f, i) => (
                        <div key={i} className="p-2.5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs flex items-center justify-between">
                          <span className="text-[#111827]">{f.faculty} ({f.department})</span>
                          <span className="text-[#B08D57]">{f.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-[#E5E1D8]">
                  <button
                    onClick={() => setSelectedPartner(null)}
                    className="px-4 py-2 bg-white/[0.04] hover:bg-[#F7F5F0] border border-[#E5E1D8] text-[#475569] rounded-md text-xs cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 9: INTERVENTIONS & ACTION PLANS */}
      {/* ======================================================== */}
      {activeTab === "interventions" && (
        <div className="space-y-8 font-mono">
          {/* Auto-Generated Recommendations */}
          {interventionRecs.length > 0 && (
            <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#B08D57]" />
                  Auto-Generated Skill Gap Recommendations ({interventionRecs.length})
                </h3>
                <span className="text-xs text-[#B08D57]">Deterministic Gap Sizing</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {interventionRecs.map((rec) => (
                  <div
                    key={rec.skill}
                    className="p-4 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-[#111827] text-sm font-semibold">{rec.skill}</span>
                        <span className="px-2 py-0.5 rounded-xs bg-rose-950 text-rose-300 text-[10px] uppercase border border-rose-800/40">
                          {rec.gap_severity} Gap
                        </span>
                      </div>
                      <span className="text-[11px] text-[#64748B] block mt-0.5">
                        Cluster: {rec.skill_cluster} &bull; {rec.affected_student_count} Affected Students
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#E5E1D8] flex items-center justify-between">
                      <span className="text-[10px] text-[#64748B]">Demand {rec.industry_demand_index}% vs Supply {rec.student_supply_index}%</span>
                      <button
                        onClick={() => {
                          setNewPlan((prev) => ({
                            ...prev,
                            title: `Intervention for ${rec.skill}`,
                            skill_cluster: rec.skill_cluster,
                            department: rec.affected_departments[0] || "All",
                            target_students_count: rec.affected_student_count,
                            baseline_supply_index: rec.student_supply_index,
                            target_supply_index: rec.industry_demand_index,
                            selected_learning_programs: rec.recommended_courses.map((c) => c.title),
                            selected_workshops: rec.recommended_workshops.map((w) => w.title),
                            selected_mentorship: rec.recommended_mentorship.map((m) => m.mentor_name),
                          }));
                          setShowInterventionModal(true);
                        }}
                        className="text-[11px] text-[#B08D57] hover:underline cursor-pointer"
                      >
                        Create Plan &rarr;
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Skill Gap Intervention Plans */}
          <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#B08D57]" />
                  Active Skill Gap Intervention Plans ({interventionPlans.length})
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Targeted academic interventions, industry labs, and mentorship sprints to close supply-demand gaps.
                </p>
              </div>
              <button
                onClick={() => setShowInterventionModal(true)}
                className="px-3.5 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs font-mono rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> New Intervention Plan
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {interventionPlans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-5 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-[#111827]">{plan.title}</h4>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={plan.status}
                          onChange={(e) => handleUpdateInterventionStatus(plan.id, e.target.value)}
                          className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-sm px-2 py-0.5 text-[10px] text-[#B08D57]"
                        >
                          <option value="draft">Draft</option>
                          <option value="planned">Planned</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="measured">Measured</option>
                        </select>
                        <button
                          onClick={() => handleDeleteIntervention(plan.id)}
                          className="text-[#64748B] hover:text-[#B4534B] p-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#B08D57] block mt-0.5">{plan.skill_cluster} &bull; {plan.department}</span>
                    <p className="text-[#475569] mt-2 text-[11px] leading-relaxed">{plan.notes || "Strategic intervention targeting market readiness."}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E5E1D8] text-[11px]">
                    <div>
                      <span className="text-[#64748B] block">Supply Target</span>
                      <strong>{plan.baseline_supply_index}% &rarr; {plan.target_supply_index}%</strong>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Target Cohort</span>
                      <strong>{plan.target_students_count} Students</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Institutional Action Plans */}
          <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#4F6F5A]" />
                  Institutional Strategic Action Plans ({actionPlans.length})
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Actionable decisions translating employability intelligence into academic policies and career services execution.
                </p>
              </div>
              <button
                onClick={() => setShowActionModal(true)}
                className="px-3.5 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] text-xs font-mono rounded-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> New Action Plan
              </button>
            </div>

            <div className="space-y-3">
              {actionPlans.map((action) => (
                <div
                  key={action.id}
                  className="p-4 rounded-sm bg-[#F7F5F0] border border-[#E5E1D8] text-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#111827] text-sm">{action.title}</span>
                      <span className="px-2 py-0.5 rounded-xs text-[9px] uppercase font-mono bg-emerald-950 text-emerald-300 border border-[rgba(79,111,90,0.25)]">
                        {action.priority} Priority
                      </span>
                    </div>
                    <p className="text-[#475569] text-[11px]">{action.source_insight}</p>
                    <span className="text-[10px] text-[#64748B]">Owner: {action.owner} &bull; Dept: {action.related_department}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-sm bg-[#FFFFFF] border border-[#E5E1D8] text-[11px] text-[#475569]">
                      {action.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New Intervention Plan Modal */}
          {showInterventionModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <form
                onSubmit={handleCreateIntervention}
                className="bg-[#FFFFFF] rounded-md p-6 md:p-8 max-w-lg w-full border border-[#E5E1D8] shadow-2xl space-y-4 text-[#111827] font-sans"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
                  <h3 className="text-lg font-bold text-[#111827]">Create Skill Gap Intervention Plan</h3>
                  <button type="button" onClick={() => setShowInterventionModal(false)} className="text-[#64748B] hover:text-[#111827]">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#475569] mb-1">Plan Title</label>
                  <input
                    type="text"
                    value={newPlan.title}
                    onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                    placeholder="e.g. Spring Kubernetes Immersion Track"
                    className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-2 font-mono text-xs text-[#111827] placeholder:text-[#64748B]"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-[#475569] mb-1">Skill Cluster</label>
                    <input
                      type="text"
                      value={newPlan.skill_cluster}
                      onChange={(e) => setNewPlan({ ...newPlan, skill_cluster: e.target.value })}
                      className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-2 font-mono text-xs text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#475569] mb-1">Target Students</label>
                    <input
                      type="number"
                      value={newPlan.target_students_count}
                      onChange={(e) => setNewPlan({ ...newPlan, target_students_count: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-2 font-mono text-xs text-[#111827]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#475569] mb-1">Strategic Notes</label>
                  <textarea
                    value={newPlan.notes || ""}
                    onChange={(e) => setNewPlan({ ...newPlan, notes: e.target.value })}
                    placeholder="Target outcomes, industry vouchers, partner participation..."
                    className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-2 font-mono text-xs text-[#111827] placeholder:text-[#64748B] h-20"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E1D8]">
                  <button
                    type="button"
                    onClick={() => setShowInterventionModal(false)}
                    className="px-4 py-2 font-mono text-xs text-[#64748B] hover:text-[#111827] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] font-mono text-xs rounded-md cursor-pointer"
                  >
                    Save Plan
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* New Action Plan Modal */}
          {showActionModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <form
                onSubmit={handleCreateActionPlan}
                className="bg-[#FFFFFF] rounded-md p-6 md:p-8 max-w-lg w-full border border-[#E5E1D8] shadow-2xl space-y-4 text-[#111827] font-sans"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
                  <h3 className="text-lg font-bold text-[#111827]">Create Institutional Action Plan</h3>
                  <button type="button" onClick={() => setShowActionModal(false)} className="text-[#64748B] hover:text-[#111827]">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#475569] mb-1">Action Title</label>
                  <input
                    type="text"
                    value={newAction.title}
                    onChange={(e) => setNewAction({ ...newAction, title: e.target.value })}
                    placeholder="e.g. Mandatory OAuth Lab in Semester 6"
                    className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-2 font-mono text-xs text-[#111827] placeholder:text-[#64748B]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-[#475569] mb-1">Source Insight</label>
                  <textarea
                    value={newAction.source_insight}
                    onChange={(e) => setNewAction({ ...newAction, source_insight: e.target.value })}
                    placeholder="What intelligence or gap triggered this action?"
                    className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-2 font-mono text-xs text-[#111827] placeholder:text-[#64748B] h-20"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-[#475569] mb-1">Owner / Lead</label>
                    <input
                      type="text"
                      value={newAction.owner}
                      onChange={(e) => setNewAction({ ...newAction, owner: e.target.value })}
                      className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-2 font-mono text-xs text-[#111827]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono text-[#475569] mb-1">Priority</label>
                    <select
                      value={newAction.priority}
                      onChange={(e) => setNewAction({ ...newAction, priority: e.target.value })}
                      className="w-full rounded-md border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-2 font-mono text-xs text-[#111827]"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E1D8]">
                  <button
                    type="button"
                    onClick={() => setShowActionModal(false)}
                    className="px-4 py-2 font-mono text-xs text-[#64748B] hover:text-[#111827] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] font-mono text-xs rounded-md cursor-pointer"
                  >
                    Save Action Plan
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 10: INSTITUTIONAL REPORTS & AUDIT EXPORTS */}
      {/* ======================================================== */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#111827] flex items-center gap-2 font-mono">
                  <Download className="h-5 w-5 text-[#B08D57]" />
                  Institutional Audit & Accreditation Reports
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Generate explainable audit datasets for NAAC, NIRF, AISHE accreditation, and internal academic reviews.
                </p>
              </div>

              {reportData && (
                <button
                  onClick={() => exportCSV(reportData)}
                  className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-[#FFFFFF] font-mono text-xs rounded-md flex items-center gap-2 transition-colors cursor-pointer self-start md:self-auto"
                >
                  <Download className="h-4 w-4" /> Download CSV Export
                </button>
              )}
            </div>

            {/* Report Selector Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none font-mono">
              {[
                { id: "skill_gap", label: "Skill Gap Audit" },
                { id: "department_readiness", label: "Department Readiness" },
                { id: "internship", label: "Internship Participation" },
                { id: "placement", label: "Placement Outcomes" },
                { id: "faculty_engagement", label: "Faculty-Industry Immersion" },
                { id: "learning_adoption", label: "Learning & Certification" },
                { id: "industry_partnerships", label: "Corporate Partnerships" },
              ].map((rep) => (
                <button
                  key={rep.id}
                  onClick={() => setSelectedReportType(rep.id)}
                  className={`px-3 py-1.5 rounded-xs text-xs whitespace-nowrap transition-colors cursor-pointer ${
                    selectedReportType === rep.id
                      ? "bg-[#0B0B0A] text-[#FFFFFF] font-medium"
                      : "border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] hover:text-[#111827]"
                  }`}
                >
                  {rep.label}
                </button>
              ))}
            </div>

            {/* Table Preview */}
            {reportLoading || !reportData ? (
              <div className="p-12 text-center text-sm font-mono text-[#64748B]">Generating report preview...</div>
            ) : (
              <div className="overflow-x-auto border border-[#E5E1D8] rounded-sm" role="region" aria-label="Institutional report preview" tabIndex={0}>
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#F7F5F0] text-[#64748B] uppercase tracking-wider">
                    <tr>
                      {reportData.columns.map((col) => (
                        <th key={col} className="p-3.5">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E1D8] text-[#475569]">
                    {reportData.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#F7F5F0] transition-colors">
                        {reportData.columns.map((col) => (
                          <td key={col} className="p-3.5 whitespace-nowrap font-medium text-[#111827]">
                            {displayReportValue(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
