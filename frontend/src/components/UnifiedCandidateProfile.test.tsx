import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { UnifiedCandidateProfile } from "./UnifiedCandidateProfile";

describe("UnifiedCandidateProfile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders aggregated evidence support without private profile fields", async () => {
    vi.spyOn(api, "candidateProfile").mockResolvedValue({
      student_id: "student-id", active_resume: { id: "resume-id", original_filename: "resume.docx", parse_status: "completed", parsed_at: null }, github_identity_status: "claimed",
      profile_completeness: { has_active_resume: true, has_project_evidence: true, has_verified_evidence: true, has_evidence_backed_skills: true, has_github_identity: true },
      skills: [{ skill_id: "python-id", canonical_name: "Python", category: "Language", supporting_evidence_count: 2, independent_evidence_count: 1, source_types: ["manual", "resume", "project"], source_diversity: 3, highest_verification_tier: "verified", verification_summary: "verified support exists", summary_confidence: 0.8, supports: [{ evidence_id: "evidence-id", title: "API Platform", evidence_type: "project", origin: "resume", verification_tier: "verified", extraction_confidence: 0.8, effective_confidence: 0.8, evidence_span: "Python", source_types: ["resume", "project"], likely_duplicate_of: "other-evidence" }] }],
    });
    render(<UnifiedCandidateProfile token="token" refreshKey={0} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText(/80% conservative confidence/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("View supporting evidence"));
    expect(screen.getByText("API Platform")).toBeInTheDocument();
    expect(screen.queryByText(/Private Candidate/)).not.toBeInTheDocument();
  });
});
