"""Dummy TPS plugin — capability API only, no SCPI / VISA."""

from __future__ import annotations

from typing import Any

from ate_platform.wiring.netlist import channel_for_pin


def run(caps: Any, ctx: dict[str, Any], **_kwargs: Any) -> dict[str, Any]:
    """Prove a plugin can use netlist + dc_bus without touching instruments."""
    netlist = ctx["netlist"]
    dc_pin = channel_for_pin(netlist, "J1-1")
    if dc_pin != "dc_pos":
        raise RuntimeError(f"unexpected channel for J1-1: {dc_pin}")

    caps.dc_apply(voltage=12.0, current_limit=2.0)
    caps.dc_output(True)
    m = caps.dc_measure()
    caps.dc_output(False)
    caps.dc_apply(voltage=0.0)

    return {
        "plugin": "dummy_tps",
        "uut_id": ctx.get("uut_id"),
        "adapter_id": ctx.get("adapter_id"),
        "dc_channel": dc_pin,
        "measured_v": m.get("voltage"),
        "note": "no SCPI in this module",
    }
