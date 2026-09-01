import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface LiquidGlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "gold";
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
        className={`pill-btn font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-md ${sizeClasses} ${className}`}
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
        className={`pill-btn-secondary font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }

  if (variant === "gold") {
    return (
      <button
        type="button"
        className={`pill-btn-gold font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-md ${sizeClasses} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full font-medium text-[#475569] transition-colors duration-200 hover:text-[#111827] hover:bg-[#EFEBE3] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${className}`}
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
    sm: "px-4 py-1.5 text-xs",
    md: "px-6 py-2 text-sm",
  }[size];

  const variantClasses = {
    primary: "pill-btn shadow-xs",
    secondary: "pill-btn-secondary",
    accent: "pill-btn-gold shadow-xs",
    ghost: "text-[#475569] hover:text-[#111827] hover:bg-[#EFEBE3] rounded-full",
  }[variant];

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
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
    <header className={`mb-8 w-full border-b border-[#E5E1D8] pb-6 ${className}`}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-2">
          {(category || index) && (
            <div className="text-[11px] font-mono uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
              <span>{category} {index ? `/ ${index}` : ""}</span>
            </div>
          )}
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-[#111827]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </h1>
          {/* Subtle Warm Gold Signature Line */}
          {!prefersReducedMotion ? (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              style={{ originX: 0 }}
              className="h-[1.5px] w-16 bg-[#B08D57]"
            />
          ) : (
            <div className="h-[1.5px] w-16 bg-[#B08D57]" />
          )}
          {subtitle && (
            <p className="max-w-3xl text-sm leading-relaxed text-[#475569] pt-1">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {lastUpdated && (
            <div className="text-right font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
              <div>Last Updated</div>
              <div className="text-[#111827] font-medium">{lastUpdated}</div>
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
    <div className={`p-5 rounded-[16px] border border-[#E5E1D8] bg-[#FFFFFF] shadow-[0_8px_30px_rgba(17,24,39,0.04)] ${className}`}>
      <div className="text-[11px] font-mono uppercase tracking-widest text-[#64748B] font-semibold">{label}</div>
      <div
        className="mt-2 text-3xl sm:text-4xl font-normal text-[#111827]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {value}
      </div>
      {(subtext || trend) && (
        <div className="mt-2 flex items-center justify-between text-xs text-[#475569] font-sans">
          {subtext && <span>{subtext}</span>}
          {trend && <span className="font-mono text-[#B08D57] font-medium">{trend}</span>}
        </div>
      )}
    </div>
  );
}

export function SectionRule({ className = "" }: { className?: string }) {
  return <div className={`my-8 h-px w-full bg-[#E5E1D8] ${className}`} />;
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
        return "border-[rgba(79,111,90,0.25)] bg-[rgba(79,111,90,0.10)] text-[#4F6F5A]";
      case "partially_verified":
      case "in_progress":
      case "processing":
      case "extracting":
        return "border-[rgba(166,124,58,0.25)] bg-[rgba(166,124,58,0.10)] text-[#A67C3A]";
      case "failed":
      case "rejected":
        return "border-[rgba(180,83,75,0.25)] bg-[rgba(180,83,75,0.10)] text-[#B4534B]";
      default:
        return "border-[#E5E1D8] bg-[#EFEBE3] text-[#475569]";
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-wide font-medium ${getStyle()} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
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
    <div className={`flex flex-wrap items-center gap-6 border-b border-[#E5E1D8] pb-2 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`group relative pb-2 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
              isActive ? "text-[#111827] font-semibold" : "text-[#64748B] hover:text-[#111827]"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] ${isActive ? "text-[#B08D57] font-bold" : "text-[#64748B]"}`}>
                  ({tab.count})
                </span>
              )}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#B08D57]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function EditorialCard({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`border border-[#E5E1D8] bg-[#FFFFFF] rounded-[16px] shadow-[0_8px_30px_rgba(17,24,39,0.04)] text-[#111827] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function EditorialBadge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "gold" | "success" | "muted";
  className?: string;
}) {
  const variantStyles = {
    default: "border border-[#E5E1D8] bg-[#F7F5F0] text-[#475569]",
    gold: "border border-[#B08D57]/40 bg-[rgba(176,141,87,0.08)] text-[#B08D57] font-semibold",
    success: "border border-[#86EFAC]/60 bg-[#DCFCE7] text-[#166534] font-semibold",
    muted: "border border-[#E5E1D8] bg-[#FFFFFF] text-[#64748B]",
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full ${variantStyles} ${className}`}
    >
      {children}
    </span>
  );
}
