import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LuminaIntelCopilot } from "./SkillPassportCopilot";
import { api } from "../api/service";

vi.mock("../api/service", () => ({
  api: {
    queryCopilot: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("LuminaIntelCopilot Floating Launcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders floating icon-only launcher without visible text label initially", () => {
    render(<LuminaIntelCopilot token="test-token" onNavigate={vi.fn()} />);

    const launcher = screen.getByRole("button", { name: /open lumina intel copilot/i });
    expect(launcher).toBeInTheDocument();

    // Verify it is icon-only and contains NO text content
    expect(launcher.textContent?.trim()).toBe("");

    // Dialog content should not be open initially
    expect(screen.queryByText("Platform Copilot")).not.toBeInTheDocument();
  });

  it("opens copilot dialog when the floating launcher icon is clicked", async () => {
    const user = userEvent.setup();
    render(<LuminaIntelCopilot token="test-token" onNavigate={vi.fn()} />);

    const launcher = screen.getByRole("button", { name: /open lumina intel copilot/i });
    await user.click(launcher);

    expect(screen.getByText("Platform Copilot")).toBeInTheDocument();
    expect(
      screen.getByText(/Hello! I am your Lumina Intel Copilot/i)
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask Copilot about skills, readiness, jobs...")).toBeInTheDocument();

    // Floating launcher button is hidden when dialog is open
    expect(screen.queryByRole("button", { name: /open lumina intel copilot/i })).not.toBeInTheDocument();
  });

  it("closes dialog and restores floating launcher when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<LuminaIntelCopilot token="test-token" onNavigate={vi.fn()} />);

    // Open dialog
    await user.click(screen.getByRole("button", { name: /open lumina intel copilot/i }));
    expect(screen.getByText("Platform Copilot")).toBeInTheDocument();

    // Close dialog
    const closeBtn = screen.getByRole("button", { name: /close copilot/i });
    await user.click(closeBtn);

    // Dialog is closed and launcher is back (waiting for exit transition)
    await waitFor(() => {
      expect(screen.queryByText("Platform Copilot")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /open lumina intel copilot/i })).toBeInTheDocument();
  });

  it("closes dialog and restores floating launcher when Escape key is pressed", async () => {
    const user = userEvent.setup();
    render(<LuminaIntelCopilot token="test-token" onNavigate={vi.fn()} />);

    // Open dialog
    await user.click(screen.getByRole("button", { name: /open lumina intel copilot/i }));
    expect(screen.getByText("Platform Copilot")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });

    // Dialog is closed (waiting for exit transition)
    await waitFor(() => {
      expect(screen.queryByText("Platform Copilot")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /open lumina intel copilot/i })).toBeInTheDocument();
  });

  it("queries copilot API when user submits query", async () => {
    const user = userEvent.setup();
    vi.mocked(api.queryCopilot).mockResolvedValueOnce({
      message: "You have verified skills in Python and FastAPI.",
      sources: ["GitHub Audit #1402", "FastAPI Assessment"],
      actions: [{ label: "View Passport", target_tab: "passport", action_type: "navigate" }],
      grounding_data: { score: 95 },
    });

    render(<LuminaIntelCopilot token="test-token" onNavigate={vi.fn()} />);

    // Open dialog
    await user.click(screen.getByRole("button", { name: /open lumina intel copilot/i }));

    const input = screen.getByPlaceholderText("Ask Copilot about skills, readiness, jobs...");
    await user.type(input, "What are my verified skills?");

    // Submit form
    const submitBtn = input.closest("form")!.querySelector('button[type="submit"]')!;
    await user.click(submitBtn);

    expect(api.queryCopilot).toHaveBeenCalledWith("What are my verified skills?", "test-token");

    await waitFor(() => {
      expect(
        screen.getByText("You have verified skills in Python and FastAPI.")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("GitHub Audit #1402")).toBeInTheDocument();
  });

  it("triggers onNavigate when an action pill is clicked", async () => {
    const user = userEvent.setup();
    const handleNavigate = vi.fn();

    render(<LuminaIntelCopilot token="test-token" onNavigate={handleNavigate} />);

    // Open dialog
    await user.click(screen.getByRole("button", { name: /open lumina intel copilot/i }));

    // Click "Analyze Skill Gaps" action
    const gapBtn = screen.getByRole("button", { name: /Analyze Skill Gaps/i });
    await user.click(gapBtn);

    expect(handleNavigate).toHaveBeenCalledWith("gaps");
  });
});
