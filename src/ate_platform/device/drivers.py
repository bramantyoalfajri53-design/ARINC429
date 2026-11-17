"""Keysight N5746A / AC6803B drivers (LXI/GPIB) with cold-start and sim."""

from __future__ import annotations

import atexit
import logging
import random
import time
from typing import Any, Optional

from ate_platform.device.safety import (
    AC_RANGE_LOW_V,
    DC_OVP_MARGIN_V,
    ac_voltage_range,
    clamp_dc_voltage_to_ovp,
)
from ate_platform.device.visa_link import (
    VISA_AVAILABLE,
    apply_visa_session,
    detect_instrument,
)

try:
    import pyvisa
except ImportError:
    pyvisa = None  # type: ignore

logger = logging.getLogger("ate_platform.drivers")

_ACTIVE: list[Any] = []


def _global_shutdown() -> None:
    for inst in list(_ACTIVE):
        try:
            inst.emergency_shutdown()
        except Exception:
            pass


atexit.register(_global_shutdown)


class DCSupplyDriver:
    def __init__(
        self,
        *,
        resource_name: str,
        model_keyword: str = "N5746",
        lxi_host: str = "",
        visa_explicit: str = "",
        simulation_mode: bool = False,
        voltage_max: float = 40.0,
        current_max: float = 19.0,
        ovp_default: float = 35.0,
        ovp_margin: float = DC_OVP_MARGIN_V,
    ) -> None:
        self.resource_name = resource_name
        self.model_keyword = model_keyword
        self.lxi_host = lxi_host
        self.visa_explicit = visa_explicit
        self.simulation_mode = simulation_mode
        self.inst = None
        self.output_enabled = False
        self.voltage_set = 0.0
        self.current_limit_set = 5.0
        self.ovp_set = ovp_default
        self.ovp_margin = ovp_margin
        self.voltage_max_limit = voltage_max
        self.current_max_limit = current_max
        self.fault_active = False
        self.fault_message = "NORMAL"
        self.idn = ""
        self.connected = False
        self._sim_v = 0.0
        _ACTIVE.append(self)

    def connect(self) -> tuple[bool, str]:
        self.output_enabled = False
        self.voltage_set = 0.0
        self.fault_active = False
        self.fault_message = "NORMAL"
        self._sim_v = 0.0
        if self.simulation_mode or not VISA_AVAILABLE:
            self.simulation_mode = True
            self.connected = True
            self.idn = "Simulated Keysight N5746A"
            return True, self.idn

        try:
            assert pyvisa is not None
            rm = pyvisa.ResourceManager()
            self.resource_name = detect_instrument(
                self.model_keyword,
                explicit=self.visa_explicit,
                lxi_host=self.lxi_host,
                gpib_fallback=self.resource_name,
            )
            self.inst = rm.open_resource(self.resource_name, timeout=4000)
            apply_visa_session(self.inst, self.resource_name, timeout_ms=4000)
            self.inst.write("*CLS")
            self.inst.write("OUTP OFF")
            self.inst.write("VOLT 0.000")
            self.inst.write(f"CURR {self.current_limit_set:.3f}")
            self.inst.write(f"VOLT:PROT {self.ovp_set:.2f}")
            self.idn = self.inst.query("*IDN?").strip()
            self.connected = True
            self.simulation_mode = False
            return True, f"Hardware Online: {self.idn} ({self.resource_name})"
        except Exception as exc:
            self.simulation_mode = True
            self.connected = True
            self.idn = f"Simulated (fallback: {exc})"
            logger.warning("DC connect failed (%s); simulation", exc)
            return False, self.idn

    def set_voltage(self, volts: float) -> None:
        v = max(0.0, min(self.voltage_max_limit, float(volts)))
        limited = clamp_dc_voltage_to_ovp(v, self.ovp_set, self.ovp_margin)
        self.voltage_set = limited
        if self.connected and not self.simulation_mode and self.inst:
            self.inst.write(f"VOLT {self.voltage_set:.3f}")

    def set_current_limit(self, amps: float) -> None:
        self.current_limit_set = max(0.0, min(self.current_max_limit, float(amps)))
        if self.connected and not self.simulation_mode and self.inst:
            self.inst.write(f"CURR {self.current_limit_set:.3f}")

    def set_ovp(self, ovp_volts: float) -> None:
        self.ovp_set = max(1.0, min(45.0, float(ovp_volts)))
        limited = clamp_dc_voltage_to_ovp(self.voltage_set, self.ovp_set, self.ovp_margin)
        if limited < self.voltage_set:
            self.set_voltage(limited)
        if self.connected and not self.simulation_mode and self.inst:
            self.inst.write(f"VOLT:PROT {self.ovp_set:.2f}")

    def set_output(self, enable: bool) -> bool:
        if enable and self.fault_active:
            return False
        if not enable:
            self.output_enabled = False
            if self.connected and not self.simulation_mode and self.inst:
                self.inst.write("OUTP OFF")
            return True
        if self.connected and not self.simulation_mode and self.inst:
            try:
                self.inst.write(f"VOLT:PROT {self.ovp_set:.2f}")
                self.inst.write(f"CURR {self.current_limit_set:.3f}")
                self.inst.write(f"VOLT {self.voltage_set:.3f}")
                self.inst.write("OUTP ON")
            except Exception:
                self.output_enabled = False
                return False
        self.output_enabled = True
        return True

    def read_measurements(self) -> dict[str, Any]:
        if self.simulation_mode or not self.connected:
            if self.output_enabled and not self.fault_active:
                # Snap to setpoint in sim so short settle times in plans are reliable.
                self._sim_v = self.voltage_set
                v = max(0.0, self._sim_v)
                i = min(self.current_limit_set, v / 20.0) if v > 0 else 0.0
            else:
                self._sim_v = 0.0
                v = 0.0
                i = 0.0
            return {
                "voltage": v,
                "current": i,
                "power": v * i,
                "output_on": self.output_enabled,
                "fault": self.fault_active,
                "fault_msg": self.fault_message,
            }
        assert self.inst is not None
        v = float(self.inst.query("MEAS:VOLT?"))
        i = float(self.inst.query("MEAS:CURR?"))
        try:
            self.output_enabled = int(self.inst.query("OUTP?").strip()) == 1
        except Exception:
            pass
        return {
            "voltage": v,
            "current": i,
            "power": v * i,
            "output_on": self.output_enabled,
            "fault": self.fault_active,
            "fault_msg": self.fault_message,
        }

    def emergency_shutdown(self) -> None:
        self.output_enabled = False
        self.voltage_set = 0.0
        if self.connected and not self.simulation_mode and self.inst:
            try:
                self.inst.write("OUTP OFF")
                self.inst.write("VOLT 0.000")
            except Exception:
                pass

    def close(self) -> None:
        self.emergency_shutdown()
        if self.inst:
            try:
                self.inst.close()
            except Exception:
                pass
            self.inst = None


class ACSourceDriver:
    def __init__(
        self,
        *,
        resource_name: str,
        model_keyword: str = "AC680",
        lxi_host: str = "",
        visa_explicit: str = "",
        simulation_mode: bool = False,
        voltage_max: float = 270.0,
        current_max: float = 20.0,
        freq_min: float = 45.0,
        freq_max: float = 500.0,
    ) -> None:
        self.resource_name = resource_name
        self.model_keyword = model_keyword
        self.lxi_host = lxi_host
        self.visa_explicit = visa_explicit
        self.simulation_mode = simulation_mode
        self.inst = None
        self.output_enabled = False
        self.voltage_rms_set = 0.0
        self.frequency_set = 400.0
        self.current_limit_set = 10.0
        self.voltage_max_limit = voltage_max
        self.current_max_limit = current_max
        self.freq_min_limit = freq_min
        self.freq_max_limit = freq_max
        self.fault_active = False
        self.fault_message = "NORMAL"
        self.idn = ""
        self.connected = False
        self._sim_v = 0.0
        _ACTIVE.append(self)

    def connect(self) -> tuple[bool, str]:
        self.output_enabled = False
        self.voltage_rms_set = 0.0
        self.frequency_set = 400.0
        self.fault_active = False
        self.fault_message = "NORMAL"
        self._sim_v = 0.0
        if self.simulation_mode or not VISA_AVAILABLE:
            self.simulation_mode = True
            self.connected = True
            self.idn = "Simulated Keysight AC6803B"
            return True, self.idn

        try:
            assert pyvisa is not None
            rm = pyvisa.ResourceManager()
            self.resource_name = detect_instrument(
                self.model_keyword,
                explicit=self.visa_explicit,
                lxi_host=self.lxi_host,
                gpib_fallback=self.resource_name,
            )
            self.inst = rm.open_resource(self.resource_name, timeout=4000)
            apply_visa_session(self.inst, self.resource_name, timeout_ms=4000)
            self.inst.write("*CLS")
            self.inst.write("OUTP OFF")
            self.inst.write(f"VOLT:RANG {AC_RANGE_LOW_V}")
            self.inst.write("VOLT 0.00")
            self.inst.write(f"FREQ {self.frequency_set:.1f}")
            self.inst.write(f"CURR:LIM {self.current_limit_set:.2f}")
            self.idn = self.inst.query("*IDN?").strip()
            self.connected = True
            self.simulation_mode = False
            return True, f"Hardware Online: {self.idn} ({self.resource_name})"
        except Exception as exc:
            self.simulation_mode = True
            self.connected = True
            self.idn = f"Simulated (fallback: {exc})"
            logger.warning("AC connect failed (%s); simulation", exc)
            return False, self.idn

    def _query_range(self) -> float:
        try:
            assert self.inst is not None
            return float(self.inst.query("VOLT:RANG?").strip())
        except Exception:
            return -1.0

    def _apply_voltage(self, volts_rms: float) -> None:
        assert self.inst is not None
        needed = ac_voltage_range(volts_rms)
        current = self._query_range()
        changing = abs(current - needed) >= 1.0
        if changing and self.output_enabled:
            self.inst.write("OUTP OFF")
            self.output_enabled = False
            time.sleep(0.2)
        if changing:
            if current >= 0 and needed < current:
                self.inst.write(f"VOLT {volts_rms:.2f}")
                self.inst.write(f"VOLT:RANG {needed}")
            else:
                self.inst.write(f"VOLT:RANG {needed}")
            time.sleep(0.2)
        self.inst.write(f"VOLT {volts_rms:.2f}")

    def set_voltage(self, volts_rms: float) -> None:
        self.voltage_rms_set = max(0.0, min(self.voltage_max_limit, float(volts_rms)))
        if self.connected and not self.simulation_mode and self.inst:
            self._apply_voltage(self.voltage_rms_set)

    def set_frequency(self, freq_hz: float) -> None:
        self.frequency_set = max(
            self.freq_min_limit, min(self.freq_max_limit, float(freq_hz))
        )
        if self.connected and not self.simulation_mode and self.inst:
            self.inst.write(f"FREQ {self.frequency_set:.1f}")

    def set_current_limit(self, amps: float) -> None:
        self.current_limit_set = max(0.0, min(self.current_max_limit, float(amps)))
        if self.connected and not self.simulation_mode and self.inst:
            self.inst.write(f"CURR:LIM {self.current_limit_set:.2f}")

    def set_output(self, enable: bool) -> bool:
        if enable and self.fault_active:
            return False
        if not enable:
            self.output_enabled = False
            if self.connected and not self.simulation_mode and self.inst:
                self.inst.write("OUTP OFF")
            return True
        if self.connected and not self.simulation_mode and self.inst:
            try:
                self.inst.write(f"CURR:LIM {self.current_limit_set:.2f}")
                self._apply_voltage(self.voltage_rms_set)
                self.inst.write(f"FREQ {self.frequency_set:.1f}")
                self.inst.write("OUTP ON")
            except Exception:
                self.output_enabled = False
                return False
        self.output_enabled = True
        return True

    def read_measurements(self) -> dict[str, Any]:
        if self.simulation_mode or not self.connected:
            if self.output_enabled and not self.fault_active:
                self._sim_v = self.voltage_rms_set
                v = max(0.0, self._sim_v)
                i = min(self.current_limit_set, v / 50.0) if v > 0 else 0.0
                freq = self.frequency_set
            else:
                self._sim_v = 0.0
                v = 0.0
                i = 0.0
                freq = self.frequency_set
            return {
                "v_rms": v,
                "i_rms": i,
                "frequency": freq,
                "power_watts": v * i * 0.93,
                "output_on": self.output_enabled,
                "fault": self.fault_active,
                "fault_msg": self.fault_message,
            }
        assert self.inst is not None
        v = float(self.inst.query("MEAS:VOLT:AC?"))
        i = float(self.inst.query("MEAS:CURR:AC?"))
        p = float(self.inst.query("MEAS:POW:AC:REAL?"))
        freq = float(self.inst.query("MEAS:FREQ?"))
        try:
            self.output_enabled = int(self.inst.query("OUTP?").strip()) == 1
        except Exception:
            pass
        return {
            "v_rms": v,
            "i_rms": i,
            "frequency": freq,
            "power_watts": p,
            "output_on": self.output_enabled,
            "fault": self.fault_active,
            "fault_msg": self.fault_message,
        }

    def emergency_shutdown(self) -> None:
        self.output_enabled = False
        self.voltage_rms_set = 0.0
        if self.connected and not self.simulation_mode and self.inst:
            try:
                self.inst.write("OUTP OFF")
                self.inst.write("VOLT 0.00")
                self.inst.write(f"VOLT:RANG {AC_RANGE_LOW_V}")
            except Exception:
                pass

    def close(self) -> None:
        self.emergency_shutdown()
        if self.inst:
            try:
                self.inst.close()
            except Exception:
                pass
            self.inst = None
