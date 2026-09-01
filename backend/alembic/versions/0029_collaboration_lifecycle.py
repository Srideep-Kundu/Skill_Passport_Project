"""Add governed industry-academia collaboration lifecycle.

Revision ID: 0029_collaboration_lifecycle
Revises: 0028_institution_membership
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0029_collaboration_lifecycle"
down_revision: str | None = "0028_institution_membership"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    challenge_columns = {
        column["name"]
        for column in inspector.get_columns("innovation_challenges")
    }
    application_columns = {
        column["name"] for column in inspector.get_columns("project_applications")
    }
    if {
        "faculty_invitations",
        "challenge_skill_requirements",
    }.issubset(tables) and {
        "recruiter_id",
        "start_date",
        "end_date",
        "published_at",
        "closed_at",
        "participant_capacity",
        "eligibility",
        "outcome_criteria",
    }.issubset(challenge_columns) and {
        "feedback_rating",
        "outcome_metadata",
        "started_at",
        "submitted_at",
        "completed_at",
    }.issubset(application_columns):
        return
    op.add_column("innovation_challenges", sa.Column("recruiter_id", postgresql.UUID(as_uuid=True)))
    op.add_column("innovation_challenges", sa.Column("start_date", sa.DateTime(timezone=True)))
    op.add_column("innovation_challenges", sa.Column("end_date", sa.DateTime(timezone=True)))
    op.add_column("innovation_challenges", sa.Column("published_at", sa.DateTime(timezone=True)))
    op.add_column("innovation_challenges", sa.Column("closed_at", sa.DateTime(timezone=True)))
    op.add_column("innovation_challenges", sa.Column("participant_capacity", sa.Integer()))
    op.add_column("innovation_challenges", sa.Column("eligibility", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("innovation_challenges", sa.Column("outcome_criteria", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.create_foreign_key("fk_challenges_recruiter", "innovation_challenges", "recruiters", ["recruiter_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_innovation_challenges_recruiter_id", "innovation_challenges", ["recruiter_id"])
    op.create_index("ix_innovation_challenges_published_at", "innovation_challenges", ["published_at"])
    op.create_index("ix_innovation_challenges_closed_at", "innovation_challenges", ["closed_at"])
    op.execute("""
        WITH normalized_recruiters AS (
            SELECT id, lower(trim(company_name)) AS company_name,
                   count(*) OVER (PARTITION BY lower(trim(company_name))) AS matches
            FROM recruiters
        )
        UPDATE innovation_challenges AS challenge
        SET recruiter_id = recruiter.id
        FROM normalized_recruiters AS recruiter
        WHERE challenge.recruiter_id IS NULL
          AND recruiter.matches = 1
          AND lower(trim(challenge.host_company)) = recruiter.company_name
    """)
    op.execute("UPDATE innovation_challenges SET challenge_type = 'live_project' WHERE challenge_type = 'live_industry_project'")
    op.execute("UPDATE innovation_challenges SET status = 'published', published_at = COALESCE(created_at, now()) WHERE status = 'active' AND challenge_type IN ('hackathon', 'innovation_challenge', 'live_project')")
    op.execute("UPDATE innovation_challenges SET status = 'closed', closed_at = now() WHERE challenge_type IN ('workshop', 'guest_lecture')")

    op.create_table(
        "challenge_skill_requirements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("challenge_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("innovation_challenges.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("skills.id"), nullable=False),
        sa.Column("requirement_type", sa.String(16), nullable=False),
        sa.Column("weight", sa.Numeric(4, 2), nullable=False, server_default="1.0"),
        sa.CheckConstraint("requirement_type IN ('required', 'preferred')", name="ck_challenge_requirement_type"),
        sa.UniqueConstraint("challenge_id", "skill_id", name="uq_challenge_skill"),
    )
    op.create_index("ix_challenge_skill_requirements_challenge_id", "challenge_skill_requirements", ["challenge_id"])
    op.create_index("ix_challenge_skill_requirements_skill_id", "challenge_skill_requirements", ["skill_id"])

    op.add_column("project_applications", sa.Column("feedback_rating", sa.Integer()))
    op.add_column("project_applications", sa.Column("outcome_metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")))
    op.add_column("project_applications", sa.Column("started_at", sa.DateTime(timezone=True)))
    op.add_column("project_applications", sa.Column("submitted_at", sa.DateTime(timezone=True)))
    op.add_column("project_applications", sa.Column("completed_at", sa.DateTime(timezone=True)))
    op.create_check_constraint("ck_project_feedback_rating", "project_applications", "feedback_rating IS NULL OR (feedback_rating BETWEEN 1 AND 5)")

    op.create_table(
        "faculty_invitations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("recruiter_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("recruiters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("academician_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("academicians.id", ondelete="CASCADE"), nullable=False),
        sa.Column("faculty_opportunity_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("faculty_opportunities.id", ondelete="CASCADE")),
        sa.Column("collaboration_workspace_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("collaboration_workspaces.id", ondelete="CASCADE")),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("message", sa.String(1000), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'declined', 'revoked')", name="ck_faculty_invitation_status"),
        sa.CheckConstraint("faculty_opportunity_id IS NOT NULL OR collaboration_workspace_id IS NOT NULL", name="ck_faculty_invitation_context"),
    )
    for column in ("recruiter_id", "academician_id", "faculty_opportunity_id", "collaboration_workspace_id", "status"):
        op.create_index(f"ix_faculty_invitations_{column}", "faculty_invitations", [column])
    op.create_index("uq_faculty_invitation_opportunity", "faculty_invitations", ["recruiter_id", "academician_id", "faculty_opportunity_id"], unique=True, postgresql_where=sa.text("faculty_opportunity_id IS NOT NULL AND status = 'pending'"))
    op.create_index("uq_faculty_invitation_workspace", "faculty_invitations", ["recruiter_id", "academician_id", "collaboration_workspace_id"], unique=True, postgresql_where=sa.text("collaboration_workspace_id IS NOT NULL AND status = 'pending'"))


def downgrade() -> None:
    op.drop_table("faculty_invitations")
    op.drop_constraint("ck_project_feedback_rating", "project_applications", type_="check")
    for column in ("completed_at", "submitted_at", "started_at", "outcome_metadata", "feedback_rating"):
        op.drop_column("project_applications", column)
    op.drop_table("challenge_skill_requirements")
    for index in ("ix_innovation_challenges_closed_at", "ix_innovation_challenges_published_at", "ix_innovation_challenges_recruiter_id"):
        op.drop_index(index, table_name="innovation_challenges")
    op.drop_constraint("fk_challenges_recruiter", "innovation_challenges", type_="foreignkey")
    for column in ("outcome_criteria", "eligibility", "participant_capacity", "closed_at", "published_at", "end_date", "start_date", "recruiter_id"):
        op.drop_column("innovation_challenges", column)
