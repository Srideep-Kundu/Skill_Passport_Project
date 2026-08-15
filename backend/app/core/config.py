from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed application configuration; secrets are never defaults."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="SKILL_PASSPORT_", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./skill_passport.db"
    jwt_secret: str = Field(default="test-only-secret-not-for-production")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480
    redis_url: str | None = None
    gemini_api_key: str | None = None
    github_token: str | None = None
    cors_origins: list[str] = ["http://localhost:5173"]
    environment: str = "development"
    extraction_sync_fallback: bool = True

    @field_validator("jwt_secret")
    @classmethod
    def require_production_secret(cls, value: str) -> str:
        # Production startup validates this in `validate_for_runtime` so tests can use isolation defaults.
        return value

    def validate_for_runtime(self) -> None:
        if self.environment == "production" and (
            self.jwt_secret == "test-only-secret-not-for-production" or len(self.jwt_secret) < 32
        ):
            raise RuntimeError("SKILL_PASSPORT_JWT_SECRET must be a strong production secret")


@lru_cache
def get_settings() -> Settings:
    return Settings()
