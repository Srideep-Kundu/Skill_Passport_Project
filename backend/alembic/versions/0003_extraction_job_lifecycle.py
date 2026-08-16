"""Persist extraction job lifecycle, retry, and idempotency state.

Revision ID: 0003_extraction_job_lifecycle
Revises: 0002_matching_role_privileges
"""
import sqlalchemy as sa

from alembic import op

revision = "0003_extraction_job_lifecycle"
down_revision = "0002_matching_role_privileges"
branch_labels = None
depends_on = None


job_status = sa.Enum(
    "pending",
    "queued",
    "processing",
    "retry_scheduled",
    "completed",
    "failed",
    "dead_lettered",
    name="extractionjobstatus",
)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for value in ("queued", "processing", "retry_scheduled", "dead_lettered"):
            op.execute(f"ALTER TYPE extractionstatus ADD VALUE IF NOT EXISTS '{value}'")
    if not sa.inspect(bind).has_table("extraction_jobs"):
        op.create_table(
            "extraction_jobs",
            sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
            sa.Column("evidence_id", sa.Uuid(), sa.ForeignKey("evidence.id", ondelete="CASCADE"), nullable=False),
            sa.Column("status", job_status, nullable=False),
            sa.Column("attempt_count", sa.Integer(), nullable=False),
            sa.Column("max_attempts", sa.Integer(), nullable=False),
            sa.Column("last_error", sa.String(length=240)),
            sa.Column("user_message", sa.String(length=240)),
            sa.Column("provider", sa.String(length=32)),
            sa.Column("idempotency_key", sa.String(length=64), nullable=False),
            sa.Column("queued_at", sa.DateTime(timezone=True)),
            sa.Column("started_at", sa.DateTime(timezone=True)),
            sa.Column("completed_at", sa.DateTime(timezone=True)),
            sa.Column("next_retry_at", sa.DateTime(timezone=True)),
            sa.UniqueConstraint("evidence_id", name="uq_extraction_job_evidence"),
            sa.UniqueConstraint("idempotency_key", name="uq_extraction_job_idempotency_key"),
        )
        op.create_index("ix_extraction_jobs_evidence_id", "extraction_jobs", ["evidence_id"])
        op.create_index("ix_extraction_jobs_status", "extraction_jobs", ["status"])
        op.create_index("ix_extraction_jobs_next_retry_at", "extraction_jobs", ["next_retry_at"])
    if bind.dialect.name == "postgresql":
        op.execute(
            """
            INSERT INTO extraction_jobs (
                id, evidence_id, status, attempt_count, max_attempts, idempotency_key, completed_at, provider
            )
            SELECT
                gen_random_uuid(), id,
                CASE extraction_status::text
                    WHEN 'extracted' THEN 'completed'::extractionjobstatus
                    WHEN 'failed' THEN 'failed'::extractionjobstatus
                    ELSE 'pending'::extractionjobstatus
                END,
                0, 3, id::text,
                CASE WHEN extraction_status::text IN ('extracted', 'failed') THEN now() ELSE NULL END,
                'legacy'
            FROM evidence e
            WHERE NOT EXISTS (SELECT 1 FROM extraction_jobs j WHERE j.evidence_id = e.id)
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("extraction_jobs"):
        op.drop_index("ix_extraction_jobs_next_retry_at", table_name="extraction_jobs")
        op.drop_index("ix_extraction_jobs_status", table_name="extraction_jobs")
        op.drop_index("ix_extraction_jobs_evidence_id", table_name="extraction_jobs")
        op.drop_table("extraction_jobs")
