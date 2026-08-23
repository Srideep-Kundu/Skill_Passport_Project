import logging
import sys
from types import SimpleNamespace

import pytest

from app.core.config import Settings
from app.core.observability import StructuredFormatter, redact_secrets, safe_request_id
from app.main import ready
from app.services.worker_observability import parse_worker_heartbeat
from seed.reset_demo import assert_demo_reset_is_allowed


def test_jwt_secret_alias_and_safe_request_ids() -> None:
    assert Settings(JWT_SECRET="a" * 32).jwt_secret == "a" * 32
    assert safe_request_id({"x-request-id": "demo-request_42"}) == "demo-request_42"
    generated = safe_request_id({"x-request-id": "not safe!"})
    assert generated != "not safe!" and len(generated) == 36


def test_worker_heartbeat_parser_rejects_invalid_values() -> None:
    assert parse_worker_heartbeat('{"jobs_processed": 2}') == {"jobs_processed": 2}
    assert parse_worker_heartbeat("not-json") is None
    assert parse_worker_heartbeat("[]") is None


def test_structured_logging_redacts_sensitive_query_parameters_and_errors() -> None:
    fake_key = "fake-key-never-log"
    message = (
        "request failed: https://provider.test/run?key="
        f"{fake_key}&token={fake_key} api_key={fake_key} access_token={fake_key}"
    )
    assert fake_key not in redact_secrets(message)

    try:
        raise RuntimeError(message)
    except RuntimeError:
        record = logging.LogRecord(
            "test",
            logging.ERROR,
            __file__,
            1,
            message,
            (),
            exc_info=sys.exc_info(),
        )
    rendered = StructuredFormatter().format(record)
    assert fake_key not in rendered
    assert rendered.count("[REDACTED]") >= 4


def test_demo_reset_is_rejected_outside_explicit_demo_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "seed.reset_demo.get_settings",
        lambda: SimpleNamespace(
            environment="production",
            demo_reset_enabled=True,
            database_url="postgresql+asyncpg://demo",
        ),
    )
    with pytest.raises(RuntimeError, match="APP_ENV=demo"):
        assert_demo_reset_is_allowed()


@pytest.mark.asyncio
async def test_readiness_checks_database_when_redis_is_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Session:
        async def execute(self, statement: object) -> None:
            assert statement is not None

    class SessionContext:
        async def __aenter__(self) -> Session:
            return Session()

        async def __aexit__(self, *args: object) -> None:
            return None

    monkeypatch.setattr("app.main.SessionLocal", lambda: SessionContext())
    monkeypatch.setattr("app.main.get_settings", lambda: SimpleNamespace(redis_url=None))

    assert await ready() == {"status": "ready"}
