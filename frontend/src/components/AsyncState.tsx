import type { PropsWithChildren, ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center font-mono text-xs" role="status">
      <div className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin mb-3" aria-hidden="true" />
      <p className="text-[#8796A2]">{label}…</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-950/20 p-4 font-mono text-xs text-red-300">
      <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <span>{message}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="ml-3 font-semibold underline cursor-pointer hover:text-white">
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  icon,
  children,
}: PropsWithChildren<{ title: string; icon?: ReactNode }>) {
  return (
    <section className="flex flex-col items-center justify-center rounded-md border border-dashed border-white/15 bg-white/[0.01] p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-[#8796A2] mb-3">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h2
        className="text-lg font-normal text-[#F7F8F8]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      {children && <p className="mt-1 max-w-sm font-mono text-xs text-[#8796A2] leading-relaxed">{children}</p>}
    </section>
  );
}
