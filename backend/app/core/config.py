from functools import lru_cache
from typing import Annotated

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
    github_token: str | None = Field(default=None, validation_alias=AliasChoices("SKILL_PASSPORT_GITHUB_TOKEN", "GITHUB_TOKEN"))
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default=["http://localhost:5173"],
        validation_alias=AliasChoices("SKILL_PASSPORT_CORS_ORIGINS", "CORS_ORIGINS"),
    )
    environment: str = Field(default="development", validation_alias=AliasChoices("SKILL_PASSPORT_ENVIRONMENT", "APP_ENV"))
    extraction_sync_fallback: bool = True

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
        if self.environment == "production" and (
            self.jwt_secret == "test-only-secret-not-for-production" or len(self.jwt_secret) < 32
        ):
            raise RuntimeError("SKILL_PASSPORT_JWT_SECRET must be a strong production secret")


@lru_cache
def get_settings() -> Settings:
    return Settings()
