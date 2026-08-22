import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Building2,
  Calendar,
  GraduationCap,
  CheckCircle2,
  Sparkles,
  Send,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { PlacementDrive } from "../api/types";
import { toast } from "sonner";

interface Props {
  token: string;
}

export function PlacementDrives({ token }: Props) {
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [loading, setLoading] = useState(true);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadDrives = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPlacementDrives(token);
      setDrives(data);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load campus placement drives"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDrives();
  }, [loadDrives]);

  async function handleRegister(driveId: string) {
    try {
      setSubmitting(true);
      await api.registerPlacement(driveId, token, notes);
      toast.success("Successfully registered for campus placement drive!");
      setRegisteringId(null);
      setNotes("");
      loadDrives();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to register for drive"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="h-5 w-5 text-[#3b71d9]" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Campus Placement & Job Drives</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Verified institutional placement drives. Apply directly with your Skill Passport verified profile and portfolio.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-white dark:bg-[#151921] rounded-2xl border border-slate-200 dark:border-white/[0.08]">
          <div className="inline-block animate-spin h-8 w-8 border-4 border-[#3b71d9] border-t-transparent rounded-full mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading placement schedule...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {drives.map((drive) => (
            <div
              key={drive.id}
              className="bg-white dark:bg-[#151921] rounded-2xl p-6 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-white/[0.15] transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#3b71d9] dark:text-[#b0c6ff] flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {drive.company_name}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                    ₹{drive.ctc_lpa} LPA
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white">{drive.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{drive.description}</p>

                {/* Eligibility & Info */}
                <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                    <span>Min CGPA: <strong>{drive.minimum_cgpa}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Batch: <strong>{drive.passing_year}</strong></span>
                  </div>
                </div>

                {/* Required Skills */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {drive.required_skills.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action / Registration state */}
              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                {drive.is_registered ? (
                  <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/30 flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      Registration Confirmed
                    </span>
                    <span className="uppercase text-[10px] tracking-wider bg-white dark:bg-emerald-900/50 px-2 py-0.5 rounded-md">
                      {drive.registration_status || "Registered"}
                    </span>
                  </div>
                ) : (
                  <div>
                    {registeringId === drive.id ? (
                      <div className="space-y-2">
                        <textarea
                          placeholder="Optional notes or areas of interest for the recruiter..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="w-full text-xs p-2 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] text-slate-900 dark:text-white"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setRegisteringId(null)}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRegister(drive.id)}
                            disabled={submitting}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            Submit Registration
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRegisteringId(drive.id)}
                        className="w-full py-2 bg-[#3b71d9] hover:bg-[#2f5db3] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-[#3b71d9]/20"
                      >
                        <Sparkles className="h-4 w-4" />
                        Register for Drive
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
