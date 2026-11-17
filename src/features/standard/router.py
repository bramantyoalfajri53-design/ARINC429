"""API router boundary for Standard operating mode (including Dynamic LRU Single Channel Mode)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import require_session

from .lru_registry import get_lru_definitions, get_lru_detail
from .schemas import LruSingleModeTransmitRequest, StandardTransmitRequest
from .service import (
    get_module_metadata,
    get_standard_state,
    transmit_lru_single_mode,
    transmit_standard_slot,
)

router = APIRouter(prefix="/api/standard", tags=["standard"])


@router.get("/status")
def standard_status(_session: str = Depends(require_session)):
    return {"metadata": get_module_metadata().model_dump(), **get_standard_state()}


@router.get("/lrus")
def list_standard_lrus(_session: str = Depends(require_session)):
    """Return list of all registered Avionics LRUs for Standard Mode."""
    return {"lrus": get_lru_definitions()}


@router.get("/lrus/{lru_id}")
def get_standard_lru_detail(lru_id: str, _session: str = Depends(require_session)):
    """Return full schema and defaults for a specific LRU."""
    try:
        return get_lru_detail(lru_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/transmit")
def standard_transmit(body: StandardTransmitRequest, _session: str = Depends(require_session)):
    try:
        return transmit_standard_slot(body.channel, body.slot)
    except (ValueError, PermissionError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/transmit-lru")
def standard_transmit_lru(body: LruSingleModeTransmitRequest, _session: str = Depends(require_session)):
    """Transmit LRU Single Channel Mode word with validation and registration."""
    try:
        return transmit_lru_single_mode(body)
    except (ValueError, PermissionError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
