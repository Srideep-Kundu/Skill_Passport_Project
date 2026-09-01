import logging
import re
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api import (
    academicians,
    achievements,
    admin,
    applications,
    assessments,
    auth,
    automation_policies,
    career_goals,
    career_guidance,
    collaborations,
    copilot,
    documents,
    evidence,
    external_job_matches,
    external_jobs,
    institution_analytics,
    institution_imports,
    internship_engagements,
    internships,
    job_discoveries,
    learning,
    linkedin,
    matches,
    passport,
    placements,
    recruiter_analytics,
    resumes,
    skill_gaps,
    skills,
    student_applications,
    teams,
)
from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.observability import (
    configure_logging,
    request_id_context,
    safe_request_id,
)

logger = logging.getLogger(__name__)
PUBLIC_SHARE_PATH = re.compile(r"^/public/passports/[^/]+")


def _safe_log_path(path: str) -> str:
    """Keep revocable bearer-style share tokens out of application logs."""
    return PUBLIC_SHARE_PATH.sub("/public/passports/[redacted]", path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    settings.validate_for_runtime()
    try:
        from app import models  # noqa: F401 - registers all tables
        from app.core.db import Base, create_matching_view, engine

        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            await conn.run_sync(Base.metadata.create_all)
            await create_matching_view(conn)
        try:
            from seed.seed_demo_data import seed_demo_data
            from seed.seed_sih_ecosystem import seed_sih_ecosystem
            from seed.seed_skills import seed_skills

            await seed_skills()
            await seed_demo_data()
            await seed_sih_ecosystem()
        except Exception as seed_err:
            logger.info("seed_notice", extra={"detail": str(seed_err)})
    except Exception:  # noqa: BLE001 - preserve teammate fail-soft startup behavior
        logger.warning("database_schema_auto_creation_notice")
    yield


settings = get_settings()
app = FastAPI(title="Skill Passport API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(copilot.router)
app.include_router(career_goals.router)
app.include_router(career_guidance.router)
app.include_router(skill_gaps.router)
app.include_router(assessments.router)
app.include_router(learning.router)
app.include_router(placements.router)
app.include_router(internship_engagements.router)
app.include_router(academicians.router)
app.include_router(institution_analytics.router)
app.include_router(institution_imports.router)
app.include_router(collaborations.router)
app.include_router(documents.router)
app.include_router(achievements.router)
app.include_router(recruiter_analytics.router)
app.include_router(applications.router)
app.include_router(automation_policies.router)
app.include_router(automation_policies.queue_router)
app.include_router(job_discoveries.router)
app.include_router(passport.router)
app.include_router(passport.public_router)
app.include_router(evidence.router)
app.include_router(external_job_matches.router)
app.include_router(external_jobs.router)
app.include_router(resumes.router)
app.include_router(linkedin.router)
app.include_router(skills.router)
app.include_router(internships.router)
app.include_router(matches.router)
app.include_router(student_applications.router)
app.include_router(teams.router)
app.include_router(admin.router)


@app.middleware("http")
async def correlation_and_access_log(request: Request, call_next):
    """Attach an opaque request ID and emit metadata-only request completion logs."""
    request_id = safe_request_id(request.headers)
    token = request_id_context.set(request_id)
    started = time.perf_counter()
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request_completed",
            extra={
                "event": "request_completed",
                "method": request.method,
                "path": _safe_log_path(request.url.path),
                "status_code": response.status_code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 2),
            },
        )
        return response
    finally:
        request_id_context.reset(token)


@app.exception_handler(HTTPException)
async def safe_http_exception(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": request_id_context.get()},
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def safe_validation_exception(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "detail": jsonable_encoder(exc.errors()),
            "request_id": request_id_context.get(),
        },
    )


@app.exception_handler(Exception)
async def safe_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "unhandled_request_error",
        extra={
            "event": "unhandled_request_error",
            "method": request.method,
            "path": _safe_log_path(request.url.path),
        },
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "request_id": request_id_context.get(),
        },
    )


@app.get("/health", tags=["operations"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", tags=["operations"])
async def ready() -> dict[str, str]:
    """Check only the dependencies required to serve authenticated requests."""
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        settings = get_settings()
        if settings.redis_url:
            client = Redis.from_url(settings.redis_url)
            try:
                await client.ping()
            finally:
                await client.aclose()
    except (RedisError, OSError, RuntimeError, SQLAlchemyError):
        logger.warning(
            "readiness_dependency_unavailable",
            extra={"event": "readiness_dependency_unavailable"},
        )
        raise HTTPException(
            status_code=503, detail="Service dependencies unavailable"
        ) from None
    return {"status": "ready"}
