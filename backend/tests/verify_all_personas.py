import os

import httpx

BASE_URL = os.environ.get("BASE_URL", "http://backend:8000")


def check_all_personas():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Faculty
        f_resp = client.post("/auth/login", json={"email": "faculty@example.demo", "password": "DemoPassword123"})
        assert f_resp.status_code == 200, f"Faculty login failed: {f_resp.text}"
        f_token = f_resp.json()["access_token"]
        f_pass = client.get("/academician/passport/me", headers={"Authorization": f"Bearer {f_token}"})
        assert f_pass.status_code == 200
        print("✓ Faculty login & passport verified")

        # 2. Institution
        i_resp = client.post("/auth/login", json={"email": "dean@example.demo", "password": "DemoPassword123"})
        assert i_resp.status_code == 200, f"Institution login failed: {i_resp.text}"
        i_token = i_resp.json()["access_token"]
        i_ana = client.get("/institution/analytics", headers={"Authorization": f"Bearer {i_token}"})
        assert i_ana.status_code == 200
        print("✓ Institution login & analytics verified")

        # 3. Student
        s_resp = client.post("/auth/login", json={"email": "maya@example.demo", "password": "DemoPassword123"})
        assert s_resp.status_code == 200, f"Student login failed: {s_resp.text}"
        s_token = s_resp.json()["access_token"]
        s_pass = client.get("/passport/me", headers={"Authorization": f"Bearer {s_token}"})
        assert s_pass.status_code == 200
        print("✓ Student login & passport verified")

        # 4. Recruiter
        r_resp = client.post("/auth/login", json={"email": "recruiter@example.demo", "password": "DemoPassword123"})
        assert r_resp.status_code == 200, f"Recruiter login failed: {r_resp.text}"
        r_token = r_resp.json()["access_token"]
        r_ints = client.get("/internships", headers={"Authorization": f"Bearer {r_token}"})
        assert r_ints.status_code == 200
        print("✓ Recruiter login & internships verified")

    print("\nALL 4 PERSONA LIVE FLOWS PASSED!")


if __name__ == "__main__":
    check_all_personas()
