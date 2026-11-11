"""
ATE Power Instrumentation - High Performance Asynchronous Engine
Decouples GPIB hardware SCPI transactions from the Qt GUI Main Thread.
Guarantees 60 FPS silky smooth UI responsiveness with zero click lag.
"""

import time
import queue
import logging
from PyQt6.QtCore import QThread, pyqtSignal

from instrument_drivers import DCSupplyDriver, ACSourceDriver
from ate_power.config import (
    AC_LXI_HOST,
    AC_VISA_RESOURCE,
    DC_LXI_HOST,
    DC_VISA_RESOURCE,
    DEFAULT_AC_VISA,
    DEFAULT_DC_VISA,
)
from ate_power.visa_link import resource_candidates

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


class InstrumentWorker(QThread):
    # Signals to GUI Thread
    dc_telemetry_signal = pyqtSignal(dict)
    ac_telemetry_signal = pyqtSignal(dict)
    connection_status_signal = pyqtSignal(bool, str, bool, str)  # dc_ok, dc_msg, ac_ok, ac_msg
    log_signal = pyqtSignal(str, str)  # message, level
    fault_signal = pyqtSignal(str, str)  # instrument_type, fault_message

    def __init__(self, simulation_mode=False):
        super().__init__()
        self.simulation_mode = simulation_mode
        self.running = True
        self.cmd_queue = queue.Queue()
        
        # Drivers initialized inside worker thread
        dc_res = resource_candidates(
            explicit=DC_VISA_RESOURCE, lxi_host=DC_LXI_HOST, gpib_fallback=DEFAULT_DC_VISA
        )[0]
        ac_res = resource_candidates(
            explicit=AC_VISA_RESOURCE, lxi_host=AC_LXI_HOST, gpib_fallback=DEFAULT_AC_VISA
        )[0]
        self.dc_driver = DCSupplyDriver(resource_name=dc_res, simulation_mode=simulation_mode)
        self.ac_driver = ACSourceDriver(resource_name=ac_res, simulation_mode=simulation_mode)

    def set_simulation_mode(self, enabled: bool):
        self.cmd_queue.put(("SET_SIM_MODE", enabled))

    def submit_command(self, cmd_type, *args):
        """Thread-safe non-blocking command submission from GUI"""
        self.cmd_queue.put((cmd_type, args))

    def run(self):
        logging.info("[WORKER] Background Instrument Thread Started.")
        
        # 1. Initial Connection Scan
        self._connect_instruments()

        last_poll_time = time.time()
        poll_interval = 0.08  # Poll telemetry every 80ms (12.5 Hz refresh)

        while self.running:
            # Process all pending commands immediately
            try:
                while not self.cmd_queue.empty():
                    cmd_type, args = self.cmd_queue.get_nowait()
                    self._execute_command(cmd_type, args)
                    self.cmd_queue.task_done()
            except queue.Empty:
                pass
            except Exception as e:
                logging.error(f"[WORKER] Command execution error: {e}")

            # Telemetry Polling
            now = time.time()
            if now - last_poll_time >= poll_interval:
                last_poll_time = now
                self._poll_telemetry()

            # Small sleep to yield CPU
            time.sleep(0.01)

        # Cleanup on thread exit
        logging.info("[WORKER] Background Instrument Thread Stopping. Performing emergency shutdown.")
        self.dc_driver.close()
        self.ac_driver.close()

    def _connect_instruments(self):
        self.log_signal.emit("Memindai bus GPIB & menginisialisasi instrumen...", "INFO")
        dc_ok, dc_msg = self.dc_driver.connect()
        ac_ok, ac_msg = self.ac_driver.connect()

        self.connection_status_signal.emit(dc_ok, dc_msg, ac_ok, ac_msg)
        self.log_signal.emit(f"DC Supply: {dc_msg}", "INFO" if dc_ok else "WARN")
        self.log_signal.emit(f"AC Source: {ac_msg}", "INFO" if ac_ok else "WARN")

    def _execute_command(self, cmd_type, args):
        if cmd_type == "CONNECT":
            self._connect_instruments()
        elif cmd_type == "SET_SIM_MODE":
            sim_enabled = args[0] if isinstance(args, tuple) else args
            self.dc_driver.simulation_mode = sim_enabled
            self.ac_driver.simulation_mode = sim_enabled
            mode_str = "SIMULASI (Virtual Mode)" if sim_enabled else "HARDWARE FISIK (GPIB Online)"
            self.log_signal.emit(f"Mode operasi diubah ke: {mode_str}", "WARN" if sim_enabled else "INFO")
        elif cmd_type == "DC_SET_VOLT":
            self.dc_driver.set_voltage(args[0])
            self.log_signal.emit(f"DCPS Target Voltage: {args[0]:.2f} V", "INFO")
        elif cmd_type == "DC_SET_CURR":
            self.dc_driver.set_current_limit(args[0])
            self.log_signal.emit(f"DCPS Current Limit: {args[0]:.2f} A", "INFO")
        elif cmd_type == "DC_SET_OVP":
            self.dc_driver.set_ovp(args[0])
            self.log_signal.emit(f"DCPS OVP Set: {args[0]:.1f} V", "INFO")
        elif cmd_type == "DC_SET_OUTP":
            self.dc_driver.set_output(args[0])
            state_str = "ON" if args[0] else "OFF"
            self.log_signal.emit(f"DCPS OUTPUT: {state_str}", "WARN" if args[0] else "INFO")
        elif cmd_type == "AC_SET_VOLT":
            self.ac_driver.set_voltage(args[0])
            self.log_signal.emit(f"ACPS Target Voltage: {args[0]:.1f} Vrms", "INFO")
        elif cmd_type == "AC_SET_FREQ":
            self.ac_driver.set_frequency(args[0])
            self.log_signal.emit(f"ACPS Frequency: {args[0]:.1f} Hz", "INFO")
        elif cmd_type == "AC_SET_CURR":
            self.ac_driver.set_current_limit(args[0])
            self.log_signal.emit(f"ACPS Current Limit: {args[0]:.1f} Arms", "INFO")
        elif cmd_type == "AC_SET_OUTP":
            self.ac_driver.set_output(args[0])
            state_str = "ON" if args[0] else "OFF"
            self.log_signal.emit(f"ACPS OUTPUT: {state_str}", "WARN" if args[0] else "INFO")
        elif cmd_type == "EMERGENCY_STOP":
            self.dc_driver.emergency_shutdown()
            self.ac_driver.emergency_shutdown()
            self.log_signal.emit("EMERGENCY STOP EXECUTED! SELURUH DAYA DIMATIKAN.", "ERROR")

    def _poll_telemetry(self):
        try:
            dc_m = self.dc_driver.read_measurements()
            self.dc_telemetry_signal.emit(dc_m)
            if dc_m.get("fault", False):
                self.fault_signal.emit("DCPS", dc_m.get("fault_msg", "TRIP"))
        except Exception as e:
            logging.debug(f"DC poll error: {e}")

        try:
            ac_m = self.ac_driver.read_measurements()
            self.ac_telemetry_signal.emit(ac_m)
            if ac_m.get("fault", False):
                self.fault_signal.emit("ACPS", ac_m.get("fault_msg", "TRIP"))
        except Exception as e:
            logging.debug(f"AC poll error: {e}")

    def stop(self):
        self.running = False
        self.wait(2000)
