# Feature freeze — Public pilot readiness

## Frozen

- Architecture: React/Vite → FastAPI → PostgreSQL/pgvector, with Redis-backed worker processing.
- Database schema and Alembic history through `0021_faculty_portal_lifecycle`.
- Matching formula and weights: `0.65 × exact + 0.25 × semantic + 0.10 × verification`.
- REST API contracts, provider boundaries, RBAC, and the deterministic demo fixture.

## Allowed before judging

- Verified P0/P1 security, correctness, or demo-navigation fixes.
- Copy corrections and direct documentation fixes.

## Not allowed before judging

- New job providers, matching algorithms, or AI capabilities.
- Schema redesign, dependency upgrades, API-breaking changes, or UI redesign.
- Browser automation/CAPTCHA work or unapproved application-submission expansion.

## Release checklist

- [ ] Run `docker compose --env-file .env.example config --quiet`.
- [ ] Run Alembic, `python -m app.core.release_check`, and `/ready` against the release environment.
- [ ] For the offline demo, use `.env.demo.example`, run `seed.reset_demo`, then `seed.validate_demo`.
- [ ] Confirm worker heartbeat and the five-minute path in [DEMO.md](DEMO.md).
- [ ] Do not use live provider calls as a required demo dependency.
