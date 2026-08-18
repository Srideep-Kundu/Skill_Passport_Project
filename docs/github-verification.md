# GitHub project verification

Students explicitly claim one GitHub username after the service confirms that the public account exists. This is an account association, not OAuth authentication or cryptographic proof of account control.

For project evidence with a canonical `https://github.com/<owner>/<repository>` URL, the service persists these checks for every verification run:

- `repository_accessible`: public repository metadata is available.
- `repository_owner_match`: the linked account owns a user-owned repository. Organization ownership is not applicable rather than a failure.
- `commit_author_match`: counts only commits whose GitHub `author.login` equals the linked username. Display names and unlinked commit emails do not count. Three or more commits in the bounded sample of 100 are a pass; one or two are partial; zero is a fail.
- `language_consistency`: explicit language names in evidence are compared with GitHub language metadata. Frameworks are not inferred.
- `timeline_consistency`: only explicit four-digit years in evidence are compared with repository creation and latest push years. No stated timeframe is not applicable.

Tier calculation is deterministic:

1. A failed commit, language, or timeline check makes the evidence `unverified`.
2. Otherwise, a passing commit-authorship check makes it `verified`.
3. Otherwise, any passing or partial supporting check makes it `partially_verified`.
4. With no supporting check, it is `unverified`.

Repository accessibility by itself can therefore never produce `verified`. GitHub timeout, rate-limit, malformed provider response, and 5xx conditions are recorded as safe partial checks and preserve the previously stored skill tier.
