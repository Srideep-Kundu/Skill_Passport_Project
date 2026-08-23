from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import require_role
from app.models import Admin, ResumeDocument
from app.services.extraction_service import extraction_metrics_for_resume
from app.services.worker_observability import (
    WORKER_HEARTBEAT_KEY,
    parse_worker_heartbeat,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/extraction-metrics/{resume_document_id}")
async def extraction_metrics(
    resume_document_id: UUID,
    principal: Annotated[Admin, Depends(require_role("admin"))],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, object]:
    """Summarize quota use without exposing evidence or provider request bodies."""
    if await session.get(ResumeDocument, resume_document_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found")
    return await extraction_metrics_for_resume(session, resume_document_id)


@router.get("/worker-status")
async def worker_status(
    principal: Annotated[Admin, Depends(require_role("admin"))],
) -> dict[str, object]:
    """Return an operational heartbeat without exposing job payloads or secrets."""
    settings = get_settings()
    if not settings.redis_url:
        return {"status": "unconfigured", "heartbeat": None}
    client = Redis.from_url(settings.redis_url)
    try:
        heartbeat = parse_worker_heartbeat(await client.get(WORKER_HEARTBEAT_KEY))
    except RedisError:
        return {"status": "unavailable", "heartbeat": None}
    finally:
        await client.aclose()
    return {"status": "healthy" if heartbeat else "stale", "heartbeat": heartbeat}


@router.get("/fairness-audit")
async def fairness_audit(principal: Annotated[Admin, Depends(require_role("admin"))], session: Annotated[AsyncSession, Depends(get_session)]) -> dict[str, dict[str, float]]:
    """Privileged audit only; university is never a matching input."""
    rows = (await session.execute(text("""SELECT COALESCE(s.university, 'unspecified') AS university, AVG(m.final_score) AS average_score
                                         FROM matches m JOIN students s ON s.id = m.student_id
                                         GROUP BY s.university ORDER BY university"""))).mappings().all()
    return {"score_by_university": {str(row["university"]): float(row["average_score"]) for row in rows}}
