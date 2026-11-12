"""Shared core HTTP and WebSocket routers."""

from .arinc429 import router as arinc429_router
from .auth import router as auth_router
from .control import router as control_router
from .telemetry import router as telemetry_router

__all__ = ["arinc429_router", "auth_router", "control_router", "telemetry_router"]

