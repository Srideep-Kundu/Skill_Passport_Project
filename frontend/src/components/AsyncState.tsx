import type { PropsWithChildren } from "react";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return <p className="py-8 text-center text-slate-600" role="status">{label}…</p>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{message}{onRetry && <button type="button" onClick={onRetry} className="ml-3 underline">Retry</button>}</div>;
}

export function EmptyState({ title, children }: PropsWithChildren<{ title: string }>) {
  return <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><h2 className="font-semibold text-slate-900">{title}</h2>{children && <p className="mt-2 text-sm text-slate-600">{children}</p>}</section>;
}
