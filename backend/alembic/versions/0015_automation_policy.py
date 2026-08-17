"""Add bounded student automation policies.

Revision ID: 0015_automation_policy
Revises: 0014_recurring_discovery
"""

import sqlalchemy as sa

from alembic import op

revision = "0015_automation_policy"
down_revision = "0014_recurring_discovery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "automation_policies" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "automation_policies",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "student_id",
            sa.Uuid(),
            sa.ForeignKey("students.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="100"),
        sa.Column(
            "minimum_match_score",
            sa.Numeric(5, 4),
            nullable=False,
            server_default="0.2",
        ),
        sa.Column("allowed_providers", sa.JSON(), nullable=False),
        sa.Column("allowed_locations", sa.JSON(), nullable=False),
        sa.Column("remote_preference", sa.Boolean()),
        sa.Column("employment_types", sa.JSON(), nullable=False),
        sa.Column("experience_levels", sa.JSON(), nullable=False),
        sa.Column("required_skills_any", sa.JSON(), nullable=False),
        sa.Column("required_skills_all", sa.JSON(), nullable=False),
        sa.Column("excluded_skills", sa.JSON(), nullable=False),
        sa.Column("excluded_companies", sa.JSON(), nullable=False),
        sa.Column("excluded_keywords", sa.JSON(), nullable=False),
        sa.Column(
            "maximum_jobs_per_run", sa.Integer(), nullable=False, server_default="25"
        ),
        sa.Column(
            "maximum_review_intents_per_run",
            sa.Integer(),
            nullable=False,
            server_default="5",
        ),
        sa.Column(
            "maximum_review_intents_per_day",
            sa.Integer(),
            nullable=False,
            server_default="5",
        ),
        sa.Column(
            "maximum_pending_review_queue_size",
            sa.Integer(),
            nullable=False,
            server_default="25",
        ),
        sa.Column(
            "auto_create_review_intent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("last_applied_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_automation_policies_student_id", "automation_policies", ["student_id"]
    )
    op.create_index(
        "ix_automation_policies_enabled", "automation_policies", ["enabled"]
    )


def downgrade() -> None:
    op.drop_table("automation_policies")
