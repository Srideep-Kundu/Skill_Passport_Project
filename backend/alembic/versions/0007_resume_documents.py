"""Add secure resume-document provenance and storage metadata.

Revision ID: 0007_resume_documents
Revises: 0006_crud_identity_integrity
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0007_resume_documents"
down_revision = "0006_crud_identity_integrity"
branch_labels = None
depends_on = None


def _columns(bind: sa.Connection, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = sa.inspect(bind).get_table_names()
    if "resume_documents" not in tables:
        status_type = postgresql.ENUM("uploaded", "parsing", "parsed", "evidence_created", "processing_skills", "completed", "failed", "unsupported", name="resumeparsestatus") if bind.dialect.name == "postgresql" else sa.Enum("uploaded", "parsing", "parsed", "evidence_created", "processing_skills", "completed", "failed", "unsupported", name="resumeparsestatus")
        op.create_table(
            "resume_documents",
            sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
            sa.Column("original_filename", sa.String(255), nullable=False), sa.Column("storage_key", sa.String(255), nullable=False, unique=True),
            sa.Column("mime_type", sa.String(100), nullable=False), sa.Column("size_bytes", sa.Integer(), nullable=False), sa.Column("checksum", sa.String(64), nullable=False),
            sa.Column("parse_status", status_type, nullable=False), sa.Column("parser_version", sa.String(32), nullable=False), sa.Column("parsed_data", sa.JSON()), sa.Column("extracted_text", sa.Text()), sa.Column("safe_error_message", sa.String(240)),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False), sa.Column("parsed_at", sa.DateTime(timezone=True)), sa.Column("is_active", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.UniqueConstraint("student_id", "checksum", name="uq_resume_document_student_checksum"),
        )
        op.create_index("ix_resume_documents_student_id", "resume_documents", ["student_id"])
        op.create_index("ix_resume_documents_checksum", "resume_documents", ["checksum"])
        op.create_index("ix_resume_documents_parse_status", "resume_documents", ["parse_status"])
        op.create_index("ix_resume_documents_is_active", "resume_documents", ["is_active"])
    evidence_columns = _columns(bind, "evidence")
    if "resume_document_id" not in evidence_columns:
        op.add_column("evidence", sa.Column("resume_document_id", sa.Uuid(), nullable=True))
        op.create_foreign_key("fk_evidence_resume_document", "evidence", "resume_documents", ["resume_document_id"], ["id"])
        op.create_index("ix_evidence_resume_document_id", "evidence", ["resume_document_id"])
    if "resume_section" not in evidence_columns:
        op.add_column("evidence", sa.Column("resume_section", sa.String(40), nullable=True))
    if "resume_source_hash" not in evidence_columns:
        op.add_column("evidence", sa.Column("resume_source_hash", sa.String(64), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    columns = _columns(bind, "evidence")
    for name in ("resume_source_hash", "resume_section"):
        if name in columns:
            op.drop_column("evidence", name)
    if "resume_document_id" in columns:
        op.drop_index("ix_evidence_resume_document_id", table_name="evidence")
        op.drop_constraint("fk_evidence_resume_document", "evidence", type_="foreignkey")
        op.drop_column("evidence", "resume_document_id")
    if "resume_documents" in sa.inspect(bind).get_table_names():
        op.drop_table("resume_documents")
