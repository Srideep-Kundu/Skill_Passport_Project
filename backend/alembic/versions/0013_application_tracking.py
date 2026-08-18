"""Add append-only application tracking events.

Revision ID: 0013_application_tracking
Revises: 0012_provider_field_identifier
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0013_application_tracking"
down_revision = "0012_provider_field_identifier"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if bind.dialect.name == "postgresql":
        op.execute("DO $$ BEGIN CREATE TYPE applicationtrackingstatus AS ENUM ('submitted', 'received', 'in_review', 'rejected', 'interview', 'offer', 'hired', 'withdrawn', 'unknown'); EXCEPTION WHEN duplicate_object THEN NULL; END $$")
        op.execute("DO $$ BEGIN CREATE TYPE applicationstatussource AS ENUM ('system', 'provider', 'user', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$")
        tracking_status = postgresql.ENUM("submitted", "received", "in_review", "rejected", "interview", "offer", "hired", "withdrawn", "unknown", name="applicationtrackingstatus", create_type=False)
        status_source = postgresql.ENUM("system", "provider", "user", "admin", name="applicationstatussource", create_type=False)
    else:
        tracking_status = sa.Enum("submitted", "received", "in_review", "rejected", "interview", "offer", "hired", "withdrawn", "unknown", name="applicationtrackingstatus")
        status_source = sa.Enum("system", "provider", "user", "admin", name="applicationstatussource")
    columns = {column["name"] for column in inspector.get_columns("applications")}
    if "tracking_status" not in columns:
        op.add_column("applications", sa.Column("tracking_status", tracking_status, nullable=True))
        op.create_index("ix_applications_tracking_status", "applications", ["tracking_status"])
    if "tracking_status_source" not in columns:
        op.add_column("applications", sa.Column("tracking_status_source", status_source, nullable=True))
    if "tracking_updated_at" not in columns:
        op.add_column("applications", sa.Column("tracking_updated_at", sa.DateTime(timezone=True), nullable=True))
    if "application_status_events" not in inspector.get_table_names():
        op.create_table(
            "application_status_events",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("application_id", sa.Uuid(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
            sa.Column("event_type", sa.String(80), nullable=False),
            sa.Column("status", tracking_status, nullable=True),
            sa.Column("source", status_source, nullable=False),
            sa.Column("provider_status", sa.String(80), nullable=True),
            sa.Column("safe_metadata", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        )
        op.create_index("ix_application_status_events_application_id", "application_status_events", ["application_id"])
        op.create_index("ix_application_status_events_status", "application_status_events", ["status"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "application_status_events" in inspector.get_table_names():
        op.drop_table("application_status_events")
    columns = {column["name"] for column in inspector.get_columns("applications")}
    if "tracking_updated_at" in columns:
        op.drop_column("applications", "tracking_updated_at")
    if "tracking_status_source" in columns:
        op.drop_column("applications", "tracking_status_source")
    if "tracking_status" in columns:
        op.drop_column("applications", "tracking_status")
    if bind.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS applicationstatussource")
        op.execute("DROP TYPE IF EXISTS applicationtrackingstatus")
