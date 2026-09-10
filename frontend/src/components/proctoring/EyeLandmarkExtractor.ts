/**
 * EyeLandmarkExtractor
 * 
 * Extracts 3D eye contour, eyelid, and iris landmarks from MediaPipe Face Landmarker results.
 * Computes Eye Aspect Ratio (EAR) for blink detection and normalized iris position (0.0 to 1.0)
 * within the eye socket for gaze estimation.
 */

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export interface SingleEyeData {
  innerCorner: Landmark3D;
  outerCorner: Landmark3D;
  topEyelid: Landmark3D;
  bottomEyelid: Landmark3D;
  irisCenter: Landmark3D;
  ear: number;
  irisRatioX: number; // 0.0 (far inner) to 1.0 (far outer)
  irisRatioY: number; // 0.0 (top) to 1.0 (bottom)
  eyeWidth: number;
  eyeHeight: number;
  isOpen: boolean;
}

export interface ExtractedEyeMetrics {
  leftEye: SingleEyeData | null;
  rightEye: SingleEyeData | null;
  avgEar: number;
  isBlinking: boolean;
  leftIrisRatioX: number;
  rightIrisRatioX: number;
  leftIrisRatioY: number;
  rightIrisRatioY: number;
  confidence: number;
}

// MediaPipe 478 Face Mesh Landmark Indices
const LANDMARKS = {
  // Left Eye (Subject's Left / Viewer's Right)
  LEFT_INNER_CORNER: 362,
  LEFT_OUTER_CORNER: 263,
  LEFT_TOP_EYELID_1: 386,
  LEFT_TOP_EYELID_2: 385,
  LEFT_BOTTOM_EYELID_1: 374,
  LEFT_BOTTOM_EYELID_2: 380,
  LEFT_IRIS_CENTER: 468,

  // Right Eye (Subject's Right / Viewer's Left)
  RIGHT_INNER_CORNER: 133,
  RIGHT_OUTER_CORNER: 33,
  RIGHT_TOP_EYELID_1: 159,
  RIGHT_TOP_EYELID_2: 158,
  RIGHT_BOTTOM_EYELID_1: 145,
  RIGHT_BOTTOM_EYELID_2: 153,
  RIGHT_IRIS_CENTER: 473,
};

function euclideanDistance(p1: Landmark3D, p2: Landmark3D): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = (p1.z || 0) - (p2.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateEAR(
  top1: Landmark3D,
  top2: Landmark3D,
  bot1: Landmark3D,
  bot2: Landmark3D,
  inner: Landmark3D,
  outer: Landmark3D
): number {
  const v1 = euclideanDistance(top1, bot1);
  const v2 = euclideanDistance(top2, bot2);
  const h = euclideanDistance(inner, outer);
  if (h < 0.0001) return 0.25;
  return (v1 + v2) / (2.0 * h);
}

export class EyeLandmarkExtractor {
  private readonly earBlinkThreshold: number = 0.18;

  /**
   * Extracts detailed eye contour and iris metrics from 478 MediaPipe landmarks.
   */
  public extract(landmarks: Landmark3D[] | null | undefined): ExtractedEyeMetrics {
    if (!landmarks || landmarks.length < 468) {
      return {
        leftEye: null,
        rightEye: null,
        avgEar: 0.25,
        isBlinking: false,
        leftIrisRatioX: 0.5,
        rightIrisRatioX: 0.5,
        leftIrisRatioY: 0.5,
        rightIrisRatioY: 0.5,
        confidence: 0,
      };
    }

    const hasIrisLandmarks = landmarks.length >= 478;

    // 1. Process Left Eye
    const lInner = landmarks[LANDMARKS.LEFT_INNER_CORNER] || { x: 0.55, y: 0.4, z: 0 };
    const lOuter = landmarks[LANDMARKS.LEFT_OUTER_CORNER] || { x: 0.70, y: 0.4, z: 0 };
    const lTop1 = landmarks[LANDMARKS.LEFT_TOP_EYELID_1] || { x: 0.62, y: 0.38, z: 0 };
    const lTop2 = landmarks[LANDMARKS.LEFT_TOP_EYELID_2] || { x: 0.64, y: 0.38, z: 0 };
    const lBot1 = landmarks[LANDMARKS.LEFT_BOTTOM_EYELID_1] || { x: 0.62, y: 0.42, z: 0 };
    const lBot2 = landmarks[LANDMARKS.LEFT_BOTTOM_EYELID_2] || { x: 0.64, y: 0.42, z: 0 };
    const lIris = hasIrisLandmarks && landmarks[LANDMARKS.LEFT_IRIS_CENTER]
      ? landmarks[LANDMARKS.LEFT_IRIS_CENTER]
      : { x: (lInner.x + lOuter.x) / 2, y: (lTop1.y + lBot1.y) / 2, z: 0 };

    const lEar = calculateEAR(lTop1, lTop2, lBot1, lBot2, lInner, lOuter);
    const lWidth = Math.max(0.001, Math.abs(lOuter.x - lInner.x));
    const lHeight = Math.max(0.001, Math.abs(lBot1.y - lTop1.y));
    const lMinX = Math.min(lInner.x, lOuter.x);
    const lIrisRatioX = Math.max(0, Math.min(1, (lIris.x - lMinX) / lWidth));
    const lMinY = Math.min(lTop1.y, lTop2.y);
    const lIrisRatioY = Math.max(0, Math.min(1, (lIris.y - lMinY) / lHeight));

    const leftEye: SingleEyeData = {
      innerCorner: lInner,
      outerCorner: lOuter,
      topEyelid: lTop1,
      bottomEyelid: lBot1,
      irisCenter: lIris,
      ear: lEar,
      irisRatioX: lIrisRatioX,
      irisRatioY: lIrisRatioY,
      eyeWidth: lWidth,
      eyeHeight: lHeight,
      isOpen: lEar >= this.earBlinkThreshold,
    };

    // 2. Process Right Eye
    const rInner = landmarks[LANDMARKS.RIGHT_INNER_CORNER] || { x: 0.45, y: 0.4, z: 0 };
    const rOuter = landmarks[LANDMARKS.RIGHT_OUTER_CORNER] || { x: 0.30, y: 0.4, z: 0 };
    const rTop1 = landmarks[LANDMARKS.RIGHT_TOP_EYELID_1] || { x: 0.38, y: 0.38, z: 0 };
    const rTop2 = landmarks[LANDMARKS.RIGHT_TOP_EYELID_2] || { x: 0.36, y: 0.38, z: 0 };
    const rBot1 = landmarks[LANDMARKS.RIGHT_BOTTOM_EYELID_1] || { x: 0.38, y: 0.42, z: 0 };
    const rBot2 = landmarks[LANDMARKS.RIGHT_BOTTOM_EYELID_2] || { x: 0.36, y: 0.42, z: 0 };
    const rIris = hasIrisLandmarks && landmarks[LANDMARKS.RIGHT_IRIS_CENTER]
      ? landmarks[LANDMARKS.RIGHT_IRIS_CENTER]
      : { x: (rInner.x + rOuter.x) / 2, y: (rTop1.y + rBot1.y) / 2, z: 0 };

    const rEar = calculateEAR(rTop1, rTop2, rBot1, rBot2, rInner, rOuter);
    const rWidth = Math.max(0.001, Math.abs(rInner.x - rOuter.x));
    const rHeight = Math.max(0.001, Math.abs(rBot1.y - rTop1.y));
    const rMinX = Math.min(rInner.x, rOuter.x);
    const rIrisRatioX = Math.max(0, Math.min(1, (rIris.x - rMinX) / rWidth));
    const rMinY = Math.min(rTop1.y, rTop2.y);
    const rIrisRatioY = Math.max(0, Math.min(1, (rIris.y - rMinY) / rHeight));

    const rightEye: SingleEyeData = {
      innerCorner: rInner,
      outerCorner: rOuter,
      topEyelid: rTop1,
      bottomEyelid: rBot1,
      irisCenter: rIris,
      ear: rEar,
      irisRatioX: rIrisRatioX,
      irisRatioY: rIrisRatioY,
      eyeWidth: rWidth,
      eyeHeight: rHeight,
      isOpen: rEar >= this.earBlinkThreshold,
    };

    const avgEar = (lEar + rEar) / 2;
    const isBlinking = avgEar < this.earBlinkThreshold;

    return {
      leftEye,
      rightEye,
      avgEar,
      isBlinking,
      leftIrisRatioX: lIrisRatioX,
      rightIrisRatioX: rIrisRatioX,
      leftIrisRatioY: lIrisRatioY,
      rightIrisRatioY: rIrisRatioY,
      confidence: hasIrisLandmarks ? 0.95 : 0.75,
    };
  }
}
