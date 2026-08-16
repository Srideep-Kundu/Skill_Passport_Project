import { useEffect, useState } from "react";

import { ApiError, api, type CandidateProfile, type ProfileSkill } from "../api";
import { EmptyState, LoadingState } from "./AsyncState";

function tierLabel(value: string): string { return value.replaceAll("_", " "); }

export function UnifiedCandidateProfile({ token, refreshKey }: { token: string; refreshKey: number }) {
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; void api.candidateProfile(token).then((result) => { if (!cancelled) setProfile(result); }).catch((caught: unknown) => { if (!cancelled) setError(caught instanceof ApiError ? caught.detail : "Profile could not be loaded."); }); return () => { cancelled = true; }; }, [refreshKey, token]);
  if (error) return <section className="rounded-xl bg-white p-5 shadow-sm"><p role="alert" className="text-sm text-red-700">{error}</p></section>;
  if (!profile) return <LoadingState label="Loading unified profile" />;
  const completeness = profile.profile_completeness;
  return <section className="rounded-xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-lg font-semibold">Unified candidate profile</h2><p className="text-sm text-slate-600">Evidence-backed aggregation for your records. It is not a candidate score.</p></div>{profile.active_resume && <p className="text-sm text-emerald-700">Active resume: {profile.active_resume.original_filename}</p>}</div><p className="mt-3 text-sm text-slate-600">Profile completeness: {Object.values(completeness).filter(Boolean).length}/5 signals present</p>{profile.skills.length ? <ul className="mt-4 space-y-3">{profile.skills.map((skill) => <ProfileRow key={skill.skill_id} skill={skill} />)}</ul> : <EmptyState title="No evidence-backed skills">Add or parse evidence to build your profile.</EmptyState>}</section>;
}

function ProfileRow({ skill }: { skill: ProfileSkill }) {
  return <li className="rounded border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{skill.canonical_name} <span className="font-normal text-slate-500">· {skill.category}</span></h3><p className="text-sm text-slate-600">{tierLabel(skill.highest_verification_tier)} support · {Math.round(skill.summary_confidence * 100)}% conservative confidence · {skill.independent_evidence_count}/{skill.supporting_evidence_count} independent evidence</p><div className="mt-1 flex flex-wrap gap-1">{skill.source_types.map((source) => <span key={source} className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-800">{source}</span>)}</div></div><span className="text-sm text-slate-500">{skill.source_diversity} source types</span></div><details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-indigo-700">View supporting evidence</summary><ul className="mt-2 space-y-2 text-sm">{skill.supports.map((support) => <li key={support.evidence_id} className="rounded bg-slate-50 p-2"><span className="font-medium">{support.title}</span> · {support.origin} · {tierLabel(support.verification_tier)} · {Math.round(support.effective_confidence * 100)}%<p className="text-slate-600">Span: {support.evidence_span}</p>{support.likely_duplicate_of && <p className="text-amber-700">Potential duplicate of another manual/resume source; counted once for reinforcement.</p>}</li>)}</ul></details></li>;
}
