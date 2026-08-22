# External job providers

External providers are ingestion-only data sources. The dependency flow is:

`provider adapter → normalized external job → PostgreSQL → deterministic external-job matching`

Provider payloads never enter candidate-profile, fairness, recommendation, or scoring code. Normal GET endpoints read only the persisted `external_jobs` records, so availability of an external source cannot change a displayed result.

## Provider interface and capabilities

`JobProvider` exposes `search_jobs`, `get_job`, and `get_application_url`. Its `ProviderCapabilities` explicitly declares `search`, `detail_fetch`, `auto_apply`, and `status_tracking`; unsupported capabilities are `false`, not emulated.

The adapters are YC startup jobs, Greenhouse Job Board API, Lever's public postings API, and Ashby's documented public Job Postings API. Each source identifier must be explicitly configured before discovery or an admin sync can access it. Ashby board names are configured through `ASHBY_JOB_BOARD_NAMES`; its adapter uses only `https://api.ashbyhq.com/posting-api/job-board/{JOB_BOARD_NAME}` and is discovery-only. Indeed and Jobsuit are unavailable until formal partner access exists. See [Ashby provider details](ashby-job-provider.md).

`GET /external-jobs/providers` distinguishes `disabled`, `configured`, `fixture`, `degraded`, `live`, and `unavailable`. Configuration or stored demo rows alone never produce `live`; the public UI preserves these labels. Demo fixture metadata includes `fixture=offline_demo` and `live_provider_call=false`.

## Data and normalization

`external_jobs` stores broadly useful job fields, provider provenance, availability, and `first_seen_at`, `last_seen_at`, and `last_synced_at`. Provider-specific leftovers are bounded JSON metadata and are never returned by the public API. `external_job_requirements` references the existing canonical `skills` table and stores the required/preferred classification, weight, exact-taxonomy confidence, and a source span.

Requirement normalization is deterministic and does not call Gemini: it matches only canonical taxonomy labels or aliases in sanitized plain-text descriptions. A nearby explicit requirements/qualifications cue makes a requirement required; preferred/nice-to-have language makes it preferred; otherwise it remains preferred. This conservative default ensures unstructured job prose cannot silently gain scoring weight. Job descriptions are parsed as untrusted HTML, script/style content is removed, and no candidate data is ever supplied to the provider or normalizer.

## Sync lifecycle and deduplication

An admin invokes `POST /external-jobs/sync` with a provider and configured generic `source_key`. The adapter fetches a complete source, then the service upserts by `(provider, external_id)`, preserving `first_seen_at` and refreshing the remaining fields, requirements, `last_seen_at`, and `last_synced_at`. Once a complete sync succeeds, previously active jobs from that same provider/source that were not observed are marked inactive; history is never deleted. A stalled or malformed provider response cannot reach this deactivation step.

The Greenhouse client uses a fixed HTTPS host, validates source keys and outgoing URLs, has bounded retries for timeouts/transport errors/5xx responses, does not retry 429 responses, and handles 404, malformed JSON, duplicate pages, and empty results with safe errors. Credentials are neither required nor logged.

## API and fairness boundary

Students may use `GET /external-jobs` and `GET /external-jobs/{id}` with pagination plus provider, location, remote, query, employment-type, experience-level, and active filters. The response includes provider, external ID, source URL, and sync freshness, but never raw metadata. `POST /external-jobs/sync` is admin-only and Redis rate-limited.

Location is a search/eligibility filter only; it is not a candidate-quality signal. Matching remains restricted to approved skill inputs and excludes names, education, location, and protected attributes. External-job scores and explanations are persisted separately from internship matches but reuse the same deterministic component formula and provenance rules. Recommendations below `MIN_EXTERNAL_JOB_MATCH_SCORE` are not returned.

## Adding an adapter

Implement `JobProvider`, declare its exact capabilities, keep all network calls inside the adapter, normalize into `NormalizedExternalJob`, and add only provider configuration—not provider payload shapes—to API contracts. Add mocked tests for pagination, errors, schema drift, upserts/inactivation, taxonomy normalization, provenance, authorization, and safe frontend rendering. Do not add an adapter that needs browser automation, CAPTCHA bypassing, or unofficial scraping.
