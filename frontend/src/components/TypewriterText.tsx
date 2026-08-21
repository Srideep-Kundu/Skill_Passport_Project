import { useEffect, useState, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface TypewriterTextProps {
  text: string;
  delay?: number; // Delay in seconds before typing starts
  speed?: number; // Milliseconds per character
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  showCursor?: boolean;
}

export function TypewriterText({
  text = "",
  delay = 0,
  speed = 18, // 18ms per character for silky smooth, modern typing
  className = "",
  as: Component = "span",
  showCursor = true,
}: TypewriterTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const [displayedLength, setDisplayedLength] = useState<number>(() =>
    prefersReducedMotion ? text.length : 0,
  );
  const [isComplete, setIsComplete] = useState<boolean>(Boolean(prefersReducedMotion));
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedLength(text.length);
      setIsComplete(true);
      return;
    }

    // Reset for new text
    setDisplayedLength(0);
    setIsComplete(false);

    // Clear any previous timers
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (intervalRef.current) window.clearInterval(intervalRef.current);

    timeoutRef.current = window.setTimeout(() => {
      let current = 0;
      intervalRef.current = window.setInterval(() => {
        current += 1;
        setDisplayedLength(current);
        if (current >= text.length) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsComplete(true);
        }
      }, Math.max(10, speed));
    }, Math.max(0, delay * 1000));

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [text, delay, speed, prefersReducedMotion]);

  const visibleText = useMemo(() => {
    if (!text) return "";
    return text.slice(0, displayedLength);
  }, [text, displayedLength]);

  if (prefersReducedMotion) {
    return <Component className={className}>{text}</Component>;
  }

  return (
    <Component className={`inline-block ${className}`}>
      <span>{visibleText}</span>
      {showCursor && !isComplete && displayedLength > 0 && displayedLength < text.length && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block ml-0.5 font-normal text-indigo-500 dark:text-indigo-400 select-none"
        >
          |
        </motion.span>
      )}
    </Component>
  );
}

// Smooth Left-to-Right Line Wipe Reveal
export function SmoothWipeLine({
  children,
  delay = 0,
  duration = 0.45,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: -12,
        filter: "blur(4px)",
      }}
      animate={{
        opacity: 1,
        x: 0,
        filter: "blur(0px)",
      }}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
