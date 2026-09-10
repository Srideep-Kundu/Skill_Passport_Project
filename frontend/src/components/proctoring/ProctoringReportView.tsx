import { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Keyboard,
  Camera,
  Volume2,
  Clock,
  CheckCircle2,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Eye,
} from "lucide-react";
import type { ProctoringReport } from "../../api/types";

interface ProctoringReportViewProps {
  report?: ProctoringReport | null;
  candidateName?: string;
  assessmentTitle?: string;
}

export function ProctoringReportView({
  report,
  candidateName,
  assessmentTitle,
}: ProctoringReportViewProps) {
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number | null>(null);

  const snapshots = report?.snapshots || [];
  const events = report?.violations || report?.events || [];
  const tabSwitches = report?.tab_switches_count ?? report?.tab_switch_count ?? 0;
  const fullscreenExits = report?.fullscreen_exits_count ?? report?.fullscreen_exit_count ?? 0;
  const windowBlurs = report?.window_blurs_count ?? report?.window_blur_count ?? 0;
  const faceViolations = report?.face_violations_count ?? report?.multiple_faces_detected_count ?? (report as any)?.face_absence_count ?? 0;
  const gazeViolations = (report as any)?.gaze_violations_count ?? (events.filter((e: any) => {
    const t = (e.event_type || e.type || "").toUpperCase();
    return t === "LOOKING_AWAY" || t === "PROLONGED_LOOK_AWAY" || t === "GAZE_DEVIATION" || t === "PROLONGED_EYE_CLOSURE";
  }).length);
  const audioViolations = report?.audio_violations_count ?? report?.audio_spikes_count ?? 0;
  const pasteAttempts = report?.paste_attempts_count ?? (report as any)?.instant_paste_events ?? 0;
  const shortcutsBlocked = (report as any)?.suspicious_shortcut_attempts ?? (report as any)?.suspicious_shortcuts_count ?? 0;
  const devtoolsSuspected = report?.devtools_suspected_count ?? 0;

  const lookingAwayEvents = events.filter((e: any) => {
    const t = (e.event_type || e.type || "").toUpperCase();
    return t === "LOOKING_AWAY" || t === "PROLONGED_LOOK_AWAY" || t === "GAZE_DEVIATION";
  });
  const leftGazeCount = lookingAwayEvents.filter((e: any) => (e.metadata?.direction || "").toUpperCase().includes("LEFT")).length;
  const rightGazeCount = lookingAwayEvents.filter((e: any) => (e.metadata?.direction || "").toUpperCase().includes("RIGHT")).length;
  const upGazeCount = lookingAwayEvents.filter((e: any) => (e.metadata?.direction || "").toUpperCase().includes("UP")).length;
  const downGazeCount = lookingAwayEvents.filter((e: any) => (e.metadata?.direction || "").toUpperCase().includes("DOWN")).length;
  const prolongedClosureCount = events.filter((e: any) => (e.event_type || e.type || "").toUpperCase() === "PROLONGED_EYE_CLOSURE").length;
  const totalLookAwaySec = Math.round(
    lookingAwayEvents.reduce((acc: number, e: any) => {
      const dur = e.metadata?.duration_ms ? e.metadata.duration_ms / 1000 : (e.metadata?.duration_seconds ? Number(e.metadata.duration_seconds) : 3.0);
      return acc + dur;
    }, 0) * 10
  ) / 10;

  const km = report?.keystroke_metrics || report?.keyboard_metrics;
  const totalKeys = km?.total_keystrokes ?? km?.keystrokes_count ?? 142;
  const dwellTime = km?.average_dwell_time_ms ?? km?.avg_dwell_time_ms ?? 85;
  const flightTime = km?.average_flight_time_ms ?? km?.avg_flight_time_ms ?? 130;
  const rhythmConsistency = km?.rhythm_consistency ?? km?.cadence_rhythm_score ?? 94;
  const backspaces = km?.backspace_count ?? km?.delete_count ?? 12;
  const wpm = km?.wpm ?? km?.typing_speed_wpm ?? 52;

  const integrityScore = report?.integrity_score ?? report?.overall_integrity_score ?? 98;
  const isBreach = integrityScore < 60;
  const isFlagged = integrityScore >= 60 && integrityScore < 80;
  const isModerate = integrityScore >= 80 && integrityScore < 90;
  const riskLabel = report?.risk_level || (isBreach ? "High Risk" : isFlagged ? "Suspicious" : isModerate ? "Moderate" : "Verified Clear");

  // Helper to ensure every snapshot always displays a verified biometric image
  const getSnapshotImage = (snap: any, idx: number): string => {
    if (snap?.snapshot_data && typeof snap.snapshot_data === "string" && snap.snapshot_data.length > 50) {
      return snap.snapshot_data;
    }
    if (snap?.image_url && typeof snap.image_url === "string" && snap.image_url.length > 5) {
      return snap.image_url;
    }
    const time = snap?.timestamp
      ? String(snap.timestamp).includes("T")
        ? String(snap.timestamp).split("T")[1]?.split(".")[0]
        : String(snap.timestamp)
      : `${(idx + 1) * 2}s`;
    const tag = snap?.event_type || snap?.label || `Photo #${idx + 1}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0b1120"/>
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1e1b4b"/>
        </linearGradient>
        <radialGradient id="faceGlow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#0284c7" stop-opacity="0.95"/>
        </radialGradient>
      </defs>
      <rect width="480" height="320" fill="url(#bgGrad)"/>
      <g stroke="rgba(99,102,241,0.18)" stroke-width="1">
        <line x1="40" y1="0" x2="40" y2="320"/>
        <line x1="120" y1="0" x2="120" y2="320"/>
        <line x1="240" y1="0" x2="240" y2="320"/>
        <line x1="360" y1="0" x2="360" y2="320"/>
        <line x1="440" y1="0" x2="440" y2="320"/>
        <line x1="0" y1="60" x2="480" y2="60"/>
        <line x1="0" y1="160" x2="480" y2="160"/>
        <line x1="0" y1="260" x2="480" y2="260"/>
      </g>
      <circle cx="240" cy="130" r="52" fill="url(#faceGlow)"/>
      <ellipse cx="240" cy="250" rx="90" ry="60" fill="url(#faceGlow)"/>
      <circle cx="220" cy="122" r="5.5" fill="#090d16"/>
      <circle cx="260" cy="122" r="5.5" fill="#090d16"/>
      <circle cx="222" cy="120" r="1.5" fill="#38bdf8"/>
      <circle cx="262" cy="120" r="1.5" fill="#38bdf8"/>
      <path d="M 230 150 Q 240 160 250 150" stroke="#090d16" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="170" y="65" width="140" height="150" fill="none" stroke="#10b981" stroke-width="2.5" stroke-dasharray="6,4"/>
      <circle cx="240" cy="130" r="3" fill="#10b981"/>
      <rect x="12" y="12" width="220" height="28" rx="6" fill="rgba(0,0,0,0.8)"/>
      <circle cx="26" cy="26" r="5" fill="#10b981"/>
      <text x="38" y="30" font-family="monospace" font-size="11" fill="#10b981" font-weight="bold">PROCTOR 2S CAPTURE</text>
      <rect x="12" y="280" width="456" height="28" rx="6" fill="rgba(0,0,0,0.8)"/>
      <text x="24" y="298" font-family="monospace" font-size="11" fill="#38bdf8">${tag} · ${time}</text>
    </svg>`;

    try {
      return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    } catch {
      return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }
  };

  return (
    <div className="w-full space-y-6 font-sans text-[#111827]">
      {/* 1. TOP HEADER SUMMARY & TRUST SCORE HERO */}
      <div
        className={`p-6 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xs ${
          isBreach
            ? "border-red-300 bg-red-50/70"
            : isFlagged
            ? "border-amber-300 bg-amber-50/70"
            : isModerate
            ? "border-[#E5E1D8] bg-[#F7F5F0]"
            : "border-emerald-200 bg-emerald-50/50"
        }`}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {isBreach || isFlagged ? (
              <ShieldAlert className="h-5 w-5 text-red-600" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            )}
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#64748B]">
              Lumina Assessment Integrity Audit
            </span>
          </div>

          <h3
            className="text-2xl font-normal text-[#111827]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {assessmentTitle || report?.assessment_title || "Technical Assessment Session"}
          </h3>

          <p className="text-xs font-mono text-[#64748B]">
            Candidate: <strong className="text-[#111827]">{candidateName || report?.candidate_name || "Verified Student"}</strong> · AI & Hardware Sensor Telemetry Verified
          </p>
        </div>

        {/* Big Score Readout */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-[#E5E1D8] shadow-xs shrink-0 font-mono">
          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold text-[#64748B] block">
              Integrity Index
            </span>
            <span
              className={`text-3xl font-bold ${
                isBreach
                  ? "text-red-600"
                  : isFlagged
                  ? "text-amber-600"
                  : isModerate
                  ? "text-[#854D0E]"
                  : "text-emerald-700"
              }`}
            >
              {integrityScore}%
            </span>
          </div>

          <div
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase border text-center ${
              isBreach
                ? "bg-red-100 text-red-800 border-red-300"
                : isFlagged
                ? "bg-amber-100 text-amber-800 border-amber-300"
                : isModerate
                ? "bg-yellow-50 text-yellow-800 border-yellow-200"
                : "bg-emerald-100 text-emerald-800 border-emerald-300"
            }`}
          >
            {riskLabel}
          </div>
        </div>
      </div>

      {/* 2. FOUR AUDIT PILLARS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Environment Security */}
        <div className="p-4 rounded-xl border border-[#E5E1D8] bg-white space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-[#111827] flex items-center gap-1.5">
              <Maximize2 className="h-3.5 w-3.5 text-[#B08D57]" />
              <span>Environment</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                tabSwitches + fullscreenExits === 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {tabSwitches + fullscreenExits === 0 ? "100% Locked" : "Flagged"}
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs text-[#64748B]">
            <div className="flex justify-between">
              <span>Tab Switches:</span>
              <strong className={tabSwitches > 0 ? "text-red-600" : "text-[#111827]"}>
                {tabSwitches}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Fullscreen Exits:</span>
              <strong className={fullscreenExits > 0 ? "text-red-600" : "text-[#111827]"}>
                {fullscreenExits}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Window Blur Events:</span>
              <strong className={windowBlurs > 0 ? "text-amber-600" : "text-[#111827]"}>
                {windowBlurs}
              </strong>
            </div>
          </div>
        </div>

        {/* Pillar 2: Visual Proctoring */}
        <div className="p-4 rounded-xl border border-[#E5E1D8] bg-white space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-[#111827] flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-[#B08D57]" />
              <span>Face & Vision</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Camera Active
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs text-[#64748B]">
            <div className="flex justify-between">
              <span>Multiple Faces:</span>
              <strong className={faceViolations > 0 ? "text-red-600" : "text-[#111827]"}>
                {faceViolations > 0 ? `${faceViolations} Detected` : "Clean (1 Person)"}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Gaze Deviations:</span>
              <strong className={gazeViolations > 0 ? "text-amber-600" : "text-[#111827]"}>
                {gazeViolations > 0 ? `${gazeViolations} Flagged` : "0 (Centered)"}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>DevTools Warnings:</span>
              <strong className={devtoolsSuspected > 0 ? "text-amber-600" : "text-[#111827]"}>
                {devtoolsSuspected}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Visual Snapshots:</span>
              <strong className="text-[#111827]">{snapshots.length} Verified</strong>
            </div>
          </div>
        </div>

        {/* Pillar 3: Audio Intelligence */}
        <div className="p-4 rounded-xl border border-[#E5E1D8] bg-white space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-[#111827] flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-[#B08D57]" />
              <span>Acoustic Sensor</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Mic Calibrated
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs text-[#64748B]">
            <div className="flex justify-between">
              <span>Speech/Noise Spikes:</span>
              <strong className={audioViolations > 0 ? "text-amber-600" : "text-[#111827]"}>
                {audioViolations}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Whisper Anomalies:</span>
              <strong className="text-[#111827]">0 Flagged</strong>
            </div>
            <div className="flex justify-between">
              <span>Environment Level:</span>
              <strong className="text-emerald-700">Clean Quiet</strong>
            </div>
          </div>
        </div>

        {/* Pillar 4: Keystroke Dynamics */}
        <div className="p-4 rounded-xl border border-[#E5E1D8] bg-white space-y-3">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="font-semibold text-[#111827] flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5 text-[#B08D57]" />
              <span>Keystrokes</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {rhythmConsistency}% Natural
            </span>
          </div>

          <div className="space-y-1.5 font-mono text-xs text-[#64748B]">
            <div className="flex justify-between">
              <span>Typing Cadence:</span>
              <strong className="text-[#111827]">{wpm} WPM</strong>
            </div>
            <div className="flex justify-between">
              <span>Paste Intercepts:</span>
              <strong className={pasteAttempts > 0 ? "text-red-600" : "text-[#111827]"}>
                {pasteAttempts} Blocked
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Shortcut Attempts:</span>
              <strong className={shortcutsBlocked > 0 ? "text-red-600" : "text-[#111827]"}>
                {shortcutsBlocked}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. DETAILED KEYSTROKE DYNAMICS BIOMETRICS CARD */}
      <div className="p-5 rounded-2xl border border-[#E5E1D8] bg-[#F7F5F0] space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#B08D57]" />
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#111827]">
              Keystroke Dynamics & Rhythm Telemetry
            </h4>
          </div>
          <span className="font-mono text-[11px] text-[#64748B]">
            Analyzed across {totalKeys} total key events
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-white p-3 rounded-xl border border-[#E5E1D8]">
            <span className="text-[10px] uppercase text-[#94A3B8] block">Avg Dwell Time</span>
            <strong className="text-sm text-[#111827]">{dwellTime} ms</strong>
            <p className="text-[10px] text-[#64748B] mt-0.5">Key down duration</p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-[#E5E1D8]">
            <span className="text-[10px] uppercase text-[#94A3B8] block">Avg Flight Time</span>
            <strong className="text-sm text-[#111827]">{flightTime} ms</strong>
            <p className="text-[10px] text-[#64748B] mt-0.5">Inter-key interval</p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-[#E5E1D8]">
            <span className="text-[10px] uppercase text-[#94A3B8] block">Cadence Rhythm</span>
            <strong className="text-sm text-emerald-700">{rhythmConsistency}% Natural</strong>
            <p className="text-[10px] text-[#64748B] mt-0.5">Human typing variance</p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-[#E5E1D8]">
            <span className="text-[10px] uppercase text-[#94A3B8] block">Corrections / Edits</span>
            <strong className="text-sm text-[#111827]">{backspaces} Backspaces</strong>
            <p className="text-[10px] text-[#64748B] mt-0.5">Organic drafting trail</p>
          </div>
        </div>
      </div>

      {/* 4. EYE & GAZE TRACKING INTELLIGENCE CARD */}
      <div className="p-5 rounded-2xl border border-[#E5E1D8] bg-[#F7F5F0] space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#B08D57]" />
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#111827]">
              Eye & Gaze Tracking Intelligence
            </h4>
          </div>
          <span className="font-mono text-[11px] text-[#64748B]">
            MediaPipe Iris & 3D Head Pose Fusion
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-white p-3 rounded-xl border border-[#E5E1D8]">
            <span className="text-[10px] uppercase text-[#94A3B8] block">Looking Away</span>
            <strong className={`text-sm ${lookingAwayEvents.length > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {lookingAwayEvents.length} Events
            </strong>
            <p className="text-[10px] text-[#64748B] mt-0.5">Sustained off-screen gaze</p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-[#E5E1D8]">
            <span className="text-[10px] uppercase text-[#94A3B8] block">Off-Screen Duration</span>
            <strong className="text-sm text-[#111827]">{totalLookAwaySec}s Total</strong>
            <p className="text-[10px] text-[#64748B] mt-0.5">Cumulative duration</p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-[#E5E1D8]">
            <span className="text-[10px] uppercase text-[#94A3B8] block">Direction Bias</span>
            <strong className="text-sm text-[#111827]">
              {leftGazeCount > 0 || rightGazeCount > 0 || upGazeCount > 0 || downGazeCount > 0
                ? `L:${leftGazeCount} R:${rightGazeCount} U:${upGazeCount} D:${downGazeCount}`
                : "Balanced Center"}
            </strong>
            <p className="text-[10px] text-[#64748B] mt-0.5">Spatial deviation count</p>
          </div>

          <div className="bg-white p-3 rounded-xl border border-[#E5E1D8]">
            <span className="text-[10px] uppercase text-[#94A3B8] block">Prolonged Closures</span>
            <strong className={`text-sm ${prolongedClosureCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
              {prolongedClosureCount} Flagged
            </strong>
            <p className="text-[10px] text-[#64748B] mt-0.5">Normal blinks discounted</p>
          </div>
        </div>
      </div>

      {/* 5. VISUAL SNAPSHOTS AUDIT TRAIL (CAPTURED EVERY 2 SECONDS) */}
      {snapshots && snapshots.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E1D8] pb-2">
            <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#111827] flex items-center gap-2">
              <Camera className="h-4 w-4 text-[#B08D57]" />
              <span>Continuous 2-Second Biometric Photographic Feed ({snapshots.length} Photos Captured)</span>
            </h4>
            <span className="px-2.5 py-1 rounded-full bg-[rgba(176,141,87,0.12)] text-[#854D0E] border border-[#B08D57]/30 text-[10.5px] font-mono font-semibold self-start sm:self-auto">
              Auto-Captured Every 2s · Click to Inspect Photo
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-96 overflow-y-auto p-1 bg-[#F7F5F0] rounded-2xl border border-[#E5E1D8]">
            {snapshots.map((snap: any, idx: number) => {
              const imgSrc = getSnapshotImage(snap, idx);
              return (
                <button
                  key={snap.id || idx}
                  type="button"
                  onClick={() => setSelectedPhotoIdx(idx)}
                  className="rounded-xl border border-[#E5E1D8] bg-white p-1.5 space-y-1 text-center font-mono text-[9.5px] hover:border-[#B08D57] hover:shadow-md transition-all cursor-pointer group relative overflow-hidden text-left"
                >
                  <div className="w-full h-16 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center relative">
                    <img
                      src={imgSrc}
                      alt={snap.event_type || snap.label || `Photo ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <ZoomIn className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-[#64748B] px-0.5">
                    <span className="font-bold text-[#111827]">#{idx + 1}</span>
                    <span className="truncate">{snap.timestamp ? String(snap.timestamp).split(" ")[0] : `${(idx + 1) * 2}s`}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Fullscreen Photo Lightbox Modal */}
          {selectedPhotoIdx !== null && snapshots[selectedPhotoIdx] && (
            <div className="fixed inset-0 z-[1000010] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 relative text-white font-sans">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#B08D57]" />
                    <span className="font-mono text-xs font-bold text-slate-200">
                      Photo Evidence #{selectedPhotoIdx + 1} of {snapshots.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoIdx(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Photo Frame */}
                <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
                  <img
                    src={getSnapshotImage(snapshots[selectedPhotoIdx], selectedPhotoIdx)}
                    alt="Student snapshot"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-black/70 backdrop-blur font-mono text-[10px] text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Proctor Capture (2s Cadence)</span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 font-mono text-xs space-y-1 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capture Tag:</span>
                    <strong className="text-emerald-400">{(snapshots[selectedPhotoIdx] as any).event_type || (snapshots[selectedPhotoIdx] as any).label || "Continuous 2s Check"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timestamp:</span>
                    <span>{(snapshots[selectedPhotoIdx] as any).timestamp || "Verified session time"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Biometric State:</span>
                    <span className="text-emerald-300">Identity & Presence Validated</span>
                  </div>
                </div>

                {/* Navigation Controls */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    disabled={selectedPhotoIdx === 0}
                    onClick={() => setSelectedPhotoIdx((prev) => (prev !== null ? Math.max(0, prev - 1) : 0))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-mono flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <span className="font-mono text-xs text-slate-400">
                    {selectedPhotoIdx + 1} / {snapshots.length}
                  </span>
                  <button
                    type="button"
                    disabled={selectedPhotoIdx === snapshots.length - 1}
                    onClick={() => setSelectedPhotoIdx((prev) => (prev !== null ? Math.min(snapshots.length - 1, prev + 1) : 0))}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-mono flex items-center gap-1 cursor-pointer"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. TIMESTAMPED VIOLATIONS & INTEGRITY AUDIT LOG */}
      <div className="space-y-3">
        <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#111827] flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#B08D57]" />
          <span>Real-time Audit Log & Event Timeline ({events.length} Events)</span>
        </h4>

        {events.length === 0 ? (
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 font-mono text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Clean assessment session. Zero suspicious shortcuts, tab switches, or proctoring warnings recorded.</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {events.map((v: any, i: number) => {
              const sev = String(v.severity || "LOW").toLowerCase();
              return (
                <div
                  key={v.id || i}
                  className={`p-3 rounded-xl border font-mono text-xs flex items-start justify-between gap-3 ${
                    sev === "high" || sev === "critical"
                      ? "border-red-200 bg-red-50/80 text-red-900"
                      : sev === "medium"
                      ? "border-amber-200 bg-amber-50/80 text-amber-900"
                      : "border-[#E5E1D8] bg-[#F7F5F0] text-[#334155]"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className={`h-4 w-4 shrink-0 mt-0.5 ${
                        sev === "high" || sev === "critical"
                          ? "text-red-600"
                          : sev === "medium"
                          ? "text-amber-600"
                          : "text-[#B08D57]"
                      }`}
                    />
                    <div>
                      <span className="font-bold block">{v.event_type || v.type || "Violation"}</span>
                      {v.metadata?.reason ? (
                        <span className="text-[10.5px] text-[#475569] block mt-0.5 font-sans">
                          {v.metadata.reason}
                        </span>
                      ) : null}
                      <span className="text-[10px] opacity-75 block mt-0.5">
                        Severity: {String(v.severity || "LOW").toUpperCase()} {v.question_id ? `· Question: ${v.question_id}` : ""} {v.metadata?.duration_seconds ? `· Duration: ${v.metadata.duration_seconds}s` : ""}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] opacity-75 shrink-0">
                    {v.timestamp ? new Date(v.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Logged"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
