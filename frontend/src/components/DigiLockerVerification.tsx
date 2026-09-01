import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  Sparkles,
  Loader2,
  Building2,
  GraduationCap,
  RefreshCw,
  Unlink,
  CreditCard,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { DigiLockerDocument, DigiLockerStatus } from "../api/types";
import { LiquidGlassButton } from "./ui/EditorialPrimitives";

interface DigiLockerVerificationProps {
  token: string;
  onEvidenceImported?: () => void;
}

export function DigiLockerVerification({ token, onEvidenceImported }: DigiLockerVerificationProps) {
  const [status, setStatus] = useState<DigiLockerStatus | null>(null);
  const [documents, setDocuments] = useState<DigiLockerDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [importingDocId, setImportingDocId] = useState<string | null>(null);
  const [importedSuccessDocIds, setImportedSuccessDocIds] = useState<Set<string>>(new Set());

  // Real-Time Aadhaar State
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [aadhaarInput, setAadhaarInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [otpSentMessage, setOtpSentMessage] = useState<string | null>(null);

  const formatAadhaar = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 12);
    const parts = raw.match(/.{1,4}/g);
    return parts ? parts.join(" ") : raw;
  };

  const loadStatusAndDocs = useCallback(async () => {
    try {
      setIsLoading(true);
      const [statusRes, docsRes] = await Promise.all([
        api.getDigiLockerStatus(token),
        api.getDigiLockerDocuments(token),
      ]);
      setStatus(statusRes);
      setDocuments(docsRes);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load DigiLocker documents"));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadStatusAndDocs();
  }, [loadStatusAndDocs]);

  const handleSendRealOtp = async () => {
    const cleanDigits = aadhaarInput.replace(/\D/g, "");
    if (cleanDigits.length !== 12) {
      toast.error("Please enter a valid 12-digit Aadhaar Card Number.");
      return;
    }

    try {
      setIsSendingOtp(true);
      const res = await api.generateAadhaarOtp(cleanDigits, token);
      setReferenceId(res.reference_id);
      setOtpSentMessage(res.message);
      toast.success(res.message || "UIDAI OTP dispatched to your registered mobile phone!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to generate UIDAI OTP. Check Aadhaar number."));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyRealOtp = async () => {
    if (!referenceId) {
      toast.error("Please request an OTP first.");
      return;
    }
    const cleanOtp = otpInput.replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP received via SMS.");
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const cleanAadhaar = aadhaarInput.replace(/\D/g, "");
      const res = await api.verifyAadhaarOtp(referenceId, cleanOtp, token, cleanAadhaar);
      setStatus(res);
      setShowConnectModal(false);
      setReferenceId(null);
      setOtpInput("");
      toast.success("Aadhaar Identity verified with live UIDAI cryptographic proof.");
      void loadStatusAndDocs();
    } catch (err) {
      toast.error(errorMessage(err, "Invalid OTP or verification expired. Try again."));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleUnlink = async () => {
    try {
      setIsUnlinking(true);
      const unlinkedRes = await api.unlinkDigiLocker(token);
      setStatus(unlinkedRes);
      toast.success("DigiLocker unlinked. Previously imported evidence records remain verified.");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to unlink DigiLocker"));
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleImport = async (doc: DigiLockerDocument) => {
    try {
      setImportingDocId(doc.doc_id);
      await api.importDigiLockerCredential(doc.doc_id, token);
      setImportedSuccessDocIds((prev) => new Set(prev).add(doc.doc_id));
      toast.success(`Imported "${doc.title}" with 1.00x verification multiplier.`);
      if (onEvidenceImported) {
        onEvidenceImported();
      }
      void loadStatusAndDocs();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to import credential"));
    } finally {
      setImportingDocId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center font-mono text-xs text-[#64748B]">
        <Loader2 className="h-6 w-6 animate-spin text-[#B08D57] mb-2" />
        <span>Syncing with DigiLocker Gateway…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner: Status & Gateway Info */}
      <div className="border border-[#E5E1D8] bg-[#FFFFFF] p-5 sm:p-6 rounded-[16px] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-full border border-[#4F6F5A]/30 bg-[rgba(79,111,90,0.12)] flex items-center justify-center text-[#4F6F5A] shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-[#111827]">
                  DigiLocker & Real-Time Aadhaar Verification Gateway
                </h3>
                {status?.is_linked ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#4F6F5A] bg-[rgba(79,111,90,0.10)] border border-[#4F6F5A]/30 px-2 py-0.5 rounded-full font-bold">
                    <CheckCircle2 className="h-3 w-3" /> Live Aadhaar Verified ({status.masked_aadhaar || "XXXX-XXXX-3821"})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#B08D57] bg-[rgba(176,141,87,0.10)] border border-[#B08D57]/30 px-2 py-0.5 rounded-full font-bold">
                    Live UIDAI Gateway Ready
                  </span>
                )}
              </div>
              <p className="text-xs text-[#475569] mt-1 max-w-2xl leading-relaxed">
                Verify your identity in real time with <strong className="text-[#111827]">live UIDAI SMS OTP verification</strong>. Import authenticated NPTEL certificates, university grade transcripts, and AICTE diplomas with a guaranteed <strong className="text-[#111827]">1.00× Verification Multiplier</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {status?.is_linked ? (
              <button
                type="button"
                onClick={() => void handleUnlink()}
                disabled={isUnlinking}
                className="rounded-full border border-[#E5E1D8] bg-[#FFFFFF] px-3.5 py-1.5 font-mono text-xs font-bold text-[#64748B] hover:text-red-600 hover:bg-[#FDF2F2] transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                {isUnlinking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                <span>Unlink Account</span>
              </button>
            ) : (
              <LiquidGlassButton
                onClick={() => {
                  setReferenceId(null);
                  setOtpInput("");
                  setShowConnectModal(true);
                }}
                size="sm"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Verify with Live Aadhaar OTP</span>
              </LiquidGlassButton>
            )}
          </div>
        </div>

        {/* Security & Fairness Invariant Tag */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E5E1D8] text-[11px] font-mono text-[#64748B]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#4F6F5A]" />
            <span>UIDAI Gateway: <strong>Live Real-Time SMS OTP</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#B08D57]" />
            <span>DPDP Act 2023: <strong>256-Bit SHA-256 Masked (No Plaintext Stored)</strong></span>
          </div>
          <div>
            <span>Confidence Multiplier: <strong className="text-[#4F6F5A]">1.00× (Zero Discount)</strong></span>
          </div>
        </div>
      </div>

      {/* Document Discovery List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-[#111827]">
              Available Academic Documents & Credentials ({documents.length})
            </h4>
            <p className="text-xs text-[#64748B] mt-0.5">
              Select verifiable credentials to extract evidenced skills directly into your Skill Passport.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadStatusAndDocs()}
            className="p-1.5 rounded-full text-[#64748B] hover:text-[#111827] hover:bg-[#F7F5F0] transition-colors cursor-pointer"
            title="Refresh documents"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const isImporting = importingDocId === doc.doc_id;
            const isSuccess = importedSuccessDocIds.has(doc.doc_id);

            return (
              <div
                key={doc.doc_id}
                className="border border-[#E5E1D8] bg-[#FFFFFF] p-5 rounded-[16px] shadow-2xs flex flex-col justify-between space-y-4 hover:border-[#B08D57]/60 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {doc.doc_type.includes("DEGREE") ? (
                        <GraduationCap className="h-4 w-4 text-[#B08D57] shrink-0" />
                      ) : doc.doc_type.includes("NPTEL") ? (
                        <Award className="h-4 w-4 text-[#4F6F5A] shrink-0" />
                      ) : (
                        <Building2 className="h-4 w-4 text-[#0f172a] shrink-0" />
                      )}
                      <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#64748B]">
                        {doc.issuer_name}
                      </span>
                    </div>
                    <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded-full bg-[#F7F5F0] border border-[#E5E1D8] text-[#475569] font-bold">
                      {doc.doc_type.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div>
                    <h5 className="text-sm font-semibold text-[#111827] leading-snug">
                      {doc.title}
                    </h5>
                    <p className="text-[11px] text-[#64748B] font-mono mt-1">
                      Issued: {doc.issued_date} · ID: {doc.doc_id}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg border border-[#E5E1D8] bg-[#F7F5F0] text-[11px] text-[#475569] leading-relaxed">
                    {doc.sample_preview}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-mono font-bold text-[#64748B] block mb-1.5">
                      Verifiable Skills ({doc.verifiable_skills.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {doc.verifiable_skills.map((skill) => (
                        <span
                          key={skill}
                          className="font-mono text-[11px] border border-[#E5E1D8] bg-[#FFFFFF] px-2 py-0.5 rounded-md text-[#111827] font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E5E1D8] flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#4F6F5A] font-bold inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> 1.00× Verified Multiplier
                  </span>

                  <LiquidGlassButton
                    disabled={isImporting || isSuccess}
                    onClick={() => void handleImport(doc)}
                    size="sm"
                  >
                    {isImporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isSuccess ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    <span>{isImporting ? "Extracting..." : isSuccess ? "Imported" : "Import & Verify"}</span>
                  </LiquidGlassButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-Time UIDAI Aadhaar Verification Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md border border-[#E5E1D8] bg-[#FFFFFF] shadow-2xl p-6 rounded-[16px] space-y-4 text-[#111827]">
            <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#4F6F5A]" />
                <h4 className="text-base font-semibold text-[#111827]">
                  Real-Time Aadhaar Verification
                </h4>
              </div>
              <span className="font-mono text-[10px] bg-[rgba(79,111,90,0.12)] text-[#4F6F5A] border border-[#4F6F5A]/30 px-2 py-0.5 rounded-full font-bold uppercase">
                UIDAI Live Gateway
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-[#475569] leading-relaxed">
                Enter your 12-digit Aadhaar number. A <strong className="text-[#111827]">real SMS OTP</strong> will be dispatched to your Aadhaar-registered mobile phone.
              </p>

              {/* Aadhaar Input Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono font-bold text-[#64748B]">
                  12-Digit Aadhaar Card Number
                </label>
                <input
                  type="text"
                  value={aadhaarInput}
                  disabled={Boolean(referenceId) || isSendingOtp}
                  onChange={(e) => setAadhaarInput(formatAadhaar(e.target.value))}
                  placeholder="XXXX XXXX XXXX"
                  maxLength={14}
                  className="w-full rounded-md border border-[#E5E1D8] bg-[#F7F5F0] px-3 py-2 text-sm font-mono tracking-widest text-[#111827] focus:border-[#B08D57] focus:outline-none"
                />
              </div>

              {/* OTP Field if OTP is sent */}
              {referenceId && (
                <div className="space-y-2 pt-2 border-t border-[#E5E1D8]">
                  <label className="block text-xs font-mono font-bold text-[#4F6F5A] flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" /> Enter 6-Digit SMS OTP
                  </label>
                  <input
                    type="text"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    autoFocus
                    className="w-full rounded-md border-2 border-[#4F6F5A] bg-[#FFFFFF] px-3 py-2 text-sm font-mono tracking-widest text-[#111827] focus:outline-none"
                  />
                  <p className="text-[11px] font-mono text-[#4F6F5A]">
                    {otpSentMessage || "UIDAI SMS OTP sent to your phone."}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-[#E5E1D8]">
              <button
                type="button"
                onClick={() => {
                  setShowConnectModal(false);
                  setReferenceId(null);
                }}
                className="font-mono text-xs font-bold text-[#64748B] hover:text-[#111827] cursor-pointer"
              >
                Cancel
              </button>

              {!referenceId ? (
                <LiquidGlassButton
                  onClick={() => void handleSendRealOtp()}
                  disabled={isSendingOtp || aadhaarInput.replace(/\D/g, "").length !== 12}
                  size="sm"
                >
                  {isSendingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  <span>Send Real UIDAI OTP</span>
                </LiquidGlassButton>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSendRealOtp()}
                    disabled={isSendingOtp}
                    className="font-mono text-[11px] text-[#B08D57] hover:underline cursor-pointer"
                  >
                    Resend OTP
                  </button>
                  <LiquidGlassButton
                    onClick={() => void handleVerifyRealOtp()}
                    disabled={isVerifyingOtp || otpInput.replace(/\D/g, "").length !== 6}
                    size="sm"
                  >
                    {isVerifyingOtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>Verify & Link</span>
                  </LiquidGlassButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
