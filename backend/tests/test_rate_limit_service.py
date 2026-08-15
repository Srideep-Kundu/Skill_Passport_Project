from types import SimpleNamespace
from typing import ClassVar

import pytest
from fastapi import HTTPException
from redis.exceptions import RedisError

from app.services import rate_limit_service


class FakePipeline:
    def __init__(self, values: dict[str, int]) -> None:
        self.values = values
        self.key = ""

    def incr(self, key: str) -> None:
        self.key = key

    def expire(self, _key: str, _seconds: int, *, nx: bool) -> None:
        assert nx

    async def execute(self) -> list[object]:
        self.values[self.key] = self.values.get(self.key, 0) + 1
        return [self.values[self.key], True]


class FakeRedis:
    values: ClassVar[dict[str, int]] = {}

    @classmethod
    def from_url(cls, _url: str) -> "FakeRedis":
        return cls()

    def pipeline(self, *, transaction: bool) -> FakePipeline:
        assert transaction
        return FakePipeline(self.values)

    async def aclose(self) -> None:
        return None


class UnavailableRedis(FakeRedis):
    def pipeline(self, *, transaction: bool) -> FakePipeline:
        raise RedisError("unavailable")


@pytest.mark.asyncio
async def test_redis_rate_limit_returns_429_after_configured_limit(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeRedis.values = {}
    monkeypatch.setattr(rate_limit_service, "Redis", FakeRedis)
    monkeypatch.setattr(
        rate_limit_service,
        "get_settings",
        lambda: SimpleNamespace(rate_limiting_enabled=True, redis_url="redis://test", environment="test"),
    )

    await rate_limit_service.enforce_rate_limit("login", "127.0.0.1", 1)
    with pytest.raises(HTTPException) as raised:
        await rate_limit_service.enforce_rate_limit("login", "127.0.0.1", 1)

    assert raised.value.status_code == 429
    assert raised.value.headers == {"Retry-After": "60"}


@pytest.mark.asyncio
async def test_rate_limit_is_not_required_without_redis_in_development(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        rate_limit_service,
        "get_settings",
        lambda: SimpleNamespace(rate_limiting_enabled=True, redis_url=None, environment="development"),
    )

    await rate_limit_service.enforce_rate_limit("login", "127.0.0.1", 1)


@pytest.mark.asyncio
async def test_rate_limit_fails_closed_when_configured_redis_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rate_limit_service, "Redis", UnavailableRedis)
    monkeypatch.setattr(
        rate_limit_service,
        "get_settings",
        lambda: SimpleNamespace(rate_limiting_enabled=True, redis_url="redis://test", environment="production"),
    )

    with pytest.raises(HTTPException) as raised:
        await rate_limit_service.enforce_rate_limit("login", "127.0.0.1", 1)

    assert raised.value.status_code == 503
