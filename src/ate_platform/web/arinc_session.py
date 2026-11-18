"""ARINC 429 TX/RX session — 10 slots per channel, app mode + screen stack."""

from __future__ import annotations

import logging
import math
import threading
import time
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Optional

from ate_platform.device.arinc429 import (
    load_t1200_channels,
    require_btidriver,
    resolve_rx_channel,
    resolve_tx_channel,
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
        self.corenum = core
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
        self._filter_hist: dict[tuple[str, str], list[tuple[float, float]]] = {}
        self._last_rx_ts: dict[tuple[str, str], float] = {}
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
            if high_speed is not None:
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
        with self._lock:
            if not self.rx[bus].enabled or not self.channel[bus].rx_enable:
                return None
            filters = list(self.rx[bus].filter_labels)
            dm = self.channel[bus].display_mode
            tc = self.time_constant_s
        rec = decode_received(int(raw), display_mode=dm)
        if filters and rec["label_octal"] not in filters:
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
            sl.data_text = decode_label(spec, raw).get("data_text") or f"{value} {spec.units}".strip()
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

    def apply_profile(
        self,
        profile_id: str,
        tx_ch: str | None = None,
        rx_ch: str | None = None,
        *,
        apply_tx: bool = True,
        apply_rx: bool = True,
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
            self.active_profile = profile.id
            self._disarm_specials_unlocked(keep="mmr" if profile.id == "mmr_755" else None)
            if apply_tx:
                self.tx_ch = tx_ch
                self.tx_profile[tx_ch] = profile.id
                cfg = self.channel[tx_ch]
                cfg.high_speed = profile.high_speed
                cfg.bit_rate_kbps = 100.0 if profile.high_speed else 12.5
                cfg.tx_enable = True
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

    def apply_dme_mode(self, mode: str) -> dict[str, Any]:
        mode = mode.lower()
        if mode not in {"standard", "single", "multi"}:
            raise ValueError("dme mode must be standard, single, or multi")
        spec = lookup_label("035")
        if spec is None:
            raise ValueError("DME label 035 missing from dictionary")
        with self._lock:
            self.dme_mode = mode
            self.active_profile = "dme"
            self.dme_line = 0
            bus = "A"
            cfg = self.channel[bus]
            cfg.tx_enable = True
            cfg.rx_enable = True
            self.rx[bus].enabled = True
            self.tx_ch = bus
            self.rx_ch = bus
            self.tx_profile[bus] = "dme"
            self.rx_profile[bus] = "dme"
            cfg.high_speed = False
            cfg.bit_rate_kbps = 12.5
            for sl in self.tx[bus]:
                sl.enabled = False
                sl.raw = 0
                sl.label_octal = "000"
            self._disarm_specials_unlocked(keep="dme")
            self._scope_rx_to_profile_unlocked(load_profile("dme"), bus)
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
                self.screen_stack = ["mode_select", "standard", "avionics_lru", "lru_format"]
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
            payload: dict[str, Any] = {
                "value": float(freq_mhz if freq_mhz is not None else cur["freq_mhz"]),
                "mode": mode or cur["mode"],
                "nav": nav or cur["nav"],
                "disp": cur["disp"] if disp is None else disp,
                "ident": cur["ident"] if ident is None else ident,
                "sdi": sl.sdi if sdi is None else sdi,
                "ssm": ssm or sl.ssm,
            }
            if pad is not None and str(pad).strip():
                clean_pad = str(pad).strip()
                payload["pad_bits"] = clean_pad
                try:
                    p_val = int(clean_pad, 2) if all(c in "01" for c in clean_pad) else int(clean_pad, 0)
                    mode_i = p_val & 0x7
                    nav_i = (p_val >> 3) & 0x3
                    payload["mode"] = next((k for k, v in DME_MODE_BITS.items() if v == mode_i), payload["mode"])
                    payload["nav"] = next((k for k, v in DME_NAV_BITS.items() if v == nav_i), payload["nav"])
                    payload["disp"] = bool((p_val >> 5) & 1)
                    payload["ident"] = bool((p_val >> 6) & 1)
                except Exception:
                    pass
            self._fill_slot_from_spec(bus, int(index), spec, payload, enabled=sl.enabled if enabled is None else enabled)
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

    def dme_echo(self, bus: str = "A") -> dict[str, Any]:
        """Compare last RX 035 with TX 035 on the given bus."""
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
                    if same_label and (rx035.data19 & ~0x7) == (sl.data19 & ~0x7) and rx035.ssm == sl.ssm:
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
            return {
                "rows": rows,
                "bnr_dist": None if dist_stale else dist.data_text,
                "ident": "" if not ident1 else f"{ident1.data_text}{(ident2.data_text if ident2 else '')}",
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
            "hits": view.label_hits.get(lab, 0),
            "age_ms": int(age * 1000) if age is not None else None,
            "stale": stale,
            "rate_ms": rate_ms,
            "trapped": trapped,
            "waiting": waiting,
        }

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
                        }
                        for h in v.ring[-16:]
                    ],
                }
            any_hi = any(self.channel[b].high_speed for b in BUSES)
            dme = None
            if self.dme_mode:
                try:
                    dme = self.dme_echo("A")
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
                "bit_rate_kbps": 100.0 if any_hi else 12.5,
                "high_speed": any_hi,
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
                "lru_connection": self.check_lru_connected(self.active_lru_code or "709", bus="A"),
                "simulation_override": self._sim_override,
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
            tx_fp = tuple(
                (b, tuple(
                    (s.index, s.enabled, s.raw, s.rate_ms, s.mode) for s in self.tx[b]
                ))
                for b in sorted(self.tx)
            )
            rx_fp = tuple(
                (b, v.enabled, tuple(v.filter_labels), v.filter_sdi)
                for b, v in sorted(self.rx.items())
            )
            return bus_fp, tx_fp, rx_fp

    def _worker(self) -> None:
        from btidriver import bticard, bti429, DriverError

        try:
            channels = load_t1200_channels(self.netlist_path)
            h_card = bticard.CardOpen(self.cardnum)
            h_core = bticard.CoreOpen(self.corenum, h_card)
            with self._lock:
                self._h_card = h_card
                self._h_core = h_core

            def apply_config() -> dict[str, Any]:
                bticard.CardReset(h_core)
                meta: dict[str, Any] = {
                    "tx_addrs": {}, "rx_chans": {}, "tx_chans": {},
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

                    if cfg.rx_enable:
                        bti429.ChConfig(
                            bti429.CHCFG429_AUTOSPEED | bti429.CHCFG429_SEQALL | wrap,
                            log_rx, h_core,
                        )
                    else:
                        bti429.ChConfig(
                            bti429.CHCFG429_INACTIVE | bti429.CHCFG429_SEQALL,
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
            last_cfg = self._config_fingerprint()

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
                    if ch not in rx_by_chan:
                        continue
                    bus = rx_by_chan[ch]
                    data = int(rec.data) & 0xFFFFFFFF
                    try:
                        self.ingest_rx_word(bus, data)
                    except Exception:
                        continue

            while not self._stop.is_set():
                fp = self._config_fingerprint()
                if fp != last_cfg:
                    try:
                        bticard.CardStop(h_core)
                    except Exception:
                        pass
                    meta = apply_config()
                    rx_by_chan = {v: k for k, v in meta["rx_chans"].items()}
                    last_cfg = fp

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
