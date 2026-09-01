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
| Demo academician | `faculty@example.demo` | Faculty passport, opportunities, applications, and collaboration workspaces. |
| Demo institution | `dean@example.demo` | Institution-scoped analytics for Harbor Polytechnic University. |

The one-click account launcher is compiled only when `VITE_DEMO_MODE=true`. Production Vercel builds must set it to `false`.

## Click path

1. Sign in as Maya and open the dashboard.
2. Open Resume and Unified Passport. The `Resume: Reliable API project` evidence is linked to the active parsed resume.
3. Open GitHub verification evidence to compare verified, partially verified, and unverified offline fixture tiers.
4. Open External Jobs and Recommendations. The Ashby ML role has a Keras → TensorFlow semantic near-match; the Greenhouse role visibly lists missing Kubernetes/AWS requirements.
5. Open **Why this match** to inspect evidence, verification, semantic similarity, and missing-skill contributions.
6. Open Saved Discovery, then the Review Queue. The enabled conservative policy created one `approval_pending` intent only.
7. Open Application Review and Tracking. The Lever historical application follows approved → prepared → assisted/manual apply → user-reported submitted/in-review; it was never provider-confirmed.
8. Sign in as the recruiter to view backend, frontend, and intentionally weak cloud-infrastructure matching examples.

## Current SIH journeys

- Student: run deterministic technical, soft-skill, or aptitude assessments; inspect assessment evidence in the Passport; show learning and internship completion outcomes; open unified **My Applications**; create a revocable public Passport and demonstrate PDF/QR access.
- Recruiter: show learning programs, internal placement jobs, hiring stages, internship mentor feedback, collaboration projects, and company-scoped demand analytics.
- Faculty: show invitations, collaboration workspaces, lifecycle transitions, and persisted outcomes.
- Institution: show durable tenant scoping, persisted demand-versus-supply analytics, and governed import previews/mappings. Institution screens intentionally show empty states when supporting records do not exist.

YC, Greenhouse, Lever, and Ashby adapters are live-capable only when configured and backed by a successful non-fixture sync. Indeed and Jobsuit remain unavailable. No workflow silently submits an application.

Live extraction and provider sync are optional demonstrations only. If they fail or are unavailable, leave the fixture path in place; no fixture claims that a live provider action happened.
