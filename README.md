# Skill Passport

An evidence-backed skill passport with deterministic, explainable internship and team matching. Every matched skill traces to submitted evidence; the score is computed from persisted matching inputs, never decided or explained by an LLM.

## Stack and safeguards

- React, Vite, TypeScript, Tailwind, and Recharts frontend
- FastAPI, Pydantic v2, async SQLAlchemy, PostgreSQL 16 + pgvector, and Redis
- JWT authentication with student, recruiter, and admin RBAC
- Gemini is limited to structured skill extraction. Extraction output is validated, normalized against the canonical taxonomy, and tied to evidence.
- Matching is reproducible: exact overlap, thresholded semantic similarity, and verification adjustment are persisted alongside the final score. Explanations use deterministic templates over those records.
- Names, universities, GPA, and all protected attributes/proxies are excluded from matching.

Architecture and contribution invariants are defined in [AGENTS.md](AGENTS.md). Read it before changing the application.

## Local development with Docker

1. Copy `.env.example` to `.env`. The checked-in values are explicit development-only defaults, so a new developer does not need to guess local database credentials. Never commit `.env`.
2. Start the stack:

   ```bash
   docker compose up -d --build
   ```

3. Compose applies migrations before starting the API and worker. To run or confirm the migration manually, use the Compose network:

   ```bash
   docker compose run --rm --no-deps backend alembic upgrade head
   docker compose run --rm --no-deps backend alembic current
   ```

4. Seed the taxonomy and demo data after the stack starts:

   ```bash
   docker compose exec backend python -m seed.seed_demo_data
   ```

5. Open the frontend at `http://localhost:5173`; the API health check is at `http://localhost:8000/health`.

Use `docker compose down` to stop services. Add `-v` only when you intentionally want to remove the local PostgreSQL/Redis volumes.

See the [local development guide](docs/local-development.md) for the environment-variable reference, host-versus-Compose database connection boundary, local checks, and reset procedure.

## Local checks

Backend:

```bash
cd backend
pip install -r requirements.txt
pytest
ruff check .
mypy app
```

Frontend:

```bash
cd frontend
npm ci
npm run test -- --run
npm run lint
npm run typecheck
npm run build
```

Validate the delivery configuration without starting services:

```bash
docker compose --env-file .env.example config --quiet
```

The GitHub Actions workflow runs migrations, backend tests/lint/type checks, frontend tests/lint/type checks/build, and Compose validation on pushes and pull requests.

## Deploy

Deploy the API, PostgreSQL + pgvector, and Redis with Railway or Render; deploy the Vite frontend on Vercel. Use [the deployment guide](docs/deployment.md) for required secrets, service topology, migration steps, least-privilege matching access, and release checks. The repeatable end-to-end acceptance steps are in the [manual demo matrix](docs/manual-demo-matrix.md).

Production requirements:

- Set unique secrets and exact HTTPS CORS origins through the platform environment UI.
- Run migrations before serving traffic and validate `vector`, `matching_view`, and role grants.
- Run the extraction worker as a distinct process using the same backend image and Redis URL.
- Never expose API keys or use `VITE_*` variables for server-only secrets.
