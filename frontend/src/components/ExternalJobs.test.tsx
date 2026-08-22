import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { ExternalJobs } from "./ExternalJobs";

describe("ExternalJobs", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders live opportunity discovery feed and provider health without automated submission", async () => {
    vi.spyOn(api, "providers").mockResolvedValue([
      {
        provider: "greenhouse",
        name: "Greenhouse",
        status: "live",
        badge_label: "GREENHOUSE",
        search_supported: true,
        status_tracking_supported: false,
        active_jobs_count: 5,
        last_synced_at: "2026-01-02T00:00:00Z",
      },
      {
        provider: "yc",
        name: "YC Startup Jobs",
        status: "live",
        badge_label: "YC STARTUP",
        search_supported: true,
        status_tracking_supported: false,
        active_jobs_count: 8,
        last_synced_at: "2026-01-02T00:00:00Z",
      },
    ]);
    vi.spyOn(api, "externalJobs").mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      items: [
        {
          id: "job-id",
          provider: "greenhouse",
          provider_source: "acme",
          external_id: "1",
          title: "Backend Intern",
          company_name: "Acme Labs",
          description: "Safe plain text",
          location: "Remote",
          remote_status: "remote",
          employment_type: "internship",
          experience_level: "intern",
          salary_min: null,
          salary_max: null,
          salary_currency: null,
          apply_url: "https://boards.greenhouse.io/acme/jobs/1",
          source_url: "https://boards.greenhouse.io/acme/jobs/1",
          posted_at: "2026-01-01T00:00:00Z",
          expires_at: null,
          first_seen_at: "2026-01-01T00:00:00Z",
          last_seen_at: "2026-01-01T00:00:00Z",
          last_synced_at: "2026-01-02T00:00:00Z",
          is_active: true,
          requirements: [
            {
              id: "req-1",
              skill_id: "python",
              skill_name: "Python",
              is_required: true,
              weight: 1.0,
              confidence: 1.0,
              source_span: "Python",
            },
          ],
        },
      ],
    });
    vi.spyOn(api, "externalJobMatches").mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      items: [
        {
          id: "match-id",
          student_id: "student-id",
          external_job_id: "job-id",
          title: "Backend Intern",
          company_name: "Acme Labs",
          provider: "greenhouse",
          external_id: "1",
          source_url: "https://boards.greenhouse.io/acme/jobs/1",
          location: "Remote",
          remote_status: "remote",
          posted_at: "2026-01-01T00:00:00Z",
          is_active: true,
          deterministic_score: 0.65,
          semantic_score: 0,
          verification_bonus: 0.1,
          final_score: 0.75,
          score_version: "v2",
          is_stale: false,
          explanation: {
            lines: [],
            deterministic_score: 0.65,
            semantic_score: 0,
            verification_bonus: 0.1,
            final_score: 0.75,
            score_version: "v2",
            items: [
              {
                skill_id: "python",
                skill_name: "Python",
                is_required: true,
                status: "matched_verified",
                contribution: 0.75,
                total_contribution: 0.75,
                deterministic_contribution: 0.65,
                semantic_contribution: 0,
                verification_contribution: 0.1,
                evidence_id: "evidence-id",
                evidence_title: "Project API",
                matched_skill_id: "python",
                matched_skill_name: "Python",
                semantic_similarity: null,
                verification_tier: "verified",
              },
            ],
          },
        },
      ],
    });
    vi.spyOn(api, "createApplication").mockResolvedValue({
      id: "application-id",
      student_id: "student-id",
      external_job_id: "job-id",
      external_job_match_id: "match-id",
      resume_document_id: "resume-id",
      status: "approval_pending",
      application_fingerprint: "fingerprint",
      approved_fingerprint: null,
      provider_capabilities: { search: true, detail_fetch: true, auto_apply: false, status_tracking: false },
      manual_apply_url: "https://boards.greenhouse.io/acme/jobs/1",
      approved_at: null,
      approval_revoked_at: null,
      submitted_at: null,
      withdrawn_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      is_approval_stale: false,
      application_snapshot: {
        schema_version: "application-v1",
        job: {
          id: "job-id",
          provider: "greenhouse",
          provider_source: "acme",
          external_id: "1",
          title: "Backend Intern",
          company_name: "Acme Labs",
          source_url: "https://boards.greenhouse.io/acme/jobs/1",
          manual_apply_url: "https://boards.greenhouse.io/acme/jobs/1",
          content_fingerprint: "job-fingerprint",
        },
        recommendation: {
          match_id: "match-id",
          final_score: 0.75,
          supporting_evidence: [{ skill_name: "Python", evidence_id: "evidence-id", evidence_title: "Project API" }],
          missing_skills: [{ skill_name: "Docker", is_required: true }],
        },
        resume: { id: "resume-id", original_filename: "resume.docx", checksum: "checksum", parser_version: "v1", parsed_at: null },
        application_profile: { full_name: "Student", email: "student@example.test", phone: null, github_links: [], portfolio_links: [], education: [], experience: [] },
        sensitive_question_policy: "requires_direct_user_input",
      },
    });

    render(<ExternalJobs token="token" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Live Opportunity Discovery")).toBeInTheDocument();
    expect(screen.getByText("Backend Intern")).toBeInTheDocument();
    expect(screen.getByText("Acme Labs")).toBeInTheDocument();
    expect(screen.getByText("75% Match")).toBeInTheDocument();
    expect(screen.queryByText(/Apply automatically/i)).not.toBeInTheDocument();

    // Test match explanation modal
    fireEvent.click(screen.getByText("75% Match"));
    expect(screen.getByText("Exact")).toBeInTheDocument();
    expect(screen.getByText("Semantic")).toBeInTheDocument();
    expect(screen.getByText("Verification")).toBeInTheDocument();
    expect(document.body.textContent).toContain("Project API");
  });
});

