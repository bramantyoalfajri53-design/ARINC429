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


def audit_ballard_hardware(cardnum: int = 0) -> dict[str, Any]:
    """Audit and discover all Ballard OmniBus II cores and ARINC 429 channels.

    Returns structured hardware metadata, inventory of RX and TX channels
    across cores, and detects the active core connected to physical transceivers.
    """
    import logging
    import os

    log = logging.getLogger("ate_platform.device.arinc429")

    if bticard is None or bti429 is None:
        return {
            "card": cardnum,
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

    try:
        hcard = bticard.CardOpen(cardnum)
    except Exception as exc:
        log.warning(f"Could not open Ballard card {cardnum}: {exc}")
        return {
            "card": cardnum,
            "simulated": False,
            "open_error": str(exc),
            "card_type": "Unknown",
            "product_pn": "",
            "serial_num": 0,
            "active_core": 0,
            "active_port": "P1 (Upper Connector)",
            "cores": [],
            "warning": f"Card {cardnum} open error: {exc}",
        }

    try:
        try:
            card_type = bticard.CardTypeStr(hcard)
        except Exception:
            card_type = "OmniBus II"

        try:
            product_pn = bticard.CardProductStr(hcard)
        except Exception:
            product_pn = ""

        try:
            serial_num = int(bticard.CardGetInfo(bticard.INFOTYPE_SERIALNUM, 0, hcard))
        except Exception:
            serial_num = 0

        core_candidates = [
            (0, "A", "P1 (Upper Connector)"),
            (1, "B", "P2 (Lower Connector)"),
            (2, "C", "Core C"),
            (3, "D", "Core D"),
        ]

        cores_info: list[dict[str, Any]] = []
        core_with_channels = None

        for c_idx, c_let, port_name in core_candidates:
            try:
                hcore = bticard.CoreOpen(c_idx, hcard)
                rx_chs = []
                tx_chs = []
                for ch in range(32):
                    try:
                        if bti429.ChIs429(ch, hcore):
                            if bti429.ChIsRcv(ch, hcore):
                                rx_chs.append(ch)
                            if bti429.ChIsXmt(ch, hcore):
                                tx_chs.append(ch)
                    except Exception:
                        pass
                total_chs = len(rx_chs) + len(tx_chs)
                if total_chs > 0 and core_with_channels is None:
                    core_with_channels = c_idx

                cores_info.append({
                    "core": c_idx,
                    "core_letter": c_let,
                    "port": port_name,
                    "rx_channels": rx_chs,
                    "tx_channels": tx_chs,
                    "count": total_chs,
                    "open_ok": True,
                })
            except Exception as e_core:
                cores_info.append({
                    "core": c_idx,
                    "core_letter": c_let,
                    "port": port_name,
                    "rx_channels": [],
                    "tx_channels": [],
                    "count": 0,
                    "open_ok": False,
                    "error": str(e_core),
                })
    finally:
        try:
            bticard.CardClose(hcard)
        except Exception:
            pass

    # Determine active core
    env_core = os.environ.get("ATE_ARINC_CORE")
    if env_core is not None:
        try:
            active_core = int(env_core)
        except ValueError:
            active_core = core_with_channels if core_with_channels is not None else 0
    else:
        active_core = core_with_channels if core_with_channels is not None else 0

    active_port = "P1 (Upper Connector)" if active_core == 0 else (
        "P2 (Lower Connector)" if active_core == 1 else f"Core {active_core}"
    )

    # Detect hardware wiring warnings
    warning = None
    if "441-000" in product_pn or product_pn.endswith("-000"):
        warning = (
            f"Modul Ballard OmniBus II PN {product_pn} (S/N {serial_num}) memiliki 8 channel ARINC 429 pada "
            f"Core 0 (Konektor Atas P1). Core 1 (Konektor Bawah P2) KOSONG / unpopulated (0 channel). "
            f"Kabel ARINC 429 menuju Interface Panel / DFIU T1203 HARUS dihubungkan ke KONEKTOR ATAS (P1 BALLARD)!"
        )

    # Prominent diagnostic banner in logs
    log.info("=" * 78)
    log.info(f"BALLARD HARDWARE AUDIT: {card_type} | PN: {product_pn} | S/N: {serial_num}")
    for c_info in cores_info:
        if c_info["open_ok"]:
            log.info(
                f"  Core {c_info['core']} (CORE {c_info['core_letter']} - {c_info['port']}): "
                f"{len(c_info['rx_channels'])} RX {c_info['rx_channels']}, "
                f"{len(c_info['tx_channels'])} TX {c_info['tx_channels']}"
            )
        else:
            log.info(f"  Core {c_info['core']} (CORE {c_info['core_letter']} - {c_info['port']}): Not Present")
    log.info(f"  --> ACTIVE CORE: {active_core} ({active_port})")
    if warning:
        log.warning(f"  --> HARDWARE NOTICE: {warning}")
    log.info("=" * 78)

    return {
        "card": cardnum,
        "simulated": False,
        "card_type": card_type,
        "product_pn": product_pn,
        "serial_num": serial_num,
        "active_core": active_core,
        "active_port": active_port,
        "cores": cores_info,
        "warning": warning,
    }

