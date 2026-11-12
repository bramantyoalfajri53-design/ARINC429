"""Business logic service for Standard Mode connected to the shared ARINC 429 coordinator."""

from __future__ import annotations

from typing import Any

from core.arinc429 import encode_arinc429_word
from core.runtime import arinc_coordinator

from .schemas import StandardModeMetadata, StandardTxSlotModel


def get_module_metadata() -> StandardModeMetadata:
    return StandardModeMetadata()


def get_standard_state() -> dict[str, Any]:
    """Return Standard Mode view backed by the shared ARINC 429 coordinator."""
    snap = arinc_coordinator.snapshot()
    return {
        "mode": "STANDARD",
        "source": snap["source"],
        "simulation_mode": snap["simulation_mode"],
        "bus_running": snap["bus_running"],
        "active_mode": snap["active_mode"],
        "channels": snap["channels"],
        "rx_history": arinc_coordinator.get_rx_history("STANDARD"),
    }


def transmit_standard_slot(channel: str, slot: StandardTxSlotModel) -> dict[str, Any]:
    """Ensure STANDARD ownership and dispatch a configured TX slot over the shared bus."""
    arinc_coordinator.acquire_mode("STANDARD")
    data_19 = int(slot.data, 16) & 0x7FFFF
    raw = encode_arinc429_word(
        label_oct=slot.label,
        sdi=slot.sdi,
        data_19bit=data_19,
        ssm=slot.ssm,
        parity=slot.parity,
    )
    tx_result = arinc_coordinator.transmit_word(
        mode="STANDARD",
        channel=channel,
        raw_word=raw,
        detail=f"STD Slot {slot.slot}: Label {slot.label} Data={slot.data.upper()} SSM={slot.ssm}",
        expected_parity=slot.parity,
    )
    return {
        **tx_result,
        "slot": slot.slot,
    }
