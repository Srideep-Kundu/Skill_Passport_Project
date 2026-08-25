import { useMemo, type CSSProperties } from "react";

// Standard 5x7 dot matrix bitmap for uppercase A-Z, numbers, and space
const FONT_MAP: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x1f],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x11, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  " ": [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c],
  "-": [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
};

interface DotMatrixWordProps {
  text: string;
  dotSize?: string;
  dotGap?: string;
  charGap?: string;
}

export function DotMatrixWord({
  text,
  dotSize = "clamp(3px, 0.7vw, 7px)",
  dotGap = "clamp(1px, 0.28vw, 3px)",
  charGap = "clamp(4px, 0.7vw, 10px)",
}: DotMatrixWordProps) {
  const chars = useMemo(() => text.toUpperCase().split(""), [text]);
  const responsiveMetrics = {
    "--dot-size": dotSize,
    "--dot-gap": dotGap,
    "--char-gap": charGap,
  } as CSSProperties;

  return (
    <div
      className="inline-flex max-w-full flex-nowrap items-center justify-center select-none"
      style={responsiveMetrics}
    >
      {chars.map((char, charIdx) => {
        const matrix = FONT_MAP[char] || FONT_MAP[" "];
        const isSpace = char === " ";

        if (isSpace) {
          return (
            <div
              key={charIdx}
              style={{ width: "calc(var(--dot-size) * 3 + var(--dot-gap) * 2)" }}
              className="shrink-0"
              aria-hidden="true"
            />
          );
        }

        return (
          <div
            key={charIdx}
            className="inline-grid shrink-0"
            style={{
              gridTemplateColumns: "repeat(5, var(--dot-size))",
              gridTemplateRows: "repeat(7, var(--dot-size))",
              gap: "var(--dot-gap)",
              marginRight: charIdx < chars.length - 1 ? "var(--char-gap)" : "0px",
            }}
            aria-hidden="true"
          >
            {matrix.map((rowVal, rowIdx) =>
              [4, 3, 2, 1, 0].map((bit) => {
                const isActive = (rowVal & (1 << bit)) !== 0;
                return (
                  <div
                    key={`${rowIdx}-${bit}`}
                    className={`rounded-[1px] transition-all duration-300 ${
                      isActive
                        ? "bg-slate-900 shadow-[0_0_8px_rgba(59,113,217,0.35)] dark:bg-white dark:shadow-[0_0_8px_rgba(56,189,248,0.9),0_0_16px_rgba(99,102,241,0.5)]"
                        : "bg-slate-300/60 dark:bg-white/[0.06]"
                    }`}
                    style={{ width: "var(--dot-size)", height: "var(--dot-size)" }}
                  />
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DotMatrixHeroHeader({
  line1 = "LUMINA INTEL",
  line2,
}: {
  line1?: string;
  line2?: string;
}) {
  return (
    <div className="my-2 flex w-full max-w-full flex-col items-center justify-center gap-3 sm:gap-4">
      {/* Line 1 */}
      <div className="flex w-full max-w-full justify-center">
        <DotMatrixWord text={line1} />
      </div>

      {/* Line 2 */}
      {line2 ? (
        <div className="flex w-full max-w-full justify-center">
          <DotMatrixWord text={line2} />
        </div>
      ) : null}

      {/* Accessible H1 */}
      <h1 className="sr-only">
        {line1} {line2}
      </h1>
    </div>
  );
}
