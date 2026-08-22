import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { ResumeIntelligence } from "./ResumeIntelligence";

const resume = { id: "resume-id", original_filename: "resume.docx", mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size_bytes: 100, checksum: "a".repeat(64), parse_status: "uploaded" as const, parser_version: "v1-deterministic", uploaded_at: "2026-01-01T00:00:00Z", parsed_at: null, is_active: true, safe_error_message: null, parsed_summary: null, generated_evidence_count: 0, skills_status: "not_started" as const };

describe("ResumeIntelligence", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uploads a PDF/DOCX resume and exposes parse progress", async () => {
    vi.spyOn(api, "resumes").mockResolvedValue({ page: 1, page_size: 20, total: 1, items: [resume] });
    vi.spyOn(api, "uploadResume").mockResolvedValue(resume);
    vi.spyOn(api, "parseResume").mockResolvedValue(resume);
    vi.spyOn(api, "activateResume").mockResolvedValue(resume);
    render(<ResumeIntelligence token="token" onChanged={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    const file = new File(["resume"], "resume.docx", { type: resume.mime_type });
    fireEvent.change(screen.getByLabelText("Resume file"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));
    await act(async () => { await Promise.resolve(); });
    expect(api.uploadResume).toHaveBeenCalledWith(file, "token");
    expect(screen.getByText(/Resume Parsed: uploaded/)).toBeInTheDocument();
  });
});
