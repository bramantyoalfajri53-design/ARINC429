"""Global state snapshot and real-time telemetry WebSocket stream."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from ate_power.auth import read_session_id

from ..dependencies import require_session
from ..runtime import broker, lease

router = APIRouter(tags=["telemetry"])


@router.get("/api/state")
def get_state(session_id: str = Depends(require_session)):
    snap = broker.snapshot()
    snap["lease"] = lease.snapshot(session_id)
    return snap


@router.websocket("/ws/telemetry")
async def telemetry_ws(ws: WebSocket):
    await ws.accept()
    session_id = read_session_id(ws)
    if not session_id:
        await ws.send_text(json.dumps({"error": "unauthorized"}))
        await ws.close(code=4401)
        return
    try:
        while True:
            snap = broker.snapshot()
            snap["lease"] = lease.snapshot(session_id)
            await ws.send_text(json.dumps(snap))
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        pass

