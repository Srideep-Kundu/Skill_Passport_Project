import os
import httpx

BASE_URL = os.environ.get("BASE_URL", "http://backend:8000")


def test_live_faculty_portal():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Login as Dr. Arvind Rao (Faculty)
        fac_auth = client.post(
            "/auth/login",
            json={"email": "faculty@example.demo", "password": "DemoPassword123"},
        )
        assert fac_auth.status_code == 200, f"Faculty login failed: {fac_auth.text}"
        fac_token = fac_auth.json()["access_token"]
        fac_headers = {"Authorization": f"Bearer {fac_token}"}
        print("✓ 1. Faculty authentication verified for Dr. Arvind Rao")

        # 2. Get Faculty Passport
        p_res = client.get("/academician/passport/me", headers=fac_headers)
        assert p_res.status_code == 200, f"Passport fetch failed: {p_res.text}"
        passport = p_res.json()
        assert passport["full_name"] == "Dr. Arvind Rao"
        assert len(passport["technical_skills"]) >= 5
        print(f"✓ 2. Faculty Academic Passport retrieved: {passport['full_name']} ({passport['years_experience']} yrs exp, {len(passport['publications'])} publications, {len(passport['patents'])} patents)")

        # 3. Update Faculty Passport
        p_up = client.put(
            "/academician/passport/me",
            headers=fac_headers,
            json={"collaboration_availability": "available"},
        )
        assert p_up.status_code == 200
        print("✓ 3. Faculty Academic Passport availability updated to 'available'")

        # 4. List Faculty Opportunities (FDPs, Internships, Grants, Consultancy)
        opps_res = client.get("/academician/opportunities", headers=fac_headers)
        assert opps_res.status_code == 200
        opps = opps_res.json()
        assert len(opps) >= 4
        print(f"✓ 4. Faculty Opportunities discovered: {len(opps)} programs active across AICTE, Grants & Immersion")

        # 5. List Faculty Applications & Proposals
        apps_res = client.get("/academician/applications/me", headers=fac_headers)
        assert apps_res.status_code == 200
        apps = apps_res.json()
        assert len(apps) >= 1
        print(f"✓ 5. Faculty Applications list retrieved: {len(apps)} proposal lifecycles tracked")

        # 6. List Collaboration Workspaces
        ws_res = client.get("/academician/workspaces", headers=fac_headers)
        assert ws_res.status_code == 200
        workspaces = ws_res.json()
        assert len(workspaces) >= 1
        ws = workspaces[0]
        print(f"✓ 6. Collaboration Workspace verified: '{ws['title']}' ({ws['progress_percentage']}% progress, {len(ws['milestones'])} milestones, {len(ws['discussion_posts'])} messages)")

        # 7. Post Discussion Update in Workspace
        disc_res = client.post(
            f"/academician/workspaces/{ws['id']}/discussions",
            headers=fac_headers,
            json={"author_name": "Dr. Arvind Rao", "author_role": "faculty", "content": "Live demo verification sync complete."},
        )
        assert disc_res.status_code == 200
        print("✓ 7. Workspace real-time discussion thread post verified")

        # 8. List Events / Workshops
        ev_res = client.get("/academician/events/me", headers=fac_headers)
        assert ev_res.status_code == 200
        print(f"✓ 8. Faculty Event Registrations retrieved: {len(ev_res.json())} sessions attended / spoken")

        # 9. List Notifications
        notif_res = client.get("/academician/notifications", headers=fac_headers)
        assert notif_res.status_code == 200
        print(f"✓ 9. Faculty Notifications retrieved: {len(notif_res.json())} notifications")

        # 10. List History
        hist_res = client.get("/academician/history/me", headers=fac_headers)
        assert hist_res.status_code == 200
        print(f"✓ 10. Faculty Collaboration History retrieved: {len(hist_res.json())} completed records")

        # 11. Recruiter Login & Review Flow
        rec_auth = client.post(
            "/auth/login",
            json={"email": "recruiter@example.demo", "password": "DemoPassword123"},
        )
        assert rec_auth.status_code == 200
        rec_token = rec_auth.json()["access_token"]
        rec_headers = {"Authorization": f"Bearer {rec_token}"}
        rec_apps = client.get("/academician/recruiter/applications", headers=rec_headers)
        assert rec_apps.status_code == 200
        print(f"✓ 11. Recruiter Review Flow verified: {len(rec_apps.json())} faculty applications accessible")

    print("\n========================================================")
    print("ALL LIVE FACULTY PORTAL ENDPOINTS VERIFIED ON PORT 8000!")
    print("========================================================")


if __name__ == "__main__":
    test_live_faculty_portal()
