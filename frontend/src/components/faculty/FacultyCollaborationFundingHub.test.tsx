import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api/service";
import type { FacultyOpportunity } from "../../api/types";
import { FacultyCollaborationFundingHub } from "./FacultyCollaborationFundingHub";

const opportunity: FacultyOpportunity = {
  id: "hub-opportunity-id",
  title: "IEEE Computer Society Academic Chapter Partnership",
  opportunity_type: "society_partnership",
  organization_name: "IEEE Computer Society",
  description: "Academic chapter, invited expert talks, and student workshops.",
  domain: "Computer Science",
  stipend_or_grant: null,
  duration_weeks: 12,
  deadline: "2026-12-01T00:00:00Z",
  status: "open",
  required_expertise: ["Artificial Intelligence"],
  discovery_type: "society",
  collaboration_types: ["chapter_partnership", "expert_speaker"],
  website_url: "https://www.computer.org/",
  profile_metadata: {},
  has_applied: false,
  is_saved: false,
  recommendation_score: 0.7,
  recommendation_version: "faculty-hub-v1",
  recommendation_components: {
    faculty_expertise: 0.75,
    student_skill_gaps: 0.5,
    institution_priorities: 0.5,
  },
  why_recommended: ["Matches faculty expertise: artificial intelligence."],
};

describe("FacultyCollaborationFundingHub", () => {
  afterEach(() => vi.restoreAllMocks());

  it("discovers, filters, saves, explains, and starts proposals", async () => {
    const list = vi.spyOn(api, "getFacultyHubOpportunities").mockResolvedValue([opportunity]);
    const save = vi.spyOn(api, "saveFacultyHubOpportunity").mockResolvedValue({
      ...opportunity,
      is_saved: true,
    });
    const createProposal = vi.fn();

    render(
      <FacultyCollaborationFundingHub
        token="faculty-token"
        proposals={[]}
        onCreateProposal={createProposal}
        onOpenWorkspace={() => undefined}
      />
    );

    expect(await screen.findByText("IEEE Computer Society Academic Chapter Partnership")).toBeInTheDocument();
    expect(screen.getByText("Why recommended?")).toBeInTheDocument();
    expect(screen.getByText(/Matches faculty expertise/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Funding" }));
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        "faculty-token",
        expect.objectContaining({ discovery_type: "funding" })
      )
    );

    fireEvent.click(screen.getByRole("button", { name: `Save ${opportunity.title}` }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(opportunity.id, "faculty-token"));

    fireEvent.click(screen.getByRole("button", { name: /Create proposal/i }));
    expect(createProposal).toHaveBeenCalledWith(
      expect.objectContaining({ id: opportunity.id, is_saved: true })
    );
  });
});
