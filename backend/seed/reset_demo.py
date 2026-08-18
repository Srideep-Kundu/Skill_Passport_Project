"""Reset a designated demo database; deliberately unavailable outside demo mode."""

import asyncio

from sqlalchemy import text

from app.core.config import get_settings
from app.core.db import Base, engine
from seed.seed_demo_data import seed_demo_data


def assert_demo_reset_is_allowed() -> None:
    settings = get_settings()
    if settings.environment != "demo" or not settings.demo_reset_enabled:
        raise RuntimeError(
            "Demo reset requires APP_ENV=demo and DEMO_RESET_ENABLED=true; it is unavailable otherwise."
        )
    if not settings.database_url.startswith("postgresql"):
        raise RuntimeError("Demo reset requires the PostgreSQL demo database.")


async def reset_demo() -> None:
    """Clear application data only after both explicit demo safety gates are present."""
    assert_demo_reset_is_allowed()
    table_names = ", ".join(table.name for table in Base.metadata.sorted_tables)
    async with engine.begin() as connection:
        await connection.execute(text(f"TRUNCATE TABLE {table_names} RESTART IDENTITY CASCADE"))
    await seed_demo_data()


async def main() -> None:
    await reset_demo()
    print("Demo reset completed.")


if __name__ == "__main__":
    asyncio.run(main())
