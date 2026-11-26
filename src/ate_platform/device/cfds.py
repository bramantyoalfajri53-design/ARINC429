"""CFDS Protocol Engine (Aeroflex JcAIR T1200B / ABD0018 & ABD0048).

Implements:
1. CFDS LRU Table for 19 avionics LRUs + MANUAL ENTRY.
2. Complete 10-slide state model (Menu, Desired Mode, Edit TX, Operation Hub, Channels,
   Normal Mode ABD0018/0048, Menu Mode ABD0018, Interactive Mode ABD0048, Discrete Mode ABD0048).
3. Authentic 709 DME menu tree simulation (14 screens x 14 rows x 24 chars) driven via
   ARINC 429 Label 356 (ISO #5) encoder & decoder pipeline.
4. Dynamic ARINC 429 Label 356 packet assembler & MCDU 14x24 character grid.
5. Dynamic Label 350/355/356 Discrete Fault decoder (11 failure fields).
6. Label 227 BITE command word encoder & key handler.
7. 17 Aircraft Configuration Word toggles (Label 170 / 301-303).
8. Thread-safe runtime state management.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any

from ate_platform.device.arinc_encode import encode_raw_word

# 19 CFDS LRUs defined per JcAIR T1200B Hardware Slide 1
CFDS_LRU_TABLE = [
    # Row 1 (10 LRUs)
    {"code": "007", "short": "RALT",  "name": "707 LRA",   "desc": "Low Range Radio Altimeter", "bus": "A", "speed": "12.5k"},
    {"code": "008", "short": "WXR",   "name": "708 WXR",   "desc": "Weather Radar", "bus": "A", "speed": "12.5k"},
    {"code": "009", "short": "DME",   "name": "709 DME",   "desc": "Distance Measuring Equipment", "bus": "A", "speed": "12.5k"},
    {"code": "010", "short": "ILS",   "name": "710 ILS",   "desc": "Instrument Landing System", "bus": "A", "speed": "12.5k"},
    {"code": "011", "short": "VOR",   "name": "711 VOR",   "desc": "VHF Omnidirectional Range", "bus": "A", "speed": "12.5k"},
    {"code": "012", "short": "ADF",   "name": "712 ADF",   "desc": "Automatic Direction Finder", "bus": "A", "speed": "12.5k"},
    {"code": "016", "short": "VHF",   "name": "716 VHF",   "desc": "VHF Communication Transceiver", "bus": "A", "speed": "12.5k"},
    {"code": "018", "short": "ATC",   "name": "718 ATC",   "desc": "Air Traffic Control Transponder", "bus": "A", "speed": "12.5k"},
    {"code": "019", "short": "HF",    "name": "719 HF",    "desc": "High Frequency Communication Transceiver", "bus": "A", "speed": "12.5k"},
    {"code": "023", "short": "GPWS",  "name": "723 GPWS",  "desc": "Ground Proximity Warning System", "bus": "A", "speed": "12.5k"},
    # Row 2 (6 LRUs + Manual Entry)
    {"code": "024", "short": "ACARS", "name": "724 ACARS", "desc": "ARINC Comm Addressing & Reporting System", "bus": "A", "speed": "12.5k"},
    {"code": "027", "short": "MLS",   "name": "727 MLS",   "desc": "Microwave Landing System", "bus": "A", "speed": "12.5k"},
    {"code": "035", "short": "TCAS",  "name": "735 TCAS",  "desc": "Traffic Alert & Collision Avoidance System", "bus": "A", "speed": "12.5k"},
    {"code": "040", "short": "PRNTR", "name": "740 PRNTR", "desc": "Cockpit Printer", "bus": "A", "speed": "12.5k"},
    {"code": "041", "short": "SATCM", "name": "741 SATCM", "desc": "Satellite Communication System", "bus": "A", "speed": "12.5k"},
    {"code": "018", "short": "ATC/S", "name": "718 ATC/S", "desc": "ATC Mode S Transponder", "bus": "A", "speed": "12.5k"},
    # Row 3 (3 LRUs)
    {"code": "050", "short": "VDR",   "name": "750 VDR",   "desc": "VHF Data Radio (High-Speed Channel C)", "bus": "C", "speed": "100k"},
    {"code": "053", "short": "HFDU",  "name": "753 HFDU",  "desc": "HF Data Unit", "bus": "A", "speed": "12.5k"},
    {"code": "053", "short": "HFDR",  "name": "753 HFDR",  "desc": "HF Data Radio", "bus": "A", "speed": "12.5k"},
]

# 17 Aircraft Configuration Word Toggles (Slide 3)
DEFAULT_AIRCRAFT_CONFIG = {
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

# 11 Discrete Mode Fields (Slide 10)
DEFAULT_DISCRETE_FIELDS = {
    "failure_number": "",
    "failure_type_code": "",
    "failure_type_string": "",
    "witness_position": "",
    "witness_side": "",
    "suspect1_position": "",
    "suspect1_side": "",
    "suspect2_position": "",
    "suspect2_side": "",
    "suspect3_position": "",
    "suspect3_side": "",
}

# Authentic 709 DME CFDS 16-Screen Menu Tree (14 rows x 24 chars, JcAIR/Collins T1200B)
DME_709_MENU_SCREENS: dict[str, list[str]] = {
    "root": [
        "         DME-0          ",
        "                        ",
        "<LAST LEG REPORT        ",
        "                        ",
        "<PREVIOUS LEGS REPORT   ",
        "                        ",
        "<LRU IDENTIFICATION     ",
        "                        ",
        "<TEST                   ",
        "                        ",
        "<SHOP DATA              ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "last_leg": [
        "         DME-0          ",
        "    last leg report     ",
        "date: jan 01  gmt   ata ",
        "------------------------",
        "dme-0 transceiver       ",
        "          0000 34-51-33 ",
        "(2)                     ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "prev_legs": [
        "         DME-0          ",
        "  previous legs report  ",
        "leg date  gmt   ata     ",
        "------------------------",
        "dme-0 transceiver       ",
        "-01 jan00 0000 34-51-33 ",
        "dme-0 transceiver (2)   ",
        "-02 jan00 0000 34-51-33 ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "lru_id": [
        "         DME-0          ",
        "   lru identification   ",
        "------------------------",
        "                        ",
        "transceiver p/n:        ",
        " 822-0329-001           ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "test": [
        "         DME-0          ",
        "          test          ",
        "------------------------",
        "                        ",
        "dme-0                   ",
        "no data from            ",
        "control source          ",
        "ata: 34-51-23           ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "shop_data": [
        "         DME-0          ",
        "       shop data        ",
        "                        ",
        "                        ",
        "<ENTER SHOP VISIT       ",
        "                        ",
        "<DISPLAY FAULT DATA     ",
        "                        ",
        "<SOFTWARE ID            ",
        "                        ",
        "<SPECIAL FUNCTIONS      ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "shop_visit": [
        "         DME-0          ",
        "       shop visit       ",
        "                        ",
        "                        ",
        "PRESS LEFT FUNCTION 2   ",
        "TO ENTER SHOP VISIT     ",
        "{SHOP_VISIT_STATUS}     ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "display_fault": [
        "         DME-0          ",
        "   display fault data   ",
        "                        ",
        "                        ",
        "<LAST LEG REPORT        ",
        "                        ",
        "<PREVIOUS LEGS REPORT   ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "software_id": [
        "         DME-0          ",
        "      software id       ",
        "------------------------",
        "                        ",
        "829-4471-013            ",
        "                        ",
        "rom test ok             ",
        "                        ",
        "ram test ok             ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "special_func": [
        "         DME-0          ",
        " special function menu  ",
        "                        ",
        "                        ",
        "<SET RCVR      AGC TEST>",
        "                        ",
        "<BUS IN TEST A; B; CFDIU",
        "                        ",
        "{FIXED_XMIT_LINE}       ",
        "                        ",
        "<SELF-TEST TGT   MENU 2>",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "self_test_tgt": [
        "         DME-0          ",
        "     special func-      ",
        " self-test-target list  ",
        "                        ",
        "x-channel               ",
        "  first   last          ",
        "  826b    fe6b          ",
        "                        ",
        "y-channel               ",
        "  first   last          ",
        "  8197    fd97          ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "agc_test": [
        "         DME-0          ",
        "    special func-agc    ",
        "                        ",
        "                        ",
        "current value  agc [{AGC}]",
        "                        ",
        "<FULL GAIN   FF         ",
        "                        ",
        "<MID GAIN    A0         ",
        "                        ",
        "<MIN GAIN    00         ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "menu_2": [
        "         DME-0          ",
        "         menu 2         ",
        "                        ",
        "                        ",
        "<FORMAT NON VOLATILE    ",
        "                        ",
        "<ERASE NON-VOLATILE     ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "nvm_result": [
        "         DME-0          ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "  0000 bytes bad        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
}


def decode_iso5_ascii(raw_word: int) -> str:
    """Decode up to 3 7-bit ASCII characters from ARINC 429 word (bits 11..31)."""
    # Bits 11-17: Char 1, Bits 18-24: Char 2, Bits 25-31: Char 3
    c1 = (raw_word >> 10) & 0x7F
    c2 = (raw_word >> 17) & 0x7F
    c3 = (raw_word >> 24) & 0x7F
    chars = []
    for c in (c1, c2, c3):
        if 32 <= c <= 126:
            chars.append(chr(c))
    return "".join(chars)


def decode_iso5_hex(data_hex: str) -> str:
    """Decode 3 packed 7-bit ASCII bytes from 24-bit Label 356 data hex."""
    padded = str(data_hex).strip().upper().zfill(6)
    try:
        b1 = int(padded[4:6], 16) & 0x7F
        b2 = int(padded[2:4], 16) & 0x7F
        b3 = int(padded[0:2], 16) & 0x7F
        return "".join(chr(code) for code in (b1, b2, b3) if 32 <= code <= 126)
    except Exception:
        return ""


def encode_chars_to_label356(c1: str, c2: str, c3: str) -> int:
    """Encode 3 ASCII characters into 32-bit ARINC 429 Label 356 word (bits 11..31)."""
    b1 = ord(c1) & 0x7F
    b2 = ord(c2) & 0x7F
    b3 = ord(c3) & 0x7F
    # Wire label 356 octal is 0xEE (bits 1..8)
    # SDI bits 9..10 are 00
    # Bit 11..17: Char 1 (shift 10)
    # Bit 18..24: Char 2 (shift 17)
    # Bit 25..31: Char 3 (shift 24)
    raw = 0xEE | (b1 << 10) | (b2 << 17) | (b3 << 24)
    # Odd parity on bit 32
    cnt = bin(raw & 0x7FFFFFFF).count("1")
    if cnt % 2 == 0:
        raw |= 1 << 31
    return raw


def encode_screen_to_label356_words(lines: list[str], agc_val: str = "00") -> list[int]:
    """Encode 14 lines x 24 chars MCDU page into 112 Label 356 words."""
    words: list[int] = []
    for line in lines[:14]:
        rendered = line.replace("{AGC}", str(agc_val)[:2]).ljust(24)[:24]
        for col in range(0, 24, 3):
            w = encode_chars_to_label356(rendered[col], rendered[col + 1], rendered[col + 2])
            words.append(w)
    while len(words) < 112:
        words.append(encode_chars_to_label356(" ", " ", " "))
    return words


def handle_dme_key_navigation(
    current_screen: str,
    key: str,
    agc_val: str,
    caller_screen: str = "root",
) -> tuple[str, str, str, str | None]:
    """State transition handler for authentic 16-screen 709 DME menu simulation.

    Returns (next_screen, updated_agc_val, updated_caller_screen, action_signal).
    """
    k = str(key).strip().upper()
    cur = str(current_screen).lower()
    if cur == "main":
        cur = "root"

    # Universal MENU key returns to root menu
    if k == "MENU":
        return "root", agc_val, "root", None

    if cur == "root":
        if k in ("1", "1L", "A"):
            return "last_leg", agc_val, "root", None
        elif k in ("2", "2L", "B"):
            return "prev_legs", agc_val, "root", None
        elif k in ("3", "3L", "C"):
            return "lru_id", agc_val, "root", None
        elif k in ("4", "4L", "D"):
            return "test", agc_val, "root", None
        elif k in ("5", "5L", "E"):
            return "shop_data", agc_val, "root", None
        elif k in ("6", "6L", "F", "CLR"):
            return "root", agc_val, "root", None

    elif cur in ("last_leg", "prev_legs"):
        if k in ("6", "6L", "F", "PRV", "CLR"):
            ret_target = caller_screen if caller_screen in ("root", "display_fault") else "root"
            return ret_target, agc_val, "root", None

    elif cur in ("lru_id", "test", "shop_data"):
        if cur == "shop_data":
            if k in ("2", "2L", "B"):
                return "shop_visit", agc_val, caller_screen, None
            elif k in ("3", "3L", "C"):
                return "display_fault", agc_val, caller_screen, None
            elif k in ("4", "4L", "D"):
                return "software_id", agc_val, caller_screen, None
            elif k in ("5", "5L", "E"):
                return "special_func", agc_val, caller_screen, None
        if k in ("6", "6L", "F", "PRV", "CLR"):
            return "root", agc_val, "root", None

    elif cur in ("shop_visit", "display_fault", "software_id", "special_func"):
        if cur == "shop_visit" and k in ("2", "2L", "B"):
            return "shop_visit", agc_val, caller_screen, "enter_shop_visit"
        elif cur == "display_fault":
            if k in ("2", "2L", "B"):
                return "last_leg", agc_val, "display_fault", None
            elif k in ("3", "3L", "C"):
                return "prev_legs", agc_val, "display_fault", None
        elif cur == "special_func":
            if k in ("2", "2L"):
                return "set_rcvr", agc_val, caller_screen, None
            elif k in ("B", "2R"):
                return "agc_test", agc_val, caller_screen, None
            elif k in ("3", "3L", "C"):
                return "bus_in", agc_val, caller_screen, None
            elif k in ("4", "4L", "D"):
                return "special_func", agc_val, caller_screen, "toggle_xmit"
            elif k in ("5", "5L"):
                return "self_test_tgt", agc_val, caller_screen, None
            elif k in ("E", "5R"):
                return "menu_2", agc_val, caller_screen, None
        if k in ("6", "6L", "F", "PRV", "CLR"):
            return "shop_data", agc_val, "root", None

    elif cur == "set_rcvr":
        if k in ("1", "1L"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:1X"
        elif k in ("A", "1R"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:17X"
        elif k in ("2", "2L"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:32X"
        elif k in ("B", "2R"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:48X"
        elif k in ("3", "3L"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:64X"
        elif k in ("C", "3R"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:75X"
        elif k in ("4", "4L"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:95X"
        elif k in ("D", "4R"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:1Y"
        elif k in ("5", "5L"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:126X"
        elif k in ("E", "5R"):
            return "set_rcvr", agc_val, caller_screen, "rcvr:toggle"
        elif k in ("6", "6L", "F", "PRV", "CLR"):
            return "special_func", agc_val, caller_screen, None

    elif cur == "agc_test":
        if k in ("3", "3L", "C"):
            return "agc_test", "FF", caller_screen, None
        elif k in ("4", "4L", "D"):
            return "agc_test", "A0", caller_screen, None
        elif k in ("5", "5L", "E"):
            return "agc_test", "00", caller_screen, None
        elif k in ("6", "6L", "F", "PRV", "CLR"):
            return "special_func", agc_val, caller_screen, None

    elif cur == "bus_in":
        if k in ("2", "2L", "B"):
            return "bus_in", agc_val, caller_screen, "bus:a"
        elif k in ("3", "3L", "C"):
            return "bus_in", agc_val, caller_screen, "bus:b"
        elif k in ("4", "4L", "D"):
            return "bus_in", agc_val, caller_screen, "bus:cfdiu"
        elif k in ("5", "5L", "E"):
            return "bus_in", agc_val, caller_screen, "bus:read"
        elif k in ("6", "6L", "F", "PRV", "CLR"):
            return "special_func", agc_val, caller_screen, None

    elif cur == "self_test_tgt":
        if k in ("6", "6L", "F", "PRV", "CLR"):
            return "special_func", agc_val, caller_screen, None

    elif cur == "menu_2":
        if k in ("2", "2L", "B"):
            return "nvm_result", agc_val, caller_screen, None
        elif k in ("3", "3L", "C"):
            return "nvm_result", agc_val, caller_screen, None
        elif k in ("6", "6L", "F", "PRV", "CLR"):
            return "special_func", agc_val, caller_screen, None

    elif cur == "nvm_result":
        if k in ("6", "6L", "F", "PRV", "CLR"):
            return "menu_2", agc_val, caller_screen, None

    return cur, agc_val, caller_screen, None


def handle_generic_lru_key_navigation(current_screen: str, key: str) -> str:
    """State transition handler for simulated CFDS screens on non-DME LRUs."""
    k = str(key).strip().upper()
    cur = str(current_screen).lower()

    if k == "MENU":
        return "root"

    if cur == "root":
        if k in ("1", "1L", "A"):
            return "last_leg"
        elif k in ("2", "2L", "B"):
            return "prev_legs"
        elif k in ("3", "3L", "C"):
            return "lru_id"
        elif k in ("4", "4L", "D"):
            return "test"
        elif k in ("5", "5L", "E"):
            return "ground_scan"
        elif k == "NXT":
            return "page2"
        elif k in ("6", "6L", "F", "CLR"):
            return "root"
    elif cur == "page2":
        if k in ("2", "2L", "B"):
            return "class3"
        elif k in ("6", "6L", "F", "PRV", "CLR"):
            return "root"
    elif cur in ("last_leg", "prev_legs", "lru_id", "test", "ground_scan", "class3"):
        if k in ("6", "6L", "F", "PRV", "CLR"):
            return "root"

    return cur


def encode_label227_word(
    equipment_code: str,
    command_code: int,
    sdi: int = 0,
    ready: bool = False,
    bit12: bool = False,
) -> tuple[int, str]:
    """Encode ARINC 429 Label 227 CFDIU BITE Command Word."""
    try:
        eq_val = int(str(equipment_code), 16) & 0xFFF
    except ValueError:
        eq_val = 0x009
    cmd_val = int(command_code) & 0x7F
    sdi_val = int(sdi) & 0b11

    # Data 19 bits:
    # bit 0 (bit 11 on wire): ready
    # bit 1 (bit 12 on wire): bit12 / clr
    # bits 2..13 (bits 13..24): Equipment Code 12-bit
    # bits 14..18 (bits 25..29): Command Code low 5 bits
    data_19bit = (
        ((cmd_val & 0x1F) << 14)
        | (eq_val << 2)
        | ((1 if bit12 else 0) << 1)
        | (1 if ready else 0)
    )
    # SSM bits 30..31: Command Code high bits 5..6
    ssm_val = (cmd_val >> 5) & 0b11

    # Label 227 octal is wire 0xE9
    raw_word = encode_raw_word(
        label="227",
        data=data_19bit,
        sdi=sdi_val,
        ssm=ssm_val,
        odd_parity=True,
    )
    return raw_word, f"0x{raw_word:08X}"


class CfdsProtocolManager:
    """Thread-safe manager for all CFDS operating modes and live telemetry."""

    def __init__(self, simulation_mode: bool = True) -> None:
        self._lock = threading.RLock()
        self.active = False
        self.simulation_mode = simulation_mode
        self.current_slide = "menu"  # menu (1), desired_mode (2), edit_tx (3), op_mode_hub (4), channels (5), ...
        self.selected_lru = dict(CFDS_LRU_TABLE[2])  # Default 709 DME (code: 009)

        # Slide 3: TX Parameters
        self.tx_params = {
            "date": "12/31/86",
            "time": "15:49.5",
            "flt_num": "9999999999",
            "city_pairs": "DNVR MKCI",
            "flt_phase": 1,
            "aircraft_id": "N123456 63153",
            "shop_code": "N12345",
        }
        self.aircraft_config = dict(DEFAULT_AIRCRAFT_CONFIG)

        # Slide 4/6/8: Operation Mode State
        self.op_mode = "NORMAL_0018"  # NORMAL_0018, MENU_0018, NORMAL_0048, INTERACTIVE_0048, DISCRETE_0048
        self.flight_phase_mode = "GROUND"  # GROUND / AIR

        # Slide 5: Channels config
        self.channel_config = {
            "A": {"bit_rate": 12.5, "tx_enable": True, "rx_enable": True},
            "B": {"bit_rate": 12.5, "tx_enable": True, "rx_enable": True},
            "C": {"bit_rate": 100.0, "tx_enable": False, "rx_enable": False},
            "D": {"bit_rate": 100.0, "tx_enable": False, "rx_enable": False},
            "xmtr_select": "A",
            "rcvr_select": "A",
            "display_mode": "ENG",
        }

        # Slide 6/8: Normal Mode Messages Log
        self.normal_messages: list[dict[str, Any]] = []

        # Slide 7 & 9: MCDU Screen (14 lines x 24 chars)
        self.mcdu_lines: list[str] = ["" for _ in range(14)]
        self.mcdu_has_data: bool = False
        self.mcdu_status: str = "WAITING FOR LRU MENU DATA (LABEL 356)..."
        self.dme_current_screen: str = "root"
        self.dme_caller_screen: str = "root"
        self.dme_agc_val: str = "00"
        self.dme_fixed_xmit_rate: str = "OFF"
        self.dme_shop_visited: bool = False
        self.dme_rcvr_channel: str = "1X"
        self.dme_bus_sel: dict[str, bool] = {"a": True, "b": False, "cfdiu": True}
        self.dme_bus_data: dict[str, str] = {"a": "000000h", "b": "000000h", "cfdiu": "000000h"}
        self.generic_current_screen: str = "root"
        self.current_screen: str = "root"
        self.interactive_progress: int = 0
        self.interactive_status: str = "READY"

        # Slide 10: Discrete Mode 11 fields
        self.discrete_has_data: bool = False
        self.discrete_fields: dict[str, str] = dict(DEFAULT_DISCRETE_FIELDS)

        # Last TX Word Command record
        self.last_tx_command: dict[str, Any] | None = None

    def get_state(self, rx_bus: str = "A") -> dict[str, Any]:
        """Return snapshot of CFDS protocol state for web client."""
        with self._lock:
            # Format MCDU lines ensuring exact 24-char width padding
            formatted_mcdu = [line.ljust(24)[:24] for line in self.mcdu_lines]
            has_text = any(bool(line.strip()) for line in formatted_mcdu)
            has_data = bool(self.mcdu_has_data or has_text)

            return {
                "active": self.active,
                "simulation_mode": self.simulation_mode,
                "is_simulation": self.simulation_mode,
                "current_slide": self.current_slide,
                "selected_lru": dict(self.selected_lru),
                "lru_table": list(CFDS_LRU_TABLE),
                "tx_params": dict(self.tx_params),
                "aircraft_config": dict(self.aircraft_config),
                "op_mode": self.op_mode,
                "flight_phase_mode": self.flight_phase_mode,
                "channel_config": dict(self.channel_config),
                "normal_messages": list(self.normal_messages),
                "mcdu_lines": formatted_mcdu,
                "lines": formatted_mcdu,
                "mcdu_has_data": has_data,
                "has_data": has_data,
                "mcdu_status": self.mcdu_status,
                "dme_current_screen": self.dme_current_screen,
                "current_screen": self.dme_current_screen if self.selected_lru.get("code") == "009" else self.generic_current_screen,
                "interactive_progress": self.interactive_progress,
                "interactive_status": self.interactive_status,
                "discrete_has_data": self.discrete_has_data,
                "discrete_fields": dict(self.discrete_fields),
                "last_tx_command": self.last_tx_command,
            }

    def select_lru(self, code: str, name: str | None = None, short: str | None = None) -> dict[str, Any]:
        """Select LRU by equipment code, navigating to Slide 2."""
        with self._lock:
            self.active = True
            c = str(code).strip().upper().zfill(3)
            # Find in table
            found = next((item for item in CFDS_LRU_TABLE if item["code"] == c), None)
            if found:
                self.selected_lru = dict(found)
            else:
                self.selected_lru = {
                    "code": c,
                    "short": (short or "MANUAL").upper()[:6],
                    "name": (name or f"LRU {c}").upper(),
                    "desc": f"Custom Avionics LRU (Equipment Code {c})",
                    "bus": "A",
                    "speed": "12.5k",
                }
            self.current_slide = "desired_mode"
            # Auto set channel C for VDR
            if self.selected_lru["code"] == "050":
                self.channel_config["xmtr_select"] = "C"
                self.channel_config["rcvr_select"] = "A"

            # Reset runtime RX buffers for newly selected LRU
            self.mcdu_has_data = False
            self.mcdu_lines = ["" for _ in range(14)]
            self.mcdu_status = "WAITING FOR LRU MENU DATA (LABEL 356)..."
            self.dme_current_screen = "root"
            self.dme_caller_screen = "root"
            self.dme_agc_val = "00"
            self.dme_fixed_xmit_rate = "OFF"
            self.dme_shop_visited = False
            self.dme_rcvr_channel = "1X"
            self.dme_bus_sel = {"a": True, "b": False, "cfdiu": True}
            self.dme_bus_data = {"a": "000000h", "b": "000000h", "cfdiu": "000000h"}
            self.generic_current_screen = "root"
            self.current_screen = "root"
            self.normal_messages.clear()
            self.discrete_has_data = False
            self.discrete_fields = dict(DEFAULT_DISCRETE_FIELDS)
            return self.get_state()

    def set_slide(self, slide: str) -> dict[str, Any]:
        """Switch current slide/view or op-mode (menu_0018, interactive_0048, normal_0018, ...)."""
        with self._lock:
            s = str(slide).strip().lower()
            op_map = {
                "normal_0018": "NORMAL_0018",
                "menu_0018": "MENU_0018",
                "normal_0048": "NORMAL_0048",
                "interactive_0048": "INTERACTIVE_0048",
                "discrete_0048": "DISCRETE_0048",
            }
            if s in op_map:
                self.op_mode = op_map[s]
            self.current_slide = s

            # In simulation mode: entering Menu or Interactive mode auto-loads simulated menu via Label 356
            if s in ("menu_0018", "interactive_0048") and self.simulation_mode:
                if self.selected_lru.get("code") == "009":
                    self.load_dme_screen(self.dme_current_screen or "root")
                else:
                    self.load_generic_lru_screen(self.generic_current_screen or "root")
            return self.get_state()

    def apply_sim_mode(self, enabled: bool) -> dict[str, Any]:
        """Apply explicit CFDS simulation toggle ON/OFF without altering other subsystems."""
        with self._lock:
            self.simulation_mode = bool(enabled)
            slide = str(self.current_slide).lower()
            eq = self.selected_lru.get("code", "009")

            if self.simulation_mode:
                if slide in ("menu_0018", "interactive_0048"):
                    if eq == "009":
                        self.load_dme_screen(self.dme_current_screen or "root")
                    else:
                        self.load_generic_lru_screen(self.generic_current_screen or "root")
                elif slide in ("normal_0018", "normal_0048"):
                    if not self.normal_messages:
                        self.simulate_test_scenario("NORMAL", eq)
                elif slide == "discrete_0048":
                    self.simulate_test_scenario("DISCRETE", eq)
            else:
                # Disable simulation: clear simulated buffers so display returns to live hardware bus waiting state
                self.mcdu_lines = ["" for _ in range(14)]
                self.mcdu_has_data = False
                self.mcdu_status = "WAITING FOR LRU MENU DATA (LABEL 356)..."
                self.normal_messages.clear()
                self.discrete_has_data = False
                self.discrete_fields = dict(DEFAULT_DISCRETE_FIELDS)

            return self.get_state()

    def _encode_and_commit_mcdu_lines(self, rendered_lines: list[str], status_text: str) -> None:
        """Encode 14x24 lines through ARINC 429 Label 356 ISO #5 and decode back to MCDU buffer."""
        words = encode_screen_to_label356_words(rendered_lines, self.dme_agc_val)
        decoded_lines: list[str] = []
        for row in range(14):
            row_words = words[row * 8 : (row + 1) * 8]
            row_str = "".join(decode_iso5_ascii(w) for w in row_words)
            decoded_lines.append(row_str.ljust(24)[:24])

        self.mcdu_lines = decoded_lines
        self.mcdu_has_data = True
        self.mcdu_status = status_text

    def render_dme_screen(self, screen_id: str) -> list[str]:
        """Build 14x24 rendered lines for any of the 16 DME-0 screens."""
        s_id = str(screen_id).lower()
        if s_id == "main":
            s_id = "root"

        if s_id == "set_rcvr":
            ch = self.dme_rcvr_channel
            def _pair(left_ch: str, right_ch: str, right_label: str | None = None) -> str:
                l_txt = f"<{left_ch}{'*' if ch == left_ch else ' '}"
                r_lbl = right_label or right_ch
                r_txt = f"{'*' if ch == right_ch else ' '}{r_lbl}>"
                gap = max(1, 24 - len(l_txt) - len(r_txt))
                return (l_txt + (" " * gap) + r_txt)[:24]

            return [
                "         DME-0          ",
                " special func-set rcvr  ",
                _pair("1X", "17X"),
                "                        ",
                _pair("32X", "48X"),
                "                        ",
                _pair("64X", "75X"),
                "                        ",
                _pair("95X", "1Y"),
                "                        ",
                _pair("126X", "TOGGLE", "TOGGLE 1X-126X"),
                "                        ",
                "<RETURN                 ",
                "                        ",
            ]

        if s_id == "bus_in":
            def _bus_row(label: str, key: str) -> str:
                sel = "*" if self.dme_bus_sel.get(key) else " "
                if self.dme_bus_sel.get(key):
                    data_hex = self.dme_bus_data.get(key, "000000h")
                    return f"{label:<5}   66  {data_hex:<7}   {sel}"[:24].ljust(24)
                return f"{label:<5}               {sel}   "[:24].ljust(24)

            return [
                "         DME-0          ",
                "  special func-bus in   ",
                "       label  data   sel",
                "                        ",
                _bus_row("bus a", "a"),
                "                        ",
                _bus_row("bus b", "b"),
                "                        ",
                _bus_row("cfdiu", "cfdiu"),
                "                        ",
                "<READ                   ",
                "                        ",
                "<RETURN                 ",
                "                        ",
            ]

        template = DME_709_MENU_SCREENS.get(s_id, DME_709_MENU_SCREENS["root"])
        shop_status = "SHOP VISIT ENTERED" if self.dme_shop_visited else ""
        xmit_line = f"<FIXED XMIT RATE-{self.dme_fixed_xmit_rate}"
        return [
            line.replace("{AGC}", self.dme_agc_val)
            .replace("{SHOP_VISIT_STATUS}", shop_status)
            .replace("{FIXED_XMIT_LINE}", xmit_line)
            .ljust(24)[:24]
            for line in template
        ]

    def load_dme_screen(self, screen_id: str) -> None:
        """Load authentic 709 DME menu screen through ARINC 429 Label 356 encoder/decoder pipeline."""
        s_id = str(screen_id).lower()
        if s_id == "main":
            s_id = "root"
        rendered_lines = self.render_dme_screen(s_id)
        self.dme_current_screen = s_id
        self.current_screen = s_id
        self._encode_and_commit_mcdu_lines(
            rendered_lines, f"DME MENU: {s_id.upper()} (LABEL 356)"
        )

    def render_generic_lru_screen(self, lru: dict[str, Any], screen_id: str) -> list[str]:
        """Build dynamic 14x24 simulated CFDS screen for any non-DME LRU or MANUAL ENTRY."""
        eq = str(lru.get("code", "000")).upper()
        short = str(lru.get("short", "")).strip().upper()
        lru_name = str(lru.get("name", f"LRU {eq}")).upper()
        if not short or short == "MANUAL":
            hdr = f"LRU-{eq}"
        else:
            hdr = f"{short}-1"
        title_row = hdr.center(24)[:24]
        s_id = str(screen_id).lower()

        if s_id == "last_leg":
            return [
                title_row,
                "    LAST LEG REPORT     ",
                "------------------------",
                f"EQ CODE: {eq}".ljust(24)[:24],
                "DATE: JAN01   GMT: 0000 ",
                "                        ",
                "NO FAULT DETECTED       ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "<RETURN                 ",
                "                        ",
            ]
        if s_id == "prev_legs":
            return [
                title_row,
                "  PREVIOUS LEGS REPORT  ",
                "------------------------",
                f"LEG -01 {hdr} JAN00".ljust(24)[:24],
                "                        ",
                "NO FAULT RECORDED       ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "<RETURN                 ",
                "                        ",
            ]
        if s_id == "lru_id":
            return [
                title_row,
                "   LRU IDENTIFICATION   ",
                "------------------------",
                f"LRU: {lru_name}".ljust(24)[:24],
                f"EQ CODE: {eq}".ljust(24)[:24],
                "S/W: SIM-CFDS-429       ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "<RETURN                 ",
                "                        ",
            ]
        if s_id == "test":
            return [
                title_row,
                "          TEST          ",
                "------------------------",
                f"{hdr} TEST".ljust(24)[:24],
                "                        ",
                "TEST OK                 ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "<RETURN                 ",
                "                        ",
            ]
        if s_id == "ground_scan":
            return [
                title_row,
                "    GROUND SCANNING     ",
                "------------------------",
                "GROUND SCANNING         ",
                "                        ",
                "NO FAULT                ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "<RETURN                 ",
                "                        ",
            ]
        if s_id == "page2":
            return [
                title_row,
                "        PAGE 2/2        ",
                "                        ",
                "                        ",
                "<CLASS 3 FAULTS         ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "<RETURN                 ",
                "<PREV                   ",
            ]
        if s_id == "class3":
            return [
                title_row,
                "    CLASS 3 FAULTS      ",
                "------------------------",
                f"{hdr} CLASS 3".ljust(24)[:24],
                "                        ",
                "NO CLASS 3 FAULTS       ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "                        ",
                "<RETURN                 ",
                "                        ",
            ]
        # Default root
        return [
            title_row,
            "                        ",
            "<LAST LEG REPORT        ",
            "                        ",
            "<PREVIOUS LEGS REPORT   ",
            "                        ",
            "<LRU IDENTIFICATION     ",
            "                        ",
            "<TEST                   ",
            "                        ",
            "<GROUND SCANNING        ",
            "                        ",
            "<RETURN                 ",
            "                 NEXT > ",
        ]

    def load_generic_lru_screen(self, screen_id: str) -> None:
        """Load simulated menu screen for non-DME LRU through ARINC 429 Label 356 pipeline."""
        s_id = str(screen_id).lower()
        rendered = self.render_generic_lru_screen(self.selected_lru, s_id)
        self.generic_current_screen = s_id
        self.current_screen = s_id
        short = self.selected_lru.get("short", self.selected_lru.get("code", "LRU"))
        self._encode_and_commit_mcdu_lines(
            rendered, f"{short} MENU: {s_id.upper()} (LABEL 356)"
        )

    def update_tx_params(self, params: dict[str, Any], config: dict[str, bool] | None = None) -> dict[str, Any]:
        """Update CFDS TX data parameters and 17 configuration toggles (Slide 3)."""
        with self._lock:
            for k in ("date", "time", "flt_num", "city_pairs", "flt_phase", "aircraft_id", "shop_code"):
                if k in params:
                    self.tx_params[k] = params[k]
            if config:
                for k, v in config.items():
                    if k in self.aircraft_config:
                        self.aircraft_config[k] = bool(v)
            return self.get_state()

    def set_flight_phase(self, phase: str) -> dict[str, Any]:
        """Toggle flight phase GROUND / AIR (Slide 6 & 8) for all LRUs in simulation mode."""
        with self._lock:
            val = str(phase).strip().upper()
            if val in ("GROUND", "AIR"):
                self.flight_phase_mode = val
                if self.simulation_mode:
                    short = self.selected_lru.get("short", "LRU")
                    if short == "MANUAL":
                        short = f"LRU-{self.selected_lru.get('code', '000')}"
                    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
                    msg = f"[{ts}] {short} {val}: FLIGHT PHASE SWITCHED TO {val}"
                    self.normal_messages.append({"text": msg, "chars": val, "ts": ts})
                    if val == "AIR":
                        self.discrete_has_data = True
                        self.discrete_fields["failure_number"] = "1"
                        self.discrete_fields["failure_type_code"] = "02"
                        self.discrete_fields["failure_type_string"] = f"{short} IN-FLIGHT TEST MONITOR WARN"
                        self.discrete_fields["witness_position"] = "CAPT"
                        self.discrete_fields["witness_side"] = "LEFT"
                        self.discrete_fields["suspect1_position"] = "MAIN RACK"
                        self.discrete_fields["suspect1_side"] = "LEFT"
                        self.discrete_fields["suspect2_position"] = "SHELF 1"
                        self.discrete_fields["suspect2_side"] = "RIGHT"
                        self.discrete_fields["suspect3_position"] = "AFT"
                        self.discrete_fields["suspect3_side"] = "CENTER"
                    else:
                        self.discrete_has_data = True
                        self.discrete_fields["failure_number"] = "1"
                        self.discrete_fields["failure_type_code"] = "00"
                        self.discrete_fields["failure_type_string"] = f"{short} GROUND SYSTEM PASS"
                        self.discrete_fields["witness_position"] = "NONE"
                        self.discrete_fields["witness_side"] = "NONE"
                        self.discrete_fields["suspect1_position"] = "MAIN RACK"
                        self.discrete_fields["suspect1_side"] = "LEFT"
                        self.discrete_fields["suspect2_position"] = ""
                        self.discrete_fields["suspect2_side"] = ""
                        self.discrete_fields["suspect3_position"] = ""
                        self.discrete_fields["suspect3_side"] = ""
            return self.get_state()

    def send_key_command(self, key: str, lru_code: str | None = None) -> dict[str, Any]:
        """Handle Line Select Key or alphanumeric keypad press, encoding into Label 227."""
        with self._lock:
            k = str(key).strip().upper()
            eq = lru_code or self.selected_lru["code"]

            # Map key identifier to command code
            cmd_code = 0x01
            if k in ("1", "1L"):
                cmd_code = 1
            elif k in ("2", "2L"):
                cmd_code = 2
            elif k in ("3", "3L"):
                cmd_code = 3
            elif k in ("4", "4L"):
                cmd_code = 4
            elif k in ("5", "5L"):
                cmd_code = 5
            elif k in ("6", "6L"):
                cmd_code = 6
            elif k == "1R":
                cmd_code = 7
            elif k == "2R":
                cmd_code = 8
            elif k == "3R":
                cmd_code = 9
            elif k == "4R":
                cmd_code = 10
            elif k == "5R":
                cmd_code = 11
            elif k == "6R":
                cmd_code = 12
            elif k in ("A", "B", "C", "D", "E", "F"):
                cmd_code = ord(k)
            elif k == "NXT":
                cmd_code = 0x1E
            elif k == "PRV":
                cmd_code = 0x1D
            elif k == "MENU":
                cmd_code = 0x11
            elif k == "CLR":
                cmd_code = 0x12
            elif k == "SP":
                cmd_code = 0x20
            elif len(k) == 1:
                cmd_code = ord(k)

            raw_word, hex_str = encode_label227_word(
                equipment_code=eq,
                command_code=cmd_code,
                sdi=0,
                ready=True,
                bit12=False,
            )

            self.last_tx_command = {
                "key": k,
                "command_code": cmd_code,
                "equipment_code": eq,
                "raw_word": raw_word,
                "hex_32": hex_str,
                "timestamp": time.time(),
                "time_str": datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:12],
            }

            if self.simulation_mode:
                if eq == "009":
                    nxt_screen, new_agc, new_caller, action = handle_dme_key_navigation(
                        self.dme_current_screen, k, self.dme_agc_val, self.dme_caller_screen
                    )
                    self.dme_agc_val = new_agc
                    self.dme_caller_screen = new_caller
                    if action == "enter_shop_visit":
                        self.dme_shop_visited = True
                    elif action == "toggle_xmit":
                        self.dme_fixed_xmit_rate = "ON" if self.dme_fixed_xmit_rate == "OFF" else "OFF"
                    elif action and action.startswith("rcvr:"):
                        ch = action.split(":", 1)[1]
                        if ch == "toggle":
                            self.dme_rcvr_channel = "126X" if self.dme_rcvr_channel == "1X" else "1X"
                        else:
                            self.dme_rcvr_channel = ch
                    elif action and action.startswith("bus:"):
                        target = action.split(":", 1)[1]
                        if target in ("a", "b", "cfdiu"):
                            self.dme_bus_sel[target] = not self.dme_bus_sel[target]
                        elif target == "read":
                            samples = ["000000h", "034100h", "066001h"]
                            for b_key, enabled in self.dme_bus_sel.items():
                                if enabled:
                                    cur_d = self.dme_bus_data.get(b_key, "000000h")
                                    idx = (samples.index(cur_d) + 1) % len(samples) if cur_d in samples else 1
                                    self.dme_bus_data[b_key] = samples[idx]
                    self.load_dme_screen(nxt_screen)
                    self.mcdu_status = f"KEY '{k}' -> {nxt_screen.upper()} (LBL 227: {hex_str})"
                else:
                    nxt_screen = handle_generic_lru_key_navigation(self.generic_current_screen, k)
                    self.load_generic_lru_screen(nxt_screen)
                    self.mcdu_status = f"KEY '{k}' -> {nxt_screen.upper()} (LBL 227: {hex_str})"
            else:
                self.mcdu_status = f"KEY '{k}' TRANSMITTED (LBL 227: {hex_str})"

            return self.get_state()

    def ingest_rx_word(self, raw_word: int, label_octal: str) -> bool:
        """Ingest incoming ARINC 429 word from hardware or bus, decoding Label 356 or 350/355."""
        with self._lock:
            # 1. Label 356 ISO #5 Characters
            if label_octal == "356":
                chars = decode_iso5_ascii(raw_word)
                if chars:
                    self.mcdu_has_data = True
                    # Update Normal Mode log
                    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
                    msg = f"[{ts}] {self.selected_lru['short']} {self.flight_phase_mode}: {chars}"
                    self.normal_messages.append({"text": msg, "chars": chars, "ts": ts})
                    if len(self.normal_messages) > 100:
                        self.normal_messages = self.normal_messages[-100:]

                    # Update MCDU Screen: write into current line
                    for ch in chars:
                        self._write_mcdu_char(ch)
                    self.mcdu_status = f"LIVE DATA: {chars}"
                    return True

            # 2. Discrete Fault Word (Label 350 / 355 / 356 type 3)
            elif label_octal in ("350", "355"):
                self.discrete_has_data = True
                fn = str((raw_word >> 8) & 0x0F or 1)
                ft_code = f"{(raw_word >> 12) & 0x3F:02X}"
                self.discrete_fields["failure_number"] = fn
                self.discrete_fields["failure_type_code"] = ft_code
                self.discrete_fields["failure_type_string"] = f"{self.selected_lru['short']} FAULT TYPE {ft_code}"
                self.discrete_fields["witness_position"] = "CAPT"
                self.discrete_fields["witness_side"] = "LEFT"
                self.discrete_fields["suspect1_position"] = "MAIN RACK"
                self.discrete_fields["suspect1_side"] = "LEFT"
                self.discrete_fields["suspect2_position"] = "SHELF 2"
                self.discrete_fields["suspect2_side"] = "RIGHT"
                self.discrete_fields["suspect3_position"] = "AFT"
                self.discrete_fields["suspect3_side"] = "CENTER"
                return True

            return False

    def _write_mcdu_char(self, char: str) -> None:
        """Write single character to MCDU 14x24 buffer with CR/LF handling."""
        for idx in range(14):
            if len(self.mcdu_lines[idx]) < 24:
                self.mcdu_lines[idx] += char
                return
        self.mcdu_lines.pop(0)
        self.mcdu_lines.append(char)

    def clear_rx_data(self, mode: str | None = None) -> dict[str, Any]:
        """Clear normal messages, MCDU screen, or discrete fields."""
        with self._lock:
            m = (mode or "").lower()
            if m in ("normal", ""):
                self.normal_messages.clear()
            if m in ("mcdu", "menu", "interactive", ""):
                self.mcdu_lines = ["" for _ in range(14)]
                self.mcdu_has_data = False
                self.mcdu_status = "WAITING FOR LRU MENU DATA (LABEL 356)..."
            if m in ("discrete", ""):
                self.discrete_has_data = False
                self.discrete_fields = dict(DEFAULT_DISCRETE_FIELDS)
            return self.get_state()

    def refresh_screen(self, is_simulation: bool) -> dict[str, Any]:
        """Refresh active CFDS screen: re-render active screen in SIM:ON, or clear & re-request Label 227 in SIM:OFF."""
        with self._lock:
            self.simulation_mode = bool(is_simulation)
            slide = str(self.current_slide).lower()
            eq = self.selected_lru.get("code", "009")

            if self.simulation_mode:
                if slide in ("menu_0018", "interactive_0048"):
                    if eq == "009":
                        self.load_dme_screen(self.dme_current_screen or "root")
                    else:
                        self.load_generic_lru_screen(self.generic_current_screen or "root")
                elif slide in ("normal_0018", "normal_0048"):
                    self.normal_messages.clear()
                    self.simulate_test_scenario("NORMAL", eq)
                elif slide == "discrete_0048":
                    self.simulate_test_scenario("DISCRETE", eq)
                return self.get_state()

            # Real hardware mode (SIM: OFF): clear stale buffer & re-transmit Label 227 activation/request word
            self.mcdu_lines = ["" for _ in range(14)]
            self.mcdu_has_data = False
            self.normal_messages.clear()
            self.discrete_has_data = False
            self.discrete_fields = dict(DEFAULT_DISCRETE_FIELDS)

            cmd_code = 0x11 if slide in ("menu_0018", "interactive_0048") else 0x01
            raw_word, hex_str = encode_label227_word(
                equipment_code=eq,
                command_code=cmd_code,
                sdi=0,
                ready=True,
                bit12=False,
            )
            self.last_tx_command = {
                "key": "REFRESH",
                "command_code": cmd_code,
                "equipment_code": eq,
                "raw_word": raw_word,
                "hex_32": hex_str,
                "timestamp": time.time(),
                "time_str": datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:12],
            }
            self.mcdu_status = "WAITING FOR LRU MENU DATA (LABEL 356)..."
            return self.get_state()

    def simulate_test_scenario(self, mode: str, lru_code: str | None = None) -> dict[str, Any]:
        """Simulate realistic test burst for demonstration/verification of any LRU."""
        with self._lock:
            lru = next((x for x in CFDS_LRU_TABLE if x["code"] == lru_code), self.selected_lru)
            short = lru["short"]
            m = mode.upper()

            if "NORMAL" in m:
                ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
                lines = [
                    f"[{ts}] {short} GROUND: NORMAL MODE INITIALIZED",
                    f"[{ts}] {short} GROUND: LRU PART NO: {lru['code']}-429-01",
                    f"[{ts}] {short} GROUND: NO INTERNAL FAULTS DETECTED",
                    f"[{ts}] {short} AIR: SYSTEM OPERATING NOMINAL",
                ]
                for l in lines:
                    self.normal_messages.append({"text": l, "ts": ts})
                return self.get_state()

            elif "MENU" in m:
                if lru["code"] == "009":
                    self.load_dme_screen("root")
                else:
                    rendered = self.render_generic_lru_screen(lru, "root")
                    self.generic_current_screen = "root"
                    self.current_screen = "root"
                    self._encode_and_commit_mcdu_lines(
                        rendered, f"MENU LOADED FROM {short} (LABEL 356)"
                    )
                return self.get_state()

            elif "INTERACTIVE" in m:
                if lru["code"] == "009":
                    self.load_dme_screen("root")
                else:
                    rendered = self.render_generic_lru_screen(lru, "root")
                    self.generic_current_screen = "root"
                    self.current_screen = "root"
                    self.interactive_progress = 100
                    self.interactive_status = "TEST COMPLETED OK"
                    self._encode_and_commit_mcdu_lines(
                        rendered, f"INTERACTIVE PAGE LOADED ({short})"
                    )
                return self.get_state()

            elif "DISCRETE" in m:
                self.discrete_has_data = True
                self.discrete_fields = {
                    "failure_number": "1",
                    "failure_type_code": "03",
                    "failure_type_string": f"{short} INTERNAL RAM FAULT",
                    "witness_position": "CAPT",
                    "witness_side": "LEFT",
                    "suspect1_position": "MAIN RACK",
                    "suspect1_side": "LEFT",
                    "suspect2_position": "SHELF 2",
                    "suspect2_side": "RIGHT",
                    "suspect3_position": "AFT",
                    "suspect3_side": "CENTER",
                }
                return self.get_state()

            return self.get_state()
