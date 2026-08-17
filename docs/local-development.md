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

   This uses the exact database credentials and service hostname from `.env`; no credentials need to be guessed. The expected current revision is `0011_application_execution`.

4. Confirm services and open the application:

   ```bash
   docker compose ps
   ```

   The frontend is at `http://localhost:5173` and API health is at `http://localhost:8000/health`.

## Development variables

| Variable | Local development value/purpose |
| --- | --- |
| `POSTGRES_USER` | Database role initialized by the PostgreSQL container. |
| `POSTGRES_PASSWORD` | Local-only PostgreSQL password; changing it requires recreating the local database volume. |
| `POSTGRES_DB` | Database initialized by the PostgreSQL container. |
| `DATABASE_URL` | API/worker/migration connection URL; use the Compose hostname `postgres`. |
| `REDIS_URL` | Redis connection URL for rate limits and extraction work. |
| `JWT_SECRET_KEY` | JWT secret used by the application. This is the configured name for the JWT secret (not `JWT_SECRET`). |
| `GEMINI_API_KEY` | Optional; required only when Gemini extraction or embeddings are enabled. Leave blank for the local extractor. |
| `EMBEDDING_PROVIDER` | `disabled` by default; set to `gemini` only with a configured Gemini key. |
| `SEMANTIC_MATCHING_ENABLED` | `false` by default; enable only with a compatible embedding provider. |
| `GREENHOUSE_BOARD_TOKENS` | Optional comma-separated allowlist of public Greenhouse board tokens. |

`.env.example` also documents CORS, extraction retry, upload-limit, matching threshold, rate-limit, and frontend API URL settings. Docker Compose uses explicit development fallbacks for every setting it consumes, while `.env` lets a developer override them consistently.

## Local checks

Run checks from the host using the project virtual environment:

```bash
cd backend
pytest
ruff check .
mypy app
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

## Secret handling

Do not commit `.env`, provider tokens, database URLs containing production credentials, or JWT keys. Use platform-managed secret configuration for production. Production requires unique secrets, PostgreSQL, Redis, and exact HTTPS CORS origins; the development defaults in `.env.example` are not safe for production.
