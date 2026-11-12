"""Single-instance hardware adapter for Astronics Ballard OmniBus II (btidriver)."""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("ate_arinc429.driver")

try:
    from btidriver import bti429, bticard  # type: ignore[import-not-found]
    HAS_BTIDRIVER = True
except ImportError:
    bticard: Any = None
    bti429: Any = None
    HAS_BTIDRIVER = False


@dataclass
class BallardChannelHandles:
    tx_channels: dict[str, int]
    rx_channels: dict[str, int]
    tx_msg_addrs: dict[str, int]


class BallardArincAdapter:
    """Thread-safe hardware adapter for ARINC 429 TX/RX using Ballard OmniBus II.

    Maintains a single CardOpen/CoreOpen handle pair so multiple UI operating modes
    (Standard, CFDS, CMC) never open competing connections to Card 0 / Core 0.
    """

    def __init__(self, card_num: int = 0, core_num: int = 0) -> None:
        self.card_num = card_num
        self.core_num = core_num
        self._lock = threading.RLock()
        self._hcard: Any = None
        self._hcore: Any = None
        self._handles: BallardChannelHandles | None = None
        self._connected = False
        self._last_error = ""

    @property
    def is_driver_present(self) -> bool:
        return HAS_BTIDRIVER

    @property
    def is_connected(self) -> bool:
        with self._lock:
            return self._connected

    @property
    def last_error(self) -> str:
        with self._lock:
            return self._last_error

    def open(self) -> bool:
        """Open single connection to Ballard Card/Core and discover up to 4 TX / 4 RX channels."""
        with self._lock:
            if self._connected:
                return True
            if not HAS_BTIDRIVER:
                self._last_error = "btidriver package not installed on this host"
                return False

            try:
                self._hcard = bticard.CardOpen(self.card_num)
                self._hcore = bticard.CoreOpen(self.core_num, self._hcard)
                bticard.CardReset(self._hcore)

                tx_chans: dict[str, int] = {}
                rx_chans: dict[str, int] = {}
                tx_names = ["TX-A", "TX-B", "TX-C", "TX-D"]
                rx_names = ["RX-A", "RX-B", "RX-C", "RX-D"]
                tx_idx = 0
                rx_idx = 0

                for ch in range(32):
                    if bti429.ChIsXmt(ch, self._hcore) and tx_idx < 4:
                        bti429.ChConfig(bti429.CHCFG429_DEFAULT, ch, self._hcore)
                        tx_chans[tx_names[tx_idx]] = ch
                        tx_idx += 1
                    elif bti429.ChIsRcv(ch, self._hcore) and rx_idx < 4:
                        bti429.ChConfig(bti429.CHCFG429_AUTOSPEED, ch, self._hcore)
                        bti429.FilterDefault(bti429.MSGCRT429_DEFAULT, ch, self._hcore)
                        rx_chans[rx_names[rx_idx]] = ch
                        rx_idx += 1

                bticard.SeqConfig(bticard.SEQCFG_DEFAULT, self._hcore)
                bticard.CardStart(self._hcore)

                self._handles = BallardChannelHandles(
                    tx_channels=tx_chans,
                    rx_channels=rx_chans,
                    tx_msg_addrs={},
                )
                self._connected = True
                self._last_error = ""
                logger.info("Ballard ARINC 429 Card #%d Core #%d opened", self.card_num, self.core_num)
                return True
            except Exception as exc:
                self._last_error = str(exc)
                self.close()
                logger.warning("Ballard ARINC 429 hardware unavailable: %s", exc)
                return False

    def close(self) -> None:
        """Cleanly close the Ballard card handle if open."""
        with self._lock:
            if self._hcard is not None and HAS_BTIDRIVER:
                try:
                    if self._hcore is not None:
                        bticard.CardStop(self._hcore)
                    bticard.CardClose(self._hcard)
                except Exception:
                    pass
            self._hcard = None
            self._hcore = None
            self._handles = None
            self._connected = False

    def configure_channel(self, channel_name: str, speed: str, trap_label: str | None = None) -> bool:
        """Apply speed / filter configuration to a mapped TX or RX physical channel."""
        with self._lock:
            if not self._connected or self._handles is None or not HAS_BTIDRIVER:
                return False
            try:
                if channel_name in self._handles.tx_channels:
                    ch = self._handles.tx_channels[channel_name]
                    flag = bti429.CHCFG429_HIGHSPEED if speed == "100k" else bti429.CHCFG429_LOWSPEED
                    bti429.ChConfig(flag, ch, self._hcore)
                    return True
                if channel_name in self._handles.rx_channels:
                    ch = self._handles.rx_channels[channel_name]
                    flag = bti429.CHCFG429_HIGHSPEED if speed == "100k" else bti429.CHCFG429_LOWSPEED
                    bti429.ChConfig(flag, ch, self._hcore)
                    if trap_label:
                        bti429.FilterSet(bti429.MSGCRT429_DEFAULT, int(trap_label, 8), bti429.SDIALL, ch, self._hcore)
                    return True
            except Exception as exc:
                self._last_error = str(exc)
            return False

    def transmit_word(self, channel_name: str, raw_word: int) -> bool:
        """Transmit a 32-bit ARINC 429 word on the mapped hardware channel."""
        with self._lock:
            if not self._connected or self._handles is None or not HAS_BTIDRIVER:
                return False
            ch = self._handles.tx_channels.get(channel_name)
            if ch is None:
                return False
            try:
                msg_addr = self._handles.tx_msg_addrs.get(channel_name)
                if msg_addr is None:
                    msg_addr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, self._hcore)
                    self._handles.tx_msg_addrs[channel_name] = msg_addr
                    bti429.SchedBuild([msg_addr], [10], [50], ch, self._hcore)
                bti429.MsgDataWr(raw_word & 0xFFFFFFFF, msg_addr, self._hcore)
                return True
            except Exception as exc:
                self._last_error = str(exc)
                return False

