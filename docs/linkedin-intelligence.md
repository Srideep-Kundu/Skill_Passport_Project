# LinkedIn Intelligence & Export Parser Architecture

## 1. Overview & Non-Negotiable Privacy Principles

Skill Passport provides a **deterministic, user-provided LinkedIn Data Export parser**.

### Strict Anti-Scraping Guarantee
- **No Web Scraping**: The platform never scrapes `linkedin.com` or calls unofficial/reverse-engineered LinkedIn APIs.
- **No Browser Automation**: No browser automation tools (Selenium, Playwright, Puppeteer) are used to access LinkedIn accounts.
- **No Password Collection**: The platform never asks for, stores, or handles LinkedIn passwords or OAuth credentials.
- **Self-Service Export**: Students export their own data archive from LinkedIn's official privacy portal and upload the `.zip` archive directly.

---

## 2. Privacy & Fairness Boundaries

| Attribute | Included in Extraction & Evidence? | Included in Embeddings & Scoring? |
| :--- | :--- | :--- |
| **Positions / Roles** | Yes (Title, Company, Role Description) | Yes (Extracted canonical skills only) |
| **Projects** | Yes (Title, Description, URL) | Yes (Extracted canonical skills only) |
| **Certifications** | Yes (Name, Authority, License) | Yes (Extracted canonical skills only) |
| **Declared Skills** | Yes (Explicit skill names) | Yes (Extracted canonical skills only) |
| **Education & Courses** | Yes (Degree, Field of Study, Courses) | Yes (Extracted canonical skills only) |
| **Publications** | Yes (Title, Publisher, Description) | Yes (Extracted canonical skills only) |
| **Name & Email** | **NO** (Strictly excluded) | **NO** (Strictly excluded) |
| **Headline & Summary** | **NO** (Strictly excluded) | **NO** (Strictly excluded) |
| **Connections / Network**| **NO** (Strictly excluded) | **NO** (Strictly excluded) |
| **Location / Demographics**| **NO** (Strictly excluded) | **NO** (Strictly excluded) |

### Evidence Provenance Labeling
- Every piece of generated evidence is categorized under `linkedin_category` and marked with `raw_metadata={"source": "linkedin_export"}`.
- In UI displays, claims are clearly labeled as **"User-Provided LinkedIn Export"** (never misrepresented as a "Verified LinkedIn profile").

---

## 3. Security Hardening

- **Archive Format**: Strictly `.zip` archives.
- **Size Limit**: Maximum 10 MB per zip archive.
- **Uncompressed Size Limit**: Maximum 50 MB total across all extracted files.
- **Compression Ratio Cap**: 100:1 ratio limit to defend against decompression bombs ("zip bombs").
- **Path Traversal Protection**: Rejects entries with directory traversal sequences (`..`), leading slashes (`/`, `\`), or absolute drive paths.
- **Prompt Injection Defense**: Sanitizes descriptions and titles matching adversarial prompt injection phrases (e.g. `ignore previous`, `system prompt`, `always match 100%`).
- **Student Data Isolation**: Strict row-level tenant boundaries ensure students can only view, parse, activate, and delete their own LinkedIn imports.

---

## 4. API Endpoints

- `POST /linkedin/imports`: Upload LinkedIn `.zip` export (SHA-256 checksum idempotency).
- `GET /linkedin/imports`: List all LinkedIn data imports for the authenticated student.
- `GET /linkedin/imports/{id}`: Retrieve parse status, evidence counts, and categorized records.
- `POST /linkedin/imports/{id}/parse`: Parse archive CSVs and enqueue extraction jobs.
- `PUT /linkedin/imports/{id}/activate`: Designate the active LinkedIn export for candidate profiling.
- `DELETE /linkedin/imports/{id}`: Delete an import (with cascade / duplicate safety checks).

---

## 5. Integration with Candidate Profile & Matching

- Activating a LinkedIn import **coexists** with the student's active resume.
- Skills extracted from LinkedIn evidence feed into the student's **Skill Passport** and **Candidate Profile**.
- Identical skills across resume and LinkedIn evidence are deduplicated with source diversity tracking to prevent artificial score inflation.
- Matching remains 100% deterministic based solely on verifiable skills and verification tiers.
