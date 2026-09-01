import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecruiterDashboard } from "./RecruiterDashboard";
import { api } from "../api";

vi.mock("../api", () => ({
  api: {
    internships: vi.fn(),
    internshipMatches: vi.fn(),
    createInternship: vi.fn(),
    updateInternship: vi.fn(),
    deleteInternship: vi.fn(),
    searchSkills: vi.fn(),
    explanation: vi.fn(),
    getRecruiterAnalytics: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    detail: string;
    constructor(detail: string) {
      super(detail);
      this.detail = detail;
    }
  },
}));

describe("RecruiterDashboard (Lumina Intel)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.internships).mockResolvedValue({
      items: [
        {
          id: "int-1",
          recruiter_id: "rec-1",
          title: "Backend Systems Intern",
          description: "Building high throughput services",
          requirements: [{ id: "req-1", skill_id: "sk-1", is_required: true, weight: 1.0 }],
          created_at: "2026-01-01",
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    });
    vi.mocked(api.getRecruiterAnalytics).mockResolvedValue({
      company_name: "Demo Labs",
      active_postings: 1,
      total_applicants: 12,
      shortlisted_candidates: 4,
      interviews_scheduled: 2,
      offers_extended: 1,
      offers_accepted: 1,
      top_demanded_skills: [
        {
          skill_name: "Python",
          required_in_postings_count: 1,
          applicant_pool_count: 10,
          supply_demand_ratio: 10.0,
          market_status: "abundant_supply",
        },
      ],
      most_common_applicant_gaps: [],
      recruitment_funnel: [],
    });
  });

  it("renders the Overview tab with key metrics and quick navigation cards", async () => {
    render(<RecruiterDashboard token="test-token" activeTab="overview" />);
    await waitFor(() => {
      expect(screen.getByText("Candidates Analyzed")).toBeInTheDocument();
      expect(screen.getByText("Evidence Verified")).toBeInTheDocument();
      expect(screen.getByText("Average Skill Match")).toBeInTheDocument();
      expect(screen.getByText("Internship-Ready")).toBeInTheDocument();
    });
  });

  it("renders the Evidence Graph tab with candidate skills and provenance tree", async () => {
    render(<RecruiterDashboard token="test-token" activeTab="evidence_graph" />);
    await waitFor(() => {
      expect(screen.getByText("Evidence Graph & Provenance Explorer")).toBeInTheDocument();
      expect(screen.getAllByText("Maya Rivera")[0]).toBeInTheDocument();
      expect(screen.getAllByText("Python")[0]).toBeInTheDocument();
    });
  });

  it("renders the Explainable Matches tab with match reasoning and breakdown", async () => {
    render(<RecruiterDashboard token="test-token" activeTab="matches" />);
    await waitFor(() => {
      expect(screen.getByText("Explainable Candidate Matching Engine")).toBeInTheDocument();
      expect(screen.getByText("WHY THIS CANDIDATE RANKED HIGH")).toBeInTheDocument();
    });
  });

  it("renders the Candidate Comparison tab with evaluation matrix", async () => {
    render(<RecruiterDashboard token="test-token" activeTab="comparison" />);
    await waitFor(() => {
      expect(screen.getByText("Multi-Candidate Evidence Comparison")).toBeInTheDocument();
      expect(screen.getByText("Overall Match Score")).toBeInTheDocument();
      expect(screen.getByText("Evidence Provenance")).toBeInTheDocument();
    });
  });

  it("renders the Skill Intelligence tab with readiness scores and growth paths", async () => {
    render(<RecruiterDashboard token="test-token" activeTab="skills" />);
    await waitFor(() => {
      expect(screen.getByText("Skill Gap & High-Potential Intelligence")).toBeInTheDocument();
      expect(screen.getByText("Actionable Growth Path")).toBeInTheDocument();
    });
  });

  it("renders the Talent Pipeline tab with cohort readiness funnels", async () => {
    render(<RecruiterDashboard token="test-token" activeTab="pipeline" />);
    await waitFor(() => {
      expect(screen.getByText("Proactive Talent Pipeline Builder")).toBeInTheDocument();
      expect(screen.getByText("Total Discovered Candidates")).toBeInTheDocument();
    });
  });

  it("renders the Applications tab with stage filters", async () => {
    render(<RecruiterDashboard token="test-token" activeTab="applications" />);
    await waitFor(() => {
      expect(screen.getByText("Candidate Applications & Stage Pipeline")).toBeInTheDocument();
    });
  });

  it("renders the Analytics tab with demand velocity metrics", async () => {
    render(<RecruiterDashboard token="test-token" activeTab="analytics" />);
    await waitFor(() => {
      expect(screen.getByText("Talent Intelligence Analytics & Insights")).toBeInTheDocument();
      expect(screen.getByText("Skill Demand & Supply Velocity")).toBeInTheDocument();
    });
  });
});
