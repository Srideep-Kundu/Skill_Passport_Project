import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, type EvidenceDetail } from "../api";
import { EvidenceUpload, statusLabel } from "./EvidenceUpload";

const baseEvidence: EvidenceDetail = {
  id: "evidence-id",
  evidence_type: "project",
  title: "Project",
  description: "Python",
  external_url: null,
  submitted_at: "2026-01-01T00:00:00Z",
  extracted_skills: [],
  extraction_status: "processing",
  extraction_job: { status: "processing", attempt_count: 1, max_attempts: 3, next_retry_at: null, user_message: null, provider: null },
};

describe("EvidenceUpload extraction status", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("shows retry and terminal extraction states without provider errors", () => {
    expect(statusLabel({ ...baseEvidence, extraction_status: "retry_scheduled", extraction_job: { ...baseEvidence.extraction_job!, status: "retry_scheduled", user_message: null } })).toContain("retrying (1/3)");
    expect(statusLabel({ ...baseEvidence, extraction_status: "failed", extraction_job: { ...baseEvidence.extraction_job!, status: "failed", user_message: "Extraction could not validate the submitted evidence." } })).toBe("Extraction could not validate the submitted evidence.");
    expect(statusLabel({ ...baseEvidence, extraction_status: "extracted", extraction_job: { ...baseEvidence.extraction_job!, status: "completed", provider: "local_fallback" } })).toContain("completed with local_fallback");
  });

  it("polls queued evidence and displays completed skills", async () => {
    vi.useFakeTimers();
    vi.spyOn(api, "submitEvidence").mockResolvedValue({ ...baseEvidence, extraction_status: "queued" });
    vi.spyOn(api, "evidence").mockResolvedValue({
      ...baseEvidence,
      extraction_status: "extracted",
      extracted_skills: [{ id: "skill-record", skill_id: "skill-id", canonical_name: "Python", extraction_confidence: 0.9, verification_tier: "unverified", evidence_span: "Python", source_evidence_id: "evidence-id" }],
      extraction_job: { status: "completed", attempt_count: 1, max_attempts: 3, next_retry_at: null, user_message: null, provider: "local_fallback" },
    });
    render(<EvidenceUpload token="token" onSubmitted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "API" } });
    fireEvent.change(screen.getByLabelText("Technical Details & Description"), { target: { value: "Built with Python" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and Extract Skills" }));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });

    expect(api.evidence).toHaveBeenCalledWith("evidence-id", "token");
    expect(screen.getByText(/Extracted skills:/)).toBeInTheDocument();
    expect(screen.getByText(/Python/)).toBeInTheDocument();
  });
});
