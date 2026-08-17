import { lazy, Suspense } from "react";
import { AuthPage } from "./pages/AuthPage";
import { useAuth } from "./auth/AuthContext";

const RecruiterDashboard = lazy(async () => ({
  default: (await import("./pages/RecruiterDashboard")).RecruiterDashboard,
}));
const StudentDashboard = lazy(async () => ({
  default: (await import("./pages/StudentDashboard")).StudentDashboard,
}));

export function App() {
  const { session, signOut } = useAuth();
  if (!session) return <AuthPage />;
  const isStudent = session.role === "student";
  return <><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><a href="/" className="font-bold text-slate-950">Skill Passport</a><div className="flex items-center gap-4"><span className="text-sm text-slate-600">{session.email} · {session.role}</span><button type="button" onClick={signOut} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium">Sign out</button></div></div></header><main className="mx-auto max-w-6xl px-6 py-8">{isStudent ? <Suspense fallback={<p className="text-slate-600">Loading dashboard…</p>}><StudentDashboard token={session.access_token} /></Suspense> : session.role === "recruiter" ? <Suspense fallback={<p className="text-slate-600">Loading dashboard…</p>}><RecruiterDashboard token={session.access_token} /></Suspense> : <section className="rounded-xl bg-white p-6 shadow-sm"><h1 className="text-xl font-semibold">Administrator access</h1><p className="mt-2 text-slate-600">Administrative taxonomy and fairness controls remain server-authorized endpoints.</p></section>}</main></>;
}
