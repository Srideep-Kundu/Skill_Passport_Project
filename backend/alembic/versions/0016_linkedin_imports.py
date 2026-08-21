"""Add LinkedIn import provenance and evidence metadata.

Revision ID: 0016_linkedin_imports
Revises: 0015_automation_policy
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0016_linkedin_imports"
down_revision = "0015_automation_policy"
branch_labels = None
depends_on = None


def _columns(bind: sa.Connection, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = sa.inspect(bind).get_table_names()
    if "linkedin_imports" not in tables:
        status_type = (
            postgresql.ENUM(
                "uploaded",
                "parsing",
                "parsed",
                "evidence_created",
                "processing_skills",
                "completed",
                "failed",
                "unsupported",
                name="linkedinparsestatus",
            )
            if bind.dialect.name == "postgresql"
            else sa.Enum(
                "uploaded",
                "parsing",
                "parsed",
                "evidence_created",
                "processing_skills",
                "completed",
                "failed",
                "unsupported",
                name="linkedinparsestatus",
            )
        )
        op.create_table(
            "linkedin_imports",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
            sa.Column("original_filename", sa.String(255), nullable=False),
            sa.Column("storage_key", sa.String(255), nullable=False, unique=True),
            sa.Column("mime_type", sa.String(100), nullable=False),
            sa.Column("size_bytes", sa.Integer(), nullable=False),
            sa.Column("checksum", sa.String(64), nullable=False),
            sa.Column("parse_status", status_type, nullable=False),
            sa.Column("parser_version", sa.String(32), nullable=False),
            sa.Column("parsed_data", sa.JSON(), nullable=True),
            sa.Column("safe_error_message", sa.String(240), nullable=True),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("parsed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.UniqueConstraint("student_id", "checksum", name="uq_linkedin_import_student_checksum"),
        )
        op.create_index("ix_linkedin_imports_student_id", "linkedin_imports", ["student_id"])
        op.create_index("ix_linkedin_imports_checksum", "linkedin_imports", ["checksum"])
        op.create_index("ix_linkedin_imports_parse_status", "linkedin_imports", ["parse_status"])
        op.create_index("ix_linkedin_imports_is_active", "linkedin_imports", ["is_active"])

    evidence_columns = _columns(bind, "evidence")
    if "linkedin_import_id" not in evidence_columns:
        op.add_column("evidence", sa.Column("linkedin_import_id", sa.Uuid(), nullable=True))
        op.create_foreign_key("fk_evidence_linkedin_import", "evidence", "linkedin_imports", ["linkedin_import_id"], ["id"], ondelete="SET NULL")
        op.create_index("ix_evidence_linkedin_import_id", "evidence", ["linkedin_import_id"])
    if "linkedin_category" not in evidence_columns:
        op.add_column("evidence", sa.Column("linkedin_category", sa.String(40), nullable=True))
    if "linkedin_source_hash" not in evidence_columns:
        op.add_column("evidence", sa.Column("linkedin_source_hash", sa.String(64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    columns = _columns(bind, "evidence")
    for name in ("linkedin_source_hash", "linkedin_category"):
        if name in columns:
            op.drop_column("evidence", name)
    if "linkedin_import_id" in columns:
        op.drop_index("ix_evidence_linkedin_import_id", table_name="evidence")
        op.drop_constraint("fk_evidence_linkedin_import", "evidence", type_="foreignkey")
        op.drop_column("evidence", "linkedin_import_id")
    if "linkedin_imports" in sa.inspect(bind).get_table_names():
        op.drop_table("linkedin_imports")
