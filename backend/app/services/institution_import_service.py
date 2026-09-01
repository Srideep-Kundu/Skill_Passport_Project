"""Governed, tenant-safe institution CSV ingestion workflows."""

from __future__ import annotations

import csv
import hashlib
import io
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import PurePath
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    AuditLog,
    CourseEnrollment,
    Evidence,
    EvidenceType,
    ExtractionStatus,
    Institution,
    InstitutionImportBatch,
    InstitutionMapping,
    LearningCourse,
    PlacementDrive,
    PlacementRegistration,
    PlacementRequirement,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)
from app.schemas.contracts import (
    InstitutionImportBatchResponse,
    InstitutionImportPreview,
    InstitutionImportRowError,
    InstitutionMappingCreate,
    InstitutionMappingResponse,
    InstitutionMappingUpdate,
)

MAX_IMPORT_BYTES = 1024 * 1024
MAX_IMPORT_ROWS = 5000
MAX_ROW_CHARACTERS = 10_000
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
FORMULA_PREFIXES = ("=", "+", "-", "@")
MAPPING_TYPES = {
    "department",
    "course",
    "cohort",
    "external_program",
    "skill",
    "trusted_provider",
}
PROVIDER_STATES = {"unavailable", "configured", "fixture/test", "degraded"}
PLACEMENT_STATUSES = {"draft", "published", "active", "upcoming", "closed"}
REGISTRATION_STATUSES = {
    "registered",
    "applied",
    "shortlisted",
    "interview",
    "interview_scheduled",
    "interviewed",
    "offered",
    "offer",
    "accepted",
    "hired",
    "rejected",
    "withdrawn",
}
TIER_ORDER = {
    VerificationTier.unverified: 0,
    VerificationTier.partially_verified: 1,
    VerificationTier.verified: 2,
}


class ImportValidationError(ValueError):
    """The submitted import cannot be processed safely."""


class ImportNotFoundError(ValueError):
    """The requested tenant-owned import resource does not exist."""


@dataclass(frozen=True)
class ParsedCsv:
    checksum: str
    rows: list[dict[str, str]]


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _key(value: str) -> str:
    return " ".join(value.strip().casefold().split())


def parse_csv_upload(
    filename: str | None,
    content_type: str | None,
    content: bytes,
    required_headers: set[str],
) -> ParsedCsv:
    supplied_name = filename or ""
    if (
        not supplied_name
        or PurePath(supplied_name).name != supplied_name
        or "/" in supplied_name
        or "\\" in supplied_name
        or not supplied_name.casefold().endswith(".csv")
    ):
        raise ImportValidationError("A plain .csv filename is required")
    if content_type and content_type.casefold() not in {
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "application/octet-stream",
    }:
        raise ImportValidationError("Only CSV uploads are supported")
    if not content or len(content) > MAX_IMPORT_BYTES:
        raise ImportValidationError("CSV must be non-empty and no larger than 1 MiB")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ImportValidationError("CSV must use UTF-8 encoding") from exc
    if "\x00" in text:
        raise ImportValidationError("CSV contains invalid binary content")
    reader = csv.DictReader(io.StringIO(text, newline=""))
    headers = {_key(value) for value in (reader.fieldnames or []) if value}
    missing = sorted(required_headers - headers)
    if missing:
        raise ImportValidationError(f"Missing required headers: {', '.join(missing)}")
    rows: list[dict[str, str]] = []
    for index, raw in enumerate(reader, start=2):
        if index - 1 > MAX_IMPORT_ROWS:
            raise ImportValidationError("CSV exceeds the 5,000 row limit")
        normalized = {_key(str(key)): _clean(value) for key, value in raw.items() if key}
        if sum(len(value) for value in normalized.values()) > MAX_ROW_CHARACTERS:
            raise ImportValidationError(f"Row {index} exceeds the safe size limit")
        if any(value.startswith(FORMULA_PREFIXES) for value in normalized.values()):
            raise ImportValidationError(f"Row {index} contains a spreadsheet formula")
        rows.append(normalized)
    return ParsedCsv(checksum=hashlib.sha256(content).hexdigest(), rows=rows)


async def _mapping_map(
    session: AsyncSession, institution_id: UUID, mapping_type: str
) -> dict[str, str]:
    rows = list(
        (
            await session.scalars(
                select(InstitutionMapping).where(
                    InstitutionMapping.institution_id == institution_id,
                    InstitutionMapping.mapping_type == mapping_type,
                )
            )
        ).all()
    )
    return {_key(row.external_key): row.canonical_value for row in rows}


def _row_error(row: int, code: str, message: str) -> InstitutionImportRowError:
    return InstitutionImportRowError(row=row, code=code, message=message)


async def preview_students(
    session: AsyncSession,
    institution: Institution,
    parsed: ParsedCsv,
) -> InstitutionImportPreview:
    departments = await _mapping_map(session, institution.id, "department")
    cohorts = await _mapping_map(session, institution.id, "cohort")
    institution_departments = {_key(value): value for value in institution.departments}
    errors: list[InstitutionImportRowError] = []
    warnings: set[str] = set()
    creates = updates = skips = 0
    seen_emails: set[str] = set()
    seen_rolls: set[str] = set()
    for offset, row in enumerate(parsed.rows, start=2):
        email = _key(row.get("email", ""))
        roll = _clean(row.get("roll_number"))
        name = _clean(row.get("full_name"))
        department_key = _key(row.get("department", ""))
        cohort_raw = _clean(row.get("cohort_year"))
        row_errors: list[InstitutionImportRowError] = []
        if not name:
            row_errors.append(_row_error(offset, "missing_name", "Full name is required"))
        if not email or not EMAIL_PATTERN.fullmatch(email):
            row_errors.append(_row_error(offset, "invalid_email", "A valid email is required"))
        if not roll:
            row_errors.append(_row_error(offset, "missing_roll_number", "Roll number is required"))
        if email in seen_emails or (roll and _key(roll) in seen_rolls):
            row_errors.append(_row_error(offset, "duplicate_row", "Duplicate email or roll number in file"))
        seen_emails.add(email)
        seen_rolls.add(_key(roll))
        department = departments.get(department_key) or institution_departments.get(department_key)
        if not department:
            row_errors.append(_row_error(offset, "unresolved_department", "Department mapping is required"))
            if department_key:
                warnings.add(f"Map department '{row.get('department', '')}'")
        cohort_value = cohorts.get(_key(cohort_raw), cohort_raw)
        try:
            cohort_year = int(cohort_value)
            if not 2000 <= cohort_year <= 2200:
                raise ValueError
        except ValueError:
            row_errors.append(_row_error(offset, "invalid_cohort", "Cohort must map to a valid year"))
        existing_email = await session.scalar(select(Student).where(Student.email == email)) if email else None
        existing_roll = (
            await session.scalar(
                select(Student).where(
                    Student.institution_id == institution.id,
                    Student.roll_number == roll,
                )
            )
            if roll
            else None
        )
        if existing_email is not None and existing_email.institution_id not in {None, institution.id}:
            row_errors.append(_row_error(offset, "cross_tenant_conflict", "Email belongs to another institution"))
        if (
            existing_email is not None
            and existing_email.institution_id is None
            and existing_email.account_status == "active"
        ):
            row_errors.append(
                _row_error(
                    offset,
                    "account_consent_required",
                    "An existing independent account must accept institution membership",
                )
            )
        if existing_email is not None and existing_roll is not None and existing_email.id != existing_roll.id:
            row_errors.append(_row_error(offset, "identity_conflict", "Email and roll number identify different students"))
        if row_errors:
            errors.extend(row_errors)
            skips += 1
        elif existing_email is not None or existing_roll is not None:
            updates += 1
        else:
            creates += 1
    return InstitutionImportPreview(
        import_type="students",
        checksum=parsed.checksum,
        total_rows=len(parsed.rows),
        valid_rows=creates + updates,
        invalid_rows=skips,
        proposed_creates=creates,
        proposed_updates=updates,
        proposed_skips=skips,
        errors=errors[:200],
        mapping_warnings=sorted(warnings),
    )


def _batch_response(batch: InstitutionImportBatch) -> InstitutionImportBatchResponse:
    return InstitutionImportBatchResponse.model_validate(batch)


async def _existing_batch(
    session: AsyncSession, institution_id: UUID, import_type: str, checksum: str
) -> InstitutionImportBatch | None:
    return await session.scalar(
        select(InstitutionImportBatch).where(
            InstitutionImportBatch.institution_id == institution_id,
            InstitutionImportBatch.import_type == import_type,
            InstitutionImportBatch.checksum == checksum,
        )
    )


def _new_batch(
    institution_id: UUID,
    import_type: str,
    preview: InstitutionImportPreview,
) -> InstitutionImportBatch:
    return InstitutionImportBatch(
        institution_id=institution_id,
        import_type=import_type,
        checksum=preview.checksum,
        status="processing",
        total_rows=preview.total_rows,
        valid_rows=preview.valid_rows,
        invalid_rows=preview.invalid_rows,
        skipped_rows=preview.proposed_skips,
        safe_error_summary=[item.model_dump(mode="json") for item in preview.errors],
        created_by=institution_id,
    )


async def import_students(
    session: AsyncSession,
    institution: Institution,
    parsed: ParsedCsv,
    confirmed_checksum: str,
) -> InstitutionImportBatchResponse:
    if not secrets.compare_digest(parsed.checksum, confirmed_checksum):
        raise ImportValidationError("Confirmed checksum does not match the dry run")
    existing_batch = await _existing_batch(session, institution.id, "students", parsed.checksum)
    if existing_batch is not None:
        return _batch_response(existing_batch)
    preview = await preview_students(session, institution, parsed)
    batch = _new_batch(institution.id, "students", preview)
    session.add(batch)
    department_map = await _mapping_map(session, institution.id, "department")
    cohort_map = await _mapping_map(session, institution.id, "cohort")
    institution_departments = {_key(value): value for value in institution.departments}
    invalid_rows = {item.row for item in preview.errors}
    created = updated = 0
    for offset, row in enumerate(parsed.rows, start=2):
        if offset in invalid_rows:
            continue
        email = _key(row["email"])
        roll = _clean(row["roll_number"])
        student = await session.scalar(
            select(Student).where(
                or_(
                    Student.email == email,
                    (Student.institution_id == institution.id) & (Student.roll_number == roll),
                )
            )
        )
        department_key = _key(row["department"])
        department = department_map.get(department_key) or institution_departments[department_key]
        cohort = int(cohort_map.get(_key(row["cohort_year"]), row["cohort_year"]))
        if student is None:
            student = Student(
                email=email,
                full_name=_clean(row["full_name"]),
                password_hash=hash_password(secrets.token_urlsafe(48)),
                account_status="pending_invite",
                institution_id=institution.id,
                university=institution.institution_name,
                department=department,
                cohort_year=cohort,
                graduation_year=cohort,
                roll_number=roll,
                career_goals={"department": department, "passing_year": cohort},
            )
            session.add(student)
            created += 1
        else:
            if student.institution_id is None:
                student.institution_id = institution.id
            student.full_name = _clean(row["full_name"])
            student.department = department
            student.cohort_year = cohort
            student.graduation_year = student.graduation_year or cohort
            student.roll_number = roll
            student.university = student.university or institution.institution_name
            updated += 1
    batch.created_rows = created
    batch.updated_rows = updated
    batch.status = "completed"
    batch.completed_at = datetime.now(UTC)
    session.add(
        AuditLog(
            actor_id=institution.id,
            action="institution_students_imported",
            entity_type="institution_import_batch",
            entity_id=batch.id,
            details={
                "checksum": batch.checksum,
                "created": created,
                "updated": updated,
                "invalid": batch.invalid_rows,
            },
        )
    )
    await session.commit()
    await session.refresh(batch)
    return _batch_response(batch)


async def list_mappings(
    session: AsyncSession, institution_id: UUID, mapping_type: str | None = None
) -> list[InstitutionMappingResponse]:
    stmt = select(InstitutionMapping).where(InstitutionMapping.institution_id == institution_id)
    if mapping_type:
        stmt = stmt.where(InstitutionMapping.mapping_type == mapping_type)
    rows = list((await session.scalars(stmt.order_by(InstitutionMapping.mapping_type, InstitutionMapping.external_key))).all())
    return [InstitutionMappingResponse.model_validate(row) for row in rows]


async def create_mapping(
    session: AsyncSession, institution: Institution, payload: InstitutionMappingCreate
) -> InstitutionMappingResponse:
    external_key = _clean(payload.external_key)
    canonical = await _validate_mapping_value(
        session, payload.mapping_type, payload.canonical_value
    )
    existing = await session.scalar(
        select(InstitutionMapping).where(
            InstitutionMapping.institution_id == institution.id,
            InstitutionMapping.mapping_type == payload.mapping_type,
            func.lower(InstitutionMapping.external_key) == external_key.casefold(),
        )
    )
    if existing is not None:
        raise ImportValidationError("Mapping already exists")
    mapping = InstitutionMapping(
        institution_id=institution.id,
        mapping_type=payload.mapping_type,
        external_key=external_key,
        canonical_value=canonical,
    )
    session.add(mapping)
    await session.commit()
    await session.refresh(mapping)
    return InstitutionMappingResponse.model_validate(mapping)


async def _validate_mapping_value(
    session: AsyncSession, mapping_type: str, supplied_value: str
) -> str:
    canonical = _clean(supplied_value)
    if mapping_type == "course":
        try:
            course_id = UUID(canonical)
        except ValueError as exc:
            raise ImportValidationError("Course mapping must reference a course UUID") from exc
        if await session.get(LearningCourse, course_id) is None:
            raise ImportValidationError("Mapped course does not exist")
    elif mapping_type == "skill":
        skill = await session.scalar(
            select(Skill).where(func.lower(Skill.canonical_name) == canonical.casefold())
        )
        if skill is None:
            raise ImportValidationError("Mapped skill is outside the canonical taxonomy")
        canonical = skill.canonical_name
    elif mapping_type == "cohort":
        try:
            year = int(canonical)
            if not 2000 <= year <= 2200:
                raise ValueError
        except ValueError as exc:
            raise ImportValidationError("Cohort mapping must be a valid year") from exc
        canonical = str(year)
    elif mapping_type == "trusted_provider":
        if canonical not in PROVIDER_STATES:
            raise ImportValidationError("Provider status must be truthful and supported")
    return canonical


async def update_mapping(
    session: AsyncSession,
    institution: Institution,
    mapping_id: UUID,
    payload: InstitutionMappingUpdate,
) -> InstitutionMappingResponse:
    mapping = await session.get(InstitutionMapping, mapping_id)
    if mapping is None or mapping.institution_id != institution.id:
        raise ImportNotFoundError("Mapping not found")
    mapping.canonical_value = await _validate_mapping_value(
        session, mapping.mapping_type, payload.canonical_value
    )
    await session.commit()
    await session.refresh(mapping)
    return InstitutionMappingResponse.model_validate(mapping)


async def delete_mapping(
    session: AsyncSession, institution_id: UUID, mapping_id: UUID
) -> None:
    mapping = await session.get(InstitutionMapping, mapping_id)
    if mapping is None or mapping.institution_id != institution_id:
        raise ImportNotFoundError("Mapping not found")
    await session.delete(mapping)
    await session.commit()


async def _skill_for_name(
    session: AsyncSession, institution_id: UUID, supplied: str
) -> Skill | None:
    skill_map = await _mapping_map(session, institution_id, "skill")
    canonical = skill_map.get(_key(supplied), supplied)
    return await session.scalar(
        select(Skill).where(func.lower(Skill.canonical_name) == canonical.casefold())
    )


def _split_skills(value: str) -> list[str]:
    return list(dict.fromkeys(part.strip() for part in re.split(r"[|;]", value) if part.strip()))


async def preview_placements(
    session: AsyncSession, institution: Institution, parsed: ParsedCsv
) -> InstitutionImportPreview:
    errors: list[InstitutionImportRowError] = []
    warnings: set[str] = set()
    creates = updates = skips = 0
    seen: set[tuple[str, str, str]] = set()
    for offset, row in enumerate(parsed.rows, start=2):
        source = _clean(row.get("external_source"))
        external_id = _clean(row.get("external_id"))
        identity = (
            _key(source),
            _key(external_id),
            _key(row.get("registration_external_id", "")),
        )
        row_errors: list[InstitutionImportRowError] = []
        if not source or not external_id or not _clean(row.get("company_name")) or not _clean(row.get("title")):
            row_errors.append(_row_error(offset, "missing_required_field", "Placement identity, company, and title are required"))
        if identity in seen:
            row_errors.append(_row_error(offset, "duplicate_row", "Duplicate placement row"))
        seen.add(identity)
        try:
            datetime.fromisoformat(_clean(row.get("drive_date")).replace("Z", "+00:00"))
        except ValueError:
            row_errors.append(_row_error(offset, "invalid_drive_date", "Drive date must be ISO-8601"))
        if (_clean(row.get("status")) or "upcoming") not in PLACEMENT_STATUSES:
            row_errors.append(_row_error(offset, "invalid_status", "Placement status is invalid"))
        for name in _split_skills(row.get("required_skills", "")):
            if await _skill_for_name(session, institution.id, name) is None:
                row_errors.append(_row_error(offset, "unresolved_skill", f"Skill '{name}' is not mapped to the canonical taxonomy"))
                warnings.add(f"Map skill '{name}'")
        roll = _clean(row.get("student_roll_number"))
        if roll and await session.scalar(
            select(Student.id).where(
                Student.institution_id == institution.id,
                Student.roll_number == roll,
            )
        ) is None:
            row_errors.append(_row_error(offset, "student_not_found", "Student roll number is not owned by this institution"))
        if roll and (_clean(row.get("registration_status")) or "registered") not in REGISTRATION_STATUSES:
            row_errors.append(_row_error(offset, "invalid_registration_status", "Registration status is invalid"))
        if row_errors:
            errors.extend(row_errors)
            skips += 1
        elif await session.scalar(
            select(PlacementDrive.id).where(
                PlacementDrive.institution_id == institution.id,
                PlacementDrive.external_source == source,
                PlacementDrive.external_id == external_id,
            )
        ):
            updates += 1
        else:
            creates += 1
    return InstitutionImportPreview(
        import_type="placements",
        checksum=parsed.checksum,
        total_rows=len(parsed.rows),
        valid_rows=creates + updates,
        invalid_rows=skips,
        proposed_creates=creates,
        proposed_updates=updates,
        proposed_skips=skips,
        errors=errors[:200],
        mapping_warnings=sorted(warnings),
    )


async def preview_learning_completions(
    session: AsyncSession, institution: Institution, parsed: ParsedCsv
) -> InstitutionImportPreview:
    course_map = await _mapping_map(session, institution.id, "course")
    provider_map = await _mapping_map(session, institution.id, "trusted_provider")
    errors: list[InstitutionImportRowError] = []
    warnings: set[str] = set()
    creates = updates = skips = 0
    seen: set[tuple[str, str]] = set()
    for offset, row in enumerate(parsed.rows, start=2):
        source = _clean(row.get("external_source"))
        external_id = _clean(row.get("external_id"))
        identity = (_key(source), _key(external_id))
        row_errors: list[InstitutionImportRowError] = []
        if not source or not external_id:
            row_errors.append(_row_error(offset, "missing_identity", "Completion source and external ID are required"))
        if identity in seen:
            row_errors.append(_row_error(offset, "duplicate_row", "Duplicate completion row"))
        seen.add(identity)
        if provider_map.get(_key(source)) not in {"configured", "fixture/test"}:
            row_errors.append(_row_error(offset, "provider_unavailable", "Provider is not configured for governed imports"))
            if source:
                warnings.add(f"Configure provider '{source}' truthfully")
        student = await session.scalar(
            select(Student).where(
                Student.institution_id == institution.id,
                Student.roll_number == _clean(row.get("student_roll_number")),
            )
        )
        if student is None:
            row_errors.append(_row_error(offset, "student_not_found", "Student roll number is not owned by this institution"))
        course_key = _key(row.get("course_external_key", ""))
        course_id_raw = course_map.get(course_key)
        course = None
        if course_id_raw:
            try:
                course = await session.get(LearningCourse, UUID(course_id_raw))
            except ValueError:
                course = None
        if course is None:
            row_errors.append(_row_error(offset, "course_not_mapped", "Course mapping is missing or invalid"))
            if course_key:
                warnings.add(f"Map course '{row.get('course_external_key', '')}'")
        if _clean(row.get("status")) not in {"completed", "verified"}:
            row_errors.append(_row_error(offset, "invalid_completion_status", "Completion status must be completed or verified"))
        if course is not None:
            canonical_count = int((await session.scalar(select(func.count(Skill.id)).where(Skill.canonical_name.in_(course.skills)))) or 0)
            if canonical_count != len(set(course.skills)):
                row_errors.append(_row_error(offset, "unresolved_skill", "Course contains a skill outside the canonical taxonomy"))
        if row_errors:
            errors.extend(row_errors)
            skips += 1
        elif student is not None and course is not None and await session.scalar(
            select(CourseEnrollment.id).where(
                CourseEnrollment.student_id == student.id,
                CourseEnrollment.course_id == course.id,
            )
        ):
            updates += 1
        else:
            creates += 1
    return InstitutionImportPreview(
        import_type="learning_completion",
        checksum=parsed.checksum,
        total_rows=len(parsed.rows),
        valid_rows=creates + updates,
        invalid_rows=skips,
        proposed_creates=creates,
        proposed_updates=updates,
        proposed_skips=skips,
        errors=errors[:200],
        mapping_warnings=sorted(warnings),
    )


async def import_placements(
    session: AsyncSession,
    institution: Institution,
    parsed: ParsedCsv,
    confirmed_checksum: str,
) -> InstitutionImportBatchResponse:
    if not secrets.compare_digest(parsed.checksum, confirmed_checksum):
        raise ImportValidationError("Confirmed checksum does not match the selected file")
    existing = await _existing_batch(session, institution.id, "placements", parsed.checksum)
    if existing:
        return _batch_response(existing)
    errors: list[InstitutionImportRowError] = []
    valid: list[tuple[int, dict[str, str], list[Skill], Student | None]] = []
    seen: set[tuple[str, str, str]] = set()
    for offset, row in enumerate(parsed.rows, start=2):
        source, external_id = _clean(row.get("external_source")), _clean(row.get("external_id"))
        registration_id = _clean(row.get("registration_external_id"))
        identity = (_key(source), _key(external_id), _key(registration_id))
        row_errors: list[InstitutionImportRowError] = []
        if not source or not external_id or not _clean(row.get("company_name")) or not _clean(row.get("title")):
            row_errors.append(_row_error(offset, "missing_required_field", "Placement identity, company, and title are required"))
        if identity in seen:
            row_errors.append(_row_error(offset, "duplicate_row", "Duplicate placement row"))
        seen.add(identity)
        try:
            datetime.fromisoformat(_clean(row.get("drive_date")).replace("Z", "+00:00"))
        except ValueError:
            row_errors.append(_row_error(offset, "invalid_drive_date", "Drive date must be ISO-8601"))
        status = _clean(row.get("status")) or "upcoming"
        if status not in PLACEMENT_STATUSES:
            row_errors.append(_row_error(offset, "invalid_status", "Placement status is invalid"))
        skills: list[Skill] = []
        for name in _split_skills(row.get("required_skills", "")):
            skill = await _skill_for_name(session, institution.id, name)
            if skill is None:
                row_errors.append(_row_error(offset, "unresolved_skill", f"Skill '{name}' is not mapped to the canonical taxonomy"))
            else:
                skills.append(skill)
        roll = _clean(row.get("student_roll_number"))
        student = None
        if roll:
            student = await session.scalar(
                select(Student).where(
                    Student.institution_id == institution.id,
                    Student.roll_number == roll,
                )
            )
            if student is None:
                row_errors.append(_row_error(offset, "student_not_found", "Student roll number is not owned by this institution"))
            registration_status = _clean(row.get("registration_status")) or "registered"
            if registration_status not in REGISTRATION_STATUSES:
                row_errors.append(_row_error(offset, "invalid_registration_status", "Registration status is invalid"))
        if row_errors:
            errors.extend(row_errors)
        else:
            valid.append((offset, row, skills, student))
    preview = InstitutionImportPreview(
        import_type="placements",
        checksum=parsed.checksum,
        total_rows=len(parsed.rows),
        valid_rows=len(valid),
        invalid_rows=len(parsed.rows) - len(valid),
        proposed_creates=len(valid),
        proposed_updates=0,
        proposed_skips=len(parsed.rows) - len(valid),
        errors=errors[:200],
    )
    batch = _new_batch(institution.id, "placements", preview)
    session.add(batch)
    created = updated = 0
    for _, row, skills, student in valid:
        source, external_id = _clean(row["external_source"]), _clean(row["external_id"])
        drive = await session.scalar(
            select(PlacementDrive).where(
                PlacementDrive.institution_id == institution.id,
                PlacementDrive.external_source == source,
                PlacementDrive.external_id == external_id,
            )
        )
        is_new = drive is None
        if drive is None:
            drive = PlacementDrive(
                institution_id=institution.id,
                external_source=source,
                external_id=external_id,
                recruiter_id=None,
                company_name=_clean(row["company_name"]),
                title=_clean(row["title"]),
                description=_clean(row.get("description")) or "Institution-imported placement opportunity.",
                role_type=_clean(row.get("role_type")) or "full_time",
                ctc_lpa=float(row.get("ctc_lpa") or 0),
                eligible_departments=[],
                minimum_cgpa=float(row.get("minimum_cgpa") or 0),
                passing_year=int(row.get("passing_year") or datetime.now(UTC).year),
                drive_date=datetime.fromisoformat(_clean(row["drive_date"]).replace("Z", "+00:00")),
                status=_clean(row.get("status")) or "upcoming",
                required_skills=[skill.canonical_name for skill in skills],
            )
            session.add(drive)
            await session.flush()
        else:
            drive.company_name = _clean(row["company_name"])
            drive.title = _clean(row["title"])
            drive.description = _clean(row.get("description")) or drive.description
            drive.status = _clean(row.get("status")) or drive.status
            drive.required_skills = [skill.canonical_name for skill in skills]
        await session.execute(delete(PlacementRequirement).where(PlacementRequirement.placement_drive_id == drive.id))
        for skill in skills:
            session.add(PlacementRequirement(placement_drive_id=drive.id, skill_id=skill.id, weight=1.0, requirement_type="required"))
        if student is not None:
            registration = await session.scalar(
                select(PlacementRegistration).where(
                    PlacementRegistration.student_id == student.id,
                    PlacementRegistration.placement_drive_id == drive.id,
                )
            )
            if registration is None:
                registration = PlacementRegistration(
                    student_id=student.id,
                    placement_drive_id=drive.id,
                    institution_id=institution.id,
                    external_source=source,
                    external_id=_clean(row.get("registration_external_id")) or f"{external_id}:{student.roll_number}",
                    status=_clean(row.get("registration_status")) or "registered",
                )
                session.add(registration)
            else:
                registration.status = _clean(row.get("registration_status")) or registration.status
        if is_new:
            created += 1
        else:
            updated += 1
    batch.created_rows = created
    batch.updated_rows = updated
    batch.status = "completed"
    batch.completed_at = datetime.now(UTC)
    session.add(AuditLog(actor_id=institution.id, action="institution_placements_imported", entity_type="institution_import_batch", entity_id=batch.id, details={"checksum": batch.checksum, "created": created, "updated": updated, "invalid": batch.invalid_rows}))
    await session.commit()
    await session.refresh(batch)
    return _batch_response(batch)


async def import_learning_completions(
    session: AsyncSession,
    institution: Institution,
    parsed: ParsedCsv,
    confirmed_checksum: str,
) -> InstitutionImportBatchResponse:
    if not secrets.compare_digest(parsed.checksum, confirmed_checksum):
        raise ImportValidationError("Confirmed checksum does not match the selected file")
    existing = await _existing_batch(session, institution.id, "learning_completion", parsed.checksum)
    if existing:
        return _batch_response(existing)
    course_map = await _mapping_map(session, institution.id, "course")
    provider_map = await _mapping_map(session, institution.id, "trusted_provider")
    errors: list[InstitutionImportRowError] = []
    valid: list[tuple[dict[str, str], Student, LearningCourse, str]] = []
    seen: set[tuple[str, str]] = set()
    for offset, row in enumerate(parsed.rows, start=2):
        source, external_id = _clean(row.get("external_source")), _clean(row.get("external_id"))
        identity = (_key(source), _key(external_id))
        row_errors: list[InstitutionImportRowError] = []
        if not source or not external_id:
            row_errors.append(_row_error(offset, "missing_identity", "Completion source and external ID are required"))
        if identity in seen:
            row_errors.append(_row_error(offset, "duplicate_row", "Duplicate completion row"))
        seen.add(identity)
        provider_status = provider_map.get(_key(source))
        if provider_status not in {"configured", "fixture/test"}:
            row_errors.append(_row_error(offset, "provider_unavailable", "Provider is not configured for governed imports"))
        student = await session.scalar(
            select(Student).where(
                Student.institution_id == institution.id,
                Student.roll_number == _clean(row.get("student_roll_number")),
            )
        )
        if student is None:
            row_errors.append(_row_error(offset, "student_not_found", "Student roll number is not owned by this institution"))
        course_id_raw = course_map.get(_key(row.get("course_external_key", "")))
        course = None
        if course_id_raw:
            try:
                course = await session.get(LearningCourse, UUID(course_id_raw))
            except ValueError:
                course = None
        if course is None:
            row_errors.append(_row_error(offset, "course_not_mapped", "Course mapping is missing or invalid"))
        if _clean(row.get("status")) not in {"completed", "verified"}:
            row_errors.append(_row_error(offset, "invalid_completion_status", "Completion status must be completed or verified"))
        if course is not None:
            canonical_count = int(
                (await session.scalar(select(func.count(Skill.id)).where(Skill.canonical_name.in_(course.skills)))) or 0
            )
            if canonical_count != len(set(course.skills)):
                row_errors.append(_row_error(offset, "unresolved_skill", "Course contains a skill outside the canonical taxonomy"))
        if row_errors:
            errors.extend(row_errors)
        else:
            assert student is not None and course is not None and provider_status is not None
            valid.append((row, student, course, provider_status))
    preview = InstitutionImportPreview(
        import_type="learning_completion",
        checksum=parsed.checksum,
        total_rows=len(parsed.rows),
        valid_rows=len(valid),
        invalid_rows=len(parsed.rows) - len(valid),
        proposed_creates=len(valid),
        proposed_updates=0,
        proposed_skips=len(parsed.rows) - len(valid),
        errors=errors[:200],
    )
    batch = _new_batch(institution.id, "learning_completion", preview)
    session.add(batch)
    created = updated = 0
    for row, student, course, provider_status in valid:
        source, external_id = _clean(row["external_source"]), _clean(row["external_id"])
        enrollment = await session.scalar(
            select(CourseEnrollment).where(
                CourseEnrollment.student_id == student.id,
                CourseEnrollment.course_id == course.id,
            )
        )
        if enrollment is None:
            enrollment = CourseEnrollment(
                student_id=student.id,
                course_id=course.id,
                institution_id=institution.id,
                external_source=source,
                external_id=external_id,
            )
            session.add(enrollment)
            await session.flush()
            created += 1
        else:
            if enrollment.institution_id not in {None, institution.id}:
                continue
            enrollment.institution_id = institution.id
            enrollment.external_source = enrollment.external_source or source
            enrollment.external_id = enrollment.external_id or external_id
            updated += 1
        enrollment.status = "verified" if provider_status == "configured" else "completed"
        enrollment.progress = 100
        enrollment.completed_at = enrollment.completed_at or datetime.now(UTC)
        enrollment.completion_source = f"institution_import:{source}:{provider_status}"
        if enrollment.completion_evidence_id is None:
            tier = VerificationTier.partially_verified if provider_status == "configured" else VerificationTier.unverified
            evidence = Evidence(
                student_id=student.id,
                evidence_type=(EvidenceType.certification if course.program_type == "certification" else EvidenceType.coursework),
                title=f"Imported completion: {course.title}",
                description=f"Completion imported by {institution.institution_name} from governed source {source}.",
                raw_metadata={
                    "institution_import_batch_id": str(batch.id),
                    "course_id": str(course.id),
                    "external_source": source,
                    "external_id_hash": hashlib.sha256(external_id.encode()).hexdigest(),
                    "provider_status": provider_status,
                },
                extraction_status=ExtractionStatus.extracted,
            )
            session.add(evidence)
            await session.flush()
            enrollment.completion_evidence_id = evidence.id
            skills = list((await session.scalars(select(Skill).where(Skill.canonical_name.in_(course.skills)))).all())
            for skill in skills:
                existing_skill = await session.scalar(
                    select(StudentSkill).where(
                        StudentSkill.student_id == student.id,
                        StudentSkill.skill_id == skill.id,
                        StudentSkill.source_evidence_id == evidence.id,
                    )
                )
                if existing_skill is None:
                    session.add(StudentSkill(student_id=student.id, skill_id=skill.id, source_evidence_id=evidence.id, extraction_confidence=1.0, verification_tier=tier, proficiency_hint="Institution-imported completion", evidence_span=f"Completed {course.title}; canonical competency: {skill.canonical_name}"))
                elif TIER_ORDER[tier] > TIER_ORDER[existing_skill.verification_tier]:
                    existing_skill.verification_tier = tier
    batch.created_rows = created
    batch.updated_rows = updated
    batch.status = "completed"
    batch.completed_at = datetime.now(UTC)
    session.add(AuditLog(actor_id=institution.id, action="institution_learning_completions_imported", entity_type="institution_import_batch", entity_id=batch.id, details={"checksum": batch.checksum, "created": created, "updated": updated, "invalid": batch.invalid_rows}))
    await session.commit()
    await session.refresh(batch)
    return _batch_response(batch)


async def get_batch(
    session: AsyncSession, institution_id: UUID, batch_id: UUID
) -> InstitutionImportBatchResponse:
    batch = await session.get(InstitutionImportBatch, batch_id)
    if batch is None or batch.institution_id != institution_id:
        raise ImportNotFoundError("Import batch not found")
    return _batch_response(batch)


async def list_batches(
    session: AsyncSession, institution_id: UUID
) -> list[InstitutionImportBatchResponse]:
    rows = list(
        (
            await session.scalars(
                select(InstitutionImportBatch)
                .where(InstitutionImportBatch.institution_id == institution_id)
                .order_by(InstitutionImportBatch.created_at.desc())
            )
        ).all()
    )
    return [_batch_response(row) for row in rows]
