"""Business logic service for Boeing CMC Mode (Aeroflex T1200B / D243W201-1 / ARINC 604-1)."""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from core.arinc429 import (
    CMC_LABEL155_BIT_NAMES,
    decode_cmc_command_227,
    decode_cmc_config_word_155,
    decode_cmc_fault_summary_word,
    decode_cmc_flight_phase_126,
    decode_iso5_pair_356,
    encode_cmc_command_227,
    encode_cmc_config_word_155,
    encode_cmc_date_260,
    encode_cmc_fault_summary_word,
    encode_cmc_flight_phase_126,
    encode_cmc_iso5_word,
    encode_cmc_label356_stream,
    encode_cmc_time_125,
)
from core.runtime import arinc_coordinator

from .schemas import (
    CmcCommandSummaryRequest,
    CmcConfigDataRequest,
    CmcFaultToggleRequest,
    CmcFunctionName,
    CmcLruSelectRequest,
    CmcModeMetadata,
    CmcShopFaultsRequest,
    CmcTerminalActionRequest,
    CmcTransmitDataRequest,
)

# 20 Standard Boeing CMC LRUs per T1200B manual
STANDARD_CMC_LRUS: list[dict[str, Any]] = [
    {"id": "707 LRA", "name": "Low Range Altimeter", "code": "007", "tc_capable": False},
    {"id": "708 WXR", "name": "Weather Radar", "code": "008", "tc_capable": False},
    {"id": "709 DME", "name": "Distance Measuring Equipment", "code": "009", "tc_capable": False},
    {"id": "710 ILS", "name": "Instrument Landing System", "code": "010", "tc_capable": True},
    {"id": "711 VOR", "name": "VHF Omnidirectional Range", "code": "011", "tc_capable": True},
    {"id": "712 ADF", "name": "Automatic Direction Finder", "code": "012", "tc_capable": True},
    {"id": "716 VHF", "name": "VHF Communications", "code": "016", "tc_capable": False},
    {"id": "718 ATC", "name": "Air Traffic Control Transponder", "code": "018", "tc_capable": False},
    {"id": "719 HF", "name": "HF Communications", "code": "019", "tc_capable": False},
    {"id": "723 GPWS", "name": "Ground Proximity Warning System", "code": "023", "tc_capable": False},
    {"id": "724 ACARS", "name": "ACARS Management Unit", "code": "024", "tc_capable": False},
    {"id": "727 MLS", "name": "Microwave Landing System", "code": "027", "tc_capable": False},
    {"id": "735 TCAS", "name": "Traffic Alert & Collision Avoidance", "code": "035", "tc_capable": False},
    {"id": "740 PRNTR", "name": "Cockpit Printer", "code": "040", "tc_capable": False},
    {"id": "741 SATCM", "name": "Satellite Communications", "code": "041", "tc_capable": False},
    {"id": "718 ATC/S", "name": "ATC Transponder Mode S", "code": "018", "tc_capable": False},
    {"id": "755 MMR", "name": "Multi-Mode Receiver", "code": "055", "tc_capable": False},
    {"id": "750 VDR", "name": "VHF Data Radio", "code": "050", "tc_capable": False},
    {"id": "753 HFDU", "name": "HF Data Unit", "code": "053", "tc_capable": False},
    {"id": "753 HFDR", "name": "HF Data Radio", "code": "053", "tc_capable": False},
]

# 6 Function select switches with Hex codes (Bits 25..31)
CMC_FUNCTION_MAP: dict[str, int] = {
    "NO REQUEST": 0x00,
    "BITE TEST": 0x01,
    "SHOP FAULTS": 0x03,
    "NEW FLIGHT": 0x12,
    "LOGOFF": 0x7F,
    "CONFIG DATA": 0x05,
    # Legacy aliases
    "BITE TEST (IN-FLIGHT)": 0x01,
    "NEW FLIGHT LEG": 0x12,
    "LOGOFF / TERMINATE": 0x7F,
    "CONFIG DATA REQUEST": 0x05,
}

# LRU specific fault bit mappings for Bits 11..27 on Label 350
LRU_SPECIFIC_FAULT_BITS: dict[str, dict[int, str]] = {
    "007": {  # 707 LRA (Radio Altimeter)
        11: "LRU FAILURE",
        12: "TX ANTENNA FAILURE",
        13: "INDICATOR FAILURE",
        14: "CFDIU INPUT BUS",
        15: "RX ANTENNA FAILURE",
    },
    "008": {  # 708 WXR (Weather Radar)
        11: "R/T FAILURE",
        12: "ANTENNA DRIVE FAILURE",
        13: "CONTROL BUS FAILURE",
        14: "DISPLAY BUS FAILURE",
        15: "CALIBRATION FAULT",
    },
    "009": {  # 709 DME
        11: "LRU FAILURE",
        12: "ANTENNA FAULT",
        13: "TUNING BUS FAULT",
        14: "VIDEO OUTPUT FAULT",
    },
    "010": {  # 710 ILS
        11: "LOCALIZER RECEIVER FAIL",
        12: "GLIDESLOPE RECEIVER FAIL",
        13: "MARKER BEACON FAIL",
        14: "TUNING BUS FAULT",
    },
    "011": {  # 711 VOR
        11: "VOR RECEIVER FAIL",
        12: "MARKER BEACON FAIL",
        13: "TUNING BUS FAULT",
        14: "AUDIO OUTPUT FAIL",
    },
    "012": {  # 712 ADF
        11: "ADF RECEIVER FAIL",
        12: "SENSE ANTENNA FAIL",
        13: "LOOP ANTENNA FAIL",
        14: "TUNING BUS FAULT",
    },
    "016": {  # 716 VHF
        11: "TRANSCEIVER FAIL",
        12: "PA OVERHEAT",
        13: "VSWR FAULT",
        14: "SYNTHESIZER UNLOCK",
    },
    "018": {  # 718 ATC / ATC/S
        11: "TRANSPONDER FAIL",
        12: "TOP ANTENNA FAIL",
        13: "BOTTOM ANTENNA FAIL",
        14: "CONTROL BUS FAIL",
        15: "ALTITUDE DATA FAIL",
    },
    "019": {  # 719 HF
        11: "TRANSCEIVER FAIL",
        12: "ANTENNA COUPLER FAIL",
        13: "POWER AMP OVERHEAT",
        14: "CONTROL BUS FAIL",
    },
    "023": {  # 723 GPWS
        11: "COMPUTER FAIL",
        12: "TERRAIN DATABASE FAIL",
        13: "GLIDESLOPE INHIBIT",
        14: "FLAP SENSOR FAIL",
        15: "LANDING GEAR SENSOR FAIL",
    },
    "024": {  # 724 ACARS
        11: "MANAGEMENT UNIT FAIL",
        12: "VHF LINK FAULT",
        13: "SATCOM LINK FAULT",
        14: "PRINTER LINK FAULT",
    },
    "027": {  # 727 MLS
        11: "AZIMUTH RECEIVER FAIL",
        12: "ELEVATION RECEIVER FAIL",
        13: "DME/P FAIL",
    },
    "035": {  # 735 TCAS
        11: "TCAS PROCESSOR FAIL",
        12: "TOP DIRECTIONAL ANT FAIL",
        13: "BOTTOM ANTENNA FAIL",
        14: "RA DISPLAY FAIL",
        15: "TA DISPLAY FAIL",
    },
    "040": {  # 740 PRNTR
        11: "PRINTER MECHANISM FAIL",
        12: "PAPER OUT",
        13: "THERMAL HEAD OVERHEAT",
        14: "INPUT BUS FAIL",
    },
    "041": {  # 741 SATCM
        11: "SDU FAILURE",
        12: "HPA FAILURE",
        13: "BSU / BEAM STEERING FAIL",
        14: "ANTENNA FAULT",
    },
    "055": {  # 755 MMR
        11: "ILS RECEIVER FAIL",
        12: "GPS RECEIVER FAIL",
        13: "GLS RECEIVER FAIL",
        14: "ANTENNA FAULT",
    },
    "050": {  # 750 VDR
        11: "VDR TRANSCEIVER FAIL",
        12: "MODE 2 MSK DEMOD FAIL",
        13: "CSMA/CD TIMING FAULT",
    },
    "053": {  # 753 HFDU / HFDR
        11: "HF DATA UNIT FAIL",
        12: "MODEM FAULT",
        13: "PROTOCOL CONTROLLER FAIL",
    },
}


@dataclass
class CmcRuntimeState:
    selected_lru: dict[str, Any] = field(
        default_factory=lambda: {
            "id": "707 LRA",
            "name": "Low Range Altimeter",
            "code": "007",
            "time_constant": "OFF",
        }
    )
    # Background Transmitted Parameters
    tx_data: dict[str, Any] = field(
        default_factory=lambda: {
            "date": "11/13/26",
            "time": "09:30.0 GMT",
            "flt_num": "AA1234",
            "city_pairs": "KSEA KORD",
            "flt_phase": 5,
            "aircraft_id": "N777AA",
            "config_word_bits": {name: False for _, name in CMC_LABEL155_BIT_NAMES},
            "words_hex": {},
        }
    )
    # Command Word 227
    selected_function: str = "NO REQUEST"
    function_code_hex: str = "00H"
    cmd_pad: int = 0
    cmd_sdi: str = "00"
    cmd_rate_ms: int = 100
    cmd_parity: str = "ODD"
    cmd_handshake_status: str = "IDLE"
    cmd_warning: str | None = None
    # Fault Summary Words (350 / 351)
    fault_page: str = "350"
    has_words_received_350: bool = True
    has_words_received_351: bool = True
    active_fault_bits_350: list[int] = field(default_factory=list)
    active_fault_bits_351: list[int] = field(default_factory=list)
    bite_test_inhibit: bool = False
    bit_29_ack: bool = True
    sdi_350: str = "00"
    ssm_350: str = "00"
    sdi_351: str = "00"
    ssm_351: str = "00"
    # Terminal Display State (Label 356)
    terminal_view: str = "MENU"
    terminal_page: int = 1
    terminal_lines: list[str] = field(
        default_factory=lambda: [
            "========================",
            "  BOEING CMC TERMINAL   ",
            "========================",
            "1< SHOP FAULTS          ",
            "2< CONFIG DATA          ",
            "3< LRU BITE TEST        ",
            "4<                      ",
            "5<                      ",
            "6< RETURN TO MAIN       ",
            "                        ",
            "A> SYS STATUS           ",
            "B> FAULT LOGS           ",
            "C>                      ",
            "D>                      ",
            "E>                      ",
            "F> HELP / INFO          ",
            "------------------------",
            "STATUS: READY [PAGE 1/1]",
        ]
    )
    terminal_message: str = "READY"
    terminal_error: str | None = None
    terminal_words_hex: list[str] = field(default_factory=list)
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


def _get_fault_bits_view(eq_code: str, active_bits: list[int]) -> list[dict[str, Any]]:
    """Build complete Bit 11 to Bit 29 list per Boeing CMC manual."""
    specific_map = LRU_SPECIFIC_FAULT_BITS.get(eq_code, {})
    items: list[dict[str, Any]] = []

    for b in range(11, 28):
        name = specific_map.get(b, "SPARE")
        is_spare = name == "SPARE"
        is_fail = b in active_bits
        items.append(
            {
                "bit": b,
                "label": name,
                "is_spare": is_spare,
                "status": "FAILURE (1)" if is_fail else ("OFF (0)" if is_spare else "OK (0)"),
                "fault": is_fail,
            }
        )

    # Bit 28: BITE TEST INHIBIT (0=ENABLE, 1=INHIBIT)
    items.append(
        {
            "bit": 28,
            "label": "BITE TEST INHIBIT",
            "is_spare": False,
            "status": "INHIBIT (1)" if _cmc_state.bite_test_inhibit else "ENABLE (0)",
            "fault": _cmc_state.bite_test_inhibit,
        }
    )

    # Bit 29: CMND WORD ACKNOWLEDGE (0=NAK, 1=ACK)
    items.append(
        {
            "bit": 29,
            "label": "CMND WORD ACKNOWLEDGE",
            "is_spare": False,
            "status": "ACK (1)" if _cmc_state.bit_29_ack else "NAK (0)",
            "fault": not _cmc_state.bit_29_ack,
        }
    )

    return items


def _compute_tx_words_hex(tx_data: dict[str, Any], sdi: str = "00") -> dict[str, str]:
    """Compute 32-bit ARINC 429 hexadecimal words for background transmit parameters."""
    cfg_word = encode_cmc_config_word_155(tx_data.get("config_word_bits", {}), sdi=sdi)

    # Date Label 260
    d_parts = tx_data.get("date", "11/13/26").split("/")
    m = int(d_parts[0]) if len(d_parts) > 0 and d_parts[0].isdigit() else 11
    d = int(d_parts[1]) if len(d_parts) > 1 and d_parts[1].isdigit() else 13
    y = int(d_parts[2]) if len(d_parts) > 2 and d_parts[2].isdigit() else 26
    date_word = encode_cmc_date_260(m, d, y, sdi=sdi)

    # Time Label 125
    t_str = tx_data.get("time", "09:30.0 GMT").replace("GMT", "").strip()
    t_sub = t_str.split(":")
    hr = int(t_sub[0]) if len(t_sub) > 0 and t_sub[0].isdigit() else 9
    mn_sub = t_sub[1].split(".") if len(t_sub) > 1 else ["30", "0"]
    mn = int(mn_sub[0]) if mn_sub[0].isdigit() else 30
    tenth = int(mn_sub[1][0]) if len(mn_sub) > 1 and mn_sub[1] and mn_sub[1][0].isdigit() else 0
    time_word = encode_cmc_time_125(hr, mn, tenth, sdi=sdi)

    # Flight Phase Label 126
    ph = int(tx_data.get("flt_phase", 5))
    ph_word = encode_cmc_flight_phase_126(ph, sdi=sdi)

    # Flight Num Labels 233..236
    flt_num = (tx_data.get("flt_num", "AA1234") + "        ")[:8]
    flt_words = [
        encode_cmc_iso5_word("233", flt_num[0], flt_num[1], sdi=sdi),
        encode_cmc_iso5_word("234", flt_num[2], flt_num[3], sdi=sdi),
        encode_cmc_iso5_word("235", flt_num[4], flt_num[5], sdi=sdi),
        encode_cmc_iso5_word("236", flt_num[6], flt_num[7], sdi=sdi),
    ]

    # City Pairs Labels 040..042
    cp = (tx_data.get("city_pairs", "KSEA KORD") + "         ")[:9]
    cp_words = [
        encode_cmc_iso5_word("040", cp[0], cp[1], sdi=sdi),
        encode_cmc_iso5_word("041", cp[2], cp[3], sdi=sdi),
        encode_cmc_iso5_word("042", cp[4], cp[5], sdi=sdi),
    ]

    # Aircraft ID Labels 301..304
    tail = (tx_data.get("aircraft_id", "N777AA") + "       ")[:7]
    tail_words = [
        encode_cmc_iso5_word("301", tail[0], tail[1], sdi=sdi),
        encode_cmc_iso5_word("302", tail[2], tail[3], sdi=sdi),
        encode_cmc_iso5_word("303", tail[4], tail[5], sdi=sdi),
        encode_cmc_iso5_word("304", tail[6], " ", sdi=sdi),
    ]

    return {
        "label_155_config": f"{cfg_word:08X}",
        "label_260_date": f"{date_word:08X}",
        "label_125_time": f"{time_word:08X}",
        "label_126_flight_phase": f"{ph_word:08X}",
        "label_233_236_flt_num": " ".join(f"{w:08X}" for w in flt_words),
        "label_040_042_city_pairs": " ".join(f"{w:08X}" for w in cp_words),
        "label_301_304_aircraft_id": " ".join(f"{w:08X}" for w in tail_words),
    }


def get_cmc_state() -> dict[str, Any]:
    with _cmc_lock:
        snap = arinc_coordinator.snapshot()

        # Encode Word #1 (350) and Word #2 (351)
        raw_350 = encode_cmc_fault_summary_word(
            label_oct="350",
            active_fault_bits=_cmc_state.active_fault_bits_350,
            command_ack=_cmc_state.bit_29_ack,
            bite_test_inhibit=_cmc_state.bite_test_inhibit,
            sdi=_cmc_state.sdi_350,
            ssm=_cmc_state.ssm_350,
        )
        raw_351 = encode_cmc_fault_summary_word(
            label_oct="351",
            active_fault_bits=_cmc_state.active_fault_bits_351,
            command_ack=_cmc_state.bit_29_ack,
            bite_test_inhibit=_cmc_state.bite_test_inhibit,
            sdi=_cmc_state.sdi_351,
            ssm=_cmc_state.ssm_351,
        )

        dec_350 = decode_cmc_fault_summary_word(raw_350)
        dec_351 = decode_cmc_fault_summary_word(raw_351)

        # Encode Label 227 Command Word
        fn_code = CMC_FUNCTION_MAP.get(_cmc_state.selected_function, 0x00)
        raw_227 = encode_cmc_command_227(
            sensor_code_hex=_cmc_state.selected_lru["code"],
            function_code=fn_code,
            pad=_cmc_state.cmd_pad,
            sdi=_cmc_state.cmd_sdi,
            parity=_cmc_state.cmd_parity,
        )
        dec_227 = decode_cmc_command_227(raw_227, expected_parity=_cmc_state.cmd_parity)

        # Transmit background hex words
        words_hex = _compute_tx_words_hex(_cmc_state.tx_data, sdi=_cmc_state.cmd_sdi)
        _cmc_state.tx_data["words_hex"] = words_hex

        # Fault bits view based on current selected page (350 vs 351)
        active_bits = (
            _cmc_state.active_fault_bits_350
            if _cmc_state.fault_page == "350"
            else _cmc_state.active_fault_bits_351
        )
        fault_bits_table = _get_fault_bits_view(_cmc_state.selected_lru["code"], active_bits)

        has_words_received = (
            _cmc_state.has_words_received_350
            if _cmc_state.fault_page == "350"
            else _cmc_state.has_words_received_351
        )

        return {
            "mode": "CMC",
            "source": snap["source"],
            "simulation_mode": snap["simulation_mode"],
            "active_mode": snap["active_mode"],
            "bus_running": snap["bus_running"],
            "channels": snap["channels"],
            "standard_lrus": STANDARD_CMC_LRUS,
            "selected_lru": _cmc_state.selected_lru,
            "transmit_data": _cmc_state.tx_data,
            "command_summary": {
                "label": "227",
                "eq_id": _cmc_state.selected_lru["code"],
                "function": _cmc_state.selected_function,
                "function_code": fn_code,
                "function_hex": f"{fn_code:02X}H",
                "pad": f"{_cmc_state.cmd_pad:02b}",
                "sdi": _cmc_state.cmd_sdi,
                "rate_ms": _cmc_state.cmd_rate_ms,
                "parity": _cmc_state.cmd_parity,
                "raw_hex": dec_227["raw_hex"],
                "handshake_status": _cmc_state.cmd_handshake_status,
                "warning": _cmc_state.cmd_warning,
                # Legacy fields for backward compatibility
                "ground_test_en": True,
                "inflight_test_en": True,
                "tx_rate_ms": _cmc_state.cmd_rate_ms,
                "rx_timeout_secs": 5,
            },
            "fault_summary": {
                "current_page": _cmc_state.fault_page,
                "has_words_received": has_words_received,
                "word_350": dec_350,
                "word_351": dec_351,
                "bit_29_ack": _cmc_state.bit_29_ack,
                "bite_test_inhibit": _cmc_state.bite_test_inhibit,
                "bits": fault_bits_table,
            },
            "terminal": {
                "view": _cmc_state.terminal_view,
                "page": _cmc_state.terminal_page,
                "lines": _cmc_state.terminal_lines,
                "message": _cmc_state.terminal_message,
                "error": _cmc_state.terminal_error,
                "words_hex": _cmc_state.terminal_words_hex,
            },
            "config_data": _cmc_state.config_data,
            "shop_faults": _cmc_state.shop_faults,
            "rx_history": arinc_coordinator.get_rx_history("CMC"),
        }


def select_cmc_lru(req: CmcLruSelectRequest) -> dict[str, Any]:
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")
        clean_code = req.code.replace("0x", "").replace("0X", "").strip().upper()
        clean_code = clean_code.zfill(3)[:3]

        _cmc_state.selected_lru = {
            "id": req.lru_id,
            "name": req.name,
            "code": clean_code,
            "time_constant": req.time_constant,
        }
        arinc_coordinator.log_event(
            "CMC",
            f"Selected LRU {req.lru_id} (Eq Code {clean_code}, TC={req.time_constant})",
        )
        return get_cmc_state()


def update_cmc_transmit_data(req: CmcTransmitDataRequest) -> dict[str, Any]:
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")
        _cmc_state.tx_data["date"] = req.date
        _cmc_state.tx_data["time"] = req.time
        _cmc_state.tx_data["flt_num"] = req.flt_num
        _cmc_state.tx_data["city_pairs"] = req.city_pairs
        _cmc_state.tx_data["flt_phase"] = req.flt_phase
        _cmc_state.tx_data["aircraft_id"] = req.aircraft_id

        if req.config_word_bits:
            for _, name in CMC_LABEL155_BIT_NAMES:
                if name in req.config_word_bits:
                    _cmc_state.tx_data["config_word_bits"][name] = req.config_word_bits[name]

        # Transmit Label 155, 260, 125, 126 onto bus
        cfg_word = encode_cmc_config_word_155(
            _cmc_state.tx_data["config_word_bits"], sdi=_cmc_state.cmd_sdi
        )
        arinc_coordinator.transmit_word(
            "CMC",
            req.channel,
            cfg_word,
            detail=f"CMC Label 155 Aircraft Config Word: {cfg_word:08X}",
        )

        return get_cmc_state()


def send_cmc_command_summary(req: CmcCommandSummaryRequest) -> dict[str, Any]:
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")
        _cmc_state.selected_function = req.function
        clean_code = (req.eq_id or req.sensor_code or _cmc_state.selected_lru["code"]).replace("0x", "").strip().upper()
        clean_code = clean_code.zfill(3)[:3]
        _cmc_state.selected_lru["code"] = clean_code
        _cmc_state.cmd_pad = req.pad
        _cmc_state.cmd_sdi = req.sdi
        _cmc_state.cmd_rate_ms = req.rate_ms
        _cmc_state.cmd_parity = req.parity

        fn_code = CMC_FUNCTION_MAP.get(req.function, 0x00)
        raw_227 = encode_cmc_command_227(
            sensor_code_hex=clean_code,
            function_code=fn_code,
            pad=req.pad,
            sdi=req.sdi,
            parity=req.parity,
        )

        _cmc_state.cmd_warning = None
        _cmc_state.cmd_handshake_status = "TRANSMITTED"

        arinc_coordinator.transmit_word(
            "CMC",
            req.channel,
            raw_227,
            detail=f"CMC Label 227 FN={req.function} ({fn_code:02X}H) EQ={clean_code} PAD={req.pad} SDI={req.sdi}",
        )

        # In simulation: auto-trigger terminal when SHOP FAULTS or CONFIG DATA is pressed
        if req.function == "SHOP FAULTS":
            _render_shop_faults_terminal(clean_code)
        elif req.function == "CONFIG DATA":
            _render_config_data_terminal(clean_code)

        return get_cmc_state()


def switch_cmc_fault_page(label: str) -> dict[str, Any]:
    with _cmc_lock:
        if label in {"350", "351"}:
            _cmc_state.fault_page = label
        return get_cmc_state()


def update_cmc_fault_bit(
    bit: int,
    fault: bool,
    command_ack: bool | None = None,
    bite_inhibit: bool | None = None,
    label: str = "350",
    sdi: str | None = None,
    ssm: str | None = None,
    has_words: bool | None = None,
) -> dict[str, Any]:
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")

        if label == "351":
            target_bits = _cmc_state.active_fault_bits_351
            if sdi is not None:
                _cmc_state.sdi_351 = sdi
            if ssm is not None:
                _cmc_state.ssm_351 = ssm
            if has_words is not None:
                _cmc_state.has_words_received_351 = has_words
        else:
            target_bits = _cmc_state.active_fault_bits_350
            if sdi is not None:
                _cmc_state.sdi_350 = sdi
            if ssm is not None:
                _cmc_state.ssm_350 = ssm
            if has_words is not None:
                _cmc_state.has_words_received_350 = has_words

        bits_set = set(target_bits)
        if 11 <= bit <= 27:
            if fault:
                bits_set.add(bit)
            else:
                bits_set.discard(bit)
        elif bit == 28:
            _cmc_state.bite_test_inhibit = fault
        elif bit == 29:
            _cmc_state.bit_29_ack = not fault if command_ack is None else command_ack

        if label == "351":
            _cmc_state.active_fault_bits_351 = sorted(bits_set)
        else:
            _cmc_state.active_fault_bits_350 = sorted(bits_set)

        if command_ack is not None:
            _cmc_state.bit_29_ack = command_ack
        if bite_inhibit is not None:
            _cmc_state.bite_test_inhibit = bite_inhibit

        # Record rx word into coordinator
        raw_word = encode_cmc_fault_summary_word(
            label_oct=label,
            active_fault_bits=sorted(bits_set),
            command_ack=_cmc_state.bit_29_ack,
            bite_test_inhibit=_cmc_state.bite_test_inhibit,
            sdi=_cmc_state.sdi_350 if label == "350" else _cmc_state.sdi_351,
            ssm=_cmc_state.ssm_350 if label == "350" else _cmc_state.ssm_351,
        )
        arinc_coordinator.record_rx_word(
            "CMC",
            "RX-B",
            raw_word,
            detail=f"Label {label} Fault Summary: active={sorted(bits_set)} ACK={_cmc_state.bit_29_ack} INHIBIT={_cmc_state.bite_test_inhibit}",
        )
        return get_cmc_state()


def _render_shop_faults_terminal(eq_code: str) -> None:
    """Simulate receiving text block ASCII/ISO Alphabet #5 via Label 356 with STX & EOT."""
    lines = [
        "========================",
        f"  SHOP FAULTS: {eq_code}  ",
        "========================",
        "JcAIR - CMC TEST        ",
        "FL01: LRU RAM INTEGRITY ",
        "FL02: RX CLOCK DRIFT    ",
        "FL03: DATA BUS SYNC     ",
        "                        ",
        "1< CLEAR ALL FAULTS     ",
        "2< PRINT LOG RECORD     ",
        "6< RETURN TO MAIN       ",
        "------------------------",
        "EOT: BLOCK VERIFIED     ",
    ]
    words, expected_count = encode_cmc_label356_stream(lines, include_stx=True, include_eot=True)
    _cmc_state.terminal_view = "SHOP_FAULTS"
    _cmc_state.terminal_lines = lines
    _cmc_state.terminal_message = f"SHOP FAULTS LOADED ({len(words)} WORDS, STX/EOT OK)"
    _cmc_state.terminal_error = None
    _cmc_state.terminal_words_hex = [f"{w:08X}" for w in words]

    _cmc_state.shop_faults = {
        "status": "VALID",
        "message": f"SIMULATION SHOP FAULTS RECEIVED ({len(words)} WORDS)",
        "valid": True,
        "source": "SIMULATION",
        "decoded_text": "JcAIR - CMC TEST",
        "records": [
            {
                "leg": "FL-01",
                "code": f"{eq_code}-RAM-INTEGRITY",
                "severity": "CLASS 1",
                "description": "Internal SRAM integrity check passed during BITE",
            },
            {
                "leg": "FL-02",
                "code": f"{eq_code}-CLK-DRIFT",
                "severity": "CLASS 2",
                "description": "Receiver clock drift within nominal tolerance",
            },
        ],
        "ordered_words": [
            {
                "word_order": idx + 1,
                "seq_ctrl": (idx + 1) & 0x1F,
                "raw_hex": f"{w:08X}",
                "chars": f"{chr((w >> 10) & 0x7F)}{chr((w >> 17) & 0x7F)}",
            }
            for idx, w in enumerate(words[:12])
        ],
    }


def _render_config_data_terminal(eq_code: str) -> None:
    lines = [
        "========================",
        f"  CONFIG DATA: {eq_code} ",
        "========================",
        "JcAIR - CMC TEST        ",
        "PN: 4059000-902         ",
        "SW: OPS-V4.2.1-B        ",
        "HW: MOD-LEVEL C         ",
        "SER: B777-TEST-99       ",
        "                        ",
        "6< RETURN TO MAIN       ",
        "------------------------",
        "EOT: BLOCK VERIFIED     ",
    ]
    words, expected_count = encode_cmc_label356_stream(lines, include_stx=True, include_eot=True)
    _cmc_state.terminal_view = "CONFIG_DATA"
    _cmc_state.terminal_lines = lines
    _cmc_state.terminal_message = f"CONFIG DATA LOADED ({len(words)} WORDS, STX/EOT OK)"
    _cmc_state.terminal_error = None
    _cmc_state.terminal_words_hex = [f"{w:08X}" for w in words]

    _cmc_state.config_data = {
        "status": "VALID",
        "message": f"SIMULATION CONFIG DATA RECEIVED ({_now_str()})",
        "valid": True,
        "source": "SIMULATION",
        "part_number": "4059000-902",
        "sw_version": "OPS-V4.2.1-B",
        "hw_mod": "MOD-LEVEL C",
        "decoded_text": "JcAIR - CMC TEST",
        "raw_words_hex": [f"{w:08X}" for w in words[:10]],
    }


def handle_cmc_terminal_action(req: CmcTerminalActionRequest) -> dict[str, Any]:
    """Execute menu choices, error simulations, or navigation on Label 356 terminal."""
    with _cmc_lock:
        arinc_coordinator.acquire_mode("CMC")
        eq_code = _cmc_state.selected_lru["code"]

        # Simulation error testing modes
        sim = req.simulate_mode
        if sim == "NO_ACK":
            _cmc_state.bit_29_ack = False
            _cmc_state.terminal_error = "WARNING: NO CMND WORD ACK RCVD"
            _cmc_state.terminal_message = "ACK TIMEOUT (3s)"
            _cmc_state.config_data["valid"] = False
            _cmc_state.config_data["message"] = "WARNING: NO CMND WORD ACK RCVD"
            _cmc_state.shop_faults["valid"] = False
            _cmc_state.shop_faults["message"] = "WARNING: NO CMND WORD ACK RCVD"
            return get_cmc_state()

        if sim == "NO_MAINTENANCE_DATA":
            _cmc_state.bit_29_ack = True
            _cmc_state.terminal_error = "NO MAINTENANCE DATA RECEIVED"
            _cmc_state.terminal_message = "LABEL 350 TIMEOUT (5s)"
            _cmc_state.config_data["valid"] = False
            _cmc_state.config_data["message"] = "NO MAINTENANCE DATA RECEIVED"
            _cmc_state.shop_faults["valid"] = False
            _cmc_state.shop_faults["message"] = "NO MAINTENANCE DATA RECEIVED"
            return get_cmc_state()

        if sim == "TIMEOUT_12S":
            _cmc_state.terminal_error = "NO LRU RESPONSE IN 12 SECS"
            _cmc_state.terminal_message = "LABEL 356 TIMEOUT (12s)"
            _cmc_state.config_data["valid"] = False
            _cmc_state.config_data["message"] = "NO LRU RESPONSE IN 12 SECS"
            _cmc_state.shop_faults["valid"] = False
            _cmc_state.shop_faults["message"] = "NO LRU RESPONSE IN 12 SECS"
            return get_cmc_state()

        if sim == "BLOCK_COUNT_ERR":
            _cmc_state.terminal_error = "BLOCK WORD COUNT ERR"
            _cmc_state.terminal_message = "STX/EOT WORD COUNT MISMATCH"
            _cmc_state.config_data["valid"] = False
            _cmc_state.config_data["message"] = "BLOCK WORD COUNT ERR"
            _cmc_state.shop_faults["valid"] = False
            _cmc_state.shop_faults["message"] = "BLOCK WORD COUNT ERR"
            return get_cmc_state()

        # Handle Navigation Keys (1..6, A..F, NXT, <RETURN)
        key = req.key.strip().upper()

        if key in {"<RETURN", "RETURN", "6"} and _cmc_state.terminal_view != "MENU":
            _cmc_state.terminal_view = "MENU"
            _cmc_state.terminal_lines = [
                "========================",
                "  BOEING CMC TERMINAL   ",
                "========================",
                "1< SHOP FAULTS          ",
                "2< CONFIG DATA          ",
                "3< LRU BITE TEST        ",
                "4<                      ",
                "5<                      ",
                "6< REFRESH MENU         ",
                "                        ",
                "A> SYS STATUS           ",
                "B> FAULT LOGS           ",
                "C>                      ",
                "D>                      ",
                "E>                      ",
                "F> HELP / INFO          ",
                "------------------------",
                "STATUS: READY [PAGE 1/1]",
            ]
            _cmc_state.terminal_message = "RETURNED TO MAIN MENU"
            _cmc_state.terminal_error = None
            return get_cmc_state()

        if key == "1" or req.action == "REQUEST_SHOP_FAULTS":
            _render_shop_faults_terminal(eq_code)
            return get_cmc_state()

        if key == "2" or req.action == "REQUEST_CONFIG_DATA":
            _render_config_data_terminal(eq_code)
            return get_cmc_state()

        if key == "NXT":
            _cmc_state.terminal_page = 2 if _cmc_state.terminal_page == 1 else 1
            _cmc_state.terminal_message = f"SWITCHED TO PAGE {_cmc_state.terminal_page}"
            return get_cmc_state()

        _cmc_state.terminal_message = f"KEY '{key}' PRESSED"
        return get_cmc_state()


def request_cmc_config_data(req: CmcConfigDataRequest) -> dict[str, Any]:
    return handle_cmc_terminal_action(
        CmcTerminalActionRequest(
            action="REQUEST_CONFIG_DATA",
            key="2",
            channel=req.channel,
            simulate_mode=req.simulate_mode,
        )
    )


def request_cmc_shop_faults(req: CmcShopFaultsRequest) -> dict[str, Any]:
    return handle_cmc_terminal_action(
        CmcTerminalActionRequest(
            action="REQUEST_SHOP_FAULTS",
            key="1",
            channel=req.channel,
            simulate_mode=req.simulate_mode,
        )
    )
