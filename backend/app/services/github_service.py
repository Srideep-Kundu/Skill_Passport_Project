"""Narrow, safe GitHub API access for ownership and project verification."""

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings

GITHUB_USERNAME_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
GITHUB_REPOSITORY_RE = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")


class GitHubError(Exception):
    """Base error which deliberately never includes a provider response body."""


class GitHubInvalidRepository(GitHubError):
    pass


class GitHubNotFound(GitHubError):
    pass


class GitHubUnavailable(GitHubError):
    pass


class GitHubInaccessible(GitHubError):
    pass


@dataclass(frozen=True)
class GitHubRepository:
    full_name: str
    owner_login: str
    owner_type: str
    is_private: bool
    created_at: datetime | None
    pushed_at: datetime | None


@dataclass(frozen=True)
class GitHubCommit:
    author_login: str | None
    committed_at: datetime | None


def normalize_github_username(username: str) -> str:
    value = username.strip()
    if not GITHUB_USERNAME_RE.fullmatch(value):
        raise ValueError("GitHub username is invalid")
    return value


def parse_github_repository_url(value: str) -> tuple[str, str]:
    """Accept only canonical public GitHub repository URLs; never fetch the supplied host."""
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname not in {"github.com", "www.github.com"} or parsed.username or parsed.password:
        raise GitHubInvalidRepository("GitHub repository URL is invalid")
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) != 2:
        raise GitHubInvalidRepository("GitHub repository URL is invalid")
    owner, repository = parts
    repository = repository.removesuffix(".git")
    if not GITHUB_USERNAME_RE.fullmatch(owner) or not GITHUB_REPOSITORY_RE.fullmatch(repository):
        raise GitHubInvalidRepository("GitHub repository URL is invalid")
    return owner, repository


def _parse_datetime(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(UTC)


class GitHubClient:
    """Centralized, bounded GitHub REST client with no token-bearing logs."""

    def __init__(self) -> None:
        settings = get_settings()
        self._headers = {"Accept": "application/vnd.github+json", "User-Agent": "skill-passport-verifier"}
        if settings.github_token:
            self._headers["Authorization"] = f"Bearer {settings.github_token}"

    async def _get_json(self, path: str, *, params: dict[str, str] | None = None) -> Any:
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                response = await client.get(f"https://api.github.com{path}", headers=self._headers, params=params)
        except (httpx.TimeoutException, httpx.TransportError) as error:
            raise GitHubUnavailable("GitHub is temporarily unavailable") from error
        if response.status_code == 404:
            raise GitHubNotFound("GitHub resource was not found")
        if response.status_code == 403:
            raise GitHubUnavailable("GitHub is temporarily unavailable")
        if response.status_code >= 500:
            raise GitHubUnavailable("GitHub is temporarily unavailable")
        if not response.is_success:
            raise GitHubInaccessible("GitHub resource cannot be accessed")
        try:
            return response.json()
        except ValueError as error:
            raise GitHubUnavailable("GitHub returned an invalid response") from error

    async def validate_username(self, username: str) -> str:
        normalized = normalize_github_username(username)
        payload = await self._get_json(f"/users/{normalized}")
        if not isinstance(payload, dict) or not isinstance(payload.get("login"), str):
            raise GitHubUnavailable("GitHub returned an invalid response")
        return payload["login"]

    async def repository(self, owner: str, repository: str) -> GitHubRepository:
        payload = await self._get_json(f"/repos/{owner}/{repository}")
        if not isinstance(payload, dict):
            raise GitHubUnavailable("GitHub returned an invalid response")
        owner_data = payload.get("owner")
        full_name = payload.get("full_name")
        if not isinstance(owner_data, dict) or not isinstance(owner_data.get("login"), str) or not isinstance(full_name, str):
            raise GitHubUnavailable("GitHub returned an invalid response")
        owner_type = owner_data.get("type")
        return GitHubRepository(
            full_name=full_name,
            owner_login=owner_data["login"],
            owner_type=owner_type if isinstance(owner_type, str) else "Unknown",
            is_private=bool(payload.get("private", True)),
            created_at=_parse_datetime(payload.get("created_at")),
            pushed_at=_parse_datetime(payload.get("pushed_at")),
        )

    async def commits(self, owner: str, repository: str) -> list[GitHubCommit]:
        payload = await self._get_json(f"/repos/{owner}/{repository}/commits", params={"per_page": "100"})
        if not isinstance(payload, list):
            raise GitHubUnavailable("GitHub returned an invalid response")
        commits: list[GitHubCommit] = []
        for item in payload[:100]:
            if not isinstance(item, dict):
                continue
            author = item.get("author")
            commit = item.get("commit")
            commit_author = commit.get("author") if isinstance(commit, dict) else None
            commits.append(
                GitHubCommit(
                    author_login=author.get("login") if isinstance(author, dict) and isinstance(author.get("login"), str) else None,
                    committed_at=_parse_datetime(commit_author.get("date")) if isinstance(commit_author, dict) else None,
                )
            )
        return commits

    async def languages(self, owner: str, repository: str) -> set[str]:
        payload = await self._get_json(f"/repos/{owner}/{repository}/languages")
        if not isinstance(payload, dict):
            raise GitHubUnavailable("GitHub returned an invalid response")
        return {key for key, value in payload.items() if isinstance(key, str) and isinstance(value, int) and value >= 0}
