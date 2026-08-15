import type { VerificationTier } from "../api";

const tierStyles: Record<VerificationTier, string> = {
  verified: "bg-emerald-100 text-emerald-800",
  partially_verified: "bg-amber-100 text-amber-800",
  unverified: "bg-slate-100 text-slate-700",
};

export function SkillBadge({ name, tier }: { name: string; tier: VerificationTier }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium ${tierStyles[tier]}`}><span aria-hidden="true">{tier === "verified" ? "✓" : tier === "partially_verified" ? "◐" : "○"}</span>{name}</span>;
}
