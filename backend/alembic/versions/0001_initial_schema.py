"""Initial evidence-backed Skill Passport schema.

Revision ID: 0001_initial_schema
Revises:
"""
from alembic import op
from app import models  # noqa: F401
from app.core.db import Base

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    Base.metadata.create_all(bind=bind)
    if bind.dialect.name == "postgresql":
        op.execute("CREATE INDEX ix_skills_embedding_cosine ON skills USING ivfflat (embedding vector_cosine_ops)")
        op.execute("CREATE INDEX ix_internships_embedding_cosine ON internships USING ivfflat (embedding vector_cosine_ops)")
    op.execute("""CREATE VIEW matching_view AS
        SELECT student_id, skill_id, source_evidence_id, extraction_confidence,
               CASE verification_tier WHEN 'verified' THEN extraction_confidence * 1.00
                 WHEN 'partially_verified' THEN extraction_confidence * 0.85 ELSE extraction_confidence * 0.65 END AS effective_confidence,
               verification_tier
        FROM student_skills""")


def downgrade() -> None:
    bind = op.get_bind()
    op.execute("DROP VIEW IF EXISTS matching_view")
    Base.metadata.drop_all(bind=bind)
