import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { GitHubVerification } from "./GitHubVerification";

describe("GitHubVerification", () => {
  afterEach(() => vi.restoreAllMocks());

  it("distinguishes a claimed identity and renders persisted verification checks", async () => {
    vi.spyOn(api, "githubIdentity").mockResolvedValue({ github_username: "candidate", association_status: "claimed", identity_authenticated: false });
    vi.spyOn(api, "verifyEvidence").mockResolvedValue({
      result: "verified",
      verification_tier: "verified",
      details: { transient_failure: false, check_count: 2 },
      checks: [
        { check_type: "repository_accessible", result: "pass", details: { repository: "candidate/project" }, checked_at: "2026-01-01T00:00:00Z" },
        { check_type: "commit_author_match", result: "pass", details: { candidate_commit_count: 3 }, checked_at: "2026-01-01T00:00:00Z" },
      ],
    });
    render(<GitHubVerification token="token" onVerified={vi.fn()} evidence={[{ id: "evidence-id", evidence_type: "project", title: "API", description: "Python", external_url: "https://github.com/candidate/project", extraction_status: "extracted", submitted_at: "2026-01-01T00:00:00Z" }]} />);

    expect(await screen.findByText("Claimed GitHub account: @candidate. This is not OAuth-authenticated.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verify project" }));
    expect(await screen.findByText("Overall: verified")).toBeInTheDocument();
    expect(screen.getByText(/3 candidate-attributed commits/)).toBeInTheDocument();
  });
});
