"""Add governed tenant-scoped institution imports and mappings.

Revision ID: 0031_institution_imports
Revises: 0030_passport_sharing
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0031_institution_imports"
down_revision: str | None = "0030_passport_sharing"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    student_columns = {
        column["name"] for column in inspector.get_columns("students")
    }
    drive_columns = {
        column["name"] for column in inspector.get_columns("placement_drives")
    }
    registration_columns = {
        column["name"]
        for column in inspector.get_columns("placement_registrations")
    }
    enrollment_columns = {
        column["name"] for column in inspector.get_columns("course_enrollments")
    }
    if {"institution_import_batches", "institution_mappings"}.issubset(tables) and {
        "account_status"
    }.issubset(student_columns) and {"institution_id"}.issubset(
        drive_columns
    ) and {"institution_id", "external_source", "external_id"}.issubset(
        registration_columns
    ) and {"institution_id", "external_source", "external_id"}.issubset(
        enrollment_columns
    ):
        return
    op.add_column(
        "students",
        sa.Column("account_status", sa.String(length=32), nullable=False, server_default="active"),
    )
    op.create_index("ix_students_account_status", "students", ["account_status"])

    op.create_table(
        "institution_import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("import_type", sa.String(length=32), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("valid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("invalid_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("skipped_rows", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "safe_error_summary",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "institution_id", "import_type", "checksum", name="uq_institution_import_checksum"
        ),
    )
    op.create_index(
        "ix_institution_import_batches_institution_id",
        "institution_import_batches",
        ["institution_id"],
    )
    op.create_index(
        "ix_institution_import_batches_scope",
        "institution_import_batches",
        ["institution_id", "import_type", "status"],
    )

    op.create_table(
        "institution_mappings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("mapping_type", sa.String(length=32), nullable=False),
        sa.Column("external_key", sa.String(length=160), nullable=False),
        sa.Column("canonical_value", sa.String(length=255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["institution_id"], ["institutions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "institution_id", "mapping_type", "external_key", name="uq_institution_mapping_key"
        ),
    )
    op.create_index(
        "ix_institution_mappings_institution_id",
        "institution_mappings",
        ["institution_id"],
    )
    op.create_index(
        "ix_institution_mappings_scope",
        "institution_mappings",
        ["institution_id", "mapping_type"],
    )

    op.drop_constraint(
        "uq_placement_external_source_id", "placement_drives", type_="unique"
    )
    op.add_column(
        "placement_drives",
        sa.Column("institution_id", postgresql.UUID(as_uuid=True)),
    )
    op.create_foreign_key(
        "fk_placement_drives_institution",
        "placement_drives",
        "institutions",
        ["institution_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_placement_drives_institution_id", "placement_drives", ["institution_id"]
    )
    op.create_unique_constraint(
        "uq_placement_external_source_id",
        "placement_drives",
        ["institution_id", "external_source", "external_id"],
    )

    for table in ("placement_registrations", "course_enrollments"):
        op.add_column(table, sa.Column("institution_id", postgresql.UUID(as_uuid=True)))
        op.add_column(table, sa.Column("external_source", sa.String(length=64)))
        op.add_column(table, sa.Column("external_id", sa.String(length=160)))
        op.create_foreign_key(
            f"fk_{table}_institution",
            table,
            "institutions",
            ["institution_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(f"ix_{table}_institution_id", table, ["institution_id"])

    op.create_unique_constraint(
        "uq_placement_registration_import_id",
        "placement_registrations",
        ["institution_id", "external_source", "external_id"],
    )
    op.create_unique_constraint(
        "uq_course_enrollment_import_id",
        "course_enrollments",
        ["institution_id", "external_source", "external_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_course_enrollment_import_id", "course_enrollments", type_="unique"
    )
    op.drop_constraint(
        "uq_placement_registration_import_id",
        "placement_registrations",
        type_="unique",
    )
    for table in ("course_enrollments", "placement_registrations"):
        op.drop_index(f"ix_{table}_institution_id", table_name=table)
        op.drop_constraint(f"fk_{table}_institution", table, type_="foreignkey")
        op.drop_column(table, "external_id")
        op.drop_column(table, "external_source")
        op.drop_column(table, "institution_id")

    op.drop_constraint(
        "uq_placement_external_source_id", "placement_drives", type_="unique"
    )
    op.drop_index("ix_placement_drives_institution_id", table_name="placement_drives")
    op.drop_constraint(
        "fk_placement_drives_institution", "placement_drives", type_="foreignkey"
    )
    op.drop_column("placement_drives", "institution_id")
    op.create_unique_constraint(
        "uq_placement_external_source_id",
        "placement_drives",
        ["external_source", "external_id"],
    )

    op.drop_index("ix_institution_mappings_scope", table_name="institution_mappings")
    op.drop_index(
        "ix_institution_mappings_institution_id", table_name="institution_mappings"
    )
    op.drop_table("institution_mappings")
    op.drop_index(
        "ix_institution_import_batches_scope",
        table_name="institution_import_batches",
    )
    op.drop_index(
        "ix_institution_import_batches_institution_id",
        table_name="institution_import_batches",
    )
    op.drop_table("institution_import_batches")
    op.drop_index("ix_students_account_status", table_name="students")
    op.drop_column("students", "account_status")
