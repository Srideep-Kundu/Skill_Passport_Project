import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, Briefcase, CheckCircle2, FileArchive, FolderGit2, GraduationCap, Info, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { ApiError, api, type LinkedInImport, type ProfessionalProfile } from "../api";
import { EmptyState, LoadingState } from "./AsyncState";

function getWorkflowStep(parseStatus: string): number {
  switch (parseStatus) {
    case "uploaded":
      return 1;
    case "parsing":
      return 2;
    case "parsed":
    case "processing_skills":
      return 3;
    case "completed":
      return 4;
    default:
      return 0;
  }
}

const WORKFLOW_STEPS = [
  "Archive Uploaded",
  "Reading CSVs",
  "Generating Evidence",
  "Skills Pipeline",
];

export function LinkedInIntelligence({
  token,
  onChanged,
}: {
  token: string;
  onChanged: () => void;
}) {
  const [imports, setImports] = useState<LinkedInImport[] | null>(null);
  const [mode, setMode] = useState<"url" | "archive">("url");
  const [profileUrl, setProfileUrl] = useState("https://linkedin.com/in/maya-rivera");
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<ProfessionalProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isParsingId, setIsParsingId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const load = useCallback(async () => {
    try {
      setImports((await api.linkedinImports(token)).items);
    } catch (caught) {
      setImports([]);
      setMessage(caught instanceof ApiError ? caught.detail : "LinkedIn imports could not be loaded.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleImportUrl() {
    if (!profileUrl.trim()) return;
    setIsImportingUrl(true);
    setMessage(null);
    try {
      const profile = await api.importLinkedInUrl(profileUrl.trim(), token);
      setPreviewProfile(profile);
      toast.success("Simulated preview generated. It will not be saved to your passport.");
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "LinkedIn profile import failed.";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setIsImportingUrl(false);
    }
  }

  async function handleSaveProfile() {
    if (!previewProfile?.persistable) return;
    setIsSavingProfile(true);
    try {
      await api.saveLinkedInProfile(previewProfile, token);
      toast.success("LinkedIn profile & skills saved to Skill Passport!");
      setPreviewProfile(null);
      onChanged();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Could not save profile to passport.";
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  }


  async function upload() {
    if (!file) return;
    try {
      const result = await api.uploadLinkedInExport(file, token);
      const msg =
        result.parse_status === "unsupported"
          ? result.safe_error_message
          : "LinkedIn export archive uploaded. Parse it to extract structured skill evidence.";
      setMessage(msg);
      toast.success("LinkedIn export uploaded successfully!");
      setFile(null);
      await load();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "LinkedIn archive upload failed.";
      setMessage(msg);
      toast.error(msg);
    }
  }

  async function parse(id: string) {
    setIsParsingId(id);
    try {
      const result = await api.parseLinkedInExport(id, token);
      const msg =
        result.safe_error_message ??
        "LinkedIn export parsed! Generated evidence items are being processed by the skill extraction worker.";
      setMessage(msg);
      toast.success("LinkedIn export parsed into evidence!");
      await load();
      onChanged();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "LinkedIn archive parsing failed.";
      setMessage(msg);
      toast.error(msg);
    } finally {
      setIsParsingId(null);
    }
  }

  async function activate(id: string) {
    try {
      await api.activateLinkedInExport(id, token);
      toast.success("LinkedIn export set as active!");
      await load();
      onChanged();
    } catch (caught) {
      const msg = caught instanceof ApiError ? caught.detail : "Could not activate LinkedIn export.";
      setMessage(msg);
      toast.error(msg);
    }
  }

  async function remove(item: LinkedInImport) {
    if (!window.confirm(`Delete LinkedIn import "${item.original_filename}"?`)) return;
    try {
      await api.deleteLinkedInExport(item.id, token);
      toast.success("LinkedIn import deleted.");
      await load();
      onChanged();
    } catch (caught) {
      const msg =
        caught instanceof ApiError
          ? caught.detail
          : "Delete generated evidence before deleting this LinkedIn import.";
      setMessage(msg);
      toast.error(msg);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-[#0c121e]/45 backdrop-blur-xl p-5 sm:p-6 shadow-lg text-slate-900 dark:text-[#f1f0e8] flex flex-col justify-between">
      <div className="border-b border-slate-100 dark:border-white/[0.08] pb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2">
            <FileArchive className="h-4 w-4 text-[#3b71d9] dark:text-[#b0c6ff]" />
            <span>LinkedIn Intelligence</span>
            <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-[#151e29] border border-blue-200 dark:border-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#3b71d9] dark:text-[#dedbc8]">
              User-Provided Export
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#98a4b3] mt-0.5">
            Deterministic parser for student-downloaded LinkedIn data archives (.zip). Never scraped.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className="inline-flex items-center gap-1 text-xs text-[#3b71d9] dark:text-[#b0c6ff] hover:underline cursor-pointer"
        >
          <Info className="h-3.5 w-3.5" />
          <span>{showGuide ? "Hide instructions" : "How to export LinkedIn data"}</span>
        </button>
      </div>

      {showGuide && (
        <div className="mt-3.5 rounded-xl border border-blue-100 dark:border-white/[0.08] bg-blue-50/50 dark:bg-[#151e29] p-3.5 text-xs text-slate-700 dark:text-[#f1f0e8] space-y-1.5 animate-fadeIn">
          <p className="font-semibold text-blue-900 dark:text-[#dedbc8] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            <span>How to download your LinkedIn Data Export (.zip):</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] text-slate-600 dark:text-[#98a4b3]">
            <li>Open LinkedIn &rarr; Click your profile icon &rarr; <strong>Settings & Privacy</strong></li>
            <li>Select <strong>Data Privacy</strong> on the left navigation</li>
            <li>Click <strong>Get a copy of your data</strong> &rarr; Request the archive (positions, projects, skills, education)</li>
            <li>Download the generated <strong>.zip</strong> archive and upload it below</li>
          </ol>
        </div>
      )}

      {/* Mode Switcher */}
      <div className="mt-4 flex gap-2 bg-slate-100 dark:bg-white/[0.05] p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === "url"
              ? "bg-white dark:bg-[#101319] text-[#3b71d9] dark:text-[#b0c6ff] shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Simulated URL Preview
        </button>
        <button
          type="button"
          onClick={() => setMode("archive")}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === "archive"
              ? "bg-white dark:bg-[#101319] text-[#3b71d9] dark:text-[#b0c6ff] shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          Export Archive (.zip)
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {mode === "url" ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                aria-label="LinkedIn profile URL"
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-profile"
                className="flex-1 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3.5 py-2 text-xs text-slate-900 dark:text-[#f1f0e8] focus:border-[#3b71d9] focus:outline-none"
              />
              <button
                disabled={isImportingUrl || !profileUrl.trim()}
                type="button"
                onClick={() => void handleImportUrl()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#3b71d9] hover:bg-[#2563eb] px-5 py-2 text-xs font-bold text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm shadow-[#3b71d9]/25"
              >
                {isImportingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>{isImportingUrl ? "Generating..." : "Generate Demo Preview"}</span>
              </button>
            </div>

            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              LinkedIn URL access is not connected. This produces a clearly labeled simulated preview only;
              upload your LinkedIn data export to create evidence-backed passport records.
            </p>

            {/* Extracted Professional Profile Preview Card */}
            {previewProfile && (
              <div className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/40 dark:bg-[#151e29] p-5 space-y-4 animate-fadeIn">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{previewProfile.full_name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-[#3b71d9] dark:text-[#b0c6ff]">
                        Demo fixture — not verified
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{previewProfile.headline}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">{previewProfile.summary}</p>
                  </div>
                  <button
                    disabled={isSavingProfile || !previewProfile.persistable}
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
                  >
                    {isSavingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>{previewProfile.persistable ? "Save to Skill Passport" : "Preview only"}</span>
                  </button>
                </div>

                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-200">
                  {previewProfile.disclaimer}
                </p>

                {/* Skills found */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Extracted Skills ({previewProfile.skills.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {previewProfile.skills.map((s: string, idx: number) => (
                      <span
                        key={idx}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-[#1b2330] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Experience & Education breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-[#18202c] rounded-xl border border-slate-200/70 dark:border-white/10">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 mb-1 text-[11px]">
                      <Briefcase className="h-3.5 w-3.5 text-[#3b71d9]" /> Experience ({previewProfile.experiences.length})
                    </p>
                    {previewProfile.experiences.map((exp, i) => (
                      <p key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
                        • <strong>{exp.title}</strong> at {exp.company}
                      </p>
                    ))}
                  </div>
                  <div className="p-3 bg-white dark:bg-[#18202c] rounded-xl border border-slate-200/70 dark:border-white/10">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 mb-1 text-[11px]">
                      <GraduationCap className="h-3.5 w-3.5 text-purple-500" /> Education ({previewProfile.education.length})
                    </p>
                    {previewProfile.education.map((edu, i) => (
                      <p key={i} className="text-[11px] text-slate-600 dark:text-slate-300">
                        • <strong>{edu.degree}</strong> ({edu.institution})
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              aria-label="LinkedIn export zip archive"
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#151e29] px-3 py-1.5 text-xs text-slate-900 dark:text-[#f1f0e8] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 dark:file:bg-[#1a2430] file:text-[#3b71d9] dark:file:text-[#b0c6ff] hover:file:bg-blue-100"
            />
            <button
              disabled={!file}
              type="button"
              onClick={() => void upload()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#3b71d9] hover:bg-[#2563eb] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm shadow-[#3b71d9]/25"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload LinkedIn archive</span>
            </button>
          </div>
        )}


        {message && (
          <p
            role="status"
            className="text-xs font-medium text-slate-600 dark:text-[#98a4b3] bg-slate-50 dark:bg-[#151e29] p-2.5 rounded-lg border border-slate-200 dark:border-white/[0.08]"
          >
            {message}
          </p>
        )}

        {!imports ? (
          <LoadingState label="Loading LinkedIn imports" />
        ) : imports.length ? (
          <ul className="space-y-3">
            {imports.map((item) => {
              const currentStep = isParsingId === item.id ? 2 : getWorkflowStep(item.parse_status);
              const summary = item.parsed_summary;

              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#151e29] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-[#f1f0e8] flex items-center gap-2">
                        <span>{item.original_filename}</span>
                        {item.is_active && (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-[#182337] border border-blue-200/60 dark:border-blue-900/60 text-[#3b71d9] dark:text-[#b0c6ff] text-[10px] font-bold px-2 py-0.5">
                            <CheckCircle2 className="h-3 w-3" /> Active LinkedIn Import
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-[#98a4b3] mt-0.5">
                        Status: <span className="font-medium text-slate-700 dark:text-[#dedbc8]">{item.parse_status}</span> &middot; Generated Evidence: <span className="font-medium text-slate-700 dark:text-[#dedbc8]">{item.generated_evidence_count}</span> &middot; Skills Extraction: <span className="font-medium text-slate-700 dark:text-[#dedbc8]">{item.skills_status}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => void parse(item.id)}
                        disabled={item.parse_status === "unsupported" || isParsingId === item.id}
                        className="text-[#3b71d9] dark:text-[#b0c6ff] hover:underline disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
                      >
                        {isParsingId === item.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span>Parse & Extract</span>
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">&middot;</span>
                      <button
                        type="button"
                        onClick={() => void activate(item.id)}
                        className="text-[#3b71d9] dark:text-[#b0c6ff] hover:underline cursor-pointer"
                      >
                        Set Active
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">&middot;</span>
                      <button
                        type="button"
                        onClick={() => void remove(item)}
                        className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer inline-flex items-center gap-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  {/* PARSING WORKFLOW STEPPER */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                    <ol className="grid grid-cols-4 gap-1 text-[10px] font-semibold text-slate-400">
                      {WORKFLOW_STEPS.map((stepName, idx) => {
                        const stepNum = idx + 1;
                        const isDone = currentStep >= stepNum;
                        const isCurrent = currentStep === stepNum || (isParsingId === item.id && stepNum === 2);

                        return (
                          <li key={stepName} className="flex flex-col gap-1">
                            <div
                              className={`h-1 w-full rounded-full transition-colors ${
                                isDone
                                  ? "bg-sky-600 dark:bg-sky-400"
                                  : isCurrent
                                  ? "bg-sky-400 animate-pulse"
                                  : "bg-slate-200 dark:bg-slate-800"
                              }`}
                            />
                            <span className={isDone ? "text-sky-700 dark:text-sky-300 font-bold" : ""}>
                              {stepName}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  {item.safe_error_message && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      {item.safe_error_message}
                    </p>
                  )}

                  {summary && (
                    <div className="pt-2 border-t border-slate-200/40 dark:border-slate-800/60 space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-[#111821] border border-slate-200/60 dark:border-white/10">
                          <Briefcase className="h-3.5 w-3.5 text-[#3b71d9] dark:text-[#b0c6ff]" />
                          <div>
                            <p className="text-[10px] text-slate-400 dark:text-[#98a4b3]">Positions</p>
                            <p className="font-bold text-slate-900 dark:text-[#f1f0e8]">{summary.counts.positions}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-[#111821] border border-slate-200/60 dark:border-white/10">
                          <FolderGit2 className="h-3.5 w-3.5 text-[#3b71d9] dark:text-[#b0c6ff]" />
                          <div>
                            <p className="text-[10px] text-slate-400 dark:text-[#98a4b3]">Projects</p>
                            <p className="font-bold text-slate-900 dark:text-[#f1f0e8]">{summary.counts.projects}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-[#111821] border border-slate-200/60 dark:border-white/10">
                          <Award className="h-3.5 w-3.5 text-amber-500" />
                          <div>
                            <p className="text-[10px] text-slate-400 dark:text-[#98a4b3]">Certifications</p>
                            <p className="font-bold text-slate-900 dark:text-[#f1f0e8]">{summary.counts.certifications}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-[#111821] border border-slate-200/60 dark:border-white/10">
                          <GraduationCap className="h-3.5 w-3.5 text-emerald-500" />
                          <div>
                            <p className="text-[10px] text-slate-400 dark:text-[#98a4b3]">Education</p>
                            <p className="font-bold text-slate-900 dark:text-[#f1f0e8]">{summary.counts.education}</p>
                          </div>
                        </div>
                      </div>

                      {summary.discovered_skills.length > 0 && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Discovered Skills: </span>
                          <span>{summary.discovered_skills.slice(0, 10).join(", ")}</span>
                          {summary.discovered_skills.length > 10 && (
                            <span className="text-slate-400"> +{summary.discovered_skills.length - 10} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No LinkedIn archive uploaded">
            Upload a LinkedIn data export archive (.zip) to extract structured skill evidence.
          </EmptyState>
        )}
      </div>
    </section>
  );
}
