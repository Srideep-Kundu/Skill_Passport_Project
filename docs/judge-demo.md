# Five-minute judge demo and Q&A

Use the offline account `maya@example.demo` and the fixture instructions in [DEMO.md](../DEMO.md). Do not call a live provider during this walkthrough.

## Timed script

| Time | Click | Say |
| --- | --- | --- |
| 0:00–0:20 | Sign in as Maya. | “Skill Passport turns evidence into a verifiable skill passport, then matches candidates to internships without black-box ranking.” |
| 0:20–0:55 | Scroll to **Resume Intelligence**. | “This active parsed resume created evidence records and extraction results. The system keeps the source rather than treating a résumé as an untraceable score.” |
| 0:55–1:30 | Open **Unified Candidate Profile** and passport skills. | “Every passport skill is canonical and carries evidence provenance. Python appears from the resume, manual project, and GitHub-backed evidence without becoming three separate skills in a score.” |
| 1:30–1:55 | Open **GitHub verification**. | “The fixture shows verified, partially verified, and unverified tiers. Repository existence alone is not verification; public proof discounts confidence but does not erase a skill.” |
| 1:55–2:45 | Scroll to **Recommended jobs**. | “These Greenhouse, Lever, and Ashby-shaped jobs are normalized offline fixtures. The recommendation is persisted from canonical requirements and evidence-backed skills.” |
| 2:45–3:30 | Expand **Why this match?** on Greenhouse and Ashby roles. | “The Greenhouse explanation visibly names missing Kubernetes and AWS. The Ashby role shows a Keras-to-TensorFlow semantic near-match, not a false exact claim. Every contribution is persisted with evidence.” |
| 3:30–3:50 | Sign out; sign in as the demo recruiter; click **Backend Platform Intern**. | “Aria and Blake have different names and universities but identical allowed inputs. Their persisted scores match; the demo validator recomputes and asserts that equality.” |
| 3:50–4:20 | Sign back in as Maya; open **Saved Discovery** and **Review Queue**. | “This conservative policy filters remote Greenhouse work and creates only one approval-pending review intent. It cannot prepare or submit on its own.” |
| 4:20–4:45 | Open the Lever application and **Tracking**. | “This timeline is explicit: approved, prepared, manual apply chosen, user-reported submitted, then user-reported in review. It never claims provider confirmation.” |
| 4:45–5:00 | Return to passport or explanation. | “The differentiator is evidence-first, deterministic matching: every score can be reconciled, every gap is visible, and protected profile data is outside the matching boundary.” |

## Backup plan

- **API or network unavailable:** use the already-open demo tab or the recruiter screenshot/recording; do not claim a live update occurred.
- **Gemini unavailable:** show the seeded parsed resume and persisted passport/matches; no live extraction is needed.
- **GitHub or job provider unavailable:** show the clearly labelled offline verification and provider fixtures; do not retry as though a fixture were live data.
- **Worker unavailable:** avoid new uploads and continue with the completed extraction records.
- **Redis unavailable:** do not demonstrate rate-limited or queued work; `/ready` will accurately report the dependency issue.

## Judge Q&A

**Architecture**

- **Why FastAPI/PostgreSQL/pgvector/Redis/workers?** FastAPI gives typed async REST boundaries; PostgreSQL keeps evidence, scores, and audit data transactional; pgvector lives beside taxonomy and match records; Redis serves rate limits and extraction work; workers keep LLM/network work off requests.
- **Why not MongoDB, Pinecone, or an LLM ranking?** The product needs joins, foreign keys, migrations, and reproducible score records. Semantic vectors are an enhancement, not an authority. An LLM never ranks, selects, or explains a match.
- **Why normalize external jobs?** Provider payloads differ; one normalized requirement model allows the same deterministic score, explanation, policy, and approval safeguards for all providers.

**Matching and explanation**

- **How is it scored?** Exact weighted overlap is 65%, semantic similarity for otherwise-unmatched requirements is 25% only at ≥0.75, and verification quality is capped at 10%.
- **Why those weights / can a skill count twice?** Exact evidence is the dominant signal; semantic evidence is deliberately limited; verification adjusts trust. Stable requirement/candidate ordering prevents a candidate evidence record from being assigned twice.
- **Preferred skills and unavailable embeddings?** Preferred skills are explanatory zero-weight rows. Without configured compatible embeddings, semantic score is zero; exact and verification remain deterministic.
- **How does the explanation reconcile?** Match components and evidence IDs are persisted at computation time; templates render those persisted values and make zero LLM calls.

**Fairness and verification**

- **How are protected attributes excluded?** Matching reads `matching_view`, not `students`; it contains only IDs, skills, evidence IDs, confidence, and tier. Names, university, GPA, and demographics are not matching inputs. The matcher role has no access to profile/raw-evidence tables.
- **Can the LLM see identity or infer protected data?** Extraction receives only evidence type/text and an opaque correlation ID when needed; prompts forbid identity inference. Resume profile data is not matching input.
- **What does verified mean?** GitHub checks ownership/attributable commits, evidence alignment, language, and timeline. A public repository alone is partial at most; organization repositories require attributable proof. Unverified skills remain with a lower multiplier so public-repo access is not a gate.

**Providers, applications, and security**

- **Are providers scraped or automatically submitted?** Greenhouse, Lever, and Ashby use their provider interfaces, not browser automation. Discovery is bounded. Application creation always needs an explicit recommendation and active resume.
- **Can it apply without permission?** No. Approval comes before preparation. Most flows are assisted/manual. Controlled Lever submission is opt-in, staging-only, credential-scoped, idempotent, and does not infer demographic answers.
- **What happens after timeout?** A submission becomes an explicit unknown state and reconciliation is auditable; it is never silently retried as a duplicate.
- **Secrets, SSRF, uploads, and consent?** Secrets are environment-only; URLs and provider payloads are validated; PDF/DOCX size/type/parser limits and prompt-injection checks are applied; duplicate operations use fingerprints/idempotency; recruiters need both match scope and recorded consent for raw evidence.

## Honest limitations

- No OCR for scanned PDFs, browser automation, or CAPTCHA bypass.
- No guaranteed provider applicant-status tracking or cross-provider duplicate merging.
- Controlled Lever submission requires legitimate scoped credentials.
- Production semantic matching requires configured Gemini embeddings; the demo uses deterministic test embeddings only.
- The matcher role is activated with `SET ROLE` on the shared application connection identity; a separate matcher connection remains future hardening.
- Provider-labelled demo records are offline fixtures, not live provider calls.
