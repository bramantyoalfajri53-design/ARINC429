"""FastAPI dependencies shared across operating mode routers."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request

from ate_power.auth import read_session_id

from .runtime import lease


def require_session(request: Request) -> str:
    """Ensure the request carries a valid signed session cookie."""
    session_id = read_session_id(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session_id


def require_control(session_id: str = Depends(require_session)) -> str:
    """Ensure the authenticated session currently holds the single-operator control lease."""
    if not lease.is_holder(session_id):
        raise HTTPException(
            status_code=403,
            detail="View-only session: acquire control to send commands",
        )
    lease.heartbeat(session_id)
    return session_id

