import { useState } from "react";
import {
  Layers,
  PlusCircle,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { EditorialCard, EditorialButton } from "../ui/EditorialPrimitives";

interface TalentPool {
  id: string;
  name: string;
  targetRole: string;
  totalDiscovered: number;
  internshipReady: number;
  trainingNeeded: number;
  emergingTalent: number;
  averageReadiness: number;
  topSkills: string[];
  topUniversities: Array<{ name: string; count: number }>;
}

const DEMO_TALENT_POOLS: TalentPool[] = [
  {
    id: "pool-ai",
    name: "AI & Machine Learning Engineering Pipeline",
    targetRole: "AI / ML Engineer",
    totalDiscovered: 480,
    internshipReady: 140,
    trainingNeeded: 65,
    emergingTalent: 275,
    averageReadiness: 88,
    topSkills: ["PyTorch", "Transformers", "Python", "Vector Embeddings", "CUDA"],
    topUniversities: [
      { name: "Harbor Polytechnic University", count: 85 },
      { name: "IIIT Hyderabad", count: 72 },
      { name: "NIT Trichy", count: 64 },
    ],
  },
  {
    id: "pool-backend",
    name: "High-Throughput Backend & Cloud Systems",
    targetRole: "Backend Distributed Systems Intern",
    totalDiscovered: 620,
    internshipReady: 210,
    trainingNeeded: 85,
    emergingTalent: 325,
    averageReadiness: 91,
    topSkills: ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis", "Kafka"],
    topUniversities: [
      { name: "Harbor Polytechnic University", count: 110 },
      { name: "IIT Bombay", count: 95 },
      { name: "Delhi Technological University", count: 80 },
    ],
  },
  {
    id: "pool-devops",
    name: "Cloud-Native Infrastructure & DevOps",
    targetRole: "Site Reliability & Cloud Intern",
    totalDiscovered: 310,
    internshipReady: 95,
    trainingNeeded: 45,
    emergingTalent: 170,
    averageReadiness: 84,
    topSkills: ["Docker", "Kubernetes", "Terraform", "CI/CD", "AWS"],
    topUniversities: [
      { name: "Harbor Polytechnic University", count: 60 },
      { name: "BITS Pilani", count: 48 },
    ],
  },
];

export function RecruiterTalentPipeline() {
  const [pools, setPools] = useState<TalentPool[]>(DEMO_TALENT_POOLS);
  const [selectedPool, setSelectedPool] = useState<TalentPool>(DEMO_TALENT_POOLS[0]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPoolName, setNewPoolName] = useState("");
  const [newTargetRole, setNewTargetRole] = useState("");

  const handleCreatePool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoolName.trim() || !newTargetRole.trim()) return;
    const newPool: TalentPool = {
      id: `pool-${Date.now()}`,
      name: newPoolName,
      targetRole: newTargetRole,
      totalDiscovered: 120,
      internshipReady: 45,
      trainingNeeded: 25,
      emergingTalent: 50,
      averageReadiness: 85,
      topSkills: ["Core Engineering", "Applied Frameworks"],
      topUniversities: [{ name: "Harbor Polytechnic University", count: 40 }],
    };
    setPools([...pools, newPool]);
    setSelectedPool(newPool);
    setNewPoolName("");
    setNewTargetRole("");
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <EditorialCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#B08D57]/10 text-[#B08D57]">
                <Layers className="h-3.5 w-3.5" />
              </span>
              <h2
                className="text-xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Proactive Talent Pipeline Builder
              </h2>
            </div>
            <p className="text-xs text-[#475569] max-w-2xl leading-relaxed">
              Transition from reactive applicant tracking to proactive talent development. Build curated candidate pools, monitor institutional talent cohorts, and pre-qualify future cohorts.
            </p>
          </div>

          <EditorialButton
            onClick={() => setShowCreateModal(true)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Talent Pool</span>
          </EditorialButton>
        </div>
      </EditorialCard>

      {/* Talent Pool Selector Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {pools.map((p) => {
          const isSelected = p.id === selectedPool.id;
          return (
            <div
              key={p.id}
              onClick={() => setSelectedPool(p)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? "border-[#B08D57] bg-[#FFFFFF] shadow-md ring-1 ring-[#B08D57]/40"
                  : "border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#B08D57]/50"
              }`}
            >
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold">
                  {p.targetRole}
                </span>
                <h3 className="text-sm font-bold text-[#111827] line-clamp-1">{p.name}</h3>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs border-t border-[#E5E1D8] pt-3">
                <div>
                  <span className="text-[10px] text-[#64748B] block">Total Discovered</span>
                  <strong className="text-base font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                    {p.totalDiscovered}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748B] block">Internship Ready</span>
                  <strong className="text-base font-normal text-[#166534]" style={{ fontFamily: "var(--font-display)" }}>
                    {p.internshipReady}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed Pipeline Breakdown */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Cohort Stages & Funnel */}
        <EditorialCard className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold">
                Cohort Readiness Funnel
              </span>
              <h3
                className="text-2xl font-normal text-[#111827] mt-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {selectedPool.name}
              </h3>
            </div>
            <div className="font-mono text-right">
              <span className="text-xs font-bold text-[#166534] bg-[#DCFCE7] px-3 py-1 rounded-full">
                {selectedPool.averageReadiness}% Avg Fit
              </span>
            </div>
          </div>

          <div className="space-y-3.5">
            {/* Stage 1: Discovered */}
            <div className="p-4 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#B08D57]" />
                <div>
                  <h4 className="text-xs font-bold text-[#111827]">Total Discovered Candidates</h4>
                  <p className="text-[11px] text-[#64748B]">Audited across participating partner universities</p>
                </div>
              </div>
              <strong className="font-mono text-lg font-bold text-[#111827]">
                {selectedPool.totalDiscovered}
              </strong>
            </div>

            {/* Stage 2: Internship Ready */}
            <div className="p-4 rounded-xl border border-[#86EFAC]/60 bg-[#DCFCE7]/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-[#166534]" />
                <div>
                  <h4 className="text-xs font-bold text-[#166534]">Internship Ready (&gt;85% Verified Fit)</h4>
                  <p className="text-[11px] text-[#166534]/80">Immediate match for active postings</p>
                </div>
              </div>
              <strong className="font-mono text-lg font-bold text-[#166534]">
                {selectedPool.internshipReady}
              </strong>
            </div>

            {/* Stage 3: Training Needed */}
            <div className="p-4 rounded-xl border border-[#FDE68A] bg-[#FEF3C7]/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-[#B45309]" />
                <div>
                  <h4 className="text-xs font-bold text-[#B45309]">Near-Ready (1-2 Gap Upskilling)</h4>
                  <p className="text-[11px] text-[#B45309]/80">Candidates ready after structured micro-modules</p>
                </div>
              </div>
              <strong className="font-mono text-lg font-bold text-[#B45309]">
                {selectedPool.trainingNeeded}
              </strong>
            </div>

            {/* Stage 4: Emerging Talent */}
            <div className="p-4 rounded-xl border border-[#E5E1D8] bg-[#FFFFFF] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-[#64748B]" />
                <div>
                  <h4 className="text-xs font-bold text-[#475569]">Emerging Talent (Junior Cohorts)</h4>
                  <p className="text-[11px] text-[#64748B]">Future pipeline building for next season hiring</p>
                </div>
              </div>
              <strong className="font-mono text-lg font-bold text-[#475569]">
                {selectedPool.emergingTalent}
              </strong>
            </div>
          </div>

          {/* Skill Distribution */}
          <div className="pt-2 border-t border-[#E5E1D8] space-y-2">
            <h4 className="font-mono text-xs font-bold text-[#111827] uppercase tracking-wider">
              Dominant Verified Taxonomies
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedPool.topSkills.map((skill) => (
                <span
                  key={skill}
                  className="font-mono text-xs border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-1 rounded-lg text-[#111827] font-semibold"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </EditorialCard>

        {/* University Talent Distribution */}
        <EditorialCard className="p-6 space-y-6">
          <div className="border-b border-[#E5E1D8] pb-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold">
              Source Analytics
            </span>
            <h3
              className="text-2xl font-normal text-[#111827] mt-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              University Talent Sources
            </h3>
            <p className="text-xs text-[#475569] mt-0.5">
              Verified institutional origin of candidates in this pool
            </p>
          </div>

          <div className="space-y-3">
            {selectedPool.topUniversities.map((uni) => (
              <div
                key={uni.name}
                className="p-3.5 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="h-4 w-4 text-[#B08D57]" />
                  <span className="font-bold text-[#111827]">{uni.name}</span>
                </div>
                <div className="font-mono text-right">
                  <strong className="text-sm text-[#111827]">{uni.count}</strong>
                  <span className="text-[10px] text-[#64748B] block">candidates</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-[#B08D57]/30 bg-[rgba(176,141,87,0.08)] flex items-center justify-between">
            <div>
              <span className="font-bold text-xs text-[#111827] block">
                Target Campus Recruitment
              </span>
              <span className="text-[11px] text-[#64748B]">
                Organize exclusive placement drive for this pool
              </span>
            </div>
            <EditorialButton variant="primary" size="sm">
              Launch Campus Drive
            </EditorialButton>
          </div>
        </EditorialCard>
      </div>

      {/* Modal for Creating New Talent Pool */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#E5E1D8] bg-[#FFFFFF] p-6 shadow-2xl space-y-4">
            <h3 className="text-xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
              Create New Talent Pipeline
            </h3>
            <form onSubmit={handleCreatePool} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="font-mono font-bold text-[#475569]">Pipeline Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Database Systems Cohort"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] p-2.5 text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono font-bold text-[#475569]">Target Role / Profile</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Backend Infrastructure Engineer"
                  value={newTargetRole}
                  onChange={(e) => setNewTargetRole(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] p-2.5 text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E1D8]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-mono text-xs text-[#64748B] hover:text-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <EditorialButton type="submit" variant="primary" size="sm">
                  Save Pipeline
                </EditorialButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
