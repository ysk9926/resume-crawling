from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from datetime import timedelta

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.bootstrap import adopt_legacy_personal_data
from app.config import SESSION_TTL_DAYS
from app.database import get_db
from app.models import User, UserSession, utcnow


USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$")


def normalize_username(username: str) -> str:
    return username.strip().casefold()


def validate_username(username: str) -> str:
    normalized = normalize_username(username)
    if not USERNAME_PATTERN.fullmatch(normalized):
        raise ValueError("Username must be 3-32 chars using letters, numbers, dot, dash, or underscore.")
    return normalized


def validate_password(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    return password


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    derived_b64 = base64.b64encode(derived).decode("ascii")
    return f"scrypt${salt_b64}${derived_b64}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, salt_b64, derived_b64 = encoded.split("$", 2)
    except ValueError:
        return False
    if algorithm != "scrypt":
        return False

    salt = base64.b64decode(salt_b64.encode("ascii"))
    expected = base64.b64decode(derived_b64.encode("ascii"))
    actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(actual, expected)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_user_account(session: Session, username: str, password: str) -> User:
    normalized_username = validate_username(username)
    validate_password(password)

    if session.scalar(select(User.id).where(User.username == normalized_username)) is not None:
        raise ValueError("Username already exists.")

    is_first_user = (session.scalar(select(func.count(User.id))) or 0) == 0
    user = User(
        username=normalized_username,
        password_hash=hash_password(password),
        role="admin" if is_first_user else "member",
    )
    session.add(user)
    session.flush()
    if is_first_user:
        adopt_legacy_personal_data(session, user)
    session.commit()
    session.refresh(user)
    return user


def create_user_session(session: Session, user: User) -> tuple[UserSession, str]:
    token = secrets.token_urlsafe(32)
    session_record = UserSession(
        user_id=user.id,
        session_token_hash=hash_session_token(token),
        expires_at=utcnow() + timedelta(days=SESSION_TTL_DAYS),
    )
    session.add(session_record)
    user.last_login_at = utcnow()
    session.commit()
    session.refresh(session_record)
    return session_record, token


def authenticate_user(session: Session, username: str, password: str) -> User:
    normalized_username = validate_username(username)
    user = session.scalar(select(User).where(User.username == normalized_username))
    if user is None or not verify_password(password, user.password_hash):
        raise ValueError("Invalid username or password.")
    if not user.is_active:
        raise ValueError("User account is inactive.")
    return user


def extract_session_token(
    session_token_header: str | None,
    authorization: str | None,
) -> str | None:
    if session_token_header:
        return session_token_header.strip()
    if authorization and authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip()
    return None


def resolve_current_user(
    session: Session,
    session_token: str | None,
) -> User | None:
    if not session_token:
        return None

    token_hash = hash_session_token(session_token)
    session_record = session.scalar(
        select(UserSession)
        .options()
        .where(UserSession.session_token_hash == token_hash)
    )
    if session_record is None or session_record.expires_at <= utcnow():
        if session_record is not None:
            session.delete(session_record)
            session.commit()
        return None

    user = session.get(User, session_record.user_id)
    if user is None or not user.is_active:
        return None

    session_record.last_seen_at = utcnow()
    session.commit()
    session.refresh(user)
    return user


def get_current_user(
    session_token_header: str | None = Header(default=None, alias="X-Session-Token"),
    authorization: str | None = Header(default=None),
    session: Session = Depends(get_db),
) -> User:
    user = resolve_current_user(
        session,
        extract_session_token(session_token_header, authorization),
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return user


def revoke_session(session: Session, session_token: str | None) -> None:
    if not session_token:
        return

    token_hash = hash_session_token(session_token)
    session_record = session.scalar(
        select(UserSession).where(UserSession.session_token_hash == token_hash)
    )
    if session_record is None:
        return

    session.delete(session_record)
    session.commit()
