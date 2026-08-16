"""Add embedding provenance and reconcilable match explanation components.

Revision ID: 0005_embedding_accounting
Revises: 0004_student_github_identity
"""
import sqlalchemy as sa

from alembic import op

revision = "0005_embedding_accounting"
down_revision = "0004_student_github_identity"
branch_labels = None
depends_on = None


def _columns(bind: sa.Connection, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    skill_columns = _columns(bind, "skills")
    for name, column in (
        ("embedding_provider", sa.Column("embedding_provider", sa.String(length=32), nullable=True)),
        ("embedding_model", sa.Column("embedding_model", sa.String(length=80), nullable=True)),
        ("embedding_dimension", sa.Column("embedding_dimension", sa.Integer(), nullable=True)),
        ("embedding_generated_at", sa.Column("embedding_generated_at", sa.DateTime(timezone=True), nullable=True)),
        ("embedding_fingerprint", sa.Column("embedding_fingerprint", sa.String(length=64), nullable=True)),
    ):
        if name not in skill_columns:
            op.add_column("skills", column)
    if "embedding_fingerprint" not in skill_columns:
        op.create_index("ix_skills_embedding_fingerprint", "skills", ["embedding_fingerprint"])
    if "input_fingerprint" not in _columns(bind, "matches"):
        op.add_column("matches", sa.Column("input_fingerprint", sa.String(length=64), server_default="legacy", nullable=False))
    explanation_columns = _columns(bind, "match_explanations")
    for name, column in (
        ("deterministic_contribution", sa.Column("deterministic_contribution", sa.Numeric(6, 5), server_default="0", nullable=False)),
        ("semantic_contribution", sa.Column("semantic_contribution", sa.Numeric(6, 5), server_default="0", nullable=False)),
        ("verification_contribution", sa.Column("verification_contribution", sa.Numeric(6, 5), server_default="0", nullable=False)),
        ("matched_skill_id", sa.Column("matched_skill_id", sa.Uuid(), sa.ForeignKey("skills.id"), nullable=True)),
        ("semantic_similarity", sa.Column("semantic_similarity", sa.Numeric(5, 4), nullable=True)),
    ):
        if name not in explanation_columns:
            op.add_column("match_explanations", column)


def downgrade() -> None:
    bind = op.get_bind()
    for name in ("semantic_similarity", "matched_skill_id", "verification_contribution", "semantic_contribution", "deterministic_contribution"):
        if name in _columns(bind, "match_explanations"):
            op.drop_column("match_explanations", name)
    if "input_fingerprint" in _columns(bind, "matches"):
        op.drop_column("matches", "input_fingerprint")
    skill_columns = _columns(bind, "skills")
    if "embedding_fingerprint" in skill_columns:
        op.drop_index("ix_skills_embedding_fingerprint", table_name="skills")
    for name in ("embedding_fingerprint", "embedding_generated_at", "embedding_dimension", "embedding_model", "embedding_provider"):
        if name in _columns(bind, "skills"):
            op.drop_column("skills", name)
