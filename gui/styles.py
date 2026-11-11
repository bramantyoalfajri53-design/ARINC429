"""
ATE Power Instrumentation GUI - Expert Graphic Designer Dark Theme
Aerospace & Defense Grade Industrial HMI Style
"""

DARK_THEME_QSS = """
QMainWindow, QWidget#centralWidget {
    background-color: #080B10;
    color: #E2E8F0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Ubuntu', 'Helvetica Neue', sans-serif;
}

QGroupBox {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #0F1622, stop:1 #0A0F17);
    border: 1px solid #1C2838;
    border-radius: 10px;
    margin-top: 26px;
    font-size: 12px;
    font-weight: 800;
    color: #38BDF8;
    padding: 14px 14px 10px 14px;
}

QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    left: 16px;
    top: 5px;
    padding: 3px 12px;
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #1E2D3F, stop:1 #131E2B);
    border: 1px solid #2B3E54;
    border-radius: 5px;
    color: #7DD3FC;
    font-size: 11px;
    letter-spacing: 0.8px;
}

QLabel {
    color: #94A3B8;
    font-size: 12px;
}

QLabel#headerTitle {
    font-size: 20px;
    font-weight: 900;
    color: #FFFFFF;
    letter-spacing: 1.2px;
}

QLabel#headerSub {
    font-size: 11px;
    color: #64748B;
    letter-spacing: 0.5px;
}

QLabel#panelSectionTitle {
    font-size: 13px;
    font-weight: 800;
    color: #E2E8F0;
    letter-spacing: 0.6px;
}

QPushButton {
    background-color: #151F2C;
    color: #E2E8F0;
    border: 1px solid #24354A;
    border-radius: 6px;
    padding: 8px 14px;
    font-weight: 700;
    font-size: 12px;
}

QPushButton:hover {
    background-color: #1E2D3F;
    border-color: #38BDF8;
    color: #FFFFFF;
}

QPushButton:pressed {
    background-color: #0E1620;
}

QPushButton#btnEStop {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #DC2626, stop:1 #991B1B);
    color: #FFFFFF;
    border: 2px solid #EF4444;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 900;
    padding: 10px 22px;
    letter-spacing: 1px;
}

QPushButton#btnEStop:hover {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #EF4444, stop:1 #B91C1C);
    border-color: #FCA5A5;
}

QPushButton#btnEStop:pressed {
    background: #7F1D1D;
}

QDoubleSpinBox, QSpinBox, QComboBox, QLineEdit {
    background-color: #0A0F16;
    color: #00F0FF;
    border: 1px solid #1E2B3C;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 14px;
    font-weight: 800;
    font-family: 'Consolas', 'JetBrains Mono', monospace;
}

QDoubleSpinBox:focus, QSpinBox:focus, QComboBox:focus, QLineEdit:focus {
    border: 1px solid #00F0FF;
    background-color: #0D1520;
}

QSlider::groove:horizontal {
    height: 6px;
    background: #151F2D;
    border-radius: 3px;
}

QSlider::sub-page:horizontal {
    background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #0284C7, stop:1 #00F0FF);
    border-radius: 3px;
}

QSlider::handle:horizontal {
    background: qlineargradient(x1:0, y1:0, x2:0, y2:1, stop:0 #38BDF8, stop:1 #0284C7);
    border: 1px solid #BAE6FD;
    width: 18px;
    margin-top: -6px;
    margin-bottom: -6px;
    border-radius: 9px;
}

QSlider::handle:horizontal:hover {
    background: #00F0FF;
    border: 1px solid #FFFFFF;
}

QTextEdit, QPlainTextEdit {
    background-color: #05080C;
    color: #94A3B8;
    border: 1px solid #151F2C;
    border-radius: 6px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 11px;
    padding: 6px;
}

QScrollBar:vertical {
    border: none;
    background: #080B10;
    width: 8px;
    margin: 0px;
}

QScrollBar::handle:vertical {
    background: #1E2B3C;
    min-height: 20px;
    border-radius: 4px;
}

QScrollBar::handle:vertical:hover {
    background: #38BDF8;
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}

QCheckBox {
    color: #94A3B8;
    font-size: 12px;
    font-weight: 600;
    spacing: 6px;
}

QCheckBox::indicator {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1px solid #24354A;
    background-color: #0C121A;
}

QCheckBox::indicator:checked {
    background-color: #0284C7;
    border-color: #38BDF8;
}

QStatusBar {
    background-color: #05070A;
    color: #64748B;
    border-top: 1px solid #131A24;
    font-size: 11px;
}
"""
