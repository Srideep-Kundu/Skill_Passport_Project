import React, { useCallback, useEffect, useState } from "react";
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Plus,
  Cpu,
  DollarSign,
  Copy,
  BarChart3,
  ChevronRight,
  Layers,
  Check,
  Zap,
} from "lucide-react";
import { api } from "../../api/service";
import { errorMessage } from "../../api/client";
import type {
  TrainingRecommendation,
  TrainingProgram,
  TrainingProgramCreateInput,
  RecordOutcomesInput,
} from "../../api/types";
import { toast } from "sonner";

interface TrainingPlannerHubProps {
  token: string;
  onNavigateToFundingHub?: (partnerOrFunding?: string) => void;
}

const PLANNER_REFERENCE_TIME = Date.now();
const DEFAULT_START_DATE = new Date(PLANNER_REFERENCE_TIME + 41 * 86400000).toISOString().split("T")[0];
const DEFAULT_END_DATE = new Date(PLANNER_REFERENCE_TIME + 43 * 86400000).toISOString().split("T")[0];

export function TrainingPlannerHub({ token, onNavigateToFundingHub }: TrainingPlannerHubProps) {
  const [loading, setLoading] = useState(true);

  // Core Data
  const [recommendations, setRecommendations] = useState<TrainingRecommendation[]>([]);
  const [trainings, setTrainings] = useState<TrainingProgram[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<TrainingProgram | null>(null);

  // Active View Tab: 'recommendations' | 'wizard' | 'execution'
  const [viewMode, setViewMode] = useState<"recommendations" | "wizard" | "execution">("recommendations");

  // Multi-Step Wizard State (Steps 1 through 7)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [submittingWizard, setSubmittingWizard] = useState(false);

  const [wizardForm, setWizardForm] = useState<TrainingProgramCreateInput>({
    title: "Applied Machine Learning & MLOps Workshop",
    objective: "Address critical student skill gaps in production model deployment, Docker containerization, and REST API serving.",
    program_type: "Hands-on Workshop",
    target_department: "Computer Science & Engineering",
    target_cohort: "CSE placement cohort",
    target_year: "3rd & 4th Year",
    target_skill: "Machine Learning",
    expected_participants: 80,
    prerequisites: ["Python Core", "Basic Linear Algebra", "Git"],
    trainer_type: "External Expert",
    trainer_name: "Dr. Arvind Swaminathan (Google Cloud)",
    trainer_organization: "Google Cloud & IEEE",
    infrastructure_requirements: ["Computer Lab", "Projector & Audio", "High-speed Internet", "Cloud Credits"],
    lab_systems_required: 80,
    lab_systems_available: 60,
    budget_breakdown: {
      trainer_fee: 20000,
      venue_costs: 5000,
      certificates: 2000,
      refreshments: 10000,
      marketing_materials: 3000,
      equipment_rental: 5000,
    },
    confirmed_funding: 25000,
    start_date: DEFAULT_START_DATE,
    end_date: DEFAULT_END_DATE,
  });

  // Copied state for marketing copy snippets
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Outcome Recording Modal State
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [outcomeForm, setOutcomeForm] = useState<RecordOutcomesInput>({
    skill_name: "Machine Learning",
    pre_score: 41.0,
    post_score: 72.0,
    cohort_name: "CSE 3rd & 4th Year Cohort (80 students)",
    attendance_count: 156,
    feedback_rating: 4.6,
  });
  const [savingOutcomes, setSavingOutcomes] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [recRes, trRes] = await Promise.allSettled([
        api.getTrainingRecommendations(token),
        api.getFacultyTrainings(token),
      ]);

      if (recRes.status === "fulfilled") setRecommendations(recRes.value);
      if (trRes.status === "fulfilled") {
        setTrainings(trRes.value);
        setSelectedTraining((current) => current ?? trRes.value[0] ?? null);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load training planner data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function startWizardFromRecommendation(rec: TrainingRecommendation) {
    setWizardForm({
      title: rec.title,
      objective: rec.why_recommended,
      program_type: "Hands-on Workshop",
      target_department: "Computer Science & Engineering",
      target_year: rec.target_students,
      target_skill: rec.target_skill,
      expected_participants: rec.estimated_participants,
      prerequisites: ["Python Core", "Git Basics"],
      trainer_type: "Industry Professional",
      trainer_name: rec.recommended_trainer,
      trainer_organization: rec.recommended_trainer_org,
      infrastructure_requirements: rec.infrastructure_needed,
      lab_systems_required: rec.estimated_participants,
      lab_systems_available: 60,
      budget_breakdown: {
        trainer_fee: 20000,
        venue_costs: 5000,
        certificates: 2000,
        refreshments: 10000,
        marketing_materials: 3000,
        equipment_rental: 5000,
      },
      confirmed_funding: 20000,
      start_date: DEFAULT_START_DATE,
      end_date: DEFAULT_END_DATE,
    });
    setWizardStep(1);
    setViewMode("wizard");
  }

  async function handleCreateTraining() {
    try {
      setSubmittingWizard(true);
      const created = await api.createTrainingProgram(wizardForm, token);
      setTrainings((prev) => [created, ...prev]);
      setSelectedTraining(created);
      setViewMode("execution");
      toast.success("Workshop & Training Program successfully configured!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to create training program"));
    } finally {
      setSubmittingWizard(false);
    }
  }

  async function handleRecordOutcomesSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTraining) return;
    try {
      setSavingOutcomes(true);
      const updated = await api.recordTrainingOutcomes(selectedTraining.id, outcomeForm, token);
      setSelectedTraining(updated);
      setTrainings((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setShowOutcomeModal(false);
      toast.success("Attendance, feedback, and pre/post outcomes recorded without changing Skill Passport verification.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to record outcomes"));
    } finally {
      setSavingOutcomes(false);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2500);
  }

  // Calculate live wizard values
  const totalBudget = Object.values(wizardForm.budget_breakdown || {}).reduce((a, b) => a + Number(b || 0), 0);
  const fundingGap = Math.max(0, totalBudget - Number(wizardForm.confirmed_funding || 0));
  const capacityGap = Math.max(0, Number(wizardForm.lab_systems_required || 0) - Number(wizardForm.lab_systems_available || 0));

  // Notice Period calculation
  const eventDateMs = wizardForm.start_date ? new Date(wizardForm.start_date).getTime() : PLANNER_REFERENCE_TIME + 41 * 86400000;
  const prepDays = Math.max(0, Math.round((eventDateMs - PLANNER_REFERENCE_TIME) / (1000 * 60 * 60 * 24)));
  const noticeStatus = prepDays >= 21 ? "GOOD" : prepDays >= 10 ? "WARNING" : "CRITICAL";
  const selectedOutcome = selectedTraining?.outcomes[selectedTraining.outcomes.length - 1];

  if (loading) {
    return (
      <div className="p-12 text-center max-w-6xl mx-auto">
        <div className="inline-block animate-spin h-7 w-7 border-2 border-[#B08D57] border-t-transparent rounded-full mb-3" />
        <p className="text-xs font-mono text-[#64748B]">Loading Training & Workshop Planner...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Top Banner */}
      <div className="border border-[#E5E1D8] bg-[#FFFFFF] rounded-md p-6 md:p-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#B08D57] mb-1">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>Skill Intelligence & Execution Engine</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
              Training & Workshop Planner
            </h1>
            <p className="text-xs text-[#475569] mt-1 font-mono">
              The Closed Loop: <span className="text-[#B08D57]">Skill Gap Detected</span> → <span className="text-[#B08D57]">Training Suggested</span> → <span className="text-[#B08D57]">Workshop Conducted</span> → <span className="text-[#4F6F5A]">Outcomes Measured</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setWizardStep(1);
                setViewMode("wizard");
              }}
              className="px-4 py-2 border border-[#B08D57] bg-[#B08D57] hover:bg-[#9a7b4c] text-white font-mono text-xs font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Launch Workshop Wizard</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-[#E5E1D8]">
          {[
            { id: "recommendations", label: "Gap-Driven Recommendations", icon: Sparkles, count: recommendations.length },
            { id: "wizard", label: "Workshop Creation Wizard", icon: Layers, count: "7 Steps" },
            { id: "execution", label: "Execution & Closed-Loop Outcomes", icon: BarChart3, count: trainings.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as typeof viewMode)}
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

      {/* VIEW 1: RECOMMENDATIONS */}
      {viewMode === "recommendations" && (
        <div className="space-y-6">
          <div className="border border-[#B08D57]/30 bg-[#FAF7F2] rounded-md p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-[#B08D57] shrink-0 mt-0.5" />
            <div className="text-xs text-[#475569] space-y-1">
              <span className="font-mono text-[10px] font-bold uppercase text-[#B08D57] block">
                Evidence-Driven Pedagogy Recommendations
              </span>
              <p>
                Lumina Intel synthesizes real-time student evidence gaps, verified skill passports, and recruiter hiring criteria to recommend high-impact training workshops.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="bg-[#FFFFFF] rounded-md p-6 border border-[#E5E1D8] flex flex-col justify-between space-y-4 hover:border-[#B08D57]/50 transition-colors shadow-2xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-rose-700 bg-rose-50 px-2 py-0.5 rounded-xs border border-rose-200">
                        {rec.gap_percentage}% Skill Gap Identified
                      </span>
                      <h3 className="text-xl font-normal text-[#111827] mt-2" style={{ fontFamily: "var(--font-display)" }}>
                        {rec.title}
                      </h3>
                      <p className="text-xs font-mono text-[#475569] mt-0.5">Target: {rec.target_students}</p>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <span className="text-[#4F6F5A] font-bold block">Est. ₹{rec.estimated_cost.toLocaleString()}</span>
                      <span className="text-[#64748B] text-[10px]">{rec.suggested_duration_days} Days · {rec.estimated_participants} Students</span>
                    </div>
                  </div>

                  {/* Why Recommended Callout */}
                  <div className="p-3 bg-[#FAF7F2] border border-[#B08D57]/30 rounded-sm text-xs space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-bold">
                      Why Recommended:
                    </span>
                    <p className="text-stone-700 leading-relaxed italic">{rec.why_recommended}</p>
                  </div>

                  <div className="space-y-1 text-xs font-mono text-[#64748B]">
                    <p>
                      <strong>Recommended Trainer:</strong> {rec.recommended_trainer} ({rec.recommended_trainer_org})
                    </p>
                    <p>
                      <strong>Infrastructure Needed:</strong> {rec.infrastructure_needed.join(", ")}
                    </p>
                    <p>
                      <strong>Suggested Partners:</strong> {rec.suggested_collaborators.join(", ")}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5E1D8] flex items-center justify-between gap-2">
                  <button
                    onClick={() => onNavigateToFundingHub && onNavigateToFundingHub(rec.suggested_collaborators[0])}
                    className="px-3 py-1.5 border border-[#E5E1D8] hover:bg-[#F7F5F0] text-[#111827] text-xs font-mono rounded-md cursor-pointer"
                  >
                    Find Grants / Partners
                  </button>
                  <button
                    onClick={() => startWizardFromRecommendation(rec)}
                    className="px-4 py-1.5 bg-[#0B0B0A] hover:bg-[#262626] text-white text-xs font-mono rounded-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Plan Workshop</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: MULTI-STEP WORKSHOP CREATION WIZARD */}
      {viewMode === "wizard" && (
        <div className="bg-white rounded-md border border-[#E5E1D8] p-6 md:p-8 space-y-6">
          {/* Step Indicator Header */}
          <div className="border-b border-[#E5E1D8] pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <span className="text-[10px] font-mono text-[#B08D57] uppercase tracking-wider font-bold">
                Step {wizardStep} of 7:{" "}
                {wizardStep === 1
                  ? "Objective & Track"
                  : wizardStep === 2
                  ? "Target Audience & Cohort"
                  : wizardStep === 3
                  ? "Trainer & Expert Matching"
                  : wizardStep === 4
                  ? "Infrastructure & Capacity Diagnostic"
                  : wizardStep === 5
                  ? "Budget Planner & Funding Gap"
                  : wizardStep === 6
                  ? "Notice Period Intelligence"
                  : "Marketing & Publicity Kit"}
              </span>

              <span className="text-xs font-mono text-[#64748B]">Auto-validating against institutional benchmarks</span>
            </div>

            {/* Stepper Progress Bar */}
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                <button
                  key={s}
                  onClick={() => setWizardStep(s)}
                  className={`h-1.5 rounded-full transition-colors cursor-pointer ${
                    wizardStep >= s ? "bg-[#0B0B0A]" : "bg-[#E5E1D8]"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* STEP 1: OBJECTIVE */}
          {wizardStep === 1 && (
            <div className="space-y-4 font-mono text-xs">
              <h3 className="text-lg font-normal text-[#111827] font-sans" style={{ fontFamily: "var(--font-display)" }}>
                Step 1: Define Program Objective
              </h3>
              <div>
                <label className="block text-[#64748B] mb-2">Primary Objective Category *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {([
                    "Training Program",
                    "Hands-on Workshop",
                    "FDP",
                    "Industry Talk",
                    "Certification Program",
                    "Placement Preparation",
                  ] as const).map((obj) => (
                    <button
                      key={obj}
                      type="button"
                      onClick={() => setWizardForm({ ...wizardForm, program_type: obj })}
                      className={`p-3 text-left border rounded-md transition-colors cursor-pointer ${
                        wizardForm.program_type === obj
                          ? "bg-[#0B0B0A] text-white border-[#0B0B0A]"
                          : "border-[#E5E1D8] bg-[#F7F5F0] text-[#111827] hover:border-[#B08D57]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{obj}</span>
                        {wizardForm.program_type === obj && <Check className="h-4 w-4" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#64748B] mb-1">Workshop Title *</label>
                <input
                  type="text"
                  value={wizardForm.title}
                  onChange={(e) => setWizardForm({ ...wizardForm, title: e.target.value })}
                  className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white font-sans text-sm"
                />
              </div>

              <div>
                <label className="block text-[#64748B] mb-1">Detailed Objective & Syllabus Outline *</label>
                <textarea
                  rows={3}
                  value={wizardForm.objective}
                  onChange={(e) => setWizardForm({ ...wizardForm, objective: e.target.value })}
                  className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white"
                />
              </div>
            </div>
          )}

          {/* STEP 2: TARGET AUDIENCE */}
          {wizardStep === 2 && (
            <div className="space-y-4 font-mono text-xs">
              <h3 className="text-lg font-normal text-[#111827] font-sans" style={{ fontFamily: "var(--font-display)" }}>
                Step 2: Target Audience & Prerequisites
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[#64748B] mb-1">Target Department</label>
                  <input
                    type="text"
                    value={wizardForm.target_department || "Computer Science & Engineering"}
                    onChange={(e) => setWizardForm({ ...wizardForm, target_department: e.target.value })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Academic Year</label>
                  <input
                    type="text"
                    value={wizardForm.target_year || "3rd & 4th Year"}
                    onChange={(e) => setWizardForm({ ...wizardForm, target_year: e.target.value })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Expected Participants</label>
                  <input
                    type="number"
                    value={wizardForm.expected_participants || 80}
                    onChange={(e) => setWizardForm({ ...wizardForm, expected_participants: Number(e.target.value) })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#64748B] mb-1">Target cohort</label>
                  <input type="text" value={wizardForm.target_cohort || ""} onChange={(e) => setWizardForm({ ...wizardForm, target_cohort: e.target.value })} className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white" />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Target skills (comma-separated)</label>
                  <input type="text" value={wizardForm.target_skill || ""} onChange={(e) => setWizardForm({ ...wizardForm, target_skill: e.target.value })} className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white" />
                </div>
              </div>

              <div>
                <label className="block text-[#64748B] mb-1">Prerequisites (comma-separated)</label>
                <input
                  type="text"
                  value={(wizardForm.prerequisites || []).join(", ")}
                  onChange={(e) =>
                    setWizardForm({
                      ...wizardForm,
                      prerequisites: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white"
                  placeholder="e.g. Python Core, Docker Basics, Git"
                />
              </div>
            </div>
          )}

          {/* STEP 3: TRAINER SELECTION */}
          {wizardStep === 3 && (
            <div className="space-y-4 font-mono text-xs">
              <h3 className="text-lg font-normal text-[#111827] font-sans" style={{ fontFamily: "var(--font-display)" }}>
                Step 3: Trainer & Expert Sourcing
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {(["Internal Faculty", "External Expert", "Industry Professional", "Professional Society", "Freelance Trainer"] as const).map((tr) => (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => setWizardForm({ ...wizardForm, trainer_type: tr })}
                    className={`p-2.5 text-center border rounded-md transition-colors cursor-pointer ${
                      wizardForm.trainer_type === tr
                        ? "bg-[#0B0B0A] text-white border-[#0B0B0A]"
                        : "border-[#E5E1D8] bg-[#F7F5F0] text-[#111827]"
                    }`}
                  >
                    {tr}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[#64748B] mb-1">Trainer / Speaker Name *</label>
                  <input
                    type="text"
                    value={wizardForm.trainer_name || ""}
                    onChange={(e) => setWizardForm({ ...wizardForm, trainer_name: e.target.value })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Trainer Organization / Society</label>
                  <input
                    type="text"
                    value={wizardForm.trainer_organization || ""}
                    onChange={(e) => setWizardForm({ ...wizardForm, trainer_organization: e.target.value })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
              </div>

              {/* Lumina Expert Matching Suggestion */}
              <div className="p-3 bg-[#FAF7F2] border border-[#B08D57]/30 rounded-sm space-y-1">
                <span className="font-bold text-[#B08D57] flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Lumina Matched Expert:
                </span>
                <p className="text-[#475569]">
                  Dr. Arvind Swaminathan (Google Cloud & IEEE Senior Member) matches this curriculum with a 4.9 out of 5 rating across 32 workshops.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: INFRASTRUCTURE & CAPACITY DIAGNOSTIC */}
          {wizardStep === 4 && (
            <div className="space-y-4 font-mono text-xs">
              <h3 className="text-lg font-normal text-[#111827] font-sans" style={{ fontFamily: "var(--font-display)" }}>
                Step 4: Infrastructure & Capacity Gap Diagnostic
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["Auditorium", "Computer Lab", "GPU Lab", "Projector & Audio", "High-speed Internet", "Cloud Credits", "Robotics Kits"].map((item) => {
                  const isSelected = (wizardForm.infrastructure_requirements || []).includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        const current = wizardForm.infrastructure_requirements || [];
                        const next = isSelected ? current.filter((x) => x !== item) : [...current, item];
                        setWizardForm({ ...wizardForm, infrastructure_requirements: next });
                      }}
                      className={`p-2.5 border rounded-md text-left transition-colors cursor-pointer flex items-center justify-between ${
                        isSelected ? "bg-[#0B0B0A] text-white" : "bg-[#F7F5F0] border-[#E5E1D8] text-[#111827]"
                      }`}
                    >
                      <span>{item}</span>
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[#64748B] mb-1">Required Computer Systems</label>
                  <input
                    type="number"
                    value={wizardForm.lab_systems_required || 80}
                    onChange={(e) => setWizardForm({ ...wizardForm, lab_systems_required: Number(e.target.value) })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Available Local Lab Workstations</label>
                  <input
                    type="number"
                    value={wizardForm.lab_systems_available || 60}
                    onChange={(e) => setWizardForm({ ...wizardForm, lab_systems_available: Number(e.target.value) })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
              </div>

              {/* Diagnostic Box */}
              <div
                className={`p-4 rounded-sm border space-y-2 ${
                  capacityGap > 0
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="h-4 w-4" /> Capacity Diagnostic:
                  </span>
                  <span>{capacityGap > 0 ? `Capacity Gap: ${capacityGap} Workstations` : "Capacity Benchmark Satisfied"}</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {capacityGap > 0
                    ? `Required: ${wizardForm.lab_systems_required} systems · Available: ${wizardForm.lab_systems_available}. Recommended action: Run the workshop in two batches or provision AWS Cloud Sandboxes.`
                    : `Institutional laboratory capacity is sufficient to host all ${wizardForm.lab_systems_required} student participants in a single batch.`}
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: BUDGET PLANNER & FUNDING GAP */}
          {wizardStep === 5 && (
            <div className="space-y-4 font-mono text-xs">
              <h3 className="text-lg font-normal text-[#111827] font-sans" style={{ fontFamily: "var(--font-display)" }}>
                Step 5: Budget Planner & Funding Gap Diagnostic
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(wizardForm.budget_breakdown || {}).map(([key, val]) => (
                  <div key={key} className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm">
                    <label className="block text-[#64748B] uppercase text-[10px] mb-1">
                      {key.replace("_", " ")}
                    </label>
                    <div className="flex items-center gap-1">
                      <span>₹</span>
                      <input
                        type="number"
                        value={val}
                        onChange={(e) => {
                          const updated = { ...wizardForm.budget_breakdown, [key]: Number(e.target.value) };
                          setWizardForm({ ...wizardForm, budget_breakdown: updated });
                        }}
                        className="w-full p-1 bg-white border border-[#E5E1D8] rounded-xs font-bold text-[#111827]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-[#64748B] mb-1">Confirmed Department / Institutional Funding (₹)</label>
                  <input
                    type="number"
                    value={wizardForm.confirmed_funding || 0}
                    onChange={(e) => setWizardForm({ ...wizardForm, confirmed_funding: Number(e.target.value) })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white font-bold"
                  />
                </div>
                <div className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-md flex flex-col justify-center">
                  <span className="text-[#64748B] text-[10px] uppercase">Estimated Total Budget</span>
                  <span className="text-xl font-bold text-[#111827]">₹{totalBudget.toLocaleString()}</span>
                </div>
              </div>

              {/* Funding Gap Card with Find Funding CTA */}
              <div
                className={`p-4 rounded-sm border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  fundingGap > 0
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-emerald-50 border-emerald-200 text-emerald-900"
                }`}
              >
                <div>
                  <span className="font-bold block text-sm">
                    {fundingGap > 0 ? `Funding Gap: ₹${fundingGap.toLocaleString()}` : "Fully Funded"}
                  </span>
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    {fundingGap > 0
                      ? "Directly bridge this deficit via AICTE, IEEE, or industry grant sponsorship."
                      : "Department allocation fully covers the itemized budget."}
                  </p>
                </div>

                {fundingGap > 0 && onNavigateToFundingHub && (
                  <button
                    type="button"
                    onClick={() => onNavigateToFundingHub()}
                    className="px-4 py-2 bg-[#B08D57] hover:bg-[#9a7b4c] text-white rounded-md flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>Find Funding in Hub</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: NOTICE PERIOD INTELLIGENCE */}
          {wizardStep === 6 && (
            <div className="space-y-4 font-mono text-xs">
              <h3 className="text-lg font-normal text-[#111827] font-sans" style={{ fontFamily: "var(--font-display)" }}>
                Step 6: Notice Period & Timeline Buffer Intelligence
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#64748B] mb-1">Proposed Workshop Start Date</label>
                  <input
                    type="date"
                    value={wizardForm.start_date || ""}
                    onChange={(e) => setWizardForm({ ...wizardForm, start_date: e.target.value })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Proposed Workshop End Date</label>
                  <input
                    type="date"
                    value={wizardForm.end_date || ""}
                    onChange={(e) => setWizardForm({ ...wizardForm, end_date: e.target.value })}
                    className="w-full p-2.5 border border-[#E5E1D8] rounded-md bg-white font-sans"
                  />
                </div>
              </div>

              {/* Notice Buffer Analysis */}
              <div className="p-4 bg-[#F7F5F0] border border-[#E5E1D8] rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B]">Preparation Time Buffer:</span>
                  <span className="text-base font-bold text-[#111827]">{prepDays} Days Remaining</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-[10px]">
                  <div className="p-2 bg-white rounded-xs border border-[#E5E1D8]">Approval (5d)</div>
                  <div className="p-2 bg-white rounded-xs border border-[#E5E1D8]">Trainer Conf (7d)</div>
                  <div className="p-2 bg-white rounded-xs border border-[#E5E1D8]">Marketing (10d)</div>
                  <div className="p-2 bg-white rounded-xs border border-[#E5E1D8]">Registration (14d)</div>
                  <div className="p-2 bg-white rounded-xs border border-[#E5E1D8]">Infra Setup (5d)</div>
                </div>

                <div
                  className={`p-2.5 rounded-xs border text-center font-bold ${
                    noticeStatus === "GOOD"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  Notice Period Readiness: {noticeStatus === "WARNING" ? "TIGHT" : noticeStatus} ({prepDays} days remaining; pending preparation tasks are evaluated again when saved)
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: MARKETING & PUBLICITY KIT */}
          {wizardStep === 7 && (
            <div className="space-y-4 font-mono text-xs">
              <h3 className="text-lg font-normal text-[#111827] font-sans" style={{ fontFamily: "var(--font-display)" }}>
                Step 7: Auto-Generated Marketing & Publicity Kit
              </h3>
              <p className="text-[#64748B]">
                Lumina Intel synthesizes ready-to-publish campaign copy for student portals, email circulars, and LinkedIn announcements.
              </p>

              <div className="space-y-3">
                {/* LinkedIn Copy */}
                <div className="p-3.5 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#111827]">LinkedIn / Social Media Announcement:</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `Excited to announce our upcoming workshop: ${wizardForm.title} at NIT Demo University! Our students will bridge key competencies with ${wizardForm.trainer_name}. #EngineeringEducation #MachineLearning #TechWorkshop`,
                          "linkedin"
                        )
                      }
                      className="px-2.5 py-1 border border-[#E5E1D8] bg-white rounded-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{copiedKey === "linkedin" ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="text-[#475569] text-[11px] leading-relaxed">
                    Excited to announce our upcoming workshop: <strong>{wizardForm.title}</strong> at NIT Demo University! Our students will bridge key competencies with {wizardForm.trainer_name}. #EngineeringEducation #TechWorkshop
                  </p>
                </div>

                {/* Email Circular */}
                <div className="p-3.5 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#111827]">Email Circular to Registered Students:</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `Subject: [Action Required] Register for ${wizardForm.title}\n\nDear Students,\n\nWe are hosting a workshop on ${wizardForm.title}. Trainer: ${wizardForm.trainer_name}.\nPlease register to reserve your workstation.`,
                          "email"
                        )
                      }
                      className="px-2.5 py-1 border border-[#E5E1D8] bg-white rounded-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{copiedKey === "email" ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="text-[#475569] text-[11px] leading-relaxed">
                    Subject: [Action Required] Register for {wizardForm.title} · Hands-on lab workstations reserved.
                  </p>
                </div>
                {[
                  ["WhatsApp announcement", `${wizardForm.title} • ${wizardForm.start_date} • Register now through Lumina Intel.`, "whatsapp"],
                  ["Poster text", `${wizardForm.title} | ${wizardForm.target_department} | ${wizardForm.start_date} | Seats: ${wizardForm.expected_participants}`, "poster"],
                  ["Registration promotion", `Registrations open for ${wizardForm.target_cohort}. Target skills: ${wizardForm.target_skill}.`, "registration"],
                ].map(([label, copy, key]) => (
                  <div key={key} className="p-3.5 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm space-y-2">
                    <div className="flex items-center justify-between"><span className="font-bold text-[#111827]">{label}</span><button type="button" onClick={() => copyToClipboard(copy, key)} className="px-2.5 py-1 border border-[#E5E1D8] bg-white rounded-xs flex items-center gap-1"><Copy className="h-3 w-3" />Copy</button></div>
                    <p className="text-[#475569] text-[11px]">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stepper Navigation Controls */}
          <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-between">
            <button
              type="button"
              disabled={wizardStep === 1}
              onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
              className="px-4 py-2 border border-[#E5E1D8] hover:bg-[#F7F5F0] rounded-md font-mono text-xs text-[#64748B] disabled:opacity-30 cursor-pointer"
            >
              Previous
            </button>

            {wizardStep < 7 ? (
              <button
                type="button"
                onClick={() => setWizardStep((s) => Math.min(7, s + 1))}
                className="px-5 py-2 bg-[#0B0B0A] hover:bg-[#262626] text-white rounded-md font-mono text-xs flex items-center gap-2 cursor-pointer"
              >
                <span>Continue</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submittingWizard}
                onClick={handleCreateTraining}
                className="px-6 py-2 bg-[#4F6F5A] hover:bg-[#3d5746] text-white rounded-md font-mono text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{submittingWizard ? "Configuring..." : "Finalize & Launch Program"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: EXECUTION & OUTCOMES */}
      {viewMode === "execution" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
              Training Execution & Closed-Loop Outcome Analytics
            </h3>
            <span className="text-xs font-mono text-[#64748B]">{trainings.length} Recorded Programs</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* List of Programs */}
            <div className="space-y-3">
              {trainings.map((tr) => (
                <button
                  key={tr.id}
                  onClick={() => setSelectedTraining(tr)}
                  className={`w-full p-4 rounded-md border text-left transition-colors cursor-pointer space-y-2 ${
                    selectedTraining?.id === tr.id
                      ? "bg-[#FFFFFF] border-[#B08D57] shadow-sm"
                      : "bg-[#FFFFFF] border-[#E5E1D8] hover:border-[#B08D57]/40"
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="uppercase text-[#B08D57] px-2 py-0.5 rounded-xs border border-[#E5E1D8]">
                      {tr.status.replace("_", " ")}
                    </span>
                    <span className="text-[#64748B]">{tr.target_skill}</span>
                  </div>
                  <h4 className="text-base font-normal text-[#111827] font-sans" style={{ fontFamily: "var(--font-display)" }}>
                    {tr.title}
                  </h4>
                  <p className="text-xs font-mono text-[#475569]">
                    Trainer: {tr.trainer_name || "Internal Faculty"} · {tr.expected_participants} Students
                  </p>
                </button>
              ))}
            </div>

            {/* Program Detail & Outcome Comparison */}
            {selectedTraining && (
              <div className="lg:col-span-2 bg-[#FFFFFF] rounded-md border border-[#E5E1D8] p-6 space-y-6 shadow-2xs font-mono text-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E5E1D8] pb-4">
                  <div>
                    <span className="text-[10px] text-[#B08D57] uppercase tracking-wider">
                      {selectedTraining.program_type}
                    </span>
                    <h3 className="text-2xl font-normal text-[#111827] mt-1 font-sans" style={{ fontFamily: "var(--font-display)" }}>
                      {selectedTraining.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => {
                      setOutcomeForm({
                        skill_name: selectedTraining.target_skill,
                        pre_score: 41.0,
                        post_score: 72.0,
                        cohort_name: `${selectedTraining.target_department} (${selectedTraining.target_year})`,
                        attendance_count: selectedTraining.execution_metrics?.attended_count || 156,
                        feedback_rating: 4.6,
                      });
                      setShowOutcomeModal(true);
                    }}
                    className="px-3.5 py-2 bg-[#B08D57] hover:bg-[#9a7b4c] text-white rounded-md flex items-center gap-1.5 cursor-pointer shadow-xs font-mono text-xs shrink-0"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>Record Pre/Post Outcomes</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm">
                    <span className="text-[10px] text-[#64748B] uppercase block">Preparation readiness</span>
                    <span className="text-lg font-bold text-[#111827]">{selectedTraining.notice_status}</span>
                    <p className="text-[10px] text-[#64748B]">{selectedTraining.notice_period_days} days · {selectedTraining.preparation_tasks.filter((task) => task.status !== "completed").length} pending tasks</p>
                  </div>
                  <div className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm">
                    <span className="text-[10px] text-[#64748B] uppercase block">Infrastructure gaps</span>
                    <span className="text-lg font-bold text-[#111827]">{selectedTraining.infrastructure_comparison.filter((item) => item.gap > 0).length}</span>
                    <p className="text-[10px] text-[#64748B]">Required vs available resources</p>
                  </div>
                  <div className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm">
                    <span className="text-[10px] text-[#64748B] uppercase block">Funding</span>
                    <span className="text-lg font-bold text-[#111827]">₹{selectedTraining.funding_gap.toLocaleString()} gap</span>
                    <button type="button" onClick={() => onNavigateToFundingHub?.()} className="text-[10px] font-bold text-[#B08D57]">Find Funding →</button>
                  </div>
                </div>

                {/* Execution Metrics Bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm">
                    <span className="text-[10px] text-[#64748B] uppercase block">Registrations</span>
                    <span className="text-xl font-bold text-[#111827]">
                      {selectedTraining.execution_metrics?.registered_count ?? selectedTraining.expected_participants}
                    </span>
                  </div>
                  <div className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm">
                    <span className="text-[10px] text-[#64748B] uppercase block">Attended</span>
                    <span className="text-xl font-bold text-[#111827]">
                      {selectedTraining.execution_metrics?.attended_count ?? 0}
                    </span>
                  </div>
                  <div className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm">
                    <span className="text-[10px] text-[#64748B] uppercase block">Feedback Score</span>
                    <span className="text-xl font-bold text-amber-600">
                      {selectedTraining.execution_metrics?.average_feedback_rating ?? 0}/5
                    </span>
                  </div>
                  <div className="p-3 bg-[#F7F5F0] border border-[#E5E1D8] rounded-sm">
                    <span className="text-[10px] text-[#64748B] uppercase block">Certificates Issued</span>
                    <span className="text-xl font-bold text-[#4F6F5A]">
                      {selectedTraining.execution_metrics?.certificates_issued ?? 0}
                    </span>
                  </div>
                </div>

                {/* Pre vs Post Readiness Comparison Box (Closed-Loop Outcome) */}
                <div className="p-5 bg-[#FAF7F2] border border-[#B08D57]/40 rounded-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-[#111827] text-sm font-sans block">
                        Closed-Loop Outcome Measurement ({selectedTraining.target_skill})
                      </span>
                      <p className="text-[11px] text-[#64748B]">
                        Comparison of cohort skill readiness benchmark before vs. after workshop completion.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xs text-xs font-bold">
                      {selectedOutcome ? `${selectedOutcome.improvement_percentage >= 0 ? "+" : ""}${selectedOutcome.improvement_percentage}% Improvement` : "Awaiting assessment"}
                    </span>
                  </div>

                  {/* Visual Bar Comparison */}
                  <div className="space-y-3 pt-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#64748B]">Pre-Workshop Cohort Readiness</span>
                        <span className="font-bold text-[#111827]">{selectedOutcome?.pre_readiness_score ?? 0}%</span>
                      </div>
                      <div className="h-3 bg-[#E5E1D8] rounded-full overflow-hidden">
                        <div className="h-full bg-stone-500 rounded-full" style={{ width: `${selectedOutcome?.pre_readiness_score ?? 0}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#64748B]">Post-Workshop Cohort Readiness</span>
                        <span className="font-bold text-[#4F6F5A]">{selectedOutcome?.post_readiness_score ?? 0}% measured readiness</span>
                      </div>
                      <div className="h-3 bg-[#E5E1D8] rounded-full overflow-hidden">
                        <div className="h-full bg-[#4F6F5A] rounded-full" style={{ width: `${selectedOutcome?.post_readiness_score ?? 0}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#475569] pt-2 border-t border-[#E5E1D8]/60 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-[#4F6F5A]" />
                    <span>
                      Attendance and assessment outcomes are recorded separately. Workshop attendance never verifies a Skill Passport skill; students must submit qualifying evidence through the existing provenance workflow.
                    </span>
                  </div>
                </div>

                {/* Campaign Analytics */}
                {selectedTraining.campaign_metrics && (
                  <div className="space-y-2">
                    <span className="font-bold text-[#111827] block">Publicity Campaign Analytics:</span>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-center text-[11px]">
                      <div className="p-2.5 bg-[#F7F5F0] rounded-xs border border-[#E5E1D8]">
                        Emails: {selectedTraining.campaign_metrics.emails_sent}
                      </div>
                      <div className="p-2.5 bg-[#F7F5F0] rounded-xs border border-[#E5E1D8]">
                        WhatsApp: {selectedTraining.campaign_metrics.whatsapp_recipients ?? 0}
                      </div>
                      <div className="p-2.5 bg-[#F7F5F0] rounded-xs border border-[#E5E1D8]">
                        LinkedIn: {selectedTraining.campaign_metrics.linkedin_views ?? selectedTraining.campaign_metrics.page_views ?? 0}
                      </div>
                      <div className="p-2.5 bg-[#F7F5F0] rounded-xs border border-[#E5E1D8]">
                        Poster Scans: {selectedTraining.campaign_metrics.poster_scans ?? 0}
                      </div>
                      <div className="p-2.5 bg-[#F7F5F0] rounded-xs border border-[#E5E1D8]">
                        Registrations: {selectedTraining.campaign_metrics.registrations}
                      </div>
                      <div className="p-2.5 bg-[#F7F5F0] rounded-xs border border-[#E5E1D8]">
                        Confirmed: {selectedTraining.campaign_metrics.confirmed_participants}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RECORD OUTCOMES MODAL */}
      {showOutcomeModal && selectedTraining && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-md max-w-lg w-full p-6 space-y-4 font-mono text-xs">
            <div className="flex items-start justify-between border-b border-[#E5E1D8] pb-3">
              <div>
                <span className="text-[10px] text-[#B08D57] uppercase tracking-wider">Closed-Loop Outcome Measurement</span>
                <h3 className="text-lg font-normal text-[#111827] mt-1 font-sans" style={{ fontFamily: "var(--font-display)" }}>
                  Record Pre/Post Outcomes
                </h3>
              </div>
            </div>

            <form onSubmit={handleRecordOutcomesSubmit} className="space-y-3">
              <div>
                <label className="block text-[#64748B] mb-1">Target Skill Evaluated</label>
                <input
                  type="text"
                  required
                  value={outcomeForm.skill_name}
                  onChange={(e) => setOutcomeForm({ ...outcomeForm, skill_name: e.target.value })}
                  className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#64748B] mb-1">Pre-Workshop Score (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={outcomeForm.pre_score}
                    onChange={(e) => setOutcomeForm({ ...outcomeForm, pre_score: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Post-Workshop Score (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={outcomeForm.post_score}
                    onChange={(e) => setOutcomeForm({ ...outcomeForm, post_score: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white font-bold text-[#4F6F5A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#64748B] mb-1">Attended Count</label>
                  <input
                    type="number"
                    value={outcomeForm.attendance_count || 156}
                    onChange={(e) => setOutcomeForm({ ...outcomeForm, attendance_count: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[#64748B] mb-1">Feedback Rating (/5)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={outcomeForm.feedback_rating || 4.6}
                    onChange={(e) => setOutcomeForm({ ...outcomeForm, feedback_rating: Number(e.target.value) })}
                    className="w-full p-2 border border-[#E5E1D8] rounded-md bg-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#FAF7F2] border border-[#B08D57]/30 rounded-sm text-[#475569]">
                These measurements are program outcomes only. They do not create evidence or change student skill-verification tiers.
              </div>

              <div className="pt-3 border-t border-[#E5E1D8] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOutcomeModal(false)}
                  className="px-3 py-1.5 border border-[#E5E1D8] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOutcomes}
                  className="px-4 py-1.5 bg-[#0B0B0A] hover:bg-[#262626] text-white rounded-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{savingOutcomes ? "Recording..." : "Save Outcomes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
