from typing import Self

import httpx
import pytest

from app.services import github_service


class FakeResponse:
    def __init__(self, status_code: int, payload: object) -> None:
        self.status_code = status_code
        self.payload = payload

    @property
    def is_success(self) -> bool:
        return 200 <= self.status_code < 300

    def json(self) -> object:
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


class FakeClient:
    response: FakeResponse | Exception

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_args: object) -> None:
        return None

    async def get(self, *_args: object, **_kwargs: object) -> FakeResponse:
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("https://github.com/owner/repository", ("owner", "repository")),
        ("https://github.com/owner/repository.git", ("owner", "repository")),
    ],
)
def test_parse_github_repository_url_accepts_only_canonical_repositories(value: str, expected: tuple[str, str]) -> None:
    assert github_service.parse_github_repository_url(value) == expected


@pytest.mark.parametrize("value", ["https://example.com/owner/repo", "https://github.com/owner/repo/issues", "http://github.com/owner/repo", "https://github.com@evil.test/owner/repo"])
def test_parse_github_repository_url_rejects_ssrf_and_non_repository_urls(value: str) -> None:
    with pytest.raises(github_service.GitHubInvalidRepository):
        github_service.parse_github_repository_url(value)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("response", "error"),
    [
        (FakeResponse(404, {}), github_service.GitHubNotFound),
        (FakeResponse(403, {}), github_service.GitHubUnavailable),
        (FakeResponse(500, {}), github_service.GitHubUnavailable),
        (httpx.TimeoutException("timeout"), github_service.GitHubUnavailable),
    ],
)
async def test_github_client_classifies_not_found_rate_limit_timeout_and_server_errors(monkeypatch: pytest.MonkeyPatch, response: FakeResponse | Exception, error: type[Exception]) -> None:
    FakeClient.response = response
    monkeypatch.setattr(github_service.httpx, "AsyncClient", lambda **_kwargs: FakeClient())

    with pytest.raises(error):
        await github_service.GitHubClient().repository("owner", "repo")


@pytest.mark.asyncio
async def test_github_client_rejects_malformed_provider_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    FakeClient.response = FakeResponse(200, {"owner": {"login": "owner"}})
    monkeypatch.setattr(github_service.httpx, "AsyncClient", lambda **_kwargs: FakeClient())

    with pytest.raises(github_service.GitHubUnavailable):
        await github_service.GitHubClient().repository("owner", "repo")
