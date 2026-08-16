from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed application configuration; secrets are never defaults."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SKILL_PASSPORT_",
        extra="ignore",
        populate_by_name=True,
    )

    database_url: str = Field(
        default="sqlite+aiosqlite:///./skill_passport.db",
        validation_alias=AliasChoices("SKILL_PASSPORT_DATABASE_URL", "DATABASE_URL"),
    )
    jwt_secret: str = Field(
        default="test-only-secret-not-for-production",
        validation_alias=AliasChoices("SKILL_PASSPORT_JWT_SECRET", "JWT_SECRET_KEY"),
    )
    jwt_algorithm: str = Field(default="HS256", validation_alias=AliasChoices("SKILL_PASSPORT_JWT_ALGORITHM", "JWT_ALGORITHM"))
    jwt_expire_minutes: int = Field(default=480, validation_alias=AliasChoices("SKILL_PASSPORT_JWT_EXPIRE_MINUTES", "ACCESS_TOKEN_EXPIRE_MINUTES"))
    redis_url: str | None = Field(default=None, validation_alias=AliasChoices("SKILL_PASSPORT_REDIS_URL", "REDIS_URL"))
    gemini_api_key: str | None = Field(default=None, validation_alias=AliasChoices("SKILL_PASSPORT_GEMINI_API_KEY", "GEMINI_API_KEY"))
    extraction_provider: Literal["local", "gemini"] = Field(
        default="local",
        validation_alias=AliasChoices("SKILL_PASSPORT_EXTRACTION_PROVIDER", "EXTRACTION_PROVIDER"),
    )
    github_token: str | None = Field(default=None, validation_alias=AliasChoices("SKILL_PASSPORT_GITHUB_TOKEN", "GITHUB_TOKEN"))
    embedding_provider: Literal["disabled", "gemini", "deterministic_test"] = Field(default="disabled", validation_alias=AliasChoices("SKILL_PASSPORT_EMBEDDING_PROVIDER", "EMBEDDING_PROVIDER"))
    embedding_model: str = Field(default="gemini-embedding-001", min_length=1, max_length=80, validation_alias=AliasChoices("SKILL_PASSPORT_EMBEDDING_MODEL", "EMBEDDING_MODEL"))
    embedding_dimension: int = Field(default=768, ge=128, le=3072, validation_alias=AliasChoices("SKILL_PASSPORT_EMBEDDING_DIMENSION", "EMBEDDING_DIMENSION"))
    semantic_matching_enabled: bool = Field(default=False, validation_alias=AliasChoices("SKILL_PASSPORT_SEMANTIC_MATCHING_ENABLED", "SEMANTIC_MATCHING_ENABLED"))
    semantic_similarity_threshold: float = Field(default=0.75, ge=0.0, le=1.0, validation_alias=AliasChoices("SKILL_PASSPORT_SEMANTIC_SIMILARITY_THRESHOLD", "SEMANTIC_SIMILARITY_THRESHOLD"))
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default=["http://localhost:5173"],
        validation_alias=AliasChoices("SKILL_PASSPORT_CORS_ORIGINS", "CORS_ORIGINS"),
    )
    environment: str = Field(default="development", validation_alias=AliasChoices("SKILL_PASSPORT_ENVIRONMENT", "APP_ENV"))
    extraction_sync_fallback: bool = Field(
        default=False,
        validation_alias=AliasChoices("SKILL_PASSPORT_EXTRACTION_SYNC_FALLBACK", "EXTRACTION_SYNC_FALLBACK"),
    )
    rate_limiting_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("SKILL_PASSPORT_RATE_LIMITING_ENABLED", "RATE_LIMITING_ENABLED"),
    )
    login_rate_limit_per_minute: int = Field(
        default=10,
        ge=1,
        validation_alias=AliasChoices("SKILL_PASSPORT_LOGIN_RATE_LIMIT_PER_MINUTE", "LOGIN_RATE_LIMIT_PER_MINUTE"),
    )
    registration_rate_limit_per_minute: int = Field(
        default=5,
        ge=1,
        validation_alias=AliasChoices("SKILL_PASSPORT_REGISTRATION_RATE_LIMIT_PER_MINUTE", "REGISTRATION_RATE_LIMIT_PER_MINUTE"),
    )
    extraction_rate_limit_per_minute: int = Field(
        default=10,
        ge=1,
        validation_alias=AliasChoices("SKILL_PASSPORT_EXTRACTION_RATE_LIMIT_PER_MINUTE", "EXTRACTION_RATE_LIMIT_PER_MINUTE"),
    )
    verification_rate_limit_per_minute: int = Field(
        default=10,
        ge=1,
        validation_alias=AliasChoices("SKILL_PASSPORT_VERIFICATION_RATE_LIMIT_PER_MINUTE", "VERIFICATION_RATE_LIMIT_PER_MINUTE"),
    )
    external_job_sync_rate_limit_per_minute: int = Field(
        default=5,
        ge=1,
        validation_alias=AliasChoices("SKILL_PASSPORT_EXTERNAL_JOB_SYNC_RATE_LIMIT_PER_MINUTE", "EXTERNAL_JOB_SYNC_RATE_LIMIT_PER_MINUTE"),
    )
    greenhouse_board_tokens: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        validation_alias=AliasChoices("SKILL_PASSPORT_GREENHOUSE_BOARD_TOKENS", "GREENHOUSE_BOARD_TOKENS"),
    )
    extraction_max_attempts: int = Field(
        default=3,
        ge=1,
        le=10,
        validation_alias=AliasChoices("SKILL_PASSPORT_EXTRACTION_MAX_ATTEMPTS", "EXTRACTION_MAX_ATTEMPTS"),
    )
    extraction_retry_base_seconds: int = Field(
        default=15,
        ge=1,
        le=3600,
        validation_alias=AliasChoices("SKILL_PASSPORT_EXTRACTION_RETRY_BASE_SECONDS", "EXTRACTION_RETRY_BASE_SECONDS"),
    )
    extraction_retry_max_seconds: int = Field(
        default=300,
        ge=1,
        le=86400,
        validation_alias=AliasChoices("SKILL_PASSPORT_EXTRACTION_RETRY_MAX_SECONDS", "EXTRACTION_RETRY_MAX_SECONDS"),
    )
    extraction_claim_timeout_seconds: int = Field(
        default=300,
        ge=30,
        le=86400,
        validation_alias=AliasChoices("SKILL_PASSPORT_EXTRACTION_CLAIM_TIMEOUT_SECONDS", "EXTRACTION_CLAIM_TIMEOUT_SECONDS"),
    )
    resume_storage_dir: Path = Field(default=Path("./uploads/resumes"), validation_alias=AliasChoices("SKILL_PASSPORT_RESUME_STORAGE_DIR", "RESUME_STORAGE_DIR"))
    resume_max_upload_bytes: int = Field(default=5 * 1024 * 1024, ge=1, le=25 * 1024 * 1024, validation_alias=AliasChoices("SKILL_PASSPORT_RESUME_MAX_UPLOAD_BYTES", "RESUME_MAX_UPLOAD_BYTES"))
    resume_max_extracted_characters: int = Field(default=100_000, ge=1_000, le=1_000_000, validation_alias=AliasChoices("SKILL_PASSPORT_RESUME_MAX_EXTRACTED_CHARACTERS", "RESUME_MAX_EXTRACTED_CHARACTERS"))

    @field_validator("jwt_secret")
    @classmethod
    def require_production_secret(cls, value: str) -> str:
        # Production startup validates this in `validate_for_runtime` so tests can use isolation defaults.
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def split_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("greenhouse_board_tokens", mode="before")
    @classmethod
    def split_greenhouse_board_tokens(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [token.strip() for token in value.split(",") if token.strip()]
        return value

    def validate_for_runtime(self) -> None:
        if self.environment != "production":
            return
        if self.jwt_secret == "test-only-secret-not-for-production" or len(self.jwt_secret) < 32:
            raise RuntimeError("SKILL_PASSPORT_JWT_SECRET must be a strong production secret")
        if not self.database_url.startswith(("postgresql://", "postgresql+asyncpg://", "postgresql+psycopg://")):
            raise RuntimeError("DATABASE_URL must use PostgreSQL in production")
        if not self.redis_url or not self.redis_url.startswith(("redis://", "rediss://")):
            raise RuntimeError("REDIS_URL must be configured with a Redis URL in production")
        if not self.cors_origins or any(origin == "*" or not origin.startswith("https://") for origin in self.cors_origins):
            raise RuntimeError("CORS_ORIGINS must contain exact HTTPS origins in production")
        if self.extraction_provider == "gemini" and not self.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is required when EXTRACTION_PROVIDER=gemini")
        if self.semantic_matching_enabled:
            if self.embedding_provider != "gemini" or not self.gemini_api_key:
                raise RuntimeError("Semantic matching in production requires GEMINI_API_KEY and EMBEDDING_PROVIDER=gemini")
            if self.embedding_dimension != 768:
                raise RuntimeError("EMBEDDING_DIMENSION must be 768 for the current pgvector schema")


@lru_cache
def get_settings() -> Settings:
    return Settings()
