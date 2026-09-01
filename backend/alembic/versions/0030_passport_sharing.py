"""Add private-by-default passport sharing.

Revision ID: 0030_passport_sharing
Revises: 0029_collaboration_lifecycle
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0030_passport_sharing"
down_revision: str | None = "0029_collaboration_lifecycle"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    if "passport_shares" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "passport_shares",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("visibility_allowlist", postgresql.JSONB(), nullable=False),
        sa.Column("label", sa.String(length=120)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True)),
        sa.Column("access_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["student_id"], ["students.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_passport_shares_student_id", "passport_shares", ["student_id"])
    op.create_index("ix_passport_shares_expires_at", "passport_shares", ["expires_at"])
    op.create_index("ix_passport_shares_revoked_at", "passport_shares", ["revoked_at"])
    op.create_index(
        "ix_passport_shares_student_active",
        "passport_shares",
        ["student_id", "revoked_at", "expires_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_passport_shares_student_active", table_name="passport_shares")
    op.drop_index("ix_passport_shares_revoked_at", table_name="passport_shares")
    op.drop_index("ix_passport_shares_expires_at", table_name="passport_shares")
    op.drop_index("ix_passport_shares_student_id", table_name="passport_shares")
    op.drop_table("passport_shares")
