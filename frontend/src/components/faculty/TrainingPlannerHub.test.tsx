import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "../../api/service";
import { TrainingPlannerHub } from "./TrainingPlannerHub";

describe("TrainingPlannerHub", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders deterministic skill-gap recommendations and the creation workflow", async () => {
    vi.spyOn(api, "getTrainingRecommendations").mockResolvedValue([{
      title: "Cloud Readiness Workshop",
      why_recommended: "Persisted cohort analytics show a 45 point Cloud Computing gap across 80 students.",
      target_students: "CSE cohort",
      target_skill: "Cloud Computing",
      gap_percentage: 45,
      suggested_duration_days: 3,
      estimated_participants: 80,
      recommended_trainer: "Industry domain expert",
      recommended_trainer_org: "Collaboration & Funding Hub",
      infrastructure_needed: ["Computer Lab"],
      estimated_cost: 45000,
      suggested_collaborators: ["IEEE Computer Society"],
      action_cta: "Plan training",
    }]);
    vi.spyOn(api, "getFacultyTrainings").mockResolvedValue([]);

    render(<TrainingPlannerHub token="faculty-token" onNavigateToFundingHub={vi.fn()} />);

    expect(await screen.findByText("Cloud Readiness Workshop")).toBeInTheDocument();
    expect(screen.getByText(/Persisted cohort analytics/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Launch Workshop Wizard/i })).toBeInTheDocument();
  });
});
