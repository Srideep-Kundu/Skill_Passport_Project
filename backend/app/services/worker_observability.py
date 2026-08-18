"""Redis-backed, non-sensitive extraction worker liveness data."""

import json
from datetime import UTC, datetime
from typing import Any

from redis.asyncio import Redis

WORKER_HEARTBEAT_KEY = "skill-passport:worker:extraction:heartbeat"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


async def publish_worker_heartbeat(
    client: Redis, *, ttl_seconds: int, state: dict[str, Any]
) -> None:
    """Overwrite an expiring heartbeat; unavailable Redis must not stop work."""
    heartbeat = {**state, "last_heartbeat_at": now_iso()}
    await client.set(WORKER_HEARTBEAT_KEY, json.dumps(heartbeat), ex=ttl_seconds)


def parse_worker_heartbeat(value: bytes | str | None) -> dict[str, Any] | None:
    if value is None:
        return None
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None
