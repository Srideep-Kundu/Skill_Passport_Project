import json

import httpx
import pytest

from app.services.job_providers import (
    GreenhouseJobProvider,
    JobSearchFilters,
    ProviderCapabilities,
    ProviderError,
    ProviderPayloadError,
    ProviderRateLimited,
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
