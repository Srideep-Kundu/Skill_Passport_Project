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
    """Apply a fixed one-minute Redis limit, failing gracefully when Redis is not running."""
    settings = get_settings()
    if not settings.rate_limiting_enabled:
        return
    if not settings.redis_url or settings.redis_url in ("redis://redis:6379/0", "redis://localhost:6379/0") and settings.environment == "production":
        # Cloud single-service deployment without managed Redis
        return

    window = int(time.time() // 60)
    key = f"skill-passport:rate-limit:{category}:{_safe_subject(subject)}:{window}"
    try:
        client = Redis.from_url(settings.redis_url, socket_connect_timeout=1.0)
        try:
            pipeline = client.pipeline(transaction=True)
            pipeline.incr(key)
            pipeline.expire(key, 60, nx=True)
            result = await pipeline.execute()
            attempts = int(result[0])
        finally:
            await client.aclose()

        if attempts > limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests. Please try again shortly.",
                headers={"Retry-After": "60"},
            )
    except RedisError:
        # Fall back gracefully so the live API remains 100% available
        return
