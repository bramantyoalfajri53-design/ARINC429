"""API router boundary for Boeing CMC operating mode."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import require_session

from .schemas import (
    CmcCommandSummaryRequest,
    CmcConfigDataRequest,
    CmcFaultToggleRequest,
    CmcLruSelectRequest,
    CmcShopFaultsRequest,
)
from .service import (
    get_cmc_state,
    get_module_metadata,
    request_cmc_config_data,
    request_cmc_shop_faults,
    select_cmc_lru,
    send_cmc_command_summary,
    update_cmc_fault_bit,
)

router = APIRouter(prefix="/api/cmc", tags=["cmc"])


@router.get("/state")
def cmc_state(_session: str = Depends(require_session)):
    return {"metadata": get_module_metadata().model_dump(), **get_cmc_state()}


@router.post("/lru")
def cmc_select_lru(body: CmcLruSelectRequest, _session: str = Depends(require_session)):
    return select_cmc_lru(body)


@router.post("/command")
def cmc_send_command(body: CmcCommandSummaryRequest, _session: str = Depends(require_session)):
    try:
        return send_cmc_command_summary(body)
    except (ValueError, PermissionError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/fault-summary")
def cmc_fault_summary(body: CmcFaultToggleRequest, _session: str = Depends(require_session)):
    return update_cmc_fault_bit(body.bit, body.fault, body.command_ack)


@router.post("/request-config-data")
def cmc_config_data(body: CmcConfigDataRequest, _session: str = Depends(require_session)):
    try:
        return request_cmc_config_data(body)
    except (ValueError, PermissionError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/request-shop-faults")
def cmc_shop_faults(body: CmcShopFaultsRequest, _session: str = Depends(require_session)):
    try:
        return request_cmc_shop_faults(body)
    except (ValueError, PermissionError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
