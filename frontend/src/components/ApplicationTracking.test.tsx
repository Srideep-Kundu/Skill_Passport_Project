import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import type { Application } from "../api";
import { ApplicationTracking } from "./ApplicationTracking";

const application: Application = {
  id: "application-id", student_id: "student-id", external_job_id: "job-id", external_job_match_id: "match-id", resume_document_id: "resume-id",
  status: "unknown_submission_state", application_fingerprint: "f".repeat(64), approved_fingerprint: "f".repeat(64), provider_capabilities: { search: true, detail_fetch: true, auto_apply: true, status_tracking: false },
  provider_schema_version: null, execution_payload_fingerprint: null, ready_payload_fingerprint: null, manual_apply_url: "https://example.test/apply", approved_at: null, approval_revoked_at: null, prepared_at: null, ready_at: null, submitted_at: null, withdrawn_at: null,
  tracking_status: "unknown", tracking_status_source: "system", tracking_updated_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", is_approval_stale: false,
  application_snapshot: { schema_version: "application-v1", job: { id: "job-id", provider: "lever", provider_source: "acme", external_id: "posting", title: "Intern", company_name: "Acme", source_url: "https://example.test/job", manual_apply_url: "https://example.test/apply", content_fingerprint: "f" }, recommendation: { match_id: "match-id", final_score: 0.7, supporting_evidence: [], missing_skills: [] }, resume: { id: "resume-id", original_filename: "resume.pdf", checksum: "f", parser_version: "v1", parsed_at: null }, application_profile: { full_name: "Student", email: "student@example.test", phone: null, github_links: [], portfolio_links: [], education: [], experience: [] }, sensitive_question_policy: "requires_direct_user_input" },
};

describe("ApplicationTracking", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders an unknown timeline and only safe reconciliation actions", async () => {
    vi.spyOn(api, "applicationTimeline").mockResolvedValue([{ id: "event-id", application_id: application.id, event_type: "submission_unknown", status: "unknown", source: "system", provider_status: null, safe_metadata: {}, created_at: "2026-01-01T00:00:00Z" }]);
    const reconcile = vi.spyOn(api, "reconcileApplication").mockResolvedValue(application);
    const withdrawn = { ...application, status: "withdrawn" as const };
    const withdraw = vi.spyOn(api, "withdrawApplication").mockResolvedValue(withdrawn);
    render(<ApplicationTracking application={application} token="token" onChanged={() => undefined} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Submission status could not be confirmed.")).toBeInTheDocument();
    expect(screen.getByText("submission unknown")).toBeInTheDocument();
    expect(screen.queryByText(/Retry submission/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Check status again" }));
    await act(async () => { await Promise.resolve(); });
    expect(reconcile).toHaveBeenCalledWith(application.id, "token");
    expect(screen.getByRole("button", { name: "Mark submitted manually" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark Withdrawn Locally" }));
    await act(async () => { await Promise.resolve(); });
    expect(withdraw).toHaveBeenCalledWith(application.id, "token");
  });
});
