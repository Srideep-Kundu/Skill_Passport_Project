import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatchExplanationPanel } from "./MatchExplanationPanel";

describe("MatchExplanationPanel", () => {
  it("renders the persisted evidence and deterministic score components", () => {
    render(
      <MatchExplanationPanel
        explanation={{
          lines: ["Recommended based on persisted evidence."],
          items: [
            {
              skill_id: "python",
              skill_name: "Python",
              status: "matched_verified",
              contribution: 0.42,
              total_contribution: 0.42,
              deterministic_contribution: 0.32,
              semantic_contribution: 0,
              verification_contribution: 0.1,
              matched_skill_id: "python",
              matched_skill_name: "Python",
              semantic_similarity: null,
              evidence_id: "e1",
              evidence_title: "API project",
            },
          ],
          deterministic_score: 0.8,
          semantic_score: 0.1,
          verification_bonus: 0.08,
          final_score: 0.63,
          score_version: "v1",
        }}
      />,
    );

    expect(screen.getByLabelText("Deterministic match explanation")).toHaveTextContent("Python");
    expect(screen.getByText(/63%\s*Final Score/)).toBeInTheDocument();
  });
});
