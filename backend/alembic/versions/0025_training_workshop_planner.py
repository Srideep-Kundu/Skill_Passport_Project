"""Add faculty training and workshop planner.

Revision ID: 0025_training_planner
Revises: 0024_faculty_hub
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0025_training_planner"
down_revision: str | None = "0024_faculty_hub"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "training_programs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("faculty_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("objective", sa.Text(), nullable=False),
        sa.Column("program_type", sa.String(length=64), nullable=False),
        sa.Column("target_cohort", sa.String(length=160), nullable=False),
        sa.Column("target_department", sa.String(length=120), nullable=False),
        sa.Column("target_year", sa.String(length=64), nullable=False),
        sa.Column("target_skills", sa.JSON(), nullable=False),
        sa.Column("expected_participants", sa.Integer(), nullable=False),
        sa.Column("prerequisites", sa.JSON(), nullable=False),
        sa.Column("trainer_type", sa.String(length=64), nullable=False),
        sa.Column("trainer_name", sa.String(length=200), nullable=True),
        sa.Column("trainer_organization", sa.String(length=255), nullable=True),
        sa.Column("trainer_reference_id", sa.Uuid(), nullable=True),
        sa.Column("infrastructure_requirements", sa.JSON(), nullable=False),
        sa.Column("budget_breakdown", sa.JSON(), nullable=False),
        sa.Column("total_estimated_budget", sa.Numeric(12, 2), nullable=False),
        sa.Column("confirmed_funding", sa.Numeric(12, 2), nullable=False),
        sa.Column("funding_gap", sa.Numeric(12, 2), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notice_period_days", sa.Integer(), nullable=False),
        sa.Column("notice_status", sa.String(length=16), nullable=False),
        sa.Column("preparation_tasks", sa.JSON(), nullable=False),
        sa.Column("marketing_kit", sa.JSON(), nullable=False),
        sa.Column("campaign_metrics", sa.JSON(), nullable=False),
        sa.Column("execution_metrics", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["faculty_id"], ["academicians.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_training_programs_faculty_id", "training_programs", ["faculty_id"])
    op.create_table(
        "training_outcome_metrics",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("training_id", sa.Uuid(), nullable=False),
        sa.Column("skill_name", sa.String(length=120), nullable=False),
        sa.Column("cohort_name", sa.String(length=200), nullable=True),
        sa.Column("pre_readiness_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("post_readiness_score", sa.Numeric(5, 2), nullable=False),
        sa.Column("improvement_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("attendance_count", sa.Integer(), nullable=False),
        sa.Column("feedback_rating", sa.Numeric(3, 2), nullable=False),
        sa.Column("evidence_records_created", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["training_id"], ["training_programs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_training_outcome_metrics_training_id", "training_outcome_metrics", ["training_id"])


def downgrade() -> None:
    op.drop_index("ix_training_outcome_metrics_training_id", table_name="training_outcome_metrics")
    op.drop_table("training_outcome_metrics")
    op.drop_index("ix_training_programs_faculty_id", table_name="training_programs")
    op.drop_table("training_programs")
