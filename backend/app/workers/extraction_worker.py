import asyncio
from uuid import UUID

from redis.asyncio import Redis

from app.core.config import get_settings
from app.services.extraction_service import process_evidence_job


async def run_worker() -> None:
    settings = get_settings()
    if not settings.redis_url:
        raise RuntimeError("SKILL_PASSPORT_REDIS_URL is required to run the extraction worker")
    client = Redis.from_url(settings.redis_url)
    try:
        while True:
            item = await client.blpop("skill-passport:extraction", timeout=5)
            if item:
                await process_evidence_job(UUID(item[1].decode()))
    finally:
        await client.aclose()


if __name__ == "__main__":
    asyncio.run(run_worker())
