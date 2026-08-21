import type { ReactNode } from "react";
import { BadgeCheck, AlertCircle, HelpCircle } from "lucide-react";
import type { VerificationTier } from "../api";

const tierStyles: Record<VerificationTier, string> = {
  verified: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80 shadow-xs",
  partially_verified: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80 shadow-xs",
  unverified: "bg-slate-100 dark:bg-[#151e29] text-slate-700 dark:text-[#f1f0e8] border-slate-200 dark:border-white/10 shadow-xs",
};

const tierIcons: Record<VerificationTier, ReactNode> = {
  verified: <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />,
  partially_verified: <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />,
  unverified: <HelpCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />,
};

export function SkillBadge({ name, tier }: { name: string; tier: VerificationTier }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold tracking-tight transition-colors ${tierStyles[tier]}`}>
      {tierIcons[tier]}
      <span>{name}</span>
    </span>
  );
}
