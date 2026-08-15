from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Admin, Recruiter, Student
from app.schemas.contracts import (
    LoginRequest,
    RecruiterRegistration,
    StudentRegistration,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


async def _email_taken(session: AsyncSession, email: str) -> bool:
    normalized = email.casefold()
    student = (await session.scalars(select(Student.id).where(Student.email == normalized))).first()
    recruiter = (await session.scalars(select(Recruiter.id).where(Recruiter.email == normalized))).first()
    admin = (await session.scalars(select(Admin.id).where(Admin.email == normalized))).first()
    return student is not None or recruiter is not None or admin is not None


@router.post("/register/student", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_student(payload: StudentRegistration, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    if await _email_taken(session, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    student = Student(email=payload.email.casefold(), password_hash=hash_password(payload.password), full_name=payload.full_name, university=payload.university, graduation_year=payload.graduation_year)
    session.add(student)
    await session.commit()
    return TokenResponse(access_token=create_access_token(student.id, student.role), role="student")


@router.post("/register/recruiter", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_recruiter(payload: RecruiterRegistration, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    if await _email_taken(session, payload.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    recruiter = Recruiter(email=payload.email.casefold(), password_hash=hash_password(payload.password), company_name=payload.company_name)
    session.add(recruiter)
    await session.commit()
    return TokenResponse(access_token=create_access_token(recruiter.id, recruiter.role), role="recruiter")


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, session: Annotated[AsyncSession, Depends(get_session)]) -> TokenResponse:
    email = payload.email.casefold()
    student = (await session.scalars(select(Student).where(Student.email == email))).first()
    recruiter = (await session.scalars(select(Recruiter).where(Recruiter.email == email))).first()
    admin = (await session.scalars(select(Admin).where(Admin.email == email))).first()
    for account in (student, recruiter, admin):
        if account is not None and verify_password(payload.password, account.password_hash):
            role = cast(Literal["student", "recruiter", "admin"], account.role)
            return TokenResponse(access_token=create_access_token(account.id, role), role=role)
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
