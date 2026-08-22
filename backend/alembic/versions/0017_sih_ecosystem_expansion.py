"""SIH 26044 Ecosystem Expansion: Academician, Institution, Assessments, Learning, Placements, Faculty, and Collaboration.

Revision ID: 0017_sih_ecosystem_expansion
Revises: 0016_linkedin_imports
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0017_sih_ecosystem_expansion"
down_revision = "0016_linkedin_imports"
branch_labels = None
depends_on = None


def _columns(bind: sa.Connection, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = sa.inspect(bind).get_table_names()

    # 1. Update PostgreSQL Role enum if postgresql dialect
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'academician'")
        op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'institution'")

    # 2. Add career_goals to students table
    if "students" in tables and "career_goals" not in _columns(bind, "students"):
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.add_column("students", sa.Column("career_goals", json_type, nullable=True))

    # 3. Create academicians table
    if "academicians" not in tables:
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.create_table(
            "academicians",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("email", sa.String(320), nullable=False, unique=True),
            sa.Column("password_hash", sa.String(255), nullable=False),
            sa.Column("full_name", sa.String(200), nullable=False),
            sa.Column("institution_name", sa.String(255), nullable=False),
            sa.Column("department", sa.String(120), nullable=False),
            sa.Column("designation", sa.String(120), nullable=False),
            sa.Column("research_areas", json_type, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 4. Create institutions table
    if "institutions" not in tables:
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.create_table(
            "institutions",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("email", sa.String(320), nullable=False, unique=True),
            sa.Column("password_hash", sa.String(255), nullable=False),
            sa.Column("institution_name", sa.String(255), nullable=False),
            sa.Column("institution_code", sa.String(64), nullable=False, unique=True),
            sa.Column("state", sa.String(100), nullable=True),
            sa.Column("departments", json_type, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 5. Create assessments & assessment_questions & attempts
    if "assessments" not in tables:
        op.create_table(
            "assessments",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("canonical_skill_name", sa.String(120), nullable=False, index=True),
            sa.Column("skill_id", sa.Uuid(), sa.ForeignKey("skills.id"), nullable=True),
            sa.Column("category", sa.String(80), nullable=False),
            sa.Column("difficulty", sa.String(32), nullable=False, server_default="intermediate"),
            sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="30"),
            sa.Column("passing_score", sa.Integer(), nullable=False, server_default="70"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if "assessment_questions" not in tables:
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.create_table(
            "assessment_questions",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("assessment_id", sa.Uuid(), sa.ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("question_text", sa.Text(), nullable=False),
            sa.Column("question_type", sa.String(32), nullable=False, server_default="mcq"),
            sa.Column("options", json_type, nullable=False),
            sa.Column("correct_answer", sa.String(255), nullable=False),
            sa.Column("explanation", sa.Text(), nullable=True),
            sa.Column("points", sa.Integer(), nullable=False, server_default="10"),
        )

    if "assessment_attempts" not in tables:
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.create_table(
            "assessment_attempts",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("assessment_id", sa.Uuid(), sa.ForeignKey("assessments.id"), nullable=False, index=True),
            sa.Column("score", sa.Numeric(5, 2), nullable=False),
            sa.Column("total_points", sa.Integer(), nullable=False),
            sa.Column("passed", sa.Boolean(), nullable=False),
            sa.Column("answers", json_type, nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 6. Create learning_courses & enrollments
    if "learning_courses" not in tables:
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.create_table(
            "learning_courses",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("provider", sa.String(120), nullable=False),
            sa.Column("category", sa.String(80), nullable=False),
            sa.Column("difficulty", sa.String(32), nullable=False, server_default="all_levels"),
            sa.Column("duration_hours", sa.Integer(), nullable=False, server_default="10"),
            sa.Column("url", sa.String(2048), nullable=False),
            sa.Column("rating", sa.Numeric(3, 2), nullable=False, server_default="4.8"),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("skills", json_type, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if "course_enrollments" not in tables:
        op.create_table(
            "course_enrollments",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("course_id", sa.Uuid(), sa.ForeignKey("learning_courses.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="enrolled"),
            sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("enrolled_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("student_id", "course_id", name="uq_student_course_enrollment"),
        )

    # 7. Create placement_drives & registrations
    if "placement_drives" not in tables:
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.create_table(
            "placement_drives",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("recruiter_id", sa.Uuid(), sa.ForeignKey("recruiters.id", ondelete="SET NULL"), nullable=True),
            sa.Column("company_name", sa.String(255), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("role_type", sa.String(80), nullable=False),
            sa.Column("ctc_lpa", sa.Numeric(6, 2), nullable=False, server_default="12.0"),
            sa.Column("eligible_departments", json_type, nullable=False),
            sa.Column("minimum_cgpa", sa.Numeric(3, 2), nullable=False, server_default="7.0"),
            sa.Column("passing_year", sa.Integer(), nullable=False, server_default="2025"),
            sa.Column("drive_date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(32), nullable=False, server_default="upcoming"),
            sa.Column("required_skills", json_type, nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if "placement_registrations" not in tables:
        op.create_table(
            "placement_registrations",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("placement_drive_id", sa.Uuid(), sa.ForeignKey("placement_drives.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="registered"),
            sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("notes", sa.String(255), nullable=True),
            sa.UniqueConstraint("student_id", "placement_drive_id", name="uq_student_placement_drive"),
        )

    # 8. Create faculty_opportunities & faculty_applications
    if "faculty_opportunities" not in tables:
        op.create_table(
            "faculty_opportunities",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("opportunity_type", sa.String(64), nullable=False),
            sa.Column("organization_name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("domain", sa.String(120), nullable=False),
            sa.Column("stipend_or_grant", sa.Numeric(12, 2), nullable=True),
            sa.Column("duration_weeks", sa.Integer(), nullable=False, server_default="4"),
            sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="open"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if "faculty_applications" not in tables:
        op.create_table(
            "faculty_applications",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("faculty_id", sa.Uuid(), sa.ForeignKey("academicians.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("opportunity_id", sa.Uuid(), sa.ForeignKey("faculty_opportunities.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="applied"),
            sa.Column("proposal_text", sa.Text(), nullable=True),
            sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("faculty_id", "opportunity_id", name="uq_faculty_opportunity_app"),
        )

    # 9. Create mentorship_sessions & innovation_challenges & project_applications
    if "mentorship_sessions" not in tables:
        op.create_table(
            "mentorship_sessions",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("mentor_name", sa.String(200), nullable=False),
            sa.Column("mentor_company", sa.String(200), nullable=False),
            sa.Column("mentor_role", sa.String(120), nullable=False),
            sa.Column("domain", sa.String(120), nullable=False),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="45"),
            sa.Column("meeting_link", sa.String(2048), nullable=True),
            sa.Column("max_participants", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if "innovation_challenges" not in tables:
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.create_table(
            "innovation_challenges",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("challenge_type", sa.String(64), nullable=False, server_default="hackathon"),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("host_company", sa.String(255), nullable=False),
            sa.Column("problem_statement", sa.Text(), nullable=False),
            sa.Column("prize_pool", sa.String(100), nullable=False, server_default="₹1,00,000"),
            sa.Column("team_size", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("duration_weeks", sa.Integer(), nullable=False, server_default="4"),
            sa.Column("mentor_name", sa.String(120), nullable=True),
            sa.Column("deliverables", json_type, nullable=False),
            sa.Column("milestones", json_type, nullable=False),
            sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
            sa.Column("tags", json_type, nullable=False),
            sa.Column("status", sa.String(32), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if "project_applications" not in tables:
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.create_table(
            "project_applications",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("challenge_id", sa.Uuid(), sa.ForeignKey("innovation_challenges.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("team_members", json_type, nullable=False),
            sa.Column("status", sa.String(32), nullable=False, server_default="applied"),
            sa.Column("submission_url", sa.String(2048), nullable=True),
            sa.Column("submission_notes", sa.Text(), nullable=True),
            sa.Column("feedback", sa.Text(), nullable=True),
            sa.Column("score_or_grade", sa.String(32), nullable=True),
            sa.Column("completion_evidence_id", sa.Uuid(), sa.ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True),
            sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 10. Create internship_engagements
    if "internship_engagements" not in tables:
        json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()
        op.create_table(
            "internship_engagements",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("internship_id", sa.Uuid(), sa.ForeignKey("internships.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("student_id", sa.Uuid(), sa.ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("recruiter_id", sa.Uuid(), sa.ForeignKey("recruiters.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("mentor_id", sa.Uuid(), nullable=True),
            sa.Column("mentor_name", sa.String(120), nullable=True),
            sa.Column("mentor_email", sa.String(120), nullable=True),
            sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="applied"),
            sa.Column("progress_percentage", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("milestones", json_type, nullable=False),
            sa.Column("mentor_feedback", json_type, nullable=True),
            sa.Column("final_rating", sa.Numeric(3, 2), nullable=True),
            sa.Column("completion_notes", sa.Text(), nullable=True),
            sa.Column("completion_evidence_id", sa.Uuid(), sa.ForeignKey("evidence.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    pass

