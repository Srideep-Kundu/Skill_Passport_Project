/**
 * BlinkDetector
 * 
 * Distinguishes natural physiological blinks (100ms - 450ms) from prolonged eye closure (>= 3500ms).
 * Computes blink rate and average duration telemetry. Normal blinks are never penalized.
 */

export type EyeClosureState = "EYES_OPEN" | "BLINKING" | "PROLONGED_CLOSURE";

export interface BlinkDetectorMetrics {
  state: EyeClosureState;
  blinkCount: number;
  avgBlinkDurationMs: number;
  currentClosureDurationMs: number;
  isProlongedClosure: boolean;
  ear: number;
}

export class BlinkDetector {
  private blinkCount: number = 0;
  private totalBlinkDurationMs: number = 0;
  private closureStartTime: number | null = null;
  private currentState: EyeClosureState = "EYES_OPEN";
  private readonly prolongedClosureThresholdMs: number = 3500;

  /**
   * Evaluates eye openness at current timestamp.
   */
  public update(
    isBlinkingNow: boolean,
    ear: number,
    now: number = performance.now()
  ): BlinkDetectorMetrics {
    let currentClosureDuration = 0;

    if (isBlinkingNow) {
      if (this.closureStartTime === null) {
        this.closureStartTime = now;
      }
      currentClosureDuration = now - this.closureStartTime;

      if (currentClosureDuration >= this.prolongedClosureThresholdMs) {
        this.currentState = "PROLONGED_CLOSURE";
      } else {
        this.currentState = "BLINKING";
      }
    } else {
      if (this.closureStartTime !== null) {
        const closedDuration = now - this.closureStartTime;
        // Count as a completed natural blink if duration was between 80ms and 600ms
        if (closedDuration >= 80 && closedDuration <= 600) {
          this.blinkCount += 1;
          this.totalBlinkDurationMs += closedDuration;
        }
        this.closureStartTime = null;
      }
      this.currentState = "EYES_OPEN";
    }

    const avgBlinkDuration =
      this.blinkCount > 0
        ? Math.round(this.totalBlinkDurationMs / this.blinkCount)
        : 180;

    return {
      state: this.currentState,
      blinkCount: this.blinkCount,
      avgBlinkDurationMs: avgBlinkDuration,
      currentClosureDurationMs: Math.round(currentClosureDuration),
      isProlongedClosure: this.currentState === "PROLONGED_CLOSURE",
      ear: Math.round(ear * 100) / 100,
    };
  }

  public reset(): void {
    this.blinkCount = 0;
    this.totalBlinkDurationMs = 0;
    this.closureStartTime = null;
    this.currentState = "EYES_OPEN";
  }
}
