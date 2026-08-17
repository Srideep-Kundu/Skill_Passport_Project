"""Persist provider field identifiers for controlled official submission.

Revision ID: 0012_provider_field_identifier
Revises: 0011_application_execution
"""
import sqlalchemy as sa

from alembic import op

revision = "0012_provider_field_identifier"
down_revision = "0011_application_execution"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "provider_field_id" not in {column["name"] for column in sa.inspect(bind).get_columns("application_fields")}:
        op.add_column("application_fields", sa.Column("provider_field_id", sa.String(160), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if "provider_field_id" in {column["name"] for column in sa.inspect(bind).get_columns("application_fields")}:
        op.drop_column("application_fields", "provider_field_id")
