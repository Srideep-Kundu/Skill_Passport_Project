# Core CRUD and account identity

Collection endpoints use the same response shape:

```json
{"page": 1, "page_size": 20, "total": 42, "items": []}
```

`page` starts at 1 and `page_size` is limited to 100. Evidence supports `evidence_type` and `extraction_status` filters; internships support a title `query` filter. Student and recruiter match collections use the same page shape.

Editing an evidence description or type deletes its prior derived `student_skills`, resets the one extraction job, and queues fresh extraction. Deleting evidence deletes its skills, verification checks, and extraction job; persisted matches stay available but are stale because their input fingerprint no longer matches. Deleting an internship removes its matches and persisted explanations.

`account_emails` is a small global registry with a primary key on normalized email. Registration creates the role record and registry record in one transaction, so duplicate emails across student, recruiter, and admin accounts are rejected both by the preflight check and by the registry's database constraint under a race. The registry is deliberately not a polymorphic foreign key: the existing role-specific account tables remain the source of profile data. Any future direct account provisioning must insert the corresponding registry row in the same transaction.
