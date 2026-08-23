# Hybrid extraction pipeline

The extraction worker resolves explicit taxonomy names and aliases before using a
model. Clearly nontechnical evidence completes with an empty result, while ambiguous
technical units use a compact extraction-only taxonomy retrieval step. Retrieval is
context, not authority: every returned skill must still be canonical and quote an
exact span from the current evidence.

## Call path

```text
deterministic gate → student cache → lexical/pgvector retrieval
  → optional local HF endpoint
  → configured Cohere/Groq/OpenRouter/Gemini chain
  → deterministic local fallback
```

Resume jobs remain independently retryable, but compatible jobs are leased and sent
in batches of at most 12 units or 12,000 characters. A successful provider stops the
chain. Only transient transport, quota, or server failures fall through; malformed
structured output fails closed.

The fixed quota benchmark models the previous one-job/one-call behavior and a
30-unit ambiguous resume: the baseline requires 30 successful-path extraction calls,
while the hybrid worker completes the same 30 independent jobs in 3 calls. A fully
structured skills resume completes in 0 calls. These counts exclude provider retries
and the separately accounted embedding request.

The cache is scoped by student, evidence type, normalized content, taxonomy
fingerprint, and extraction policy version. It stores skill IDs, confidence, relative
offsets, and safe provenance—not raw evidence. Cache hits are revalidated against the
current evidence before StudentSkill rows are written. Separate evidence sources are
never collapsed.

## Local model option

`HF_EXTRACTION_ENABLED=true` adds an OpenAI-compatible endpoint before external
providers. The API and worker images intentionally do not include Transformers or
PyTorch. The default model identifier is `microsoft/Phi-4-mini-instruct`; approximate
weight memory is 7.7 GB BF16, 3.8 GB at 8-bit, or 2 GB at 4-bit, plus runtime and KV
cache. `google/gemma-3-4b-it` is an alternative that requires accepting its license.

## Accounting and privacy

`extraction_attempts` records stage, provider/model, latency, safe error category,
request count, and token counts when the provider supplies them. It never stores
prompts, evidence, provider bodies, credentials, identity data, protected attributes,
match scores, or explanations. Admins can inspect one resume through
`GET /admin/extraction-metrics/{resume_document_id}`.

The matching formula, readiness calculation, explanation templates, verification
tiers, Gemini embedding model, and 768-dimensional pgvector schema are unchanged.
