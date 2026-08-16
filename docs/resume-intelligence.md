# Resume intelligence

Students upload a text-based PDF or DOCX to `POST /resumes`. The API validates its extension, declared MIME type, byte limit, and actual parseability before storing it under a generated key in managed local storage. Application code depends on the `ResumeStorage` interface, so object storage can replace the local implementation later.

`POST /resumes/{id}/parse` deterministically extracts text with `pypdf` or `python-docx`, then validates a structured `ResumeParsedData` result. Image-only PDFs are retained with an `unsupported` status and a clear user-facing message; OCR is intentionally not used. Malformed files are rejected and never stored.

The parser creates evidence only for projects, certifications, achievements, and a carefully isolated explicit-technical-skills section. Every generated evidence row contains `resume_document_id`, section, and source hash provenance, then receives the existing extraction job. No resume skill bypasses taxonomy normalization, verification, matching, or deterministic explanation.

Contact details and detected protected-attribute labels live only in the private resume record/parsed preview. Matching still reads exclusively from `matching_view`; the resume is never embedded or joined into matching. Resume text is untrusted data and the deterministic parser never executes it, follows links, or treats instructions in it as claims.

Documents are immutable historical records. The same checksum for the same student returns the existing document. Reparse is idempotent because generated evidence is keyed by document plus source hash. Uploading another resume does not remove evidence from the prior one; activation changes only the current-resume flag. A document with generated evidence cannot be deleted until the student explicitly removes that evidence.
