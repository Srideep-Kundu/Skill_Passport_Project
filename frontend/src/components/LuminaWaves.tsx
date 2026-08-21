import { useEffect, useRef } from "react";

interface LuminaWavesProps {
  className?: string;
  opacity?: number;
  speed?: number;
  interactive?: boolean;
}

export function LuminaWaves({
  className = "",
  opacity = 0.65,
  speed = 1,
  interactive = false,
}: LuminaWavesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 400);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener("resize", handleResize);

    let mouseY = height / 2;
    let targetMouseY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      targetMouseY = e.clientY - rect.top;
    };

    if (interactive) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    let time = 0;

    // Organic wave ribbon configurations matching the Lumina Intel aesthetic
    const ribbons = [
      {
        baseY: 0.52,
        amplitude: 45,
        frequency: 0.0035,
        speed: 0.008 * speed,
        colorStart: "rgba(56, 189, 248, 0.45)", // Cyan
        colorMid: "rgba(59, 130, 246, 0.65)", // Cobalt Blue
        colorEnd: "rgba(37, 99, 235, 0.0)",
        lineWidth: 2.2,
        blur: 8,
      },
      {
        baseY: 0.48,
        amplitude: 58,
        frequency: 0.0028,
        speed: -0.006 * speed,
        colorStart: "rgba(99, 102, 241, 0.35)", // Indigo
        colorMid: "rgba(56, 189, 248, 0.55)", // Cyan
        colorEnd: "rgba(14, 165, 233, 0.0)",
        lineWidth: 1.8,
        blur: 12,
      },
      {
        baseY: 0.56,
        amplitude: 38,
        frequency: 0.0042,
        speed: 0.011 * speed,
        colorStart: "rgba(222, 219, 200, 0.25)", // Warm Cream
        colorMid: "rgba(59, 130, 246, 0.45)", // Cobalt
        colorEnd: "rgba(30, 58, 138, 0.0)",
        lineWidth: 1.5,
        blur: 6,
      },
      {
        baseY: 0.42,
        amplitude: 65,
        frequency: 0.0022,
        speed: -0.004 * speed,
        colorStart: "rgba(37, 99, 235, 0.25)", // Deep Blue
        colorMid: "rgba(147, 197, 253, 0.4)", // Light Blue
        colorEnd: "rgba(15, 23, 42, 0.0)",
        lineWidth: 2.8,
        blur: 16,
      },
    ];

    const render = () => {
      time += 1;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // Render each wave ribbon
      ribbons.forEach((ribbon, index) => {
        ctx.save();
        ctx.beginPath();

        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, ribbon.colorStart);
        grad.addColorStop(0.5, ribbon.colorMid);
        grad.addColorStop(1, ribbon.colorEnd);

        ctx.strokeStyle = grad;
        ctx.lineWidth = ribbon.lineWidth;
        ctx.shadowColor = ribbon.colorMid;
        ctx.shadowBlur = ribbon.blur;
        ctx.globalAlpha = opacity;

        const effectiveBaseY =
          height * ribbon.baseY +
          (interactive ? (mouseY - height / 2) * 0.15 * (index % 2 === 0 ? 1 : -1) : 0);

        for (let x = 0; x <= width; x += 4) {
          const yOffset =
            Math.sin(x * ribbon.frequency + time * ribbon.speed + index * 1.4) *
              ribbon.amplitude +
            Math.cos(x * ribbon.frequency * 0.5 + time * ribbon.speed * 0.8) *
              (ribbon.amplitude * 0.4);

          const y = effectiveBaseY + yOffset;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (interactive) {
        window.removeEventListener("mousemove", handleMouseMove);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [opacity, speed, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 h-full w-full select-none ${className}`}
    />
  );
}
