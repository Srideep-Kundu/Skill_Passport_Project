import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { ExternalJobs } from "./ExternalJobs";

describe("ExternalJobs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders persisted provider provenance without auto-apply affordances", async () => {
    vi.spyOn(api, "externalJobs").mockResolvedValue({ page: 1, page_size: 20, total: 1, items: [{ id: "job-id", provider: "greenhouse", provider_source: "acme", external_id: "1", title: "Backend Intern", company_name: "Acme", description: "Safe plain text", location: "Remote", remote_status: "remote", employment_type: null, experience_level: null, salary_min: null, salary_max: null, salary_currency: null, apply_url: "https://boards.greenhouse.io/acme/jobs/1", source_url: "https://boards.greenhouse.io/acme/jobs/1", posted_at: null, expires_at: null, first_seen_at: "2026-01-01T00:00:00Z", last_seen_at: "2026-01-01T00:00:00Z", last_synced_at: "2026-01-02T00:00:00Z", is_active: true, requirements: [] }] });
    render(<ExternalJobs token="token" />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Backend Intern")).toBeInTheDocument();
    expect(screen.getByText("Source: greenhouse")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View source listing" })).toHaveAttribute("href", "https://boards.greenhouse.io/acme/jobs/1");
    expect(screen.queryByText(/Apply automatically/i)).not.toBeInTheDocument();
  });
});
