"""SIH 26044 Final Completions: Apprenticeships, Recruiter Training Programs, Soft Skills & Aptitude breakdowns, User Documents, and Achievements.

Revision ID: 0018_sih_final_completions
Revises: 0017_sih_ecosystem_expansion
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0018_sih_final_completions"
down_revision = "0017_sih_ecosystem_expansion"
branch_labels = None
depends_on = None


def _columns(bind: sa.Connection, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = sa.inspect(bind).get_table_names()
    json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()

    # 1. Extend internships for Apprenticeships
    if "internships" in tables:
        cols = _columns(bind, "internships")
        if "opportunity_type" not in cols:
            op.add_column("internships", sa.Column("opportunity_type", sa.String(32), nullable=False, server_default="internship"))
        if "mode" not in cols:
            op.add_column("internships", sa.Column("mode", sa.String(32), nullable=True, server_default="hybrid"))
        if "stipend_amount" not in cols:
            op.add_column("internships", sa.Column("stipend_amount", sa.Numeric(10, 2), nullable=True))
        if "duration_weeks" not in cols:
            op.add_column("internships", sa.Column("duration_weeks", sa.Integer(), nullable=True, server_default="12"))
        if "location" not in cols:
            op.add_column("internships", sa.Column("location", sa.String(255), nullable=True))
        if "is_published" not in cols:
            op.add_column("internships", sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("true")))

    # 2. Extend learning_courses for Recruiter/Industry Training Programs & Certifications
    if "learning_courses" in tables:
        cols = _columns(bind, "learning_courses")
        if "recruiter_id" not in cols:
            op.add_column("learning_courses", sa.Column("recruiter_id", sa.Uuid(), sa.ForeignKey("recruiters.id", ondelete="SET NULL"), nullable=True))
        if "program_type" not in cols:
            op.add_column("learning_courses", sa.Column("program_type", sa.String(64), nullable=False, server_default="course"))
        if "start_date" not in cols:
            op.add_column("learning_courses", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True))
        if "end_date" not in cols:
            op.add_column("learning_courses", sa.Column("end_date", sa.DateTime(timezone=True), nullable=True))
        if "delivery_mode" not in cols:
            op.add_column("learning_courses", sa.Column("delivery_mode", sa.String(32), nullable=False, server_default="online"))
        if "capacity" not in cols:
            op.add_column("learning_courses", sa.Column("capacity", sa.Integer(), nullable=True))
        if "certificate_available" not in cols:
            op.add_column("learning_courses", sa.Column("certificate_available", sa.Boolean(), nullable=False, server_default=sa.text("true")))
        if "is_published" not in cols:
            op.add_column("learning_courses", sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("true")))

    # 3. Extend assessment_attempts for breakdown
    if "assessment_attempts" in tables and "breakdown" not in _columns(bind, "assessment_attempts"):
        op.add_column("assessment_attempts", sa.Column("breakdown", json_type, nullable=False, server_default=sa.text("'{}'")))

    # 4. Create user_documents table
    if "user_documents" not in tables:
        op.create_table(
            "user_documents",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("user_id", sa.Uuid(), nullable=False, index=True),
            sa.Column("user_role", sa.String(32), nullable=False, server_default="student"),
            sa.Column("document_type", sa.String(64), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("file_name", sa.String(255), nullable=False),
            sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("mime_type", sa.String(128), nullable=False, server_default="application/pdf"),
            sa.Column("file_url", sa.String(2048), nullable=True),
            sa.Column("verification_status", sa.String(32), nullable=False, server_default="uploaded"),
            sa.Column("related_entity_id", sa.Uuid(), nullable=True),
            sa.Column("metadata_payload", json_type, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

    # 5. Create student_achievements table
    if "student_achievements" not in tables:
        op.create_table(
            "student_achievements",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("achievement_type", sa.String(64), nullable=False),
            sa.Column("issuer_organization", sa.String(255), nullable=False),
            sa.Column("issue_date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("proof_url", sa.String(2048), nullable=True),
            sa.Column("verification_status", sa.String(32), nullable=False, server_default="self_reported"),
            sa.Column("evidence_id", sa.Uuid(), sa.ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        )

    # 6. Extend placement_registrations for match scoring and interviews
    if "placement_registrations" in tables:
        cols = _columns(bind, "placement_registrations")
        if "match_score" not in cols:
            op.add_column("placement_registrations", sa.Column("match_score", sa.Numeric(5, 4), nullable=False, server_default="0.0"))
        if "deterministic_score" not in cols:
            op.add_column("placement_registrations", sa.Column("deterministic_score", sa.Numeric(5, 4), nullable=False, server_default="0.0"))
        if "semantic_score" not in cols:
            op.add_column("placement_registrations", sa.Column("semantic_score", sa.Numeric(5, 4), nullable=False, server_default="0.0"))
        if "verification_bonus" not in cols:
            op.add_column("placement_registrations", sa.Column("verification_bonus", sa.Numeric(5, 4), nullable=False, server_default="0.0"))
        if "interview_date" not in cols:
            op.add_column("placement_registrations", sa.Column("interview_date", sa.DateTime(timezone=True), nullable=True))
        if "interview_notes" not in cols:
            op.add_column("placement_registrations", sa.Column("interview_notes", sa.Text(), nullable=True))
        if "offer_details" not in cols:
            op.add_column("placement_registrations", sa.Column("offer_details", json_type, nullable=True))


def downgrade() -> None:
    pass

