import os
from typing import Any

import httpx

BASE_URL = os.environ.get("BASE_URL", "http://backend:8000")
DEMO_PASSWORD = "DemoPassword123"


def _headers(client: httpx.Client, email: str) -> dict[str, str]:
    response = client.post(
        "/auth/login", json={"email": email, "password": DEMO_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed for {email}"
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _json(
    client: httpx.Client, path: str, headers: dict[str, str] | None = None
) -> Any:
    response = client.get(path, headers=headers)
    assert response.status_code == 200, f"GET {path} returned {response.status_code}"
    return response.json()


def _require_records(value: Any, label: str) -> None:
    if isinstance(value, list):
        assert value, f"Missing seeded {label} records"
        return
    if isinstance(value, dict) and "items" in value:
        assert value["items"], f"Missing seeded {label} records"


def check_all_personas() -> None:
    with httpx.Client(base_url=BASE_URL, timeout=20.0) as client:
        student = _headers(client, "maya@example.demo")
        passport = _json(client, "/passport/me", student)
        assert passport["skills"], "Student passport has no provenance-backed skills"
        _require_records(
            _json(client, "/assessments/attempts/me", student), "assessment attempts"
        )
        _require_records(_json(client, "/learning/courses", student), "learning")
        _require_records(
            _json(client, "/internship-engagements/me", student),
            "internship outcomes",
        )
        _require_records(
            _json(client, "/students/me/applications", student), "applications"
        )
        _require_records(
            _json(client, "/collaborations/projects/me", student), "collaborations"
        )
        _json(client, "/skill-gaps/analyze", student)
        _json(client, "/students/me/matches", student)
        providers = _json(client, "/external-jobs/providers", student)
        assert all(
            not (item["status"] == "live" and item["fixture"])
            for item in providers
        ), "Fixture provider data was reported as live"
        print("PASS student passport, outcomes, matching, and provider truthfulness")

        recruiter = _headers(client, "recruiter@example.demo")
        _require_records(
            _json(client, "/learning/programs/mine", recruiter), "recruiter programs"
        )
        _require_records(
            _json(client, "/placements/drives/mine", recruiter), "placement jobs"
        )
        _require_records(
            _json(client, "/internship-engagements/recruiter", recruiter),
            "recruiter internship outcomes",
        )
        _require_records(
            _json(client, "/collaborations/recruiter/challenges", recruiter),
            "recruiter challenges",
        )
        _require_records(
            _json(client, "/collaborations/recruiter/invitations", recruiter),
            "faculty invitations",
        )
        _json(client, "/recruiter-analytics/me/demand", recruiter)
        print("PASS recruiter-owned programs, pipelines, collaboration, and demand")

        faculty = _headers(client, "faculty@example.demo")
        _json(client, "/academician/passport/me", faculty)
        _require_records(
            _json(client, "/collaborations/invitations/me", faculty),
            "faculty invitation history",
        )
        print("PASS faculty passport and invitation lifecycle")

        institution = _headers(client, "dean@example.demo")
        _json(client, "/institution/analytics", institution)
        _json(client, "/institution/demand-supply", institution)
        _require_records(
            _json(client, "/institution/imports", institution), "institution imports"
        )
        _require_records(
            _json(client, "/institution/mappings", institution),
            "institution mappings",
        )
        print("PASS institution analytics, tenant data, imports, and mappings")

        share_response = client.post(
            "/passport/shares",
            headers=student,
            json={
                "label": "Phase 11 release validation",
                "visibility_allowlist": [
                    "verified_skills",
                    "assessment_competencies",
                    "learning_outcomes",
                    "internship_outcomes",
                    "collaboration_outcomes",
                ],
            },
        )
        assert share_response.status_code == 201
        share = share_response.json()
        token = share["raw_token"]
        _json(client, f"/public/passports/{token}")
        assert client.get(f"/public/passports/{token}.pdf").status_code == 200
        assert client.get(f"/public/passports/{token}/qr").status_code == 200
        revoked = client.delete(f"/passport/shares/{share['id']}", headers=student)
        assert revoked.status_code == 200
        assert client.get(f"/public/passports/{token}").status_code == 404
        print("PASS revocable public passport, PDF, QR, and fail-closed access")

    print("ALL PHASE 11 REAL DEMO API CHECKS PASSED")


if __name__ == "__main__":
    check_all_personas()
