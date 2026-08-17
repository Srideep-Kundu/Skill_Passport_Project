"""Add saved job discoveries and auditable recurring runs.

Revision ID: 0014_recurring_discovery
Revises: 0013_application_tracking
"""
import sqlalchemy as sa

from alembic import op

revision = "0014_recurring_discovery"
down_revision = "0013_application_tracking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    status = sa.Enum("queued", "running", "completed", "partial", "failed", name="discoveryrunstatus")
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DO $$ BEGIN CREATE TYPE discoveryrunstatus AS ENUM ('queued', 'running', 'completed', 'partial', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$")
        from sqlalchemy.dialects.postgresql import ENUM

        status = ENUM("queued", "running", "completed", "partial", "failed", name="discoveryrunstatus", create_type=False)
    op.create_table(
        "job_discoveries",
        sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False), sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("query", sa.String(200)), sa.Column("location", sa.String(255)), sa.Column("remote_preference", sa.Boolean()),
        sa.Column("employment_type", sa.String(64)), sa.Column("experience_level", sa.String(64)), sa.Column("providers", sa.JSON(), nullable=False),
        sa.Column("freshness_days", sa.Integer(), nullable=False, server_default="30"), sa.Column("minimum_match_score", sa.Numeric(5, 4), nullable=False, server_default="0.2"),
        sa.Column("cadence_hours", sa.Integer(), nullable=False, server_default="24"), sa.Column("last_run_at", sa.DateTime(timezone=True)), sa.Column("next_run_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_job_discoveries_student_id", "job_discoveries", ["student_id"])
    op.create_index("ix_job_discoveries_enabled", "job_discoveries", ["enabled"])
    op.create_index("ix_job_discoveries_next_run_at", "job_discoveries", ["next_run_at"])
    op.create_table(
        "job_discovery_runs",
        sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("discovery_id", sa.Uuid(), sa.ForeignKey("job_discoveries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", status, nullable=False), sa.Column("providers_requested", sa.JSON(), nullable=False), sa.Column("provider_results", sa.JSON(), nullable=False),
        sa.Column("jobs_seen", sa.Integer(), nullable=False, server_default="0"), sa.Column("jobs_created", sa.Integer(), nullable=False, server_default="0"), sa.Column("jobs_updated", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recommendations_created", sa.Integer(), nullable=False, server_default="0"), sa.Column("recommendations_changed", sa.Integer(), nullable=False, server_default="0"), sa.Column("safe_error", sa.String(240)),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False), sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    for name, columns in (("ix_job_discovery_runs_discovery_id", ["discovery_id"]), ("ix_job_discovery_runs_status", ["status"])):
        op.create_index(name, "job_discovery_runs", columns)
    op.create_table(
        "discovery_recommendations",
        sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("discovery_id", sa.Uuid(), sa.ForeignKey("job_discoveries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_job_id", sa.Uuid(), sa.ForeignKey("external_jobs.id"), nullable=False), sa.Column("match_fingerprint", sa.String(64), nullable=False),
        sa.Column("first_recommended_at", sa.DateTime(timezone=True), nullable=False), sa.Column("last_recommended_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("discovery_id", "external_job_id", name="uq_discovery_recommendation_job"),
    )
    op.create_index("ix_discovery_recommendations_discovery_id", "discovery_recommendations", ["discovery_id"])
    op.create_index("ix_discovery_recommendations_external_job_id", "discovery_recommendations", ["external_job_id"])


def downgrade() -> None:
    op.drop_table("discovery_recommendations")
    op.drop_table("job_discovery_runs")
    op.drop_table("job_discoveries")
    if op.get_bind().dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS discoveryrunstatus")
