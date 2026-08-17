# Application tracking and reconciliation

Application workflow and application tracking are deliberately separate. Workflow controls approval, preparation, submission, manual application, and local withdrawal. Tracking records the latest known post-submission state without changing matching or recommendation scores.

## Status and provenance

`applications.tracking_status` is one of `submitted`, `received`, `in_review`, `rejected`, `interview`, `offer`, `hired`, `withdrawn`, or `unknown`. Its companion source is `system`, `provider`, `user`, or `admin`.

Every material action produces an append-only `application_status_events` row. It contains an event type, optional normalized tracking status, provenance, timestamp, optional safe provider status, and safe metadata. It never contains application answers, uploaded resume data, or provider credentials. Submission attempts remain separate immutable records with their fingerprint, result, timestamps, provider reference, and safe error.

## Ambiguous submissions

When a submission POST times out after it may have reached the provider, the application enters `unknown_submission_state` and tracking becomes `unknown`. It is never automatically submitted again. The student may request reconciliation once, mark it submitted manually, open the provider page, or leave it unresolved.

Lever and Greenhouse are explicitly declared as having no applicant-status lookup in this release. No dashboard or portal scraping occurs. A future adapter may enable lookup only with an official documented endpoint, correctly scoped credentials, a stored provider-confirmed application ID, and an explicit normalized status mapping.

## Manual application and withdrawal

Students can select manual apply and record a local submission time plus an optional format-validated confirmation reference. This is `user` provenance and never becomes an authoritative provider ID or provider-confirmed state. Local withdrawal is always available and produces a `withdrawn` user event. Provider-side withdrawal is not attempted because no configured adapter officially supports it.

## API and UI

Student-owned endpoints expose the application, its timeline, and redacted attempt history, plus manual-submitted, reconciliation, and withdrawal actions. Ownership checks apply uniformly. The dashboard renders a timeline and an explicit ambiguous-state warning; it has no retry-submission action.

## Fairness boundary

Application statuses, attempt results, provider outcomes, and status events never enter the matching view, matching services, embeddings, or score calculations. They are operational tracking data only.
