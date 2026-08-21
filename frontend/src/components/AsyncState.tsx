import type { PropsWithChildren, ReactNode } from "react";
import { LoaderCircle, AlertTriangle, Inbox } from "lucide-react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center" role="status">
      <LoaderCircle className="h-7 w-7 animate-spin text-indigo-600 dark:text-indigo-400 mb-2.5" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}…</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-4 text-xs font-medium text-red-800 dark:text-red-300">
      <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <span>{message}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="ml-3 font-bold underline cursor-pointer hover:text-red-900 dark:hover:text-red-200">
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
    <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 mb-3">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">{title}</h2>
      {children && <p className="mt-1.5 max-w-sm text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{children}</p>}
    </section>
  );
}
