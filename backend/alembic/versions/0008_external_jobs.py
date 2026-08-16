"""Add provider-neutral external job ingestion tables.

Revision ID: 0008_external_jobs
Revises: 0007_resume_documents
"""
import sqlalchemy as sa

from alembic import op

revision = "0008_external_jobs"
down_revision = "0007_resume_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "external_jobs" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table(
            "external_jobs",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("provider", sa.String(64), nullable=False),
            sa.Column("provider_source", sa.String(120), nullable=False),
            sa.Column("external_id", sa.String(160), nullable=False),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("company_name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("location", sa.String(255), nullable=True),
            sa.Column("remote_status", sa.String(32), nullable=True),
            sa.Column("employment_type", sa.String(64), nullable=True),
            sa.Column("experience_level", sa.String(64), nullable=True),
            sa.Column("salary_min", sa.Numeric(12, 2), nullable=True),
            sa.Column("salary_max", sa.Numeric(12, 2), nullable=True),
            sa.Column("salary_currency", sa.String(8), nullable=True),
            sa.Column("apply_url", sa.String(2048), nullable=True),
            sa.Column("source_url", sa.String(2048), nullable=False),
            sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("raw_metadata", sa.JSON(), nullable=True),
            sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("last_synced_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.UniqueConstraint("provider", "external_id", name="uq_external_job_provider_external_id"),
        )
        for name, columns in (
            ("ix_external_jobs_provider", ["provider"]),
            ("ix_external_jobs_provider_source", ["provider_source"]),
            ("ix_external_jobs_last_synced_at", ["last_synced_at"]),
            ("ix_external_jobs_is_active", ["is_active"]),
        ):
            op.create_index(name, "external_jobs", columns)
    if "external_job_requirements" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table(
            "external_job_requirements",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("external_job_id", sa.Uuid(), sa.ForeignKey("external_jobs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("skill_id", sa.Uuid(), sa.ForeignKey("skills.id"), nullable=False),
            sa.Column("is_required", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("weight", sa.Numeric(3, 2), server_default="1.0", nullable=False),
            sa.Column("confidence", sa.Numeric(4, 3), nullable=False),
            sa.Column("source_span", sa.String(500), nullable=False),
            sa.UniqueConstraint("external_job_id", "skill_id", name="uq_external_job_requirement_skill"),
        )
        op.create_index("ix_external_job_requirements_external_job_id", "external_job_requirements", ["external_job_id"])
        op.create_index("ix_external_job_requirements_skill_id", "external_job_requirements", ["skill_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if "external_job_requirements" in sa.inspect(bind).get_table_names():
        op.drop_table("external_job_requirements")
    if "external_jobs" in sa.inspect(bind).get_table_names():
        op.drop_table("external_jobs")
