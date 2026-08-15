from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_async_engine(settings.database_url, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def create_matching_view(connection) -> None:  # type: ignore[no-untyped-def]
    """Install the restricted input surface used by the matching service.

    It deliberately exposes no profile or protected-attribute columns.
    """
    await connection.execute(text("DROP VIEW IF EXISTS matching_view"))
    await connection.execute(
        text(
            """CREATE VIEW matching_view AS
            SELECT student_id, skill_id, source_evidence_id,
                   extraction_confidence,
                   CASE verification_tier
                     WHEN 'verified' THEN extraction_confidence * 1.00
                     WHEN 'partially_verified' THEN extraction_confidence * 0.85
                     ELSE extraction_confidence * 0.65
                   END AS effective_confidence,
                   verification_tier
            FROM student_skills"""
        )
    )


async def create_schema_for_local_use() -> None:
    """Development/test convenience; production schema is managed by Alembic."""
    from app import models  # noqa: F401 - register model metadata

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)
