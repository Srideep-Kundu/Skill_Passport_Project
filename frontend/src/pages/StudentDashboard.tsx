import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ApiError, api } from "../api";
import type { MatchExplanation, Passport, StudentMatch } from "../api";
import { EmptyState, ErrorState, LoadingState } from "../components/AsyncState";
import { EvidenceUpload } from "./EvidenceUpload";
import { EvidenceLifecycle } from "../components/EvidenceLifecycle";
import { GitHubVerification } from "./GitHubVerification";
import { MatchExplanationPanel } from "../components/MatchExplanationPanel";
import { SkillBadge } from "../components/SkillBadge";
import { TeamSuggestions } from "./TeamSuggestions";

export function StudentDashboard({ token }: { token: string }) {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [matches, setMatches] = useState<StudentMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedExplanation, setSelectedExplanation] = useState<MatchExplanation | null>(null);
  const [loadingExplanationId, setLoadingExplanationId] = useState<string | null>(null);
  const [recruiterEvidenceConsent, setRecruiterEvidenceConsent] = useState(false);
  const [evidenceRefresh, setEvidenceRefresh] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try { const [nextPassport, nextMatchPage, nextConsent] = await Promise.all([api.passport(token), api.studentMatches(token), api.recruiterEvidenceConsent(token)]); setPassport(nextPassport); setMatches(nextMatchPage.items); setRecruiterEvidenceConsent(nextConsent.recruiter_evidence_consent); }
    catch (caught) { setError(caught instanceof ApiError ? caught.detail : "Your dashboard could not be loaded."); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function showExplanation(match: StudentMatch) {
    if (match.explanation) { setSelectedExplanation(match.explanation); return; }
    setLoadingExplanationId(match.id);
    try { setSelectedExplanation(await api.explanation(match.id, token)); }
    catch (caught) { setError(caught instanceof ApiError ? caught.detail : "The explanation could not be loaded."); }
    finally { setLoadingExplanationId(null); }
  }
  async function updateRecruiterEvidenceConsent() {
    setError(null);
    try {
      const next = await api.setRecruiterEvidenceConsent(!recruiterEvidenceConsent, token);
      setRecruiterEvidenceConsent(next.recruiter_evidence_consent);
    } catch (caught) { setError(caught instanceof ApiError ? caught.detail : "Evidence consent could not be updated."); }
  }
  if (error && !passport) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!passport || !matches) return <LoadingState label="Loading your evidence-backed passport" />;
  const scoreData = matches.slice(0, 6).map((match) => ({ internship: match.internship_title, score: Math.round(match.final_score * 100) }));
  return <div className="space-y-8"><header><p className="font-semibold text-indigo-600">STUDENT DASHBOARD</p><h1 className="text-3xl font-bold tracking-tight text-slate-950">Your verifiable skill passport</h1><p className="mt-2 text-slate-600">Skills are only shown when they can be traced to submitted evidence.</p></header>{error && <ErrorState message={error} onRetry={() => void load()} />}<section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Recruiter evidence access</h2><p className="mt-1 text-sm text-slate-600">{recruiterEvidenceConsent ? "Recruiters with a match to their internship may request your raw evidence." : "Recruiters can view score explanations, but cannot access your raw evidence."}</p><button type="button" onClick={() => void updateRecruiterEvidenceConsent()} className="mt-3 rounded border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700">{recruiterEvidenceConsent ? "Disable raw evidence access" : "Allow raw evidence access"}</button></section><div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Passport skills</h2>{passport.skills.length ? <div className="mt-4 flex flex-wrap gap-2">{passport.skills.map((skill) => <SkillBadge key={skill.id} name={skill.canonical_name} tier={skill.verification_tier} />)}</div> : <EmptyState title="No extracted skills yet">Add project or certification evidence to begin your passport.</EmptyState>}</section><EvidenceUpload token={token} onSubmitted={() => { setEvidenceRefresh((value) => value + 1); void load(); }} /></div><EvidenceLifecycle token={token} refreshKey={evidenceRefresh} onChanged={() => void load()} /><GitHubVerification token={token} evidence={passport.evidence} onVerified={() => void load()} /><section className="rounded-xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-lg font-semibold">Internship matches</h2><p className="text-sm text-slate-600">Scores use persisted exact, semantic, and verification components.</p></div></div>{matches.length ? <><div className="mt-4 h-60" aria-label="Internship match score chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={scoreData}><XAxis dataKey="internship" tick={{ fontSize: 12 }} interval={0} /><YAxis unit="%" /><Tooltip /><Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div><ul className="mt-5 space-y-3">{matches.map((match) => <li key={match.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4"><div><h3 className="font-semibold">{match.internship_title}</h3><p className="text-sm text-slate-600">Exact {Math.round(match.deterministic_score * 100)}% · Semantic {Math.round(match.semantic_score * 100)}% · Verified {Math.round(match.verification_bonus * 100)}%</p></div><div className="flex items-center gap-3"><strong className="text-xl text-indigo-700">{Math.round(match.final_score * 100)}%</strong><button type="button" onClick={() => void showExplanation(match)} className="rounded border border-indigo-600 px-3 py-1.5 text-sm font-medium text-indigo-700">{loadingExplanationId === match.id ? "Loading…" : "Why this match"}</button></div></li>)}</ul></> : <EmptyState title="No matches yet">Matches will appear when internships fit your evidence-backed skills.</EmptyState>}</section><TeamSuggestions token={token} availableSkillIds={passport.skills.map((skill) => skill.skill_id)} />{selectedExplanation && <MatchExplanationPanel explanation={selectedExplanation} />}</div>;
}
