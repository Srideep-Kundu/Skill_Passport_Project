import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Compass,
  Building2,
  Briefcase,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { CareerGoals, CareerGuidanceOverview, SkillGapAnalysis } from "../api/types";
import { CircularReadinessGauge } from "./CircularReadinessGauge";
import { toast } from "sonner";

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
  const [activeTab, setActiveTab] = useState<"gaps" | "guidance">("gaps");
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
      <div className="p-8 text-center bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl border border-slate-200/70 dark:border-white/[0.08] shadow-lg">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-[#3b71d9] border-t-transparent rounded-full mb-3" />
        <p className="text-sm text-slate-500 dark:text-[#98a4b3]">Analyzing career readiness and skill requirements...</p>
      </div>
    );
  }

  const verifiedSkills = analysis?.gap_items.filter((i) => i.status === "verified" || i.status === "assessed") || [];
  const missingSkills = analysis?.gap_items.filter((i) => i.status === "missing") || [];

  return (
    <div className="space-y-6">
      {/* Target Role Selector Header */}
      <div className="bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-white/[0.08] shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-5 w-5 text-[#3b71d9] dark:text-[#b0c6ff]" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Target Career Role & Ambition</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-[#98a4b3] font-sans">
              Select your aspiration to calculate real-time deterministic role readiness against verified Passport evidence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {POPULAR_ROLES.map((role) => (
              <button
                key={role}
                onClick={() => handleRoleChange(role)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer backdrop-blur-md ${
                  selectedRole === role
                    ? "bg-[#3b71d9] text-white shadow-xs shadow-[#3b71d9]/30"
                    : "bg-slate-100/80 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08]"
                }`}
              >
                {role}
              </button>
            ))}
            <button
              onClick={handleSaveTargetRole}
              disabled={savingGoals}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Set Primary
            </button>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
          <button
            onClick={() => setActiveTab("gaps")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "gaps"
                ? "bg-[#3b71d9] text-white shadow-xs"
                : "text-slate-600 dark:text-[#98a4b3] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Skill Gap Matrix & Readiness
          </button>
          <button
            onClick={() => setActiveTab("guidance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "guidance"
                ? "bg-[#3b71d9] text-white shadow-xs"
                : "text-slate-600 dark:text-[#98a4b3] hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            Career Guidance Pathways {guidance && `(${guidance.ready_roles.length} Ready)`}
          </button>
        </div>
      </div>

      {activeTab === "guidance" && guidance && (
        <div className="space-y-6">
          {/* Top Role Readiness Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ready Roles */}
            <div className="bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-white/[0.08] shadow-lg space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Roles You Are Ready For</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
                You have strong verified evidence meeting or exceeding the 70% curriculum threshold.
              </p>
              <div className="space-y-3">
                {guidance.ready_roles.length > 0 ? (
                  guidance.ready_roles.map((r) => (
                    <div
                      key={r.role_name}
                      className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 backdrop-blur-md border border-emerald-200/50 dark:border-emerald-900/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{r.role_name}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100/90 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                          {Math.round(r.readiness_percentage)}% Ready
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">💡 {r.why_explanation}</p>
                      <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 pt-1">
                        <span>Recommended: {r.recommended_next_step}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">Complete more coursework or assessments to unlock 70%+ ready roles.</p>
                )}
              </div>
            </div>

            {/* Next-Step Roles */}
            <div className="bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-white/[0.08] shadow-lg space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#3b71d9] dark:text-[#b0c6ff]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Realistic Next-Step Roles</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
                Roles where bridging 1–2 specific gaps will quickly qualify you for interviews.
              </p>
              <div className="space-y-3">
                {guidance.next_step_roles.map((r) => (
                  <div
                    key={r.role_name}
                    className="p-4 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 backdrop-blur-md border border-blue-100 dark:border-blue-900/30 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{r.role_name}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100/90 dark:bg-blue-900/50 text-[#3b71d9] dark:text-[#b0c6ff]">
                        {Math.round(r.readiness_percentage)}% Match
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">💡 {r.why_explanation}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {r.missing_critical_skills.map((s) => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-md bg-rose-50/80 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 font-semibold">
                          Missing: {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Plan & Industry Alignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-white/[0.08] shadow-lg space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Actionable Next Steps</h3>
              </div>
              <div className="space-y-2.5">
                {guidance.learning_action_plan.map((item) => (
                  <div key={item.priority} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50/50 dark:bg-white/[0.03] backdrop-blur-md border border-slate-200/40 dark:border-white/[0.04]">
                    <span className="w-5 h-5 rounded-full bg-[#3b71d9] text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {item.priority}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.action}</p>
                      <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">Impact: {item.impact}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-white/[0.08] shadow-lg space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#3b71d9] dark:text-[#b0c6ff]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Aligning Industry Sectors</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#98a4b3] font-sans">
                Sectors actively hiring for your primary target role ({guidance.target_role}):
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {guidance.aligning_industry_sectors.map((sec) => (
                  <span
                    key={sec}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100/80 dark:bg-white/[0.05] text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/[0.08] flex items-center gap-1.5 backdrop-blur-xs"
                  >
                    <Briefcase className="h-3.5 w-3.5 text-[#3b71d9]" />
                    {sec}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decluttered Role Readiness Overview */}
      {activeTab === "gaps" && analysis && (
        <div className="bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-white/[0.08] shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <CircularReadinessGauge
                readinessScore={analysis.overall_readiness_score}
                label={`${analysis.target_role}`}
                size={110}
              />
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-[#f1f0e8] font-sans">{analysis.target_role}</h3>
                <p className="text-sm font-bold text-[#3b71d9] dark:text-[#b0c6ff] mt-0.5">
                  {analysis.overall_readiness_score}% Role Ready
                </p>
                <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-1 font-sans">
                  {analysis.overall_readiness_score >= 70
                    ? "Strong match! You are interview-ready for this target role."
                    : "Bridge critical missing skills below to unlock high-confidence recruiter matching."}
                </p>
              </div>
            </div>

            <div className="flex gap-2 self-start md:self-center">
              {onNavigateToAssessment && (
                <button
                  onClick={onNavigateToAssessment}
                  className="px-3.5 py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer font-sans"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Take Assessment
                </button>
              )}
              {onNavigateToLearning && (
                <button
                  onClick={onNavigateToLearning}
                  className="px-3.5 py-2 bg-white/80 dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer font-sans backdrop-blur-md border border-slate-200/60 dark:border-white/10"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Bridge Gaps
                </button>
              )}
            </div>
          </div>

          {/* Clean 2-column breakdown: Strong Skills vs Critical Gaps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
            <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 backdrop-blur-md">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block mb-2 font-sans">
                Strong Verified Skills ({verifiedSkills.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {verifiedSkills.length > 0 ? (
                  verifiedSkills.map((s) => (
                    <span
                      key={s.skill_name}
                      className="px-2.5 py-1 rounded-xl bg-white/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 font-semibold text-xs flex items-center gap-1 backdrop-blur-xs"
                    >
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      {s.skill_name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No skills verified yet</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 backdrop-blur-md">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block mb-2 font-sans">
                Needs Improvement / Missing Gaps ({missingSkills.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.length > 0 ? (
                  missingSkills.map((s) => (
                    <span
                      key={s.skill_name}
                      className="px-2.5 py-1 rounded-xl bg-white/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 font-semibold text-xs flex items-center gap-1 backdrop-blur-xs"
                    >
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      {s.skill_name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-emerald-600 font-semibold">All required skills met!</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Skill Gap Matrix */}
      {analysis && (
        <div className="bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-slate-200/70 dark:border-white/[0.08] shadow-lg">
          <h3 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] mb-4 flex items-center gap-2 font-sans">
            <TrendingUp className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
            Detailed Skill Gap Closure Roadmap
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {analysis.gap_items.map((item, idx) => (
              <motion.div
                key={item.skill_name}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {item.status === "verified" || item.status === "assessed" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-[#f1f0e8] font-sans">{item.skill_name}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
                        {item.category}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.importance === "critical"
                            ? "bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/50 dark:border-rose-900/30"
                            : "bg-slate-100/80 dark:bg-white/[0.05] text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {item.importance}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-1 font-sans">{item.recommended_action}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                  {item.status === "missing" && (
                    <button
                      onClick={onNavigateToLearning}
                      className="px-3 py-1 bg-blue-50/80 dark:bg-[#3b71d9]/20 hover:bg-blue-100 text-[#3b71d9] dark:text-[#b0c6ff] text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1 font-sans"
                    >
                      <span>Find Courses</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                  {item.status === "verified" && (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-sans">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {Math.round(item.proficiency_score * 100)}% Proficiency
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
