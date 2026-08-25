import pytest

from app.core.config import Settings


def production_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "environment": "production",
        "jwt_secret": "a" * 32,
        "database_url": "postgresql+asyncpg://user:password@db:5432/skill_passport",
        "redis_url": "redis://redis:6379/0",
        "cors_origins": ["https://app.example.test"],
        "google_client_id": "public-web-client-id.apps.googleusercontent.com",
        "embedding_provider": "disabled",
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
        ({"google_client_id": None}, "GOOGLE_CLIENT_ID"),
        ({"extraction_provider": "gemini", "gemini_api_key": None}, "GEMINI_API_KEY"),
        ({"extraction_provider": "groq", "groq_api_key": None}, "GROQ_API_KEY"),
        ({"extraction_provider": "cohere", "cohere_api_key": None}, "cohere"),
        (
            {
                "extraction_provider": "local",
                "extraction_fallback_providers": ["openrouter"],
                "openrouter_api_key": None,
            },
            "openrouter",
        ),
        ({"hf_extraction_enabled": True}, "HF_EXTRACTION_ENDPOINT"),
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


def test_groq_extraction_configuration_keeps_gemini_embeddings_independent() -> None:
    settings = Settings(
        EXTRACTION_PROVIDER="groq",
        EXTRACTION_FALLBACK_PROVIDERS="gemini,local",
        GROQ_API_KEY="test-groq-key",
        GROQ_EXTRACTION_MODEL="openai/gpt-oss-20b",
        EMBEDDING_PROVIDER="gemini",
        EMBEDDING_MODEL="gemini-embedding-001",
        EMBEDDING_DIMENSION="768",
    )

    assert settings.extraction_provider == "groq"
    assert settings.extraction_fallback_providers == ["gemini", "local"]
    assert settings.groq_extraction_model == "openai/gpt-oss-20b"
    assert settings.embedding_provider == "gemini"
    assert settings.embedding_model == "gemini-embedding-001"
    assert settings.embedding_dimension == 768


def test_complete_external_chain_parses_without_changing_embedding_configuration() -> None:
    settings = Settings(
        EXTRACTION_PROVIDER="cohere",
        EXTRACTION_FALLBACK_PROVIDERS="groq,openrouter,gemini,local",
        COHERE_API_KEY="cohere-test",
        GROQ_API_KEY="groq-test",
        OPENROUTER_API_KEY="openrouter-test",
        GEMINI_API_KEY="gemini-test",
        EMBEDDING_PROVIDER="gemini",
        EMBEDDING_MODEL="gemini-embedding-001",
        EMBEDDING_DIMENSION="768",
    )

    assert settings.extraction_fallback_providers == [
        "groq",
        "openrouter",
        "gemini",
        "local",
    ]
    assert settings.embedding_model == "gemini-embedding-001"
    assert settings.embedding_dimension == 768
