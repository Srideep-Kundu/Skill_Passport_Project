import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";

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
  password: z.string().min(1, "Password is required"),
});

const registerStudentSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  university: z.string().optional(),
});

const registerRecruiterSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
});

const registerAcademicianSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  institutionName: z.string().min(2, "Institution name is required"),
  department: z.string().min(2, "Department is required"),
  designation: z.string().min(2, "Designation is required"),
});

const registerInstitutionSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  institutionName: z.string().min(2, "Institution name is required"),
  institutionCode: z.string().min(2, "Institution/AISHE code is required"),
  state: z.string().min(2, "State is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterStudentFormData = z.infer<typeof registerStudentSchema>;
type RegisterRecruiterFormData = z.infer<typeof registerRecruiterSchema>;
type RegisterAcademicianFormData = z.infer<typeof registerAcademicianSchema>;
type RegisterInstitutionFormData = z.infer<typeof registerInstitutionSchema>;

export function AuthPage({
  isModal = false,
  initialMode = "login",
  initialRole = "student",
  onClose,
}: AuthPageProps) {
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
    defaultValues: {
      email: "",
      password: "",
      fullName: "",
      institutionName: "",
      department: "",
      designation: "",
    },
  });

  const institutionForm = useForm<RegisterInstitutionFormData>({
    resolver: zodResolver(registerInstitutionSchema),
    defaultValues: {
      email: "",
      password: "",
      institutionName: "",
      institutionCode: "",
      state: "",
    },
  });

  async function handleLoginSubmit(data: LoginFormData) {
    setError(null);
    try {
      const session = await api.login({ email: data.email, password: data.password });
      setSession(session, data.email);
      toast.success("Welcome back to your passport workspace.");
      if (onClose) onClose();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Login failed. Please verify your credentials.";
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
      setSession(session, data.fullName || data.email);
      toast.success("Student profile created successfully.");
      if (onClose) onClose();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Registration failed. Please try again.";
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
      setSession(session, data.companyName || data.email);
      toast.success("Recruiter profile created successfully.");
      if (onClose) onClose();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Registration failed. Please try again.";
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
      setSession(session, data.fullName || data.email);
      toast.success("Academician profile created successfully.");
      if (onClose) onClose();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Registration failed. Please try again.";
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
      setSession(session, data.institutionName || data.email);
      toast.success("Institution workspace created successfully.");
      if (onClose) onClose();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Registration failed. Please check invitation permissions.";
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
      toast.success("Google authentication successful.");
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
    <div className={`relative w-full text-[#111827] font-['Inter',sans-serif] ${isModal ? "" : "min-h-screen py-12 px-6 flex items-center justify-center bg-[#F7F5F0]"}`}>
      {/* Modal Close Button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-0 right-0 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E1D8] bg-[#FFFFFF] text-[#475569] hover:text-[#111827] hover:border-[#111827]/30 transition-all cursor-pointer shadow-xs"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-start w-full max-w-5xl mx-auto">
        {/* Left Narrative Panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#B08D57] font-semibold flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
            AUTHENTICATION GATEWAY
          </div>
          <h2
            className="text-3xl sm:text-4xl font-normal leading-[1.05] tracking-tight text-[#111827]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {mode === "login" ? "Welcome back to your passport." : "Build your evidence-backed identity."}
          </h2>
          <p className="text-sm leading-relaxed text-[#475569]">
            Access auditable skill telemetry, verifiable project credentials, and explainable internship matching.
          </p>

          <div className="space-y-4 pt-5 border-t border-[#E5E1D8] text-xs font-mono text-[#475569]">
            <div className="flex items-start gap-3">
              <span className="text-[#B08D57] font-bold shrink-0">01</span>
              <span>Every passport skill traces to concrete evidence records</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[#B08D57] font-bold shrink-0">02</span>
              <span>Deterministic computation without black-box AI bias</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[#B08D57] font-bold shrink-0">03</span>
              <span>Protected attributes never influence matching formulas</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 rounded-[16px] shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
          {/* Mode Switcher */}
          <div className="flex border-b border-[#E5E1D8] mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); }}
              className={`pb-3 px-4 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                mode === "login"
                  ? "text-[#111827] border-b-2 border-[#111827] font-semibold"
                  : "text-[#64748B] hover:text-[#111827]"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(null); }}
              className={`pb-3 px-4 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
                mode === "register"
                  ? "text-[#111827] border-b-2 border-[#111827] font-semibold"
                  : "text-[#64748B] hover:text-[#111827]"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* LOGIN VIEW */}
          {mode === "login" && (
            <div className="space-y-5">
              {/* Quick Demo Credentials Panel for Hackathon Judges */}
              <div className="rounded-xl border border-[#B08D57]/30 bg-[#B08D57]/5 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#B08D57] font-bold flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57] animate-pulse" />
                    Hackathon Demo Accounts (1-Click Fill)
                  </span>
                  <span className="font-mono text-[10px] text-[#64748B]">pwd: demo123</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      loginForm.setValue("email", "recruiter.demo@technova.com");
                      loginForm.setValue("password", "demo123");
                      setError(null);
                    }}
                    className="flex flex-col items-start p-2 rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#111827] hover:shadow-xs transition-all text-left cursor-pointer"
                  >
                    <span className="text-[11px] font-semibold text-[#111827]">Recruiter</span>
                    <span className="text-[9px] font-mono text-[#64748B] truncate max-w-full">Arjun Mehta · TechNova</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      loginForm.setValue("email", "faculty.demo@example.com");
                      loginForm.setValue("password", "demo123");
                      setError(null);
                    }}
                    className="flex flex-col items-start p-2 rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#111827] hover:shadow-xs transition-all text-left cursor-pointer"
                  >
                    <span className="text-[11px] font-semibold text-[#111827]">Faculty / Academic</span>
                    <span className="text-[9px] font-mono text-[#64748B] truncate max-w-full">Dr. Ananya Sharma · NIT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      loginForm.setValue("email", "institution.demo@example.com");
                      loginForm.setValue("password", "demo123");
                      setError(null);
                    }}
                    className="flex flex-col items-start p-2 rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#111827] hover:shadow-xs transition-all text-left cursor-pointer"
                  >
                    <span className="text-[11px] font-semibold text-[#111827]">Institution / Univ</span>
                    <span className="text-[9px] font-mono text-[#64748B] truncate max-w-full">Dr. Vikram Rao · NIT Univ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      loginForm.setValue("email", "maya@example.demo");
                      loginForm.setValue("password", "demo123");
                      setError(null);
                    }}
                    className="flex flex-col items-start p-2 rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] hover:border-[#111827] hover:shadow-xs transition-all text-left cursor-pointer"
                  >
                    <span className="text-[11px] font-semibold text-[#111827]">Student Candidate</span>
                    <span className="text-[9px] font-mono text-[#64748B] truncate max-w-full">Maya Rivera · Passport</span>
                  </button>
                </div>
              </div>

              <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    {...loginForm.register("email")}
                    type="email"
                    placeholder="user@example.com"
                    className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#111827] placeholder:text-[#64748B] transition-colors"
                  />
                  {loginForm.formState.errors.email && (
                    <span className="text-xs text-[#B4534B] mt-1 block">{loginForm.formState.errors.email.message}</span>
                  )}
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1.5">
                    Password
                  </label>
                  <input
                    id="login-password"
                    {...loginForm.register("password")}
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-2.5 text-sm text-[#111827] placeholder:text-[#64748B] transition-colors"
                  />
                  {loginForm.formState.errors.password && (
                    <span className="text-xs text-[#B4534B] mt-1 block">{loginForm.formState.errors.password.message}</span>
                  )}
                </div>

                {error && (
                  <div role="alert" className="rounded-lg border border-[#B4534B]/30 bg-[rgba(180,83,75,0.10)] p-3 text-xs text-[#B4534B]">
                    {error}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="pill-btn w-full py-3.5 shadow-md hover:shadow-lg transition-all"
                  >
                    {isSubmitting ? "Authenticating..." : "Sign In to Workspace"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* REGISTER VIEW */}
          {mode === "register" && (
            <div className="space-y-6">
              {/* 4-Persona Selector */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-[#475569] mb-2">
                  Select Role
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Registration role">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === "student"}
                    onClick={() => setRole("student")}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      role === "student"
                        ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)] text-[#111827]"
                        : "border-[#E5E1D8] bg-[#F7F5F0] text-[#475569] hover:border-[#D5D0C5] hover:text-[#111827]"
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-wider text-[#B08D57] font-semibold">01 / STUDENT</div>
                    <div className="text-sm font-medium text-[#111827] mt-0.5">Student</div>
                    <div className="text-[11px] text-[#475569] font-sans mt-1">Build a verified portfolio</div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === "recruiter"}
                    onClick={() => setRole("recruiter")}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      role === "recruiter"
                        ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)] text-[#111827]"
                        : "border-[#E5E1D8] bg-[#F7F5F0] text-[#475569] hover:border-[#D5D0C5] hover:text-[#111827]"
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-wider text-[#B08D57] font-semibold">02 / RECRUITER</div>
                    <div className="text-sm font-medium text-[#111827] mt-0.5">Recruiter</div>
                    <div className="text-[11px] text-[#475569] font-sans mt-1">Discover verified candidates</div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === "academician"}
                    onClick={() => setRole("academician")}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      role === "academician"
                        ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)] text-[#111827]"
                        : "border-[#E5E1D8] bg-[#F7F5F0] text-[#475569] hover:border-[#D5D0C5] hover:text-[#111827]"
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-wider text-[#B08D57] font-semibold">03 / FACULTY</div>
                    <div className="text-sm font-medium text-[#111827] mt-0.5">Faculty</div>
                    <div className="text-[11px] text-[#475569] font-sans mt-1">Collaborate with industry</div>
                  </button>

                  <button
                    type="button"
                    role="radio"
                    aria-checked={role === "institution"}
                    onClick={() => setRole("institution")}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      role === "institution"
                        ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)] text-[#111827]"
                        : "border-[#E5E1D8] bg-[#F7F5F0] text-[#475569] hover:border-[#D5D0C5] hover:text-[#111827]"
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-wider text-[#B08D57] font-semibold">04 / UNIVERSITY</div>
                    <div className="text-sm font-medium text-[#111827] mt-0.5">Institution</div>
                    <div className="text-[11px] text-[#475569] font-sans mt-1">Institutional intelligence</div>
                  </button>
                </div>
              </div>

              {/* STUDENT FORM */}
              {role === "student" && (
                <form onSubmit={studentForm.handleSubmit(handleStudentRegisterSubmit)} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Full Name</label>
                    <input
                      {...studentForm.register("fullName")}
                      placeholder="e.g. Maya Rivera"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                    {studentForm.formState.errors.fullName && (
                      <span className="text-xs text-[#B4534B] mt-1 block">{studentForm.formState.errors.fullName.message}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">
                      University <span className="text-[#64748B] lowercase">(optional)</span>
                    </label>
                    <input
                      {...studentForm.register("university")}
                      placeholder="e.g. State University"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Email Address</label>
                    <input
                      {...studentForm.register("email")}
                      type="email"
                      placeholder="student@university.edu"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                    {studentForm.formState.errors.email && (
                      <span className="text-xs text-[#B4534B] mt-1 block">{studentForm.formState.errors.email.message}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Password</label>
                    <input
                      {...studentForm.register("password")}
                      type="password"
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                    {studentForm.formState.errors.password && (
                      <span className="text-xs text-[#B4534B] mt-1 block">{studentForm.formState.errors.password.message}</span>
                    )}
                  </div>

                  {error && <div className="p-3 text-xs text-[#B4534B] border border-[#B4534B]/30 bg-[rgba(180,83,75,0.10)] rounded-lg">{error}</div>}

                  <button type="submit" disabled={isSubmitting} className="pill-btn w-full py-3.5 shadow-md">
                    {isSubmitting ? "Creating Student Account..." : "Create Student Account"}
                  </button>
                </form>
              )}

              {/* RECRUITER FORM */}
              {role === "recruiter" && (
                <form onSubmit={recruiterForm.handleSubmit(handleRecruiterRegisterSubmit)} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Company Name</label>
                    <input
                      {...recruiterForm.register("companyName")}
                      placeholder="e.g. Acme Labs"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                    {recruiterForm.formState.errors.companyName && (
                      <span className="text-xs text-[#B4534B] mt-1 block">{recruiterForm.formState.errors.companyName.message}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Work Email</label>
                    <input
                      {...recruiterForm.register("email")}
                      type="email"
                      placeholder="recruiter@company.com"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                    {recruiterForm.formState.errors.email && (
                      <span className="text-xs text-[#B4534B] mt-1 block">{recruiterForm.formState.errors.email.message}</span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Password</label>
                    <input
                      {...recruiterForm.register("password")}
                      type="password"
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                    {recruiterForm.formState.errors.password && (
                      <span className="text-xs text-[#B4534B] mt-1 block">{recruiterForm.formState.errors.password.message}</span>
                    )}
                  </div>

                  {error && <div className="p-3 text-xs text-[#B4534B] border border-[#B4534B]/30 bg-[rgba(180,83,75,0.10)] rounded-lg">{error}</div>}

                  <button type="submit" disabled={isSubmitting} className="pill-btn w-full py-3.5 shadow-md">
                    {isSubmitting ? "Creating Recruiter Account..." : "Create Recruiter Account"}
                  </button>
                </form>
              )}

              {/* ACADEMICIAN FORM */}
              {role === "academician" && (
                <form onSubmit={academicianForm.handleSubmit(handleAcademicianRegisterSubmit)} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Full Name</label>
                    <input
                      {...academicianForm.register("fullName")}
                      placeholder="e.g. Dr. Arvind Rao"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Institution</label>
                      <input
                        {...academicianForm.register("institutionName")}
                        placeholder="e.g. IIT Bombay"
                        className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Department</label>
                      <input
                        {...academicianForm.register("department")}
                        placeholder="e.g. Computer Science"
                        className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Designation</label>
                    <input
                      {...academicianForm.register("designation")}
                      placeholder="e.g. Professor & Head of AI"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Academic Email</label>
                    <input
                      {...academicianForm.register("email")}
                      type="email"
                      placeholder="faculty@iitb.ac.in"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Password</label>
                    <input
                      {...academicianForm.register("password")}
                      type="password"
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  {error && <div className="p-3 text-xs text-[#B4534B] border border-[#B4534B]/30 bg-[rgba(180,83,75,0.10)] rounded-lg">{error}</div>}

                  <button type="submit" disabled={isSubmitting} className="pill-btn w-full py-3.5 shadow-md">
                    {isSubmitting ? "Creating Faculty Account..." : "Create Faculty Account"}
                  </button>
                </form>
              )}

              {/* INSTITUTION FORM */}
              {role === "institution" && (
                <form onSubmit={institutionForm.handleSubmit(handleInstitutionRegisterSubmit)} className="space-y-3.5">
                  <div className="rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] p-3 text-xs text-[#475569] font-mono">
                    Public-pilot institution accounts are invite-only. Use the administrative email included in your invitation.
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Institution Name</label>
                    <input
                      {...institutionForm.register("institutionName")}
                      placeholder="e.g. National Institute of Technology"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">AISHE Code</label>
                      <input
                        {...institutionForm.register("institutionCode")}
                        placeholder="e.g. C-12345"
                        className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">State</label>
                      <input
                        {...institutionForm.register("state")}
                        placeholder="e.g. Karnataka"
                        className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Admin Email</label>
                    <input
                      {...institutionForm.register("email")}
                      type="email"
                      placeholder="dean@university.edu"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase tracking-wider text-[#475569] mb-1">Password</label>
                    <input
                      {...institutionForm.register("password")}
                      type="password"
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                    />
                  </div>

                  {error && <div className="p-3 text-xs text-[#B4534B] border border-[#B4534B]/30 bg-[rgba(180,83,75,0.10)] rounded-lg">{error}</div>}

                  <button type="submit" disabled={isSubmitting} className="pill-btn w-full py-3.5 shadow-md">
                    {isSubmitting ? "Creating University Account..." : "Create University Account"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Social Auth Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E5E1D8]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest text-[#64748B]">
              <span className="bg-[#FFFFFF] px-3">Or continue with</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-[16px] border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-7 shadow-[0_8px_30px_rgba(17,24,39,0.08)] space-y-5 text-[#111827]">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#B08D57] font-semibold mb-1">
                GOOGLE AUTHENTICATED
              </div>
              <h3 className="text-2xl font-normal text-[#111827]" style={{ fontFamily: "var(--font-display)" }}>
                Select Your Account Type
              </h3>
              <p className="text-xs text-[#475569] mt-1">
                Choose how you would like to participate in Lumina Intel.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setGoogleModalRole("student")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  googleModalRole === "student" ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)]" : "border-[#E5E1D8] bg-[#F7F5F0]"
                }`}
              >
                <div className="font-mono text-xs text-[#B08D57]">01 / STUDENT</div>
                <div className="text-sm font-medium text-[#111827]">Student / Candidate</div>
              </button>
              <button
                type="button"
                onClick={() => setGoogleModalRole("recruiter")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  googleModalRole === "recruiter" ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)]" : "border-[#E5E1D8] bg-[#F7F5F0]"
                }`}
              >
                <div className="font-mono text-xs text-[#B08D57]">02 / RECRUITER</div>
                <div className="text-sm font-medium text-[#111827]">Recruiter / Employer</div>
              </button>
              <button
                type="button"
                onClick={() => setGoogleModalRole("academician")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  googleModalRole === "academician" ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)]" : "border-[#E5E1D8] bg-[#F7F5F0]"
                }`}
              >
                <div className="font-mono text-xs text-[#B08D57]">03 / FACULTY</div>
                <div className="text-sm font-medium text-[#111827]">Faculty / Academician</div>
              </button>
              <button
                type="button"
                onClick={() => setGoogleModalRole("institution")}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  googleModalRole === "institution" ? "border-[#B08D57] bg-[rgba(176,141,87,0.10)]" : "border-[#E5E1D8] bg-[#F7F5F0]"
                }`}
              >
                <div className="font-mono text-xs text-[#B08D57]">04 / UNIVERSITY</div>
                <div className="text-sm font-medium text-[#111827]">Institution / Leadership</div>
              </button>
            </div>

            {googleModalRole !== "student" && (
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-mono uppercase tracking-wider text-[#475569]">
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
                  className="w-full rounded-lg border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-sm text-[#111827]"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingGoogleCredential(null)}
                disabled={isGoogleSubmitting}
                className="flex-1 pill-btn-secondary py-2.5 text-xs font-mono uppercase tracking-wider text-[#475569] hover:text-[#111827]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmGoogleRole}
                disabled={isGoogleSubmitting}
                className="flex-1 pill-btn py-2.5 text-xs"
              >
                {isGoogleSubmitting ? "Connecting..." : "Confirm & Enter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
