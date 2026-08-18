# Application approval workflow

This workflow records a student's explicit intent to apply to one external job. It does not automate a browser, retain provider credentials, or claim that a provider-side application exists until a separately capability-gated execution adapter confirms it. See [the application execution foundation](application-execution-foundation.md) for the Phase 11 preparation and submission boundary.

## Explicit approval rule

An `applications` record is created only when a student selects a persisted external-job recommendation. The record binds one student, one external job, one persisted recommendation, and the active resume used at review time. A recommendation, profile setting, or prior approval never authorizes another job or a changed payload.

The implemented state machine is deliberately small:

```text
approval_pending -> approved -> approval_pending  (revoke before any execution)
approval_pending -> manual_apply -> withdrawn
approval_pending -> withdrawn
approved -> manual_apply | withdrawn
```

Approval remains a prerequisite for preparation and submission. Invalid transitions return a conflict response. A withdrawn record is terminal. Manual application is a recorded choice, not a failure, and only exposes the original provider URL. The execution states and their additional safeguards are documented in the application execution foundation.

## Approval snapshot and staleness

Creation and approval review use a deterministic SHA-256 fingerprint over a versioned snapshot containing:

- persisted job/provider/title/company/source URL plus a hash of the material job content;
- exact persisted match ID, match input fingerprint, component scores, source evidence references, and missing skills;
- selected active resume ID/checksum/parser version; and
- an application-safe profile: name, email, phone, portfolio/GitHub links, education, and experience.

The application-safe profile is separate from `matching_view`. Identity/contact fields never enter matching or alter a match score. Sensitive self-identification questions (for example gender, ethnicity, disability, religion, caste, veteran status, or sexual orientation) have no stored answer in this workflow and must require direct user input in a future form implementation.

An approved fingerprint becomes stale when the active resume changes, material job content changes, the persisted recommendation changes, or the application-safe profile changes. Resume activation proactively demotes affected approvals to `approval_pending`. Job sync checks and invalidates stale approvals. Other stale approvals are detected when read or when an approval action is attempted; an approval cannot be replayed for changed inputs. The student must refresh the review snapshot and explicitly approve again.

## API and audit trail

Student-scoped endpoints are:

- `POST /applications` — create an intent from `{ external_job_id, external_job_match_id }`.
- `GET /applications` and `GET /applications/{id}` — list/view only the caller's records.
- `POST /applications/{id}/request-approval`
- `POST /applications/{id}/approve`
- `POST /applications/{id}/revoke-approval`
- `POST /applications/{id}/manual`
- `POST /applications/{id}/withdraw`

Cross-student application IDs return the same 404 response as absent IDs. Audit entries contain only actor, application/job IDs, status transition metadata, and a fingerprint—not application-safe profile values or sensitive payloads. Events include `application_intent_created`, `approval_requested`, `application_approved`, `approval_revoked`, `manual_apply_selected`, `application_withdrawn`, and `approval_invalidated`.

Provider capabilities are snapshotted for future compatibility. Current Greenhouse capability remains `auto_apply=false`; it routes the student to assisted/manual application only. The provider-neutral execution contract, payload review, sensitive direct-input handling, idempotency, and normalized provider responses are documented in the application execution foundation.
