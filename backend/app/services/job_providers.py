"""Provider adapters only normalize public job-source data; they never score candidates."""

import asyncio
import re
from abc import ABC, abstractmethod
from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from datetime import UTC, datetime
from html import unescape
from html.parser import HTMLParser
from typing import Any, ClassVar
from urllib.parse import urlsplit

import httpx


class ProviderError(Exception):
    safe_message = "The job source is temporarily unavailable. Please try again later."


class ProviderRateLimited(ProviderError):
    safe_message = "The job source is rate limited. Please try again later."


class ProviderNotFound(ProviderError):
    safe_message = "The configured job source was not found."


class ProviderPayloadError(ProviderError):
    safe_message = "The job source returned an unexpected response."


class ProviderSubmissionUnsupported(ProviderError):
    safe_message = "This provider does not support machine application submission."


@dataclass(frozen=True)
class ProviderCapabilities:
    search: bool
    detail_fetch: bool
    auto_apply: bool
    status_tracking: bool


@dataclass(frozen=True)
class ApplicationFieldDefinition:
    field_id: str
    label: str
    field_type: str
    required: bool
    category: str
    allowed_values: tuple[str, ...] = ()
    sensitive: bool = False
    requires_user_input: bool = False
    source: str = "provider"


@dataclass(frozen=True)
class ProviderApplicationSchema:
    version: str
    fields: tuple[ApplicationFieldDefinition, ...]


@dataclass(frozen=True)
class ProviderSubmissionResult:
    outcome: str
    external_application_id: str | None = None
    safe_error: str | None = None


@dataclass(frozen=True)
class JobSearchFilters:
    query: str | None = None
    location: str | None = None
    remote: bool | None = None
    employment_type: str | None = None
    experience_level: str | None = None
    posted_after: datetime | None = None
    cursor: str | None = None
    page_size: int = 50


@dataclass(frozen=True)
class NormalizedExternalJob:
    provider: str
    provider_source: str
    external_id: str
    title: str
    company_name: str
    description: str
    location: str | None
    remote_status: str | None
    employment_type: str | None
    experience_level: str | None
    salary_min: float | None
    salary_max: float | None
    salary_currency: str | None
    apply_url: str | None
    source_url: str
    posted_at: datetime | None
    expires_at: datetime | None
    raw_metadata: dict[str, Any] | None


@dataclass(frozen=True)
class ProviderSearchPage:
    jobs: tuple[NormalizedExternalJob, ...]
    next_cursor: str | None


class JobProvider(ABC):
    name: str
    capabilities: ProviderCapabilities

    @abstractmethod
    async def search_jobs(self, filters: JobSearchFilters, *, source_key: str) -> ProviderSearchPage: ...

    @abstractmethod
    async def get_job(self, external_id: str, *, source_key: str) -> NormalizedExternalJob: ...

    def get_application_url(self, job: NormalizedExternalJob) -> str | None:
        return job.apply_url

    async def get_application_schema(self, job: NormalizedExternalJob) -> ProviderApplicationSchema:
        """Return only a provider-declared schema; unsupported providers remain assisted-only."""
        del job
        return ProviderApplicationSchema(version="unsupported-v1", fields=())

    async def validate_application(self, payload: dict[str, object]) -> list[str]:
        """Adapters may add provider-specific validation without making submission mandatory."""
        del payload
        return []

    async def submit_application(self, payload: dict[str, object], *, idempotency_key: str) -> ProviderSubmissionResult:
        del payload, idempotency_key
        raise ProviderSubmissionUnsupported()

    async def get_submission_result(self, external_application_id: str) -> ProviderSubmissionResult | None:
        del external_application_id
        return None


class _PlainTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored_depth = 0

    def handle_data(self, data: str) -> None:
        if not self.ignored_depth:
            self.parts.append(data)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self.ignored_depth += 1
            return
        if tag in {"br", "p", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.ignored_depth:
            self.ignored_depth -= 1

    def text(self) -> str:
        return re.sub(r"[ \t]+", " ", re.sub(r"\n{3,}", "\n\n", "".join(self.parts))).strip()


def html_to_safe_text(value: object, *, limit: int = 20_000) -> str:
    if not isinstance(value, str):
        return ""
    parser = _PlainTextParser()
    try:
        parser.feed(unescape(value))
        parser.close()
    except Exception:  # noqa: BLE001 - untrusted provider HTML must never escape the adapter.
        return ""
    return parser.text()[:limit]


def _safe_url(value: object, *, allowed_hosts: AbstractSet[str]) -> str | None:
    if not isinstance(value, str) or len(value) > 2_048:
        return None
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return None
    hostname = parsed.hostname.casefold()
    if hostname not in allowed_hosts:
        return None
    return value


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)


def _clean_text(value: object, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    text = " ".join(value.split())[:limit]
    return text or None


def _safe_metadata(value: object, *, depth: int = 0) -> object:
    if depth > 3:
        return None
    if isinstance(value, str):
        return value[:2_000]
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    if isinstance(value, list):
        return [_safe_metadata(item, depth=depth + 1) for item in value[:50]]
    if isinstance(value, dict):
        return {str(key)[:100]: _safe_metadata(item, depth=depth + 1) for key, item in list(value.items())[:50]}
    return str(value)[:2_000]


class GreenhouseJobProvider(JobProvider):
    """Official public Greenhouse Job Board API adapter, not a browser scraper."""

    name = "greenhouse"
    capabilities = ProviderCapabilities(search=True, detail_fetch=True, auto_apply=False, status_tracking=False)
    _board_key = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
    _base_url = "https://boards-api.greenhouse.io/v1/boards"
    _public_hosts: ClassVar[frozenset[str]] = frozenset({"boards.greenhouse.io", "job-boards.greenhouse.io"})

    def __init__(self, *, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._transport = transport

    @classmethod
    def _validate_source_key(cls, source_key: str) -> None:
        if not cls._board_key.fullmatch(source_key):
            raise ProviderPayloadError()

    async def _get_json(self, path: str, *, params: dict[str, str] | None = None) -> dict[str, Any]:
        for attempt in range(2):
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0), transport=self._transport, follow_redirects=False) as client:
                    response = await client.get(f"{self._base_url}/{path}", params=params, headers={"Accept": "application/json"})
            except (httpx.TimeoutException, httpx.TransportError) as error:
                if attempt == 0:
                    await asyncio.sleep(0.1)
                    continue
                raise ProviderError() from error
            if response.status_code == 429:
                raise ProviderRateLimited()
            if response.status_code == 404:
                raise ProviderNotFound()
            if response.status_code >= 500:
                if attempt == 0:
                    await asyncio.sleep(0.1)
                    continue
                raise ProviderError()
            if response.status_code >= 400:
                raise ProviderPayloadError()
            try:
                payload = response.json()
            except ValueError as error:
                raise ProviderPayloadError() from error
            if not isinstance(payload, dict):
                raise ProviderPayloadError()
            return payload
        raise ProviderError()

    def _normalize_job(self, payload: dict[str, Any], *, source_key: str, company_name: str) -> NormalizedExternalJob:
        external_id = str(payload.get("id", "")).strip()
        title = _clean_text(payload.get("title"), 200)
        content = html_to_safe_text(payload.get("content"))
        if not external_id or len(external_id) > 160 or title is None or not content:
            raise ProviderPayloadError()
        location_data = payload.get("location")
        location = _clean_text(location_data.get("name"), 255) if isinstance(location_data, dict) else None
        remote_status = "remote" if "remote" in f"{title} {location or ''}".casefold() else "not_remote" if location else None
        constructed_url = f"https://boards.greenhouse.io/{source_key}/jobs/{external_id}"
        source_url = _safe_url(payload.get("absolute_url"), allowed_hosts=self._public_hosts) or constructed_url
        metadata = _safe_metadata({
            "departments": payload.get("departments"),
            "offices": payload.get("offices"),
            "provider_metadata": payload.get("metadata"),
            "updated_at": payload.get("updated_at"),
        })
        return NormalizedExternalJob(
            provider=self.name,
            provider_source=source_key,
            external_id=external_id,
            title=title,
            company_name=company_name[:255],
            description=content,
            location=location,
            remote_status=remote_status,
            employment_type=None,
            experience_level=None,
            salary_min=None,
            salary_max=None,
            salary_currency=None,
            apply_url=source_url,
            source_url=source_url,
            posted_at=_parse_time(payload.get("updated_at")),
            expires_at=None,
            raw_metadata=metadata if isinstance(metadata, dict) else None,
        )

    @staticmethod
    def _matches(job: NormalizedExternalJob, filters: JobSearchFilters) -> bool:
        if filters.query and filters.query.casefold() not in f"{job.title} {job.company_name}".casefold():
            return False
        if filters.location and filters.location.casefold() not in (job.location or "").casefold():
            return False
        if filters.remote is not None and (job.remote_status == "remote") != filters.remote:
            return False
        if filters.employment_type and job.employment_type != filters.employment_type:
            return False
        if filters.experience_level and job.experience_level != filters.experience_level:
            return False
        return not (filters.posted_after and (job.posted_at is None or job.posted_at < filters.posted_after))

    async def search_jobs(self, filters: JobSearchFilters, *, source_key: str) -> ProviderSearchPage:
        self._validate_source_key(source_key)
        board, payload = await self._get_json(source_key), await self._get_json(f"{source_key}/jobs", params={"content": "true"})
        company_name = _clean_text(board.get("name"), 255) or source_key
        jobs_data = payload.get("jobs")
        if not isinstance(jobs_data, list):
            raise ProviderPayloadError()
        if any(not isinstance(item, dict) for item in jobs_data):
            raise ProviderPayloadError()
        jobs = [self._normalize_job(item, source_key=source_key, company_name=company_name) for item in jobs_data]
        filtered = [job for job in jobs if self._matches(job, filters)]
        try:
            start = int(filters.cursor or "0")
        except ValueError as error:
            raise ProviderPayloadError() from error
        if start < 0:
            raise ProviderPayloadError()
        page_size = min(max(filters.page_size, 1), 100)
        page = tuple(filtered[start : start + page_size])
        next_cursor = str(start + page_size) if start + page_size < len(filtered) else None
        return ProviderSearchPage(jobs=page, next_cursor=next_cursor)

    async def get_job(self, external_id: str, *, source_key: str) -> NormalizedExternalJob:
        self._validate_source_key(source_key)
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,160}", external_id):
            raise ProviderPayloadError()
        board, payload = await self._get_json(source_key), await self._get_json(f"{source_key}/jobs/{external_id}", params={"content": "true"})
        return self._normalize_job(payload, source_key=source_key, company_name=_clean_text(board.get("name"), 255) or source_key)


class DeterministicTestApplicationProvider(JobProvider):
    """Test/dev-only adapter; never register it as a real provider integration."""

    name = "test_application"
    capabilities = ProviderCapabilities(search=False, detail_fetch=False, auto_apply=True, status_tracking=False)

    def __init__(self, outcomes: tuple[str, ...] = ("submitted",)) -> None:
        self._outcomes = list(outcomes)
        self.submit_calls = 0

    async def search_jobs(self, filters: JobSearchFilters, *, source_key: str) -> ProviderSearchPage:
        del filters, source_key
        raise ProviderSubmissionUnsupported()

    async def get_job(self, external_id: str, *, source_key: str) -> NormalizedExternalJob:
        del external_id, source_key
        raise ProviderSubmissionUnsupported()

    async def get_application_schema(self, job: NormalizedExternalJob) -> ProviderApplicationSchema:
        del job
        return ProviderApplicationSchema(
            version="test-v1",
            fields=(
                ApplicationFieldDefinition("full_name", "Full name", "text", True, "identity", source="profile"),
                ApplicationFieldDefinition("email", "Email", "email", True, "identity", source="profile"),
                ApplicationFieldDefinition("phone", "Phone", "phone", False, "identity", source="profile"),
                ApplicationFieldDefinition("why_interested", "Why are you interested?", "textarea", True, "narrative", requires_user_input=True),
                ApplicationFieldDefinition("work_authorization", "Authorized to work?", "select", True, "legal", ("yes", "no"), sensitive=True, requires_user_input=True),
            ),
        )

    async def validate_application(self, payload: dict[str, object]) -> list[str]:
        answers = payload.get("answers")
        if not isinstance(answers, dict):
            return ["payload"]
        return [field_id for field_id in ("full_name", "email", "why_interested", "work_authorization") if not answers.get(field_id)]

    async def submit_application(self, payload: dict[str, object], *, idempotency_key: str) -> ProviderSubmissionResult:
        del payload
        self.submit_calls += 1
        outcome = self._outcomes.pop(0) if self._outcomes else "submitted"
        if outcome == "submitted":
            return ProviderSubmissionResult("submitted", external_application_id=f"test-{idempotency_key[:12]}")
        if outcome == "rejected_by_provider":
            return ProviderSubmissionResult(outcome, safe_error="The test provider rejected the application")
        if outcome == "validation_failed":
            return ProviderSubmissionResult(outcome, safe_error="The test provider rejected a field")
        if outcome == "rate_limited":
            return ProviderSubmissionResult(outcome, safe_error="The test provider is rate limited")
        if outcome == "temporary_failure":
            return ProviderSubmissionResult(outcome, safe_error="The test provider failed before submission")
        if outcome == "unknown_submission_state":
            return ProviderSubmissionResult(outcome, safe_error="The test provider may have received the application")
        return ProviderSubmissionResult("validation_failed", safe_error="The test provider returned an invalid result")


class JobProviderRegistry:
    def __init__(self, providers: tuple[JobProvider, ...] | None = None) -> None:
        available = providers or (GreenhouseJobProvider(),)
        self._providers = {provider.name: provider for provider in available}

    def get(self, name: str) -> JobProvider:
        try:
            return self._providers[name]
        except KeyError as error:
            raise ProviderNotFound() from error


provider_registry = JobProviderRegistry()
