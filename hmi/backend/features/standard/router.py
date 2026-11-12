"""API router boundary for Standard operating mode."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import require_session

from .schemas import StandardTransmitRequest
from .service import get_module_metadata, get_standard_state, transmit_standard_slot

router = APIRouter(prefix="/api/standard", tags=["standard"])


@router.get("/status")
def standard_status(_session: str = Depends(require_session)):
    return {"metadata": get_module_metadata().model_dump(), **get_standard_state()}


@router.post("/transmit")
def standard_transmit(body: StandardTransmitRequest, _session: str = Depends(require_session)):
    try:
        return transmit_standard_slot(body.channel, body.slot)
    except (ValueError, PermissionError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
