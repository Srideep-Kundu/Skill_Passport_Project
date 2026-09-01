"""Add append-only placement pipeline status events.

Revision ID: 0027_placement_status_events
Revises: 0026_placement_jobs_pipeline
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0027_placement_status_events"
down_revision: str | None = "0026_placement_jobs_pipeline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if "placement_status_events" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "placement_status_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "placement_registration_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("old_stage", sa.String(length=32), nullable=True),
        sa.Column("new_stage", sa.String(length=32), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_role", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["placement_registration_id"],
            ["placement_registrations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_placement_status_events_registration",
        "placement_status_events",
        ["placement_registration_id", "created_at"],
    )
    op.create_index(
        "ix_placement_status_events_new_stage",
        "placement_status_events",
        ["new_stage"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_placement_status_events_new_stage",
        table_name="placement_status_events",
    )
    op.drop_index(
        "ix_placement_status_events_registration",
        table_name="placement_status_events",
    )
    op.drop_table("placement_status_events")
