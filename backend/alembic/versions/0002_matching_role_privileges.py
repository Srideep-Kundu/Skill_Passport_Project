"""Create a least-privilege PostgreSQL role for matching operations.

Revision ID: 0002_matching_role_privileges
Revises: 0001_initial_schema
"""
from alembic import op

revision = "0002_matching_role_privileges"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'skill_passport_matcher') THEN
                CREATE ROLE skill_passport_matcher NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
            END IF;
        END
        $$
        """
    )
    op.execute("REVOKE ALL PRIVILEGES ON TABLE students, recruiters, admins, evidence, verification_checks FROM PUBLIC")
    op.execute("REVOKE ALL PRIVILEGES ON TABLE students, recruiters, admins, evidence, verification_checks FROM skill_passport_matcher")
    op.execute("GRANT USAGE ON SCHEMA public TO skill_passport_matcher")
    op.execute("GRANT SELECT ON TABLE matching_view, skills, internship_requirements TO skill_passport_matcher")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE matches, match_explanations, audit_log TO skill_passport_matcher")
    op.execute("DO $$ BEGIN EXECUTE format('GRANT skill_passport_matcher TO %I', current_user); END $$")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return
    op.execute("REVOKE skill_passport_matcher FROM CURRENT_USER")
    op.execute("DROP ROLE IF EXISTS skill_passport_matcher")
