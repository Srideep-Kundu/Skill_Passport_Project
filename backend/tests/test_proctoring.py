"""Tests for Assessment Proctoring & Keystroke Dynamics System."""
from uuid import uuid4
from datetime import UTC, datetime

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api import auth as auth_api
from app.core.db import Base, create_matching_view, get_session
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import (
    Assessment,
    ProctoringEvent,
    ProctoringRiskLevel,
    ProctoringSession,
    ProctoringSessionStatus,
    Recruiter,
    Role,
    Student,
)
from app.services.proctoring_service import (
    PENALTY_WEIGHTS,
    calculate_integrity_score,
    proctoring_service,
)


@pytest_asyncio.fixture
async def proctoring_client(monkeypatch: pytest.MonkeyPatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await create_matching_view(connection)

    async def override_session():
        async with factory() as session:
            yield session

    async def no_op_rate_limit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(auth_api, "enforce_rate_limit", no_op_rate_limit)

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        yield client, factory
    app.dependency_overrides.clear()
    await engine.dispose()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# =============================================================================
# Unit Tests for Integrity Scoring Algorithm
# =============================================================================

def test_clean_session_score():
    """A session with zero violations has 100.0 score and low risk."""
    score, risk = calculate_integrity_score([])
    assert score == 100.0
    assert risk == ProctoringRiskLevel.low


def test_penalty_deduction_and_clamping():
    """Penalties reduce score proportionally and clamp at 0.0."""
    events = [
        ProctoringEvent(event_type="TAB_SWITCH", confidence=1.0),      # -10
        ProctoringEvent(event_type="MULTIPLE_FACES", confidence=1.0),  # -25
        ProctoringEvent(event_type="RESTRICTED_PASTE", confidence=1.0), # -15
    ]
    score, risk = calculate_integrity_score(events)
    assert score == 50.0
    assert risk == ProctoringRiskLevel.high

    # Test clamping
    excessive_events = [ProctoringEvent(event_type="MULTIPLE_FACES", confidence=1.0) for _ in range(10)]
    clamped_score, clamped_risk = calculate_integrity_score(excessive_events)
    assert clamped_score == 0.0
    assert clamped_risk == ProctoringRiskLevel.high


def test_confidence_weighting():
    """Lower confidence reduces the penalty impact."""
    high_conf = [ProctoringEvent(event_type="TAB_SWITCH", confidence=1.0)]
    low_conf = [ProctoringEvent(event_type="TAB_SWITCH", confidence=0.5)]

    score_high, _ = calculate_integrity_score(high_conf)
    score_low, _ = calculate_integrity_score(low_conf)

    assert score_high == 90.0
    assert score_low == 95.0


# =============================================================================
# End-to-End API Integration Tests
# =============================================================================

@pytest.mark.asyncio
async def test_proctoring_session_lifecycle(proctoring_client):
    client, factory = proctoring_client

    # 1. Seed Student & Assessment
    student_id = uuid4()
    assessment_id = uuid4()
    async with factory() as session:
        student = Student(
            id=student_id,
            email="student_proctor@test.com",
            full_name="Proctored Candidate",
            password_hash=hash_password("StudentPass123!"),
            role=Role.student,
        )
        assessment = Assessment(
            id=assessment_id,
            title="Full-Stack Diagnostics",
            canonical_skill_name="React",
            category="Frontend",
            difficulty="intermediate",
            duration_minutes=30,
            passing_score=70,
            is_active=True,
        )
        session.add_all([student, assessment])
        await session.commit()

    student_token = create_access_token(student_id, "student")

    # 2. Start Proctoring Session
    start_resp = await client.post(
        "/proctoring/session/start",
        json={"assessment_id": str(assessment_id), "settings": {"max_warnings": 3}},
        headers=auth_header(student_token),
    )
    assert start_resp.status_code == 201
    session_data = start_resp.json()
    session_id = session_data["id"]
    assert session_data["integrity_score"] == 100.0
    assert session_data["risk_level"] == "low"
    assert session_data["status"] == "in_progress"

    # 3. Batch Record Events (Tab Switch + Fullscreen Exit)
    events_resp = await client.post(
        "/proctoring/events",
        json={
            "session_id": session_id,
            "events": [
                {"event_type": "TAB_SWITCH", "severity": "HIGH", "confidence": 1.0},
                {"event_type": "FULLSCREEN_EXIT", "severity": "MEDIUM", "confidence": 1.0},
            ],
        },
        headers=auth_header(student_token),
    )
    assert events_resp.status_code == 200
    updated_session = events_resp.json()
    assert updated_session["total_violations"] == 2
    assert updated_session["integrity_score"] == 85.0
    assert updated_session["risk_level"] == "low"

    # 4. Record Keyboard Metrics
    kb_resp = await client.post(
        "/proctoring/keyboard",
        json={
            "session_id": session_id,
            "wpm": 65,
            "avg_dwell_time_ms": 78.5,
            "avg_flight_time_ms": 115.2,
            "cadence_variance": 14.3,
            "rhythm_consistency": 96.0,
            "keystrokes_count": 240,
            "backspace_count": 8,
            "delete_count": 2,
            "edit_ratio": 0.042,
            "bulk_insertions_count": 0,
            "paste_attempts_count": 1,
            "restricted_shortcuts_count": 1,
            "macro_pattern_score": 2.5,
            "idle_duration_seconds": 12.0,
        },
        headers=auth_header(student_token),
    )
    assert kb_resp.status_code == 204

    # 5. Upload Evidence Snapshot
    evidence_resp = await client.post(
        "/proctoring/evidence",
        json={
            "session_id": session_id,
            "event_type": "TAB_SWITCH",
            "snapshot_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "metadata": {"window_width": 1920, "window_height": 1080},
        },
        headers=auth_header(student_token),
    )
    assert evidence_resp.status_code == 204

    # 6. End Session
    end_resp = await client.post(
        f"/proctoring/session/{session_id}/end",
        json={"status": "completed"},
        headers=auth_header(student_token),
    )
    assert end_resp.status_code == 200
    assert end_resp.json()["status"] == "completed"

    # 7. Student Views Own Proctoring Report
    report_resp = await client.get(
        f"/proctoring/report/{assessment_id}/{student_id}",
        headers=auth_header(student_token),
    )
    assert report_resp.status_code == 200
    report = report_resp.json()
    assert report["integrity_score"] == 85.0
    assert report["total_violations"] == 2
    assert report["tab_switches_count"] == 1
    assert report["fullscreen_exits_count"] == 1
    assert report["keyboard_metrics"]["wpm"] == 65
    assert len(report["events"]) == 2
    assert len(report["snapshots"]) == 1


@pytest.mark.asyncio
async def test_proctoring_rbac_security(proctoring_client):
    client, factory = proctoring_client

    student1_id = uuid4()
    student2_id = uuid4()
    recruiter_id = uuid4()
    assessment_id = uuid4()

    async with factory() as session:
        s1 = Student(
            id=student1_id,
            email="s1@test.com",
            full_name="Student One",
            password_hash=hash_password("Pass1!"),
            role=Role.student,
        )
        s2 = Student(
            id=student2_id,
            email="s2@test.com",
            full_name="Student Two",
            password_hash=hash_password("Pass2!"),
            role=Role.student,
        )
        r = Recruiter(
            id=recruiter_id,
            company_name="Tech Corp",
            email="recruiter@techcorp.com",
            password_hash=hash_password("RecruiterPass1!"),
            role=Role.recruiter,
        )
        asmt = Assessment(
            id=assessment_id,
            title="Algorithms Diagnostics",
            canonical_skill_name="Python",
            category="Backend",
            difficulty="intermediate",
            duration_minutes=30,
            passing_score=70,
            is_active=True,
        )
        proc_sess = ProctoringSession(
            id=uuid4(),
            student_id=student1_id,
            assessment_id=assessment_id,
            status=ProctoringSessionStatus.completed,
            start_time=datetime.now(UTC),
            integrity_score=90.0,
            risk_level=ProctoringRiskLevel.low,
            total_violations=1,
            settings={},
            metadata_payload={},
        )
        session.add_all([s1, s2, r, asmt, proc_sess])
        await session.commit()

    student1_token = create_access_token(student1_id, "student")
    student2_token = create_access_token(student2_id, "student")
    recruiter_token = create_access_token(recruiter_id, "recruiter")

    # Student 2 cannot view Student 1's proctoring report (403 Forbidden)
    s2_view_s1 = await client.get(
        f"/proctoring/report/{assessment_id}/{student1_id}",
        headers=auth_header(student2_token),
    )
    assert s2_view_s1.status_code == 403

    # Recruiter can view student's report
    recruiter_view = await client.get(
        f"/proctoring/report/{assessment_id}/{student1_id}",
        headers=auth_header(recruiter_token),
    )
    assert recruiter_view.status_code == 200
    assert recruiter_view.json()["integrity_score"] == 90.0
