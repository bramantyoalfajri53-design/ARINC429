"""Boeing CMC / Sensor BITE Protocol Engine (ARINC 604 — Label 227 & Label 350).

Implements full Aeroflex / JcAIR T1200B BOEING CMC/SENSOR BITE logic:
1. 19 Standard LRUs + MANUAL ENTRY with equipment codes and bus speeds.
2. Per-LRU Label 350 Fault Summary Bit Maps (bits 11-29) including exact
   JcAIR T1200B maps for 707 LRA (RALT) and 709 DME plus all other 17 LRUs.
3. 6-slide state machine: menu, desired_mode, edit_tx, fault_summary,
   command_summary, channels.
4. ARINC 429 Label 227 Command Summary Word encoder (Label, EQ ID, Function 0-5,
   PAD, SDI, Rate, Parity) and 6 Function Select Switches.
5. CMC Transmit Words encoders: DATE (260), TIME (125), FLT_PHASE (126),
   FLT_NUM/CITY_PAIRS/AIRCRAFT_ID (233-236), and 17-bit Aircraft Configuration
   Word (170).
6. Live Label 350 Fault Summary decoder with SDI, SSM, parity, ENG/BIN/HEX
   word display, and NO WORDS RECEIVED until live/sim Label 350 arrives.
7. Thread-safe simulation toggle (SIM: ON / OFF), Refresh, and manual sim-bit
   toggling.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

from ate_platform.device.arinc_encode import (
    encode_raw_word,
    get_data19,
    get_ssm_bits,
    word_parity_odd,
)

# 19 Standard Boeing CMC LRUs + MANUAL ENTRY (JcAIR T1200B Slide 1)
CMC_LRU_TABLE: list[dict[str, str]] = [
    # Row 1 (10 LRUs)
    {"code": "007", "short": "RALT",  "name": "707 LRA",   "desc": "Low Range Radio Altimeter",               "bus": "A", "speed": "12.5k"},
    {"code": "008", "short": "WXR",   "name": "708 WXR",   "desc": "Weather Radar",                           "bus": "A", "speed": "12.5k"},
    {"code": "009", "short": "DME",   "name": "709 DME",   "desc": "Distance Measuring Equipment",            "bus": "A", "speed": "12.5k"},
    {"code": "010", "short": "ILS",   "name": "710 ILS",   "desc": "Instrument Landing System",               "bus": "A", "speed": "12.5k"},
    {"code": "011", "short": "VOR",   "name": "711 VOR",   "desc": "VHF Omnidirectional Range",               "bus": "A", "speed": "12.5k"},
    {"code": "012", "short": "ADF",   "name": "712 ADF",   "desc": "Automatic Direction Finder",              "bus": "A", "speed": "12.5k"},
    {"code": "016", "short": "VHF",   "name": "716 VHF",   "desc": "VHF Communication Transceiver",           "bus": "A", "speed": "12.5k"},
    {"code": "018", "short": "ATC",   "name": "718 ATC",   "desc": "Air Traffic Control Transponder",         "bus": "A", "speed": "12.5k"},
    {"code": "019", "short": "HF",    "name": "719 HF",    "desc": "High Frequency Communication Transceiver","bus": "A", "speed": "12.5k"},
    {"code": "023", "short": "GPWS",  "name": "723 GPWS",  "desc": "Ground Proximity Warning System",         "bus": "A", "speed": "12.5k"},
    # Row 2 (6 LRUs + Manual Entry in UI)
    {"code": "024", "short": "ACARS", "name": "724 ACARS", "desc": "ARINC Comm Addressing & Reporting System","bus": "A", "speed": "12.5k"},
    {"code": "027", "short": "MLS",   "name": "727 MLS",   "desc": "Microwave Landing System",                "bus": "A", "speed": "12.5k"},
    {"code": "035", "short": "TCAS",  "name": "735 TCAS",  "desc": "Traffic Alert & Collision Avoidance",     "bus": "A", "speed": "12.5k"},
    {"code": "040", "short": "PRNTR", "name": "740 PRNTR", "desc": "Cockpit Printer",                         "bus": "A", "speed": "12.5k"},
    {"code": "041", "short": "SATCM", "name": "741 SATCM", "desc": "Satellite Communication System",          "bus": "A", "speed": "12.5k"},
    {"code": "118", "short": "ATC/S", "name": "718 ATC/S", "desc": "ATC Mode S Transponder",                  "bus": "A", "speed": "12.5k"},
    # Row 3 (3 LRUs)
    {"code": "050", "short": "VDR",   "name": "750 VDR",   "desc": "VHF Data Radio (High-Speed Channel C)",   "bus": "C", "speed": "100k"},
    {"code": "053", "short": "HFDU",  "name": "753 HFDU",  "desc": "HF Data Unit",                            "bus": "A", "speed": "12.5k"},
    {"code": "153", "short": "HFDR",  "name": "753 HFDR",  "desc": "HF Data Radio",                           "bus": "A", "speed": "12.5k"},
]

MANUAL_LRU_DEFAULT: dict[str, str] = {
    "code": "000",
    "short": "MANUAL",
    "name": "MANUAL ENTRY",
    "desc": "Manual Equipment Code Entry",
    "bus": "A",
    "speed": "12.5k",
    "is_manual": "1",
}


def _build_bit_map(bits_11_to_15: dict[int, str], extra: dict[int, str] | None = None) -> dict[int, str]:
    m: dict[int, str] = {}
    for b in range(11, 30):
        m[b] = "SPARE"
    m.update(bits_11_to_15)
    if extra:
        m.update(extra)
    m[28] = "DATA TRANSFER IN PROGRESS"
    m[29] = "CMND WORD ACKNOWLEDGE"
    return m


# Per-LRU Label 350 Bit 11..29 Maps (ARINC 604-1 / JcAIR T1200B Slides 4 & 10)
CMC_FAULT_BIT_MAPS: dict[str, dict[int, str]] = {
    "707 LRA": _build_bit_map({
        11: "LRRA LRU FAULT",
        12: "NO CTL BUS INPUT",
        13: "ANTENNA FAULT",
        14: "ARINC 429 XMITTER FAULT",
        15: "NO ADC BUS INPUT",
    }),
    "708 WXR": _build_bit_map({
        11: "WXR LRU FAULT",
        12: "CONTROL UNIT FAULT",
        13: "ANTENNA / DRIVE FAULT",
        14: "NO IRS / ATTITUDE BUS",
        15: "WAVEGUIDE / RT FAULT",
    }),
    "709 DME": _build_bit_map({
        11: "DME LRU FAULT",
        12: "CONTROL UNIT FAULT",
        13: "ANTENNA FAULT",
        14: "NOT USED",
        15: "TEST INHIBIT",
    }),
    "710 ILS": _build_bit_map({
        11: "ILS LRU FAULT",
        12: "NO CTL BUS INPUT",
        13: "LOC / GS ANTENNA FAULT",
        14: "ARINC 429 XMITTER FAULT",
        15: "MARKER RECEIVER FAULT",
    }),
    "711 VOR": _build_bit_map({
        11: "VOR LRU FAULT",
        12: "NO CTL BUS INPUT",
        13: "VOR ANTENNA FAULT",
        14: "MB / RMP BUS FAULT",
        15: "TEST INHIBIT",
    }),
    "712 ADF": _build_bit_map({
        11: "ADF LRU FAULT",
        12: "CONTROL UNIT FAULT",
        13: "LOOP / SENSE ANT FAULT",
        14: "ARINC 429 XMITTER FAULT",
        15: "POWER SUPPLY FAULT",
    }),
    "716 VHF": _build_bit_map({
        11: "VHF LRU FAULT",
        12: "NO CTL BUS INPUT",
        13: "ANTENNA / VSWR FAULT",
        14: "PTT STUCK > 35 SEC",
        15: "SYNTHESIZER UNLOCK",
    }),
    "718 ATC": _build_bit_map({
        11: "ATC LRU FAULT",
        12: "NO CTL BUS INPUT",
        13: "TOP / BOT ANTENNA FAULT",
        14: "NO ADC / ALTITUDE BUS",
        15: "SUPPRESSION BUS FAULT",
    }),
    "719 HF": _build_bit_map({
        11: "HF LRU FAULT",
        12: "CONTROL UNIT FAULT",
        13: "ANTENNA COUPLER FAULT",
        14: "PA OVERTEMP FAULT",
        15: "VSWR / TUNER FAULT",
    }),
    "723 GPWS": _build_bit_map({
        11: "GPWS LRU FAULT",
        12: "NO LRRA BUS INPUT",
        13: "NO ADC / ILS BUS",
        14: "PROGRAM PIN FAULT",
        15: "TERRAIN DB FAULT",
    }),
    "724 ACARS": _build_bit_map({
        11: "ACARS MU FAULT",
        12: "VHF / SATCOM LINK FAULT",
        13: "MCDU INTERFACE FAULT",
        14: "PRINTER INTERFACE FAULT",
        15: "CONFIG PIN FAULT",
    }),
    "727 MLS": _build_bit_map({
        11: "MLS LRU FAULT",
        12: "NO CTL BUS INPUT",
        13: "AZIMUTH / ELV ANT FAULT",
        14: "DME/P INTERFACE FAULT",
        15: "TEST INHIBIT",
    }),
    "735 TCAS": _build_bit_map({
        11: "TCAS LRU FAULT",
        12: "TOP / BOT ANT FAULT",
        13: "NO MODE S XPDR BUS",
        14: "NO RAD ALT / IRS BUS",
        15: "DISPLAY INTERFACE FAULT",
    }),
    "740 PRNTR": _build_bit_map({
        11: "PRINTER LRU FAULT",
        12: "PRINT HEAD FAULT",
        13: "PAPER OUT / JAM",
        14: "DATA LINK BUS FAULT",
        15: "POWER SUPPLY FAULT",
    }),
    "741 SATCM": _build_bit_map({
        11: "SDU / SATCOM LRU FAULT",
        12: "HPA / LNA FAULT",
        13: "HIGH GAIN ANT FAULT",
        14: "NO IRS / FMS BUS",
        15: "RF SYNTHESIZER FAULT",
    }),
    "718 ATC/S": _build_bit_map({
        11: "ATC MODE S LRU FAULT",
        12: "NO CTL BUS INPUT",
        13: "TOP / BOT ANTENNA FAULT",
        14: "NO ADC / IRS BUS INPUT",
        15: "SUPPRESSION BUS FAULT",
    }),
    "750 VDR": _build_bit_map({
        11: "VDR LRU FAULT",
        12: "NO CTL / RMP BUS",
        13: "ANTENNA / VSWR FAULT",
        14: "PTT / SQUELCH FAULT",
        15: "VDL MODE 2 FAULT",
    }),
    "753 HFDU": _build_bit_map({
        11: "HFDU LRU FAULT",
        12: "CONTROL / CMU BUS FAULT",
        13: "ANTENNA COUPLER FAULT",
        14: "PA OVERTEMP / VSWR",
        15: "DATA MODEM FAULT",
    }),
    "753 HFDR": _build_bit_map({
        11: "HFDR LRU FAULT",
        12: "CONTROL / CMU BUS FAULT",
        13: "ANTENNA COUPLER FAULT",
        14: "PA OVERTEMP / VSWR",
        15: "RF / DATA MODEM FAULT",
    }),
    "MANUAL ENTRY": _build_bit_map({
        11: "LRU FAULT",
        12: "CONTROL UNIT FAULT",
        13: "ANTENNA / SENSOR FAULT",
        14: "INTERFACE BUS FAULT",
        15: "TEST INHIBIT",
    }),
}

CMC_FUNCTION_SWITCHES: list[dict[str, Any]] = [
    {"code": 0, "label": "NO REQUEST",  "desc": "Idle / Clear Command"},
    {"code": 1, "label": "BITE TEST",   "desc": "Initiate LRU Self-Test"},
    {"code": 2, "label": "SHOP FAULTS", "desc": "Request Extended Shop Fault Data"},
    {"code": 3, "label": "FLIGHT",      "desc": "New Flight Leg Synchronization"},
    {"code": 4, "label": "LOGOFF",      "desc": "End BITE / Maintenance Session"},
    {"code": 5, "label": "CONFIG DATA", "desc": "Request LRU Configuration Data"},
]

DEFAULT_CMC_TX_PARAMS: dict[str, str] = {
    "date": "12/31/86",
    "time": "15:49.5",
    "flt_num": "99999999",
    "city_pairs": "DNVR MKCI",
    "flt_phase": "1",
    "aircraft_id": "N123456",
}

DEFAULT_CMC_AIRCRAFT_CONFIG: dict[str, bool] = {
    # Row 1 (10 items)
    "DATA_PRINTER": False,
    "DATA_LINK": False,
    "AIDS": False,
    "RMP3": False,
    "VHF3": False,
    "HF1": False,
    "HF2": False,
    "ADF2": False,
    "MLS1": False,
    "MLS2": False,
    # Row 2 (7 items)
    "WBS1": False,
    "RADAR2": False,
    "TPIS": False,
    "AFT_CRG/HT": False,
    "FWD_CRG/HT": False,
    "CRG/SMOKE": False,
    "WBS2": False,
}

CMC_AIRCRAFT_CONFIG_ORDER: list[str] = list(DEFAULT_CMC_AIRCRAFT_CONFIG.keys())

CMC_SLIDES = {
    "menu",
    "desired_mode",
    "edit_tx",
    "fault_summary",
    "command_summary",
    "channels",
}

CMC_SSM_MAP = {
    0: "00 (FAIL)",
    1: "01 (NCD)",
    2: "10 (TEST)",
    3: "11 (NML)",
}

CMC_SDI_MAP = {
    0: "ALL (00)",
    1: "1 (01)",
    2: "2 (10)",
    3: "3 (11)",
}


def resolve_cmc_lru(name_or_code: str) -> dict[str, str]:
    """Resolve LRU by name, short code, or equipment code, supporting MANUAL ENTRY."""
    q = (name_or_code or "").strip().upper()
    if q in ("MANUAL", "MANUAL ENTRY", "MANUAL_ENTRY"):
        return dict(MANUAL_LRU_DEFAULT)
    for row in CMC_LRU_TABLE:
        if q in (row["name"].upper(), row["short"].upper(), row["code"].upper()):
            return dict(row)
    # Check custom 3-char hex/octal equipment code (manual entry)
    cleaned = q[:3].zfill(3) if q else "007"
    out = dict(MANUAL_LRU_DEFAULT)
    out["code"] = cleaned
    out["short"] = cleaned
    return out


def _sdi_to_int(sdi: Any) -> int:
    if isinstance(sdi, int):
        return sdi & 0x3
    s = str(sdi or "ALL").strip().upper()
    if s in ("ALL", "0", "00"):
        return 0
    if s in ("1", "01", "L"):
        return 1
    if s in ("2", "10", "R"):
        return 2
    if s in ("3", "11", "C"):
        return 3
    return 0


def _sdi_to_str(sdi: Any) -> str:
    val = _sdi_to_int(sdi)
    return "ALL" if val == 0 else str(val)


def encode_cmc_label227(
    *,
    label: str = "227",
    eq_id: str = "000",
    function_code: int = 0,
    pad: str = "00",
    sdi: str | int = "ALL",
    parity: str = "ODD",
) -> tuple[int, str]:
    """Encode ARINC 604 Label 227 Command Summary Word."""
    try:
        eq_val = int(str(eq_id or "000").strip(), 16) & 0xFFF
    except ValueError:
        eq_val = 0
    try:
        pad_val = int(str(pad or "00").strip(), 2) & 0x7
    except ValueError:
        pad_val = 0
    fn_val = int(function_code) & 0x7
    data19 = (pad_val & 0x7) | ((fn_val & 0x7) << 3) | ((eq_val & 0xFFF) << 6)
    sdi_i = _sdi_to_int(sdi)
    odd = str(parity or "ODD").strip().upper() != "EVEN"
    raw = encode_raw_word(label or "227", data19, sdi=sdi_i, ssm=3, odd_parity=odd)
    return raw, f"0x{raw:08X}"


def encode_cmc_label350(
    bits: dict[int, int] | None = None,
    *,
    sdi: int = 0,
    ssm: int = 3,
    odd_parity: bool = True,
) -> tuple[int, str]:
    """Encode ARINC 604 Label 350 Fault Summary Word from bits 11-29."""
    data19 = 0
    for bit_num, val in (bits or {}).items():
        if 11 <= int(bit_num) <= 29 and int(val):
            data19 |= 1 << (int(bit_num) - 11)
    raw = encode_raw_word("350", data19, sdi=int(sdi) & 0x3, ssm=int(ssm) & 0x3, odd_parity=odd_parity)
    return raw, f"0x{raw:08X}"


def encode_cmc_transmit_words(
    tx_params: dict[str, str],
    aircraft_config: dict[str, bool],
) -> list[dict[str, Any]]:
    """Encode ARINC 604 CMC Transmit Words (Labels 260, 125, 126, 233-236, 170)."""
    words: list[dict[str, Any]] = []

    # Label 260 - DATE (DD/MM/YY)
    date_digits = [int(c) for c in str(tx_params.get("date", "12/31/86")) if c.isdigit()]
    date_digits = (date_digits + [0] * 6)[:6]
    date_bcd = 0
    for idx, d in enumerate(date_digits):
        date_bcd |= (d & 0xF) << ((idx % 4) * 4)
    date_raw = encode_raw_word("260", date_bcd & 0x7FFFF, sdi=0, ssm=0, odd_parity=True)
    words.append({"label": "260", "name": "DATE", "raw": date_raw, "hex": f"0x{date_raw:08X}"})

    # Label 125 - TIME (HH:MM.t UTC)
    time_digits = [int(c) for c in str(tx_params.get("time", "15:49.5")) if c.isdigit()]
    time_digits = (time_digits + [0] * 5)[:5]
    time_val = (
        (time_digits[0] * 10 + time_digits[1]) * 600
        + (time_digits[2] * 10 + time_digits[3]) * 10
        + time_digits[4]
    ) & 0x7FFFF
    time_raw = encode_raw_word("125", time_val, sdi=0, ssm=3, odd_parity=True)
    words.append({"label": "125", "name": "TIME", "raw": time_raw, "hex": f"0x{time_raw:08X}"})

    # Label 126 - FLIGHT PHASE
    try:
        phase = int(str(tx_params.get("flt_phase", "1")).strip()) & 0xF
    except ValueError:
        phase = 1
    phase_raw = encode_raw_word("126", phase, sdi=0, ssm=3, odd_parity=True)
    words.append({"label": "126", "name": "FLT_PHASE", "raw": phase_raw, "hex": f"0x{phase_raw:08X}"})

    # Labels 233-236 - ISO #5 Flight Number, City Pairs, Aircraft ID
    iso_sources = [
        ("233", "FLT_NUM", str(tx_params.get("flt_num", "99999999"))[:4]),
        ("234", "FLT_NUM_2", str(tx_params.get("flt_num", "99999999"))[4:8]),
        ("235", "CITY_PAIRS", str(tx_params.get("city_pairs", "DNVR MKCI"))[:4]),
        ("236", "AIRCRAFT_ID", str(tx_params.get("aircraft_id", "N123456"))[:4]),
    ]
    for lbl, field_name, chunk in iso_sources:
        padded = chunk.ljust(3)[:3]
        c0, c1, c2 = (ord(ch) & 0x3F for ch in padded)
        d19 = c0 | (c1 << 6) | (c2 << 12)
        raw = encode_raw_word(lbl, d19, sdi=0, ssm=3, odd_parity=True)
        words.append({"label": lbl, "name": field_name, "raw": raw, "hex": f"0x{raw:08X}"})

    # Label 170 - 17-bit Aircraft Configuration Word
    cfg_mask = 0
    for idx, key in enumerate(CMC_AIRCRAFT_CONFIG_ORDER):
        if aircraft_config.get(key, False):
            cfg_mask |= 1 << idx
    cfg_raw = encode_raw_word("170", cfg_mask & 0x7FFFF, sdi=0, ssm=3, odd_parity=True)
    words.append({"label": "170", "name": "AIRCRAFT_CONFIG", "raw": cfg_raw, "hex": f"0x{cfg_raw:08X}"})

    return words


def format_word_display(raw_word: int, mode: str) -> str:
    """Format 32-bit raw ARINC word according to ENG / BIN / HEX."""
    w = int(raw_word) & 0xFFFFFFFF
    m = str(mode or "ENG").strip().upper()
    if m == "BIN":
        b = format(w, "032b")
        return f"{b[0]} {b[1:3]} {b[3:22]} {b[22:24]} {b[24:32]}"
    if m == "HEX":
        return f"0x{w:08X}"
    # ENG: octal label + hex data + parity/ssm
    sdi = (w >> 8) & 0x3
    ssm = get_ssm_bits(w)
    d19 = get_data19(w)
    return f"LBL 350 | SDI={sdi:02b} | DATA=0x{d19:05X} | SSM={ssm:02b} | 0x{w:08X}"


def decode_cmc_label350(
    raw_word: int,
    *,
    lru_name: str = "707 LRA",
    display_mode: str = "ENG",
) -> dict[str, Any]:
    """Decode ARINC 429 Label 350 Fault Summary Word into structured fields + bit table."""
    w = int(raw_word) & 0xFFFFFFFF
    data19 = get_data19(w)
    sdi = (w >> 8) & 0x3
    ssm = get_ssm_bits(w)
    parity_odd = word_parity_odd(w)

    bit_map = CMC_FAULT_BIT_MAPS.get(lru_name, CMC_FAULT_BIT_MAPS["MANUAL ENTRY"])
    bits: list[dict[str, Any]] = []
    bit_dict: dict[int, int] = {}
    for bit_num in range(11, 30):
        status = (data19 >> (bit_num - 11)) & 1
        bit_dict[bit_num] = status
        bits.append({
            "bit": bit_num,
            "status": status,
            "function": bit_map.get(bit_num, "SPARE"),
        })

    return {
        "has_data": True,
        "raw_word": w,
        "hex_32": f"0x{w:08X}",
        "data19": data19,
        "sdi": sdi,
        "sdi_str": CMC_SDI_MAP.get(sdi, f"{sdi:02b}"),
        "ssm": ssm,
        "ssm_str": CMC_SSM_MAP.get(ssm, f"{ssm:02b}"),
        "parity": "ODD" if parity_odd else "EVEN",
        "formatted": format_word_display(w, display_mode),
        "bits": bits,
        "bit_dict": bit_dict,
    }


class CmcProtocolManager:
    """Thread-safe runtime state manager for Boeing CMC / Sensor BITE (ARINC 604)."""

    def __init__(self, simulation_mode: bool = False) -> None:
        self._lock = threading.RLock()
        self.simulation_mode = bool(simulation_mode)
        self.active = False

        self.selected_lru: dict[str, str] = dict(CMC_LRU_TABLE[0])  # Default 707 LRA (007)
        self.time_constant: str = "OFF"
        self.current_slide: str = "menu"

        self.tx_params: dict[str, str] = dict(DEFAULT_CMC_TX_PARAMS)
        self.aircraft_config: dict[str, bool] = dict(DEFAULT_CMC_AIRCRAFT_CONFIG)
        self.last_tx_words: list[dict[str, Any]] = []

        self.cmd_summary: dict[str, Any] = {
            "label": "227",
            "eq_id": "000",
            "function_code": 0,
            "function_label": "NO REQUEST",
            "pad": "00",
            "sdi": "ALL",
            "rate_ms": 1000,
            "parity": "ODD",
        }
        self.last_cmd_word: dict[str, Any] | None = None

        self.channels: dict[str, Any] = {
            "bit_rate_kbps": "12.5",
            "xmtr_select": "TX-A",
            "rcvr_select": "RX-A",
            "tx_enabled": {"A": True, "B": True, "C": True, "D": True},
            "display_mode": "ENG",
        }

        self.fault_has_data: bool = False
        self.fault_raw_word: int | None = None
        self.fault_rx_count: int = 0
        self.fault_last_rx_ts: str = ""
        self.sim_bit_overrides: dict[int, int] = {}

    def select_lru(
        self,
        lru_name_or_code: str,
        *,
        manual_code: str | None = None,
        time_constant: str | None = None,
        advance_to_mode: bool = True,
    ) -> dict[str, Any]:
        with self._lock:
            resolved = resolve_cmc_lru(lru_name_or_code)
            if manual_code is not None and str(manual_code).strip():
                cleaned = str(manual_code).strip().upper()[:3].zfill(3)
                resolved["code"] = cleaned
                if resolved["name"] == "MANUAL ENTRY":
                    resolved["short"] = cleaned
            self.selected_lru = resolved
            if time_constant is not None:
                self.time_constant = str(time_constant).strip()
            self.active = True
            self.sim_bit_overrides.clear()
            self.fault_has_data = False
            self.fault_raw_word = None
            self.fault_rx_count = 0
            self.cmd_summary["eq_id"] = "000"
            # Switch channel C 100k for 750 VDR when appropriate
            if resolved["name"] == "750 VDR":
                self.channels["bit_rate_kbps"] = "100"
                self.channels["xmtr_select"] = "TX-C"
                self.channels["rcvr_select"] = "RX-C"
            if advance_to_mode:
                self.current_slide = "desired_mode"
            return self.get_state()

    def set_slide(self, slide: str, *, active: bool | None = None) -> dict[str, Any]:
        with self._lock:
            s = str(slide or "menu").strip().lower()
            if s in CMC_SLIDES:
                self.current_slide = s
            if active is not None:
                self.active = bool(active)
            return self.get_state()

    def update_tx_params(
        self,
        *,
        tx_params: dict[str, str] | None = None,
        aircraft_config: dict[str, bool] | None = None,
        time_constant: str | None = None,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        with self._lock:
            if tx_params:
                for k in DEFAULT_CMC_TX_PARAMS:
                    if k in tx_params and tx_params[k] is not None:
                        self.tx_params[k] = str(tx_params[k])
            if aircraft_config:
                for k in DEFAULT_CMC_AIRCRAFT_CONFIG:
                    if k in aircraft_config:
                        self.aircraft_config[k] = bool(aircraft_config[k])
            if time_constant is not None:
                self.time_constant = str(time_constant).strip()
            encoded = encode_cmc_transmit_words(self.tx_params, self.aircraft_config)
            self.last_tx_words = encoded
            return self.get_state(), encoded

    def send_command(
        self,
        *,
        label: str | None = None,
        eq_id: str | None = None,
        function_code: int | None = None,
        pad: str | None = None,
        sdi: str | int | None = None,
        rate_ms: int | None = None,
        parity: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        with self._lock:
            if label is not None and str(label).strip():
                self.cmd_summary["label"] = str(label).strip().zfill(3)[:3]
            if eq_id is not None:
                cleaned_eq = str(eq_id).strip().upper()[:3].zfill(3) if str(eq_id).strip() else "000"
                self.cmd_summary["eq_id"] = cleaned_eq
            if function_code is not None:
                fn_i = max(0, min(5, int(function_code)))
                self.cmd_summary["function_code"] = fn_i
                self.cmd_summary["function_label"] = next(
                    (f["label"] for f in CMC_FUNCTION_SWITCHES if f["code"] == fn_i),
                    "NO REQUEST",
                )
            if pad is not None:
                p = str(pad).strip()
                self.cmd_summary["pad"] = p[:2].zfill(2) if p else "00"
            if sdi is not None:
                self.cmd_summary["sdi"] = _sdi_to_str(sdi)
            if rate_ms is not None:
                self.cmd_summary["rate_ms"] = max(20, min(10000, int(rate_ms)))
            if parity is not None:
                p_str = str(parity).strip().upper()
                self.cmd_summary["parity"] = "EVEN" if p_str == "EVEN" else "ODD"

            raw, hex_str = encode_cmc_label227(
                label=self.cmd_summary["label"],
                eq_id=self.cmd_summary["eq_id"],
                function_code=self.cmd_summary["function_code"],
                pad=self.cmd_summary["pad"],
                sdi=self.cmd_summary["sdi"],
                parity=self.cmd_summary["parity"],
            )
            cmd_record = {
                **self.cmd_summary,
                "raw_word": raw,
                "hex_32": hex_str,
                "timestamp": time.time(),
                "time_str": datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:12],
            }
            self.last_cmd_word = cmd_record

            # In simulation mode, reflect ARINC 604 LRU response on Label 350
            if self.simulation_mode:
                self._synthesize_sim_label350_locked()

            return self.get_state(), cmd_record

    def _synthesize_sim_label350_locked(self) -> None:
        fn = int(self.cmd_summary.get("function_code", 0))
        bits: dict[int, int] = dict(self.sim_bit_overrides)
        if fn != 0:
            bits[29] = 1  # CMND WORD ACKNOWLEDGE
            if fn in (2, 5):  # SHOP FAULTS / CONFIG DATA
                bits.setdefault(28, 1)  # DATA TRANSFER IN PROGRESS
            elif fn == 1:  # BITE TEST
                bits.setdefault(28, 0)
        else:
            bits.setdefault(29, 0)
        sdi_val = _sdi_to_int(self.cmd_summary.get("sdi", "ALL"))
        raw, _ = encode_cmc_label350(bits, sdi=sdi_val, ssm=3, odd_parity=True)
        self.fault_has_data = True
        self.fault_raw_word = raw
        self.fault_rx_count += 1
        self.fault_last_rx_ts = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:12]

    def toggle_sim_bit(self, bit_num: int, status: int | None = None) -> dict[str, Any]:
        with self._lock:
            b = int(bit_num)
            if not (11 <= b <= 29):
                return self.get_state()
            if self.simulation_mode:
                cur_val = 0
                if self.fault_raw_word is not None:
                    cur_val = (get_data19(self.fault_raw_word) >> (b - 11)) & 1
                new_val = (1 - cur_val) if status is None else (1 if int(status) else 0)
                self.sim_bit_overrides[b] = new_val
                # Re-encode current bits with override
                bits: dict[int, int] = {}
                if self.fault_raw_word is not None:
                    d19 = get_data19(self.fault_raw_word)
                    for idx in range(11, 30):
                        bits[idx] = (d19 >> (idx - 11)) & 1
                bits[b] = new_val
                sdi_val = _sdi_to_int(self.cmd_summary.get("sdi", "ALL"))
                raw, _ = encode_cmc_label350(bits, sdi=sdi_val, ssm=3, odd_parity=True)
                self.fault_has_data = True
                self.fault_raw_word = raw
                self.fault_rx_count += 1
                self.fault_last_rx_ts = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:12]
            return self.get_state()

    def set_channels(
        self,
        *,
        bit_rate_kbps: str | None = None,
        xmtr_select: str | None = None,
        rcvr_select: str | None = None,
        tx_enabled: dict[str, bool] | None = None,
        display_mode: str | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            if bit_rate_kbps is not None:
                br = str(bit_rate_kbps).strip()
                if br in ("12.5", "100"):
                    self.channels["bit_rate_kbps"] = br
            if xmtr_select is not None:
                xs = str(xmtr_select).strip().upper()
                if xs in ("TX-A", "TX-B", "TX-C", "TX-D"):
                    self.channels["xmtr_select"] = xs
            if rcvr_select is not None:
                rs = str(rcvr_select).strip().upper()
                if rs in ("RX-A", "RX-B", "RX-C", "RX-D"):
                    self.channels["rcvr_select"] = rs
            if tx_enabled:
                for ch in ("A", "B", "C", "D"):
                    if ch in tx_enabled:
                        self.channels["tx_enabled"][ch] = bool(tx_enabled[ch])
            if display_mode is not None:
                dm = str(display_mode).strip().upper()
                if dm in ("ENG", "BIN", "HEX"):
                    self.channels["display_mode"] = dm
            return self.get_state()

    def apply_sim_mode(self, enabled: bool) -> dict[str, Any]:
        """Switch CMC simulation override cleanly; SIM:OFF clears sim buffer so NO WORDS RECEIVED shows."""
        with self._lock:
            self.simulation_mode = bool(enabled)
            if not self.simulation_mode:
                self.fault_has_data = False
                self.fault_raw_word = None
                self.fault_rx_count = 0
                self.sim_bit_overrides.clear()
            else:
                self._synthesize_sim_label350_locked()
            return self.get_state()

    def refresh_screen(self, is_simulation: bool) -> dict[str, Any]:
        """Refresh Fault Summary / Command state."""
        with self._lock:
            self.simulation_mode = bool(is_simulation)
            if self.simulation_mode:
                self._synthesize_sim_label350_locked()
            else:
                self.fault_has_data = False
                self.fault_raw_word = None
                self.fault_rx_count = 0
                raw, hex_str = encode_cmc_label227(
                    label=self.cmd_summary["label"],
                    eq_id=self.cmd_summary["eq_id"],
                    function_code=self.cmd_summary["function_code"],
                    pad=self.cmd_summary["pad"],
                    sdi=self.cmd_summary["sdi"],
                    parity=self.cmd_summary["parity"],
                )
                self.last_cmd_word = {
                    **self.cmd_summary,
                    "raw_word": raw,
                    "hex_32": hex_str,
                    "timestamp": time.time(),
                    "time_str": datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:12],
                }
            return self.get_state()

    def ingest_rx_word(self, raw_word: int, label_octal: str) -> bool:
        """Ingest physical or simulated Label 350 ARINC 429 word from bus."""
        if str(label_octal).strip() != "350":
            return False
        with self._lock:
            self.fault_has_data = True
            self.fault_raw_word = int(raw_word) & 0xFFFFFFFF
            self.fault_rx_count += 1
            self.fault_last_rx_ts = datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:12]
            return True

    def get_state(self) -> dict[str, Any]:
        with self._lock:
            lru_name = self.selected_lru["name"]
            bit_map = CMC_FAULT_BIT_MAPS.get(lru_name, CMC_FAULT_BIT_MAPS["MANUAL ENTRY"])
            display_mode = self.channels.get("display_mode", "ENG")

            if self.fault_has_data and self.fault_raw_word is not None:
                decoded = decode_cmc_label350(
                    self.fault_raw_word,
                    lru_name=lru_name,
                    display_mode=display_mode,
                )
            else:
                decoded = {
                    "has_data": False,
                    "raw_word": None,
                    "hex_32": "",
                    "data19": 0,
                    "sdi": 0,
                    "sdi_str": "ALL (00)",
                    "ssm": 0,
                    "ssm_str": "00",
                    "parity": self.cmd_summary["parity"],
                    "formatted": "NO WORDS RECEIVED",
                    "bits": [
                        {
                            "bit": b,
                            "status": 0,
                            "function": bit_map.get(b, "SPARE"),
                        }
                        for b in range(11, 30)
                    ],
                    "bit_dict": {b: 0 for b in range(11, 30)},
                }

            return {
                "active": self.active,
                "simulation_mode": self.simulation_mode,
                "selected_lru": dict(self.selected_lru),
                "time_constant": self.time_constant,
                "current_slide": self.current_slide,
                "tx_params": dict(self.tx_params),
                "aircraft_config": dict(self.aircraft_config),
                "last_tx_words": list(self.last_tx_words),
                "cmd_summary": dict(self.cmd_summary),
                "last_cmd_word": dict(self.last_cmd_word) if self.last_cmd_word else None,
                "channels": {
                    "bit_rate_kbps": self.channels["bit_rate_kbps"],
                    "xmtr_select": self.channels["xmtr_select"],
                    "rcvr_select": self.channels["rcvr_select"],
                    "tx_enabled": dict(self.channels["tx_enabled"]),
                    "display_mode": self.channels["display_mode"],
                },
                "fault_summary": decoded,
                "fault_rx_count": self.fault_rx_count,
                "fault_last_rx_ts": self.fault_last_rx_ts,
                "lru_table": CMC_LRU_TABLE,
                "function_switches": CMC_FUNCTION_SWITCHES,
                "aircraft_config_keys": CMC_AIRCRAFT_CONFIG_ORDER,
            }
