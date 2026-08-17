"""Minimal, privacy-safe runtime observability helpers."""

import contextvars
import json
import logging
import sys
from collections.abc import Mapping
from uuid import uuid4

request_id_context: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "request_id", default=None
)


def new_request_id() -> str:
    return str(uuid4())


class StructuredFormatter(logging.Formatter):
    """Emit JSON logs without request bodies, headers, or credentials."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = request_id_context.get()
        if request_id:
            payload["request_id"] = request_id
        for field in ("event", "method", "path", "status_code", "duration_ms"):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def configure_logging(log_level: str) -> None:
    """Configure an idempotent stdout JSON logger for API and worker processes."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))


def safe_request_id(headers: Mapping[str, str]) -> str:
    """Accept a bounded opaque correlation ID or replace it with a UUID."""
    candidate = headers.get("x-request-id", "")
    if 1 <= len(candidate) <= 128 and candidate.replace("-", "").replace("_", "").isalnum():
        return candidate
    return new_request_id()
