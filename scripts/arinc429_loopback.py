#!/usr/bin/env python3
"""ARINC 429 hardware loopback for OmniBus II PN 441.

Profiles:
  diag   — CH0↔4, CH1↔5, CH2↔6, CH3↔7 (early wiring smoke)
  t1200  — production T1200 map: XMIT A→RCVR A … XMIT D→RCVR D
           (phys 1→0, 3→2, 5→4, 7→6)

T1200 jumpers required for profile t1200:
  CH1↔CH0 (bus A), CH3↔CH2 (B), CH5↔CH4 (C), CH7↔CH6 (D)

Example:
  source /home/paridit/project/ATE/.venv/bin/activate
  python3 scripts/arinc429_loopback.py --profile t1200
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "src"))

from ate_platform.device.arinc429 import (  # noqa: E402
    DriverError,
    run_t1200_bus_loopback,
    t1200_loopback_pairs,
)

# Keep diag path using the older pairwise helper in this file for compatibility.
try:
    from btidriver import bticard, bti429
except ImportError:
    bticard = bti429 = None  # type: ignore


DIAG_PAIRS = ((0, 4), (1, 5), (2, 6), (3, 7))


def _run_diag(args: argparse.Namespace) -> int:
    # Re-use legacy script logic via subprocess-equivalent inline import of old runner
    # by calling the shared pair loop through a thin local copy.
    from ate_platform.device import arinc429 as a429

    a429.require_btidriver()
    # Map diag pairs into temporary LoopbackHit-compatible run by faking bus names
    # Use low-level path: build custom pairs list via run that expects t1200 shape —
    # instead call original sequential code from scripts history briefly.
    import time

    h_card = bticard.CardOpen(args.card)
    try:
        h_core = bticard.CoreOpen(args.core, h_card)
        bticard.CardReset(h_core)
        speed = bti429.CHCFG429_HIGHSPEED if args.high_speed else bti429.CHCFG429_LOWSPEED
        wrap = bti429.CHCFG429_SELFTEST if args.selftest else 0
        planned = []
        for i, (phys_tx, phys_rx) in enumerate(DIAG_PAIRS):
            log_tx = a429.resolve_tx_channel(h_core, phys_tx)
            log_rx = a429.resolve_rx_channel(h_core, phys_rx)
            label = 0o101 + i
            word = (bti429.FldPutLabel(0, label) | ((0xA500 + (i << 8)) & 0xFFFFFF00)) & 0xFFFFFFFF
            planned.append(
                dict(
                    phys_tx=phys_tx,
                    phys_rx=phys_rx,
                    log_tx=log_tx,
                    log_rx=log_rx,
                    label=label,
                    word=word,
                    tx_hits=0,
                    rx_hits=0,
                    last_rx=None,
                )
            )
            print(
                f"  CH{phys_tx}(Tx {log_tx}) -> CH{phys_rx}(Rx {log_rx}) "
                f"label={oct(label)} word=0x{word:08X}"
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
                bti429.MSGCRT429_DEFAULT, p["label"], bti429.SDIALL, p["log_rx"], h_core
            )
            xaddr = bti429.MsgCreate(bti429.MSGCRT429_DEFAULT, h_core)
            bti429.MsgDataWr(p["word"], xaddr, h_core)
            bti429.SchedBuild([xaddr], [150], [300], p["log_tx"], h_core)
        bticard.SeqConfig(bticard.SEQCFG_DEFAULT, h_core)
        bticard.CardStart(h_core)
        buf = bticard.uint16_buffer(8192)
        by_tx = {p["log_tx"]: p for p in planned}
        by_rx = {p["log_rx"]: p for p in planned}
        t_end = time.time() + args.seconds
        while time.time() < t_end:
            n, _ = bticard.SeqBlkRd(buf, 8192, h_core)
            if n:
                sf = bticard.SeqFindInit(buf, n)
                while True:
                    rec = bticard.SeqFindNext429(sf)
                    if not rec:
                        break
                    ch = (int(rec.activity) & bti429.MSGACT429_CHMASK) >> bti429.MSGACT429_CHSHIFT
                    data = int(rec.data) & 0xFFFFFFFF
                    if ch in by_tx:
                        by_tx[ch]["tx_hits"] += 1
                    if ch in by_rx:
                        by_rx[ch]["rx_hits"] += 1
                        by_rx[ch]["last_rx"] = data
            time.sleep(0.02)
        bticard.CardStop(h_core)
        ok_all = True
        print("\nResults:")
        for p in planned:
            last = p["last_rx"]
            label_ok = last is not None and bti429.FldGetLabel(last) == p["label"]
            ok = p["tx_hits"] >= args.min_hits and p["rx_hits"] >= args.min_hits and label_ok
            ok_all = ok_all and ok
            st = "PASS" if ok else "FAIL"
            extra = f"last=0x{last:08X}" if last is not None else "NO_RX"
            print(
                f"  [{st}] CH{p['phys_tx']}->CH{p['phys_rx']}  "
                f"tx={p['tx_hits']} rx={p['rx_hits']} {extra}"
            )
        print("\nOVERALL:", "PASS" if ok_all else "FAIL")
        return 0 if ok_all else 1
    finally:
        bticard.CardClose(h_card)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="OmniBus II ARINC 429 loopback")
    parser.add_argument("--card", type=int, default=0)
    parser.add_argument("--core", type=int, default=0)
    parser.add_argument(
        "--profile",
        choices=("t1200", "diag"),
        default="t1200",
        help="t1200 = production A–D map (default); diag = early 0↔4…3↔7 jumpers",
    )
    parser.add_argument("--buses", default="A,B,C,D", help="For t1200: which buses (A,B,C,D)")
    parser.add_argument("--high-speed", action="store_true")
    parser.add_argument("--seconds", type=float, default=2.0)
    parser.add_argument("--min-hits", type=int, default=3)
    parser.add_argument(
        "--selftest",
        action="store_true",
        help="Internal wrap (no jumper). Only valid for a single bus.",
    )
    parser.add_argument(
        "--netlist",
        default=str(REPO / "netlist" / "t1200_db37_omnibus_441.yaml"),
    )
    args = parser.parse_args(argv)

    if args.profile == "diag":
        print("Profile: diag (CH0↔4, CH1↔5, CH2↔6, CH3↔7)")
        if args.selftest:
            print("Note: selftest with multi-pair may mix labels; prefer --profile t1200 --buses A")
        return _run_diag(args)

    print("Profile: t1200 (XMIT A–D → RCVR A–D)")
    print("Required external jumpers (remove diag 0↔4… jumpers first):")
    for bus, tx, rx in t1200_loopback_pairs(args.netlist):
        print(f"  Bus {bus}: CH{tx} (XMIT) <-> CH{rx} (RCVR)")

    buses = [b.strip().upper() for b in args.buses.split(",") if b.strip()]
    if args.selftest and len(buses) > 1:
        print(f"Note: --selftest using only bus {buses[0]}", file=sys.stderr)
        buses = buses[:1]

    try:
        results = run_t1200_bus_loopback(
            cardnum=args.card,
            corenum=args.core,
            netlist_path=args.netlist,
            high_speed=args.high_speed,
            seconds=args.seconds,
            min_hits=args.min_hits,
            selftest=args.selftest,
            buses=buses,
        )
    except DriverError as exc:
        print(f"DriverError: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print("\nResults:")
    all_ok = True
    for r in results:
        st = "PASS" if r.ok else "FAIL"
        all_ok = all_ok and r.ok
        print(
            f"  [{st}] Bus {r.bus}  CH{r.phys_tx}->CH{r.phys_rx}  "
            f"(log Tx{r.log_tx}/Rx{r.log_rx})  {r.detail}"
        )
    print("\nOVERALL:", "PASS" if all_ok else "FAIL")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
