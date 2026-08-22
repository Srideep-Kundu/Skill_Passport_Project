import { useMemo } from "react";

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
  dotSize?: number;
  dotGap?: number;
  charGap?: number;
}

export function DotMatrixWord({
  text,
  dotSize = 4,
  dotGap = 2,
  charGap = 8,
}: DotMatrixWordProps) {
  const chars = useMemo(() => text.toUpperCase().split(""), [text]);

  return (
    <div className="inline-flex items-center justify-center flex-wrap gap-y-2 select-none">
      {chars.map((char, charIdx) => {
        const matrix = FONT_MAP[char] || FONT_MAP[" "];
        const isSpace = char === " ";

        if (isSpace) {
          return (
            <div
              key={charIdx}
              style={{ width: `${dotSize * 3 + dotGap * 2}px` }}
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
              gridTemplateColumns: `repeat(5, ${dotSize}px)`,
              gridTemplateRows: `repeat(7, ${dotSize}px)`,
              gap: `${dotGap}px`,
              marginRight: charIdx < chars.length - 1 ? `${charGap}px` : "0px",
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
                        ? "bg-white shadow-[0_0_8px_rgba(56,189,248,0.9),0_0_16px_rgba(99,102,241,0.5)]"
                        : "bg-white/[0.06]"
                    }`}
                    style={{ width: `${dotSize}px`, height: `${dotSize}px` }}
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
  line1 = "INTELLIGENCE",
  line2 = "DESIGNED TO EVOLVE",
}: {
  line1?: string;
  line2?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-3 sm:space-y-4 my-2">
      {/* Line 1 */}
      <div className="flex justify-center transform scale-75 sm:scale-95 md:scale-110 lg:scale-125 transition-transform">
        <DotMatrixWord text={line1} dotSize={4.5} dotGap={2.5} charGap={10} />
      </div>

      {/* Line 2 */}
      <div className="flex justify-center transform scale-75 sm:scale-95 md:scale-110 lg:scale-125 transition-transform">
        <DotMatrixWord text={line2} dotSize={4.5} dotGap={2.5} charGap={10} />
      </div>

      {/* Accessible H1 */}
      <h1 className="sr-only">
        {line1} {line2}
      </h1>
    </div>
  );
}
