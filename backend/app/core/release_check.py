"""Non-destructive post-migration checks for a production or demo release."""

import asyncio

from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.db import engine

EXPECTED_MIGRATION = "0021_faculty_portal_lifecycle"


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
    except SQLAlchemyError:
        return ["database_connection_or_schema"]

    if revision != EXPECTED_MIGRATION:
        failures.append("alembic_revision")
    if not vector_extension:
        failures.append("pgvector_extension")
    if not matching_view:
        failures.append("matching_view")
    if not matching_role:
        failures.append("matching_role")
    if not taxonomy_count:
        failures.append("taxonomy_seed")

    settings = get_settings()
    if settings.redis_url:
        client = Redis.from_url(settings.redis_url)
        try:
            await client.ping()
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
