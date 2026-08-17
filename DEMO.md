# Offline hackathon demo

Use a disposable PostgreSQL database only. The fixture never calls Gemini, GitHub, Greenhouse, Lever, or Ashby; provider-labelled jobs and verification records declare themselves as offline fixtures.

## Start and reset

Copy `.env.demo.example` to `.env`. On a machine that already has a local Compose database, first run `docker compose down -v` so PostgreSQL initializes the disposable `skill_passport_demo` database, then start the stack. Compose applies migrations; run:

```bash
docker compose exec backend python -m seed.reset_demo
docker compose exec backend python -m seed.validate_demo
```

`reset_demo` requires both `APP_ENV=demo` and `DEMO_RESET_ENABLED=true`, truncates only that configured disposable database, then seeds again. Run the validator after every reset.

## Accounts

All demo accounts use the non-production password `DemoPassword123`.

| Persona | Email | Demo purpose |
| --- | --- | --- |
| Maya Rivera | `maya@example.demo` | Main student: active parsed resume, multi-source Python evidence, all verification tiers, jobs, queue, and tracking. |
| Noah Chen | `noah@example.demo` | Medium React/Python match. |
| Aria Patel | `aria@example.demo` | Fairness pair A. |
| Blake Morgan | `blake@example.demo` | Fairness pair B; identical allowed inputs and score to Aria. |
| Demo recruiter | `recruiter@example.demo` | Internal internship and candidate-match view. |

## Click path

1. Sign in as Maya and open the dashboard.
2. Open Resume and Unified Passport. The `Resume: Reliable API project` evidence is linked to the active parsed resume.
3. Open GitHub verification evidence to compare verified, partially verified, and unverified offline fixture tiers.
4. Open External Jobs and Recommendations. The Ashby ML role has a Keras → TensorFlow semantic near-match; the Greenhouse role visibly lists missing Kubernetes/AWS requirements.
5. Open **Why this match** to inspect evidence, verification, semantic similarity, and missing-skill contributions.
6. Open Saved Discovery, then the Review Queue. The enabled conservative policy created one `approval_pending` intent only.
7. Open Application Review and Tracking. The Lever historical application follows approved → prepared → assisted/manual apply → user-reported submitted/in-review; it was never provider-confirmed.
8. Sign in as the recruiter to view backend, frontend, and intentionally weak cloud-infrastructure matching examples.

Live extraction and provider sync are optional demonstrations only. If they fail or are unavailable, leave the fixture path in place; no fixture claims that a live provider action happened.
