import type { PropsWithChildren, ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center font-mono text-xs" role="status">
      <div className="h-6 w-6 rounded-full border-2 border-[#E5E1D8] border-t-[#B08D57] animate-spin mb-3" aria-hidden="true" />
      <p className="text-[#64748B] font-medium">{label}…</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-[#B4534B]/30 bg-[#FDF2F2] p-4 font-mono text-xs text-[#B4534B]">
      <AlertTriangle className="h-4 w-4 text-[#B4534B] shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <span>{message}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="ml-3 font-bold underline cursor-pointer hover:text-[#7F1D1D]">
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
    <section className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-[#E5E1D8] bg-[#FFFFFF] p-8 text-center shadow-2xs">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E5E1D8] bg-[#F7F5F0] text-[#64748B] mb-3">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h2
        className="text-lg font-normal text-[#111827]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      {children && <p className="mt-1 max-w-sm font-sans text-xs text-[#475569] leading-relaxed">{children}</p>}
    </section>
  );
}
