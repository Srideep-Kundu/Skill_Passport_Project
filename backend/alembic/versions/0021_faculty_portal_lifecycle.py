"""Faculty Portal Phase 1 and Phase 2 Lifecycle, Collaboration Workspaces, Events, and Notifications.

Revision ID: 0021_faculty_portal_lifecycle
Revises: 0020_merge_0019_heads
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "0021_faculty_portal_lifecycle"
down_revision = "0020_merge_0019_heads"
branch_labels = None
depends_on = None


def _columns(bind: sa.Connection, table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(bind).get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    tables = sa.inspect(bind).get_table_names()
    json_type = postgresql.JSONB() if bind.dialect.name == "postgresql" else sa.JSON()

    # 1. Update academicians table with passport fields
    if "academicians" in tables:
        cols = _columns(bind, "academicians")
        if "bio" not in cols:
            op.add_column("academicians", sa.Column("bio", sa.Text(), nullable=True))
        if "years_experience" not in cols:
            op.add_column("academicians", sa.Column("years_experience", sa.Integer(), nullable=False, server_default="0"))
        if "technical_skills" not in cols:
            op.add_column("academicians", sa.Column("technical_skills", json_type, nullable=False, server_default="[]"))
        if "certifications" not in cols:
            op.add_column("academicians", sa.Column("certifications", json_type, nullable=False, server_default="[]"))
        if "publications" not in cols:
            op.add_column("academicians", sa.Column("publications", json_type, nullable=False, server_default="[]"))
        if "patents" not in cols:
            op.add_column("academicians", sa.Column("patents", json_type, nullable=False, server_default="[]"))
        if "past_industry_experience" not in cols:
            op.add_column("academicians", sa.Column("past_industry_experience", json_type, nullable=False, server_default="[]"))
        if "completed_fdps" not in cols:
            op.add_column("academicians", sa.Column("completed_fdps", json_type, nullable=False, server_default="[]"))
        if "completed_trainings" not in cols:
            op.add_column("academicians", sa.Column("completed_trainings", json_type, nullable=False, server_default="[]"))
        if "collaboration_availability" not in cols:
            op.add_column("academicians", sa.Column("collaboration_availability", sa.String(64), nullable=False, server_default="available"))
        if "phone" not in cols:
            op.add_column("academicians", sa.Column("phone", sa.String(32), nullable=True))
        if "linkedin_url" not in cols:
            op.add_column("academicians", sa.Column("linkedin_url", sa.String(512), nullable=True))
        if "google_scholar_url" not in cols:
            op.add_column("academicians", sa.Column("google_scholar_url", sa.String(512), nullable=True))

    # 2. Update faculty_opportunities table
    if "faculty_opportunities" in tables:
        cols = _columns(bind, "faculty_opportunities")
        if "objectives" not in cols:
            op.add_column("faculty_opportunities", sa.Column("objectives", json_type, nullable=False, server_default="[]"))
        if "mode" not in cols:
            op.add_column("faculty_opportunities", sa.Column("mode", sa.String(32), nullable=False, server_default="hybrid"))
        if "location" not in cols:
            op.add_column("faculty_opportunities", sa.Column("location", sa.String(255), nullable=True))
        if "eligibility" not in cols:
            op.add_column("faculty_opportunities", sa.Column("eligibility", sa.Text(), nullable=True))
        if "required_expertise" not in cols:
            op.add_column("faculty_opportunities", sa.Column("required_expertise", json_type, nullable=False, server_default="[]"))
        if "deliverables" not in cols:
            op.add_column("faculty_opportunities", sa.Column("deliverables", json_type, nullable=False, server_default="[]"))
        if "required_documents" not in cols:
            op.add_column("faculty_opportunities", sa.Column("required_documents", json_type, nullable=False, server_default="[]"))
        if "contact_email" not in cols:
            op.add_column("faculty_opportunities", sa.Column("contact_email", sa.String(320), nullable=True))
        if "contact_person" not in cols:
            op.add_column("faculty_opportunities", sa.Column("contact_person", sa.String(200), nullable=True))
        if "created_by_recruiter_id" not in cols:
            op.add_column("faculty_opportunities", sa.Column("created_by_recruiter_id", sa.Uuid(), sa.ForeignKey("recruiters.id", ondelete="SET NULL"), nullable=True))

    # 3. Update faculty_applications table
    if "faculty_applications" in tables:
        cols = _columns(bind, "faculty_applications")
        if "application_type" not in cols:
            op.add_column("faculty_applications", sa.Column("application_type", sa.String(64), nullable=False, server_default="general"))
        if "proposal_title" not in cols:
            op.add_column("faculty_applications", sa.Column("proposal_title", sa.String(255), nullable=True))
        if "problem_statement" not in cols:
            op.add_column("faculty_applications", sa.Column("problem_statement", sa.Text(), nullable=True))
        if "objectives" not in cols:
            op.add_column("faculty_applications", sa.Column("objectives", json_type, nullable=False, server_default="[]"))
        if "methodology" not in cols:
            op.add_column("faculty_applications", sa.Column("methodology", sa.Text(), nullable=True))
        if "team_members" not in cols:
            op.add_column("faculty_applications", sa.Column("team_members", json_type, nullable=False, server_default="[]"))
        if "student_researchers" not in cols:
            op.add_column("faculty_applications", sa.Column("student_researchers", json_type, nullable=False, server_default="[]"))
        if "deliverables" not in cols:
            op.add_column("faculty_applications", sa.Column("deliverables", json_type, nullable=False, server_default="[]"))
        if "milestones" not in cols:
            op.add_column("faculty_applications", sa.Column("milestones", json_type, nullable=False, server_default="[]"))
        if "timeline_weeks" not in cols:
            op.add_column("faculty_applications", sa.Column("timeline_weeks", sa.Integer(), nullable=True))
        if "budget_requested" not in cols:
            op.add_column("faculty_applications", sa.Column("budget_requested", sa.Numeric(12, 2), nullable=True))
        if "industry_support_required" not in cols:
            op.add_column("faculty_applications", sa.Column("industry_support_required", sa.Text(), nullable=True))
        if "attachments" not in cols:
            op.add_column("faculty_applications", sa.Column("attachments", json_type, nullable=False, server_default="[]"))
        if "reviewer_notes" not in cols:
            op.add_column("faculty_applications", sa.Column("reviewer_notes", sa.Text(), nullable=True))
        if "feedback" not in cols:
            op.add_column("faculty_applications", sa.Column("feedback", sa.Text(), nullable=True))
        if "industry_mentor_name" not in cols:
            op.add_column("faculty_applications", sa.Column("industry_mentor_name", sa.String(200), nullable=True))
        if "industry_mentor_email" not in cols:
            op.add_column("faculty_applications", sa.Column("industry_mentor_email", sa.String(320), nullable=True))
        if "engagement_status" not in cols:
            op.add_column("faculty_applications", sa.Column("engagement_status", sa.String(32), nullable=False, server_default="not_started"))
        if "start_date" not in cols:
            op.add_column("faculty_applications", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True))
        if "end_date" not in cols:
            op.add_column("faculty_applications", sa.Column("end_date", sa.DateTime(timezone=True), nullable=True))
        if "completion_report" not in cols:
            op.add_column("faculty_applications", sa.Column("completion_report", sa.Text(), nullable=True))
        if "completion_certificate_url" not in cols:
            op.add_column("faculty_applications", sa.Column("completion_certificate_url", sa.String(2048), nullable=True))
        if "rating_or_grade" not in cols:
            op.add_column("faculty_applications", sa.Column("rating_or_grade", sa.String(32), nullable=True))
        if "outcome_type" not in cols:
            op.add_column("faculty_applications", sa.Column("outcome_type", sa.String(64), nullable=True))
        if "outcome_details" not in cols:
            op.add_column("faculty_applications", sa.Column("outcome_details", json_type, nullable=False, server_default="{}"))
        if "updated_at" not in cols:
            op.add_column("faculty_applications", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))

    # 4. Create collaboration_workspaces
    if "collaboration_workspaces" not in tables:
        op.create_table(
            "collaboration_workspaces",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("application_id", sa.Uuid(), sa.ForeignKey("faculty_applications.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("challenge_id", sa.Uuid(), sa.ForeignKey("innovation_challenges.id", ondelete="SET NULL"), nullable=True, index=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("collaboration_type", sa.String(64), nullable=False),
            sa.Column("organization_name", sa.String(255), nullable=False),
            sa.Column("faculty_lead_id", sa.Uuid(), sa.ForeignKey("academicians.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("industry_lead_name", sa.String(200), nullable=False),
            sa.Column("industry_lead_email", sa.String(320), nullable=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="active"),
            sa.Column("progress_percentage", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("objectives", json_type, nullable=False, server_default="[]"),
            sa.Column("participants", json_type, nullable=False, server_default="[]"),
            sa.Column("milestones", json_type, nullable=False, server_default="[]"),
            sa.Column("tasks", json_type, nullable=False, server_default="[]"),
            sa.Column("meetings", json_type, nullable=False, server_default="[]"),
            sa.Column("discussion_posts", json_type, nullable=False, server_default="[]"),
            sa.Column("deliverables", json_type, nullable=False, server_default="[]"),
            sa.Column("feedback", json_type, nullable=False, server_default="[]"),
            sa.Column("outcome_summary", sa.Text(), nullable=True),
            sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )

    # 5. Create faculty_event_registrations
    if "faculty_event_registrations" not in tables:
        op.create_table(
            "faculty_event_registrations",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("faculty_id", sa.Uuid(), sa.ForeignKey("academicians.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("event_id", sa.Uuid(), nullable=False, index=True),
            sa.Column("event_type", sa.String(64), nullable=False, server_default="workshop"),
            sa.Column("event_title", sa.String(255), nullable=False),
            sa.Column("host_organization", sa.String(255), nullable=False),
            sa.Column("role", sa.String(32), nullable=False, server_default="attendee"),
            sa.Column("status", sa.String(32), nullable=False, server_default="registered"),
            sa.Column("feedback", sa.Text(), nullable=True),
            sa.Column("certificate_url", sa.String(2048), nullable=True),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("registered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("faculty_id", "event_id", "event_type", name="uq_faculty_event_reg"),
        )

    # 6. Create faculty_notifications
    if "faculty_notifications" not in tables:
        op.create_table(
            "faculty_notifications",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("faculty_id", sa.Uuid(), sa.ForeignKey("academicians.id", ondelete="CASCADE"), nullable=False, index=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("category", sa.String(64), nullable=False, server_default="application"),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("link_url", sa.String(1024), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    op.drop_table("faculty_notifications")
    op.drop_table("faculty_event_registrations")
    op.drop_table("collaboration_workspaces")
