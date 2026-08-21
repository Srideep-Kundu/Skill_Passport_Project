"""Deterministic LinkedIn export archive parser and evidence generation."""
import csv
import hashlib
import io
import re
import unicodedata
import zipfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol
from uuid import UUID, uuid4

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import (
    Evidence,
    EvidenceType,
    ExtractionJob,
    ExtractionJobStatus,
    LinkedInImport,
    LinkedInParseStatus,
)
from app.schemas.contracts import (
    LinkedInCounts,
    LinkedInImportResponse,
    LinkedInParsedSummary,
)
from app.services.extraction_service import create_extraction_job, enqueue_extraction

LINKEDIN_PARSER_VERSION = "2026.1"
SUPPORTED_ARCHIVE_EXTENSIONS = {".zip"}
MAX_ARCHIVE_ENTRIES = 100
MAX_UNCOMPRESSED_TOTAL_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_ENTRY_COMPRESSION_RATIO = 100

PROMPT_INJECTION_PATTERN = re.compile(
    r"ignore\s+previous|system\s+prompt|follow\s+these\s+instructions|mark\s+me|give\s+me\s+100|always\s+match",
    re.IGNORECASE,
)


class LinkedInError(Exception):
    def __init__(self, message: str, unsupported: bool = False) -> None:
        super().__init__(message)
        self.message = message
        self.unsupported = unsupported


class LinkedInStorage(Protocol):
    def save(self, data: bytes, suffix: str) -> str: ...
    def read(self, key: str) -> bytes: ...
    def delete(self, key: str) -> None: ...


class LocalLinkedInStorage:
    """Managed storage for LinkedIn data export archives."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = (root or get_settings().linkedin_storage_dir).resolve()

    def _path(self, key: str) -> Path:
        if Path(key).name != key or not re.fullmatch(r"[a-f0-9-]+\.zip", key):
            raise LinkedInError("Stored LinkedIn document could not be accessed")
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise LinkedInError("Stored LinkedIn document could not be accessed")
        return path

    def save(self, data: bytes, suffix: str = ".zip") -> str:
        key = f"{uuid4()}{suffix}"
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    def read(self, key: str) -> bytes:
        try:
            return self._path(key).read_bytes()
        except OSError as error:
            raise LinkedInError("Stored LinkedIn document is unavailable") from error

    def delete(self, key: str) -> None:
        try:
            self._path(key).unlink(missing_ok=True)
        except OSError as error:
            raise LinkedInError("Stored LinkedIn document could not be deleted") from error


def _clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    normalized = unicodedata.normalize("NFKC", value)
    return re.sub(r"\s+", " ", normalized).strip()


def _is_injection(value: str) -> bool:
    return bool(PROMPT_INJECTION_PATTERN.search(value))


def validate_linkedin_upload(filename: str | None, data: bytes) -> str:
    suffix = Path(filename or "").suffix.casefold()
    if suffix not in SUPPORTED_ARCHIVE_EXTENSIONS:
        raise LinkedInError("Only LinkedIn data export archives (.zip) are supported")
    if not data:
        raise LinkedInError("The uploaded LinkedIn archive is empty")
    if len(data) > get_settings().linkedin_max_upload_bytes:
        raise LinkedInError("The uploaded archive exceeds the allowed size limit (10MB)")
    return suffix


def _inspect_and_read_csv_entries(data: bytes) -> dict[str, list[dict[str, str]]]:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except (zipfile.BadZipFile, OSError) as error:
        raise LinkedInError("The uploaded file is not a valid zip archive", unsupported=True) from error

    with archive:
        entries = archive.infolist()
        if len(entries) > MAX_ARCHIVE_ENTRIES:
            raise LinkedInError("Archive exceeds maximum entry count limit", unsupported=True)

        total_uncompressed = 0
        for entry in entries:
            name = entry.filename.replace("\\", "/")
            if name.startswith(("/", "\\")) or ".." in name.split("/"):
                raise LinkedInError("Archive contains invalid path entries", unsupported=True)
            if entry.file_size > 0 and entry.compress_size > 0 and (entry.file_size / entry.compress_size) > MAX_ENTRY_COMPRESSION_RATIO:
                raise LinkedInError("Archive contains highly compressed entries (potential zip bomb)", unsupported=True)
            total_uncompressed += entry.file_size
            if total_uncompressed > MAX_UNCOMPRESSED_TOTAL_BYTES:
                raise LinkedInError("Archive exceeds uncompressed size limit", unsupported=True)

        csv_data: dict[str, list[dict[str, str]]] = {}
        for entry in entries:
            if entry.is_dir():
                continue
            path_obj = Path(entry.filename)
            if path_obj.suffix.casefold() != ".csv":
                continue
            base_category = path_obj.stem.casefold()
            try:
                raw_bytes = archive.read(entry)
            except Exception as error:
                raise LinkedInError(f"Could not read entry {entry.filename}", unsupported=True) from error

            # Try utf-8-sig first, then utf-8, then latin-1 fallback
            for encoding in ("utf-8-sig", "utf-8", "latin-1"):
                try:
                    text = raw_bytes.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            else:
                text = raw_bytes.decode("utf-8", errors="replace")

            reader = csv.DictReader(io.StringIO(text))
            if not reader.fieldnames:
                continue

            cleaned_fieldnames = {_clean_text(col).casefold(): col for col in reader.fieldnames if col}
            rows: list[dict[str, str]] = []
            for row in reader:
                cleaned_row: dict[str, str] = {}
                for clean_name, orig_col in cleaned_fieldnames.items():
                    val = row.get(orig_col) or ""
                    cleaned_row[clean_name] = _clean_text(val)
                if any(cleaned_row.values()):
                    rows.append(cleaned_row)

            csv_data[base_category] = rows

    if not csv_data:
        raise LinkedInError("No recognized CSV data files found in the LinkedIn archive", unsupported=True)

    return csv_data


@dataclass(frozen=True)
class LinkedInEvidenceClaim:
    category: str
    evidence_type: EvidenceType
    title: str
    description: str
    source_span: str
    external_url: str | None = None


def _get_val(row: dict[str, str], *keys: str) -> str:
    for key in keys:
        for row_key, row_val in row.items():
            if key in row_key:
                return row_val
    return ""


def parse_linkedin_archive(data: bytes) -> tuple[dict[str, Any], list[LinkedInEvidenceClaim]]:
    csv_data = _inspect_and_read_csv_entries(data)
    claims: list[LinkedInEvidenceClaim] = []
    counts = LinkedInCounts()
    discovered_skills: set[str] = set()

    # 1. Positions / Experience
    for cat_key in ("positions", "experience"):
        if cat_key in csv_data:
            for row in csv_data[cat_key]:
                company = _get_val(row, "company", "organization")
                title = _get_val(row, "title", "role", "position")
                desc = _get_val(row, "description", "summary")
                location = _get_val(row, "location")
                started = _get_val(row, "started on", "start date", "from")
                finished = _get_val(row, "finished on", "end date", "to")

                if desc and _is_injection(desc):
                    desc = ""
                if not title and not company:
                    continue
                counts.positions += 1
                header_title = f"{title} at {company}" if (title and company) else (title or company)
                span_parts = [f"Role: {header_title}"]
                if location:
                    span_parts.append(f"Location: {location}")
                if started or finished:
                    span_parts.append(f"Period: {started or 'N/A'} - {finished or 'Present'}")
                if desc:
                    span_parts.append(f"Description: {desc}")

                full_span = "\n".join(span_parts)
                claims.append(
                    LinkedInEvidenceClaim(
                        category="positions",
                        evidence_type=EvidenceType.project,
                        title=header_title[:200],
                        description=(desc or header_title)[:4000],
                        source_span=full_span,
                    )
                )

    # 2. Projects
    if "projects" in csv_data:
        for row in csv_data["projects"]:
            title = _get_val(row, "title", "name")
            desc = _get_val(row, "description", "summary")
            url = _get_val(row, "url", "link")
            started = _get_val(row, "started on", "start date")
            finished = _get_val(row, "finished on", "end date")

            if desc and _is_injection(desc):
                desc = ""
            if not title:
                continue
            counts.projects += 1
            span_parts = [f"Project: {title}"]
            if url:
                span_parts.append(f"URL: {url}")
            if started or finished:
                span_parts.append(f"Period: {started or 'N/A'} - {finished or 'Present'}")
            if desc:
                span_parts.append(f"Description: {desc}")

            full_span = "\n".join(span_parts)
            claims.append(
                LinkedInEvidenceClaim(
                    category="projects",
                    evidence_type=EvidenceType.project,
                    title=title[:200],
                    description=(desc or title)[:4000],
                    source_span=full_span,
                    external_url=url or None,
                )
            )

    # 3. Certifications
    if "certifications" in csv_data:
        for row in csv_data["certifications"]:
            name = _get_val(row, "name", "title")
            authority = _get_val(row, "authority", "issuer", "organization")
            url = _get_val(row, "url", "link")
            license_num = _get_val(row, "license", "number", "id")

            if not name:
                continue
            counts.certifications += 1
            cert_title = f"{name} ({authority})" if authority else name
            span_parts = [f"Certification: {cert_title}"]
            if license_num:
                span_parts.append(f"License: {license_num}")
            if url:
                span_parts.append(f"URL: {url}")

            full_span = "\n".join(span_parts)
            claims.append(
                LinkedInEvidenceClaim(
                    category="certifications",
                    evidence_type=EvidenceType.certification,
                    title=cert_title[:200],
                    description=full_span[:4000],
                    source_span=full_span,
                    external_url=url or None,
                )
            )

    # 4. Skills
    if "skills" in csv_data:
        skill_names: list[str] = []
        for row in csv_data["skills"]:
            name = _get_val(row, "name", "skill")
            if name and not _is_injection(name):
                skill_names.append(name)
                discovered_skills.add(name)
        counts.skills = len(skill_names)
        if skill_names:
            skills_text = ", ".join(sorted(set(skill_names), key=str.casefold)[:100])
            claims.append(
                LinkedInEvidenceClaim(
                    category="skills",
                    evidence_type=EvidenceType.coursework,
                    title="LinkedIn Declared Skills",
                    description=f"Explicit skills listed in LinkedIn export: {skills_text}",
                    source_span=skills_text,
                )
            )

    # 5. Education
    if "education" in csv_data:
        for row in csv_data["education"]:
            school = _get_val(row, "school", "institution", "university")
            degree = _get_val(row, "degree", "qualification")
            field = _get_val(row, "field", "major", "study")
            notes = _get_val(row, "notes", "description", "activities")

            if not school and not degree:
                continue
            counts.education += 1
            edu_title = f"{degree} in {field}" if degree and field else degree or field or school
            span_parts = [f"Institution: {school}", f"Degree: {edu_title}"]
            if notes and not _is_injection(notes):
                span_parts.append(f"Details: {notes}")

            full_span = "\n".join(span_parts)
            claims.append(
                LinkedInEvidenceClaim(
                    category="education",
                    evidence_type=EvidenceType.coursework,
                    title=f"Education: {edu_title}"[:200],
                    description=full_span[:4000],
                    source_span=full_span,
                )
            )

    # 6. Courses
    if "courses" in csv_data:
        course_names: list[str] = []
        for row in csv_data["courses"]:
            name = _get_val(row, "name", "title", "course")
            number = _get_val(row, "number", "code")
            if name and not _is_injection(name):
                counts.courses += 1
                course_names.append(f"{number}: {name}" if number else name)
        if course_names:
            courses_text = "; ".join(course_names[:50])
            claims.append(
                LinkedInEvidenceClaim(
                    category="courses",
                    evidence_type=EvidenceType.coursework,
                    title="LinkedIn Completed Courses",
                    description=f"Completed courses from LinkedIn export: {courses_text}",
                    source_span=courses_text,
                )
            )

    # 7. Languages
    if "languages" in csv_data:
        lang_list: list[str] = []
        for row in csv_data["languages"]:
            name = _get_val(row, "name", "language")
            prof = _get_val(row, "proficiency", "level")
            if name:
                counts.languages += 1
                lang_list.append(f"{name} ({prof})" if prof else name)
        if lang_list:
            lang_text = ", ".join(lang_list)
            claims.append(
                LinkedInEvidenceClaim(
                    category="languages",
                    evidence_type=EvidenceType.coursework,
                    title="LinkedIn Languages",
                    description=f"Languages declared in LinkedIn export: {lang_text}",
                    source_span=lang_text,
                )
            )

    # 8. Publications
    if "publications" in csv_data:
        for row in csv_data["publications"]:
            title = _get_val(row, "title", "name")
            publisher = _get_val(row, "publisher", "journal")
            desc = _get_val(row, "description")
            url = _get_val(row, "url")
            if not title:
                continue
            counts.publications += 1
            pub_title = f"{title} ({publisher})" if publisher else title
            span_parts = [f"Publication: {pub_title}"]
            if desc and not _is_injection(desc):
                span_parts.append(f"Description: {desc}")
            full_span = "\n".join(span_parts)
            claims.append(
                LinkedInEvidenceClaim(
                    category="publications",
                    evidence_type=EvidenceType.project,
                    title=pub_title[:200],
                    description=full_span[:4000],
                    source_span=full_span,
                    external_url=url or None,
                )
            )

    # Note: Profile.csv is parsed for record counting only; personal fields (name, email, headline) are excluded from evidence.
    if "profile" in csv_data:
        pass

    summary = LinkedInParsedSummary(
        counts=counts,
        discovered_skills=sorted(discovered_skills, key=str.casefold)[:50],
        categories_present=sorted(csv_data.keys()),
        total_records=sum(len(r) for r in csv_data.values()),
    )

    return summary.model_dump(mode="json"), claims


def _source_hash(category: str, span: str) -> str:
    return hashlib.sha256(f"{category}\0{span}".encode()).hexdigest()


async def convert_linkedin_to_evidence(
    session: AsyncSession,
    document: LinkedInImport,
    claims: list[LinkedInEvidenceClaim],
) -> list[UUID]:
    created: list[UUID] = []
    for claim in claims:
        source_hash = _source_hash(claim.category, claim.source_span)
        existing = await session.scalar(
            select(Evidence.id).where(
                Evidence.linkedin_import_id == document.id,
                Evidence.linkedin_source_hash == source_hash,
            )
        )
        if existing is not None:
            continue
        evidence = Evidence(
            student_id=document.student_id,
            evidence_type=claim.evidence_type,
            title=claim.title,
            description=claim.description,
            external_url=claim.external_url,
            raw_metadata={
                "source": "linkedin_export",
                "category": claim.category,
                "source_span": claim.source_span,
            },
            linkedin_import_id=document.id,
            linkedin_category=claim.category,
            linkedin_source_hash=source_hash,
        )
        session.add(evidence)
        await session.flush()
        await create_extraction_job(session, evidence)
        created.append(evidence.id)

    await session.commit()
    for evidence_id in created:
        await enqueue_extraction(session, evidence_id)
    return created


async def parse_linkedin_document(
    session: AsyncSession,
    document: LinkedInImport,
    storage: LinkedInStorage,
) -> LinkedInImport:
    if document.parse_status == LinkedInParseStatus.unsupported:
        return document

    document.parse_status = LinkedInParseStatus.parsing
    document.safe_error_message = None
    await session.commit()

    try:
        archive_bytes = storage.read(document.storage_key)
        parsed_data, claims = parse_linkedin_archive(archive_bytes)
        document.parsed_data = parsed_data
        document.parser_version = LINKEDIN_PARSER_VERSION
        document.parsed_at = datetime.now(UTC)
        document.parse_status = LinkedInParseStatus.parsed
        await session.commit()

        await convert_linkedin_to_evidence(session, document, claims)
        document.parse_status = LinkedInParseStatus.processing_skills
        await session.commit()
    except LinkedInError as error:
        document.parse_status = (
            LinkedInParseStatus.unsupported if error.unsupported else LinkedInParseStatus.failed
        )
        document.safe_error_message = error.message
        await session.commit()
    except Exception:  # noqa: BLE001
        document.parse_status = LinkedInParseStatus.failed
        document.safe_error_message = "An unexpected error occurred while parsing the LinkedIn archive"
        await session.commit()

    return document


async def linkedin_response(
    session: AsyncSession,
    document: LinkedInImport,
) -> LinkedInImportResponse:
    generated_count = int(
        (
            await session.scalar(
                select(func.count()).select_from(Evidence).where(Evidence.linkedin_import_id == document.id)
            )
        )
        or 0
    )

    skills_status = "not_started"
    if generated_count > 0:
        job_statuses = list(
            (
                await session.scalars(
                    select(ExtractionJob.status)
                    .join(Evidence, ExtractionJob.evidence_id == Evidence.id)
                    .where(Evidence.linkedin_import_id == document.id)
                )
            ).all()
        )
        if all(s == ExtractionJobStatus.completed for s in job_statuses):
            skills_status = "completed"
        elif any(s in (ExtractionJobStatus.processing, ExtractionJobStatus.queued) for s in job_statuses):
            skills_status = "processing"
        elif any(s in (ExtractionJobStatus.failed, ExtractionJobStatus.dead_lettered) for s in job_statuses):
            skills_status = "has_failures"
        else:
            skills_status = "queued"

    parsed_summary: LinkedInParsedSummary | None = None
    if document.parsed_data:
        try:
            parsed_summary = LinkedInParsedSummary.model_validate(document.parsed_data)
        except Exception:  # noqa: BLE001
            parsed_summary = None

    return LinkedInImportResponse(
        id=document.id,
        original_filename=document.original_filename,
        mime_type=document.mime_type,
        size_bytes=document.size_bytes,
        checksum=document.checksum,
        parse_status=document.parse_status.value,
        parser_version=document.parser_version,
        uploaded_at=document.uploaded_at,
        parsed_at=document.parsed_at,
        is_active=document.is_active,
        safe_error_message=document.safe_error_message,
        parsed_summary=parsed_summary,
        generated_evidence_count=generated_count,
        skills_status=skills_status,
    )


async def activate_linkedin_import(session: AsyncSession, document: LinkedInImport) -> None:
    await session.execute(
        update(LinkedInImport)
        .where(LinkedInImport.student_id == document.student_id)
        .values(is_active=False)
    )
    document.is_active = True
    await session.commit()
