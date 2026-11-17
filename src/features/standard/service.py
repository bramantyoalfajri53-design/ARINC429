"""Business logic service for Standard Mode connected to the shared ARINC 429 coordinator."""

from __future__ import annotations

import re
from typing import Any

from core.arinc429 import encode_arinc429_word
from core.runtime import arinc_coordinator

from .lru_registry import LRU_REGISTRY, get_lru_definitions, get_lru_detail
from .schemas import (
    LruSingleModeTransmitRequest,
    StandardModeMetadata,
    StandardTxSlotModel,
)


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
        "lrus": get_lru_definitions(),
    }


def transmit_standard_slot(channel: str, slot: StandardTxSlotModel) -> dict[str, Any]:
    """Ensure STANDARD ownership and dispatch a configured TX slot over the shared bus."""
    arinc_coordinator.acquire_mode("STANDARD")
    try:
        data_19 = int(slot.data, 16) & 0x7FFFF
    except ValueError:
        data_19 = 0

    ssm_val = "NO" if slot.ssm == "NML" else slot.ssm

    raw = encode_arinc429_word(
        label_oct=slot.label,
        sdi=slot.sdi,
        data_19bit=data_19,
        ssm=ssm_val,
        parity=slot.parity,
    )
    tx_result = arinc_coordinator.transmit_word(
        mode="STANDARD",
        channel=channel,
        raw_word=raw,
        detail=f"STD Slot {slot.slot}: Label {slot.label} Data={slot.data} SSM={slot.ssm}",
        expected_parity=slot.parity,
    )
    return {
        **tx_result,
        "slot": slot.slot,
    }


def encode_lru_data_and_pad(req: LruSingleModeTransmitRequest) -> tuple[int, str]:
    """Encode LRU-specific data string and PAD bits into 19-bit payload (bits 11-29).

    Returns (payload_19bit, ssm_str).
    """
    pad_str = req.pad.strip()
    lru_key = req.lru_id.strip().upper()

    # Determine 2-bit SSM
    ssm_map = {"NML": "NO", "NO": "NO", "NCD": "NCD", "FT": "FT", "FW": "FW"}
    ssm_str = ssm_map.get(req.ssm.upper(), "NO")

    if lru_key == "DME":
        # bits 11-17: PAD / Mode bits (7 bits)
        # bits 18-29: BCD frequency (12 bits)
        # Parse PAD bitstring (default 7 bits)
        pad_bits = int(pad_str, 2) & 0x7F if pad_str else 0b1100001
        
        # Parse data frequency (e.g. "108.00 MHZ" or numeric float)
        m = re.search(r"(\d+(\.\d+)?)", req.data)
        freq_mhz = float(m.group(1)) if m else 108.00
        
        # ARINC 709 DME frequency word (Label 035):
        # 100 MHz tens & units, tenths, hundredths
        # e.g. 108.00 -> 108.00 MHz
        freq_int = int(round(freq_mhz * 100))
        tens = (freq_int // 1000) % 10
        units = (freq_int // 100) % 10
        tenths = (freq_int // 10) % 10
        hundredths = (freq_int % 10) // 5  # 50 kHz step (0 or 5)
        
        bcd_freq = ((tens & 0x3) << 10) | ((units & 0xF) << 6) | ((tenths & 0xF) << 2) | (hundredths & 0x3)
        payload_19 = (bcd_freq << 7) | pad_bits
        return payload_19 & 0x7FFFF, ssm_str

    # Generic LRU encoder (VOR, ILS, ADF, MMR, etc.)
    pad_bits = int(pad_str, 2) if (pad_str and all(c in "01" for c in pad_str)) else 0
    m = re.search(r"(\d+(\.\d+)?)", req.data)
    if m:
        num_val = int(round(float(m.group(1))))
        payload_19 = ((num_val & 0xFFF) << len(pad_str)) | (pad_bits & 0x7F)
    else:
        payload_19 = pad_bits & 0x7FFFF

    return payload_19 & 0x7FFFF, ssm_str


def transmit_lru_single_mode(req: LruSingleModeTransmitRequest) -> dict[str, Any]:
    """Transmit LRU Single Channel Mode word with validation and registration."""
    arinc_coordinator.acquire_mode("STANDARD")
    lru_key = req.lru_id.strip().upper()
    if lru_key not in LRU_REGISTRY:
        raise ValueError(f"Unknown LRU ID: {req.lru_id}")

    payload_19, ssm_str = encode_lru_data_and_pad(req)

    raw = encode_arinc429_word(
        label_oct=req.label,
        sdi=req.sdi,
        data_19bit=payload_19,
        ssm=ssm_str,
        parity=req.parity,
    )

    detail_str = (
        f"STD-LRU [{req.lru_id}] Slot {req.slot}: "
        f"{req.function} Label={req.label} Data={req.data} PAD={req.pad} "
        f"SDI={req.sdi} SSM={req.ssm} Rate={req.rate}ms"
    )

    tx_result = arinc_coordinator.transmit_word(
        mode="STANDARD",
        channel=req.channel,
        raw_word=raw,
        detail=detail_str,
        expected_parity=req.parity,
    )

    # In simulator mode, generate corresponding RX response for DME or other LRUs
    rx_sim = simulate_lru_rx(req)

    return {
        **tx_result,
        "lru_id": req.lru_id,
        "slot": req.slot,
        "function": req.function,
        "data_eng": req.data,
        "pad": req.pad,
        "payload_19": f"0x{payload_19:05X}",
        "rx_simulation": rx_sim,
    }


def simulate_lru_rx(req: LruSingleModeTransmitRequest) -> dict[str, Any]:
    """Generate simulated RX reply matching Aeroflex T1200B Single Channel screen."""
    lru_key = req.lru_id.strip().upper()
    if lru_key == "DME":
        return {
            "channel": "RX-A",
            "function": "DME DIST",
            "label": "202",
            "data": "43.01 NM",
            "sdi": req.sdi,
            "pad": "0000000",
            "ssm": "NML",
            "parity": "ODD",
            "rate": 100,
            "bnr_dist": "43.01 NM",
            "bcd_dist": "43.01 NM",
            "speed_kts": "0 KTS",
            "reply_eff": "70%",
            "rf_level": "-00 dBM",
            "status": "VALID",
        }
    return {
        "channel": "RX-A",
        "function": f"{lru_key} REPLY",
        "label": "000",
        "data": req.data,
        "sdi": req.sdi,
        "pad": req.pad,
        "ssm": "NML",
        "parity": "ODD",
        "rate": 100,
        "status": "VALID",
    }
