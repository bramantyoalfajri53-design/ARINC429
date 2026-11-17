"""Shared runtime singletons (instrument broker, control lease, lifespan)."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException

from ate_power.broker import InstrumentBroker
from ate_power.lease import ControlLease

from .arinc429 import Arinc429Coordinator

broker = InstrumentBroker(simulation_mode=False)
arinc_coordinator = Arinc429Coordinator()
lease = ControlLease()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Start and stop the single-owner instrument broker and ARINC 429 coordinator."""
    broker.start()
    arinc_coordinator.start_hardware()
    yield
    arinc_coordinator.stop_hardware()
    broker.stop()


def broker_cmd(cmd_type: str, *args: Any) -> None:
    """Submit a synchronous command to the instrument broker."""
    try:
        broker.run_cmd(cmd_type, *args)
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc

