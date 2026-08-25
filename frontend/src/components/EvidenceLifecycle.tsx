import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { ApiError, api, type EvidenceSummary, type PaginatedResponse } from "../api";
import { EmptyState, LoadingState } from "./AsyncState";
import { containerStaggerVariants, cardItemVariants, modalVariants } from "../theme/motion";
import { EditorialButton } from "./ui/EditorialPrimitives";

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
    <section className="rounded-md border border-white/10 bg-[#071E2B] p-6 text-[#F7F8F8] flex flex-col justify-between font-sans">
      <div className="border-b border-white/10 pb-4">
        <h2
          className="text-xl font-normal text-[#F7F8F8]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Evidence Lifecycle & Extraction
        </h2>
        <p className="font-mono text-xs text-[#8796A2] mt-0.5">
          Updating evidence automatically re-queues skill extraction and deterministic scoring.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {message && (
          <p role="status" className="font-mono text-xs text-[#9CC7D8] bg-[#9CC7D8]/10 p-3 rounded-sm border border-[#9CC7D8]/30">
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
              className="space-y-3"
            >
              {result.items.map((evidence) => (
                <motion.li
                  key={evidence.id}
                  variants={prefersReducedMotion ? undefined : cardItemVariants}
                  className="rounded-sm border border-white/10 bg-white/[0.01] p-4 space-y-2 hover:border-white/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-mono text-sm text-[#F7F8F8]">{evidence.title}</p>
                      <p className="text-xs text-[#BEC8CF] line-clamp-2 leading-relaxed">
                        {evidence.description}
                      </p>
                      <p className="font-mono text-[10px] uppercase text-[#8796A2] pt-1">
                        Extraction Status: {evidence.extraction_status.replaceAll("_", " ")}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => beginEdit(evidence)}
                        className="text-[#9CC7D8] hover:text-[#F7F8F8] cursor-pointer"
                      >
                        Edit
                      </button>
                      <span className="text-white/20">·</span>
                      <button
                        type="button"
                        onClick={() => void remove(evidence)}
                        className="text-red-400 hover:text-red-300 cursor-pointer"
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
                        className="mt-3 grid gap-3 border-t border-white/10 pt-3"
                      >
                        <input
                          aria-label="Edit evidence title"
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          className="rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-[#F7F8F8] focus:border-white focus:outline-none"
                        />
                        <textarea
                          aria-label="Edit evidence description"
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          className="min-h-20 rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-[#F7F8F8] focus:border-white focus:outline-none"
                        />
                        <div className="flex justify-end gap-2 font-mono text-xs">
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="px-3 py-1 text-[#8796A2] hover:text-[#F7F8F8] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <EditorialButton
                            variant="primary"
                            onClick={() => void save()}
                          >
                            Save and reprocess
                          </EditorialButton>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              ))}
            </motion.ul>

            {result.total > 20 && (
              <div className="flex items-center justify-between pt-3 border-t border-white/10 font-mono text-xs">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 border border-white/10 rounded-xs disabled:opacity-30 text-[#8796A2] hover:text-white cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-[#8796A2]">Page {page}</span>
                <button
                  disabled={page * 20 >= result.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 border border-white/10 rounded-xs disabled:opacity-30 text-[#8796A2] hover:text-white cursor-pointer"
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
