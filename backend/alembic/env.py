from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from app import models  # noqa: F401
from app.core.config import get_settings
from app.core.db import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata

# These pgvector indexes are created explicitly by the initial migration because
# SQLAlchemy metadata cannot represent their production IVFFlat configuration
# without also making Base.metadata.create_all() create them twice in 0001.
MIGRATION_MANAGED_INDEXES = {
    "ix_internships_embedding_cosine",
    "ix_skills_embedding_cosine",
}


def include_object(object_: object, name: str | None, type_: str, reflected: bool, compare_to: object | None) -> bool:
    """Exclude migration-managed pgvector indexes from autogenerate drift checks."""
    del object_, compare_to
    return not (type_ == "index" and reflected and name in MIGRATION_MANAGED_INDEXES)


def sync_database_url() -> str:
    """Alembic runs through a synchronous driver while the API uses async SQLAlchemy."""
    return (
        get_settings()
        .database_url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
        .replace("sqlite+aiosqlite://", "sqlite://")
    )


def run_migrations_offline() -> None:
    context.configure(
        url=sync_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    config.set_main_option("sqlalchemy.url", sync_database_url())
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
