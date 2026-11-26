"""ARINC 429 TX/RX session — 10 slots per channel, app mode + screen stack."""

from __future__ import annotations

import logging
import math
import os
import threading
import time
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Optional

from ate_platform.device.arinc429 import (
    audit_ballard_hardware,
    load_t1200_channels,
    require_btidriver,
    resolve_rx_channel,
    resolve_tx_channel,
    run_t1200_bus_loopback,
)
from ate_platform.device.arinc_encode import (
    DATA_MASK19,
    decode_word,
    encode_adf_freq_032,
    encode_raw_word,
    format_pads,
    join_pad,
    label_octal_str,
    parse_data19,
    parse_label,
    split_pad,
    ssm_name_from_bits,
    dissect_arinc_word,
    encode_dme_frequency_035,
    decode_dme_frequency_035,
    decode_dme_distance_202,
    decode_dme_distance_201,
)
from ate_platform.device.arinc_profile import (
    CATALOG,
    FILTER_LABELS,
    HIGH_RATES,
    LOW_RATES,
    TIME_CONSTANTS,
    LabelSpec,
    decode_label,
    delete_profile,
    dme_unpack,
    encode_label,
    label_spec_to_dict,
    list_profiles,
    load_profile,
    rate_to_high_speed,
    save_profile,
    channel_letter,
)
from ate_platform.device.label_dict import decode_received, format_display, library_catalog, lookup_label
from ate_platform.device.vhf900_align import Vhf900AlignManager
from ate_platform.device.cfds import CfdsProtocolManager
from ate_platform.paths import REPO_ROOT

try:
    from btidriver import bticard, bti429, DriverError
    HAS_BTIDRIVER = bool(bticard is not None and bti429 is not None)
except ImportError:
    HAS_BTIDRIVER = False
    bticard = None
    bti429 = None

    class DriverError(Exception):
        pass

logger = logging.getLogger("ate_platform.arinc.session")

BUSES = ("A", "B", "C", "D")
SLOTS_PER_BUS = 10
RX_RING = 64
MODES = ("standard", "cfds", "cmc")
DISPLAY_MODES = ("ENG", "BIN", "HEX")
STALE_S = 2.5
RX_AUTO = "auto"
_WORD_BITS = 32
_GAP_MAX = 65535
DME_MULTI_FREQS = (134.40, 109.75, 133.70, 114.65, 117.90, 108.00)
DME_MULTI_MODES = ("DF1", "DF2", "DF3", "DF4", "DF5", "SCAN")
MMR_BG_LABELS = ("040", "041", "042", "125", "203", "210", "260", "320")


def tx_frame_ms(rates: list[int], cap: int = 4000) -> int:
    """LCM of slot rates, capped so the looping schedule stays finite."""
    if not rates:
        return 150
    frame = max(10, int(rates[0]))
    for r in rates[1:]:
        frame = math.lcm(frame, max(10, int(r)))
        if frame > cap:
            return max(max(10, int(x)) for x in rates)
    return frame


def tx_period_bits(rate_ms: int, kbps: float) -> int:
    bit_us = 1000.0 / max(1.0, float(kbps))
    return max(_WORD_BITS + 4, int(round(float(rate_ms) * 1000.0 / bit_us)))


def _emit_gap_bits(bti429, bits: int, ch, h_core) -> None:
    bits = max(0, int(bits))
    while bits > _GAP_MAX:
        bti429.SchedGap(_GAP_MAX, ch, h_core)
        bits -= _GAP_MAX
    if bits:
        bti429.SchedGap(bits, ch, h_core)


def _build_tx_bit_schedule(bti429, addrs_rates: list[tuple[int, int]], kbps: float, log_tx, h_core) -> None:
    """Exact TX period via SchedMsg + SchedGap (bit times). SchedBuild min=max drifted ~1.5×."""
    rates = [max(10, int(r)) for _, r in addrs_rates]
    frame = tx_frame_ms(rates)
    events: list[tuple[int, int]] = []
    for addr, rate in addrs_rates:
        t = 0
        r = max(10, int(rate))
        while t < frame:
            events.append((t, addr))
            t += r
    events.sort(key=lambda x: x[0])
    bit_us = 1000.0 / max(1.0, float(kbps))

    def ms_to_bits(ms: int) -> int:
        return int(round(float(ms) * 1000.0 / bit_us))

    cursor = 0
    for t_ms, addr in events:
        target = ms_to_bits(t_ms)
        wait = target - cursor
        if wait > 0:
            _emit_gap_bits(bti429, wait, log_tx, h_core)
            cursor = target
        bti429.SchedMsg(addr, log_tx, h_core)
        cursor += _WORD_BITS
    end = ms_to_bits(frame)
    if end > cursor:
        _emit_gap_bits(bti429, end - cursor, log_tx, h_core)


@dataclass
class ChannelState:
    high_speed: bool = False
    selftest: bool = False
    tx_enable: bool = False
    rx_enable: bool = False
    odd_parity: bool = True
    display_mode: str = "ENG"
    bit_rate_kbps: float = 12.5


@dataclass
class TxSlot:
    index: int = 0
    mode: str = "raw"
    enabled: bool = False
    funct: str = ""
    label_octal: str = "000"
    data19: int = 0
    pad3: int = 0
    data16: int = 0
    freq_khz: float = 577.0
    sdi: int = 0
    ssm: str = "NML"
    parity: str = "ODD"
    rate_ms: int = 150
    raw: int = 0
    data_text: str = ""
    profile_id: str = ""
    eng_value: float | None = None
    encoding: str = "raw"
    units: str = ""
    eng_step: float = 1.0
    eng_min: float = 0.0
    eng_max: float = 0.0
    word_index: int = 1


@dataclass
class RxHit:
    funct: str = ""
    label_octal: str = ""
    data_text: str = ""
    data19: int = 0
    pad3: int = 0
    pads: str = "-"
    data16: int = 0
    sdi: int = 0
    ssm: str = ""
    parity: str = ""
    raw: int = 0
    ts: float = 0.0
    units: str = ""
    eng_value: float | None = None
    encoding: str = ""
    period_ms: int = 0
    mem: str = ""
    bf: str = ""


@dataclass
class RxTrap:
    label_octal: str = ""
    sdi: int | None = None
    triggered: bool = False


@dataclass
class RxView:
    enabled: bool = True
    filter_labels: list[str] = field(default_factory=list)
    filter_sdi: int | None = None
    last: Optional[RxHit] = None
    ring: list[RxHit] = field(default_factory=list)
    hits: int = 0
    by_label: dict[str, RxHit] = field(default_factory=dict)
    label_hits: dict[str, int] = field(default_factory=dict)
    traps: list[RxTrap] = field(default_factory=list)
    page: int = 0


def _new_slots() -> list[TxSlot]:
    return [TxSlot(index=i) for i in range(SLOTS_PER_BUS)]


def _ssm_name(ssm: int | str, encoding: str = "bnr") -> str:
    if isinstance(ssm, str):
        return ssm.upper()
    return ssm_name_from_bits(int(ssm), encoding)


class ArincSession:
    """Owns OmniBus card; 10 TX slots per channel + RX monitor for bus A-D."""

    def __init__(
        self,
        *,
        card: int = 0,
        core: int = 0,
        netlist_path: str | Path | None = None,
        high_speed: bool = False,
        simulation: bool | None = None,
    ) -> None:
        if simulation is None:
            self.simulation_mode = not HAS_BTIDRIVER
        else:
            self.simulation_mode = bool(simulation) or (not HAS_BTIDRIVER)
        self.cardnum = card
        self.hardware_info = audit_ballard_hardware(card) if not self.simulation_mode else {
            "card": card,
            "simulated": True,
            "card_type": "Simulated OmniBus II",
            "product_pn": "SIM-441-000",
            "serial_num": 9999,
            "active_core": 0,
            "active_port": "P1 (Upper Connector)",
            "cores": [
                {
                    "core": 0,
                    "core_letter": "A",
                    "port": "P1 (Upper Connector)",
                    "rx_channels": list(range(8)),
                    "tx_channels": list(range(16, 24)),
                    "count": 16,
                    "open_ok": True,
                },
                {
                    "core": 1,
                    "core_letter": "B",
                    "port": "P2 (Lower Connector)",
                    "rx_channels": [],
                    "tx_channels": [],
                    "count": 0,
                    "open_ok": True,
                },
            ],
            "warning": (
                "OmniBus II module 222-441-000 has ARINC 429 transceivers on Core 0 (P1 Upper). "
                "Core 1 (P2 Lower) is unpopulated. Ensure physical cable is connected to P1 Upper."
            ),
        }
        env_core = os.environ.get("ATE_ARINC_CORE")
        if env_core is not None:
            try:
                self.corenum = int(env_core)
            except ValueError:
                self.corenum = self.hardware_info.get("active_core", core)
        else:
            self.corenum = self.hardware_info.get("active_core", core)

        self.netlist_path = netlist_path or (
            REPO_ROOT / "netlist" / "t1200_db37_omnibus_441.yaml"
        )
        self._lock = threading.RLock()
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._running = False
        self._h_card = None
        self._h_core = None
        self._error: str | None = None
        self.app_mode: str = "standard"
        self.screen_stack: list[str] = ["mode_select"]
        self.channel: dict[str, ChannelState] = {
            b: ChannelState(high_speed=high_speed) for b in BUSES
        }
        self.tx: dict[str, list[TxSlot]] = {b: _new_slots() for b in BUSES}
        self.rx: dict[str, RxView] = {b: RxView(enabled=False) for b in BUSES}
        self._channels_meta: dict[str, Any] = {}
        self._wiring: dict[str, dict[str, Any]] = self._load_wiring()
        self.active_profile: str | None = None
        self.tx_ch: str = "A"
        self.rx_ch: str = "A"
        self.tx_profile: dict[str, str | None] = {b: None for b in BUSES}
        self.rx_profile: dict[str, str | None] = {b: None for b in BUSES}
        self._sim_override: bool = False
        self.active_lru_code: str = "709"
        self.time_constant_s: float = 0.0
        self.ln1: dict[str, str] = {"kind": "tx", "bus": "A"}
        self.ln2: dict[str, str] = {"kind": "rx", "bus": "A"}
        self.ln_edit: str = "tx"
        self.dme_mode: str | None = None
        self.dme_line: int = 0
        self.mmr_menu: str | None = None
        self.mmr_inc_time: bool = False
        self.vhf900: Vhf900AlignManager = Vhf900AlignManager()
        self.cfds: CfdsProtocolManager = CfdsProtocolManager(simulation_mode=self.simulation_mode)
        self._filter_hist: dict[tuple[str, str], list[tuple[float, float]]] = {}
        self._last_rx_ts: dict[tuple[str, str], float] = {}

        # Real-time traffic activity counter for all Ballard Core 0 channels (RX 0..7 and TX 16..23)
        self._channel_activity: dict[int, dict[str, Any]] = {}
        rx_pin_map = {
            0: ("A", "RCVR_A", "CH 0 (Banana) / DB37 Pins 29, 11"),
            1: ("SPARE", "RX_SPARE_1", "CH 1 Spare RX"),
            2: ("B", "RCVR_B", "CH 2 (Banana) / DB37 Pins 12, 31"),
            3: ("SPARE", "RX_SPARE_3", "CH 3 Spare RX"),
            4: ("C", "RCVR_C", "CH 4 (Banana) / DB37 Pins 35, 17"),
            5: ("SPARE", "RX_SPARE_5", "CH 5 Spare RX"),
            6: ("D", "RCVR_D", "CH 6 (Banana) / DB37 Pins 18, 37"),
            7: ("SPARE", "RX_SPARE_7", "CH 7 Spare RX"),
        }
        for ch in range(8):
            b_name, r_name, p_name = rx_pin_map[ch]
            self._channel_activity[ch] = {
                "channel": ch,
                "phys": ch,
                "type": "RX",
                "bus": b_name,
                "role": r_name,
                "pin_info": p_name,
                "db37_pins": p_name,
                "name": f"{r_name} (CH {ch})",
                "t1200_label": f"CH {b_name} RX",
                "hits": 0,
                "count": 0,
                "last_hex": "",
                "last_label": "",
                "last_sdi": None,
                "last_ssm": None,
                "last_ts": None,
                "age_s": None,
                "active": False,
            }
        tx_pin_map = {
            17: ("A", "XMIT_A", "CH 1 (Banana) / DB37 Pins 26, 8"),
            19: ("B", "XMIT_B", "CH 3 (Banana) / DB37 Pins 9, 28"),
            21: ("C", "XMIT_C", "CH 5 (Banana) / DB37 Pins 32, 14"),
            23: ("D", "XMIT_D", "CH 7 (Banana) / DB37 Pins 15, 34"),
        }
        for ch in range(16, 24):
            phys = ch - 16
            b_name, r_name, p_name = tx_pin_map.get(ch, ("SPARE", f"TX_SPARE_{phys}", f"CH {phys}"))
            self._channel_activity[ch] = {
                "channel": ch,
                "phys": phys,
                "type": "TX",
                "bus": b_name,
                "role": r_name,
                "pin_info": p_name,
                "db37_pins": p_name,
                "name": f"{r_name} (CH {phys})",
                "t1200_label": f"CH {b_name} TX",
                "hits": 0,
                "count": 0,
                "last_hex": "",
                "last_label": "",
                "last_sdi": None,
                "last_ssm": None,
                "last_ts": None,
                "age_s": None,
                "active": False,
            }

        try:
            self.configure_tx_slot("A", 0, mode="adf", freq_khz=577.0, enabled=False)
        except Exception as exc:
            logger.debug("default ADF preload skipped: %s", exc)

    def _load_wiring(self) -> dict[str, dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        try:
            ch = load_t1200_channels(self.netlist_path)
        except Exception as exc:
            logger.warning("ARINC wiring map not loaded: %s", exc)
            return out
        for b in BUSES:
            tx = ch.get(f"XMIT_{b}") or {}
            rx = ch.get(f"RCVR_{b}") or {}
            tx_db = tx.get("t1200_db37") or {}
            rx_db = rx.get("t1200_db37") or {}
            out[b] = {
                "phys_tx": tx.get("omnibus_phys"),
                "phys_rx": rx.get("omnibus_phys"),
                "log_tx": tx.get("bti_logical"),
                "log_rx": rx.get("bti_logical"),
                "tx_db37_hi": tx_db.get("hi"),
                "tx_db37_lo": tx_db.get("lo"),
                "rx_db37_hi": rx_db.get("hi"),
                "rx_db37_lo": rx_db.get("lo"),
            }
        return out

    def _record_channel_traffic(self, ch: int, data: int, is_tx: bool = False) -> None:
        """Update live activity metrics for physical/logical channel ch."""
        now_s = time.time()
        w = int(data) & 0xFFFFFFFF
        with self._lock:
            if ch not in self._channel_activity:
                phys = ch if not is_tx else ch - 16
                self._channel_activity[ch] = {
                    "channel": ch,
                    "phys": phys,
                    "type": "TX" if is_tx else "RX",
                    "bus": "OTHER",
                    "role": f"{'TX' if is_tx else 'RX'}_{ch}",
                    "pin_info": f"Channel {ch}",
                    "hits": 0,
                    "last_hex": "",
                    "last_label": "",
                    "last_sdi": None,
                    "last_ssm": None,
                    "last_ts": None,
                    "age_s": None,
                    "last_seen_s": None,
                    "count": 0,
                    "active": False,
                }
            entry = self._channel_activity[ch]
            entry["hits"] += 1
            entry["count"] = entry["hits"]
            entry["last_hex"] = f"0x{w:08X}"
            entry["last_label"] = f"{w & 0xFF:03o}"
            entry["last_sdi"] = (w >> 8) & 0x3
            entry["last_ssm"] = (w >> 29) & 0x3
            entry["last_ts"] = now_s
            entry["age_s"] = 0.0
            entry["last_seen_s"] = 0.0
            entry["active"] = True

    def get_channel_activity(self) -> list[dict[str, Any]]:
        """Return real-time status and traffic counters across all Ballard transceivers."""
        now = time.time()
        with self._lock:
            result = []
            for ch, entry in sorted(self._channel_activity.items()):
                item = dict(entry)
                item["count"] = item["hits"]
                if item["last_ts"] is not None:
                    age = round(now - item["last_ts"], 2)
                    item["age_s"] = age
                    item["last_seen_s"] = age
                    item["active"] = age <= 2.5
                else:
                    item["age_s"] = None
                    item["last_seen_s"] = None
                    item["active"] = False
                result.append(item)
            return result

    def hardware_selftest(self) -> dict[str, Any]:
        """Execute non-destructive Ballard internal hardware selftest loopback across all 4 buses."""
        self._force_reconfig = True
        if not HAS_BTIDRIVER or self._sim_override:
            return {
                "success": True,
                "overall_status": "PASS",
                "simulated": True,
                "summary": "All 4 ARINC 429 buses PASSED internal loopback self-test (Simulation).",
                "message": "All 4 ARINC 429 buses PASSED internal loopback self-test (Simulation).",
                "buses": {
                    "A": {"status": "PASS", "tx_ch": 1, "rx_ch": 0, "tx_hits": 10, "rx_hits": 10, "label": "201", "detail": "PASS (simulated)"},
                    "B": {"status": "PASS", "tx_ch": 3, "rx_ch": 2, "tx_hits": 10, "rx_hits": 10, "label": "202", "detail": "PASS (simulated)"},
                    "C": {"status": "PASS", "tx_ch": 5, "rx_ch": 4, "tx_hits": 10, "rx_hits": 10, "label": "203", "detail": "PASS (simulated)"},
                    "D": {"status": "PASS", "tx_ch": 7, "rx_ch": 6, "tx_hits": 10, "rx_hits": 10, "label": "204", "detail": "PASS (simulated)"},
                },
            }

        try:
            hits = run_t1200_bus_loopback(
                cardnum=self.cardnum,
                corenum=self.corenum,
                netlist_path=self.netlist_path,
                high_speed=False,
                seconds=1.2,
                min_hits=2,
                selftest=True,
                buses=["A", "B", "C", "D"],
            )
            bus_results = {}
            all_ok = True
            for h in hits:
                bus_results[h.bus] = {
                    "status": "PASS" if h.ok else "FAIL",
                    "tx_ch": h.phys_tx,
                    "rx_ch": h.phys_rx,
                    "tx_hits": h.tx_hits,
                    "rx_hits": h.rx_hits,
                    "last_rx": f"0x{h.last_rx:08X}" if h.last_rx is not None else None,
                    "detail": h.detail,
                }
                if not h.ok:
                    all_ok = False
            return {
                "success": all_ok,
                "overall_status": "PASS" if all_ok else "FAIL",
                "simulated": False,
                "summary": "All 4 ARINC 429 buses PASSED Ballard internal transceiver selftest." if all_ok else "One or more buses failed internal selftest.",
                "message": "All 4 ARINC 429 buses PASSED Ballard internal transceiver selftest." if all_ok else "One or more buses failed internal selftest.",
                "buses": bus_results,
            }
        except Exception as exc:
            return {
                "success": False,
                "overall_status": "FAIL",
                "simulated": False,
                "error": str(exc),
                "message": f"Selftest execution error: {exc}",
                "summary": f"Hardware selftest error: {exc}",
                "buses": {},
            }
        finally:
            # Force background worker to re-apply channel configuration, filters, and restart card
            self._force_reconfig = True
            time.sleep(0.15)

    # --- navigation -----------------------------------------------------

    def set_mode(self, mode: str) -> str:
        mode = mode.lower()
        if mode not in MODES:
            raise ValueError(f"mode must be {MODES}")
        with self._lock:
            self.app_mode = mode
            self.screen_stack = ["mode_select", mode]
            return self.app_mode

    def push_screen(self, screen: str) -> list[str]:
        with self._lock:
            self.screen_stack.append(screen)
            return list(self.screen_stack)

    def pop_screen(self) -> list[str]:
        with self._lock:
            if len(self.screen_stack) > 1:
                self.screen_stack.pop()
            return list(self.screen_stack)

    # --- channel --------------------------------------------------------

    def configure_channel(
        self,
        bus: str,
        *,
        high_speed: bool | None = None,
        selftest: bool | None = None,
        tx_enable: bool | None = None,
        rx_enable: bool | None = None,
        odd_parity: bool | None = None,
        display_mode: str | None = None,
        bit_rate_kbps: float | None = None,
    ) -> ChannelState:
        bus = bus.upper()
        with self._lock:
            cfg = self.channel[bus]
            if bit_rate_kbps is not None:
                cfg.bit_rate_kbps = float(bit_rate_kbps)
                cfg.high_speed = rate_to_high_speed(cfg.bit_rate_kbps)
            elif high_speed is not None:
                cfg.high_speed = bool(high_speed)
                cfg.bit_rate_kbps = 100.0 if cfg.high_speed else 12.5
            if selftest is not None:
                cfg.selftest = bool(selftest)
            if tx_enable is not None:
                cfg.tx_enable = bool(tx_enable)
            if rx_enable is not None:
                cfg.rx_enable = bool(rx_enable)
                self.rx[bus].enabled = cfg.rx_enable
            if odd_parity is not None:
                cfg.odd_parity = bool(odd_parity)
            if display_mode is not None:
                dm = display_mode.upper()
                if dm not in DISPLAY_MODES:
                    raise ValueError(f"display_mode must be {DISPLAY_MODES}")
                cfg.display_mode = dm
            return cfg

    def set_bit_rate(self, high_speed: bool, buses: list[str] | None = None) -> None:
        targets = [b.upper() for b in (buses or list(BUSES))]
        with self._lock:
            for b in targets:
                self.channel[b].high_speed = bool(high_speed)
                self.channel[b].bit_rate_kbps = 100.0 if high_speed else 12.5

    # --- TX slots -------------------------------------------------------

    def configure_tx_slot(
        self,
        bus: str,
        slot: int,
        *,
        mode: str = "raw",
        label: int | str = "000",
        data: int | str = 0,
        data19: int | str | None = None,
        pad3: int | None = None,
        data16: int | None = None,
        sdi: int = 0,
        ssm: int | str = "NML",
        rate_ms: int = 150,
        odd_parity: bool = True,
        enabled: bool | None = None,
        raw_word: int | str | None = None,
        freq_khz: float | None = None,
        profile: str | None = None,
        eng_value: float | str | None = None,
    ) -> TxSlot:
        bus = bus.upper()
        if bus not in BUSES:
            raise ValueError(f"bus must be {BUSES}")
        if not (0 <= int(slot) < SLOTS_PER_BUS):
            raise ValueError(f"slot must be 0..{SLOTS_PER_BUS - 1}")
        mode_l = mode.lower()

        if raw_word is not None:
            if isinstance(raw_word, str):
                s = raw_word.strip().lower()
                raw = int(s, 16) if s.startswith("0x") else int(s, 0)
            else:
                raw = int(raw_word) & 0xFFFFFFFF
            decoded = decode_word(raw, profile="none")
            with self._lock:
                sl = self.tx[bus][int(slot)]
                if enabled is not None:
                    sl.enabled = enabled
                sl.mode = "raw"
                sl.funct = "RAW"
                sl.profile_id = ""
                sl.eng_value = None
                sl.label_octal = decoded.label_octal
                sl.data19 = decoded.data19
                sl.pad3 = decoded.pad3
                sl.data16 = decoded.data16
                sl.data_text = decoded.data_text
                sl.sdi = decoded.sdi
                sl.ssm = decoded.ssm_name
                sl.parity = "ODD" if odd_parity else "EVEN"
                sl.rate_ms = max(10, int(rate_ms))
                sl.raw = raw
                return sl

        pid = ""
        if mode_l != "raw":
            pid = (profile or "").strip()
            if not pid:
                if mode_l in {"adf", "adf_032"}:
                    pid = "adf_032"
                elif mode_l in {"dme", "freq", "dme_freq"}:
                    pid = "dme"
                else:
                    pid = mode_l
            elif pid in {"freq", "dme_freq"}:
                pid = "dme"
        if pid:
            spec_profile = load_profile(pid)
            wanted = str(label or "").strip()
            spec = spec_profile.find_label(wanted.zfill(3)) if wanted and wanted not in {"000", "0"} else None
            if spec is None:
                spec = spec_profile.labels[0] if spec_profile.labels else None
            if spec is None:
                raise ValueError(f"profile {pid} has no labels")
            spec = replace(
                spec,
                sdi=int(sdi) & 0x3,
                ssm=_ssm_name(ssm),
                rate_ms=max(10, int(rate_ms)),
                parity="ODD" if odd_parity else "EVEN",
            )
            if eng_value is not None:
                value: Any = eng_value
            elif freq_khz is not None:
                value = float(freq_khz)
            elif spec.eng_default is not None:
                value = spec.eng_default
            else:
                value = 0.0
            raw = encode_label(spec, value)
            decoded = decode_word(raw)
            eng = decode_label(spec, raw)
            with self._lock:
                sl = self.tx[bus][int(slot)]
                if enabled is not None:
                    sl.enabled = enabled
                sl.mode = "lru"
                sl.profile_id = pid
                sl.funct = spec.funct
                sl.label_octal = spec.label_octal
                try:
                    sl.eng_value = float(value)
                except (TypeError, ValueError):
                    sl.eng_value = None
                sl.freq_khz = float(value) if spec.encoding in {"bcd_freq_khz", "bcd_tenths_khz"} else sl.freq_khz
                sl.data19 = decoded.data19
                sl.pad3 = decoded.pad3
                sl.data16 = decoded.data16
                sl.data_text = eng.get("data_text") or decoded.data_text
                sl.sdi = spec.sdi
                sl.ssm = spec.ssm
                sl.parity = "ODD" if odd_parity else "EVEN"
                sl.rate_ms = spec.rate_ms
                sl.raw = raw
                sl.encoding = spec.encoding
                sl.units = spec.units
                sl.eng_step = spec.eng_step
                sl.eng_min = spec.eng_min
                sl.eng_max = spec.eng_max
                sl.word_index = spec.word_index
                return sl

        if mode_l == "adf":
            freq = float(freq_khz) if freq_khz is not None else 577.0
            raw = encode_adf_freq_032(freq, sdi=sdi, ssm=ssm)
            decoded = decode_word(raw)
            with self._lock:
                sl = self.tx[bus][int(slot)]
                if enabled is not None:
                    sl.enabled = enabled
                sl.mode = "adf"
                sl.funct = "ADF"
                sl.label_octal = "032"
                sl.freq_khz = freq
                sl.data19 = decoded.data19
                sl.pad3 = decoded.pad3
                sl.data16 = decoded.data16
                sl.data_text = f"{freq:.1f} KHZ"
                sl.sdi = int(sdi) & 0x3
                sl.ssm = _ssm_name(ssm)
                sl.parity = "ODD"
                sl.rate_ms = max(10, int(rate_ms))
                sl.raw = raw
                return sl

        # raw mode
        if data19 is not None:
            d19 = int(data19) & DATA_MASK19 if isinstance(data19, int) else parse_data19(data19)
        elif pad3 is not None or data16 is not None:
            p3v = int(pad3 or 0) & 0x7
            d16v = (parse_data19(data16) if isinstance(data16, str) else int(data16 or 0)) & 0x7FFF
            d19 = join_pad(p3v, d16v)
        else:
            d19 = int(data) & DATA_MASK19 if isinstance(data, int) else parse_data19(data)
        raw = encode_raw_word(label, d19, sdi=sdi, ssm=ssm, odd_parity=odd_parity)
        lab = parse_label(label)
        p3, d16 = split_pad(d19)
        with self._lock:
            sl = self.tx[bus][int(slot)]
            if enabled is not None:
                sl.enabled = enabled
            sl.mode = "raw"
            sl.funct = "RAW"
            sl.profile_id = ""
            sl.eng_value = None
            sl.label_octal = label_octal_str(lab)
            sl.data19 = d19
            sl.pad3 = p3
            sl.data16 = d16
            sl.data_text = f"0x{d19:05X}"
            sl.sdi = int(sdi) & 0x3
            sl.ssm = _ssm_name(ssm)
            sl.parity = "ODD" if odd_parity else "EVEN"
            sl.rate_ms = max(10, int(rate_ms))
            sl.raw = raw
            return sl

    def clear_tx_slot(self, bus: str, slot: int) -> TxSlot:
        bus = bus.upper()
        with self._lock:
            sl = self.tx[bus][int(slot)]
            sl.enabled = False
            sl.label_octal = "000"
            sl.data19 = 0
            sl.pad3 = 0
            sl.data16 = 0
            sl.raw = 0
            sl.data_text = ""
            sl.funct = ""
            sl.mode = "raw"
            sl.profile_id = ""
            sl.eng_value = None
            return sl

    # --- RX -------------------------------------------------------------

    def configure_rx(
        self,
        bus: str,
        *,
        enabled: bool | None = None,
        filter_labels: list[str] | None = None,
        filter_sdi: int | None = ...,  # type: ignore[assignment]
    ) -> RxView:
        bus = bus.upper()
        with self._lock:
            view = self.rx[bus]
            if enabled is not None:
                view.enabled = enabled
                self.channel[bus].rx_enable = enabled
            if filter_labels is not None:
                view.filter_labels = [
                    label_octal_str(parse_label(x)) for x in filter_labels if str(x).strip()
                ]
            if filter_sdi is not ...:
                view.filter_sdi = filter_sdi
            return view

    def clear_rx_hits(self, bus: str | None = None) -> None:
        with self._lock:
            targets = [bus.upper()] if bus else list(BUSES)
            for b in targets:
                v = self.rx[b]
                v.hits = 0
                v.last = None
                v.ring.clear()
                v.by_label.clear()
                v.label_hits.clear()
                v.page = 0

    def set_rx_trap(self, bus: str, label: str, sdi: int | None = None, *, clear: bool = False) -> RxView:
        bus = bus.upper()
        lab = label_octal_str(parse_label(label))
        with self._lock:
            view = self.rx[bus]
            if clear:
                view.traps = [t for t in view.traps if not (t.label_octal == lab and (sdi is None or t.sdi == sdi))]
                if lab in view.by_label and not any(t.label_octal == lab for t in view.traps):
                    pass
                return view
            for t in view.traps:
                if t.label_octal == lab and t.sdi == sdi:
                    t.triggered = False
                    return view
            view.traps.append(RxTrap(label_octal=lab, sdi=sdi, triggered=False))
            return view

    def set_rx_page(self, bus: str, page: int) -> None:
        with self._lock:
            self.rx[bus.upper()].page = max(0, int(page))

    def set_time_constant(self, seconds: float) -> None:
        val = float(seconds)
        nearest = min(TIME_CONSTANTS, key=lambda x: abs(x - val))
        with self._lock:
            self.time_constant_s = nearest
            self._filter_hist.clear()

    def set_line(self, which: str, kind: str, bus: str) -> None:
        kind = kind.lower()
        bus = bus.upper()
        if kind not in {"tx", "rx"} or bus not in BUSES:
            raise ValueError("kind tx/rx and bus A-D")
        with self._lock:
            if which == "ln1":
                self.ln1 = {"kind": kind, "bus": bus}
            else:
                self.ln2 = {"kind": kind, "bus": bus}
            if kind == "tx":
                self.tx_ch = bus
                self.channel[bus].tx_enable = True
            elif kind == "rx":
                self.rx_ch = bus
                self.channel[bus].rx_enable = True
                self.rx[bus].enabled = True

    def set_active_channels(self, tx_ch: str | None = None, rx_ch: str | None = None) -> dict[str, Any]:
        with self._lock:
            if tx_ch:
                t = tx_ch.upper()
                if t in BUSES:
                    self.tx_ch = t
                    self.channel[t].tx_enable = True
            if rx_ch:
                r = rx_ch.upper()
                if r in BUSES:
                    self.rx_ch = r
                    self.channel[r].rx_enable = True
                    self.rx[r].enabled = True
            return self._snapshot_locked()

    def set_ln_edit(self, kind: str) -> None:
        kind = kind.lower()
        if kind not in {"tx", "rx"}:
            raise ValueError("ln_edit must be tx or rx")
        with self._lock:
            self.ln_edit = kind

    def ingest_rx_word(self, bus: str, raw: int, ts: float | None = None) -> RxHit | None:
        """Decode one received word via the label dictionary. Used by worker and tests."""
        bus = bus.upper()
        now = float(ts if ts is not None else time.time())
        bus_rx_map = {"A": 0, "B": 2, "C": 4, "D": 6}
        self._record_channel_traffic(bus_rx_map.get(bus, 0), int(raw), is_tx=False)
        with self._lock:
            if not self.rx[bus].enabled or not self.channel[bus].rx_enable:
                return None
            filters = list(self.rx[bus].filter_labels)
            dm = self.channel[bus].display_mode
            tc = self.time_constant_s
        rec = decode_received(int(raw), display_mode=dm)
        if filters and rec["label_octal"] not in filters:
            dme_active = (self.active_profile == "dme" or getattr(self, "dme_mode", "") in {"standard", "single", "multi"} or getattr(self, "screen", "") in {"dme_diagnostic", "dme_single", "dme_multi", "standard_dme"})
            if not (dme_active and rec["label_octal"] in {"035", "201", "202", "246", "247"}):
                return None
        eng_val = rec.get("eng_value")
        if tc > 0 and rec["label_octal"] in FILTER_LABELS and isinstance(eng_val, (int, float)):
            key = (bus, rec["label_octal"])
            with self._lock:
                hist = self._filter_hist.setdefault(key, [])
                hist.append((now, float(eng_val)))
                hist[:] = [p for p in hist if now - p[0] <= tc]
                if hist:
                    eng_val = sum(p[1] for p in hist) / len(hist)
                    rec["eng_value"] = eng_val
                    units = rec.get("units") or ""
                    rec["data_text"] = f"{eng_val:.2f} {units}".strip()
                    rec["data_display"] = rec["data_text"] if dm == "ENG" else rec["data_display"]
        hit = RxHit(
            funct=rec["funct"],
            label_octal=rec["label_octal"],
            data_text=rec["data_text"] if dm == "ENG" else rec["data_display"],
            data19=rec["data19"],
            pad3=rec["pad3"],
            pads=rec.get("pads") or "-",
            data16=rec["data16"],
            sdi=rec["sdi"],
            ssm=rec["ssm_name"],
            parity="ODD" if rec["parity_odd"] else "EVEN",
            raw=rec["raw"],
            ts=now,
            units=rec.get("units") or "",
            eng_value=float(eng_val) if isinstance(eng_val, (int, float)) else None,
            encoding=rec.get("encoding") or "",
            mem=rec.get("mem") or "",
            bf=rec.get("bf") or "",
        )
        with self._lock:
            v = self.rx[bus]
            prev = v.by_label.get(hit.label_octal)
            if prev and prev.ts:
                hit.period_ms = max(1, int(round((now - prev.ts) * 1000)))
            else:
                lib = lookup_label(hit.label_octal)
                hit.period_ms = int(lib.rate_ms) if lib and lib.rate_ms else 0
            v.last = hit
            v.hits += 1
            v.by_label[hit.label_octal] = hit
            v.label_hits[hit.label_octal] = v.label_hits.get(hit.label_octal, 0) + 1
            v.ring.append(hit)
            if len(v.ring) > RX_RING:
                v.ring.pop(0)
            for t in v.traps:
                if t.label_octal == hit.label_octal and (t.sdi is None or t.sdi == hit.sdi):
                    t.triggered = True
        if hasattr(self, "cfds") and self.cfds.active:
            try:
                self.cfds.ingest_rx_word(hit.raw, hit.label_octal)
            except Exception:
                pass
        return hit

    def catalog(self) -> list[dict[str, Any]]:
        return [dict(x) for x in CATALOG]

    def label_library(self) -> list[dict[str, Any]]:
        return library_catalog()

    # --- profiles -------------------------------------------------------

    def available_profiles(self) -> list[dict[str, Any]]:
        return list_profiles()

    def profile_detail(self, profile_id: str) -> dict[str, Any]:
        p = load_profile(profile_id)
        return {
            "id": p.id,
            "name": p.name,
            "funct": p.funct,
            "mode": p.mode,
            "bus": p.tx_ch,
            "tx_ch": p.tx_ch,
            "rx_ch": p.rx_ch,
            "high_speed": p.high_speed,
            "characteristic": p.characteristic,
            "notes": p.notes,
            "labels": [label_spec_to_dict(ls) for ls in p.labels],
        }

    def upsert_profile(self, payload: dict[str, Any], *, overwrite: bool) -> dict[str, Any]:
        save_profile(payload, overwrite=overwrite)
        return self.profile_detail(str(payload["id"]))

    def remove_profile(self, profile_id: str) -> None:
        delete_profile(profile_id)
        with self._lock:
            if self.active_profile == profile_id:
                self.active_profile = None
            for b in BUSES:
                if self.tx_profile.get(b) == profile_id:
                    self.tx_profile[b] = None
                if self.rx_profile.get(b) == profile_id:
                    self.rx_profile[b] = None

    def _paint_slot(self, sl: TxSlot, spec: LabelSpec, value: Any, profile_id: str) -> None:
        raw = encode_label(spec, value)
        from ate_platform.device.arinc_encode import decode_word as _dw
        decoded = _dw(raw)
        sl.enabled = True
        sl.mode = "lru"
        sl.profile_id = profile_id
        if isinstance(value, dict) and "value" in value:
            try:
                sl.eng_value = float(value["value"])
            except (TypeError, ValueError):
                sl.eng_value = None
        else:
            try:
                sl.eng_value = float(value)
            except (TypeError, ValueError):
                sl.eng_value = None
        sl.funct = spec.funct
        sl.label_octal = spec.label_octal
        sl.data19 = decoded.data19
        sl.pad3 = decoded.pad3
        sl.data16 = decoded.data16
        sl.sdi = spec.sdi
        sl.ssm = spec.ssm
        sl.parity = spec.parity or "ODD"
        sl.rate_ms = spec.rate_ms
        sl.raw = raw
        sl.encoding = spec.encoding
        sl.units = spec.units
        sl.eng_step = spec.eng_step
        sl.eng_min = spec.eng_min
        sl.eng_max = spec.eng_max
        sl.word_index = spec.word_index
        try:
            dec = decode_label(spec, raw)
            if sl.eng_value is None and dec.get("eng_value") is not None:
                sl.eng_value = dec["eng_value"]
            sl.data_text = dec.get("data_text") or f"{value} {spec.units}".strip()
            if dec.get("extra", {}).get("pads"):
                sl.pads = dec["extra"]["pads"]
        except Exception:
            sl.data_text = f"{value} {spec.units}".strip()

    def _seed_rx_template(self, bus: str, spec: LabelSpec) -> None:
        v = self.rx[bus]
        if spec.label_octal in v.by_label:
            hit = v.by_label[spec.label_octal]
            if not hit.funct:
                hit.funct = spec.funct
            if not hit.units:
                hit.units = spec.units
            if not hit.encoding:
                hit.encoding = spec.encoding
            if not hit.parity:
                hit.parity = spec.parity or "ODD"
            return
        v.by_label[spec.label_octal] = RxHit(
            funct=spec.funct,
            label_octal=spec.label_octal,
            data_text="—",
            units=spec.units,
            encoding=spec.encoding,
            parity=spec.parity or "ODD",
            ts=0.0,
        )

    def _reset_rx_unlocked(self, bus: str) -> None:
        v = self.rx[bus]
        v.hits = 0
        v.last = None
        v.ring.clear()
        v.by_label.clear()
        v.label_hits.clear()
        v.page = 0
        v.traps.clear()
        v.filter_labels = []
        v.filter_sdi = None
        for key in [k for k in self._filter_hist if k[0] == bus]:
            del self._filter_hist[key]
        for key in [k for k in self._last_rx_ts if k[0] == bus]:
            del self._last_rx_ts[key]

    def _blank_tx_unlocked(self, bus: str) -> None:
        for sl in self.tx[bus]:
            sl.enabled = False
            sl.label_octal = "000"
            sl.data19 = 0
            sl.raw = 0
            sl.data_text = ""
            sl.funct = ""
            sl.mode = "raw"
            sl.encoding = "raw"
            sl.units = ""
            sl.profile_id = ""

    def _scope_rx_to_profile_unlocked(self, profile, bus: str) -> None:
        """RX list + hardware filter = this template, on this CH only."""
        bus = channel_letter(bus)
        self._reset_rx_unlocked(bus)
        expected: list[str] = []
        seen: set[str] = set()
        for ls in profile.labels:
            lab = ls.label_octal.zfill(3)
            if lab in seen:
                continue
            seen.add(lab)
            expected.append(lab)
            self._seed_rx_template(bus, ls)
        self.rx[bus].filter_labels = list(expected)
        self.rx[bus].enabled = True

    def _drop_rx_seeds_unlocked(self, bus: str) -> None:
        v = self.rx[bus]
        v.by_label = {k: h for k, h in v.by_label.items() if h.raw}
        v.filter_labels = []
        v.filter_sdi = None
        for key in [k for k in self._filter_hist if k[0] == bus]:
            del self._filter_hist[key]

    def _apply_rx_auto_unlocked(self, bus: str) -> None:
        bus = channel_letter(bus)
        self.rx_ch = bus
        self.rx_profile[bus] = None
        self.channel[bus].rx_enable = True
        self.rx[bus].enabled = True
        self.rx[bus].page = 0
        self._drop_rx_seeds_unlocked(bus)

    def _disarm_specials_unlocked(self, keep: str | None = None) -> None:
        if keep != "dme":
            self.dme_mode = None
            self.dme_line = 0
        if keep != "mmr":
            self.mmr_menu = None
            self.mmr_inc_time = False
        if keep != "vhf_align":
            self.vhf900.current_screen = "menu"

    def apply_profile(
        self,
        profile_id: str,
        tx_ch: str | None = None,
        rx_ch: str | None = None,
        *,
        apply_tx: bool = True,
        apply_rx: bool = True,
        reset: bool = False,
    ) -> dict[str, Any]:
        pid = str(profile_id or "").strip()
        if pid.lower() == RX_AUTO:
            rx_ch = channel_letter(rx_ch or self.rx_ch)
            with self._lock:
                if apply_rx:
                    self._apply_rx_auto_unlocked(rx_ch)
                return self._snapshot_locked()
        profile = load_profile(profile_id)
        tx_ch = channel_letter(tx_ch or profile.tx_ch)
        rx_ch = channel_letter(rx_ch or profile.rx_ch)
        with self._lock:
            prev_profile = self.active_profile
            self.active_profile = profile.id
            self._disarm_specials_unlocked(keep="mmr" if profile.id == "mmr_755" else ("vhf_align" if profile.id == "vhf_align" else None))
            if apply_tx:
                self.tx_ch = tx_ch
                self.tx_profile[tx_ch] = profile.id
                cfg = self.channel[tx_ch]
                cfg.high_speed = profile.high_speed
                cfg.bit_rate_kbps = 100.0 if profile.high_speed else 12.5
                cfg.tx_enable = True

                has_configured_slots = any(
                    sl.profile_id == profile.id and sl.label_octal != "000" for sl in self.tx[tx_ch]
                )
                should_init = reset or (prev_profile != profile.id) or not has_configured_slots

                if should_init:
                    self._blank_tx_unlocked(tx_ch)
                    tx_specs = [ls for ls in profile.labels if ls.direction in ("tx", "both", "")]
                    slot_i = 0
                    for spec in tx_specs:
                        if slot_i >= SLOTS_PER_BUS:
                            break
                        default = spec.eng_default if spec.eng_default is not None else 0.0
                        self._paint_slot(self.tx[tx_ch][slot_i], spec, default, profile.id)
                        self.tx[tx_ch][slot_i].index = slot_i
                        slot_i += 1
            if apply_rx:
                self.rx_ch = rx_ch
                self.rx_profile[rx_ch] = profile.id
                self.channel[rx_ch].rx_enable = True
                self.rx[rx_ch].enabled = True
                self._scope_rx_to_profile_unlocked(profile, rx_ch)
            if apply_tx and profile.id == "mmr_755":
                self._arm_mmr_background_locked()
            return self._snapshot_locked()

    def set_label_value(
        self, profile_id: str, label_octal: str, value: Any, word_index: int | None = None,
    ) -> dict[str, Any]:
        profile = load_profile(profile_id)
        spec = profile.find_label(label_octal.zfill(3), word_index=word_index)
        if spec is None:
            raise ValueError(f"label {label_octal} not in profile {profile_id}")
        bus = self.tx_ch
        for b, pid in self.tx_profile.items():
            if pid == profile.id:
                bus = b
                break
        bus = channel_letter(spec.bus or bus or profile.tx_ch)
        with self._lock:
            idx = None
            for i, sl in enumerate(self.tx[bus]):
                if sl.label_octal == spec.label_octal and (
                    word_index is None or sl.word_index == spec.word_index
                ):
                    idx = i
                    break
            if idx is None:
                idx = 0
            self._paint_slot(self.tx[bus][idx], spec, value, profile.id)
            self.tx[bus][idx].index = idx
            self.active_profile = profile.id
            self.tx_ch = bus
            self.tx_profile[bus] = profile.id
            return self._snapshot_locked()

    def _fill_slot_from_spec(self, bus: str, index: int, spec: LabelSpec, value: Any, *, enabled: bool = True) -> None:
        self._paint_slot(self.tx[bus][index], spec, value, spec.funct)
        self.tx[bus][index].index = index
        self.tx[bus][index].enabled = enabled

    def _arm_mmr_background_locked(self) -> None:
        self.channel["B"].tx_enable = True
        self.channel["B"].high_speed = False
        self.channel["B"].bit_rate_kbps = 12.5
        self.channel["C"].tx_enable = True
        self.channel["C"].high_speed = True
        self.channel["C"].bit_rate_kbps = 100.0
        defaults = {"040": 0, "041": 0, "042": 0, "125": 120000, "203": 0, "210": 0, "260": 101, "320": 0}
        for bus in ("B", "C"):
            for sl in self.tx[bus]:
                sl.enabled = False
                sl.raw = 0
            for i, lab in enumerate(MMR_BG_LABELS[:SLOTS_PER_BUS]):
                spec = lookup_label(lab)
                if spec is None:
                    continue
                self._fill_slot_from_spec(bus, i, spec, defaults.get(lab, 0))

    def apply_dme_mode(self, mode: str, reset: bool = False) -> dict[str, Any]:
        mode = mode.lower()
        if mode not in {"standard", "single", "multi"}:
            raise ValueError("dme mode must be standard, single, or multi")
        spec = lookup_label("035")
        if spec is None:
            raise ValueError("DME label 035 missing from dictionary")
        with self._lock:
            prev_mode = self.dme_mode
            prev_profile = self.active_profile
            self.dme_mode = mode
            self.active_profile = "dme"
            self.dme_line = 0
            bus = self.tx_ch or "A"
            if bus not in BUSES:
                bus = "A"
            for b in BUSES:
                if b == bus:
                    self.channel[b].tx_enable = True
                    self.channel[b].rx_enable = True
                    self.channel[b].high_speed = False
                    self.channel[b].bit_rate_kbps = 12.5
                else:
                    self.channel[b].high_speed = False
                    self.channel[b].bit_rate_kbps = 12.5
                    if b in ("C", "D"):
                        self.channel[b].tx_enable = False
                        self.channel[b].rx_enable = False
            self.rx[bus].enabled = True
            self.tx_ch = bus
            self.rx_ch = bus
            self.tx_profile[bus] = "dme"
            self.rx_profile[bus] = "dme"
            self._disarm_specials_unlocked(keep="dme")
            self._scope_rx_to_profile_unlocked(load_profile("dme"), bus)

            is_same_family = (prev_mode == mode) or (prev_mode in {"standard", "single"} and mode in {"standard", "single"})
            has_configured_slots = any(
                (sl.label_octal == "035" and sl.raw != 0) or sl.enabled for sl in self.tx[bus]
            )
            should_init = reset or (not is_same_family) or (prev_profile != "dme") or not has_configured_slots

            if should_init:
                for sl in self.tx[bus]:
                    sl.enabled = False
                    sl.raw = 0
                    sl.label_octal = "000"
                if mode == "multi":
                    for i, (freq, dm) in enumerate(zip(DME_MULTI_FREQS, DME_MULTI_MODES)):
                        self._fill_slot_from_spec(
                            bus, i, spec, {"value": freq, "mode": dm, "nav": "VOR", "sdi": 0, "ssm": "NML"},
                        )
                        self.tx[bus][i].rate_ms = 100
                else:
                    self._fill_slot_from_spec(
                        bus, 0, spec, {"value": 134.40, "mode": "DF1", "nav": "VOR", "disp": True},
                    )
                    self.tx[bus][0].rate_ms = 100
            if mode == "standard":
                self.screen_stack = ["mode_select", "standard", "avionics_lru", "dme_config", "dme_standard"]
            elif mode == "single":
                self.screen_stack = ["mode_select", "standard", "avionics_lru", "dme_config", "dme_single"]
            else:
                self.screen_stack = ["mode_select", "standard", "avionics_lru", "dme_config", "dme_multi"]
            return self._snapshot_locked()

    def configure_dme_slot(
        self,
        index: int,
        *,
        bus: str = "A",
        freq_mhz: float | None = None,
        mode: str | None = None,
        nav: str | None = None,
        disp: bool | None = None,
        ident: bool | None = None,
        sdi: int | None = None,
        ssm: str | None = None,
        pad: str | None = None,
        parity: str = "ODD",
        rate_ms: int = 100,
        enabled: bool | None = None,
    ) -> dict[str, Any]:
        spec = lookup_label("035")
        if spec is None:
            raise ValueError("DME label 035 missing")
        bus = bus.upper() if bus else "A"
        if bus not in BUSES:
            bus = "A"
        with self._lock:
            sl = self.tx[bus][int(index)]
            from ate_platform.device.arinc_profile import dme_unpack, DME_MODE_BITS, DME_NAV_BITS
            cur = dme_unpack(sl.data19) if sl.raw else {"freq_mhz": 134.40, "mode": "DF1", "nav": "VOR", "disp": True, "ident": False, "pads": "0100001"}
            target_mode = mode if mode is not None else cur["mode"]
            target_nav = nav if nav is not None else cur["nav"]
            target_disp = disp if disp is not None else cur["disp"]
            target_ident = ident if ident is not None else cur["ident"]

            if pad is not None and str(pad).strip():
                clean_pad = str(pad).strip()
                try:
                    p_val = int(clean_pad, 2) if all(c in "01" for c in clean_pad) else int(clean_pad, 0)
                    if mode is None:
                        mode_i = p_val & 0x7
                        target_mode = next((k for k, v in DME_MODE_BITS.items() if v == mode_i), target_mode)
                    if nav is None:
                        nav_i = (p_val >> 3) & 0x3
                        target_nav = next((k for k, v in DME_NAV_BITS.items() if v == nav_i), target_nav)
                    if disp is None:
                        target_disp = bool((p_val >> 5) & 1)
                    if ident is None:
                        target_ident = bool((p_val >> 6) & 1)
                except Exception:
                    pass

            target_ssm = ssm or sl.ssm
            if target_mode in {"NCD", "FT"}:
                target_ssm = target_mode
            elif target_mode == "OFF":
                target_ssm = "FT"

            m_val = DME_MODE_BITS.get(str(target_mode).upper(), 1) & 0x7
            n_val = (DME_NAV_BITS.get(str(target_nav).upper(), 0) & 0x3) << 3
            d_val = (1 if target_disp else 0) << 5
            i_val = (1 if target_ident else 0) << 6
            p_val = m_val | n_val | d_val | i_val
            clean_pad = format(p_val, "07b")

            payload: dict[str, Any] = {
                "value": float(freq_mhz if freq_mhz is not None else cur["freq_mhz"]),
                "mode": target_mode,
                "nav": target_nav,
                "disp": target_disp,
                "ident": target_ident,
                "pad_bits": clean_pad,
                "sdi": sl.sdi if sdi is None else sdi,
                "ssm": target_ssm,
            }
            self._fill_slot_from_spec(bus, int(index), spec, payload, enabled=sl.enabled if enabled is None else enabled)
            if sdi is not None:
                self.tx[bus][int(index)].sdi = int(sdi)
            if target_ssm:
                self.tx[bus][int(index)].ssm = target_ssm
            if freq_mhz is not None:
                self.tx[bus][int(index)].eng_value = float(freq_mhz)
            self.tx[bus][int(index)].rate_ms = rate_ms
            self.tx[bus][int(index)].parity = parity.upper()
            self.dme_line = int(index)
            return self._snapshot_locked()

    def set_mmr_menu(self, menu: str) -> dict[str, Any]:
        menu = menu.lower()
        if menu not in {"ils", "dads", "fms"}:
            raise ValueError("mmr menu must be ils, dads, or fms")
        with self._lock:
            self.mmr_menu = menu
            self.active_profile = "mmr_755"
            self._disarm_specials_unlocked(keep="mmr")
            p = load_profile("mmr_755")
            self._scope_rx_to_profile_unlocked(p, "A")
            self._arm_mmr_background_locked()
            if menu == "ils":
                self.channel["A"].tx_enable = True
                for sl in self.tx["A"]:
                    sl.enabled = False
                    sl.raw = 0
                slot_i = 0
                for spec in p.labels:
                    if spec.direction not in ("tx", "both", ""):
                        continue
                    if slot_i >= SLOTS_PER_BUS:
                        break
                    self._fill_slot_from_spec("A", slot_i, spec, spec.eng_default if spec.eng_default is not None else 0)
                    slot_i += 1
            self.screen_stack = ["mode_select", "standard", "avionics_lru", "mmr_menu", "mmr_format"]
            return self._snapshot_locked()

    def set_mmr_inc_time(self, enabled: bool) -> dict[str, Any]:
        with self._lock:
            self.mmr_inc_time = bool(enabled)
            return self._snapshot_locked()

    def tick_mmr_time(self) -> None:
        """Increment labels 125/150 when INC TIME is on (called from snapshot/poll)."""
        with self._lock:
            if not self.mmr_inc_time:
                return
            spec = lookup_label("125")
            if spec is None:
                return
            for bus in BUSES:
                for sl in self.tx[bus]:
                    if sl.label_octal in {"125", "150"} and sl.enabled:
                        cur = int(sl.eng_value or 0)
                        hh = (cur // 10000) % 24
                        mm = (cur // 100) % 100
                        ss = cur % 100
                        ss += 1
                        if ss >= 60:
                            ss = 0
                            mm += 1
                        if mm >= 60:
                            mm = 0
                            hh = (hh + 1) % 24
                        nxt = hh * 10000 + mm * 100 + ss
                        lab = lookup_label(sl.label_octal) or spec
                        self._fill_slot_from_spec(bus, sl.index, lab, nxt)

    def dme_echo(self, bus: str | None = None) -> dict[str, Any]:
        """Compare last RX 035 with TX 035 on the given bus (default: active tx_ch)."""
        if not bus:
            bus = self.tx_ch or "A"
        bus = bus.upper()
        with self._lock:
            tx_slots = [s for s in self.tx[bus] if s.enabled and s.label_octal == "035"]
            rx035 = self.rx[bus].by_label.get("035")
            dist = self.rx[bus].by_label.get("202")
            ident1 = self.rx[bus].by_label.get("246")
            ident2 = self.rx[bus].by_label.get("247")
            now = time.time()
            rows = []
            for sl in tx_slots:
                echo = "NONE"
                rx_row = None
                if rx035 and (now - rx035.ts) <= STALE_S:
                    same_label = rx035.label_octal == sl.label_octal
                    tx_freq12 = (sl.data19 >> 7) & 0xFFF
                    rx_freq12 = (rx035.data19 >> 7) & 0xFFF
                    freq_match = (tx_freq12 == rx_freq12) if (tx_freq12 and rx_freq12) else ((rx035.data19 & ~0x7F) == (sl.data19 & ~0x7F))
                    if same_label and freq_match:
                        echo = "OK"
                    elif same_label:
                        echo = "ERR"
                    rx_row = rx035
                rows.append({
                    "slot": sl.index,
                    "echo": echo,
                    "tx_data": sl.data_text,
                    "tx_raw": f"0x{sl.raw:08X}" if sl.raw else "",
                    "rx_data": rx_row.data_text if rx_row else "",
                    "rx_ssm": rx_row.ssm if rx_row else "",
                })
            dist_stale = not dist or (now - dist.ts) > STALE_S
            dist_mem = getattr(dist, "mem", "")
            if not dist_mem and dist and dist.raw:
                dist_mem = "ON" if ((dist.raw >> 10) & 1) else "OFF"
            dist_bf = getattr(dist, "bf", "")
            if not dist_bf and dist and dist.raw:
                dist_bf = "F" if ((dist.raw >> 11) & 1) else "B"
            return {
                "rows": rows,
                "bnr_dist": None if dist_stale else dist.data_text,
                "mem": "" if (dist_stale or not dist) else dist_mem,
                "bf": "" if (dist_stale or not dist) else dist_bf,
                "ident": "" if not ident1 else f"{ident1.data_text}{(ident2.data_text if ident2 else '')}",
            }

    def dme_handshake_diagnostic(
        self,
        bus: str = "A",
        freq_mhz: float = 134.40,
        rate_ms: int = 100,
        arm_stimulus: bool = True,
        sim_scenario: str = "auto",
    ) -> dict[str, Any]:
        """Perform real-time DME Live Handshake & Echo Diagnostic per ARINC 709.

        Stimulus (TX to DME):
        - 12.5 kbps Low Speed, Odd Parity
        - Label 035 transmitted every 100 ms with:
          * Frequency: freq_mhz (default 134.40 MHz or 108.00 MHz)
          * Mode: DF1 (bits 13-11 = 001)
          * SDI: 00 (All Call)
          * DISP: 1 (bit 16, request BCD distance)
          * SSM: 00 (Normal Operation)
          * Parity: Odd Parity

        Detection & Validation (RX from DME):
        - Real-time listening with 2.5-second timeout window
        - Label 035 (Echo Frequency): 'ECHO OK', 'ECHO ERR', 'NONE'
        - Label 202 (BNR Distance): NM & SSM (NML, NCD, FT, FAIL)
        - Label 201 (BCD Distance): NM & SSM
        - Label 246/247 (Station Ident): character string

        Status:
        - 'DISCONNECTED / NO RX (Timeout 2.5s)'
        - 'LOOPBACK / TX ECHO ONLY'
        - 'DME CONNECTED & ACTIVE'
        """
        bus = channel_letter(bus)
        now = time.time()
        timeout_s = 2.5

        # 1. Set 12.5 kbps Low Speed for standard ARINC 709 DME and ensure channel is enabled
        self.set_bit_rate(high_speed=False, buses=[bus])
        with self._lock:
            self.tx_ch = bus
            self.rx_ch = bus
            self.channel[bus].tx_enable = True
            self.channel[bus].rx_enable = True
            self.rx[bus].enabled = True

        # 2. Arm stimulus if requested
        tx_word_raw = None
        if arm_stimulus:
            tx_word_raw = encode_dme_frequency_035(
                freq_mhz=freq_mhz,
                mode="DF1",
                sdi=0,
                disp=True,
                ident=False,
                nav="VOR",
                ssm=0,
                odd_parity=True,
            )
            self.configure_dme_slot(
                0,
                bus=bus,
                freq_mhz=freq_mhz,
                mode="DF1",
                nav="VOR",
                disp=True,
                ident=False,
                sdi=0,
                ssm="NML",
                pad="0100001",
                parity="ODD",
                rate_ms=rate_ms,
                enabled=True,
            )
            if not self._running:
                self.start()

        # 3. Simulation engine response injection (when running in simulation mode or requested)
        is_real = HAS_BTIDRIVER and not self._sim_override
        if not is_real:
            scenario = sim_scenario if sim_scenario != "auto" else "active"
            self.clear_rx_hits(bus)
            if scenario == "active":
                # Ingest RX 035 (matching freq, DF1)
                echo_raw = encode_dme_frequency_035(
                    freq_mhz=freq_mhz,
                    mode="DF1",
                    sdi=0,
                    disp=True,
                    ident=False,
                    nav="VOR",
                    ssm=0,
                    odd_parity=True,
                )
                self.ingest_rx_word(bus, echo_raw, ts=now)

                # Ingest RX 202 (BNR Distance: 50.00 NM matching ATC-1400A bench setting!)
                bnr_counts = int(round(50.0 / 0.0078125))  # 6400 -> 0x61900082
                w202 = 0x82 | ((bnr_counts & 0xFFFF) << 12) | (3 << 29)  # SSM=3 (NML)
                if bin(w202).count('1') % 2 == 0:
                    w202 |= (1 << 31)
                self.ingest_rx_word(bus, w202, ts=now)

                # Ingest RX 201 (BCD Distance: 50.00 NM)
                w201 = 0x81 | ((0x05000 & 0x7FFFF) << 10)  # 5000 hundredths of NM
                if bin(w201).count('1') % 2 == 0:
                    w201 |= (1 << 31)
                self.ingest_rx_word(bus, w201, ts=now)

                # Ingest RX 246 (Station Ident: "PRES")
                w246 = bti429.FldPutLabel(0, 0o246) if bti429 else 0o246
                if bti429:
                    w246 = bti429.FldPutData(w246, 0x14053)
                    w246 = bti429.BCDPutSSM(w246, 0)
                    w246 = bti429.FldPutParBit(w246)
                self.ingest_rx_word(bus, w246, ts=now)
            elif scenario == "loopback_only":
                echo_raw = encode_dme_frequency_035(
                    freq_mhz=freq_mhz,
                    mode="DF1",
                    sdi=0,
                    disp=True,
                    ident=False,
                    nav="VOR",
                    ssm=0,
                    odd_parity=True,
                )
                self.ingest_rx_word(bus, echo_raw, ts=now)
            elif scenario == "disconnected":
                self.clear_rx_hits(bus)

        # 4. Analyze RX bus state
        with self._lock:
            v = self.rx.get(bus)
            last_hit = v.last if v else None
            last_hit_ts = last_hit.ts if last_hit else None
            last_seen_s = round(now - last_hit_ts, 2) if last_hit_ts else None
            rx_hits = v.hits if v else 0

            is_fresh = last_seen_s is not None and last_seen_s <= timeout_s

            rx035 = v.by_label.get("035") if v else None
            rx202 = v.by_label.get("202") if v else None
            rx201 = v.by_label.get("201") if v else None
            rx246 = v.by_label.get("246") if v else None
            rx247 = v.by_label.get("247") if v else None

            sl0 = self.tx[bus][0] if self.tx.get(bus) else None
            if sl0 and sl0.enabled and sl0.raw:
                tx_word_raw = sl0.raw

        rx035_fresh = bool(rx035 and rx035.ts and (now - rx035.ts) <= timeout_s)
        rx202_fresh = bool(rx202 and rx202.ts and (now - rx202.ts) <= timeout_s)
        rx201_fresh = bool(rx201 and rx201.ts and (now - rx201.ts) <= timeout_s)
        rx246_fresh = bool(rx246 and rx246.ts and (now - rx246.ts) <= timeout_s)
        rx247_fresh = bool(rx247 and rx247.ts and (now - rx247.ts) <= timeout_s)

        # 5. Connection State Classification
        if not is_fresh or rx_hits == 0:
            status = "DISCONNECTED / NO RX (Timeout 2.5s)"
            status_code = "DISCONNECTED"
            status_level = "danger"
            detail = f"No ARINC 429 words received on RCVR_{bus} within {timeout_s}s timeout."
        elif rx035_fresh and not (rx202_fresh or rx201_fresh):
            status = "LOOPBACK / TX ECHO ONLY"
            status_code = "LOOPBACK"
            status_level = "warn"
            detail = "Label 035 (Tuning Echo) received, but NO distance telemetry (Label 202/201) from Collins DME-900."
        elif rx035_fresh and (rx202_fresh or rx201_fresh):
            status = "DME CONNECTED & ACTIVE"
            status_code = "CONNECTED_ACTIVE"
            status_level = "ok"
            detail = f"Collins DME-900 active on RCVR_{bus}. Distance & Echo verified."
        else:
            status = "DATA DETECTED / NO DME LOCK"
            status_code = "UNKNOWN_STREAM"
            status_level = "warn"
            detail = f"Received {rx_hits} words on RCVR_{bus}, but standard ARINC 709 burst is incomplete."

        # 6. Echo Frequency Validation (Label 035)
        echo_status = "NONE"
        rx_echo_freq = None
        rx_echo_mode = None
        rx_echo_age = None
        if rx035_fresh:
            rx_echo_age = round(now - rx035.ts, 2)
            d035 = decode_dme_frequency_035(rx035.raw)
            rx_echo_freq = d035.get("freq_mhz")
            rx_echo_mode = d035.get("mode")
            if rx_echo_freq is not None and abs(rx_echo_freq - freq_mhz) < 0.05:
                echo_status = "ECHO OK"
            else:
                echo_status = "ECHO ERR"

        # 7. BNR Distance (Label 202)
        bnr_dist_nm = None
        bnr_dist_text = "--.- NM"
        bnr_ssm = "NONE"
        bnr_age = None
        bnr_mem = "OFF"
        bnr_bf = "F"
        if rx202_fresh:
            bnr_age = round(now - rx202.ts, 2)
            d202 = decode_dme_distance_202(rx202.raw)
            bnr_dist_nm = d202["dist_nm"]
            bnr_dist_text = d202["dist_text"]
            bnr_ssm = d202["ssm_name"]
            bnr_mem = "ON" if ((rx202.raw >> 10) & 1) else "OFF"
            bnr_bf = "F" if ((rx202.raw >> 11) & 1) else "B"

        # 8. BCD Distance (Label 201)
        bcd_dist_nm = None
        bcd_dist_text = "----"
        bcd_ssm = "NONE"
        bcd_age = None
        if rx201_fresh:
            bcd_age = round(now - rx201.ts, 2)
            d201 = decode_dme_distance_201(rx201.raw)
            bcd_dist_nm = d201["dist_nm"]
            bcd_dist_text = d201["dist_text"]
            bcd_ssm = d201["ssm_name"]
        else:
            bcd_dist_text = "NO BCD (DISP OFF / NO DATA)"
            bcd_ssm = "NCD"

        # 9. Ground Station Ident (Label 246 / 247)
        ident_text = "----"
        ident_age = None
        if rx246_fresh:
            ident_age = round(now - rx246.ts, 2)
            id1 = rx246.data_text or ""
            id2 = rx247.data_text if (rx247_fresh and rx247.data_text) else ""
            ident_text = f"{id1}{id2}".strip() or "----"

        # 10. Raw 32-bit Word Protocol Inspector
        words_list: list[dict[str, Any]] = []
        has_parity_error = False

        if tx_word_raw is not None:
            dis_tx = dissect_arinc_word(tx_word_raw)
            dis_tx["name"] = f"TX 035 (DME FREQ {freq_mhz:.2f} MHz)"
            dis_tx["direction"] = "TX"
            words_list.append(dis_tx)

        if rx035_fresh:
            dis_rx035 = dissect_arinc_word(rx035.raw)
            dis_rx035["name"] = f"RX 035 (ECHO {rx_echo_freq or ''} MHz {rx_echo_mode or ''})"
            dis_rx035["direction"] = "RX"
            dis_rx035["age_s"] = rx_echo_age
            if not dis_rx035["parity_odd"]:
                has_parity_error = True
            words_list.append(dis_rx035)

        if rx202_fresh:
            dis_rx202 = dissect_arinc_word(rx202.raw)
            dis_rx202["name"] = f"RX 202 (BNR DIST {bnr_dist_text} [{bnr_ssm}])"
            dis_rx202["direction"] = "RX"
            dis_rx202["age_s"] = bnr_age
            if not dis_rx202["parity_odd"]:
                has_parity_error = True
            words_list.append(dis_rx202)

        if rx201_fresh:
            dis_rx201 = dissect_arinc_word(rx201.raw)
            dis_rx201["name"] = f"RX 201 (BCD DIST {bcd_dist_text} [{bcd_ssm}])"
            dis_rx201["direction"] = "RX"
            dis_rx201["age_s"] = bcd_age
            if not dis_rx201["parity_odd"]:
                has_parity_error = True
            words_list.append(dis_rx201)

        if rx246_fresh:
            dis_rx246 = dissect_arinc_word(rx246.raw)
            dis_rx246["name"] = f"RX 246 (IDENT {ident_text})"
            dis_rx246["direction"] = "RX"
            dis_rx246["age_s"] = ident_age
            if not dis_rx246["parity_odd"]:
                has_parity_error = True
            words_list.append(dis_rx246)

        # Troubleshooting checklist recommendations tailored to the bench photos
        checklist = [
            {
                "item": "Ballard OmniBus II PXI Front Panel Connector",
                "expected": "P1 BALLARD (Upper Connector / Core 0)",
                "action": (
                    "Berdasarkan part number modul 222-441-000, 8 channel ARINC 429 berada di Core 0 (Konektor Atas P1). "
                    "Konektor Bawah P2 adalah Core 1 (000/Kosong). Pastikan kabel fisik ke Interface Panel CH 0-7 / J1 "
                    "dicolokkan ke KONEKTOR ATAS (P1 BALLARD)!"
                ),
            },
            {
                "item": "DFIU T1203 Rear OPERATION Switch",
                "expected": "MANUAL",
                "action": "Ensure toggle switch at rear panel of Kustom Electronics T1203 is set to MANUAL (not REMOTE).",
            },
            {
                "item": "ARINC 429 Wiring (Panel TX to DFIU)",
                "expected": f"CH {bus} TX -> DME A-FREQ FUNCT SELECT-A",
                "action": "Verify POS (HI), NEG (LO), and GND lines firmly seated in DFIU ARINC 429 INPUTS.",
            },
            {
                "item": "ARINC 429 Wiring (DFIU to Panel RX)",
                "expected": f"DME A-DISTANCE DATA-1 -> CH {bus} RX",
                "action": "Verify POS (HI), NEG (LO), and GND lines firmly seated in DFIU ARINC 429 OUTPUTS.",
            },
            {
                "item": "Breakout Box 56-1189-22 Controls",
                "expected": "SUPPRESSOR CLOSED, Thumbwheels 001",
                "action": "Verify SUPPRESSOR toggle is CLOSED and ATE 100-pin locking connector is firmly engaged.",
            },
            {
                "item": "IFR ATC-1400A RF Simulator",
                "expected": "0001 TAC X (134.40 MHz), RF Level -86 dBm, Reply Eff > 50%",
                "action": "Set ATC-1400A to Channel 1X / 134.40 MHz, RANGE 50.00 NM, and verify RF coax connected to DME antenna port.",
            },
            {
                "item": "28VDC Power Supply",
                "expected": "28.0 VDC (+ and - terminals energized)",
                "action": "Ensure DFIU T1203 and Collins DME-900 28VDC power supply is switched ON.",
            },
        ]

        wiring_warning = None
        if has_parity_error:
            wiring_warning = (
                "⚠️ PARITY ERROR DETECTED: ARINC 429 POS (HI) and NEG (LO) wires may be inverted "
                "on the terminal block, or baud rate is unsynchronized (12.5 kbps vs 100 kbps)."
            )

        return {
            "status": status,
            "status_code": status_code,
            "status_level": status_level,
            "detail": detail,
            "bus": bus,
            "freq_mhz": freq_mhz,
            "rate_ms": rate_ms,
            "timeout_s": timeout_s,
            "last_seen_s": last_seen_s,
            "rx_hits": rx_hits,
            "is_real_hardware": is_real,
            "simulation": not is_real,
            "echo": {
                "status": echo_status,
                "freq_mhz": rx_echo_freq,
                "mode": rx_echo_mode,
                "last_seen_s": rx_echo_age,
            },
            "bnr_distance": {
                "dist_nm": bnr_dist_nm,
                "dist_text": bnr_dist_text,
                "ssm": bnr_ssm,
                "last_seen_s": bnr_age,
                "mem": bnr_mem,
                "bf": bnr_bf,
            },
            "bcd_distance": {
                "dist_nm": bcd_dist_nm,
                "dist_text": bcd_dist_text,
                "ssm": bcd_ssm,
                "last_seen_s": bcd_age,
            },
            "ident": {
                "ident_text": ident_text,
                "last_seen_s": ident_age,
            },
            "words": words_list,
            "has_parity_error": has_parity_error,
            "wiring_warning": wiring_warning,
            "checklist": checklist,
            "hardware": self.hardware_info,
            "channel_activity": self.get_channel_activity(),
            "timestamp": time.strftime("%H:%M:%S", time.localtime(now)),
        }

    def set_simulation_override(self, enabled: bool) -> dict[str, Any]:
        with self._lock:
            self._sim_override = bool(enabled)
            return self._snapshot_locked()

    def check_lru_connected(self, lru_code: str = "709", bus: str = "A") -> dict[str, Any]:
        bus = channel_letter(bus)
        now = time.time()
        with self._lock:
            self.active_lru_code = lru_code
            # Explicit simulation mode activated by user
            if self._sim_override:
                return {
                    "connected": True,
                    "mode": "SIMULATION",
                    "simulation": True,
                    "detail": "Simulation Mode active (Software Mock Engine)",
                    "last_seen_s": 0.0,
                    "rx_hits": 999,
                    "bus": bus,
                    "lru": lru_code,
                }

            # If hardware driver is not available on host
            if not HAS_BTIDRIVER:
                return {
                    "connected": False,
                    "mode": "REAL",
                    "simulation": False,
                    "detail": "Hardware driver (Ballard BTIDriver) not available on host. Physical device cannot be detected.",
                    "last_seen_s": None,
                    "rx_hits": 0,
                    "bus": bus,
                    "lru": lru_code,
                }

            # In Real Hardware mode, ARINC bus must be actively running
            if not self._running:
                return {
                    "connected": False,
                    "mode": "REAL",
                    "simulation": False,
                    "detail": "ARINC 429 Bus is stopped. Start bus to detect physical device.",
                    "last_seen_s": None,
                    "rx_hits": 0,
                    "bus": bus,
                    "lru": lru_code,
                }

            # Check receiver on target bus
            v = self.rx.get(bus)
            if not v or not v.enabled or not v.last or not v.last.ts:
                return {
                    "connected": False,
                    "mode": "REAL",
                    "simulation": False,
                    "detail": f"No signals received on RCVR_{bus}. Check DME cable and power.",
                    "last_seen_s": None,
                    "rx_hits": v.hits if v else 0,
                    "bus": bus,
                    "lru": lru_code,
                }

            age = now - v.last.ts
            if age > STALE_S:
                return {
                    "connected": False,
                    "mode": "REAL",
                    "simulation": False,
                    "detail": f"Signal lost on RCVR_{bus} ({age:.1f}s ago). Device disconnected.",
                    "last_seen_s": round(age, 2),
                    "rx_hits": v.hits,
                    "bus": bus,
                    "lru": lru_code,
                }

            dme_labels = {"035", "202", "246", "247", "270", "356", "227"}
            has_dme = any(
                (now - h.ts) <= STALE_S
                for lab, h in v.by_label.items()
                if lab in dme_labels and h.ts
            )

            return {
                "connected": True,
                "mode": "REAL",
                "simulation": False,
                "detail": f"Physical DME active on RCVR_{bus} ({v.hits} words, last {age:.2f}s ago)",
                "last_seen_s": round(age, 2),
                "rx_hits": v.hits,
                "bus": bus,
                "lru": lru_code,
                "specific_dme_labels": has_dme,
            }

    def get_vhf_align_state(self) -> dict[str, Any]:
        with self._lock:
            rx_c = self.rx["C"]
            return self.vhf900.get_state(rx_bus_c=rx_c)

    def config_vhf_align(self, **kwargs: Any) -> dict[str, Any]:
        with self._lock:
            self.vhf900.update_config(**kwargs)
            sdi_int = int(self.vhf900.sdi, 2) if (isinstance(self.vhf900.sdi, str) and self.vhf900.sdi.isdigit()) else (int(self.vhf900.sdi) if self.vhf900.sdi is not None else 0)
            ssm_str = str(self.vhf900.ssm).zfill(2)[-2:]
            for b in BUSES:
                for sl in self.tx[b]:
                    if sl and sl.enabled:
                        lab = sl.label_octal or "030"
                        if b == "C" or lab in {"030", "047", "130", "131"}:
                            spec = LabelSpec(
                                label_octal=lab,
                                funct=sl.funct or "VHF_FREQ",
                                direction="tx",
                                sdi=sdi_int,
                                ssm=ssm_str,
                                parity=sl.parity or "ODD",
                                rate_ms=sl.rate_ms or 10,
                                encoding=sl.encoding or "bcd",
                                units=sl.units or "MHZ",
                                bcd_scale=1000.0,
                                bcd_digits=5,
                                eng_default=self.vhf900.freq_mhz,
                            )
                            self._paint_slot(sl, spec, self.vhf900.freq_mhz, "vhf_align")
            return self.vhf900.get_state(rx_bus_c=self.rx["C"])

    def start_vhf_checksum(self) -> dict[str, Any]:
        with self._lock:
            self.vhf900.start_checksum()
            return self.vhf900.get_state(rx_bus_c=self.rx["C"])

    def write_vhf_var(self, action: str) -> dict[str, Any]:
        with self._lock:
            res = self.vhf900.write_var(action)
            res["state"] = self.vhf900.get_state(rx_bus_c=self.rx["C"])
            return res

    def step_vhf_freq(self, delta: int) -> dict[str, Any]:
        with self._lock:
            self.vhf900.step_freq(delta)
            sl = self.tx["C"][0]
            if sl and sl.enabled:
                sdi_int = int(self.vhf900.sdi, 2) if self.vhf900.sdi.isdigit() else 0
                spec = LabelSpec(
                    label_octal="030",
                    funct="VHF_FREQ",
                    direction="tx",
                    sdi=sdi_int,
                    ssm=self.vhf900.ssm,
                    parity="ODD",
                    rate_ms=10,
                    encoding="bcd",
                    units="MHZ",
                    bcd_scale=1000.0,
                    bcd_digits=5,
                    eng_default=self.vhf900.freq_mhz,
                )
                self._paint_slot(sl, spec, self.vhf900.freq_mhz, "vhf_align")
            return self.vhf900.get_state(rx_bus_c=self.rx["C"])

    def step_vhf_val(self, delta: int) -> dict[str, Any]:
        with self._lock:
            self.vhf900.step_var_val(delta)
            return self.vhf900.get_state(rx_bus_c=self.rx["C"])

    def configure_hf_dual_word(
        self,
        bus: str = "A",
        freq_mhz: float = 10.0,
        sb: str = "LSB",
        mod: str = "AM",
        cw: bool = False,
        ssm: str = "NML",
        rate_ms: int = 75,
    ) -> dict[str, Any]:
        bus = channel_letter(bus)
        with self._lock:
            sl1 = self.tx[bus][0]
            sl2 = self.tx[bus][1]

            spec1 = LabelSpec(
                label_octal="037",
                funct="HF_FREQ1",
                direction="tx",
                sdi=0,
                ssm=ssm,
                parity="ODD",
                rate_ms=rate_ms,
                encoding="hf_pair",
                units="MHZ",
                word_index=1,
                eng_default=freq_mhz,
            )
            extra1 = {"value": freq_mhz, "freq_mhz": freq_mhz, "sb": sb, "mod": mod, "word_index": 1, "ssm": ssm}
            self._paint_slot(sl1, spec1, extra1, self.active_profile or "hf_719")

            fine_freq = round((freq_mhz * 10000.0) % 10.0) / 10000.0
            spec2 = LabelSpec(
                label_octal="037",
                funct="HF_FREQ2",
                direction="tx",
                sdi=1,
                ssm=ssm,
                parity="ODD",
                rate_ms=rate_ms,
                encoding="hf_pair",
                units="MHZ",
                word_index=2,
                eng_default=fine_freq,
            )
            extra2 = {"value": freq_mhz, "freq_mhz": freq_mhz, "cw": 1 if cw else 0, "word_index": 2, "ssm": ssm}
            self._paint_slot(sl2, spec2, extra2, self.active_profile or "hf_719")

            return self._snapshot_locked()

    def _snapshot_locked(self) -> dict[str, Any]:
        return self.snapshot()

    def _rx_label_row(
        self,
        *,
        lab: str,
        hit: RxHit,
        view: RxView,
        now: float,
        spec: LabelSpec | None = None,
        dm: str = "ENG",
    ) -> dict[str, Any]:
        data = hit.data_text
        funct = hit.funct
        units = hit.units
        eng_value = hit.eng_value
        if spec is not None and hit.raw:
            try:
                eng = decode_label(spec, hit.raw)
                funct = spec.funct or funct
                units = spec.units or units
                eng_text = eng.get("data_text") or data
                data = format_display(hit.data19, eng_text, dm)
                ev = eng.get("eng_value")
                if isinstance(ev, (int, float)):
                    eng_value = float(ev)
            except Exception:
                pass
        age = now - hit.ts if hit.ts else None
        has_word = bool(hit.raw)
        if not self._running:
            stale = not has_word
        else:
            stale = (not has_word) or age is None or age > STALE_S
        trapped = any(t.label_octal == lab for t in view.traps)
        waiting = trapped and not any(t.label_octal == lab and t.triggered for t in view.traps)
        lib = spec or lookup_label(lab)
        lib_rate = int(lib.rate_ms) if lib and lib.rate_ms else 0
        measured = int(hit.period_ms or 0)
        rate_ms = measured or lib_rate
        return {
            "label": lab,
            "funct": funct,
            "data": data,
            "units": units,
            "eng_value": eng_value,
            "sdi": f"{hit.sdi:02d}",
            "ssm": hit.ssm,
            "pads": hit.pads or "-",
            "par": hit.parity,
            "raw": f"0x{hit.raw:08X}" if hit.raw else "",
            "mem": getattr(hit, "mem", "") or ("ON" if hit and hit.raw and ((hit.raw >> 10) & 1) else ("OFF" if hit and hit.raw else "")),
            "bf": getattr(hit, "bf", "") or ("F" if hit and hit.raw and ((hit.raw >> 11) & 1) else ("B" if hit and hit.raw else "")),
            "hits": view.label_hits.get(lab, 0),
            "age_ms": int(age * 1000) if age is not None else None,
            "stale": stale,
            "rate_ms": rate_ms,
            "trapped": trapped,
            "waiting": waiting,
        }

    # --- CFDS protocol control ------------------------------------------

    def get_cfds_state(self) -> dict[str, Any]:
        with self._lock:
            self.cfds.simulation_mode = self.simulation_mode or bool(self._sim_override)
            return self.cfds.get_state(rx_bus=self.rx_ch or "A")

    def select_cfds_lru(self, code: str, name: str | None = None, short: str | None = None) -> dict[str, Any]:
        with self._lock:
            self.cfds.simulation_mode = self.simulation_mode or bool(self._sim_override)
            res = self.cfds.select_lru(code, name, short)
            if self.cfds.selected_lru.get("code") == "050":
                self.channel["C"].high_speed = True
                self.channel["C"].bit_rate_kbps = 100.0
                self.channel["C"].tx_enable = True
                self.tx_ch = "C"
            return res

    def set_cfds_slide(self, slide: str) -> dict[str, Any]:
        with self._lock:
            self.cfds.simulation_mode = self.simulation_mode or bool(self._sim_override)
            return self.cfds.set_slide(slide)

    def update_cfds_tx_params(self, params: dict[str, Any], config: dict[str, bool] | None = None) -> dict[str, Any]:
        with self._lock:
            return self.cfds.update_tx_params(params, config)

    def set_cfds_flight_phase(self, phase: str) -> dict[str, Any]:
        with self._lock:
            self.cfds.simulation_mode = self.simulation_mode or bool(self._sim_override)
            return self.cfds.set_flight_phase(phase)

    def send_cfds_key(self, key: str, lru_code: str | None = None) -> dict[str, Any]:
        with self._lock:
            self.cfds.simulation_mode = self.simulation_mode or bool(self._sim_override)
            return self.cfds.send_key_command(key, lru_code)

    def set_cfds_channels(self, **kwargs: Any) -> dict[str, Any]:
        with self._lock:
            for k, v in kwargs.items():
                if k in self.cfds.channel_config and v is not None:
                    self.cfds.channel_config[k] = v
            return self.cfds.get_state()

    def clear_cfds_rx(self, mode: str | None = None) -> dict[str, Any]:
        with self._lock:
            return self.cfds.clear_rx_data(mode)

    def simulate_cfds_scenario(self, mode: str, lru_code: str | None = None) -> dict[str, Any]:
        with self._lock:
            self.cfds.simulation_mode = self.simulation_mode or bool(self._sim_override)
            return self.cfds.simulate_test_scenario(mode, lru_code)

    # --- snapshot + run control -----------------------------------------

    def snapshot(self) -> dict[str, Any]:
        now = time.time()
        try:
            self.tick_mmr_time()
        except Exception:
            pass
        with self._lock:
            channels = self._channels_meta or {}
            wiring = self._wiring or {}
            bus_out = {}
            for b in BUSES:
                cfg = self.channel[b]
                w = wiring.get(b) or {}
                hw_kbps = 100.0 if cfg.high_speed else 12.5
                bus_out[b] = {
                    "high_speed": cfg.high_speed,
                    "bit_rate_kbps": cfg.bit_rate_kbps,
                    "bit_rate_hw_kbps": hw_kbps,
                    "selftest": cfg.selftest,
                    "tx_enable": cfg.tx_enable,
                    "rx_enable": cfg.rx_enable,
                    "odd_parity": cfg.odd_parity,
                    "display_mode": cfg.display_mode,
                    "phys_tx": channels.get("phys_tx", {}).get(b, w.get("phys_tx")),
                    "phys_rx": channels.get("phys_rx", {}).get(b, w.get("phys_rx")),
                    "log_tx": channels.get("log_tx", {}).get(b, w.get("log_tx")),
                    "log_rx": channels.get("log_rx", {}).get(b, w.get("log_rx")),
                    "tx_db37_hi": w.get("tx_db37_hi"),
                    "tx_db37_lo": w.get("tx_db37_lo"),
                    "rx_db37_hi": w.get("rx_db37_hi"),
                    "rx_db37_lo": w.get("rx_db37_lo"),
                }
            tx_out = {}
            for b in BUSES:
                dm = self.channel[b].display_mode
                tx_out[b] = []
                for s in self.tx[b]:
                    data_show = s.data_text
                    if dm == "BIN":
                        data_show = format(s.data19, "019b")
                    elif dm == "HEX":
                        data_show = f"0x{s.data19:05X}" if s.raw else s.data_text
                    tx_out[b].append({
                        "index": s.index,
                        "mode": s.mode,
                        "enabled": s.enabled,
                        "funct": s.funct,
                        "label": s.label_octal,
                        "data": data_show,
                        "data_eng": s.data_text,
                        "data19": f"0x{s.data19:05X}",
                        "pad3": f"{s.pad3:03b}",
                        "pads": (
                            dme_unpack(s.data19)["pads"] if s.encoding == "dme_freq" and s.raw
                            else format_pads(s.data19, (lib.pads if (lib := lookup_label(s.label_octal)) else "-"))
                        ),
                        "data16": f"0x{s.data16:04X}",
                        "sdi": f"{s.sdi:02d}",
                        "ssm": s.ssm,
                        "par": s.parity,
                        "rate_ms": s.rate_ms,
                        "raw": f"0x{s.raw:08X}" if s.raw else "",
                        "freq_khz": s.freq_khz,
                        "profile": s.profile_id,
                        "eng_value": s.eng_value,
                        "encoding": s.encoding,
                        "units": s.units,
                        "eng_step": s.eng_step,
                        "word_index": s.word_index,
                    })
            rx_out = {}
            for b, v in self.rx.items():
                last = v.last
                dm = self.channel[b].display_mode
                trap_map = {(t.label_octal, t.sdi): t for t in v.traps}
                labels_out = []
                seen = set(v.by_label.keys())
                auto = not self.rx_profile.get(b)
                trap_labs = {t.label_octal for t in v.traps}
                for lab, hit in sorted(v.by_label.items()):
                    if v.filter_labels and lab not in v.filter_labels:
                        continue
                    if auto and not hit.raw:
                        continue
                    # Auto = live traffic only (T1200). Do not keep every label ever seen.
                    if auto and self._running and lab not in trap_labs:
                        age = now - hit.ts if hit.ts else None
                        if age is None or age > STALE_S:
                            continue
                    labels_out.append(self._rx_label_row(
                        lab=lab, hit=hit, view=v, now=now,
                        spec=lookup_label(lab) if auto else None, dm=dm,
                    ))
                for t in v.traps:
                    if t.label_octal not in seen:
                        labels_out.append({
                            "label": t.label_octal,
                            "funct": "",
                            "data": "WAITING FOR TRIGGER" if not t.triggered else "",
                            "units": "",
                            "eng_value": None,
                            "sdi": "" if t.sdi is None else f"{t.sdi:02d}",
                            "ssm": "",
                            "pads": "",
                            "par": "",
                            "raw": "",
                            "hits": 0,
                            "age_ms": None,
                            "stale": True,
                            "rate_ms": 0,
                            "trapped": True,
                            "waiting": not t.triggered,
                        })
                rx_out[b] = {
                    "enabled": v.enabled,
                    "filter_labels": list(v.filter_labels),
                    "filter_sdi": v.filter_sdi,
                    "funct": last.funct if last else "",
                    "label": last.label_octal if last else "",
                    "data": last.data_text if last else "",
                    "units": last.units if last else "",
                    "eng_value": last.eng_value if last else None,
                    "data19": f"0x{last.data19:05X}" if last and last.raw else "",
                    "pad3": f"{last.pad3:03b}" if last and last.raw else "",
                    "data16": f"0x{last.data16:04X}" if last and last.raw else "",
                    "sdi": f"{last.sdi:02d}" if last else "",
                    "ssm": last.ssm if last else "",
                    "par": last.parity if last else "",
                    "raw": f"0x{last.raw:08X}" if last and last.raw else "",
                    "hits": v.hits,
                    "age_s": round(now - last.ts, 2) if last and last.ts else None,
                    "page": v.page,
                    "auto": auto,
                    "labels": labels_out,
                    "groups": [],
                    "traps": [
                        {"label": t.label_octal, "sdi": t.sdi, "triggered": t.triggered}
                        for t in v.traps
                    ],
                    "ring": [
                        {
                            "label": h.label_octal,
                            "data": h.data_text,
                            "units": h.units,
                            "raw": f"0x{h.raw:08X}",
                            "ts": round(h.ts, 2),
                            "mem": getattr(h, "mem", ""),
                            "bf": getattr(h, "bf", ""),
                        }
                        for h in v.ring[-16:]
                    ],
                }
            active_buses = [b for b in BUSES if self.channel[b].tx_enable or self.channel[b].rx_enable]
            if not active_buses:
                active_buses = [self.tx_ch or "A"]
            active_highs = [self.channel[b].high_speed for b in active_buses]
            has_high = any(active_highs)
            has_low = any(not h for h in active_highs)
            primary_bus = (self.tx_ch or "A").upper()
            primary_cfg = self.channel.get(primary_bus, self.channel["A"])
            if has_high and has_low:
                bit_rate_display = "12.5 / 100 kbps"
                bit_rate_kbps = 100.0
                high_speed = True
            elif has_high:
                bit_rate_kbps = primary_cfg.bit_rate_kbps if primary_cfg.high_speed else 100.0
                high_speed = True
                bit_rate_display = f"{bit_rate_kbps:.2f} kbps" if bit_rate_kbps not in (100.0, 100) else "100 kbps"
            else:
                bit_rate_kbps = primary_cfg.bit_rate_kbps
                high_speed = False
                bit_rate_display = f"{bit_rate_kbps:.1f} kbps" if (bit_rate_kbps * 10) % 10 != 0 else f"{int(bit_rate_kbps)} kbps"
            dme = None
            if self.dme_mode:
                try:
                    dme = self.dme_echo(self.tx_ch or "A")
                    dme["mode"] = self.dme_mode
                    dme["line"] = self.dme_line
                except Exception:
                    dme = {"mode": self.dme_mode, "line": self.dme_line, "rows": []}
            prof = None
            if self.active_profile:
                try:
                    prof = self.profile_detail(self.active_profile)
                except Exception:
                    prof = {"id": self.active_profile, "labels": []}
            return {
                "running": self._running,
                "error": self._error,
                "app_mode": self.app_mode,
                "screen_stack": list(self.screen_stack),
                "active_profile": self.active_profile,
                "tx_ch": self.tx_ch,
                "rx_ch": self.rx_ch,
                "tx_profile": {b: self.tx_profile.get(b) for b in BUSES},
                "rx_profile": {b: (self.rx_profile.get(b) or RX_AUTO) for b in BUSES},
                "bit_rate_kbps": bit_rate_kbps,
                "bit_rate_display": bit_rate_display,
                "high_speed": high_speed,
                "time_constant_s": self.time_constant_s,
                "ln1": dict(self.ln1),
                "ln2": dict(self.ln2),
                "ln_edit": self.ln_edit,
                "dme": dme,
                "mmr_menu": self.mmr_menu,
                "mmr_inc_time": self.mmr_inc_time,
                "rates": {"low": list(LOW_RATES), "high": list(HIGH_RATES)},
                "catalog": [dict(x) for x in CATALOG],
                "profile": prof,
                "bus": bus_out,
                "tx": tx_out,
                "rx": rx_out,
                "hardware": self.hardware_info,
                "channel_activity": self.get_channel_activity(),
                "lru_connection": self.check_lru_connected(self.active_lru_code or "709", bus="A"),
                "simulation_override": self._sim_override,
                "vhf_align": self.vhf900.get_state(rx_bus_c=self.rx["C"], lightweight=(self.active_profile != "vhf_align")),
                "cfds": self.cfds.get_state(rx_bus=self.rx_ch or "A"),
            }

    def start(self) -> None:
        if not self.simulation_mode:
            require_btidriver()
        with self._lock:
            if self._running:
                return
            self._stop.clear()
            self._error = None
            target = self._sim_worker if self.simulation_mode else self._worker
            self._thread = threading.Thread(
                target=target, name="arinc-session", daemon=True
            )
            self._running = True
            self._thread.start()

    def _sim_worker(self) -> None:
        with self._lock:
            self._channels_meta = {
                "phys_tx": {b: idx for idx, b in enumerate(BUSES)},
                "phys_rx": {b: idx for idx, b in enumerate(BUSES)},
                "log_tx": {b: idx for idx, b in enumerate(BUSES)},
                "log_rx": {b: idx for idx, b in enumerate(BUSES)},
            }
        last_tx_time: dict[tuple[str, int], float] = {}
        while not self._stop.is_set():
            now = time.monotonic()
            with self._lock:
                bus_cfgs = {b: self.channel[b] for b in BUSES}
                tx_slots = {b: list(self.tx[b]) for b in BUSES}

            for bus in BUSES:
                cfg = bus_cfgs[bus]
                if not cfg.tx_enable:
                    continue
                for slot in tx_slots[bus]:
                    if not (slot.enabled and slot.raw):
                        continue
                    rate_s = max(0.01, float(slot.rate_ms) / 1000.0)
                    key = (bus, slot.index)
                    prev = last_tx_time.get(key, 0.0)
                    if now - prev >= rate_s:
                        last_tx_time[key] = now
                        if cfg.rx_enable and (self._sim_override or cfg.selftest):
                            try:
                                self.ingest_rx_word(bus, slot.raw)
                            except Exception:
                                pass
            time.sleep(0.02)

    def stop(self) -> None:
        self._stop.set()
        t = self._thread
        if t and t.is_alive():
            t.join(timeout=3.0)
        with self._lock:
            self._running = False
            self._thread = None

    def _config_fingerprint(self) -> tuple:
        with self._lock:
            bus_fp = tuple(
                (b, c.high_speed, c.bit_rate_kbps, c.selftest, c.tx_enable, c.rx_enable, c.odd_parity, c.display_mode)
                for b, c in sorted(self.channel.items())
            )
            tx_struct_fp = tuple(
                (b, tuple(
                    (s.index, s.enabled, s.rate_ms, s.mode) for s in self.tx[b]
                ))
                for b in sorted(self.tx)
            )
            tx_raw_fp = tuple(
                (b, tuple(
                    (s.index, s.raw) for s in self.tx[b]
                ))
                for b in sorted(self.tx)
            )
            rx_fp = tuple(
                (b, v.enabled, tuple(v.filter_labels), v.filter_sdi)
                for b, v in sorted(self.rx.items())
            )
            return (bus_fp, tx_struct_fp, rx_fp), tx_raw_fp

    def _worker(self) -> None:
        from btidriver import bticard, bti429, DriverError

        try:
            channels = load_t1200_channels(self.netlist_path)
            h_card = bticard.CardOpen(self.cardnum)
            active_core = self.corenum
            if self.hardware_info and not self.simulation_mode:
                core_data = next((c for c in self.hardware_info.get("cores", []) if c["core"] == active_core), None)
                if core_data and core_data.get("count", 0) == 0:
                    fallback = self.hardware_info.get("active_core", 0)
                    logger.warning(
                        f"Requested Core {active_core} has 0 ARINC 429 channels! Falling back to Core {fallback} ({self.hardware_info.get('active_port')})."
                    )
                    active_core = fallback
            h_core = bticard.CoreOpen(active_core, h_card)
            logger.info(
                f"Ballard ARINC 429 Worker started on Card {self.cardnum}, Core {active_core} "
                f"({self.hardware_info.get('active_port', 'P1 Upper') if self.hardware_info else 'P1 Upper'})"
            )
            with self._lock:
                self._h_card = h_card
                self._h_core = h_core

            def apply_config() -> dict[str, Any]:
                bticard.CardReset(h_core)
                meta: dict[str, Any] = {
                    "tx_addrs": {}, "tx_slot_addrs": {b: {} for b in BUSES}, "rx_chans": {}, "tx_chans": {},
                    "phys_tx": {}, "phys_rx": {}, "log_tx": {}, "log_rx": {},
                }
                with self._lock:
                    bus_cfgs = {b: self.channel[b] for b in BUSES}
                    tx_slots = {b: list(self.tx[b]) for b in BUSES}
                    rx_views = {b: self.rx[b] for b in BUSES}

                for letter in BUSES:
                    tx_spec = channels[f"XMIT_{letter}"]
                    rx_spec = channels[f"RCVR_{letter}"]
                    phys_tx = int(tx_spec["omnibus_phys"])
                    phys_rx = int(rx_spec["omnibus_phys"])
                    log_tx = resolve_tx_channel(h_core, phys_tx)
                    log_rx = resolve_rx_channel(h_core, phys_rx)
                    meta["tx_chans"][letter] = log_tx
                    meta["rx_chans"][letter] = log_rx
                    meta["phys_tx"][letter] = phys_tx
                    meta["phys_rx"][letter] = phys_rx
                    meta["log_tx"][letter] = log_tx
                    meta["log_rx"][letter] = log_rx

                    cfg = bus_cfgs[letter]
                    speed = (
                        bti429.CHCFG429_HIGHSPEED if cfg.high_speed
                        else bti429.CHCFG429_LOWSPEED
                    )
                    wrap = bti429.CHCFG429_SELFTEST if cfg.selftest else 0
                    # PARDATA: send bit 32 as encoded (per-slot ODD/EVEN). PARODD overwrote EVEN.
                    # GAPBIT: SchedGap is bit times so 150 ms stays 150, not SchedBuild's ~1.5×.

                    # Always configure RX channel with AUTOSPEED + SEQALL for non-intrusive traffic monitoring
                    bti429.ChConfig(
                        bti429.CHCFG429_AUTOSPEED | bti429.CHCFG429_SEQALL | wrap,
                        log_rx, h_core,
                    )

                    if cfg.tx_enable and any(s.enabled and s.raw for s in tx_slots[letter]):
                        bti429.ChConfig(
                            speed | wrap | bti429.CHCFG429_PARDATA
                            | bti429.CHCFG429_GAPBIT | bti429.CHCFG429_SEQALL,
                            log_tx, h_core,
                        )
                    else:
                        bti429.ChConfig(
                            speed | bti429.CHCFG429_INACTIVE | bti429.CHCFG429_SEQALL,
                            log_tx, h_core,
                        )

                    rv = rx_views[letter]
                    if cfg.rx_enable:
                        if rv.filter_labels:
                            bti429.FilterDefault(0, log_rx, h_core)
                            sdi_mask = (
                                bti429.SDIALL if rv.filter_sdi is None
                                else (1 << (int(rv.filter_sdi) & 0x3))
                            )
                            for lab_s in rv.filter_labels:
                                bti429.FilterSet(
                                    bti429.MSGCRT429_DEFAULT,
                                    parse_label(lab_s), sdi_mask, log_rx, h_core,
                                )
                        else:
                            bti429.FilterDefault(
                                bti429.MSGCRT429_DEFAULT, log_rx, h_core
                            )

                for letter in BUSES:
                    cfg = bus_cfgs[letter]
                    if not cfg.tx_enable:
                        continue
                    addrs_rates: list[tuple[int, int]] = []
                    for sl in tx_slots[letter]:
                        if not (sl.enabled and sl.raw):
                            continue
                        addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, h_core)
                        bti429.MsgDataWr(sl.raw, addr, h_core)
                        addrs_rates.append((addr, max(10, int(sl.rate_ms))))
                        meta["tx_slot_addrs"][letter][sl.index] = addr
                    if addrs_rates:
                        kbps = float(cfg.bit_rate_kbps) or (100.0 if cfg.high_speed else 12.5)
                        _build_tx_bit_schedule(bti429, addrs_rates, kbps, meta["tx_chans"][letter], h_core)
                        meta["tx_addrs"][letter] = [a for a, _ in addrs_rates]

                bticard.SeqConfig(bticard.SEQCFG_DEFAULT, h_core)
                bticard.CardStart(h_core)
                with self._lock:
                    self._channels_meta = {
                        "phys_tx": meta["phys_tx"], "phys_rx": meta["phys_rx"],
                        "log_tx": meta["log_tx"], "log_rx": meta["log_rx"],
                    }
                return meta

            meta = apply_config()
            buf = bticard.uint16_buffer(8192)
            rx_by_chan = {v: k for k, v in meta["rx_chans"].items()}
            last_struct_cfg, last_raw_cfg = self._config_fingerprint()

            def drain_seq() -> None:
                try:
                    n, _ = bticard.SeqBlkRd(buf, 8192, h_core)
                except DriverError:
                    n = 0
                if not n:
                    return
                sf = bticard.SeqFindInit(buf, n)
                while True:
                    rec = bticard.SeqFindNext429(sf)
                    if not rec:
                        break
                    ch = (int(rec.activity) & bti429.MSGACT429_CHMASK) >> bti429.MSGACT429_CHSHIFT
                    data = int(rec.data) & 0xFFFFFFFF
                    self._record_channel_traffic(ch, data, is_tx=(ch >= 16))
                    if ch in rx_by_chan:
                        bus = rx_by_chan[ch]
                        if self.channel[bus].rx_enable:
                            try:
                                self.ingest_rx_word(bus, data)
                            except Exception:
                                continue

            while not self._stop.is_set():
                struct_fp, raw_fp = self._config_fingerprint()
                force = getattr(self, "_force_reconfig", False)
                if struct_fp != last_struct_cfg or force:
                    self._force_reconfig = False
                    try:
                        bticard.CardStop(h_core)
                    except Exception:
                        pass
                    meta = apply_config()
                    rx_by_chan = {v: k for k, v in meta["rx_chans"].items()}
                    last_struct_cfg = struct_fp
                    last_raw_cfg = raw_fp
                elif raw_fp != last_raw_cfg:
                    with self._lock:
                        current_tx = {b: list(self.tx[b]) for b in BUSES}
                    needs_rebuild = False
                    for letter, slots in current_tx.items():
                        slot_addrs = meta.get("tx_slot_addrs", {}).get(letter, {})
                        for sl in slots:
                            if sl.enabled and sl.raw:
                                if sl.index in slot_addrs:
                                    try:
                                        bti429.MsgDataWr(sl.raw, slot_addrs[sl.index], h_core)
                                    except Exception as e:
                                        logger.warning(f"MsgDataWr error on bus {letter}[{sl.index}]: {e}")
                                else:
                                    needs_rebuild = True
                                    break
                        if needs_rebuild:
                            break
                    if needs_rebuild:
                        try:
                            bticard.CardStop(h_core)
                        except Exception:
                            pass
                        meta = apply_config()
                        rx_by_chan = {v: k for k, v in meta["rx_chans"].items()}
                        last_struct_cfg = struct_fp
                    last_raw_cfg = raw_fp

                drain_seq()
                time.sleep(0.05)

            drain_seq()
            try:
                bticard.CardStop(h_core)
            except Exception:
                pass
            try:
                bticard.CardClose(h_card)
            except Exception:
                pass
        except Exception as exc:
            logger.exception("arinc session failed")
            with self._lock:
                self._error = str(exc)
                self._running = False
        finally:
            with self._lock:
                self._h_card = None
                self._h_core = None
