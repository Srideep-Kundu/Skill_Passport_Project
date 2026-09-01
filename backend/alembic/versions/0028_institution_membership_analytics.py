"""Add durable institution membership and academic metadata.

Revision ID: 0028_institution_membership
Revises: 0027_placement_status_events
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0028_institution_membership"
down_revision: str | None = "0027_placement_status_events"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    columns = {
        column["name"] for column in sa.inspect(op.get_bind()).get_columns("students")
    }
    if {"institution_id", "department", "cohort_year", "roll_number"}.issubset(
        columns
    ):
        return
    op.add_column(
        "students",
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("students", sa.Column("department", sa.String(length=120)))
    op.add_column("students", sa.Column("cohort_year", sa.Integer()))
    op.add_column("students", sa.Column("roll_number", sa.String(length=120)))
    op.create_foreign_key(
        "fk_students_institution_id",
        "students",
        "institutions",
        ["institution_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_students_institution_id", "students", ["institution_id"])
    op.create_index(
        "ix_students_institution_department",
        "students",
        ["institution_id", "department"],
    )
    op.create_index(
        "ix_students_institution_cohort",
        "students",
        ["institution_id", "cohort_year"],
    )
    op.create_index(
        "uq_students_institution_roll_number",
        "students",
        ["institution_id", "roll_number"],
        unique=True,
        postgresql_where=sa.text("roll_number IS NOT NULL"),
    )

    # Only a unique normalized name match is accepted. Ambiguous and unmatched
    # legacy names deliberately remain unassigned.
    op.execute(
        """
        WITH normalized_institutions AS (
            SELECT
                id,
                lower(regexp_replace(trim(institution_name), '\\s+', ' ', 'g')) AS normalized_name,
                count(*) OVER (
                    PARTITION BY lower(
                        regexp_replace(trim(institution_name), '\\s+', ' ', 'g')
                    )
                ) AS match_count
            FROM institutions
        )
        UPDATE students AS student
        SET institution_id = institution.id
        FROM normalized_institutions AS institution
        WHERE student.institution_id IS NULL
          AND student.university IS NOT NULL
          AND institution.match_count = 1
          AND lower(regexp_replace(trim(student.university), '\\s+', ' ', 'g'))
              = institution.normalized_name
        """
    )
    op.execute(
        """
        UPDATE students
        SET department = NULLIF(trim(career_goals ->> 'department'), '')
        WHERE department IS NULL
          AND career_goals IS NOT NULL
          AND NULLIF(trim(career_goals ->> 'department'), '') IS NOT NULL
        """
    )
    op.execute(
        """
        UPDATE students
        SET cohort_year = graduation_year
        WHERE cohort_year IS NULL AND graduation_year IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("uq_students_institution_roll_number", table_name="students")
    op.drop_index("ix_students_institution_cohort", table_name="students")
    op.drop_index("ix_students_institution_department", table_name="students")
    op.drop_index("ix_students_institution_id", table_name="students")
    op.drop_constraint("fk_students_institution_id", "students", type_="foreignkey")
    op.drop_column("students", "roll_number")
    op.drop_column("students", "cohort_year")
    op.drop_column("students", "department")
    op.drop_column("students", "institution_id")
