"""Provider-neutral SIS/ERP normalization contracts.

Adapters normalize records only. Persistence, tenant ownership, audit, and
idempotency are enforced by the institution import service.
"""

from __future__ import annotations

import csv
import io
import secrets
from collections.abc import Iterable
from typing import Protocol
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import Student


class StudentImportRecord(BaseModel):
    external_id: str = Field(min_length=1, max_length=160)
    full_name: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=320)
    department: str = Field(min_length=1, max_length=120)
    cohort_year: int = Field(ge=2000, le=2200)
    cgpa: float | None = Field(default=None, ge=0, le=10)


class PlacementImportRecord(BaseModel):
    external_source: str = Field(min_length=1, max_length=64)
    external_id: str = Field(min_length=1, max_length=160)
    company_name: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    student_external_id: str | None = Field(default=None, max_length=160)


class LearningCompletionImportRecord(BaseModel):
    external_source: str = Field(min_length=1, max_length=64)
    external_id: str = Field(min_length=1, max_length=160)
    student_external_id: str = Field(min_length=1, max_length=160)
    course_external_key: str = Field(min_length=1, max_length=160)
    status: str


class InstitutionImportAdapter(Protocol):
    """Normalized interface implemented by credentialed SIS/LMS adapters."""

    provider_name: str
    credentialed: bool

    async def students(self) -> Iterable[StudentImportRecord]: ...

    async def placements(self) -> Iterable[PlacementImportRecord]: ...

    async def learning_completions(
        self,
    ) -> Iterable[LearningCompletionImportRecord]: ...


class BatchImportSummary(BaseModel):
    """Compatibility response for the legacy internal CSV helper."""

    total_records: int
    imported_count: int
    skipped_count: int
    errors: list[str] = Field(default_factory=list)


async def import_students_csv(
    session: AsyncSession,
    csv_content: str,
    institution_id: UUID | None = None,
) -> BatchImportSummary:
    """Legacy helper retained safely; public imports use the governed API.

    Imported accounts are invitation-pending and receive an unknowable random
    bcrypt value, never a shared/default password.
    """

    reader = csv.DictReader(io.StringIO(csv_content))
    imported = 0
    skipped = 0
    errors: list[str] = []
    for index, row in enumerate(reader, start=2):
        try:
            email = (row.get("email") or "").strip().casefold()
            name = (row.get("full_name") or row.get("name") or "").strip()
            if not email or not name:
                skipped += 1
                continue
            if await session.scalar(select(Student.id).where(Student.email == email)):
                skipped += 1
                continue
            passing_year = int(row.get("passing_year") or 2025)
            department = (row.get("department") or "").strip() or None
            session.add(
                Student(
                    email=email,
                    full_name=name,
                    password_hash=hash_password(secrets.token_urlsafe(48)),
                    account_status="pending_invite",
                    institution_id=institution_id,
                    department=department,
                    cohort_year=passing_year,
                    roll_number=(row.get("roll_number") or "").strip() or None,
                    career_goals={
                        "department": department,
                        "cgpa": float(row.get("cgpa") or 8.0),
                        "passing_year": passing_year,
                    },
                )
            )
            imported += 1
        except (TypeError, ValueError) as exc:
            errors.append(f"Row {index}: invalid field ({type(exc).__name__})")
    await session.commit()
    return BatchImportSummary(
        total_records=imported + skipped + len(errors),
        imported_count=imported,
        skipped_count=skipped,
        errors=errors,
    )
