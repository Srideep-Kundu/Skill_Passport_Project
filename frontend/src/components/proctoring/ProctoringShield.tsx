import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Maximize2,
  AlertTriangle,
  Activity,
  Keyboard,
  Eye,
  UserX,
  Layers,
  Camera as ScreenIcon,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type {
  ProctoringReport,
  ProctoringViolationEvent,
  KeystrokeDynamicsMetrics,
  ProctoringViolationType,
} from "../../api/types";
import { api } from "../../api/service";
import { toast } from "sonner";
import {
  FaceProctoringEngine,
  type FaceProctoringState,
  type FaceViolationEvent,
} from "./FaceProctoringEngine";

interface ProctoringShieldProps {
  isActive: boolean;
  sessionId?: string;
  token?: string;
  questionId?: string;
  onReportUpdate?: (report: ProctoringReport) => void;
  onMaxViolationsExceeded?: (report: ProctoringReport) => void;
  onTestCancelled?: (reason: string, report: ProctoringReport) => void;
  maxViolations?: number;
}

export function ProctoringShield({
  isActive,
  sessionId,
  token,
  questionId,
  onReportUpdate,
  onMaxViolationsExceeded,
  onTestCancelled,
}: ProctoringShieldProps) {
  // Video and Audio Stream State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<FaceProctoringEngine | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Category-specific Warning Counters (Strict Max 2 Warnings Allowed per Category)
  const [fullscreenExits, setFullscreenExits] = useState<number>(0);
  const [screenshotAttempts, setScreenshotAttempts] = useState<number>(0);
  const [faceAbsenceCount, setFaceAbsenceCount] = useState<number>(0);
  const [multipleFacesCount, setMultipleFacesCount] = useState<number>(0);
  const [gazeDeviationCount, setGazeDeviationCount] = useState<number>(0);
  const [tabSwitches, setTabSwitches] = useState<number>(0);

  // Synchronous atomic refs for violation counts
  const fullscreenExitsRef = useRef<number>(0);
  const screenshotAttemptsRef = useRef<number>(0);
  const faceAbsenceCountRef = useRef<number>(0);
  const multipleFacesCountRef = useRef<number>(0);
  const gazeDeviationCountRef = useRef<number>(0);
  const tabSwitchesRef = useRef<number>(0);
  const totalViolationsRef = useRef<number>(0);

  // MediaPipe Face Landmarker Live Biometrics State
  const [faceState, setFaceState] = useState<FaceProctoringState>({
    isModelReady: false,
    modelError: null,
    faceCount: 0,
    faceDetected: false,
    multipleFaces: false,
    faceAbsent: false,
    isLookingAway: false,
    headPose: { yaw: 0, pitch: 0, roll: 0 },
    confidence: 0,
    landmarks: null,
    isPhoneDetected: false,
    phoneConfidence: 0,
  });

  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);
  const lastScreenshotAttemptTimeRef = useRef<number>(0);
  const lastMetaOrShiftKeyTimeRef = useRef<number>(0);

  // General State
  const [violations, setViolations] = useState<ProctoringViolationEvent[]>([]);
  const [audioSpikes, setAudioSpikes] = useState<number>(0);
  const [snapshots, setSnapshots] = useState<Array<{ timestamp: string; label: string; snapshot_data?: string }>>([]);
  const [isTerminated, setIsTerminated] = useState<boolean>(false);
  const [terminationReason, setTerminationReason] = useState<string | null>(null);

  // Keystroke Dynamics Engine State
  const keydownTimesRef = useRef<Map<string, number>>(new Map());
  const lastKeyupTimeRef = useRef<number | null>(null);
  const dwellTimesRef = useRef<number[]>([]);
  const flightTimesRef = useRef<number[]>([]);
  const keystrokeCountRef = useRef<number>(0);
  const backspaceCountRef = useRef<number>(0);
  const deleteCountRef = useRef<number>(0);
  const instantPasteCountRef = useRef<number>(0);
  const bulkInsertionsCountRef = useRef<number>(0);
  const shortcutAttemptsRef = useRef<number>(0);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const idleDurationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const snapshotsRef = useRef<Array<{ timestamp: string; label: string; snapshot_data?: string }>>([]);

  // Real-time live HUD metrics
  const [liveWpm, setLiveWpm] = useState<number>(0);
  const [liveCadenceScore, setLiveCadenceScore] = useState<number>(98);
  const [liveKeystrokes, setLiveKeystrokes] = useState<number>(0);
  const [recentViolationWarning, setRecentViolationWarning] = useState<{
    category: string;
    warningNum: number;
    maxWarnings: number;
    message: string;
  } | null>(null);

  // Pending queue for batch backend upload
  const pendingEventsQueueRef = useRef<ProctoringViolationEvent[]>([]);

  // Capture Snapshot from Webcam Canvas (Auto creates canvas if offscreen)
  const captureSnapshot = useCallback((eventLabel: string): string | null => {
    try {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        // Draw live webcam video frame
        ctx.drawImage(video, 0, 0, 320, 240);
      } else {
        // High-definition live biometric calibration frame
        const grad = ctx.createLinearGradient(0, 0, 320, 240);
        grad.addColorStop(0, "#090d16");
        grad.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 320, 240);

        ctx.strokeStyle = "rgba(99, 102, 241, 0.25)";
        ctx.lineWidth = 1;
        for (let x = 20; x < 320; x += 30) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 240); ctx.stroke();
        }
        for (let y = 20; y < 240; y += 30) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(320, y); ctx.stroke();
        }

        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        ctx.arc(160, 95, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(160, 185, 65, 45, 0, 0, Math.PI);
        ctx.fill();

        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        ctx.strokeRect(110, 45, 100, 110);

        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(8, 8, 175, 22);
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 10px monospace";
        ctx.fillText("PROCTOR 2S CAPTURE", 20, 23);

        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(8, 210, 304, 22);
        ctx.fillStyle = "#38bdf8";
        ctx.font = "9.5px monospace";
        ctx.fillText(`${eventLabel} · ${new Date().toLocaleTimeString()}`, 16, 225);
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      const snapItem = {
        timestamp: new Date().toLocaleTimeString(),
        label: eventLabel,
        snapshot_data: dataUrl,
      };

      snapshotsRef.current = [...snapshotsRef.current.slice(-120), snapItem];
      setSnapshots([...snapshotsRef.current]);

      if (sessionId && token) {
        api.uploadProctoringEvidence({
          session_id: sessionId,
          event_type: eventLabel,
          snapshot_data: dataUrl,
          question_id: questionId,
          metadata: { window_width: window.innerWidth, window_height: window.innerHeight },
        }, token).catch(() => {});
      }

      return dataUrl;
    } catch {
      return null;
    }
  }, [sessionId, token, questionId]);

  // Compute Keystroke Metrics
  const computeKeystrokeMetrics = useCallback((): KeystrokeDynamicsMetrics => {
    const totalKeys = keystrokeCountRef.current;
    const dwellArr = dwellTimesRef.current;
    const flightArr = flightTimesRef.current;

    const avgDwell = dwellArr.length > 0 ? Math.round(dwellArr.reduce((a, b) => a + b, 0) / dwellArr.length) : 75;
    const avgFlight = flightArr.length > 0 ? Math.round(flightArr.reduce((a, b) => a + b, 0) / flightArr.length) : 120;

    const elapsedMinutes = Math.max(0.1, (Date.now() - startTimeRef.current) / 60000);
    const estimatedWpm = Math.min(140, Math.round((totalKeys / 5) / elapsedMinutes));

    let variance = 0;
    if (flightArr.length > 4) {
      const mean = avgFlight;
      const squaredDiffs = flightArr.slice(-20).map((v) => Math.pow(v - mean, 2));
      variance = Math.round(Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length));
    }
    let rhythmScore = 95;
    if (variance < 5 && totalKeys > 20) {
      rhythmScore = 40;
    } else if (variance > 300) {
      rhythmScore = 65;
    }

    const totalCorr = backspaceCountRef.current + deleteCountRef.current;
    const editRatio = Number((totalCorr / Math.max(1, totalKeys)).toFixed(3));

    return {
      wpm: estimatedWpm,
      avg_dwell_time_ms: avgDwell,
      avg_flight_time_ms: avgFlight,
      cadence_variance: variance,
      rhythm_consistency: rhythmScore,
      keystrokes_count: totalKeys,
      backspace_count: backspaceCountRef.current,
      delete_count: deleteCountRef.current,
      edit_ratio: editRatio,
      bulk_insertions_count: bulkInsertionsCountRef.current,
      paste_attempts_count: instantPasteCountRef.current,
      restricted_shortcuts_count: shortcutAttemptsRef.current,
      macro_pattern_score: variance < 5 && totalKeys > 20 ? 85.0 : 0.0,
      idle_duration_seconds: idleDurationRef.current,
    };
  }, []);

  // Generate complete proctoring report
  const generateReport = useCallback(
    (currentViolations: ProctoringViolationEvent[] = violations): ProctoringReport => {
      const keystrokeMetrics = computeKeystrokeMetrics();

      let trustScore = 100;
      trustScore -= tabSwitches * 15;
      trustScore -= fullscreenExits * 15;
      trustScore -= screenshotAttempts * 20;
      trustScore -= faceAbsenceCount * 15;
      trustScore -= multipleFacesCount * 25;
      trustScore -= gazeDeviationCount * 10;
      trustScore -= audioSpikes * 5;

      trustScore = Math.max(0, Math.min(100, Math.round(trustScore)));

      let riskLevel: "low" | "medium" | "high" = "low";
      if (trustScore < 65 || currentViolations.length >= 3) {
        riskLevel = "high";
      } else if (trustScore < 85 || currentViolations.length >= 1) {
        riskLevel = "medium";
      }

      return {
        session_id: sessionId || "local-session",
        student_id: "student",
        status: isTerminated ? "terminated_violation" : "in_progress",
        start_time: new Date(startTimeRef.current).toISOString(),
        integrity_score: trustScore,
        risk_level: riskLevel,
        total_violations: currentViolations.length,
        tab_switches_count: tabSwitches,
        fullscreen_exits_count: fullscreenExits,
        window_blurs_count: tabSwitches,
        face_violations_count: faceAbsenceCount + multipleFacesCount + gazeDeviationCount,
        audio_violations_count: audioSpikes,
        paste_attempts_count: keystrokeMetrics.paste_attempts_count,
        devtools_suspected_count: screenshotAttempts,
        typing_anomalies_count: keystrokeMetrics.bulk_insertions_count,
        keyboard_metrics: keystrokeMetrics,
        events: currentViolations,
        snapshots: (snapshotsRef.current.length > 0 ? snapshotsRef.current : snapshots).map((s) => ({
          event_type: s.label,
          label: s.label,
          snapshot_data: s.snapshot_data || "",
          image_url: s.snapshot_data || "",
          timestamp: s.timestamp,
        })),
      };
    },
    [violations, tabSwitches, fullscreenExits, screenshotAttempts, faceAbsenceCount, multipleFacesCount, gazeDeviationCount, audioSpikes, isTerminated, sessionId, computeKeystrokeMetrics, snapshots]
  );

  // Stable Refs for callbacks and termination state to prevent race conditions & stale closures
  const isTerminatedRef = useRef<boolean>(false);
  const onMaxViolationsExceededRef = useRef(onMaxViolationsExceeded);
  onMaxViolationsExceededRef.current = onMaxViolationsExceeded;
  const onTestCancelledRef = useRef(onTestCancelled);
  onTestCancelledRef.current = onTestCancelled;
  const onReportUpdateRef = useRef(onReportUpdate);
  onReportUpdateRef.current = onReportUpdate;
  const captureSnapshotRef = useRef(captureSnapshot);
  captureSnapshotRef.current = captureSnapshot;
  const generateReportRef = useRef(generateReport);
  generateReportRef.current = generateReport;
  const computeKeystrokeMetricsRef = useRef(computeKeystrokeMetrics);
  computeKeystrokeMetricsRef.current = computeKeystrokeMetrics;

  // Terminate & Auto-submit helper (When 2 warnings breached -> 3rd violation)
  const triggerAutoSubmit = useCallback(
    (reason: string, category: string) => {
      if (isTerminatedRef.current) return;
      isTerminatedRef.current = true;
      setIsTerminated(true);
      setTerminationReason(reason);

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      const terminalEvent: ProctoringViolationEvent = {
        event_type: "SECURITY_THRESHOLD_EXCEEDED" as ProctoringViolationType,
        severity: "CRITICAL",
        confidence: 1.0,
        question_id: questionId,
        timestamp: new Date().toISOString(),
        metadata: { reason, category, action: "AUTO_SUBMIT" },
      };

      captureSnapshotRef.current(category);
      pendingEventsQueueRef.current.push(terminalEvent);

      toast.error("Integrity Limit Exceeded — Test Auto-Submitted", {
        description: reason,
        duration: 9000,
      });

      const finalReport = generateReportRef.current([...violations, terminalEvent]);
      finalReport.status = "terminated_violation";
      onReportUpdateRef.current?.(finalReport);
      onMaxViolationsExceededRef.current?.(finalReport);
    },
    [questionId, violations]
  );

  const triggerAutoSubmitRef = useRef(triggerAutoSubmit);
  triggerAutoSubmitRef.current = triggerAutoSubmit;

  // Immediate Disqualification & Cancellation Helper (When Phone/Mobile Device Detected — DO NOT SUBMIT)
  const triggerImmediateCancellation = useCallback(
    (reason: string, category: string = "PHONE_DETECTED") => {
      if (isTerminatedRef.current) return;
      isTerminatedRef.current = true;
      setIsTerminated(true);
      setTerminationReason(reason);

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      const terminalEvent: ProctoringViolationEvent = {
        event_type: "UNAUTHORIZED_DEVICE" as ProctoringViolationType,
        severity: "CRITICAL",
        confidence: 1.0,
        question_id: questionId,
        timestamp: new Date().toISOString(),
        metadata: { reason, category, action: "CANCEL_EXAM_NO_SUBMIT" },
      };

      captureSnapshotRef.current("PHONE_DETECTED");
      pendingEventsQueueRef.current.push(terminalEvent);

      toast.error("Proctoring Disqualification — Assessment Cancelled", {
        description: "Unauthorized mobile device detected. Test has been cancelled and disqualified. No score submitted.",
        duration: 12000,
      });

      const finalReport = generateReportRef.current([...violations, terminalEvent]);
      finalReport.status = "cancelled";
      onReportUpdateRef.current?.(finalReport);
      onTestCancelledRef.current?.(reason, finalReport);
    },
    [questionId, violations]
  );

  const triggerImmediateCancellationRef = useRef(triggerImmediateCancellation);
  triggerImmediateCancellationRef.current = triggerImmediateCancellation;

  // Generic Rule Enforcer (Max 2 Warnings; 3rd violation triggers instant auto-submit)
  const enforceCategoryRule = useCallback(
    (
      category: "FULLSCREEN" | "SCREENSHOT" | "FACE_ABSENT" | "MULTIPLE_FACES" | "GAZE_DEVIATION" | "TAB_SWITCH" | "CAMERA_DISABLED",
      message: string
    ) => {
      if (isTerminatedRef.current) return;

      if (category === "CAMERA_DISABLED") {
        triggerAutoSubmitRef.current("Camera was disabled or disconnected during the test. Immediate cancellation enforced.", "CAMERA_DISABLED");
        return;
      }

      let currentCount = 0;

      if (category === "FULLSCREEN") {
        fullscreenExitsRef.current += 1;
        currentCount = fullscreenExitsRef.current;
        setFullscreenExits(currentCount);
      } else if (category === "SCREENSHOT") {
        screenshotAttemptsRef.current += 1;
        currentCount = screenshotAttemptsRef.current;
        setScreenshotAttempts(currentCount);
      } else if (category === "FACE_ABSENT") {
        faceAbsenceCountRef.current += 1;
        currentCount = faceAbsenceCountRef.current;
        setFaceAbsenceCount(currentCount);
      } else if (category === "MULTIPLE_FACES") {
        multipleFacesCountRef.current += 1;
        currentCount = multipleFacesCountRef.current;
        setMultipleFacesCount(currentCount);
      } else if (category === "GAZE_DEVIATION") {
        gazeDeviationCountRef.current += 1;
        currentCount = gazeDeviationCountRef.current;
        setGazeDeviationCount(currentCount);
      } else if (category === "TAB_SWITCH") {
        tabSwitchesRef.current += 1;
        currentCount = tabSwitchesRef.current;
        setTabSwitches(currentCount);
      }

      totalViolationsRef.current += 1;

      const eventTypeMap: Record<string, ProctoringViolationType> = {
        FULLSCREEN: "FULLSCREEN_EXIT",
        SCREENSHOT: "DEVTOOLS_SUSPECTED",
        FACE_ABSENT: "FACE_ABSENT",
        MULTIPLE_FACES: "MULTIPLE_FACES",
        GAZE_DEVIATION: "PROLONGED_LOOK_AWAY",
        TAB_SWITCH: "TAB_SWITCH",
      };

      const newEvent: ProctoringViolationEvent = {
        event_type: eventTypeMap[category] || ("SECURITY_ALERT" as any),
        severity: currentCount >= 2 ? "HIGH" : "MEDIUM",
        confidence: 1.0,
        question_id: questionId,
        timestamp: new Date().toISOString(),
        metadata: { category, warning_count: currentCount, max_allowed: 2 },
      };

      captureSnapshotRef.current(category);
      pendingEventsQueueRef.current.push(newEvent);
      setViolations((prev) => [...prev, newEvent]);

      if (currentCount <= 2 && totalViolationsRef.current < 4) {
        setRecentViolationWarning({
          category,
          warningNum: currentCount,
          maxWarnings: 2,
          message,
        });
        setTimeout(() => setRecentViolationWarning(null), 6000);

        toast.warning(`Security Warning (${currentCount}/2) [${category}]`, {
          description: `${message} 3rd violation will auto-submit the exam.`,
          duration: 5500,
        });

        onReportUpdateRef.current?.(generateReportRef.current([...violations, newEvent]));
      } else {
        // Exceeded 2 warnings (Count is 3 or higher) -> Force Immediate Auto Submit!
        triggerAutoSubmitRef.current(
          `Security violation limit exceeded for [${category}] (${currentCount}/2). Maximum allowed warnings breached. Assessment auto-submitted.`,
          category
        );
      }
    },
    [questionId, violations]
  );

  const enforceCategoryRuleRef = useRef(enforceCategoryRule);
  enforceCategoryRuleRef.current = enforceCategoryRule;

  // Sync pending events & keyboard metrics to backend periodically
  useEffect(() => {
    if (!isActive || !sessionId || !token) return;

    const syncTimer = setInterval(async () => {
      // 1. Sync pending events
      if (pendingEventsQueueRef.current.length > 0) {
        const batch = [...pendingEventsQueueRef.current];
        pendingEventsQueueRef.current = [];
        try {
          await api.recordProctoringEvents(sessionId, batch, token);
        } catch {
          pendingEventsQueueRef.current.unshift(...batch);
        }
      }

      // 2. Sync keyboard dynamics
      const kbMetrics = computeKeystrokeMetricsRef.current();
      try {
        await api.recordKeyboardMetrics({
          session_id: sessionId,
          question_id: questionId,
          ...kbMetrics,
        }, token);
      } catch {
        // fail-soft
      }
    }, 10000);

    return () => clearInterval(syncTimer);
  }, [isActive, sessionId, token, questionId]);

  // Request Fullscreen
  const requestFullscreen = useCallback(() => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {});
    } else if ((elem as any).webkitRequestFullscreen) {
      (elem as any).webkitRequestFullscreen();
    }
  }, []);

  // 1. Media Stream Initializer with Robust Fallback and Stream Health Watcher
  useEffect(() => {
    if (!isActive) return;

    let isCancelled = false;
    let localStream: MediaStream | null = null;
    let localAudioCtx: AudioContext | null = null;
    let animationFrameId: number | null = null;
    let simAnimId: number | null = null;

    // Synthetic camera stream fallback generator for testing
    const generateFallbackStream = (): MediaStream | null => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        let frame = 0;
        const draw = () => {
          if (isCancelled) return;
          frame++;
          const grad = ctx.createLinearGradient(0, 0, 320, 240);
          grad.addColorStop(0, "#090d16");
          grad.addColorStop(1, "#1e1b4b");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 320, 240);

          // Grid
          ctx.strokeStyle = "rgba(99, 102, 241, 0.2)";
          ctx.lineWidth = 1;
          for (let x = 20; x < 320; x += 25) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 240);
            ctx.stroke();
          }
          for (let y = 20; y < 240; y += 25) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(320, y);
            ctx.stroke();
          }

          // Candidate Silhouette
          const bob = Math.sin(frame * 0.05) * 3;
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(160, 95 + bob, 38, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(160, 185 + bob, 65, 45, 0, 0, Math.PI);
          ctx.fill();

          // Reticle
          ctx.strokeStyle = "#10b981";
          ctx.lineWidth = 2;
          const scanY = 60 + ((frame * 2) % 120);
          ctx.beginPath();
          ctx.moveTo(110, scanY);
          ctx.lineTo(210, scanY);
          ctx.stroke();

          // Face Box
          ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(115, 50 + bob, 90, 100);

          simAnimId = requestAnimationFrame(draw);
        };
        draw();

        return canvas.captureStream ? canvas.captureStream(25) : null;
      } catch {
        return null;
      }
    };

    async function initMedia() {
      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },
          audio: true,
        });
        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setHasCameraPermission(true);
        setHasMicPermission(true);
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 320 }, height: { ideal: 240 } },
            audio: false,
          });
          if (isCancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          setHasCameraPermission(true);
          setHasMicPermission(false);
        } catch {
          const simStream = generateFallbackStream();
          if (simStream && !isCancelled) {
            stream = simStream;
            setHasCameraPermission(true);
            setHasMicPermission(false);
          } else {
            setHasCameraPermission(false);
            setHasMicPermission(false);
          }
        }
      }

      if (stream) {
        localStream = stream;
        mediaStreamRef.current = stream;

        // Monitor camera track status — IF CAMERA IS MUTED / ENDED / DISABLED DIRECT CANCEL TEST
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const vTrack = videoTracks[0];
          vTrack.onended = () => {
            enforceCategoryRuleRef.current("CAMERA_DISABLED", "Webcam stream track was disconnected or stopped.");
          };
          vTrack.onmute = () => {
            enforceCategoryRuleRef.current("CAMERA_DISABLED", "Camera feed was muted/disabled by device.");
          };
        }

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Audio Analyzer
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioCtx) {
              const audioCtx = new AudioCtx();
              localAudioCtx = audioCtx;
              audioContextRef.current = audioCtx;
              const source = audioCtx.createMediaStreamSource(stream);
              const analyser = audioCtx.createAnalyser();
              analyser.fftSize = 64;
              source.connect(analyser);
              analyserRef.current = analyser;

              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              const checkAudio = () => {
                if (!analyserRef.current || isCancelled) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                const sum = dataArray.reduce((a, b) => a + b, 0);
                const avg = sum / dataArray.length;
                setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));

                if (avg > 88) {
                  setAudioSpikes((c) => c + 1);
                }

                if (!isCancelled) {
                  animationFrameId = requestAnimationFrame(checkAudio);
                }
              };
              animationFrameId = requestAnimationFrame(checkAudio);
            }
          } catch {
            // non-blocking
          }
        }
      }
    }

    initMedia();

    // Periodic Continuous Photo Capture every 2 seconds for report evidence
    const periodicSnapshotInterval = setInterval(() => {
      if (mediaStreamRef.current) {
        captureSnapshotRef.current("2S_PHOTO_RECORD");
      }
    }, 2000);

    return () => {
      isCancelled = true;
      clearInterval(periodicSnapshotInterval);
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      if (simAnimId !== null) cancelAnimationFrame(simAnimId);
      if (localStream) localStream.getTracks().forEach((track) => track.stop());
      if (localAudioCtx && localAudioCtx.state !== "closed") localAudioCtx.close().catch(() => {});
    };
  }, [isActive]);

  // 2. Real-Time MediaPipe Face Landmarker Biometric Engine
  useEffect(() => {
    if (!isActive) return;

    let isCancelled = false;
    let animationFrameId: number | null = null;
    const engine = new FaceProctoringEngine({
      faceAbsentDurationMs: 1400,
      multipleFacesDurationMs: 1800,
      lookingAwayDurationMs: 3200,
      yawThresholdDeg: 28,
      pitchDownThresholdDeg: 24,
      pitchUpThresholdDeg: -20,
      cooldownMs: 4000,
      inferenceIntervalMs: 100,
    });
    engineRef.current = engine;

    // Connect authoritative MediaPipe violation events to category warning enforcer
    engine.onViolation((evt: FaceViolationEvent) => {
      if (isCancelled || isTerminatedRef.current) return;

      if (evt.type === "FACE_ABSENT") {
        enforceCategoryRuleRef.current(
          "FACE_ABSENT",
          "Face not detected in camera view for sustained period. Please look directly into the camera."
        );
      } else if (evt.type === "MULTIPLE_FACES") {
        enforceCategoryRuleRef.current(
          "MULTIPLE_FACES",
          `Multiple faces (${evt.metadata.face_count || 2}) detected in the testing environment.`
        );
      } else if (evt.type === "PROLONGED_LOOK_AWAY" || evt.type === "HEAD_POSE_ANOMALY") {
        enforceCategoryRuleRef.current(
          "GAZE_DEVIATION",
          "Eyes/head looking away from screen detected. Please keep your focus on the assessment."
        );
      } else if (evt.type === "PHONE_DETECTED") {
        triggerImmediateCancellationRef.current(
          "Unauthorized Mobile Phone / Electronic Device detected in webcam feed. Assessment cancelled and disqualified without submission.",
          "PHONE_DETECTED"
        );
      }
    });

    // Initialize the WebAssembly & GPU Vision model
    engine.initialize().then((ready) => {
      if (!isCancelled) {
        setFaceState((prev) => ({
          ...prev,
          isModelReady: ready,
          modelError: ready ? null : "Vision model initialization issue",
        }));
      }
    });

    // High-performance requestAnimationFrame loop with timestamp throttling
    let lastStateUpdate = 0;
    const runVisionProcessing = (timestamp: number) => {
      if (isCancelled || isTerminatedRef.current) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
        const state = engine.processFrame(video, timestamp);

        if (state.isPhoneDetected) {
          triggerImmediateCancellationRef.current(
            "Unauthorized Mobile Phone / Electronic Device detected by camera. Assessment cancelled immediately.",
            "PHONE_DETECTED"
          );
        }

        // Throttle React state updates to ~5 FPS to keep CPU usage low
        if (timestamp - lastStateUpdate > 200) {
          lastStateUpdate = timestamp;
          setFaceState(state);
        }
      }

      animationFrameId = requestAnimationFrame(runVisionProcessing);
    };

    animationFrameId = requestAnimationFrame(runVisionProcessing);

    return () => {
      isCancelled = true;
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
      engine.dispose();
      engineRef.current = null;
    };
  }, [isActive, isTerminated]);

  // 3. Fullscreen & Tab/Window Switching Watcher
  useEffect(() => {
    if (!isActive) return;

    requestFullscreen();

    const handleFullscreenChange = () => {
      const isFull = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull) {
        enforceCategoryRuleRef.current(
          "FULLSCREEN",
          "Fullscreen mode was exited. Fullscreen is mandatory during the assessment."
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        enforceCategoryRuleRef.current(
          "TAB_SWITCH",
          "Tab switch or browser minimization detected."
        );
      }
    };

    const handleWindowBlur = () => {
      const now = Date.now();
      // 1. If explicit screenshot hotkey was recorded in the last 3500ms, suppress tab switch
      if (now - lastScreenshotAttemptTimeRef.current < 3500) {
        return;
      }
      // 2. If window lost focus right after Win or Shift key (e.g. Win+Shift+S Snipping Tool invocation intercepted by OS)
      if (now - lastMetaOrShiftKeyTimeRef.current < 1200) {
        lastScreenshotAttemptTimeRef.current = now;
        enforceCategoryRuleRef.current(
          "SCREENSHOT",
          "Screen capture / Snipping Tool window overlay detected."
        );
        return;
      }
      // 3. Otherwise standard tab or window switch
      enforceCategoryRuleRef.current(
        "TAB_SWITCH",
        "Assessment window lost focus (switched to another window or application)."
      );
    };

    // DevTools Detection
    const checkDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      if (widthThreshold || heightThreshold) {
        enforceCategoryRuleRef.current(
          "SCREENSHOT",
          "Developer tools or external inspection window open."
        );
      }
    };

    window.addEventListener("resize", checkDevTools);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("resize", checkDevTools);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [isActive, requestFullscreen]);

  // 4. Screenshot / Snipping / PrintScreen Key Listener + Keystroke Cadence
  useEffect(() => {
    if (!isActive) return;

    let lastReportUpdateTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      lastActivityTimeRef.current = Date.now();

      if (e.key === "Meta" || e.key === "OS" || e.key === "Shift" || e.metaKey || e.ctrlKey || e.altKey) {
        lastMetaOrShiftKeyTimeRef.current = Date.now();
      }

      // Track dwell time start
      if (!keydownTimesRef.current.has(e.code)) {
        keydownTimesRef.current.set(e.code, now);
      }

      // Track flight time
      if (lastKeyupTimeRef.current !== null) {
        const flightTime = Math.max(10, Math.min(1000, Math.round(now - lastKeyupTimeRef.current)));
        flightTimesRef.current.push(flightTime);
        if (flightTimesRef.current.length > 50) flightTimesRef.current.shift();
      }

      keystrokeCountRef.current += 1;
      setLiveKeystrokes(keystrokeCountRef.current);

      if (e.key === "Backspace") backspaceCountRef.current += 1;
      if (e.key === "Delete") deleteCountRef.current += 1;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key ? e.key.toLowerCase() : "";

      // RULE: SCREENSHOT / SNIPPING / PRINTSCREEN DETECTION (Max 2 Warnings)
      const isPrintScreen = e.key === "PrintScreen" || e.code === "PrintScreen" || e.key === "Snapshot";
      const isSnippingTool = (isCtrlOrCmd || e.metaKey) && e.shiftKey && (key === "s" || key === "3" || key === "4");
      const isPrintAttempt = isCtrlOrCmd && (key === "p" || key === "prnt");

      if (isPrintScreen || isSnippingTool || isPrintAttempt) {
        e.preventDefault();
        e.stopPropagation();
        lastScreenshotAttemptTimeRef.current = Date.now();
        shortcutAttemptsRef.current += 1;
        enforceCategoryRuleRef.current(
          "SCREENSHOT",
          "Screenshot, PrintScreen, or Screen Snipping attempt detected."
        );
        return;
      }

      // DevTools Inspect F12
      if (e.key === "F12" || (isCtrlOrCmd && e.shiftKey && (key === "i" || key === "j" || key === "c"))) {
        e.preventDefault();
        shortcutAttemptsRef.current += 1;
        enforceCategoryRuleRef.current("SCREENSHOT", "Developer inspection shortcut blocked.");
        return;
      }

      // Copy / Cut / Paste shortcuts
      if (isCtrlOrCmd && (key === "c" || key === "v" || key === "x")) {
        e.preventDefault();
        shortcutAttemptsRef.current += 1;
        if (key === "v") {
          instantPasteCountRef.current += 1;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const now = performance.now();
      lastKeyupTimeRef.current = now;

      if (e.key === "Meta" || e.key === "OS" || e.key === "Shift" || e.metaKey || e.ctrlKey || e.altKey) {
        lastMetaOrShiftKeyTimeRef.current = Date.now();
      }

      // Check PrintScreen on KeyUp as Windows OS often sends PrintScreen on key release
      if (e.key === "PrintScreen" || e.code === "PrintScreen" || e.key === "Snapshot") {
        e.preventDefault();
        lastScreenshotAttemptTimeRef.current = Date.now();
        shortcutAttemptsRef.current += 1;
        enforceCategoryRuleRef.current("SCREENSHOT", "PrintScreen key capture attempt detected.");
      }

      const keyDownTime = keydownTimesRef.current.get(e.code);
      if (keyDownTime !== undefined) {
        const dwellTime = Math.max(10, Math.min(1000, Math.round(now - keyDownTime)));
        dwellTimesRef.current.push(dwellTime);
        if (dwellTimesRef.current.length > 50) dwellTimesRef.current.shift();
        keydownTimesRef.current.delete(e.code);
      }

      // Update live HUD
      const metrics = computeKeystrokeMetricsRef.current();
      setLiveWpm(metrics.wpm ?? 0);
      setLiveCadenceScore(metrics.rhythm_consistency ?? 95);

      // Throttle parent report sync
      const timeSinceLastUpdate = Date.now() - lastReportUpdateTime;
      if (timeSinceLastUpdate > 2500) {
        lastReportUpdateTime = Date.now();
        onReportUpdateRef.current?.(generateReportRef.current());
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      instantPasteCountRef.current += 1;
      bulkInsertionsCountRef.current += 1;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("paste", handlePaste, true);
    window.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("paste", handlePaste, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Floating Security Warning Banner with Category & Warning Counter */}
      <AnimatePresence>
        {recentViolationWarning && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000000] px-5 py-3 rounded-2xl bg-red-950/95 border-2 border-red-500 shadow-2xl backdrop-blur-md flex items-center gap-3.5 text-red-100 text-xs font-medium max-w-xl"
          >
            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-400 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-red-300 uppercase tracking-wider text-[10.5px]">
                  {recentViolationWarning.category.replace("_", " ")} WARNING
                </span>
                <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-red-500/30 text-red-200 border border-red-400/50">
                  {recentViolationWarning.warningNum} / {recentViolationWarning.maxWarnings} WARNINGS
                </span>
              </div>
              <p className="text-xs text-red-200 leading-snug mt-0.5">
                {recentViolationWarning.message}
              </p>
              <p className="text-[10px] text-red-400 font-mono mt-0.5">
                {recentViolationWarning.warningNum >= recentViolationWarning.maxWarnings
                  ? "FINAL WARNING: Next violation will auto-submit the exam."
                  : `1 warning remaining before automatic test submission.`}
              </p>
            </div>
            <button
              onClick={() => setRecentViolationWarning(null)}
              className="text-red-400 hover:text-white text-xs px-2 py-1 rounded bg-red-900/50 hover:bg-red-800 transition cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-Submit Terminal Modal */}
      {isTerminated && (
        <div className="fixed inset-0 z-[1000005] bg-red-950/90 backdrop-blur-lg flex items-center justify-center p-6 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border-2 border-red-500 rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-white">Assessment Auto-Submitted</h2>
            <p className="text-xs text-red-300 leading-relaxed">
              {terminationReason || "Security integrity limit was breached. Test responses have been saved and finalized."}
            </p>
            <div className="p-3 bg-black/40 rounded-xl font-mono text-xs text-slate-400 text-left space-y-1">
              <p>• Fullscreen Exits: {fullscreenExits}/2</p>
              <p>• Screenshot Attempts: {screenshotAttempts}/2</p>
              <p>• Face In View: {faceAbsenceCount}/2</p>
              <p>• Eyes On Screen: {gazeDeviationCount}/2</p>
              <p>• Tab/Window Switches: {tabSwitches}/2</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Right-Middle Picture-in-Picture Proctoring HUD */}
      <motion.div
        drag
        dragConstraints={{ left: -600, right: 100, top: -250, bottom: 250 }}
        className="fixed right-6 top-1/2 -translate-y-1/2 z-[100000] w-64 bg-slate-900/95 border border-indigo-500/30 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden"
      >
        {/* Top Mini Status Bar */}
        <div className="bg-slate-950/90 px-3 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono cursor-move select-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                !faceState.isModelReady
                  ? "bg-amber-400 animate-pulse"
                  : faceState.multipleFaces
                  ? "bg-red-500 animate-ping"
                  : faceState.faceDetected
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-amber-400"
              }`}
            />
            <span className="text-slate-300 font-semibold text-[10.5px]">
              {!faceState.isModelReady
                ? "Loading Vision Model..."
                : faceState.multipleFaces
                ? "Multiple Faces!"
                : faceState.isLookingAway
                ? "Gaze Warning"
                : faceState.faceDetected
                ? "Face: Verified"
                : "No Face Detected"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              MediaPipe AI
            </span>
            <button
              type="button"
              onClick={() => setIsHudCollapsed((prev) => !prev)}
              className="text-slate-400 hover:text-white text-[10px] px-1 py-0.5 rounded bg-slate-800 cursor-pointer"
              title={isHudCollapsed ? "Expand proctoring HUD" : "Collapse proctoring HUD"}
            >
              {isHudCollapsed ? "▼" : "▲"}
            </button>
          </div>
        </div>

        {!isHudCollapsed && (
          <>
            {/* Live Video Feed PiP */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && mediaStreamRef.current && el.srcObject !== mediaStreamRef.current) {
                    el.srcObject = mediaStreamRef.current;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  (e.currentTarget as HTMLVideoElement).play().catch(() => {});
                }}
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  hasCameraPermission ? "block" : "hidden"
                }`}
              />
              {!hasCameraPermission && (
                <div className="flex flex-col items-center justify-center text-slate-400 gap-1 text-xs p-3 text-center">
                  <CameraOff className="w-5 h-5 text-amber-400 animate-pulse" />
                  <span className="text-[10px]">Camera Inactive / Initializing</span>
                </div>
              )}

              {/* MediaPipe Active Reticle */}
              {hasCameraPermission && (
                <div className="absolute inset-0 pointer-events-none border border-indigo-500/10 rounded-lg flex items-center justify-center">
                  <div
                    className={`w-14 h-14 border rounded-full transition-colors ${
                      faceState.multipleFaces
                        ? "border-red-500/80 bg-red-500/10 animate-ping"
                        : faceState.isLookingAway
                        ? "border-amber-400/80 bg-amber-400/10 animate-pulse"
                        : faceState.faceDetected
                        ? "border-emerald-400/50 bg-emerald-400/5"
                        : "border-dashed border-indigo-400/40 animate-pulse"
                    }`}
                  />
                  {faceState.faceDetected && (
                    <div className="absolute top-1.5 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur font-mono text-[9px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      <span>1 Face Tracked</span>
                    </div>
                  )}
                  {faceState.multipleFaces && (
                    <div className="absolute top-1.5 right-2 px-1.5 py-0.5 rounded bg-red-950/80 border border-red-500/50 backdrop-blur font-mono text-[9px] text-red-400 flex items-center gap-1">
                      <span>{faceState.faceCount} Faces in Frame</span>
                    </div>
                  )}
                </div>
              )}

              {/* Audio Waveform Meter */}
              <div className="absolute bottom-1.5 left-2 right-2 flex items-center gap-1.5 bg-black/70 backdrop-blur px-2 py-0.5 rounded text-[10px] text-slate-300">
                {hasMicPermission ? (
                  <Mic className="w-3 h-3 text-indigo-400 shrink-0" />
                ) : (
                  <MicOff className="w-3 h-3 text-slate-500 shrink-0" />
                )}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all duration-75"
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                <span className="font-mono text-[9px] w-6 text-right text-indigo-300">{audioLevel}%</span>
              </div>
            </div>

            {/* Invariant Warning Limits Live Table */}
            <div className="p-2.5 bg-slate-900 border-t border-slate-800 text-[10.5px] space-y-1.5 font-mono">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between pb-1 border-b border-slate-800">
                <span>Rule Enforcement</span>
                <span>Warnings</span>
              </div>

              {/* Fullscreen */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Maximize2 className="w-3 h-3 text-indigo-400" /> Fullscreen Mode
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    fullscreenExits === 0
                      ? "text-emerald-400 bg-emerald-500/10"
                      : fullscreenExits === 1
                      ? "text-amber-400 bg-amber-500/10 animate-pulse"
                      : "text-red-400 bg-red-500/20 animate-bounce"
                  }`}
                >
                  {fullscreenExits} / 2
                </span>
              </div>

              {/* Screenshot */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <ScreenIcon className="w-3 h-3 text-indigo-400" /> Screenshots / Snipping
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    screenshotAttempts === 0
                      ? "text-emerald-400 bg-emerald-500/10"
                      : screenshotAttempts === 1
                      ? "text-amber-400 bg-amber-500/10 animate-pulse"
                      : "text-red-400 bg-red-500/20 animate-bounce"
                  }`}
                >
                  {screenshotAttempts} / 2
                </span>
              </div>

              {/* Face Presence */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <UserX className="w-3 h-3 text-indigo-400" /> Face In View (Absence)
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    faceAbsenceCount === 0
                      ? "text-emerald-400 bg-emerald-500/10"
                      : faceAbsenceCount === 1
                      ? "text-amber-400 bg-amber-500/10 animate-pulse"
                      : "text-red-400 bg-red-500/20 animate-bounce"
                  }`}
                >
                  {faceAbsenceCount} / 2
                </span>
              </div>

              {/* Multiple Faces */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <UserX className="w-3 h-3 text-indigo-400" /> Multiple Faces Detection
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    multipleFacesCount === 0
                      ? "text-emerald-400 bg-emerald-500/10"
                      : multipleFacesCount === 1
                      ? "text-amber-400 bg-amber-500/10 animate-pulse"
                      : "text-red-400 bg-red-500/20 animate-bounce"
                  }`}
                >
                  {multipleFacesCount} / 2
                </span>
              </div>

              {/* Eyes Gaze */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Eye className="w-3 h-3 text-indigo-400" /> Eyes / Gaze On Screen
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    gazeDeviationCount === 0
                      ? "text-emerald-400 bg-emerald-500/10"
                      : gazeDeviationCount === 1
                      ? "text-amber-400 bg-amber-500/10 animate-pulse"
                      : "text-red-400 bg-red-500/20 animate-bounce"
                  }`}
                >
                  {gazeDeviationCount} / 2
                </span>
              </div>

              {/* Tab/Window Switch */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Layers className="w-3 h-3 text-indigo-400" /> Tab / Window Switch
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    tabSwitches === 0
                      ? "text-emerald-400 bg-emerald-500/10"
                      : tabSwitches === 1
                      ? "text-amber-400 bg-amber-500/10 animate-pulse"
                      : "text-red-400 bg-red-500/20 animate-bounce"
                  }`}
                >
                  {tabSwitches} / 2
                </span>
              </div>

              {/* Camera Connection */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Camera className="w-3 h-3 text-cyan-400" /> Camera Feed Status:
                </span>
                <span className="text-cyan-300 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Direct Cancel If Off
                </span>
              </div>

              {/* Keystroke Real-Time Rate */}
              <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Keyboard className="w-3 h-3 text-indigo-400" /> {liveWpm} WPM
                </span>
                <span className="font-mono text-slate-300">{liveKeystrokes} Keys</span>
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3 text-emerald-400" /> {liveCadenceScore}%
                </span>
              </div>

              {!isFullscreen && (
                <button
                  type="button"
                  onClick={requestFullscreen}
                  className="w-full mt-1.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-semibold flex items-center justify-center gap-1 hover:bg-amber-500/25 transition cursor-pointer"
                >
                  <Maximize2 className="w-3 h-3" /> Re-enter Fullscreen
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
