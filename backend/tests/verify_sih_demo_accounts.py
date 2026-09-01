"""Verification script for 3 Canonical Demo Accounts (Recruiter, Faculty, Institution) + Student."""
import asyncio
import httpx

API_BASE = "http://localhost:8000"

async def test_auth_and_features():
    async with httpx.AsyncClient(base_url=API_BASE, timeout=20.0) as client:
        print("\n=== STEP 1: Verify Recruiter Demo Account ===")
        rec_res = await client.post("/auth/login", json={"email": "recruiter.demo@technova.com", "password": "demo123"})
        assert rec_res.status_code == 200, f"Recruiter login failed: {rec_res.text}"
        rec_data = rec_res.json()
        rec_token = rec_data["access_token"]
        rec_headers = {"Authorization": f"Bearer {rec_token}"}
        print(f"✅ Recruiter Login successful (Role: {rec_data['role']})")

        rec_me = (await client.get("/auth/me", headers=rec_headers)).json()
        assert rec_me["role"] == "recruiter"
        print(f"✅ Recruiter /auth/me verified: {rec_me['company_name']}")

        internships_res = await client.get("/internships", headers=rec_headers)
        assert internships_res.status_code == 200
        internships_page = internships_res.json()
        internships = internships_page.get("items", [])
        print(f"✅ Recruiter Internships count: {len(internships)}")
        for i in internships:
            print(f"   - {i['title']} (Requirements: {len(i.get('requirements', []))})")

        analytics_res = await client.get("/recruiter-analytics/me", headers=rec_headers)
        assert analytics_res.status_code == 200
        analytics = analytics_res.json()
        print(f"✅ Recruiter Analytics: Active Postings={analytics['active_postings']}, Applicants={analytics['total_applicants']}, Shortlisted={analytics['shortlisted_candidates']}")
        print(f"   Top demanded skills count: {len(analytics['top_demanded_skills'])}")

        print("\n=== STEP 2: Verify Faculty Demo Account ===")
        fac_res = await client.post("/auth/login", json={"email": "faculty.demo@example.com", "password": "demo123"})
        assert fac_res.status_code == 200, f"Faculty login failed: {fac_res.text}"
        fac_data = fac_res.json()
        fac_token = fac_data["access_token"]
        fac_headers = {"Authorization": f"Bearer {fac_token}"}
        print(f"✅ Faculty Login successful (Role: {fac_data['role']})")

        fac_me = (await client.get("/auth/me", headers=fac_headers)).json()
        assert fac_me["role"] == "academician"
        print(f"✅ Faculty /auth/me verified: {fac_me['full_name']} at {fac_me['institution_name']}")

        fac_prof_res = await client.get("/academician/passport/me", headers=fac_headers)
        assert fac_prof_res.status_code == 200, f"Faculty passport failed: {fac_prof_res.text}"
        fac_prof = fac_prof_res.json()
        print(f"✅ Faculty Passport: {fac_prof['full_name']}, {fac_prof['designation']}, {len(fac_prof['publications'])} publications, {len(fac_prof['patents'])} patents")

        fac_opps_res = await client.get("/academician/opportunities", headers=fac_headers)
        assert fac_opps_res.status_code == 200
        fac_opps = fac_opps_res.json()
        print(f"✅ Faculty Opportunities available: {len(fac_opps)}")

        fac_apps_res = await client.get("/academician/applications/me", headers=fac_headers)
        assert fac_apps_res.status_code == 200
        fac_apps = fac_apps_res.json()
        print(f"✅ Faculty Applications: {len(fac_apps)}")

        fac_ws_res = await client.get("/academician/workspaces", headers=fac_headers)
        assert fac_ws_res.status_code == 200
        fac_ws = fac_ws_res.json()
        print(f"✅ Faculty Workspaces: {len(fac_ws)}")
        if fac_ws:
            print(f"   - Active R&D Project: {fac_ws[0]['title']} ({fac_ws[0]['progress_percentage']}% completed)")

        fac_docs_res = await client.get("/documents", headers=fac_headers)
        assert fac_docs_res.status_code == 200
        fac_docs = fac_docs_res.json()
        print(f"✅ Faculty Document Vault entries: {len(fac_docs)}")

        print("\n=== STEP 3: Verify Institution Demo Account ===")
        inst_res = await client.post("/auth/login", json={"email": "institution.demo@example.com", "password": "demo123"})
        assert inst_res.status_code == 200, f"Institution login failed: {inst_res.text}"
        inst_data = inst_res.json()
        inst_token = inst_data["access_token"]
        inst_headers = {"Authorization": f"Bearer {inst_token}"}
        print(f"✅ Institution Login successful (Role: {inst_data['role']})")

        inst_me = (await client.get("/auth/me", headers=inst_headers)).json()
        assert inst_me["role"] == "institution"
        print(f"✅ Institution /auth/me verified: {inst_me['institution_name']}")

        inst_overview = (await client.get("/institution/analytics", headers=inst_headers)).json()
        print(f"✅ Institution Overview: Students={inst_overview['total_students']}, Verified Skills={inst_overview['total_verified_skills']}, Employability={inst_overview['overall_employability_index']}%")
        print(f"   Department metrics count: {len(inst_overview['department_metrics'])}")
        for d in inst_overview['department_metrics']:
            print(f"   - {d['department']}: {d['total_students']} students, Placement Rate: {d['placement_rate']}%")

        inst_internships = (await client.get("/institution/internships/monitoring", headers=inst_headers)).json()
        print(f"✅ Institution Internships: Eligible={inst_internships['eligible_students']}, Active={inst_internships['active_internships']}, Completed={inst_internships['completed_internships']}")

        inst_placements = (await client.get("/institution/placements/monitoring", headers=inst_headers)).json()
        print(f"✅ Institution Placements: Eligible={inst_placements['eligible_students']}, Applications={inst_placements['applications']}, Placed={inst_placements['placements_secured']}")

        inst_partnerships = (await client.get("/institution/partnerships", headers=inst_headers)).json()
        print(f"✅ Institution Partnerships: Total={inst_partnerships['total_partners']}")
        for p in inst_partnerships['partners']:
            print(f"   - {p['partner_name']} ({p['domain']}, Status: {p['status']})")

        inst_fac = (await client.get("/institution/faculty-engagement", headers=inst_headers)).json()
        print(f"✅ Institution Faculty Engagement: Total Faculty={inst_fac['total_participating_faculty']}, Active Trainings={inst_fac['active_industrial_training']}, Collaborations={inst_fac['research_collaborations']}")

        print("\n=== STEP 4: Verify Student Demo Account ===")
        stu_res = await client.post("/auth/login", json={"email": "maya@example.demo", "password": "demo123"})
        assert stu_res.status_code == 200, f"Student login failed: {stu_res.text}"
        stu_data = stu_res.json()
        print(f"✅ Student Login successful (Role: {stu_data['role']})")

        print("\n🎉 ALL 4 DEMO ACCOUNTS AND ECOSYSTEM DATA VERIFIED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_auth_and_features())
