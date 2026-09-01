"""Add assessment dimensions and idempotent evidence provenance.

Revision ID: 0023_assessment_provenance
Revises: 0022_hybrid_extraction_pipeline
"""

import sqlalchemy as sa

from alembic import op

revision = "0023_assessment_provenance"
down_revision = "0022_hybrid_extraction_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {
        table: {column["name"] for column in inspector.get_columns(table)}
        for table in ("assessments", "assessment_questions", "assessment_attempts")
    }
    if (
        "assessment_type" in columns["assessments"]
        and "competency_skill_id" in columns["assessment_questions"]
        and {"evidence_id", "idempotency_key"}.issubset(columns["assessment_attempts"])
    ):
        return
    op.add_column(
        "assessments",
        sa.Column(
            "assessment_type",
            sa.String(length=32),
            server_default="technical",
            nullable=False,
        ),
    )
    op.create_index(
        "ix_assessments_assessment_type", "assessments", ["assessment_type"]
    )
    op.add_column(
        "assessment_questions",
        sa.Column("competency_skill_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_assessment_questions_competency_skill",
        "assessment_questions",
        "skills",
        ["competency_skill_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index(
        "ix_assessment_questions_competency_skill_id",
        "assessment_questions",
        ["competency_skill_id"],
    )

    op.add_column(
        "assessment_attempts",
        sa.Column("evidence_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "assessment_attempts",
        sa.Column("idempotency_key", sa.String(length=64), nullable=True),
    )
    op.create_foreign_key(
        "fk_assessment_attempts_evidence",
        "assessment_attempts",
        "evidence",
        ["evidence_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_assessment_attempts_evidence_id",
        "assessment_attempts",
        ["evidence_id"],
        unique=True,
    )
    op.create_unique_constraint(
        "uq_assessment_attempt_submission",
        "assessment_attempts",
        ["student_id", "assessment_id", "idempotency_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_assessment_attempt_submission", "assessment_attempts", type_="unique"
    )
    op.drop_index(
        "ix_assessment_attempts_evidence_id", table_name="assessment_attempts"
    )
    op.drop_constraint(
        "fk_assessment_attempts_evidence", "assessment_attempts", type_="foreignkey"
    )
    op.drop_column("assessment_attempts", "idempotency_key")
    op.drop_column("assessment_attempts", "evidence_id")

    op.drop_index(
        "ix_assessment_questions_competency_skill_id",
        table_name="assessment_questions",
    )
    op.drop_constraint(
        "fk_assessment_questions_competency_skill",
        "assessment_questions",
        type_="foreignkey",
    )
    op.drop_column("assessment_questions", "competency_skill_id")

    op.drop_index("ix_assessments_assessment_type", table_name="assessments")
    op.drop_column("assessments", "assessment_type")
