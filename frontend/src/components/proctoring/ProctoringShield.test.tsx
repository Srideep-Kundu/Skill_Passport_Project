import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PreAssessmentSystemCheck } from "./PreAssessmentSystemCheck";
import { ProctoringReportView } from "./ProctoringReportView";
import type { ProctoringReport } from "../../api/types";

describe("PreAssessmentSystemCheck Component", () => {
  it("renders assessment title, system checks, and handles cancellation", () => {
    const handleCancel = vi.fn();
    const handleProceed = vi.fn();

    render(
      <PreAssessmentSystemCheck
        assessmentTitle="Frontend Systems Diagnostic"
        durationMinutes={30}
        questionCount={5}
        onProceed={handleProceed}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByText(/Proctoring & System Readiness Check/i)).toBeInTheDocument();
    expect(screen.getByText(/Frontend Systems Diagnostic/i)).toBeInTheDocument();
    expect(screen.getByText(/Fullscreen Lock API/i)).toBeInTheDocument();
    expect(screen.getByText(/Keystroke Cadence Engine/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});

describe("ProctoringReportView Component", () => {
  const mockReport: ProctoringReport = {
    session_id: "sess-123",
    student_id: "stud-456",
    candidate_name: "Candidate One",
    assessment_title: "Full-Stack System Diagnostic",
    status: "completed",
    start_time: new Date().toISOString(),
    integrity_score: 92,
    risk_level: "low",
    total_violations: 1,
    tab_switches_count: 1,
    fullscreen_exits_count: 0,
    window_blurs_count: 0,
    face_violations_count: 0,
    audio_violations_count: 0,
    paste_attempts_count: 0,
    devtools_suspected_count: 0,
    typing_anomalies_count: 0,
    keyboard_metrics: {
      wpm: 64,
      avg_dwell_time_ms: 80,
      avg_flight_time_ms: 110,
      cadence_variance: 15,
      rhythm_consistency: 96,
      keystrokes_count: 320,
      backspace_count: 10,
      delete_count: 2,
      edit_ratio: 0.038,
      bulk_insertions_count: 0,
      paste_attempts_count: 0,
      restricted_shortcuts_count: 0,
      macro_pattern_score: 0,
      idle_duration_seconds: 5,
    },
    events: [
      {
        id: "evt-1",
        event_type: "TAB_SWITCH",
        severity: "HIGH",
        timestamp: new Date().toISOString(),
        metadata: {},
      },
    ],
    snapshots: [],
  };

  it("renders integrity score, risk level badge, and telemetry breakdown", () => {
    render(<ProctoringReportView report={mockReport} candidateName="Candidate One" />);

    expect(screen.getByText(/92%/i)).toBeInTheDocument();
    expect(screen.getByText(/low/i)).toBeInTheDocument();
    expect(screen.getByText(/64 WPM/i)).toBeInTheDocument();
    expect(screen.getByText(/80 ms/i)).toBeInTheDocument();
    expect(screen.getAllByText(/96% Natural/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/10 Backspaces/i)).toBeInTheDocument();
    expect(screen.getByText(/TAB_SWITCH/i)).toBeInTheDocument();
  });
});
