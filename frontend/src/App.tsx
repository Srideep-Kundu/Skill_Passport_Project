import { AuthPage } from "./pages/AuthPage";
import { RecruiterDashboard } from "./pages/RecruiterDashboard";
import { StudentDashboard } from "./pages/StudentDashboard";
import { useAuth } from "./auth/AuthContext";

export function App() {
  const { session, signOut } = useAuth();
  if (!session) return <AuthPage />;
  const isStudent = session.role === "student";
  return <><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"><a href="/" className="font-bold text-slate-950">Skill Passport</a><div className="flex items-center gap-4"><span className="text-sm text-slate-600">{session.email} · {session.role}</span><button type="button" onClick={signOut} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium">Sign out</button></div></div></header><main className="mx-auto max-w-6xl px-6 py-8">{isStudent ? <StudentDashboard token={session.access_token} /> : session.role === "recruiter" ? <RecruiterDashboard token={session.access_token} /> : <section className="rounded-xl bg-white p-6 shadow-sm"><h1 className="text-xl font-semibold">Administrator access</h1><p className="mt-2 text-slate-600">Administrative taxonomy and fairness controls remain server-authorized endpoints.</p></section>}</main></>;
}
