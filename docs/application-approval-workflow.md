# Application approval workflow

This workflow records a student's explicit intent to apply to one external job. It does **not** submit an application to a provider, automate a browser, retain provider credentials, or claim that a provider-side application exists.

## Explicit approval rule

An `applications` record is created only when a student selects a persisted external-job recommendation. The record binds one student, one external job, one persisted recommendation, and the active resume used at review time. A recommendation, profile setting, or prior approval never authorizes another job or a changed payload.

The implemented state machine is deliberately small:

```text
approval_pending -> approved -> approval_pending  (revoke before any execution)
approval_pending -> manual_apply -> withdrawn
approval_pending -> withdrawn
approved -> manual_apply | withdrawn
```

There is no submission state or submit endpoint. Invalid transitions return a conflict response. A withdrawn record is terminal. Manual application is a recorded choice, not a failure, and only exposes the original provider URL.

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

Provider capabilities are snapshotted for future compatibility. Current Greenhouse capability is `auto_apply=false`; this phase routes the student to manual apply and contains no provider execution code. Before an Application Execution phase, the repository still needs a separately reviewed execution contract, per-provider authorization/capability checks, payload field review with direct user input for sensitive questions, idempotency/withdrawal semantics, and provider response handling.
