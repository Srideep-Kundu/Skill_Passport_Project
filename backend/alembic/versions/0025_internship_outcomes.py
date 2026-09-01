"""Add governed internship lifecycle outcome provenance.

Revision ID: 0025_internship_outcomes
Revises: 0024_learning_outcomes
"""

import sqlalchemy as sa

from alembic import op

revision = "0025_internship_outcomes"
down_revision = "0024_learning_outcomes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    columns = {
        column["name"]
        for column in sa.inspect(connection).get_columns("internship_engagements")
    }
    if {"completed_at", "mentor_verified_at"}.issubset(columns):
        return
    duplicate_count = connection.scalar(
        sa.text(
            """
            SELECT count(*) FROM (
                SELECT internship_id, student_id
                FROM internship_engagements
                GROUP BY internship_id, student_id
                HAVING count(*) > 1
            ) AS duplicates
            """
        )
    )
    if duplicate_count:
        raise RuntimeError(
            "Duplicate internship engagements must be resolved before migration 0025"
        )
    duplicate_evidence_count = connection.scalar(
        sa.text(
            """
            SELECT count(*) FROM (
                SELECT completion_evidence_id
                FROM internship_engagements
                WHERE completion_evidence_id IS NOT NULL
                GROUP BY completion_evidence_id
                HAVING count(*) > 1
            ) AS duplicates
            """
        )
    )
    if duplicate_evidence_count:
        raise RuntimeError(
            "Duplicate completion evidence links must be resolved before migration 0025"
        )

    op.add_column(
        "internship_engagements",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "internship_engagements",
        sa.Column("mentor_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint(
        "uq_internship_engagement_student",
        "internship_engagements",
        ["internship_id", "student_id"],
    )
    op.create_index(
        "ix_internship_engagements_completion_evidence_id",
        "internship_engagements",
        ["completion_evidence_id"],
        unique=True,
    )
    op.create_index(
        "ix_internship_engagements_completed_at",
        "internship_engagements",
        ["completed_at"],
    )
    op.create_index(
        "ix_internship_engagements_mentor_verified_at",
        "internship_engagements",
        ["mentor_verified_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_internship_engagements_mentor_verified_at",
        table_name="internship_engagements",
    )
    op.drop_index(
        "ix_internship_engagements_completed_at",
        table_name="internship_engagements",
    )
    op.drop_index(
        "ix_internship_engagements_completion_evidence_id",
        table_name="internship_engagements",
    )
    op.drop_constraint(
        "uq_internship_engagement_student",
        "internship_engagements",
        type_="unique",
    )
    op.drop_column("internship_engagements", "mentor_verified_at")
    op.drop_column("internship_engagements", "completed_at")
