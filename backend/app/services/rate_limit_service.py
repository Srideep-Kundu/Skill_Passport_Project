import hashlib
import time

from fastapi import HTTPException, status
from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings


def _safe_subject(subject: str) -> str:
    """Avoid persisting raw addresses or account identifiers in Redis keys."""
    return hashlib.sha256(subject.encode()).hexdigest()


async def enforce_rate_limit(category: str, subject: str, limit: int) -> None:
    """Apply a fixed one-minute Redis limit, failing closed when Redis is configured but unavailable."""
    settings = get_settings()
    if not settings.rate_limiting_enabled:
        return
    if not settings.redis_url:
        if settings.environment == "production":
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rate limiting is temporarily unavailable")
        return

    window = int(time.time() // 60)
    key = f"skill-passport:rate-limit:{category}:{_safe_subject(subject)}:{window}"
    client = Redis.from_url(settings.redis_url)
    try:
        pipeline = client.pipeline(transaction=True)
        pipeline.incr(key)
        pipeline.expire(key, 60, nx=True)
        result = await pipeline.execute()
        attempts = int(result[0])
    except RedisError as error:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rate limiting is temporarily unavailable") from error
    finally:
        await client.aclose()

    if attempts > limit:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many requests. Please try again shortly.",
            headers={"Retry-After": "60"},
        )
