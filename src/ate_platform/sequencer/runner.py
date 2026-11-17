"""Thin YAML test sequencer with mandatory power teardown."""

from __future__ import annotations

import importlib
import logging
import threading
import time
import traceback
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Optional

import yaml

from ate_platform.device.server import CapabilityFacade, DeviceServer
from ate_platform.paths import REPO_ROOT
from ate_platform.results.store import new_run_id, plan_hash, write_run
from ate_platform.sequencer.limits import LimitError, expect_hz, expect_v
from ate_platform.wiring.netlist import load_netlist, validate_capabilities

logger = logging.getLogger("ate_platform.sequencer")


class Verdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    ERROR = "ERROR"
    ABORT = "ABORT"
    SKIP = "SKIP"


@dataclass
class StepResult:
    id: str
    name: str
    verdict: Verdict
    detail: str = ""
    measurements: dict[str, Any] = field(default_factory=dict)
    duration_s: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["verdict"] = self.verdict.value
        return d


def planned_steps(plan: dict[str, Any]) -> list[dict[str, str]]:
    """Pre-register step id/name for UI queued/running display."""
    out: list[dict[str, str]] = []
    for raw in plan.get("steps") or []:
        sid = str(raw.get("id", raw.get("action", "step")))
        out.append({"id": sid, "name": str(raw.get("name", sid))})
    return out


def load_plan(path: str | Path) -> dict[str, Any]:
    p = Path(path)
    data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    data["_path"] = str(p.resolve())
    return data


def _builtin_steps(caps: CapabilityFacade, ctx: dict[str, Any]) -> dict[str, Callable]:
    def setup(**_kwargs: Any) -> dict[str, Any]:
        caps.reset_safe()
        return {"action": "reset_safe"}

    def teardown(**_kwargs: Any) -> dict[str, Any]:
        caps.reset_safe()
        return {"action": "reset_safe"}

    def dc_apply(
        voltage: float = 0.0,
        current_limit: float = 5.0,
        ovp: float | None = None,
        **_kwargs: Any,
    ) -> dict[str, Any]:
        kw: dict[str, Any] = {"voltage": voltage, "current_limit": current_limit}
        if ovp is not None:
            kw["ovp"] = ovp
        caps.dc_apply(**kw)
        return {"set_voltage": voltage, "current_limit": current_limit}

    def dc_output(enabled: bool = False, confirm_high_voltage: bool = False, **_kwargs: Any) -> dict:
        caps.dc_output(enabled, confirm_high_voltage=confirm_high_voltage)
        return {"output_on": enabled}

    def dc_measure_expect(
        nominal_v: float = 28.0,
        tol_v: float = 0.5,
        settle_s: float = 0.3,
        **_kwargs: Any,
    ) -> dict[str, Any]:
        time.sleep(settle_s)
        m = caps.dc_measure()
        expect_v(float(m["voltage"]), nominal_v, tol_v, name="DC V")
        return m

    def ac_apply(
        voltage: float = 0.0,
        frequency: float = 400.0,
        current_limit: float = 10.0,
        **_kwargs: Any,
    ) -> dict[str, Any]:
        caps.ac_apply(voltage=voltage, frequency=frequency, current_limit=current_limit)
        return {"set_voltage": voltage, "frequency": frequency}

    def ac_output(enabled: bool = False, confirm_high_voltage: bool = False, **_kwargs: Any) -> dict:
        caps.ac_output(enabled, confirm_high_voltage=confirm_high_voltage)
        return {"output_on": enabled}

    def ac_measure_expect(
        nominal_v: float = 115.0,
        tol_v: float = 2.0,
        nominal_hz: float = 400.0,
        tol_hz: float = 5.0,
        settle_s: float = 0.4,
        **_kwargs: Any,
    ) -> dict[str, Any]:
        time.sleep(settle_s)
        m = caps.ac_measure()
        expect_v(float(m["v_rms"]), nominal_v, tol_v, name="AC Vrms")
        expect_hz(float(m["frequency"]), nominal_hz, tol_hz, name="AC Hz")
        return m

    def fail_intentional(message: str = "intentional fail", **_kwargs: Any) -> dict[str, Any]:
        raise LimitError(message)

    def plugin_call(module: str, function: str = "run", **kwargs: Any) -> dict[str, Any]:
        mod = importlib.import_module(module)
        fn = getattr(mod, function)
        result = fn(caps, ctx, **kwargs)
        return result if isinstance(result, dict) else {"result": result}

    return {
        "setup": setup,
        "teardown": teardown,
        "dc_apply": dc_apply,
        "dc_output": dc_output,
        "dc_measure_expect": dc_measure_expect,
        "ac_apply": ac_apply,
        "ac_output": ac_output,
        "ac_measure_expect": ac_measure_expect,
        "fail_intentional": fail_intentional,
        "plugin": plugin_call,
    }


def run_plan(
    plan_path: str | Path,
    *,
    station_path: str | Path | None = None,
    simulation: bool | None = None,
    operator: str = "operator",
    uut_id: str = "DUMMY-UUT",
    adapter_id: str = "dummy_ita",
    out_dir: Path | None = None,
    stop_on_fail: bool = True,
    server: DeviceServer | None = None,
    on_step: Callable[[StepResult], None] | None = None,
    on_step_start: Callable[[str, str], None] | None = None,
    abort_event: threading.Event | None = None,
    run_id: str | None = None,
) -> dict[str, Any]:
    """Execute a plan YAML.

    If ``server`` is omitted, a temporary DeviceServer is started and stopped.
    If ``server`` is provided (daemon), this function acquires/releases the lock
    and calls reset_safe but does **not** stop the server.
    """
    import sys

    from ate_platform.station_model import load_station

    plugins_dir = str(REPO_ROOT / "plugins")
    if plugins_dir not in sys.path:
        sys.path.insert(0, plugins_dir)

    plan = load_plan(plan_path)
    plan_file = Path(plan["_path"])
    owns_server = server is None
    if owns_server:
        station = load_station(station_path)
        server = DeviceServer(station, simulation=simulation)
        server.start()
    else:
        assert server is not None
        station = server.station

    netlist_path = plan.get("netlist") or "netlist/dummy_ita.yaml"
    netlist = load_netlist(REPO_ROOT / netlist_path if not Path(netlist_path).is_file() else netlist_path)

    required_caps = list(plan.get("required_capabilities") or station.capabilities.keys())
    validate_capabilities(netlist, required_caps, adapter_id=adapter_id)

    token = server.acquire(label=f"run:{plan.get('id', 'plan')}")
    caps = CapabilityFacade(server, token)

    ctx: dict[str, Any] = {
        "uut_id": uut_id,
        "adapter_id": adapter_id,
        "operator": operator,
        "netlist": netlist,
        "plan": plan,
    }
    builtins = _builtin_steps(caps, ctx)
    step_results: list[StepResult] = []
    overall = Verdict.PASS
    rid = run_id or new_run_id()

    try:
        for raw in plan.get("steps") or []:
            if abort_event is not None and abort_event.is_set():
                overall = Verdict.ABORT
                break
            sid = str(raw.get("id", raw.get("action", "step")))
            name = str(raw.get("name", sid))
            action = str(raw.get("action"))
            params = dict(raw.get("params") or {})
            if on_step_start is not None:
                try:
                    on_step_start(sid, name)
                except Exception:
                    logger.exception("on_step_start failed")
            t0 = time.time()
            try:
                if action not in builtins:
                    raise KeyError(f"Unknown action: {action}")
                measurements = builtins[action](**params) or {}
                sr = StepResult(
                    id=sid,
                    name=name,
                    verdict=Verdict.PASS,
                    measurements=measurements,
                    duration_s=round(time.time() - t0, 3),
                )
            except LimitError as exc:
                sr = StepResult(
                    id=sid,
                    name=name,
                    verdict=Verdict.FAIL,
                    detail=str(exc),
                    duration_s=round(time.time() - t0, 3),
                )
                overall = Verdict.FAIL
            except Exception as exc:
                sr = StepResult(
                    id=sid,
                    name=name,
                    verdict=Verdict.ERROR,
                    detail=f"{exc}\n{traceback.format_exc()}",
                    duration_s=round(time.time() - t0, 3),
                )
                overall = Verdict.ERROR
            step_results.append(sr)
            if on_step is not None:
                try:
                    on_step(sr)
                except Exception:
                    logger.exception("on_step failed")
            logger.info("[%s] %s %s", sr.verdict.value, sid, sr.detail or "")
            if sr.verdict in {Verdict.FAIL, Verdict.ERROR} and stop_on_fail:
                break
            if abort_event is not None and abort_event.is_set():
                overall = Verdict.ABORT
                break
    finally:
        # Mandatory teardown — even if lock/steps exploded.
        try:
            server.reset_safe()
        except Exception as exc:
            logger.error("reset_safe failed: %s", exc)
            overall = Verdict.ABORT if overall == Verdict.PASS else overall
        try:
            server.release(token)
        except Exception:
            pass
        if owns_server:
            server.stop()

    record = {
        "run_id": rid,
        "verdict": overall.value,
        "operator": operator,
        "uut_id": uut_id,
        "adapter_id": adapter_id,
        "station_id": station.station_id,
        "plan_id": plan.get("id"),
        "plan_path": str(plan_file),
        "plan_hash": plan_hash(plan_file),
        "steps": [s.to_dict() for s in step_results],
    }
    path = write_run(record, out_dir=out_dir)
    record["result_path"] = str(path)
    return record
