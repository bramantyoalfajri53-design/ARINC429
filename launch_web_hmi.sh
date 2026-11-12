#!/usr/bin/env bash
# Launch ATE Power web HMI (FastAPI + built SPA)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${ROOT}/hmi/backend"
export LD_LIBRARY_PATH="${ROOT}/driver/Astronic Ballard/BTIDRIVER/DRIVERINTEL64:/usr/local/lib:${LD_LIBRARY_PATH:-}"

if [ -x "${ROOT}/.venv/bin/python3" ]; then
    PYTHON_BIN="${ROOT}/.venv/bin/python3"
elif [ -x "${ROOT}/.venv/Scripts/python.exe" ]; then
    PYTHON_BIN="${ROOT}/.venv/Scripts/python.exe"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python)"
else
    echo "Python interpreter not found. Create ${ROOT}/.venv or install Python 3."
    exit 1
fi

if ! "${PYTHON_BIN}" -c "import uvicorn" >/dev/null 2>&1; then
    echo "Missing uvicorn in ${PYTHON_BIN}. Install hmi/backend/requirements.txt or run scripts/install_drivers.sh."
    exit 1
fi

if [ ! -f "${ROOT}/hmi/frontend/dist/index.html" ]; then
    echo "Warning: ${ROOT}/hmi/frontend/dist/index.html not found. Run 'npm run build' in hmi/frontend."
fi

exec "${PYTHON_BIN}" -m uvicorn app:app \
    --app-dir "${ROOT}/hmi/backend" \
    --host 0.0.0.0 \
    --port 8080
