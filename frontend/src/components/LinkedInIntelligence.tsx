import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, CheckCircle2, FileArchive, GraduationCap, Info, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { ApiError, api, type LinkedInImport, type ProfessionalProfile } from "../api";
import { EmptyState, LoadingState } from "./AsyncState";
import { LiquidGlassButton } from "./ui/EditorialPrimitives";

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
    <section className="border border-white/10 bg-[#061524] p-6 rounded-md text-white font-sans space-y-6">
      <div className="border-b border-white/10 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-normal text-white flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <FileArchive className="h-4 w-4 text-white/80" />
            <span>LinkedIn Intelligence</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-300 border border-white/15 px-2 py-0.5 rounded-xs">
              USER-PROVIDED EXPORT · NOT SCRAPED
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Deterministic parser for student-downloaded LinkedIn data archives (.zip). Never scraped.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className="font-mono text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
          <span>{showGuide ? "Hide instructions" : "How to export LinkedIn data"}</span>
        </button>
      </div>

      {showGuide && (
        <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm text-xs text-neutral-300 space-y-2 font-mono">
          <p className="text-white font-medium flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-white/80" />
            <span>How to download your LinkedIn Data Export (.zip):</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-neutral-400">
            <li>Open LinkedIn &rarr; Click your profile icon &rarr; <strong>Settings & Privacy</strong></li>
            <li>Select <strong>Data Privacy</strong> on the left navigation</li>
            <li>Click <strong>Get a copy of your data</strong> &rarr; Request the archive (positions, projects, skills, education)</li>
            <li>Download the generated <strong>.zip</strong> archive and upload it below</li>
          </ol>
        </div>
      )}

      {/* Mode Switcher */}
      <div className="flex border-b border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`pb-2 px-3 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
            mode === "url"
              ? "text-white border-b-2 border-white font-semibold"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Simulated URL Preview
        </button>
        <button
          type="button"
          onClick={() => setMode("archive")}
          className={`pb-2 px-3 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
            mode === "archive"
              ? "text-white border-b-2 border-white font-semibold"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Export Archive (.zip)
        </button>
      </div>

      <div className="space-y-4">
        {mode === "url" ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                aria-label="LinkedIn profile URL"
                type="url"
                value={profileUrl}
                onChange={(e) => setProfileUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-profile"
                className="flex-1 rounded-md border border-white/15 bg-white/[0.03] px-3 py-2 text-xs text-white focus:border-white focus:outline-none"
              />
              <LiquidGlassButton
                disabled={isImportingUrl || !profileUrl.trim()}
                onClick={() => void handleImportUrl()}
                size="sm"
              >
                {isImportingUrl ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span>{isImportingUrl ? "Generating..." : "Generate Demo Preview"}</span>
              </LiquidGlassButton>
            </div>

            <p className="font-mono text-[11px] text-neutral-400">
              LinkedIn URL access is not connected. This produces a clearly labeled simulated preview only;
              upload your LinkedIn data export to create evidence-backed passport records.
            </p>

            {/* Preview Card */}
            {previewProfile && (
              <div className="border border-white/15 bg-white/[0.02] p-5 rounded-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-normal text-white flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                      <span>{previewProfile.full_name}</span>
                      <span className="font-mono text-[10px] uppercase border border-white/20 px-2 py-0.5 rounded-xs text-neutral-300">
                        Demo fixture — not verified
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-300 mt-0.5">{previewProfile.headline}</p>
                    <p className="text-[11px] text-neutral-400 mt-1 italic">{previewProfile.summary}</p>
                  </div>
                  <LiquidGlassButton
                    disabled={isSavingProfile || !previewProfile.persistable}
                    onClick={() => void handleSaveProfile()}
                    size="sm"
                  >
                    {isSavingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>{previewProfile.persistable ? "Save to Skill Passport" : "Preview only"}</span>
                  </LiquidGlassButton>
                </div>

                <div className="font-mono text-[11px] text-neutral-400 border border-white/10 p-2.5 rounded-sm">
                  {previewProfile.disclaimer}
                </div>

                <div>
                  <h4 className="font-mono text-[10px] uppercase tracking-wider text-neutral-400 mb-1.5">
                    Extracted Skills ({previewProfile.skills.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {previewProfile.skills.map((s: string, idx: number) => (
                      <span
                        key={idx}
                        className="font-mono text-xs border border-white/15 bg-white/5 px-2 py-0.5 rounded-xs text-white"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 border border-white/10 bg-white/[0.02] rounded-sm">
                    <p className="font-mono text-[10px] uppercase text-neutral-400 flex items-center gap-1.5 mb-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-white/80" /> Experience ({previewProfile.experiences.length})
                    </p>
                    {previewProfile.experiences.map((exp, i) => (
                      <p key={i} className="text-[11px] text-neutral-300">
                        • <strong>{exp.title}</strong> at {exp.company}
                      </p>
                    ))}
                  </div>
                  <div className="p-3 border border-white/10 bg-white/[0.02] rounded-sm">
                    <p className="font-mono text-[10px] uppercase text-neutral-400 flex items-center gap-1.5 mb-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-white/80" /> Education ({previewProfile.education.length})
                    </p>
                    {previewProfile.education.map((edu, i) => (
                      <p key={i} className="text-[11px] text-neutral-300">
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
              className="flex-1 rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs text-white file:mr-2 file:py-1 file:px-2 file:rounded-xs file:border-0 file:text-xs file:font-mono file:bg-white/10 file:text-white hover:file:bg-white/20"
            />
            <LiquidGlassButton
              disabled={!file}
              onClick={() => void upload()}
              size="sm"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload LinkedIn archive</span>
            </LiquidGlassButton>
          </div>
        )}

        {message && (
          <p
            role="status"
            className="text-xs font-mono text-neutral-300 p-2.5 rounded-sm border border-white/10 bg-white/[0.02]"
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
                  className="border border-white/10 bg-white/[0.02] p-4 rounded-sm space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm text-white flex items-center gap-2">
                        <span>{item.original_filename}</span>
                        {item.is_active && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-white border border-white/20 px-2 py-0.5 rounded-xs flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Active LinkedIn Import
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[11px] text-neutral-400 mt-0.5">
                        Status: <span className="text-white">{item.parse_status}</span> · Generated Evidence: <span className="text-white">{item.generated_evidence_count}</span> · Skills Extraction: <span className="text-white">{item.skills_status}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => void parse(item.id)}
                        disabled={item.parse_status === "unsupported" || isParsingId === item.id}
                        className="text-neutral-300 hover:text-white disabled:opacity-40 cursor-pointer inline-flex items-center gap-1"
                      >
                        {isParsingId === item.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span>Parse & Extract</span>
                      </button>
                      <span className="text-white/20">·</span>
                      <button
                        type="button"
                        onClick={() => void activate(item.id)}
                        className="text-neutral-300 hover:text-white cursor-pointer"
                      >
                        Set Active
                      </button>
                      <span className="text-white/20">·</span>
                      <button
                        type="button"
                        onClick={() => void remove(item)}
                        className="text-neutral-400 hover:text-red-400 cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  {/* WORKFLOW STEPPER */}
                  <div className="pt-2 border-t border-white/10">
                    <ol className="grid grid-cols-4 gap-2 font-mono text-[10px] text-neutral-400">
                      {WORKFLOW_STEPS.map((stepName, idx) => {
                        const stepNum = idx + 1;
                        const isDone = currentStep >= stepNum;
                        const isCurrent = currentStep === stepNum || (isParsingId === item.id && stepNum === 2);

                        return (
                          <li key={stepName} className="flex flex-col gap-1">
                            <div
                              className={`h-0.5 w-full rounded-full transition-colors ${
                                isDone
                                  ? "bg-white"
                                  : isCurrent
                                  ? "bg-white/60 animate-pulse"
                                  : "bg-white/10"
                              }`}
                            />
                            <span className={isDone ? "text-white" : ""}>
                              {stepName}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  {item.safe_error_message && (
                    <p className="text-xs text-red-300 font-mono">
                      {item.safe_error_message}
                    </p>
                  )}

                  {summary && (
                    <div className="pt-2 border-t border-white/10 space-y-2 font-mono">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-sm border border-white/10 bg-white/[0.02]">
                          <p className="text-[10px] uppercase text-neutral-400">Positions</p>
                          <p className="text-lg font-normal text-white mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                            {summary.counts.positions}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-sm border border-white/10 bg-white/[0.02]">
                          <p className="text-[10px] uppercase text-neutral-400">Projects</p>
                          <p className="text-lg font-normal text-white mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                            {summary.counts.projects}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-sm border border-white/10 bg-white/[0.02]">
                          <p className="text-[10px] uppercase text-neutral-400">Certifications</p>
                          <p className="text-lg font-normal text-white mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                            {summary.counts.certifications}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-sm border border-white/10 bg-white/[0.02]">
                          <p className="text-[10px] uppercase text-neutral-400">Education</p>
                          <p className="text-lg font-normal text-white mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                            {summary.counts.education}
                          </p>
                        </div>
                      </div>

                      {summary.discovered_skills.length > 0 && (
                        <div className="text-xs text-neutral-300 pt-1">
                          <span className="text-neutral-400">Discovered Skills: </span>
                          <span>{summary.discovered_skills.slice(0, 10).join(", ")}</span>
                          {summary.discovered_skills.length > 10 && (
                            <span className="text-neutral-400"> +{summary.discovered_skills.length - 10} more</span>
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
