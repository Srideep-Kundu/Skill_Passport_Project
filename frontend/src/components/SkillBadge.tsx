import type { ReactNode } from "react";
import { BadgeCheck, AlertCircle, HelpCircle } from "lucide-react";
import type { VerificationTier } from "../api";

const tierStyles: Record<VerificationTier, string> = {
  verified: "bg-[rgba(79,111,90,0.10)] text-[#4F6F5A] border-[rgba(79,111,90,0.25)]",
  partially_verified: "bg-[rgba(166,124,58,0.10)] text-[#A67C3A] border-[rgba(166,124,58,0.25)]",
  unverified: "bg-[#F7F5F0] text-[#64748B] border-[#E5E1D8]",
};

const tierIcons: Record<VerificationTier, ReactNode> = {
  verified: <BadgeCheck className="h-3 w-3 text-[#4F6F5A] shrink-0" aria-hidden="true" />,
  partially_verified: <AlertCircle className="h-3 w-3 text-[#A67C3A] shrink-0" aria-hidden="true" />,
  unverified: <HelpCircle className="h-3 w-3 text-[#64748B] shrink-0" aria-hidden="true" />,
};

export function SkillBadge({ name, tier }: { name?: string; tier: VerificationTier }) {
  const displayLabel = name || tier.replace("_", " ");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-wide uppercase transition-colors ${tierStyles[tier]}`}
    >
      {tierIcons[tier]}
      <span>{displayLabel}</span>
    </span>
  );
}
