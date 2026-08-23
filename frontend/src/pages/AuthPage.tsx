import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, GraduationCap, Briefcase, BookOpen, Building2, X } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";

type Mode = "login" | "register";
type RegistrationRole = "student" | "recruiter" | "academician" | "institution";

export interface AuthPageProps {
  isModal?: boolean;
  onClose?: () => void;
}

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const registerStudentSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name is required"),
  university: z.string().optional(),
});

const registerRecruiterSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(2, "Company name is required"),
});

const registerAcademicianSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name is required"),
  institutionName: z.string().min(2, "Institution name is required"),
  department: z.string().min(2, "Department is required"),
  designation: z.string().min(2, "Designation is required"),
});

const registerInstitutionSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  institutionName: z.string().min(2, "Institution name is required"),
  institutionCode: z.string().min(2, "Institution code is required"),
  state: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterStudentFormData = z.infer<typeof registerStudentSchema>;
type RegisterRecruiterFormData = z.infer<typeof registerRecruiterSchema>;
type RegisterAcademicianFormData = z.infer<typeof registerAcademicianSchema>;
type RegisterInstitutionFormData = z.infer<typeof registerInstitutionSchema>;


export function AuthPage({ isModal = false, onClose }: AuthPageProps = {}) {
  const { setSession } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<RegistrationRole>("student");
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const studentForm = useForm<RegisterStudentFormData>({
    resolver: zodResolver(registerStudentSchema),
    defaultValues: { email: "", password: "", fullName: "", university: "" },
  });

  const recruiterForm = useForm<RegisterRecruiterFormData>({
    resolver: zodResolver(registerRecruiterSchema),
    defaultValues: { email: "", password: "", companyName: "" },
  });

  const academicianForm = useForm<RegisterAcademicianFormData>({
    resolver: zodResolver(registerAcademicianSchema),
    defaultValues: { email: "", password: "", fullName: "", institutionName: "", department: "Computer Science", designation: "Associate Professor" },
  });

  const institutionForm = useForm<RegisterInstitutionFormData>({
    resolver: zodResolver(registerInstitutionSchema),
    defaultValues: { email: "", password: "", institutionName: "", institutionCode: "", state: "Maharashtra" },
  });

  async function handleLoginSubmit(data: LoginFormData) {
    setError(null);
    try {
      const session = await api.login({ email: data.email, password: data.password });
      setSession(session, data.email);
      toast.success("Successfully logged in!");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Unable to authenticate. Please check your credentials.";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleStudentRegisterSubmit(data: RegisterStudentFormData) {
    setError(null);
    try {
      const session = await api.registerStudent({
        email: data.email,
        password: data.password,
        full_name: data.fullName,
        university: data.university || undefined,
      });
      setSession(session, data.email);
      toast.success("Student account created successfully!");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Unable to register student account.";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleRecruiterRegisterSubmit(data: RegisterRecruiterFormData) {
    setError(null);
    try {
      const session = await api.registerRecruiter({
        email: data.email,
        password: data.password,
        company_name: data.companyName,
      });
      setSession(session, data.email);
      toast.success("Recruiter account created successfully!");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Unable to register recruiter account.";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleAcademicianRegisterSubmit(data: RegisterAcademicianFormData) {
    setError(null);
    try {
      const session = await api.registerAcademician({
        email: data.email,
        password: data.password,
        full_name: data.fullName,
        institution_name: data.institutionName,
        department: data.department,
        designation: data.designation,
      });
      setSession(session, data.email);
      toast.success("Academician account created successfully!");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Unable to register academician account.";
      setError(msg);
      toast.error(msg);
    }
  }

  async function handleInstitutionRegisterSubmit(data: RegisterInstitutionFormData) {
    setError(null);
    try {
      const session = await api.registerInstitution({
        email: data.email,
        password: data.password,
        institution_name: data.institutionName,
        institution_code: data.institutionCode,
        state: data.state,
      });
      setSession(session, data.email);
      toast.success("Institution account created successfully!");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Unable to register institution account.";
      setError(msg);
      toast.error(msg);
    }
  }


  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null);
  const [googleModalRole, setGoogleModalRole] = useState<RegistrationRole>("student");
  const [googleCompanyName, setGoogleCompanyName] = useState<string>("");
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState<boolean>(false);

  function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    if (!credentialResponse.credential) {
      toast.error("Google authentication error: No credential returned.");
      return;
    }
    setError(null);
    setGoogleModalRole(role);
    setPendingGoogleCredential(credentialResponse.credential);
  }

  async function handleConfirmGoogleRole() {
    if (!pendingGoogleCredential) return;
    setIsGoogleSubmitting(true);
    setError(null);
    try {
      const session = await api.loginGoogle({
        credential: pendingGoogleCredential,
        role: googleModalRole,
        company_name: googleModalRole === "recruiter" ? (googleCompanyName.trim() || undefined) : undefined,
      });
      setSession(session, "Google User");
      setPendingGoogleCredential(null);
      toast.success(`Logged in as ${session.role}!`);
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Google sign-in failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsGoogleSubmitting(false);
    }
  }

  const isSubmitting =
    loginForm.formState.isSubmitting ||
    studentForm.formState.isSubmitting ||
    recruiterForm.formState.isSubmitting;

  return (
    <main
      className={`relative mx-auto grid items-center gap-8 lg:gap-12 text-slate-900 dark:text-[#f1f0e8] transition-all ${
        isModal
          ? "w-full max-w-5xl p-6 sm:p-8 lg:p-10 lg:grid-cols-2 bg-slate-50/95 dark:bg-[#101319]/95"
          : "min-h-screen max-w-6xl px-6 py-12 lg:grid-cols-2 bg-slate-50 dark:bg-[#101319]"
      }`}
    >
      {/* Close button in modal mode */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close authentication modal"
          className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#151e29]/80 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a2536] transition-all cursor-pointer shadow-xs"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Brand & Value Proposition */}
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-white/10 bg-blue-50/80 dark:bg-[#151e29] px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#3b71d9] dark:text-[#dedbc8]">
          <span className="h-2 w-2 rounded-full bg-[#3b71d9] dark:bg-[#b0c6ff] animate-pulse"></span>
          Skill Passport &middot; Lumina Intel
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-[#f1f0e8] sm:text-5xl lg:leading-[1.15]">
          Proof-backed skills. <br />
          <span className="bg-gradient-to-r from-[#3b71d9] to-[#38bdf8] bg-clip-text text-transparent">
            Transparent opportunities.
          </span>
        </h1>
        <p className="max-w-lg text-lg text-slate-600 dark:text-[#98a4b3] leading-relaxed">
          Build a portable passport from verified evidence, then see deterministic internship and team matches with every contribution mathematically explained.
        </p>

        <div className="pt-2">
          <ul className="space-y-3.5 text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              Every skill is linked to traceable evidence & repository tiers.
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              Deterministic, auditable matching formulas without LLM bias.
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              Names, universities, and protected attributes never affect scores.
            </li>
          </ul>
        </div>

      </section>

      {/* Auth Card */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821] p-7 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none">
        <div className="flex gap-2 border-b border-slate-200 dark:border-white/[0.08]">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`pb-3.5 px-3 font-semibold text-sm transition-colors relative cursor-pointer ${
              mode === "login"
                ? "text-[#3b71d9] dark:text-[#b0c6ff] border-b-2 border-[#3b71d9] dark:border-[#b0c6ff]"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(null); }}
            className={`pb-3.5 px-3 font-semibold text-sm transition-colors relative cursor-pointer ${
              mode === "register"
                ? "text-[#3b71d9] dark:text-[#b0c6ff] border-b-2 border-[#3b71d9] dark:border-[#b0c6ff]"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            Create account
          </button>
        </div>

        {/* LOGIN FORM (React Hook Form + Zod) */}
        {mode === "login" && (
          <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="mt-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-[#f1f0e8]">Welcome back</h2>
              <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-1">Enter your credentials to access your passport dashboard</p>
            </div>

            <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
              Email address
              <input
                {...loginForm.register("email")}
                type="email"
                placeholder="user@example.com"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none focus:ring-1 focus:ring-[#3b71d9] text-slate-900 dark:text-[#f1f0e8]"
              />
              {loginForm.formState.errors.email && (
                <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{loginForm.formState.errors.email.message}</span>
              )}
            </label>

            <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
              Password
              <input
                {...loginForm.register("password")}
                type="password"
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none focus:ring-1 focus:ring-[#3b71d9] text-slate-900 dark:text-[#f1f0e8]"
              />
              {loginForm.formState.errors.password && (
                <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{loginForm.formState.errors.password.message}</span>
              )}
            </label>

            {error && (
              <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900/80 bg-red-50 dark:bg-red-950/40 p-3 text-xs font-medium text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#3b71d9] py-2.5 font-semibold text-white shadow-md shadow-[#3b71d9]/25 hover:bg-[#2563eb] focus:outline-none disabled:opacity-50 cursor-pointer transition-all text-sm"
            >
              {isSubmitting ? "Authenticating..." : "Sign in"}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === "register" && (
          <div className="mt-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-[#f1f0e8]">Create your passport account</h2>
              <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-1">Get started with verifiable skill portfolios</p>
            </div>

            <fieldset className="space-y-2 pt-1">
              <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#98a4b3]">I am registering as</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all ${
                  role === "student" ? "border-[#3b71d9] bg-blue-50/50 dark:bg-[#182337] text-[#3b71d9] dark:text-[#b0c6ff] shadow-sm" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-[#98a4b3] hover:bg-slate-50 dark:hover:bg-[#151e29]"
                }`}>
                  <input
                    type="radio"
                    className="sr-only"
                    name="role"
                    checked={role === "student"}
                    onChange={() => setRole("student")}
                  />
                  <GraduationCap className="h-3.5 w-3.5 shrink-0 text-[#3b71d9]" aria-hidden="true" />
                  <span>Student</span>
                </label>

                <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all ${
                  role === "recruiter" ? "border-[#3b71d9] bg-blue-50/50 dark:bg-[#182337] text-[#3b71d9] dark:text-[#b0c6ff] shadow-sm" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-[#98a4b3] hover:bg-slate-50 dark:hover:bg-[#151e29]"
                }`}>
                  <input
                    type="radio"
                    className="sr-only"
                    name="role"
                    checked={role === "recruiter"}
                    onChange={() => setRole("recruiter")}
                  />
                  <Briefcase className="h-3.5 w-3.5 shrink-0 text-[#3b71d9]" aria-hidden="true" />
                  <span>Recruiter</span>
                </label>

                <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all ${
                  role === "academician" ? "border-[#3b71d9] bg-blue-50/50 dark:bg-[#182337] text-[#3b71d9] dark:text-[#b0c6ff] shadow-sm" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-[#98a4b3] hover:bg-slate-50 dark:hover:bg-[#151e29]"
                }`}>
                  <input
                    type="radio"
                    className="sr-only"
                    name="role"
                    checked={role === "academician"}
                    onChange={() => setRole("academician")}
                  />
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#3b71d9]" aria-hidden="true" />
                  <span>Faculty</span>
                </label>

                <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all ${
                  role === "institution" ? "border-[#3b71d9] bg-blue-50/50 dark:bg-[#182337] text-[#3b71d9] dark:text-[#b0c6ff] shadow-sm" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-[#98a4b3] hover:bg-slate-50 dark:hover:bg-[#151e29]"
                }`}>
                  <input
                    type="radio"
                    className="sr-only"
                    name="role"
                    checked={role === "institution"}
                    onChange={() => setRole("institution")}
                  />
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-[#3b71d9]" aria-hidden="true" />
                  <span>University</span>
                </label>
              </div>
            </fieldset>

            {role === "student" && (
              <form onSubmit={studentForm.handleSubmit(handleStudentRegisterSubmit)} className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Full name
                  <input
                    {...studentForm.register("fullName")}
                    placeholder="e.g. Maya Rivera"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {studentForm.formState.errors.fullName && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{studentForm.formState.errors.fullName.message}</span>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  University <span className="font-normal text-slate-400 text-xs">(optional)</span>
                  <input
                    {...studentForm.register("university")}
                    placeholder="e.g. State University"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Email address
                  <input
                    {...studentForm.register("email")}
                    type="email"
                    placeholder="user@example.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {studentForm.formState.errors.email && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{studentForm.formState.errors.email.message}</span>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Password
                  <input
                    {...studentForm.register("password")}
                    type="password"
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {studentForm.formState.errors.password && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{studentForm.formState.errors.password.message}</span>
                  )}
                </label>

                {error && (
                  <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900/80 bg-red-50 dark:bg-red-950/40 p-3 text-xs font-medium text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#3b71d9] py-2.5 font-semibold text-white shadow-md shadow-[#3b71d9]/25 hover:bg-[#2563eb] focus:outline-none disabled:opacity-50 cursor-pointer transition-all text-sm"
                >
                  {isSubmitting ? "Creating Student Account..." : "Create Student Account"}
                </button>
              </form>
            )}

            {role === "recruiter" && (
              <form onSubmit={recruiterForm.handleSubmit(handleRecruiterRegisterSubmit)} className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Company name
                  <input
                    {...recruiterForm.register("companyName")}
                    placeholder="e.g. Acme Tech Labs"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {recruiterForm.formState.errors.companyName && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{recruiterForm.formState.errors.companyName.message}</span>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Email address
                  <input
                    {...recruiterForm.register("email")}
                    type="email"
                    placeholder="user@example.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {recruiterForm.formState.errors.email && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{recruiterForm.formState.errors.email.message}</span>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Password
                  <input
                    {...recruiterForm.register("password")}
                    type="password"
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {recruiterForm.formState.errors.password && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{recruiterForm.formState.errors.password.message}</span>
                  )}
                </label>

                {error && (
                  <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900/80 bg-red-50 dark:bg-red-950/40 p-3 text-xs font-medium text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#3b71d9] py-2.5 font-semibold text-white shadow-md shadow-[#3b71d9]/25 hover:bg-[#2563eb] focus:outline-none disabled:opacity-50 cursor-pointer transition-all text-sm"
                >
                  {isSubmitting ? "Creating Recruiter Account..." : "Create Recruiter Account"}
                </button>
              </form>
            )}

            {role === "academician" && (
              <form onSubmit={academicianForm.handleSubmit(handleAcademicianRegisterSubmit)} className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Full name
                  <input
                    {...academicianForm.register("fullName")}
                    placeholder="e.g. Dr. Arvind Rao"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {academicianForm.formState.errors.fullName && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{academicianForm.formState.errors.fullName.message}</span>
                  )}
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                    Institution
                    <input
                      {...academicianForm.register("institutionName")}
                      placeholder="e.g. IIT Bombay"
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                    />
                    {academicianForm.formState.errors.institutionName && (
                      <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{academicianForm.formState.errors.institutionName.message}</span>
                    )}
                  </label>
                  <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                    Department
                    <input
                      {...academicianForm.register("department")}
                      placeholder="e.g. Computer Science"
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                    />
                    {academicianForm.formState.errors.department && (
                      <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{academicianForm.formState.errors.department.message}</span>
                    )}
                  </label>
                </div>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Designation
                  <input
                    {...academicianForm.register("designation")}
                    placeholder="e.g. Professor & Head of AI"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {academicianForm.formState.errors.designation && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{academicianForm.formState.errors.designation.message}</span>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Email address
                  <input
                    {...academicianForm.register("email")}
                    type="email"
                    placeholder="faculty@example.edu"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {academicianForm.formState.errors.email && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{academicianForm.formState.errors.email.message}</span>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Password
                  <input
                    {...academicianForm.register("password")}
                    type="password"
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {academicianForm.formState.errors.password && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{academicianForm.formState.errors.password.message}</span>
                  )}
                </label>

                {error && (
                  <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900/80 bg-red-50 dark:bg-red-950/40 p-3 text-xs font-medium text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#3b71d9] py-2.5 font-semibold text-white shadow-md shadow-[#3b71d9]/25 hover:bg-[#2563eb] focus:outline-none disabled:opacity-50 cursor-pointer transition-all text-sm"
                >
                  {isSubmitting ? "Creating Faculty Account..." : "Create Faculty Account"}
                </button>
              </form>
            )}

            {role === "institution" && (
              <form onSubmit={institutionForm.handleSubmit(handleInstitutionRegisterSubmit)} className="space-y-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
                  Public-pilot institution accounts are invite-only. Use the administrative email included in your invitation.
                </div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Institution Name
                  <input
                    {...institutionForm.register("institutionName")}
                    placeholder="e.g. National Institute of Technology"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {institutionForm.formState.errors.institutionName && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{institutionForm.formState.errors.institutionName.message}</span>
                  )}
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                    Institution Code (AISHE)
                    <input
                      {...institutionForm.register("institutionCode")}
                      placeholder="e.g. C-12345"
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                    />
                    {institutionForm.formState.errors.institutionCode && (
                      <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{institutionForm.formState.errors.institutionCode.message}</span>
                    )}
                  </label>
                  <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                    State / Region
                    <input
                      {...institutionForm.register("state")}
                      placeholder="e.g. Karnataka"
                      className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                    />
                    {institutionForm.formState.errors.state && (
                      <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{institutionForm.formState.errors.state.message}</span>
                    )}
                  </label>
                </div>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Administrative Email
                  <input
                    {...institutionForm.register("email")}
                    type="email"
                    placeholder="dean@university.edu"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {institutionForm.formState.errors.email && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{institutionForm.formState.errors.email.message}</span>
                  )}
                </label>

                <label className="block text-sm font-medium text-slate-700 dark:text-[#f1f0e8]">
                  Password
                  <input
                    {...institutionForm.register("password")}
                    type="password"
                    placeholder="••••••••"
                    className="mt-1 w-full rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-sm focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                  />
                  {institutionForm.formState.errors.password && (
                    <span className="text-xs text-rose-600 dark:text-rose-400 mt-1 block">{institutionForm.formState.errors.password.message}</span>
                  )}
                </label>

                {error && (
                  <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900/80 bg-red-50 dark:bg-red-950/40 p-3 text-xs font-medium text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-[#3b71d9] py-2.5 font-semibold text-white shadow-md shadow-[#3b71d9]/25 hover:bg-[#2563eb] focus:outline-none disabled:opacity-50 cursor-pointer transition-all text-sm"
                >
                  {isSubmitting ? "Creating University Account..." : "Create University Account"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Google OAuth & Social Auth Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-white/[0.08]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-[#111821] px-3 text-slate-500 dark:text-[#98a4b3] font-medium tracking-wider">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google Login Component */}
        <div className="flex flex-col items-center justify-center w-full min-h-[44px]">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => {
              setError("Google authentication was unsuccessful.");
              toast.error("Google authentication failed.");
            }}
            useOneTap={false}
            theme="outline"
            shape="rectangular"
            size="large"
            width="100%"
            text={mode === "login" ? "signin_with" : "signup_with"}
          />
        </div>

      </section>

      {/* Google Role Selection Modal */}
      {pendingGoogleCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200/80 dark:border-white/[0.12] bg-white/90 dark:bg-[#0c121e]/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl space-y-5 text-slate-900 dark:text-[#f1f0e8] max-h-[90vh] overflow-y-auto">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-2 backdrop-blur-xs font-sans">
                <GraduationCap className="h-3.5 w-3.5" />
                Google Account Verified
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">
                Select Your Account Type
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-1 font-sans">
                Choose how you would like to participate in Skill Passport.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Student */}
              <button
                type="button"
                onClick={() => setGoogleModalRole("student")}
                className={`flex items-start gap-3.5 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                  googleModalRole === "student"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-600/30 text-slate-900 dark:text-white"
                    : "border-slate-200/70 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] bg-slate-50/50 dark:bg-white/[0.02]"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${
                  googleModalRole === "student"
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                }`}>
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Student / Candidate</span>
                    {googleModalRole === "student" && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 leading-relaxed font-sans">
                    Build a proof-backed portfolio, verify coursework & GitHub projects, and explore deterministic matches.
                  </p>
                </div>
              </button>

              {/* Recruiter */}
              <button
                type="button"
                onClick={() => setGoogleModalRole("recruiter")}
                className={`flex items-start gap-3.5 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                  googleModalRole === "recruiter"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-600/30 text-slate-900 dark:text-white"
                    : "border-slate-200/70 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] bg-slate-50/50 dark:bg-white/[0.02]"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${
                  googleModalRole === "recruiter"
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                }`}>
                  <Briefcase className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Recruiter / Employer</span>
                    {googleModalRole === "recruiter" && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 leading-relaxed font-sans">
                    Source verified candidate profiles with auditable match calculations and skill telemetry.
                  </p>
                </div>
              </button>

              {/* Faculty / Academician */}
              <button
                type="button"
                onClick={() => setGoogleModalRole("academician")}
                className={`flex items-start gap-3.5 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                  googleModalRole === "academician"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-600/30 text-slate-900 dark:text-white"
                    : "border-slate-200/70 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] bg-slate-50/50 dark:bg-white/[0.02]"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${
                  googleModalRole === "academician"
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                }`}>
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Faculty / Academician</span>
                    {googleModalRole === "academician" && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 leading-relaxed font-sans">
                    Curate department curriculum benchmarks, verify coursework evidence, and mentor students.
                  </p>
                </div>
              </button>

              {/* Institution / University */}
              <button
                type="button"
                onClick={() => setGoogleModalRole("institution")}
                className={`flex items-start gap-3.5 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                  googleModalRole === "institution"
                    ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-600/30 text-slate-900 dark:text-white"
                    : "border-slate-200/70 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.16] bg-slate-50/50 dark:bg-white/[0.02]"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${
                  googleModalRole === "institution"
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"
                    : "bg-slate-200/70 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                }`}>
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-[#f1f0e8] font-sans">Institution / College</span>
                    {googleModalRole === "institution" && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 leading-relaxed font-sans">
                    Manage campus placement drives, track department skill readiness, and view institutional analytics.
                  </p>
                </div>
              </button>
            </div>

            {googleModalRole !== "student" && (
              <div className="space-y-1.5 pt-1 animate-in fade-in duration-150 font-sans">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-[#98a4b3]">
                  {googleModalRole === "recruiter"
                    ? "Company / Organization Name"
                    : googleModalRole === "academician"
                    ? "University / Institution Name"
                    : "Institution / College Name"}
                </label>
                <input
                  type="text"
                  value={googleCompanyName}
                  onChange={(e) => setGoogleCompanyName(e.target.value)}
                  placeholder={
                    googleModalRole === "recruiter"
                      ? "e.g. Acme Tech Labs"
                      : googleModalRole === "academician"
                      ? "e.g. Stanford University"
                      : "e.g. National Institute of Technology"
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3.5 py-2 text-sm focus:border-indigo-600 focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2 font-sans">
              <button
                type="button"
                onClick={() => setPendingGoogleCredential(null)}
                disabled={isGoogleSubmitting}
                className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 py-2.5 text-sm font-semibold text-slate-700 dark:text-[#dedbc8] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGoogleRole}
                disabled={isGoogleSubmitting}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2.5 text-sm font-semibold text-white transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGoogleSubmitting
                  ? "Connecting..."
                  : `Continue as ${
                      googleModalRole === "student"
                        ? "Student"
                        : googleModalRole === "recruiter"
                        ? "Recruiter"
                        : googleModalRole === "academician"
                        ? "Faculty"
                        : "Institution"
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
