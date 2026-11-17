"""
Single-owner GPIB command/telemetry broker.
HTTP handlers must not talk to VISA directly — enqueue here.
"""

from __future__ import annotations

import logging
import queue
import threading
import time
from collections import deque
from typing import Any, Optional

from ate_power.drivers import ACSourceDriver, DCSupplyDriver
from ate_power.config import (
    AC_HV_THRESHOLD_VRMS,
    AC_LXI_HOST,
    AC_VISA_RESOURCE,
    DC_HV_THRESHOLD_V,
    DC_LXI_HOST,
    DC_VISA_RESOURCE,
    DEFAULT_AC_VISA,
    DEFAULT_DC_VISA,
)
from ate_power.safety import (
    is_zero_off_preset,
    must_drop_output_for_frequency,
    must_drop_output_for_voltage,
)
from ate_power.visa_link import resource_candidates

logger = logging.getLogger("ate_power.broker")

POLL_INTERVAL_S = 0.08
LOG_MAX = 80


class InstrumentBroker:
    def __init__(self, simulation_mode: bool = False) -> None:
        self._cmd_queue: queue.Queue = queue.Queue()
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None

        dc_res = resource_candidates(
            explicit=DC_VISA_RESOURCE, lxi_host=DC_LXI_HOST, gpib_fallback=DEFAULT_DC_VISA
        )[0]
        ac_res = resource_candidates(
            explicit=AC_VISA_RESOURCE, lxi_host=AC_LXI_HOST, gpib_fallback=DEFAULT_AC_VISA
        )[0]
        self.dc = DCSupplyDriver(resource_name=dc_res, simulation_mode=simulation_mode)
        self.ac = ACSourceDriver(resource_name=ac_res, simulation_mode=simulation_mode)

        self._dc_ok = False
        self._dc_msg = "Not connected"
        self._ac_ok = False
        self._ac_msg = "Not connected"
        self._dc_tel: dict[str, Any] = {}
        self._ac_tel: dict[str, Any] = {}
        self._logs: deque[dict[str, str]] = deque(maxlen=LOG_MAX)

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, name="ate-gpib-broker", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        self.submit("SHUTDOWN")
        if self._thread:
            self._thread.join(timeout=3.0)
        try:
            self.dc.close()
        except Exception:
            pass
        try:
            self.ac.close()
        except Exception:
            pass

    def submit(self, cmd_type: str, *args: Any) -> None:
        self._cmd_queue.put((cmd_type, args, None, None))

    def run_cmd(self, cmd_type: str, *args: Any, timeout: float = 8.0) -> None:
        done = threading.Event()
        errors: list[BaseException] = []
        self._cmd_queue.put((cmd_type, args, done, errors))
        if not done.wait(timeout):
            raise TimeoutError(f"Command {cmd_type} timed out")
        if errors:
            raise errors[0]

    def _log(self, message: str, level: str = "INFO") -> None:
        entry = {
            "ts": time.strftime("%H:%M:%S"),
            "level": level,
            "message": message,
        }
        with self._lock:
            self._logs.append(entry)
        logger.log(getattr(logging, level, logging.INFO), message)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            dc = dict(self._dc_tel)
            ac = dict(self._ac_tel)
            logs = list(self._logs)
            dc_ok, dc_msg = self._dc_ok, self._dc_msg
            ac_ok, ac_msg = self._ac_ok, self._ac_msg

        dc.update(
            {
                "set_voltage": self.dc.voltage_set,
                "set_current": self.dc.current_limit_set,
                "set_ovp": self.dc.ovp_set,
                "resource": self.dc.resource_name,
                "simulation": self.dc.simulation_mode,
                "connected_ok": dc_ok,
                "idn": dc_msg,
            }
        )
        ac.update(
            {
                "set_voltage": self.ac.voltage_rms_set,
                "set_frequency": self.ac.frequency_set,
                "set_current": self.ac.current_limit_set,
                "resource": self.ac.resource_name,
                "simulation": self.ac.simulation_mode,
                "connected_ok": ac_ok,
                "idn": ac_msg,
            }
        )
        return {
            "dc": dc,
            "ac": ac,
            "log": logs[-40:],
            "simulation": bool(self.dc.simulation_mode and self.ac.simulation_mode),
            "ts": time.time(),
        }

    def current_dc_set_voltage(self) -> float:
        return float(self.dc.voltage_set)

    def current_ac_set_voltage(self) -> float:
        return float(self.ac.voltage_rms_set)

    def _run(self) -> None:
        logger.info("Instrument broker thread started")
        self._connect()
        last_poll = 0.0
        while self._running:
            try:
                while True:
                    item = self._cmd_queue.get_nowait()
                    cmd_type, args = item[0], item[1]
                    done = item[2] if len(item) > 2 else None
                    errors = item[3] if len(item) > 3 else None
                    try:
                        if cmd_type == "SHUTDOWN":
                            self._running = False
                            break
                        self._execute(cmd_type, args)
                    except Exception as exc:
                        if errors is not None:
                            errors.append(exc)
                        else:
                            raise
                    finally:
                        if done is not None:
                            done.set()
                    if not self._running:
                        break
            except queue.Empty:
                pass
            except Exception as exc:
                logger.exception("Command error: %s", exc)
                self._log(f"Command error: {exc}", "ERROR")

            now = time.time()
            if now - last_poll >= POLL_INTERVAL_S:
                last_poll = now
                self._poll()
            time.sleep(0.01)

        logger.info("Instrument broker stopping; emergency shutdown")
        self.dc.close()
        self.ac.close()

    def _connect(self) -> None:
        self._log("Scanning LXI/GPIB and initializing instruments...", "INFO")
        dc_ok, dc_msg = self.dc.connect()
        ac_ok, ac_msg = self.ac.connect()
        with self._lock:
            self._dc_ok, self._dc_msg = dc_ok, dc_msg
            self._ac_ok, self._ac_msg = ac_ok, ac_msg
        self._log(f"DC Supply: {dc_msg}", "INFO" if dc_ok else "WARN")
        self._log(f"AC Source: {ac_msg}", "INFO" if ac_ok else "WARN")

    def _execute(self, cmd_type: str, args: tuple) -> None:
        if cmd_type == "CONNECT":
            self._connect()
        elif cmd_type == "SET_SIM_MODE":
            enabled = bool(args[0])
            currently_sim = bool(self.dc.simulation_mode and self.ac.simulation_mode)
            if enabled and not currently_sim:
                self.dc.emergency_shutdown()
                self.ac.emergency_shutdown()
            self.dc.simulation_mode = enabled
            self.ac.simulation_mode = enabled
            if enabled:
                self.dc.connected = True
                self.ac.connected = True
                mode = "SIMULATION"
                self._log(f"Operating mode: {mode} (hardware outputs forced OFF)", "WARN")
            else:
                self._log("Operating mode: HARDWARE (LXI/GPIB) — cold-start reconnect", "INFO")
                self._connect()
        elif cmd_type == "DC_SET_VOLT":
            new_v = float(args[0])
            if must_drop_output_for_voltage(
                output_on=self.dc.output_enabled,
                current_v=self.dc.voltage_set,
                new_v=new_v,
                hv_threshold=DC_HV_THRESHOLD_V,
            ):
                self.dc.set_output(False)
                self._log(
                    "DCPS output dropped before HV setpoint (live crossing of "
                    f"{DC_HV_THRESHOLD_V:.0f} V requires a new ON + confirm)",
                    "WARN",
                )
            if is_zero_off_preset(new_v) and self.dc.output_enabled:
                self.dc.set_output(False)
                self._log("DCPS output dropped (0 V Off preset)", "INFO")
            self.dc.set_voltage(new_v)
            self._log(f"DCPS target voltage: {self.dc.voltage_set:.2f} V", "INFO")
        elif cmd_type == "DC_SET_CURR":
            self.dc.set_current_limit(args[0])
            self._log(f"DCPS current limit: {args[0]:.2f} A", "INFO")
        elif cmd_type == "DC_SET_OVP":
            self.dc.set_ovp(args[0])
            self._log(f"DCPS OVP: {args[0]:.1f} V", "INFO")
        elif cmd_type == "DC_SET_OUTP":
            ok = self.dc.set_output(args[0])
            if not ok:
                self._log("DCPS output ON blocked (fault active)", "ERROR")
                return
            self._log(f"DCPS OUTPUT: {'ON' if args[0] else 'OFF'}", "WARN" if args[0] else "INFO")
        elif cmd_type == "AC_SET_VOLT":
            new_v = float(args[0])
            if must_drop_output_for_voltage(
                output_on=self.ac.output_enabled,
                current_v=self.ac.voltage_rms_set,
                new_v=new_v,
                hv_threshold=AC_HV_THRESHOLD_VRMS,
            ):
                self.ac.set_output(False)
                self._log(
                    "ACPS output dropped before HV setpoint (live crossing of "
                    f"{AC_HV_THRESHOLD_VRMS:.0f} Vrms requires a new ON + confirm)",
                    "WARN",
                )
            if is_zero_off_preset(new_v) and self.ac.output_enabled:
                self.ac.set_output(False)
                self._log("ACPS output dropped (0 V Off preset)", "INFO")
            self.ac.set_voltage(new_v)
            self._log(f"ACPS target voltage: {self.ac.voltage_rms_set:.1f} Vrms", "INFO")
        elif cmd_type == "AC_SET_FREQ":
            new_f = float(args[0])
            if must_drop_output_for_frequency(
                output_on=self.ac.output_enabled,
                current_hz=self.ac.frequency_set,
                new_hz=new_f,
            ):
                self.ac.set_output(False)
                self._log(
                    "ACPS output dropped before frequency-band change "
                    "(mains vs 400 Hz avionics must not switch while live)",
                    "WARN",
                )
            self.ac.set_frequency(new_f)
            self._log(f"ACPS frequency: {self.ac.frequency_set:.1f} Hz", "INFO")
        elif cmd_type == "AC_SET_CURR":
            self.ac.set_current_limit(args[0])
            self._log(f"ACPS current limit: {args[0]:.1f} Arms", "INFO")
        elif cmd_type == "AC_SET_OUTP":
            ok = self.ac.set_output(args[0])
            if not ok:
                self._log("ACPS output ON blocked (fault active)", "ERROR")
                return
            self._log(f"ACPS OUTPUT: {'ON' if args[0] else 'OFF'}", "WARN" if args[0] else "INFO")
        elif cmd_type == "EMERGENCY_STOP":
            self.dc.emergency_shutdown()
            self.ac.emergency_shutdown()
            self._log("EMERGENCY STOP: all outputs off, voltage reset to 0 V", "ERROR")

    def _poll(self) -> None:
        if not self._cmd_queue.empty():
            return
        try:
            dc_m = self.dc.read_measurements()
            with self._lock:
                self._dc_tel = dc_m
            if dc_m.get("fault"):
                self._log(f"DCPS fault: {dc_m.get('fault_msg', 'TRIP')}", "ERROR")
        except Exception as exc:
            logger.debug("DC poll error: %s", exc)

        try:
            ac_m = self.ac.read_measurements()
            with self._lock:
                self._ac_tel = ac_m
            if ac_m.get("fault"):
                self._log(f"ACPS fault: {ac_m.get('fault_msg', 'TRIP')}", "ERROR")
        except Exception as exc:
            logger.debug("AC poll error: %s", exc)
