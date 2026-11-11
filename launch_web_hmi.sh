#!/usr/bin/env bash
# Launch ATE Power web HMI (FastAPI + built SPA)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${ROOT}/hmi/backend"
export LD_LIBRARY_PATH="${ROOT}/driver/Astronic Ballard/BTIDRIVER/DRIVERINTEL64:/usr/local/lib:${LD_LIBRARY_PATH:-}"
VENV="${ROOT}/.venv/bin/python3"
if [ ! -x "${VENV}" ]; then
    echo "Missing ${ROOT}/.venv — run scripts/install_drivers.sh first."
    exit 1
fi
exec "${ROOT}/.venv/bin/uvicorn" app:app \
    --app-dir "${ROOT}/hmi/backend" \
    --host 0.0.0.0 \
    --port 8080
