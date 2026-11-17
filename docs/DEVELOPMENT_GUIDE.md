# Local Development Guide

This guide explains how to develop, test, and run the ARINC 429 Integration platform on a local workstation without requiring an active SSH connection to the physical PXIe test rack.

---

## 1. Architecture Overview

The system consists of two primary layers:
1. **Core Station Kernel (`src/ate_platform/` & `src/core/`):**
   - Manages test sequencer, VISA links (LXI/GPIB for Keysight power supplies), and ARINC 429 card drivers.
   - Provides web endpoints under `/api/arinc/*`, `/api/standard/*`, `/api/cfds/*`, and `/api/cmc/*`.
2. **Modular HMI & Dynapro 1780A Infotouch Display (`hmi/` & `web/`):**
   - Retro CRT display emulation representing the JcAIR T1200 Infotouch console.
   - React SPA Vite application (`hmi/frontend/`) built into `web/dist/` and `hmi/frontend/dist/`.

---

## 2. Virtual Environment Setup

### Windows (Local):
```powershell
# Create venv if not present
python -m venv hmi\backend\.venv
.\hmi\backend\.venv\Scripts\Activate.ps1

# Install requirements
pip install -r hmi\backend\requirements.txt
pip install pyyaml pydantic paramiko pytest anyio httpx
```

### Linux / Server:
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

---

## 3. Simulation Mode vs Hardware Mode

When the Astronics Ballard OmniBus II PCIe/PXIe card is not installed on the machine:
- `Arinc429Coordinator` detects `adapter.is_connected == False`.
- The system automatically engages **SIMULATION MODE**.
- ARINC 429 transmit calls return simulated words with proper odd parity and generate realistic receiver loopback words (e.g. Label 202 DME distance 43.01 NM for Label 035 frequency transmissions).

---

## 4. Running the Application Locally

```powershell
$env:PYTHONPATH = ".\src;.\hmi\backend"
.\hmi\backend\.venv\Scripts\python.exe -m uvicorn ate_platform.web.app:app --host 127.0.0.1 --port 8080
```
Then navigate to:
- Operator console: `http://localhost:8080/`
- ARINC 429 console: `http://localhost:8080/arinc` (Default PIN: `2468`)
- Click **"Dynapro 1780A Infotouch"** card under Standard Mode to test the dynamic retro CRT display.
