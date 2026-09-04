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
  Play,
  Eye,
  UserCheck,
  Video,
  Award,
  Star,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Briefcase,
  UserPlus,
  CalendarClock,
  FileText,
  Check,
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
  FacultyJobApplication,
  FacultyVideo,
  IndustryPartnerDetail,
  IndustryPartnershipOverview,
  InstitutionActionPlan,
  InstitutionAlertItem,
  InstitutionAnalyticsOverview,
  InstitutionFacultyJob,
  InstitutionFacultyVideosResponse,
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
  DUMMY_FACULTY_VIDEOS,
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

function getEmbedVideoUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  }
  return null;
}

const DUMMY_FACULTY_JOBS: InstitutionFacultyJob[] = [
  {
    id: "fjob-001",
    institution_id: "inst-001",
    institution_name: "Indian Institute of Science & Technology",
    title: "Professor & Chair of Artificial Intelligence",
    department: "Computer Science & Engineering",
    designation: "Full Professor",
    employment_type: "Full-time Tenure Track",
    min_experience_years: 8,
    qualification_required: "Ph.D. in Computer Science, AI or Machine Learning",
    skills_required: ["Foundation Models", "PyTorch", "High Performance Computing", "Grant Writing"],
    research_areas: ["Deep Learning", "Natural Language Processing", "Neuro-symbolic AI"],
    salary_range_lpa: "26 - 36 LPA",
    location: "Bangalore Main Campus",
    openings_count: 2,
    deadline: "2026-11-30T18:30:00Z",
    description: "Lead cutting-edge research in deep neural architectures, supervise doctoral scholars, and guide curriculum modernization.",
    responsibilities: ["Direct the Advanced AI Lab", "Deliver M.Tech & Ph.D. core electives", "Secure national R&D grants"],
    benefits: ["Research Seed Grant ₹15 Lakhs", "Subsidized Campus Villa", "Annual International Conference Sponsorship"],
    status: "open",
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    applications_count: 2,
  },
  {
    id: "fjob-002",
    institution_id: "inst-001",
    institution_name: "Indian Institute of Science & Technology",
    title: "Associate Professor in Cloud & Distributed Systems",
    department: "Information Technology",
    designation: "Associate Professor",
    employment_type: "Full-time",
    min_experience_years: 5,
    qualification_required: "Ph.D. in Computer Science / IT or equivalent",
    skills_required: ["Kubernetes", "Distributed Consensus", "Go", "Cloud Architecture"],
    research_areas: ["Serverless Architectures", "Edge Computing", "Distributed Ledger Systems"],
    salary_range_lpa: "18 - 25 LPA",
    location: "Bangalore Main Campus",
    openings_count: 3,
    deadline: "2026-12-15T18:30:00Z",
    description: "Teach distributed systems, establish cloud testbeds, and collaborate with industry hyperscaler partners.",
    responsibilities: ["Teach Cloud & Distributed Computing", "Facilitate industry-funded capstones", "Publish in Tier-1 conferences"],
    benefits: ["Faculty Development Grant", "Health & Medical Coverage for Family", "Performance Incentives"],
    status: "open",
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    applications_count: 1,
  },
  {
    id: "fjob-003",
    institution_id: "inst-001",
    institution_name: "Indian Institute of Science & Technology",
    title: "Assistant Professor in Cybersecurity & Cryptography",
    department: "Electronics & Communication",
    designation: "Assistant Professor",
    employment_type: "Full-time",
    min_experience_years: 2,
    qualification_required: "Ph.D. or Master's with exceptional research record",
    skills_required: ["Post-Quantum Cryptography", "Network Security", "Zero Trust Architectures"],
    research_areas: ["Cyber-Physical Security", "Homomorphic Encryption"],
    salary_range_lpa: "14 - 19 LPA",
    location: "Bangalore Main Campus",
    openings_count: 1,
    deadline: "2026-10-31T18:30:00Z",
    description: "Develop hands-on cybersecurity laboratories, lead cyber defense competitions, and instruct network security.",
    responsibilities: ["Mentor undergraduate engineering students", "Establish Cyber Range Lab", "Publish high-impact papers"],
    benefits: ["Relocation Allowance", "Laptop & Hardware Grant", "Sabbatical Policy"],
    status: "open",
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    applications_count: 1,
  },
];

const DUMMY_FACULTY_APPLICATIONS: FacultyJobApplication[] = [
  {
    id: "fapp-001",
    job_id: "fjob-001",
    faculty_id: "fac-001",
    status: "interview_scheduled",
    statement_of_purpose: "I am passionate about building robust foundation models and advancing transformer efficiency in academic settings.",
    research_statement: "Published 14 papers in NeurIPS/ICLR on attention mechanisms and gradient optimization.",
    teaching_philosophy: "Active student-centric problem based learning through collaborative code laboratories.",
    current_institution: "National University of Tech",
    current_designation: "Associate Professor",
    years_of_experience: 9,
    notice_period_days: 45,
    cv_url: "https://example.com/cv-dr-sharma.pdf",
    applied_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    faculty_name: "Dr. Ananya Sharma",
    faculty_email: "dr.ananya@nit.demo",
    faculty_department: "Computer Science Engineering",
    faculty_designation: "Associate Professor",
    faculty_research_areas: ["Deep Learning", "Computer Vision", "NLP"],
    job_title: "Professor & Chair of Artificial Intelligence",
    institution_name: "Indian Institute of Science & Technology",
    department: "Computer Science & Engineering",
    designation: "Full Professor",
    interview_details: {
      scheduled_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      mode: "online",
      meeting_link: "https://meet.google.com/xyz-recruitment-panel",
      venue: "Virtual Boardroom",
      panel_members: ["Dean of Academics", "Prof. K. Raman (External AI Expert)", "HOD Computing"],
      instructions: "Please prepare a 20-minute presentation on your 3-year research plan followed by technical Q&A.",
      status: "scheduled",
    },
  },
  {
    id: "fapp-002",
    job_id: "fjob-001",
    faculty_id: "fac-002",
    status: "offered",
    statement_of_purpose: "With 12 years in systems and AI infrastructure, I wish to elevate the department's high performance computing center.",
    research_statement: "Focusing on distributed memory pipelines and heterogeneous GPU cluster schedulers.",
    teaching_philosophy: "Hands-on engineering rigor paired with theoretical fundamentals.",
    current_institution: "IIT Research Foundation",
    current_designation: "Senior Scientist",
    years_of_experience: 12,
    notice_period_days: 30,
    cv_url: "https://example.com/cv-dr-vikram.pdf",
    applied_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    faculty_name: "Dr. Vikram Rao",
    faculty_email: "dr.vikram@nit.demo",
    faculty_department: "Computer Science Engineering",
    faculty_designation: "Professor & Dean of Computing",
    faculty_research_areas: ["Distributed Systems", "Cloud Computing", "HPC"],
    job_title: "Professor & Chair of Artificial Intelligence",
    institution_name: "Indian Institute of Science & Technology",
    department: "Computer Science & Engineering",
    designation: "Full Professor",
    interview_details: {
      scheduled_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      mode: "offline",
      venue: "Main Campus Senate Hall",
      panel_members: ["Vice Chancellor", "Dean of Faculty Affairs", "HOD Computer Science"],
      status: "completed",
      rating: 4.9,
      feedback: "Exceptional research vision, outstanding publication record, and clear strategy for laboratory expansion.",
      notes: "Unanimous committee recommendation for Professorship.",
      decision: "offered",
      decision_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      offer_details: {
        designation: "Full Professor & Chair of AI",
        base_salary_lpa: 32.0,
        joining_date: "2026-11-01",
      },
    },
  },
];

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

  // Faculty Video Contributions & Teacher Value States
  const [facultyVideosData, setFacultyVideosData] = useState<InstitutionFacultyVideosResponse | null>(null);
  const [expandedFaculty, setExpandedFaculty] = useState<Record<string, boolean>>({});
  const [selectedPreviewVideo, setSelectedPreviewVideo] = useState<FacultyVideo | null>(null);
  const [videoSearchQuery, setVideoSearchQuery] = useState<string>("");
  const [videoDeptFilter, setVideoDeptFilter] = useState<string>("All");
  const [facultySortBy, setFacultySortBy] = useState<"value" | "views" | "videos">("value");
  const [facultySubTab, setFacultySubTab] = useState<"recruitment" | "videos" | "immersion">("recruitment");

  // Faculty Recruitment & Job Openings States
  const [facultyJobs, setFacultyJobs] = useState<InstitutionFacultyJob[]>([]);
  const [facultyJobDeptFilter, setFacultyJobDeptFilter] = useState("All");
  const [facultyJobStatusFilter, setFacultyJobStatusFilter] = useState("all");
  const [facultyJobSearchQuery, setFacultyJobSearchQuery] = useState("");
  const [selectedJobForApps, setSelectedJobForApps] = useState<InstitutionFacultyJob | null>(null);
  const [jobApplications, setJobApplications] = useState<FacultyJobApplication[]>([]);
  const [jobApplicationsLoading, setJobApplicationsLoading] = useState(false);
  const [showPostJobModal, setShowPostJobModal] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [targetAppForInterview, setTargetAppForInterview] = useState<FacultyJobApplication | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [targetAppForDecision, setTargetAppForDecision] = useState<FacultyJobApplication | null>(null);
  const [candidateDetailApp, setCandidateDetailApp] = useState<FacultyJobApplication | null>(null);

  // New Job Form State
  const [newFacultyJob, setNewFacultyJob] = useState({
    title: "",
    department: "Computer Science & Engineering",
    designation: "Assistant Professor",
    employment_type: "Full-time",
    min_experience_years: 3,
    qualification_required: "Ph.D. or Master's in relevant engineering/science field",
    skills_required: "Python, Distributed Systems, Machine Learning",
    research_areas: "Artificial Intelligence, Cloud Computing",
    salary_range_lpa: "15 - 22 LPA",
    location: "Main University Campus",
    openings_count: 2,
    deadline: "",
    description: "",
    responsibilities: "Conduct undergraduate & graduate lectures; Lead funded research projects; Guide student capstones",
    benefits: "Faculty Research Seed Grant; Health Insurance; Conference Travel Sponsorship",
  });

  // Schedule Interview Form State
  const [interviewForm, setInterviewForm] = useState({
    scheduled_at: "",
    mode: "online" as "online" | "offline",
    meeting_link: "https://meet.google.com/abc-faculty-interview",
    venue: "Campus Administration Block, Board Room 1",
    panel_members: "Dean of Academics, Head of Department, External Subject Specialist",
    instructions: "Please prepare a 20-minute presentation on your research vision followed by selection committee Q&A.",
  });

  // Decision Form State
  const [decisionForm, setDecisionForm] = useState({
    status: "offered" as "offered" | "shortlisted" | "rejected",
    rating: 4.5,
    feedback: "Demonstrated exemplary subject matter expertise, strong pedagogy, and impressive publication pedigree.",
    notes: "Recommended unanimously for faculty appointment.",
    offer_designation: "",
    offer_salary_lpa: "",
    offer_joining_date: "",
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
        facVideosRes,
        curRes,
        partRes,
        learnRes,
        riskRes,
        relRes,
        facJobsRes,
        facAppsRes,
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
        api.getInstitutionFacultyVideos(token),
        api.getCurriculumRecommendations(token),
        api.getIndustryPartnerships(token),
        api.getLearningEffectiveness(token),
        api.getAtRiskCohorts(token),
        api.getCollaborationRelationships(token),
        api.getInstitutionFacultyJobs(token),
        api.getAllInstitutionFacultyApplications(token),
      ]);

      if (overviewRes.status === "fulfilled" && overviewRes.value && overviewRes.value.total_students > 0) {
        setAnalytics(overviewRes.value);
      } else {
        setAnalytics(DUMMY_ANALYTICS_OVERVIEW);
      }

      if (alertsRes.status === "fulfilled" && alertsRes.value?.alerts?.length) {
        setAlerts(alertsRes.value.alerts);
      } else {
        setAlerts(DUMMY_ALERTS);
      }

      if (cohortsRes.status === "fulfilled" && cohortsRes.value?.cohorts?.length && cohortsRes.value.total_students_monitored > 0) {
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

      if (internRes.status === "fulfilled" && internRes.value && (internRes.value.eligible_students > 0 || internRes.value.active_internships > 0)) {
        setInternshipData(internRes.value);
      } else {
        setInternshipData(DUMMY_INTERNSHIP_MONITORING);
      }

      if (placeRes.status === "fulfilled" && placeRes.value && (placeRes.value.eligible_students > 0 || placeRes.value.placements_secured > 0)) {
        setPlacementData(placeRes.value);
      } else {
        setPlacementData(DUMMY_PLACEMENT_MONITORING);
      }

      if (facRes.status === "fulfilled" && facRes.value && facRes.value.total_participating_faculty > 0) {
        setFacultyData(facRes.value);
      } else {
        setFacultyData(DUMMY_FACULTY_ENGAGEMENT);
      }

      if (facVideosRes.status === "fulfilled" && facVideosRes.value && (facVideosRes.value.faculty_contributions?.length > 0 || facVideosRes.value.total_videos > 0)) {
        setFacultyVideosData(facVideosRes.value);
        if (facVideosRes.value.faculty_contributions?.[0]?.faculty_name) {
          setExpandedFaculty({ [facVideosRes.value.faculty_contributions[0].faculty_name]: true });
        }
      } else {
        setFacultyVideosData(DUMMY_FACULTY_VIDEOS);
        if (DUMMY_FACULTY_VIDEOS.faculty_contributions?.[0]?.faculty_name) {
          setExpandedFaculty({ [DUMMY_FACULTY_VIDEOS.faculty_contributions[0].faculty_name]: true });
        }
      }

      if (curRes.status === "fulfilled" && curRes.value?.length) {
        setCurriculumRecs(curRes.value);
      } else {
        setCurriculumRecs(DUMMY_CURRICULUM_RECS);
      }

      if (partRes.status === "fulfilled" && partRes.value && partRes.value.total_partners > 0) {
        setPartnershipData(partRes.value);
      } else {
        setPartnershipData(DUMMY_PARTNERSHIP_OVERVIEW);
      }

      if (learnRes.status === "fulfilled" && learnRes.value && learnRes.value.total_enrolled > 0) {
        setLearningData(learnRes.value);
      } else {
        setLearningData(DUMMY_LEARNING_DATA);
      }

      if (riskRes.status === "fulfilled" && riskRes.value && riskRes.value.total_at_risk_students > 0) {
        setAtRiskData(riskRes.value);
      } else {
        setAtRiskData(DUMMY_AT_RISK_SUMMARY);
      }

      if (relRes.status === "fulfilled" && relRes.value && relRes.value.total_collaborations > 0) {
        setRelationshipsData(relRes.value);
      } else {
        setRelationshipsData(DUMMY_COLLABORATIONS);
      }

      if (facJobsRes.status === "fulfilled" && facJobsRes.value && facJobsRes.value.items?.length > 0) {
        setFacultyJobs(facJobsRes.value.items);
      } else {
        setFacultyJobs(DUMMY_FACULTY_JOBS);
      }

      if (facAppsRes.status === "fulfilled" && facAppsRes.value && facAppsRes.value.items?.length > 0) {
        setJobApplications(facAppsRes.value.items);
      } else {
        setJobApplications(DUMMY_FACULTY_APPLICATIONS);
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
      setFacultyVideosData(DUMMY_FACULTY_VIDEOS);
      setCurriculumRecs(DUMMY_CURRICULUM_RECS);
      setPartnershipData(DUMMY_PARTNERSHIP_OVERVIEW);
      setLearningData(DUMMY_LEARNING_DATA);
      setAtRiskData(DUMMY_AT_RISK_SUMMARY);
      setRelationshipsData(DUMMY_COLLABORATIONS);
      setFacultyJobs(DUMMY_FACULTY_JOBS);
      setJobApplications(DUMMY_FACULTY_APPLICATIONS);
    } finally {
      setLoading(false);
    }
  }, [token]);

  async function handlePostFacultyJob(e: React.FormEvent) {
    e.preventDefault();
    if (!newFacultyJob.title.trim()) {
      toast.error("Please provide a job title");
      return;
    }
    try {
      const skills = newFacultyJob.skills_required.split(",").map((s) => s.trim()).filter(Boolean);
      const research = newFacultyJob.research_areas.split(",").map((s) => s.trim()).filter(Boolean);
      const resps = newFacultyJob.responsibilities.split(";").map((s) => s.trim()).filter(Boolean);
      const benefits = newFacultyJob.benefits.split(";").map((s) => s.trim()).filter(Boolean);

      const created = await api.createFacultyJob(
        {
          title: newFacultyJob.title,
          department: newFacultyJob.department,
          designation: newFacultyJob.designation,
          employment_type: newFacultyJob.employment_type,
          min_experience_years: Number(newFacultyJob.min_experience_years) || 0,
          qualification_required: newFacultyJob.qualification_required,
          skills_required: skills,
          research_areas: research,
          salary_range_lpa: newFacultyJob.salary_range_lpa,
          location: newFacultyJob.location,
          openings_count: Number(newFacultyJob.openings_count) || 1,
          deadline: newFacultyJob.deadline ? new Date(newFacultyJob.deadline).toISOString() : null,
          description: newFacultyJob.description,
          responsibilities: resps,
          benefits: benefits,
          status: "open",
        },
        token
      );
      setFacultyJobs((prev) => [created, ...prev]);
      setShowPostJobModal(false);
      setNewFacultyJob({
        title: "",
        department: "Computer Science & Engineering",
        designation: "Assistant Professor",
        employment_type: "Full-time",
        min_experience_years: 3,
        qualification_required: "Ph.D. or Master's in relevant engineering/science field",
        skills_required: "Python, Distributed Systems, Machine Learning",
        research_areas: "Artificial Intelligence, Cloud Computing",
        salary_range_lpa: "15 - 22 LPA",
        location: "Main University Campus",
        openings_count: 2,
        deadline: "",
        description: "",
        responsibilities: "Conduct undergraduate & graduate lectures; Lead funded research projects; Guide student capstones",
        benefits: "Faculty Research Seed Grant; Health Insurance; Conference Travel Sponsorship",
      });
      toast.success("Faculty vacancy published successfully!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to publish faculty job"));
    }
  }

  async function handleToggleFacultyJobStatus(jobId: string, currentStatus: string) {
    const nextStatus = currentStatus === "open" ? "closed" : "open";
    try {
      const updated = await api.updateFacultyJob(jobId, { status: nextStatus }, token);
      setFacultyJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
      toast.success(`Position status changed to ${nextStatus.toUpperCase()}`);
    } catch {
      setFacultyJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: nextStatus } : j)));
      toast.success(`Position status changed to ${nextStatus.toUpperCase()}`);
    }
  }

  async function handleDeleteFacultyJob(jobId: string) {
    if (!window.confirm("Are you sure you want to remove this faculty job opening?")) return;
    try {
      await api.deleteFacultyJob(jobId, token);
    } catch {
      // ignore
    }
    setFacultyJobs((prev) => prev.filter((j) => j.id !== jobId));
    if (selectedJobForApps?.id === jobId) setSelectedJobForApps(null);
    toast.success("Faculty job posting removed");
  }

  async function handleSelectJobForApplicants(job: InstitutionFacultyJob | null) {
    setSelectedJobForApps(job);
    setJobApplicationsLoading(true);
    try {
      if (job) {
        const res = await api.getFacultyJobApplications(job.id, token);
        if (res?.items && res.items.length > 0) {
          setJobApplications(res.items);
        } else {
          setJobApplications(DUMMY_FACULTY_APPLICATIONS.filter((a) => a.job_id === job.id || job.id === "fjob-001"));
        }
      } else {
        const res = await api.getAllInstitutionFacultyApplications(token);
        if (res?.items && res.items.length > 0) {
          setJobApplications(res.items);
        } else {
          setJobApplications(DUMMY_FACULTY_APPLICATIONS);
        }
      }
    } catch {
      if (job) {
        setJobApplications(DUMMY_FACULTY_APPLICATIONS.filter((a) => a.job_id === job.id || job.id === "fjob-001"));
      } else {
        setJobApplications(DUMMY_FACULTY_APPLICATIONS);
      }
    } finally {
      setJobApplicationsLoading(false);
    }
  }

  async function handleScheduleInterviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetAppForInterview) return;
    if (!interviewForm.scheduled_at) {
      toast.error("Please select a date and time for the interview");
      return;
    }
    try {
      const panel = interviewForm.panel_members.split(",").map((p) => p.trim()).filter(Boolean);
      const updated = await api.scheduleFacultyInterview(
        targetAppForInterview.id,
        {
          scheduled_at: new Date(interviewForm.scheduled_at).toISOString(),
          mode: interviewForm.mode,
          meeting_link: interviewForm.mode === "online" ? interviewForm.meeting_link : null,
          venue: interviewForm.mode === "offline" ? interviewForm.venue : null,
          panel_members: panel,
          instructions: interviewForm.instructions,
        },
        token
      );
      setJobApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setShowInterviewModal(false);
      setTargetAppForInterview(null);
      toast.success("Faculty interview scheduled and invitation dispatched!");
    } catch {
      // Local fallback update for demo
      const updatedDetails = {
        scheduled_at: new Date(interviewForm.scheduled_at).toISOString(),
        mode: interviewForm.mode,
        meeting_link: interviewForm.mode === "online" ? interviewForm.meeting_link : null,
        venue: interviewForm.mode === "offline" ? interviewForm.venue : null,
        panel_members: interviewForm.panel_members.split(",").map((p) => p.trim()),
        instructions: interviewForm.instructions,
        status: "scheduled",
      };
      setJobApplications((prev) =>
        prev.map((a) =>
          a.id === targetAppForInterview.id
            ? { ...a, status: "interview_scheduled", interview_details: updatedDetails }
            : a
        )
      );
      setShowInterviewModal(false);
      setTargetAppForInterview(null);
      toast.success("Faculty interview scheduled (saved locally)!");
    }
  }

  async function handleRecordDecisionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetAppForDecision) return;
    try {
      const offerDetails =
        decisionForm.status === "offered"
          ? {
              designation: decisionForm.offer_designation || targetAppForDecision.designation,
              base_salary_lpa: decisionForm.offer_salary_lpa || "Competitive",
              joining_date: decisionForm.offer_joining_date || "Immediate / Next Semester",
            }
          : null;

      const updated = await api.recordInterviewDecision(
        targetAppForDecision.id,
        {
          status: decisionForm.status,
          rating: Number(decisionForm.rating) || 4.0,
          feedback: decisionForm.feedback,
          notes: decisionForm.notes,
          offer_details: offerDetails,
        },
        token
      );
      setJobApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setShowDecisionModal(false);
      setTargetAppForDecision(null);
      toast.success(`Hiring decision recorded: ${decisionForm.status.toUpperCase()}!`);
    } catch {
      // Local fallback update for demo
      const updatedDetails = {
        ...targetAppForDecision.interview_details,
        status: "completed",
        rating: Number(decisionForm.rating) || 4.5,
        feedback: decisionForm.feedback,
        notes: decisionForm.notes,
        decision: decisionForm.status,
        decision_at: new Date().toISOString(),
        offer_details:
          decisionForm.status === "offered"
            ? {
                designation: decisionForm.offer_designation || targetAppForDecision.designation || undefined,
                base_salary_lpa: decisionForm.offer_salary_lpa || "Competitive",
                joining_date: decisionForm.offer_joining_date || "Immediate",
              }
            : undefined,
      };
      setJobApplications((prev) =>
        prev.map((a) =>
          a.id === targetAppForDecision.id
            ? { ...a, status: decisionForm.status, interview_details: updatedDetails }
            : a
        )
      );
      setShowDecisionModal(false);
      setTargetAppForDecision(null);
      toast.success(`Hiring decision recorded: ${decisionForm.status.toUpperCase()}!`);
    }
  }

  const loadDepartmentDetail = useCallback(async (deptName: string) => {
    try {
      setDeptLoading(true);
      const data = await api.getDepartmentDetail(deptName, token);
      if (data && data.total_students > 0 && data.top_verified_skills?.length > 0) {
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
      if (data?.cohorts?.length && data.total_students_monitored > 0) {
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
      if (data && data.rows?.length > 0) {
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
      {/* ======================================================== */}
      {/* TAB 7: FACULTY-INDUSTRY ENGAGEMENT & VIDEO MASTERCLASSES */}
      {/* ======================================================== */}
      {activeTab === "faculty" && (
        <div className="space-y-6">
          {/* Sub-navigation Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E5E1D8]">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFacultySubTab("recruitment")}
                className={`px-3.5 py-1.5 rounded-sm text-xs font-mono transition-colors flex items-center gap-2 cursor-pointer ${
                  facultySubTab === "recruitment"
                    ? "bg-[#111827] text-white dark:bg-[#B08D57] dark:text-[#111827] font-bold shadow-xs"
                    : "bg-[#F7F5F0] text-[#475569] hover:bg-[#E5E1D8]"
                }`}
              >
                <Briefcase className="h-4 w-4" />
                <span>Faculty Recruitment & Interview Portal ({facultyJobs.length})</span>
              </button>
              <button
                onClick={() => setFacultySubTab("videos")}
                className={`px-3.5 py-1.5 rounded-sm text-xs font-mono transition-colors flex items-center gap-2 cursor-pointer ${
                  facultySubTab === "videos"
                    ? "bg-[#111827] text-white dark:bg-[#B08D57] dark:text-[#111827] font-bold shadow-xs"
                    : "bg-[#F7F5F0] text-[#475569] hover:bg-[#E5E1D8]"
                }`}
              >
                <Video className="h-4 w-4" />
                <span>Faculty Video Masterclasses & Teacher Value Ranking</span>
              </button>
              <button
                onClick={() => setFacultySubTab("immersion")}
                className={`px-3.5 py-1.5 rounded-sm text-xs font-mono transition-colors flex items-center gap-2 cursor-pointer ${
                  facultySubTab === "immersion"
                    ? "bg-[#111827] text-white dark:bg-[#B08D57] dark:text-[#111827] font-bold shadow-xs"
                    : "bg-[#F7F5F0] text-[#475569] hover:bg-[#E5E1D8]"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                <span>Industry Immersion & Multi-Party Initiatives</span>
              </button>
            </div>
            <span className="text-[11px] text-[#64748B] font-mono">
              University: <strong className="text-[#111827]">{facultyVideosData?.institution_name || analytics?.institution_name}</strong>
            </span>
          </div>

          {/* VIEW: FACULTY RECRUITMENT & INTERVIEW PORTAL */}
          {facultySubTab === "recruitment" && (
            <div className="space-y-6 font-mono">
              {/* Overview Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-[#B08D57]" />
                    Faculty Vacancies
                  </span>
                  <p className="text-2xl text-[#111827] mt-1 font-bold">
                    {facultyJobs.length}
                  </p>
                  <span className="text-[11px] text-[#64748B] mt-0.5 block">Total Posted Positions</span>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5 text-[#2563EB]" />
                    Active Openings
                  </span>
                  <p className="text-2xl text-[#2563EB] mt-1 font-bold">
                    {facultyJobs.filter((j) => j.status === "open").length}
                  </p>
                  <span className="text-[11px] text-[#64748B] mt-0.5 block">Accepting Applications</span>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#4F6F5A]" />
                    Candidate Applications
                  </span>
                  <p className="text-2xl text-[#4F6F5A] mt-1 font-bold">
                    {jobApplications.length}
                  </p>
                  <span className="text-[11px] text-[#64748B] mt-0.5 block">Faculty Profiles Submitted</span>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 text-[#B08D57]" />
                    Interviews & Offers
                  </span>
                  <p className="text-2xl text-[#B08D57] mt-1 font-bold">
                    {jobApplications.filter((a) => a.status === "interview_scheduled" || a.status === "offered").length}
                  </p>
                  <span className="text-[11px] text-[#B08D57] font-semibold mt-0.5 block">
                    {jobApplications.filter((a) => a.status === "offered").length} Formal Offers
                  </span>
                </div>
              </div>

              {/* Explainer Box */}
              <div className="bg-[#FBF9F5] rounded-md p-4 border border-[#E5E1D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xs bg-[#B08D57]/10 text-[#B08D57] shrink-0 mt-0.5">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827]">
                      University Academic Recruitment, Selection Committee & Interview Suite
                    </h3>
                    <p className="text-xs text-[#475569] mt-0.5 leading-relaxed font-sans">
                      Publish academic vacancies (Chair, Professor, Associate, Assistant Professor). Review candidate faculty portfolios, verified credentials, and statements of purpose. Conduct structured interviews via Google Meet or campus panel and record deterministic hiring decisions.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPostJobModal(true)}
                  className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-white text-xs rounded-sm transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Post Faculty Vacancy</span>
                </button>
              </div>

              {/* Filter and Search Bar */}
              <div className="bg-[#FFFFFF] p-4 rounded-md border border-[#E5E1D8] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={facultyJobSearchQuery}
                    onChange={(e) => setFacultyJobSearchQuery(e.target.value)}
                    placeholder="Search vacancies by title, department, designation, or research keywords..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                  {facultyJobSearchQuery && (
                    <button
                      onClick={() => setFacultyJobSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-xs text-[#94A3B8] hover:text-[#111827]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Dept:</span>
                  </div>
                  <select
                    value={facultyJobDeptFilter}
                    onChange={(e) => setFacultyJobDeptFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  >
                    <option value="All">All Departments</option>
                    {Array.from(new Set(facultyJobs.map((j) => j.department).filter(Boolean))).map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 text-xs text-[#64748B] ml-2">
                    <span>Status:</span>
                  </div>
                  <select
                    value={facultyJobStatusFilter}
                    onChange={(e) => setFacultyJobStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  >
                    <option value="all">All Statuses</option>
                    <option value="open">Open Positions</option>
                    <option value="closed">Closed Positions</option>
                  </select>

                  {selectedJobForApps && (
                    <button
                      onClick={() => handleSelectJobForApplicants(null)}
                      className="px-2.5 py-1.5 text-xs rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#475569] hover:bg-[#E5E1D8] transition-colors ml-2 cursor-pointer"
                    >
                      Show All Applications
                    </button>
                  )}
                </div>
              </div>

              {/* Main Content Layout: Jobs Grid + Applicants List */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Posted Vacancies (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-[#B08D57]" />
                      University Job Postings ({facultyJobs.length})
                    </h4>
                    <span className="text-[11px] text-[#64748B]">Click card to filter applicants</span>
                  </div>

                  {(() => {
                    const filteredJobs = facultyJobs.filter((j) => {
                      const q = facultyJobSearchQuery.toLowerCase().trim();
                      const matchQuery =
                        !q ||
                        j.title.toLowerCase().includes(q) ||
                        j.department.toLowerCase().includes(q) ||
                        j.designation.toLowerCase().includes(q) ||
                        (j.skills_required || []).some((s) => s.toLowerCase().includes(q));
                      const matchDept = facultyJobDeptFilter === "All" || j.department.toLowerCase() === facultyJobDeptFilter.toLowerCase();
                      const matchStatus = facultyJobStatusFilter === "all" || j.status === facultyJobStatusFilter;
                      return matchQuery && matchDept && matchStatus;
                    });

                    if (filteredJobs.length === 0) {
                      return (
                        <div className="p-8 text-center bg-[#FFFFFF] border border-[#E5E1D8] rounded-md">
                          <Briefcase className="h-6 w-6 text-[#94A3B8] mx-auto mb-2 opacity-50" />
                          <p className="text-xs font-semibold text-[#111827]">No faculty job postings match filter</p>
                          <button
                            onClick={() => setShowPostJobModal(true)}
                            className="mt-3 px-3 py-1.5 bg-[#B08D57] text-white rounded-sm text-xs cursor-pointer"
                          >
                            + Post First Opening
                          </button>
                        </div>
                      );
                    }

                    return filteredJobs.map((job) => {
                      const isSelected = selectedJobForApps?.id === job.id;
                      const appCount = jobApplications.filter((a) => a.job_id === job.id).length;

                      return (
                        <div
                          key={job.id}
                          className={`p-4 rounded-md border bg-[#FFFFFF] transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                            isSelected
                              ? "border-[#B08D57] ring-1 ring-[#B08D57]/40 shadow-xs"
                              : "border-[#E5E1D8] hover:border-[#B08D57]/50"
                          }`}
                          onClick={() => handleSelectJobForApplicants(job)}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-xs text-[10px] font-semibold uppercase ${
                                  job.status === "open"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-100 text-slate-600 border border-slate-200"
                                }`}
                              >
                                {job.status === "open" ? "Open for Applications" : "Position Closed"}
                              </span>
                              <span className="text-[11px] text-[#64748B]">
                                {job.openings_count} {job.openings_count === 1 ? "Vacancy" : "Vacancies"}
                              </span>
                            </div>

                            <h5 className="text-sm font-bold text-[#111827] mt-1.5 hover:text-[#B08D57] transition-colors">
                              {job.title}
                            </h5>
                            <p className="text-xs text-[#475569] mt-0.5">
                              {job.designation} &bull; <span className="text-[#B08D57] font-semibold">{job.department}</span>
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B] mt-2 pt-2 border-t border-[#E5E1D8]">
                              <span>Exp: &ge;{job.min_experience_years} yrs</span>
                              <span>Salary: {job.salary_range_lpa}</span>
                              <span>Type: {job.employment_type}</span>
                            </div>

                            {/* Skills pill list */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(job.skills_required || []).slice(0, 3).map((s) => (
                                <span
                                  key={s}
                                  className="px-1.5 py-0.5 bg-[#F7F5F0] text-[#475569] text-[10px] rounded-xs border border-[#E5E1D8]"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[#E5E1D8] text-xs">
                            <span className="inline-flex items-center gap-1 font-bold text-[#2563EB]">
                              <UserCheck className="h-3.5 w-3.5" />
                              {appCount} {appCount === 1 ? "Applicant" : "Applicants"}
                            </span>

                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleToggleFacultyJobStatus(job.id, job.status)}
                                className="px-2 py-1 rounded-xs bg-[#F7F5F0] hover:bg-[#E5E1D8] text-[#475569] text-[11px] transition-colors"
                              >
                                {job.status === "open" ? "Close Job" : "Re-open"}
                              </button>
                              <button
                                onClick={() => handleDeleteFacultyJob(job.id)}
                                className="p-1 text-[#94A3B8] hover:text-red-600 transition-colors"
                                title="Delete Posting"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Right Column: Applicants Review & Interview Pipeline (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-[#2563EB]" />
                      Candidate Review & Interview Pipeline
                      {selectedJobForApps ? ` for "${selectedJobForApps.title}"` : " (All Vacancies)"}
                    </h4>
                    <span className="text-[11px] text-[#64748B]">
                      {(() => {
                        const targetList = selectedJobForApps
                          ? jobApplications.filter((a) => a.job_id === selectedJobForApps.id)
                          : jobApplications;
                        return `${targetList.length} Candidate(s)`;
                      })()}
                    </span>
                  </div>

                  {(() => {
                    const filteredApps = selectedJobForApps
                      ? jobApplications.filter((a) => a.job_id === selectedJobForApps.id)
                      : jobApplications;

                    if (jobApplicationsLoading) {
                      return (
                        <div className="p-12 text-center bg-[#FFFFFF] border border-[#E5E1D8] rounded-md">
                          <div className="inline-block animate-spin h-6 w-6 border-2 border-[#B08D57] border-t-transparent rounded-full mb-2" />
                          <p className="text-xs text-[#64748B]">Loading candidate applications...</p>
                        </div>
                      );
                    }

                    if (filteredApps.length === 0) {
                      return (
                        <div className="p-12 text-center bg-[#FFFFFF] border border-[#E5E1D8] rounded-md">
                          <FileText className="h-8 w-8 text-[#94A3B8] mx-auto mb-2 opacity-50" />
                          <p className="text-xs font-semibold text-[#111827]">No candidate applications yet</p>
                          <p className="text-[11px] text-[#64748B] mt-1 font-sans">
                            When faculty members browse and apply for this university vacancy, their credentials, Statements of Purpose, and research statements will appear here.
                          </p>
                        </div>
                      );
                    }

                    return filteredApps.map((app) => {
                      const interview = app.interview_details || {};
                      const isInterviewScheduled = app.status === "interview_scheduled" || !!interview.scheduled_at;
                      const isOffered = app.status === "offered";
                      const isRejected = app.status === "rejected";

                      return (
                        <div
                          key={app.id}
                          className="bg-[#FFFFFF] rounded-md border border-[#E5E1D8] p-5 space-y-4 hover:border-[#B08D57]/40 transition-colors shadow-2xs"
                        >
                          {/* Candidate Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E1D8]">
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="text-sm font-bold text-[#111827]">
                                  {app.faculty_name || "Academician Candidate"}
                                </h5>
                                <span
                                  className={`px-2 py-0.5 rounded-xs text-[10px] font-semibold uppercase ${
                                    isOffered
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : isInterviewScheduled
                                      ? "bg-purple-50 text-purple-700 border border-purple-200"
                                      : isRejected
                                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                                      : "bg-amber-50 text-amber-700 border border-amber-200"
                                  }`}
                                >
                                  {app.status.replace("_", " ")}
                                </span>
                              </div>
                              <p className="text-xs text-[#64748B] mt-0.5">
                                {app.current_designation || app.faculty_designation || "Assistant Professor"} &bull;{" "}
                                <span className="text-[#475569]">{app.current_institution || app.faculty_department || "Current University"}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => setCandidateDetailApp(app)}
                                className="px-2.5 py-1 rounded-xs bg-[#F7F5F0] hover:bg-[#E5E1D8] text-xs text-[#475569] transition-colors cursor-pointer"
                              >
                                View SOP & Bio
                              </button>
                              <button
                                onClick={() => {
                                  setTargetAppForInterview(app);
                                  setInterviewForm({
                                    scheduled_at: "",
                                    mode: "online",
                                    meeting_link: "https://meet.google.com/abc-faculty-interview",
                                    venue: "Campus Administration Block, Board Room 1",
                                    panel_members: "Dean of Academics, Head of Department, External Subject Specialist",
                                    instructions: "Please present a 15-minute research seminar followed by selection committee Q&A.",
                                  });
                                  setShowInterviewModal(true);
                                }}
                                className="px-2.5 py-1 rounded-xs bg-[#2563EB] hover:bg-blue-700 text-white text-xs transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <CalendarClock className="h-3 w-3" />
                                <span>{isInterviewScheduled ? "Reschedule" : "Schedule Interview"}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setTargetAppForDecision(app);
                                  setDecisionForm({
                                    status: isOffered ? "offered" : "shortlisted",
                                    rating: interview.rating || 4.5,
                                    feedback: interview.feedback || "",
                                    notes: interview.notes || "",
                                    offer_designation: app.designation || "",
                                    offer_salary_lpa: "Competitive",
                                    offer_joining_date: "",
                                  });
                                  setShowDecisionModal(true);
                                }}
                                className="px-2.5 py-1 rounded-xs bg-[#B08D57] hover:bg-amber-700 text-white text-xs transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" />
                                <span>Evaluate / Decide</span>
                              </button>
                            </div>
                          </div>

                          {/* Quick Stats & Position Info */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-[#FBF9F5] p-3 rounded-xs border border-[#E5E1D8]">
                            <div>
                              <span className="text-[10px] text-[#64748B] block uppercase">Position Applied:</span>
                              <span className="font-bold text-[#111827] truncate block">{app.job_title || "Faculty Opening"}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#64748B] block uppercase">Experience:</span>
                              <span className="font-bold text-[#111827]">{app.years_of_experience} years</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#64748B] block uppercase">Notice Period:</span>
                              <span className="font-bold text-[#111827]">{app.notice_period_days} days</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#64748B] block uppercase">CV / Portfolio:</span>
                              {app.cv_url ? (
                                <a
                                  href={app.cv_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#2563EB] hover:underline flex items-center gap-1 font-bold"
                                >
                                  <span>View CV</span> <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-[#64748B]">Attached in Portal</span>
                              )}
                            </div>
                          </div>

                          {/* Statement Preview */}
                          <div>
                            <span className="text-[10px] uppercase text-[#64748B] font-bold block mb-1">
                              Statement of Purpose Preview:
                            </span>
                            <p className="text-xs text-[#475569] line-clamp-2 italic font-sans">
                              &ldquo;{app.statement_of_purpose}&rdquo;
                            </p>
                          </div>

                          {/* Interview Scheduled Box (Prominent) */}
                          {isInterviewScheduled && interview.scheduled_at && (
                            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-sm space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
                                  <CalendarClock className="h-4 w-4 text-purple-700" />
                                  <span>Interview Scheduled: {new Date(interview.scheduled_at).toLocaleString()}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-xs bg-purple-100 text-purple-800 text-[10px] uppercase font-bold">
                                  {interview.mode || "Online"}
                                </span>
                              </div>

                              {interview.mode === "online" && interview.meeting_link && (
                                <div className="flex items-center justify-between gap-3 pt-1">
                                  <span className="text-xs text-purple-800 truncate font-mono">
                                    Video Link: {interview.meeting_link}
                                  </span>
                                  <a
                                    href={interview.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-xs text-xs font-bold transition-colors shrink-0 flex items-center gap-1"
                                  >
                                    <span>Launch Video Panel</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}

                              {interview.mode === "offline" && interview.venue && (
                                <p className="text-xs text-purple-800">
                                  <strong>Campus Venue:</strong> {interview.venue}
                                </p>
                              )}

                              {interview.panel_members && interview.panel_members.length > 0 && (
                                <p className="text-[11px] text-purple-700">
                                  <strong>Committee:</strong> {interview.panel_members.join(", ")}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Offer / Decision Box */}
                          {isOffered && (
                            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-sm space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  <span>Formal Faculty Offer Extended</span>
                                </div>
                                {interview.rating && (
                                  <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                                    {interview.rating} / 5.0
                                  </span>
                                )}
                              </div>
                              {interview.feedback && (
                                <p className="text-xs text-emerald-800 font-sans italic">
                                  &ldquo;{interview.feedback}&rdquo;
                                </p>
                              )}
                              {interview.offer_details && (
                                <div className="flex flex-wrap gap-4 text-[11px] text-emerald-900 font-mono pt-1">
                                  <span>Role: {interview.offer_details.designation || "Faculty Member"}</span>
                                  <span>CTC: {interview.offer_details.base_salary_lpa} LPA</span>
                                  <span>Joining: {interview.offer_details.joining_date}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* VIEW A: FACULTY VIDEOS & TEACHER VALUE RANKING */}
          {facultySubTab === "videos" && (
            <div className="space-y-6">
              {/* Overview Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5 text-[#B08D57]" />
                    Faculty Content Educators
                  </span>
                  <p className="text-2xl text-[#111827] mt-1 font-bold">
                    {facultyVideosData?.total_faculty_contributors ?? 0}
                  </p>
                  <span className="text-[11px] text-[#64748B] mt-0.5 block">Active Teachers Uploading</span>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5 text-[#2563EB]" />
                    Masterclasses Published
                  </span>
                  <p className="text-2xl text-[#2563EB] mt-1 font-bold">
                    {facultyVideosData?.total_videos ?? 0}
                  </p>
                  <span className="text-[11px] text-[#64748B] mt-0.5 block">Video Lectures in Library</span>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-[#4F6F5A]" />
                    Cumulative Student Views
                  </span>
                  <p className="text-2xl text-[#4F6F5A] mt-1 font-bold">
                    {(facultyVideosData?.total_video_views ?? 0).toLocaleString()}
                  </p>
                  <span className="text-[11px] text-[#64748B] mt-0.5 block">Total Student Engagement</span>
                </div>
                <div className="bg-[#FFFFFF] p-4 rounded-sm border border-[#E5E1D8]">
                  <span className="text-xs text-[#64748B] uppercase block flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-[#B08D57]" />
                    Top Value Educator
                  </span>
                  <p className="text-lg text-[#111827] mt-1 font-bold truncate" title={facultyVideosData?.top_faculty_contributor || "N/A"}>
                    {facultyVideosData?.top_faculty_contributor || "N/A"}
                  </p>
                  <span className="text-[11px] text-[#B08D57] font-semibold mt-0.5 block">⭐ #1 Value Ranking Leader</span>
                </div>
              </div>

              {/* Explainer / University Head Insight Box */}
              <div className="bg-[#FBF9F5] rounded-md p-4 border border-[#E5E1D8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xs bg-[#B08D57]/10 text-[#B08D57] shrink-0 mt-0.5">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#111827] font-mono">
                      Faculty Educational Value & Pedagogical Impact Ranking
                    </h3>
                    <p className="text-xs text-[#475569] mt-0.5 leading-relaxed">
                      University leadership can evaluate which professors contribute high-impact academic content. The <strong>Teacher Value Score</strong> deterministically combines student viewership volume (1 pt/view), lecture library count (50 pts/lecture), and verified technical curriculum breadth (15 pts/skill).
                    </p>
                  </div>
                </div>
              </div>

              {/* Controls: Search, Department Filter & Sorting */}
              <div className="bg-[#FFFFFF] p-4 rounded-md border border-[#E5E1D8] flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={videoSearchQuery}
                    onChange={(e) => setVideoSearchQuery(e.target.value)}
                    placeholder="Search by teacher name, department, subject, or skill covered..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                  {videoSearchQuery && (
                    <button
                      onClick={() => setVideoSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-xs text-[#94A3B8] hover:text-[#111827]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-[#64748B]">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Dept:</span>
                  </div>
                  <select
                    value={videoDeptFilter}
                    onChange={(e) => setVideoDeptFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-mono rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  >
                    <option value="All">All Departments</option>
                    {Array.from(
                      new Set(
                        (facultyVideosData?.faculty_contributions || [])
                          .map((f) => f.department)
                          .filter(Boolean)
                      )
                    ).map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5 text-xs font-mono text-[#64748B] ml-2">
                    <span>Sort:</span>
                  </div>
                  <select
                    value={facultySortBy}
                    onChange={(e) => setFacultySortBy(e.target.value as "value" | "views" | "videos")}
                    className="px-2.5 py-1.5 text-xs font-mono rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  >
                    <option value="value">Highest Value Score ⭐</option>
                    <option value="views">Most Student Views 👁️</option>
                    <option value="videos">Most Video Lectures 📹</option>
                  </select>
                </div>
              </div>

              {/* Faculty Members Grouped by Name & Ranked by Value */}
              <div className="space-y-4">
                {(() => {
                  const list = (facultyVideosData?.faculty_contributions || [])
                    .filter((f) => {
                      const q = videoSearchQuery.toLowerCase().trim();
                      const matchesSearch =
                        !q ||
                        f.faculty_name.toLowerCase().includes(q) ||
                        f.department.toLowerCase().includes(q) ||
                        f.skills_taught.some((s) => s.toLowerCase().includes(q)) ||
                        f.videos.some((v) => v.title.toLowerCase().includes(q) || v.subject.toLowerCase().includes(q));

                      const matchesDept =
                        videoDeptFilter === "All" ||
                        f.department.toLowerCase() === videoDeptFilter.toLowerCase();

                      return matchesSearch && matchesDept;
                    })
                    .sort((a, b) => {
                      if (facultySortBy === "views") return b.total_views - a.total_views;
                      if (facultySortBy === "videos") return b.total_videos - a.total_videos;
                      return b.value_score - a.value_score;
                    });

                  if (list.length === 0) {
                    return (
                      <div className="p-12 text-center bg-[#FFFFFF] border border-[#E5E1D8] rounded-md font-mono">
                        <Video className="h-8 w-8 text-[#94A3B8] mx-auto mb-2 opacity-60" />
                        <p className="text-sm font-semibold text-[#111827]">No faculty video contributions found</p>
                        <p className="text-xs text-[#64748B] mt-1">Try adjusting your keyword search or department filter.</p>
                      </div>
                    );
                  }

                  return list.map((teacher, idx) => {
                    const isExpanded = expandedFaculty[teacher.faculty_name] ?? false;
                    const isTop1 = teacher.value_rank === 1 || idx === 0;

                    return (
                      <div
                        key={teacher.faculty_name}
                        className={`bg-[#FFFFFF] rounded-md border transition-all ${
                          isTop1
                            ? "border-[#B08D57]/60 shadow-xs"
                            : "border-[#E5E1D8]"
                        }`}
                      >
                        {/* Teacher Header Bar */}
                        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-3.5">
                            {/* Rank Indicator */}
                            <div
                              className={`h-11 w-11 rounded-sm flex flex-col items-center justify-center font-mono font-bold shrink-0 ${
                                isTop1
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-[#B08D57] border border-[#B08D57]/40"
                                  : teacher.value_rank === 2
                                  ? "bg-slate-200 dark:bg-slate-800 text-[#475569] border border-slate-300"
                                  : "bg-[#F7F5F0] text-[#64748B] border border-[#E5E1D8]"
                              }`}
                            >
                              <span className="text-[10px] uppercase tracking-tighter">RANK</span>
                              <span className="text-base leading-none">#{teacher.value_rank || idx + 1}</span>
                            </div>

                            {/* Teacher Info */}
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-base font-bold text-[#111827]">
                                  {teacher.faculty_name}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 rounded-xs text-[10px] font-mono uppercase font-semibold ${
                                    isTop1
                                      ? "bg-amber-50 text-[#B08D57] border border-[#B08D57]/30"
                                      : "bg-[#F7F5F0] text-[#475569] border border-[#E5E1D8]"
                                  }`}
                                >
                                  {teacher.value_tier}
                                </span>
                              </div>
                              <p className="text-xs text-[#64748B] mt-0.5">
                                <span className="font-medium text-[#475569]">{teacher.faculty_designation}</span>
                                {teacher.department && ` • ${teacher.department}`}
                              </p>
                              <p className="text-[11px] text-[#94A3B8] mt-0.5 font-mono">
                                Affiliation: {teacher.faculty_institution}
                              </p>
                            </div>
                          </div>

                          {/* Value Score & Expand Toggle */}
                          <div className="flex flex-wrap items-center gap-4">
                            {/* Value Score Badge */}
                            <div className="bg-[#F7F5F0] px-3.5 py-2 rounded-sm border border-[#E5E1D8] text-right">
                              <span className="text-[10px] font-mono uppercase text-[#64748B] block">
                                Educational Value Score
                              </span>
                              <div className="flex items-center justify-end gap-1 text-[#111827] font-mono font-bold text-lg">
                                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                                <span>{teacher.value_score.toLocaleString()} pts</span>
                              </div>
                            </div>

                            {/* Quick Metrics */}
                            <div className="hidden sm:flex items-center gap-4 font-mono text-xs text-[#475569]">
                              <div>
                                <span className="text-[10px] text-[#64748B] block uppercase">Lectures</span>
                                <span className="font-bold text-[#111827]">{teacher.total_videos}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#64748B] block uppercase">Views</span>
                                <span className="font-bold text-[#4F6F5A]">{teacher.total_views}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#64748B] block uppercase">Avg / Vid</span>
                                <span className="font-bold text-[#111827]">{teacher.avg_views_per_video}</span>
                              </div>
                            </div>

                            {/* Toggle Accordion */}
                            <button
                              onClick={() =>
                                setExpandedFaculty((prev) => ({
                                  ...prev,
                                  [teacher.faculty_name]: !isExpanded,
                                }))
                              }
                              className="px-3.5 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] hover:bg-white text-xs font-mono text-[#111827] transition-colors flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
                            >
                              <span>{isExpanded ? "Hide Lectures" : `View Lectures (${teacher.total_videos})`}</span>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Skills Covered Strip */}
                        <div className="px-5 py-2.5 bg-[#FBF9F5] border-t border-[#E5E1D8] flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-[11px] font-mono font-semibold text-[#64748B] mr-1 uppercase">
                            Topics & Skills Taught:
                          </span>
                          {teacher.skills_taught.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 rounded-xs bg-white text-[#111827] border border-[#E5E1D8] text-[11px] font-mono"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>

                        {/* Videos Grid (Visible when Expanded) */}
                        {isExpanded && (
                          <div className="p-5 border-t border-[#E5E1D8] bg-[#FDFBF7]/50 space-y-4">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-[#475569] font-mono flex items-center gap-1.5">
                                <Video className="h-3.5 w-3.5 text-[#B08D57]" />
                                Video Masterclasses by {teacher.faculty_name} ({teacher.videos.length})
                              </h5>
                              <span className="text-[11px] text-[#64748B] font-mono">
                                Click any lecture to inspect student engagement & notes
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {teacher.videos.map((vid) => (
                                <div
                                  key={vid.id}
                                  className="bg-white rounded-sm border border-[#E5E1D8] hover:border-[#B08D57]/60 transition-all flex flex-col justify-between overflow-hidden shadow-2xs"
                                >
                                  <div>
                                    {/* Video Thumbnail / Header */}
                                    <div className="relative aspect-video bg-slate-900 flex items-center justify-center overflow-hidden group">
                                      {vid.thumbnail_url ? (
                                        <img
                                          src={vid.thumbnail_url}
                                          alt={vid.title}
                                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                      ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                                          <Video className="h-8 w-8 text-slate-500" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <button
                                          onClick={() => setSelectedPreviewVideo(vid)}
                                          className="p-3 rounded-full bg-[#B08D57] text-white hover:scale-110 transition-transform cursor-pointer shadow-md"
                                          title="Watch Lecture"
                                        >
                                          <Play className="h-4 w-4 fill-white" />
                                        </button>
                                      </div>
                                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-xs bg-black/80 text-white font-mono text-[10px]">
                                        {vid.duration_minutes} min
                                      </span>
                                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-xs bg-black/80 text-[#B08D57] font-mono text-[10px]">
                                        {vid.subject}
                                      </span>
                                    </div>

                                    {/* Video Title & Description */}
                                    <div className="p-3.5 space-y-2">
                                      <h6
                                        onClick={() => setSelectedPreviewVideo(vid)}
                                        className="text-xs font-bold text-[#111827] line-clamp-2 hover:text-[#B08D57] cursor-pointer transition-colors"
                                        title={vid.title}
                                      >
                                        {vid.title}
                                      </h6>
                                      <p className="text-[11px] text-[#64748B] line-clamp-2">
                                        {vid.description}
                                      </p>

                                      {/* Skills covered pills */}
                                      <div className="flex flex-wrap gap-1 pt-1">
                                        {(vid.skills_covered || []).slice(0, 3).map((s) => (
                                          <span
                                            key={s}
                                            className="px-1.5 py-0.2 rounded-xs bg-[#F7F5F0] text-[#475569] text-[10px] font-mono border border-[#E5E1D8]"
                                          >
                                            {s}
                                          </span>
                                        ))}
                                        {(vid.skills_covered || []).length > 3 && (
                                          <span className="text-[10px] text-[#94A3B8] font-mono">
                                            +{(vid.skills_covered || []).length - 3}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Card Footer: Views & Action */}
                                  <div className="p-3 bg-[#FBF9F5] border-t border-[#E5E1D8] flex items-center justify-between text-xs font-mono">
                                    <div className="flex items-center gap-1.5 text-[#4F6F5A] font-bold">
                                      <Eye className="h-3.5 w-3.5" />
                                      <span>{vid.views_count} views</span>
                                    </div>
                                    <button
                                      onClick={() => setSelectedPreviewVideo(vid)}
                                      className="text-[11px] text-[#B08D57] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>Inspect Lecture</span>
                                      <ChevronRight className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* VIEW B: INDUSTRY IMMERSION & MULTI-PARTY INITIATIVES */}
          {facultySubTab === "immersion" && facultyData && (
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

          {/* PREVIEW VIDEO MODAL FOR UNIVERSITY HEAD */}
          {selectedPreviewVideo && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
              <div className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-md max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-4 p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#E5E1D8]">
                  <div>
                    <span className="text-[10px] font-mono text-[#B08D57] uppercase tracking-wider block font-semibold">
                      Faculty Lecture Inspection • {selectedPreviewVideo.subject}
                    </span>
                    <h3 className="text-lg font-bold text-[#111827] mt-0.5">
                      {selectedPreviewVideo.title}
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Uploaded by <strong className="text-[#111827]">{selectedPreviewVideo.faculty_name}</strong> ({selectedPreviewVideo.faculty_designation})
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedPreviewVideo(null)}
                    className="p-1.5 rounded-sm hover:bg-[#F7F5F0] text-[#64748B] hover:text-[#111827] cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Video Player */}
                <div className="aspect-video w-full bg-black rounded-sm overflow-hidden flex items-center justify-center">
                  {getEmbedVideoUrl(selectedPreviewVideo.video_url) ? (
                    <iframe
                      src={getEmbedVideoUrl(selectedPreviewVideo.video_url)!}
                      title={selectedPreviewVideo.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : selectedPreviewVideo.video_url.endsWith(".mp4") || selectedPreviewVideo.video_url.startsWith("/uploads/") ? (
                    <video
                      src={selectedPreviewVideo.video_url}
                      controls
                      poster={selectedPreviewVideo.thumbnail_url || undefined}
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="text-center p-6 text-white space-y-3 font-mono">
                      <Video className="h-12 w-12 text-[#B08D57] mx-auto" />
                      <p className="text-sm font-semibold">{selectedPreviewVideo.title}</p>
                      <a
                        href={selectedPreviewVideo.video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[#B08D57] text-white text-xs hover:bg-[#997343] transition-colors"
                      >
                        <span>Open Lecture Link</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Details Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs p-3 bg-[#F7F5F0] rounded-sm border border-[#E5E1D8]">
                  <div>
                    <span className="text-[10px] text-[#64748B] uppercase block">Views</span>
                    <span className="font-bold text-[#4F6F5A]">{selectedPreviewVideo.views_count} views</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] uppercase block">Duration</span>
                    <span className="font-bold text-[#111827]">{selectedPreviewVideo.duration_minutes} mins</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] uppercase block">Department</span>
                    <span className="font-bold text-[#111827] truncate block">{selectedPreviewVideo.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] uppercase block">Institution</span>
                    <span className="font-bold text-[#111827] truncate block">{selectedPreviewVideo.faculty_institution}</span>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-xs font-bold text-[#111827] font-mono uppercase mb-1">
                    Lecture Description
                  </h4>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    {selectedPreviewVideo.description}
                  </p>
                </div>

                {/* Skills Covered */}
                <div>
                  <h4 className="text-xs font-bold text-[#111827] font-mono uppercase mb-1.5">
                    Competencies & Skills Covered
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPreviewVideo.skills_covered.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-xs bg-white text-[#111827] text-xs font-mono border border-[#E5E1D8]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Lecture Notes Markdown */}
                {selectedPreviewVideo.notes_markdown && (
                  <div>
                    <h4 className="text-xs font-bold text-[#111827] font-mono uppercase mb-1.5">
                      Pedagogical Notes & Code Snippets
                    </h4>
                    <div className="p-4 bg-[#F7F5F0] rounded-sm border border-[#E5E1D8] text-xs font-mono text-[#334155] whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                      {selectedPreviewVideo.notes_markdown}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setSelectedPreviewVideo(null)}
                    className="px-4 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] hover:bg-white text-xs font-mono text-[#111827] cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
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
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <form
                onSubmit={handleCreateIntervention}
                className="bg-[#FFFFFF] rounded-md p-6 md:p-8 max-w-lg w-full border border-[#E5E1D8] shadow-2xl space-y-4 text-[#111827] font-sans my-auto"
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
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <form
                onSubmit={handleCreateActionPlan}
                className="bg-[#FFFFFF] rounded-md p-6 md:p-8 max-w-lg w-full border border-[#E5E1D8] shadow-2xl space-y-4 text-[#111827] font-sans my-auto"
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

      {/* ======================================================== */}
      {/* MODALS: FACULTY RECRUITMENT & INTERVIEW LIFECYCLE */}
      {/* ======================================================== */}

      {/* 1. Post Faculty Vacancy Modal */}
      {showPostJobModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md p-6 max-w-3xl w-full border border-[#E5E1D8] shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <div>
                <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-[#B08D57]" />
                  Post New University Faculty Opening
                </h3>
                <p className="text-[11px] text-[#64748B] font-sans mt-0.5">
                  Publish vacancies to attract distinguished academic fellows and researchers across institutions.
                </p>
              </div>
              <button
                onClick={() => setShowPostJobModal(false)}
                className="p-1 rounded-sm text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePostFacultyJob} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Position Title *</label>
                  <input
                    type="text"
                    required
                    value={newFacultyJob.title}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, title: e.target.value })}
                    placeholder="e.g. Professor & Chair of Artificial Intelligence"
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Department *</label>
                  <select
                    value={newFacultyJob.department}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  >
                    <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                    <option value="Artificial Intelligence & Data Science">Artificial Intelligence & Data Science</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Electronics & Communication">Electronics & Communication</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                    <option value="Mechanical Engineering">Mechanical Engineering</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Designation *</label>
                  <select
                    value={newFacultyJob.designation}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, designation: e.target.value })}
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  >
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Full Professor">Full Professor</option>
                    <option value="Professor & Chair">Professor & Chair</option>
                    <option value="Distinguished Chair Professor">Distinguished Chair Professor</option>
                    <option value="Adjunct / Visiting Professor">Adjunct / Visiting Professor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Employment Type</label>
                  <select
                    value={newFacultyJob.employment_type}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, employment_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  >
                    <option value="Full-time Tenure Track">Full-time Tenure Track</option>
                    <option value="Full-time Regular">Full-time Regular</option>
                    <option value="Contractual / 3-Year Tenure">Contractual / 3-Year Tenure</option>
                    <option value="Visiting Faculty">Visiting Faculty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Salary Scale / CTC Range</label>
                  <input
                    type="text"
                    value={newFacultyJob.salary_range_lpa}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, salary_range_lpa: e.target.value })}
                    placeholder="e.g. 18 - 25 LPA"
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Min Experience (Years)</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={newFacultyJob.min_experience_years}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, min_experience_years: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Number of Openings</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newFacultyJob.openings_count}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, openings_count: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Campus Location</label>
                  <input
                    type="text"
                    value={newFacultyJob.location}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, location: e.target.value })}
                    placeholder="e.g. Main Campus, Technology Block"
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Application Deadline</label>
                  <input
                    type="date"
                    value={newFacultyJob.deadline}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, deadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Minimum Qualification Required</label>
                  <input
                    type="text"
                    value={newFacultyJob.qualification_required}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, qualification_required: e.target.value })}
                    placeholder="e.g. Ph.D. in Computer Science or Artificial Intelligence with peer-reviewed publications"
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Core Skills / Specializations (comma separated)</label>
                  <input
                    type="text"
                    value={newFacultyJob.skills_required}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, skills_required: e.target.value })}
                    placeholder="e.g. PyTorch, Distributed Systems, Cloud Architecture, Reinforcement Learning"
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Research Areas (comma separated)</label>
                  <input
                    type="text"
                    value={newFacultyJob.research_areas}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, research_areas: e.target.value })}
                    placeholder="e.g. Machine Learning, Natural Language Processing, Cyber-Physical Systems"
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Role Summary & Overview</label>
                  <textarea
                    rows={3}
                    value={newFacultyJob.description}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, description: e.target.value })}
                    placeholder="Outline the department vision, laboratory leadership opportunities, and academic focus..."
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57] font-sans text-xs"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Key Responsibilities (semicolon separated)</label>
                  <input
                    type="text"
                    value={newFacultyJob.responsibilities}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, responsibilities: e.target.value })}
                    placeholder="Teach core electives; Guide Ph.D. scholars; Secure external R&D grants"
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Perks, Grants & Allowances (semicolon separated)</label>
                  <input
                    type="text"
                    value={newFacultyJob.benefits}
                    onChange={(e) => setNewFacultyJob({ ...newFacultyJob, benefits: e.target.value })}
                    placeholder="Research Seed Grant ₹10L; Campus Housing; International Travel Grant"
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E1D8]">
                <button
                  type="button"
                  onClick={() => setShowPostJobModal(false)}
                  className="px-4 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] hover:bg-white text-xs text-[#475569] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0B0B0A] hover:bg-[#111827] text-white text-xs rounded-sm cursor-pointer shadow-xs"
                >
                  Publish Faculty Opening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Schedule Faculty Interview Modal */}
      {showInterviewModal && targetAppForInterview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md p-6 max-w-lg w-full border border-[#E5E1D8] shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <div>
                <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-[#2563EB]" />
                  Schedule Selection Interview
                </h3>
                <p className="text-[11px] text-[#64748B] font-sans mt-0.5">
                  Candidate: <strong>{targetAppForInterview.faculty_name}</strong> &bull; {targetAppForInterview.job_title}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowInterviewModal(false);
                  setTargetAppForInterview(null);
                }}
                className="p-1 rounded-sm text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleInterviewSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Interview Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={interviewForm.scheduled_at}
                  onChange={(e) => setInterviewForm({ ...interviewForm, scheduled_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Interview Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInterviewForm({ ...interviewForm, mode: "online" })}
                    className={`py-2 text-center rounded-xs border text-xs cursor-pointer ${
                      interviewForm.mode === "online"
                        ? "bg-[#111827] text-white border-[#111827] font-bold"
                        : "bg-[#F7F5F0] text-[#475569] border-[#E5E1D8]"
                    }`}
                  >
                    Online (Video Link)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterviewForm({ ...interviewForm, mode: "offline" })}
                    className={`py-2 text-center rounded-xs border text-xs cursor-pointer ${
                      interviewForm.mode === "offline"
                        ? "bg-[#111827] text-white border-[#111827] font-bold"
                        : "bg-[#F7F5F0] text-[#475569] border-[#E5E1D8]"
                    }`}
                  >
                    In-Person (Campus Venue)
                  </button>
                </div>
              </div>

              {interviewForm.mode === "online" ? (
                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Google Meet / Video Link *</label>
                  <input
                    type="url"
                    required
                    value={interviewForm.meeting_link}
                    onChange={(e) => setInterviewForm({ ...interviewForm, meeting_link: e.target.value })}
                    placeholder="https://meet.google.com/..."
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Campus Venue / Room *</label>
                  <input
                    type="text"
                    required
                    value={interviewForm.venue}
                    onChange={(e) => setInterviewForm({ ...interviewForm, venue: e.target.value })}
                    placeholder="Campus Administration Block, Senate Committee Hall"
                    className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Selection Committee / Panel Members</label>
                <input
                  type="text"
                  value={interviewForm.panel_members}
                  onChange={(e) => setInterviewForm({ ...interviewForm, panel_members: e.target.value })}
                  placeholder="Dean of Academics, HOD Computing, External Subject Specialist"
                  className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Instructions & Seminar Topic</label>
                <textarea
                  rows={3}
                  value={interviewForm.instructions}
                  onChange={(e) => setInterviewForm({ ...interviewForm, instructions: e.target.value })}
                  placeholder="Please prepare a 15-minute presentation on research vision followed by Q&A..."
                  className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57] font-sans text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E1D8]">
                <button
                  type="button"
                  onClick={() => {
                    setShowInterviewModal(false);
                    setTargetAppForInterview(null);
                  }}
                  className="px-4 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] hover:bg-white text-xs text-[#475569] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs rounded-sm cursor-pointer shadow-xs"
                >
                  Dispatch Interview Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Record Interview Decision & Evaluation Modal */}
      {showDecisionModal && targetAppForDecision && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md p-6 max-w-lg w-full border border-[#E5E1D8] shadow-2xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <div>
                <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                  <Check className="h-4 w-4 text-[#B08D57]" />
                  Record Committee Decision & Evaluation
                </h3>
                <p className="text-[11px] text-[#64748B] font-sans mt-0.5">
                  Candidate: <strong>{targetAppForDecision.faculty_name}</strong> &bull; {targetAppForDecision.job_title}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDecisionModal(false);
                  setTargetAppForDecision(null);
                }}
                className="p-1 rounded-sm text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordDecisionSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Committee Status Decision *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisionForm({ ...decisionForm, status: "offered" })}
                    className={`py-2 text-center rounded-xs border text-xs cursor-pointer font-bold ${
                      decisionForm.status === "offered"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-[#F7F5F0] text-emerald-800 border-[#E5E1D8]"
                    }`}
                  >
                    Formal Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionForm({ ...decisionForm, status: "shortlisted" })}
                    className={`py-2 text-center rounded-xs border text-xs cursor-pointer font-bold ${
                      decisionForm.status === "shortlisted"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-[#F7F5F0] text-blue-800 border-[#E5E1D8]"
                    }`}
                  >
                    Shortlisted
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisionForm({ ...decisionForm, status: "rejected" })}
                    className={`py-2 text-center rounded-xs border text-xs cursor-pointer font-bold ${
                      decisionForm.status === "rejected"
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-[#F7F5F0] text-rose-800 border-[#E5E1D8]"
                    }`}
                  >
                    Not Selected
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">
                  Interview Evaluation Score (1.0 to 5.0)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={decisionForm.rating}
                    onChange={(e) => setDecisionForm({ ...decisionForm, rating: parseFloat(e.target.value) })}
                    className="flex-1 accent-[#B08D57]"
                  />
                  <span className="font-bold text-sm text-[#B08D57] w-12 text-right">
                    ⭐ {decisionForm.rating.toFixed(1)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Committee Feedback for Candidate</label>
                <textarea
                  rows={2}
                  value={decisionForm.feedback}
                  onChange={(e) => setDecisionForm({ ...decisionForm, feedback: e.target.value })}
                  placeholder="Feedback on pedagogical delivery and research presentation..."
                  className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57] font-sans text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#475569] mb-1 uppercase font-bold">Confidential Committee Notes</label>
                <textarea
                  rows={2}
                  value={decisionForm.notes}
                  onChange={(e) => setDecisionForm({ ...decisionForm, notes: e.target.value })}
                  placeholder="Internal audit notes regarding salary band, lab space allocation, etc."
                  className="w-full px-3 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] focus:outline-none focus:border-[#B08D57] font-sans text-xs"
                />
              </div>

              {decisionForm.status === "offered" && (
                <div className="p-3 rounded-sm bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                  <span className="text-[10px] text-emerald-900 font-bold uppercase block">Formal Offer Terms</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-[#475569] mb-0.5">Offered Designation</label>
                      <input
                        type="text"
                        value={decisionForm.offer_designation}
                        onChange={(e) => setDecisionForm({ ...decisionForm, offer_designation: e.target.value })}
                        placeholder={targetAppForDecision.designation || "Full Professor"}
                        className="w-full px-2 py-1.5 rounded-xs border border-emerald-300 bg-white text-[#111827] text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#475569] mb-0.5">Offered CTC (LPA)</label>
                      <input
                        type="text"
                        value={decisionForm.offer_salary_lpa}
                        onChange={(e) => setDecisionForm({ ...decisionForm, offer_salary_lpa: e.target.value })}
                        placeholder="e.g. 24.5 LPA"
                        className="w-full px-2 py-1.5 rounded-xs border border-emerald-300 bg-white text-[#111827] text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E1D8]">
                <button
                  type="button"
                  onClick={() => {
                    setShowDecisionModal(false);
                    setTargetAppForDecision(null);
                  }}
                  className="px-4 py-2 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0] hover:bg-white text-xs text-[#475569] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#B08D57] hover:bg-amber-700 text-white text-xs rounded-sm cursor-pointer shadow-xs font-bold"
                >
                  Finalize Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Candidate Detail & Statement of Purpose Modal */}
      {candidateDetailApp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] rounded-md p-6 max-w-2xl w-full border border-[#E5E1D8] shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto font-mono text-xs text-[#111827]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E1D8]">
              <div>
                <h3 className="text-base font-bold text-[#111827]">
                  {candidateDetailApp.faculty_name}
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {candidateDetailApp.current_designation} &bull; {candidateDetailApp.current_institution}
                </p>
              </div>
              <button
                onClick={() => setCandidateDetailApp(null)}
                className="p-1 rounded-sm text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F7F5F0] p-3 rounded-sm border border-[#E5E1D8]">
              <div>
                <span className="text-[10px] text-[#64748B] block uppercase">Applied Role</span>
                <span className="font-bold">{candidateDetailApp.job_title}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block uppercase">Experience</span>
                <span className="font-bold">{candidateDetailApp.years_of_experience} yrs</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block uppercase">Notice Period</span>
                <span className="font-bold">{candidateDetailApp.notice_period_days} days</span>
              </div>
              <div>
                <span className="text-[10px] text-[#64748B] block uppercase">Email</span>
                <span className="font-bold truncate block">{candidateDetailApp.faculty_email || "N/A"}</span>
              </div>
            </div>

            <div className="space-y-3 font-sans">
              <div>
                <h4 className="text-xs font-bold uppercase text-[#111827] font-mono mb-1">
                  Statement of Purpose
                </h4>
                <p className="text-xs text-[#475569] leading-relaxed bg-[#FBF9F5] p-3 rounded-sm border border-[#E5E1D8] whitespace-pre-wrap">
                  {candidateDetailApp.statement_of_purpose}
                </p>
              </div>

              {candidateDetailApp.research_statement && (
                <div>
                  <h4 className="text-xs font-bold uppercase text-[#111827] font-mono mb-1">
                    Research Statement & 3-Year Vision
                  </h4>
                  <p className="text-xs text-[#475569] leading-relaxed bg-[#FBF9F5] p-3 rounded-sm border border-[#E5E1D8] whitespace-pre-wrap">
                    {candidateDetailApp.research_statement}
                  </p>
                </div>
              )}

              {candidateDetailApp.teaching_philosophy && (
                <div>
                  <h4 className="text-xs font-bold uppercase text-[#111827] font-mono mb-1">
                    Teaching & Pedagogical Philosophy
                  </h4>
                  <p className="text-xs text-[#475569] leading-relaxed bg-[#FBF9F5] p-3 rounded-sm border border-[#E5E1D8] whitespace-pre-wrap">
                    {candidateDetailApp.teaching_philosophy}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E5E1D8]">
              <button
                onClick={() => setCandidateDetailApp(null)}
                className="px-4 py-2 bg-[#F7F5F0] hover:bg-[#E5E1D8] border border-[#E5E1D8] text-[#475569] rounded-sm text-xs cursor-pointer font-mono"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
