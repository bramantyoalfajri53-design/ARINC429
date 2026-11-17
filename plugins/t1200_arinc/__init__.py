"""T1200-compatible ARINC 429 bus smoke via OmniBus (capability-style plugin)."""

from __future__ import annotations

from typing import Any


def run(caps: Any, ctx: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
    """Run T1200 A–D loopback using netlist mapping.

    kwargs:
      buses: list/str default A,B,C,D
      seconds, min_hits, high_speed, selftest, card, core
    """
    from ate_platform.device.arinc429 import run_t1200_bus_loopback

    buses = kwargs.get("buses", ["A", "B", "C", "D"])
    if isinstance(buses, str):
        buses = [b.strip() for b in buses.split(",") if b.strip()]

    netlist_path = None
    plan = ctx.get("plan") or {}
    if plan.get("netlist"):
        netlist_path = plan["netlist"]
    elif ctx.get("netlist") is not None and getattr(ctx["netlist"], "raw", None):
        # prefer path from plan; raw already loaded
        netlist_path = "netlist/t1200_db37_omnibus_441.yaml"

    results = run_t1200_bus_loopback(
        cardnum=int(kwargs.get("card", 0)),
        corenum=int(kwargs.get("core", 0)),
        netlist_path=netlist_path or "netlist/t1200_db37_omnibus_441.yaml",
        high_speed=bool(kwargs.get("high_speed", False)),
        seconds=float(kwargs.get("seconds", 2.0)),
        min_hits=int(kwargs.get("min_hits", 3)),
        selftest=bool(kwargs.get("selftest", False)),
        buses=buses,
    )
    failed = [r for r in results if not r.ok]
    if failed:
        detail = "; ".join(f"{r.bus}:{r.detail}" for r in failed)
        raise RuntimeError(f"ARINC loopback FAIL: {detail}")

    return {
        "plugin": "t1200_arinc",
        "buses": [
            {
                "bus": r.bus,
                "phys_tx": r.phys_tx,
                "phys_rx": r.phys_rx,
                "tx_hits": r.tx_hits,
                "rx_hits": r.rx_hits,
                "last_rx": r.last_rx,
                "label": oct(r.label),
            }
            for r in results
        ],
        "verdict": "PASS",
    }
