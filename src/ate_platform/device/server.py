"""Single-owner device server: capabilities, lock, safety policy."""

from __future__ import annotations

import logging
import queue
import threading
from typing import Any, Callable, Optional

from ate_platform.device.drivers import ACSourceDriver, DCSupplyDriver
from ate_platform.device.lock import ControlLock
from ate_platform.device.safety import (
    ac_requires_hv_confirm,
    dc_requires_hv_confirm,
    is_zero_off,
    must_drop_output_for_frequency,
    must_drop_output_for_voltage,
)
from ate_platform.paths import force_simulation
from ate_platform.station_model import StationConfig, load_station

logger = logging.getLogger("ate_platform.device")


class HighVoltageConfirmRequired(RuntimeError):
    def __init__(self, kind: str, voltage: float, threshold: float) -> None:
        self.kind = kind
        self.voltage = voltage
        self.threshold = threshold
        super().__init__(
            f"{kind.upper()} output ON at {voltage:.2f} exceeds {threshold:.0f}; "
            "pass confirm_high_voltage=True after operator acknowledge"
        )


class DeviceServer:
    """Queue-serialized access to DC/AC instruments via named capabilities."""

    def __init__(
        self,
        station: StationConfig | None = None,
        *,
        simulation: bool | None = None,
    ) -> None:
        self.station = station or load_station()
        sim = force_simulation() if simulation is None else simulation
        self.lock = ControlLock()
        self._q: queue.Queue = queue.Queue()
        self._thread: Optional[threading.Thread] = None
        self._running = False

        dc_spec = self.station.instruments["dcps"]
        ac_spec = self.station.instruments["acps"]
        self.dc = DCSupplyDriver(
            resource_name=dc_spec.gpib_fallback,
            model_keyword=dc_spec.model_keyword,
            lxi_host=dc_spec.lxi_host,
            visa_explicit=dc_spec.visa_explicit,
            simulation_mode=sim,
            voltage_max=dc_spec.voltage_max,
            current_max=dc_spec.current_max,
            ovp_default=self.station.dc_ovp_default_v,
            ovp_margin=self.station.dc_ovp_margin_v,
        )
        self.ac = ACSourceDriver(
            resource_name=ac_spec.gpib_fallback,
            model_keyword=ac_spec.model_keyword,
            lxi_host=ac_spec.lxi_host,
            visa_explicit=ac_spec.visa_explicit,
            simulation_mode=sim,
            voltage_max=ac_spec.voltage_max,
            current_max=ac_spec.current_max,
            freq_min=ac_spec.freq_min_hz,
            freq_max=ac_spec.freq_max_hz,
        )
        self._dc_msg = "not opened"
        self._ac_msg = "not opened"
        self._dc_ok = False
        self._ac_ok = False

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, name="ate-device", daemon=True)
        self._thread.start()
        self.run("open")

    def stop(self) -> None:
        if not self._running:
            return
        try:
            # Prefer quiet reset_safe on normal shutdown; estop is for emergencies.
            self.run("reset_safe", timeout=5.0)
            self.run("close", timeout=5.0)
        except Exception:
            try:
                self.run("estop", timeout=5.0)
            except Exception:
                pass
        self._running = False
        self._q.put(("__stop__", (), None, None))
        if self._thread:
            self._thread.join(timeout=3.0)

    def run(self, cmd: str, *args: Any, timeout: float = 15.0) -> Any:
        done = threading.Event()
        box: list[Any] = []
        err: list[BaseException] = []
        self._q.put((cmd, args, done, (box, err)))
        if not done.wait(timeout):
            raise TimeoutError(f"Device command {cmd} timed out")
        if err:
            raise err[0]
        return box[0] if box else None

    def acquire(self, label: str = "client") -> str:
        return self.lock.acquire(label)

    def release(self, token: str) -> None:
        self.lock.release(token)

    # --- capability API (requires lock except measure/status/estop) ---

    def dc_apply(
        self,
        token: str,
        *,
        voltage: float | None = None,
        current_limit: float | None = None,
        ovp: float | None = None,
    ) -> None:
        self.lock.require(token)
        self.run("dc_apply", voltage, current_limit, ovp)

    def dc_output(self, token: str, enabled: bool, *, confirm_high_voltage: bool = False) -> None:
        self.lock.require(token)
        self.run("dc_output", enabled, confirm_high_voltage)

    def dc_measure(self) -> dict[str, Any]:
        return self.run("dc_measure")

    def ac_apply(
        self,
        token: str,
        *,
        voltage: float | None = None,
        frequency: float | None = None,
        current_limit: float | None = None,
    ) -> None:
        self.lock.require(token)
        self.run("ac_apply", voltage, frequency, current_limit)

    def ac_output(self, token: str, enabled: bool, *, confirm_high_voltage: bool = False) -> None:
        self.lock.require(token)
        self.run("ac_output", enabled, confirm_high_voltage)

    def ac_measure(self) -> dict[str, Any]:
        return self.run("ac_measure")

    def reset_safe(self, token: Optional[str] = None) -> None:
        """Cold safe: outputs off, setpoints 0. Lock optional (teardown / fail path)."""
        if token is not None:
            self.lock.require(token)
        self.run("reset_safe")

    def estop(self) -> None:
        """Bypasses control lock."""
        self.run("estop")

    def status(self) -> dict[str, Any]:
        return self.run("status")

    def _run(self) -> None:
        while self._running:
            try:
                item = self._q.get(timeout=0.1)
            except queue.Empty:
                continue
            cmd, args, done, payload = item
            if cmd == "__stop__":
                if done:
                    done.set()
                break
            box, err = payload if payload else ([], [])
            try:
                result = self._execute(cmd, args)
                box.append(result)
            except BaseException as exc:
                err.append(exc)
            finally:
                if done:
                    done.set()

    def _execute(self, cmd: str, args: tuple) -> Any:
        if cmd == "open":
            self._dc_ok, self._dc_msg = self.dc.connect()
            self._ac_ok, self._ac_msg = self.ac.connect()
            logger.info("DC: %s", self._dc_msg)
            logger.info("AC: %s", self._ac_msg)
            return {"dc": self._dc_msg, "ac": self._ac_msg}
        if cmd == "close":
            self.dc.close()
            self.ac.close()
            return None
        if cmd == "estop":
            self.dc.emergency_shutdown()
            self.ac.emergency_shutdown()
            logger.error("E-STOP: all outputs off, voltages 0 V")
            return None
        if cmd == "reset_safe":
            self.dc.set_output(False)
            self.ac.set_output(False)
            self.dc.set_voltage(0.0)
            self.ac.set_voltage(0.0)
            return None
        if cmd == "status":
            return {
                "station_id": self.station.station_id,
                "lock": self.lock.snapshot(),
                "dc": {
                    "ok": self._dc_ok,
                    "msg": self._dc_msg,
                    "resource": self.dc.resource_name,
                    "simulation": self.dc.simulation_mode,
                    "set_voltage": self.dc.voltage_set,
                    "output_on": self.dc.output_enabled,
                    "idn": self.dc.idn,
                },
                "ac": {
                    "ok": self._ac_ok,
                    "msg": self._ac_msg,
                    "resource": self.ac.resource_name,
                    "simulation": self.ac.simulation_mode,
                    "set_voltage": self.ac.voltage_rms_set,
                    "set_frequency": self.ac.frequency_set,
                    "output_on": self.ac.output_enabled,
                    "idn": self.ac.idn,
                },
                "capabilities": list(self.station.capabilities.keys()),
            }
        if cmd == "dc_apply":
            voltage, current_limit, ovp = args
            if voltage is not None:
                new_v = float(voltage)
                if must_drop_output_for_voltage(
                    output_on=self.dc.output_enabled,
                    current_v=self.dc.voltage_set,
                    new_v=new_v,
                    hv_threshold=self.station.dc_hv_threshold_v,
                ):
                    self.dc.set_output(False)
                if is_zero_off(new_v) and self.dc.output_enabled:
                    self.dc.set_output(False)
                self.dc.set_voltage(new_v)
            if current_limit is not None:
                self.dc.set_current_limit(float(current_limit))
            if ovp is not None:
                self.dc.set_ovp(float(ovp))
            return None
        if cmd == "dc_output":
            enabled, confirm = args
            if enabled and dc_requires_hv_confirm(
                self.dc.voltage_set, self.station.dc_hv_threshold_v
            ) and not confirm:
                raise HighVoltageConfirmRequired(
                    "dc", self.dc.voltage_set, self.station.dc_hv_threshold_v
                )
            ok = self.dc.set_output(bool(enabled))
            if not ok:
                raise RuntimeError("DC output ON blocked (fault)")
            return None
        if cmd == "dc_measure":
            return self.dc.read_measurements()
        if cmd == "ac_apply":
            voltage, frequency, current_limit = args
            if voltage is not None:
                new_v = float(voltage)
                if must_drop_output_for_voltage(
                    output_on=self.ac.output_enabled,
                    current_v=self.ac.voltage_rms_set,
                    new_v=new_v,
                    hv_threshold=self.station.ac_hv_threshold_vrms,
                ):
                    self.ac.set_output(False)
                if is_zero_off(new_v) and self.ac.output_enabled:
                    self.ac.set_output(False)
                self.ac.set_voltage(new_v)
            if frequency is not None:
                new_f = float(frequency)
                if must_drop_output_for_frequency(
                    output_on=self.ac.output_enabled,
                    current_hz=self.ac.frequency_set,
                    new_hz=new_f,
                ):
                    self.ac.set_output(False)
                self.ac.set_frequency(new_f)
            if current_limit is not None:
                self.ac.set_current_limit(float(current_limit))
            return None
        if cmd == "ac_output":
            enabled, confirm = args
            if enabled and ac_requires_hv_confirm(
                self.ac.voltage_rms_set, self.station.ac_hv_threshold_vrms
            ) and not confirm:
                raise HighVoltageConfirmRequired(
                    "ac", self.ac.voltage_rms_set, self.station.ac_hv_threshold_vrms
                )
            ok = self.ac.set_output(bool(enabled))
            if not ok:
                raise RuntimeError("AC output ON blocked (fault)")
            return None
        if cmd == "ac_measure":
            return self.ac.read_measurements()
        raise ValueError(f"Unknown device command: {cmd}")


class CapabilityFacade:
    """TPS-facing API: only named capabilities, no SCPI."""

    def __init__(self, server: DeviceServer, token: str) -> None:
        self._s = server
        self._token = token

    def dc_apply(self, **kwargs: Any) -> None:
        self._s.dc_apply(self._token, **kwargs)

    def dc_output(self, enabled: bool, *, confirm_high_voltage: bool = False) -> None:
        self._s.dc_output(self._token, enabled, confirm_high_voltage=confirm_high_voltage)

    def dc_measure(self) -> dict[str, Any]:
        return self._s.dc_measure()

    def ac_apply(self, **kwargs: Any) -> None:
        self._s.ac_apply(self._token, **kwargs)

    def ac_output(self, enabled: bool, *, confirm_high_voltage: bool = False) -> None:
        self._s.ac_output(self._token, enabled, confirm_high_voltage=confirm_high_voltage)

    def ac_measure(self) -> dict[str, Any]:
        return self._s.ac_measure()

    def reset_safe(self) -> None:
        self._s.reset_safe(self._token)
