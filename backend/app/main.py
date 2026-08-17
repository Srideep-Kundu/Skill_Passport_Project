from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    admin,
    applications,
    auth,
    evidence,
    external_job_matches,
    external_jobs,
    internships,
    job_discoveries,
    matches,
    passport,
    resumes,
    skills,
    teams,
)
from app.core.config import get_settings
from app.core.db import create_schema_for_local_use


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.validate_for_runtime()
    if settings.database_url.startswith("sqlite"):
        await create_schema_for_local_use()
    yield


settings = get_settings()
app = FastAPI(title="Skill Passport API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=False, allow_methods=["*"], allow_headers=["Authorization", "Content-Type"])
app.include_router(auth.router)
app.include_router(applications.router)
app.include_router(job_discoveries.router)
app.include_router(passport.router)
app.include_router(evidence.router)
app.include_router(external_job_matches.router)
app.include_router(external_jobs.router)
app.include_router(resumes.router)
app.include_router(skills.router)
app.include_router(internships.router)
app.include_router(matches.router)
app.include_router(teams.router)
app.include_router(admin.router)


@app.get("/health", tags=["operations"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
