"""API router boundary for Boeing CMC operating mode."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import require_session

from .schemas import (
    CmcCommandSummaryRequest,
    CmcConfigDataRequest,
    CmcFaultToggleRequest,
    CmcFaultWordPageRequest,
    CmcLruSelectRequest,
    CmcShopFaultsRequest,
    CmcTerminalActionRequest,
    CmcTransmitDataRequest,
)
from .service import (
    get_cmc_state,
    get_module_metadata,
    handle_cmc_terminal_action,
    request_cmc_config_data,
    request_cmc_shop_faults,
    select_cmc_lru,
    send_cmc_command_summary,
    switch_cmc_fault_page,
    update_cmc_fault_bit,
    update_cmc_transmit_data,
)

router = APIRouter(prefix="/api/cmc", tags=["cmc"])


@router.get("/state")
def cmc_state(_session: str = Depends(require_session)):
    return {"metadata": get_module_metadata().model_dump(), **get_cmc_state()}


@router.post("/lru")
def cmc_select_lru(body: CmcLruSelectRequest, _session: str = Depends(require_session)):
    return select_cmc_lru(body)


@router.post("/transmit-data")
def cmc_transmit_data(body: CmcTransmitDataRequest, _session: str = Depends(require_session)):
    try:
        return update_cmc_transmit_data(body)
    except (ValueError, PermissionError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/command")
def cmc_send_command(body: CmcCommandSummaryRequest, _session: str = Depends(require_session)):
    try:
        return send_cmc_command_summary(body)
    except (ValueError, PermissionError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/fault-summary")
def cmc_fault_summary(body: CmcFaultToggleRequest, _session: str = Depends(require_session)):
    return update_cmc_fault_bit(
        bit=body.bit,
        fault=body.fault,
        command_ack=body.command_ack,
        bite_inhibit=body.bite_inhibit,
        label=body.label,
        sdi=body.sdi,
        ssm=body.ssm,
        has_words=body.has_words,
    )


@router.post("/fault-page")
def cmc_fault_page(body: CmcFaultWordPageRequest, _session: str = Depends(require_session)):
    return switch_cmc_fault_page(body.label)


@router.post("/terminal-action")
def cmc_terminal_action(body: CmcTerminalActionRequest, _session: str = Depends(require_session)):
    try:
        return handle_cmc_terminal_action(body)
    except (ValueError, PermissionError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
