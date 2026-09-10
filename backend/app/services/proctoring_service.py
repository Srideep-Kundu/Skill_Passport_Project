"""Assessment Proctoring & Keystroke Dynamics Service.

Provides authoritative server-side violation processing, integrity scoring,
evidence retention, and secure recruiter/student report generation.
"""
from datetime import UTC, datetime
from uuid import UUID
import uuid

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Assessment,
    ProjectAssessment,
    ProctoringEvent,
    ProctoringEvidence,
    ProctoringRiskLevel,
    ProctoringSession,
    ProctoringSessionStatus,
    KeyboardMetrics,
    Student,
)
from app.schemas.contracts import (
    ProctoringEventCreate,
    ProctoringEventsBatchRequest,
    ProctoringEvidenceUploadRequest,
    ProctoringKeyboardMetricsCreate,
    ProctoringKeyboardSummary,
    ProctoringReportResponse,
    ProctoringSessionEndRequest,
    ProctoringSessionResponse,
    ProctoringSessionStartRequest,
    ProctoringSnapshotItem,
    ProctoringViolationItem,
)


PENALTY_WEIGHTS: dict[str, float] = {
    "TAB_SWITCH": 10.0,
    "FULLSCREEN_EXIT": 5.0,
    "WINDOW_BLUR": 3.0,
    "PAGE_HIDDEN": 5.0,
    "MULTIPLE_FACES": 25.0,
    "FACE_ABSENT": 10.0,
    "PROLONGED_LOOK_AWAY": 5.0,
    "LOOKING_AWAY": 5.0,
    "HEAD_POSE_ANOMALY": 5.0,
    "RESTRICTED_SHORTCUT": 10.0,
    "RESTRICTED_PASTE": 15.0,
    "PASTE_ATTEMPT": 15.0,
    "BULK_TEXT_INSERTION": 15.0,
    "DEVTOOLS_SUSPECTED": 15.0,
    "VOICE_DETECTED": 10.0,
    "BACKGROUND_SPEECH": 8.0,
    "LOUD_NOISE": 5.0,
    "TYPING_ANOMALY": 5.0,
    "AUTOMATED_TYPING_PATTERN": 15.0,
    "TYPING_PATTERN_CHANGE": 5.0,
}


def calculate_integrity_score(events: list[ProctoringEvent]) -> tuple[float, ProctoringRiskLevel]:
    """Authoritative server-side calculation of proctoring integrity score and risk level."""
    total_deduction = 0.0
    for evt in events:
        evt_type = (evt.event_type or "").upper()
        penalty = PENALTY_WEIGHTS.get(evt_type, 5.0)
        confidence = float(evt.confidence) if evt.confidence is not None else 1.0
        total_deduction += penalty * min(1.0, max(0.5, confidence))

    score = max(0.0, min(100.0, 100.0 - total_deduction))
    score = round(score, 1)

    if score >= 85.0:
        risk = ProctoringRiskLevel.low
    elif score >= 65.0:
        risk = ProctoringRiskLevel.medium
    else:
        risk = ProctoringRiskLevel.high

    return score, risk


class ProctoringService:
    """Manages assessment proctoring sessions, metrics, and report computation."""

    async def start_session(
        self,
        session: AsyncSession,
        student_id: UUID,
        payload: ProctoringSessionStartRequest,
    ) -> ProctoringSessionResponse:
        """Initialize an active proctoring session for an assessment attempt."""
        new_session = ProctoringSession(
            id=uuid.uuid4(),
            student_id=student_id,
            assessment_id=payload.assessment_id,
            project_assessment_id=payload.project_assessment_id,
            status=ProctoringSessionStatus.in_progress,
            start_time=datetime.now(UTC),
            integrity_score=100.0,
            risk_level=ProctoringRiskLevel.low,
            total_violations=0,
            settings=payload.settings,
            metadata_payload={},
        )
        session.add(new_session)
        await session.commit()
        await session.refresh(new_session)

        return ProctoringSessionResponse(
            id=new_session.id,
            student_id=new_session.student_id,
            assessment_id=new_session.assessment_id,
            project_assessment_id=new_session.project_assessment_id,
            status=new_session.status.value,
            start_time=new_session.start_time,
            end_time=new_session.end_time,
            integrity_score=float(new_session.integrity_score),
            risk_level=new_session.risk_level.value,
            total_violations=new_session.total_violations,
            settings=new_session.settings,
        )

    async def record_events_batch(
        self,
        session: AsyncSession,
        student_id: UUID,
        payload: ProctoringEventsBatchRequest,
    ) -> ProctoringSessionResponse:
        """Batch-record proctoring violation events and update authoritative score."""
        stmt = (
            select(ProctoringSession)
            .where(
                and_(
                    ProctoringSession.id == payload.session_id,
                    ProctoringSession.student_id == student_id,
                )
            )
            .options(selectinload(ProctoringSession.events))
        )
        proc_session = (await session.scalars(stmt)).first()
        if not proc_session:
            raise ValueError("Proctoring session not found or unauthorized")

        for item in payload.events:
            event_row = ProctoringEvent(
                id=uuid.uuid4(),
                session_id=proc_session.id,
                question_id=item.question_id,
                event_type=item.event_type.upper(),
                severity=item.severity.upper(),
                confidence=item.confidence,
                timestamp=item.timestamp,
                metadata_payload=item.metadata,
                snapshot_url=item.snapshot_url,
            )
            session.add(event_row)
            proc_session.events.append(event_row)

        all_events = proc_session.events
        score, risk = calculate_integrity_score(all_events)
        proc_session.integrity_score = score
        proc_session.risk_level = risk
        proc_session.total_violations = len(all_events)

        await session.commit()
        await session.refresh(proc_session)

        return ProctoringSessionResponse(
            id=proc_session.id,
            student_id=proc_session.student_id,
            assessment_id=proc_session.assessment_id,
            project_assessment_id=proc_session.project_assessment_id,
            status=proc_session.status.value,
            start_time=proc_session.start_time,
            end_time=proc_session.end_time,
            integrity_score=float(proc_session.integrity_score),
            risk_level=proc_session.risk_level.value,
            total_violations=proc_session.total_violations,
            settings=proc_session.settings,
        )

    async def record_keyboard_metrics(
        self,
        session: AsyncSession,
        student_id: UUID,
        payload: ProctoringKeyboardMetricsCreate,
    ) -> None:
        """Record aggregated keystroke dynamics metrics without raw keystroke capture."""
        stmt = select(ProctoringSession).where(
            and_(
                ProctoringSession.id == payload.session_id,
                ProctoringSession.student_id == student_id,
            )
        )
        proc_session = (await session.scalars(stmt)).first()
        if not proc_session:
            raise ValueError("Proctoring session not found or unauthorized")

        metrics_row = KeyboardMetrics(
            id=uuid.uuid4(),
            session_id=proc_session.id,
            question_id=payload.question_id,
            wpm=payload.wpm,
            avg_dwell_time_ms=payload.avg_dwell_time_ms,
            avg_flight_time_ms=payload.avg_flight_time_ms,
            cadence_variance=payload.cadence_variance,
            rhythm_consistency=payload.rhythm_consistency,
            keystrokes_count=payload.keystrokes_count,
            backspace_count=payload.backspace_count,
            delete_count=payload.delete_count,
            edit_ratio=payload.edit_ratio,
            bulk_insertions_count=payload.bulk_insertions_count,
            paste_attempts_count=payload.paste_attempts_count,
            restricted_shortcuts_count=payload.restricted_shortcuts_count,
            macro_pattern_score=payload.macro_pattern_score,
            idle_duration_seconds=payload.idle_duration_seconds,
            timestamp=datetime.now(UTC),
        )
        session.add(metrics_row)
        await session.commit()

    async def upload_evidence(
        self,
        session: AsyncSession,
        student_id: UUID,
        payload: ProctoringEvidenceUploadRequest,
    ) -> None:
        """Save captured snapshot evidence associated with proctoring violation."""
        stmt = select(ProctoringSession).where(
            and_(
                ProctoringSession.id == payload.session_id,
                ProctoringSession.student_id == student_id,
            )
        )
        proc_session = (await session.scalars(stmt)).first()
        if not proc_session:
            raise ValueError("Proctoring session not found or unauthorized")

        evidence_row = ProctoringEvidence(
            id=uuid.uuid4(),
            session_id=proc_session.id,
            event_type=payload.event_type.upper(),
            question_id=payload.question_id,
            snapshot_data=payload.snapshot_data,
            timestamp=payload.timestamp,
            metadata_payload=payload.metadata,
        )
        session.add(evidence_row)
        await session.commit()

    async def get_session_status(
        self,
        session: AsyncSession,
        session_id: UUID,
        current_user_id: UUID,
        role: str,
    ) -> ProctoringSessionResponse:
        """Get live status and score for a proctoring session."""
        stmt = select(ProctoringSession).where(ProctoringSession.id == session_id)
        proc_session = (await session.scalars(stmt)).first()
        if not proc_session:
            raise ValueError("Proctoring session not found")

        if role == "student" and proc_session.student_id != current_user_id:
            raise PermissionError("Unauthorized access to proctoring session")

        return ProctoringSessionResponse(
            id=proc_session.id,
            student_id=proc_session.student_id,
            assessment_id=proc_session.assessment_id,
            project_assessment_id=proc_session.project_assessment_id,
            status=proc_session.status.value,
            start_time=proc_session.start_time,
            end_time=proc_session.end_time,
            integrity_score=float(proc_session.integrity_score),
            risk_level=proc_session.risk_level.value,
            total_violations=proc_session.total_violations,
            settings=proc_session.settings,
        )

    async def end_session(
        self,
        session: AsyncSession,
        session_id: UUID,
        student_id: UUID,
        payload: ProctoringSessionEndRequest,
    ) -> ProctoringSessionResponse:
        """Finalize proctoring session upon assessment submission."""
        stmt = (
            select(ProctoringSession)
            .where(
                and_(
                    ProctoringSession.id == session_id,
                    ProctoringSession.student_id == student_id,
                )
            )
            .options(selectinload(ProctoringSession.events))
        )
        proc_session = (await session.scalars(stmt)).first()
        if not proc_session:
            raise ValueError("Proctoring session not found or unauthorized")

        all_events = proc_session.events
        score, risk = calculate_integrity_score(all_events)
        proc_session.integrity_score = score
        proc_session.risk_level = risk
        proc_session.total_violations = len(all_events)
        proc_session.end_time = datetime.now(UTC)
        proc_session.status = (
            ProctoringSessionStatus.terminated_violation
            if payload.status == "terminated_violation"
            else ProctoringSessionStatus.completed
        )

        await session.commit()
        await session.refresh(proc_session)

        return ProctoringSessionResponse(
            id=proc_session.id,
            student_id=proc_session.student_id,
            assessment_id=proc_session.assessment_id,
            project_assessment_id=proc_session.project_assessment_id,
            status=proc_session.status.value,
            start_time=proc_session.start_time,
            end_time=proc_session.end_time,
            integrity_score=float(proc_session.integrity_score),
            risk_level=proc_session.risk_level.value,
            total_violations=proc_session.total_violations,
            settings=proc_session.settings,
        )

    async def get_proctoring_report(
        self,
        session: AsyncSession,
        assessment_id: UUID,
        student_id: UUID,
        viewer_id: UUID,
        role: str,
    ) -> ProctoringReportResponse:
        """Fetch comprehensive proctoring audit report for recruiters or students."""
        if role == "student" and student_id != viewer_id:
            raise PermissionError("Access denied: You can only view your own proctoring report")

        # Query latest proctoring session for this assessment and student
        stmt = (
            select(ProctoringSession)
            .where(
                and_(
                    ProctoringSession.student_id == student_id,
                    (ProctoringSession.assessment_id == assessment_id)
                    | (ProctoringSession.project_assessment_id == assessment_id),
                )
            )
            .options(
                selectinload(ProctoringSession.events),
                selectinload(ProctoringSession.evidence_snapshots),
                selectinload(ProctoringSession.keyboard_metrics),
                selectinload(ProctoringSession.student),
            )
            .order_by(ProctoringSession.start_time.desc())
        )
        proc_session = (await session.scalars(stmt)).first()

        # If not found by direct assessment_id, attempt to find latest session for this student
        if not proc_session:
            fallback_stmt = (
                select(ProctoringSession)
                .where(ProctoringSession.student_id == student_id)
                .options(
                    selectinload(ProctoringSession.events),
                    selectinload(ProctoringSession.evidence_snapshots),
                    selectinload(ProctoringSession.keyboard_metrics),
                    selectinload(ProctoringSession.student),
                )
                .order_by(ProctoringSession.start_time.desc())
            )
            proc_session = (await session.scalars(fallback_stmt)).first()

        if not proc_session:
            raise ValueError("No proctoring records found for this assessment and student")

        # Get Assessment Title
        assessment_title = "Assessment"
        if proc_session.assessment_id:
            asmt_row = (
                await session.scalars(
                    select(Assessment).where(Assessment.id == proc_session.assessment_id)
                )
            ).first()
            if asmt_row:
                assessment_title = asmt_row.title
        elif proc_session.project_assessment_id:
            proj_row = (
                await session.scalars(
                    select(ProjectAssessment).where(
                        ProjectAssessment.id == proc_session.project_assessment_id
                    )
                )
            ).first()
            if proj_row:
                assessment_title = proj_row.project_title

        # Aggregate counts
        events = proc_session.events or []
        tab_switches = sum(1 for e in events if e.event_type == "TAB_SWITCH")
        fullscreen_exits = sum(1 for e in events if e.event_type == "FULLSCREEN_EXIT")
        window_blurs = sum(1 for e in events if e.event_type in ("WINDOW_BLUR", "PAGE_HIDDEN"))
        face_violations = sum(
            1 for e in events if e.event_type in ("MULTIPLE_FACES", "FACE_ABSENT", "PROLONGED_LOOK_AWAY")
        )
        audio_violations = sum(
            1 for e in events if e.event_type in ("VOICE_DETECTED", "BACKGROUND_SPEECH", "LOUD_NOISE")
        )
        paste_attempts = sum(
            1 for e in events if e.event_type in ("RESTRICTED_PASTE", "PASTE_ATTEMPT", "BULK_TEXT_INSERTION")
        )
        devtools_suspected = sum(1 for e in events if e.event_type == "DEVTOOLS_SUSPECTED")
        typing_anomalies = sum(
            1 for e in events if e.event_type in ("TYPING_ANOMALY", "AUTOMATED_TYPING_PATTERN", "TYPING_PATTERN_CHANGE")
        )

        # Aggregate keyboard metrics
        kb_list = proc_session.keyboard_metrics or []
        kb_summary = ProctoringKeyboardSummary()
        if kb_list:
            kb_summary.wpm = round(sum(k.wpm for k in kb_list) / len(kb_list))
            kb_summary.avg_dwell_time_ms = round(
                sum(float(k.avg_dwell_time_ms) for k in kb_list) / len(kb_list), 1
            )
            kb_summary.avg_flight_time_ms = round(
                sum(float(k.avg_flight_time_ms) for k in kb_list) / len(kb_list), 1
            )
            kb_summary.cadence_variance = round(
                sum(float(k.cadence_variance) for k in kb_list) / len(kb_list), 1
            )
            kb_summary.rhythm_consistency = round(
                sum(float(k.rhythm_consistency) for k in kb_list) / len(kb_list), 1
            )
            kb_summary.keystrokes_count = sum(k.keystrokes_count for k in kb_list)
            kb_summary.backspace_count = sum(k.backspace_count for k in kb_list)
            kb_summary.delete_count = sum(k.delete_count for k in kb_list)
            total_corr = kb_summary.backspace_count + kb_summary.delete_count
            kb_summary.edit_ratio = round(
                total_corr / max(1, kb_summary.keystrokes_count), 3
            )
            kb_summary.bulk_insertions_count = sum(k.bulk_insertions_count for k in kb_list)
            kb_summary.paste_attempts_count = sum(k.paste_attempts_count for k in kb_list)
            kb_summary.restricted_shortcuts_count = sum(k.restricted_shortcuts_count for k in kb_list)
            kb_summary.macro_pattern_score = round(
                sum(float(k.macro_pattern_score) for k in kb_list) / len(kb_list), 1
            )
            kb_summary.idle_duration_seconds = round(
                sum(float(k.idle_duration_seconds) for k in kb_list), 1
            )

        student = proc_session.student

        return ProctoringReportResponse(
            session_id=proc_session.id,
            student_id=proc_session.student_id,
            candidate_name=student.full_name if student else None,
            candidate_email=student.email if student else None,
            assessment_id=proc_session.assessment_id or proc_session.project_assessment_id,
            assessment_title=assessment_title,
            status=proc_session.status.value,
            start_time=proc_session.start_time,
            end_time=proc_session.end_time,
            integrity_score=float(proc_session.integrity_score),
            risk_level=proc_session.risk_level.value,
            total_violations=proc_session.total_violations,
            tab_switches_count=tab_switches,
            fullscreen_exits_count=fullscreen_exits,
            window_blurs_count=window_blurs,
            face_violations_count=face_violations,
            audio_violations_count=audio_violations,
            paste_attempts_count=paste_attempts,
            devtools_suspected_count=devtools_suspected,
            typing_anomalies_count=typing_anomalies,
            keyboard_metrics=kb_summary,
            events=[
                ProctoringViolationItem(
                    id=e.id,
                    event_type=e.event_type,
                    severity=e.severity,
                    confidence=float(e.confidence),
                    question_id=e.question_id,
                    timestamp=e.timestamp,
                    metadata=e.metadata_payload or {},
                    snapshot_url=e.snapshot_url,
                )
                for e in sorted(events, key=lambda x: x.timestamp)
            ],
            snapshots=[
                ProctoringSnapshotItem(
                    id=s.id,
                    event_type=s.event_type,
                    question_id=s.question_id,
                    snapshot_data=s.snapshot_data,
                    timestamp=s.timestamp,
                    metadata=s.metadata_payload or {},
                )
                for s in sorted(proc_session.evidence_snapshots or [], key=lambda x: x.timestamp)
            ],
        )


proctoring_service = ProctoringService()
