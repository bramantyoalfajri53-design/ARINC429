"""Shared HTTP API routes for ARINC 429 bus coordination, channel config, and log export."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..arinc429 import BusSpeed, OperatingMode
from ..dependencies import require_session
from ..runtime import arinc_coordinator

router = APIRouter(prefix="/api/arinc429", tags=["arinc429"])


class AcquireModeRequest(BaseModel):
    mode: OperatingMode


class BusControlRequest(BaseModel):
    running: bool | None = None
    speed: BusSpeed | None = None
    simulation_mode: bool | None = None


class ChannelConfigRequest(BaseModel):
    channel: str = Field(..., pattern=r"^(TX|RX)-[ABCD]$")
    speed: BusSpeed | None = None
    enabled: bool | None = None
    trap_label: str | None = Field(default=None, max_length=3)
    trap_active: bool | None = None


@router.get("/status")
def get_arinc_status(_session: str = Depends(require_session)):
    """Return unified ARINC 429 hardware/simulation status, shared channels, and recent logs."""
    return arinc_coordinator.snapshot()


@router.post("/mode")
def acquire_operating_mode(body: AcquireModeRequest, _session: str = Depends(require_session)):
    """Switch active bus ownership to STANDARD, CFDS, or CMC with RX isolation."""
    return arinc_coordinator.acquire_mode(body.mode)


@router.post("/bus")
def update_bus_state(body: BusControlRequest, _session: str = Depends(require_session)):
    """Start/stop ARINC 429 bus, change global speed, or switch SIMULATION/HARDWARE source."""
    try:
        return arinc_coordinator.set_bus_state(
            running=body.running,
            speed=body.speed,
            simulation_mode=body.simulation_mode,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/channels")
def update_channel_config(body: ChannelConfigRequest, _session: str = Depends(require_session)):
    """Configure shared ARINC 429 TX-A..D or RX-A..D channel parameters."""
    try:
        return arinc_coordinator.configure_channel(
            channel=body.channel,
            speed=body.speed,
            enabled=body.enabled,
            trap_label=body.trap_label,
            trap_active=body.trap_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/export")
def export_arinc_logs(
    fmt: Literal["json", "csv"] = Query(default="json"),
    _session: str = Depends(require_session),
):
    """Export timestamped ARINC 429 test activity logs in JSON or CSV format (zero-DB)."""
    content, media_type = arinc_coordinator.export_logs(fmt)
    ext = "csv" if fmt == "csv" else "json"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="arinc429_log.{ext}"'},
    )

