# Automated Test Equipment (ATE) & Web HMI System

Repositori ini berisi aplikasi web HMI (**ATE Power Control Console** + fondasi arsitektur modular untuk mode operasi **Aeroflex JcAIR T1200 / T1200B Control Display Unit**: *Standard*, *CFDS*, dan *CMC*), modul driver, script instalasi otomatis, serta dokumentasi teknis untuk sistem **Automated Test Equipment (ATE)** berbasis platform National Instruments (NI) PXI Express, avionik ARINC 429, dan catu daya programmable **Keysight** via **LXI (LAN)** / GPIB.

**Host produksi:** NI PXIe-8821 (`ni-ate`) — **Ubuntu 22.04.5 LTS Server**, kernel **6.8.0-138-generic** (HWE), user `paridit`, proyek di `/home/paridit/project/ATE`.

---

## Teknologi yang Digunakan

- **Frontend (`hmi/frontend/`):** React 18, TypeScript 5 (`strict`), Vite 5 (Feature-Based Modular Architecture)
- **Backend (`hmi/backend/`):** Python 3.10+, FastAPI, Uvicorn, WebSocket, Pydantic, `itsdangerous`
- **Instrumentation & Hardware:** `pyvisa`, `pyvisa-py`, `nidaqmx`, Astronics Ballard `btidriver` (ARINC 429)
- **Desktop Legacy (`gui/`):** PyQt6, `pyqtgraph`
- **Testing:** `pytest` (backend)

---

## Panduan & Dokumentasi Lengkap

| Dokumen | Deskripsi | Tautan |
| :--- | :--- | :---: |
| **Arsitektur Modular Web HMI** | Struktur feature-based modular, diagram hubungan antar-modul, dan aturan dependency. | [Lihat Dokumen](docs/architecture/modular-architecture.md) |
| **Panduan Pengembangan Tim** | Panduan kerja paralel Standard / CFDS / CMC, shared components, dan Git workflow. | [Lihat Dokumen](docs/development-guide/team-development-guide.md) |
| **Dokumentasi Modul** | Kontrak, public exports, dan endpoint per modul Web HMI. | [Lihat Dokumen](docs/module-documentation/modules-overview.md) |
| **Konfigurasi Perangkat Keras** | Spesifikasi chassis NI PXIe-1071, modul PXIe, instrumen Keysight, pinout, dan konektivitas. | [Lihat Dokumen](docs/hardware_configuration.md) |
| **Panduan Instalasi Driver & OS** | Instalasi kernel HWE, NI Linux 2026 Q3, `btipci.ko`, udev, systemd, dan Python venv. | [Lihat Dokumen](docs/driver_installation_guide.md) |
| **Panduan Pemrograman & API** | Template Python untuk ARINC 429 (`btidriver`), DAQmx, Keysight (`pyvisa`), dan Serial COM. | [Lihat Dokumen](docs/programming_and_api_guide.md) |

---

## Struktur Direktori Proyek

```text
ARINC429/
├── docs/
│   ├── architecture/                  # Diagram & aturan arsitektur modular web HMI
│   ├── development-guide/             # Panduan pengembangan paralel & Git workflow
│   ├── module-documentation/          # Spesifikasi tiap modul web HMI
│   ├── hardware_configuration.md      # Spesifikasi perangkat keras & pinout I/O
│   ├── driver_installation_guide.md   # Panduan teknis instalasi driver & kernel
│   └── programming_and_api_guide.md   # Referensi API & contoh script Python
├── driver/
│   ├── Astronic Ballard/              # Driver BTIDriver (C/C++, Python), BTIKPCI
│   └── NILinux2026Q3DeviceDrivers/    # Paket .deb NI Linux 2026 Q3
├── gui/                               # HMI PyQt6 legacy (fallback desktop)
├── hmi/
│   ├── backend/
│   │   ├── app.py                     # Composition root FastAPI + SPA fallback
│   │   ├── core/                      # Shared auth, lease, runtime, telemetry WS, SPA
│   │   ├── features/
│   │   │   ├── power/                 # Endpoint DCPS/ACPS, E-STOP, sim, rescan
│   │   │   ├── standard/              # Modul Standard Mode (Developer A)
│   │   │   ├── cfds/                  # Modul CFDS Mode (Developer B)
│   │   │   └── cmc/                   # Modul CMC Mode (Developer C)
│   │   ├── ate_power/                 # Driver Keysight SCPI/VISA, safety interlocks, broker
│   │   ├── tests/                     # Test per modul (power, shared, standard, cfds, cmc)
│   │   ├── pyproject.toml
│   │   └── requirements.txt
│   ├── frontend/
│   │   ├── public/                    # Static assets, images, icons
│   │   ├── src/
│   │   │   ├── app/                   # Router, providers, layouts, configuration, App.tsx
│   │   │   ├── features/
│   │   │   │   ├── power-console/     # Konsol aktif Keysight N5746A & AC6803B
│   │   │   │   ├── standard/          # Modul Standard Mode (Developer A)
│   │   │   │   ├── cfds/              # Modul CFDS Mode (Developer B)
│   │   │   │   └── cmc/               # Modul CMC Mode (Developer C)
│   │   │   ├── shared/                # Components, hooks, services, types, constants, utils
│   │   │   ├── styles/                # tokens.css, global.css, index.css
│   │   │   ├── assets/
│   │   │   └── main.tsx
│   │   ├── tests/                     # Direktori test per fitur (power-console, standard, cfds, cmc)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── deploy/ate-power-hmi.service   # systemd unit
├── scripts/
│   ├── install_drivers.sh             # Otomasi kernel HWE, driver NI/Ballard, dan venv
│   ├── verify_drivers.py              # Self-test deteksi hardware & driver
│   └── demo_ate_sequence.py           # Demonstrasi sekuens pengujian ATE
├── launch_web_hmi.sh                  # Launcher Web HMI (Linux / Git Bash)
├── launch_web_hmi.ps1                 # Launcher Web HMI (Windows PowerShell)
├── launch_power_gui.sh                # Launcher HMI desktop PyQt6
├── ATE_Power_Control.desktop
├── pyrightconfig.json
└── README.md
```

---

## Cara Instalasi & Menjalankan Aplikasi

### 1. Instalasi Dependency Web HMI

**Backend (`hmi/backend/`):**
```bash
pip install -r hmi/backend/requirements.txt
```

**Frontend (`hmi/frontend/`):**
```bash
cd hmi/frontend
npm ci
npm run build
```

### 2. Menjalankan Aplikasi (Mode Produksi / Terpadu port `8080`)

- **Linux / Git Bash:**
  ```bash
  ./launch_web_hmi.sh
  ```
- **Windows PowerShell:**
  ```powershell
  .\launch_web_hmi.ps1
  ```
- **Produksi Ubuntu (`systemd`):**
  ```bash
  sudo systemctl enable --now ate-power-hmi.service
  ```

Buka `http://localhost:8080/` (atau `http://<ip-ni-ate>:8080/`).

### 3. Menjalankan Mode Development (Hot Reload)

Terminal 1 — Backend FastAPI:
```bash
cd hmi/backend
python -m uvicorn app:app --reload --host 127.0.0.1 --port 8080
```

Terminal 2 — Frontend Vite (`proxy /api` & `/ws` ke port `8080`):
```bash
cd hmi/frontend
npm run dev
```

### 4. Validasi & Pengujian

```bash
# Frontend TypeScript check & production build
cd hmi/frontend
npm run typecheck
npm run build

# Backend unit & integration tests
cd ../backend
python -m pytest -v
```

---

## Status Deteksi Perangkat Keras & Keamanan HMI

| Komponen / Slot | Model Hardware | Antarmuka | Status Driver & Deteksi |
| :--- | :--- | :--- | :---: |
| **Chassis** | **NI PXIe-1071** (4-Slot 3U) | PCIe Backplane | Terdeteksi (PLX PEX 8725) |
| **Slot 1 (Controller)** | **NI PXIe-8821 Embedded Controller** | Host CPU / Serial RS-232 | Aktif (`ni-ate`, Ubuntu 22.04.5) |
| **Slot 2 (GPIB)** | **NI PXI-GPIB Controller** | IEEE 488 Master | Terdeteksi (`GPIB0::INTFC`) |
| **Slot 3 (Avionics)** | **Astronics Ballard OmniBus® II** | ARINC 429 Dual Core | Terdeteksi (Card 0 / Core A, 2 core PCI) |
| **Slot 4 (DAQ)** | **NI PXIe-6341 Multifunction I/O** | 16 AI, 2 AO, 24 DIO | Terdeteksi (`Dev1`) |
| **Eksternal (1U)** | **Keysight N5746A DC Power Supply** | LXI `10.11.11.11` (VXI-11) | `TCPIP0::10.11.11.11::inst0::INSTR` |
| **Eksternal (3U)** | **Keysight AC6803B AC Power Source** | LXI `10.11.11.12` (HiSLIP) | `TCPIP0::10.11.11.12::hislip0::INSTR` |

- PIN default ada di `.env` sebagai `ATE_HMI_PIN` (fallback bawaan `2468`, bukan password sudo).
- Satu sesi memegang kontrol (*Take control*). Browser lain view-only untuk setpoint/output; **E-STOP tetap aktif** untuk setiap sesi yang sudah login.
- Interlock HV di server: DC > 35 V / AC > 130 Vrms butuh konfirmasi sebelum `OUTP ON`. Setpoint yang menyeberang ke HV saat output hidup menjatuhkan output terlebih dahulu.
- Tanpa instrumen Keysight atau `pyvisa`, driver otomatis berjalan di mode simulasi (`SIM MODE`).

---

## Script Uji & Instalasi Driver Hardware (`ni-ate`)

```bash
source /home/paridit/project/ATE/.venv/bin/activate
python3 /home/paridit/project/ATE/scripts/verify_drivers.py
python3 /home/paridit/project/ATE/scripts/demo_ate_sequence.py

# Instalasi ulang stack driver (jika diperlukan):
sudo bash /home/paridit/project/ATE/scripts/install_drivers.sh
```
