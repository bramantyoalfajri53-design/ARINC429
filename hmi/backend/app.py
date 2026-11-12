"""ATE Power HMI HTTP/WebSocket application composition root."""

from __future__ import annotations

import logging

from fastapi import FastAPI

from core.config import FRONTEND_DIST
from core.dependencies import require_control, require_session
from core.routers import arinc429_router, auth_router, control_router, telemetry_router
from core.runtime import arinc_coordinator, broker, broker_cmd, lease, lifespan
from core.spa import register_spa
from features.cfds import router as cfds_router
from features.cmc import router as cmc_router
from features.power import router as power_router
from features.standard import router as standard_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ate_power.app")

app = FastAPI(title="ATE Power & ARINC 429 HMI", version="1.1.0", lifespan=lifespan)

app.include_router(auth_router)
app.include_router(control_router)
app.include_router(telemetry_router)
app.include_router(arinc429_router)
app.include_router(power_router)
app.include_router(standard_router)
app.include_router(cfds_router)
app.include_router(cmc_router)

register_spa(app)

__all__ = [
    "FRONTEND_DIST",
    "app",
    "arinc_coordinator",
    "broker",
    "broker_cmd",
    "lease",
    "lifespan",
    "logger",
    "require_control",
    "require_session",
]
