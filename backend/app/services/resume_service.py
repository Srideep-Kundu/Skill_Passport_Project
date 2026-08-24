"""Safe local resume storage, deterministic text extraction, and evidence conversion."""
import hashlib
import io
import re
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol
from uuid import UUID, uuid4

from docx import Document
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import (
    Evidence,
    EvidenceType,
    ExtractionJob,
    ExtractionJobStatus,
    ResumeDocument,
    ResumeParseStatus,
)
from app.schemas.contracts import (
    AchievementEntry,
    CandidateContact,
    CertificationEntry,
    EducationEntry,
    ExperienceEntry,
    ProjectEntry,
    ResumeDocumentResponse,
    ResumeParsedData,
)
from app.services.application_service import (
    invalidate_approved_applications_for_student,
)
from app.services.extraction_service import (
    create_extraction_job,
    enqueue_extraction,
    requeue_terminal_extractions,
)

PARSER_VERSION = "v1-deterministic"
PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
SUPPORTED_DOCUMENTS = {".pdf": PDF_MIME, ".docx": DOCX_MIME}


class ResumeError(Exception):
    def __init__(self, message: str, *, unsupported: bool = False) -> None:
        super().__init__(message)
        self.message = message
        self.unsupported = unsupported


class ResumeStorage(Protocol):
    def save(self, data: bytes, suffix: str) -> str: ...
    def read(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...


class LocalResumeStorage:
    """Managed storage: keys are generated server-side and never derived from a filename."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or get_settings().resume_storage_dir).resolve()

    def _path(self, key: str) -> Path:
        if Path(key).name != key or not re.fullmatch(r"[a-f0-9-]+\.(pdf|docx)", key):
            raise ResumeError("Stored document could not be accessed")
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ResumeError("Stored document could not be accessed")
        return path

    def save(self, data: bytes, suffix: str) -> str:
        key = f"{uuid4()}{suffix}"
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def read(self, key: str) -> bytes:
        try:
            return self._path(key).read_bytes()
        except OSError as error:
            raise ResumeError("Stored document is unavailable") from error

    def delete(self, key: str) -> None:
        try:
            self._path(key).unlink(missing_ok=True)
        except OSError as error:
            raise ResumeError("Stored document could not be deleted") from error


def validate_upload(filename: str | None, mime_type: str | None, data: bytes) -> tuple[str, str]:
    suffix = Path(filename or "").suffix.casefold()
    expected_mime = SUPPORTED_DOCUMENTS.get(suffix)
    if expected_mime is None:
        raise ResumeError("Only PDF and DOCX resumes are supported")
    if mime_type != expected_mime:
        raise ResumeError("The document type does not match the uploaded file")
    if not data:
        raise ResumeError("The uploaded resume is empty")
    if len(data) > get_settings().resume_max_upload_bytes:
        raise ResumeError("The uploaded resume exceeds the allowed size")
    return suffix, expected_mime


def extract_document_text(data: bytes, mime_type: str) -> str:
    settings = get_settings()
    try:
        if mime_type == PDF_MIME:
            reader = PdfReader(io.BytesIO(data), strict=True)
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
            if len(text.strip()) < 20:
                raise ResumeError("This PDF appears scanned or image-only. Upload a text-based PDF or DOCX.", unsupported=True)
        elif mime_type == DOCX_MIME:
            document = Document(io.BytesIO(data))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text)
        else:
            raise ResumeError("Unsupported document format")
    except ResumeError:
        raise
    except (OSError, PdfReadError, ValueError, zipfile.BadZipFile) as error:
        raise ResumeError("The uploaded document is malformed or unsupported") from error
    text = text.strip()
    if not text:
        raise ResumeError("The uploaded resume has no extractable text")
    return text[: settings.resume_max_extracted_characters]


SECTION_HEADINGS = {
    "education": "education",
    "academic background": "education",
    "qualifications": "education",
    "experience": "experience",
    "work experience": "experience",
    "professional experience": "experience",
    "employment history": "experience",
    "work history": "experience",
    "projects": "projects",
    "academic projects": "projects",
    "key projects": "projects",
    "personal projects": "projects",
    "project experience": "projects",
    "certifications": "certifications",
    "certificates": "certifications",
    "licenses & certifications": "certifications",
    "achievements": "achievements",
    "awards": "achievements",
    "honors": "achievements",
    "skills": "skills",
    "technical skills": "skills",
    "key skills": "skills",
    "core competencies": "skills",
    "skills & abilities": "skills",
    "technologies": "skills",
    "tech stack": "skills",
    "tools & technologies": "skills",
    "summary": "experience",
    "professional summary": "experience",
    "profile": "experience",
}
PROTECTED_LABELS = ("date of birth", "dob", "gender", "pronouns", "address", "religion", "caste", "ethnicity", "disability", "marital", "nationality")


def _clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lstrip("•-*– "))[:1_000]


def _title_and_detail(value: str) -> tuple[str, str]:
    parts = re.split(r"\s[-–:]\s", value, maxsplit=1)
    return parts[0][:200], (parts[1] if len(parts) > 1 else value)[:1_000]


def parse_resume_text(text: str) -> ResumeParsedData:
    """Parse section structure only; resume text is data and never executable instructions."""
    lines = [_clean_line(line) for line in text.splitlines() if _clean_line(line)]
    sections: dict[str, list[str]] = {name: [] for name in set(SECTION_HEADINGS.values())}
    current: str | None = None
    for line in lines:
        matched_inline = False
        for h_key, h_sec in SECTION_HEADINGS.items():
            pattern = rf"^{re.escape(h_key)}\s*[:–-]\s*(.*)$"
            m = re.match(pattern, line, flags=re.IGNORECASE)
            if m:
                current = h_sec
                content_after = m.group(1).strip()
                if content_after:
                    sections[current].append(content_after)
                matched_inline = True
                break
        if matched_inline:
            continue

        heading = line.rstrip(":").casefold()
        if heading in SECTION_HEADINGS and len(line) < 60:
            current = SECTION_HEADINGS[heading]
        elif current is not None:
            sections[current].append(line)
    first_lines = lines[:5]
    joined = "\n".join(lines).casefold()
    email_match = re.search(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", text, flags=re.IGNORECASE)
    phone_match = re.search(r"(?:\+?\d[\d ()-]{7,}\d)", text)
    links = re.findall(r"https?://[^\s)>]+", text, flags=re.IGNORECASE)
    github_links = sorted({link.rstrip(".,") for link in links if re.match(r"https?://(?:www\.)?github\.com/", link, re.IGNORECASE)})
    portfolio_links = sorted({link.rstrip(".,") for link in links if link not in github_links})
    name = next((line for line in first_lines if "@" not in line and not re.search(r"\d{4,}", line) and len(line) <= 100), None)
    contact = CandidateContact(name=name, email=email_match.group(0) if email_match else None, phone=phone_match.group(0) if phone_match else None, github_links=github_links, portfolio_links=portfolio_links)

    education = [EducationEntry(institution=title, detail=detail, source_span=line) for line in sections["education"] for title, detail in [_title_and_detail(line)]]
    experience = [ExperienceEntry(title=title, description=detail, source_span=line) for line in sections["experience"] for title, detail in [_title_and_detail(line)]]
    projects = [ProjectEntry(title=title, description=detail, source_span=line) for line in sections["projects"] for title, detail in [_title_and_detail(line)]]
    certifications = [CertificationEntry(name=title, detail=detail, source_span=line) for line in sections["certifications"] for title, detail in [_title_and_detail(line)]]
    achievements = [AchievementEntry(title=title, detail=detail, source_span=line) for line in sections["achievements"] for title, detail in [_title_and_detail(line)]]

    skill_tokens = [
        token.strip()[:120]
        for line in sections["skills"]
        for token in re.split(r"[,;|•]", line)
        if token.strip() and not re.search(r"ignore\s+previous|instruction|mark\s+me|expert", token, flags=re.IGNORECASE)
    ]
    return ResumeParsedData(
        contact=contact,
        education=education, experience=experience, projects=projects, certifications=certifications, achievements=achievements,
        explicit_technical_skills=sorted(set(skill_tokens), key=str.casefold)[:100],
        prohibited_attribute_labels=[label for label in PROTECTED_LABELS if label in joined],
    )


def _source_hash(section: str, span: str) -> str:
    return hashlib.sha256(f"{section}\0{span}".encode()).hexdigest()


def _looks_like_instruction(value: str) -> bool:
    return bool(re.search(r"ignore\s+previous|system\s+prompt|follow\s+these\s+instructions|mark\s+me", value, flags=re.IGNORECASE))


@dataclass(frozen=True)
class EvidenceClaim:
    section: str
    evidence_type: EvidenceType
    title: str
    description: str
    source_span: str


def claims_from_parsed(parsed: ResumeParsedData, full_text: str = "") -> list[EvidenceClaim]:
    claims: list[EvidenceClaim] = []
    # 1. Primary technical skills claim (all explicit skills in 1 immediate job)
    if parsed.explicit_technical_skills:
        skills = ", ".join(parsed.explicit_technical_skills)
        claims.append(EvidenceClaim("skills", EvidenceType.coursework, "Resume Technical Skills", f"Explicit technical skills listed in resume: {skills}", skills))

    # 2. Key projects (top 4 high-impact project records)
    for item in parsed.projects[:4]:
        if not _looks_like_instruction(item.source_span):
            claims.append(EvidenceClaim("projects", EvidenceType.project, item.title, item.description, item.source_span))

    # 3. Work experience (top 3 key experience records)
    for item in parsed.experience[:3]:
        if not _looks_like_instruction(item.source_span):
            claims.append(EvidenceClaim("experience", EvidenceType.project, item.title, item.description, item.source_span))

    # 4. Certifications & Achievements (top 2 each)
    for item in parsed.certifications[:2]:
        if not _looks_like_instruction(item.source_span):
            claims.append(EvidenceClaim("certifications", EvidenceType.certification, item.name, item.detail, item.source_span))
    for item in parsed.achievements[:2]:
        if not _looks_like_instruction(item.source_span):
            claims.append(EvidenceClaim("achievements", EvidenceType.competition, item.title, item.detail, item.source_span))

    # Fallback claim if nothing parsed
    if not claims and full_text.strip():
        claims.append(EvidenceClaim("resume", EvidenceType.project, "Resume Technical Overview", full_text[:4000], full_text[:1000]))
    return claims


async def convert_resume_to_evidence(session: AsyncSession, document: ResumeDocument, parsed: ResumeParsedData, full_text: str = "") -> list[UUID]:
    created: list[UUID] = []
    for claim in claims_from_parsed(parsed, full_text):
        source_hash = _source_hash(claim.section, claim.source_span)
        existing = await session.scalar(select(Evidence.id).where(Evidence.resume_document_id == document.id, Evidence.resume_source_hash == source_hash))
        if existing is not None:
            continue
        evidence = Evidence(student_id=document.student_id, evidence_type=claim.evidence_type, title=claim.title, description=claim.description, raw_metadata={"resume_section": claim.section, "source_span": claim.source_span}, resume_document_id=document.id, resume_section=claim.section, resume_source_hash=source_hash)
        session.add(evidence)
        await session.flush()
        await create_extraction_job(session, evidence)
        created.append(evidence.id)
    await session.commit()
    for evidence_id in created:
        await enqueue_extraction(session, evidence_id)
    return created


async def parse_resume_document(session: AsyncSession, document: ResumeDocument, storage: ResumeStorage) -> ResumeDocument:
    if document.parse_status == ResumeParseStatus.unsupported:
        return document
    document.parse_status = ResumeParseStatus.parsing
    document.safe_error_message = None
    await session.commit()
    try:
        text = extract_document_text(storage.read(document.storage_key), document.mime_type)
        parsed = parse_resume_text(text)
        document.extracted_text = text
        document.parsed_data = parsed.model_dump(mode="json")
        document.parser_version = PARSER_VERSION
        document.parsed_at = datetime.now(UTC)
        document.parse_status = ResumeParseStatus.parsed
        await session.commit()
        await convert_resume_to_evidence(session, document, parsed, text)
        document.parse_status = ResumeParseStatus.processing_skills
        await session.commit()
    except ResumeError as error:
        document.parse_status = ResumeParseStatus.unsupported if error.unsupported else ResumeParseStatus.failed
        document.safe_error_message = error.message
        await session.commit()
    return document


async def resume_response(session: AsyncSession, document: ResumeDocument) -> ResumeDocumentResponse:
    evidence_ids = select(Evidence.id).where(Evidence.resume_document_id == document.id)
    generated_count = int((await session.scalar(select(func.count()).select_from(Evidence).where(Evidence.resume_document_id == document.id))) or 0)
    job_statuses = list((await session.scalars(select(ExtractionJob.status).where(ExtractionJob.evidence_id.in_(evidence_ids)))).all())
    completed_jobs = sum(status == ExtractionJobStatus.completed for status in job_statuses)
    failed_jobs = sum(
        status in {ExtractionJobStatus.failed, ExtractionJobStatus.dead_lettered}
        for status in job_statuses
    )
    pending_jobs = len(job_statuses) - completed_jobs - failed_jobs
    if not job_statuses:
        skills_status = "ready" if document.parse_status in {ResumeParseStatus.parsed, ResumeParseStatus.completed} else "not_started"
    elif pending_jobs:
        skills_status = "processing"
    elif failed_jobs and completed_jobs:
        skills_status = "partial_failure"
    elif failed_jobs:
        skills_status = "failed"
    else:
        skills_status = "ready"
    if (document.parse_status in {ResumeParseStatus.processing_skills, ResumeParseStatus.parsed}) and skills_status in {"ready", "completed"}:
        document.parse_status = ResumeParseStatus.completed
        await session.commit()
    parsed = ResumeParsedData.model_validate(document.parsed_data) if document.parsed_data else None
    return ResumeDocumentResponse(id=document.id, original_filename=document.original_filename, mime_type=document.mime_type, size_bytes=document.size_bytes, checksum=document.checksum, parse_status=document.parse_status.value, parser_version=document.parser_version, uploaded_at=document.uploaded_at, parsed_at=document.parsed_at, is_active=document.is_active, safe_error_message=document.safe_error_message, parsed_summary=parsed, generated_evidence_count=generated_count, skills_status=skills_status, completed_jobs=completed_jobs, failed_jobs=failed_jobs, pending_jobs=pending_jobs, total_jobs=len(job_statuses))


async def retry_failed_resume_extractions(
    session: AsyncSession, document: ResumeDocument
) -> int:
    rows = (
        await session.execute(
            select(Evidence.id, ExtractionJob.status)
            .join(ExtractionJob, ExtractionJob.evidence_id == Evidence.id)
            .where(Evidence.resume_document_id == document.id)
        )
    ).all()
    active_statuses = {
        ExtractionJobStatus.pending,
        ExtractionJobStatus.queued,
        ExtractionJobStatus.processing,
        ExtractionJobStatus.retry_scheduled,
    }
    if any(job_status in active_statuses for _, job_status in rows):
        raise ResumeError("Resume extraction is already in progress")
    failed_ids = [
        evidence_id
        for evidence_id, job_status in rows
        if job_status
        in {ExtractionJobStatus.failed, ExtractionJobStatus.dead_lettered}
    ]
    if not failed_ids:
        raise ResumeError("This resume has no failed evidence to retry")
    requeued = await requeue_terminal_extractions(session, failed_ids)
    if not requeued:
        raise ResumeError("Resume extraction is already in progress")
    return requeued


async def activate_resume(session: AsyncSession, document: ResumeDocument) -> None:
    current_id = await session.scalar(
        select(ResumeDocument.id).where(
            ResumeDocument.student_id == document.student_id,
            ResumeDocument.is_active.is_(True),
        )
    )
    if current_id == document.id:
        return
    await session.execute(update(ResumeDocument).where(ResumeDocument.student_id == document.student_id).values(is_active=False))
    document.is_active = True
    await invalidate_approved_applications_for_student(session, document.student_id)
    await session.commit()
