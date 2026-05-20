from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import AuthRequest, AuthSessionOut, ViewerOut
from app.security import (
    authenticate_user,
    create_user_account,
    create_user_session,
    extract_session_token,
    get_current_user,
    revoke_session,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthSessionOut)
def signup(
    payload: AuthRequest,
    db: Session = Depends(get_db),
) -> AuthSessionOut:
    try:
        user = create_user_account(db, payload.username, payload.password)
        _, session_token = create_user_session(db, user)
    except ValueError as exc:
        detail = str(exc)
        status_code = 409 if detail == "Username already exists." else 400
        raise HTTPException(status_code=status_code, detail=detail) from exc

    return AuthSessionOut(
        session_token=session_token,
        user=ViewerOut.model_validate(user),
    )


@router.post("/login", response_model=AuthSessionOut)
def login(
    payload: AuthRequest,
    db: Session = Depends(get_db),
) -> AuthSessionOut:
    try:
        user = authenticate_user(db, payload.username, payload.password)
        _, session_token = create_user_session(db, user)
    except ValueError as exc:
        detail = str(exc)
        status_code = 403 if detail == "User account is inactive." else 401
        raise HTTPException(status_code=status_code, detail=detail) from exc

    return AuthSessionOut(
        session_token=session_token,
        user=ViewerOut.model_validate(user),
    )


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    session_token_header: str | None = Header(default=None, alias="X-Session-Token"),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Response:
    revoke_session(
        db,
        extract_session_token(session_token_header, authorization),
    )
    return response


@router.get("/me", response_model=ViewerOut)
def get_me(user=Depends(get_current_user)) -> ViewerOut:
    return ViewerOut.model_validate(user)
