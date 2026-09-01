import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { CareerGoals, CareerGuidanceOverview, SkillGapAnalysis } from "../api/types";
import { CircularReadinessGauge } from "./CircularReadinessGauge";
import { toast } from "sonner";
import { EditorialButton, EditorialTextTabs } from "./ui/EditorialPrimitives";

interface Props {
  token: string;
  onNavigateToLearning?: () => void;
  onNavigateToAssessment?: () => void;
}

const POPULAR_ROLES = [
  "Full Stack Developer",
  "AI / Machine Learning Engineer",
  "Data Scientist",
  "DevOps / Cloud Engineer",
];

export function SkillGapAnalyzer({ token, onNavigateToLearning, onNavigateToAssessment }: Props) {
  const [goals, setGoals] = useState<CareerGoals | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("Full Stack Developer");
  const [analysis, setAnalysis] = useState<SkillGapAnalysis | null>(null);
  const [guidance, setGuidance] = useState<CareerGuidanceOverview | null>(null);
  const [activeTab, setActiveTab] = useState<string>("gaps");
  const [loading, setLoading] = useState(true);
  const [savingGoals, setSavingGoals] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [userGoals, guidanceData] = await Promise.all([
        api.getCareerGoals(token),
        api.getCareerGuidance(token).catch(() => null),
      ]);
      setGoals(userGoals);
      setGuidance(guidanceData);
      const activeRole = userGoals.target_roles?.[0] || "Full Stack Developer";
      setSelectedRole(activeRole);
      const gapData = await api.getSkillGapAnalysis(token, activeRole);
      setAnalysis(gapData);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load skill gap analysis"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleRoleChange(role: string) {
    setSelectedRole(role);
    try {
      setLoading(true);
      const gapData = await api.getSkillGapAnalysis(token, role);
      setAnalysis(gapData);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to analyze target role"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveTargetRole() {
    if (!goals) return;
    try {
      setSavingGoals(true);
      const updated = await api.updateCareerGoals(
        {
          ...goals,
          target_roles: [selectedRole, ...(goals.target_roles?.filter((r) => r !== selectedRole) || [])],
        },
        token
      );
      setGoals(updated);
      toast.success(`Target role set to ${selectedRole}`);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update target role"));
    } finally {
      setSavingGoals(false);
    }
  }

  if (loading && !analysis) {
    return (
      <div className="p-12 text-center border border-[#E5E1D8] bg-[#FFFFFF] rounded-[16px] shadow-2xs">
        <div className="inline-block animate-spin h-6 w-6 border-2 border-[#B08D57] border-t-transparent rounded-full mb-3" />
        <p className="font-mono text-xs text-[#64748B]">Analyzing career readiness and skill requirements...</p>
      </div>
    );
  }

  const verifiedSkills = analysis?.gap_items.filter((i) => i.status === "verified" || i.status === "assessed") || [];
  const missingSkills = analysis?.gap_items.filter((i) => i.status === "missing") || [];

  const mainTabs = [
    { id: "gaps", label: "Skill Gap Matrix & Readiness" },
    { id: "guidance", label: `Career Pathways ${guidance ? `(${guidance.ready_roles.length} Ready)` : ""}` },
  ];

  return (
    <div className="space-y-6 font-sans text-[#111827]">
      {/* Target Role Selector Header Box */}
      <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-7 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold block mb-1">
              Target Career Role
            </span>
            <h2
              className="text-2xl font-normal text-[#111827]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {selectedRole}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {POPULAR_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleChange(role)}
                className={`px-3.5 py-1.5 rounded-full font-mono text-xs transition-all cursor-pointer ${
                  selectedRole === role
                    ? "bg-[#0B0B0A] text-[#FFFFFF] font-medium"
                    : "border border-[#E5E1D8] bg-[#F7F5F0] text-[#475569] hover:text-[#111827] hover:border-[#B08D57]"
                }`}
              >
                {role}
              </button>
            ))}
            <button
              type="button"
              onClick={handleSaveTargetRole}
              disabled={savingGoals}
              className="pill-btn-outline px-3.5 py-1.5 text-xs text-[#111827] flex items-center gap-1.5"
            >
              <Sparkles className="h-3 w-3 text-[#B08D57]" />
              <span>Set Primary</span>
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <EditorialTextTabs
          tabs={mainTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          className="pt-2"
        />
      </div>

      {activeTab === "guidance" && guidance && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ready Roles */}
            <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <div className="border-b border-[#E5E1D8] pb-3">
                <h3
                  className="text-xl font-normal text-[#111827]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Roles You Are Ready For
                </h3>
                <p className="text-xs text-[#475569] mt-0.5 font-mono">
                  Verified evidence exceeds the 70% requirement threshold.
                </p>
              </div>

              <div className="space-y-3">
                {guidance.ready_roles.length > 0 ? (
                  guidance.ready_roles.map((r) => (
                    <div
                      key={r.role_name}
                      className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[12px] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-[#111827] font-semibold">{r.role_name}</span>
                        <span className="badge-success">
                          {Math.round(r.readiness_percentage)}% Ready
                        </span>
                      </div>
                      <p className="text-xs text-[#475569] leading-relaxed">{r.why_explanation}</p>
                      <div className="font-mono text-[11px] text-[#64748B] pt-1">
                        Next step: {r.recommended_next_step}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-mono text-[#64748B]">
                    Complete more coursework or assessments to unlock 70%+ ready roles.
                  </p>
                )}
              </div>
            </div>

            {/* Next-Step Roles */}
            <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <div className="border-b border-[#E5E1D8] pb-3">
                <h3
                  className="text-xl font-normal text-[#111827]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Realistic Next-Step Roles
                </h3>
                <p className="text-xs text-[#475569] mt-0.5 font-mono">
                  Closing 1–2 specific gaps qualifies you for direct interviews.
                </p>
              </div>

              <div className="space-y-3">
                {guidance.next_step_roles.map((r) => (
                  <div
                    key={r.role_name}
                    className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[12px] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-[#111827] font-semibold">{r.role_name}</span>
                      <span className="badge-warning">
                        {Math.round(r.readiness_percentage)}% Match
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed">{r.why_explanation}</p>
                    <div className="font-mono text-xs text-[#B08D57] font-semibold pt-1">
                      Missing: {r.missing_critical_skills.join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Steps & Industry Sectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <h3
                className="text-xl font-normal text-[#111827] border-b border-[#E5E1D8] pb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Actionable Next Steps
              </h3>
              <div className="space-y-2.5">
                {guidance.learning_action_plan.map((item) => (
                  <div
                    key={item.priority}
                    className="flex items-start gap-3 border border-[#E5E1D8] bg-[#F7F5F0] p-3.5 rounded-[12px]"
                  >
                    <span className="font-mono text-xs text-[#B08D57] font-bold shrink-0">
                      0{item.priority}
                    </span>
                    <div>
                      <p className="text-xs text-[#111827] leading-relaxed font-medium">{item.action}</p>
                      <p className="font-mono text-[11px] text-[#64748B] mt-0.5">Impact: {item.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
              <h3
                className="text-xl font-normal text-[#111827] border-b border-[#E5E1D8] pb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Aligning Industry Sectors
              </h3>
              <p className="font-mono text-xs text-[#64748B]">
                Sectors actively hiring for {guidance.target_role}:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {guidance.aligning_industry_sectors.map((sec) => (
                  <span
                    key={sec}
                    className="font-mono text-xs text-[#475569] border border-[#E5E1D8] bg-[#F7F5F0] px-3.5 py-1.5 rounded-full"
                  >
                    {sec}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Readiness Overview */}
      {activeTab === "gaps" && analysis && (
        <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-7 rounded-[16px] space-y-6 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <CircularReadinessGauge
                readinessScore={analysis.overall_readiness_score}
                label="READY"
                size={100}
              />
              <div className="space-y-1">
                <h3
                  className="text-2xl font-normal text-[#111827]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {analysis.target_role}
                </h3>
                <div className="font-mono text-xs text-[#B08D57] font-semibold">
                  {analysis.overall_readiness_score}% Deterministic Role Readiness
                </div>
                <p className="text-xs text-[#475569] max-w-xl leading-relaxed pt-1">
                  {analysis.overall_readiness_score >= 70
                    ? "Strong verified match. You meet the qualification requirements for this target role."
                    : "Bridge critical missing skills below to unlock high-confidence recruiter matching."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 self-start md:self-center">
              {onNavigateToAssessment && (
                <EditorialButton
                  variant="primary"
                  onClick={onNavigateToAssessment}
                >
                  Take Assessment
                </EditorialButton>
              )}
              {onNavigateToLearning && (
                <EditorialButton
                  variant="secondary"
                  onClick={onNavigateToLearning}
                >
                  Bridge Gaps
                </EditorialButton>
              )}
            </div>
          </div>

          {/* 2-column breakdown: Strong Skills vs Critical Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#E5E1D8]">
            <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[12px] space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] font-semibold block">
                Verified Skills ({verifiedSkills.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {verifiedSkills.length > 0 ? (
                  verifiedSkills.map((s) => (
                    <span
                      key={s.skill_name}
                      className="inline-flex items-center gap-1 font-mono text-xs text-[#4F6F5A] border border-[rgba(79,111,90,0.25)] bg-[rgba(79,111,90,0.10)] px-3 py-1 rounded-full font-medium"
                    >
                      <CheckCircle2 className="h-3 w-3 text-[#4F6F5A]" />
                      <span>{s.skill_name}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-mono text-[#64748B]">No skills verified yet</span>
                )}
              </div>
            </div>

            <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[12px] space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] font-semibold block">
                Missing Gaps ({missingSkills.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.length > 0 ? (
                  missingSkills.map((s) => (
                    <span
                      key={s.skill_name}
                      className="inline-flex items-center gap-1 font-mono text-xs text-[#B4534B] border border-[#B4534B]/30 bg-[rgba(180,83,75,0.08)] px-3 py-1 rounded-full font-medium"
                    >
                      <AlertCircle className="h-3 w-3 text-[#B4534B]" />
                      <span>{s.skill_name}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-mono text-[#4F6F5A] font-semibold">All required skills met</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Skill Gap Matrix as Ruled Rows */}
      {analysis && (
        <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-7 rounded-[16px] space-y-4 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
          <div className="border-b border-[#E5E1D8] pb-3">
            <h3
              className="text-xl font-normal text-[#111827]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Detailed Skill Gap Closure Roadmap
            </h3>
          </div>

          <div className="divide-y divide-[#E5E1D8]">
            {analysis.gap_items.map((item, idx) => (
              <motion.div
                key={item.skill_name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {item.status === "verified" || item.status === "assessed" ? (
                      <CheckCircle2 className="h-4 w-4 text-[#4F6F5A]" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-[#B4534B]" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-[#111827] font-semibold">{item.skill_name}</span>
                      <span className="font-mono text-[10px] uppercase text-[#64748B]">
                        {item.category}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded-full font-semibold ${
                          item.importance === "critical"
                            ? "text-[#B4534B] border border-[#B4534B]/30 bg-[rgba(180,83,75,0.08)]"
                            : "text-[#64748B] border border-[#E5E1D8] bg-[#F7F5F0]"
                        }`}
                      >
                        {item.importance}
                      </span>
                    </div>
                    <p className="text-xs text-[#475569] leading-relaxed font-sans">{item.recommended_action}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto shrink-0 font-mono text-xs">
                  {item.status === "missing" && (
                    <button
                      type="button"
                      onClick={onNavigateToLearning}
                      className="text-[#B08D57] hover:text-[#111827] font-semibold cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <span>Find Courses</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                  {item.status === "verified" && (
                    <span className="text-[#4F6F5A] flex items-center gap-1 font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{Math.round(item.proficiency_score * 100)}% Proficiency</span>
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
