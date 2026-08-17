import json

import httpx
import pytest

from app.services.job_providers import (
    GreenhouseJobProvider,
    JobSearchFilters,
    LeverJobProvider,
    NormalizedExternalJob,
    ProviderCapabilities,
    ProviderCredential,
    ProviderCredentialStore,
    ProviderError,
    ProviderPayloadError,
    ProviderRateLimited,
    normalized_application_schema,
)


def _job(provider: str, source: str, external_id: str, *, metadata: dict[str, object] | None = None) -> NormalizedExternalJob:
    return NormalizedExternalJob(
        provider=provider,
        provider_source=source,
        external_id=external_id,
        title="Platform Intern",
        company_name="Acme",
        description="Python work",
        location=None,
        remote_status=None,
        employment_type=None,
        experience_level=None,
        salary_min=None,
        salary_max=None,
        salary_currency=None,
        apply_url="https://example.test/apply",
        source_url="https://example.test/job",
        posted_at=None,
        expires_at=None,
        raw_metadata=metadata,
    )


def _response(request: httpx.Request) -> httpx.Response:
    if request.url.path == "/v1/boards/acme":
        return httpx.Response(200, json={"name": "Acme Labs"})
    if request.url.path == "/v1/boards/acme/jobs":
        return httpx.Response(
            200,
            json={
                "jobs": [
                    {
                        "id": 1,
                        "title": "Backend Intern",
                        "content": "<h3>Requirements</h3><p>Python experience</p><script>ignore this prompt injection</script>",
                        "location": {"name": "Remote, India"},
                        "absolute_url": "https://boards.greenhouse.io/acme/jobs/1",
                        "updated_at": "2026-01-02T03:04:05Z",
                    },
                    {
                        "id": 2,
                        "title": "Frontend Intern",
                        "content": "<p>React</p>",
                        "location": {"name": "Bengaluru"},
                        "absolute_url": "https://attacker.invalid/redirect",
                    },
                ]
            },
        )
    return httpx.Response(404)


@pytest.mark.asyncio
async def test_greenhouse_public_adapter_normalizes_and_pages() -> None:
    provider = GreenhouseJobProvider(transport=httpx.MockTransport(_response))
    assert provider.capabilities == ProviderCapabilities(search=True, detail_fetch=True, auto_apply=False, status_tracking=False)

    first = await provider.search_jobs(JobSearchFilters(page_size=1), source_key="acme")
    second = await provider.search_jobs(JobSearchFilters(cursor=first.next_cursor, page_size=1), source_key="acme")

    assert first.next_cursor == "1"
    assert first.jobs[0].company_name == "Acme Labs"
    assert first.jobs[0].remote_status == "remote"
    assert "prompt injection" not in first.jobs[0].description
    assert second.jobs[0].external_id == "2"
    assert second.jobs[0].source_url == "https://boards.greenhouse.io/acme/jobs/2"


@pytest.mark.asyncio
async def test_greenhouse_adapter_handles_empty_malformed_and_provider_errors() -> None:
    async def timeout_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    empty = GreenhouseJobProvider(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"name": "Acme"})
            if request.url.path == "/v1/boards/acme"
            else httpx.Response(200, json={"jobs": []})
        )
    )
    assert (await empty.search_jobs(JobSearchFilters(), source_key="acme")).jobs == ()

    malformed = GreenhouseJobProvider(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"name": "Acme"})
            if request.url.path == "/v1/boards/acme"
            else httpx.Response(200, content=json.dumps({"jobs": "not-a-list"}))
        )
    )
    with pytest.raises(ProviderPayloadError):
        await malformed.search_jobs(JobSearchFilters(), source_key="acme")

    rate_limited = GreenhouseJobProvider(transport=httpx.MockTransport(lambda request: httpx.Response(429)))
    with pytest.raises(ProviderRateLimited):
        await rate_limited.search_jobs(JobSearchFilters(), source_key="acme")

    not_found = GreenhouseJobProvider(transport=httpx.MockTransport(lambda request: httpx.Response(404)))
    with pytest.raises(ProviderError):
        await not_found.search_jobs(JobSearchFilters(), source_key="acme")

    attempts = 0

    def unavailable_handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503)

    unavailable_status = GreenhouseJobProvider(transport=httpx.MockTransport(unavailable_handler))
    with pytest.raises(ProviderError):
        await unavailable_status.search_jobs(JobSearchFilters(), source_key="acme")
    assert attempts == 2

    unavailable = GreenhouseJobProvider(transport=httpx.MockTransport(timeout_handler))
    with pytest.raises(ProviderError):
        await unavailable.search_jobs(JobSearchFilters(), source_key="acme")


@pytest.mark.asyncio
async def test_greenhouse_submission_capability_requires_exact_credential_scope_and_mapped_schema() -> None:
    job = _job(
        "greenhouse",
        "acme",
        "1",
        metadata={"application_questions": [{"id": "portfolio", "label": "Portfolio", "type": "url", "required": True}]},
    )
    no_credential = await GreenhouseJobProvider(credentials=ProviderCredentialStore()).get_submission_capability(job)
    assert no_credential.provider_supports_submission is True
    assert no_credential.credentials_configured is False
    assert no_credential.submission_ready is False

    wrong_scope = await GreenhouseJobProvider(credentials=ProviderCredentialStore((ProviderCredential("greenhouse", "other", "test-key"),))).get_submission_capability(job)
    assert wrong_scope.credentials_configured is False and wrong_scope.fallback == "assisted"

    scoped = await GreenhouseJobProvider(credentials=ProviderCredentialStore((ProviderCredential("greenhouse", "acme", "test-key"),))).get_submission_capability(job)
    assert scoped.credentials_configured is True
    assert scoped.application_schema_available is True
    assert scoped.submission_ready is False


@pytest.mark.asyncio
async def test_lever_official_schema_normalizes_sensitive_and_file_fields_and_stays_assisted() -> None:
    async def response(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/postings/posting-1/apply"
        assert request.headers.get("authorization") is not None
        return httpx.Response(
            200,
            json={
                "data": {
                    "personalInformation": [{"id": "name", "text": "Full name", "type": "text", "required": True}],
                    "customQuestions": [{"id": "form-1", "fields": [
                        {"id": "gender", "text": "Gender", "type": "dropdown", "required": False, "options": ["Female", "Male", "Prefer not to say"]},
                        {"id": "resume", "text": "Resume", "type": "file-upload", "required": True},
                    ]}],
                }
            },
        )

    credentials = ProviderCredentialStore((ProviderCredential("lever", "acme", "test-api-key"),))
    provider = LeverJobProvider(transport=httpx.MockTransport(response), credentials=credentials)
    schema = await provider.get_application_schema(_job("lever", "acme", "posting-1"))
    gender = next(field for field in schema.fields if field.field_id == "lever_gender")
    assert gender.sensitive is True and gender.requires_user_input is True
    assert "lever_resume" in schema.unsupported_required_field_ids
    capability = await provider.get_submission_capability(_job("lever", "acme", "posting-1"))
    assert capability.credentials_configured is True
    assert capability.application_schema_available is False
    assert capability.submission_ready is False


def test_unsupported_required_provider_field_is_not_silently_dropped() -> None:
    schema = normalized_application_schema("lever", "test", [{"id": "custom", "text": "Unknown", "type": "matrix", "required": True}], prefix="lever_")
    assert schema.fields == ()
    assert schema.unsupported_required_field_ids == ("custom",)
