from datetime import datetime, timedelta

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import text

from app.config import settings
from app.services.db_service import engine


pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer()


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password is too long. Maximum is 72 bytes.")

    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if len(password.encode("utf-8")) > 72:
        return False

    return pwd_context.verify(password, password_hash)


def create_access_token(data: dict) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expire_minutes)

    payload = {
        **data,
        "exp": expire,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

def register_user(
    email: str,
    password: str,
    full_name: str,
    organization_code: str,
    email_provider: str | None = None,
    email_address: str | None = None,
):
    clean_email = email.lower().strip()
    clean_organization_code = organization_code.strip()

    if not clean_organization_code:
        raise ValueError("Organization code is required")

    password_hash = hash_password(password)

    with engine.begin() as conn:
        existing_user = conn.execute(
            text("""
                SELECT id
                FROM users
                WHERE email = :email
            """),
            {"email": clean_email},
        ).first()

        if existing_user:
            raise ValueError("User already exists")

        organization = conn.execute(
            text("""
                SELECT id, name
                FROM organizations
                WHERE registration_code = :registration_code
                AND is_active = TRUE
            """),
            {"registration_code": clean_organization_code},
        ).first()

        if not organization:
            raise ValueError("Invalid organization code")

        user = conn.execute(
            text("""
                INSERT INTO users (email, password_hash, full_name)
                VALUES (:email, :password_hash, :full_name)
                RETURNING id, email, full_name
            """),
            {
                "email": clean_email,
                "password_hash": password_hash,
                "full_name": full_name,
            },
        ).first()

        conn.execute(
            text("""
                INSERT INTO organization_members (
                    user_id,
                    organization_id,
                    role,
                    app_access_enabled
                )
                VALUES (
                    :user_id,
                    :organization_id,
                    'member',
                    FALSE
                )
            """),
            {
                "user_id": user.id,
                "organization_id": organization.id,
            },
        )

        if email_provider:
            conn.execute(
                text("""
                    INSERT INTO email_connections (
                        user_id,
                        organization_id,
                        provider,
                        email_address,
                        status
                    )
                    VALUES (
                        :user_id,
                        :organization_id,
                        :provider,
                        :email_address,
                        'pending'
                    )
                """),
                {
                    "user_id": user.id,
                    "organization_id": organization.id,
                    "provider": email_provider,
                    "email_address": email_address or clean_email,
                },
            )

    return {
        "status": "registered",
        "message": "Registration created. Waiting for admin approval.",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
        },
        "organization": {
            "id": organization.id,
            "name": organization.name,
        },
    }

def login_user(email: str, password: str):
    clean_email = email.lower().strip()

    with engine.begin() as conn:
        user = conn.execute(
            text("""
                SELECT id, email, password_hash, full_name, global_role
                FROM users
                WHERE email = :email
            """),
            {"email": clean_email},
        ).first()

        if not user:
            raise ValueError("Invalid email or password")

        if not verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password")

        membership = conn.execute(
            text("""
                SELECT
                    om.organization_id,
                    om.role,
                    om.app_access_enabled,
                    o.is_active AS organization_is_active
                FROM organization_members om
                JOIN organizations o ON o.id = om.organization_id
                WHERE om.user_id = :user_id
                LIMIT 1
            """),
            {"user_id": user.id},
        ).first()

        if not membership:
            raise ValueError("User has no organization membership")

        if not membership.organization_is_active:
            raise ValueError("Organization is disabled")

        if not membership.app_access_enabled:
            raise ValueError("User access is waiting for admin approval")

    token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "organization_id": membership.organization_id,
            "role": membership.role,
            "global_role": user.global_role,
        }
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
        },
        "organization_id": membership.organization_id,
        "role": membership.role,
    }

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        user_id = payload.get("sub")
        organization_id = payload.get("organization_id")

        if user_id is None or organization_id is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token payload",
            )

        return {
            "user_id": int(user_id),
            "email": payload.get("email"),
            "organization_id": int(organization_id),
            "role": payload.get("role"),
            "global_role": payload.get("global_role", "user"),
        }

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )