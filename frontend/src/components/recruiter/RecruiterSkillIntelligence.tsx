import { useState } from "react";
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { EditorialCard, EditorialButton } from "../ui/EditorialPrimitives";

interface SkillGapCandidate {
  id: string;
  name: string;
  avatar: string;
  university: string;
  targetRole: string;
  readinessScore: number;
  currentSkills: Array<{ name: string; level: string; verified: boolean }>;
  missingSkills: Array<{ name: string; priority: "high" | "medium"; rationale: string }>;
  suggestedGrowthPath: Array<{ step: number; title: string; provider: string; duration: string }>;
  conversionPotential: "High" | "Immediate Hire" | "Mentorship Candidate";
}

const DEMO_SKILL_INTELLIGENCE_DATA: SkillGapCandidate[] = [
  {
    id: "cand-aarav",
    name: "Aarav Singh",
    avatar: "AS",
    university: "National Institute of Technology",
    targetRole: "AI Systems & MLOps Engineer",
    readinessScore: 90,
    currentSkills: [
      { name: "PyTorch & Transformers", level: "Advanced", verified: true },
      { name: "Python & Vector Math", level: "Advanced", verified: true },
      { name: "ONNX Runtime Acceleration", level: "Intermediate", verified: true },
      { name: "Model Quantization", level: "Intermediate", verified: false },
    ],
    missingSkills: [
      {
        name: "MLOps / Pipeline Automation",
        priority: "high",
        rationale: "Required for production deployment and automated model retraining",
      },
      {
        name: "Cloud Deployment (AWS SageMaker / GCP Vertex)",
        priority: "high",
        rationale: "Required for distributed endpoint inference serving",
      },
    ],
    suggestedGrowthPath: [
      {
        step: 1,
        title: "AWS Certified Machine Learning Specialist Lab",
        provider: "AWS Skill Builder",
        duration: "2 weeks",
      },
      {
        step: 2,
        title: "Deploy Vision Transformer on SageMaker Inference Endpoint",
        provider: "Open Source Project Sandbox",
        duration: "1 week",
      },
      {
        step: 3,
        title: "Setup MLflow Model Registry & CI/CD GitHub Action",
        provider: "Lumina Labs Accelerator",
        duration: "3 days",
      },
    ],
    conversionPotential: "Immediate Hire",
  },
  {
    id: "cand-maya",
    name: "Maya Rivera",
    avatar: "MR",
    university: "Harbor Polytechnic University",
    targetRole: "Senior Backend Distributed Systems Intern",
    readinessScore: 94,
    currentSkills: [
      { name: "Python & AsyncIO", level: "Expert", verified: true },
      { name: "FastAPI REST Gateway", level: "Advanced", verified: true },
      { name: "PostgreSQL & pgvector", level: "Advanced", verified: true },
      { name: "Docker Containerization", level: "Intermediate", verified: true },
    ],
    missingSkills: [
      {
        name: "Kubernetes Cluster Management",
        priority: "medium",
        rationale: "Desirable for multi-service autoscaling and Helm deployments",
      },
      {
        name: "OpenTelemetry Observability",
        priority: "medium",
        rationale: "Desirable for distributed tracing across microservices",
      },
    ],
    suggestedGrowthPath: [
      {
        step: 1,
        title: "CKAD Kubernetes Application Developer Hands-on Lab",
        provider: "CNCF Education",
        duration: "2 weeks",
      },
      {
        step: 2,
        title: "Implement Distributed Jaeger & Prometheus Tracing",
        provider: "Faculty Capstone Lab",
        duration: "1 week",
      },
    ],
    conversionPotential: "Immediate Hire",
  },
  {
    id: "cand-rahul",
    name: "Rahul Sharma",
    avatar: "RS",
    university: "IIIT Hyderabad",
    targetRole: "High-Throughput Financial Systems Engineer",
    readinessScore: 88,
    currentSkills: [
      { name: "Python Concurrency", level: "Advanced", verified: true },
      { name: "PostgreSQL Schema Design", level: "Advanced", verified: true },
      { name: "Redis Distributed Locks", level: "Intermediate", verified: true },
    ],
    missingSkills: [
      {
        name: "Kafka Event Streaming",
        priority: "high",
        rationale: "Critical for fault-tolerant transactional message brokers",
      },
      {
        name: "Terraform Infrastructure as Code",
        priority: "medium",
        rationale: "Needed for reproducible cloud cluster provisioning",
      },
    ],
    suggestedGrowthPath: [
      {
        step: 1,
        title: "Apache Kafka Event-Driven Architecture Masterclass",
        provider: "Confluent Developer",
        duration: "10 days",
      },
      {
        step: 2,
        title: "Build Zero-Loss Transaction Message Queue",
        provider: "Systems Engineering Guild",
        duration: "1 week",
      },
    ],
    conversionPotential: "Mentorship Candidate",
  },
];

export function RecruiterSkillIntelligence() {
  const [candidates] = useState<SkillGapCandidate[]>(DEMO_SKILL_INTELLIGENCE_DATA);
  const [selectedCandidate, setSelectedCandidate] = useState<SkillGapCandidate>(DEMO_SKILL_INTELLIGENCE_DATA[0]);

  return (
    <div className="space-y-6 font-sans">
      {/* Banner */}
      <EditorialCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#B08D57]/10 text-[#B08D57]">
                <TrendingUp className="h-3.5 w-3.5" />
              </span>
              <h2
                className="text-xl font-normal text-[#111827]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Skill Gap & High-Potential Intelligence
              </h2>
            </div>
            <p className="text-xs text-[#475569] max-w-2xl leading-relaxed">
              Identify candidates on the cusp of role mastery. Understand missing competencies, evaluate readiness scores, and sponsor direct guided upskilling pathways for rapid internship conversion.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#166534] bg-[#DCFCE7] px-3.5 py-1.5 rounded-full font-bold">
              3 High-Potential Candidates Identified
            </span>
          </div>
        </div>
      </EditorialCard>

      {/* Candidate Selection Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {candidates.map((c) => {
          const isSelected = c.id === selectedCandidate.id;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedCandidate(c)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? "border-[#B08D57] bg-[#FFFFFF] shadow-md ring-1 ring-[#B08D57]/40"
                  : "border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#B08D57]/50"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#111827] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                    {c.avatar}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111827]">{c.name}</h3>
                    <p className="text-[11px] text-[#64748B] truncate max-w-[130px]">
                      {c.targetRole}
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xl font-bold text-[#166534]">
                    {c.readinessScore}%
                  </div>
                  <span className="text-[9px] uppercase text-[#64748B]">Readiness</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between font-mono text-[10px] border-t border-[#E5E1D8] pt-2">
                <span className="text-[#64748B]">{c.missingSkills.length} skill gaps</span>
                <span className="text-[#B08D57] font-semibold">{c.conversionPotential}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Deep-Dive Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        {/* Current Skills & Gaps */}
        <EditorialCard className="p-6 space-y-6">
          <div className="border-b border-[#E5E1D8] pb-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold">
              Competency Evaluation
            </span>
            <h3
              className="text-2xl font-normal text-[#111827] mt-1"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {selectedCandidate.name}
            </h3>
            <p className="text-xs text-[#475569] mt-0.5">
              Targeting: <strong className="text-[#111827]">{selectedCandidate.targetRole}</strong>
            </p>
          </div>

          {/* Current Possessed Skills */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-[#166534]" />
              <span>Current Verified Skills ({selectedCandidate.currentSkills.length})</span>
            </h4>
            <div className="space-y-2">
              {selectedCandidate.currentSkills.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0] text-xs"
                >
                  <div className="flex items-center gap-2 font-bold text-[#111827]">
                    <span>✓</span>
                    <span>{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="text-[#475569]">{s.level}</span>
                    {s.verified && (
                      <span className="bg-[#DCFCE7] text-[#166534] font-bold px-2 py-0.5 rounded-sm">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Missing Skills Callout */}
          <div className="space-y-3 pt-2 border-t border-[#E5E1D8]">
            <h4 className="font-mono text-xs font-bold text-[#111827] uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-[#B08D57]" />
              <span>Missing Skill Gaps ({selectedCandidate.missingSkills.length})</span>
            </h4>
            <div className="space-y-2">
              {selectedCandidate.missingSkills.map((gap) => (
                <div
                  key={gap.name}
                  className="p-3 rounded-xl border border-[#E5E1D8] bg-[#FFFFFF] space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#111827]">{gap.name}</span>
                    <span className="font-mono text-[9px] uppercase text-[#B4534B] bg-[#FEE2E2] px-2 py-0.5 rounded-sm font-semibold">
                      {gap.priority} Priority
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">{gap.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        </EditorialCard>

        {/* Guided Growth & Upskilling Path */}
        <EditorialCard className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#B08D57] font-semibold">
                Actionable Growth Path
              </span>
              <h3
                className="text-xl font-normal text-[#111827] mt-0.5"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Upskilling to 100% Role Readiness
              </h3>
            </div>
            <div className="font-mono text-right">
              <span className="text-xs font-bold text-[#166534] bg-[#DCFCE7] px-3 py-1 rounded-full">
                Est. Time: ~3.5 Weeks
              </span>
            </div>
          </div>

          <p className="text-xs text-[#475569] leading-relaxed">
            By sponsoring or recommending this structured path, recruiters can bridge this candidate's missing competencies before internship onboarding:
          </p>

          <div className="space-y-4">
            {selectedCandidate.suggestedGrowthPath.map((step) => (
              <div
                key={step.step}
                className="flex items-start gap-3.5 p-4 rounded-xl border border-[#E5E1D8] bg-[#F7F5F0]"
              >
                <div className="h-7 w-7 rounded-full bg-[#B08D57] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5">
                  {step.step}
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-xs font-bold text-[#111827]">{step.title}</h4>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-[#64748B]">
                    <span>Provider: <strong className="text-[#475569]">{step.provider}</strong></span>
                    <span>·</span>
                    <span>Duration: <strong className="text-[#475569]">{step.duration}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-[#B08D57]/30 bg-[rgba(176,141,87,0.08)] flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-[#111827] block">
                Pre-Hire Skill Sponsorship
              </span>
              <span className="text-[11px] text-[#64748B] font-sans">
                Send growth roadmap directly to candidate with 1-click invitation
              </span>
            </div>
            <EditorialButton variant="primary" size="sm">
              Sponsor Candidate
            </EditorialButton>
          </div>
        </EditorialCard>
      </div>
    </div>
  );
}
