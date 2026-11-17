"""PIN authentication and session endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from ate_power.auth import (
    authenticate_pin,
    clear_session_cookie,
    create_session_id,
    issue_session_cookie,
    read_session_id,
)
from ate_power.schemas import LoginRequest

from ..dependencies import require_session
from ..runtime import lease

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest):
    if not authenticate_pin(body.pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")
    session_id = create_session_id()
    response = JSONResponse({"ok": True})
    issue_session_cookie(response, session_id)
    return response


@router.post("/logout")
def logout(request: Request):
    session_id = read_session_id(request)
    if session_id:
        lease.release(session_id)
    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    return response


@router.get("/session")
def session_info(session_id: str = Depends(require_session)):
    return {"ok": True, "lease": lease.snapshot(session_id)}

