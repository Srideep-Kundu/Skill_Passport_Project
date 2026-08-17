# Recurring job discovery

Students own saved discoveries with a bounded 6, 12, or 24-hour cadence. Each run uses the existing provider adapters, normalized-job persistence, requirement normalization, and deterministic external-job matching pipeline.

Discovery preferences filter what is fetched and surfaced: query, location, remote preference, employment type, experience level, provider, job freshness, and minimum recommendation score. They never enter the skill-fit formula or matching view.

Runs are persisted with safe per-provider summaries. Provider failures are isolated: a successful source can produce a partial run if another source is unavailable or rate-limited. Filtered searches never mark unrelated existing jobs inactive; complete administrator source sync remains responsible for source-wide retirement.

New recommendations use the stable `(discovery, external_job)` identity. A job is new only the first time it clears that discovery's threshold. A changed match fingerprint is recorded as changed, not new. Runs never create applications, approvals, submission attempts, provider answers, or sensitive data changes.

The extraction worker promotes due discoveries roughly once a minute, with a maximum of ten due discoveries per tick. Each provider source is page-bounded and each student is limited to ten enabled discoveries. There is no automatic application, approval, submission, portal scraping, or email scraping.
