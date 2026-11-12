"""API router boundary for CFDS operating mode."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from core.dependencies import require_session

from .service import get_module_metadata

router = APIRouter(prefix="/api/cfds", tags=["cfds"])


@router.get("/status")
def cfds_status(_session: str = Depends(require_session)):
    return get_module_metadata().model_dump()
