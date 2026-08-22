import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api, type ResumeDocument } from "../api";
import { ResumeIntelligence } from "./ResumeIntelligence";

const mockParsedSummary = {
  contact: {
    name: "Maya Rivera",
    email: "maya@example.demo",
    phone: "+1-555-0199",
    github_links: ["https://github.com/mayarivera"],
    portfolio_links: [],
  },
  projects: [
    { title: "Distributed Task Queue", description: "Async task queue in Python and Redis." },
    { title: "Real-time Metrics Dashboard", description: "Telemetry dashboard using React and FastAPI." },
  ],
  certifications: [{ name: "AWS Certified Developer", detail: "Amazon Web Services" }],
  achievements: [{ title: "Hackathon Winner", detail: "1st place in Regional Cloud Hackathon" }],
  explicit_technical_skills: ["Python", "FastAPI", "React", "PostgreSQL", "Docker", "Redis", "TypeScript", "Kubernetes", "GraphQL"],
};

const completedResume: ResumeDocument = {
  id: "resume-uuid-1",
  original_filename: "maya-rivera-resume.pdf",
  mime_type: "application/pdf",
  size_bytes: 45056,
  checksum: "a".repeat(64),
  parse_status: "completed",
  parser_version: "v1-deterministic",
  uploaded_at: "2026-01-01T00:00:00Z",
  parsed_at: "2026-01-01T00:01:00Z",
  is_active: true,
  safe_error_message: null,
  parsed_summary: mockParsedSummary,
  generated_evidence_count: 3,
  skills_status: "ready",
};

describe("ResumeIntelligence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty state with drag-and-drop zone and no parse/activate buttons", async () => {
    vi.spyOn(api, "resumes").mockResolvedValue({ page: 1, page_size: 20, total: 0, items: [] });
    render(<ResumeIntelligence token="token" onChanged={vi.fn()} />);

    expect(await screen.findByText(/Drag & drop your resume here/i)).toBeInTheDocument();
    expect(screen.getByText(/Turn your resume into evidence-backed skills/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^parse$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^activate$/i })).not.toBeInTheDocument();
  });

  it("automatically orchestrates upload -> parse -> activate on file selection", async () => {
    const uploadedResume: ResumeDocument = {
      ...completedResume,
      parse_status: "uploaded",
      parsed_summary: null,
    };
    const parsedResume: ResumeDocument = {
      ...completedResume,
      parse_status: "parsed",
    };

    vi.spyOn(api, "resumes").mockResolvedValue({ page: 1, page_size: 20, total: 0, items: [] });
    vi.spyOn(api, "uploadResume").mockResolvedValue(uploadedResume);
    vi.spyOn(api, "parseResume").mockResolvedValue(parsedResume);
    vi.spyOn(api, "activateResume").mockResolvedValue(completedResume);

    const onChanged = vi.fn();
    render(<ResumeIntelligence token="token" onChanged={onChanged} />);

    await screen.findByText(/Drag & drop your resume here/i);

    const file = new File(["test resume content"], "maya-resume.pdf", { type: "application/pdf" });
    const fileInput = screen.getByLabelText("Resume file");

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(api.uploadResume).toHaveBeenCalledWith(file, "token");
      expect(api.parseResume).toHaveBeenCalledWith(uploadedResume.id, "token");
      expect(api.activateResume).toHaveBeenCalledWith(uploadedResume.id, "token");
      expect(onChanged).toHaveBeenCalled();
    });
  });

  it("renders structured categorized skill chips and metrics without comma-separated text wall", async () => {
    vi.spyOn(api, "resumes").mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      items: [completedResume],
    });

    render(<ResumeIntelligence token="token" onChanged={vi.fn()} />);

    // Check header and active badge
    expect(await screen.findByText("Active Resume")).toBeInTheDocument();
    expect(screen.getByText("maya-rivera-resume.pdf")).toBeInTheDocument();

    // Check real metrics from backend
    expect(screen.getByText("9")).toBeInTheDocument(); // 9 skills extracted
    expect(screen.getByText("3")).toBeInTheDocument(); // 3 evidence records

    // Check structured skill chips (not comma-separated)
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("FastAPI")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();

    // Verify comma-separated paragraph is NOT present
    expect(screen.queryByText(/Skills: Python, FastAPI/i)).not.toBeInTheDocument();

    // Verify manual Parse and Activate buttons are NOT present
    expect(screen.queryByRole("button", { name: /^parse$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^activate$/i })).not.toBeInTheDocument();
  });

  it("expands categorized skill view on clicking view all skills", async () => {
    vi.spyOn(api, "resumes").mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      items: [completedResume],
    });

    render(<ResumeIntelligence token="token" onChanged={vi.fn()} />);

    // Wait for complete state to mount
    expect(await screen.findByText("Active Resume")).toBeInTheDocument();

    // Click "+1 more" or "View all (9)"
    const viewAllBtn = screen.getByText(/View all \(9\)/i);
    await act(async () => {
      fireEvent.click(viewAllBtn);
    });

    // Check category headings
    expect(screen.getByText("Languages")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Databases")).toBeInTheDocument();
  });

  it("allows replacing resume and returning to upload dropzone", async () => {
    vi.spyOn(api, "resumes").mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      items: [completedResume],
    });

    render(<ResumeIntelligence token="token" onChanged={vi.fn()} />);

    expect(await screen.findByText("Active Resume")).toBeInTheDocument();

    const replaceBtn = screen.getByRole("button", { name: /replace/i });
    await act(async () => {
      fireEvent.click(replaceBtn);
    });

    expect(screen.getByText(/Drag & drop your resume here/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancel replace/i)).toBeInTheDocument();
  });

  it("deletes active resume safely and refreshes parent state", async () => {
    vi.spyOn(api, "resumes").mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      items: [completedResume],
    });
    vi.spyOn(api, "deleteResume").mockResolvedValue(undefined as unknown as void);

    const onChanged = vi.fn();
    render(<ResumeIntelligence token="token" onChanged={onChanged} />);

    expect(await screen.findByText("Active Resume")).toBeInTheDocument();

    const deleteBtn = screen.getByTitle("Remove resume");
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(api.deleteResume).toHaveBeenCalledWith(completedResume.id, "token");
    expect(onChanged).toHaveBeenCalled();
  });

  it("handles parse failure and allows retry analysis", async () => {
    const failedResume: ResumeDocument = {
      ...completedResume,
      parse_status: "failed",
      safe_error_message: "Document structure corrupted",
      parsed_summary: null,
    };

    vi.spyOn(api, "resumes").mockResolvedValue({
      page: 1,
      page_size: 20,
      total: 1,
      items: [failedResume],
    });
    vi.spyOn(api, "parseResume").mockResolvedValue(completedResume);
    vi.spyOn(api, "activateResume").mockResolvedValue(completedResume);

    render(<ResumeIntelligence token="token" onChanged={vi.fn()} />);

    expect(await screen.findByText(/We couldn't fully analyze this resume/i)).toBeInTheDocument();
    expect(screen.getByText("Document structure corrupted")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /Retry Analysis/i });
    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(api.parseResume).toHaveBeenCalledWith(failedResume.id, "token");
  });
});
