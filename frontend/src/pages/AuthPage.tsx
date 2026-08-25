import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { LiquidGlassButton } from "../components/ui/EditorialPrimitives";

type Mode = "login" | "register";
type RegistrationRole = "student" | "recruiter" | "academician" | "institution";

export interface AuthPageProps {
  isModal?: boolean;
  initialMode?: Mode;
  initialRole?: RegistrationRole;
  onClose?: () => void;
}

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const TYPO_DOMAINS: Record<string, string> = {
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmaul.com": "gmail.com",
  "gamil.co": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "icoud.com": "icloud.com",
};

const emailSchema = z
  .string()
  .min(1, "Email address is required")
  .superRefine((val, ctx) => {
    const trimmed = val.trim().toLowerCase();
    if (!emailRegex.test(trimmed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a valid email ID. Please enter a valid email address.",
      });
      return;
    }
    if (trimmed.includes("..") || trimmed.includes(".@") || trimmed.includes("@.")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a valid email ID.",
      });
      return;
    }
    const parts = trimmed.split("@");
    if (parts.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a valid email ID.",
      });
      return;
    }
    const domain = parts[1];
    if (TYPO_DOMAINS[domain]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Not a valid email ID. Did you mean @${TYPO_DOMAINS[domain]}?`,
      });
      return;
    }
    const domainParts = domain.split(".");
    if (domainParts.length < 2 || domainParts.some((p) => p.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a valid email ID. Domain must have a valid extension.",
      });
      return;
    }
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a valid email ID. Top-level domain must be valid.",
      });
      return;
    }
  });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const registerStudentSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name is required"),
  university: z.string().optional(),
});

const registerRecruiterSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(2, "Company name is required"),
});

const registerAcademicianSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name is required"),
  institutionName: z.string().min(2, "Institution name is required"),
  department: z.string().min(2, "Department is required"),
  designation: z.string().min(2, "Designation is required"),
});

const registerInstitutionSchema = z.object({
  email: emailSchema,
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

export function AuthPage({ isModal = false, initialMode = "login", initialRole = "student", onClose }: AuthPageProps = {}) {
  const { setSession } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [role, setRole] = useState<RegistrationRole>(initialRole);
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
      if (onClose) onClose();
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
      if (onClose) onClose();
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
      if (onClose) onClose();
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
      toast.success("Faculty account created successfully!");
      if (onClose) onClose();
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
      if (onClose) onClose();
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
      if (onClose) onClose();
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
    recruiterForm.formState.isSubmitting ||
    academicianForm.formState.isSubmitting ||
    institutionForm.formState.isSubmitting;

  return (
    <div className={`relative w-full text-white ${isModal ? "" : "min-h-screen py-12 px-6 flex items-center justify-center bg-[#031322]"}`}>
      {/* Modal Close Button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-0 right-0 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-neutral-400 hover:text-white hover:border-white/20 transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-start w-full max-w-5xl mx-auto">
        {/* Left Narrative Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
            AUTHENTICATION GATEWAY
          </div>
          <h2
            className="text-3xl sm:text-4xl font-normal leading-[1.05] tracking-tight text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {mode === "login" ? "Welcome back to your passport." : "Build your evidence-backed identity."}
          </h2>
          <p className="text-sm leading-relaxed text-neutral-300">
            Access auditable skill telemetry, verifiable project credentials, and explainable internship matching.
          </p>

          <div className="space-y-4 pt-4 border-t border-white/10 text-xs font-mono text-neutral-400">
            <div className="flex items-start gap-3">
              <span className="text-white shrink-0">01</span>
              <span>Every passport skill traces to concrete evidence records</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-white shrink-0">02</span>
              <span>Deterministic computation without black-box AI bias</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-white shrink-0">03</span>
              <span>Protected attributes never influence matching formulas</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 border border-white/10 bg-[#061524]/70 p-6 sm:p-8 rounded-lg backdrop-blur-xs">
          {/* Mode Switcher */}
          <div className="flex border-b border-white/10 mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className={`pb-3 px-4 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                mode === "login"
                  ? "text-white border-b-2 border-white font-semibold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              className={`pb-3 px-4 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                mode === "register"
                  ? "text-white border-b-2 border-white font-semibold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* LOGIN VIEW */}
          {mode === "login" && (
            <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                  Email Address
                </label>
                <input
                  id="login-email"
                  {...loginForm.register("email")}
                  type="email"
                  placeholder="user@example.com"
                  className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-400 focus:border-white focus:outline-none transition-colors"
                />
                {loginForm.formState.errors.email && (
                  <span className="text-xs text-red-400 mt-1 block">{loginForm.formState.errors.email.message}</span>
                )}
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1.5">
                  Password
                </label>
                <input
                  id="login-password"
                  {...loginForm.register("password")}
                  type="password"
                  placeholder="••••••••"
                  className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-400 focus:border-white focus:outline-none transition-colors"
                />
                {loginForm.formState.errors.password && (
                  <span className="text-xs text-red-400 mt-1 block">{loginForm.formState.errors.password.message}</span>
                )}
              </div>

              {error && (
                <div role="alert" className="rounded-md border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="pt-2">
                <LiquidGlassButton
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3"
                >
                  {isSubmitting ? "Authenticating..." : "Sign In to Workspace"}
                </LiquidGlassButton>
              </div>
            </form>
          )}

          {/* REGISTER VIEW */}
          {mode === "register" && (
            <div className="space-y-6">
              {/* 4-Persona Selector */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-neutral-400 mb-2">
                  Select Role
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Registration role">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === "student"}
                    onClick={() => setRole("student")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      role === "student"
                        ? "border-white bg-white/10 text-white"
                        : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">01 / STUDENT</div>
                    <div className="text-sm font-medium text-white mt-0.5">Student</div>
                    <div className="text-[11px] text-neutral-400 font-sans mt-1">Build a verified portfolio</div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === "recruiter"}
                    onClick={() => setRole("recruiter")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      role === "recruiter"
                        ? "border-white bg-white/10 text-white"
                        : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">02 / RECRUITER</div>
                    <div className="text-sm font-medium text-white mt-0.5">Recruiter</div>
                    <div className="text-[11px] text-neutral-400 font-sans mt-1">Discover verified candidates</div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === "academician"}
                    onClick={() => setRole("academician")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      role === "academician"
                        ? "border-white bg-white/10 text-white"
                        : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">03 / FACULTY</div>
                    <div className="text-sm font-medium text-white mt-0.5">Faculty</div>
                    <div className="text-[11px] text-neutral-400 font-sans mt-1">Collaborate with industry</div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === "institution"}
                    onClick={() => setRole("institution")}
                    className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                      role === "institution"
                        ? "border-white bg-white/10 text-white"
                        : "border-white/10 bg-white/[0.02] text-neutral-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">04 / UNIVERSITY</div>
                    <div className="text-sm font-medium text-white mt-0.5">Institution</div>
                    <div className="text-[11px] text-neutral-400 font-sans mt-1">Institutional intelligence</div>
                  </button>
                </div>
              </div>

              {/* STUDENT FORM */}
              {role === "student" && (
                <form onSubmit={studentForm.handleSubmit(handleStudentRegisterSubmit)} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Full Name</label>
                    <input
                      {...studentForm.register("fullName")}
                      placeholder="e.g. Maya Rivera"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                    {studentForm.formState.errors.fullName && (
                      <span className="text-xs text-red-400 mt-1 block">{studentForm.formState.errors.fullName.message}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                      University <span className="text-neutral-400 lowercase">(optional)</span>
                    </label>
                    <input
                      {...studentForm.register("university")}
                      placeholder="e.g. State University"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Email Address</label>
                    <input
                      {...studentForm.register("email")}
                      type="email"
                      placeholder="student@university.edu"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                    {studentForm.formState.errors.email && (
                      <span className="text-xs text-red-400 mt-1 block">{studentForm.formState.errors.email.message}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Password</label>
                    <input
                      {...studentForm.register("password")}
                      type="password"
                      placeholder="••••••••"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                    {studentForm.formState.errors.password && (
                      <span className="text-xs text-red-400 mt-1 block">{studentForm.formState.errors.password.message}</span>
                    )}
                  </div>

                  {error && <div className="p-3 text-xs text-red-300 border border-red-500/30 bg-red-950/20 rounded-md">{error}</div>}

                  <LiquidGlassButton type="submit" disabled={isSubmitting} className="w-full py-3">
                    {isSubmitting ? "Creating Student Account..." : "Create Student Account"}
                  </LiquidGlassButton>
                </form>
              )}

              {/* RECRUITER FORM */}
              {role === "recruiter" && (
                <form onSubmit={recruiterForm.handleSubmit(handleRecruiterRegisterSubmit)} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Company Name</label>
                    <input
                      {...recruiterForm.register("companyName")}
                      placeholder="e.g. Acme Labs"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                    {recruiterForm.formState.errors.companyName && (
                      <span className="text-xs text-red-400 mt-1 block">{recruiterForm.formState.errors.companyName.message}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Work Email</label>
                    <input
                      {...recruiterForm.register("email")}
                      type="email"
                      placeholder="recruiter@company.com"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                    {recruiterForm.formState.errors.email && (
                      <span className="text-xs text-red-400 mt-1 block">{recruiterForm.formState.errors.email.message}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Password</label>
                    <input
                      {...recruiterForm.register("password")}
                      type="password"
                      placeholder="••••••••"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                    {recruiterForm.formState.errors.password && (
                      <span className="text-xs text-red-400 mt-1 block">{recruiterForm.formState.errors.password.message}</span>
                    )}
                  </div>

                  {error && <div className="p-3 text-xs text-red-300 border border-red-500/30 bg-red-950/20 rounded-md">{error}</div>}

                  <LiquidGlassButton type="submit" disabled={isSubmitting} className="w-full py-3">
                    {isSubmitting ? "Creating Recruiter Account..." : "Create Recruiter Account"}
                  </LiquidGlassButton>
                </form>
              )}

              {/* ACADEMICIAN FORM */}
              {role === "academician" && (
                <form onSubmit={academicianForm.handleSubmit(handleAcademicianRegisterSubmit)} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Full Name</label>
                    <input
                      {...academicianForm.register("fullName")}
                      placeholder="e.g. Dr. Arvind Rao"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Institution</label>
                      <input
                        {...academicianForm.register("institutionName")}
                        placeholder="e.g. IIT Bombay"
                        className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Department</label>
                      <input
                        {...academicianForm.register("department")}
                        placeholder="e.g. Computer Science"
                        className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Designation</label>
                    <input
                      {...academicianForm.register("designation")}
                      placeholder="e.g. Professor & Head of AI"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Academic Email</label>
                    <input
                      {...academicianForm.register("email")}
                      type="email"
                      placeholder="faculty@iitb.ac.in"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Password</label>
                    <input
                      {...academicianForm.register("password")}
                      type="password"
                      placeholder="••••••••"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  {error && <div className="p-3 text-xs text-red-300 border border-red-500/30 bg-red-950/20 rounded-md">{error}</div>}

                  <LiquidGlassButton type="submit" disabled={isSubmitting} className="w-full py-3">
                    {isSubmitting ? "Creating Faculty Account..." : "Create Faculty Account"}
                  </LiquidGlassButton>
                </form>
              )}

              {/* INSTITUTION FORM */}
              {role === "institution" && (
                <form onSubmit={institutionForm.handleSubmit(handleInstitutionRegisterSubmit)} className="space-y-3.5">
                  <div className="rounded-md border border-white/10 bg-white/[0.02] p-3 text-xs text-neutral-300 font-mono">
                    Public-pilot institution accounts are invite-only. Use the administrative email included in your invitation.
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Institution Name</label>
                    <input
                      {...institutionForm.register("institutionName")}
                      placeholder="e.g. National Institute of Technology"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">AISHE Code</label>
                      <input
                        {...institutionForm.register("institutionCode")}
                        placeholder="e.g. C-12345"
                        className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">State</label>
                      <input
                        {...institutionForm.register("state")}
                        placeholder="e.g. Karnataka"
                        className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Admin Email</label>
                    <input
                      {...institutionForm.register("email")}
                      type="email"
                      placeholder="dean@university.edu"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">Password</label>
                    <input
                      {...institutionForm.register("password")}
                      type="password"
                      placeholder="••••••••"
                      className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                    />
                  </div>

                  {error && <div className="p-3 text-xs text-red-300 border border-red-500/30 bg-red-950/20 rounded-md">{error}</div>}

                  <LiquidGlassButton type="submit" disabled={isSubmitting} className="w-full py-3">
                    {isSubmitting ? "Creating University Account..." : "Create University Account"}
                  </LiquidGlassButton>
                </form>
              )}
            </div>
          )}

          {/* Social Auth Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest text-neutral-400">
              <span className="bg-[#061524] px-3">Or continue with</span>
            </div>
          </div>

          {/* Google OAuth Button */}
          <div className="flex flex-col items-center justify-center w-full min-h-[44px]">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => {
                setError("Google authentication was unsuccessful.");
                toast.error("Google authentication failed.");
              }}
              useOneTap={false}
              theme="filled_black"
              shape="rectangular"
              size="large"
              width="100%"
              text={mode === "login" ? "signin_with" : "signup_with"}
            />
          </div>
        </div>
      </div>

      {/* Google Role Confirmation Dialog */}
      {pendingGoogleCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#031322]/85 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/15 bg-[#061524] p-6 sm:p-7 shadow-2xl space-y-5 text-white">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-1">
                GOOGLE AUTHENTICATED
              </div>
              <h3 className="text-2xl font-normal text-white" style={{ fontFamily: "var(--font-display)" }}>
                Select Your Account Type
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Choose how you would like to participate in Skill Passport.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setGoogleModalRole("student")}
                className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                  googleModalRole === "student" ? "border-white bg-white/10" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="font-mono text-xs text-neutral-400">01 / STUDENT</div>
                <div className="text-sm font-medium text-white">Student / Candidate</div>
              </button>
              <button
                type="button"
                onClick={() => setGoogleModalRole("recruiter")}
                className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                  googleModalRole === "recruiter" ? "border-white bg-white/10" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="font-mono text-xs text-neutral-400">02 / RECRUITER</div>
                <div className="text-sm font-medium text-white">Recruiter / Employer</div>
              </button>
              <button
                type="button"
                onClick={() => setGoogleModalRole("academician")}
                className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                  googleModalRole === "academician" ? "border-white bg-white/10" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="font-mono text-xs text-neutral-400">03 / FACULTY</div>
                <div className="text-sm font-medium text-white">Faculty / Academician</div>
              </button>
              <button
                type="button"
                onClick={() => setGoogleModalRole("institution")}
                className={`p-3 rounded-md border text-left transition-all cursor-pointer ${
                  googleModalRole === "institution" ? "border-white bg-white/10" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <div className="font-mono text-xs text-neutral-400">04 / UNIVERSITY</div>
                <div className="text-sm font-medium text-white">Institution / Leadership</div>
              </button>
            </div>

            {googleModalRole !== "student" && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400">
                  {googleModalRole === "recruiter"
                    ? "Company Name"
                    : googleModalRole === "academician"
                    ? "Institution Name"
                    : "University Name"}
                </label>
                <input
                  type="text"
                  value={googleCompanyName}
                  onChange={(e) => setGoogleCompanyName(e.target.value)}
                  placeholder="e.g. Organization Name"
                  className="w-full rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-white focus:outline-none"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingGoogleCredential(null)}
                disabled={isGoogleSubmitting}
                className="flex-1 rounded-full border border-white/20 py-2.5 text-xs font-mono uppercase tracking-wider text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <LiquidGlassButton
                onClick={handleConfirmGoogleRole}
                disabled={isGoogleSubmitting}
                className="flex-1 py-2.5 text-xs"
              >
                {isGoogleSubmitting ? "Connecting..." : "Confirm & Enter"}
              </LiquidGlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
