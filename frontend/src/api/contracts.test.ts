import { describe, expect, it } from "vitest";

import type {
  EvidenceDetail,
  EvidenceSummary,
  ExtractedSkill,
  Internship,
  MatchExplanation,
} from "./types";

describe("backend response contracts", () => {
  it("models the current FastAPI response shapes without invented fields", () => {
    const skill = {
      id: "student-skill-id",
      skill_id: "skill-id",
      canonical_name: "Python",
      extraction_confidence: 0.8,
      verification_tier: "unverified",
      source_evidence_id: "evidence-id",
      evidence_span: "Python",
    } satisfies ExtractedSkill;
    const evidence = {
      id: "evidence-id",
      evidence_type: "project",
      title: "API project",
      description: "Built a Python API.",
      external_url: null,
      extraction_status: "extracted",
      submitted_at: "2026-01-01T00:00:00Z",
    } satisfies EvidenceSummary;
    const detail = { ...evidence, extracted_skills: [skill] } satisfies EvidenceDetail;
    const internship = {
      id: "internship-id",
      recruiter_id: "recruiter-id",
      title: "Backend intern",
      description: "Build APIs.",
      created_at: "2026-01-01T00:00:00Z",
    } satisfies Internship;
    const explanation = {
      lines: ["Recommended based on persisted records."],
      items: [{ skill_id: "skill-id", skill_name: "Python", status: "matched_unverified", contribution: 0.2, evidence_id: null, evidence_title: null }],
      deterministic_score: 0.3,
      semantic_score: 0,
      verification_bonus: 0.05,
      final_score: 0.245,
      score_version: "v1",
    } satisfies MatchExplanation;

    expect(detail.extracted_skills[0].canonical_name).toBe("Python");
    expect(internship.recruiter_id).toBe("recruiter-id");
    expect(explanation.items[0].evidence_title).toBeNull();
  });
});
