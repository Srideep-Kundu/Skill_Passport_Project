# Ashby public job-board provider

The Ashby adapter uses Ashby's documented public Job Postings API: `GET https://api.ashbyhq.com/posting-api/job-board/{JOB_BOARD_NAME}?includeCompensation=true`. It reads published public postings for an allowlisted job-board name and requires no credential. The job-board name is the final segment of the employer's Ashby-hosted jobs URL and must be configured in `ASHBY_JOB_BOARD_NAMES`.

The adapter declares `search=true`, `detail_fetch=false`, `auto_apply=false`, and `status_tracking=false`. Ashby documents separate custom-careers-page form and submission capabilities, but this release deliberately does not use them. Ashby jobs therefore remain on the existing assisted/manual application path.

It normalizes only documented public fields: posting ID, title, sanitized description, location, remote/workplace type, employment type, annual salary component when present, public job/apply URLs, and publication time. Department, team, secondary locations, and other bounded public leftovers remain private provider metadata. Requirement extraction reuses the existing taxonomy alias pipeline; matching and explanations are unchanged.

All requests use the fixed `api.ashbyhq.com` HTTPS host, reject redirects and unsafe job URLs, validate board names, cap result pages locally, retry transport/5xx failures once, and surface 429 responses without retry. A failed Ashby source produces a partial discovery run without preventing other configured providers from running.

Jobs retain the existing `(provider, external_id)` identity. Cross-provider duplicates remain separate records by design; automation's existing student-plus-external-job protection means a listing is never reopened automatically.
