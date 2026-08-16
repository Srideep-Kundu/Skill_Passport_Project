import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { ExternalJobs } from "./ExternalJobs";

describe("ExternalJobs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders persisted recommendations and their stored explanation without auto-apply affordances", async () => {
    vi.spyOn(api, "externalJobs").mockResolvedValue({ page: 1, page_size: 20, total: 1, items: [{ id: "job-id", provider: "greenhouse", provider_source: "acme", external_id: "1", title: "Backend Intern", company_name: "Acme", description: "Safe plain text", location: "Remote", remote_status: "remote", employment_type: null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, apply_url: "https://boards.greenhouse.io/acme/jobs/1", source_url: "https://boards.greenhouse.io/acme/jobs/1", posted_at: null, expires_at: null, first_seen_at: "2026-01-01T00:00:00Z", last_seen_at: "2026-01-01T00:00:00Z", last_synced_at: "2026-01-02T00:00:00Z", is_active: true, requirements: [] }] });
    vi.spyOn(api, "externalJobMatches").mockResolvedValue({ page: 1, page_size: 20, total: 1, items: [{ id: "match-id", student_id: "student-id", external_job_id: "job-id", title: "Backend Intern", company_name: "Acme", provider: "greenhouse", external_id: "1", source_url: "https://boards.greenhouse.io/acme/jobs/1", location: "Remote", remote_status: "remote", posted_at: null, is_active: true, deterministic_score: 0.65, semantic_score: 0, verification_bonus: 0.1, final_score: 0.75, score_version: "v2", is_stale: false, explanation: { lines: [], deterministic_score: 0.65, semantic_score: 0, verification_bonus: 0.1, final_score: 0.75, score_version: "v2", items: [{ skill_id: "python", skill_name: "Python", is_required: true, status: "matched_verified", contribution: 0.75, total_contribution: 0.75, deterministic_contribution: 0.65, semantic_contribution: 0, verification_contribution: 0.1, evidence_id: "evidence-id", evidence_title: "Project API", matched_skill_id: "python", matched_skill_name: "Python", semantic_similarity: null, verification_tier: "verified" }] } }] });
    render(<ExternalJobs token="token" />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getAllByText("Backend Intern")).toHaveLength(2);
    expect(screen.getAllByText("Source: greenhouse")).toHaveLength(2);
    expect(screen.getByText("75%")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Why this match?"));
    expect(document.body.textContent).toContain("Project API");
    expect(screen.getAllByRole("link", { name: "Open original listing" })[0]).toHaveAttribute("href", "https://boards.greenhouse.io/acme/jobs/1");
    expect(screen.queryByText(/Apply automatically/i)).not.toBeInTheDocument();
  });
});
