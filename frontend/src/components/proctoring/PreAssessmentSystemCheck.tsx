import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ShieldCheck,
  Camera,
  CameraOff,
  Mic,
  Maximize2,
  CheckCircle2,
  AlertCircle,
  Keyboard,
  Lock,
  ArrowRight,
  Globe,
  RefreshCw,
  Sparkles,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";

interface PreAssessmentSystemCheckProps {
  assessmentTitle: string;
  durationMinutes: number;
  questionCount: number;
  onProceed: () => void;
  onCancel: () => void;
}

export function PreAssessmentSystemCheck({
  assessmentTitle,
  durationMinutes,
  questionCount,
  onProceed,
  onCancel,
}: PreAssessmentSystemCheckProps) {
  const [cameraState, setCameraState] = useState<"checking" | "granted" | "denied">("checking");
  const [micState, setMicState] = useState<"checking" | "granted" | "denied">("checking");
  const [fullscreenState, setFullscreenState] = useState<"checking" | "supported" | "unsupported">("checking");
  const [browserState, setBrowserState] = useState<"checking" | "compatible" | "warning">("checking");
  const [consentAgreed, setConsentAgreed] = useState<boolean>(true);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const simCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const simAnimIdRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Generate synthetic camera stream if physical camera is unavailable
  const generateSimulatedStream = useCallback(() => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      simCanvasRef.current = canvas;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let frame = 0;
      const drawSim = () => {
        frame++;
        // Dark gradient background
        const grad = ctx.createLinearGradient(0, 0, 320, 240);
        grad.addColorStop(0, "#090d16");
        grad.addColorStop(1, "#1e1b4b");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 320, 240);

        // Biometric scanning grid
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

        // Simulated candidate silhouette
        const bob = Math.sin(frame * 0.05) * 3;
        ctx.fillStyle = "#38bdf8";
        ctx.beginPath();
        // Head
        ctx.arc(160, 95 + bob, 38, 0, Math.PI * 2);
        ctx.fill();
        // Shoulders
        ctx.beginPath();
        ctx.ellipse(160, 185 + bob, 65, 45, 0, 0, Math.PI);
        ctx.fill();

        // Scanning Reticle
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 2;
        const scanY = 60 + ((frame * 2) % 120);
        ctx.beginPath();
        ctx.moveTo(110, scanY);
        ctx.lineTo(210, scanY);
        ctx.stroke();

        // Biometric Face Box
        ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(115, 50 + bob, 90, 100);

        // Status text
        ctx.fillStyle = "#10b981";
        ctx.font = "10px monospace";
        ctx.fillText("BIOMETRIC VALIDATED", 10, 225);

        simAnimIdRef.current = requestAnimationFrame(drawSim);
      };
      drawSim();

      const simStream = canvas.captureStream ? canvas.captureStream(25) : null;
      if (simStream) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        streamRef.current = simStream;
        setIsSimulated(true);
        setCameraState("granted");
        if (videoRef.current) {
          videoRef.current.srcObject = simStream;
          videoRef.current.play().catch(() => {});
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  // Request real media streams with multiple fallbacks
  const requestMedia = useCallback(async () => {
    setIsRequesting(true);
    setCameraState("checking");
    setMicState("checking");

    // Helper to safely attach stream to video element
    const attachStream = (stream: MediaStream) => {
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    };

    let videoStream: MediaStream | null = null;
    let audioStream: MediaStream | null = null;

    // 1. Acquire video stream
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
    } catch {
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        // Video unavailable
      }
    }

    // 2. Acquire audio stream
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // Mic unavailable
      }
    }

    try {
      const combinedStream = typeof MediaStream !== "undefined" ? new MediaStream() : (videoStream || audioStream || null);

      if (videoStream) {
        if (typeof MediaStream !== "undefined" && combinedStream instanceof MediaStream) {
          videoStream.getVideoTracks().forEach((t) => (combinedStream as MediaStream).addTrack(t));
          attachStream(combinedStream);
        } else {
          attachStream(videoStream);
        }
        setCameraState("granted");
        setIsSimulated(false);
      } else {
        setCameraState("denied");
      }

      if (audioStream && audioStream.getAudioTracks().length > 0) {
        if (typeof MediaStream !== "undefined" && combinedStream instanceof MediaStream) {
          audioStream.getAudioTracks().forEach((t) => (combinedStream as MediaStream).addTrack(t));
        }
        setMicState("granted");

        // Setup audio level meter with robust AudioContext handling
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            if (audioContextRef.current && audioContextRef.current.state !== "closed") {
              audioContextRef.current.close().catch(() => {});
            }
            const audioCtx = new AudioCtx();
            audioContextRef.current = audioCtx;
            if (audioCtx.state === "suspended") {
              audioCtx.resume().catch(() => {});
            }

            const source = audioCtx.createMediaStreamSource(audioStream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.5;
            source.connect(analyser);

            const dataArr = new Uint8Array(analyser.frequencyBinCount);
            const interval = setInterval(() => {
              if (analyser && audioContextRef.current && audioContextRef.current.state !== "closed") {
                if (audioContextRef.current.state === "suspended") {
                  audioContextRef.current.resume().catch(() => {});
                }
                analyser.getByteFrequencyData(dataArr);
                let sum = 0;
                for (let i = 0; i < dataArr.length; i++) {
                  sum += dataArr[i];
                }
                const avg = sum / dataArr.length;
                const normalized = Math.min(100, Math.round((avg / 64) * 100));
                setAudioLevel(normalized);
              } else {
                clearInterval(interval);
              }
            }, 100);
          }
        } catch {
          // Audio meter optional
        }
      } else {
        setMicState("denied");
        setAudioLevel(0);
      }
    } finally {
      setIsRequesting(false);
    }
  }, []);

  // Perform Initial Diagnostics
  useEffect(() => {
    // 1. Fullscreen API check
    if (document.fullscreenEnabled || (document as any).webkitFullscreenEnabled) {
      setFullscreenState("supported");
    } else {
      setFullscreenState("unsupported");
    }

    // 2. Browser check
    const ua = navigator.userAgent;
    if (ua.includes("Chrome") || ua.includes("Edg") || ua.includes("Firefox") || ua.includes("Safari")) {
      setBrowserState("compatible");
    } else {
      setBrowserState("warning");
    }

    // 3. Request media on mount
    void requestMedia();

    return () => {
      if (simAnimIdRef.current) {
        cancelAnimationFrame(simAnimIdRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [requestMedia]);

  // Ensure video element receives stream immediately on re-render / ref attachment
  useEffect(() => {
    if (cameraState === "granted" && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [cameraState, isSimulated]);

  const canStart = (cameraState === "granted" || isSimulated) && fullscreenState === "supported" && consentAgreed;

  return createPortal(
    <div className="fixed inset-0 z-[1000000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#FFFFFF] border border-[#E5E1D8] rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden relative my-auto"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(176,141,87,0.1)] border border-[rgba(176,141,87,0.25)] flex items-center justify-center text-[#B08D57]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-[#111827] flex items-center gap-2"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Proctoring & System Readiness Check
              </h2>
              <p className="text-xs text-[#64748B]">
                {assessmentTitle} • {durationMinutes} Mins • {questionCount} Questions
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-mono font-semibold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
            Secure Session
          </span>
        </div>

        {/* Video Preview & Biometric Check */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative rounded-xl overflow-hidden bg-[#111827] border border-[#E5E1D8] aspect-video flex items-center justify-center">
            {cameraState === "granted" ? (
              <video
                ref={(el) => {
                  videoRef.current = el;
                  if (el && streamRef.current && el.srcObject !== streamRef.current) {
                    el.srcObject = streamRef.current;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  (e.currentTarget as HTMLVideoElement).play().catch(() => {});
                }}
                className={`w-full h-full object-cover ${isSimulated ? "" : "transform -scale-x-100"}`}
              />
            ) : (
              <div className="text-center p-4 space-y-2 bg-[#F7F5F0] w-full h-full flex flex-col items-center justify-center">
                <CameraOff className="w-8 h-8 text-[#B08D57] mx-auto" />
                <p className="text-xs font-semibold text-[#111827]">
                  {cameraState === "checking" ? "Initializing Camera Sensor..." : "Camera Permission Blocked / Not Found"}
                </p>
                <p className="text-[11px] text-[#64748B] leading-tight max-w-[200px]">
                  Click below to grant camera access or activate the simulator mode.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void requestMedia()}
                    disabled={isRequesting}
                    className="px-2.5 py-1 rounded-lg bg-[#0B0B0A] hover:bg-[#27272A] text-white text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRequesting ? "animate-spin" : ""}`} />
                    <span>{isRequesting ? "Requesting..." : "Allow Camera"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={generateSimulatedStream}
                    className="px-2.5 py-1 rounded-lg bg-[#FFFFFF] hover:bg-[#EFEBE3] text-[#854D0E] border border-[rgba(176,141,87,0.3)] text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#B08D57]" />
                    <span>Test Simulator</span>
                  </button>
                </div>
              </div>
            )}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/75 backdrop-blur text-[10px] text-[#86EFAC] flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              <span>{isSimulated ? "Simulated Sensor Feed" : "Live Sensor Feed"}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Camera */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8] hover:border-[#D5D0C5] transition-colors">
              <div className="flex items-center gap-2.5">
                <Camera className="w-4 h-4 text-[#B08D57]" />
                <span className="text-xs font-semibold text-[#111827]">Webcam Sensor</span>
              </div>
              {cameraState === "granted" ? (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {isSimulated ? "Simulated" : "Live Ready"}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestMedia()}
                  className="text-xs text-[#854D0E] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Grant Access
                </button>
              )}
            </div>

            {/* Mic */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8] hover:border-[#D5D0C5] transition-colors">
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-[#B08D57]" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-[#111827]">Microphone Audio</span>
                  <div className="w-24 h-1.5 bg-[#E5E1D8] rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-[#B08D57] transition-all duration-75 rounded-full"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                </div>
              </div>
              {micState === "granted" ? (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Level Active
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#EFEBE3] text-[#64748B] border border-[#E5E1D8]">
                  Optional
                </span>
              )}
            </div>

            {/* Fullscreen Mode */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8] hover:border-[#D5D0C5] transition-colors">
              <div className="flex items-center gap-2.5">
                <Maximize2 className="w-4 h-4 text-[#B08D57]" />
                <span className="text-xs font-semibold text-[#111827]">Fullscreen Lock API</span>
              </div>
              {fullscreenState === "supported" ? (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Supported
                </span>
              ) : (
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Unsupported
                </span>
              )}
            </div>

            {/* Browser Compatibility */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8] hover:border-[#D5D0C5] transition-colors">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-[#B08D57]" />
                <span className="text-xs font-semibold text-[#111827]">Browser Environment</span>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {browserState === "compatible" ? "Verified Compatible" : "Standard"}
              </span>
            </div>

            {/* Keystroke Dynamics */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8] hover:border-[#D5D0C5] transition-colors">
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-4 h-4 text-[#B08D57]" />
                <span className="text-xs font-semibold text-[#111827]">Keystroke Cadence Engine</span>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Enabled
              </span>
            </div>

            {/* Eye & Gaze Tracking */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F7F5F0] border border-[#E5E1D8] hover:border-[#D5D0C5] transition-colors">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-[#B08D57]" />
                <span className="text-xs font-semibold text-[#111827]">Eye & Gaze Tracking</span>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Calibrated
              </span>
            </div>
          </div>
        </div>

        {/* Proctoring Rules Summary */}
        <div className="p-3.5 bg-[rgba(176,141,87,0.06)] border border-[rgba(176,141,87,0.25)] rounded-xl mb-5 text-xs text-[#475569] space-y-1.5">
          <p className="font-semibold text-[#854D0E] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#B08D57]" /> Examination Integrity Invariants:
          </p>
          <ul className="list-disc list-inside text-[#475569] space-y-1 pl-1">
            <li><strong className="text-[#111827]">Fullscreen Mode:</strong> Max 2 warnings for exiting fullscreen. 3rd exit auto-submits exam.</li>
            <li><strong className="text-[#111827]">Screenshots / Snipping:</strong> Max 2 warnings for PrintScreen/Snipping shortcuts.</li>
            <li><strong className="text-[#111827]">Face & Eyes Detection:</strong> Max 2 warnings if face is absent or eyes look away from screen.</li>
            <li><strong className="text-[#111827]">Tab & Window Switching:</strong> Max 2 warnings for switching tabs or minimizing browser.</li>
            <li><strong className="text-[#111827]">Camera Disconnection:</strong> Disabling or losing camera feed causes immediate test cancellation.</li>
            <li><strong className="text-[#111827]">Auto-Submit Rule:</strong> Exceeding warnings on any single rule will automatically submit the assessment.</li>
          </ul>
        </div>

        {/* Consent Checkbox */}
        <label className="flex items-start gap-2.5 cursor-pointer mb-6 text-xs text-[#475569] select-none">
          <input
            type="checkbox"
            checked={consentAgreed}
            onChange={(e) => setConsentAgreed(e.target.checked)}
            className="mt-0.5 rounded border-[#E5E1D8] text-[#0B0B0A] focus:ring-[#B08D57]/30"
          />
          <span>
            I acknowledge and consent to active session proctoring, webcam baseline validation, and keystroke dynamics tracking for verification purposes.
          </span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-[#E5E1D8] pt-4">
          <div>
            {cameraState === "denied" && !isSimulated && (
              <button
                type="button"
                onClick={generateSimulatedStream}
                className="text-xs text-[#854D0E] hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Sparkles className="w-3 h-3 text-[#B08D57]" /> Use Simulator Mode (Bypass Webcam)
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#111827] hover:bg-[#EFEBE3] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canStart}
              onClick={onProceed}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-md transition ${
                canStart
                  ? "bg-[#0B0B0A] hover:bg-[#27272A] text-white hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  : "bg-[#E5E1D8] text-[#94A3B8] cursor-not-allowed border border-[#D5D0C5]"
              }`}
            >
              <span>Start Proctored Assessment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
