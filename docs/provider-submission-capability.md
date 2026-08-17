# Provider submission capability

Phase 12 distinguishes a provider's technical API capability from permission to submit to a particular employer's posting. Public job discovery never grants application-submission authority.

## Capability decision

For each prepared application, the provider returns a non-secret decision with:

- `provider_supports_submission`: the provider offers an official submission API.
- `credentials_configured`: a credential exists for the exact provider and employer board/site scope.
- `posting_supports_submission`: the posting is eligible for that provider's official flow.
- `application_schema_available`: every required field can be safely represented.
- `submission_ready`: all of the above **and** an explicitly enabled controlled submission adapter are present.

Any false requirement selects `fallback=assisted`. The API and UI never infer readiness from a public posting, a provider name, or a generic API key.

## Credentials and scope

Credentials are read only from environment/secret-provider configuration, never from jobs, applications, database records, API responses, or audit events. Development uses optional JSON arrays in `GREENHOUSE_APPLICATION_CREDENTIALS` and `LEVER_APPLICATION_CREDENTIALS`:

```json
[{"scope":"employer-board-or-site","api_key":"provider-secret"}]
```

`scope` is compared exactly (case-insensitively) with `external_jobs.provider_source`. A Greenhouse credential for board `company-a`, for example, cannot be selected for a `company-b` job. The secret is not returned or logged. Production credentials belong in the deployment platform's secret manager, not `.env` or Git.

## Provider behavior

Greenhouse's public Job Board API supports job discovery; its authenticated application endpoint is a separate capability. The adapter records that distinction and maps public application-question metadata only when available. A missing credential, a wrong-board credential, or an unmapped required question keeps the job assisted-only.

Lever has a public postings adapter and an authenticated official application-question discovery path. The adapter maps supported official fields to the normalized Phase 11 model. Unsupported required fields and required file-upload fields force assisted fallback. The release does not submit requests to either provider: a controlled submission adapter, provider approval, and an end-to-end staging review are required first.

## Schema, sensitive fields, and files

Supported normalized types are text, textarea, email, phone, URL, select, multi-select, boolean, date, number, and file. Unknown required fields are recorded as unsafe rather than silently dropped. Sensitive labels (including EEO/demographic, work authorization, visa, criminal-history, and salary questions) are marked for direct user input; no answer is inferred.

File fields remain assisted-only in this release. A future upload adapter must read the approved active resume from managed storage, verify its checksum and size/type against the approved snapshot and provider limits, and persist only a provider-private upload reference. It must never expose upload URLs to the client or duplicate a resume unnecessarily.

## Adding a future provider

1. Implement only documented official endpoints and preserve public discovery separately from authenticated submission.
2. Add provider-scoped secret configuration and an exact job-to-scope match.
3. Normalize every official required field; fail to assisted mode for unknown or unsupported requirements.
4. Implement upload handling and an idempotent controlled submission adapter only after review.
5. Add mocked contract tests for scope isolation, malformed schemas, sensitive fields, idempotency, and fallback before any staging submission test.
