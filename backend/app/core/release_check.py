"""Non-destructive post-migration checks for a production or demo release."""

import asyncio

from alembic.config import Config
from alembic.script import ScriptDirectory
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.db import engine
from app.services.worker_observability import (
    WORKER_HEARTBEAT_KEY,
    parse_worker_heartbeat,
)

REQUIRED_RELEASE_TABLES = (
    "students",
    "skills",
    "evidence",
    "student_skills",
    "assessments",
    "assessment_attempts",
    "learning_courses",
    "course_enrollments",
    "internships",
    "internship_engagements",
    "placement_drives",
    "placement_registrations",
    "placement_status_events",
    "innovation_challenges",
    "project_applications",
    "faculty_invitations",
    "passport_shares",
    "institution_import_batches",
    "institution_mappings",
    "external_jobs",
    "audit_log",
)


def expected_migration() -> str:
    """Resolve the repository's sole Alembic head instead of pinning a stale revision."""
    head = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
    if head is None:
        raise RuntimeError("Alembic has no current head")
    return head


async def verify_release() -> list[str]:
    """Return failed invariant names; never print connection strings or exception details."""
    failures: list[str] = []
    try:
        async with engine.connect() as connection:
            revision = await connection.scalar(text("SELECT version_num FROM alembic_version"))
            vector_extension = await connection.scalar(
                text("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')")
            )
            matching_view = await connection.scalar(text("SELECT to_regclass('public.matching_view') IS NOT NULL"))
            taxonomy_count = await connection.scalar(text("SELECT count(*) FROM skills"))
            matching_role = await connection.scalar(
                text("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'skill_passport_matcher')")
            )
            missing_tables = [
                table_name
                for table_name in REQUIRED_RELEASE_TABLES
                if not await connection.scalar(
                    text("SELECT to_regclass(:table_name) IS NOT NULL"),
                    {"table_name": f"public.{table_name}"},
                )
            ]
    except SQLAlchemyError:
        return ["database_connection_or_schema"]

    try:
        current_head = expected_migration()
    except (OSError, RuntimeError, ValueError):
        current_head = None
    if revision != current_head:
        failures.append("alembic_revision")
    if not vector_extension:
        failures.append("pgvector_extension")
    if not matching_view:
        failures.append("matching_view")
    if not matching_role:
        failures.append("matching_role")
    if not taxonomy_count:
        failures.append("taxonomy_seed")
    if missing_tables:
        failures.append("required_tables")

    settings = get_settings()
    if settings.redis_url:
        client = Redis.from_url(settings.redis_url)
        try:
            await client.ping()
            heartbeat = parse_worker_heartbeat(
                await client.get(WORKER_HEARTBEAT_KEY)
            )
            if heartbeat is None:
                failures.append("worker_heartbeat")
        except RedisError:
            failures.append("redis")
        finally:
            await client.aclose()
    elif settings.environment == "production":
        failures.append("redis")
    return failures


async def main() -> None:
    failures = await verify_release()
    if failures:
        print("Release verification failed: " + ", ".join(failures))
        raise SystemExit(1)
    print("Release verification passed.")


if __name__ == "__main__":
    asyncio.run(main())
