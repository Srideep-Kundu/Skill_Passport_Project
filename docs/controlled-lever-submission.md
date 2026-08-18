# Controlled Lever submission

Phase 13 implements one official provider POST path: Lever. Greenhouse remains assisted-only. Lever was selected because its official developer documentation defines an authenticated application-question endpoint, file upload flow, and Apply to a posting endpoint. The integration makes no browser requests and never uses a public job listing as authority to submit.

## Staging-only boundary

All of the following must be set before the API can make a Lever POST:

```text
APP_ENV=staging
APPLICATION_EXECUTION_MODE=staging_submit
PROVIDER_SUBMISSION_ENABLED=true
LEVER_SUBMISSION_ENABLED=true
```

The default is assisted mode. Production startup rejects these settings, and CI uses mocks only. A matched credential must be present in `LEVER_APPLICATION_CREDENTIALS` for the exact Lever site (`external_jobs.provider_source`), using the Phase 12 scoped configuration format. A credential for one employer cannot submit to another employer's posting.

## Official request flow

1. Retrieve `GET /v1/postings/{posting}/apply` with the employer-scoped API credential and normalize the official required fields.
2. If the form contains a required, unmappable, or required EEO field, keep the application assisted-only. EEO data is not serialized by this adapter.
3. For a recognized required resume field, verify the approved resume document ID, checksum, managed-storage contents, MIME type, and size before upload.
4. Upload that exact document to `POST /v1/uploads`, then retain the returned provider URI only in-memory for the immediate request.
5. Submit the serialized official fields to `POST /v1/postings/{posting}/apply?send_confirmation_email=true` using HTTP Basic API-key authentication.

The provider field ID and its form group are persisted with the normalized field so the POST can reproduce the officially retrieved form structure. No resume upload URI or provider credential is returned to the browser or written to the generic audit payload.

## Submission safeguards

Phase 11 approval fingerprint, payload fingerprint, user-input, ownership, and persisted idempotency checks execute before the provider call. Lever's documented endpoint does not expose a native idempotency key in this integration, so the internal persisted idempotency key is authoritative.

A `429` or definite 5xx becomes a retryable result. A connection failure before a request is sent is retryable. A timeout or transport failure after issuing an upload or application POST is `unknown_submission_state`; it is never automatically replayed. Provider validation responses become `needs_input` and do not expose provider details.

## Controlled testing

Use only a legitimately provisioned staging/test Lever employer account and an API key scoped to that site. First exercise the mocked contract tests, then configure the four staging settings and the exact site credential. Do not point this integration at random public employers or production candidate data. If no legitimate test employer is available, leave all flags disabled and use assisted application.
