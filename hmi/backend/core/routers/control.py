"""Single-operator control lease endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import require_session
from ..runtime import lease

router = APIRouter(prefix="/api/control", tags=["control"])


@router.post("/acquire")
def control_acquire(session_id: str = Depends(require_session)):
    ok, message = lease.acquire(session_id)
    if not ok:
        raise HTTPException(status_code=409, detail=message)
    return {"ok": True, "message": message, "lease": lease.snapshot(session_id)}


@router.post("/heartbeat")
def control_heartbeat(session_id: str = Depends(require_session)):
    if not lease.heartbeat(session_id):
        raise HTTPException(status_code=403, detail="Not the control holder")
    return {"ok": True, "lease": lease.snapshot(session_id)}


@router.post("/release")
def control_release(session_id: str = Depends(require_session)):
    lease.release(session_id)
    return {"ok": True, "lease": lease.snapshot(session_id)}

