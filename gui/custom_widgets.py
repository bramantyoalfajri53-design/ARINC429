"""
ATE Power Instrumentation - Compact Cockpit UI Custom Widgets
Optimized for 1366x768 & standard displays with Zero Clipping.
"""

from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QFrame,
    QDoubleSpinBox, QSlider, QSizePolicy
)
from PyQt6.QtCore import Qt, pyqtSignal


class OledMetricCard(QFrame):
    """
    Kartu Metrik Digital OLED ringkas (Height ~44px).
    Menampilkan metrik besar dengan kontras tinggi tanpa memakan ruang vertikal berlebih.
    """
    def __init__(self, title: str, unit: str, glow_color: str = "#00F0FF", parent=None):
        super().__init__(parent)
        self.title_text = title
        self.unit_text = unit
        self.glow_color = glow_color

        self.setObjectName("oledMetricCard")
        self.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Fixed)
        self.setFixedHeight(44)
        self.setStyleSheet(f"""
            QFrame#oledMetricCard {{
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #0D131C, stop:1 #06090E);
                border: 1px solid #1E2D40;
                border-radius: 6px;
            }}
            QFrame#oledMetricCard:hover {{
                border: 1px solid {glow_color};
            }}
        """)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(8, 2, 8, 2)
        layout.setSpacing(6)

        # Left: Title + Unit Badge
        left_box = QVBoxLayout()
        left_box.setSpacing(1)
        left_box.setAlignment(Qt.AlignmentFlag.AlignVCenter | Qt.AlignmentFlag.AlignLeft)

        self.lbl_title = QLabel(self.title_text.upper())
        self.lbl_title.setStyleSheet("color: #7E93A8; font-size: 9px; font-weight: 800; letter-spacing: 0.5px;")
        
        self.lbl_unit = QLabel(self.unit_text)
        self.lbl_unit.setStyleSheet(f"""
            color: {glow_color};
            background-color: #101B27;
            border: 1px solid #1E2E42;
            border-radius: 3px;
            font-size: 8px;
            font-weight: 800;
            padding: 0px 4px;
        """)
        
        left_box.addWidget(self.lbl_title)
        left_box.addWidget(self.lbl_unit)
        layout.addLayout(left_box)

        layout.addStretch()

        # Right: Value Readout
        self.lbl_value = QLabel("0.00")
        self.lbl_value.setAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
        self.lbl_value.setStyleSheet(f"""
            color: {glow_color};
            font-family: 'Consolas', 'JetBrains Mono', 'DejaVu Sans Mono', monospace;
            font-size: 17px;
            font-weight: 900;
            letter-spacing: 0.5px;
        """)
        layout.addWidget(self.lbl_value)

    def set_value(self, val_str: str):
        self.lbl_value.setText(val_str)


class ControlInputBlock(QFrame):
    """
    Blok Input Kontrol Setpoint Ringkas (Height ~42px).
    Baris 1: Label Judul + Spinbox
    Baris 2: Slim Horizontal Slider
    """
    valueChanged = pyqtSignal(float)

    def __init__(self, title: str, min_val: float, max_val: float, default_val: float, step: float, decimals: int, unit_suffix: str, glow_color: str = "#00F0FF", parent=None):
        super().__init__(parent)
        self.decimals = decimals
        self.scale_factor = 10 ** decimals
        self.glow_color = glow_color

        self.setFixedHeight(42)
        self.setStyleSheet("""
            QFrame {
                background-color: #0A0F16;
                border: 1px solid #16202C;
                border-radius: 5px;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 3, 6, 3)
        layout.setSpacing(1)

        # Top Row: Title + Compact Spinbox
        top_row = QHBoxLayout()
        top_row.setContentsMargins(0, 0, 0, 0)
        top_row.setSpacing(4)
        
        lbl = QLabel(title)
        lbl.setStyleSheet("color: #C5D2E0; font-size: 10px; font-weight: 700;")
        top_row.addWidget(lbl)
        top_row.addStretch()

        self.spinbox = QDoubleSpinBox()
        self.spinbox.setRange(min_val, max_val)
        self.spinbox.setDecimals(decimals)
        self.spinbox.setSingleStep(step)
        self.spinbox.setSuffix(f" {unit_suffix}")
        self.spinbox.setValue(default_val)
        self.spinbox.setMinimumWidth(88)
        self.spinbox.setFixedHeight(20)
        self.spinbox.setAlignment(Qt.AlignmentFlag.AlignRight)
        self.spinbox.setStyleSheet(f"""
            QDoubleSpinBox {{
                background-color: #05080C;
                color: {glow_color};
                border: 1px solid #1F2E40;
                border-radius: 3px;
                padding: 1px 4px;
                font-size: 11px;
                font-weight: 800;
                font-family: 'Consolas', monospace;
            }}
            QDoubleSpinBox:focus {{
                border: 1px solid {glow_color};
            }}
        """)
        self.spinbox.valueChanged.connect(self._on_spin_changed)
        top_row.addWidget(self.spinbox)
        layout.addLayout(top_row)

        # Bottom Row: Slim Slider
        self.slider = QSlider(Qt.Orientation.Horizontal)
        self.slider.setRange(int(min_val * self.scale_factor), int(max_val * self.scale_factor))
        self.slider.setValue(int(default_val * self.scale_factor))
        self.slider.setFixedHeight(14)
        self.slider.setStyleSheet(f"""
            QSlider::groove:horizontal {{
                height: 4px;
                background: #151F2D;
                border-radius: 2px;
            }}
            QSlider::sub-page:horizontal {{
                background: {glow_color};
                border-radius: 2px;
            }}
            QSlider::handle:horizontal {{
                background: #E2E8F0;
                border: 1px solid {glow_color};
                width: 12px;
                margin-top: -4px;
                margin-bottom: -4px;
                border-radius: 6px;
            }}
            QSlider::handle:horizontal:hover {{
                background: {glow_color};
            }}
        """)
        self.slider.valueChanged.connect(self._on_slider_changed)
        layout.addWidget(self.slider)

    def _on_spin_changed(self, val: float):
        self.slider.blockSignals(True)
        self.slider.setValue(int(val * self.scale_factor))
        self.slider.blockSignals(False)
        self.valueChanged.emit(val)

    def _on_slider_changed(self, val_int: int):
        val = val_int / float(self.scale_factor)
        self.spinbox.blockSignals(True)
        self.spinbox.setValue(val)
        self.spinbox.blockSignals(False)
        self.valueChanged.emit(val)

    def set_value(self, val: float):
        self.spinbox.setValue(val)

    def value(self) -> float:
        return self.spinbox.value()


class GlowPowerButton(QPushButton):
    """
    Tombol Daya Taktil Beriluminasi (Height ~30px).
    """
    def __init__(self, text="POWER ON", is_power_on=False, parent=None):
        super().__init__(text, parent)
        self.is_active = is_power_on
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setFixedHeight(30)
        self.update_style()

    def set_active_state(self, active: bool, active_text="🛑 POWER OFF", inactive_text="⚡ POWER ON"):
        self.is_active = active
        self.setText(active_text if active else inactive_text)
        self.update_style()

    def update_style(self):
        if self.is_active:
            self.setStyleSheet("""
                QPushButton {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #DC2626, stop:1 #991B1B);
                    color: #FFFFFF;
                    border: 1px solid #EF4444;
                    border-radius: 5px;
                    font-size: 11px;
                    font-weight: 900;
                    letter-spacing: 0.6px;
                    padding: 4px 10px;
                }
                QPushButton:hover {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #EF4444, stop:1 #B91C1C);
                    border: 1px solid #FCA5A5;
                }
                QPushButton:pressed {
                    background: #7F1D1D;
                }
            """)
        else:
            self.setStyleSheet("""
                QPushButton {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #059669, stop:1 #047857);
                    color: #FFFFFF;
                    border: 1px solid #10B981;
                    border-radius: 5px;
                    font-size: 11px;
                    font-weight: 900;
                    letter-spacing: 0.6px;
                    padding: 4px 10px;
                }
                QPushButton:hover {
                    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #10B981, stop:1 #059669);
                    border: 1px solid #34D399;
                }
                QPushButton:pressed {
                    background: #064E3B;
                }
            """)


class PresetChip(QPushButton):
    """
    Pill-shaped Preset Button ringkas (Height ~22px).
    """
    def __init__(self, label: str, parent=None):
        super().__init__(label, parent)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setFixedHeight(22)
        self.setStyleSheet("""
            QPushButton {
                background-color: #101722;
                color: #94A3B8;
                border: 1px solid #1E2D3E;
                border-radius: 11px;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 8px;
            }
            QPushButton:hover {
                background-color: #1A2838;
                color: #38BDF8;
                border: 1px solid #0284C7;
            }
            QPushButton:pressed {
                background-color: #0C4A6E;
                color: #FFFFFF;
            }
        """)


class StatusIndicatorPill(QFrame):
    """
    Pill indikator status (Height ~24px).
    """
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("statusPill")
        self.setFixedHeight(24)

        layout = QHBoxLayout(self)
        layout.setContentsMargins(6, 1, 6, 1)
        layout.setSpacing(4)

        self.dot_label = QLabel("●")
        self.text_label = QLabel("STANDBY")
        self.text_label.setStyleSheet("font-size: 9px; font-weight: 800; letter-spacing: 0.5px;")

        layout.addWidget(self.dot_label)
        layout.addWidget(self.text_label)

        self.set_state(active=False)

    def set_state(self, active: bool, fault: bool = False, fault_msg: str = ""):
        if fault:
            self.dot_label.setStyleSheet("color: #EF4444; font-size: 11px;")
            self.text_label.setText(f"FAULT: {fault_msg}".upper())
            self.text_label.setStyleSheet("color: #EF4444; font-size: 9px; font-weight: 800;")
            self.setStyleSheet("""
                QFrame#statusPill {
                    background-color: #2A0E13;
                    border: 1px solid #7F1D1D;
                    border-radius: 4px;
                }
            """)
        elif active:
            self.dot_label.setStyleSheet("color: #00FF9D; font-size: 11px;")
            self.text_label.setText("LIVE EMISSION (ON)")
            self.text_label.setStyleSheet("color: #00FF9D; font-size: 9px; font-weight: 800;")
            self.setStyleSheet("""
                QFrame#statusPill {
                    background-color: #062317;
                    border: 1px solid #059669;
                    border-radius: 4px;
                }
            """)
        else:
            self.dot_label.setStyleSheet("color: #64748B; font-size: 11px;")
            self.text_label.setText("OUTPUT OFF (STANDBY)")
            self.text_label.setStyleSheet("color: #94A3B8; font-size: 9px; font-weight: 800;")
            self.setStyleSheet("""
                QFrame#statusPill {
                    background-color: #0E151E;
                    border: 1px solid #1E293B;
                    border-radius: 4px;
                }
            """)
