#!/usr/bin/env python3
"""
==============================================================================
ATE Power Instrumentation Controller Console (Desktop HMI)
Compact Cockpit Edition — Zero Clipping on 1366x768 & Scaled Displays
Hardware: Keysight N5746A (DCPS) & Keysight AC6803B (ACPS)
==============================================================================
"""

import sys
import os
import time
from collections import deque

from PyQt6.QtWidgets import (  # type: ignore[import-not-found]
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QGridLayout, QGroupBox, QLabel, QPushButton, QCheckBox,
    QTextEdit, QFrame, QMessageBox, QStatusBar,
    QScrollArea, QSizePolicy
)
from PyQt6.QtCore import Qt, QTimer, pyqtSlot  # type: ignore[import-not-found]
from PyQt6.QtGui import QFont, QColor  # type: ignore[import-not-found]

import pyqtgraph as pg  # type: ignore[import-not-found]

# Local Modules
from styles import DARK_THEME_QSS
from custom_widgets import OledMetricCard, ControlInputBlock, GlowPowerButton, PresetChip, StatusIndicatorPill
from async_engine import InstrumentWorker


class PowerControlConsole(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("ATE POWER INSTRUMENTATION CONSOLE — KEYSIGHT DCPS & ACPS")
        
        # Sizing presisi untuk layar 1366x768 (tersedia 741px)
        self.resize(1340, 715)
        self.setMinimumSize(980, 600)
        self.setStyleSheet(DARK_THEME_QSS)

        # Ring Buffers untuk Grafik (100 points)
        self.history_len = 100
        self.dc_v_history = deque(maxlen=self.history_len)
        self.dc_i_history = deque(maxlen=self.history_len)
        self.ac_v_history = deque(maxlen=self.history_len)
        self.ac_p_history = deque(maxlen=self.history_len)

        # State Lokal GUI
        self.dc_output_on = False
        self.ac_output_on = False

        # Bangun Komponen UI Terlebih Dahulu
        self.init_ui()

        # Inisialisasi & Jalankan Thread Asinkron Latar Belakang (Non-Blocking)
        self.worker = InstrumentWorker(simulation_mode=False)
        self.worker.dc_telemetry_signal.connect(self.on_dc_telemetry)
        self.worker.ac_telemetry_signal.connect(self.on_ac_telemetry)
        self.worker.connection_status_signal.connect(self.on_connection_status)
        self.worker.log_signal.connect(self.log)
        self.worker.fault_signal.connect(self.on_fault_triggered)
        self.worker.start()

        # 60 FPS Chart Render Timer (25ms)
        self.chart_timer = QTimer(self)
        self.chart_timer.timeout.connect(self.render_charts)
        self.chart_timer.start(25)

    def init_ui(self):
        # Master Scroll Area untuk mencegah konten terpotong pada resolusi rendah
        scroll_area = QScrollArea(self)
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.Shape.NoFrame)
        scroll_area.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        scroll_area.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.setCentralWidget(scroll_area)

        central_widget = QWidget()
        central_widget.setObjectName("centralWidget")
        scroll_area.setWidget(central_widget)

        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 6, 10, 6)
        main_layout.setSpacing(6)

        # ----------------------------------------------------------------------
        # 1. TOP HEADER BAR (Compact Height ~36px)
        # ----------------------------------------------------------------------
        header_frame = QFrame()
        header_frame.setFixedHeight(40)
        header_frame.setStyleSheet("""
            QFrame {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #0E1622, stop:0.5 #131E2C, stop:1 #0E1622);
                border: 1px solid #1C2B3C;
                border-radius: 6px;
            }
        """)
        header_layout = QHBoxLayout(header_frame)
        header_layout.setContentsMargins(8, 2, 8, 2)
        header_layout.setSpacing(8)

        # Title
        title_label = QLabel("⚡ ATE POWER CONTROL CONSOLE")
        title_label.setStyleSheet("color: #FFFFFF; font-size: 13px; font-weight: 900; letter-spacing: 0.8px;")
        header_layout.addWidget(title_label)

        sub_title = QLabel("• KEYSIGHT N5746A & AC6803B")
        sub_title.setStyleSheet("color: #64748B; font-size: 10px; font-weight: 700;")
        header_layout.addWidget(sub_title)

        header_layout.addStretch()

        # Hardware Heartbeat Beacon
        self.lbl_heartbeat = QLabel("● SYSTEM ACTIVE")
        self.lbl_heartbeat.setStyleSheet("color: #00FF9D; font-weight: 800; font-size: 10px; background: #062317; border: 1px solid #059669; border-radius: 4px; padding: 2px 6px;")
        header_layout.addWidget(self.lbl_heartbeat)

        # Simulation Mode Toggle
        self.sim_checkbox = QCheckBox("Sim Mode")
        self.sim_checkbox.setStyleSheet("color: #38BDF8; font-weight: 700; font-size: 10px;")
        self.sim_checkbox.toggled.connect(self.on_sim_toggle)
        header_layout.addWidget(self.sim_checkbox)

        # Re-Scan GPIB Button
        self.btn_rescan = QPushButton("🔄 Re-Scan")
        self.btn_rescan.setFixedHeight(26)
        self.btn_rescan.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_rescan.clicked.connect(self.on_rescan_clicked)
        header_layout.addWidget(self.btn_rescan)

        # EMERGENCY STOP
        self.btn_estop = QPushButton("🛑 EMERGENCY STOP")
        self.btn_estop.setObjectName("btnEStop")
        self.btn_estop.setFixedHeight(28)
        self.btn_estop.setCursor(Qt.CursorShape.PointingHandCursor)
        self.btn_estop.clicked.connect(self.on_emergency_stop_clicked)
        header_layout.addWidget(self.btn_estop)

        main_layout.addWidget(header_frame)

        # ----------------------------------------------------------------------
        # 2. MAIN DUAL PANELS (DCPS & ACPS) - SIDE BY SIDE
        # ----------------------------------------------------------------------
        panels_layout = QHBoxLayout()
        panels_layout.setSpacing(8)

        # Left: DC Power Supply Panel
        dc_panel = self.create_dc_panel()
        panels_layout.addWidget(dc_panel, stretch=1)

        # Right: AC Power Source Panel
        ac_panel = self.create_ac_panel()
        panels_layout.addWidget(ac_panel, stretch=1)

        main_layout.addLayout(panels_layout, stretch=1)

        # ----------------------------------------------------------------------
        # 3. BOTTOM TELEMETRY LOG & SCPI MONITOR (Compact ~45px)
        # ----------------------------------------------------------------------
        bottom_frame = QFrame()
        bottom_frame.setFixedHeight(50)
        bottom_frame.setStyleSheet("background-color: #0A0F16; border: 1px solid #16202D; border-radius: 5px;")
        bot_layout = QHBoxLayout(bottom_frame)
        bot_layout.setContentsMargins(6, 2, 6, 2)
        bot_layout.setSpacing(6)

        lbl_log_title = QLabel("📜 LOG:")
        lbl_log_title.setStyleSheet("color: #64748B; font-size: 9px; font-weight: 800;")
        bot_layout.addWidget(lbl_log_title)

        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        self.log_text.setStyleSheet("background: transparent; border: none; font-size: 10px; color: #94A3B8;")
        bot_layout.addWidget(self.log_text, stretch=1)

        self.btn_clear_log = QPushButton("Clear")
        self.btn_clear_log.setFixedHeight(20)
        self.btn_clear_log.setStyleSheet("background: #111A24; border: 1px solid #202E3E; color: #64748B; font-size: 9px; padding: 1px 6px;")
        self.btn_clear_log.clicked.connect(lambda: self.log_text.clear())
        bot_layout.addWidget(self.btn_clear_log)

        main_layout.addWidget(bottom_frame)

        # Status Bar
        self.status_bar = QStatusBar()
        self.status_bar.setFixedHeight(18)
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("Engine Started. Non-Blocking Async SCPI Ready.")

    # ==========================================================================
    # DC POWER SUPPLY PANEL (Keysight N5746A)
    # ==========================================================================
    def create_dc_panel(self):
        group = QGroupBox("KEYSIGHT N5746A — SYSTEM DC POWER SUPPLY (40V / 19A, 760W)")
        layout = QVBoxLayout(group)
        layout.setContentsMargins(8, 10, 8, 8)
        layout.setSpacing(6)

        # Top Control Row (Status Pill + Glowing Power Button)
        top_row = QHBoxLayout()
        top_row.setSpacing(6)
        self.dc_status_pill = StatusIndicatorPill()
        top_row.addWidget(self.dc_status_pill)
        top_row.addStretch()

        self.btn_dc_power = GlowPowerButton("⚡ DC POWER ON", is_power_on=False)
        self.btn_dc_power.setMinimumWidth(130)
        self.btn_dc_power.clicked.connect(self.on_dc_power_toggle)
        top_row.addWidget(self.btn_dc_power)
        layout.addLayout(top_row)

        # 2x2 OLED Metric Cards Grid
        meters_grid = QGridLayout()
        meters_grid.setHorizontalSpacing(6)
        meters_grid.setVerticalSpacing(4)

        self.card_dc_v = OledMetricCard("Measured Voltage", "V", glow_color="#00F0FF")
        self.card_dc_i = OledMetricCard("Measured Current", "A", glow_color="#F59E0B")
        self.card_dc_p = OledMetricCard("Calculated Power", "W", glow_color="#10B981")
        self.card_dc_mode = OledMetricCard("Regulation Mode", "STATE", glow_color="#38BDF8")

        meters_grid.addWidget(self.card_dc_v, 0, 0)
        meters_grid.addWidget(self.card_dc_i, 0, 1)
        meters_grid.addWidget(self.card_dc_p, 1, 0)
        meters_grid.addWidget(self.card_dc_mode, 1, 1)
        layout.addLayout(meters_grid)

        # Setpoint Inputs (Compact Control Blocks)
        self.dc_v_block = ControlInputBlock(
            title="Target Voltage (0 - 40V)", min_val=0.0, max_val=40.0, default_val=0.0,
            step=0.5, decimals=2, unit_suffix="V", glow_color="#00F0FF"
        )
        self.dc_v_block.valueChanged.connect(self.on_dc_v_changed)
        layout.addWidget(self.dc_v_block)

        self.dc_i_block = ControlInputBlock(
            title="Current Limit (0 - 19A)", min_val=0.0, max_val=19.0, default_val=5.0,
            step=0.5, decimals=2, unit_suffix="A", glow_color="#F59E0B"
        )
        self.dc_i_block.valueChanged.connect(self.on_dc_i_changed)
        layout.addWidget(self.dc_i_block)

        self.dc_ovp_block = ControlInputBlock(
            title="Hardware OVP Protection", min_val=1.0, max_val=45.0, default_val=35.0,
            step=1.0, decimals=1, unit_suffix="V (OVP)", glow_color="#EF4444"
        )
        self.dc_ovp_block.valueChanged.connect(lambda v: self.worker.submit_command("DC_SET_OVP", v))
        layout.addWidget(self.dc_ovp_block)

        # Quick Preset Chips (Single Row)
        preset_row = QHBoxLayout()
        preset_row.setSpacing(4)
        preset_row.addWidget(QLabel("Presets:"))
        for label, val in [("28V (Aircraft)", 28.0), ("12V", 12.0), ("5V", 5.0), ("3.3V", 3.3), ("0V (Off)", 0.0)]:
            btn = PresetChip(label)
            btn.clicked.connect(lambda _, v=val: self.apply_dc_preset(v))
            preset_row.addWidget(btn)
        preset_row.addStretch()
        layout.addLayout(preset_row)

        # Real-time High-speed Oscilloscope Stripchart (Compact Height ~95px)
        self.dc_plot = pg.PlotWidget(title="DC Trend")
        self.dc_plot.setBackground("#05080C")
        self.dc_plot.showGrid(x=True, y=True, alpha=0.15)
        self.dc_curve_v = self.dc_plot.plot(pen=pg.mkPen(color="#00F0FF", width=2.0), name="V")
        self.dc_curve_i = self.dc_plot.plot(pen=pg.mkPen(color="#F59E0B", width=2.0), name="I")
        self.dc_plot.setFixedHeight(95)
        layout.addWidget(self.dc_plot)

        return group

    # ==========================================================================
    # AC POWER SOURCE PANEL (Keysight AC6803B)
    # ==========================================================================
    def create_ac_panel(self):
        group = QGroupBox("KEYSIGHT AC6803B — BASIC AC POWER SOURCE (2000VA, 135V/270V, 45-500Hz)")
        layout = QVBoxLayout(group)
        layout.setContentsMargins(8, 10, 8, 8)
        layout.setSpacing(6)

        # Top Control Row (Status Pill + Glowing Power Button)
        top_row = QHBoxLayout()
        top_row.setSpacing(6)
        self.ac_status_pill = StatusIndicatorPill()
        top_row.addWidget(self.ac_status_pill)
        top_row.addStretch()

        self.btn_ac_power = GlowPowerButton("⚡ AC POWER ON", is_power_on=False)
        self.btn_ac_power.setMinimumWidth(130)
        self.btn_ac_power.clicked.connect(self.on_ac_power_toggle)
        top_row.addWidget(self.btn_ac_power)
        layout.addLayout(top_row)

        # 2x2 OLED Metric Cards Grid
        meters_grid = QGridLayout()
        meters_grid.setHorizontalSpacing(6)
        meters_grid.setVerticalSpacing(4)

        self.card_ac_v = OledMetricCard("Measured Vrms", "Vrms", glow_color="#38BDF8")
        self.card_ac_i = OledMetricCard("Measured Irms", "Arms", glow_color="#F59E0B")
        self.card_ac_p = OledMetricCard("Active Power", "W", glow_color="#10B981")
        self.card_ac_f = OledMetricCard("Freq / PF", "Hz / PF", glow_color="#A78BFA")

        meters_grid.addWidget(self.card_ac_v, 0, 0)
        meters_grid.addWidget(self.card_ac_i, 0, 1)
        meters_grid.addWidget(self.card_ac_p, 1, 0)
        meters_grid.addWidget(self.card_ac_f, 1, 1)
        layout.addLayout(meters_grid)

        # Setpoint Inputs (Compact Control Blocks)
        self.ac_v_block = ControlInputBlock(
            title="Target Voltage (0 - 270 Vrms)", min_val=0.0, max_val=270.0, default_val=0.0,
            step=1.0, decimals=1, unit_suffix="Vrms", glow_color="#38BDF8"
        )
        self.ac_v_block.valueChanged.connect(self.on_ac_v_changed)
        layout.addWidget(self.ac_v_block)

        self.ac_f_block = ControlInputBlock(
            title="Frequency (45 - 500 Hz)", min_val=45.0, max_val=500.0, default_val=400.0,
            step=5.0, decimals=1, unit_suffix="Hz", glow_color="#A78BFA"
        )
        self.ac_f_block.valueChanged.connect(self.on_ac_f_changed)
        layout.addWidget(self.ac_f_block)

        self.ac_i_block = ControlInputBlock(
            title="Current Limit (0 - 20 Arms)", min_val=0.0, max_val=20.0, default_val=10.0,
            step=0.5, decimals=1, unit_suffix="Arms", glow_color="#F59E0B"
        )
        self.ac_i_block.valueChanged.connect(lambda v: self.worker.submit_command("AC_SET_CURR", v))
        layout.addWidget(self.ac_i_block)

        # Quick Preset Chips (Single Row)
        preset_row = QHBoxLayout()
        preset_row.setSpacing(4)
        preset_row.addWidget(QLabel("Presets:"))
        for label, v_val, f_val in [
            ("115V@400Hz", 115.0, 400.0),
            ("230V@50Hz", 230.0, 50.0),
            ("115V@60Hz", 115.0, 60.0),
            ("26V@400Hz", 26.0, 400.0),
            ("0V (Off)", 0.0, 400.0)
        ]:
            btn = PresetChip(label)
            btn.clicked.connect(lambda _, v=v_val, f=f_val: self.apply_ac_preset(v, f))
            preset_row.addWidget(btn)
        preset_row.addStretch()
        layout.addLayout(preset_row)

        # Real-time High-speed Oscilloscope Stripchart (Compact Height ~95px)
        self.ac_plot = pg.PlotWidget(title="AC Trend")
        self.ac_plot.setBackground("#05080C")
        self.ac_plot.showGrid(x=True, y=True, alpha=0.15)
        self.ac_curve_v = self.ac_plot.plot(pen=pg.mkPen(color="#38BDF8", width=2.0), name="Vrms")
        self.ac_curve_p = self.ac_plot.plot(pen=pg.mkPen(color="#10B981", width=2.0), name="W")
        self.ac_plot.setFixedHeight(95)
        layout.addWidget(self.ac_plot)

        return group

    # ==========================================================================
    # LOGGING & ASYNC SLOTS
    # ==========================================================================
    @pyqtSlot(str, str)
    def log(self, message: str, level: str = "INFO"):
        t_stamp = time.strftime("%H:%M:%S")
        color = "#38BDF8" if level == "INFO" else "#EF4444" if level == "ERROR" else "#F59E0B"
        self.log_text.append(f"<span style='color: #475569;'>[{t_stamp}]</span> <span style='color: {color}; font-weight: bold;'>[{level}]</span> {message}")

    @pyqtSlot(bool, str, bool, str)
    def on_connection_status(self, dc_ok, dc_msg, ac_ok, ac_msg):
        sim_active = self.worker.simulation_mode or (not dc_ok and not ac_ok)
        self.sim_checkbox.blockSignals(True)
        self.sim_checkbox.setChecked(sim_active)
        self.sim_checkbox.blockSignals(False)

        if sim_active:
            self.lbl_heartbeat.setText("● SIM MODE")
            self.lbl_heartbeat.setStyleSheet("color: #38BDF8; font-weight: 800; font-size: 10px; background: #0C4A6E; border: 1px solid #0284C7; border-radius: 4px; padding: 2px 6px;")
            self.status_bar.showMessage("Engine Status: Virtual Simulation Active")
        else:
            self.lbl_heartbeat.setText("● GPIB ONLINE")
            self.lbl_heartbeat.setStyleSheet("color: #00FF9D; font-weight: 800; font-size: 10px; background: #062317; border: 1px solid #059669; border-radius: 4px; padding: 2px 6px;")
            self.status_bar.showMessage(f"Hardware Online: DCPS @ GPIB5 | ACPS @ GPIB7")

    @pyqtSlot(str, str)
    def on_fault_triggered(self, inst_type, fault_msg):
        if inst_type == "DCPS":
            self.dc_status_pill.set_state(active=False, fault=True, fault_msg=fault_msg)
            self.dc_output_on = False
            self.btn_dc_power.set_active_state(False, active_text="🛑 DC POWER OFF", inactive_text="⚡ DC POWER ON")
        elif inst_type == "ACPS":
            self.ac_status_pill.set_state(active=False, fault=True, fault_msg=fault_msg)
            self.ac_output_on = False
            self.btn_ac_power.set_active_state(False, active_text="🛑 AC POWER OFF", inactive_text="⚡ AC POWER ON")

    @pyqtSlot(dict)
    def on_dc_telemetry(self, m):
        v = m.get("voltage", 0.0)
        i = m.get("current", 0.0)
        p = m.get("power", 0.0)
        outp = m.get("output_on", False)
        fault = m.get("fault", False)
        status_mode = m.get("status", "ONLINE")

        self.card_dc_v.set_value(f"{v:.2f}")
        self.card_dc_i.set_value(f"{i:.3f}")
        self.card_dc_p.set_value(f"{p:.1f}")
        self.card_dc_mode.set_value(status_mode)

        if not fault:
            self.dc_status_pill.set_state(active=outp)

        self.dc_v_history.append(v)
        self.dc_i_history.append(i)

    @pyqtSlot(dict)
    def on_ac_telemetry(self, m):
        v_rms = m.get("v_rms", 0.0)
        i_rms = m.get("i_rms", 0.0)
        p_real = m.get("power_watts", 0.0)
        pf = m.get("power_factor", 1.0)
        freq = m.get("frequency", 400.0)
        outp = m.get("output_on", False)
        fault = m.get("fault", False)

        self.card_ac_v.set_value(f"{v_rms:.1f}")
        self.card_ac_i.set_value(f"{i_rms:.2f}")
        self.card_ac_p.set_value(f"{p_real:.1f}")
        self.card_ac_f.set_value(f"{freq:.0f}Hz / {pf:.2f}")

        if not fault:
            self.ac_status_pill.set_state(active=outp)

        self.ac_v_history.append(v_rms)
        self.ac_p_history.append(p_real)

    def render_charts(self):
        if self.dc_v_history:
            self.dc_curve_v.setData(list(self.dc_v_history))
            self.dc_curve_i.setData(list(self.dc_i_history))
        if self.ac_v_history:
            self.ac_curve_v.setData(list(self.ac_v_history))
            self.ac_curve_p.setData(list(self.ac_p_history))

    # ==========================================================================
    # NON-BLOCKING CONTROL HANDLERS
    # ==========================================================================
    def on_sim_toggle(self, checked: bool):
        self.worker.set_simulation_mode(checked)

    def on_rescan_clicked(self):
        self.worker.submit_command("CONNECT")

    def on_emergency_stop_clicked(self):
        self.dc_output_on = False
        self.ac_output_on = False
        self.btn_dc_power.set_active_state(False, active_text="🛑 DC POWER OFF", inactive_text="⚡ DC POWER ON")
        self.btn_ac_power.set_active_state(False, active_text="🛑 AC POWER OFF", inactive_text="⚡ AC POWER ON")
        self.dc_v_block.set_value(0.0)
        self.ac_v_block.set_value(0.0)
        self.dc_status_pill.set_state(active=False)
        self.ac_status_pill.set_state(active=False)

        self.worker.submit_command("EMERGENCY_STOP")
        QMessageBox.critical(self, "EMERGENCY SHUTDOWN", "SEMUA OUTPUT CATU DAYA TELAH DIMATIKAN DAN DIRESET KE 0.0V SECARA AMAN!")

    # --- DC Handlers ---
    def on_dc_v_changed(self, val: float):
        self.worker.submit_command("DC_SET_VOLT", val)

    def on_dc_i_changed(self, val: float):
        self.worker.submit_command("DC_SET_CURR", val)

    def apply_dc_preset(self, voltage: float):
        self.dc_v_block.set_value(voltage)

    def on_dc_power_toggle(self):
        new_state = not self.dc_output_on
        
        # High Voltage Warning Interlock (>35V)
        if new_state and self.dc_v_block.value() > 35.0:
            reply = QMessageBox.warning(
                self,
                "⚠️ PERINGATAN TEGANGAN TINGGI DC",
                f"Anda akan mengaktifkan catu daya DC pada tegangan tinggi ({self.dc_v_block.value():.2f} VDC)!\n\nLanjutkan?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )
            if reply != QMessageBox.StandardButton.Yes:
                return

        self.dc_output_on = new_state
        self.btn_dc_power.set_active_state(new_state, active_text="🛑 DC POWER OFF", inactive_text="⚡ DC POWER ON")
        self.dc_status_pill.set_state(active=new_state)
        self.worker.submit_command("DC_SET_OUTP", new_state)

    # --- AC Handlers ---
    def on_ac_v_changed(self, val: float):
        self.worker.submit_command("AC_SET_VOLT", val)

    def on_ac_f_changed(self, val: float):
        self.worker.submit_command("AC_SET_FREQ", val)

    def apply_ac_preset(self, voltage: float, freq: float):
        self.ac_v_block.set_value(voltage)
        self.ac_f_block.set_value(freq)

    def on_ac_power_toggle(self):
        new_state = not self.ac_output_on

        # High Voltage Warning Interlock (>130V)
        if new_state and self.ac_v_block.value() > 130.0:
            reply = QMessageBox.warning(
                self,
                "⚠️ PERINGATAN TEGANGAN TINGGI AC",
                f"Anda akan mengaktifkan catu daya AC pada tegangan tinggi ({self.ac_v_block.value():.1f} Vrms @ {self.ac_f_block.value():.1f} Hz)!\n\nLanjutkan?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )
            if reply != QMessageBox.StandardButton.Yes:
                return

        self.ac_output_on = new_state
        self.btn_ac_power.set_active_state(new_state, active_text="🛑 AC POWER OFF", inactive_text="⚡ AC POWER ON")
        self.ac_status_pill.set_state(active=new_state)
        self.worker.submit_command("AC_SET_OUTP", new_state)

    def closeEvent(self, event):
        self.worker.stop()
        event.accept()


def main():
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    console = PowerControlConsole()
    console.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
