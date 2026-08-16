from functools import lru_cache
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
