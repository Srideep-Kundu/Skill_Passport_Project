import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Layers } from "lucide-react";
import { ApiError, api, type EvidenceSummary, type PaginatedResponse } from "../api";
import { EmptyState, LoadingState } from "./AsyncState";
import { containerStaggerVariants, cardItemVariants, modalVariants } from "../theme/motion";

export function EvidenceLifecycle({
  token,
  refreshKey,
  onChanged,
}: {
  token: string;
  refreshKey: number;
  onChanged: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [result, setResult] = useState<PaginatedResponse<EvidenceSummary> | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EvidenceSummary | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setResult(await api.evidences(token, page));
    } catch (caught) {
      setMessage(caught instanceof ApiError ? caught.detail : "Evidence could not be loaded.");
    }
  }, [page, token]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function beginEdit(evidence: EvidenceSummary) {
    setEditing(evidence);
    setTitle(evidence.title);
    setDescription(evidence.description);
    setMessage(null);
  }

  async function save() {
    if (!editing) return;
    try {
      const updated = await api.updateEvidence(editing.id, { title, description }, token);
      setEditing(null);
      setMessage(`Evidence saved. Extraction is ${updated.extraction_status.replaceAll("_", " ")}.`);
      toast.success("Evidence updated and reprocessing queued!");
      await load();
      onChanged();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Evidence could not be updated.";
      setMessage(msg);
      toast.error(msg);
    }
  }

  async function remove(evidence: EvidenceSummary) {
    if (!window.confirm(`Delete ${evidence.title}? This removes its evidence-backed skills.`)) return;
    try {
      await api.deleteEvidence(evidence.id, token);
      toast.success("Evidence deleted.");
      await load();
      onChanged();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Evidence could not be deleted.";
      setMessage(msg);
      toast.error(msg);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-5 sm:p-6 shadow-lg text-slate-900 dark:text-[#f1f0e8] flex flex-col justify-between">
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3.5">
        <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2 font-sans">
          <Layers className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
          <span>Evidence Lifecycle & Extraction</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5 font-sans">
          Updating evidence automatically re-queues skill extraction and deterministic scoring.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {message && (
          <p role="status" className="text-xs font-medium text-slate-600 dark:text-[#dedbc8] bg-slate-50/60 dark:bg-white/[0.03] backdrop-blur-md p-2.5 rounded-xl border border-slate-200/60 dark:border-white/10 font-sans">
            {message}
          </p>
        )}

        {!result ? (
          <LoadingState label="Loading evidence" />
        ) : result.items.length ? (
          <>
            <motion.ul
              variants={prefersReducedMotion ? undefined : containerStaggerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-2.5"
            >
              {result.items.map((evidence) => (
                <motion.li
                  key={evidence.id}
                  variants={prefersReducedMotion ? undefined : cardItemVariants}
                  className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-slate-50/40 dark:bg-white/[0.03] backdrop-blur-md p-4 space-y-2 hover:border-[#3b71d9]/50 dark:hover:border-blue-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-[#f1f0e8] font-sans">{evidence.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] mt-0.5 line-clamp-2 font-sans">
                        {evidence.description}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-400 dark:text-[#98a4b3] mt-1 uppercase tracking-wider font-sans">
                        Extraction Status: {evidence.extraction_status.replaceAll("_", " ")}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold font-sans">
                      <button
                        type="button"
                        onClick={() => beginEdit(evidence)}
                        className="text-[#3b71d9] dark:text-[#b0c6ff] hover:underline cursor-pointer"
                      >
                        Edit
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">&middot;</span>
                      <button
                        type="button"
                        onClick={() => void remove(evidence)}
                        className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {editing?.id === evidence.id && (
                      <motion.div
                        variants={prefersReducedMotion ? undefined : modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="mt-3 grid gap-2.5 border-t border-slate-200/60 dark:border-white/[0.08] pt-3"
                      >
                        <input
                          aria-label="Edit evidence title"
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          className="rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3 py-1.5 text-xs text-slate-900 dark:text-[#f1f0e8] focus:border-[#3b71d9] focus:outline-none"
                        />
                        <textarea
                          aria-label="Edit evidence description"
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          className="min-h-20 rounded-xl border border-slate-300 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] backdrop-blur-md px-3 py-1.5 text-xs text-slate-900 dark:text-[#f1f0e8] focus:border-[#3b71d9] focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="rounded-lg border border-slate-300 dark:border-white/10 px-3 py-1 text-xs font-medium cursor-pointer text-slate-700 dark:text-[#dedbc8]"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void save()}
                            className="rounded-lg bg-[#3b71d9] px-3 py-1 text-xs font-semibold text-white hover:bg-[#2563eb] transition-colors cursor-pointer font-sans shadow-sm shadow-[#3b71d9]/25"
                          >
                            Save and reprocess
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              ))}
            </motion.ul>

            {result.total > 20 && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.08] text-xs font-sans">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border border-slate-200 dark:border-white/10 px-2.5 py-1 disabled:opacity-40 cursor-pointer text-slate-700 dark:text-[#dedbc8]"
                >
                  Previous
                </button>
                <span className="text-slate-500 dark:text-[#98a4b3]">Page {page}</span>
                <button
                  disabled={page * 20 >= result.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-slate-200 dark:border-white/10 px-2.5 py-1 disabled:opacity-40 cursor-pointer text-slate-700 dark:text-[#dedbc8]"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState title="No evidence uploaded yet">
            Submit your first project or code sample to start generating skill claims.
          </EmptyState>
        )}
      </div>
    </section>
  );
}
