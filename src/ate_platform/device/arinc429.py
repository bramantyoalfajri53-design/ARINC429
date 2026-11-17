"""OmniBus II ARINC 429 helper (BTIDriver) for PN 441 / T1200 breakout."""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional

import yaml

from ate_platform.paths import REPO_ROOT

try:
    from btidriver import bticard, bti429, DriverError
except ImportError:  # pragma: no cover
    bticard = None  # type: ignore
    bti429 = None  # type: ignore

    class DriverError(Exception):  # type: ignore
        pass


@dataclass
class BusChannel:
    name: str
    role: str
    phys: int
    logical: int


@dataclass
class LoopbackHit:
    bus: str
    phys_tx: int
    phys_rx: int
    log_tx: int
    log_rx: int
    label: int
    word: int
    tx_hits: int
    rx_hits: int
    last_rx: int | None
    ok: bool
    detail: str


def require_btidriver() -> None:
    if bticard is None or bti429 is None:
        raise ImportError(
            "btidriver not available. Use ATE venv:\n"
            "  source /home/paridit/project/ATE/.venv/bin/activate"
        )


def load_t1200_channels(
    netlist_path: str | Path | None = None,
) -> dict[str, dict[str, Any]]:
    path = Path(netlist_path) if netlist_path else (
        REPO_ROOT / "netlist" / "t1200_db37_omnibus_441.yaml"
    )
    if not path.is_file():
        path = REPO_ROOT / path
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    channels = raw.get("channels") or {}
    if not channels:
        raise ValueError(f"No channels in {path}")
    return {str(k): dict(v) for k, v in channels.items()}


def t1200_loopback_pairs(
    netlist_path: str | Path | None = None,
) -> list[tuple[str, int, int]]:
    """Return [(bus_letter, phys_tx, phys_rx), ...] for A–D."""
    ch = load_t1200_channels(netlist_path)
    out: list[tuple[str, int, int]] = []
    for letter in ("A", "B", "C", "D"):
        tx = ch[f"XMIT_{letter}"]
        rx = ch[f"RCVR_{letter}"]
        out.append((letter, int(tx["omnibus_phys"]), int(rx["omnibus_phys"])))
    return out


def resolve_tx_channel(h_core: Any, phys: int) -> int:
    require_btidriver()
    if bti429.ChIsXmt(phys, h_core):
        return phys
    alt = phys + 16
    if alt < 32 and bti429.ChIsXmt(alt, h_core):
        return alt
    raise RuntimeError(f"No Tx capability for physical CH{phys}")


def resolve_rx_channel(h_core: Any, phys: int) -> int:
    require_btidriver()
    if bti429.ChIsRcv(phys, h_core):
        return phys
    alt = phys + 16
    if alt < 32 and bti429.ChIsRcv(alt, h_core):
        return alt
    raise RuntimeError(f"No Rx capability for physical CH{phys}")


def _seq_channel(activity: int) -> int:
    return (activity & bti429.MSGACT429_CHMASK) >> bti429.MSGACT429_CHSHIFT


def run_t1200_bus_loopback(
    *,
    cardnum: int = 0,
    corenum: int = 0,
    netlist_path: str | Path | None = None,
    high_speed: bool = False,
    seconds: float = 2.0,
    min_hits: int = 3,
    selftest: bool = False,
    buses: Iterable[str] | None = None,
) -> list[LoopbackHit]:
    """Loopback each T1200 bus: XMIT_x (phys) -> RCVR_x (phys)."""
    require_btidriver()
    wanted = {b.upper() for b in (buses or ("A", "B", "C", "D"))}
    pairs = [(bus, tx, rx) for bus, tx, rx in t1200_loopback_pairs(netlist_path) if bus in wanted]
    if not pairs:
        raise ValueError("No buses selected")

    h_card = bticard.CardOpen(cardnum)
    try:
        h_core = bticard.CoreOpen(corenum, h_card)
        bticard.CardReset(h_core)

        speed = bti429.CHCFG429_HIGHSPEED if high_speed else bti429.CHCFG429_LOWSPEED
        wrap = bti429.CHCFG429_SELFTEST if selftest else 0

        planned: list[dict[str, Any]] = []
        for i, (bus, phys_tx, phys_rx) in enumerate(pairs):
            log_tx = resolve_tx_channel(h_core, phys_tx)
            log_rx = resolve_rx_channel(h_core, phys_rx)
            label = 0o201 + i  # distinct labels per bus
            word = (bti429.FldPutLabel(0, label) | ((0xB000 + (i << 8)) & 0xFFFFFF00)) & 0xFFFFFFFF
            planned.append(
                {
                    "bus": bus,
                    "phys_tx": phys_tx,
                    "phys_rx": phys_rx,
                    "log_tx": log_tx,
                    "log_rx": log_rx,
                    "label": label,
                    "word": word,
                    "tx_hits": 0,
                    "rx_hits": 0,
                    "last_rx": None,
                }
            )

        for p in planned:
            bti429.ChConfig(
                bti429.CHCFG429_AUTOSPEED | bti429.CHCFG429_SEQALL | wrap,
                p["log_rx"],
                h_core,
            )
            bti429.ChConfig(speed | bti429.CHCFG429_SEQALL | wrap, p["log_tx"], h_core)
            bti429.FilterDefault(bti429.MSGCRT429_DEFAULT, p["log_rx"], h_core)
            bti429.FilterSet(
                bti429.MSGCRT429_DEFAULT,
                p["label"],
                bti429.SDIALL,
                p["log_rx"],
                h_core,
            )
            xaddr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, h_core)
            bti429.MsgDataWr(p["word"], xaddr, h_core)
            bti429.SchedBuild([xaddr], [150], [300], p["log_tx"], h_core)

        bticard.SeqConfig(bticard.SEQCFG_DEFAULT, h_core)
        bticard.CardStart(h_core)

        buf_size = 8192
        seqbuf = bticard.uint16_buffer(buf_size)
        by_tx = {p["log_tx"]: p for p in planned}
        by_rx = {p["log_rx"]: p for p in planned}

        deadline = time.time() + seconds
        while time.time() < deadline:
            seqcount, _ = bticard.SeqBlkRd(seqbuf, buf_size, h_core)
            if seqcount:
                sfinfo = bticard.SeqFindInit(seqbuf, seqcount)
                while True:
                    rec = bticard.SeqFindNext429(sfinfo)
                    if not rec:
                        break
                    ch = _seq_channel(int(rec.activity))
                    data = int(rec.data) & 0xFFFFFFFF
                    if ch in by_tx:
                        by_tx[ch]["tx_hits"] += 1
                    if ch in by_rx:
                        by_rx[ch]["rx_hits"] += 1
                        by_rx[ch]["last_rx"] = data
            time.sleep(0.02)

        bticard.CardStop(h_core)

        results: list[LoopbackHit] = []
        for p in planned:
            last = p["last_rx"]
            label_ok = last is not None and bti429.FldGetLabel(last) == p["label"]
            ok = p["tx_hits"] >= min_hits and p["rx_hits"] >= min_hits and label_ok
            detail = f"tx={p['tx_hits']} rx={p['rx_hits']} need>={min_hits}"
            if last is None:
                detail += " NO_RX"
            else:
                detail += f" last=0x{last:08X} label={'OK' if label_ok else 'BAD'}"
            results.append(
                LoopbackHit(
                    bus=p["bus"],
                    phys_tx=p["phys_tx"],
                    phys_rx=p["phys_rx"],
                    log_tx=p["log_tx"],
                    log_rx=p["log_rx"],
                    label=p["label"],
                    word=p["word"],
                    tx_hits=p["tx_hits"],
                    rx_hits=p["rx_hits"],
                    last_rx=last,
                    ok=ok,
                    detail=detail,
                )
            )
        return results
    finally:
        try:
            bticard.CardClose(h_card)
        except Exception:
            pass
