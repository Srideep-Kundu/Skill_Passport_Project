/**
 * GazeEstimator
 * 
 * Fuses 3D eye iris position, facial landmarks, 3D head pose (yaw/pitch/roll),
 * and screen-center baseline calibration into an estimated gaze vector and state.
 */

import type { ExtractedEyeMetrics } from "./EyeLandmarkExtractor";

export type GazeState =
  | "CENTER"
  | "LEFT"
  | "RIGHT"
  | "UP"
  | "DOWN"
  | "AWAY"
  | "UNKNOWN";

export interface GazeBaselineCalibration {
  baselineYaw: number;
  baselinePitch: number;
  baselineRoll: number;
  baselineIrisRatioX: number;
  baselineIrisRatioY: number;
  isCalibrated: boolean;
}

export interface EstimatedGazeResult {
  gazeState: GazeState;
  gazeVector: { x: number; y: number }; // Normalized -1.0 to +1.0
  confidence: number;
  headPose: { yaw: number; pitch: number; roll: number };
  eyeOffset: { x: number; y: number };
  isReadingPattern: boolean;
  isLookingAway: boolean;
  reason: string;
}

export class GazeEstimator {
  private calibration: GazeBaselineCalibration = {
    baselineYaw: 0,
    baselinePitch: 0,
    baselineRoll: 0,
    baselineIrisRatioX: 0.5,
    baselineIrisRatioY: 0.5,
    isCalibrated: false,
  };

  // Recent horizontal saccade history for reading pattern recognition
  private recentHorizontalSamples: number[] = [];

  /**
   * Sets or updates the neutral screen-center calibration baseline.
   */
  public setCalibration(calibration: Partial<GazeBaselineCalibration>): void {
    this.calibration = {
      ...this.calibration,
      ...calibration,
      isCalibrated: true,
    };
  }

  public getCalibration(): GazeBaselineCalibration {
    return { ...this.calibration };
  }

  /**
   * Estimates current gaze direction and state from eye metrics and head pose.
   */
  public estimate(
    eyeMetrics: ExtractedEyeMetrics,
    headPose: { yaw: number; pitch: number; roll: number },
    blendshapes?: any
  ): EstimatedGazeResult {
    // If no eyes detected or confidence is too low
    if (!eyeMetrics.leftEye && !eyeMetrics.rightEye) {
      return {
        gazeState: "UNKNOWN",
        gazeVector: { x: 0, y: 0 },
        confidence: 0,
        headPose,
        eyeOffset: { x: 0, y: 0 },
        isReadingPattern: false,
        isLookingAway: false,
        reason: "Eye landmarks unavailable",
      };
    }

    // 1. Calculate relative eye offsets from baseline
    const avgIrisX = (eyeMetrics.leftIrisRatioX + eyeMetrics.rightIrisRatioX) / 2;
    const avgIrisY = (eyeMetrics.leftIrisRatioY + eyeMetrics.rightIrisRatioY) / 2;

    const baseIrisX = this.calibration.isCalibrated ? this.calibration.baselineIrisRatioX : 0.5;
    const baseIrisY = this.calibration.isCalibrated ? this.calibration.baselineIrisRatioY : 0.5;
    const baseYaw = this.calibration.isCalibrated ? this.calibration.baselineYaw : 0;
    const basePitch = this.calibration.isCalibrated ? this.calibration.baselinePitch : 0;

    // Relative iris offsets (scaled to roughly -1 to +1 range)
    const eyeOffsetX = (avgIrisX - baseIrisX) * 2.2;
    const eyeOffsetY = (avgIrisY - baseIrisY) * 2.2;

    // Relative head pose offsets (scaled to -1 to +1 range across typical FOV)
    const headOffsetX = (headPose.yaw - baseYaw) / 36.0;
    const headOffsetY = (headPose.pitch - basePitch) / 28.0;

    // 2. Blendshape boost (if ARKit blendshapes available)
    let blendshapeGazeX = 0;
    let blendshapeGazeY = 0;
    if (blendshapes && blendshapes.categories) {
      const getScore = (name: string): number => {
        const cat = blendshapes.categories.find((c: any) => c.categoryName === name);
        return cat ? cat.score : 0;
      };

      const lookOutLeft = getScore("eyeLookOutLeft");
      const lookInRight = getScore("eyeLookInRight");
      const lookOutRight = getScore("eyeLookOutRight");
      const lookInLeft = getScore("eyeLookInLeft");
      const lookUpLeft = getScore("eyeLookUpLeft");
      const lookUpRight = getScore("eyeLookUpRight");
      const lookDownLeft = getScore("eyeLookDownLeft");
      const lookDownRight = getScore("eyeLookDownRight");

      const leftGazeScore = (lookOutLeft + lookInRight) / 2;
      const rightGazeScore = (lookOutRight + lookInLeft) / 2;
      const upGazeScore = (lookUpLeft + lookUpRight) / 2;
      const downGazeScore = (lookDownLeft + lookDownRight) / 2;

      blendshapeGazeX = (rightGazeScore - leftGazeScore) * 1.2;
      blendshapeGazeY = (downGazeScore - upGazeScore) * 1.2;
    }

    // 3. Fused Gaze Vector
    const fusedX = eyeOffsetX * 0.40 + headOffsetX * 0.45 + blendshapeGazeX * 0.15;
    const fusedY = eyeOffsetY * 0.35 + headOffsetY * 0.50 + blendshapeGazeY * 0.15;

    const clampedX = Math.max(-1.0, Math.min(1.0, fusedX));
    const clampedY = Math.max(-1.0, Math.min(1.0, fusedY));

    // 4. Track reading patterns (natural horizontal sweeps across question text)
    this.recentHorizontalSamples.push(clampedX);
    if (this.recentHorizontalSamples.length > 20) {
      this.recentHorizontalSamples.shift();
    }
    const xMin = Math.min(...this.recentHorizontalSamples);
    const xMax = Math.max(...this.recentHorizontalSamples);
    const isReadingSweep = xMax - xMin > 0.35 && Math.abs(headOffsetY) < 0.22;

    // 5. Determine Gaze State
    let gazeState: GazeState = "CENTER";
    let isLookingAway = false;
    let reason = "Gaze centered on assessment screen";

    const absX = Math.abs(clampedX);

    // Horizontal threshold checks (Left / Right)
    if (clampedX < -0.32) {
      gazeState = "LEFT";
      reason = "Candidate looking left";
      isLookingAway = absX > 0.42 || Math.abs(headOffsetX) > 0.48;
    } else if (clampedX > 0.32) {
      gazeState = "RIGHT";
      reason = "Candidate looking right";
      isLookingAway = absX > 0.42 || Math.abs(headOffsetX) > 0.48;
    } else if (clampedY < -0.30) {
      gazeState = "UP";
      reason = "Candidate looking upwards";
      isLookingAway = Math.abs(clampedY) > 0.40;
    } else if (clampedY > 0.38) {
      // For coding assessments, looking slightly down towards keyboard/code is normal
      if (clampedY > 0.52 && Math.abs(headOffsetY) > 0.45) {
        gazeState = "DOWN";
        reason = "Candidate looking down off-screen";
        isLookingAway = true;
      } else {
        gazeState = "CENTER";
        reason = "Natural downward gaze (typing/reading code)";
        isLookingAway = false;
      }
    } else {
      gazeState = "CENTER";
      isLookingAway = false;
    }

    // Suppress violation if reading sweep detected
    if (isReadingSweep && (gazeState === "LEFT" || gazeState === "RIGHT")) {
      isLookingAway = false;
      reason = "Natural reading horizontal eye saccade";
    }

    if (isLookingAway) {
      gazeState = "AWAY";
    }

    const confidence = Math.min(
      0.98,
      Math.max(0.60, eyeMetrics.confidence * 0.5 + (1.0 - Math.min(1.0, Math.abs(headPose.roll) / 45)) * 0.5)
    );

    return {
      gazeState,
      gazeVector: { x: Math.round(clampedX * 100) / 100, y: Math.round(clampedY * 100) / 100 },
      confidence: Math.round(confidence * 100) / 100,
      headPose,
      eyeOffset: { x: Math.round(eyeOffsetX * 100) / 100, y: Math.round(eyeOffsetY * 100) / 100 },
      isReadingPattern: isReadingSweep,
      isLookingAway,
      reason,
    };
  }
}
