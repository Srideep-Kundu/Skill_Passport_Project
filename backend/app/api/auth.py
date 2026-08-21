import secrets
from typing import Annotated, Any, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.security import create_access_token, hash_password, verify_password
from app.models import AccountEmail, Admin, Recruiter, Role, Student
from app.schemas.contracts import (
    GoogleAuthRequest,
    LoginRequest,
    RecruiterRegistration,
    StudentRegistration,
    TokenResponse,
)
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
            detail=f"Google authentication token validation failed: {exc}",
        ) from exc


async def _email_taken(session: AsyncSession, email: str) -> bool:
    normalized = email.casefold()
    registry = await session.get(AccountEmail, normalized)
    if registry is not None:
        return True
    student = (await session.scalars(select(Student.id).where(Student.email == normalized))).first()
    recruiter = (await session.scalars(select(Recruiter.id).where(Recruiter.email == normalized))).first()
    admin = (await session.scalars(select(Admin.id).where(Admin.email == normalized))).first()
    return student is not None or recruiter is not None or admin is not None


@router.post("/register/student", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_student(payload: StudentRegistration, request: Request, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    await enforce_rate_limit("registration", _request_subject(request), get_settings().registration_rate_limit_per_minute)
    if await _email_taken(session, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    student = Student(email=payload.email.casefold(), password_hash=hash_password(payload.password), full_name=payload.full_name, university=payload.university, graduation_year=payload.graduation_year)
    session.add(student)
    await session.flush()
    session.add(AccountEmail(email=student.email, account_id=student.id, role=Role.student))
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from error
    return TokenResponse(access_token=create_access_token(student.id, student.role), role="student")


@router.post("/register/recruiter", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_recruiter(payload: RecruiterRegistration, request: Request, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    await enforce_rate_limit("registration", _request_subject(request), get_settings().registration_rate_limit_per_minute)
    if await _email_taken(session, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    recruiter = Recruiter(email=payload.email.casefold(), password_hash=hash_password(payload.password), company_name=payload.company_name)
    session.add(recruiter)
    await session.flush()
    session.add(AccountEmail(email=recruiter.email, account_id=recruiter.id, role=Role.recruiter))
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered") from error
    return TokenResponse(access_token=create_access_token(recruiter.id, recruiter.role), role="recruiter")


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    await enforce_rate_limit("login", _request_subject(request), get_settings().login_rate_limit_per_minute)
    email = payload.email.casefold()
    student = (await session.scalars(select(Student).where(Student.email == email))).first()
    recruiter = (await session.scalars(select(Recruiter).where(Recruiter.email == email))).first()
    admin = (await session.scalars(select(Admin).where(Admin.email == email))).first()
    for account in (student, recruiter, admin):
        if account is not None and verify_password(payload.password, account.password_hash):
            role = cast(Literal["student", "recruiter", "admin"], account.role)
            return TokenResponse(access_token=create_access_token(account.id, role), role=role)
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")


@router.post("/google", response_model=TokenResponse)
async def login_with_google(
    payload: GoogleAuthRequest,
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    await enforce_rate_limit("login", _request_subject(request), get_settings().login_rate_limit_per_minute)
    
    settings = get_settings()
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
        role = cast(Literal["student", "recruiter", "admin"], role_value)
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
