"""Add institution faculty job postings and interview lifecycle applications.

Revision ID: 0026_faculty_recruitment
Revises: 0025_training_planner
"""

import sqlalchemy as sa
from alembic import op

revision = "0026_faculty_recruitment"
down_revision = "0025_training_planner"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    # 1. Create institution_faculty_jobs table
    if "institution_faculty_jobs" not in tables:
        op.create_table(
            "institution_faculty_jobs",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "institution_id",
                sa.Uuid(),
                sa.ForeignKey("institutions.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("institution_name", sa.String(255), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("department", sa.String(128), nullable=False),
            sa.Column("designation", sa.String(128), nullable=False),
            sa.Column("employment_type", sa.String(64), server_default="Full-time", nullable=False),
            sa.Column("min_experience_years", sa.Integer(), server_default="3", nullable=False),
            sa.Column("qualification_required", sa.String(255), server_default="Ph.D. or Master's in relevant field", nullable=False),
            sa.Column("skills_required", sa.JSON(), server_default="[]", nullable=False),
            sa.Column("research_areas", sa.JSON(), server_default="[]", nullable=False),
            sa.Column("salary_range_lpa", sa.String(128), server_default="Competitive", nullable=False),
            sa.Column("location", sa.String(255), server_default="Campus", nullable=False),
            sa.Column("openings_count", sa.Integer(), server_default="1", nullable=False),
            sa.Column("deadline", sa.DateTime(timezone=True), nullable=True),
            sa.Column("description", sa.Text(), server_default="", nullable=False),
            sa.Column("responsibilities", sa.JSON(), server_default="[]", nullable=False),
            sa.Column("benefits", sa.JSON(), server_default="[]", nullable=False),
            sa.Column("status", sa.String(32), server_default="open", nullable=False, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 2. Create faculty_job_applications table
    if "faculty_job_applications" not in tables:
        op.create_table(
            "faculty_job_applications",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column(
                "job_id",
                sa.Uuid(),
                sa.ForeignKey("institution_faculty_jobs.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column(
                "faculty_id",
                sa.Uuid(),
                sa.ForeignKey("academicians.id", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("status", sa.String(40), server_default="applied", nullable=False, index=True),
            sa.Column("statement_of_purpose", sa.Text(), nullable=False),
            sa.Column("research_statement", sa.Text(), nullable=True),
            sa.Column("teaching_philosophy", sa.Text(), nullable=True),
            sa.Column("current_institution", sa.String(255), server_default="", nullable=False),
            sa.Column("current_designation", sa.String(128), server_default="", nullable=False),
            sa.Column("years_of_experience", sa.Integer(), server_default="0", nullable=False),
            sa.Column("notice_period_days", sa.Integer(), server_default="30", nullable=False),
            sa.Column("cv_url", sa.String(2048), nullable=True),
            sa.Column("interview_details", sa.JSON(), server_default="{}", nullable=False),
            sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("job_id", "faculty_id", name="uq_faculty_job_application"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    tables = set(sa.inspect(bind).get_table_names())

    if "faculty_job_applications" in tables:
        op.drop_table("faculty_job_applications")
    if "institution_faculty_jobs" in tables:
        op.drop_table("institution_faculty_jobs")
