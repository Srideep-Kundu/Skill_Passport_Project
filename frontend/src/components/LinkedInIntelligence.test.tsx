import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { LinkedInIntelligence } from "./LinkedInIntelligence";

const mockImport = {
  id: "linkedin-id",
  original_filename: "export.zip",
  mime_type: "application/zip",
  size_bytes: 5000,
  checksum: "b".repeat(64),
  parse_status: "uploaded" as const,
  parser_version: "2026.1",
  uploaded_at: "2026-01-01T00:00:00Z",
  parsed_at: null,
  is_active: true,
  safe_error_message: null,
  parsed_summary: {
    counts: {
      positions: 2,
      projects: 1,
      certifications: 1,
      skills: 5,
      education: 1,
      publications: 0,
      courses: 0,
      languages: 0,
    },
    discovered_skills: ["Python", "FastAPI", "PostgreSQL"],
    categories_present: ["positions", "projects", "skills"],
    total_records: 9,
  },
  generated_evidence_count: 4,
  skills_status: "not_started" as const,
};

describe("LinkedInIntelligence", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uploads a LinkedIn zip export and exposes workflow progress and counts", async () => {
    vi.spyOn(api, "linkedinImports").mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      items: [mockImport],
    });
    vi.spyOn(api, "uploadLinkedInExport").mockResolvedValue(mockImport);

    render(<LinkedInIntelligence token="token" onChanged={vi.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });

    const file = new File(["fake zip content"], "export.zip", { type: "application/zip" });
    fireEvent.change(screen.getByLabelText("LinkedIn export zip archive"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload LinkedIn archive" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(api.uploadLinkedInExport).toHaveBeenCalledWith(file, "token");
    expect(screen.getByText("export.zip")).toBeInTheDocument();
    expect(screen.getByText("Active LinkedIn Import")).toBeInTheDocument();
    expect(screen.getByText("Positions")).toBeInTheDocument();
  });
});
