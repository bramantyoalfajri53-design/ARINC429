"""Shared single-owner ARINC 429 bus coordinator for Standard, CFDS, and CMC modes."""

from __future__ import annotations

import csv
import io
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

from .codec import decode_arinc429_word
from .driver import HAS_BTIDRIVER, BallardArincAdapter

OperatingMode = Literal["STANDARD", "CFDS", "CMC"]
BusSpeed = Literal["100k", "12.5k"]
DataSource = Literal["HARDWARE", "SIMULATION"]


@dataclass
class TxChannelState:
    speed: BusSpeed = "12.5k"
    enabled: bool = False


@dataclass
class RxChannelState:
    speed: BusSpeed = "12.5k"
    trap_label: str = ""
    trap_active: bool = False


@dataclass
class BusLogEntry:
    timestamp: str
    mode: OperatingMode
    source: DataSource
    direction: Literal["TX", "RX", "SYS"]
    channel: str
    label: str
    raw_hex: str
    detail: str


class Arinc429Coordinator:
    """Single-owner coordinator preventing channel conflicts, duplicate links, and RX mix-ups."""

    def __init__(self, simulation_mode: bool | None = None) -> None:
        self._lock = threading.RLock()
        self.adapter = BallardArincAdapter()
        # Default to hardware attempt if driver is installed, otherwise explicit SIMULATION mode
        self._simulation_mode: bool = (not HAS_BTIDRIVER) if simulation_mode is None else simulation_mode
        self._active_mode: OperatingMode = "STANDARD"
        self._bus_running: bool = False
        self._global_speed: BusSpeed = "12.5k"
        self._word_count: int = 0

        self._tx_channels: dict[str, TxChannelState] = {
            "TX-A": TxChannelState(speed="12.5k", enabled=True),
            "TX-B": TxChannelState(speed="12.5k", enabled=False),
            "TX-C": TxChannelState(speed="12.5k", enabled=False),
            "TX-D": TxChannelState(speed="12.5k", enabled=False),
        }
        self._rx_channels: dict[str, RxChannelState] = {
            "RX-A": RxChannelState(speed="12.5k", trap_label="356", trap_active=False),
            "RX-B": RxChannelState(speed="12.5k", trap_label="350", trap_active=False),
            "RX-C": RxChannelState(speed="12.5k", trap_label="", trap_active=False),
            "RX-D": RxChannelState(speed="12.5k", trap_label="", trap_active=False),
        }

        self._rx_buffers: dict[OperatingMode, deque[dict[str, Any]]] = {
            "STANDARD": deque(maxlen=100),
            "CFDS": deque(maxlen=100),
            "CMC": deque(maxlen=100),
        }
        self._logs: deque[BusLogEntry] = deque(maxlen=500)
        self._log("STANDARD", "SYS", "-", "---", "00000000", "ARINC 429 Coordinator initialized")

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    @property
    def data_source(self) -> DataSource:
        with self._lock:
            if not self._simulation_mode and self.adapter.is_connected:
                return "HARDWARE"
            return "SIMULATION"

    def start_hardware(self) -> None:
        """Initialize physical adapter if not in simulation mode."""
        with self._lock:
            if not self._simulation_mode:
                opened = self.adapter.open()
                if not opened:
                    self._simulation_mode = True
                    self._log(
                        self._active_mode,
                        "SYS",
                        "-",
                        "---",
                        "00000000",
                        f"Hardware unavailable ({self.adapter.last_error}); operating in SIMULATION mode",
                    )

    def stop_hardware(self) -> None:
        """Release hardware link on server shutdown."""
        with self._lock:
            self._bus_running = False
            self.adapter.close()

    def _log(
        self,
        mode: OperatingMode,
        direction: Literal["TX", "RX", "SYS"],
        channel: str,
        label: str,
        raw_hex: str,
        detail: str,
    ) -> None:
        src = "SIMULATION" if direction == "SYS" and self._simulation_mode else self.data_source
        self._logs.append(
            BusLogEntry(
                timestamp=self._now_iso(),
                mode=mode,
                source=src,
                direction=direction,
                channel=channel,
                label=label,
                raw_hex=raw_hex,
                detail=detail,
            )
        )

    def acquire_mode(self, mode: OperatingMode) -> dict[str, Any]:
        """Switch exclusive bus ownership to a single operating mode and flush cross-mode RX queues."""
        with self._lock:
            previous = self._active_mode
            if previous != mode:
                self._rx_buffers[previous].clear()
                self._active_mode = mode
                self._log(
                    mode,
                    "SYS",
                    "-",
                    "---",
                    "00000000",
                    f"Mode switched from {previous} to {mode}; RX isolation barrier applied",
                )
            return self.snapshot()

    def set_bus_state(
        self,
        running: bool | None = None,
        speed: BusSpeed | None = None,
        simulation_mode: bool | None = None,
    ) -> dict[str, Any]:
        """Update shared bus transmission state, speed, or simulation flag."""
        with self._lock:
            if simulation_mode is not None:
                if not simulation_mode:
                    opened = self.adapter.open()
                    if not opened:
                        raise RuntimeError(
                            f"Cannot switch to HARDWARE mode: {self.adapter.last_error or 'Ballard hardware unavailable'}"
                        )
                    self._simulation_mode = False
                else:
                    self.adapter.close()
                    self._simulation_mode = True

            if speed is not None:
                self._global_speed = speed
                for ch_name, ch_state in self._tx_channels.items():
                    ch_state.speed = speed
                    if not self._simulation_mode:
                        self.adapter.configure_channel(ch_name, speed)
                for ch_name, rx_state in self._rx_channels.items():
                    rx_state.speed = speed
                    if not self._simulation_mode:
                        self.adapter.configure_channel(ch_name, speed, rx_state.trap_label or None)

            if running is not None:
                self._bus_running = running
                self._log(
                    self._active_mode,
                    "SYS",
                    "-",
                    "---",
                    "00000000",
                    f"ARINC 429 Bus {'STARTED' if running else 'STOPPED'} ({self._global_speed}, {self.data_source})",
                )
            return self.snapshot()

    def configure_channel(
        self,
        channel: str,
        speed: BusSpeed | None = None,
        enabled: bool | None = None,
        trap_label: str | None = None,
        trap_active: bool | None = None,
    ) -> dict[str, Any]:
        """Configure one of shared channels TX-A..D or RX-A..D."""
        with self._lock:
            if channel in self._tx_channels:
                st = self._tx_channels[channel]
                if speed is not None:
                    st.speed = speed
                if enabled is not None:
                    st.enabled = enabled
                if not self._simulation_mode:
                    self.adapter.configure_channel(channel, st.speed)
                self._log(
                    self._active_mode,
                    "SYS",
                    channel,
                    "---",
                    "00000000",
                    f"{channel} updated speed={st.speed} enabled={st.enabled}",
                )
                return self.snapshot()

            if channel in self._rx_channels:
                rx = self._rx_channels[channel]
                if speed is not None:
                    rx.speed = speed
                if trap_label is not None:
                    rx.trap_label = trap_label
                if trap_active is not None:
                    rx.trap_active = trap_active
                if not self._simulation_mode:
                    self.adapter.configure_channel(channel, rx.speed, rx.trap_label or None)
                self._log(
                    self._active_mode,
                    "SYS",
                    channel,
                    rx.trap_label or "---",
                    "00000000",
                    f"{channel} updated speed={rx.speed} trap={rx.trap_label or 'OFF'}",
                )
                return self.snapshot()

            raise ValueError(f"Unknown ARINC 429 channel: {channel}")

    def transmit_word(
        self,
        mode: OperatingMode,
        channel: str,
        raw_word: int,
        detail: str = "",
        expected_parity: str = "ODD",
    ) -> dict[str, Any]:
        """Coordinate TX word emission ensuring exclusive mode ownership and single-channel access."""
        with self._lock:
            if self._active_mode != mode:
                raise PermissionError(
                    f"Mode conflict: bus currently owned by {self._active_mode}, cannot transmit from {mode}"
                )
            if channel not in self._tx_channels:
                raise ValueError(f"Invalid TX channel: {channel}")

            decoded = decode_arinc429_word(raw_word, expected_parity=expected_parity)
            if not self._simulation_mode:
                ok = self.adapter.transmit_word(channel, decoded.raw)
                if not ok:
                    raise RuntimeError(f"Hardware transmit failed: {self.adapter.last_error}")

            self._word_count += 1
            src = self.data_source
            self._log(
                mode,
                "TX",
                channel,
                decoded.label_oct,
                decoded.hex_word,
                detail or f"TX {decoded.label_oct} SSM={decoded.ssm}",
            )
            return {
                "ok": True,
                "source": src,
                "mode": mode,
                "channel": channel,
                "raw_hex": decoded.hex_word,
                "label": decoded.label_oct,
                "sdi": decoded.sdi,
                "data_hex": decoded.data_hex,
                "ssm": decoded.ssm,
                "timestamp": self._now_iso(),
            }

    def record_rx_word(
        self,
        mode: OperatingMode,
        channel: str,
        raw_word: int,
        detail: str = "",
        source_override: DataSource | None = None,
    ) -> dict[str, Any]:
        """Record a received ARINC 429 word into the owning mode's isolated RX buffer."""
        with self._lock:
            decoded = decode_arinc429_word(raw_word)
            src: DataSource = source_override or self.data_source
            self._word_count += 1
            entry = {
                "timestamp": self._now_iso(),
                "mode": mode,
                "source": src,
                "channel": channel,
                "label": decoded.label_oct,
                "sdi": decoded.sdi,
                "data_hex": decoded.data_hex,
                "ssm": decoded.ssm,
                "raw_hex": decoded.hex_word,
                "detail": detail,
            }
            self._rx_buffers[mode].append(entry)
            self._log(
                mode,
                "RX",
                channel,
                decoded.label_oct,
                decoded.hex_word,
                detail or f"RX {decoded.label_oct}",
            )
            return entry

    def log_event(
        self,
        mode: OperatingMode,
        detail: str,
        direction: Literal["TX", "RX", "SYS"] = "SYS",
        channel: str = "-",
        label: str = "---",
        raw_hex: str = "00000000",
    ) -> None:
        """Append a protocol or diagnostic event with explicit SIMULATION/HARDWARE source tagging."""
        with self._lock:
            self._log(mode, direction, channel, label, raw_hex, detail)

    def get_rx_history(self, mode: OperatingMode, limit: int = 30) -> list[dict[str, Any]]:
        """Return isolated RX history exclusively for the requested mode."""
        with self._lock:
            return list(self._rx_buffers[mode])[-limit:]

    def export_logs(self, fmt: Literal["json", "csv"] = "json") -> tuple[str, str]:
        """Export timestamped bus activity logs as JSON string or CSV string (zero-DB design)."""
        import json

        with self._lock:
            rows = [
                {
                    "timestamp": e.timestamp,
                    "mode": e.mode,
                    "source": e.source,
                    "direction": e.direction,
                    "channel": e.channel,
                    "label": e.label,
                    "raw_hex": e.raw_hex,
                    "detail": e.detail,
                }
                for e in self._logs
            ]
            if fmt == "csv":
                buf = io.StringIO()
                writer = csv.DictWriter(
                    buf,
                    fieldnames=["timestamp", "mode", "source", "direction", "channel", "label", "raw_hex", "detail"],
                )
                writer.writeheader()
                writer.writerows(rows)
                return buf.getvalue(), "text/csv"
            return json.dumps({"source": self.data_source, "logs": rows}, indent=2), "application/json"

    def snapshot(self) -> dict[str, Any]:
        """Return full shared ARINC 429 coordinator snapshot."""
        with self._lock:
            return {
                "source": self.data_source,
                "simulation_mode": self._simulation_mode,
                "hardware_driver_installed": HAS_BTIDRIVER,
                "hardware_connected": self.adapter.is_connected,
                "active_mode": self._active_mode,
                "bus_running": self._bus_running,
                "global_speed": self._global_speed,
                "word_count": self._word_count,
                "channels": {
                    "tx": {
                        k: {"speed": v.speed, "enabled": v.enabled}
                        for k, v in self._tx_channels.items()
                    },
                    "rx": {
                        k: {"speed": v.speed, "trap_label": v.trap_label, "trap_active": v.trap_active}
                        for k, v in self._rx_channels.items()
                    },
                },
                "logs": [
                    {
                        "timestamp": e.timestamp,
                        "mode": e.mode,
                        "source": e.source,
                        "direction": e.direction,
                        "channel": e.channel,
                        "label": e.label,
                        "raw_hex": e.raw_hex,
                        "detail": e.detail,
                    }
                    for e in list(self._logs)[-50:]
                ],
                "rx_recent": list(self._rx_buffers[self._active_mode])[-20:],
                "timestamp": time.time(),
            }

