"""Institutional SIS / ERP Student Roster Import Layer.

Supports bulk CSV and JSON student demographic and academic roster ingestion
into the institution directory without manual record entry.
"""
import csv
import io
from typing import Any
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Student


class StudentImportRecord(BaseModel):
    full_name: str
    email: str
    department: str
    cgpa: float
    passing_year: int
    roll_number: str | None = None


class BatchImportSummary(BaseModel):
    total_records: int
    imported_count: int
    skipped_count: int
    errors: list[str] = []


async def import_students_csv(
    session: AsyncSession,
    csv_content: str,
) -> BatchImportSummary:
    reader = csv.DictReader(io.StringIO(csv_content))
    imported = 0
    skipped = 0
    errors = []

    for idx, row in enumerate(reader):
        try:
            email = row.get("email", "").strip().lower()
            name = row.get("full_name", "").strip() or row.get("name", "").strip()
            if not email or not name:
                skipped += 1
                continue

            existing = (await session.scalars(select(Student).where(Student.email == email))).first()
            if existing:
                skipped += 1
                continue

            student = Student(
                email=email,
                full_name=name,
                password_hash="import_initial_placeholder",
                career_goals={
                    "department": row.get("department", "Computer Science"),
                    "cgpa": float(row.get("cgpa", 8.0)),
                    "passing_year": int(row.get("passing_year", 2025)),
                },
            )
            session.add(student)
            imported += 1
        except Exception as exc:
            errors.append(f"Row {idx + 1}: {str(exc)}")

    await session.commit()
    return BatchImportSummary(
        total_records=imported + skipped + len(errors),
        imported_count=imported,
        skipped_count=skipped,
        errors=errors,
    )
