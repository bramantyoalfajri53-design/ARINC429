"""Station YAML loader."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from ate_platform.paths import REPO_ROOT, env, load_dotenv


@dataclass
class InstrumentSpec:
    id: str
    model: str
    model_keyword: str
    role: str
    lxi_host: str
    visa_explicit: str
    gpib_fallback: str
    voltage_max: float
    current_max: float
    freq_min_hz: float = 45.0
    freq_max_hz: float = 500.0


@dataclass
class StationConfig:
    station_id: str
    name: str
    dc_hv_threshold_v: float
    ac_hv_threshold_vrms: float
    dc_ovp_default_v: float
    dc_ovp_margin_v: float
    instruments: dict[str, InstrumentSpec] = field(default_factory=dict)
    capabilities: dict[str, str] = field(default_factory=dict)  # cap -> instrument id
    raw: dict[str, Any] = field(default_factory=dict)

    def instrument_for_capability(self, capability: str) -> InstrumentSpec:
        inst_id = self.capabilities.get(capability)
        if not inst_id or inst_id not in self.instruments:
            raise KeyError(f"Unknown capability: {capability}")
        return self.instruments[inst_id]


def load_station(path: str | Path | None = None) -> StationConfig:
    load_dotenv()
    station_path = Path(path) if path else (REPO_ROOT / "station" / "ni-ate.yaml")
    if not station_path.is_file():
        raise FileNotFoundError(f"Station config not found: {station_path}")
    raw = yaml.safe_load(station_path.read_text(encoding="utf-8")) or {}
    safety = raw.get("safety") or {}
    instruments: dict[str, InstrumentSpec] = {}
    for iid, spec in (raw.get("instruments") or {}).items():
        instruments[iid] = InstrumentSpec(
            id=iid,
            model=str(spec.get("model", "")),
            model_keyword=str(spec.get("model_keyword", "")),
            role=str(spec.get("role", "")),
            lxi_host=env(str(spec.get("lxi_host_env", "")), ""),
            visa_explicit=env(str(spec.get("visa_env", "")), ""),
            gpib_fallback=str(spec.get("gpib_fallback", "")),
            voltage_max=float(
                spec.get("voltage_max_v", spec.get("voltage_max_vrms", 40.0))
            ),
            current_max=float(spec.get("current_max_a", 19.0)),
            freq_min_hz=float(spec.get("freq_min_hz", 45.0)),
            freq_max_hz=float(spec.get("freq_max_hz", 500.0)),
        )
    caps = {
        name: str(body.get("instrument"))
        for name, body in (raw.get("capabilities") or {}).items()
        if isinstance(body, dict) and body.get("instrument")
    }
    return StationConfig(
        station_id=str(raw.get("station_id", "unknown")),
        name=str(raw.get("name", "")),
        dc_hv_threshold_v=float(safety.get("dc_hv_threshold_v", 35.0)),
        ac_hv_threshold_vrms=float(safety.get("ac_hv_threshold_vrms", 130.0)),
        dc_ovp_default_v=float(safety.get("dc_ovp_default_v", 35.0)),
        dc_ovp_margin_v=float(safety.get("dc_ovp_margin_v", 1.0)),
        instruments=instruments,
        capabilities=caps,
        raw=raw,
    )
