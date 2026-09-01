import { motion } from "framer-motion";

interface CircularReadinessGaugeProps {
  readinessScore: number; // 0 - 100 (Outer ring - Electric Blue)
  verificationScore?: number; // 0 - 100 (Inner ring - Soft Champagne)
  label?: string;
  size?: number;
}

export function CircularReadinessGauge({
  readinessScore = 87,
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
  const scoreText = `${clampedReadiness}%`;
  const metricFontSize = scoreText.length >= 5
    ? "clamp(0.9375rem, 19cqi, 1.625rem)"
    : "clamp(1rem, 22cqi, 1.875rem)";

  return (
    <div
      className="relative aspect-square shrink-0 select-none"
      style={{
        width: size,
        height: size,
        flexBasis: size,
        containerType: "inline-size",
      }}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0 h-full w-full transform -rotate-90 drop-shadow-[0_0_12px_rgba(59,130,246,0.25)]"
      >
        {/* Outer Background Track */}
        <circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="transparent"
          stroke="#E5E1D8"
          strokeWidth={strokeWidth}
        />

        {/* Outer Dynamic Ring (Warm Luxury Gold) */}
        <motion.circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="transparent"
          stroke="url(#warmGoldGaugeGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={outerCircumference}
          initial={{ strokeDashoffset: outerCircumference }}
          animate={{ strokeDashoffset: outerOffset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          strokeLinecap="round"
        />

        {/* Gradient */}
        <defs>
          <linearGradient id="warmGoldGaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#B08D57" />
          </linearGradient>
        </defs>
      </svg>

      {/* Central Metric Readout */}
      <div className="pointer-events-none absolute inset-[18%] grid place-items-center text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex min-w-0 flex-col items-center justify-center gap-[clamp(0.125rem,2cqi,0.25rem)] text-center"
        >
          <span
            className="block whitespace-nowrap font-normal leading-none tracking-tight text-[#111827]"
            style={{ fontSize: metricFontSize, fontFamily: "var(--font-display)" }}
          >
            {scoreText}
          </span>
          <span
            className="block max-w-full truncate whitespace-nowrap text-center font-mono font-semibold uppercase leading-none tracking-[0.18em] text-[#B08D57]"
            style={{ fontSize: "clamp(0.5rem, 7cqi, 0.625rem)" }}
            title={label}
          >
            {label}
          </span>
        </motion.div>
      </div>
    </div>
  );
}
