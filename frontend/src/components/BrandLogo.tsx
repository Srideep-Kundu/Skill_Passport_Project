interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <img
      src="/branding/favicon.svg"
      alt="Lumina Intel"
      width={40}
      height={40}
      className={`h-10 w-10 shrink-0 object-contain ${className}`}
    />
  );
}
