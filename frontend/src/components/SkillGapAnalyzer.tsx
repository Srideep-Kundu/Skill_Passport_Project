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
import { EditorialButton, EditorialPageHeader, EditorialTextTabs } from "./ui/EditorialPrimitives";

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
      <div className="p-12 text-center border border-white/10 bg-[#071E2B] rounded-md">
        <div className="inline-block animate-spin h-6 w-6 border-2 border-white/20 border-t-white rounded-full mb-3" />
        <p className="font-mono text-xs text-[#8796A2]">Analyzing career readiness and skill requirements...</p>
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
    <div className="space-y-6 font-sans">
      <EditorialPageHeader
        category="STUDENT"
        index="ANALYSIS"
        title="Skill Gaps & Career Readiness"
        subtitle="Evaluate your verified competency graph against target industry roles to discover actionable preparation paths."
      />

      {/* Target Role Selector Header Box */}
      <div className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#8796A2] block mb-1">
              Target Career Role
            </span>
            <h2
              className="text-2xl font-normal text-[#F7F8F8]"
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
                className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors cursor-pointer ${
                  selectedRole === role
                    ? "border border-[#9CC7D8]/40 bg-[#9CC7D8]/10 text-[#9CC7D8]"
                    : "border border-white/10 bg-white/[0.02] text-[#8796A2] hover:text-[#F7F8F8]"
                }`}
              >
                {role}
              </button>
            ))}
            <button
              type="button"
              onClick={handleSaveTargetRole}
              disabled={savingGoals}
              className="px-3 py-1.5 border border-white/20 bg-white/10 hover:bg-white/15 text-white font-mono text-xs rounded-md transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
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
            <div className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-4">
              <div className="border-b border-white/10 pb-3">
                <h3
                  className="text-lg font-normal text-[#F7F8F8]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Roles You Are Ready For
                </h3>
                <p className="text-xs text-[#8796A2] mt-0.5 font-mono">
                  Verified evidence exceeds the 70% requirement threshold.
                </p>
              </div>

              <div className="space-y-3">
                {guidance.ready_roles.length > 0 ? (
                  guidance.ready_roles.map((r) => (
                    <div
                      key={r.role_name}
                      className="border border-white/10 bg-white/[0.02] p-4 rounded-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-[#F7F8F8]">{r.role_name}</span>
                        <span className="font-mono text-xs text-[#9CC7D8] border border-[#9CC7D8]/30 px-2 py-0.5 rounded-xs">
                          {Math.round(r.readiness_percentage)}% Ready
                        </span>
                      </div>
                      <p className="text-xs text-[#BEC8CF] leading-relaxed">{r.why_explanation}</p>
                      <div className="font-mono text-[11px] text-[#8796A2] pt-1">
                        Next step: {r.recommended_next_step}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-mono text-[#8796A2]">
                    Complete more coursework or assessments to unlock 70%+ ready roles.
                  </p>
                )}
              </div>
            </div>

            {/* Next-Step Roles */}
            <div className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-4">
              <div className="border-b border-white/10 pb-3">
                <h3
                  className="text-lg font-normal text-[#F7F8F8]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Realistic Next-Step Roles
                </h3>
                <p className="text-xs text-[#8796A2] mt-0.5 font-mono">
                  Closing 1–2 specific gaps qualifies you for direct interviews.
                </p>
              </div>

              <div className="space-y-3">
                {guidance.next_step_roles.map((r) => (
                  <div
                    key={r.role_name}
                    className="border border-white/10 bg-white/[0.02] p-4 rounded-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-[#F7F8F8]">{r.role_name}</span>
                      <span className="font-mono text-xs text-[#BEC8CF] border border-white/15 px-2 py-0.5 rounded-xs">
                        {Math.round(r.readiness_percentage)}% Match
                      </span>
                    </div>
                    <p className="text-xs text-[#BEC8CF] leading-relaxed">{r.why_explanation}</p>
                    <div className="font-mono text-xs text-[#9CC7D8] pt-1">
                      Missing: {r.missing_critical_skills.join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Steps & Industry Sectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-4">
              <h3
                className="text-lg font-normal text-[#F7F8F8] border-b border-white/10 pb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Actionable Next Steps
              </h3>
              <div className="space-y-2.5">
                {guidance.learning_action_plan.map((item) => (
                  <div
                    key={item.priority}
                    className="flex items-start gap-3 border border-white/10 bg-white/[0.01] p-3 rounded-sm"
                  >
                    <span className="font-mono text-xs text-[#9CC7D8] font-bold shrink-0">
                      0{item.priority}
                    </span>
                    <div>
                      <p className="text-xs text-[#F7F8F8] leading-relaxed">{item.action}</p>
                      <p className="font-mono text-[11px] text-[#8796A2] mt-0.5">Impact: {item.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-4">
              <h3
                className="text-lg font-normal text-[#F7F8F8] border-b border-white/10 pb-3"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Aligning Industry Sectors
              </h3>
              <p className="font-mono text-xs text-[#8796A2]">
                Sectors actively hiring for {guidance.target_role}:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {guidance.aligning_industry_sectors.map((sec) => (
                  <span
                    key={sec}
                    className="font-mono text-xs text-[#BEC8CF] border border-white/10 bg-white/[0.02] px-3 py-1.5 rounded-sm"
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
        <div className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <CircularReadinessGauge
                readinessScore={analysis.overall_readiness_score}
                label="READY"
                size={100}
              />
              <div className="space-y-1">
                <h3
                  className="text-2xl font-normal text-[#F7F8F8]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {analysis.target_role}
                </h3>
                <div className="font-mono text-xs text-[#9CC7D8]">
                  {analysis.overall_readiness_score}% Deterministic Role Readiness
                </div>
                <p className="text-xs text-[#BEC8CF] max-w-xl leading-relaxed pt-1">
                  {analysis.overall_readiness_score >= 70
                    ? "Strong verified match. You meet the qualification requirements for this target role."
                    : "Bridge critical missing skills below to unlock high-confidence recruiter matching."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 self-start md:self-center">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#8796A2] block">
                Verified Skills ({verifiedSkills.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {verifiedSkills.length > 0 ? (
                  verifiedSkills.map((s) => (
                    <span
                      key={s.skill_name}
                      className="inline-flex items-center gap-1 font-mono text-xs text-[#F7F8F8] border border-white/15 bg-white/5 px-2.5 py-1 rounded-xs"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span>{s.skill_name}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-mono text-[#8796A2]">No skills verified yet</span>
                )}
              </div>
            </div>

            <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm space-y-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#8796A2] block">
                Missing Gaps ({missingSkills.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.length > 0 ? (
                  missingSkills.map((s) => (
                    <span
                      key={s.skill_name}
                      className="inline-flex items-center gap-1 font-mono text-xs text-[#9CC7D8] border border-[#9CC7D8]/30 bg-[#9CC7D8]/10 px-2.5 py-1 rounded-xs"
                    >
                      <AlertCircle className="h-3 w-3 text-[#9CC7D8]" />
                      <span>{s.skill_name}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-mono text-emerald-400">All required skills met</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Skill Gap Matrix as Ruled Rows */}
      {analysis && (
        <div className="border border-white/10 bg-[#071E2B] p-6 rounded-md space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3
              className="text-lg font-normal text-[#F7F8F8]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Detailed Skill Gap Closure Roadmap
            </h3>
          </div>

          <div className="divide-y divide-white/10">
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
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-[#9CC7D8]" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-[#F7F8F8]">{item.skill_name}</span>
                      <span className="font-mono text-[10px] uppercase text-[#8796A2]">
                        {item.category}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase px-1.5 py-0.5 rounded-xs ${
                          item.importance === "critical"
                            ? "text-[#9CC7D8] border border-[#9CC7D8]/30"
                            : "text-[#8796A2] border border-white/10"
                        }`}
                      >
                        {item.importance}
                      </span>
                    </div>
                    <p className="text-xs text-[#BEC8CF] leading-relaxed font-sans">{item.recommended_action}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto shrink-0 font-mono text-xs">
                  {item.status === "missing" && (
                    <button
                      type="button"
                      onClick={onNavigateToLearning}
                      className="text-[#9CC7D8] hover:text-[#F7F8F8] cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <span>Find Courses</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                  {item.status === "verified" && (
                    <span className="text-emerald-400 flex items-center gap-1">
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
