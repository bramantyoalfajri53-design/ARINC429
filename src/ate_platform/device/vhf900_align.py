"""Collins VHF-900 Alignment Mode (ARINC 716 on Channel C 100 kbps).

Implements:
1. 40 TFM variables across 4 pages.
2. 40 Calibration variables across 4 pages.
3. Checksum recalculation 10s routine:
   - 0..1 s:  Address 0x78123, Data 0x5A
   - 1..10 s: Address 0x78321, Data 0xA5
4. Continuous Label 030 TX @ 100/s (10 ms) on Channel C (100 kbps).
5. Echo detection on Channel C for Label 030 ("ERROR: VHF900 DID NOT ECHO 429 COMMAND").
6. Label 350 Failure message decoding.
"""

from __future__ import annotations

import time
from typing import Any

# 40 TFM Variables (10 per page, 2 columns of 5)
TFM_VARIABLES = [
    # Page 1
    {"id": 1, "page": 1, "col": 0, "num": 1, "name": "RCV PRESEL 1", "ram": 0x40, "rom": 0x40},
    {"id": 2, "page": 1, "col": 0, "num": 2, "name": "RCV PRESEL 2", "ram": 0x48, "rom": 0x48},
    {"id": 3, "page": 1, "col": 0, "num": 3, "name": "RCV PRESEL 3", "ram": 0x50, "rom": 0x50},
    {"id": 4, "page": 1, "col": 0, "num": 4, "name": "RCV PRESEL 4", "ram": 0x58, "rom": 0x58},
    {"id": 5, "page": 1, "col": 0, "num": 5, "name": "SIMUL THRESH", "ram": 0x2A, "rom": 0x2A},
    {"id": 6, "page": 1, "col": 1, "num": 13, "name": "25K SQ LO", "ram": 0x1E, "rom": 0x1E},
    {"id": 7, "page": 1, "col": 1, "num": 14, "name": "25K SQ UP", "ram": 0x32, "rom": 0x32},
    {"id": 8, "page": 1, "col": 1, "num": 15, "name": "AGC SQLCH LO", "ram": 0x18, "rom": 0x18},
    {"id": 9, "page": 1, "col": 1, "num": 16, "name": "AGC SQLCH UP", "ram": 0x24, "rom": 0x24},
    {"id": 10, "page": 1, "col": 1, "num": 17, "name": "RCV AUD GAIN", "ram": 0x7F, "rom": 0x7F},

    # Page 2
    {"id": 11, "page": 2, "col": 0, "num": 18, "name": "8.33 SQ LO", "ram": 0x1C, "rom": 0x1C},
    {"id": 12, "page": 2, "col": 0, "num": 19, "name": "8.33 SQ UP", "ram": 0x30, "rom": 0x30},
    {"id": 13, "page": 2, "col": 0, "num": 20, "name": "MOD GAIN 25K", "ram": 0x64, "rom": 0x64},
    {"id": 14, "page": 2, "col": 0, "num": 21, "name": "MOD GAIN 8.33", "ram": 0x5A, "rom": 0x5A},
    {"id": 15, "page": 2, "col": 0, "num": 22, "name": "SIDETONE GAIN", "ram": 0x40, "rom": 0x40},
    {"id": 16, "page": 2, "col": 1, "num": 23, "name": "TX PWR LEVEL", "ram": 0x80, "rom": 0x80},
    {"id": 17, "page": 2, "col": 1, "num": 24, "name": "REF OSC FREQ", "ram": 0x82, "rom": 0x82},
    {"id": 18, "page": 2, "col": 1, "num": 25, "name": "VCO PRESCALE", "ram": 0x3F, "rom": 0x3F},
    {"id": 19, "page": 2, "col": 1, "num": 26, "name": "SYNTH OFFSET", "ram": 0x04, "rom": 0x04},
    {"id": 20, "page": 2, "col": 1, "num": 27, "name": "IF LEVEL ADJ", "ram": 0x55, "rom": 0x55},

    # Page 3
    {"id": 21, "page": 3, "col": 0, "num": 28, "name": "AGC ATTEN 1", "ram": 0x10, "rom": 0x10},
    {"id": 22, "page": 3, "col": 0, "num": 29, "name": "AGC ATTEN 2", "ram": 0x20, "rom": 0x20},
    {"id": 23, "page": 3, "col": 0, "num": 30, "name": "AGC ATTEN 3", "ram": 0x40, "rom": 0x40},
    {"id": 24, "page": 3, "col": 0, "num": 31, "name": "MIXER BIAS", "ram": 0x4A, "rom": 0x4A},
    {"id": 25, "page": 3, "col": 0, "num": 32, "name": "DISCR ZERO", "ram": 0x7E, "rom": 0x7E},
    {"id": 26, "page": 3, "col": 1, "num": 33, "name": "SQUELCH HYST", "ram": 0x08, "rom": 0x08},
    {"id": 27, "page": 3, "col": 1, "num": 34, "name": "NOISE GATE", "ram": 0x12, "rom": 0x12},
    {"id": 28, "page": 3, "col": 1, "num": 35, "name": "AUDIO COMP", "ram": 0x30, "rom": 0x30},
    {"id": 29, "page": 3, "col": 1, "num": 36, "name": "DATA MOD LVL", "ram": 0x45, "rom": 0x45},
    {"id": 30, "page": 3, "col": 1, "num": 37, "name": "LINE IN GAIN", "ram": 0x50, "rom": 0x50},

    # Page 4
    {"id": 31, "page": 4, "col": 0, "num": 38, "name": "TX PRE-DRIVE", "ram": 0x60, "rom": 0x60},
    {"id": 32, "page": 4, "col": 0, "num": 39, "name": "PA BIAS 1", "ram": 0x38, "rom": 0x38},
    {"id": 33, "page": 4, "col": 0, "num": 40, "name": "PA BIAS 2", "ram": 0x3C, "rom": 0x3C},
    {"id": 34, "page": 4, "col": 0, "num": 41, "name": "TEMP SENSE 1", "ram": 0x50, "rom": 0x50},
    {"id": 35, "page": 4, "col": 0, "num": 42, "name": "TEMP SENSE 2", "ram": 0x50, "rom": 0x50},
    {"id": 36, "page": 4, "col": 1, "num": 43, "name": "VSWR THRESH", "ram": 0x70, "rom": 0x70},
    {"id": 37, "page": 4, "col": 1, "num": 44, "name": "SENSITIVITY", "ram": 0x22, "rom": 0x22},
    {"id": 38, "page": 4, "col": 1, "num": 45, "name": "SELECTIVITY", "ram": 0x1F, "rom": 0x1F},
    {"id": 39, "page": 4, "col": 1, "num": 46, "name": "HARMONIC FLT", "ram": 0x15, "rom": 0x15},
    {"id": 40, "page": 4, "col": 1, "num": 47, "name": "SPARE VAR", "ram": 0x00, "rom": 0x00},
]

# 40 Calibration Variables (10 per page, 2 columns of 5)
CAL_VARIABLES = [
    # Page 1
    {"id": 1, "page": 1, "col": 0, "num": 1, "name": "LO TX FWD PR", "rom": 0x82},
    {"id": 2, "page": 1, "col": 0, "num": 2, "name": "UP TX FWD PR", "rom": 0x88},
    {"id": 3, "page": 1, "col": 0, "num": 3, "name": "UPPER VSWR", "rom": 0x64},
    {"id": 4, "page": 1, "col": 0, "num": 4, "name": "UP OVER VOLT", "rom": 0x90},
    {"id": 5, "page": 1, "col": 0, "num": 5, "name": "FAN ENBL TMP", "rom": 0x55},
    {"id": 6, "page": 1, "col": 1, "num": 6, "name": "FAN DSBL TMP", "rom": 0x48},
    {"id": 7, "page": 1, "col": 1, "num": 7, "name": "UPR TX TEMP", "rom": 0x6E},
    {"id": 8, "page": 1, "col": 1, "num": 8, "name": "LOWER 5 VDC", "rom": 0x4C},
    {"id": 9, "page": 1, "col": 1, "num": 9, "name": "UPPER 5 VDC", "rom": 0x54},
    {"id": 10, "page": 1, "col": 1, "num": 10, "name": "LOWER 12 VDC", "rom": 0x70},

    # Page 2
    {"id": 11, "page": 2, "col": 0, "num": 11, "name": "UPPER 12 VDC", "rom": 0x78},
    {"id": 12, "page": 2, "col": 0, "num": 12, "name": "LOWER 28 VDC", "rom": 0xA0},
    {"id": 13, "page": 2, "col": 0, "num": 13, "name": "UPPER 28 VDC", "rom": 0xB0},
    {"id": 14, "page": 2, "col": 0, "num": 14, "name": "REF VOLTAGE", "rom": 0x7F},
    {"id": 15, "page": 2, "col": 0, "num": 15, "name": "TX POWER CAL", "rom": 0x84},
    {"id": 16, "page": 2, "col": 1, "num": 16, "name": "MOD DEPTH CAL", "rom": 0x60},
    {"id": 17, "page": 2, "col": 1, "num": 17, "name": "FREQ ERROR CAL", "rom": 0x80},
    {"id": 18, "page": 2, "col": 1, "num": 18, "name": "VCO CAL LO", "rom": 0x22},
    {"id": 19, "page": 2, "col": 1, "num": 19, "name": "VCO CAL HI", "rom": 0x55},
    {"id": 20, "page": 2, "col": 1, "num": 20, "name": "PA BIAS CAL", "rom": 0x3E},

    # Page 3
    {"id": 21, "page": 3, "col": 0, "num": 21, "name": "FWD POWER CAL", "rom": 0x85},
    {"id": 22, "page": 3, "col": 0, "num": 22, "name": "REV POWER CAL", "rom": 0x1A},
    {"id": 23, "page": 3, "col": 0, "num": 23, "name": "DET GAIN CAL", "rom": 0x50},
    {"id": 24, "page": 3, "col": 0, "num": 24, "name": "TEMP ZERO CAL", "rom": 0x40},
    {"id": 25, "page": 3, "col": 0, "num": 25, "name": "TEMP SLOPE CAL", "rom": 0x62},
    {"id": 26, "page": 3, "col": 1, "num": 26, "name": "AUDIO ZERO CAL", "rom": 0x7E},
    {"id": 27, "page": 3, "col": 1, "num": 27, "name": "AUDIO SPAN CAL", "rom": 0x82},
    {"id": 28, "page": 3, "col": 1, "num": 28, "name": "RSSI SLOPE CAL", "rom": 0x44},
    {"id": 29, "page": 3, "col": 1, "num": 29, "name": "RSSI OFFSET", "rom": 0x18},
    {"id": 30, "page": 3, "col": 1, "num": 30, "name": "SQ THRESH CAL", "rom": 0x2C},

    # Page 4
    {"id": 31, "page": 4, "col": 0, "num": 31, "name": "8.33 DEV CAL", "rom": 0x58},
    {"id": 32, "page": 4, "col": 0, "num": 32, "name": "25K DEV CAL", "rom": 0x66},
    {"id": 33, "page": 4, "col": 0, "num": 33, "name": "PRESEL TUNING", "rom": 0x48},
    {"id": 34, "page": 4, "col": 0, "num": 34, "name": "NOTCH FILTER", "rom": 0x30},
    {"id": 35, "page": 4, "col": 0, "num": 35, "name": "BANDPASS ADJ", "rom": 0x52},
    {"id": 36, "page": 4, "col": 1, "num": 36, "name": "SENS CAL 118", "rom": 0x20},
    {"id": 37, "page": 4, "col": 1, "num": 37, "name": "SENS CAL 127", "rom": 0x22},
    {"id": 38, "page": 4, "col": 1, "num": 38, "name": "SENS CAL 136", "rom": 0x25},
    {"id": 39, "page": 4, "col": 1, "num": 39, "name": "SPARE CAL 1", "rom": 0x00},
    {"id": 40, "page": 4, "col": 1, "num": 40, "name": "SPARE CAL 2", "rom": 0x00},
]

FAULT_MESSAGES: dict[int, str] = {
    0: "NO FAULT DETECTED",
    1: "SYNTHESIZER OUT OF LOCK",
    2: "LOW TRANSMIT POWER",
    3: "HIGH VSWR DETECTED",
    4: "OVER TEMPERATURE TRIP",
    5: "POWER SUPPLY VOLTAGE FAULT",
    6: "CALIBRATION CHECKSUM ERROR",
    7: "EEPROM READ/WRITE ERROR",
    8: "MODULATION FAULT",
    9: "PROCESSOR RAM ERROR",
    10: "RECEIVER PRESELECTOR FAULT",
}


class Vhf900AlignManager:
    """Manages Collins VHF-900 alignment mode state and operations."""

    def __init__(self) -> None:
        self.freq_mhz: float = 118.000
        self.ssm: str = "00"  # "00", "01", "10", "11"
        self.sdi: str = "00"  # "00", "01", "10", "11"
        self.tx_inh: bool = False
        self.tx_phs: bool = False
        self.current_screen: str = "menu"  # "menu", "tfm", "cal", "faults"
        self.tfm_page: int = 1  # 1..4
        self.cal_page: int = 1  # 1..4
        self.active_var_id: int = 1
        self.cursor_field: str = "val"  # "val" or "freq"
        self.val_nibble: int = 0  # 0 = high nibble, 1 = low nibble
        self.freq_pos: int = 2  # 0: 100s, 1: 10s, 2: 1s, 3: 0.1s, 4: 0.01s, 5: 0.001s

        # Deep copy variables
        self.tfm_vars: list[dict[str, Any]] = [dict(v) for v in TFM_VARIABLES]
        self.cal_vars: list[dict[str, Any]] = [dict(v) for v in CAL_VARIABLES]

        # Checksum routine state
        self.checksum_status: str = "IDLE"  # "IDLE", "RUNNING", "DONE"
        self.checksum_start: float = 0.0

        # Confirmation timer for 2-click write
        self.confirm_action: str | None = None
        self.confirm_ts: float = 0.0

    def get_state(self, rx_bus_c: Any = None) -> dict[str, Any]:
        now = time.time()

        # Update checksum routine if running
        if self.checksum_status == "RUNNING":
            elapsed = now - self.checksum_start
            if elapsed >= 10.0:
                self.checksum_status = "DONE"

        # Check echo on Channel C
        echo_ok = False
        fault_code_1 = 0
        fault_code_2 = 0
        label_350_raw = 0

        if rx_bus_c:
            rx030 = getattr(rx_bus_c, "by_label", {}).get("030") if hasattr(rx_bus_c, "by_label") else None
            if rx030 and (now - getattr(rx030, "ts", 0)) <= 2.5:
                # Compare frequency if available
                echo_ok = True

            rx350 = getattr(rx_bus_c, "by_label", {}).get("350") if hasattr(rx_bus_c, "by_label") else None
            if rx350 and (now - getattr(rx350, "ts", 0)) <= 3.0:
                raw350 = int(getattr(rx350, "raw", 0))
                label_350_raw = raw350
                fault_code_1 = (raw350 >> 10) & 0x1F
                fault_code_2 = (raw350 >> 15) & 0x1F

        msg1 = FAULT_MESSAGES.get(fault_code_1, f"FAULT CODE {fault_code_1:02d}")
        msg2 = FAULT_MESSAGES.get(fault_code_2, f"FAULT CODE {fault_code_2:02d}")

        active_var = None
        if self.current_screen == "tfm":
            active_var = next((v for v in self.tfm_vars if v["id"] == self.active_var_id), self.tfm_vars[0])
        elif self.current_screen == "cal":
            active_var = next((v for v in self.cal_vars if v["id"] == self.active_var_id), self.cal_vars[0])

        return {
            "freq_mhz": self.freq_mhz,
            "ssm": self.ssm,
            "sdi": self.sdi,
            "tx_inh": self.tx_inh,
            "tx_phs": self.tx_phs,
            "current_screen": self.current_screen,
            "tfm_page": self.tfm_page,
            "cal_page": self.cal_page,
            "active_var_id": self.active_var_id,
            "active_var": active_var,
            "cursor_field": self.cursor_field,
            "val_nibble": self.val_nibble,
            "freq_pos": self.freq_pos,
            "checksum_status": self.checksum_status,
            "checksum_remaining": max(0.0, 10.0 - (now - self.checksum_start)) if self.checksum_status == "RUNNING" else 0.0,
            "echo_ok": echo_ok,
            "tfm_vars": self.tfm_vars,
            "cal_vars": self.cal_vars,
            "faults": {
                "label_350_raw": f"0x{label_350_raw:08X}" if label_350_raw else "00000000",
                "code1": f"{fault_code_1:02d}" if fault_code_1 > 0 else "NONE",
                "msg1": msg1 if fault_code_1 > 0 else "NO FAULT DETECTED",
                "code2": f"{fault_code_2:02d}" if fault_code_2 > 0 else "NONE",
                "msg2": msg2 if fault_code_2 > 0 else "NO FAULT DETECTED",
            },
            "confirm_action": self.confirm_action if (now - self.confirm_ts) <= 3.0 else None,
        }

    def update_config(self, **kwargs: Any) -> dict[str, Any]:
        if "freq_mhz" in kwargs:
            try:
                self.freq_mhz = round(float(kwargs["freq_mhz"]), 3)
            except (ValueError, TypeError):
                pass
        if "ssm" in kwargs:
            self.ssm = str(kwargs["ssm"]).zfill(2)[-2:]
        if "sdi" in kwargs:
            self.sdi = str(kwargs["sdi"]).zfill(2)[-2:]
        if "tx_inh" in kwargs:
            self.tx_inh = bool(kwargs["tx_inh"])
        if "tx_phs" in kwargs:
            self.tx_phs = bool(kwargs["tx_phs"])
        if "current_screen" in kwargs:
            screen = str(kwargs["current_screen"]).lower()
            if screen in {"menu", "tfm", "cal", "faults"}:
                self.current_screen = screen
                if screen == "tfm":
                    self.active_var_id = (self.tfm_page - 1) * 10 + 1
                elif screen == "cal":
                    self.active_var_id = (self.cal_page - 1) * 10 + 1
        if "tfm_page" in kwargs:
            self.tfm_page = ((int(kwargs["tfm_page"]) - 1) % 4) + 1
            self.active_var_id = (self.tfm_page - 1) * 10 + 1
        if "cal_page" in kwargs:
            self.cal_page = ((int(kwargs["cal_page"]) - 1) % 4) + 1
            self.active_var_id = (self.cal_page - 1) * 10 + 1
        if "active_var_id" in kwargs:
            self.active_var_id = int(kwargs["active_var_id"])
        if "cursor_field" in kwargs:
            self.cursor_field = str(kwargs["cursor_field"])
        if "val_nibble" in kwargs:
            self.val_nibble = int(kwargs["val_nibble"]) & 1
        if "freq_pos" in kwargs:
            self.freq_pos = max(0, min(5, int(kwargs["freq_pos"])))

        return self.get_state()

    def step_freq(self, delta: int) -> float:
        """Step current frequency digit specified by freq_pos."""
        # Positions: 0=100s, 1=10s, 2=1s, 3=0.1s, 4=0.01s, 5=0.001s
        steps = [100.0, 10.0, 1.0, 0.1, 0.01, 0.005]
        step_val = steps[self.freq_pos] if self.freq_pos < len(steps) else 0.025
        new_freq = self.freq_mhz + (delta * step_val)
        if new_freq < 118.000:
            new_freq = 118.000
        elif new_freq > 136.975:
            new_freq = 136.975
        self.freq_mhz = round(new_freq, 3)
        return self.freq_mhz

    def step_var_val(self, delta: int) -> int:
        """Step active variable RAM (or ROM) value at current nibble."""
        vars_list = self.tfm_vars if self.current_screen == "tfm" else self.cal_vars
        var = next((v for v in vars_list if v["id"] == self.active_var_id), None)
        if not var:
            return 0
        field = "ram" if self.current_screen == "tfm" else "rom"
        val = int(var.get(field, 0))
        high = (val >> 4) & 0xF
        low = val & 0xF
        if self.val_nibble == 0:
            high = (high + delta) % 16
        else:
            low = (low + delta) % 16
        new_val = (high << 4) | low
        var[field] = new_val
        return new_val

    def start_checksum(self) -> dict[str, Any]:
        """Trigger 10s recalculate ROM checksum routine."""
        self.checksum_start = time.time()
        self.checksum_status = "RUNNING"
        return self.get_state()

    def write_var(self, action: str) -> dict[str, Any]:
        """Perform 2-click write to ROM or write block to ROM."""
        now = time.time()
        if self.confirm_action != action or (now - self.confirm_ts) > 3.0:
            # First click: request confirmation
            self.confirm_action = action
            self.confirm_ts = now
            return {"status": "CONFIRM_REQUIRED", "action": action}

        # Second click within 3 seconds: perform write
        self.confirm_action = None
        self.confirm_ts = 0.0

        if action == "WRITE_ROM":
            if self.current_screen == "tfm":
                var = next((v for v in self.tfm_vars if v["id"] == self.active_var_id), None)
                if var:
                    var["rom"] = var.get("ram", 0)
            elif self.current_screen == "cal":
                # Calibration write to ROM
                pass
            return {"status": "OK", "action": action, "msg": "WRITTEN TO ROM"}

        elif action == "WRITE_BLK":
            if self.current_screen == "tfm":
                # Copy RAM to ROM for entire current page
                for var in self.tfm_vars:
                    if var["page"] == self.tfm_page:
                        var["rom"] = var.get("ram", 0)
            return {"status": "OK", "action": action, "msg": "BLOCK WRITTEN TO ROM"}

        return {"status": "UNKNOWN_ACTION"}
