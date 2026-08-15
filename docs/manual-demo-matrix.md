# Manual demo-path matrix

Run this matrix against a fresh, seeded environment before a demo or release. Record the date, build/commit, executor, and outcome in the release notes; do not put credentials or personal data in those notes.

| Scenario | Steps | Expected result |
| --- | --- | --- |
| Student signup and login | Register a new student, then log in with the same credentials. | A valid JWT is returned; student routes load; recruiter/admin routes are denied. |
| Recruiter signup and login | Register and log in as a recruiter. | A valid JWT is returned; only that recruiter’s company resources are visible. |
| Evidence submission | Submit project text and an optional safe GitHub URL. | Evidence persists immediately as `pending_extraction`; no request waits for an LLM response. |
| Extraction status and provenance | Poll the evidence record after the worker completes extraction. | Each extracted passport skill links to the submitting evidence, includes a valid span/confidence, and has a verification tier. |
| Verification | Request GitHub verification for evidence with a reachable repository URL. | A verification check is recorded and the tier updates independently of extraction. Provider failures are safe and clear. |
| Passport display | Open the student passport. | Evidence-backed skills, evidence titles, confidence, and verification badges are shown; no evidence-free skills appear. |
| Internship and matches | As a recruiter, create an internship and load its matches. | Results are stable across repeated requests with the same persisted inputs and are scoped to the recruiter’s company. |
| Match explanation | Expand a match explanation as student and recruiter. | Matched/missing skills, evidence references, verification state, component contributions, and persisted final score are template-derived; no LLM call occurs. |
| Fairness regression | Use the seeded pair with the same skills/evidence and distinct name/university values. | Match scores and ordering are identical bit-for-bit. |
| Recruiter evidence boundary | Attempt to open a candidate’s raw evidence before and after consent is granted. | Access is denied without consent and allowed only for the authorized internship after consent. |
| Team suggestion | Request a team suggestion for a target skill set. | Deterministic pairs/groups show coverage and the Jaccard redundancy penalty. |
| Error and rate-limit behavior | Send invalid evidence, malformed JWTs, and repeated auth/extraction requests. | Requests return structured errors; no secret, stack trace, or raw provider output is exposed; rate-limited requests are rejected safely. |
