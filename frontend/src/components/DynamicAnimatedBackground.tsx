import { useEffect, useRef } from "react";

interface DynamicAnimatedBackgroundProps {
  className?: string;
  isDarkMode?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  baseAlpha: number;
  pulseSpeed: number;
}

export function DynamicAnimatedBackground({
  className = "",
  isDarkMode = true,
}: DynamicAnimatedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);

    // Mouse tracking for interactive wave ripple & particle gravity
    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Generate floating constellation particles
    const particleCount = Math.min(Math.floor((width * height) / 14000), 100);
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1,
        baseAlpha: Math.random() * 0.5 + 0.2,
        alpha: Math.random() * 0.5 + 0.2,
        pulseSpeed: Math.random() * 0.03 + 0.01,
      });
    }

    let time = 0;

    // Multi-layer Lumina wave ribbon configurations (Calibrated slow speed)
    const waveRibbons = [
      {
        baseY: 0.52,
        amplitude: 55,
        frequency: 0.0035,
        speed: 0.004,
        colorStart: "rgba(56, 189, 248, 0.55)", // Cyan
        colorMid: "rgba(99, 102, 241, 0.7)", // Indigo
        colorEnd: "rgba(37, 99, 235, 0.0)",
        lineWidth: 2.8,
        blur: 14,
      },
      {
        baseY: 0.47,
        amplitude: 70,
        frequency: 0.0028,
        speed: -0.003,
        colorStart: "rgba(99, 102, 241, 0.5)", // Indigo
        colorMid: "rgba(56, 189, 248, 0.75)", // Cyan
        colorEnd: "rgba(147, 51, 234, 0.0)",
        lineWidth: 2.4,
        blur: 16,
      },
      {
        baseY: 0.56,
        amplitude: 40,
        frequency: 0.0048,
        speed: 0.005,
        colorStart: "rgba(37, 99, 235, 0.4)", // Blue
        colorMid: "rgba(56, 189, 248, 0.6)", // Cyan
        colorEnd: "rgba(99, 102, 241, 0.0)",
        lineWidth: 2.0,
        blur: 10,
      },
      {
        baseY: 0.42,
        amplitude: 85,
        frequency: 0.002,
        speed: 0.0025,
        colorStart: "rgba(129, 140, 248, 0.35)", // Light Indigo
        colorMid: "rgba(14, 165, 233, 0.5)", // Sky Blue
        colorEnd: "rgba(2, 132, 199, 0.0)",
        lineWidth: 1.8,
        blur: 12,
      },
    ];

    const render = () => {
      time += 0.4; // Calibrated slow frame increment

      // Smooth mouse lerp
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // 1. Draw glowing ambient background light orbs
      const bgGrad1 = ctx.createRadialGradient(
        width * 0.3 + Math.sin(time * 0.008) * 100,
        height * 0.35 + Math.cos(time * 0.008) * 60,
        10,
        width * 0.3,
        height * 0.35,
        width * 0.45
      );
      bgGrad1.addColorStop(0, "rgba(79, 70, 229, 0.18)"); // Indigo glow
      bgGrad1.addColorStop(0.6, "rgba(56, 189, 248, 0.08)"); // Cyan
      bgGrad1.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = bgGrad1;
      ctx.fillRect(0, 0, width, height);

      const bgGrad2 = ctx.createRadialGradient(
        width * 0.7 + Math.cos(time * 0.009) * 120,
        height * 0.65 + Math.sin(time * 0.009) * 80,
        10,
        width * 0.7,
        height * 0.65,
        width * 0.5
      );
      bgGrad2.addColorStop(0, "rgba(56, 189, 248, 0.15)"); // Cyan glow
      bgGrad2.addColorStop(0.6, "rgba(99, 102, 241, 0.06)");
      bgGrad2.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = bgGrad2;
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Floating & Pulsing Constellation Particles with Connections
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Pulsing alpha
        p.alpha = p.baseAlpha + Math.sin(time * p.pulseSpeed) * 0.25;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56, 189, 248, ${Math.max(0.05, p.alpha)})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(56, 189, 248, 0.8)";
        ctx.fill();
        ctx.shadowBlur = 0;

        // Connect nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${(1 - dist / 120) * 0.22})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // 3. Draw Multi-layer Harmonic Undulating Lumina Waves
      waveRibbons.forEach((ribbon) => {
        ctx.save();
        ctx.shadowBlur = ribbon.blur;
        ctx.shadowColor = ribbon.colorMid;

        const currentBaseY = height * ribbon.baseY;
        const mouseEffectY = (mouseY - height / 2) * 0.12;

        ctx.beginPath();
        const step = 6;
        for (let x = 0; x <= width + step; x += step) {
          const distFromMouse = Math.abs(x - mouseX);
          const ripple = Math.sin(distFromMouse * 0.02 - time * 0.04) * Math.max(0, 1 - distFromMouse / 300) * 18;

          const wave1 = Math.sin(x * ribbon.frequency + time * ribbon.speed) * ribbon.amplitude;
          const wave2 = Math.cos(x * ribbon.frequency * 0.6 - time * ribbon.speed * 0.8) * (ribbon.amplitude * 0.4);
          const y = currentBaseY + wave1 + wave2 + ripple + mouseEffectY;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        const waveGrad = ctx.createLinearGradient(0, 0, width, 0);
        waveGrad.addColorStop(0, ribbon.colorStart);
        waveGrad.addColorStop(0.5, ribbon.colorMid);
        waveGrad.addColorStop(1, ribbon.colorEnd);

        ctx.strokeStyle = waveGrad;
        ctx.lineWidth = ribbon.lineWidth;
        ctx.stroke();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none w-full h-full z-0 ${className}`}
    />
  );
}
