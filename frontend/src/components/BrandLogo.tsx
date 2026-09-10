interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

export function BrandLogo({ compact = false, className = "" }: BrandLogoProps) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {/* Frame the supplied artwork's compass without altering the original asset. */}
      <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full mix-blend-multiply">
        <img
          src="/branding/lumina-intel.png"
          alt={compact ? "Lumina Intel" : ""}
          width={2000}
          height={2000}
          className="absolute max-w-none"
          style={{ width: "222.222%", left: "-63.889%", top: "-48.611%" }}
        />
      </span>
      {!compact && (
        <span className="whitespace-nowrap font-serif text-lg font-bold uppercase tracking-tight text-[#404341] sm:text-xl">
          Lumina Intel
        </span>
      )}
    </span>
  );
}
