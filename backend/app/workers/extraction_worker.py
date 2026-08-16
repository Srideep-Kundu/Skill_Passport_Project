import asyncio
import logging
from uuid import UUID

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.services.extraction_service import (
    QUEUE_NAME,
    enqueue_due_retries,
    process_evidence_job,
)

logger = logging.getLogger(__name__)


async def process_queue_item(payload: bytes) -> None:
    """Isolate malformed payloads and job-level failures from the worker loop."""
    try:
        await process_evidence_job(UUID(payload.decode()))
    except (ValueError, UnicodeDecodeError):
        logger.warning("extraction_worker_invalid_job_payload")
    except Exception:
        logger.exception("extraction_worker_job_unhandled_error")


async def run_worker() -> None:
    settings = get_settings()
    if not settings.redis_url:
        raise RuntimeError("SKILL_PASSPORT_REDIS_URL is required to run the extraction worker")
    client = Redis.from_url(settings.redis_url)
    try:
        while True:
            try:
                await enqueue_due_retries()
                item = await client.blpop(QUEUE_NAME, timeout=5)
            except RedisError:
                logger.warning("extraction_worker_redis_unavailable")
                await asyncio.sleep(1)
                continue
            if item:
                await process_queue_item(item[1])
    finally:
        await client.aclose()


if __name__ == "__main__":
    asyncio.run(run_worker())
