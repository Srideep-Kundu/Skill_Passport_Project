/**
 * MediaPipe Face Landmarker & Dual-Layer Biometric Proctoring Engine.
 * 
 * Provides client-side, real-time webcam face presence, camera obstruction/hand-on-lens detection,
 * multiple face detection, 3D head pose estimation (yaw/pitch/roll), eye tracking, iris landmark analysis,
 * blink dynamics, and looking-away analysis with temporal smoothing and anti-false-positive filtering.
 */
import type {
  FaceLandmarker,
  ObjectDetector,
  FaceLandmarkerResult,
  ObjectDetectorResult,
} from "@mediapipe/tasks-vision";

let cachedFilesetResolver: any = null;

import { EyeLandmarkExtractor, type ExtractedEyeMetrics } from "./EyeLandmarkExtractor";
import { BlinkDetector, type BlinkDetectorMetrics } from "./BlinkDetector";
import {
  GazeEstimator,
  type GazeState,
  type GazeBaselineCalibration,
  type EstimatedGazeResult,
} from "./GazeEstimator";
import { GazeTemporalFilter, type GazeViolationPayload } from "./GazeTemporalFilter";

export interface FaceProctoringConfig {
  faceAbsentDurationMs?: number;
  multipleFacesDurationMs?: number;
  lookingAwayDurationMs?: number;
  yawThresholdDeg?: number;
  pitchDownThresholdDeg?: number;
  pitchUpThresholdDeg?: number;
  cooldownMs?: number;
  inferenceIntervalMs?: number;
}

export interface HeadPose {
  yaw: number;   // Left (-) / Right (+) in degrees
  pitch: number; // Up (-) / Down (+) in degrees
  roll: number;  // Tilt in degrees
}

export interface FaceProctoringState {
  isModelReady: boolean;
  modelError: string | null;
  faceCount: number;
  faceDetected: boolean;
  multipleFaces: boolean;
  faceAbsent: boolean;
  isLookingAway: boolean;
  isPhoneDetected: boolean;
  phoneConfidence: number;
  headPose: HeadPose;
  confidence: number;
  landmarks: Array<{ x: number; y: number; z: number }> | null;
  // Eye Tracking & Gaze Estimation
  gazeState: GazeState;
  gazeVector: { x: number; y: number };
  gazeConfidence: number;
  isBlinking: boolean;
  blinkCount: number;
  avgEar: number;
  isReadingPattern: boolean;
}

export type FaceViolationType =
  | "FACE_ABSENT"
  | "MULTIPLE_FACES"
  | "PROLONGED_LOOK_AWAY"
  | "LOOKING_AWAY"
  | "GAZE_DEVIATION"
  | "PROLONGED_EYE_CLOSURE"
  | "HEAD_POSE_ANOMALY"
  | "PHONE_DETECTED";

export interface FaceViolationEvent {
  type: FaceViolationType;
  durationMs: number;
  confidence: number;
  timestamp: string;
  metadata: Record<string, any>;
}

export class FaceProctoringEngine {
  private landmarker: FaceLandmarker | null = null;
  private objectDetector: ObjectDetector | null = null;
  private isInitializing: boolean = false;
  private isReady: boolean = false;
  private modelError: string | null = null;

  // Dedicated Eye & Gaze Sub-engines
  private eyeExtractor: EyeLandmarkExtractor = new EyeLandmarkExtractor();
  private blinkDetector: BlinkDetector = new BlinkDetector();
  private gazeEstimator: GazeEstimator = new GazeEstimator();
  private gazeTemporalFilter: GazeTemporalFilter = new GazeTemporalFilter();

  // Offscreen analysis canvas for optical fallback & obstruction detection
  private opticalCanvas: HTMLCanvasElement | null = null;

  // Temporal state tracking
  private faceAbsentStartTime: number | null = null;
  private multipleFacesStartTime: number | null = null;
  private phoneDetectedStartTime: number | null = null;

  // Cooldown timestamps to prevent event spam
  private lastFaceAbsentEventTime: number = 0;
  private lastMultipleFacesEventTime: number = 0;
  private lastPhoneDetectedEventTime: number = 0;

  // Last inference time for throttle
  private lastInferenceTime: number = 0;

  // Last known persistent state
  private lastComputedState: FaceProctoringState;

  // Configuration
  private readonly config: Required<FaceProctoringConfig>;

  // Callbacks
  private onViolationCallback: ((event: FaceViolationEvent) => void) | null = null;

  constructor(config?: FaceProctoringConfig) {
    this.config = {
      faceAbsentDurationMs: config?.faceAbsentDurationMs ?? 1400,
      multipleFacesDurationMs: config?.multipleFacesDurationMs ?? 1500,
      lookingAwayDurationMs: config?.lookingAwayDurationMs ?? 2800,
      yawThresholdDeg: config?.yawThresholdDeg ?? 26,
      pitchDownThresholdDeg: config?.pitchDownThresholdDeg ?? 22,
      pitchUpThresholdDeg: config?.pitchUpThresholdDeg ?? -18,
      cooldownMs: config?.cooldownMs ?? 5000,
      inferenceIntervalMs: config?.inferenceIntervalMs ?? 100,
    };

    this.gazeTemporalFilter = new GazeTemporalFilter({
      lookAwayThresholdMs: this.config.lookingAwayDurationMs,
      cooldownMs: this.config.cooldownMs,
    });

    // Wire Gaze Temporal Filter events directly to engine violation dispatcher
    this.gazeTemporalFilter.onViolation((payload: GazeViolationPayload) => {
      this.triggerViolation({
        type: payload.type,
        durationMs: payload.durationMs,
        confidence: payload.confidence,
        timestamp: new Date().toISOString(),
        metadata: payload.metadata,
      });
    });

    this.lastComputedState = {
      isModelReady: false,
      modelError: null,
      faceCount: 0,
      faceDetected: false,
      multipleFaces: false,
      faceAbsent: true,
      isLookingAway: false,
      isPhoneDetected: false,
      phoneConfidence: 0,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
      confidence: 0,
      landmarks: null,
      gazeState: "UNKNOWN",
      gazeVector: { x: 0, y: 0 },
      gazeConfidence: 0,
      isBlinking: false,
      blinkCount: 0,
      avgEar: 0.25,
      isReadingPattern: false,
    };
  }

  public onViolation(callback: (event: FaceViolationEvent) => void): void {
    this.onViolationCallback = callback;
  }

  /**
   * Sets or updates candidate screen-center baseline calibration.
   */
  public setCalibrationBaseline(baseline: Partial<GazeBaselineCalibration>): void {
    this.gazeEstimator.setCalibration(baseline);
  }

  public getCalibrationBaseline(): GazeBaselineCalibration {
    return this.gazeEstimator.getCalibration();
  }

  /**
   * Initializes the MediaPipe Face Landmarker and Object Detector models asynchronously.
   */
  public async initialize(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.modelError = null;

    try {
      const { FilesetResolver, FaceLandmarker, ObjectDetector } = await import("@mediapipe/tasks-vision");
      if (!cachedFilesetResolver) {
        cachedFilesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
        );
      }
      const filesetResolver = cachedFilesetResolver;

      // 1. Initialize Face Landmarker with blendshapes & iris landmark support
      try {
        this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 4,
          minFaceDetectionConfidence: 0.40,
          minFacePresenceConfidence: 0.40,
          minTrackingConfidence: 0.40,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        });
      } catch {
        this.landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 4,
          minFaceDetectionConfidence: 0.40,
          minFacePresenceConfidence: 0.40,
          minTrackingConfidence: 0.40,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
        });
      }

      // 2. Initialize Object Detector for Mobile Phone Detection
      const modelUrls = [
        "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
        "https://storage.googleapis.com/mediapipe-models/object_detector/ssd_mobilenet_v2/float16/1/ssd_mobilenet_v2.tflite",
      ];

      for (const modelUrl of modelUrls) {
        if (this.objectDetector) break;
        try {
          this.objectDetector = await ObjectDetector.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: modelUrl,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            scoreThreshold: 0.65,
            maxResults: 4,
          });
        } catch {
          try {
            this.objectDetector = await ObjectDetector.createFromOptions(filesetResolver, {
              baseOptions: {
                modelAssetPath: modelUrl,
                delegate: "CPU",
              },
              runningMode: "VIDEO",
              scoreThreshold: 0.65,
              maxResults: 4,
            });
          } catch {
            // Try next model URL
          }
        }
      }

      this.isReady = true;
      this.isInitializing = false;
      this.lastComputedState.isModelReady = true;
      return true;
    } catch (err: any) {
      this.modelError = err?.message || "Using client vision fallback";
      this.isInitializing = false;
      this.isReady = true;
      this.lastComputedState.isModelReady = true;
      return true;
    }
  }

  /**
   * Fast optical frame check to detect hand-on-camera or completely dark/blocked lens.
   */
  private checkOpticalFrame(video: HTMLVideoElement): { isCameraBlocked: boolean; hasHumanPresence: boolean } {
    if (!this.opticalCanvas) {
      this.opticalCanvas = document.createElement("canvas");
      this.opticalCanvas.width = 64;
      this.opticalCanvas.height = 48;
    }
    const canvas = this.opticalCanvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { isCameraBlocked: false, hasHumanPresence: true };

    try {
      ctx.drawImage(video, 0, 0, 64, 48);
      const imgData = ctx.getImageData(0, 0, 64, 48);
      const data = imgData.data;

      let totalBrightness = 0;
      let skinPixels = 0;
      let varianceAcc = 0;

      for (let i = 0; i < data.length; i += 8) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += brightness;

        if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 10) {
          skinPixels++;
        }
      }

      const sampledCount = data.length / 8;
      const avgBrightness = totalBrightness / sampledCount;

      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        varianceAcc += Math.abs(lum - avgBrightness);
      }
      const avgVariance = varianceAcc / (data.length / 16);

      const isBlocked = avgBrightness < 16 || (avgBrightness < 45 && avgVariance < 4.0);
      const hasPresence = !isBlocked && (skinPixels / sampledCount > 0.04 || avgVariance > 12);

      return { isCameraBlocked: isBlocked, hasHumanPresence: hasPresence };
    } catch {
      return { isCameraBlocked: false, hasHumanPresence: true };
    }
  }

  /**
   * Processes a video frame with dual-layer vision, eye tracking, and temporal smoothing.
   */
  public processFrame(video: HTMLVideoElement, now: number = performance.now()): FaceProctoringState {
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      return this.lastComputedState;
    }

    // Throttle inference interval (~10-15 FPS for real-time responsiveness)
    if (now - this.lastInferenceTime < this.config.inferenceIntervalMs) {
      return this.lastComputedState;
    }
    this.lastInferenceTime = now;

    // 1. MediaPipe Object Detection (Strict Cell Phone Detection with 2.5s Temporal Persistence)
    let isPhoneInThisFrame = false;
    let phoneScore = 0;

    if (this.objectDetector) {
      try {
        const objResult: ObjectDetectorResult = this.objectDetector.detectForVideo(video, now);
        if (objResult.detections && objResult.detections.length > 0) {
          for (const det of objResult.detections) {
            for (const cat of det.categories) {
              const label = (cat.categoryName || "").toLowerCase();
              if (
                (label === "cell phone" || label === "mobile phone" || label === "telephone") &&
                cat.score >= 0.65
              ) {
                isPhoneInThisFrame = true;
                phoneScore = Math.max(phoneScore, cat.score);
              }
            }
          }
        }
      } catch {
        // Non-blocking fail-soft
      }
    }

    if (isPhoneInThisFrame) {
      if (this.phoneDetectedStartTime === null) {
        this.phoneDetectedStartTime = now;
      }
      const duration = now - this.phoneDetectedStartTime;
      if (duration >= 2500 && now - this.lastPhoneDetectedEventTime >= 5000) {
        this.lastPhoneDetectedEventTime = now;
        this.triggerViolation({
          type: "PHONE_DETECTED",
          durationMs: Math.round(duration),
          confidence: phoneScore,
          timestamp: new Date().toISOString(),
          metadata: {
            reason: `Mobile phone verified in camera view (${(phoneScore * 100).toFixed(0)}% confidence for ${(duration / 1000).toFixed(1)}s)`,
            action: "CANCEL_EXAM_NO_SUBMIT",
            device: "cell phone",
          },
        });
      }
    } else {
      this.phoneDetectedStartTime = null;
    }

    // 2. Optical Check (Camera Blocked / Lens Covered Detector)
    const optical = this.checkOpticalFrame(video);
    if (optical.isCameraBlocked) {
      return this.handleFaceAbsent(now, "Camera lens is blocked or covered by an object/hand");
    }

    // 3. MediaPipe Face Landmark Detection with Eye Tracking & Gaze Fusion
    if (this.landmarker) {
      try {
        const result: FaceLandmarkerResult = this.landmarker.detectForVideo(video, now);
        const state = this.analyzeResult(result, now);
        const isSustainedPhone =
          isPhoneInThisFrame &&
          this.phoneDetectedStartTime !== null &&
          now - this.phoneDetectedStartTime >= 2500;
        state.isPhoneDetected = isSustainedPhone;
        state.phoneConfidence = isPhoneInThisFrame ? phoneScore : 0;
        this.lastComputedState = state;
        return state;
      } catch {
        // Fallback to optical presence if WebGL/WASM dropped frame
      }
    }

    // 4. Optical Fallback Presence if MediaPipe not yet initialized
    if (!optical.hasHumanPresence) {
      return this.handleFaceAbsent(now, "No student face detected in camera view");
    } else {
      this.faceAbsentStartTime = null;
      this.lastComputedState = {
        isModelReady: this.isReady,
        modelError: null,
        faceCount: 1,
        faceDetected: true,
        multipleFaces: false,
        faceAbsent: false,
        isLookingAway: false,
        isPhoneDetected: false,
        phoneConfidence: 0,
        headPose: { yaw: 0, pitch: 0, roll: 0 },
        confidence: 0.88,
        landmarks: null,
        gazeState: "CENTER",
        gazeVector: { x: 0, y: 0 },
        gazeConfidence: 0.80,
        isBlinking: false,
        blinkCount: 0,
        avgEar: 0.25,
        isReadingPattern: false,
      };
      return this.lastComputedState;
    }
  }

  private handleFaceAbsent(now: number, reason: string): FaceProctoringState {
    if (this.faceAbsentStartTime === null) {
      this.faceAbsentStartTime = now;
    } else {
      const absentDuration = now - this.faceAbsentStartTime;
      if (
        absentDuration >= this.config.faceAbsentDurationMs &&
        now - this.lastFaceAbsentEventTime >= this.config.cooldownMs
      ) {
        this.lastFaceAbsentEventTime = now;
        this.triggerViolation({
          type: "FACE_ABSENT",
          durationMs: Math.round(absentDuration),
          confidence: 0.99,
          timestamp: new Date().toISOString(),
          metadata: {
            reason,
            duration_seconds: (absentDuration / 1000).toFixed(1),
          },
        });
      }
    }

    this.gazeTemporalFilter.reset();

    this.lastComputedState = {
      isModelReady: this.isReady,
      modelError: this.modelError,
      faceCount: 0,
      faceDetected: false,
      multipleFaces: false,
      faceAbsent: true,
      isLookingAway: false,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
      confidence: 0.95,
      landmarks: null,
      isPhoneDetected: false,
      phoneConfidence: 0,
      gazeState: "UNKNOWN",
      gazeVector: { x: 0, y: 0 },
      gazeConfidence: 0,
      isBlinking: false,
      blinkCount: this.blinkDetector.update(false, 0, now).blinkCount,
      avgEar: 0,
      isReadingPattern: false,
    };
    return this.lastComputedState;
  }

  /**
   * Analyzes raw MediaPipe Face Landmarker results and handles temporal eye & head transitions.
   */
  private analyzeResult(result: FaceLandmarkerResult, now: number): FaceProctoringState {
    const faceCount = result.faceLandmarks ? result.faceLandmarks.length : 0;
    let headPose: HeadPose = { yaw: 0, pitch: 0, roll: 0 };
    let confidence = 0.95;
    let landmarks = null;
    let eyeMetrics: ExtractedEyeMetrics = {
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
    let blinkMetrics: BlinkDetectorMetrics = {
      state: "EYES_OPEN",
      blinkCount: 0,
      avgBlinkDurationMs: 180,
      currentClosureDurationMs: 0,
      isProlongedClosure: false,
      ear: 0.25,
    };
    let gazeResult: EstimatedGazeResult = {
      gazeState: "UNKNOWN",
      gazeVector: { x: 0, y: 0 },
      confidence: 0,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
      eyeOffset: { x: 0, y: 0 },
      isReadingPattern: false,
      isLookingAway: false,
      reason: "",
    };

    if (faceCount > 0 && result.faceLandmarks[0]) {
      landmarks = result.faceLandmarks[0];
      headPose = this.estimateHeadPose(landmarks);
      eyeMetrics = this.eyeExtractor.extract(landmarks);
      blinkMetrics = this.blinkDetector.update(eyeMetrics.isBlinking, eyeMetrics.avgEar, now);
      gazeResult = this.gazeEstimator.estimate(
        eyeMetrics,
        headPose,
        result.faceBlendshapes?.[0]
      );
    }

    // 1. TEMPORAL RULE: FACE ABSENCE (0 Faces)
    if (faceCount === 0) {
      return this.handleFaceAbsent(now, "No face detected in webcam view for sustained period");
    } else {
      this.faceAbsentStartTime = null;
    }

    // 2. TEMPORAL RULE: MULTIPLE FACES (>= 2 Faces)
    if (faceCount >= 2) {
      this.gazeTemporalFilter.reset();
      if (this.multipleFacesStartTime === null) {
        this.multipleFacesStartTime = now;
      } else {
        const multiDuration = now - this.multipleFacesStartTime;
        if (
          multiDuration >= this.config.multipleFacesDurationMs &&
          now - this.lastMultipleFacesEventTime >= this.config.cooldownMs
        ) {
          this.lastMultipleFacesEventTime = now;
          this.triggerViolation({
            type: "MULTIPLE_FACES",
            durationMs: Math.round(multiDuration),
            confidence: 0.95,
            timestamp: new Date().toISOString(),
            metadata: {
              face_count: faceCount,
              reason: `${faceCount} separate faces detected simultaneously in the test environment`,
              duration_seconds: (multiDuration / 1000).toFixed(1),
            },
          });
        }
      }

      return {
        isModelReady: this.isReady,
        modelError: this.modelError,
        faceCount,
        faceDetected: false,
        multipleFaces: true,
        faceAbsent: false,
        isLookingAway: false,
        headPose,
        confidence: 0.95,
        landmarks,
        isPhoneDetected: false,
        phoneConfidence: 0,
        gazeState: "UNKNOWN",
        gazeVector: { x: 0, y: 0 },
        gazeConfidence: 0,
        isBlinking: false,
        blinkCount: blinkMetrics.blinkCount,
        avgEar: eyeMetrics.avgEar,
        isReadingPattern: false,
      };
    } else {
      this.multipleFacesStartTime = null;
    }

    // 3. EYE TRACKING & GAZE TEMPORAL FILTERING (Sustained Off-Screen Gaze)
    const filterResult = this.gazeTemporalFilter.update(gazeResult, blinkMetrics, now);
    const isLookingAway = gazeResult.isLookingAway || filterResult.isSustainedViolation;

    return {
      isModelReady: this.isReady,
      modelError: this.modelError,
      faceCount,
      faceDetected: faceCount === 1,
      multipleFaces: false,
      faceAbsent: false,
      isLookingAway,
      headPose,
      confidence,
      landmarks,
      isPhoneDetected: false,
      phoneConfidence: 0,
      gazeState: gazeResult.gazeState,
      gazeVector: filterResult.smoothedVector,
      gazeConfidence: gazeResult.confidence,
      isBlinking: blinkMetrics.state === "BLINKING",
      blinkCount: blinkMetrics.blinkCount,
      avgEar: eyeMetrics.avgEar,
      isReadingPattern: gazeResult.isReadingPattern,
    };
  }

  /**
   * Estimates Head Pose (Yaw, Pitch, Roll) from 3D facial mesh landmarks.
   */
  private estimateHeadPose(landmarks: Array<{ x: number; y: number; z: number }>): HeadPose {
    const nose = landmarks[1] || landmarks[4] || { x: 0.5, y: 0.5, z: 0 };
    const forehead = landmarks[10] || { x: 0.5, y: 0.2, z: 0 };
    const chin = landmarks[152] || { x: 0.5, y: 0.8, z: 0 };
    const leftEye = landmarks[263] || { x: 0.7, y: 0.4, z: 0 };
    const rightEye = landmarks[33] || { x: 0.3, y: 0.4, z: 0 };

    // 1. Yaw (Left / Right turn)
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeDist = Math.max(0.001, Math.abs(rightEye.x - leftEye.x));
    const yawRatio = (nose.x - eyeMidX) / eyeDist;
    const yaw = Math.max(-90, Math.min(90, yawRatio * 110));

    // 2. Pitch (Up / Down tilt)
    const faceHeight = Math.max(0.001, Math.abs(chin.y - forehead.y));
    const noseExpectedY = forehead.y + faceHeight * 0.58;
    const pitchRatio = (nose.y - noseExpectedY) / faceHeight;
    const pitch = Math.max(-90, Math.min(90, pitchRatio * 120));

    // 3. Roll (Head tilt)
    const deltaY = rightEye.y - leftEye.y;
    const deltaX = rightEye.x - leftEye.x;
    const roll = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    return {
      yaw: Math.round(yaw),
      pitch: Math.round(pitch),
      roll: Math.round(roll),
    };
  }

  private triggerViolation(event: FaceViolationEvent): void {
    if (this.onViolationCallback) {
      this.onViolationCallback(event);
    }
  }

  /**
   * Cleanly releases all MediaPipe WebAssembly and GPU resources.
   */
  public dispose(): void {
    try {
      if (this.landmarker) {
        this.landmarker.close();
        this.landmarker = null;
      }
      if (this.objectDetector) {
        this.objectDetector.close();
        this.objectDetector = null;
      }
    } catch {
      // fail-soft
    }
    this.isReady = false;
    this.isInitializing = false;
    this.onViolationCallback = null;
    this.opticalCanvas = null;
    this.blinkDetector.reset();
    this.gazeTemporalFilter.reset();
  }
}
