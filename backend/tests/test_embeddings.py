from app.services.embeddings import VECTOR_DIMENSIONS, deterministic_embedding


def test_fallback_embedding_matches_pgvector_dimension() -> None:
    embedding = deterministic_embedding("Python FastAPI PostgreSQL")

    assert len(embedding) == VECTOR_DIMENSIONS == 768
