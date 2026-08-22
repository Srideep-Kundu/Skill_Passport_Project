# Deployment guide

## Production prerequisites

Use PostgreSQL 16 with the `vector` extension enabled and a Redis instance reachable only by the API/worker network. Run Alembic migrations before serving traffic, seed the canonical taxonomy and demo data only in a demo environment, and configure `/ready` as the service health check. `/health` is liveness-only; `/ready` checks the database and Redis without leaking dependency details.

Set the following through platform-managed configuration, never in Git: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GITHUB_TOKEN`, `GOOGLE_CLIENT_ID`, the approved provider source identifiers, `INSTITUTION_REGISTRATION_ALLOWLIST`, and production `CORS_ORIGINS`. `JWT_SECRET_KEY` is accepted only for compatibility. Set `APP_ENV=production`; strong unique JWT keys, PostgreSQL, Key Value, an exact HTTPS CORS origin, and a non-empty Google audience when Google sign-in is exposed are mandatory. This pilot selects Gemini extraction and embeddings, but semantic scoring must remain disabled until the 768-dimensional backfill succeeds.

The `0002_matching_role_privileges` migration creates `skill_passport_matcher`, a `NOLOGIN` role restricted to `matching_view`, taxonomy/requirements, and match persistence. Matching service transactions activate that role before matching reads and writes; the role cannot select profile or raw-evidence tables. The current monolithic API still uses one primary connection identity outside those transactions, so a separate matching-process database identity remains a future hardening step. Run this migration with a database principal permitted to create roles and validate the grants as part of deployment.

## Railway

1. Provision a PostgreSQL 16 service with pgvector available and a Redis service in the same Railway project.
2. Create an API service from this repository and set its configuration path to `infra/railway.toml`; provide the environment variables above plus the platform connection URLs.
3. Run `alembic upgrade head` as a release/pre-deploy command, then run `python -m app.core.release_check` after the taxonomy is seeded and deploy the API. Confirm `GET /ready` is healthy.
4. Create a second service from the same backend image with command `python -m app.workers.extraction_worker`, sharing the API environment except browser CORS configuration.
5. Deploy the frontend separately on Vercel (below) and set the API `CORS_ORIGINS` to its exact HTTPS origin.

## Render

`infra/render.yaml` declares a same-region API, worker, PostgreSQL 16 database, and private Render Key Value instance. Key Value is injected into both application services through its internal `connectionString`. The paid single-instance API has a disk mounted at `/app/uploads`; resume and LinkedIn archives use `/app/uploads/resumes` and `/app/uploads/linkedin`. A Render disk belongs to one service and prevents horizontal API scaling, so moving uploads to object storage is required before multi-instance scaling. Confirm the database supports `CREATE EXTENSION vector`. The API uses `alembic upgrade head` as its pre-deploy command. Seed taxonomy and run `python -m app.core.release_check` as controlled one-off steps; never run the demo reset in production.

## Vercel frontend

Import the repository and set `frontend` as the Vercel root directory. Build with `npm run build` and publish `dist`. Set `VITE_API_BASE_URL` to the Render API HTTPS URL, `VITE_GOOGLE_CLIENT_ID` to the public OAuth client ID, and `VITE_DEMO_MODE=false`. Redeploy after changing any Vite variable because it is embedded at build time. Add the final Vercel HTTPS origin to Render `CORS_ORIGINS`. Do not put server secrets in `VITE_*` variables.

## Release checks

1. Run the CI workflow and `docker compose --env-file .env.example config --quiet`.
2. Apply migrations, seed the taxonomy, then run `python -m app.core.release_check`. It validates the pgvector extension, `matching_view`, matching role, current revision, taxonomy, and Redis.
3. Confirm `/health`, `/ready`, auth rate limits, CORS, worker heartbeat (`GET /admin/worker-status` as an admin), worker queue processing, and migration state. Logs are JSON metadata only and carry `X-Request-ID`; do not log bodies, credentials, or raw evidence.
4. Execute the [manual demo matrix](manual-demo-matrix.md), including the fairness pair and raw-evidence consent boundary. For a demo release, use the offline seeded fixture and keep provider submission disabled.

## Release smoke and rollback

After deployment, run `python -m app.core.release_smoke` in the backend release environment. It verifies the database release invariants plus `/health` and `/ready`. When non-production smoke credentials are explicitly provided in `RELEASE_SMOKE_EMAIL` and `RELEASE_SMOKE_PASSWORD`, it also validates login and a protected passport request; the command never prints either value. Browser E2E separately validates the frontend authentication contract with a mocked API.

If a release fails before the API starts, keep the prior API and worker image running, inspect the migration/release-check output by request ID, and correct or add a forward migration. Do not roll back schema manually or run demo reset against production. External providers are deliberately degraded dependencies: Gemini, GitHub, and job boards do not affect `/ready`; the existing evidence, verification, matching, explanation, and offline fixture remain available.
