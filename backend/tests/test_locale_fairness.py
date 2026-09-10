import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app import models  # noqa: F401 - register all model metadata
from app.core.db import Base, create_matching_view


@pytest.mark.asyncio
async def test_preferred_locale_is_not_exposed_to_matching_view() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    try:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
            await create_matching_view(connection)
            columns = (await connection.execute(text("PRAGMA table_info(matching_view)"))).mappings().all()

        column_names = {str(column["name"]) for column in columns}
        assert column_names == {
            "student_id",
            "skill_id",
            "source_evidence_id",
            "extraction_confidence",
            "effective_confidence",
            "verification_tier",
        }
        assert "preferred_locale" not in column_names
    finally:
        await engine.dispose()
