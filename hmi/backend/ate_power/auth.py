"""PIN session cookies (HttpOnly, signed)."""

from __future__ import annotations

import secrets
from typing import Optional, Union

from itsdangerous import BadSignature, TimestampSigner
from starlette.requests import Request
from starlette.responses import Response
from starlette.websockets import WebSocket

from .config import SESSION_COOKIE, session_secret, verify_pin

_signer = TimestampSigner(session_secret())
SESSION_MAX_AGE_S = 12 * 3600


def create_session_id() -> str:
    return secrets.token_urlsafe(24)


def issue_session_cookie(response: Response, session_id: str) -> None:
    token = _signer.sign(session_id.encode("utf-8")).decode("utf-8")
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE_S,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


def read_session_id(request: Union[Request, WebSocket]) -> Optional[str]:
    raw = request.cookies.get(SESSION_COOKIE)
    if not raw:
        return None
    try:
        session_id = _signer.unsign(raw, max_age=SESSION_MAX_AGE_S)
        return session_id.decode("utf-8")
    except (BadSignature, UnicodeDecodeError):
        return None


def authenticate_pin(pin: str) -> bool:
    if not pin or len(pin) > 64:
        return False
    return verify_pin(pin)
