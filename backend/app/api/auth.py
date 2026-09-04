import secrets
from typing import Annotated, Any, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from uuid import UUID

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    current_principal,
    hash_password,
    verify_password,
    verify_password_reset_token,
)
from app.models import (
    Academician,
    AccountEmail,
    Admin,
    Institution,
    Recruiter,
    Role,
    Student,
)
from app.schemas.contracts import (
    AcademicianRegistration,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GoogleAuthRequest,
    InstitutionRegistration,
    LoginRequest,
    RecruiterRegistration,
    ResetPasswordRequest,
    ResetPasswordResponse,
    StudentRegistration,
    TokenResponse,
    VerifyResetTokenRequest,
    VerifyResetTokenResponse,
)
from app.services.email_service import send_password_reset_email
from app.services.rate_limit_service import enforce_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


def _request_subject(request: Request) -> str:
    return request.client.host if request.client is not None else "unknown-client"


def verify_google_credential(credential: str, client_id: str | None = None) -> dict[str, Any]:
    try:
        request = google_requests.Request()
        id_info = id_token.verify_oauth2_token(
            credential,
            request,
            audience=client_id if client_id else None,
        )
        return id_info
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication token validation failed",
        ) from exc


async def _email_taken(session: AsyncSession, email: str) -> bool:
    normalized = email.casefold()
    registry = await session.get(AccountEmail, normalized)
    if registry is not None:
        return True
    student = (await session.scalars(select(Student.id).where(Student.email == normalized))).first()
    recruiter = (await session.scalars(select(Recruiter.id).where(Recruiter.email == normalized))).first()
    academician = (await session.scalars(select(Academician.id).where(Academician.email == normalized))).first()
    institution = (await session.scalars(select(Institution.id).where(Institution.email == normalized))).first()
    admin = (await session.scalars(select(Admin.id).where(Admin.email == normalized))).first()
    return student is not None or recruiter is not None or academician is not None or institution is not None or admin is not None


@router.post("/register/student", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_student(payload: StudentRegistration, request: Request, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    await enforce_rate_limit("registration", _request_subject(request), get_settings().registration_rate_limit_per_minute)
    if await _email_taken(session, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    student = Student(email=payload.email.casefold(), password_hash=hash_password(payload.password), full_name=payload.full_name, university=payload.university, graduation_year=payload.graduation_year)
    session.add(student)
    await session.flush()
    session.add(AccountEmail(email=student.email, account_id=student.id, role=Role.student))
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.") from error
    return TokenResponse(access_token=create_access_token(student.id, student.role), role="student")


@router.post("/register/recruiter", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_recruiter(payload: RecruiterRegistration, request: Request, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    await enforce_rate_limit("registration", _request_subject(request), get_settings().registration_rate_limit_per_minute)
    if await _email_taken(session, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    recruiter = Recruiter(email=payload.email.casefold(), password_hash=hash_password(payload.password), company_name=payload.company_name)
    session.add(recruiter)
    await session.flush()
    session.add(AccountEmail(email=recruiter.email, account_id=recruiter.id, role=Role.recruiter))
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.") from error
    return TokenResponse(access_token=create_access_token(recruiter.id, recruiter.role), role="recruiter")


@router.post("/register/academician", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_academician(payload: AcademicianRegistration, request: Request, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    await enforce_rate_limit("registration", _request_subject(request), get_settings().registration_rate_limit_per_minute)
    if await _email_taken(session, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    academician = Academician(
        email=payload.email.casefold(),
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        institution_name=payload.institution_name,
        department=payload.department,
        designation=payload.designation,
        research_areas=payload.research_areas,
    )
    session.add(academician)
    await session.flush()
    session.add(AccountEmail(email=academician.email, account_id=academician.id, role=Role.academician))
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.") from error
    return TokenResponse(access_token=create_access_token(academician.id, academician.role), role="academician")


@router.post("/register/institution", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_institution(payload: InstitutionRegistration, request: Request, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    settings = get_settings()
    await enforce_rate_limit("registration", _request_subject(request), settings.registration_rate_limit_per_minute)
    if (
        settings.environment == "production"
        and payload.email.casefold() not in settings.institution_registration_allowlist
    ):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Institution registration requires an invitation.",
        )
    if await _email_taken(session, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")
    existing_code = (await session.scalars(select(Institution).where(Institution.institution_code == payload.institution_code.strip()))).first()
    if existing_code:
        raise HTTPException(status.HTTP_409_CONFLICT, "An institution with this code already exists.")
    institution = Institution(
        email=payload.email.casefold(),
        password_hash=hash_password(payload.password),
        institution_name=payload.institution_name,
        institution_code=payload.institution_code.strip(),
        state=payload.state,
        departments=payload.departments,
    )
    session.add(institution)
    await session.flush()
    session.add(AccountEmail(email=institution.email, account_id=institution.id, role=Role.institution))
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email or institution code already exists.") from error
    return TokenResponse(access_token=create_access_token(institution.id, institution.role), role="institution")


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    await enforce_rate_limit("login", _request_subject(request), get_settings().login_rate_limit_per_minute)
    email = payload.email.casefold()
    candidate_emails = [email]
    if email in ("maya@example.demo", "maya@poly.demo"):
        candidate_emails = ["maya@poly.demo", "maya@example.demo"]
    student = (await session.scalars(select(Student).where(Student.email.in_(candidate_emails)))).first()
    recruiter = (await session.scalars(select(Recruiter).where(Recruiter.email == email))).first()
    academician = (await session.scalars(select(Academician).where(Academician.email == email))).first()
    institution = (await session.scalars(select(Institution).where(Institution.email == email))).first()
    admin = (await session.scalars(select(Admin).where(Admin.email == email))).first()
    for account in (student, recruiter, academician, institution, admin):
        if account is not None and verify_password(payload.password, account.password_hash):
            role = cast(Literal["student", "recruiter", "admin", "academician", "institution"], account.role)
            return TokenResponse(access_token=create_access_token(account.id, role), role=role)
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")


async def _find_account_by_email(
    session: AsyncSession, email: str
) -> tuple[Any, str | None, str | None]:
    normalized = email.strip().casefold()
    student = (await session.scalars(select(Student).where(Student.email == normalized))).first()
    if student is not None:
        return student, "student", student.full_name
    recruiter = (await session.scalars(select(Recruiter).where(Recruiter.email == normalized))).first()
    if recruiter is not None:
        return recruiter, "recruiter", recruiter.company_name
    academician = (await session.scalars(select(Academician).where(Academician.email == normalized))).first()
    if academician is not None:
        return academician, "academician", academician.full_name
    institution = (await session.scalars(select(Institution).where(Institution.email == normalized))).first()
    if institution is not None:
        return institution, "institution", institution.institution_name
    admin = (await session.scalars(select(Admin).where(Admin.email == normalized))).first()
    if admin is not None:
        return admin, "admin", "Administrator"
    return None, None, None


async def _find_account_by_id_and_role(
    session: AsyncSession, account_id: UUID, role: str
) -> Any:
    if role == "student":
        return (await session.scalars(select(Student).where(Student.id == account_id))).first()
    elif role == "recruiter":
        return (await session.scalars(select(Recruiter).where(Recruiter.id == account_id))).first()
    elif role == "academician":
        return (await session.scalars(select(Academician).where(Academician.id == account_id))).first()
    elif role == "institution":
        return (await session.scalars(select(Institution).where(Institution.id == account_id))).first()
    elif role == "admin":
        return (await session.scalars(select(Admin).where(Admin.id == account_id))).first()
    return None


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ForgotPasswordResponse:
    settings = get_settings()
    await enforce_rate_limit(
        "forgot_password",
        _request_subject(request),
        settings.forgot_password_rate_limit_per_minute,
    )
    email = payload.email.strip().casefold()
    account, role, name = await _find_account_by_email(session, email)

    dev_reset_url = None
    dev_token = None

    if account is not None and role is not None:
        token = create_password_reset_token(
            subject=account.id,
            role=role,
            email=email,
        )
        email_result = await send_password_reset_email(
            to_email=email,
            reset_token=token,
            recipient_name=name,
        )
        if settings.environment != "production":
            dev_reset_url = email_result.get("reset_url")
            dev_token = token

    # Always return a consistent user-facing message to prevent email enumeration
    return ForgotPasswordResponse(
        message="If an account with this email exists, a password reset link has been sent.",
        email=email,
        dev_reset_url=dev_reset_url,
        dev_token=dev_token,
    )


@router.post("/verify-reset-token", response_model=VerifyResetTokenResponse)
async def verify_reset_token(
    payload: VerifyResetTokenRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> VerifyResetTokenResponse:
    subject_id, role, email = verify_password_reset_token(payload.token)
    account = await _find_account_by_id_and_role(session, subject_id, role)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account associated with this password reset link no longer exists.",
        )
    return VerifyResetTokenResponse(
        valid=True,
        email=email,
        role=role,
        message="Password reset token is valid.",
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ResetPasswordResponse:
    await enforce_rate_limit(
        "reset_password",
        _request_subject(request),
        get_settings().login_rate_limit_per_minute,
    )
    subject_id, role, email = verify_password_reset_token(payload.token)
    account = await _find_account_by_id_and_role(session, subject_id, role)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account associated with this password reset link no longer exists.",
        )

    account.password_hash = hash_password(payload.new_password)
    await session.commit()

    return ResetPasswordResponse(
        message="Password has been successfully updated. You can now sign in with your new password.",
        email=email,
    )


@router.post("/google", response_model=TokenResponse)
async def login_with_google(
    payload: GoogleAuthRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    await enforce_rate_limit("login", _request_subject(request), get_settings().login_rate_limit_per_minute)
    
    settings = get_settings()
    if settings.environment == "production" and not settings.google_client_id:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Google authentication is not configured.",
        )
    id_info = verify_google_credential(payload.credential, settings.google_client_id)
    
    email_raw = id_info.get("email")
    if not email_raw or not isinstance(email_raw, str):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Google token missing verified email")
    
    email = email_raw.casefold()
    full_name = id_info.get("name") or email.split("@")[0]
    if isinstance(full_name, str):
        full_name = full_name.strip() or "Google User"
    else:
        full_name = "Google User"

    # Check if account already exists
    registry = await session.get(AccountEmail, email)
    if registry is not None:
        role_value = registry.role.value if hasattr(registry.role, "value") else str(registry.role)
        role = cast(Literal["student", "recruiter", "admin", "academician", "institution"], role_value)
        return TokenResponse(access_token=create_access_token(registry.account_id, role), role=role)

    # Fallback search directly in tables in case AccountEmail was migrated
    student = (await session.scalars(select(Student).where(Student.email == email))).first()
    if student is not None:
        session.add(AccountEmail(email=email, account_id=student.id, role=Role.student))
        await session.commit()
        return TokenResponse(access_token=create_access_token(student.id, Role.student), role="student")

    recruiter = (await session.scalars(select(Recruiter).where(Recruiter.email == email))).first()
    if recruiter is not None:
        session.add(AccountEmail(email=email, account_id=recruiter.id, role=Role.recruiter))
        await session.commit()
        return TokenResponse(access_token=create_access_token(recruiter.id, Role.recruiter), role="recruiter")

    academician = (await session.scalars(select(Academician).where(Academician.email == email))).first()
    if academician is not None:
        session.add(AccountEmail(email=email, account_id=academician.id, role=Role.academician))
        await session.commit()
        return TokenResponse(access_token=create_access_token(academician.id, Role.academician), role="academician")

    institution = (await session.scalars(select(Institution).where(Institution.email == email))).first()
    if institution is not None:
        session.add(AccountEmail(email=email, account_id=institution.id, role=Role.institution))
        await session.commit()
        return TokenResponse(access_token=create_access_token(institution.id, Role.institution), role="institution")

    admin = (await session.scalars(select(Admin).where(Admin.email == email))).first()
    if admin is not None:
        session.add(AccountEmail(email=email, account_id=admin.id, role=Role.admin))
        await session.commit()
        return TokenResponse(access_token=create_access_token(admin.id, Role.admin), role="admin")

    # New User Signup
    random_password = secrets.token_urlsafe(32)
    pwd_hash = hash_password(random_password)

    if payload.role == "recruiter":
        company = payload.company_name or f"{full_name}'s Organization"
        new_recruiter = Recruiter(email=email, password_hash=pwd_hash, company_name=company)
        session.add(new_recruiter)
        await session.flush()
        session.add(AccountEmail(email=email, account_id=new_recruiter.id, role=Role.recruiter))
        try:
            await session.commit()
        except IntegrityError as error:
            await session.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Account registration conflict") from error
        return TokenResponse(access_token=create_access_token(new_recruiter.id, Role.recruiter), role="recruiter")
    elif payload.role == "academician":
        new_academician = Academician(
            email=email,
            password_hash=pwd_hash,
            full_name=full_name,
            institution_name=payload.company_name or "Partner University",
            department="Computer Science & Engineering",
            designation="Assistant Professor",
            research_areas=["Artificial Intelligence", "Distributed Systems"],
        )
        session.add(new_academician)
        await session.flush()
        session.add(AccountEmail(email=email, account_id=new_academician.id, role=Role.academician))
        try:
            await session.commit()
        except IntegrityError as error:
            await session.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Account registration conflict") from error
        return TokenResponse(access_token=create_access_token(new_academician.id, Role.academician), role="academician")
    elif payload.role == "institution":
        new_institution = Institution(
            email=email,
            password_hash=pwd_hash,
            institution_name=payload.company_name or f"{full_name} Institute",
            institution_code=f"INST-{secrets.token_hex(3).upper()}",
            state="Karnataka",
            departments=["Computer Science", "Information Technology", "Electronics"],
        )
        session.add(new_institution)
        await session.flush()
        session.add(AccountEmail(email=email, account_id=new_institution.id, role=Role.institution))
        try:
            await session.commit()
        except IntegrityError as error:
            await session.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Account registration conflict") from error
        return TokenResponse(access_token=create_access_token(new_institution.id, Role.institution), role="institution")
    else:
        new_student = Student(email=email, password_hash=pwd_hash, full_name=full_name)
        session.add(new_student)
        await session.flush()
        session.add(AccountEmail(email=email, account_id=new_student.id, role=Role.student))
        try:
            await session.commit()
        except IntegrityError as error:
            await session.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, "Account registration conflict") from error
        return TokenResponse(access_token=create_access_token(new_student.id, Role.student), role="student")


@router.get("/me")
async def get_me(
    principal: Annotated[Student | Recruiter | Admin | Academician | Institution, Depends(current_principal)],
) -> dict[str, Any]:
    role_val = principal.role if hasattr(principal, "role") else "unknown"
    data: dict[str, Any] = {
        "id": str(principal.id),
        "email": principal.email,
        "role": role_val,
    }
    if hasattr(principal, "full_name"):
        data["full_name"] = principal.full_name
    if hasattr(principal, "company_name"):
        data["company_name"] = principal.company_name
    if hasattr(principal, "institution_name"):
        data["institution_name"] = principal.institution_name
    if hasattr(principal, "department"):
        data["department"] = principal.department
    if hasattr(principal, "designation"):
        data["designation"] = principal.designation
    if hasattr(principal, "university"):
        data["university"] = principal.university
    return data

