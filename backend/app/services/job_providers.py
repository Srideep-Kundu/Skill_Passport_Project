"""Provider adapters only normalize public job-source data; they never score candidates."""

import asyncio
import json
import re
from abc import ABC, abstractmethod
from collections.abc import Set as AbstractSet
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from html import unescape
from html.parser import HTMLParser
from typing import Any, ClassVar
from urllib.parse import urlsplit

import httpx

from app.core.config import get_settings
from app.models import ApplicationTrackingStatus


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


class ProviderPreSendFailure(ProviderError):
    safe_message = "The provider could not be reached before submission started."


@dataclass(frozen=True)
class ProviderCapabilities:
    search: bool
    detail_fetch: bool
    auto_apply: bool
    status_tracking: bool


@dataclass(frozen=True)
class ProviderSubmissionCapability:
    """Exact-provider and exact-employer submission decision; never contains a credential."""

    provider_supports_submission: bool
    credentials_configured: bool
    posting_supports_submission: bool
    application_schema_available: bool
    submission_ready: bool
    fallback: str
    reason: str


@dataclass(frozen=True)
class ProviderStatusCapability:
    supports_status_tracking: bool
    status_lookup_method: str
    credentials_configured: bool
    reason: str


@dataclass(frozen=True)
class ProviderStatusResult:
    status: ApplicationTrackingStatus
    provider_status: str | None = None


@dataclass(frozen=True)
class ProviderCredential:
    provider: str
    scope: str
    secret: str


class ProviderCredentialStore:
    """Environment-backed credentials scoped to one provider employer/board identity."""

    def __init__(self, credentials: tuple[ProviderCredential, ...] = ()) -> None:
        self._credentials = {(item.provider, item.scope.casefold()): item for item in credentials}

    @staticmethod
    def _parse(provider: str, value: str | None) -> tuple[ProviderCredential, ...]:
        if not value:
            return ()
        try:
            entries = json.loads(value)
        except json.JSONDecodeError:
            return ()
        if not isinstance(entries, list):
            return ()
        parsed: list[ProviderCredential] = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            scope, secret = entry.get("scope"), entry.get("api_key")
            if isinstance(scope, str) and isinstance(secret, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,120}", scope) and 1 <= len(secret) <= 4096:
                parsed.append(ProviderCredential(provider, scope, secret))
        return tuple(parsed)

    @classmethod
    def from_environment(cls) -> "ProviderCredentialStore":
        settings = get_settings()
        return cls(
            cls._parse("greenhouse", settings.greenhouse_application_credentials)
            + cls._parse("lever", settings.lever_application_credentials)
        )

    def get(self, provider: str, scope: str) -> ProviderCredential | None:
        return self._credentials.get((provider, scope.casefold()))


provider_credential_store = ProviderCredentialStore.from_environment()


@dataclass(frozen=True)
class ProviderSubmissionPolicy:
    enabled: bool
    lever_enabled: bool
    staging_mode: bool

    @classmethod
    def from_environment(cls) -> "ProviderSubmissionPolicy":
        settings = get_settings()
        return cls(settings.provider_submission_enabled, settings.lever_submission_enabled, settings.environment == "staging" and settings.application_execution_mode == "staging_submit")

    @property
    def lever_live_submission_allowed(self) -> bool:
        return self.enabled and self.lever_enabled and self.staging_mode


provider_submission_policy = ProviderSubmissionPolicy.from_environment()


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
    provider_field_id: str | None = None


@dataclass(frozen=True)
class ProviderApplicationSchema:
    version: str
    fields: tuple[ApplicationFieldDefinition, ...]
    unsupported_required_field_ids: tuple[str, ...] = ()


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

    async def get_submission_capability(self, job: NormalizedExternalJob) -> ProviderSubmissionCapability:
        del job
        return ProviderSubmissionCapability(False, False, False, False, False, "assisted", "This provider has no official submission integration.")

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

    async def get_status_capability(self) -> ProviderStatusCapability:
        return ProviderStatusCapability(False, "none", False, "This provider has no configured applicant-status lookup.")

    async def get_application_status(self, external_application_id: str) -> ProviderStatusResult | None:
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


_SENSITIVE_FIELD_WORDS = frozenset({"gender", "race", "ethnicity", "disability", "veteran", "religion", "sexual orientation", "work authorization", "visa", "criminal", "salary"})
_FIELD_TYPE_MAP = {
    "text": "text",
    "short_answer": "text",
    "short text": "text",
    "textarea": "textarea",
    "long_answer": "textarea",
    "long text": "textarea",
    "email": "email",
    "phone": "phone",
    "url": "url",
    "dropdown": "select",
    "single_select": "select",
    "single select": "select",
    "multiple choice": "select",
    "multi_select": "multi_select",
    "multiple select": "multi_select",
    "boolean": "boolean",
    "yes_no": "boolean",
    "date": "date",
    "number": "number",
    "file": "file",
    "file-upload": "file",
    "file upload": "file",
}


def normalize_provider_application_field(provider: str, value: object, *, prefix: str = "") -> ApplicationFieldDefinition | None:
    """Map a documented provider field to Phase 11's safe normalized contract."""
    if not isinstance(value, dict):
        return None
    raw_id = value.get("id") or value.get("name")
    label = value.get("label") or value.get("question") or value.get("text")
    raw_type = value.get("type") or value.get("input_type")
    if not isinstance(raw_id, (str, int)) or not isinstance(label, str) or not isinstance(raw_type, str):
        return None
    field_id = re.sub(r"[^a-z0-9_]", "_", f"{prefix}{raw_id}".casefold()).strip("_")
    if not re.fullmatch(r"[a-z][a-z0-9_]{0,119}", field_id) or not (clean_label := _clean_text(label, 255)):
        return None
    field_type = _FIELD_TYPE_MAP.get(raw_type.casefold())
    if field_type is None:
        return None
    values = value.get("options") or value.get("values") or value.get("choices") or []
    options: list[str] = []
    if isinstance(values, list):
        for option in values:
            option_text = option.get("label") or option.get("text") or option.get("value") if isinstance(option, dict) else option
            if isinstance(option_text, str) and (clean_option := _clean_text(option_text, 255)):
                options.append(clean_option)
    if field_type in {"select", "multi_select"} and not options:
        return None
    label_key = clean_label.casefold()
    sensitive = any(word in label_key for word in _SENSITIVE_FIELD_WORDS) or value.get("category") == "eeo"
    category = "legal" if sensitive else "provider"
    raw_provider_id = str(raw_id)
    if len(raw_provider_id) > 160:
        return None
    return ApplicationFieldDefinition(
        field_id=field_id,
        label=clean_label,
        field_type=field_type,
        required=bool(value.get("required", False)),
        category=category,
        allowed_values=tuple(dict.fromkeys(options)),
        sensitive=sensitive,
        requires_user_input=sensitive,
        source=f"{provider}_official_schema",
        provider_field_id=raw_provider_id,
    )


def normalized_application_schema(provider: str, version: str, fields: object, *, prefix: str) -> ProviderApplicationSchema:
    if not isinstance(fields, list):
        return ProviderApplicationSchema(version, ())
    normalized: list[ApplicationFieldDefinition] = []
    unsupported_required: list[str] = []
    for index, item in enumerate(fields):
        definition = normalize_provider_application_field(provider, item, prefix=prefix)
        if definition is not None:
            normalized.append(definition)
            if definition.required and definition.field_type == "file":
                # A provider upload URI must only be created by a reviewed upload adapter.
                unsupported_required.append(definition.field_id)
        elif isinstance(item, dict) and item.get("required") is True:
            raw_id = item.get("id") or item.get("name") or str(index)
            unsupported_required.append(str(raw_id)[:120])
    ids = [field.field_id for field in normalized]
    if len(ids) != len(set(ids)):
        return ProviderApplicationSchema(version, (), tuple(unsupported_required + ["duplicate_field_id"]))
    return ProviderApplicationSchema(version, tuple(normalized), tuple(unsupported_required))


class GreenhouseJobProvider(JobProvider):
    """Official public Greenhouse Job Board API adapter, not a browser scraper."""

    name = "greenhouse"
    capabilities = ProviderCapabilities(search=True, detail_fetch=True, auto_apply=False, status_tracking=False)

    async def get_status_capability(self) -> ProviderStatusCapability:
        return ProviderStatusCapability(False, "none", False, "Greenhouse job-board credentials do not provide applicant-status tracking in this integration.")
    _board_key = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
    _base_url = "https://boards-api.greenhouse.io/v1/boards"
    _public_hosts: ClassVar[frozenset[str]] = frozenset({"boards.greenhouse.io", "job-boards.greenhouse.io"})

    def __init__(self, *, transport: httpx.AsyncBaseTransport | None = None, credentials: ProviderCredentialStore | None = None) -> None:
        self._transport = transport
        self._credentials = credentials or provider_credential_store

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
            "application_questions": payload.get("questions"),
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
        board, payload = await self._get_json(source_key), await self._get_json(f"{source_key}/jobs", params={"content": "true", "questions": "true"})
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
        board, payload = await self._get_json(source_key), await self._get_json(f"{source_key}/jobs/{external_id}", params={"content": "true", "questions": "true"})
        return self._normalize_job(payload, source_key=source_key, company_name=_clean_text(board.get("name"), 255) or source_key)

    async def get_application_schema(self, job: NormalizedExternalJob) -> ProviderApplicationSchema:
        metadata = job.raw_metadata or {}
        questions = metadata.get("application_questions") if isinstance(metadata, dict) else None
        return normalized_application_schema(self.name, "greenhouse-job-board-v1", questions, prefix="gh_")

    async def get_submission_capability(self, job: NormalizedExternalJob) -> ProviderSubmissionCapability:
        credential = self._credentials.get(self.name, job.provider_source)
        schema = await self.get_application_schema(job)
        schema_available = bool(schema.fields) and not schema.unsupported_required_field_ids
        if credential is None:
            return ProviderSubmissionCapability(True, False, True, schema_available, False, "assisted", "Provider integration is not connected for this Greenhouse board.")
        if not schema_available:
            return ProviderSubmissionCapability(True, True, True, False, False, "assisted", "The required Greenhouse application form cannot be safely mapped.")
        return ProviderSubmissionCapability(True, True, True, True, False, "assisted", "Credential scope matches, but controlled Greenhouse submission is not enabled by this release.")


class LeverJobProvider(JobProvider):
    """Official Lever postings adapter with credential-scoped form discovery only."""

    name = "lever"
    capabilities = ProviderCapabilities(search=True, detail_fetch=True, auto_apply=False, status_tracking=False)

    async def get_status_capability(self) -> ProviderStatusCapability:
        return ProviderStatusCapability(False, "none", False, "Controlled Lever submission credentials are not used for applicant-status tracking.")
    _site_key = re.compile(r"^[A-Za-z0-9_-]{1,120}$")
    _posting_key = re.compile(r"^[A-Za-z0-9-]{1,160}$")
    _public_base_url = "https://api.lever.co/v0/postings"
    _authenticated_base_url = "https://api.lever.co/v1"
    _public_hosts: ClassVar[frozenset[str]] = frozenset({"jobs.lever.co", "jobs.eu.lever.co"})

    def __init__(self, *, transport: httpx.AsyncBaseTransport | None = None, credentials: ProviderCredentialStore | None = None) -> None:
        self._transport = transport
        self._credentials = credentials or provider_credential_store

    @classmethod
    def _validate_site(cls, site: str) -> None:
        if not cls._site_key.fullmatch(site):
            raise ProviderPayloadError()

    async def _public_json(self, path: str, *, params: dict[str, str] | None = None) -> object:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0), transport=self._transport, follow_redirects=False) as client:
                response = await client.get(f"{self._public_base_url}/{path}", params=params, headers={"Accept": "application/json"})
        except (httpx.TimeoutException, httpx.TransportError) as error:
            raise ProviderError() from error
        if response.status_code == 429:
            raise ProviderRateLimited()
        if response.status_code == 404:
            raise ProviderNotFound()
        if response.status_code >= 500:
            raise ProviderError()
        if response.status_code >= 400:
            raise ProviderPayloadError()
        try:
            return response.json()
        except ValueError as error:
            raise ProviderPayloadError() from error

    def _normalize_job(self, payload: object, *, source_key: str) -> NormalizedExternalJob:
        if not isinstance(payload, dict):
            raise ProviderPayloadError()
        external_id, title = _clean_text(str(payload.get("id", "")), 160), _clean_text(payload.get("text"), 200)
        description = _clean_text(payload.get("descriptionPlain"), 20_000) or html_to_safe_text(payload.get("description"))
        categories = payload.get("categories")
        location = _clean_text(categories.get("location"), 255) if isinstance(categories, dict) else None
        if not external_id or not self._posting_key.fullmatch(external_id) or title is None or not description:
            raise ProviderPayloadError()
        hosted = _safe_url(payload.get("hostedUrl"), allowed_hosts=self._public_hosts)
        apply_url = _safe_url(payload.get("applyUrl"), allowed_hosts=self._public_hosts) or hosted
        if hosted is None:
            hosted = f"https://jobs.lever.co/{source_key}/{external_id}"
        return NormalizedExternalJob(
            provider=self.name,
            provider_source=source_key,
            external_id=external_id,
            title=title,
            company_name=source_key,
            description=description,
            location=location,
            remote_status=_clean_text(payload.get("workplaceType"), 40),
            employment_type=_clean_text(categories.get("commitment"), 100) if isinstance(categories, dict) else None,
            experience_level=None,
            salary_min=None,
            salary_max=None,
            salary_currency=None,
            apply_url=apply_url,
            source_url=hosted,
            posted_at=None,
            expires_at=None,
            raw_metadata=None,
        )

    async def search_jobs(self, filters: JobSearchFilters, *, source_key: str) -> ProviderSearchPage:
        self._validate_site(source_key)
        payload = await self._public_json(source_key, params={"mode": "json", "limit": str(min(max(filters.page_size, 1), 100))})
        if not isinstance(payload, list):
            raise ProviderPayloadError()
        jobs = tuple(self._normalize_job(item, source_key=source_key) for item in payload)
        return ProviderSearchPage(jobs=jobs, next_cursor=None)

    async def get_job(self, external_id: str, *, source_key: str) -> NormalizedExternalJob:
        self._validate_site(source_key)
        if not self._posting_key.fullmatch(external_id):
            raise ProviderPayloadError()
        return self._normalize_job(await self._public_json(f"{source_key}/{external_id}", params={"mode": "json"}), source_key=source_key)

    async def _application_questions(self, job: NormalizedExternalJob, credential: ProviderCredential) -> object:
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0), transport=self._transport, follow_redirects=False) as client:
                response = await client.get(
                    f"{self._authenticated_base_url}/postings/{job.external_id}/apply",
                    auth=(credential.secret, ""),
                    headers={"Accept": "application/json"},
                )
        except (httpx.TimeoutException, httpx.TransportError) as error:
            raise ProviderError() from error
        if response.status_code in {401, 403, 404}:
            raise ProviderPayloadError()
        if response.status_code == 429:
            raise ProviderRateLimited()
        if response.status_code >= 500:
            raise ProviderError()
        if response.status_code >= 400:
            raise ProviderPayloadError()
        try:
            return response.json()
        except ValueError as error:
            raise ProviderPayloadError() from error

    async def get_application_schema(self, job: NormalizedExternalJob) -> ProviderApplicationSchema:
        credential = self._credentials.get(self.name, job.provider_source)
        if credential is None:
            return ProviderApplicationSchema("lever-v1", ())
        payload = await self._application_questions(job, credential)
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise ProviderPayloadError()
        fields: list[ApplicationFieldDefinition] = []
        unsupported: list[str] = []

        def add_fields(value: object, source: str, *, eeo: bool = False) -> None:
            if not isinstance(value, list):
                return
            for item in value:
                definition = normalize_provider_application_field(self.name, item, prefix="lever_")
                if definition is None:
                    if isinstance(item, dict) and item.get("required") is True:
                        unsupported.append(str(item.get("id", "unknown"))[:120])
                    continue
                if eeo:
                    # Preserve direct-input policy, but do not serialize an undocumented EEO shape.
                    if definition.required:
                        unsupported.append(definition.provider_field_id or definition.field_id)
                    continue
                if definition.field_type == "file" and "resume" not in definition.label.casefold():
                    if definition.required:
                        unsupported.append(definition.provider_field_id or definition.field_id)
                    continue
                fields.append(replace(definition, source=source))

        add_fields(data.get("personalInformation"), "lever:personal")
        add_fields(data.get("urls"), "lever:urls")
        add_fields(data.get("eeoResponses"), "lever:eeo", eeo=True)
        custom_questions = data.get("customQuestions")
        if isinstance(custom_questions, list):
            for group in custom_questions:
                if isinstance(group, dict) and isinstance(group.get("fields"), list):
                    group_id = str(group.get("id", ""))
                    if re.fullmatch(r"[A-Za-z0-9-]{1,36}", group_id):
                        add_fields(group["fields"], f"lever:custom:{group_id}")
                    else:
                        unsupported.append("invalid_custom_question_group")
        ids = [field.field_id for field in fields]
        if len(ids) != len(set(ids)):
            unsupported.append("duplicate_field_id")
        return ProviderApplicationSchema("lever-v1", tuple(fields), tuple(unsupported))

    async def get_submission_capability(self, job: NormalizedExternalJob) -> ProviderSubmissionCapability:
        credential = self._credentials.get(self.name, job.provider_source)
        if credential is None:
            return ProviderSubmissionCapability(True, False, True, False, False, "assisted", "Provider integration is not connected for this Lever site.")
        try:
            schema = await self.get_application_schema(job)
        except ProviderError:
            return ProviderSubmissionCapability(True, True, True, False, False, "assisted", "The official Lever application schema is unavailable.")
        schema_available = bool(schema.fields) and not schema.unsupported_required_field_ids
        if not schema_available:
            return ProviderSubmissionCapability(True, True, True, False, False, "assisted", "The required Lever application form cannot be safely mapped.")
        if not provider_submission_policy.lever_live_submission_allowed:
            return ProviderSubmissionCapability(True, True, True, True, False, "assisted", "Controlled Lever submission is disabled outside the staging safety boundary.")
        return ProviderSubmissionCapability(True, True, True, True, True, "none", "Controlled Lever submission is enabled for this employer scope.")

    async def _upload_resume(self, credential: ProviderCredential, upload: dict[str, object]) -> str:
        filename, mime_type, content = upload.get("filename"), upload.get("mime_type"), upload.get("content")
        if not isinstance(filename, str) or not isinstance(mime_type, str) or not isinstance(content, bytes) or len(content) > 30 * 1024 * 1024:
            raise ProviderPayloadError()
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0), transport=self._transport, follow_redirects=False) as client:
                response = await client.post(f"{self._authenticated_base_url}/uploads", auth=(credential.secret, ""), files={"file": (filename, content, mime_type)})
        except httpx.ConnectError as error:
            raise ProviderPreSendFailure() from error
        except (httpx.TimeoutException, httpx.TransportError) as error:
            raise ProviderError() from error
        if response.status_code == 429:
            raise ProviderRateLimited()
        if response.status_code >= 500:
            raise ProviderPreSendFailure()
        if response.status_code >= 400:
            raise ProviderPayloadError()
        try:
            data = response.json().get("data")
        except ValueError as error:
            raise ProviderPayloadError() from error
        uri = data.get("uri") if isinstance(data, dict) else None
        if not isinstance(uri, str) or not uri.startswith(f"{self._authenticated_base_url}/uploads/"):
            raise ProviderPayloadError()
        return uri

    async def submit_application(self, payload: dict[str, object], *, idempotency_key: str) -> ProviderSubmissionResult:
        del idempotency_key  # Lever's documented endpoint has no native idempotency parameter.
        provider_source, external_id = payload.get("provider_source"), payload.get("external_job_id")
        if not isinstance(provider_source, str) or not isinstance(external_id, str) or not self._posting_key.fullmatch(external_id):
            raise ProviderPayloadError()
        credential = self._credentials.get(self.name, provider_source)
        if credential is None or not provider_submission_policy.lever_live_submission_allowed:
            raise ProviderSubmissionUnsupported()
        field_entries = payload.get("fields")
        if not isinstance(field_entries, list):
            raise ProviderPayloadError()
        body: dict[str, object] = {"personalInformation": [], "customQuestions": [], "urls": []}
        custom_forms: dict[str, list[dict[str, object]]] = {}
        resume_uri: str | None = None
        for field in field_entries:
            if not isinstance(field, dict):
                raise ProviderPayloadError()
            source, provider_field_id, field_type, answer = field.get("source"), field.get("provider_field_id"), field.get("field_type"), field.get("answer")
            if not isinstance(source, str) or not isinstance(provider_field_id, str):
                raise ProviderPayloadError()
            value = answer
            if field_type == "file":
                upload = payload.get("_resume_upload")
                if not isinstance(upload, dict):
                    raise ProviderPayloadError()
                resume_uri = resume_uri or await self._upload_resume(credential, upload)
                value = resume_uri
            item = {"id": provider_field_id, "value": value}
            if source == "lever:personal":
                cast = body["personalInformation"]
                assert isinstance(cast, list)
                cast.append(item)
            elif source == "lever:urls":
                cast = body["urls"]
                assert isinstance(cast, list)
                cast.append(item)
            elif source.startswith("lever:custom:"):
                group_id = source.removeprefix("lever:custom:")
                if not re.fullmatch(r"[A-Za-z0-9-]{1,36}", group_id):
                    raise ProviderPayloadError()
                custom_forms.setdefault(group_id, []).append(item)
            else:
                raise ProviderPayloadError()
        body["customQuestions"] = [{"id": group_id, "fields": items} for group_id, items in sorted(custom_forms.items())]
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0), transport=self._transport, follow_redirects=False) as client:
                response = await client.post(
                    f"{self._authenticated_base_url}/postings/{external_id}/apply",
                    auth=(credential.secret, ""),
                    params={"send_confirmation_email": "true"},
                    json=body,
                    headers={"Accept": "application/json"},
                )
        except httpx.ConnectError as error:
            raise ProviderPreSendFailure() from error
        except (httpx.TimeoutException, httpx.TransportError) as error:
            # A timeout after issuing the POST may mean Lever received the application.
            raise ProviderError() from error
        if response.status_code == 429:
            return ProviderSubmissionResult("rate_limited", safe_error="Lever rate limited this application submission")
        if response.status_code >= 500:
            return ProviderSubmissionResult("temporary_failure", safe_error="Lever temporarily could not accept this application")
        if response.status_code in {400, 422}:
            return ProviderSubmissionResult("validation_failed", safe_error="Lever rejected one or more application fields")
        if response.status_code in {401, 403, 404}:
            return ProviderSubmissionResult("rejected_by_provider", safe_error="Lever did not authorize this application submission")
        if response.status_code >= 400:
            return ProviderSubmissionResult("rejected_by_provider", safe_error="Lever rejected this application")
        try:
            data = response.json().get("data")
        except ValueError as error:
            raise ProviderError() from error
        application_id = data.get("applicationId") or data.get("id") if isinstance(data, dict) else None
        if not isinstance(application_id, str) or not application_id:
            raise ProviderError()
        return ProviderSubmissionResult("submitted", external_application_id=application_id)


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

    async def get_submission_capability(self, job: NormalizedExternalJob) -> ProviderSubmissionCapability:
        del job
        return ProviderSubmissionCapability(True, True, True, True, True, "none", "Deterministic test-only submission capability.")

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
        available = providers or (GreenhouseJobProvider(), LeverJobProvider())
        self._providers = {provider.name: provider for provider in available}

    def get(self, name: str) -> JobProvider:
        try:
            return self._providers[name]
        except KeyError as error:
            raise ProviderNotFound() from error


provider_registry = JobProviderRegistry()
