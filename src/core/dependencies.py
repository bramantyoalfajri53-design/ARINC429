"""FastAPI dependencies shared across operating mode routers."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request

from ate_power.auth import read_session_id

from .runtime import lease


def require_session(request: Request) -> str:
    """Ensure the request carries a valid signed session cookie."""
    # First check ate_platform.web.auth (for ate-web production on port 8080)
    try:
        from ate_platform.web.auth import read_session_id as read_ui_session
        sid = read_ui_session(request)
        if sid:
            return sid
    except ImportError:
        pass

    # Then check ate_power.auth fallback
    sid = read_session_id(request)
    if not sid:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return sid


def require_control(session_id: str = Depends(require_session)) -> str:
    """Ensure the authenticated session currently holds the single-operator control lease."""
    if not lease.is_holder(session_id):
        raise HTTPException(
            status_code=403,
            detail="View-only session: acquire control to send commands",
        )
    lease.heartbeat(session_id)
    return session_id

