# External job providers

External providers are ingestion-only data sources. The dependency flow is:

`provider adapter → normalized external job → PostgreSQL → future external-job match adapter`

Provider payloads never enter candidate-profile, fairness, recommendation, or scoring code. Normal GET endpoints read only the persisted `external_jobs` records, so availability of an external source cannot change a displayed result.

## Provider interface and capabilities

`JobProvider` exposes `search_jobs`, `get_job`, and `get_application_url`. Its `ProviderCapabilities` explicitly declares `search`, `detail_fetch`, `auto_apply`, and `status_tracking`; unsupported capabilities are `false`, not emulated.

The first adapter is Greenhouse Job Board API. Greenhouse documents public, unauthenticated GET endpoints for published job boards and jobs; the adapter calls only `https://boards-api.greenhouse.io/v1/boards/{board_token}` and its job endpoints. It never submits applications, controls a browser, or scrapes HTML pages. A board token must be explicitly allowlisted in `GREENHOUSE_BOARD_TOKENS` before an admin can request `POST /external-jobs/sync`.

## Data and normalization

`external_jobs` stores broadly useful job fields, provider provenance, availability, and `first_seen_at`, `last_seen_at`, and `last_synced_at`. Provider-specific leftovers are bounded JSON metadata and are never returned by the public API. `external_job_requirements` references the existing canonical `skills` table and stores the required/preferred classification, weight, exact-taxonomy confidence, and a source span.

Requirement normalization is deterministic and does not call Gemini: it matches only canonical taxonomy labels or aliases in sanitized plain-text descriptions. A nearby explicit requirements/qualifications cue makes a requirement required; preferred/nice-to-have language makes it preferred; otherwise it remains preferred. This conservative default ensures unstructured job prose cannot silently gain scoring weight. Job descriptions are parsed as untrusted HTML, script/style content is removed, and no candidate data is ever supplied to the provider or normalizer.

## Sync lifecycle and deduplication

An admin invokes `POST /external-jobs/sync` with a provider and configured generic `source_key`. The adapter fetches a complete source, then the service upserts by `(provider, external_id)`, preserving `first_seen_at` and refreshing the remaining fields, requirements, `last_seen_at`, and `last_synced_at`. Once a complete sync succeeds, previously active jobs from that same provider/source that were not observed are marked inactive; history is never deleted. A stalled or malformed provider response cannot reach this deactivation step.

The Greenhouse client uses a fixed HTTPS host, validates source keys and outgoing URLs, has bounded retries for timeouts/transport errors/5xx responses, does not retry 429 responses, and handles 404, malformed JSON, duplicate pages, and empty results with safe errors. Credentials are neither required nor logged.

## API and fairness boundary

Students may use `GET /external-jobs` and `GET /external-jobs/{id}` with pagination plus provider, location, remote, query, employment-type, experience-level, and active filters. The response includes provider, external ID, source URL, and sync freshness, but never raw metadata. `POST /external-jobs/sync` is admin-only and Redis rate-limited.

Location is a search/eligibility filter only; it is not a candidate-quality signal. Existing matching remains restricted to `matching_view`, which excludes names, education, location, and protected attributes. `external_job_requirements` can be read as the same `RequirementInput` shape used by the deterministic matcher, but Phase 8 intentionally does not persist or display external-job scores/explanations yet. This avoids creating a second formula or prematurely changing the internship `matches` contract.

## Adding an adapter

Implement `JobProvider`, declare its exact capabilities, keep all network calls inside the adapter, normalize into `NormalizedExternalJob`, and add only provider configuration—not provider payload shapes—to API contracts. Add mocked tests for pagination, errors, schema drift, upserts/inactivation, taxonomy normalization, provenance, authorization, and safe frontend rendering. Do not add an adapter that needs browser automation, CAPTCHA bypassing, or unofficial scraping.
