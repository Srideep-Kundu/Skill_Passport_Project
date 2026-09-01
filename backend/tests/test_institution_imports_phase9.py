import uuid
from datetime import UTC, datetime, timedelta

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.db import Base, get_session
from app.core.security import create_access_token
from app.main import app
from app.models import (
    CourseEnrollment,
    Evidence,
    EvidenceType,
    ExtractionStatus,
    Institution,
    InstitutionImportBatch,
    LearningCourse,
    PlacementDrive,
    PlacementRegistration,
    PlacementRequirement,
    Role,
    Skill,
    Student,
    StudentSkill,
    VerificationTier,
)


@pytest_asyncio.fixture
async def phase9_client():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def override_session():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        async with factory() as session:
            first = Institution(
                email="imports-one@example.edu",
                password_hash="hash",
                institution_name="Import University One",
                institution_code="IMP-ONE",
                departments=["Computer Science"],
            )
            second = Institution(
                email="imports-two@example.edu",
                password_hash="hash",
                institution_name="Import University Two",
                institution_code="IMP-TWO",
                departments=["Computer Science"],
            )
            skill = Skill(
                canonical_name="Python Phase9", category="technical", aliases=["Py9"]
            )
            session.add_all([first, second, skill])
            await session.flush()
            course = LearningCourse(
                title="Python Phase9 Certificate",
                provider="Configured LMS",
                category="Software",
                program_type="certification",
                duration_hours=4,
                url="https://example.com/course",
                description="A governed completion course.",
                skills=[skill.canonical_name],
            )
            other_student = Student(
                email="owned@other.edu",
                password_hash="hash",
                full_name="Other Tenant Student",
                institution_id=second.id,
                roll_number="OTHER-1",
            )
            session.add_all([course, other_student])
            await session.commit()
            data = {
                "first": first.id,
                "second": second.id,
                "skill": skill.id,
                "course": course.id,
            }
        yield client, factory, data
    app.dependency_overrides.clear()
    await engine.dispose()


def _headers(identifier: uuid.UUID) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(identifier, Role.institution)}"}


async def _mapping(client, headers, mapping_type, external_key, canonical_value):
    response = await client.post(
        "/institution/mappings",
        headers=headers,
        json={
            "mapping_type": mapping_type,
            "external_key": external_key,
            "canonical_value": canonical_value,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.asyncio
async def test_student_dry_run_confirm_invitation_and_idempotency(phase9_client):
    client, factory, data = phase9_client
    headers = _headers(data["first"])
    other_headers = _headers(data["second"])
    await _mapping(client, headers, "department", "CSE", "Computer Science")
    csv_data = (
        b"full_name,email,roll_number,department,cohort_year,institution_id,role\n"
        + f"Invited Student,invited@example.edu,IMP-001,CSE,2027,{data['second']},admin\n".encode()
        + f"Cross Tenant,owned@other.edu,IMP-002,CSE,2027,{data['first']},student\n".encode()
    )

    before = 0
    async with factory() as session:
        before = int((await session.scalar(select(func.count(Student.id)))) or 0)
    dry_run = await client.post(
        "/institution/imports/students/dry-run",
        headers=headers,
        files={"file": ("students.csv", csv_data, "text/csv")},
    )
    assert dry_run.status_code == 200, dry_run.text
    preview = dry_run.json()
    assert preview["valid_rows"] == 1
    assert preview["invalid_rows"] == 1
    assert {error["code"] for error in preview["errors"]} == {
        "cross_tenant_conflict"
    }
    async with factory() as session:
        assert int((await session.scalar(select(func.count(Student.id)))) or 0) == before

    files = {"file": ("students.csv", csv_data, "text/csv")}
    confirmed = await client.post(
        "/institution/imports/students",
        headers=headers,
        files=files,
        data={"confirmed_checksum": preview["checksum"]},
    )
    assert confirmed.status_code == 201, confirmed.text
    result = confirmed.json()
    assert result["created_rows"] == 1
    assert result["invalid_rows"] == 1
    repeated = await client.post(
        "/institution/imports/students",
        headers=headers,
        files={"file": ("students.csv", csv_data, "text/csv")},
        data={"confirmed_checksum": preview["checksum"]},
    )
    assert repeated.json()["id"] == result["id"]
    assert (
        await client.get(f"/institution/imports/{result['id']}", headers=other_headers)
    ).status_code == 404
    async with factory() as session:
        imported = await session.scalar(
            select(Student).where(Student.email == "invited@example.edu")
        )
        assert imported is not None
        assert imported.institution_id == data["first"]
        assert imported.account_status == "pending_invite"
        assert "placeholder" not in imported.password_hash.casefold()
        assert (
            await session.scalar(
                select(func.count(InstitutionImportBatch.id)).where(
                    InstitutionImportBatch.institution_id == data["first"],
                    InstitutionImportBatch.import_type == "students",
                )
            )
        ) == 1
    login = await client.post(
        "/auth/login",
        json={"email": "invited@example.edu", "password": "DefaultPassword123!"},
    )
    assert login.status_code == 401


@pytest.mark.asyncio
async def test_mapping_tenant_crud_and_safe_upload_validation(phase9_client):
    client, _, data = phase9_client
    headers = _headers(data["first"])
    other_headers = _headers(data["second"])
    mapping = await _mapping(client, headers, "department", "CS", "Computer Science")
    assert (
        await client.patch(
            f"/institution/mappings/{mapping['id']}",
            headers=other_headers,
            json={"canonical_value": "Other"},
        )
    ).status_code == 404
    updated = await client.patch(
        f"/institution/mappings/{mapping['id']}",
        headers=headers,
        json={"canonical_value": "Computer Science and Engineering"},
    )
    assert updated.status_code == 200
    assert updated.json()["canonical_value"] == "Computer Science and Engineering"
    malformed = await client.post(
        "/institution/imports/students/dry-run",
        headers=headers,
        files={"file": ("students.csv", b"name,email\nA,a@example.com", "text/csv")},
    )
    assert malformed.status_code == 422
    traversal = await client.post(
        "/institution/imports/students/dry-run",
        headers=headers,
        files={"file": ("../students.csv", b"x", "text/csv")},
    )
    assert traversal.status_code == 422
    formula = (
        b"full_name,email,roll_number,department,cohort_year\n"
        b"=CMD(),safe@example.edu,R1,CS,2027"
    )
    assert (
        await client.post(
            "/institution/imports/students/dry-run",
            headers=headers,
            files={"file": ("students.csv", formula, "text/csv")},
        )
    ).status_code == 422
    oversized = b"x" * (1024 * 1024 + 1)
    assert (
        await client.post(
            "/institution/imports/students/dry-run",
            headers=headers,
            files={"file": ("students.csv", oversized, "text/csv")},
        )
    ).status_code == 422
    live_provider = await client.post(
        "/institution/mappings",
        headers=headers,
        json={
            "mapping_type": "trusted_provider",
            "external_key": "not-credentialed",
            "canonical_value": "live",
        },
    )
    assert live_provider.status_code == 422


@pytest.mark.asyncio
async def test_placement_import_upserts_existing_models_and_skills(phase9_client):
    client, factory, data = phase9_client
    headers = _headers(data["first"])
    await _mapping(client, headers, "department", "CSE", "Computer Science")
    student_csv = b"full_name,email,roll_number,department,cohort_year\nPlacement Student,placement@example.edu,P-1,CSE,2027"
    preview = (
        await client.post(
            "/institution/imports/students/dry-run",
            headers=headers,
            files={"file": ("students.csv", student_csv, "text/csv")},
        )
    ).json()
    await client.post(
        "/institution/imports/students",
        headers=headers,
        files={"file": ("students.csv", student_csv, "text/csv")},
        data={"confirmed_checksum": preview["checksum"]},
    )
    drive_date = (datetime.now(UTC) + timedelta(days=10)).isoformat()
    placement_csv = (
        "external_source,external_id,company_name,title,drive_date,required_skills,student_roll_number,registration_status,registration_external_id\n"
        f"erp,DRIVE-1,Industry One,Software Engineer,{drive_date},Python Phase9,P-1,shortlisted,REG-1\n"
        f"erp,DRIVE-2,Industry Two,Data Engineer,{drive_date},Unknown Skill,,,\n"
    ).encode()
    placement_preview = await client.post(
        "/institution/imports/placements/dry-run",
        headers=headers,
        files={"file": ("placements.csv", placement_csv, "text/csv")},
    )
    assert placement_preview.status_code == 200
    assert placement_preview.json()["invalid_rows"] == 1
    async with factory() as session:
        assert await session.scalar(select(func.count(PlacementDrive.id))) == 0
    checksum = placement_preview.json()["checksum"]
    first = await client.post(
        "/institution/imports/placements",
        headers=headers,
        files={"file": ("placements.csv", placement_csv, "text/csv")},
        data={"confirmed_checksum": checksum},
    )
    assert first.status_code == 201, first.text
    assert first.json()["created_rows"] == 1
    assert first.json()["invalid_rows"] == 1
    assert first.json()["safe_error_summary"][0]["code"] == "unresolved_skill"
    repeated = await client.post(
        "/institution/imports/placements",
        headers=headers,
        files={"file": ("placements.csv", placement_csv, "text/csv")},
        data={"confirmed_checksum": checksum},
    )
    assert repeated.json()["id"] == first.json()["id"]
    async with factory() as session:
        assert await session.scalar(select(func.count(PlacementDrive.id))) == 1
        assert await session.scalar(select(func.count(PlacementRegistration.id))) == 1
        assert await session.scalar(select(func.count(PlacementRequirement.id))) == 1
        drive = await session.scalar(select(PlacementDrive))
        assert drive is not None and drive.institution_id == data["first"]


@pytest.mark.asyncio
async def test_learning_completion_provenance_trust_and_replay(phase9_client):
    client, factory, data = phase9_client
    headers = _headers(data["first"])
    await _mapping(client, headers, "department", "CSE", "Computer Science")
    await _mapping(client, headers, "course", "PY-CERT", str(data["course"]))
    await _mapping(client, headers, "trusted_provider", "configured-lms", "configured")
    student_csv = b"full_name,email,roll_number,department,cohort_year\nLearning Student,learning@example.edu,L-1,CSE,2027"
    preview = (
        await client.post(
            "/institution/imports/students/dry-run",
            headers=headers,
            files={"file": ("students.csv", student_csv, "text/csv")},
        )
    ).json()
    await client.post(
        "/institution/imports/students",
        headers=headers,
        files={"file": ("students.csv", student_csv, "text/csv")},
        data={"confirmed_checksum": preview["checksum"]},
    )
    async with factory() as session:
        student = await session.scalar(
            select(Student).where(Student.email == "learning@example.edu")
        )
        assert student is not None
        prior_evidence = Evidence(
            student_id=student.id,
            evidence_type=EvidenceType.coursework,
            title="Independent verified evidence",
            description="Existing stronger proof.",
            extraction_status=ExtractionStatus.extracted,
        )
        session.add(prior_evidence)
        await session.flush()
        session.add(
            StudentSkill(
                student_id=student.id,
                skill_id=data["skill"],
                source_evidence_id=prior_evidence.id,
                extraction_confidence=1.0,
                verification_tier=VerificationTier.verified,
                evidence_span="Independent verified Python Phase9 evidence",
            )
        )
        await session.commit()
    completion_csv = b"external_source,external_id,student_roll_number,course_external_key,status\nconfigured-lms,COMP-1,L-1,PY-CERT,completed"
    completion_preview = await client.post(
        "/institution/imports/learning-completions/dry-run",
        headers=headers,
        files={"file": ("completions.csv", completion_csv, "text/csv")},
    )
    assert completion_preview.status_code == 200
    assert completion_preview.json()["valid_rows"] == 1
    async with factory() as session:
        assert await session.scalar(select(func.count(CourseEnrollment.id))) == 0
        assert await session.scalar(select(func.count(Evidence.id))) == 1
    checksum = completion_preview.json()["checksum"]
    imported = await client.post(
        "/institution/imports/learning-completions",
        headers=headers,
        files={"file": ("completions.csv", completion_csv, "text/csv")},
        data={"confirmed_checksum": checksum},
    )
    assert imported.status_code == 201, imported.text
    repeated = await client.post(
        "/institution/imports/learning-completions",
        headers=headers,
        files={"file": ("completions.csv", completion_csv, "text/csv")},
        data={"confirmed_checksum": checksum},
    )
    assert repeated.json()["id"] == imported.json()["id"]
    async with factory() as session:
        assert await session.scalar(select(func.count(CourseEnrollment.id))) == 1
        assert await session.scalar(select(func.count(Evidence.id))) == 2
        assert await session.scalar(select(func.count(StudentSkill.id))) == 2
        tiers = list((await session.scalars(select(StudentSkill.verification_tier))).all())
        assert VerificationTier.verified in tiers
        assert VerificationTier.partially_verified in tiers
