"""Add faculty Collaboration & Funding Hub catalog metadata and saves.

Revision ID: 0024_faculty_hub
Revises: 0023_digilocker_credentials
"""

import sqlalchemy as sa
from alembic import op

revision = "0024_faculty_hub"
down_revision = "0023_digilocker_credentials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "faculty_opportunities" in tables:
        columns = {column["name"] for column in inspector.get_columns("faculty_opportunities")}
        with op.batch_alter_table("faculty_opportunities") as batch_op:
            if "discovery_type" not in columns:
                batch_op.add_column(
                    sa.Column("discovery_type", sa.String(32), nullable=False, server_default="funding")
                )
            if "collaboration_types" not in columns:
                batch_op.add_column(
                    sa.Column("collaboration_types", sa.JSON(), nullable=False, server_default=sa.text("'[]'"))
                )
            if "website_url" not in columns:
                batch_op.add_column(sa.Column("website_url", sa.String(2048), nullable=True))
            if "profile_metadata" not in columns:
                batch_op.add_column(
                    sa.Column("profile_metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'"))
                )

        indexes = {index["name"] for index in sa.inspect(bind).get_indexes("faculty_opportunities")}
        if "ix_faculty_opportunities_discovery_type" not in indexes:
            op.create_index(
                "ix_faculty_opportunities_discovery_type",
                "faculty_opportunities",
                ["discovery_type"],
            )

    if "saved_faculty_opportunities" not in tables:
        op.create_table(
            "saved_faculty_opportunities",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "faculty_id",
                sa.Uuid(),
                sa.ForeignKey("academicians.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "opportunity_id",
                sa.Uuid(),
                sa.ForeignKey("faculty_opportunities.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.UniqueConstraint(
                "faculty_id", "opportunity_id", name="uq_saved_faculty_opportunity"
            ),
        )
        op.create_index(
            "ix_saved_faculty_opportunities_faculty_id",
            "saved_faculty_opportunities",
            ["faculty_id"],
        )
        op.create_index(
            "ix_saved_faculty_opportunities_opportunity_id",
            "saved_faculty_opportunities",
            ["opportunity_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "saved_faculty_opportunities" in tables:
        op.drop_index(
            "ix_saved_faculty_opportunities_opportunity_id",
            table_name="saved_faculty_opportunities",
        )
        op.drop_index(
            "ix_saved_faculty_opportunities_faculty_id",
            table_name="saved_faculty_opportunities",
        )
        op.drop_table("saved_faculty_opportunities")

    if "faculty_opportunities" in tables:
        columns = {
            column["name"]
            for column in sa.inspect(bind).get_columns("faculty_opportunities")
        }
        indexes = {
            index["name"]
            for index in sa.inspect(bind).get_indexes("faculty_opportunities")
        }
        if "ix_faculty_opportunities_discovery_type" in indexes:
            op.drop_index(
                "ix_faculty_opportunities_discovery_type",
                table_name="faculty_opportunities",
            )
        with op.batch_alter_table("faculty_opportunities") as batch_op:
            for column_name in (
                "profile_metadata",
                "website_url",
                "collaboration_types",
                "discovery_type",
            ):
                if column_name in columns:
                    batch_op.drop_column(column_name)
