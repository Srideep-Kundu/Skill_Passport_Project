"""University / Institution Decision-Support Portal: Intervention Plans and Action Plans.

Revision ID: 0019_institution_decision_portal
Revises: 0018_sih_final_completions
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0019_institution_decision_portal"
down_revision = "0018_sih_final_completions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = sa.inspect(bind).get_table_names()
    json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()

    # 1. Create institution_intervention_plans table
    if "institution_intervention_plans" not in tables:
        op.create_table(
            "institution_intervention_plans",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("institution_id", sa.Uuid(), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=True, index=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("skill_cluster", sa.String(120), nullable=False),
            sa.Column("department", sa.String(120), nullable=False, server_default="All"),
            sa.Column("target_students_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("baseline_supply_index", sa.Numeric(5, 2), nullable=False, server_default="0.0"),
            sa.Column("target_supply_index", sa.Numeric(5, 2), nullable=False, server_default="80.0"),
            sa.Column("selected_learning_programs", json_type, nullable=False),
            sa.Column("selected_workshops", json_type, nullable=False),
            sa.Column("selected_mentorship", json_type, nullable=False),
            sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("target_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

    # 2. Create institution_action_plans table
    if "institution_action_plans" not in tables:
        op.create_table(
            "institution_action_plans",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("institution_id", sa.Uuid(), sa.ForeignKey("institutions.id", ondelete="CASCADE"), nullable=True, index=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("action_type", sa.String(64), nullable=False),
            sa.Column("related_department", sa.String(120), nullable=False, server_default="All"),
            sa.Column("source_insight", sa.Text(), nullable=False),
            sa.Column("priority", sa.String(32), nullable=False, server_default="medium"),
            sa.Column("owner", sa.String(120), nullable=False, server_default="Dean of Academics"),
            sa.Column("target_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="planned"),
            sa.Column("linked_intervention_id", sa.Uuid(), sa.ForeignKey("institution_intervention_plans.id", ondelete="SET NULL"), nullable=True),
            sa.Column("outcome_notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    pass
