"""ATE Power HMI HTTP/WebSocket application."""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from ate_power.auth import (
    authenticate_pin,
    clear_session_cookie,
    create_session_id,
    issue_session_cookie,
    read_session_id,
)
from ate_power.broker import InstrumentBroker
from ate_power.config import AC_HV_THRESHOLD_VRMS, DC_HV_THRESHOLD_V, FRONTEND_DIST
from ate_power.lease import ControlLease
from ate_power.safety import ac_requires_hv_confirm, dc_requires_hv_confirm
from ate_power.schemas import (
    AcPresetRequest,
    AcSetpointRequest,
    DcPresetRequest,
    DcSetpointRequest,
    LoginRequest,
    OutputRequest,
    SimulationRequest,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ate_power.app")

broker = InstrumentBroker(simulation_mode=False)
lease = ControlLease()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    broker.start()
    yield
    broker.stop()


app = FastAPI(title="ATE Power HMI", version="1.0.0", lifespan=lifespan)


def require_session(request: Request) -> str:
    session_id = read_session_id(request)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return session_id


def broker_cmd(cmd_type: str, *args) -> None:
    try:
        broker.run_cmd(cmd_type, *args)
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc


def require_control(session_id: str = Depends(require_session)) -> str:
    if not lease.is_holder(session_id):
        raise HTTPException(
            status_code=403,
            detail="View-only session: acquire control to send commands",
        )
    lease.heartbeat(session_id)
    return session_id


@app.post("/api/auth/login")
def login(body: LoginRequest):
    if not authenticate_pin(body.pin):
        raise HTTPException(status_code=401, detail="Invalid PIN")
    session_id = create_session_id()
    response = JSONResponse({"ok": True})
    issue_session_cookie(response, session_id)
    return response


@app.post("/api/auth/logout")
def logout(request: Request):
    session_id = read_session_id(request)
    if session_id:
        lease.release(session_id)
    response = JSONResponse({"ok": True})
    clear_session_cookie(response)
    return response


@app.get("/api/auth/session")
def session_info(session_id: str = Depends(require_session)):
    return {"ok": True, "lease": lease.snapshot(session_id)}


@app.get("/api/state")
def get_state(session_id: str = Depends(require_session)):
    snap = broker.snapshot()
    snap["lease"] = lease.snapshot(session_id)
    return snap


@app.post("/api/control/acquire")
def control_acquire(session_id: str = Depends(require_session)):
    ok, message = lease.acquire(session_id)
    if not ok:
        raise HTTPException(status_code=409, detail=message)
    return {"ok": True, "message": message, "lease": lease.snapshot(session_id)}


@app.post("/api/control/heartbeat")
def control_heartbeat(session_id: str = Depends(require_session)):
    if not lease.heartbeat(session_id):
        raise HTTPException(status_code=403, detail="Not the control holder")
    return {"ok": True, "lease": lease.snapshot(session_id)}


@app.post("/api/control/release")
def control_release(session_id: str = Depends(require_session)):
    lease.release(session_id)
    return {"ok": True, "lease": lease.snapshot(session_id)}


def _require_dc_hv_confirm(enabled: bool, confirm: bool) -> None:
    set_v = broker.current_dc_set_voltage()
    if enabled and dc_requires_hv_confirm(set_v) and not confirm:
        raise HTTPException(
            status_code=409,
            detail={
                "needs_confirm": True,
                "kind": "dc",
                "threshold_v": DC_HV_THRESHOLD_V,
                "set_voltage": set_v,
                "message": (
                    f"DC output ON at {set_v:.2f} VDC "
                    f"exceeds {DC_HV_THRESHOLD_V:.0f} V. Confirm high voltage."
                ),
            },
        )


def _require_ac_hv_confirm(enabled: bool, confirm: bool) -> None:
    set_v = broker.current_ac_set_voltage()
    if enabled and ac_requires_hv_confirm(set_v) and not confirm:
        raise HTTPException(
            status_code=409,
            detail={
                "needs_confirm": True,
                "kind": "ac",
                "threshold_v": AC_HV_THRESHOLD_VRMS,
                "set_voltage": set_v,
                "message": (
                    f"AC output ON at {set_v:.1f} Vrms "
                    f"exceeds {AC_HV_THRESHOLD_VRMS:.0f} V. Confirm high voltage."
                ),
            },
        )


@app.post("/api/dc/setpoint")
def dc_setpoint(body: DcSetpointRequest, _ctrl: str = Depends(require_control)):
    if body.voltage is not None:
        broker_cmd("DC_SET_VOLT", body.voltage)
    if body.current is not None:
        broker_cmd("DC_SET_CURR", body.current)
    if body.ovp is not None:
        broker_cmd("DC_SET_OVP", body.ovp)
    return {"ok": True}


@app.post("/api/dc/output")
def dc_output(body: OutputRequest, _ctrl: str = Depends(require_control)):
    _require_dc_hv_confirm(body.enabled, body.confirm_high_voltage)
    broker_cmd("DC_SET_OUTP", body.enabled)
    return {"ok": True}


@app.post("/api/dc/preset")
def dc_preset(body: DcPresetRequest, _ctrl: str = Depends(require_control)):
    broker_cmd("DC_SET_VOLT", body.voltage)
    return {"ok": True}


@app.post("/api/ac/setpoint")
def ac_setpoint(body: AcSetpointRequest, _ctrl: str = Depends(require_control)):
    if body.voltage is not None:
        broker_cmd("AC_SET_VOLT", body.voltage)
    if body.frequency is not None:
        broker_cmd("AC_SET_FREQ", body.frequency)
    if body.current is not None:
        broker_cmd("AC_SET_CURR", body.current)
    return {"ok": True}


@app.post("/api/ac/output")
def ac_output(body: OutputRequest, _ctrl: str = Depends(require_control)):
    _require_ac_hv_confirm(body.enabled, body.confirm_high_voltage)
    broker_cmd("AC_SET_OUTP", body.enabled)
    return {"ok": True}


@app.post("/api/ac/preset")
def ac_preset(body: AcPresetRequest, _ctrl: str = Depends(require_control)):
    broker_cmd("AC_SET_VOLT", body.voltage)
    broker_cmd("AC_SET_FREQ", body.frequency)
    return {"ok": True}


@app.post("/api/estop")
def estop(_session: str = Depends(require_session)):
    """Global E-STOP: any authenticated session, including view-only."""
    broker_cmd("EMERGENCY_STOP")
    return {"ok": True}


@app.post("/api/gpib/rescan")
def gpib_rescan(_ctrl: str = Depends(require_control)):
    broker_cmd("CONNECT")
    return {"ok": True}


@app.post("/api/mode/simulation")
def set_simulation(body: SimulationRequest, _ctrl: str = Depends(require_control)):
    broker_cmd("SET_SIM_MODE", body.enabled)
    return {"ok": True}


@app.websocket("/ws/telemetry")
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


def _spa_index() -> Optional[Path]:
    index = FRONTEND_DIST / "index.html"
    return index if index.is_file() else None


if FRONTEND_DIST.is_dir():
    assets = FRONTEND_DIST / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("ws/"):
        raise HTTPException(status_code=404)
    index = _spa_index()
    if index is None:
        return JSONResponse(
            {
                "service": "ATE Power HMI",
                "frontend": "not built",
                "hint": "Run npm run build in hmi/frontend",
            }
        )
    requested = FRONTEND_DIST / full_path
    if full_path and requested.is_file():
        return FileResponse(requested)
    return FileResponse(index)
