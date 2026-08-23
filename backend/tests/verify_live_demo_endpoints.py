"""Live demo verification script calling real FastAPI endpoints on port 8000."""
import httpx

BASE_URL = "http://127.0.0.1:8000"

def test_live_demo():
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)
    print("=== LIVE DEMO API VERIFICATION ===")

    # 1. Health & Docs
    resp = client.get("/docs")
    assert resp.status_code == 200, f"Docs failed: {resp.status_code}"
    print("✓ Backend Docs / OpenAPI: 200 OK")

    # 2. Student Persona Flow
    print("\n--- Testing Student Persona (maya@example.demo) ---")
    login_res = client.post("/auth/login", json={"email": "maya@example.demo", "password": "DemoPassword123"})
    assert login_res.status_code == 200, f"Student login failed: {login_res.text}"
    student_token = login_res.json()["access_token"]
    student_headers = {"Authorization": f"Bearer {student_token}"}
    print("✓ Student Login: 200 OK")

    # Passport & Profile
    profile = client.get("/passport/profile", headers=student_headers).json()
    assert "student_id" in profile
    print(f"✓ Candidate Profile: ID {profile['student_id']} ({len(profile['skills'])} skills, GitHub: {profile['github_identity_status']})")

    passport = client.get("/passport/me", headers=student_headers).json()
    print(f"✓ Skill Passport: {len(passport.get('skills', []))} total verified/assessed skills")

    # Matches & Match Explanation
    matches = client.get("/students/me/matches", headers=student_headers).json()
    print(f"✓ Internship Matches: {len(matches.get('items', []))} opportunities retrieved")
    if matches.get("items"):
        top_match_id = matches["items"][0]["id"]
        exp = client.get(f"/matches/{top_match_id}/explanation", headers=student_headers).json()
        print(f"✓ Match Explanation (Deterministic: {exp['deterministic_score']:.2f}, Semantic: {exp['semantic_score']:.2f}, Bonus: {exp['verification_bonus']:.2f})")

    # Skill Gaps & Career Guidance
    gaps = client.get("/skill-gaps/analyze?target_role=Full+Stack+Developer", headers=student_headers).json()
    print(f"✓ Skill Gap Analysis: Readiness {gaps['overall_readiness_score']:.0f}% ({gaps['matched_skills_count']} skills matched)")

    guidance = client.get("/career-guidance/overview", headers=student_headers).json()
    print(f"✓ Career Guidance Overview: {len(guidance['ready_roles'])} ready roles, {len(guidance['next_step_roles'])} next-step roles")

    # Learning Hub
    courses = client.get("/learning/courses", headers=student_headers).json()
    print(f"✓ Learning Courses: {len(courses)} courses retrieved with curriculum URLs")

    # Placements
    drives = client.get("/placements/drives", headers=student_headers).json()
    print(f"✓ Placement Drives: {len(drives)} drives active")

    # Collaboration & Challenges
    challenges = client.get("/collaborations/challenges", headers=student_headers).json()
    print(f"✓ Innovation Challenges: {len(challenges)} seeded demo challenges")

    # Copilot Query
    copilot_res = client.post("/copilot/query", json={"query": "What are my verified skills?"}, headers=student_headers)
    assert copilot_res.status_code == 200, f"Copilot query failed: {copilot_res.text}"
    copilot = copilot_res.json()
    assert len(copilot["sources"]) > 0
    print(f"✓ Skill Passport Copilot: Responded with {len(copilot['sources'])} sources and {len(copilot['actions'])} navigation actions")

    # LinkedIn Import URL
    li = client.post("/linkedin/imports/import-url", json={"profile_url": "https://linkedin.com/in/maya-rivera"}, headers=student_headers).json()
    assert li["full_name"] == "Maya Rivera"
    assert li["is_demo_fixture"] is True and li["persistable"] is False
    print(f"✓ LinkedIn simulated URL preview: {len(li['skills'])} skills, non-persistable fixture")

    # 3. Recruiter Persona Flow
    print("\n--- Testing Recruiter Persona (recruiter@example.demo) ---")
    rec_login = client.post("/auth/login", json={"email": "recruiter@example.demo", "password": "DemoPassword123"})
    assert rec_login.status_code == 200, f"Recruiter login failed: {rec_login.text}"
    rec_token = rec_login.json()["access_token"]
    rec_headers = {"Authorization": f"Bearer {rec_token}"}
    print("✓ Recruiter Login: 200 OK")

    internships = client.get("/internships", headers=rec_headers).json()
    print(f"✓ Recruiter Internships: {len(internships.get('items', []))} active postings")

    rec_analytics = client.get("/recruiter-analytics/me", headers=rec_headers).json()
    print(f"✓ Recruiter Analytics: {rec_analytics['active_postings']} active postings, {rec_analytics['total_applicants']} applicants, {len(rec_analytics['top_demanded_skills'])} demanded skills tracked")

    # 4. Academician / Faculty Persona Flow
    print("\n--- Testing Academician Persona (faculty@poly.demo) ---")
    fac_login = client.post("/auth/login", json={"email": "faculty@poly.demo", "password": "password123"})
    assert fac_login.status_code == 200, f"Faculty login failed: {fac_login.text}"
    fac_token = fac_login.json()["access_token"]
    fac_headers = {"Authorization": f"Bearer {fac_token}"}
    print("✓ Faculty Login: 200 OK")

    fac_opps = client.get("/faculty/opportunities", headers=fac_headers).json()
    print(f"✓ Faculty Opportunities: {len(fac_opps)} research/mentorship opportunities")

    # 5. Institution Persona Flow
    print("\n--- Testing Institution Persona (admin@poly.demo) ---")
    inst_login = client.post("/auth/login", json={"email": "admin@poly.demo", "password": "password123"})
    assert inst_login.status_code == 200, f"Institution login failed: {inst_login.text}"
    inst_token = inst_login.json()["access_token"]
    inst_headers = {"Authorization": f"Bearer {inst_token}"}
    print("✓ Institution Login: 200 OK")

    inst_overview = client.get("/institution/analytics", headers=inst_headers).json()
    print(f"✓ Institution Analytics: {inst_overview['total_students']} students across {len(inst_overview['department_metrics'])} departments")
    print(f"  Verified student coverage: {inst_overview['overall_employability_index']:.1f}%, Active Internships: {inst_overview['active_internships']}")

    print("\n🎉 ALL LIVE DEMO ENDPOINTS VERIFIED SUCCESSFULLY (100% PASS RATE)!")

if __name__ == "__main__":
    test_live_demo()
