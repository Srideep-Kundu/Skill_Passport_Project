import { useCallback, useEffect, useState } from "react";

import { ApiError, api, type EvidenceSummary, type PaginatedResponse } from "../api";
import { EmptyState, LoadingState } from "./AsyncState";

export function EvidenceLifecycle({ token, refreshKey, onChanged }: { token: string; refreshKey: number; onChanged: () => void }) {
  const [result, setResult] = useState<PaginatedResponse<EvidenceSummary> | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EvidenceSummary | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setResult(await api.evidences(token, page)); }
    catch (caught) { setMessage(caught instanceof ApiError ? caught.detail : "Evidence could not be loaded."); }
  }, [page, token]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  function beginEdit(evidence: EvidenceSummary) { setEditing(evidence); setTitle(evidence.title); setDescription(evidence.description); setMessage(null); }
  async function save() {
    if (!editing) return;
    try {
      const updated = await api.updateEvidence(editing.id, { title, description }, token);
      setEditing(null); setMessage(`Evidence saved. Extraction is ${updated.extraction_status.replaceAll("_", " ")}.`);
      await load(); onChanged();
    } catch (caught) { setMessage(caught instanceof ApiError ? caught.detail : "Evidence could not be updated."); }
  }
  async function remove(evidence: EvidenceSummary) {
    if (!window.confirm(`Delete ${evidence.title}? This removes its evidence-backed skills.`)) return;
    try { await api.deleteEvidence(evidence.id, token); setMessage("Evidence deleted; derived skills were removed."); await load(); onChanged(); }
    catch (caught) { setMessage(caught instanceof ApiError ? caught.detail : "Evidence could not be deleted."); }
  }

  return <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Evidence</h2>{message && <p role="status" className="mt-2 text-sm text-slate-600">{message}</p>}{!result ? <LoadingState label="Loading evidence" /> : result.items.length ? <><ul className="mt-3 space-y-2">{result.items.map((evidence) => <li key={evidence.id} className="rounded border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{evidence.title}</p><p className="text-sm text-slate-600">{evidence.evidence_type} · {evidence.extraction_status.replaceAll("_", " ")}</p></div><div className="flex gap-2"><button type="button" onClick={() => beginEdit(evidence)} className="text-sm text-indigo-700">Edit</button><button type="button" onClick={() => void remove(evidence)} className="text-sm text-red-700">Delete</button></div></div>{editing?.id === evidence.id && <div className="mt-3 grid gap-2"><input aria-label="Edit evidence title" value={title} onChange={(event) => setTitle(event.target.value)} className="rounded border border-slate-300 px-2 py-1" /><textarea aria-label="Edit evidence description" value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-20 rounded border border-slate-300 px-2 py-1" /><div className="flex gap-2"><button type="button" onClick={() => void save()} className="rounded bg-indigo-600 px-3 py-1 text-sm text-white">Save and reprocess</button><button type="button" onClick={() => setEditing(null)} className="text-sm">Cancel</button></div></div>}</li>)}</ul><Pagination page={result.page} pageSize={result.page_size} total={result.total} onPage={setPage} /></> : <EmptyState title="No evidence submitted">Add evidence to begin your passport.</EmptyState>}</section>;
}

function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  return <div className="mt-3 flex items-center gap-3 text-sm"><button disabled={page === 1} onClick={() => onPage(page - 1)} className="disabled:text-slate-400">Previous</button><span>Page {page} of {pages}</span><button disabled={page === pages} onClick={() => onPage(page + 1)} className="disabled:text-slate-400">Next</button></div>;
}
