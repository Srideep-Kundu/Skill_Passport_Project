"""Add matching and ranking fields to placement_registrations table.

Revision ID: 0019_placement_registrations_fields
Revises: 0018_sih_final_completions
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0019_placement_fields"
down_revision = "0018_sih_final_completions"
branch_labels = None
depends_on = None


def _columns(bind: sa.Connection, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = sa.inspect(bind).get_table_names()
    json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()

    if "placement_drives" in tables:
        cols = _columns(bind, "placement_drives")
        if "recruiter_id" not in cols:
            op.add_column("placement_drives", sa.Column("recruiter_id", sa.Uuid(), sa.ForeignKey("recruiters.id", ondelete="SET NULL"), nullable=True))

    if "placement_registrations" in tables:
        cols = _columns(bind, "placement_registrations")
        if "match_score" not in cols:
            op.add_column("placement_registrations", sa.Column("match_score", sa.Numeric(5, 4), nullable=False, server_default="0.0"))
        if "deterministic_score" not in cols:
            op.add_column("placement_registrations", sa.Column("deterministic_score", sa.Numeric(5, 4), nullable=False, server_default="0.0"))
        if "semantic_score" not in cols:
            op.add_column("placement_registrations", sa.Column("semantic_score", sa.Numeric(5, 4), nullable=False, server_default="0.0"))
        if "verification_bonus" not in cols:
            op.add_column("placement_registrations", sa.Column("verification_bonus", sa.Numeric(5, 4), nullable=False, server_default="0.0"))
        if "interview_date" not in cols:
            op.add_column("placement_registrations", sa.Column("interview_date", sa.DateTime(timezone=True), nullable=True))
        if "interview_notes" not in cols:
            op.add_column("placement_registrations", sa.Column("interview_notes", sa.Text(), nullable=True))
        if "offer_details" not in cols:
            op.add_column("placement_registrations", sa.Column("offer_details", json_type, nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    tables = sa.inspect(bind).get_table_names()

    if "placement_registrations" in tables:
        cols = _columns(bind, "placement_registrations")
        for col in [
            "offer_details",
            "interview_notes",
            "interview_date",
            "verification_bonus",
            "semantic_score",
            "deterministic_score",
            "match_score",
        ]:
            if col in cols:
                op.drop_column("placement_registrations", col)
