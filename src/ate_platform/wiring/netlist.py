"""ITA netlist: UUT pin -> station capability channel."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from ate_platform.paths import REPO_ROOT


@dataclass
class Netlist:
    adapter_id: str
    name: str
    capabilities: list[str] = field(default_factory=list)
    pins: dict[str, str] = field(default_factory=dict)  # UUT pin -> station channel
    raw: dict[str, Any] = field(default_factory=dict)


def load_netlist(path: str | Path) -> Netlist:
    p = Path(path)
    if not p.is_file():
        p = REPO_ROOT / path
    raw = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    pins = {
        str(k): str(v)
        for k, v in (raw.get("pins") or {}).items()
    }
    return Netlist(
        adapter_id=str(raw.get("adapter_id", p.stem)),
        name=str(raw.get("name", "")),
        capabilities=[str(c) for c in (raw.get("capabilities") or [])],
        pins=pins,
        raw=raw,
    )


def validate_capabilities(netlist: Netlist, required: list[str], *, adapter_id: str | None = None) -> None:
    if adapter_id and adapter_id != netlist.adapter_id:
        raise ValueError(
            f"Adapter mismatch: run requested {adapter_id!r}, netlist is {netlist.adapter_id!r}"
        )
    missing = [c for c in required if c not in netlist.capabilities]
    if missing:
        raise ValueError(
            f"Adapter {netlist.adapter_id!r} missing capabilities: {missing}"
        )


def channel_for_pin(netlist: Netlist, uut_pin: str) -> str:
    if uut_pin not in netlist.pins:
        raise KeyError(f"Pin {uut_pin!r} not in adapter {netlist.adapter_id}")
    return netlist.pins[uut_pin]
