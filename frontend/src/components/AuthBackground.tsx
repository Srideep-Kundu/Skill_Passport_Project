/**
 * AuthBackground
 * ──────────────────────────────────────────────
 * Cinematic authenticated app background.
 * Mounted ONCE in App.tsx; persists across all tab/route changes.
 * No people. Books + stars + plants + warm desk-light atmosphere.
 *
 * Layer structure (bottom → top):
 *   1. Stars – 3 depth layers, slow parallax translate drift
 *   2. Warm amber wash – lower-right desk-lamp atmosphere
 *   3. Cool blue wash  – upper-center match of hero palette (static)
 *   4. SVG foliage       – bottom-left and bottom-right plant silhouettes
 *   5. Book shelf hint   – warm horizontal glow at very bottom center
 *
 * All layers: position:fixed, pointer-events:none, z-index:0.
 * Animation respects prefers-reduced-motion (CSS @media query).
 */
export function AuthBackground() {
  return (
    <div className="auth-bg" aria-hidden="true">
      {/* ── Star field ─────────────────────────────── */}
      <div className="auth-bg__stars auth-bg__stars--a" />
      <div className="auth-bg__stars auth-bg__stars--b" />
      <div className="auth-bg__stars auth-bg__stars--c" />

      {/* ── Warm desk-light wash ────────────────────── */}
      <div className="auth-bg__warmlight" />

      {/* ── Cool upper wash (matches hero palette) ──── */}
      <div className="auth-bg__bloom" />

      {/* ── Left foliage silhouette ─────────────────── */}
      <svg
        className="auth-bg__plant auth-bg__plant--left"
        viewBox="0 0 160 420"
        preserveAspectRatio="xMinYMax meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main stem */}
        <path
          d="M55 420 C52 375 60 335 48 285 C40 248 56 208 45 168 C38 138 53 98 42 62 C38 42 50 18 57 4"
          stroke="rgba(72,112,78,0.32)"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Leaf 1 — large lower-left */}
        <path
          d="M48 286 C18 274 -8 252 9 224 C24 198 50 214 48 286"
          fill="rgba(52,88,58,0.16)"
          stroke="rgba(72,112,78,0.22)"
          strokeWidth="0.6"
        />
        {/* Leaf 2 — mid-left */}
        <path
          d="M46 208 C14 194 -12 172 7 146 C22 123 48 140 46 208"
          fill="rgba(52,88,58,0.13)"
          stroke="rgba(72,112,78,0.18)"
          strokeWidth="0.6"
        />
        {/* Leaf 3 — upper-right */}
        <path
          d="M45 164 C72 147 98 139 93 113 C87 90 62 104 45 164"
          fill="rgba(52,88,58,0.14)"
          stroke="rgba(72,112,78,0.18)"
          strokeWidth="0.6"
        />
        {/* Leaf 4 — top-left */}
        <path
          d="M43 98 C16 83 -6 65 12 44 C26 24 46 42 43 98"
          fill="rgba(52,88,58,0.11)"
          stroke="rgba(72,112,78,0.15)"
          strokeWidth="0.6"
        />
        {/* Small side-shoot lower */}
        <path
          d="M50 338 C28 332 14 326 20 315 C26 304 50 316 50 338"
          fill="rgba(52,88,58,0.10)"
          stroke="rgba(72,112,78,0.14)"
          strokeWidth="0.5"
        />
      </svg>

      {/* ── Right foliage silhouette ────────────────── */}
      <svg
        className="auth-bg__plant auth-bg__plant--right"
        viewBox="0 0 160 420"
        preserveAspectRatio="xMaxYMax meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main stem */}
        <path
          d="M105 420 C108 375 100 335 112 285 C120 248 104 208 115 168 C122 138 107 98 118 62 C122 42 110 18 103 4"
          stroke="rgba(72,112,78,0.32)"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Leaf 1 — large lower-right */}
        <path
          d="M112 286 C142 274 168 252 151 224 C136 198 110 214 112 286"
          fill="rgba(52,88,58,0.16)"
          stroke="rgba(72,112,78,0.22)"
          strokeWidth="0.6"
        />
        {/* Leaf 2 — mid-right */}
        <path
          d="M114 208 C146 194 172 172 153 146 C138 123 112 140 114 208"
          fill="rgba(52,88,58,0.13)"
          stroke="rgba(72,112,78,0.18)"
          strokeWidth="0.6"
        />
        {/* Leaf 3 — upper-left */}
        <path
          d="M115 164 C88 147 62 139 67 113 C73 90 98 104 115 164"
          fill="rgba(52,88,58,0.14)"
          stroke="rgba(72,112,78,0.18)"
          strokeWidth="0.6"
        />
        {/* Leaf 4 — top-right */}
        <path
          d="M117 98 C144 83 166 65 148 44 C134 24 114 42 117 98"
          fill="rgba(52,88,58,0.11)"
          stroke="rgba(72,112,78,0.15)"
          strokeWidth="0.6"
        />
        {/* Small side-shoot lower */}
        <path
          d="M110 338 C132 332 146 326 140 315 C134 304 110 316 110 338"
          fill="rgba(52,88,58,0.10)"
          stroke="rgba(72,112,78,0.14)"
          strokeWidth="0.5"
        />
      </svg>

      {/* ── Quiet desk and book silhouettes ─────────── */}
      <div className="auth-bg__shelf">
        <span className="auth-bg__book auth-bg__book--one" />
        <span className="auth-bg__book auth-bg__book--two" />
        <span className="auth-bg__book auth-bg__book--three" />
        <span className="auth-bg__book auth-bg__book--four" />
      </div>
    </div>
  );
}
