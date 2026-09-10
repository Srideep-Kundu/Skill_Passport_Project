"""Add display-only preferred locale to authenticated account tables.

Revision ID: 0027_preferred_locale
Revises: 0026_faculty_recruitment
"""

import sqlalchemy as sa
from alembic import op

revision = "0027_preferred_locale"
down_revision = "0026_faculty_recruitment"
branch_labels = None
depends_on = None

ACCOUNT_TABLES = ("students", "recruiters", "academicians", "institutions", "admins")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    for table_name in ACCOUNT_TABLES:
        if table_name not in existing_tables:
            continue
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        if "preferred_locale" not in columns:
            op.add_column(table_name, sa.Column("preferred_locale", sa.String(length=12), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    for table_name in reversed(ACCOUNT_TABLES):
        if table_name not in existing_tables:
            continue
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        if "preferred_locale" in columns:
            op.drop_column(table_name, "preferred_locale")
