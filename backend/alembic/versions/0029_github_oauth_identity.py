"""Add github_id for OAuth login to students and recruiters.

Revision ID: 0029_github_oauth_identity
Revises: 0028_remove_retired_locales
"""

import sqlalchemy as sa
from alembic import op

revision = "0029_github_oauth_identity"
down_revision = "0028_remove_retired_locales"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    for table_name in ("students", "recruiters"):
        if table_name not in existing_tables:
            continue
        columns = {c["name"] for c in inspector.get_columns(table_name)}
        if "github_id" not in columns:
            op.add_column(
                table_name,
                sa.Column("github_id", sa.String(64), nullable=True),
            )
            op.create_index(
                f"ix_{table_name}_github_id",
                table_name,
                ["github_id"],
                unique=True,
            )


def downgrade() -> None:
    for table_name in ("students", "recruiters"):
        op.drop_index(f"ix_{table_name}_github_id", table_name=table_name)
        op.drop_column(table_name, "github_id")
