"""Business logic service for Boeing CMC Mode via shared ARINC 429 coordinator."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from core.arinc429 import (
    decode_cmc_fault_summary_word,
    decode_iso5_pair_356,
    encode_cmc_command_227,
    encode_cmc_fault_summary_word,
    encode_iso5_pair_356,
)
from core.runtime import arinc_coordinator

from .schemas import (
    CmcCommandSummaryRequest,
    CmcConfigDataRequest,
    CmcFunctionName,
    CmcLruSelectRequest,
    CmcModeMetadata,
    CmcShopFaultsRequest,
)

CMC_FUNCTION_CODES: dict[CmcFunctionName, int] = {
    "NO REQUEST": 0,
    "BITE TEST (IN-FLIGHT)": 1,
    "SHOP FAULTS": 2,
    "NEW FLIGHT LEG": 3,
    "LOGOFF / TERMINATE": 4,
    "CONFIG DATA REQUEST": 5,
}

FAULT_BIT_LABELS: list[tuple[int, str]] = [
    (11, "INTERNAL MEMORY FAULT"),
    (12, "PROCESSOR SELF-TEST FAIL"),
    (13, "ARINC 429 BUS RX ABNORMAL"),
    (14, "ANALOG I/O CALIBRATION ERR"),
    (15, "POWER TRANSIENT / GLITCH"),
    (16, "WATCHDOG TIMEOUT ERROR"),
    (17, "INTERFACE CONNECTOR INTEGRITY"),
    (18, "SECONDARY HARDWARE FAULT"),
    (19, "DISCRETE INTERFACE INOP"),
    (20, "COOLING FAN / OVERHEAT"),
    (21, "SENSOR CALIBRATION DRIFT"),
    (22, "LRU SYSTEM INHIBITED"),
    (23, "CRC CHECKSUM MISMATCH"),
    (24, "CONFIGURATION STRAP INVALID"),
    (25, "LRU GENERAL FAILURE"),
    (26, "LINE REPLACEABLE MODULE FAIL"),
    (27, "MAINTENANCE ADVISORY ACTIVE"),
    (28, "INTERMITTENT FAULT RECORDED"),
]


@dataclass
class CmcRuntimeState:
    selected_lru: dict[str, str] = field(
        default_factory=lambda: {
            "id": "AIMS",
            "name": "Airplane Information Management System",
            "code": "0x1A",
        }
    )
    selected_function: CmcFunctionName = "BITE TEST (IN-FLIGHT)"
    ground_test_en: bool = True
    inflight_test_en: bool = True
    tx_rate_ms: int = 200
    rx_timeout_secs: int = 12
    active_fault_bits: list[int] = field(default_factory=list)
    bit_29_ack: bool = True
    config_data: dict[str, Any] = field(
        default_factory=lambda: {
            "status": "IDLE",
            "message": "READY TO REQUEST CONFIGURATION DATA",
            "valid": False,
            "source": "SIMULATION",
            "part_number": "",
            "sw_version": "",
            "hw_mod": "",
            "raw_words_hex": [],
        }
    )
    shop_faults: dict[str, Any] = field(
        default_factory=lambda: {
            "status": "IDLE",
            "message": "READY TO REQUEST SHOP FAULTS",
            "valid": False,
            "source": "SIMULATION",
            "records": [],
            "ordered_words": [],
        }
    )


_cmc_lock = threading.RLock()
_cmc_state = CmcRuntimeState()


def get_module_metadata() -> CmcModeMetadata:
    return CmcModeMetadata()


def _now_str() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")


def _encode_ascii_stream_356(text: str) -> list[int]:
    """Encode a maintenance string into ordered 32-bit ARINC 429 Label 356 words (2 chars/word)."""
    words: list[int] = []
    padded = text if len(text) % 2 == 0 else text + " "
    for idx in range(0, len(padded), 2):
        seq = (idx // 2) + 1
        words.append(encode_iso5_pair_356(padded[idx], padded[idx + 1], seq_ctrl=seq))
    return words


def _decode_ascii_stream_356(words: list[int]) -> tuple[str, list[dict[str, Any]]]:
    """Decode ordered Label 356 words preserving word index and ISO #5 characters."""
    chars: list[str] = []
    ordered_meta: list[dict[str, Any]] = []
    for pos, raw in enumerate(words, start=1):
        c1, c2, seq = decode_iso5_pair_356(raw)
        chars.extend([c1, c2])
        ordered_meta.append(
            {
                "word_order": pos,
                "seq_ctrl": seq,
                "raw_hex": f"{raw:08X}",
                "chars": f"{c1}{c2}",
            }
        )
    return "".join(chars).strip(), ordered_meta


def get_cmc_state() -> dict[str, Any]:
    with _cmc_lock:
        snap = arinc_coordinator.snapshot()
        raw_350 = encode_cmc_fault_summary_word(
            "350",
            active_fault_bits=_cmc_state.active_fault_bits,
            command_ack=_cmc_state.bit_29_ack,
        )
        raw_351 = encode_cmc_fault_summary_word(
            "351",
            active_fault_bits=[],
            command_ack=_cmc_state.bit_29_ack,
        )
        decoded_350 = decode_cmc_fault_summary_word(raw_350)
        decoded_351 = decode_cmc_fault_summary_word(raw_351)

        fault_bits_view = [
            {"bit": b, "label": lbl, "fault": b in _cmc_state.active_fault_bits}
            for b, lbl in FAULT_BIT_LABELS
        ]

        return {
            "mode": "CMC",
            "source": snap["source"],
            "simulation_mode": snap["simulation_mode"],
            "active_mode": snap["active_mode"],
            "bus_running": snap["bus_running"],
            "channels": snap["channels"],
            "selected_lru": _cmc_state.selected_lru,
            "command_summary": {
                "function": _cmc_state.selected_function,
                "function_code": CMC_FUNCTION_CODES[_cmc_state.selected_function],
                "ground_test_en": _cmc_state.ground_test_en,
                "inflight_test_en": _cmc_state.inflight_test_en,
                "tx_rate_ms": _cmc_state.tx_rate_ms,
                "rx_timeout_secs": _cmc_state.rx_timeout_secs,
            },
            "fault_summary": {
                "word_350": decoded_350,
                "word_351": decoded_351,
                "bit_29_ack": _cmc_state.bit_29_ack,
                "bits": fault_bits_view,
            },
            "config_data": _cmc_state.config_data,
            "shop_faults": _cmc_state.shop_faults,
            "rx_history": arinc_coordinator.get_rx_history("CMC"),
        }


def select_cmc_lru(req: CmcLruSelectRequest) -> dict[str, Any]:
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")
        _cmc_state.selected_lru = {
            "id": req.lru_id,
            "name": req.name,
            "code": req.code,
        }
        arinc_coordinator.log_event(
            "CMC",
            f"Selected Boeing LRU {req.lru_id} ({req.code})",
        )
        return get_cmc_state()


def send_cmc_command_summary(req: CmcCommandSummaryRequest) -> dict[str, Any]:
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")
        _cmc_state.selected_function = req.function
        _cmc_state.ground_test_en = req.ground_test_en
        _cmc_state.inflight_test_en = req.inflight_test_en

        fn_code = CMC_FUNCTION_CODES[req.function]
        raw_227 = encode_cmc_command_227(
            sensor_code_hex=req.sensor_code,
            function_code=fn_code,
            ground_test_enable=req.ground_test_en,
            inflight_test_enable=req.inflight_test_en,
        )
        arinc_coordinator.transmit_word(
            "CMC",
            req.channel,
            raw_227,
            detail=f"CMC Label 227 FN={req.function} GND={req.ground_test_en} AIR={req.inflight_test_en}",
        )
        return get_cmc_state()


def update_cmc_fault_bit(bit: int, fault: bool, command_ack: bool | None = None) -> dict[str, Any]:
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")
        bits = set(_cmc_state.active_fault_bits)
        if fault:
            bits.add(bit)
        else:
            bits.discard(bit)
        _cmc_state.active_fault_bits = sorted(bits)
        if command_ack is not None:
            _cmc_state.bit_29_ack = command_ack

        raw_350 = encode_cmc_fault_summary_word(
            "350",
            active_fault_bits=_cmc_state.active_fault_bits,
            command_ack=_cmc_state.bit_29_ack,
        )
        arinc_coordinator.record_rx_word(
            "CMC",
            "RX-B",
            raw_350,
            detail=f"Label 350 Fault Summary updated: active={_cmc_state.active_fault_bits} Bit29ACK={_cmc_state.bit_29_ack}",
        )
        return get_cmc_state()


def request_cmc_config_data(req: CmcConfigDataRequest) -> dict[str, Any]:
    """Send Label 227 CONFIG DATA REQUEST and handle manual ACK / Maintenance Data / 12s Timeout rules."""
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")
        raw_227 = encode_cmc_command_227(
            sensor_code_hex=_cmc_state.selected_lru["code"],
            function_code=CMC_FUNCTION_CODES["CONFIG DATA REQUEST"],
            ground_test_enable=_cmc_state.ground_test_en,
            inflight_test_enable=_cmc_state.inflight_test_en,
        )
        arinc_coordinator.transmit_word(
            "CMC",
            req.channel,
            raw_227,
            detail=f"CMC CONFIG DATA REQUEST to {_cmc_state.selected_lru['id']}",
        )

        src = arinc_coordinator.data_source
        if src == "HARDWARE":
            _cmc_state.bit_29_ack = False
            _cmc_state.config_data = {
                "status": "NO_RESPONSE",
                "message": "NO LRU RESPONSE IN 12 SECS",
                "valid": False,
                "source": "HARDWARE",
                "part_number": "",
                "sw_version": "",
                "hw_mod": "",
                "raw_words_hex": [],
            }
            arinc_coordinator.log_event(
                "CMC",
                "HARDWARE: NO LRU RESPONSE IN 12 SECS (physical LRU not replying on Label 350/356)",
                direction="RX",
                channel="RX-B",
                label="356",
            )
            return get_cmc_state()

        # SIMULATION outcomes explicitly tagged with source="SIMULATION"
        sim = req.simulate_mode
        if sim == "NO_ACK":
            _cmc_state.bit_29_ack = False
            _cmc_state.config_data = {
                "status": "ERROR",
                "message": "NO COMMAND WORD ACK RCVD",
                "valid": False,
                "source": "SIMULATION",
                "part_number": "",
                "sw_version": "",
                "hw_mod": "",
                "raw_words_hex": [],
            }
            arinc_coordinator.log_event("CMC", "SIMULATION: NO COMMAND WORD ACK RCVD", direction="RX", label="350")
            return get_cmc_state()

        if sim == "NO_MAINTENANCE_DATA":
            _cmc_state.bit_29_ack = True
            _cmc_state.config_data = {
                "status": "ERROR",
                "message": "NO MAINTENANCE DATA RECEIVED",
                "valid": False,
                "source": "SIMULATION",
                "part_number": "",
                "sw_version": "",
                "hw_mod": "",
                "raw_words_hex": [],
            }
            arinc_coordinator.log_event("CMC", "SIMULATION: NO MAINTENANCE DATA RECEIVED (Label 356 empty)", direction="RX", label="356")
            return get_cmc_state()

        if sim == "TIMEOUT_12S":
            _cmc_state.bit_29_ack = False
            _cmc_state.config_data = {
                "status": "TIMEOUT",
                "message": "NO LRU RESPONSE IN 12 SECS",
                "valid": False,
                "source": "SIMULATION",
                "part_number": "",
                "sw_version": "",
                "hw_mod": "",
                "raw_words_hex": [],
            }
            arinc_coordinator.log_event("CMC", "SIMULATION: NO LRU RESPONSE IN 12 SECS", direction="RX", label="356")
            return get_cmc_state()

        # SUCCESS in SIMULATION
        _cmc_state.bit_29_ack = True
        lru_id = _cmc_state.selected_lru["id"]
        payload_text = f"PN:4059000-902|{lru_id}|SW:OPS-V4.2|HW:MOD-C"
        words = _encode_ascii_stream_356(payload_text)
        for w in words:
            arinc_coordinator.record_rx_word("CMC", "RX-A", w, detail="SIMULATION Label 356 Config Word", source_override="SIMULATION")
        decoded_text, ordered = _decode_ascii_stream_356(words)
        _cmc_state.config_data = {
            "status": "VALID",
            "message": f"SIMULATION CONFIG DATA RECEIVED ({_now_str()})",
            "valid": True,
            "source": "SIMULATION",
            "part_number": "4059000-902",
            "sw_version": "OPS-V4.2",
            "hw_mod": "MOD-C",
            "decoded_text": decoded_text,
            "raw_words_hex": [item["raw_hex"] for item in ordered],
        }
        return get_cmc_state()


def request_cmc_shop_faults(req: CmcShopFaultsRequest) -> dict[str, Any]:
    """Send Label 227 SHOP FAULTS request and assemble ordered Label 356 Shop Fault words."""
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")
        raw_227 = encode_cmc_command_227(
            sensor_code_hex=_cmc_state.selected_lru["code"],
            function_code=CMC_FUNCTION_CODES["SHOP FAULTS"],
            ground_test_enable=_cmc_state.ground_test_en,
            inflight_test_enable=_cmc_state.inflight_test_en,
        )
        arinc_coordinator.transmit_word(
            "CMC",
            req.channel,
            raw_227,
            detail=f"CMC SHOP FAULTS REQUEST to {_cmc_state.selected_lru['id']}",
        )

        src = arinc_coordinator.data_source
        if src == "HARDWARE":
            _cmc_state.shop_faults = {
                "status": "TIMEOUT",
                "message": "NO LRU RESPONSE IN 12 SECS",
                "valid": False,
                "source": "HARDWARE",
                "records": [],
                "ordered_words": [],
            }
            return get_cmc_state()

        sim = req.simulate_mode
        if sim == "NO_ACK":
            _cmc_state.bit_29_ack = False
            _cmc_state.shop_faults = {
                "status": "ERROR",
                "message": "NO COMMAND WORD ACK RCVD",
                "valid": False,
                "source": "SIMULATION",
                "records": [],
                "ordered_words": [],
            }
            return get_cmc_state()

        if sim == "NO_MAINTENANCE_DATA":
            _cmc_state.bit_29_ack = True
            _cmc_state.shop_faults = {
                "status": "ERROR",
                "message": "NO MAINTENANCE DATA RECEIVED",
                "valid": False,
                "source": "SIMULATION",
                "records": [],
                "ordered_words": [],
            }
            return get_cmc_state()

        if sim == "TIMEOUT_12S":
            _cmc_state.bit_29_ack = False
            _cmc_state.shop_faults = {
                "status": "TIMEOUT",
                "message": "NO LRU RESPONSE IN 12 SECS",
                "valid": False,
                "source": "SIMULATION",
                "records": [],
                "ordered_words": [],
            }
            return get_cmc_state()

        _cmc_state.bit_29_ack = True
        lru_id = _cmc_state.selected_lru["id"]
        fault_msg = f"FL01:{lru_id}-RAM-PARITY|FL02:{lru_id}-CLK-DRIFT"
        words = _encode_ascii_stream_356(fault_msg)
        for w in words:
            arinc_coordinator.record_rx_word("CMC", "RX-A", w, detail="SIMULATION Label 356 Shop Fault Word", source_override="SIMULATION")
        decoded_text, ordered = _decode_ascii_stream_356(words)
        _cmc_state.shop_faults = {
            "status": "VALID",
            "message": f"SIMULATION SHOP FAULTS RECEIVED ({len(words)} WORDS)",
            "valid": True,
            "source": "SIMULATION",
            "decoded_text": decoded_text,
            "records": [
                {
                    "leg": "FL-01",
                    "code": f"{lru_id}-RAM-PARITY",
                    "severity": "CLASS 1",
                    "description": "Internal SRAM parity mismatch during power-up BITE",
                },
                {
                    "leg": "FL-02",
                    "code": f"{lru_id}-CLK-DRIFT",
                    "severity": "CLASS 2",
                    "description": "100 kbps oscillator frequency drift threshold warning",
                },
            ],
            "ordered_words": ordered,
        }
        return get_cmc_state()
