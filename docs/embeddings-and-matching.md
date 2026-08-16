# Embeddings and matching

Production semantic matching uses Gemini `gemini-embedding-001` with `outputDimensionality=768`, which matches the existing `VECTOR(768)` pgvector columns. Gemini supports flexible output dimensions and recommends 768 as one of the supported sizes; vectors are normalized before storage. [Gemini embedding model documentation](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001)

Set `EMBEDDING_PROVIDER=gemini`, a `GEMINI_API_KEY`, `EMBEDDING_DIMENSION=768`, and `SEMANTIC_MATCHING_ENABLED=true` to enable semantic credit. With the default disabled provider, matching remains deterministic exact-overlap plus verification and never substitutes hash vectors as semantic results.

Generate missing/outdated taxonomy vectors explicitly with:

```text
python -m seed.backfill_embeddings
```

The command fingerprints normalized canonical names and aliases with provider/model/dimension metadata, so unchanged skills are not embedded again. Alembic migrations never call an embedding provider.

For unmatched required skills, semantic matching considers only persisted skill vectors. A candidate evidence-backed skill can receive semantic credit for at most one missing requirement in a run. Eligible pairs are sorted by weighted semantic value, then similarity and stable IDs; pairs below the configured threshold receive no credit.

Each explanation row persists exact, semantic, and verification contributions. Their sum equals the persisted final score (subject only to display rounding). GET endpoints only return persisted rows and report staleness from an input fingerprint; explicit recompute endpoints update rows and `computed_at` only when matching inputs changed.
