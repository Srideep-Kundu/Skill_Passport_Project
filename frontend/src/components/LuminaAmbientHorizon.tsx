import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface LuminaAmbientHorizonProps {
  className?: string;
}

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  speedX: number;
  speedY: number;
  depth: number;
  hasFlare: boolean;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  alpha: number;
  active: boolean;
}

export function LuminaAmbientHorizon({ className = "" }: LuminaAmbientHorizonProps) {
  const prefersReduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (prefersReduced) return;
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

    // Interactive pointer parallax & hover wave ripple
    let mouseX = width * 0.5;
    let mouseY = height * 0.5;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // 1. Celestial Stars Field (Multi-depth & Twinkling)
    const starCount = 75;
    const stars: Star[] = Array.from({ length: starCount }, () => {
      const depth = Math.random(); // 0 (far) to 1 (near)
      return {
        x: Math.random() * width,
        y: Math.random() * height * 0.85,
        size: depth > 0.8 ? Math.random() * 2.2 + 1.2 : Math.random() * 1.4 + 0.6,
        baseAlpha: Math.random() * 0.45 + 0.15,
        alpha: 0.3,
        twinkleSpeed: Math.random() * 0.03 + 0.008,
        twinklePhase: Math.random() * Math.PI * 2,
        speedX: (Math.random() - 0.5) * (0.08 + depth * 0.12),
        speedY: -Math.random() * (0.06 + depth * 0.1), // Gentle upward stellar drift
        depth,
        hasFlare: depth > 0.85 && Math.random() > 0.4,
      };
    });

    // Occasional shooting star streak
    const shootingStar: ShootingStar = {
      x: 0,
      y: 0,
      length: 120,
      speed: 16,
      angle: Math.PI / 5,
      alpha: 0,
      active: false,
    };

    let timeToNextShootingStar = Math.random() * 300 + 150;

    // Micro-data glyph constellation (Upper 45% of screen)
    const glyphCount = 28;
    const glyphs = Array.from({ length: glyphCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.45),
      size: Math.random() * 2.2 + 1.2,
      opacity: Math.random() * 0.3 + 0.08,
      speedX: (Math.random() - 0.5) * 0.15,
      speedY: (Math.random() - 0.5) * 0.12,
      pulseSpeed: Math.random() * 0.015 + 0.005,
      pulsePhase: Math.random() * Math.PI * 2,
      isText: Math.random() > 0.65,
      textChar: Math.random() > 0.5 ? "00" : "000",
    }));

    let time = 0;

    const render = () => {
      time += 0.012;

      // Smooth pointer interpolation (lerp)
      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains("dark");
      const mouseNormX = (mouseX / width - 0.5) * 2; // -1 to +1
      const mouseNormY = (mouseY / height - 0.5) * 2;

      // ==========================================
      // 1. RENDER CELESTIAL STARS & TWINKLE FLARES
      // ==========================================
      ctx.save();
      for (const s of stars) {
        s.x += s.speedX + mouseNormX * (s.depth * 0.2);
        s.y += s.speedY + mouseNormY * (s.depth * 0.2);
        s.twinklePhase += s.twinkleSpeed;

        // Wrap boundaries
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height * 0.85;
        if (s.y > height * 0.85) s.y = 0;

        s.alpha = s.baseAlpha * (0.5 + 0.5 * Math.sin(s.twinklePhase));

        // Draw star core
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(225, 235, 255, ${s.alpha})`
          : `rgba(99, 102, 241, ${s.alpha * 0.6})`;
        ctx.shadowBlur = s.depth > 0.7 ? 8 : 4;
        ctx.shadowColor = isDark ? "rgba(176, 198, 255, 0.6)" : "rgba(99, 102, 241, 0.3)";
        ctx.fill();

        // Cross-flare for bright stars
        if (s.hasFlare && s.alpha > 0.45) {
          const flareLen = s.size * 3.5;
          ctx.strokeStyle = isDark
            ? `rgba(255, 255, 255, ${s.alpha * 0.6})`
            : `rgba(99, 102, 241, ${s.alpha * 0.35})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(s.x - flareLen, s.y);
          ctx.lineTo(s.x + flareLen, s.y);
          ctx.moveTo(s.x, s.y - flareLen);
          ctx.lineTo(s.x, s.y + flareLen);
          ctx.stroke();
        }
      }

      // Shooting Star Cycle
      if (!shootingStar.active) {
        timeToNextShootingStar -= 1;
        if (timeToNextShootingStar <= 0) {
          shootingStar.active = true;
          shootingStar.x = Math.random() * width * 0.7;
          shootingStar.y = Math.random() * height * 0.3;
          shootingStar.alpha = 1;
          timeToNextShootingStar = Math.random() * 400 + 250;
        }
      } else {
        shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed;
        shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed;
        shootingStar.alpha -= 0.015;

        if (shootingStar.alpha <= 0 || shootingStar.x > width || shootingStar.y > height) {
          shootingStar.active = false;
        } else {
          ctx.beginPath();
          const tailX = shootingStar.x - Math.cos(shootingStar.angle) * shootingStar.length;
          const tailY = shootingStar.y - Math.sin(shootingStar.angle) * shootingStar.length;
          const grad = ctx.createLinearGradient(tailX, tailY, shootingStar.x, shootingStar.y);
          grad.addColorStop(0, "rgba(56, 189, 248, 0)");
          grad.addColorStop(0.7, `rgba(176, 198, 255, ${shootingStar.alpha * 0.6})`);
          grad.addColorStop(1, `rgba(255, 255, 255, ${shootingStar.alpha})`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.8;
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(shootingStar.x, shootingStar.y);
          ctx.stroke();
        }
      }
      ctx.restore();

      // ==========================================
      // 2. RENDER UPPER MICRO-DATA GLYPH MATRIX
      // ==========================================
      ctx.save();
      for (const g of glyphs) {
        g.x += g.speedX;
        g.y += g.speedY;
        g.pulsePhase += g.pulseSpeed;

        if (g.x < 0) g.x = width;
        if (g.x > width) g.x = 0;
        if (g.y < 0) g.y = height * 0.45;
        if (g.y > height * 0.45) g.y = 0;

        const currentOpacity = g.opacity * (0.6 + 0.4 * Math.sin(g.pulsePhase));

        if (g.isText) {
          ctx.font = `${Math.floor(g.size * 3.5)}px monospace`;
          ctx.fillStyle = isDark
            ? `rgba(142, 162, 198, ${currentOpacity * 0.7})`
            : `rgba(99, 102, 241, ${currentOpacity * 0.4})`;
          ctx.fillText(g.textChar, g.x, g.y);
        } else {
          ctx.beginPath();
          ctx.arc(g.x, g.y, g.size, 0, Math.PI * 2);
          ctx.fillStyle = isDark
            ? `rgba(176, 198, 255, ${currentOpacity})`
            : `rgba(79, 70, 229, ${currentOpacity * 0.5})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = isDark ? "rgba(59, 113, 217, 0.4)" : "rgba(99, 102, 241, 0.2)";
          ctx.fill();
        }
      }
      ctx.restore();

      // ==========================================
      // 3. RENDER DYNAMIC FLUID WAVE HORIZON RIBBONS
      // ==========================================
      // Multi-harmonic sine waves modulated by cursor hover lift
      const hoverLift = (mouseY / height - 0.5) * 45; // hover dynamic vertical shift
      const hoverTilt = (mouseX / width - 0.5) * 35;

      const ribbons = [
        {
          // Deep Foundation Glow (Cobalt to Apricot/Amber)
          baseY: height * 0.52 + hoverLift * 0.5,
          amp1: 42,
          freq1: 0.0022,
          speed1: 0.9,
          amp2: 24,
          freq2: 0.0045,
          speed2: -0.6,
          lineWidth: 58,
          blur: 52,
          colorStart: isDark ? "rgba(59, 113, 217, 0.28)" : "rgba(99, 102, 241, 0.14)",
          colorMid: isDark ? "rgba(255, 183, 131, 0.34)" : "rgba(165, 180, 252, 0.20)",
          colorEnd: isDark ? "rgba(56, 189, 248, 0.22)" : "rgba(56, 189, 248, 0.12)",
        },
        {
          // Active Vibrant Middle Wave (Warm Amber, Cyan, Electric Blue)
          baseY: height * 0.48 + hoverLift * 0.8,
          amp1: 54,
          freq1: 0.0028,
          speed1: -1.2,
          amp2: 32,
          freq2: 0.0052,
          speed2: 0.8,
          lineWidth: 24,
          blur: 28,
          colorStart: isDark ? "rgba(176, 198, 255, 0.42)" : "rgba(79, 70, 229, 0.22)",
          colorMid: isDark ? "rgba(255, 218, 180, 0.52)" : "rgba(199, 210, 254, 0.30)",
          colorEnd: isDark ? "rgba(56, 189, 248, 0.35)" : "rgba(147, 197, 253, 0.18)",
        },
        {
          // High-Frequency Luminous Core Streak
          baseY: height * 0.47 + hoverLift,
          amp1: 36,
          freq1: 0.0035,
          speed1: 1.4,
          amp2: 18,
          freq2: 0.0068,
          speed2: -1.1,
          lineWidth: 8,
          blur: 14,
          colorStart: isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(255, 255, 255, 0.4)",
          colorMid: isDark ? "rgba(255, 230, 200, 0.65)" : "rgba(224, 231, 255, 0.45)",
          colorEnd: isDark ? "rgba(147, 197, 253, 0.50)" : "rgba(165, 180, 252, 0.35)",
        },
        {
          // Upper Counter-Harmonic Ambient Ribbon (Luminous Cyan / Cream)
          baseY: height * 0.42 + hoverLift * 0.4,
          amp1: 45,
          freq1: 0.0018,
          speed1: -0.7,
          amp2: 28,
          freq2: 0.0038,
          speed2: 1.1,
          lineWidth: 40,
          blur: 44,
          colorStart: isDark ? "rgba(56, 189, 248, 0.18)" : "rgba(56, 189, 248, 0.10)",
          colorMid: isDark ? "rgba(59, 113, 217, 0.24)" : "rgba(99, 102, 241, 0.12)",
          colorEnd: isDark ? "rgba(222, 219, 200, 0.22)" : "rgba(224, 231, 255, 0.14)",
        },
      ];

      for (const r of ribbons) {
        ctx.save();
        ctx.filter = `blur(${r.blur}px)`;
        ctx.beginPath();

        const step = 14;
        let first = true;

        for (let x = -40; x <= width + 40; x += step) {
          // Compound wave harmonics
          const wave1 = Math.sin(time * r.speed1 + x * r.freq1) * r.amp1;
          const wave2 = Math.cos(time * r.speed2 + x * r.freq2) * r.amp2;
          
          // Cursor hover wave displacement
          const distToMouse = Math.abs(x - mouseX);
          const mouseInfluence = Math.max(0, 1 - distToMouse / (width * 0.45));
          const hoverWave = Math.sin(time * 2.5 + distToMouse * 0.01) * (mouseInfluence * 20);

          const y = r.baseY + wave1 + wave2 + hoverWave + (x / width - 0.5) * hoverTilt;

          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }

        const grad = ctx.createLinearGradient(0, r.baseY - 50, width, r.baseY + 50);
        grad.addColorStop(0, r.colorStart);
        grad.addColorStop(0.5, r.colorMid);
        grad.addColorStop(1, r.colorEnd);

        ctx.strokeStyle = grad;
        ctx.lineWidth = r.lineWidth;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [prefersReduced]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 overflow-hidden z-0 select-none ${className}`}
    >
      {/* Top subtle radial atmospheric halo */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-[#3b71d9]/10 via-[#b0c6ff]/5 to-transparent blur-3xl rounded-full dark:opacity-80 opacity-40" />

      {/* Dynamic Animated Stars & Luminous Wave Horizon Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
      />
    </div>
  );
}
