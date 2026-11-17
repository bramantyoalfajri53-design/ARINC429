"""HTTP routes for DC/AC power supplies, E-STOP, GPIB rescan, and simulation mode."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from core.dependencies import require_control, require_session

from .schemas import (
    AcPresetRequest,
    AcSetpointRequest,
    DcPresetRequest,
    DcSetpointRequest,
    OutputRequest,
    SimulationRequest,
)
from .service import (
    apply_ac_output,
    apply_ac_preset,
    apply_ac_setpoint,
    apply_dc_output,
    apply_dc_preset,
    apply_dc_setpoint,
    rescan_instruments,
    set_simulation_mode,
    trigger_estop,
)

router = APIRouter(tags=["power"])


@router.post("/api/dc/setpoint")
def dc_setpoint(body: DcSetpointRequest, _ctrl: str = Depends(require_control)):
    apply_dc_setpoint(body.voltage, body.current, body.ovp)
    return {"ok": True}


@router.post("/api/dc/output")
def dc_output(body: OutputRequest, _ctrl: str = Depends(require_control)):
    apply_dc_output(body.enabled, body.confirm_high_voltage)
    return {"ok": True}


@router.post("/api/dc/preset")
def dc_preset(body: DcPresetRequest, _ctrl: str = Depends(require_control)):
    apply_dc_preset(body.voltage)
    return {"ok": True}


@router.post("/api/ac/setpoint")
def ac_setpoint(body: AcSetpointRequest, _ctrl: str = Depends(require_control)):
    apply_ac_setpoint(body.voltage, body.frequency, body.current)
    return {"ok": True}


@router.post("/api/ac/output")
def ac_output(body: OutputRequest, _ctrl: str = Depends(require_control)):
    apply_ac_output(body.enabled, body.confirm_high_voltage)
    return {"ok": True}


@router.post("/api/ac/preset")
def ac_preset(body: AcPresetRequest, _ctrl: str = Depends(require_control)):
    apply_ac_preset(body.voltage, body.frequency)
    return {"ok": True}


@router.post("/api/estop")
def estop(_session: str = Depends(require_session)):
    """Global E-STOP: any authenticated session, including view-only."""
    trigger_estop()
    return {"ok": True}


@router.post("/api/gpib/rescan")
def gpib_rescan(_ctrl: str = Depends(require_control)):
    rescan_instruments()
    return {"ok": True}


@router.post("/api/mode/simulation")
def set_simulation(body: SimulationRequest, _ctrl: str = Depends(require_control)):
    set_simulation_mode(body.enabled)
    return {"ok": True}

