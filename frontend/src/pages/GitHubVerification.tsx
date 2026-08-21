import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GitBranch, CheckCircle2, Clock, XCircle } from "lucide-react";
import { ApiError, api } from "../api";
import type { EvidenceSummary, VerificationCheck, VerificationResult } from "../api";

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
    try {
      const identity = await api.setGithubIdentity(username, token);
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
    <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111821]/90 backdrop-blur-xs p-5 sm:p-6 shadow-sm space-y-4 text-slate-900 dark:text-[#f1f0e8]">
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
          <span>GitHub Project Verification</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5">
          Verify repository ownership, commits, and languages to boost matching confidence tiers.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-[#151e29] border border-slate-200/80 dark:border-white/[0.08] p-3.5">
        <span className="text-xs font-medium text-slate-700 dark:text-[#f1f0e8]">{identityStatus}</span>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="github-username">
            GitHub username
          </label>
          <input
            id="github-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="GitHub handle (e.g. maya-dev)"
            className="rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#111821] px-3 py-1.5 text-xs focus:border-[#3b71d9] focus:outline-none text-slate-900 dark:text-[#f1f0e8]"
          />
          <button
            type="button"
            onClick={() => void saveIdentity()}
            className="rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-white dark:bg-[#182337] px-3 py-1.5 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-blue-50 dark:hover:bg-[#1f2d47] transition-colors cursor-pointer"
          >
            Save Handle
          </button>
        </div>
      </div>

      {projectEvidence.length ? (
        <ul className="space-y-2.5">
          {projectEvidence.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/40 dark:bg-[#151e29] p-3.5 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
            >
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900 dark:text-[#f1f0e8] block">{item.title}</span>
                <span className="text-[11px] text-slate-400 dark:text-[#98a4b3] font-mono block truncate max-w-sm">
                  {item.external_url}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void verify(item.id)}
                disabled={isVerifyingId === item.id}
                className="rounded-lg border border-[#3b71d9] dark:border-blue-500 bg-blue-50/50 dark:bg-[#182337] px-3 py-1.5 text-xs font-semibold text-[#3b71d9] dark:text-[#b0c6ff] hover:bg-[#3b71d9] hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isVerifyingId === item.id ? "Verifying..." : "Run GitHub Verification"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500 dark:text-[#98a4b3]">
          No project evidence with a GitHub or repository URL found. Add a project URL in the Evidence tab first.
        </p>
      )}

      {message && (
        <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-2.5 text-xs font-medium text-red-700 dark:text-red-300">
          {message}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Verification Outcome:</span>
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              {result.verification_tier.replaceAll("_", " ")}
            </span>
          </div>
          <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 pt-1">
            {result.checks.map((check) => (
              <li key={`${check.check_type}-${check.checked_at}`} className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">
                  {check.result === "pass" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : check.result === "partial" ? (
                    <Clock className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-500" aria-hidden="true" />
                  )}
                </span>
                <span>
                  <strong>{check.check_type.replaceAll("_", " ")}: </strong>
                  {checkSummary(check)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
