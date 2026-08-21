import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { MOTION_DURATIONS } from "../theme/motion";

export function AnimatedNumber({
  value,
  formatter = (v) => `${v}`,
}: {
  value: number;
  formatter?: (v: number) => string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const startVal = prevValueRef.current;
    const targetVal = value;
    if (startVal === targetVal) return;

    let animationFrameId: number;
    let startTimestamp: number | null = null;
    const durationMs = MOTION_DURATIONS.slow * 1000; // ~450ms

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / durationMs, 1);
      // Ease-out cubic formula
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (targetVal - startVal) * easeOut);

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        prevValueRef.current = targetVal;
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, prefersReducedMotion]);

  return <span>{formatter(displayValue)}</span>;
}
