# Unified Candidate Profile

`GET /passport/profile` is a student-private, read-only aggregation of the authoritative `student_skills`, `skills`, and `evidence` records. It never writes a second skill source of truth and does not change matching queries.

For each canonical skill, every evidence-backed student-skill row remains visible with its original extraction confidence, verification tier, span, and origin. The highest tier is a summary only; it never changes the tier on the individual supports.

The summary confidence is deterministic and display/audit-only: group supports with the same normalized evidence type and title, retain the strongest effective confidence in each group, then compute `min(1, strongest + 0.15 × sum(min(other_group, 0.5)))`. Effective confidence remains extraction confidence multiplied by the existing verification multiplier. This caps duplicate reinforcement while allowing independent evidence to modestly reinforce a skill.

Exact same-type/title manual and resume evidence is flagged as a potential duplicate. Nothing is deleted or merged automatically. All matching continues to use the existing restricted `matching_view`, not this profile object.

The profile includes an active-resume reference, GitHub identity status, and transparent completeness booleans. Completeness is not a quality or ranking score.

Private profile data (name, email, university, contact details, raw resume text, and protected attributes) is absent from both the endpoint and the narrow `MatchingProfileResponse` helper. The endpoint is student-only; recruiters continue to use scoped match/explanation routes with consent controls.
