"""
ATE Power Instrumentation Drivers (SCPI / VISA & Simulation Engine)
Supports:
1. Keysight N5746A (System DC Power Supply: 40V, 19A, 760W) @ LXI 10.11.11.11 (GPIB cadangan)
2. Keysight AC6803B (AC Power Source: 2000VA, 135V/270V, 45-500Hz) @ LXI 10.11.11.12 (GPIB cadangan)
Includes LXI/GPIB auto-detect & fault interlocks.
"""

import time
import atexit
import random
import logging

from ate_power.safety import (
    AC_RANGE_LOW_V,
    DC_OVP_MARGIN_V,
    ac_voltage_range,
    clamp_dc_voltage_to_ovp,
)
from ate_power.visa_link import (
    VISA_AVAILABLE,
    apply_visa_session,
    detect_ac_resource,
    detect_dc_resource,
    detect_instrument,
)

try:
    import pyvisa
except ImportError:
    pyvisa = None  # type: ignore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

_ACTIVE_INSTRUMENTS = []


def _global_safety_shutdown():
    """Emergency cleanup callback on process termination"""
    for inst in _ACTIVE_INSTRUMENTS:
        try:
            inst.emergency_shutdown()
        except Exception:
            pass


atexit.register(_global_safety_shutdown)


def auto_detect_gpib_instrument(model_keyword="AC680", default_resource="GPIB0::7::INSTR"):
    """Back-compat wrapper: detect LXI (LAN) first, then GPIB."""
    return detect_instrument(model_keyword, gpib_fallback=default_resource)


class DCSupplyDriver:
    """
    Driver untuk Keysight N5746A System DC Power Supply (40V / 19A, 760W)
    Default Address: LXI (ATE_DC_LXI_HOST) / GPIB0::5::INSTR cadangan
    """

    def __init__(self, resource_name="GPIB0::5::INSTR", simulation_mode=False):
        self.resource_name = resource_name
        self.simulation_mode = simulation_mode
        self.inst = None
        self.output_enabled = False
        
        # State Setpoints & Safety Limits
        self.voltage_set = 0.0
        self.current_limit_set = 5.0
        self.ovp_set = 35.0
        self.voltage_max_limit = 40.0
        self.current_max_limit = 19.0
        
        # Fault Flags
        self.fault_active = False
        self.fault_message = "NORMAL"
        
        self._sim_v = 0.0
        self._sim_i = 0.0
        self.connected = False
        
        _ACTIVE_INSTRUMENTS.append(self)

    def _cold_start_state(self) -> None:
        self.output_enabled = False
        self.voltage_set = 0.0
        self.current_limit_set = 5.0
        self.ovp_set = 35.0
        self.fault_active = False
        self.fault_message = "NORMAL"
        self._sim_v = 0.0
        self._sim_i = 0.0

    def connect(self):
        self._cold_start_state()
        if self.simulation_mode or not VISA_AVAILABLE:
            self.simulation_mode = True
            self.connected = True
            logging.info(f"DC Supply ({self.resource_name}) connected in SIMULATION MODE.")
            return True, "Simulated Keysight N5746A (Virtual Mode)"

        try:
            rm = pyvisa.ResourceManager()
            detected_res = detect_dc_resource()
            self.resource_name = detected_res

            self.inst = rm.open_resource(self.resource_name, timeout=4000)
            apply_visa_session(self.inst, self.resource_name, timeout_ms=4000)
            
            # --- SAFETY INITIALIZATION SEQUENCE ---
            self.inst.write("*CLS")
            self.inst.write("OUTP OFF")
            self.inst.write("VOLT 0.000")
            self.inst.write(f"CURR {self.current_limit_set:.3f}")
            self.inst.write(f"VOLT:PROT {self.ovp_set:.2f}")
            
            idn = self.inst.query("*IDN?").strip()
            self.connected = True
            self.simulation_mode = False
            logging.info(f"DC Supply ({self.resource_name}) Hardware Online: {idn}")
            return True, f"Hardware Online: {idn} ({self.resource_name})"
        except Exception as e:
            logging.warning(f"Gagal koneksi ke hardware {self.resource_name}: {e}. Beralih ke mode simulasi.")
            self.simulation_mode = True
            self.connected = True
            return False, f"Hardware tidak terdeteksi ({e}). Menggunakan mode simulasi."

    def set_voltage(self, volts: float):
        v_clamped = max(0.0, min(self.voltage_max_limit, float(volts)))
        limited = clamp_dc_voltage_to_ovp(v_clamped, self.ovp_set)
        if limited < v_clamped:
            logging.warning(
                f"DC voltage {v_clamped:.3f} V clamped to {limited:.3f} V "
                f"(OVP {self.ovp_set:.2f} V − {DC_OVP_MARGIN_V:.0f} V margin). "
                "Raise hardware OVP explicitly if a higher setpoint is required."
            )
        self.voltage_set = limited
        if self.connected and not self.simulation_mode:
            try:
                self.inst.write(f"VOLT {self.voltage_set:.3f}")
            except Exception as e:
                logging.error(f"Error set DC voltage: {e}")

    def set_current_limit(self, amps: float):
        i_clamped = max(0.0, min(self.current_max_limit, float(amps)))
        self.current_limit_set = i_clamped
        if self.connected and not self.simulation_mode:
            try:
                self.inst.write(f"CURR {self.current_limit_set:.3f}")
            except Exception as e:
                logging.error(f"Error set DC current limit: {e}")

    def set_ovp(self, ovp_volts: float):
        ovp_clamped = max(1.0, min(45.0, float(ovp_volts)))
        self.ovp_set = ovp_clamped
        limited = clamp_dc_voltage_to_ovp(self.voltage_set, self.ovp_set)
        if limited < self.voltage_set:
            self.set_voltage(limited)
        if self.connected and not self.simulation_mode:
            try:
                self.inst.write(f"VOLT:PROT {self.ovp_set:.2f}")
            except Exception as e:
                logging.error(f"Error set OVP: {e}")

    def set_output(self, enable: bool):
        if enable and self.fault_active:
            logging.error("Gagal mengaktifkan output: Status FAULT aktif pada instrumen.")
            return False

        if not enable:
            self.output_enabled = False
            if self.connected and not self.simulation_mode:
                try:
                    self.inst.write("OUTP OFF")
                    logging.info(f"DC Supply ({self.resource_name}) -> OUTP OFF")
                except Exception as e:
                    logging.error(f"Error set DC output state: {e}")
            return True

        if self.connected and not self.simulation_mode:
            try:
                self.inst.write(f"VOLT:PROT {self.ovp_set:.2f}")
                self.inst.write(f"CURR {self.current_limit_set:.3f}")
                self.inst.write(f"VOLT {self.voltage_set:.3f}")
                self.inst.write("OUTP ON")
                logging.info(f"DC Supply ({self.resource_name}) -> OUTP ON")
            except Exception as e:
                logging.error(f"Error set DC output state: {e}")
                self.output_enabled = False
                return False
        self.output_enabled = True
        return True

    def read_measurements(self):
        if self.simulation_mode or not self.connected:
            if self.output_enabled and not self.fault_active:
                target_v = self.voltage_set
                self._sim_v += (target_v - self._sim_v) * 0.4
                noise_v = (random.random() - 0.5) * 0.02
                v_out = max(0.0, self._sim_v + noise_v)
                
                if v_out > self.ovp_set:
                    self.fault_active = True
                    self.fault_message = "OVP TRIP (Over-Voltage)"
                    self.output_enabled = False
                    v_out = 0.0
                    i_out = 0.0
                else:
                    load_resistance = 20.0
                    calc_i = v_out / load_resistance
                    i_out = min(self.current_limit_set, calc_i) + (random.random() - 0.5) * 0.005
                    i_out = max(0.0, i_out)
            else:
                self._sim_v *= 0.3
                v_out = max(0.0, self._sim_v)
                i_out = 0.0

            return {
                "voltage": v_out,
                "current": i_out,
                "power": v_out * i_out,
                "output_on": self.output_enabled,
                "fault": self.fault_active,
                "fault_msg": self.fault_message,
                "status": "CV" if i_out < self.current_limit_set else "CC"
            }

        try:
            v_act = float(self.inst.query("MEAS:VOLT?"))
            i_act = float(self.inst.query("MEAS:CURR?"))
            
            try:
                outp_state = int(self.inst.query("OUTP?").strip())
                self.output_enabled = (outp_state == 1)
            except Exception:
                pass

            return {
                "voltage": v_act,
                "current": i_act,
                "power": v_act * i_act,
                "output_on": self.output_enabled,
                "fault": self.fault_active,
                "fault_msg": self.fault_message,
                "status": "ONLINE"
            }
        except Exception:
            return {
                "voltage": 0.0,
                "current": 0.0,
                "power": 0.0,
                "output_on": False,
                "fault": True,
                "fault_msg": "TIMEOUT",
                "status": "ERROR"
            }

    def emergency_shutdown(self):
        self.output_enabled = False
        self.voltage_set = 0.0
        if self.connected and not self.simulation_mode:
            try:
                self.inst.write("OUTP OFF")
                self.inst.write("VOLT 0.000")
            except Exception:
                pass

    def close(self):
        self.emergency_shutdown()
        if self.inst:
            try:
                self.inst.close()
            except Exception:
                pass


class ACSourceDriver:
    """
    Driver untuk Keysight AC6803B Basic AC Power Source (2000VA, 135V/270V, 45-500Hz)
    Hardware Address: LXI (ATE_AC_LXI_HOST) / GPIB0::7::INSTR cadangan
    """

    def __init__(self, resource_name="GPIB0::7::INSTR", simulation_mode=False):
        self.resource_name = resource_name
        self.simulation_mode = simulation_mode
        self.inst = None
        self.output_enabled = False
        
        # State Setpoints & Safety Limits
        self.voltage_rms_set = 0.0
        self.frequency_set = 400.0    # Default 400 Hz (Standar avionik DO-160)
        self.current_limit_set = 10.0
        self.voltage_max_limit = 270.0
        self.freq_min_limit = 45.0
        self.freq_max_limit = 500.0
        
        # Fault Flags
        self.fault_active = False
        self.fault_message = "NORMAL"
        
        self._sim_v = 0.0
        self.connected = False
        
        _ACTIVE_INSTRUMENTS.append(self)

    def _cold_start_state(self) -> None:
        self.output_enabled = False
        self.voltage_rms_set = 0.0
        self.frequency_set = 400.0
        self.current_limit_set = 10.0
        self.fault_active = False
        self.fault_message = "NORMAL"
        self._sim_v = 0.0

    def connect(self):
        self._cold_start_state()
        if self.simulation_mode or not VISA_AVAILABLE:
            self.simulation_mode = True
            self.connected = True
            logging.info(f"AC Source ({self.resource_name}) connected in SIMULATION MODE.")
            return True, "Simulated Keysight AC6803B (Virtual Mode)"

        try:
            rm = pyvisa.ResourceManager()
            detected_res = detect_ac_resource()
            self.resource_name = detected_res

            self.inst = rm.open_resource(self.resource_name, timeout=4000)
            apply_visa_session(self.inst, self.resource_name, timeout_ms=4000)
            
            # --- SAFETY INITIALIZATION SEQUENCE ---
            self.inst.write("*CLS")
            self.inst.write("OUTP OFF")
            self.inst.write(f"VOLT:RANG {AC_RANGE_LOW_V}")
            self.inst.write("VOLT 0.00")
            self.inst.write(f"FREQ {self.frequency_set:.1f}")
            self.inst.write(f"CURR:LIM {self.current_limit_set:.2f}")
            
            idn = self.inst.query("*IDN?").strip()
            self.connected = True
            self.simulation_mode = False
            logging.info(f"AC Source ({self.resource_name}) Hardware Online: {idn}")
            return True, f"Hardware Online: {idn} ({self.resource_name})"
        except Exception as e:
            logging.warning(f"Gagal koneksi ke hardware {self.resource_name}: {e}. Beralih ke mode simulasi.")
            self.simulation_mode = True
            self.connected = True
            return False, f"Hardware tidak terdeteksi ({e}). Menggunakan mode simulasi."

    def _query_ac_range(self) -> float:
        try:
            raw = self.inst.query("VOLT:RANG?").strip()
            return float(raw)
        except Exception:
            return -1.0

    def _apply_ac_voltage(self, volts_rms: float) -> None:
        needed = ac_voltage_range(volts_rms)
        current = self._query_ac_range()
        changing = abs(current - needed) >= 1.0
        if changing and self.output_enabled:
            # Range cannot change while output is on; instrument would shut output off anyway.
            self.inst.write("OUTP OFF")
            self.output_enabled = False
            time.sleep(0.2)
            logging.warning("AC output dropped to change voltage range (Keysight AC6803B requirement).")
        if changing:
            if current >= 0 and needed < current:
                # Lower the setpoint first so switching to 135 V does not force 0 V.
                self.inst.write(f"VOLT {volts_rms:.2f}")
                self.inst.write(f"VOLT:RANG {needed}")
            else:
                self.inst.write(f"VOLT:RANG {needed}")
            time.sleep(0.2)
        self.inst.write(f"VOLT {volts_rms:.2f}")
        try:
            err = self.inst.query("SYST:ERR?").strip()
            if err and not err.startswith("0"):
                logging.error(f"AC Source SCPI error after VOLT {volts_rms}: {err}")
        except Exception:
            pass

    def set_voltage(self, volts_rms: float):
        v_clamped = max(0.0, min(self.voltage_max_limit, float(volts_rms)))
        self.voltage_rms_set = v_clamped
        
        if self.connected and not self.simulation_mode:
            try:
                self._apply_ac_voltage(self.voltage_rms_set)
                logging.info(
                    f"AC Source ({self.resource_name}) -> VOLT {self.voltage_rms_set:.2f} "
                    f"(range {ac_voltage_range(self.voltage_rms_set)} V)"
                )
            except Exception as e:
                logging.error(f"Error set AC voltage: {e}")

    def set_frequency(self, freq_hz: float):
        f_clamped = max(self.freq_min_limit, min(self.freq_max_limit, float(freq_hz)))
        self.frequency_set = f_clamped
        if self.connected and not self.simulation_mode:
            try:
                self.inst.write(f"FREQ {self.frequency_set:.1f}")
                logging.info(f"AC Source ({self.resource_name}) -> FREQ {self.frequency_set:.1f}")
            except Exception as e:
                logging.error(f"Error set AC frequency: {e}")

    def set_current_limit(self, amps_rms: float):
        i_clamped = max(0.0, min(20.0, float(amps_rms)))
        self.current_limit_set = i_clamped
        if self.connected and not self.simulation_mode:
            try:
                self.inst.write(f"CURR:LIM {self.current_limit_set:.2f}")
            except Exception as e:
                logging.error(f"Error set AC current limit: {e}")

    def set_output(self, enable: bool):
        if enable and self.fault_active:
            logging.error("Gagal mengaktifkan output: Status FAULT aktif pada AC Power Source.")
            return False

        if not enable:
            self.output_enabled = False
            if self.connected and not self.simulation_mode:
                try:
                    self.inst.write("OUTP OFF")
                    logging.info(f"AC Source ({self.resource_name}) -> OUTP OFF")
                except Exception as e:
                    logging.error(f"Error set AC output state: {e}")
            return True

        if self.connected and not self.simulation_mode:
            try:
                self.inst.write(f"CURR:LIM {self.current_limit_set:.2f}")
                self._apply_ac_voltage(self.voltage_rms_set)
                self.inst.write(f"FREQ {self.frequency_set:.1f}")
                self.inst.write("OUTP ON")
                logging.info(f"AC Source ({self.resource_name}) -> OUTP ON")
            except Exception as e:
                logging.error(f"Error set AC output state: {e}")
                self.output_enabled = False
                return False
        self.output_enabled = True
        return True

    def read_measurements(self):
        if self.simulation_mode or not self.connected:
            if self.output_enabled and not self.fault_active:
                target_v = self.voltage_rms_set
                self._sim_v += (target_v - self._sim_v) * 0.35
                v_out = max(0.0, self._sim_v + (random.random() - 0.5) * 0.1)
                
                load_z = 50.0
                i_out = (v_out / load_z) + (random.random() - 0.5) * 0.01
                i_out = max(0.0, min(self.current_limit_set, i_out))
                pf = 0.93 + (random.random() - 0.5) * 0.02
                p_va = v_out * i_out
                p_w = p_va * pf
                i_peak = i_out * 1.414
                freq = self.frequency_set + (random.random() - 0.5) * 0.05
            else:
                self._sim_v *= 0.3
                v_out = max(0.0, self._sim_v)
                i_out = 0.0
                p_w = 0.0
                p_va = 0.0
                pf = 1.0
                i_peak = 0.0
                freq = self.frequency_set

            return {
                "v_rms": v_out,
                "i_rms": i_out,
                "i_peak": i_peak,
                "power_watts": p_w,
                "power_va": p_va,
                "power_factor": pf,
                "frequency": freq,
                "output_on": self.output_enabled,
                "fault": self.fault_active,
                "fault_msg": self.fault_message
            }

        try:
            v_rms = float(self.inst.query("MEAS:VOLT:AC?"))
            i_rms = float(self.inst.query("MEAS:CURR:AC?"))
            p_real = float(self.inst.query("MEAS:POW:AC:REAL?"))
            p_apparent = float(self.inst.query("MEAS:POW:AC:APP?"))
            
            pf = (p_real / p_apparent) if p_apparent > 0.5 else 1.0
            freq = float(self.inst.query("MEAS:FREQ?"))
            
            try:
                outp_state = int(self.inst.query("OUTP?").strip())
                self.output_enabled = (outp_state == 1)
            except Exception:
                pass

            return {
                "v_rms": v_rms,
                "i_rms": i_rms,
                "i_peak": i_rms * 1.414,
                "power_watts": p_real,
                "power_va": p_apparent,
                "power_factor": min(1.0, max(0.0, pf)),
                "frequency": freq,
                "output_on": self.output_enabled,
                "fault": self.fault_active,
                "fault_msg": self.fault_message
            }
        except Exception:
            return {
                "v_rms": 0.0,
                "i_rms": 0.0,
                "i_peak": 0.0,
                "power_watts": 0.0,
                "power_va": 0.0,
                "power_factor": 1.0,
                "frequency": self.frequency_set,
                "output_on": False,
                "fault": True,
                "fault_msg": "TIMEOUT"
            }

    def emergency_shutdown(self):
        self.output_enabled = False
        self.voltage_rms_set = 0.0
        if self.connected and not self.simulation_mode:
            try:
                self.inst.write("OUTP OFF")
                self.inst.write("VOLT 0.00")
                self.inst.write(f"VOLT:RANG {AC_RANGE_LOW_V}")
            except Exception:
                pass

    def close(self):
        self.emergency_shutdown()
        if self.inst:
            try:
                self.inst.close()
            except Exception:
                pass
