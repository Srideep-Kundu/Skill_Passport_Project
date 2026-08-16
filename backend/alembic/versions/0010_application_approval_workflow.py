"""Add explicit student application intent and approval records.

Revision ID: 0010_application_approval
Revises: 0009_external_job_matches
"""
import sqlalchemy as sa

from alembic import op

revision = "0010_application_approval"
down_revision = "0009_external_job_matches"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "applications" in sa.inspect(op.get_bind()).get_table_names():
        return
    status_type = sa.Enum("approval_pending", "approved", "manual_apply", "withdrawn", name="applicationstatus")
    op.create_table(
        "applications",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
        sa.Column("external_job_id", sa.Uuid(), sa.ForeignKey("external_jobs.id"), nullable=False),
        sa.Column("external_job_match_id", sa.Uuid(), sa.ForeignKey("external_job_matches.id"), nullable=False),
        sa.Column("resume_document_id", sa.Uuid(), sa.ForeignKey("resume_documents.id"), nullable=False),
        sa.Column("status", status_type, nullable=False, server_default="approval_pending"),
        sa.Column("application_snapshot", sa.JSON(), nullable=False),
        sa.Column("application_fingerprint", sa.String(64), nullable=False),
        sa.Column("approved_fingerprint", sa.String(64), nullable=True),
        sa.Column("provider_capabilities", sa.JSON(), nullable=False),
        sa.Column("manual_apply_url", sa.String(2048), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approval_revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("external_application_id", sa.String(255), nullable=True),
        sa.Column("failure_reason", sa.String(240), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("student_id", "external_job_id", name="uq_application_student_external_job"),
    )
    for name, columns in (
        ("ix_applications_student_id", ["student_id"]),
        ("ix_applications_external_job_id", ["external_job_id"]),
        ("ix_applications_external_job_match_id", ["external_job_match_id"]),
        ("ix_applications_resume_document_id", ["resume_document_id"]),
        ("ix_applications_status", ["status"]),
    ):
        op.create_index(name, "applications", columns)


def downgrade() -> None:
    bind = op.get_bind()
    if "applications" in sa.inspect(bind).get_table_names():
        op.drop_table("applications")
    if bind.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS applicationstatus")
