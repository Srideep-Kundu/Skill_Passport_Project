"""Add first-class placement jobs and canonical requirements.

Revision ID: 0026_placement_jobs_pipeline
Revises: 0025_internship_outcomes
"""

import sqlalchemy as sa

from alembic import op

revision = "0026_placement_jobs_pipeline"
down_revision = "0025_internship_outcomes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {
        column["name"] for column in inspector.get_columns("placement_drives")
    }
    if "placement_requirements" in inspector.get_table_names() and {
        "qualifications",
        "employment_type",
        "location",
        "application_deadline",
        "eligibility",
        "published_at",
        "closed_at",
        "external_source",
        "external_id",
    }.issubset(columns):
        return
    op.add_column("placement_drives", sa.Column("qualifications", sa.Text()))
    op.add_column(
        "placement_drives",
        sa.Column(
            "employment_type",
            sa.String(length=64),
            server_default="full_time",
            nullable=False,
        ),
    )
    op.add_column("placement_drives", sa.Column("location", sa.String(length=255)))
    op.add_column(
        "placement_drives",
        sa.Column("application_deadline", sa.DateTime(timezone=True)),
    )
    op.add_column(
        "placement_drives",
        sa.Column("eligibility", sa.JSON(), server_default="{}", nullable=False),
    )
    op.add_column(
        "placement_drives", sa.Column("published_at", sa.DateTime(timezone=True))
    )
    op.add_column(
        "placement_drives", sa.Column("closed_at", sa.DateTime(timezone=True))
    )
    op.add_column(
        "placement_drives", sa.Column("external_source", sa.String(length=64))
    )
    op.add_column(
        "placement_drives", sa.Column("external_id", sa.String(length=160))
    )
    op.create_index(
        "ix_placement_drives_application_deadline",
        "placement_drives",
        ["application_deadline"],
    )
    op.create_unique_constraint(
        "uq_placement_external_source_id",
        "placement_drives",
        ["external_source", "external_id"],
    )
    op.create_table(
        "placement_requirements",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("placement_drive_id", sa.Uuid(), nullable=False),
        sa.Column("skill_id", sa.Uuid(), nullable=False),
        sa.Column("weight", sa.Numeric(4, 2), nullable=False),
        sa.Column("requirement_type", sa.String(length=16), nullable=False),
        sa.ForeignKeyConstraint(
            ["placement_drive_id"], ["placement_drives.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["skill_id"], ["skills.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "placement_drive_id", "skill_id", name="uq_placement_requirement_skill"
        ),
    )
    op.create_index(
        "ix_placement_requirements_placement_drive_id",
        "placement_requirements",
        ["placement_drive_id"],
    )
    op.create_index(
        "ix_placement_requirements_skill_id",
        "placement_requirements",
        ["skill_id"],
    )

    # Existing raw names are migrated only when they match an existing
    # canonical name. The legacy JSON remains available so unresolved values
    # can be reported without inventing taxonomy rows.
    op.execute(
        sa.text(
            """
            INSERT INTO placement_requirements
                (id, placement_drive_id, skill_id, weight, requirement_type)
            SELECT gen_random_uuid(), pd.id, s.id, 1.0, 'required'
            FROM placement_drives pd
            CROSS JOIN LATERAL jsonb_array_elements_text(pd.required_skills) raw(name)
            JOIN skills s ON lower(s.canonical_name) = lower(raw.name)
            ON CONFLICT (placement_drive_id, skill_id) DO NOTHING
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE placement_drives
            SET status = 'published', published_at = COALESCE(published_at, created_at)
            WHERE status IN ('active', 'upcoming')
            """
        )
    )


def downgrade() -> None:
    op.drop_index(
        "ix_placement_requirements_skill_id", table_name="placement_requirements"
    )
    op.drop_index(
        "ix_placement_requirements_placement_drive_id",
        table_name="placement_requirements",
    )
    op.drop_table("placement_requirements")
    op.drop_constraint(
        "uq_placement_external_source_id", "placement_drives", type_="unique"
    )
    op.drop_index(
        "ix_placement_drives_application_deadline", table_name="placement_drives"
    )
    op.drop_column("placement_drives", "external_id")
    op.drop_column("placement_drives", "external_source")
    op.drop_column("placement_drives", "closed_at")
    op.drop_column("placement_drives", "published_at")
    op.drop_column("placement_drives", "eligibility")
    op.drop_column("placement_drives", "application_deadline")
    op.drop_column("placement_drives", "location")
    op.drop_column("placement_drives", "employment_type")
    op.drop_column("placement_drives", "qualifications")
