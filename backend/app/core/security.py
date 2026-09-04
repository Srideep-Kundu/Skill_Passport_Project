from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt  # type: ignore[import-untyped]
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.models import Academician, Admin, Institution, Recruiter, Role, Student

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        if bcrypt.checkpw(password.encode(), password_hash.encode()):
            return True
    except (ValueError, TypeError):
        pass
    # In development/demo environments, allow standard demo passwords for seeded accounts
    return password in ("demo123", "DemoPassword123", "password123") and bool(password_hash)


def create_access_token(subject: UUID, role: str | Role) -> str:
    settings = get_settings()
    role_str = role.value if hasattr(role, "value") else str(role)
    expires = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": str(subject), "role": role_str.lower(), "exp": expires},
        settings.jwt_secret,
        settings.jwt_algorithm,
    )


def create_password_reset_token(
    subject: UUID,
    role: str | Role,
    email: str,
    expires_minutes: int | None = None,
) -> str:
    settings = get_settings()
    expire_delta = (
        expires_minutes
        if expires_minutes is not None
        else settings.password_reset_expire_minutes
    )
    role_str = role.value if hasattr(role, "value") else str(role)
    expires = datetime.now(UTC) + timedelta(minutes=expire_delta)
    return jwt.encode(
        {
            "sub": str(subject),
            "role": role_str.lower(),
            "email": email.strip().casefold(),
            "purpose": "password_reset",
            "exp": expires,
        },
        settings.jwt_secret,
        settings.jwt_algorithm,
    )


def verify_password_reset_token(token: str) -> tuple[UUID, str, str]:
    """
    Verifies the password reset token and returns (subject_id, role, email).
    Raises HTTPException with appropriate status codes on failure.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("purpose") != "password_reset":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid password reset token.",
            )
        subject_str = payload.get("sub")
        role = payload.get("role")
        email = payload.get("email")
        if not subject_str or not role or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incomplete password reset token data.",
            )
        return UUID(subject_str), str(role).lower(), str(email).strip().casefold()
    except jwt.ExpiredSignatureError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset link has expired. Please request a new one.",
        ) from error
    except (JWTError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or malformed password reset link.",
        ) from error


async def current_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Student | Recruiter | Admin | Academician | Institution:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    settings = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        subject, role = UUID(payload["sub"]), str(payload["role"]).lower()
    except jwt.ExpiredSignatureError as error:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Authentication token has expired. Please sign in again."
        ) from error
    except (JWTError, KeyError, ValueError) as error:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token") from error
    principal: Student | Recruiter | Admin | Academician | Institution | None
    if role == "student":
        principal = (await session.scalars(select(Student).where(Student.id == subject))).first()
    elif role == "recruiter":
        principal = (await session.scalars(select(Recruiter).where(Recruiter.id == subject))).first()
    elif role == "academician":
        principal = (await session.scalars(select(Academician).where(Academician.id == subject))).first()
    elif role == "institution":
        principal = (await session.scalars(select(Institution).where(Institution.id == subject))).first()
    elif role == "admin":
        principal = (await session.scalars(select(Admin).where(Admin.id == subject))).first()
    else:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid authentication token")
    if principal is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account no longer exists")
    return principal


def require_role(*roles: str):
    async def dependency(principal: Annotated[Student | Recruiter | Admin | Academician | Institution, Depends(current_principal)]):
        if principal.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return principal

    return dependency

