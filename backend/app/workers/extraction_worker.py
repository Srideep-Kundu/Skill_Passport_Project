import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.services.discovery_service import run_due_discoveries
from app.services.extraction_service import (
    QUEUE_NAME,
    enqueue_due_retries,
    process_evidence_job,
)
from app.services.worker_observability import publish_worker_heartbeat

logger = logging.getLogger(__name__)


async def process_queue_item(payload: bytes) -> bool:
    """Isolate malformed payloads and job-level failures from the worker loop."""
    try:
        await process_evidence_job(UUID(payload.decode()))
        return True
    except (ValueError, UnicodeDecodeError):
        logger.warning("extraction_worker_invalid_job_payload")
        return False
    except Exception:
        logger.exception("extraction_worker_job_unhandled_error")
        return False


async def run_worker() -> None:
    settings = get_settings()
    if not settings.redis_url:
        raise RuntimeError("SKILL_PASSPORT_REDIS_URL is required to run the extraction worker")
    client = Redis.from_url(settings.redis_url)
    discovery_tick = 0
    started_at = datetime.now(UTC).isoformat()
    jobs_processed = 0
    jobs_failed = 0
    last_successful_job_at: str | None = None
    last_failed_job_at: str | None = None
    logger.info("extraction_worker_started", extra={"event": "extraction_worker_started"})
    try:
        while True:
            try:
                await publish_worker_heartbeat(
                    client,
                    ttl_seconds=settings.worker_heartbeat_ttl_seconds,
                    state={
                        "started_at": started_at,
                        "jobs_processed": jobs_processed,
                        "jobs_failed": jobs_failed,
                        "last_successful_job_at": last_successful_job_at,
                        "last_failed_job_at": last_failed_job_at,
                    },
                )
                await enqueue_due_retries()
                discovery_tick += 1
                if discovery_tick >= 12:
                    discovery_tick = 0
                    async with SessionLocal() as session:
                        await run_due_discoveries(session)
                item = await client.blpop(QUEUE_NAME, timeout=5)
            except RedisError:
                logger.warning("extraction_worker_redis_unavailable")
                await asyncio.sleep(1)
                continue
            if item:
                succeeded = await process_queue_item(item[1])
                jobs_processed += 1
                if succeeded:
                    last_successful_job_at = datetime.now(UTC).isoformat()
                else:
                    jobs_failed += 1
                    last_failed_job_at = datetime.now(UTC).isoformat()
    finally:
        await client.aclose()


if __name__ == "__main__":
    asyncio.run(run_worker())
