"""Background plan runner shared by the operator web daemon."""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any, Optional

from ate_platform.device.server import DeviceServer
from ate_platform.paths import REPO_ROOT
from ate_platform.results.store import new_run_id
from ate_platform.sequencer.runner import StepResult, load_plan, planned_steps, run_plan

logger = logging.getLogger("ate_platform.web.run_manager")


class RunManager:
    """At most one active plan run at a time on a shared DeviceServer."""

    def __init__(self, server: DeviceServer, *, out_dir: Path | None = None) -> None:
        self.server = server
        self.out_dir = out_dir or (REPO_ROOT / "results_out")
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._abort = threading.Event()
        self._state: dict[str, Any] = {
            "active": False,
            "run_id": None,
            "verdict": None,
            "operator": None,
            "uut_id": None,
            "adapter_id": None,
            "plan_id": None,
            "plan_path": None,
            "planned": [],
            "current_step_id": None,
            "steps": [],
            "record": None,
            "error": None,
        }

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._state)

    def is_active(self) -> bool:
        with self._lock:
            return bool(self._state["active"])

    def start(
        self,
        plan_path: str | Path,
        *,
        operator: str = "operator",
        uut_id: str = "DUMMY-UUT",
        adapter_id: str = "dummy_ita",
    ) -> dict[str, Any]:
        path = Path(plan_path)
        if not path.is_file():
            candidate = REPO_ROOT / plan_path
            if candidate.is_file():
                path = candidate
            else:
                raise FileNotFoundError(f"Plan not found: {plan_path}")

        with self._lock:
            if self._state["active"]:
                raise RuntimeError("A run is already active")
            if self.server.lock.snapshot().get("held"):
                raise RuntimeError("Control lock already held")
            plan = load_plan(path)
            run_id = new_run_id()
            self._abort.clear()
            self._state = {
                "active": True,
                "run_id": run_id,
                "verdict": "RUNNING",
                "operator": operator,
                "uut_id": uut_id,
                "adapter_id": adapter_id,
                "plan_id": plan.get("id"),
                "plan_path": str(path.resolve()),
                "planned": planned_steps(plan),
                "current_step_id": None,
                "steps": [],
                "record": None,
                "error": None,
            }

        self._thread = threading.Thread(
            target=self._worker,
            args=(path, operator, uut_id, adapter_id, run_id),
            name=f"ate-run-{run_id}",
            daemon=True,
        )
        self._thread.start()
        return self.snapshot()

    def abort(self, run_id: str) -> dict[str, Any]:
        with self._lock:
            if not self._state["active"] or self._state["run_id"] != run_id:
                raise KeyError(f"No active run {run_id}")
            self._abort.set()
            return dict(self._state)

    def _on_step_start(self, sid: str, _name: str) -> None:
        with self._lock:
            self._state["current_step_id"] = sid

    def _on_step(self, sr: StepResult) -> None:
        with self._lock:
            self._state["steps"].append(sr.to_dict())
            self._state["current_step_id"] = None

    def _worker(
        self,
        path: Path,
        operator: str,
        uut_id: str,
        adapter_id: str,
        run_id: str,
    ) -> None:
        try:
            record = run_plan(
                path,
                server=self.server,
                operator=operator,
                uut_id=uut_id,
                adapter_id=adapter_id,
                out_dir=self.out_dir,
                on_step=self._on_step,
                on_step_start=self._on_step_start,
                abort_event=self._abort,
                run_id=run_id,
            )
            with self._lock:
                self._state["active"] = False
                self._state["verdict"] = record.get("verdict")
                self._state["steps"] = list(record.get("steps") or [])
                self._state["current_step_id"] = None
                self._state["record"] = record
        except Exception as exc:
            logger.exception("run failed")
            with self._lock:
                self._state["active"] = False
                self._state["verdict"] = "ERROR"
                self._state["error"] = str(exc)
                self._state["current_step_id"] = None
