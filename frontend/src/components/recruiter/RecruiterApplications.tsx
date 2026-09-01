import { useState } from "react";
import {
  FileText,
  GraduationCap,
} from "lucide-react";
import { EditorialCard } from "../ui/EditorialPrimitives";

export type ApplicationStage =
  | "Applied"
  | "Screening"
  | "Shortlisted"
  | "Interview"
  | "Selected"
  | "Offer";

interface StagedApplication {
  id: string;
  candidateName: string;
  avatar: string;
  university: string;
  internshipTitle: string;
  stage: ApplicationStage;
  appliedDate: string;
  fitScore: number;
  verifiedSkills: string[];
  keyEvidence: string;
}

const DEMO_APPLICATIONS: StagedApplication[] = [
  {
    id: "app-1",
    candidateName: "Maya Rivera",
    avatar: "MR",
    university: "Harbor Polytechnic University",
    internshipTitle: "Backend & Systems Intern",
    stage: "Interview",
    appliedDate: "2026-02-28",
    fitScore: 92,
    verifiedSkills: ["Python", "FastAPI", "PostgreSQL", "pgvector", "Docker"],
    keyEvidence: "148 verified commits across 3 production repositories + 98% Algorithm score",
  },
  {
    id: "app-2",
    candidateName: "Rahul Sharma",
    avatar: "RS",
    university: "IIIT Hyderabad",
    internshipTitle: "Backend & Systems Intern",
    stage: "Shortlisted",
    appliedDate: "2026-03-01",
    fitScore: 86,
    verifiedSkills: ["Python", "PostgreSQL", "Redis"],
    keyEvidence: "Financial ledger sharding project + Concurrency benchmark score (94%)",
  },
  {
    id: "app-3",
    candidateName: "Aarav Singh",
    avatar: "AS",
    university: "NIT Trichy",
    internshipTitle: "AI & Neural Networks Engineer",
    stage: "Screening",
    appliedDate: "2026-03-01",
    fitScore: 81,
    verifiedSkills: ["PyTorch", "Transformers", "Python"],
    keyEvidence: "Vision Transformer fine-tuning + ONNX tensor runtime",
  },
  {
    id: "app-4",
    candidateName: "Priya Patel",
    avatar: "PP",
    university: "IIT Bombay",
    internshipTitle: "Full-Stack Web Engineer",
    stage: "Applied",
    appliedDate: "2026-03-02",
    fitScore: 84,
    verifiedSkills: ["React", "TypeScript", "Django"],
    keyEvidence: "Campus placement web portal + 2 npm libraries",
  },
];

const STAGES: ApplicationStage[] = [
  "Applied",
  "Screening",
  "Shortlisted",
  "Interview",
  "Selected",
  "Offer",
];

export function RecruiterApplications() {
  const [applications, setApplications] = useState<StagedApplication[]>(DEMO_APPLICATIONS);
  const [selectedStage, setSelectedStage] = useState<ApplicationStage | "all">("all");

  const moveStage = (appId: string, newStage: ApplicationStage) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === appId ? { ...app, stage: newStage } : app))
    );
  };

  const filteredApps = applications.filter((app) =>
    selectedStage === "all" ? true : app.stage === selectedStage
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Banner */}
      <EditorialCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#B08D57]/10 text-[#B08D57]">
                <FileText className="h-3.5 w-3.5" />
              </span>
              <h2
                className="text-xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Candidate Applications & Stage Pipeline
              </h2>
            </div>
            <p className="text-xs text-[#475569] max-w-2xl leading-relaxed">
              Track candidates through screening, technical interviews, and final offers with verified skill evidence visible at every decision stage.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-[#64748B]">
            <span className="font-bold text-[#111827]">{applications.length}</span> Active Applications
          </div>
        </div>
      </EditorialCard>

      {/* Stage Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E1D8] pb-3">
        <button
          type="button"
          onClick={() => setSelectedStage("all")}
          className={`px-3 py-1 rounded-full font-mono text-xs transition-colors cursor-pointer ${
            selectedStage === "all"
              ? "bg-[#111827] text-white font-bold"
              : "border border-[#E5E1D8] bg-[#FFFFFF] text-[#475569] hover:border-[#B08D57]"
          }`}
        >
          All Stages ({applications.length})
        </button>
        {STAGES.map((stg) => {
          const count = applications.filter((a) => a.stage === stg).length;
          const isSelected = selectedStage === stg;
          return (
            <button
              key={stg}
              type="button"
              onClick={() => setSelectedStage(stg)}
              className={`px-3 py-1 rounded-full font-mono text-xs transition-colors cursor-pointer ${
                isSelected
                  ? "bg-[#B08D57] text-white font-bold"
                  : "border border-[#E5E1D8] bg-[#FFFFFF] text-[#475569] hover:border-[#B08D57]"
              }`}
            >
              {stg} ({count})
            </button>
          );
        })}
      </div>

      {/* Kanban / Staged Cards Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {filteredApps.map((app) => (
          <EditorialCard key={app.id} className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  {app.avatar}
                </div>
                <div>
                  <h3
                    className="text-base font-normal text-[#111827]"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {app.candidateName}
                  </h3>
                  <p className="text-xs text-[#475569] font-medium">{app.internshipTitle}</p>
                  <div className="font-mono text-[10px] text-[#64748B] flex items-center gap-1 mt-0.5">
                    <GraduationCap className="h-3 w-3 text-[#B08D57]" />
                    <span>{app.university}</span>
                  </div>
                </div>
              </div>

              <div className="text-right font-mono shrink-0">
                <span
                  className="text-2xl font-normal text-[#111827] block leading-none"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {app.fitScore}%
                </span>
                <span className="text-[9px] uppercase text-[#166534] font-bold">
                  Match Fit
                </span>
              </div>
            </div>

            {/* Evidence Provenance Box */}
            <div className="p-3 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] block font-bold">
                Audited Evidence Provenance:
              </span>
              <p className="text-xs text-[#475569] font-sans leading-relaxed">
                {app.keyEvidence}
              </p>
            </div>

            {/* Verified Skills */}
            <div className="flex flex-wrap gap-1.5">
              {app.verifiedSkills.map((s) => (
                <span
                  key={s}
                  className="font-mono text-[10px] border border-[#E5E1D8] bg-[#FFFFFF] px-2 py-0.5 rounded-md text-[#111827]"
                >
                  ✓ {s}
                </span>
              ))}
            </div>

            {/* Stage Selector Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-[#E5E1D8]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#64748B] uppercase">Stage:</span>
                <select
                  value={app.stage}
                  onChange={(e) => moveStage(app.id, e.target.value as ApplicationStage)}
                  className="rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-2.5 py-1 font-mono text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none cursor-pointer"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <span className="font-mono text-[10px] text-[#64748B]">
                Applied {app.appliedDate}
              </span>
            </div>
          </EditorialCard>
        ))}
      </div>
    </div>
  );
}
