import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface LiquidGlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function LiquidGlassButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: LiquidGlassButtonProps) {
  const sizeClasses = {
    sm: "px-4 py-1.5 text-xs",
    md: "px-6 py-2.5 text-sm",
    lg: "px-10 py-4 text-base sm:text-lg",
  }[size];

  if (variant === "primary") {
    return (
      <button
        type="button"
        className={`liquid-glass inline-flex items-center justify-center gap-2 rounded-md font-medium text-white transition-all duration-200 hover:border-white/40 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }

  if (variant === "secondary") {
    return (
      <button
        type="button"
        className={`inline-flex items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.03] font-medium text-neutral-200 transition-colors duration-200 hover:bg-white/[0.06] hover:border-white/30 hover:text-white active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium text-neutral-400 transition-colors duration-200 hover:text-white active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export interface EditorialButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "sm" | "md";
  children: React.ReactNode;
}

export function EditorialButton({
  variant = "primary",
  size = "sm",
  className = "",
  children,
  ...props
}: EditorialButtonProps) {
  const sizeClasses = {
    sm: "px-3.5 py-1.5 text-xs",
    md: "px-5 py-2 text-sm",
  }[size];

  const variantClasses = {
    primary: "border border-white/20 bg-white/10 text-[#F7F8F8] hover:bg-white/15 hover:border-white/30",
    secondary: "border border-white/10 bg-transparent text-[#BEC8CF] hover:text-[#F7F8F8] hover:border-white/20 hover:bg-white/[0.02]",
    accent: "border border-[#9CC7D8]/40 bg-[#9CC7D8]/10 text-[#9CC7D8] hover:bg-[#9CC7D8]/20 hover:border-[#9CC7D8]/60",
    ghost: "text-[#8796A2] hover:text-[#F7F8F8] hover:bg-white/[0.02]",
  }[variant];

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export interface EditorialPageHeaderProps {
  category?: string;
  index?: string | number;
  title: string;
  subtitle?: string;
  lastUpdated?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EditorialPageHeader({
  category,
  index,
  title,
  subtitle,
  lastUpdated,
  action,
  className = "",
}: EditorialPageHeaderProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <header className={`mb-8 w-full border-b border-white/10 pb-6 ${className}`}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          {(category || index) && (
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#8796A2]">
              {category} {index ? `/ ${index}` : ""}
            </div>
          )}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-[#F7F8F8]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
          {/* Signature Accent Line */}
          {!prefersReducedMotion ? (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              style={{ originX: 0 }}
              className="h-[1.5px] w-16 bg-[#9CC7D8]/60"
            />
          ) : (
            <div className="h-[1.5px] w-16 bg-[#9CC7D8]/60" />
          )}
          {subtitle && (
            <p className="max-w-3xl text-sm leading-relaxed text-[#BEC8CF] pt-1">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {lastUpdated && (
            <div className="text-right font-mono text-[10px] uppercase tracking-wider text-[#8796A2]">
              <div>Last Updated</div>
              <div className="text-[#BEC8CF]">{lastUpdated}</div>
            </div>
          )}
          {action}
        </div>
      </div>
    </header>
  );
}

export interface MetricReadoutProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  className?: string;
}

export function MetricReadout({ label, value, subtext, trend, className = "" }: MetricReadoutProps) {
  return (
    <div className={`p-4 sm:p-5 rounded-md border border-white/10 bg-[#071E2B] ${className}`}>
      <div className="text-[11px] font-mono uppercase tracking-widest text-[#8796A2]">{label}</div>
      <div
        className="mt-2 text-3xl sm:text-4xl font-normal text-[#F7F8F8]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
      {(subtext || trend) && (
        <div className="mt-2 flex items-center justify-between text-xs text-[#BEC8CF] font-sans">
          {subtext && <span>{subtext}</span>}
          {trend && <span className="font-mono text-[#9CC7D8]">{trend}</span>}
        </div>
      )}
    </div>
  );
}

export function SectionRule({ className = "" }: { className?: string }) {
  return <div className={`my-8 h-px w-full bg-white/10 ${className}`} />;
}

export interface StatusTagProps {
  status: "verified" | "partially_verified" | "unverified" | "active" | "pending" | "failed" | string;
  className?: string;
}

export function StatusTag({ status, className = "" }: StatusTagProps) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");

  const getStyle = () => {
    switch (normalized) {
      case "verified":
      case "active":
      case "ready":
      case "completed":
        return "border-white/20 bg-white/10 text-[#F7F8F8]";
      case "partially_verified":
      case "in_progress":
      case "processing":
      case "extracting":
        return "border-white/15 bg-white/5 text-[#BEC8CF]";
      case "failed":
      case "rejected":
        return "border-red-500/30 bg-red-950/20 text-red-300";
      default:
        return "border-white/10 bg-white/[0.02] text-[#8796A2]";
    }
  };

  const getLabel = () => {
    switch (normalized) {
      case "verified":
        return "Verified";
      case "partially_verified":
        return "Partially Verified";
      case "unverified":
        return "Unverified";
      default:
        return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] tracking-wide ${getStyle()} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {getLabel()}
    </span>
  );
}

export interface EditorialTextTabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function EditorialTextTabs({ tabs, activeTab, onChange, className = "" }: EditorialTextTabsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-6 border-b border-white/10 pb-2 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`group relative pb-2 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
              isActive ? "text-[#F7F8F8] font-semibold" : "text-[#8796A2] hover:text-[#BEC8CF]"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] ${isActive ? "text-[#9CC7D8]" : "text-[#8796A2]"}`}>
                  ({tab.count})
                </span>
              )}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#9CC7D8]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
