import { useState } from "react";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";

type Mode = "login" | "register";
type RegistrationRole = "student" | "recruiter";

export function AuthPage() {
  const { setSession } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<RegistrationRole>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const session = mode === "login"
        ? await api.login({ email, password })
        : role === "student"
          ? await api.registerStudent({ email, password, full_name: fullName, university: university || undefined })
          : await api.registerRecruiter({ email, password, company_name: companyName });
      setSession(session, email);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.detail : "Unable to authenticate. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2"><section><p className="font-semibold tracking-wide text-indigo-600">SKILL PASSPORT</p><h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Proof-backed skills. Transparent opportunities.</h1><p className="mt-5 max-w-lg text-lg text-slate-600">Build a portable passport from evidence, then see deterministic internship and team matches with every contribution explained.</p><ul className="mt-8 space-y-3 text-slate-700"><li>✓ Every skill is linked to evidence.</li><li>✓ Match scores are deterministic and auditable.</li><li>✓ Protected attributes never influence matching.</li></ul></section><section className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/60"><div className="flex gap-2 border-b border-slate-200"><button type="button" onClick={() => setMode("login")} className={`px-4 py-3 font-medium ${mode === "login" ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-500"}`}>Sign in</button><button type="button" onClick={() => setMode("register")} className={`px-4 py-3 font-medium ${mode === "register" ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-500"}`}>Create account</button></div><form onSubmit={handleSubmit} className="mt-6 space-y-4"><h2 className="text-xl font-semibold">{mode === "login" ? "Welcome back" : "Create your passport account"}</h2>{mode === "register" && <fieldset><legend className="mb-2 text-sm font-medium">I am a</legend><div className="flex gap-3"><label className="flex items-center gap-2"><input type="radio" checked={role === "student"} onChange={() => setRole("student")} />Student</label><label className="flex items-center gap-2"><input type="radio" checked={role === "recruiter"} onChange={() => setRole("recruiter")} />Recruiter</label></div></fieldset>}{mode === "register" && role === "student" && <><label className="block text-sm font-medium">Full name<input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" autoComplete="name" /></label><label className="block text-sm font-medium">University <span className="font-normal text-slate-500">(display only)</span><input value={university} onChange={(event) => setUniversity(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" autoComplete="organization" /></label></>}{mode === "register" && role === "recruiter" && <label className="block text-sm font-medium">Company name<input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" autoComplete="organization" /></label>}<label className="block text-sm font-medium">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" autoComplete="email" /></label><label className="block text-sm font-medium">Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={isSubmitting} className="w-full rounded bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300">{isSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button></form></section></main>;
}
