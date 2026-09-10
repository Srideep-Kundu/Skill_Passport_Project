# Localization architecture and glossary

English (`en`) is the authoritative source and fallback locale. Display locale is a user preference only: it is excluded from the restricted matching view, score computation, extraction prompts, canonical identifiers, audit identifiers, hashes, and formula versions.

The frontend extracts a deterministic inventory of user-facing source phrases from application TSX and localization resources. Locale catalogs are static, checked-in JSON and are loaded on demand. `PortalTextLocalizer` applies exact source-phrase translations to rendered text and accessibility attributes, including lazy-loaded tabs and dialogs. It never calls a translation service at runtime and excludes code, formulas, and explicitly protected content.

## Translation coverage

The complete 1,959-phrase portal catalog is present for Assamese, Bengali, Bodo, Dogri, Gujarati, Hindi, Kannada, Konkani, Maithili, Malayalam, Marathi, Nepali, Odia, Punjabi, Sanskrit, Tamil, and Telugu. Catalog integrity tests require every complete locale to contain the exact source inventory with no empty translations. Manipuri/Meitei and Santali retain core-navigation translations with English fallback for remaining portal phrases. Urdu, Kashmiri, and Sindhi are not supported or selectable.

Run `node scripts/extract-ui-phrases.mjs` after changing visible copy. `scripts/generate-static-translations.py` is a maintainer-only catalog generator and is not part of the application bundle. Generated output requires native-speaker review, especially Bodo, Dogri, Konkani, and other low-resource locales.

## Script policy

Manipuri uses Meitei Mayek; Santali uses Ol Chiki; Punjabi uses Gurmukhi; Konkani, Bodo, and Dogri use Devanagari. These initial choices intentionally avoid multiple script variants.

## Translator glossary

Use these concepts consistently. Persisted identifiers and enum values remain in English even when their display labels are localized.

| Term | Translator note |
| --- | --- |
| Skill Passport | Evidence-backed record of a person's demonstrated skills; not a government passport. |
| Evidence | A submitted artifact supporting a skill claim. |
| Evidence provenance | Traceable origin linking a skill to a specific evidence record. |
| Verification | Independent checking of evidence. |
| Verified | Highest verification tier; multiplier remains `1.00`. |
| Partially verified | Middle verification tier; multiplier remains `0.85`. |
| Unverified | Evidence exists but lacks independent verification; multiplier remains `0.65`. |
| Internship | A time-bound work-learning opportunity. |
| Match score | Persisted deterministic result on the `[0, 1]` scale. |
| Exact skill overlap | Weighted overlap of canonical required skills. |
| Semantic similarity | Cosine similarity used only for unmatched requirements above the fixed threshold. |
| Verification adjustment | Persisted verification component of the score. |
| Missing requirement | Required skill not supported by the candidate's persisted evidence. |
| Recruiter | Authorized employer-side user. |
| Student | Candidate maintaining an evidence-backed passport. |
| Faculty | Academician user; do not translate as administrative staff. |
| Institution | University or authorized educational institution account. |
| Team complementarity | Deterministic coverage benefit after redundancy penalty. |
| Consent | Student-controlled permission for recruiter access to raw evidence. |
| Audit log | Immutable operational record of material actions and computations. |

Technical skill names, product brand `Lumina Intel`, `pgvector`, URLs, identifiers, formula symbols, and source-code names should normally remain unchanged. All translations require native-speaker review before being treated as legally or institutionally authoritative.
