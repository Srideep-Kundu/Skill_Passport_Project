import pytest

from app.core.config import Settings


def production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "production",
        "jwt_secret": "a" * 32,
        "database_url": "postgresql+asyncpg://user:password@db:5432/skill_passport",
        "redis_url": "redis://redis:6379/0",
        "cors_origins": ["https://app.example.test"],
    }
    values.update(overrides)
    return Settings(**values)


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"jwt_secret": "too-short"}, "JWT_SECRET"),
        ({"database_url": "sqlite+aiosqlite:///./skill_passport.db"}, "PostgreSQL"),
        ({"redis_url": None}, "REDIS_URL"),
        ({"cors_origins": ["*"]}, "CORS_ORIGINS"),
        ({"extraction_provider": "gemini", "gemini_api_key": None}, "GEMINI_API_KEY"),
        ({"semantic_matching_enabled": True}, "Semantic matching"),
    ],
)
def test_production_settings_reject_unsafe_or_missing_configuration(overrides: dict[str, object], message: str) -> None:
    with pytest.raises(RuntimeError, match=message):
        production_settings(**overrides).validate_for_runtime()


def test_development_settings_allow_local_defaults() -> None:
    Settings().validate_for_runtime()


def test_costly_operation_rate_limits_accept_documented_environment_aliases() -> None:
    settings = Settings(
        DISCOVERY_RUN_RATE_LIMIT_PER_MINUTE="7",
        APPLICATION_EXECUTION_RATE_LIMIT_PER_MINUTE="8",
    )

    assert settings.discovery_run_rate_limit_per_minute == 7
    assert settings.application_execution_rate_limit_per_minute == 8
