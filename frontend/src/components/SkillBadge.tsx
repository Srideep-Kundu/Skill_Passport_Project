import type { ReactNode } from "react";
import { BadgeCheck, AlertCircle, HelpCircle } from "lucide-react";
import type { VerificationTier } from "../api";

const tierStyles: Record<VerificationTier, string> = {
  verified: "bg-white/10 text-white border-white/20",
  partially_verified: "bg-white/5 text-neutral-300 border-white/15",
  unverified: "bg-white/[0.02] text-neutral-400 border-white/10",
};

const tierIcons: Record<VerificationTier, ReactNode> = {
  verified: <BadgeCheck className="h-3 w-3 text-white shrink-0" aria-hidden="true" />,
  partially_verified: <AlertCircle className="h-3 w-3 text-neutral-300 shrink-0" aria-hidden="true" />,
  unverified: <HelpCircle className="h-3 w-3 text-neutral-400 shrink-0" aria-hidden="true" />,
};

export function SkillBadge({ name, tier }: { name: string; tier: VerificationTier }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs tracking-wide transition-colors ${tierStyles[tier]}`}
    >
      {tierIcons[tier]}
      <span>{name}</span>
    </span>
  );
}
