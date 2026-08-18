from types import SimpleNamespace
from typing import Self

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base
from app.models import Skill
from app.services import embeddings


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

    async def post(self, *_args: object, **_kwargs: object) -> FakeResponse:
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


@pytest_asyncio.fixture
async def session_factory() -> async_sessionmaker[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    await engine.dispose()


def test_deterministic_test_embedding_matches_pgvector_dimension() -> None:
    assert len(embeddings.deterministic_embedding("Python FastAPI PostgreSQL")) == embeddings.VECTOR_DIMENSIONS == 768


@pytest.mark.asyncio
async def test_gemini_embedding_normalizes_valid_mocked_provider_vector(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(embeddings, "get_settings", lambda: SimpleNamespace(gemini_api_key="test"))
    FakeClient.response = FakeResponse(200, {"embedding": {"values": [1.0, 0.0]}})
    monkeypatch.setattr(embeddings.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    service = embeddings.GeminiEmbeddingService(embeddings.EmbeddingSpec("gemini", "test-model", 2))

    assert await service.embed("Python") == [1.0, 0.0]


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [{"embedding": {"values": [1.0]}}, {"embedding": {"values": [float("nan"), 0.0]}}, {"embedding": {"values": [0.0, 0.0]}}])
async def test_gemini_embedding_rejects_wrong_dimension_nan_and_empty(monkeypatch: pytest.MonkeyPatch, payload: object) -> None:
    monkeypatch.setattr(embeddings, "get_settings", lambda: SimpleNamespace(gemini_api_key="test"))
    FakeClient.response = FakeResponse(200, payload)
    monkeypatch.setattr(embeddings.httpx, "AsyncClient", lambda **_kwargs: FakeClient())

    with pytest.raises(embeddings.InvalidEmbedding):
        await embeddings.GeminiEmbeddingService(embeddings.EmbeddingSpec("gemini", "test-model", 2)).embed("Python")


@pytest.mark.asyncio
@pytest.mark.parametrize("response", [FakeResponse(429, {}), FakeResponse(500, {}), httpx.TimeoutException("timeout")])
async def test_gemini_embedding_classifies_transient_provider_failures(monkeypatch: pytest.MonkeyPatch, response: FakeResponse | Exception) -> None:
    monkeypatch.setattr(embeddings, "get_settings", lambda: SimpleNamespace(gemini_api_key="test"))
    FakeClient.response = response
    monkeypatch.setattr(embeddings.httpx, "AsyncClient", lambda **_kwargs: FakeClient())

    with pytest.raises(embeddings.EmbeddingUnavailable):
        await embeddings.GeminiEmbeddingService(embeddings.EmbeddingSpec("gemini", "test-model", 2)).embed("Python")


@pytest.mark.asyncio
async def test_skill_embedding_backfill_is_cached_and_idempotent(session_factory: async_sessionmaker[AsyncSession]) -> None:
    class CountingService(embeddings.EmbeddingService):
        def __init__(self) -> None:
            super().__init__(embeddings.EmbeddingSpec("gemini", "test-model", 2))
            self.calls = 0

        async def embed(self, _text: str) -> list[float]:
            self.calls += 1
            return [1.0, 0.0]

    service = CountingService()
    async with session_factory() as session:
        session.add(Skill(canonical_name="Python", category="Language", aliases=["python3"]))
        await session.commit()
        assert await embeddings.backfill_skill_embeddings(session, service) == 1
        assert await embeddings.backfill_skill_embeddings(session, service) == 0

    assert service.calls == 1
