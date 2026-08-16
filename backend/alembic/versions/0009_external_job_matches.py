"""Persist deterministic external-job matches and explanations.

Revision ID: 0009_external_job_matches
Revises: 0008_external_jobs
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0009_external_job_matches"
down_revision = "0008_external_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "external_job_matches" not in sa.inspect(bind).get_table_names():
        op.create_table(
            "external_job_matches",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False),
            sa.Column("external_job_id", sa.Uuid(), sa.ForeignKey("external_jobs.id", ondelete="CASCADE"), nullable=False),
            sa.Column("deterministic_score", sa.Numeric(5, 4), nullable=False),
            sa.Column("semantic_score", sa.Numeric(5, 4), nullable=False),
            sa.Column("verification_bonus", sa.Numeric(5, 4), nullable=False),
            sa.Column("final_score", sa.Numeric(5, 4), nullable=False),
            sa.Column("score_version", sa.String(32), nullable=False),
            sa.Column("input_fingerprint", sa.String(64), nullable=False),
            sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.UniqueConstraint("student_id", "external_job_id", name="uq_external_job_match_student_job"),
        )
        for name, columns in (
            ("ix_external_job_matches_student_id", ["student_id"]),
            ("ix_external_job_matches_external_job_id", ["external_job_id"]),
            ("ix_external_job_matches_final_score", ["final_score"]),
        ):
            op.create_index(name, "external_job_matches", columns)
    if "external_job_match_explanations" not in sa.inspect(bind).get_table_names():
        tier_type = postgresql.ENUM("verified", "partially_verified", "unverified", name="verificationtier", create_type=False) if bind.dialect.name == "postgresql" else sa.Enum("verified", "partially_verified", "unverified", name="verificationtier")
        op.create_table(
            "external_job_match_explanations",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("external_job_match_id", sa.Uuid(), sa.ForeignKey("external_job_matches.id", ondelete="CASCADE"), nullable=False),
            sa.Column("skill_id", sa.Uuid(), sa.ForeignKey("skills.id"), nullable=False),
            sa.Column("is_required", sa.Boolean(), nullable=False),
            sa.Column("status", sa.String(40), nullable=False),
            sa.Column("contribution", sa.Numeric(6, 5), nullable=False),
            sa.Column("deterministic_contribution", sa.Numeric(6, 5), nullable=False),
            sa.Column("semantic_contribution", sa.Numeric(6, 5), nullable=False),
            sa.Column("verification_contribution", sa.Numeric(6, 5), nullable=False),
            sa.Column("matched_skill_id", sa.Uuid(), sa.ForeignKey("skills.id"), nullable=True),
            sa.Column("semantic_similarity", sa.Numeric(5, 4), nullable=True),
            sa.Column("contributing_evidence_id", sa.Uuid(), sa.ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True),
            sa.Column("extraction_confidence", sa.Numeric(4, 3), nullable=True),
            sa.Column("verification_tier", tier_type, nullable=True),
            sa.UniqueConstraint("external_job_match_id", "skill_id", name="uq_external_job_match_explanation_skill"),
        )
        for name, columns in (
            ("ix_external_job_match_explanations_external_job_match_id", ["external_job_match_id"]),
            ("ix_external_job_match_explanations_skill_id", ["skill_id"]),
        ):
            op.create_index(name, "external_job_match_explanations", columns)
    if bind.dialect.name == "postgresql":
        op.execute("GRANT SELECT ON TABLE external_jobs, external_job_requirements TO skill_passport_matcher")
        op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE external_job_matches, external_job_match_explanations TO skill_passport_matcher")


def downgrade() -> None:
    bind = op.get_bind()
    if "external_job_match_explanations" in sa.inspect(bind).get_table_names():
        op.drop_table("external_job_match_explanations")
    if "external_job_matches" in sa.inspect(bind).get_table_names():
        op.drop_table("external_job_matches")
