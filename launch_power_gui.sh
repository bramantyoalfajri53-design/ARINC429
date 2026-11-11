#!/usr/bin/env bash
# ==============================================================================
# ATE Power Instrumentation HMI Console Launcher
# Launches the Native Desktop GUI on the local display (DISPLAY=:0)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$SCRIPT_DIR/.venv/bin/python3"
GUI_SCRIPT="$SCRIPT_DIR/gui/power_controller_gui.py"

# Set default DISPLAY jika belum diset
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:0
fi

# Export shared library path untuk driver Ballard dan C API
export LD_LIBRARY_PATH="$SCRIPT_DIR/driver/Astronic Ballard/BTIDRIVER/DRIVERINTEL64:/usr/local/lib:$LD_LIBRARY_PATH"

if [ ! -f "$VENV_PYTHON" ]; then
    echo "[ERROR] Python Virtual Environment tidak ditemukan di $SCRIPT_DIR/.venv"
    echo "Silakan jalankan: sudo bash $SCRIPT_DIR/scripts/install_drivers.sh terlebih dahulu."
    exit 1
fi

echo "======================================================================="
echo "   Menjalankan ATE Power Instrumentation HMI Console...                "
echo "======================================================================="
echo "Display: $DISPLAY"
echo "Python:  $VENV_PYTHON"
echo "Script:  $GUI_SCRIPT"
echo "======================================================================="

exec "$VENV_PYTHON" "$GUI_SCRIPT" "$@"
