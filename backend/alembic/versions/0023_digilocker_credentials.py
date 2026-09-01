"""Add student DigiLocker accounts and verifiable credential support.

Revision ID: 0023_digilocker_credentials
Revises: 0022_hybrid_extraction_pipeline
"""

import sqlalchemy as sa
from alembic import op

revision = "0023_digilocker_credentials"
down_revision = "0022_hybrid_extraction_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    # 1. Add digilocker_credential value to postgres evidencetype enum
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE evidencetype ADD VALUE IF NOT EXISTS 'digilocker_credential';")

    # 2. Create student_digilocker_accounts table
    if "student_digilocker_accounts" not in tables:
        op.create_table(
            "student_digilocker_accounts",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "student_id",
                sa.Uuid(),
                sa.ForeignKey("students.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            sa.Column("digilocker_id_hash", sa.String(64), nullable=False),
            sa.Column("apaar_id_hash", sa.String(64), nullable=True),
            sa.Column("is_linked", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column(
                "linked_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
        )
        op.create_index(
            "ix_student_digilocker_accounts_student_id",
            "student_digilocker_accounts",
            ["student_id"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())
    if "student_digilocker_accounts" in tables:
        op.drop_index("ix_student_digilocker_accounts_student_id", table_name="student_digilocker_accounts")
        op.drop_table("student_digilocker_accounts")
