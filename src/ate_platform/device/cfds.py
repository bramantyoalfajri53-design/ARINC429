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

# Authentic 709 DME CFDS Screens (14 rows x 24 chars) restored from Git history (641e1d7)
DME_709_MENU_SCREENS: dict[str, list[str]] = {
    "main": [
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
        "                 NEXT > ",
    ],
    "menu_2": [
        "         DME-0          ",
        "         MENU 2         ",
        "                        ",
        "                        ",
        "<FORMAT NON-VOLATILE    ",
        "                        ",
        "<ERASE NON-VOLATILE     ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "<PREV                   ",
    ],
    "format_nvm": [
        "         DME-0          ",
        "         MENU 2         ",
        "                        ",
        "                        ",
        "  0000 BYTES BAD        ",
        "                        ",
        "  NVM FORMATTED OK      ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "erase_nvm": [
        "         DME-0          ",
        "         MENU 2         ",
        "                        ",
        "                        ",
        "  0000 BYTES BAD        ",
        "                        ",
        "  NVM ERASED OK         ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "last_leg": [
        "         DME-0          ",
        "    LAST LEG REPORT     ",
        "      DATE: JAN01       ",
        "------------------------",
        "    GMT     ATA         ",
        "    DME-0 TRANSCEIVER(2)",
        "3   0000    34-51-33    ",
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
        "  PREVIOUS LEGS REPORT  ",
        "------------------------",
        "  LEG DATE    GMT   ATA ",
        "  DME-0 TRANSCEIVER     ",
        "-01 JAN00   0000  34-51-33",
        "  DME-0 TRANSCEIVER (2) ",
        "-02 JAN00   0000  34-51-33",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "lru_id": [
        "         DME-0          ",
        "   LRU IDENTIFICATION   ",
        "------------------------",
        "TRANSCEIVER P/N:        ",
        "  822-0329-001          ",
        "SERIAL NUMBER: 1204     ",
        "MODIFICATION DOT: 1-4   ",
        "EQUIPMENT: COL-DME-709  ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "test": [
        "         DME-0          ",
        "          TEST          ",
        "------------------------",
        "DME-0 NO DATA FROM      ",
        "        CONTROL SOURCE  ",
        "ATA:  34-51-23          ",
        "                        ",
        "BITE TEST COMPLETE:     ",
        "  SYSTEM NORMAL         ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "shop_data": [
        "         DME-0          ",
        "       SHOP DATA        ",
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
        "    ENTER SHOP VISIT    ",
        "------------------------",
        "SHOP CODE: N12345       ",
        "DATE: 11/18/26          ",
        "STATION: GMF-AEROASIA   ",
        "                        ",
        "VISIT RECORD STORED OK  ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "fault_data": [
        "         DME-0          ",
        "   DISPLAY FAULT DATA   ",
        "------------------------",
        "NO FAULT DATA RECORDED  ",
        "                        ",
        "NVM LOG COUNTER: 000    ",
        "INTERNAL BUS CHECKSUM:  ",
        "  PASS                  ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "software_id": [
        "         DME-0          ",
        "      SOFTWARE ID       ",
        "------------------------",
        "SOFTWARE P/N:           ",
        "  COL-DME-709-01        ",
        "CRC CHECKSUM: 0x9B42    ",
        "RELEASE: REV 02.1       ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "special_func_agc": [
        "         DME-0          ",
        "    SPECIAL FUNC-AGC    ",
        " CURRENT VALUE AGC: {AGC} ",
        "                        ",
        "                        ",
        "                        ",
        "<FULL GAIN FF           ",
        "                        ",
        "<MID GAIN A0            ",
        "                        ",
        "<MIN GAIN 00            ",
        "                        ",
        "<RETURN                 ",
        "                        ",
    ],
    "bus_in_test": [
        "         DME-0          ",
        "      BUS IN TEST       ",
        "------------------------",
        "ARINC 429 BUS RX-A:     ",
        "  12.5 KBPS OK          ",
        "ARINC 429 BUS RX-B:     ",
        "  STANDBY               ",
        "PARITY ERRORS: 000      ",
        "BUS TIMING: 100% OK     ",
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


def encode_screen_to_label356_words(lines: list[str], agc_val: str = "A0") -> list[int]:
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
    current_screen: str, key: str, agc_val: str
) -> tuple[str, str, str | None]:
    """State transition handler for authentic 709 DME menu simulation.

    Returns (next_screen, updated_agc_val, action_signal).
    action_signal is 'exit' when returning to Slide 4 Op Mode Hub.
    """
    k = str(key).strip().upper()
    cur = str(current_screen).lower()

    # Universal MENU key returns to main menu
    if k == "MENU":
        return "main", agc_val, None

    if cur == "main":
        if k in ("1", "1L", "A"):
            return "last_leg", agc_val, None
        elif k in ("2", "2L", "B"):
            return "prev_legs", agc_val, None
        elif k in ("3", "3L", "C"):
            return "lru_id", agc_val, None
        elif k in ("4", "4L", "D"):
            return "test", agc_val, None
        elif k in ("5", "5L", "E"):
            return "shop_data", agc_val, None
        elif k in ("6", "6L", "F", "CLR"):
            return "main", agc_val, "exit"
        elif k == "NXT":
            return "menu_2", agc_val, None

    elif cur == "menu_2":
        if k in ("2", "2L", "B"):
            return "format_nvm", agc_val, None
        elif k in ("3", "3L", "C"):
            return "erase_nvm", agc_val, None
        elif k in ("6", "6L", "F", "PRV", "NXT", "CLR"):
            return "main", agc_val, None

    elif cur in ("format_nvm", "erase_nvm"):
        if k in ("6", "6L", "F", "PRV", "CLR"):
            return "menu_2", agc_val, None

    elif cur in ("last_leg", "prev_legs", "lru_id", "test"):
        if k in ("6", "6L", "F", "PRV", "CLR"):
            return "main", agc_val, None

    elif cur == "shop_data":
        if k in ("2", "2L", "B"):
            return "shop_visit", agc_val, None
        elif k in ("3", "3L", "C"):
            return "fault_data", agc_val, None
        elif k in ("4", "4L", "D"):
            return "software_id", agc_val, None
        elif k in ("5", "5L", "E"):
            return "special_func_agc", agc_val, None
        elif k in ("6", "6L", "F", "PRV", "CLR"):
            return "main", agc_val, None

    elif cur in ("shop_visit", "fault_data", "software_id"):
        if k in ("6", "6L", "F", "PRV", "CLR"):
            return "shop_data", agc_val, None

    elif cur == "special_func_agc":
        if k in ("3", "3L", "C"):
            return "special_func_agc", "FF", None
        elif k in ("4", "4L", "D"):
            return "special_func_agc", "A0", None
        elif k in ("5", "5L", "E"):
            return "special_func_agc", "00", None
        elif k in ("6", "6L", "F", "PRV", "CLR"):
            return "shop_data", agc_val, None

    elif cur == "bus_in_test":
        if k in ("6", "6L", "F", "PRV", "CLR"):
            return "special_func_agc", agc_val, None

    return cur, agc_val, None


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
        self.mcdu_status: str = "AWAITING LRU RESPONSE (LABEL 356)"
        self.dme_current_screen: str = "main"
        self.dme_agc_val: str = "A0"
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

            return {
                "active": self.active,
                "simulation_mode": self.simulation_mode,
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
                "mcdu_has_data": self.mcdu_has_data,
                "mcdu_status": self.mcdu_status,
                "dme_current_screen": self.dme_current_screen,
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
            self.dme_current_screen = "main"
            self.dme_agc_val = "A0"
            self.normal_messages.clear()
            self.discrete_has_data = False
            self.discrete_fields = dict(DEFAULT_DISCRETE_FIELDS)
            return self.get_state()

    def set_slide(self, slide: str) -> dict[str, Any]:
        """Switch current slide/view (menu, desired_mode, edit_tx, op_mode_hub, channels, ...)."""
        with self._lock:
            s = str(slide).lower()
            self.current_slide = s
            # In simulation mode: entering Menu or Interactive mode on 709 DME auto-injects authentic menu
            if s in ("menu_0018", "interactive_0048"):
                if self.simulation_mode and self.selected_lru.get("code") == "009":
                    self.load_dme_screen(self.dme_current_screen or "main")
            return self.get_state()

    def load_dme_screen(self, screen_id: str) -> None:
        """Load authentic 709 DME menu screen through ARINC 429 Label 356 encoder/decoder pipeline."""
        s_id = str(screen_id).lower()
        template = DME_709_MENU_SCREENS.get(s_id, DME_709_MENU_SCREENS["main"])
        rendered_lines = [
            line.replace("{AGC}", self.dme_agc_val).ljust(24)[:24]
            for line in template
        ]
        # Encode through ARINC 429 Label 356 pipeline
        words = encode_screen_to_label356_words(rendered_lines, self.dme_agc_val)
        # Decode each row back through decode_iso5_ascii to guarantee 100% protocol fidelity
        decoded_lines: list[str] = []
        for row in range(14):
            row_words = words[row * 8 : (row + 1) * 8]
            row_str = "".join(decode_iso5_ascii(w) for w in row_words)
            decoded_lines.append(row_str.ljust(24)[:24])

        self.mcdu_lines = decoded_lines
        self.mcdu_has_data = True
        self.dme_current_screen = s_id
        self.mcdu_status = f"DME MENU: {s_id.upper()} (LABEL 356)"

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
        """Toggle flight phase GROUND / AIR (Slide 6 & 8)."""
        with self._lock:
            val = str(phase).strip().upper()
            if val in ("GROUND", "AIR"):
                self.flight_phase_mode = val
                if self.simulation_mode and self.selected_lru.get("code") == "009":
                    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
                    msg = f"[{ts}] DME {val}: FLIGHT PHASE SWITCHED TO {val}"
                    self.normal_messages.append({"text": msg, "chars": val, "ts": ts})
                    if val == "AIR":
                        self.discrete_has_data = True
                        self.discrete_fields["failure_number"] = "1"
                        self.discrete_fields["failure_type_code"] = "02"
                        self.discrete_fields["failure_type_string"] = "DME IN-FLIGHT PULSE TIMING WARN"
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
                        self.discrete_fields["failure_type_string"] = "DME GROUND SYSTEM PASS"
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

            # In simulation mode for 709 DME: drive screen navigation
            if self.simulation_mode and eq == "009":
                nxt_screen, new_agc, action = handle_dme_key_navigation(
                    self.dme_current_screen, k, self.dme_agc_val
                )
                self.dme_agc_val = new_agc
                if action == "exit":
                    self.current_slide = "op_mode_hub"
                    self.mcdu_status = f"EXIT CFDS MENU (KEY '{k}' -> OP MODE HUB)"
                else:
                    self.load_dme_screen(nxt_screen)
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
                    self.load_dme_screen("main")
                else:
                    self.mcdu_lines = [
                        f"< {short} BITE MENU >".center(24),
                        "< 1  SYSTEM STATUS      ",
                        "< 2  CURRENT LEG REPORT ",
                        "< 3  PREVIOUS LEGS LOG  ",
                        "< 4  LRU IDENTIFICATION ",
                        "< 5  GROUND TEST        ",
                        "< 6  CLASS 3 FAULTS     ",
                        "                        ",
                        "                        ",
                        "                        ",
                        "                        ",
                        "                RETURN >",
                        "------------------------",
                        "STATUS: SELECT OPTION   ",
                    ]
                    self.mcdu_has_data = True
                    self.mcdu_status = f"MENU LOADED FROM {short} (LABEL 356)"
                return self.get_state()

            elif "INTERACTIVE" in m:
                if lru["code"] == "009":
                    self.load_dme_screen("main")
                else:
                    self.mcdu_lines = [
                        f"< {short} INTERACTIVE >".center(24),
                        "< 1L SELF TEST START    ",
                        "     BITE TEST ACTIVE   ",
                        "< 2L READ MEMORY DUMP   ",
                        "     EEPROM CHECKSUM OK ",
                        "< 3L CALIBRATION MODE   ",
                        "     FREQ SYNTH LOCKED  ",
                        "------------------------",
                        "LRU RESPONSE TIME: 42 MS",
                        "DATA LINK BUS: VALID    ",
                        "COMMAND 227: ACK OK     ",
                        "                NEXT >  ",
                        "------------------------",
                        "READY FOR NEXT INPUT    ",
                    ]
                    self.mcdu_has_data = True
                    self.interactive_progress = 100
                    self.interactive_status = "TEST COMPLETED OK"
                    self.mcdu_status = f"INTERACTIVE PAGE LOADED ({short})"
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
