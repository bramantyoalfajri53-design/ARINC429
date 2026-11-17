"""API router boundary for CFDS operating mode."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from core.dependencies import require_session

from .schemas import (
    CfdsBiteCommandRequest,
    CfdsChannelConfigRequest,
    CfdsDiscreteSimulateRequest,
    CfdsLruSelectRequest,
    CfdsNormalSimulateRequest,
    CfdsTxParamsRequest,
)
from .service import (
    configure_cfds_channel,
    get_cfds_state,
    get_module_metadata,
    select_cfds_lru,
    send_cfds_bite_command,
    simulate_discrete_mode,
    simulate_normal_mode,
    update_cfds_tx_params,
)

router = APIRouter(prefix="/api/cfds", tags=["cfds"])


@router.get("/status")
def cfds_status(_session: str = Depends(require_session)):
    return get_module_metadata().model_dump()


@router.get("/state")
def cfds_state(_session: str = Depends(require_session)):
    return get_cfds_state()


@router.post("/lru")
def cfds_select_lru(req: CfdsLruSelectRequest, _session: str = Depends(require_session)):
    return select_cfds_lru(req)


@router.post("/tx-params")
def cfds_update_tx_params(req: CfdsTxParamsRequest, _session: str = Depends(require_session)):
    return update_cfds_tx_params(req)


@router.post("/command")
def cfds_send_command(req: CfdsBiteCommandRequest, _session: str = Depends(require_session)):
    try:
        return send_cfds_bite_command(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/normal/simulate")
def cfds_simulate_normal(req: CfdsNormalSimulateRequest, _session: str = Depends(require_session)):
    return simulate_normal_mode(req)


@router.post("/discrete/simulate")
def cfds_simulate_discrete(req: CfdsDiscreteSimulateRequest, _session: str = Depends(require_session)):
    return simulate_discrete_mode(req)


@router.post("/channels/configure")
def cfds_configure_channel(req: CfdsChannelConfigRequest, _session: str = Depends(require_session)):
    try:
        return configure_cfds_channel(req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
