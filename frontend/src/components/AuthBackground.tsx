import { useEffect, useRef, useState } from "react";

const HERO_BACKGROUND_VIDEO =
  "https://designerstephen.github.io/public-assets/videos/serene-art-hero.mp4";

/**
 * The landing hero's exact video, mounted once behind every authenticated view.
 * Playback pauses for reduced-motion users while the loaded frame remains visible.
 */
export function AuthBackground() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);

    setPrefersReducedMotion(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    void video.play().catch(() => undefined);
  }, [prefersReducedMotion]);

  return (
    <div className="auth-bg" aria-hidden="true">
      <video
        ref={videoRef}
        autoPlay={!prefersReducedMotion}
        loop
        muted
        playsInline
        preload="auto"
        className="auth-bg__video"
        src={HERO_BACKGROUND_VIDEO}
      />
      <div className="auth-bg__lighting" />
    </div>
  );
}
