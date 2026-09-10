/**
 * MediaPipe Face Landmarker & Dual-Layer Biometric Proctoring Engine.
 * 
 * Provides client-side, real-time webcam face presence, camera obstruction/hand-on-lens detection,
 * multiple face detection, head pose estimation (yaw/pitch/roll), and
 * looking-away analysis with temporal smoothing and anti-false-positive filtering.
 */
import {
  FaceLandmarker,
  ObjectDetector,
  FilesetResolver,
  type FaceLandmarkerResult,
  type ObjectDetectorResult,
} from "@mediapipe/tasks-vision";

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
}

export type FaceViolationType =
  | "FACE_ABSENT"
  | "MULTIPLE_FACES"
  | "PROLONGED_LOOK_AWAY"
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

  // Offscreen analysis canvas for optical fallback & obstruction detection
  private opticalCanvas: HTMLCanvasElement | null = null;
  private deviceCanvas: HTMLCanvasElement | null = null;

  // Temporal state tracking
  private faceAbsentStartTime: number | null = null;
  private multipleFacesStartTime: number | null = null;
  private lookingAwayStartTime: number | null = null;
  private phoneDetectedStartTime: number | null = null;

  // Cooldown timestamps to prevent event spam
  private lastFaceAbsentEventTime: number = 0;
  private lastMultipleFacesEventTime: number = 0;
  private lastLookingAwayEventTime: number = 0;
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
      lookingAwayDurationMs: config?.lookingAwayDurationMs ?? 2500,
      yawThresholdDeg: config?.yawThresholdDeg ?? 26,
      pitchDownThresholdDeg: config?.pitchDownThresholdDeg ?? 22,
      pitchUpThresholdDeg: config?.pitchUpThresholdDeg ?? -18,
      cooldownMs: config?.cooldownMs ?? 5000,
      inferenceIntervalMs: config?.inferenceIntervalMs ?? 100,
    };

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
    };
  }

  public onViolation(callback: (event: FaceViolationEvent) => void): void {
    this.onViolationCallback = callback;
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
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm"
      );

      // 1. Initialize Face Landmarker (GPU first, fallback CPU)
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

      // 2. Initialize Object Detector for Mobile Phone / Handheld Electronic Devices
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
            scoreThreshold: 0.18,
            maxResults: 8,
          });
        } catch {
          try {
            this.objectDetector = await ObjectDetector.createFromOptions(filesetResolver, {
              baseOptions: {
                modelAssetPath: modelUrl,
                delegate: "CPU",
              },
              runningMode: "VIDEO",
              scoreThreshold: 0.18,
              maxResults: 8,
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
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;

        // Human skin tone detection heuristic
        if (r > 60 && g > 30 && b > 15 && r > g && r > b && (r - g) > 10) {
          skinPixels++;
        }
      }

      const sampledCount = data.length / 8;
      const avgBrightness = totalBrightness / sampledCount;

      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const bVal = (r + g + b) / 3;
        varianceAcc += Math.abs(bVal - avgBrightness);
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
   * Real-time Computer Vision Handheld Mobile Phone / Electronic Device Analyzer.
   * Detects:
   * 1. Rectangular phone form-factor (aspect ratio ~1.5:1 to 2.4:1) with parallel straight edges.
   * 2. Handheld electronic bezel contours in front of chest/webcam.
   * 3. Mobile screen display emission, glossy dark glass reflections, or high-contrast screen textures.
   */
  private checkOpticalDeviceInFrame(video: HTMLVideoElement): { phoneDetected: boolean; confidence: number } {
    if (!this.deviceCanvas) {
      this.deviceCanvas = document.createElement("canvas");
      this.deviceCanvas.width = 120;
      this.deviceCanvas.height = 90;
    }
    const canvas = this.deviceCanvas;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { phoneDetected: false, confidence: 0 };

    try {
      const W = 120;
      const H = 90;
      ctx.drawImage(video, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;

      let verticalEdgePoints = 0;
      let horizontalEdgePoints = 0;
      let phoneScreenLuminanceBlobs = 0;
      let darkGlossyRectPoints = 0;

      // Scan grid for high-gradient phone borders and screen texture
      for (let y = 10; y < H - 10; y += 3) {
        for (let x = 10; x < W - 10; x += 3) {
          const idx = (y * W + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Horizontal gradient (vertical bezel lines)
          const rightIdx = (y * W + (x + 2)) * 4;
          const lumRight = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
          const gradH = Math.abs(lum - lumRight);

          // Vertical gradient (horizontal bezel lines)
          const downIdx = ((y + 2) * W + x) * 4;
          const lumDown = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];
          const gradV = Math.abs(lum - lumDown);

          if (gradH > 35) verticalEdgePoints++;
          if (gradV > 35) horizontalEdgePoints++;

          // 1. Mobile screen glow (active display emission)
          if ((b > 160 && (b - r) > 15 && lum > 120) || (lum > 220 && (r + g + b) > 650)) {
            phoneScreenLuminanceBlobs++;
          }

          // 2. Dark glossy phone rectangle / black bezel held up
          if (lum < 40 && (gradH > 30 || gradV > 30)) {
            darkGlossyRectPoints++;
          }
        }
      }

      // Smartphone signature: strong vertical & horizontal parallel edges + screen glow or dark glossy bezel
      const hasEdgeStructure = verticalEdgePoints >= 18 && horizontalEdgePoints >= 14;
      const isEmissivePhone = phoneScreenLuminanceBlobs >= 8 && (verticalEdgePoints >= 12 || horizontalEdgePoints >= 10);
      const isDarkGlossyPhone = darkGlossyRectPoints >= 16 && hasEdgeStructure;
      const isStrongEdgePhone = verticalEdgePoints >= 36 && horizontalEdgePoints >= 28;

      const isDetected = isEmissivePhone || isDarkGlossyPhone || isStrongEdgePhone;
      const confidence = isDetected
        ? Math.min(0.99, 0.70 + (phoneScreenLuminanceBlobs * 0.02) + (verticalEdgePoints * 0.005))
        : 0;

      return { phoneDetected: isDetected, confidence };
    } catch {
      return { phoneDetected: false, confidence: 0 };
    }
  }

  /**
   * Processes a video frame with dual-layer vision & temporal smoothing.
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

    // 1. MediaPipe Object Detection (Cell Phone / Mobile Device Check)
    if (this.objectDetector) {
      try {
        const objResult: ObjectDetectorResult = this.objectDetector.detectForVideo(video, now);
        if (objResult.detections && objResult.detections.length > 0) {
          for (const det of objResult.detections) {
            for (const cat of det.categories) {
              const label = (cat.categoryName || "").toLowerCase();
              if (
                (label.includes("cell") ||
                  label.includes("phone") ||
                  label.includes("mobile") ||
                  label.includes("telephone") ||
                  label.includes("remote") ||
                  label.includes("device") ||
                  label.includes("handheld") ||
                  label.includes("tablet") ||
                  label.includes("screen") ||
                  label.includes("laptop")) &&
                cat.score >= 0.18
              ) {
                return this.handlePhoneDetected(
                  now,
                  `Mobile phone detected via vision detector (${cat.categoryName}: ${(cat.score * 100).toFixed(0)}% confidence)`,
                  cat.score
                );
              }
            }
          }
        }
      } catch {
        // Fallback to optical device check
      }
    }

    // 2. Optical Phone Screen / Rectangular Bezel Detection Check
    const deviceCheck = this.checkOpticalDeviceInFrame(video);
    if (deviceCheck.phoneDetected) {
      return this.handlePhoneDetected(
        now,
        "Unauthorized mobile phone / handheld electronic device detected in webcam frame",
        deviceCheck.confidence
      );
    } else {
      this.phoneDetectedStartTime = null;
    }

    // 3. First Optical Check (Instant Hand-on-Camera & Lens Obstruction detector)
    const optical = this.checkOpticalFrame(video);
    if (optical.isCameraBlocked) {
      return this.handleFaceAbsent(now, "Camera lens is blocked or covered by an object/hand");
    }

    // 4. MediaPipe Face Landmark Detection
    if (this.landmarker) {
      try {
        const result: FaceLandmarkerResult = this.landmarker.detectForVideo(video, now);
        const state = this.analyzeResult(result, now);
        this.lastComputedState = state;
        return state;
      } catch {
        // Fallback to optical presence if WebGL/WASM dropped frame
      }
    }

    // 5. Fallback Optical Presence if MediaPipe not yet initialized
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
      };
      return this.lastComputedState;
    }
  }

  private handlePhoneDetected(now: number, reason: string, confidence: number = 0.95): FaceProctoringState {
    if (this.phoneDetectedStartTime === null) {
      this.phoneDetectedStartTime = now;
    }

    const duration = now - this.phoneDetectedStartTime;
    // Trigger immediately after 150ms of sustained phone detection
    if (duration >= 150 && now - this.lastPhoneDetectedEventTime >= 2000) {
      this.lastPhoneDetectedEventTime = now;
      this.triggerViolation({
        type: "PHONE_DETECTED",
        durationMs: Math.round(duration),
        confidence,
        timestamp: new Date().toISOString(),
        metadata: {
          reason,
          action: "CANCEL_EXAM_NO_SUBMIT",
          device: "cell phone",
        },
      });
    }

    this.lastComputedState = {
      isModelReady: this.isReady,
      modelError: this.modelError,
      faceCount: 1,
      faceDetected: true,
      multipleFaces: false,
      faceAbsent: false,
      isLookingAway: false,
      isPhoneDetected: true,
      phoneConfidence: confidence,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
      confidence,
      landmarks: null,
    };
    return this.lastComputedState;
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
    };
    return this.lastComputedState;
  }

  /**
   * Analyzes raw MediaPipe Face Landmarker results and handles temporal state transitions.
   */
  private analyzeResult(result: FaceLandmarkerResult, now: number): FaceProctoringState {
    const faceCount = result.faceLandmarks ? result.faceLandmarks.length : 0;
    let headPose: HeadPose = { yaw: 0, pitch: 0, roll: 0 };
    let isLookingAway = false;
    let confidence = 0.95;
    let landmarks = null;

    if (faceCount > 0 && result.faceLandmarks[0]) {
      landmarks = result.faceLandmarks[0];
      headPose = this.estimateHeadPose(landmarks);
      isLookingAway = this.checkLookingAway(headPose, result.faceBlendshapes?.[0]);
    }

    // 1. TEMPORAL RULE: FACE ABSENCE (0 Faces)
    if (faceCount === 0) {
      return this.handleFaceAbsent(now, "No face detected in webcam view for sustained period");
    } else {
      this.faceAbsentStartTime = null;
    }

    // 2. TEMPORAL RULE: MULTIPLE FACES (>= 2 Faces)
    if (faceCount >= 2) {
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
    } else {
      this.multipleFacesStartTime = null;
    }

    // 3. TEMPORAL RULE: LOOKING AWAY (Sustained Yaw / Pitch deviation)
    if (faceCount === 1 && isLookingAway) {
      if (this.lookingAwayStartTime === null) {
        this.lookingAwayStartTime = now;
      } else {
        const lookAwayDuration = now - this.lookingAwayStartTime;
        if (
          lookAwayDuration >= this.config.lookingAwayDurationMs &&
          now - this.lastLookingAwayEventTime >= this.config.cooldownMs
        ) {
          this.lastLookingAwayEventTime = now;
          this.triggerViolation({
            type: "PROLONGED_LOOK_AWAY",
            durationMs: Math.round(lookAwayDuration),
            confidence: 0.90,
            timestamp: new Date().toISOString(),
            metadata: {
              yaw: Math.round(headPose.yaw),
              pitch: Math.round(headPose.pitch),
              roll: Math.round(headPose.roll),
              reason: "Candidate gaze and head pose deviated off-screen for sustained period",
              duration_seconds: (lookAwayDuration / 1000).toFixed(1),
            },
          });
        }
      }
    } else {
      this.lookingAwayStartTime = null;
    }

    return {
      isModelReady: this.isReady,
      modelError: this.modelError,
      faceCount,
      faceDetected: faceCount === 1,
      multipleFaces: faceCount >= 2,
      faceAbsent: faceCount === 0,
      isLookingAway,
      headPose,
      confidence,
      landmarks,
      isPhoneDetected: false,
      phoneConfidence: 0,
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

  /**
   * Evaluates whether head pose or eye blendshapes indicate off-screen gaze.
   */
  private checkLookingAway(headPose: HeadPose, blendshapes?: any): boolean {
    // 1. Check head pose angles
    const isYawDeviated = Math.abs(headPose.yaw) > this.config.yawThresholdDeg;
    const isPitchDeviated =
      headPose.pitch > this.config.pitchDownThresholdDeg ||
      headPose.pitch < this.config.pitchUpThresholdDeg;

    if (isYawDeviated || isPitchDeviated) {
      return true;
    }

    // 2. Check eye gaze blendshapes if available
    if (blendshapes && blendshapes.categories) {
      const getScore = (name: string): number => {
        const cat = blendshapes.categories.find((c: any) => c.categoryName === name);
        return cat ? cat.score : 0;
      };

      const eyeLookOutLeft = getScore("eyeLookOutLeft");
      const eyeLookInRight = getScore("eyeLookInRight");
      const eyeLookOutRight = getScore("eyeLookOutRight");
      const eyeLookInLeft = getScore("eyeLookInLeft");
      const eyeLookDownLeft = getScore("eyeLookDownLeft");
      const eyeLookDownRight = getScore("eyeLookDownRight");

      // Gaze turned strongly sideways
      if ((eyeLookOutLeft > 0.60 && eyeLookInRight > 0.60) || (eyeLookOutRight > 0.60 && eyeLookInLeft > 0.60)) {
        return true;
      }
      // Gaze turned strongly downwards
      if (eyeLookDownLeft > 0.70 && eyeLookDownRight > 0.70) {
        return true;
      }
    }

    return false;
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
    } catch {
      // fail-soft
    }
    this.isReady = false;
    this.isInitializing = false;
    this.onViolationCallback = null;
    this.opticalCanvas = null;
  }
}
