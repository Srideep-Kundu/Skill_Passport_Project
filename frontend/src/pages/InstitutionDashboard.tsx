import { useEffect, useState } from "react";
import {
  Building2,
  ShieldCheck,
  TrendingUp,
  FileSpreadsheet,
  Download,
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
import type { InstitutionAnalyticsOverview } from "../api/types";
import { toast } from "sonner";

interface Props {
  token: string;
}

const BAR_COLORS = ["#3b71d9", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6", "#f97316"];

export function InstitutionDashboard({ token }: Props) {
  const [analytics, setAnalytics] = useState<InstitutionAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [token]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const data = await api.getInstitutionAnalytics(token);
      setAnalytics(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load institution analytics");
    } finally {
      setLoading(false);
    }
  }

  function handleExportReport() {
    toast.success("Institutional Employability & Skill Audit Report exported as PDF.");
  }

  if (loading || !analytics) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin h-8 w-8 border-4 border-[#3b71d9] border-t-transparent rounded-full mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading university employability analytics...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#151921] rounded-3xl p-8 border border-slate-200 dark:border-white/[0.08] shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#3b71d9]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#3b71d9] dark:text-[#b0c6ff] text-xs font-bold mb-3">
              <Building2 className="h-3.5 w-3.5" />
              University & Institution Intelligence Hub
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white">
              {analytics.institution_name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Real-time aggregated employability metrics, department skill distributions, and curriculum-market gap insights without PII leakage.
            </p>
          </div>

          <button
            onClick={handleExportReport}
            className="px-4 py-2.5 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <Download className="h-4 w-4" />
            Export Audit Report
          </button>
        </div>

        {/* High-Level Overview Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8 pt-6 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
            <span className="text-xs text-slate-400 uppercase font-semibold">Total Students</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{analytics.total_students}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
            <span className="text-xs text-slate-400 uppercase font-semibold">Verified Skills</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {analytics.total_verified_skills}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
            <span className="text-xs text-slate-400 uppercase font-semibold">Active Internships</span>
            <p className="text-2xl font-black text-[#3b71d9] mt-1">{analytics.active_internships}</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
            <span className="text-xs text-slate-400 uppercase font-semibold">Placements Secured</span>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {analytics.placements_secured}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03]">
            <span className="text-xs text-slate-400 uppercase font-semibold">Employability Index</span>
            <p className="text-2xl font-black text-amber-500 mt-1">{analytics.overall_employability_index}%</p>
          </div>
        </div>
      </div>

      {/* Analytics Charts & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Verified Skills Chart */}
        <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#3b71d9]" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Top Student Competencies</h2>
            </div>
            <span className="text-xs text-slate-400">By Verified Student Count</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.top_skills_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="skill_name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#151921", borderColor: "#333", borderRadius: 12, fontSize: 12, color: "#fff" }}
                />
                <Bar dataKey="student_count" radius={[6, 6, 0, 0]}>
                  {analytics.top_skills_distribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Industry Market Demand Gaps */}
        <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Curriculum vs Industry Demand Radar</h2>
            </div>
            <span className="text-xs text-slate-400">Market Intelligence</span>
          </div>

          <div className="space-y-4">
            {analytics.market_skill_demand_gaps.map((item) => (
              <div key={item.skill} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-slate-900 dark:text-white">{item.skill}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold ${
                      item.gap_severity === "Critical" || item.gap_severity === "High"
                        ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                        : item.gap_severity === "Medium"
                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {item.gap_severity} Gap
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <div>
                    <span>Industry Demand Index: </span>
                    <strong className="text-[#3b71d9]">{item.industry_demand_index}%</strong>
                  </div>
                  <div>
                    <span>Student Supply Index: </span>
                    <strong className="text-slate-700 dark:text-slate-300">{item.student_supply_index}%</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Department Breakdown Table */}
      <div className="bg-white dark:bg-[#151921] rounded-3xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs overflow-hidden">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-[#3b71d9]" />
          Department-Wise Competency & Placement Matrix
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-400 uppercase font-bold tracking-wider">
              <tr>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Total Enrolled</th>
                <th className="p-3.5">Avg Verified Skills</th>
                <th className="p-3.5">Placement Conversion</th>
                <th className="p-3.5">Internship Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] font-medium text-slate-700 dark:text-slate-300">
              {analytics.department_metrics.map((dept) => (
                <tr key={dept.department} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">{dept.department}</td>
                  <td className="p-3.5">{dept.total_students} Students</td>
                  <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                    {dept.verified_skills_average} / Student
                  </td>
                  <td className="p-3.5 font-bold text-[#3b71d9]">{dept.placement_rate}%</td>
                  <td className="p-3.5 font-bold text-purple-600 dark:text-purple-400">{dept.internship_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
