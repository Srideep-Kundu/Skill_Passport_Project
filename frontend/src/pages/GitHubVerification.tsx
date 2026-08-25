import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GitBranch, CheckCircle2, Clock, XCircle } from "lucide-react";
import { ApiError, api } from "../api";
import type { EvidenceSummary, VerificationCheck, VerificationResult } from "../api";
import { LiquidGlassButton } from "../components/ui/EditorialPrimitives";

function checkSummary(check: VerificationCheck): string {
  const reason = check.details.reason;
  if (typeof reason === "string") return reason;
  const commits = check.details.candidate_commit_count;
  if (typeof commits === "number") {
    return `${commits} candidate-attributed commit${commits === 1 ? "" : "s"} in repository history.`;
  }
  const repository = check.details.repository;
  if (typeof repository === "string") return `Repository ${repository} is publicly accessible.`;
  const matches = check.details.matching_languages;
  if (Array.isArray(matches) && matches.every((value) => typeof value === "string")) {
    return matches.length
      ? `Matching repository languages: ${matches.join(", ")}.`
      : "No claimed language matched repository language metadata.";
  }
  return check.check_type.replaceAll("_", " ");
}

export function GitHubVerification({
  token,
  evidence,
  onVerified,
}: {
  token: string;
  evidence: EvidenceSummary[];
  onVerified: () => void;
}) {
  const [username, setUsername] = useState("");
  const [identityStatus, setIdentityStatus] = useState("Loading GitHub identity…");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isVerifyingId, setIsVerifyingId] = useState<string | null>(null);

  useEffect(() => {
    void api
      .githubIdentity(token)
      .then((identity) => {
        setUsername(identity.github_username ?? "");
        setIdentityStatus(
          identity.github_username
            ? `Linked GitHub handle: @${identity.github_username}`
            : "No GitHub username linked yet."
        );
      })
      .catch(() => setIdentityStatus("GitHub identity could not be loaded."));
  }, [token]);

  async function saveIdentity() {
    setMessage(null);
    const cleanHandle = username
      .trim()
      .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
      .replace(/^@/, "")
      .replace(/\/.*$/, "");
    try {
      const identity = await api.setGithubIdentity(cleanHandle, token);
      setUsername(identity.github_username ?? "");
      setIdentityStatus(`Linked GitHub handle: @${identity.github_username}`);
      toast.success("GitHub handle saved successfully!");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "GitHub username could not be saved.";
      setMessage(msg);
      toast.error(msg);
    }
  }

  async function verify(evidenceId: string) {
    setMessage(null);
    setIsVerifyingId(evidenceId);
    try {
      const next = await api.verifyEvidence(evidenceId, token);
      setResult(next);
      onVerified();
      toast.success("GitHub repository verification completed!");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "GitHub verification could not be completed.";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setIsVerifyingId(null);
    }
  }

  const projectEvidence = evidence.filter((item) => item.evidence_type === "project" && item.external_url);

  return (
    <section className="border border-white/10 bg-[#061524] p-6 rounded-md space-y-6 text-white font-sans">
      <div className="border-b border-white/10 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-normal text-white flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <GitBranch className="h-4 w-4 text-white/80" />
            <span>GitHub Project Verification</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Verify repository ownership, commits, and languages to boost matching confidence tiers.
          </p>
        </div>
      </div>

      {/* Identity Ledger Row */}
      <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="font-mono text-xs text-neutral-300">
          {identityStatus}
        </div>
        <div className="flex items-center gap-2">
          <input
            id="github-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="GitHub handle (e.g. maya-dev)"
            className="rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-white focus:border-white focus:outline-none"
          />
          <LiquidGlassButton size="sm" onClick={() => void saveIdentity()}>
            Save Handle
          </LiquidGlassButton>
        </div>
      </div>

      {/* Repositories Audit Table */}
      <div className="space-y-3">
        <div className="font-mono text-xs uppercase tracking-wider text-neutral-400">
          Attached Project Repositories
        </div>
        {projectEvidence.length ? (
          <div className="space-y-2">
            {projectEvidence.map((item) => (
              <div
                key={item.id}
                className="border border-white/10 bg-white/[0.02] p-4 rounded-sm flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-0.5 min-w-0">
                  <span className="text-sm font-normal text-white block" style={{ fontFamily: "var(--font-display)" }}>
                    {item.title}
                  </span>
                  <span className="font-mono text-xs text-neutral-400 block truncate max-w-md">
                    {item.external_url}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void verify(item.id)}
                  disabled={isVerifyingId === item.id}
                  className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 font-mono text-xs text-neutral-300 hover:text-white hover:border-white/40 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingId === item.id ? "Verifying..." : "Run GitHub Verification"}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-neutral-400 font-mono py-4">
            No project evidence with a GitHub or repository URL found. Add a project URL in the Evidence tab first.
          </p>
        )}
      </div>

      {message && (
        <div role="alert" className="p-3 text-xs text-red-300 border border-red-500/30 bg-red-950/20 rounded-sm font-mono">
          {message}
        </div>
      )}

      {/* Audit Outcome Ledger */}
      {result && (
        <div className="border border-white/15 bg-white/[0.03] p-5 rounded-sm space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <span className="font-mono text-xs uppercase tracking-wider text-neutral-300">Verification Outcome:</span>
            <span className="font-mono text-xs uppercase text-white border border-white/20 px-2 py-0.5 rounded-xs">
              {result.verification_tier.replaceAll("_", " ")}
            </span>
          </div>
          <ul className="space-y-2 font-mono text-xs text-neutral-300 pt-1">
            {result.checks.map((check) => (
              <li key={`${check.check_type}-${check.checked_at}`} className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5">
                  {check.result === "pass" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  ) : check.result === "partial" ? (
                    <Clock className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                  )}
                </span>
                <div>
                  <strong className="text-white uppercase">{check.check_type.replaceAll("_", " ")}: </strong>
                  <span className="text-neutral-400">{checkSummary(check)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
