import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Calendar,
  GraduationCap,
  CheckCircle2,
  Send,
} from "lucide-react";
import { api } from "../api/service";
import { errorMessage } from "../api/client";
import type { PlacementDrive } from "../api/types";
import { toast } from "sonner";
import { EditorialButton, EditorialPageHeader } from "./ui/EditorialPrimitives";

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
    <div className="space-y-6 font-sans">
      <EditorialPageHeader
        category="STUDENT"
        index="CAMPUS"
        title="Campus Placement & Job Drives"
        subtitle="Verified institutional placement drives. Apply directly with your Skill Passport verified profile and portfolio."
      />

      {loading ? (
        <div className="p-12 text-center border border-white/10 bg-[#071E2B] rounded-md">
          <div className="inline-block animate-spin h-6 w-6 border-2 border-white/20 border-t-white rounded-full mb-3" />
          <p className="font-mono text-xs text-[#8796A2]">Loading placement schedule...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {drives.map((drive) => (
            <div
              key={drive.id}
              className="border border-white/10 bg-[#071E2B] p-6 rounded-md flex flex-col justify-between space-y-5 hover:border-white/20 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-[#9CC7D8] flex items-center gap-1.5 font-bold">
                    <Building2 className="h-3.5 w-3.5" />
                    {drive.company_name}
                  </span>
                  <span className="text-[#F7F8F8] border border-white/15 px-2 py-0.5 rounded-xs">
                    ₹{drive.ctc_lpa} LPA
                  </span>
                </div>

                <h3
                  className="text-xl font-normal text-[#F7F8F8]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {drive.title}
                </h3>
                <p className="text-xs text-[#BEC8CF] leading-relaxed line-clamp-2">{drive.description}</p>

                {/* Eligibility & Info */}
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs text-[#8796A2]">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>Min CGPA: <strong className="text-[#F7F8F8]">{drive.minimum_cgpa}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Batch: <strong className="text-[#F7F8F8]">{drive.passing_year}</strong></span>
                  </div>
                </div>

                {/* Required Skills as dots */}
                <div className="pt-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#8796A2] block mb-1">
                    Requirements
                  </span>
                  <p className="font-mono text-xs text-[#BEC8CF]">
                    {drive.required_skills.join(" · ")}
                  </p>
                </div>
              </div>

              {/* Action / Registration state */}
              <div className="pt-4 border-t border-white/10">
                {drive.is_registered ? (
                  <div className="p-3 rounded-sm border border-white/15 bg-white/5 flex items-center justify-between font-mono text-xs text-[#F7F8F8]">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Registration Confirmed
                    </span>
                    <span className="uppercase text-[10px] text-[#9CC7D8]">
                      {drive.registration_status || "Registered"}
                    </span>
                  </div>
                ) : (
                  <div>
                    {registeringId === drive.id ? (
                      <div className="space-y-3">
                        <textarea
                          placeholder="Optional notes or areas of interest for the recruiter..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="w-full text-xs p-3 rounded-md bg-white/[0.03] border border-white/15 text-[#F7F8F8] focus:outline-none focus:border-white"
                        />
                        <div className="flex justify-end gap-2 font-mono text-xs">
                          <button
                            type="button"
                            onClick={() => setRegisteringId(null)}
                            className="px-3 py-1.5 text-[#8796A2] hover:text-[#F7F8F8] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <EditorialButton
                            variant="primary"
                            onClick={() => handleRegister(drive.id)}
                            disabled={submitting}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Submit Registration
                          </EditorialButton>
                        </div>
                      </div>
                    ) : (
                      <EditorialButton
                        variant="primary"
                        onClick={() => setRegisteringId(drive.id)}
                        className="w-full justify-center"
                      >
                        Register for Placement Drive
                      </EditorialButton>
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
