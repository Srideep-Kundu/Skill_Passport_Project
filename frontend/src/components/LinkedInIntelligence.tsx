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
      toast.success("LinkedIn profile & skills saved to Lumina Intel!");
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
    <section className="border border-[#E5E1D8] bg-[#FFFFFF] p-6 sm:p-8 rounded-[16px] text-[#111827] font-sans space-y-6 shadow-[0_8px_30px_rgba(17,24,39,0.04)]">
      <div className="border-b border-[#E5E1D8] pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-[#B08D57] font-semibold mb-1 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B08D57]" />
            <span>LINKEDIN PROVENANCE AUDIT</span>
          </div>
          <h2 className="text-2xl font-normal text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <FileArchive className="h-5 w-5 text-[#B08D57]" />
            <span>LinkedIn Intelligence</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] border border-[#E5E1D8] bg-[#F7F5F0] px-2.5 py-0.5 rounded-full">
              USER-PROVIDED EXPORT · NOT SCRAPED
            </span>
          </h2>
          <p className="text-xs text-[#475569] mt-0.5">
            Deterministic parser for student-downloaded LinkedIn data archives (.zip). Never scraped.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className="font-mono text-xs text-[#B08D57] hover:text-[#111827] flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
          <span>{showGuide ? "Hide instructions" : "How to export LinkedIn data"}</span>
        </button>
      </div>

      {showGuide && (
        <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-4 rounded-[14px] text-xs text-[#475569] space-y-2 font-mono">
          <p className="text-[#111827] font-medium flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#B08D57]" />
            <span>How to download your LinkedIn Data Export (.zip):</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#64748B]">
            <li>Open LinkedIn &rarr; Click your profile icon &rarr; <strong>Settings & Privacy</strong></li>
            <li>Select <strong>Data Privacy</strong> on the left navigation</li>
            <li>Click <strong>Get a copy of your data</strong> &rarr; Request the archive (positions, projects, skills, education)</li>
            <li>Download the generated <strong>.zip</strong> archive and upload it below</li>
          </ol>
        </div>
      )}

      {/* Mode Switcher */}
      <div className="flex border-b border-[#E5E1D8] w-fit">
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`pb-2 px-3 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
            mode === "url"
              ? "text-[#111827] border-b-2 border-[#111827] font-semibold"
              : "text-[#64748B] hover:text-[#111827]"
          }`}
        >
          Simulated URL Preview
        </button>
        <button
          type="button"
          onClick={() => setMode("archive")}
          className={`pb-2 px-3 font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer ${
            mode === "archive"
              ? "text-[#111827] border-b-2 border-[#111827] font-semibold"
              : "text-[#64748B] hover:text-[#111827]"
          }`}
        >
          ZIP Archive Upload
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
                className="flex-1 rounded-md border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-2 text-xs text-[#111827] focus:border-[#B08D57] focus:outline-none"
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

            <p className="font-mono text-[11px] text-[#64748B]">
              LinkedIn URL access is not connected. This produces a clearly labeled simulated preview only;
              upload your LinkedIn data export to create evidence-backed passport records.
            </p>

            {/* Preview Card */}
            {previewProfile && (
              <div className="border border-[#E5E1D8] bg-[#F7F5F0] p-5 rounded-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-normal text-[#111827] flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                      <span>{previewProfile.full_name}</span>
                      <span className="font-mono text-[10px] uppercase border border-[#E5E1D8] px-2 py-0.5 rounded-xs text-[#475569]">
                        Demo fixture — not verified
                      </span>
                    </h3>
                    <p className="text-xs text-[#475569] mt-0.5">{previewProfile.headline}</p>
                    <p className="text-[11px] text-[#64748B] mt-1 italic">{previewProfile.summary}</p>
                  </div>
                  <LiquidGlassButton
                    disabled={isSavingProfile || !previewProfile.persistable}
                    onClick={() => void handleSaveProfile()}
                    size="sm"
                  >
                    {isSavingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    <span>{previewProfile.persistable ? "Save to Lumina Intel" : "Preview only"}</span>
                  </LiquidGlassButton>
                </div>

                <div className="font-mono text-[11px] text-[#64748B] border border-[#E5E1D8] p-2.5 rounded-sm">
                  {previewProfile.disclaimer}
                </div>

                <div>
                  <h4 className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] mb-1.5">
                    Extracted Skills ({previewProfile.skills.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {previewProfile.skills.map((s: string, idx: number) => (
                      <span
                        key={idx}
                        className="font-mono text-xs border border-[#E5E1D8] bg-[#FFFFFF] px-2 py-0.5 rounded-xs text-[#111827]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 border border-[#E5E1D8] bg-[#FFFFFF] rounded-sm">
                    <p className="font-mono text-[10px] uppercase text-[#64748B] flex items-center gap-1.5 mb-1.5 font-semibold">
                      <Briefcase className="h-3.5 w-3.5 text-[#B08D57]" /> Experience ({previewProfile.experiences.length})
                    </p>
                    {previewProfile.experiences.map((exp, i) => (
                      <p key={i} className="text-[11px] text-[#475569]">
                        • <strong>{exp.title}</strong> at {exp.company}
                      </p>
                    ))}
                  </div>
                  <div className="p-3 border border-[#E5E1D8] bg-[#FFFFFF] rounded-sm">
                    <p className="font-mono text-[10px] uppercase text-[#64748B] flex items-center gap-1.5 mb-1.5 font-semibold">
                      <GraduationCap className="h-3.5 w-3.5 text-[#B08D57]" /> Education ({previewProfile.education.length})
                    </p>
                    {previewProfile.education.map((edu, i) => (
                      <p key={i} className="text-[11px] text-[#475569]">
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
              className="flex-1 rounded-md border border-[#E5E1D8] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#111827] file:mr-2 file:py-1 file:px-2 file:rounded-xs file:border file:border-[#E5E1D8] file:text-xs file:font-mono file:bg-[#F7F5F0] file:text-[#111827] hover:file:bg-[#E5E1D8]"
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
            className="text-xs font-mono text-[#475569] p-2.5 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]"
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
                  className="border border-[#E5E1D8] bg-[#FFFFFF] p-4 rounded-sm space-y-3 shadow-2xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm text-[#111827] flex items-center gap-2">
                        <span>{item.original_filename}</span>
                        {item.is_active && (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#4F6F5A] border border-[#4F6F5A]/30 bg-[rgba(79,111,90,0.10)] px-2 py-0.5 rounded-xs flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Active LinkedIn Import
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[11px] text-[#64748B] mt-0.5">
                        Status: <span className="text-[#111827] font-semibold">{item.parse_status}</span> · Generated Evidence: <span className="text-[#111827] font-semibold">{item.generated_evidence_count}</span> · Skills Extraction: <span className="text-[#111827] font-semibold">{item.skills_status}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => void parse(item.id)}
                        disabled={item.parse_status === "unsupported" || isParsingId === item.id}
                        className="text-[#0f172a] hover:text-[#000000] disabled:opacity-40 cursor-pointer inline-flex items-center gap-1 font-semibold"
                      >
                        {isParsingId === item.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span>Parse & Extract</span>
                      </button>
                      <span className="text-[#CBD5E1]">·</span>
                      <button
                        type="button"
                        onClick={() => void activate(item.id)}
                        className="text-[#0f172a] hover:text-[#000000] cursor-pointer font-semibold"
                      >
                        Set Active
                      </button>
                      <span className="text-[#CBD5E1]">·</span>
                      <button
                        type="button"
                        onClick={() => void remove(item)}
                        className="text-[#64748B] hover:text-red-600 cursor-pointer inline-flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  {/* WORKFLOW STEPPER */}
                  <div className="pt-2 border-t border-[#E5E1D8]">
                    <ol className="grid grid-cols-4 gap-2 font-mono text-[10px] text-[#64748B]">
                      {WORKFLOW_STEPS.map((stepName, idx) => {
                        const stepNum = idx + 1;
                        const isDone = currentStep >= stepNum;
                        const isCurrent = currentStep === stepNum || (isParsingId === item.id && stepNum === 2);

                        return (
                          <li key={stepName} className="flex flex-col gap-1">
                            <div
                              className={`h-0.5 w-full rounded-full transition-colors ${
                                isDone
                                  ? "bg-[#B08D57]"
                                  : isCurrent
                                  ? "bg-[#B08D57]/60 animate-pulse"
                                  : "bg-[#E5E1D8]"
                              }`}
                            />
                            <span className={isDone ? "text-[#111827] font-semibold" : "text-[#64748B]"}>
                              {stepName}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  {item.safe_error_message && (
                    <p className="text-xs text-[#B4534B] font-mono">
                      {item.safe_error_message}
                    </p>
                  )}

                  {summary && (
                    <div className="pt-2 border-t border-[#E5E1D8] space-y-2 font-mono">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
                          <p className="text-[10px] uppercase text-[#64748B] font-semibold">Positions</p>
                          <p className="text-lg font-normal text-[#111827] mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                            {summary.counts.positions}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
                          <p className="text-[10px] uppercase text-[#64748B] font-semibold">Projects</p>
                          <p className="text-lg font-normal text-[#111827] mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                            {summary.counts.projects}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
                          <p className="text-[10px] uppercase text-[#64748B] font-semibold">Certifications</p>
                          <p className="text-lg font-normal text-[#111827] mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                            {summary.counts.certifications}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-sm border border-[#E5E1D8] bg-[#F7F5F0]">
                          <p className="text-[10px] uppercase text-[#64748B] font-semibold">Education</p>
                          <p className="text-lg font-normal text-[#111827] mt-0.5" style={{ fontFamily: "var(--font-display)" }}>
                            {summary.counts.education}
                          </p>
                        </div>
                      </div>

                      {summary.discovered_skills.length > 0 && (
                        <div className="text-xs text-[#475569] pt-1">
                          <span className="text-[#64748B]">Discovered Skills: </span>
                          <span>{summary.discovered_skills.slice(0, 10).join(", ")}</span>
                          {summary.discovered_skills.length > 10 && (
                            <span className="text-[#64748B]"> +{summary.discovered_skills.length - 10} more</span>
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
