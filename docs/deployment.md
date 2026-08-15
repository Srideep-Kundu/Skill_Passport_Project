# Deployment guide

## Production prerequisites

Use PostgreSQL 16 with the `vector` extension enabled and a Redis instance reachable only by the API/worker network. Run Alembic migrations before serving traffic, seed the canonical taxonomy and demo data only in a demo environment, and configure `/health` as the service health check.

Set the following as platform secrets or environment variables, never in Git: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `GEMINI_API_KEY`, optional `GITHUB_TOKEN`, and production `CORS_ORIGINS`. Set `APP_ENV=production`; strong unique JWT keys and production credentials are mandatory. Do not use the local values from `.env.example`.

The database role used by the matching worker must have access only to `matching_view` and matching-related persistence, not the `students` table. Run the matching-view migration/grant validation as part of deployment.

## Railway

1. Provision a PostgreSQL 16 service with pgvector available and a Redis service in the same Railway project.
2. Create an API service from this repository and set its configuration path to `infra/railway.toml`; provide the environment variables above plus the platform connection URLs.
3. Run `alembic upgrade head` as a release/pre-deploy command, then deploy the API. Confirm `GET /health` is healthy.
4. Create a second service from the same backend image with command `python -m app.workers.extraction_worker`, sharing the API environment except browser CORS configuration.
5. Deploy the frontend separately on Vercel (below) and set the API `CORS_ORIGINS` to its exact HTTPS origin.

## Render

`infra/render.yaml` provisions the API and PostgreSQL declaration. Supply `REDIS_URL`, `CORS_ORIGINS`, and provider tokens in the Render dashboard; attach a private Redis service or managed equivalent. Confirm the managed PostgreSQL plan supports `CREATE EXTENSION vector` before deployment. Use the API Docker service’s release command or a one-off job to run `alembic upgrade head`; then run seed commands only for an explicitly designated demo environment. Create a private worker service from the same backend Dockerfile with `python -m app.workers.extraction_worker`.

## Vercel frontend

Import the repository and set `frontend` as the Vercel root directory. Build with `npm run build` and publish `dist`. Set `VITE_API_BASE_URL` to the public API HTTPS URL for each environment. Redeploy after changing that value because Vite embeds it at build time. Do not put server secrets in `VITE_*` variables.

## Release checks

1. Run the CI workflow and `docker compose --env-file .env.example config --quiet`.
2. Apply migrations and validate the pgvector extension, `matching_view`, and least-privilege grants.
3. Confirm `/health`, auth rate limits, CORS, worker queue processing, and migration state.
4. Execute the [manual demo matrix](manual-demo-matrix.md), including the fairness pair and raw-evidence consent boundary.
