"""Business logic service for CFDS Mode via shared ARINC 429 coordinator."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from core.arinc429 import encode_arinc429_word
from core.runtime import arinc_coordinator

from .schemas import (
    CfdsBiteCommandRequest,
    CfdsChannelConfigRequest,
    CfdsDiscreteSimulateRequest,
    CfdsLruSelectRequest,
    CfdsModeMetadata,
    CfdsNormalSimulateRequest,
    CfdsTxParamsRequest,
)

# Manual Figure 58 (pp. 1-4-100) Label 356 simulation bursts
FIGURE_58_TEST_BURST: list[dict[str, Any]] = [
    {"slot": 10, "label": "356", "dataHex": "02720A", "desc": "STX (Block Length: 10 Words)"},
    {"slot": 9, "label": "356", "dataHex": "202020", "desc": "DATA ('   ')"},
    {"slot": 8, "label": "356", "dataHex": "202020", "desc": "DATA ('   ')"},
    {"slot": 7, "label": "356", "dataHex": "41634A", "desc": "DATA ('JcA')"},
    {"slot": 6, "label": "356", "dataHex": "205249", "desc": "DATA ('IR ')"},
    {"slot": 5, "label": "356", "dataHex": "C3202D", "desc": "DATA ('- C' + parity bit 32)"},
    {"slot": 4, "label": "356", "dataHex": "534446", "desc": "DATA ('FDS')"},
    {"slot": 3, "label": "356", "dataHex": "455420", "desc": "DATA (' TE')"},
    {"slot": 2, "label": "356", "dataHex": "A05453", "desc": "DATA ('ST ' + parity bit 32)"},
    {"slot": 1, "label": "356", "dataHex": "040000", "desc": "EOT (End of Transmission)"},
]

FIGURE_58_COUNT_ERR_BURST: list[dict[str, Any]] = [
    {"slot": 10, "label": "356", "dataHex": "027209", "desc": "STX (Erroneous Length: 9 Words)"},
    *FIGURE_58_TEST_BURST[1:-1],
    {"slot": 1, "label": "356", "dataHex": "040000", "desc": "EOT (Word 10 of 10 - Mismatch!)"},
]

DEFAULT_AIRCRAFT_CONFIG: dict[str, bool] = {
    "printer": False,
    "link": False,
    "aids": False,
    "rmp3": False,
    "vhf3": False,
    "hf1": False,
    "hf2": False,
    "adf2": False,
    "mls1": False,
    "mls2": False,
    "wbs1": False,
    "radar2": False,
    "tpis": False,
    "aftCrgHt": False,
    "fwdCrgHt": False,
    "crgSmoke": False,
    "wbs2": False,
}


@dataclass
class CfdsRuntimeState:
    selected_lru: dict[str, str] = field(
        default_factory=lambda: {
            "code": "735",
            "name": "TCAS",
            "description": "Traffic Alert & Collision Avoidance System",
        }
    )
    tx_params: dict[str, Any] = field(
        default_factory=lambda: {
            "date": "111126",
            "time": "120000",
            "flightNumber": "GA402",
            "cityPairs": "CGKDPS",
            "aircraftId": "N12345",
            "flightPhase": 0,
        }
    )
    aircraft_config: dict[str, bool] = field(default_factory=lambda: dict(DEFAULT_AIRCRAFT_CONFIG))
    last_tx_command: dict[str, Any] | None = None
    normal_rx: dict[str, Any] = field(
        default_factory=lambda: {
            "status": "WAITING",
            "source": "SIMULATION",
            "decoded_text": "",
            "error": None,
            "words": [],
        }
    )
    discrete_rx: dict[str, Any] = field(
        default_factory=lambda: {
            "status": "WAITING",
            "source": "SIMULATION",
            "records": [],
        }
    )


_cfds_lock = threading.RLock()
_cfds_state = CfdsRuntimeState()


def get_module_metadata() -> CfdsModeMetadata:
    return CfdsModeMetadata()


def _now_time() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%H:%M:%S")


def encode_cfds_bite_word(
    equipment_code: str,
    command_code: int,
    sdi: int = 0,
    ready: bool = False,
    bit12: bool = False,
) -> tuple[int, str]:
    """
    Encode CFDS Label 227 BITE Command Word using protected core encode_arinc429_word.

    ARINC 429 layout per Aeroflex JcAIR T1200B Manual Section 4.F:
    - Bits 1-8:   Label 227 (LSB-first wire 0xE9 via encode_arinc429_word)
    - Bits 9-10:  SDI
    - Bit  11:    READY flag (data bit 0)
    - Bit  12:    CLR/SHFT+CLR flag (data bit 1)
    - Bits 13-24: 12-bit Hex Equipment Code (data bits 2..13)
    - Bits 25-29: Command Code low 5 bits (data bits 14..18)
    - Bits 30-31: Command Code bits 5..6 mapped to SSM
    - Bit  32:    ODD Parity
    """
    eq_val = int(equipment_code, 16) & 0xFFF
    cmd_val = int(command_code) & 0x7F
    sdi_val = int(sdi) & 0b11
    data_19bit = (
        ((cmd_val & 0x1F) << 14)
        | (eq_val << 2)
        | ((1 if bit12 else 0) << 1)
        | (1 if ready else 0)
    )
    ssm_val = (cmd_val >> 5) & 0b11
    raw_word = encode_arinc429_word(
        "227",
        sdi=sdi_val,
        data_19bit=data_19bit,
        ssm=ssm_val,
        parity="ODD",
    )
    return raw_word, f"0x{raw_word:08X}"


def decode_label356_slot_word(data_hex: str) -> str:
    """Decode 3 packed 7-bit ASCII bytes from 24-bit Label 356 data word (bits 32..9)."""
    padded = data_hex.strip().upper().zfill(6)
    b1 = int(padded[4:6], 16) & 0x7F
    b2 = int(padded[2:4], 16) & 0x7F
    b3 = int(padded[0:2], 16) & 0x7F
    return "".join(chr(code) for code in (b1, b2, b3) if 32 <= code <= 126)


def parse_label356_burst(burst: list[dict[str, Any]], source: str = "SIMULATION") -> dict[str, Any]:
    """Validate STX/EOT, word count, and ASCII content of a Label 356 burst (Figure 58)."""
    if not burst:
        return {"valid": False, "source": source, "text": "", "error": "NO_DATA", "errorMessage": "NO DATA"}
    stx = burst[0]
    eot = burst[-1]
    stx_hex = str(stx["dataHex"]).upper().zfill(6)
    eot_hex = str(eot["dataHex"]).upper().zfill(6)
    if int(stx_hex[0:2], 16) != 0x02:
        return {"valid": False, "source": source, "text": "", "error": "INVALID_STX", "errorMessage": "INVALID STX WORD"}
    expected_count = int(stx_hex[4:6], 16)
    actual_count = len(burst)
    if expected_count != actual_count:
        return {
            "valid": False,
            "source": source,
            "text": "",
            "error": "BLOCK_WORD_COUNT_ERR",
            "errorMessage": f"BLOCK WORD COUNT ERR (EXP {expected_count}, ACT {actual_count})",
            "expectedWordCount": expected_count,
            "actualWordCount": actual_count,
        }
    if int(eot_hex[0:2], 16) != 0x04:
        return {"valid": False, "source": source, "text": "", "error": "INVALID_EOT", "errorMessage": "INVALID EOT WORD"}
    decoded = "".join(decode_label356_slot_word(str(w["dataHex"])) for w in burst[1:-1]).strip()
    return {
        "valid": True,
        "source": source,
        "text": decoded,
        "expectedWordCount": expected_count,
        "actualWordCount": actual_count,
    }


def get_cfds_state() -> dict[str, Any]:
    with _cfds_lock:
        snap = arinc_coordinator.snapshot()
        return {
            "mode": "CFDS",
            "source": snap["source"],
            "simulation_mode": snap["simulation_mode"],
            "active_mode": snap["active_mode"],
            "bus_running": snap["bus_running"],
            "global_speed": snap["global_speed"],
            "channels": snap["channels"],
            "selected_lru": dict(_cfds_state.selected_lru),
            "tx_params": dict(_cfds_state.tx_params),
            "aircraft_config": dict(_cfds_state.aircraft_config),
            "last_tx_command": _cfds_state.last_tx_command,
            "normal_rx": dict(_cfds_state.normal_rx),
            "discrete_rx": dict(_cfds_state.discrete_rx),
            "rx_history": arinc_coordinator.get_rx_history("CFDS"),
        }


def select_cfds_lru(req: CfdsLruSelectRequest) -> dict[str, Any]:
    with _cfds_lock:
        arinc_coordinator.acquire_mode("CFDS")
        code = req.code.upper()
        name = req.name.strip()
        desc = req.description.strip() or f"Custom Avionics LRU (Hex Code 0x{code})"
        _cfds_state.selected_lru = {"code": code, "name": name, "description": desc}
        arinc_coordinator.log_event("CFDS", f"Selected CFDS LRU {name} (0x{code})")
        return get_cfds_state()


def update_cfds_tx_params(req: CfdsTxParamsRequest) -> dict[str, Any]:
    with _cfds_lock:
        arinc_coordinator.acquire_mode("CFDS")
        _cfds_state.tx_params = {
            "date": req.date.strip(),
            "time": req.time.strip(),
            "flightNumber": req.flightNumber.strip().upper(),
            "cityPairs": req.cityPairs.strip().upper(),
            "aircraftId": req.aircraftId.strip().upper(),
            "flightPhase": req.flightPhase,
        }
        if req.aircraftConfig is not None:
            _cfds_state.aircraft_config = req.aircraftConfig.model_dump()
        arinc_coordinator.log_event(
            "CFDS",
            f"Updated TX parameters (Date={_cfds_state.tx_params['date']}, A/C={_cfds_state.tx_params['aircraftId']}, Phase={req.flightPhase})",
        )
        return get_cfds_state()


def send_cfds_bite_command(req: CfdsBiteCommandRequest) -> dict[str, Any]:
    with _cfds_lock:
        arinc_coordinator.acquire_mode("CFDS")
        eq = req.equipment_code.upper()
        raw_word, hex_32 = encode_cfds_bite_word(
            equipment_code=eq,
            command_code=req.command_code,
            sdi=req.sdi,
            ready=req.ready,
            bit12=req.bit12,
        )
        action_desc = req.action_label.strip() or f"{req.submode} CMD 0x{req.command_code:02X}"
        tx_res = arinc_coordinator.transmit_word(
            mode="CFDS",
            channel=req.channel,
            raw_word=raw_word,
            detail=f"CFDS {action_desc} EQ=0x{eq} CMD=0x{req.command_code:02X} BIT12={int(req.bit12)} RDY={int(req.ready)}",
        )
        _cfds_state.last_tx_command = {
            "submode": req.submode,
            "action_label": action_desc,
            "equipment_code": eq,
            "command_code": req.command_code,
            "command_hex": f"0x{req.command_code:02X}",
            "sdi": req.sdi,
            "ready": req.ready,
            "bit12": req.bit12,
            "channel": req.channel,
            "raw_word": raw_word,
            "raw_hex": hex_32,
            "source": tx_res["source"],
            "timestamp": tx_res["timestamp"],
        }
        state = get_cfds_state()
        state["tx_word"] = tx_res
        return state


def simulate_normal_mode(req: CfdsNormalSimulateRequest) -> dict[str, Any]:
    with _cfds_lock:
        arinc_coordinator.acquire_mode("CFDS")
        if req.scenario == "CLEAR":
            _cfds_state.normal_rx = {
                "status": "WAITING",
                "source": arinc_coordinator.data_source,
                "decoded_text": "",
                "error": None,
                "words": [],
            }
            arinc_coordinator.log_event("CFDS", "Cleared Normal Mode Label 356 buffer")
            return get_cfds_state()

        burst = FIGURE_58_TEST_BURST if req.scenario == "FIGURE_58_PASS" else FIGURE_58_COUNT_ERR_BURST
        parsed = parse_label356_burst(burst, source="SIMULATION")
        # Wire label 356 octal (0xEE) reversed LSB-first = 0x77
        for slot_word in burst:
            raw_32 = ((int(str(slot_word["dataHex"]), 16) & 0xFFFFFF) << 8) | 0x77
            arinc_coordinator.record_rx_word(
                mode="CFDS",
                channel=req.channel,
                raw_word=raw_32,
                detail=f"[SIM] Label 356 Slot {slot_word['slot']}: {slot_word['desc']}",
                source_override="SIMULATION",
            )
        _cfds_state.normal_rx = {
            "status": "DATA_ACTIVE" if parsed["valid"] else "ERROR",
            "source": "SIMULATION",
            "decoded_text": parsed.get("text", ""),
            "error": parsed.get("errorMessage"),
            "words": burst,
        }
        return get_cfds_state()


def simulate_discrete_mode(req: CfdsDiscreteSimulateRequest) -> dict[str, Any]:
    with _cfds_lock:
        arinc_coordinator.acquire_mode("CFDS")
        if req.scenario == "CLEAR":
            _cfds_state.discrete_rx = {
                "status": "WAITING",
                "source": arinc_coordinator.data_source,
                "records": [],
            }
            arinc_coordinator.log_event("CFDS", "Cleared Discrete Mode Label 355 buffer")
            return get_cfds_state()

        ts = _now_time()
        fig73_record = {
            "failureNumber": "002",
            "failureTypeCode": "005",
            "failureTypeString": "CHECK SUSPECT 1 SYSTEM",
            "witnessPosition": "012",
            "witnessSide": "024",
            "suspect1Position": "048",
            "suspect1Side": "013",
            "suspect2Position": "026",
            "suspect2Side": "052",
            "suspect3Position": "010",
            "suspect3Side": "020",
            "source": "SIMULATION",
            "receivedAt": ts,
        }
        records = [fig73_record]
        if req.scenario == "MULTI_FIG74":
            records.extend(
                [
                    {
                        "failureNumber": "007",
                        "failureTypeCode": "011",
                        "failureTypeString": "[SIM] CHECK BUS INPUT A",
                        "witnessPosition": "014",
                        "witnessSide": "001",
                        "suspect1Position": "031",
                        "suspect1Side": "002",
                        "suspect2Position": "000",
                        "suspect2Side": "000",
                        "suspect3Position": "000",
                        "suspect3Side": "000",
                        "source": "SIMULATION",
                        "receivedAt": ts,
                    },
                    {
                        "failureNumber": "014",
                        "failureTypeCode": "003",
                        "failureTypeString": "[SIM] INTERNAL MEMORY TEST",
                        "witnessPosition": "012",
                        "witnessSide": "024",
                        "suspect1Position": "012",
                        "suspect1Side": "024",
                        "suspect2Position": "000",
                        "suspect2Side": "000",
                        "suspect3Position": "000",
                        "suspect3Side": "000",
                        "source": "SIMULATION",
                        "receivedAt": ts,
                    },
                ]
            )

        _cfds_state.discrete_rx = {
            "status": "DATA_ACTIVE",
            "source": "SIMULATION",
            "records": records,
        }
        arinc_coordinator.log_event(
            "CFDS",
            f"[SIM] Discrete Mode Label 355 injected ({len(records)} failure record(s))",
            direction="RX",
            channel=req.channel,
            label="355",
            raw_hex="00000000",
        )
        return get_cfds_state()


def configure_cfds_channel(req: CfdsChannelConfigRequest) -> dict[str, Any]:
    with _cfds_lock:
        arinc_coordinator.acquire_mode("CFDS")
        arinc_coordinator.configure_channel(
            channel=req.channel,
            speed=req.speed,
            enabled=req.enabled,
            trap_label=req.trap_label,
            trap_active=req.trap_active,
        )
        return get_cfds_state()
