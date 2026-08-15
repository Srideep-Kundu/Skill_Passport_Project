# AGENTS.md — Skill Passport Engineering Rules

## 1. Project objective

Build a **Verifiable Skill Passport and Explainable Internship-Team Matching Platform**. Students maintain evidence-backed skills; recruiters post internships and receive transparent, fair candidate matches. The system may also suggest complementary student teams.

The product's non-negotiable properties are:

- Every passport skill traces to a specific evidence record.
- Internship and team matching are deterministic, auditable computations.
- Explanations are rendered from persisted database records and templates.
- Protected attributes and their proxies never influence matching.

The project roadmap at `C:\Users\Srideep Kundu\Downloads\skill-passport-roadmap.md` is the source of truth for product scope and technical decisions. When it conflicts with this file, the stricter privacy, fairness, determinism, or security rule wins.

## 2. Non-negotiable architecture

Use the following flow:

`React frontend → FastAPI REST gateway (JWT + RBAC) → domain services → PostgreSQL/pgvector`, with Redis-backed asynchronous extraction work.

- Write submitted evidence to PostgreSQL before queuing extraction. Return promptly; never block the submission request on an LLM call.
- The worker performs structured skill extraction, taxonomy normalization, and independent verification updates.
- The matching service computes and persists scores and their components. It must use a restricted matching database view and may not query the `students` table.
- The explanation service reads persisted match, skill, evidence, and verification records and renders deterministic templates. It must make **zero LLM calls**.
- Do not introduce separate microservices, a dedicated vector database, model-training infrastructure, or other technologies not justified by the roadmap.

## 3. Technology stack

| Layer | Required choice |
| --- | --- |
| Frontend | Vite + React + TypeScript, Tailwind CSS, Recharts |
| API | FastAPI, Pydantic v2, async SQLAlchemy 2.0 |
| Data | PostgreSQL 16 with pgvector |
| Async work and rate limits | Redis |
| AI | Gemini API for structured skill extraction only |
| Embeddings | Gemini embeddings or `sentence-transformers` fallback |
| Authentication | FastAPI JWT with `python-jose` and bcrypt |
| Local deployment | Docker Compose |
| Tests | pytest (and frontend tests when frontend behavior changes) |

Keep dependencies minimal. Do not substitute Next.js, Django, MongoDB, Supabase, a dedicated vector database, PyTorch, or a new queue framework without a written, accepted architectural reason.

## 4. Repository structure and module boundaries

Implement the roadmap's intended structure without unrelated reorganization:

```text
backend/
  app/
    core/          # settings, security, async database setup
    models/        # SQLAlchemy models grouped by domain
    schemas/       # Pydantic request/response contracts
    api/           # FastAPI routers only
    services/      # extraction, verification, matching, explanation logic
    workers/       # Redis extraction consumers
  alembic/         # migrations
  seed/            # reproducible taxonomy and demo data seeds
  tests/
frontend/
  src/
    pages/
    components/
    api/           # typed HTTP client/wrappers
infra/             # deployment/infrastructure configuration only
docs/              # architecture, API, operational, and demo documentation
```

- Keep routers thin: validate input, authorize, invoke services, and return schemas.
- Keep database persistence out of UI components and out of router-specific business logic.
- Add a file only in the module that owns its behavior. Do not move, rename, or rewrite working modules merely for style.
- Document any unavoidable structural change in the PR/commit summary and preserve imports and public behavior through a compatibility path.

## 5. Coding conventions

- Python: type annotate public functions, use `async` for I/O-bound application and database paths, use Pydantic models at boundaries, and use explicit domain exceptions mapped to stable API errors.
- TypeScript: use strict types; place shared API types in the API layer; use functional React components and hooks; handle loading, error, and empty states.
- Use clear domain names (`source_evidence_id`, `verification_tier`, `deterministic_score`), not ambiguous abbreviations.
- Validate inputs at the boundary, normalize canonical skills in services, and keep pure scoring/template functions side-effect free.
- Do not silently swallow exceptions, fabricate fallback match results, or use unvalidated LLM output.
- Add focused comments/docstrings only where a decision, invariant, or algorithm is not obvious from the code.

## 6. API conventions and compatibility

- Use REST endpoints under the roadmap's stable paths, including `/auth`, `/passport`, `/evidence`, `/skills`, `/internships`, `/matches`, `/teams`, and `/admin`.
- Authenticate protected endpoints with `Authorization: Bearer <JWT>`; determine identity and role server-side from validated claims, never request-supplied IDs.
- Define Pydantic request and response schemas for every endpoint. Return predictable status codes and structured error details; never leak internal exceptions, secrets, or protected data.
- Validate pagination and filtering parameters for growing list endpoints. Enforce ownership and company scope before querying or returning records.
- Preserve existing endpoint paths, request fields, response fields, and semantics. Any incompatible change requires an explicit versioned endpoint or an additive transition plan, migration notes, and tests for both contracts.

## 7. Database conventions and evidence provenance

- Use UUID primary keys, UTC `TIMESTAMPTZ` audit fields, foreign keys, explicit constraints/enums/checks, and Alembic migrations for every persistent schema change. Never modify production schema manually.
- Maintain `skills` as the canonical taxonomy; normalize aliases/extracted labels against it rather than storing arbitrary duplicate skill names.
- Use pgvector only for taxonomy, internship, and matching semantic data; maintain the roadmap's compatible vector dimensions and cosine indexes.
- Use JSONB only for flexible, auditable payloads such as external verification snapshots or extraction metadata—not as a replacement for relational fields.
- Record material actions in `audit_log`, especially extraction, verification, match computation, score version/formula data, and privileged actions.
- Every `student_skills` row MUST have a non-null `source_evidence_id` foreign key. A skill without evidence must not enter a passport or matching input.
- Preserve distinct `student_skills` rows when the same skill is demonstrated by different evidence. Persist the extraction confidence and exact evidence span/metadata for each row.
- Verification tiers are `verified`, `partially_verified`, and `unverified`. Compute the effective confidence as extraction confidence × multiplier: `1.00`, `0.85`, and `0.65` respectively. Verification discounts a skill; it must not erase it solely because external proof is unavailable.

## 8. Authentication and RBAC

- Roles are `student`, `recruiter`, and `admin`. JWTs contain only the minimum immutable identity and role claims required for authorization.
- Students may create and manage only their own profile, evidence, passport, and student-facing matches. They control consent for recruiter access to raw evidence.
- Recruiters may manage only their own company's internships and view only candidates/matches scoped to those internships. They must not access another company's applicant pool or raw student evidence without recorded student consent.
- Admin-only operations include taxonomy curation, privileged audit/fairness access, and other operational controls. Check admin authorization in the API and service layer.
- Hash passwords with bcrypt; never store plaintext passwords or place sensitive identity data in tokens.

## 9. AI and LLM rules

- Gemini may be used only for strict JSON-mode candidate skill extraction from evidence text. Embedding providers may generate embeddings; neither capability is scoring authority.
- LLM requests contain evidence type, evidence text, and an opaque correlation/student UUID only when needed for logging. They must never contain a name, university, profile data, protected attributes, credentials, final score, match result, or explanation.
- Prompts must instruct the model to extract only explicit or directly unambiguous technical skills, return an evidence span, avoid identity/demographic inference, and return an empty list when uncertain.
- Treat all model output as untrusted: validate it against a Pydantic schema, enforce confidence bounds, verify evidence spans against submitted text, normalize against the taxonomy, and log failures safely.
- An LLM must never determine, rank, select, calibrate, override, or explain a final match score. Do not use an LLM for explanation phrasing.

## 10. Deterministic matching rules

For each student–internship pair, compute only from authorized matching inputs: canonical skill IDs, internship requirement weights, extraction/effective confidence, verification tier, and embeddings.

```text
D = weighted exact required-skill overlap
S = weighted semantic similarity for unmatched required skills only,
    counting similarities below 0.75 as zero
V = verification adjustment based on matched skills, scaled to [0, 0.10]
final_score = clamp(0.65 * D + 0.25 * S + 0.10 * V, 0, 1)
```

- The calculation must be reproducible for identical persisted inputs. Define deterministic ordering/tie-breaking and never use nondeterministic model output at scoring time.
- Persist `deterministic_score`, `semantic_score`, `verification_bonus`, `final_score`, formula/score version, and computation timestamp for every match.
- For team suggestions, use the roadmap's deterministic complementarity objective: target-skill coverage minus `0.5 ×` Jaccard redundancy. Do not present team matching as an ML or LLM judgment.
- Implement and test the exact-overlap component before semantic matching. Semantic scoring is an optional enhancement, not permission to change the deterministic contract.

## 11. Explainability rules

- At match computation time, write a `match_explanations` row for each required/possessed skill with status, score contribution, and contributing evidence ID where applicable.
- Render the explanation solely from stored `matches`, `match_explanations`, `skills`, `evidence`, and verification records using deterministic templates.
- Explanations must identify matched verified skills, matched unverified/partially verified skills, missing requirements, source evidence, component contributions, and the persisted final score as appropriate to the viewer's authorization.
- Never reconstruct an explanation from current mutable state alone, ask an LLM why a match occurred, or make explanation claims that cannot be traced to a record.

## 12. Fairness rules

- Protected attributes and proxies are forbidden matching inputs: name, gender/pronouns, age/DOB, photo, address, caste, religion, ethnicity, disability, marital status, university prestige/name, college tier/ranking, GPA, and family/economic background.
- Store display or operational fields separately when necessary, but do not join them into matching queries or pass them to LLM extraction.
- The matching service must use a restricted PostgreSQL `matching_view` that exposes only the approved matching fields (at minimum `student_id`, `skill_id`, and effective confidence) and a least-privilege database role with no access to `students`.
- Log component scores for auditability. Keep fairness-audit data and any research-only demographic proxy data outside the matching pipeline.
- Include regression tests proving students with identical evidence/skills receive bit-for-bit identical scores despite different names or universities.

## 13. Testing requirements

- Every feature and bug fix requires focused automated tests in the owning backend or frontend test suite. Add integration/API tests when behavior crosses a boundary.
- Matching tests must cover the formula, weights, confidence multipliers, threshold behavior, bounds, deterministic tie-breaking, persistence of components, and team complementarity.
- Test evidence provenance, duplicate-skill evidence retention, extraction validation failure paths, RBAC/company scoping/consent, explanation provenance/template output, fairness isolation, input validation, rate limits, and API compatibility.
- Add migration tests or upgrade checks for schema changes and seed-data checks for taxonomy/demo invariants where relevant.
- Maintain a manual demo-path matrix for signup/login, evidence submission, extraction status, verification, passport display, matching, explanation, fairness demo, and recruiter access boundaries.

## 14. Security requirements

- Validate and size-limit all evidence text, uploads, URLs, and third-party webhook/API data before storage, verification, or LLM use. Treat uploaded evidence as potentially prompt-injecting content.
- Apply rate limits to authentication and costly extraction/verification endpoints using Redis.
- Use parameterized SQL/SQLAlchemy, enforce authorization before resource access, protect CORS settings by environment, and avoid logging personal data or raw secrets.
- Use HTTPS and secure cookie/token handling in deployment. Review dependency and container vulnerabilities before release.
- Record security-relevant failures safely; do not expose stack traces, provider responses, or internal infrastructure details to clients.

## 15. Secrets and environment variables

- Read configuration through Pydantic settings and environment variables. `.env` files are local-only and ignored by Git; `.env.example` contains variable names and non-secret placeholders only.
- Never hardcode, commit, echo, log, paste into fixtures, or expose API keys, JWT signing keys, database URLs containing credentials, OAuth secrets, passwords, or provider tokens.
- Rotate/revoke a secret that is accidentally exposed, remove it from all tracked content where feasible, and document the remediation without reproducing the secret.
- Fail closed with a clear startup/configuration error when mandatory production secrets are absent. Use explicit test-only dummy values isolated from real environments.

## 16. Git workflow and collaboration

- Before editing, inspect the relevant files and current working tree. Preserve user and concurrent-agent changes; do not overwrite or revert unrelated work.
- Keep commits narrow and intentional. Describe behavioral changes, migrations, API compatibility effects, and tests run.
- Do not rewrite working code, reformat unrelated files, upgrade dependencies, or refactor unrelated modules without a concrete defect/requirement and documented justification.
- Coordinate ownership when changes span frontend, API, schema, workers, or infrastructure. A schema/API change must include the needed migration, contract update, and consumer tests in the same change set or a documented compatible rollout.

## 17. Agent responsibilities and change boundaries

- **Architecture agent:** protects these invariants and reviews cross-cutting changes.
- **Backend agent:** owns FastAPI, schemas, services, workers, migrations, and backend tests.
- **Frontend agent:** owns UI, accessibility, typed API integration, and frontend tests.
- **Data/ML agent:** owns taxonomy, extraction validation, embeddings, deterministic matching, seed data, and algorithm tests.
- **Security/QA agent:** owns RBAC/security review, compatibility checks, test coverage, and demo-path verification.

Agents must modify only files required for their assigned task and its direct tests/documentation. They must not change unrelated modules, generated lockfiles, dependencies, APIs, schemas, or configuration as incidental cleanup. If a required edit crosses ownership boundaries, explain the dependency and make the smallest compatible change.

## 18. Handling failing tests

1. Reproduce the failure and identify whether it was pre-existing, caused by the current change, environmental, or a legitimate regression.
2. Diagnose the owning behavior before modifying tests or implementation.
3. Fix the defect in its owning module and add/adjust tests only when the intended behavior has changed and the change is documented.
4. Never delete, skip, weaken, snapshot-overwrite, or change unrelated tests merely to obtain a passing run.
5. Run relevant focused tests, then the widest practical verification suite. If blocked by an external service or environment, report the exact blocker, evidence, and tests not run; do not claim success.

## 19. Definition of Done

A change is done only when:

- It satisfies the requested behavior without violating evidence, determinism, explanation, fairness, security, or compatibility invariants.
- Inputs, outputs, authorization, errors, and persistence are validated and documented where externally observable.
- Required migrations, seed updates, API/schema updates, and compatibility handling are included.
- Focused tests pass, relevant regression/integration tests pass, and manual demo implications are checked when applicable.
- No secrets, protected matching inputs, unverifiable explanation claims, unrelated edits, or unjustified dependencies were introduced.
- The handoff reports files changed, the user-visible behavior, tests run and results, and any known limitations or follow-up work.
