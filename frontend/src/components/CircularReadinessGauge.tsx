import { motion } from "framer-motion";

interface CircularReadinessGaugeProps {
  readinessScore: number; // 0 - 100 (Outer ring - Electric Blue)
  verificationScore?: number; // 0 - 100 (Inner ring - Soft Champagne)
  label?: string;
  size?: number;
}

export function CircularReadinessGauge({
  readinessScore = 87,
  verificationScore = 84,
  label = "READINESS",
  size = 180,
}: CircularReadinessGaugeProps) {
  const strokeWidth = 5;
  const center = size / 2;

  // Outer ring calculations
  const outerRadius = center - 12;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const clampedReadiness = Math.max(0, Math.min(100, readinessScore));
  const outerOffset = outerCircumference - (clampedReadiness / 100) * outerCircumference;

  // Inner ring calculations
  const innerRadius = outerRadius - 12;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const clampedVerification = Math.max(0, Math.min(100, verificationScore));
  const innerOffset = innerCircumference - (clampedVerification / 100) * innerCircumference;

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 drop-shadow-[0_0_12px_rgba(59,130,246,0.25)]"
      >
        {/* Outer Background Track */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-[#1d2025]"
        />

        {/* Outer Dynamic Ring (Lumina Primary Cobalt) */}
        <motion.circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="transparent"
          stroke="url(#outerCobaltGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={outerCircumference}
          initial={{ strokeDashoffset: outerCircumference }}
          animate={{ strokeDashoffset: outerOffset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          strokeLinecap="round"
        />

        {/* Inner Background Track */}
        <circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth - 1}
          className="text-slate-200/60 dark:text-[#151e29]"
        />

        {/* Inner Dynamic Ring (Lumina Editorial Cream) */}
        <motion.circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="transparent"
          stroke="url(#innerCreamGradient)"
          strokeWidth={strokeWidth - 1}
          strokeDasharray={innerCircumference}
          initial={{ strokeDashoffset: innerCircumference }}
          animate={{ strokeDashoffset: innerOffset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.25 }}
          strokeLinecap="round"
        />

        {/* Gradients */}
        <defs>
          <linearGradient id="outerCobaltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b0c6ff" />
            <stop offset="100%" stopColor="#3b71d9" />
          </linearGradient>
          <linearGradient id="innerCreamGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dedbc8" />
            <stop offset="100%" stopColor="#cac7b5" />
          </linearGradient>
        </defs>
      </svg>

      {/* Central Metric Readout */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center"
        >
          <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-[#f1f0e8] block font-sans">
            {clampedReadiness}%
          </span>
          <span className="text-[10px] font-bold tracking-[0.2em] text-slate-500 dark:text-[#98a4b3] uppercase mt-0.5 block">
            {label}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
