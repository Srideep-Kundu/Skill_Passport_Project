# Explainable external-job matching

External jobs are matched only after ingestion and canonical requirement normalization:

`persisted student skills from matching_view + external_job_requirements → calculate_score → external_job_matches + external_job_match_explanations → student read APIs`

The external target is a thin persistence adapter over the existing `RequirementInput`, `PossessedSkill`, fingerprint, embedding validation, and `calculate_score` code path. It does not inspect a provider name or candidate profile fields. The existing `matches` table remains internship-only because its foreign key requires an `internships` row; `external_job_matches` is the smallest compatible parallel record rather than a polymorphic rewrite.

## Scoring and requirements

External matches use the same versioned calculation as internships:

`final = clamp(0.65 × D + 0.25 × S + V, 0, 1)`

`D` is exact evidence-backed overlap, `S` is thresholded semantic similarity for unmatched required skills, and `V` is the bounded verification component. Requirement skill IDs, weights, evidence-backed effective confidence, verification tier, and approved embeddings are the only score inputs.

Internship matching has always scored required requirements only. External jobs preserve that contract: preferred requirements are persisted and explained, including exact or semantic support and missing status, but contribute zero to D/S/V. This makes missing critical requirements impossible to offset with nice-to-have skills.

## Persistence, explanations, and staleness

Each external match persists all score components, score version, input fingerprint, computation time, and an explanation row per canonical requirement. Explanation rows retain requirement classification, match status, semantic counterpart/similarity, supporting evidence ID, extraction confidence, verification tier, and exact/semantic/verification/total contributions. The deterministic template reads these stored rows only; it makes no model calls. Component totals reconcile to the persisted final score, while preferred zero-weight rows remain visible.

Recommendations are explicitly computed through `POST /external-jobs/matches/recompute`; normal GETs never call a provider or recompute a score. A match is stale if skills/effective confidence/verification, requirements, embedding metadata/configuration, or score version changes, or if the job becomes inactive. Inactive jobs retain historical records but are omitted from active recommendations. Jobs with no required canonical requirement are marked insufficient for matching and receive no invented description-level score.

## Filtering and fairness

`GET /external-jobs/matches` supports persisted recommendation filtering by active state plus optional location, remote, and employment type. Those are eligibility/search filters only. They do not appear in the score fingerprint or score formula. Provider is included only for provenance and display; changing a normalized job's provider cannot change its skill-fit score.

`MIN_EXTERNAL_JOB_MATCH_SCORE` defaults to `0.2` and filters the Recommended Jobs feed only. It does not alter computed scores, searchability, or the canonical job record. Users can still browse all synced jobs, including jobs below threshold.

The matcher still obtains candidate inputs solely from `matching_view`; names, universities, profile completeness, contact data, and protected attributes are neither loaded nor accepted by score functions. The external-match explanation uses existing evidence provenance, not resume/profile text.

## APIs

- `POST /external-jobs/matches/recompute` computes persisted matches for the authenticated student and active jobs only.
- `GET /external-jobs/matches` returns that student's active, threshold-qualified persisted recommendations in deterministic score/posted/company/title/external-ID order.
- `GET /external-jobs/{job_id}/match` returns ready, not-computed, inactive, or insufficient-requirements state.
- `GET /external-job-matches/{match_id}/explanation` returns the owner's persisted deterministic explanation.

There is no application submission, automatic application, browser automation, or application tracking in this feature.
