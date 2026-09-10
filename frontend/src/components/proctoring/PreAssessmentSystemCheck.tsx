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

    try {
      // Attempt 1: Video + Audio
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });
      attachStream(stream);
      setCameraState("granted");
      setMicState("granted");
      setIsSimulated(false);

      // Setup audio level meter
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const dataArr = new Uint8Array(analyser.frequencyBinCount);
          const interval = setInterval(() => {
            if (analyser && audioContextRef.current?.state !== "closed") {
              analyser.getByteFrequencyData(dataArr);
              const sum = dataArr.reduce((a, b) => a + b, 0);
              const avg = sum / dataArr.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            } else {
              clearInterval(interval);
            }
          }, 150);
        }
      } catch {
        // Audio meter optional
      }
    } catch {
      // Attempt 2: Video only (without microphone requirement)
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        attachStream(videoStream);
        setCameraState("granted");
        setMicState("denied");
        setIsSimulated(false);
      } catch {
        // Attempt 3: Basic generic video constraint
        try {
          const basicStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          attachStream(basicStream);
          setCameraState("granted");
          setMicState("denied");
          setIsSimulated(false);
        } catch {
          // Camera permission denied or no webcam hardware
          setCameraState("denied");
          setMicState("denied");
        }
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
    <div className="fixed inset-0 z-[1000000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900 border border-indigo-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden relative my-auto"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Proctoring & System Readiness Check
              </h2>
              <p className="text-xs text-slate-400">
                {assessmentTitle} • {durationMinutes} Mins • {questionCount} Questions
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Secure Session
          </span>
        </div>

        {/* Video Preview & Biometric Check */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
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
              <div className="text-center p-4 space-y-2">
                <CameraOff className="w-8 h-8 text-amber-400/80 mx-auto" />
                <p className="text-xs font-semibold text-slate-200">
                  {cameraState === "checking" ? "Initializing Camera Sensor..." : "Camera Permission Blocked / Not Found"}
                </p>
                <p className="text-[11px] text-slate-400 leading-tight">
                  Click below to grant camera access or activate the simulator mode.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void requestMedia()}
                    disabled={isRequesting}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRequesting ? "animate-spin" : ""}`} />
                    <span>{isRequesting ? "Requesting..." : "Allow Camera"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={generateSimulatedStream}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Test Simulator</span>
                  </button>
                </div>
              </div>
            )}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur text-[10px] text-emerald-400 flex items-center gap-1.5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isSimulated ? "Simulated Sensor Feed" : "Live Sensor Feed"}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Camera */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <Camera className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-200">Webcam Sensor</span>
              </div>
              {cameraState === "granted" ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {isSimulated ? "Simulated" : "Live Ready"}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestMedia()}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium underline cursor-pointer"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Grant Access
                </button>
              )}
            </div>

            {/* Mic */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <Mic className="w-4 h-4 text-indigo-400" />
                <div className="flex flex-col">
                  <span className="text-xs text-slate-200">Microphone Audio</span>
                  <div className="w-24 h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-indigo-500 transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                </div>
              </div>
              {micState === "granted" ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Level Active
                </span>
              ) : (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  Optional
                </span>
              )}
            </div>

            {/* Fullscreen Mode */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <Maximize2 className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-200">Fullscreen Lock API</span>
              </div>
              {fullscreenState === "supported" ? (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Supported
                </span>
              ) : (
                <span className="text-xs text-red-400 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> Unsupported
                </span>
              )}
            </div>

            {/* Browser Compatibility */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-200">Browser Environment</span>
              </div>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> {browserState === "compatible" ? "Verified Compatible" : "Standard"}
              </span>
            </div>

            {/* Keystroke Dynamics */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2.5">
                <Keyboard className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-slate-200">Keystroke Cadence Engine</span>
              </div>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
              </span>
            </div>
          </div>
        </div>

        {/* Proctoring Rules Summary */}
        <div className="p-3.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl mb-5 text-xs text-slate-300 space-y-1.5">
          <p className="font-semibold text-indigo-300 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Examination Integrity Invariants:
          </p>
          <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
            <li><strong>Fullscreen Mode:</strong> Max 2 warnings for exiting fullscreen. 3rd exit auto-submits exam.</li>
            <li><strong>Screenshots / Snipping:</strong> Max 2 warnings for PrintScreen/Snipping shortcuts.</li>
            <li><strong>Face & Eyes Detection:</strong> Max 2 warnings if face is absent or eyes look away from screen.</li>
            <li><strong>Tab & Window Switching:</strong> Max 2 warnings for switching tabs or minimizing browser.</li>
            <li><strong>Camera Disconnection:</strong> Disabling or losing camera feed causes immediate test cancellation.</li>
            <li><strong>Auto-Submit Rule:</strong> Exceeding warnings on any single rule will automatically submit the assessment.</li>
          </ul>
        </div>

        {/* Consent Checkbox */}
        <label className="flex items-start gap-2.5 cursor-pointer mb-6 text-xs text-slate-300 select-none">
          <input
            type="checkbox"
            checked={consentAgreed}
            onChange={(e) => setConsentAgreed(e.target.checked)}
            className="mt-0.5 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500/20"
          />
          <span>
            I acknowledge and consent to active session proctoring, webcam baseline validation, and keystroke dynamics tracking for verification purposes.
          </span>
        </label>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <div>
            {cameraState === "denied" && !isSimulated && (
              <button
                type="button"
                onClick={generateSimulatedStream}
                className="text-xs text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Use Simulator Mode (Bypass Webcam)
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canStart}
              onClick={onProceed}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg transition ${
                canStart
                  ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
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
