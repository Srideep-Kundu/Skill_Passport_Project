/**
 * GazeTemporalFilter
 * 
 * Applies exponential smoothing and multi-second temporal thresholding to gaze estimates.
 * Prevents transient eye saccades or brief glances from triggering false violations.
 * Requires sustained off-screen deviation (default >= 3000ms) before emitting LOOKING_AWAY events.
 */

import type { EstimatedGazeResult, GazeState } from "./GazeEstimator";
import type { BlinkDetectorMetrics } from "./BlinkDetector";

export interface GazeViolationPayload {
  type: "LOOKING_AWAY" | "PROLONGED_EYE_CLOSURE" | "GAZE_DEVIATION";
  direction: GazeState | "PROLONGED_CLOSURE";
  durationMs: number;
  confidence: number;
  metadata: Record<string, any>;
}

export interface GazeFilterConfig {
  lookAwayThresholdMs?: number; // default 3000ms
  closureThresholdMs?: number;  // default 3500ms
  cooldownMs?: number;          // default 5000ms
  smoothingFactor?: number;     // default 0.35
}

export class GazeTemporalFilter {
  private config: Required<GazeFilterConfig>;

  // Smoothed gaze coordinates
  private smoothedX: number = 0;
  private smoothedY: number = 0;

  // Temporal state tracking
  private lookAwayStartTime: number | null = null;
  private currentDeviationDirection: GazeState = "CENTER";
  private lastViolationTime: number = 0;
  private lastClosureViolationTime: number = 0;

  // Callback
  private onViolationCallback: ((payload: GazeViolationPayload) => void) | null = null;

  constructor(config?: GazeFilterConfig) {
    this.config = {
      lookAwayThresholdMs: config?.lookAwayThresholdMs ?? 3000,
      closureThresholdMs: config?.closureThresholdMs ?? 3500,
      cooldownMs: config?.cooldownMs ?? 5000,
      smoothingFactor: config?.smoothingFactor ?? 0.35,
    };
  }

  public onViolation(callback: (payload: GazeViolationPayload) => void): void {
    this.onViolationCallback = callback;
  }

  /**
   * Processes instantaneous gaze and blink measurements with temporal debouncing.
   */
  public update(
    gazeResult: EstimatedGazeResult,
    blinkMetrics: BlinkDetectorMetrics,
    now: number = performance.now()
  ): {
    smoothedVector: { x: number; y: number };
    sustainedLookAwayDurationMs: number;
    isSustainedViolation: boolean;
  } {
    // 1. Exponential Moving Average Smoothing
    const alpha = this.config.smoothingFactor;
    this.smoothedX = alpha * gazeResult.gazeVector.x + (1 - alpha) * this.smoothedX;
    this.smoothedY = alpha * gazeResult.gazeVector.y + (1 - alpha) * this.smoothedY;

    // 2. Prolonged Eye Closure Check
    if (blinkMetrics.isProlongedClosure) {
      if (
        blinkMetrics.currentClosureDurationMs >= this.config.closureThresholdMs &&
        now - this.lastClosureViolationTime >= this.config.cooldownMs
      ) {
        this.lastClosureViolationTime = now;
        this.emitViolation({
          type: "PROLONGED_EYE_CLOSURE",
          direction: "PROLONGED_CLOSURE",
          durationMs: blinkMetrics.currentClosureDurationMs,
          confidence: 0.90,
          metadata: {
            reason: `Eyes remained closed for ${(blinkMetrics.currentClosureDurationMs / 1000).toFixed(1)}s`,
            ear: blinkMetrics.ear,
            action: "WARNING_PROLONGED_CLOSURE",
          },
        });
      }
    }

    // 3. Sustained Looking Away Check
    let sustainedDuration = 0;
    const isLookingAway = gazeResult.isLookingAway || gazeResult.gazeState === "AWAY" || gazeResult.gazeState === "LEFT" || gazeResult.gazeState === "RIGHT";

    if (isLookingAway && gazeResult.gazeState !== "UNKNOWN") {
      if (this.lookAwayStartTime === null) {
        this.lookAwayStartTime = now;
        this.currentDeviationDirection = gazeResult.gazeState;
      }
      sustainedDuration = now - this.lookAwayStartTime;

      if (
        sustainedDuration >= this.config.lookAwayThresholdMs &&
        now - this.lastViolationTime >= this.config.cooldownMs
      ) {
        this.lastViolationTime = now;
        this.emitViolation({
          type: "LOOKING_AWAY",
          direction: this.currentDeviationDirection,
          durationMs: Math.round(sustainedDuration),
          confidence: gazeResult.confidence,
          metadata: {
            direction: this.currentDeviationDirection,
            duration_seconds: (sustainedDuration / 1000).toFixed(1),
            reason: `Candidate sustained gaze away (${this.currentDeviationDirection}) for ${(sustainedDuration / 1000).toFixed(1)}s`,
            headYaw: gazeResult.headPose.yaw,
            headPitch: gazeResult.headPose.pitch,
            gazeX: Math.round(this.smoothedX * 100) / 100,
            gazeY: Math.round(this.smoothedY * 100) / 100,
            action: "RECORD_LOOK_AWAY_EVENT",
          },
        });
      }
    } else {
      this.lookAwayStartTime = null;
      this.currentDeviationDirection = "CENTER";
    }

    return {
      smoothedVector: {
        x: Math.round(this.smoothedX * 100) / 100,
        y: Math.round(this.smoothedY * 100) / 100,
      },
      sustainedLookAwayDurationMs: Math.round(sustainedDuration),
      isSustainedViolation: sustainedDuration >= this.config.lookAwayThresholdMs,
    };
  }

  private emitViolation(payload: GazeViolationPayload): void {
    if (this.onViolationCallback) {
      this.onViolationCallback(payload);
    }
  }

  public reset(): void {
    this.smoothedX = 0;
    this.smoothedY = 0;
    this.lookAwayStartTime = null;
    this.currentDeviationDirection = "CENTER";
  }
}
