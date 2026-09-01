"""Add governed learning attendance and completion provenance.

Revision ID: 0024_learning_outcomes
Revises: 0023_assessment_provenance
"""

import sqlalchemy as sa

from alembic import op

revision = "0024_learning_outcomes"
down_revision = "0023_assessment_provenance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("course_enrollments")
    }
    if {
        "attendance_status",
        "attendance_marked_at",
        "completion_source",
        "completion_evidence_id",
        "verified_by_recruiter_id",
    }.issubset(columns):
        return
    op.add_column(
        "course_enrollments",
        sa.Column(
            "attendance_status",
            sa.String(length=32),
            server_default="pending",
            nullable=False,
        ),
    )
    op.add_column(
        "course_enrollments",
        sa.Column("attendance_marked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "course_enrollments",
        sa.Column("completion_source", sa.String(length=64), nullable=True),
    )
    op.add_column(
        "course_enrollments",
        sa.Column("completion_evidence_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "course_enrollments",
        sa.Column("verified_by_recruiter_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_course_enrollments_completion_evidence",
        "course_enrollments",
        "evidence",
        ["completion_evidence_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_course_enrollments_verified_recruiter",
        "course_enrollments",
        "recruiters",
        ["verified_by_recruiter_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_course_enrollments_completion_evidence_id",
        "course_enrollments",
        ["completion_evidence_id"],
        unique=True,
    )
    op.create_index(
        "ix_course_enrollments_verified_by_recruiter_id",
        "course_enrollments",
        ["verified_by_recruiter_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_course_enrollments_verified_by_recruiter_id",
        table_name="course_enrollments",
    )
    op.drop_index(
        "ix_course_enrollments_completion_evidence_id",
        table_name="course_enrollments",
    )
    op.drop_constraint(
        "fk_course_enrollments_verified_recruiter",
        "course_enrollments",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_course_enrollments_completion_evidence",
        "course_enrollments",
        type_="foreignkey",
    )
    op.drop_column("course_enrollments", "verified_by_recruiter_id")
    op.drop_column("course_enrollments", "completion_evidence_id")
    op.drop_column("course_enrollments", "completion_source")
    op.drop_column("course_enrollments", "attendance_marked_at")
    op.drop_column("course_enrollments", "attendance_status")
