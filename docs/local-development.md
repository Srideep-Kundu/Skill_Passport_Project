# Local development

This guide uses Docker Compose for PostgreSQL, Redis, migrations, the API, worker, and frontend. The root `.env` file is local-only and is ignored by Git.

## Fresh start

1. Copy the development template:

   ```bash
   cp .env.example .env
   ```

   On PowerShell use `Copy-Item .env.example .env`.

2. Build and start the stack:

   ```bash
   docker compose up -d --build
   ```

   The `migrate` service runs `alembic upgrade head` before the API and worker start. The template's `DATABASE_URL` deliberately uses `postgres` as the hostname because it is consumed inside the Compose network.

3. To run or confirm migrations manually, use a one-off backend container rather than a host-shell Alembic command:

   ```bash
   docker compose run --rm --no-deps backend alembic upgrade head
   docker compose run --rm --no-deps backend alembic current
   ```

   This uses the exact database credentials and service hostname from `.env`; no credentials need to be guessed. The expected current revision is `0022_hybrid_extraction_pipeline`.

4. Seed the canonical taxonomy (and, optionally, the demo data) after services are healthy:

   ```bash
   docker compose exec backend python -m seed.seed_skills
   # Optional local demo accounts and evidence:
   # For the complete offline demo, use .env.demo.example and then:
   docker compose exec backend python -m seed.reset_demo
   docker compose exec backend python -m seed.validate_demo
   ```

5. Confirm services and open the application:

   ```bash
   docker compose ps
   ```

   The frontend is at `http://localhost:5173`; API liveness is at `http://localhost:8000/health` and database/Redis readiness is at `http://localhost:8000/ready`.

## Development variables

| Variable | Local development value/purpose |
| --- | --- |
| `POSTGRES_USER` | Database role initialized by the PostgreSQL container. |
| `POSTGRES_PASSWORD` | Local-only PostgreSQL password; changing it requires recreating the local database volume. |
| `POSTGRES_DB` | Database initialized by the PostgreSQL container. |
| `DATABASE_URL` | API/worker/migration connection URL; use the Compose hostname `postgres`. |
| `REDIS_URL` | Redis connection URL for rate limits and extraction work. |
| `JWT_SECRET` | JWT signing secret. `JWT_SECRET_KEY` remains accepted for compatibility with existing deployments. |
| `GEMINI_API_KEY` | Optional; required when Gemini extraction, a Gemini extraction fallback, or Gemini embeddings are enabled. |
| `GROQ_API_KEY` | Optional; required only when Groq extraction is selected. Never expose it to the frontend. |
| `COHERE_API_KEY` / `OPENROUTER_API_KEY` | Optional server-only credentials for the transient fallback chain. |
| `EXTRACTION_PROVIDER` | `local`, `gemini`, `groq`, `cohere`, or `openrouter`; extraction remains independent of matching scores. |
| `GROQ_EXTRACTION_MODEL` | Pinned Groq model ID; defaults to `openai/gpt-oss-20b` for strict JSON-Schema output. |
| `EXTRACTION_FALLBACK_PROVIDERS` | Optional comma-separated transient-only fallback chain, for example `gemini,local`. |
| `HF_EXTRACTION_*` | Optional OpenAI-compatible local model endpoint; disabled by default and does not add ML libraries to the worker image. |
| `EXTRACTION_RAG_*` | Extraction-only taxonomy retrieval controls; independent from the matching similarity threshold. |
| `EXTRACTION_CACHE_ENABLED` | Enables student-scoped validated result reuse without storing raw evidence in the cache. |
| `EMBEDDING_PROVIDER` | `disabled` by default; set to `gemini` only with a configured Gemini key. |
| `SEMANTIC_MATCHING_ENABLED` | `false` by default; enable only with a compatible embedding provider. |
| `GREENHOUSE_BOARD_TOKENS` | Optional comma-separated allowlist of public Greenhouse board tokens. |
| `LEVER_SITE_TOKENS` / `ASHBY_JOB_BOARD_NAMES` / `YC_SOURCE_KEYS` | Explicit public source identifiers; empty sources are reported as disabled. |
| `INSTITUTION_REGISTRATION_ALLOWLIST` | Comma-separated invited institution emails; enforced when `APP_ENV=production`. |
| `LINKEDIN_STORAGE_DIR` | Managed directory for user-provided LinkedIn export archives. |
| `VITE_DEMO_MODE` | Shows demo account shortcuts only when exactly `true`; keep false for public builds. |
| `LEVER_SITE_TOKENS` | Optional comma-separated allowlist of public Lever site tokens. |
| `ASHBY_JOB_BOARD_NAMES` | Optional comma-separated allowlist of public Ashby job-board names. |
| `DISCOVERY_RUN_RATE_LIMIT_PER_MINUTE` | Per-student limit for manual discovery runs. |
| `APPLICATION_EXECUTION_RATE_LIMIT_PER_MINUTE` | Per-student shared limit for prepare, submit, and reconciliation calls. |
| `WORKER_HEARTBEAT_TTL_SECONDS` | Redis heartbeat expiry for the extraction worker; 30 seconds by default. |

`.env.example` also documents CORS, extraction retry, upload-limit, matching threshold, rate-limit, and frontend API URL settings. Docker Compose uses explicit development fallbacks for every setting it consumes, while `.env` lets a developer override them consistently.

## Local checks

Run checks from the host using the project virtual environment:

```bash
cd backend
# PowerShell
.\.venv\Scripts\Activate.ps1
python -m pytest
python -m ruff check .
python -m mypy app
```

For frontend checks:

```bash
cd frontend
npm run test
npm run lint
npm run typecheck
npm run build
```

## Resetting local data

`docker compose down` stops services without deleting data. `docker compose down -v` permanently removes the local PostgreSQL, Redis, and resume volumes. Only use `-v` when a complete local reset is intended.

For a repeatable **demo-only** reset, stop the local stack, remove its volumes, start it again, and seed after migrations complete:

```bash
docker compose down -v
docker compose up -d --build
docker compose exec backend python -m seed.seed_demo_data
docker compose exec backend python -m app.core.release_check
```

The complete fixture is documented in [DEMO.md](../DEMO.md). It is offline, creates no provider credentials or live external requests, and must never run against a production database.

To clear and reseed an already-running **disposable PostgreSQL demo database**, use the guarded command below. It refuses to run unless both gates are explicitly supplied; it is never an API endpoint and cannot run with `APP_ENV=production`.

```bash
docker compose --env-file .env.demo.example run --rm --no-deps backend python -m seed.reset_demo
docker compose --env-file .env.demo.example run --rm --no-deps backend python -m seed.validate_demo
```

## Secret handling

Do not commit `.env`, provider tokens, database URLs containing production credentials, or JWT keys. Use platform-managed secret configuration for production. Production requires unique secrets, PostgreSQL, Redis, and exact HTTPS CORS origins; the development defaults in `.env.example` are not safe for production.
