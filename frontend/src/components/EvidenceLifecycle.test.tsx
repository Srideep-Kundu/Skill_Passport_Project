import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../api";
import { EvidenceLifecycle } from "./EvidenceLifecycle";

describe("EvidenceLifecycle", () => {
  afterEach(() => vi.restoreAllMocks());

  it("edits evidence and makes the reprocessing state visible", async () => {
    vi.spyOn(api, "evidences").mockResolvedValue({
      page: 1, page_size: 20, total: 1,
      items: [{ id: "evidence-id", evidence_type: "project", title: "Old API", description: "Python", external_url: null, extraction_status: "extracted", submitted_at: "2026-01-01T00:00:00Z" }],
    });
    vi.spyOn(api, "updateEvidence").mockResolvedValue({
      id: "evidence-id", evidence_type: "project", title: "New API", description: "Changed Python", external_url: null,
      extraction_status: "queued", submitted_at: "2026-01-01T00:00:00Z", extracted_skills: [], extraction_job: null,
    });
    render(<EvidenceLifecycle token="token" refreshKey={0} onChanged={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit evidence title"), { target: { value: "New API" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and reprocess" }));
    await act(async () => { await Promise.resolve(); });

    expect(api.updateEvidence).toHaveBeenCalledWith("evidence-id", { title: "New API", description: "Python" }, "token");
    expect(screen.getByRole("status")).toHaveTextContent("Extraction is queued");
  });
});
