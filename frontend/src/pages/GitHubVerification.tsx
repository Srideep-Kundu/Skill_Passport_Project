import { useEffect, useState } from "react";

import { ApiError, api } from "../api";
import type { EvidenceSummary, VerificationCheck, VerificationResult } from "../api";

function checkSummary(check: VerificationCheck): string {
  const reason = check.details.reason;
  if (typeof reason === "string") return reason;
  const commits = check.details.candidate_commit_count;
  if (typeof commits === "number") return `${commits} candidate-attributed commits in the first 100 repository commits.`;
  const repository = check.details.repository;
  if (typeof repository === "string") return `Repository ${repository} is publicly accessible.`;
  const matches = check.details.matching_languages;
  if (Array.isArray(matches) && matches.every((value) => typeof value === "string")) return matches.length ? `Matching repository language: ${matches.join(", ")}.` : "No claimed language matched repository language metadata.";
  return check.check_type.replaceAll("_", " ");
}

export function GitHubVerification({ token, evidence, onVerified }: { token: string; evidence: EvidenceSummary[]; onVerified: () => void }) {
  const [username, setUsername] = useState("");
  const [identityStatus, setIdentityStatus] = useState("Loading GitHub identity…");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.githubIdentity(token).then((identity) => {
      setUsername(identity.github_username ?? "");
      setIdentityStatus(identity.github_username ? `Claimed GitHub account: @${identity.github_username}. This is not OAuth-authenticated.` : "No GitHub account is linked.");
    }).catch(() => setIdentityStatus("GitHub identity could not be loaded."));
  }, [token]);

  async function saveIdentity() {
    setMessage(null);
    try {
      const identity = await api.setGithubIdentity(username, token);
      setUsername(identity.github_username ?? "");
      setIdentityStatus(`Claimed GitHub account: @${identity.github_username}. This is not OAuth-authenticated.`);
    } catch (caught) { setMessage(caught instanceof ApiError ? caught.detail : "GitHub username could not be saved."); }
  }

  async function verify(evidenceId: string) {
    setMessage(null);
    try {
      const next = await api.verifyEvidence(evidenceId, token);
      setResult(next);
      onVerified();
    } catch (caught) { setMessage(caught instanceof ApiError ? caught.detail : "GitHub verification could not be completed."); }
  }

  const projectEvidence = evidence.filter((item) => item.evidence_type === "project" && item.external_url);
  return <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">GitHub project verification</h2><p className="mt-1 text-sm text-slate-600">A linked username is student-claimed, not cryptographically authenticated. Verification requires attributable repository activity.</p><p className="mt-2 text-sm text-slate-700">{identityStatus}</p><div className="mt-3 flex flex-wrap gap-2"><label className="sr-only" htmlFor="github-username">GitHub username</label><input id="github-username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="GitHub username" className="rounded border border-slate-300 px-3 py-2 text-sm" /><button type="button" onClick={() => void saveIdentity()} className="rounded border border-indigo-600 px-3 py-2 text-sm font-medium text-indigo-700">Save GitHub username</button></div>{projectEvidence.length ? <ul className="mt-4 space-y-2">{projectEvidence.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-3"><span className="text-sm font-medium">{item.title}</span><button type="button" onClick={() => void verify(item.id)} className="rounded border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700">Verify project</button></li>)}</ul> : <p className="mt-4 text-sm text-slate-600">Add project evidence with a GitHub repository URL to verify it.</p>}{message && <p role="alert" className="mt-3 text-sm text-red-700">{message}</p>}{result && <div className="mt-4 rounded border border-slate-200 p-3"><p className="font-medium">Overall: {result.verification_tier.replaceAll("_", " ")}</p><ul className="mt-2 space-y-1 text-sm text-slate-700">{result.checks.map((check) => <li key={`${check.check_type}-${check.checked_at}`}><span className="font-medium">{check.result === "pass" ? "✓" : check.result === "partial" ? "~" : check.result === "fail" ? "✕" : "–"} {check.check_type.replaceAll("_", " ")}: </span>{checkSummary(check)}</li>)}</ul></div>}</section>;
}
