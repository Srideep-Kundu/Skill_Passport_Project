"""Add an explicitly claimed GitHub username for student verification.

Revision ID: 0004_student_github_identity
Revises: 0003_extraction_job_lifecycle
"""
import sqlalchemy as sa

from alembic import op

revision = "0004_student_github_identity"
down_revision = "0003_extraction_job_lifecycle"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("students")}
    if "github_username" not in columns:
        op.add_column("students", sa.Column("github_username", sa.String(length=39), nullable=True))
        op.create_index("ix_students_github_username", "students", ["github_username"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("students")}
    if "github_username" in columns:
        op.drop_index("ix_students_github_username", table_name="students")
        op.drop_column("students", "github_username")
