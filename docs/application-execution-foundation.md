# Application execution foundation

This layer turns an approved application intent into either a reviewed, provider-neutral application payload or an assisted application. It does not automate a browser, collect provider credentials, bypass CAPTCHAs, or invent a Greenhouse submission path.

## Provider boundary

`JobProvider` retains explicit `search`, `detail_fetch`, `auto_apply`, and `status_tracking` capabilities. It now has optional application methods: `get_application_schema`, `validate_application`, `submit_application`, and `get_submission_result`. An adapter that does not explicitly declare `auto_apply=true` cannot submit: the API returns the assisted/manual path instead.

Greenhouse remains `auto_apply=false`. Its public board data can produce an assisted preparation view with the source application URL, the active resume, application-safe profile fields, and evidence-backed match context, but never a machine submission button.

`DeterministicTestApplicationProvider` is deliberately absent from the production registry. It is a test/dev fixture that exercises a declared auto-apply adapter and normalized outcomes; it is not an external integration.

## Lifecycle and review

The state machine is:

```text
approval_pending -> approved -> preparing -> needs_input | prepared
prepared -> ready_to_submit -> submitting -> submitted
submitting -> failed | needs_input | ready_to_submit | unknown_submission_state
```

`manual_apply` and `withdrawn` cannot enter submission. A retryable rate-limit or temporary failure returns to `ready_to_submit`; an ambiguous result becomes `unknown_submission_state` and requires reconciliation rather than an automatic retry. Preparation and every execution transition re-check the Phase 10 approval fingerprint against the current job, match, resume, and application-safe profile snapshot.

Changing a prepared answer clears readiness and returns the application to review (`prepared` or `needs_input`). The user must explicitly mark the exact completed payload ready before the submit endpoint can run.

## Fields and sensitive data

`application_fields` stores normalized provider fields: identifier, label, conceptual type, requirement/category/value constraints, sensitivity, source, answer provenance, answer, and direct-input requirement. Supported types are text, textarea, email, phone, URL, select, multi-select, boolean, file, date, and number.

Only application-safe contact data is prefilled from the approved application snapshot. Technical facts are not generated in this phase. Sensitive/legal fields and any field marked `requires_user_input` require an explicit `user_provided` answer; they are never inferred from a profile or resume. Sensitive answers are stored only when necessary to execute a legitimate provider adapter, are omitted from API form responses, and are never written into generic audit details.

## Payload binding and idempotency

The SHA-256 execution fingerprint deterministically covers the application ID, provider and provider source, external job identity, approved application fingerprint, selected resume snapshot/checksum, provider schema version, and canonically ordered normalized answers. `ready_payload_fingerprint` records the user-reviewed payload. Submission requires both stored fingerprints to equal the current computed value.

`application_submission_attempts` persists an idempotency key derived from application ID and payload fingerprint, attempt count, timestamps, normalized outcome, provider response identifier, and safe error. The attempt is committed as `submitting` before contacting the adapter. Submitted, in-progress, and ambiguous attempts cannot be replayed. Generic transport uncertainty is treated as `unknown_submission_state`, never retried automatically.

## Audit and matching isolation

The workflow records preparation, unanswered-field, answer-update, ready, submission-started, success, failure, and ambiguity events with field identifiers and status only. It does not record sensitive answer values. Application fields and answers are never used by the external-job matching service, so execution cannot change a recommendation score.
