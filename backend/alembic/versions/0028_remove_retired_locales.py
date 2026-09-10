"""Clear preferences for retired display locales.

Revision ID: 0028_remove_retired_locales
Revises: 0027_preferred_locale
"""

import sqlalchemy as sa
from alembic import op

revision = "0028_remove_retired_locales"
down_revision = "0027_preferred_locale"
branch_labels = None
depends_on = None

ACCOUNT_TABLES = ("students", "recruiters", "academicians", "institutions", "admins")
RETIRED_LOCALES = ("ur", "ks", "sd")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())
    for table_name in ACCOUNT_TABLES:
        if table_name not in existing_tables:
            continue
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        if "preferred_locale" not in columns:
            continue
        account = sa.table(table_name, sa.column("preferred_locale", sa.String(length=12)))
        op.execute(
            account.update()
            .where(account.c.preferred_locale.in_(RETIRED_LOCALES))
            .values(preferred_locale=None)
        )


def downgrade() -> None:
    # Retired preference values cannot be reconstructed safely.
    pass
