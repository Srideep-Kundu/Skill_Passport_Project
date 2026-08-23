"""Add student-scoped extraction cache and safe provider call accounting.

Revision ID: 0022_hybrid_extraction_pipeline
Revises: 0021_faculty_portal_lifecycle
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0022_hybrid_extraction_pipeline"
down_revision = "0021_faculty_portal_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
    if "extraction_cache_entries" not in tables:
        op.create_table(
            "extraction_cache_entries",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "student_id",
                sa.Uuid(),
                sa.ForeignKey("students.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("evidence_type", sa.String(40), nullable=False),
            sa.Column("content_fingerprint", sa.String(64), nullable=False),
            sa.Column("config_fingerprint", sa.String(64), nullable=False),
            sa.Column("payload", json_type, nullable=False),
            sa.Column("source_provider", sa.String(32), nullable=False),
            sa.Column("source_model", sa.String(120), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
            sa.UniqueConstraint(
                "student_id",
                "evidence_type",
                "content_fingerprint",
                "config_fingerprint",
                name="uq_extraction_cache_scope",
            ),
        )
        op.create_index(
            "ix_extraction_cache_entries_student_id",
            "extraction_cache_entries",
            ["student_id"],
        )
    if "extraction_attempts" not in tables:
        op.create_table(
            "extraction_attempts",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "extraction_job_id",
                sa.Uuid(),
                sa.ForeignKey("extraction_jobs.id", ondelete="CASCADE"),
            ),
            sa.Column(
                "resume_document_id",
                sa.Uuid(),
                sa.ForeignKey("resume_documents.id", ondelete="SET NULL"),
            ),
            sa.Column("batch_id", sa.Uuid(), nullable=False),
            sa.Column("stage", sa.String(32), nullable=False),
            sa.Column("outcome", sa.String(32), nullable=False),
            sa.Column("provider", sa.String(32)),
            sa.Column("model", sa.String(120)),
            sa.Column("cache_hit", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("request_count", sa.Integer(), server_default="0", nullable=False),
            sa.Column("input_tokens", sa.Integer()),
            sa.Column("output_tokens", sa.Integer()),
            sa.Column("latency_ms", sa.Integer()),
            sa.Column("error_code", sa.String(80)),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("CURRENT_TIMESTAMP"),
                nullable=False,
            ),
        )
        for column in (
            "extraction_job_id",
            "resume_document_id",
            "batch_id",
            "stage",
            "created_at",
        ):
            op.create_index(
                f"ix_extraction_attempts_{column}", "extraction_attempts", [column]
            )


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "extraction_attempts" in tables:
        op.drop_table("extraction_attempts")
    if "extraction_cache_entries" in tables:
        op.drop_table("extraction_cache_entries")
