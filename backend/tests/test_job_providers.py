import json

import httpx
import pytest

from app.services.job_providers import (
    AshbyJobProvider,
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
    ProviderSubmissionPolicy,
    normalized_application_schema,
)


def _job(
    provider: str,
    source: str,
    external_id: str,
    *,
    metadata: dict[str, object] | None = None,
) -> NormalizedExternalJob:
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
    assert provider.capabilities == ProviderCapabilities(
        search=True, detail_fetch=True, auto_apply=False, status_tracking=False
    )

    first = await provider.search_jobs(JobSearchFilters(page_size=1), source_key="acme")
    second = await provider.search_jobs(
        JobSearchFilters(cursor=first.next_cursor, page_size=1), source_key="acme"
    )

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
            lambda request: (
                httpx.Response(200, json={"name": "Acme"})
                if request.url.path == "/v1/boards/acme"
                else httpx.Response(200, json={"jobs": []})
            )
        )
    )
    assert (await empty.search_jobs(JobSearchFilters(), source_key="acme")).jobs == ()

    malformed = GreenhouseJobProvider(
        transport=httpx.MockTransport(
            lambda request: (
                httpx.Response(200, json={"name": "Acme"})
                if request.url.path == "/v1/boards/acme"
                else httpx.Response(200, content=json.dumps({"jobs": "not-a-list"}))
            )
        )
    )
    with pytest.raises(ProviderPayloadError):
        await malformed.search_jobs(JobSearchFilters(), source_key="acme")

    rate_limited = GreenhouseJobProvider(
        transport=httpx.MockTransport(lambda request: httpx.Response(429))
    )
    with pytest.raises(ProviderRateLimited):
        await rate_limited.search_jobs(JobSearchFilters(), source_key="acme")

    not_found = GreenhouseJobProvider(
        transport=httpx.MockTransport(lambda request: httpx.Response(404))
    )
    with pytest.raises(ProviderError):
        await not_found.search_jobs(JobSearchFilters(), source_key="acme")

    attempts = 0

    def unavailable_handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503)

    unavailable_status = GreenhouseJobProvider(
        transport=httpx.MockTransport(unavailable_handler)
    )
    with pytest.raises(ProviderError):
        await unavailable_status.search_jobs(JobSearchFilters(), source_key="acme")
    assert attempts == 2

    unavailable = GreenhouseJobProvider(transport=httpx.MockTransport(timeout_handler))
    with pytest.raises(ProviderError):
        await unavailable.search_jobs(JobSearchFilters(), source_key="acme")


@pytest.mark.asyncio
async def test_greenhouse_submission_capability_requires_exact_credential_scope_and_mapped_schema() -> (
    None
):
    job = _job(
        "greenhouse",
        "acme",
        "1",
        metadata={
            "application_questions": [
                {
                    "id": "portfolio",
                    "label": "Portfolio",
                    "type": "url",
                    "required": True,
                }
            ]
        },
    )
    no_credential = await GreenhouseJobProvider(
        credentials=ProviderCredentialStore()
    ).get_submission_capability(job)
    assert no_credential.provider_supports_submission is True
    assert no_credential.credentials_configured is False
    assert no_credential.submission_ready is False

    wrong_scope = await GreenhouseJobProvider(
        credentials=ProviderCredentialStore(
            (ProviderCredential("greenhouse", "other", "test-key"),)
        )
    ).get_submission_capability(job)
    assert (
        wrong_scope.credentials_configured is False
        and wrong_scope.fallback == "assisted"
    )

    scoped = await GreenhouseJobProvider(
        credentials=ProviderCredentialStore(
            (ProviderCredential("greenhouse", "acme", "test-key"),)
        )
    ).get_submission_capability(job)
    assert scoped.credentials_configured is True
    assert scoped.application_schema_available is True
    assert scoped.submission_ready is False


@pytest.mark.asyncio
async def test_ashby_public_adapter_normalizes_pages_and_remains_assisted_only() -> (
    None
):
    def response(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "api.ashbyhq.com"
        assert request.url.path == "/posting-api/job-board/acme"
        assert request.url.params["includeCompensation"] == "true"
        return httpx.Response(
            200,
            json={
                "apiVersion": "1",
                "jobs": [
                    {
                        "id": "job-1",
                        "title": "Backend Intern",
                        "location": "Remote, India",
                        "isListed": True,
                        "isRemote": True,
                        "workplaceType": "Remote",
                        "descriptionHtml": "<p>Requirements: Python</p><script>ignore</script>",
                        "publishedAt": "2026-01-02T03:04:05Z",
                        "employmentType": "Intern",
                        "jobUrl": "https://jobs.ashbyhq.com/acme/job-1",
                        "applyUrl": "https://jobs.ashbyhq.com/acme/job-1/apply",
                        "compensation": {
                            "summaryComponents": [
                                {
                                    "compensationType": "Salary",
                                    "currencyCode": "USD",
                                    "minValue": 50000,
                                    "maxValue": 70000,
                                }
                            ]
                        },
                    },
                    {
                        "id": "job-2",
                        "title": "Private",
                        "isListed": False,
                        "descriptionPlain": "Python",
                    },
                    {
                        "id": "job-3",
                        "title": "Frontend Intern",
                        "location": "Bengaluru",
                        "isListed": True,
                        "workplaceType": "OnSite",
                        "descriptionPlain": "React",
                        "jobUrl": "https://attacker.invalid/job",
                    },
                ],
            },
        )

    provider = AshbyJobProvider(transport=httpx.MockTransport(response))
    assert provider.capabilities == ProviderCapabilities(
        search=True, detail_fetch=False, auto_apply=False, status_tracking=False
    )
    first = await provider.search_jobs(JobSearchFilters(page_size=1), source_key="acme")
    second = await provider.search_jobs(
        JobSearchFilters(cursor=first.next_cursor, page_size=1), source_key="acme"
    )
    assert first.next_cursor == "1" and first.jobs[0].external_id == "job-1"
    assert first.jobs[0].remote_status == "remote" and first.jobs[0].salary_min == 50000
    assert "ignore" not in first.jobs[0].description
    assert second.jobs[0].source_url == "https://jobs.ashbyhq.com/acme"
    capability = await provider.get_submission_capability(first.jobs[0])
    assert (
        capability.provider_supports_submission is False
        and capability.fallback == "assisted"
    )


@pytest.mark.asyncio
async def test_ashby_adapter_rejects_malformed_payload_and_handles_provider_errors() -> (
    None
):
    malformed = AshbyJobProvider(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"jobs": "invalid"})
        )
    )
    with pytest.raises(ProviderPayloadError):
        await malformed.search_jobs(JobSearchFilters(), source_key="acme")
    rate_limited = AshbyJobProvider(
        transport=httpx.MockTransport(lambda request: httpx.Response(429))
    )
    with pytest.raises(ProviderRateLimited):
        await rate_limited.search_jobs(JobSearchFilters(), source_key="acme")
    attempts = 0

    def unavailable(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        return httpx.Response(503)

    with pytest.raises(ProviderError):
        await AshbyJobProvider(transport=httpx.MockTransport(unavailable)).search_jobs(
            JobSearchFilters(), source_key="acme"
        )
    assert attempts == 2


@pytest.mark.asyncio
async def test_lever_official_schema_normalizes_sensitive_and_file_fields_and_stays_assisted() -> (
    None
):
    async def response(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/postings/posting-1/apply"
        assert request.headers.get("authorization") is not None
        return httpx.Response(
            200,
            json={
                "data": {
                    "personalInformation": [
                        {
                            "id": "name",
                            "text": "Full name",
                            "type": "text",
                            "required": True,
                        }
                    ],
                    "customQuestions": [
                        {
                            "id": "form-1",
                            "fields": [
                                {
                                    "id": "gender",
                                    "text": "Gender",
                                    "type": "dropdown",
                                    "required": False,
                                    "options": ["Female", "Male", "Prefer not to say"],
                                },
                                {
                                    "id": "resume",
                                    "text": "Resume",
                                    "type": "file-upload",
                                    "required": True,
                                },
                            ],
                        }
                    ],
                }
            },
        )

    credentials = ProviderCredentialStore(
        (ProviderCredential("lever", "acme", "test-api-key"),)
    )
    provider = LeverJobProvider(
        transport=httpx.MockTransport(response), credentials=credentials
    )
    schema = await provider.get_application_schema(_job("lever", "acme", "posting-1"))
    gender = next(field for field in schema.fields if field.field_id == "lever_gender")
    assert gender.sensitive is True and gender.requires_user_input is True
    resume = next(field for field in schema.fields if field.field_id == "lever_resume")
    assert resume.field_type == "file" and resume.source == "lever:custom:form-1"
    capability = await provider.get_submission_capability(
        _job("lever", "acme", "posting-1")
    )
    assert capability.credentials_configured is True
    assert capability.application_schema_available is True
    assert capability.submission_ready is False


def test_unsupported_required_provider_field_is_not_silently_dropped() -> None:
    schema = normalized_application_schema(
        "lever",
        "test",
        [{"id": "custom", "text": "Unknown", "type": "matrix", "required": True}],
        prefix="lever_",
    )
    assert schema.fields == ()
    assert schema.unsupported_required_field_ids == ("custom",)


@pytest.mark.asyncio
async def test_controlled_lever_submission_uploads_approved_resume_and_posts_official_payload(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.job_providers as providers

    monkeypatch.setattr(
        providers,
        "provider_submission_policy",
        ProviderSubmissionPolicy(True, True, True),
    )
    requests: list[httpx.Request] = []

    async def response(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/v1/uploads":
            return httpx.Response(
                201, json={"data": {"uri": "https://api.lever.co/v1/uploads/resume-1"}}
            )
        if request.url.path == "/v1/postings/posting-1/apply":
            assert request.url.params["send_confirmation_email"] == "true"
            body = json.loads(request.content)
            assert body["personalInformation"] == [{"id": "name", "value": "Student"}]
            assert body["customQuestions"] == [
                {
                    "id": "form-1",
                    "fields": [
                        {
                            "id": "resume",
                            "value": "https://api.lever.co/v1/uploads/resume-1",
                        }
                    ],
                }
            ]
            return httpx.Response(
                201, json={"data": {"applicationId": "application-1"}}
            )
        return httpx.Response(404)

    provider = LeverJobProvider(
        transport=httpx.MockTransport(response),
        credentials=ProviderCredentialStore(
            (ProviderCredential("lever", "acme", "test-api-key"),)
        ),
    )
    result = await provider.submit_application(
        {
            "provider_source": "acme",
            "external_job_id": "posting-1",
            "fields": [
                {
                    "field_id": "lever_name",
                    "provider_field_id": "name",
                    "field_type": "text",
                    "source": "lever:personal",
                    "answer": "Student",
                },
                {
                    "field_id": "lever_resume",
                    "provider_field_id": "resume",
                    "field_type": "file",
                    "source": "lever:custom:form-1",
                    "answer": {"approved_resume": True},
                },
            ],
            "_resume_upload": {
                "filename": "resume.pdf",
                "mime_type": "application/pdf",
                "content": b"resume",
            },
        },
        idempotency_key="internal-only",
    )
    assert (
        result.outcome == "submitted"
        and result.external_application_id == "application-1"
    )
    assert [request.url.path for request in requests] == [
        "/v1/uploads",
        "/v1/postings/posting-1/apply",
    ]


@pytest.mark.asyncio
async def test_controlled_lever_submission_normalizes_rate_limit_and_ambiguous_transport(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.services.job_providers as providers

    monkeypatch.setattr(
        providers,
        "provider_submission_policy",
        ProviderSubmissionPolicy(True, True, True),
    )
    credentials = ProviderCredentialStore(
        (ProviderCredential("lever", "acme", "test-api-key"),)
    )
    payload = {"provider_source": "acme", "external_job_id": "posting-1", "fields": []}
    rate_limited = LeverJobProvider(
        transport=httpx.MockTransport(lambda request: httpx.Response(429)),
        credentials=credentials,
    )
    assert (
        await rate_limited.submit_application(payload, idempotency_key="one")
    ).outcome == "rate_limited"

    async def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("post may have been sent", request=request)

    ambiguous = LeverJobProvider(
        transport=httpx.MockTransport(timeout), credentials=credentials
    )
    with pytest.raises(ProviderError):
        await ambiguous.submit_application(payload, idempotency_key="two")


@pytest.mark.asyncio
async def test_yc_provider_normalizes_and_discovers_startup_jobs() -> None:
    from app.services.job_providers import YCJobProvider

    def _mock_yc(request: httpx.Request) -> httpx.Response:
        if "hn.algolia.com" in str(request.url):
            return httpx.Response(
                200,
                json={
                    "hits": [
                        {
                            "objectID": "40001",
                            "title": "PostHog (YC W20) is hiring a Backend Engineer (Remote)",
                            "story_text": "<p>We are looking for Python and ClickHouse developers.</p>",
                            "url": "https://posthog.com/careers",
                            "created_at": "2026-08-20T10:00:00Z",
                        },
                        {
                            "objectID": "40002",
                            "title": "Supabase – Founding Frontend Engineer in San Francisco",
                            "story_text": "Join us to build open-source tools with React and TypeScript.",
                            "url": "https://supabase.com/careers",
                            "created_at": "2026-08-21T12:00:00Z",
                        },
                    ]
                },
            )
        return httpx.Response(404)

    yc_provider = YCJobProvider(transport=httpx.MockTransport(_mock_yc))
    assert yc_provider.capabilities.search is True
    page = await yc_provider.search_jobs(JobSearchFilters(page_size=10), source_key="yc_startups")
    assert len(page.jobs) == 2
    assert page.jobs[0].company_name == "PostHog"
    assert page.jobs[0].title == "Backend Engineer"
    assert page.jobs[0].remote_status == "remote"
    assert page.jobs[0].raw_metadata is not None and page.jobs[0].raw_metadata.get("batch") == "YC W20"
    assert page.jobs[1].company_name == "Supabase"
    assert page.jobs[1].location == "San Francisco, CA"


@pytest.mark.asyncio
async def test_indeed_and_jobsuit_degrade_gracefully() -> None:
    from app.services.job_providers import IndeedJobProvider, JobsuitJobProvider

    indeed = IndeedJobProvider()
    assert indeed.capabilities.search is False
    with pytest.raises(ProviderError, match="Indeed integration requires official Indeed Publisher/Partner API credentials"):
        await indeed.search_jobs(JobSearchFilters(), source_key="default")

    jobsuit = JobsuitJobProvider()
    assert jobsuit.capabilities.search is False
    with pytest.raises(ProviderError, match="Jobsuit.ai integration requires active partner API configuration"):
        await jobsuit.search_jobs(JobSearchFilters(), source_key="default")

