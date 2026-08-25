import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { InternshipMatches } from "./InternshipMatches";

describe("InternshipMatches", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders ranked internship recommendations with deterministic explanations and filters", async () => {
    vi.spyOn(api, "externalJobMatches").mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      items: [
        {
          id: "match-1",
          student_id: "student-1",
          external_job_id: "job-1",
          title: "Fullstack Platform Intern",
          company_name: "YC Startup Labs",
          provider: "yc",
          external_id: "yc-101",
          source_url: "https://news.ycombinator.com/item?id=101",
          location: "Remote, India",
          remote_status: "remote",
          posted_at: "2026-01-01T00:00:00Z",
          is_active: true,
          deterministic_score: 0.7,
          semantic_score: 0.1,
          verification_bonus: 0.08,
          final_score: 0.88,
          score_version: "v2",
          is_stale: false,
          explanation: {
            lines: [],
            deterministic_score: 0.7,
            semantic_score: 0.1,
            verification_bonus: 0.08,
            final_score: 0.88,
            score_version: "v2",
            items: [
              {
                skill_id: "py",
                skill_name: "Python",
                is_required: true,
                status: "matched_verified",
                contribution: 0.45,
                total_contribution: 0.45,
                deterministic_contribution: 0.4,
                semantic_contribution: 0,
                verification_contribution: 0.05,
                evidence_id: "ev-1",
                evidence_title: "FastAPI Backend Project",
                matched_skill_id: "py",
                matched_skill_name: "Python",
                semantic_similarity: null,
                verification_tier: "verified",
              },
              {
                skill_id: "k8s",
                skill_name: "Kubernetes",
                is_required: true,
                status: "missing",
                contribution: 0,
                total_contribution: 0,
                deterministic_contribution: 0,
                semantic_contribution: 0,
                verification_contribution: 0,
                evidence_id: null,
                evidence_title: null,
                matched_skill_id: null,
                matched_skill_name: null,
                semantic_similarity: null,
                verification_tier: null,
              },
            ],
          },
        },
      ],
    });

    render(<InternshipMatches token="token" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Ranked Internship Opportunities")).toBeInTheDocument();
    expect(screen.getByText("Fullstack Platform Intern")).toBeInTheDocument();
    expect(screen.getByText("YC Startup Labs")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getByText("YC STARTUP")).toBeInTheDocument();
    expect(screen.getByText("Strong Evidence")).toBeInTheDocument();

    // Verify "Why this match?" modal
    fireEvent.click(screen.getByText("Why this match?"));
    expect(screen.getByText("Deterministic Explainability Breakdown")).toBeInTheDocument();
    expect(screen.getByText(/Why You Match: Fullstack Platform Intern/)).toBeInTheDocument();
    expect(screen.getByText("Exact Skills")).toBeInTheDocument();
    expect(document.body.textContent).toContain("FastAPI Backend Project");
  });

  it("syncs configured providers before refreshing ranked matches", async () => {
    vi.spyOn(api, "externalJobMatches").mockResolvedValue({ page: 1, page_size: 20, total: 0, items: [] });
    const sync = vi.spyOn(api, "syncAllExternalJobs").mockResolvedValue({
      total_created: 0,
      total_updated: 0,
      total_synced: 0,
      providers: {},
      synced_at: "2026-01-01T00:00:00Z",
    });

    render(<InternshipMatches token="token" />);
    const refresh = await screen.findByRole("button", { name: "Discover & Refresh" });
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(refresh);

    await waitFor(() => expect(sync).toHaveBeenCalledWith("token"));
  });
});
