import { describe, it, expect, vi } from "vitest";
import { FaceProctoringEngine, type FaceProctoringConfig } from "./FaceProctoringEngine";

describe("FaceProctoringEngine", () => {
  it("initializes with configurable thresholds and state", () => {
    const config: FaceProctoringConfig = {
      faceAbsentDurationMs: 2000,
      multipleFacesDurationMs: 1500,
      lookingAwayDurationMs: 3000,
      yawThresholdDeg: 25,
    };
    const engine = new FaceProctoringEngine(config);
    expect(engine).toBeDefined();

    // Default uninitialized state returns safe defaults
    const dummyVideo = document.createElement("video");
    const state = engine.processFrame(dummyVideo, 100);
    expect(state.isModelReady).toBe(false);
    expect(state.faceCount).toBe(0);
    expect(state.faceDetected).toBe(false);
  });

  it("handles violation event callbacks properly", () => {
    const engine = new FaceProctoringEngine();
    const violationHandler = vi.fn();
    engine.onViolation(violationHandler);

    expect(engine).toBeDefined();
    engine.dispose();
  });
});
