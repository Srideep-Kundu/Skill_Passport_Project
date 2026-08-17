"""Add provider-neutral application preparation and submission persistence.

Revision ID: 0011_application_execution
Revises: 0010_application_approval
"""
import sqlalchemy as sa

from alembic import op

revision = "0011_application_execution"
down_revision = "0010_application_approval"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if bind.dialect.name == "postgresql":
        for value in ("preparing", "needs_input", "prepared", "ready_to_submit", "submitting", "submitted", "failed", "unknown_submission_state"):
            op.execute(f"ALTER TYPE applicationstatus ADD VALUE IF NOT EXISTS '{value}'")
    application_columns = {column["name"] for column in inspector.get_columns("applications")}
    for name, column in (
        ("provider_schema_version", sa.Column("provider_schema_version", sa.String(64), nullable=True)),
        ("execution_payload_fingerprint", sa.Column("execution_payload_fingerprint", sa.String(64), nullable=True)),
        ("ready_payload_fingerprint", sa.Column("ready_payload_fingerprint", sa.String(64), nullable=True)),
        ("prepared_at", sa.Column("prepared_at", sa.DateTime(timezone=True), nullable=True)),
        ("ready_at", sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True)),
    ):
        if name not in application_columns:
            op.add_column("applications", column)
    if "ix_applications_execution_payload_fingerprint" not in {item["name"] for item in inspector.get_indexes("applications")}:
        op.create_index("ix_applications_execution_payload_fingerprint", "applications", ["execution_payload_fingerprint"])
    if "application_fields" not in inspector.get_table_names():
        op.create_table(
            "application_fields",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("application_id", sa.Uuid(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
            sa.Column("field_id", sa.String(120), nullable=False),
            sa.Column("label", sa.String(255), nullable=False),
            sa.Column("field_type", sa.String(32), nullable=False),
            sa.Column("required", sa.Boolean(), nullable=False),
            sa.Column("category", sa.String(64), nullable=False),
            sa.Column("allowed_values", sa.JSON(), nullable=False),
            sa.Column("sensitive", sa.Boolean(), nullable=False),
            sa.Column("source", sa.String(64), nullable=False),
            sa.Column("answer", sa.JSON(), nullable=True),
            sa.Column("answer_source", sa.String(32), nullable=True),
            sa.Column("requires_user_input", sa.Boolean(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.UniqueConstraint("application_id", "field_id", name="uq_application_field_id"),
        )
        op.create_index("ix_application_fields_application_id", "application_fields", ["application_id"])
    if "application_submission_attempts" not in inspector.get_table_names():
        attempt_type = sa.Enum("submitting", "submitted", "retryable_failure", "failed", "unknown_submission_state", name="submissionattemptstatus")
        op.create_table(
            "application_submission_attempts",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("application_id", sa.Uuid(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
            sa.Column("payload_fingerprint", sa.String(64), nullable=False),
            sa.Column("idempotency_key", sa.String(64), nullable=False),
            sa.Column("status", attempt_type, nullable=False),
            sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("provider_response_id", sa.String(255), nullable=True),
            sa.Column("result_type", sa.String(64), nullable=True),
            sa.Column("safe_error", sa.String(240), nullable=True),
            sa.UniqueConstraint("idempotency_key", name="uq_application_submission_idempotency_key"),
        )
        for name, columns in (
            ("ix_application_submission_attempts_application_id", ["application_id"]),
            ("ix_application_submission_attempts_payload_fingerprint", ["payload_fingerprint"]),
            ("ix_application_submission_attempts_status", ["status"]),
        ):
            op.create_index(name, "application_submission_attempts", columns)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "application_submission_attempts" in inspector.get_table_names():
        op.drop_table("application_submission_attempts")
    if "application_fields" in inspector.get_table_names():
        op.drop_table("application_fields")
    application_columns = {column["name"] for column in inspector.get_columns("applications")}
    for name in ("ready_at", "prepared_at", "ready_payload_fingerprint", "execution_payload_fingerprint", "provider_schema_version"):
        if name in application_columns:
            op.drop_column("applications", name)
    if bind.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS submissionattemptstatus")
