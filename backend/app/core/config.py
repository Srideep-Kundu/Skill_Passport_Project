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
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_JWT_SECRET", "JWT_SECRET", "JWT_SECRET_KEY"
        ),
    )
    jwt_algorithm: str = Field(
        default="HS256",
        validation_alias=AliasChoices("SKILL_PASSPORT_JWT_ALGORITHM", "JWT_ALGORITHM"),
    )
    jwt_expire_minutes: int = Field(
        default=480,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_JWT_EXPIRE_MINUTES", "ACCESS_TOKEN_EXPIRE_MINUTES"
        ),
    )
    redis_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SKILL_PASSPORT_REDIS_URL", "REDIS_URL"),
    )
    gemini_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_GEMINI_API_KEY", "GEMINI_API_KEY"
        ),
    )
    groq_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_GROQ_API_KEY", "GROQ_API_KEY"
        ),
    )
    cohere_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_COHERE_API_KEY", "COHERE_API_KEY"
        ),
    )
    openrouter_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_OPENROUTER_API_KEY", "OPENROUTER_API_KEY"
        ),
    )
    extraction_provider: Literal[
        "local", "gemini", "groq", "cohere", "openrouter"
    ] = Field(
        default="local",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_PROVIDER", "EXTRACTION_PROVIDER"
        ),
    )
    extraction_model: str = Field(
        default="gemini-3.6-flash",
        min_length=1,
        max_length=80,
        pattern=r"^[A-Za-z0-9._-]+$",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_MODEL", "EXTRACTION_MODEL"
        ),
    )
    groq_extraction_model: str = Field(
        default="openai/gpt-oss-20b",
        min_length=1,
        max_length=100,
        pattern=r"^[A-Za-z0-9._/-]+$",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_GROQ_EXTRACTION_MODEL", "GROQ_EXTRACTION_MODEL"
        ),
    )
    cohere_extraction_model: str = Field(
        default="command-a-03-2025",
        min_length=1,
        max_length=100,
        pattern=r"^[A-Za-z0-9._/-]+$",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_COHERE_EXTRACTION_MODEL", "COHERE_EXTRACTION_MODEL"
        ),
    )
    openrouter_extraction_model: str = Field(
        default="openai/gpt-oss-120b",
        min_length=1,
        max_length=120,
        pattern=r"^[A-Za-z0-9._:/-]+$",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_OPENROUTER_EXTRACTION_MODEL",
            "OPENROUTER_EXTRACTION_MODEL",
        ),
    )
    hf_extraction_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_HF_EXTRACTION_ENABLED", "HF_EXTRACTION_ENABLED"
        ),
    )
    hf_extraction_endpoint: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_HF_EXTRACTION_ENDPOINT", "HF_EXTRACTION_ENDPOINT"
        ),
    )
    hf_extraction_model: str = Field(
        default="microsoft/Phi-4-mini-instruct",
        min_length=1,
        max_length=120,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_HF_EXTRACTION_MODEL", "HF_EXTRACTION_MODEL"
        ),
    )
    hf_extraction_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_HF_EXTRACTION_API_KEY", "HF_EXTRACTION_API_KEY"
        ),
    )
    hf_extraction_timeout_seconds: int = Field(
        default=30,
        ge=1,
        le=300,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_HF_EXTRACTION_TIMEOUT_SECONDS",
            "HF_EXTRACTION_TIMEOUT_SECONDS",
        ),
    )
    extraction_fallback_providers: Annotated[
        list[Literal["local", "gemini", "groq", "cohere", "openrouter"]],
        NoDecode,
    ] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_FALLBACK_PROVIDERS",
            "EXTRACTION_FALLBACK_PROVIDERS",
        ),
    )
    extraction_rag_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_RAG_ENABLED", "EXTRACTION_RAG_ENABLED"
        ),
    )
    extraction_rag_top_k: int = Field(
        default=8,
        ge=1,
        le=30,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_RAG_TOP_K", "EXTRACTION_RAG_TOP_K"
        ),
    )
    extraction_rag_min_similarity: float = Field(
        default=0.72,
        ge=0.0,
        le=1.0,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_RAG_MIN_SIMILARITY",
            "EXTRACTION_RAG_MIN_SIMILARITY",
        ),
    )
    extraction_cache_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_CACHE_ENABLED",
            "EXTRACTION_CACHE_ENABLED",
        ),
    )
    extraction_batch_max_units: int = Field(
        default=12,
        ge=1,
        le=30,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_BATCH_MAX_UNITS",
            "EXTRACTION_BATCH_MAX_UNITS",
        ),
    )
    extraction_batch_max_characters: int = Field(
        default=12_000,
        ge=1_500,
        le=50_000,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_BATCH_MAX_CHARACTERS",
            "EXTRACTION_BATCH_MAX_CHARACTERS",
        ),
    )
    extraction_schema_version: str = Field(
        default="v2-hybrid-batch",
        min_length=1,
        max_length=40,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_SCHEMA_VERSION",
            "EXTRACTION_SCHEMA_VERSION",
        ),
    )
    github_token: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SKILL_PASSPORT_GITHUB_TOKEN", "GITHUB_TOKEN"),
    )
    google_client_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SKILL_PASSPORT_GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_ID"),
    )
    institution_registration_allowlist: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_INSTITUTION_REGISTRATION_ALLOWLIST",
            "INSTITUTION_REGISTRATION_ALLOWLIST",
        ),
    )
    embedding_provider: Literal["disabled", "gemini", "deterministic_test"] = Field(
        default="disabled",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EMBEDDING_PROVIDER", "EMBEDDING_PROVIDER"
        ),
    )
    embedding_model: str = Field(
        default="gemini-embedding-001",
        min_length=1,
        max_length=80,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EMBEDDING_MODEL", "EMBEDDING_MODEL"
        ),
    )
    embedding_dimension: int = Field(
        default=768,
        ge=128,
        le=3072,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EMBEDDING_DIMENSION", "EMBEDDING_DIMENSION"
        ),
    )
    semantic_matching_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_SEMANTIC_MATCHING_ENABLED", "SEMANTIC_MATCHING_ENABLED"
        ),
    )
    semantic_similarity_threshold: float = Field(
        default=0.75,
        ge=0.0,
        le=1.0,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_SEMANTIC_SIMILARITY_THRESHOLD",
            "SEMANTIC_SIMILARITY_THRESHOLD",
        ),
    )
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default=["http://localhost:5173"],
        validation_alias=AliasChoices("SKILL_PASSPORT_CORS_ORIGINS", "CORS_ORIGINS"),
    )
    environment: str = Field(
        default="development",
        validation_alias=AliasChoices("SKILL_PASSPORT_ENVIRONMENT", "APP_ENV"),
    )
    log_level: str = Field(
        default="INFO",
        validation_alias=AliasChoices("SKILL_PASSPORT_LOG_LEVEL", "LOG_LEVEL"),
    )
    worker_heartbeat_ttl_seconds: int = Field(
        default=30,
        ge=10,
        le=3600,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_WORKER_HEARTBEAT_TTL_SECONDS",
            "WORKER_HEARTBEAT_TTL_SECONDS",
        ),
    )
    demo_reset_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_DEMO_RESET_ENABLED", "DEMO_RESET_ENABLED"
        ),
    )
    extraction_sync_fallback: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_SYNC_FALLBACK", "EXTRACTION_SYNC_FALLBACK"
        ),
    )
    rate_limiting_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_RATE_LIMITING_ENABLED", "RATE_LIMITING_ENABLED"
        ),
    )
    login_rate_limit_per_minute: int = Field(
        default=10,
        ge=1,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_LOGIN_RATE_LIMIT_PER_MINUTE", "LOGIN_RATE_LIMIT_PER_MINUTE"
        ),
    )
    registration_rate_limit_per_minute: int = Field(
        default=5,
        ge=1,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_REGISTRATION_RATE_LIMIT_PER_MINUTE",
            "REGISTRATION_RATE_LIMIT_PER_MINUTE",
        ),
    )
    extraction_rate_limit_per_minute: int = Field(
        default=10,
        ge=1,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_RATE_LIMIT_PER_MINUTE",
            "EXTRACTION_RATE_LIMIT_PER_MINUTE",
        ),
    )
    verification_rate_limit_per_minute: int = Field(
        default=10,
        ge=1,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_VERIFICATION_RATE_LIMIT_PER_MINUTE",
            "VERIFICATION_RATE_LIMIT_PER_MINUTE",
        ),
    )
    external_job_sync_rate_limit_per_minute: int = Field(
        default=5,
        ge=1,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTERNAL_JOB_SYNC_RATE_LIMIT_PER_MINUTE",
            "EXTERNAL_JOB_SYNC_RATE_LIMIT_PER_MINUTE",
        ),
    )
    discovery_run_rate_limit_per_minute: int = Field(
        default=10,
        ge=1,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_DISCOVERY_RUN_RATE_LIMIT_PER_MINUTE",
            "DISCOVERY_RUN_RATE_LIMIT_PER_MINUTE",
        ),
    )
    application_execution_rate_limit_per_minute: int = Field(
        default=10,
        ge=1,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_APPLICATION_EXECUTION_RATE_LIMIT_PER_MINUTE",
            "APPLICATION_EXECUTION_RATE_LIMIT_PER_MINUTE",
        ),
    )
    external_job_min_match_score: float = Field(
        default=0.2,
        ge=0.0,
        le=1.0,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_MIN_EXTERNAL_JOB_MATCH_SCORE",
            "MIN_EXTERNAL_JOB_MATCH_SCORE",
        ),
    )
    greenhouse_board_tokens: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_GREENHOUSE_BOARD_TOKENS", "GREENHOUSE_BOARD_TOKENS"
        ),
    )
    lever_site_tokens: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_LEVER_SITE_TOKENS", "LEVER_SITE_TOKENS"
        ),
    )
    ashby_job_board_names: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_ASHBY_JOB_BOARD_NAMES", "ASHBY_JOB_BOARD_NAMES"
        ),
    )
    yc_source_keys: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["yc_startups"],
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_YC_SOURCE_KEYS", "YC_SOURCE_KEYS"
        ),
    )
    discovery_max_active_per_student: int = Field(
        default=10,
        ge=1,
        le=25,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_DISCOVERY_MAX_ACTIVE_PER_STUDENT",
            "DISCOVERY_MAX_ACTIVE_PER_STUDENT",
        ),
    )
    greenhouse_application_credentials: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_GREENHOUSE_APPLICATION_CREDENTIALS",
            "GREENHOUSE_APPLICATION_CREDENTIALS",
        ),
    )
    lever_application_credentials: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_LEVER_APPLICATION_CREDENTIALS",
            "LEVER_APPLICATION_CREDENTIALS",
        ),
    )
    provider_submission_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_PROVIDER_SUBMISSION_ENABLED", "PROVIDER_SUBMISSION_ENABLED"
        ),
    )
    lever_submission_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_LEVER_SUBMISSION_ENABLED", "LEVER_SUBMISSION_ENABLED"
        ),
    )
    application_execution_mode: Literal["assisted", "staging_submit"] = Field(
        default="assisted",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_APPLICATION_EXECUTION_MODE", "APPLICATION_EXECUTION_MODE"
        ),
    )
    extraction_max_attempts: int = Field(
        default=3,
        ge=1,
        le=10,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_MAX_ATTEMPTS", "EXTRACTION_MAX_ATTEMPTS"
        ),
    )
    extraction_retry_base_seconds: int = Field(
        default=15,
        ge=1,
        le=3600,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_RETRY_BASE_SECONDS",
            "EXTRACTION_RETRY_BASE_SECONDS",
        ),
    )
    extraction_retry_max_seconds: int = Field(
        default=300,
        ge=1,
        le=86400,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_RETRY_MAX_SECONDS",
            "EXTRACTION_RETRY_MAX_SECONDS",
        ),
    )
    extraction_claim_timeout_seconds: int = Field(
        default=300,
        ge=30,
        le=86400,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_EXTRACTION_CLAIM_TIMEOUT_SECONDS",
            "EXTRACTION_CLAIM_TIMEOUT_SECONDS",
        ),
    )
    resume_storage_dir: Path = Field(
        default=Path("./uploads/resumes"),
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_RESUME_STORAGE_DIR", "RESUME_STORAGE_DIR"
        ),
    )
    resume_max_upload_bytes: int = Field(
        default=5 * 1024 * 1024,
        ge=1,
        le=25 * 1024 * 1024,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_RESUME_MAX_UPLOAD_BYTES", "RESUME_MAX_UPLOAD_BYTES"
        ),
    )
    resume_max_extracted_characters: int = Field(
        default=100_000,
        ge=1_000,
        le=1_000_000,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_RESUME_MAX_EXTRACTED_CHARACTERS",
            "RESUME_MAX_EXTRACTED_CHARACTERS",
        ),
    )
    linkedin_storage_dir: Path = Field(
        default=Path("./uploads/linkedin"),
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_LINKEDIN_STORAGE_DIR", "LINKEDIN_STORAGE_DIR"
        ),
    )
    linkedin_max_upload_bytes: int = Field(
        default=10 * 1024 * 1024,
        ge=1,
        le=50 * 1024 * 1024,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_LINKEDIN_MAX_UPLOAD_BYTES", "LINKEDIN_MAX_UPLOAD_BYTES"
        ),
    )
    frontend_url: str = Field(
        default="http://localhost:5173",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_FRONTEND_URL", "FRONTEND_URL"
        ),
    )
    smtp_host: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SKILL_PASSPORT_SMTP_HOST", "SMTP_HOST"),
    )
    smtp_port: int = Field(
        default=587,
        validation_alias=AliasChoices("SKILL_PASSPORT_SMTP_PORT", "SMTP_PORT"),
    )
    smtp_username: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_SMTP_USERNAME", "SMTP_USER", "SMTP_USERNAME"
        ),
    )
    smtp_password: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_SMTP_PASSWORD", "SMTP_PASS", "SMTP_PASSWORD"
        ),
    )
    smtp_from_email: str = Field(
        default="noreply@skillpassport.dev",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_SMTP_FROM_EMAIL", "SMTP_FROM_EMAIL"
        ),
    )
    smtp_from_name: str = Field(
        default="Lumina Intel Verification",
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_SMTP_FROM_NAME", "SMTP_FROM_NAME"
        ),
    )
    smtp_use_tls: bool = Field(
        default=True,
        validation_alias=AliasChoices("SKILL_PASSPORT_SMTP_USE_TLS", "SMTP_USE_TLS"),
    )
    smtp_use_ssl: bool = Field(
        default=False,
        validation_alias=AliasChoices("SKILL_PASSPORT_SMTP_USE_SSL", "SMTP_USE_SSL"),
    )
    password_reset_expire_minutes: int = Field(
        default=30,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_PASSWORD_RESET_EXPIRE_MINUTES",
            "PASSWORD_RESET_EXPIRE_MINUTES",
        ),
    )
    forgot_password_rate_limit_per_minute: int = Field(
        default=5,
        validation_alias=AliasChoices(
            "SKILL_PASSPORT_FORGOT_PASSWORD_RATE_LIMIT_PER_MINUTE",
            "FORGOT_PASSWORD_RATE_LIMIT_PER_MINUTE",
        ),
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

    @field_validator("greenhouse_board_tokens", mode="before")
    @classmethod
    def split_greenhouse_board_tokens(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [token.strip() for token in value.split(",") if token.strip()]
        return value

    @field_validator("lever_site_tokens", mode="before")
    @classmethod
    def split_lever_site_tokens(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [token.strip() for token in value.split(",") if token.strip()]
        return value

    @field_validator("ashby_job_board_names", mode="before")
    @classmethod
    def split_ashby_job_board_names(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [name.strip() for name in value.split(",") if name.strip()]
        return value

    @field_validator("extraction_fallback_providers", mode="before")
    @classmethod
    def split_extraction_fallback_providers(
        cls, value: str | list[str]
    ) -> list[str]:
        providers = value.split(",") if isinstance(value, str) else value
        return [provider.strip().casefold() for provider in providers if provider.strip()]

    @field_validator("institution_registration_allowlist", mode="before")
    @classmethod
    def split_institution_registration_allowlist(
        cls, value: str | list[str]
    ) -> list[str]:
        if isinstance(value, str):
            return [email.strip().casefold() for email in value.split(",") if email.strip()]
        return [email.strip().casefold() for email in value if email.strip()]

    @field_validator("yc_source_keys", mode="before")
    @classmethod
    def split_yc_source_keys(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [k.strip() for k in value.split(",") if k.strip()]
        return value

    def validate_for_runtime(self) -> None:
        if self.environment != "production":
            return
        if (
            self.jwt_secret == "test-only-secret-not-for-production"
            or len(self.jwt_secret) < 32
        ):
            raise RuntimeError(
                "SKILL_PASSPORT_JWT_SECRET must be a strong production secret"
            )
        if not self.database_url.startswith(
            ("postgresql://", "postgresql+asyncpg://", "postgresql+psycopg://")
        ):
            raise RuntimeError("DATABASE_URL must use PostgreSQL in production")
        if not self.redis_url or not self.redis_url.startswith(
            ("redis://", "rediss://")
        ):
            raise RuntimeError(
                "REDIS_URL must be configured with a Redis URL in production"
            )
        if not self.cors_origins or any(
            origin == "*" or not origin.startswith("https://")
            for origin in self.cors_origins
        ):
            raise RuntimeError(
                "CORS_ORIGINS must contain exact HTTPS origins in production"
            )
        if not self.google_client_id:
            raise RuntimeError("GOOGLE_CLIENT_ID is required in production")
        if self.extraction_provider == "gemini" and not self.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is required when EXTRACTION_PROVIDER=gemini"
            )
        if self.extraction_provider == "groq" and not self.groq_api_key:
            raise RuntimeError(
                "GROQ_API_KEY is required when EXTRACTION_PROVIDER=groq"
            )
        configured_chain = {
            self.extraction_provider,
            *self.extraction_fallback_providers,
        }
        required_keys = {
            "gemini": self.gemini_api_key,
            "groq": self.groq_api_key,
            "cohere": self.cohere_api_key,
            "openrouter": self.openrouter_api_key,
        }
        missing = sorted(
            provider
            for provider, key in required_keys.items()
            if provider in configured_chain and not key
        )
        if missing:
            raise RuntimeError(
                "Missing extraction provider configuration: " + ", ".join(missing)
            )
        if self.hf_extraction_enabled and not self.hf_extraction_endpoint:
            raise RuntimeError(
                "HF_EXTRACTION_ENDPOINT is required when HF extraction is enabled"
            )
        if self.semantic_matching_enabled:
            if self.embedding_provider != "gemini" or not self.gemini_api_key:
                raise RuntimeError(
                    "Semantic matching in production requires GEMINI_API_KEY and EMBEDDING_PROVIDER=gemini"
                )
            if self.embedding_dimension != 768:
                raise RuntimeError(
                    "EMBEDDING_DIMENSION must be 768 for the current pgvector schema"
                )
        if (
            self.provider_submission_enabled
            or self.lever_submission_enabled
            or self.application_execution_mode == "staging_submit"
        ):
            raise RuntimeError(
                "Controlled provider submission is permitted only in an explicitly configured staging environment"
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
