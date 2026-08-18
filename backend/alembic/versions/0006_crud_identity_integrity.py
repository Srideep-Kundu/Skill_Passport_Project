"""Complete core lifecycle constraints and global account-email integrity.

Revision ID: 0006_crud_identity_integrity
Revises: 0005_embedding_accounting
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0006_crud_identity_integrity"
down_revision = "0005_embedding_accounting"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    duplicates = bind.execute(
        sa.text(
            """SELECT normalized_email FROM (
                SELECT LOWER(email) AS normalized_email FROM students
                UNION ALL SELECT LOWER(email) AS normalized_email FROM recruiters
                UNION ALL SELECT LOWER(email) AS normalized_email FROM admins
            ) accounts GROUP BY normalized_email HAVING COUNT(*) > 1"""
        )
    ).first()
    if duplicates is not None:
        raise RuntimeError("Cannot migrate conflicting account email: resolve cross-role duplicates first")

    if "account_emails" not in sa.inspect(bind).get_table_names():
        role_type = postgresql.ENUM("student", "recruiter", "admin", name="role", create_type=False)
        op.create_table(
            "account_emails",
            sa.Column("email", sa.String(length=320), primary_key=True),
            sa.Column("account_id", sa.Uuid(), nullable=False),
            sa.Column("role", role_type, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        )
        op.create_index("ix_account_emails_account_id", "account_emails", ["account_id"])
    for table, role in (("students", "student"), ("recruiters", "recruiter"), ("admins", "admin")):
        op.execute(sa.text(f"INSERT INTO account_emails (email, account_id, role) SELECT LOWER(email), id, '{role}' FROM {table} ON CONFLICT (email) DO NOTHING"))

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE match_explanations DROP CONSTRAINT IF EXISTS match_explanations_contributing_evidence_id_fkey")
        op.create_foreign_key(
            "fk_match_explanations_contributing_evidence",
            "match_explanations",
            "evidence",
            ["contributing_evidence_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.drop_constraint("fk_match_explanations_contributing_evidence", "match_explanations", type_="foreignkey")
        op.create_foreign_key(
            "match_explanations_contributing_evidence_id_fkey",
            "match_explanations",
            "evidence",
            ["contributing_evidence_id"],
            ["id"],
        )
    if "account_emails" in sa.inspect(bind).get_table_names():
        op.drop_index("ix_account_emails_account_id", table_name="account_emails")
        op.drop_table("account_emails")
