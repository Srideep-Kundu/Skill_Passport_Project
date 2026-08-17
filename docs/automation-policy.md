# Automation policy boundary

Automation policies operate only after deterministic external-job matching. They filter and prioritize recommendations using job metadata and canonical job requirement skill IDs; they never modify match scores or query protected student data.

Policies are disabled by default. They can surface eligible work in the review queue and may create an `approval_pending` review intent; they cannot approve an application, prepare provider fields, supply answers, alter sensitive fields, bypass stale checks, or submit to a provider.

The current lifecycle requires explicit student approval before preparation. Automation stops at application intent/review queue creation. After explicit approval, the existing preparation workflow begins; submission remains separately capability- and safety-gated.

Policy decisions are deterministic: score threshold, provider/location/remote/employment/experience constraints, company/keyword exclusions, then canonical job-skill any/all/exclusion rules. Lower `priority` wins deterministic queue ordering. Limits cap job processing, review intents per run/day, and the pending review queue. A prior application for the same student and external job is never reopened automatically, including withdrawn, manual, and submitted records.
