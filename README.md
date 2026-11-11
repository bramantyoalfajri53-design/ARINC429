# Automated Test Equipment (ATE) System

Repositori ini berisi dokumentasi teknis, modul driver, script instalasi otomatis, dan pustaka pemrograman untuk sistem **Automated Test Equipment (ATE)** berbasis platform National Instruments (NI) PXI Express, instrumentasi avionik ARINC 429, serta instrumen catu daya programmable **Keysight** via **LXI (LAN)** dengan GPIB sebagai cadangan.

**Host saat ini:** NI PXIe-8821 (`ni-ate`) — **Ubuntu 22.04.5 LTS Server**, kernel **6.8.0-138-generic** (HWE), user `paridit`, proyek di `/home/paridit/project/ATE`.

---

## 📚 Panduan & Dokumentasi Lengkap

| Dokumen | Deskripsi | Tautan |
| :--- | :--- | :---: |
| **Konfigurasi Perangkat Keras** | Spesifikasi chassis NI PXIe-1071, modul PXIe internal, instrumen daya Keysight, pinout, dan diagram konektivitas. | [Lihat Dokumen](docs/hardware_configuration.md) |
| **Panduan Instalasi Driver & OS** | Instalasi kernel HWE, repositori NI Ubuntu 22.04, kompilasi `btipci.ko` (gcc-12), udev, systemd, dan Python venv. | [Lihat Dokumen](docs/driver_installation_guide.md) |
| **Panduan Pemrograman & API** | Template Python untuk ARINC 429 (`btidriver`), DAQmx (`nidaqmx`), catu daya Keysight (`pyvisa`), dan Serial COM. | [Lihat Dokumen](docs/programming_and_api_guide.md) |

---

## 🛠️ Struktur Direktori Proyek

```
ATE/
├── docs/
│   ├── hardware_configuration.md      # Spesifikasi perangkat keras & pinout I/O
│   ├── driver_installation_guide.md   # Panduan teknis instalasi driver & kernel modules
│   └── programming_and_api_guide.md   # Referensi API & contoh script pengujian Python
├── driver/
│   ├── Astronic Ballard/              # Driver BTIDriver (C/C++, Python), BTIKPCI
│   └── NILinux2026Q3DeviceDrivers/    # Paket repositori .deb NI Linux 2026 Q3 (22.04 & 24.04)
├── gui/                               # HMI PyQt6 legacy (fallback desktop)
├── hmi/
│   ├── backend/                       # FastAPI + LXI/GPIB broker
│   ├── frontend/                      # SPA React/TS (build → dist)
│   └── deploy/ate-power-hmi.service   # systemd unit
├── scripts/
│   ├── install_drivers.sh             # Otomasi kernel HWE, driver NI/Ballard, dan venv
│   ├── verify_drivers.py              # Self-test deteksi hardware & driver
│   └── demo_ate_sequence.py           # Demonstrasi sekuens pengujian ATE
├── launch_web_hmi.sh                  # Launcher HMI web (port 8080)
├── launch_power_gui.sh                # Launcher HMI desktop PyQt6 (memerlukan DISPLAY)
├── ATE_Power_Control.desktop          # Shortcut desktop legacy
└── README.md
```

---

## ⚡ Status Deteksi Perangkat Keras

Status di bawah sesuai verifikasi terakhir di host `ni-ate` (kernel 6.8 HWE, driver NI 2026 Q3 + `btipci` terpasang).

| Komponen / Slot | Model Hardware | Antarmuka | Status Driver & Deteksi |
| :--- | :--- | :--- | :---: |
| **Chassis** | **NI PXIe-1071** (4-Slot 3U) | PCIe Backplane | Terdeteksi (PLX PEX 8725) |
| **Slot 1 (Controller)** | **NI PXIe-8821 Embedded Controller** | Host CPU / Serial RS-232 | Aktif (`ni-ate`, Ubuntu 22.04.5) |
| **Slot 2 (GPIB)** | **NI PXI-GPIB Controller** | IEEE 488 Master | Terdeteksi (`GPIB0::INTFC`) |
| **Slot 3 (Avionics)** | **Astronics Ballard OmniBus® II** | ARINC 429 Dual Core | Terdeteksi (Card 0 / Core A, 2 core PCI) |
| **Slot 4 (DAQ)** | **NI PXIe-6341 Multifunction I/O** | 16 AI, 2 AO, 24 DIO | Terdeteksi (`Dev1`) |
| **Eksternal (1U)** | **Keysight N5746A DC Power Supply** | LXI `10.11.11.11` (VXI-11) | `TCPIP0::10.11.11.11::inst0::INSTR` |
| **Eksternal (3U)** | **Keysight AC6803B AC Power Source** | LXI `10.11.11.12` (HiSLIP) | `TCPIP0::10.11.11.12::hislip0::INSTR` |

---

## HMI Power Console (Web)

Konsol utama untuk **Keysight N5746A (DCPS)** dan **Keysight AC6803B (ACPS)** adalah aplikasi web di host `ni-ate` (port **8080**). Satu proses Python memegang sesi VISA LXI; browser di LAN lab masuk dengan PIN. Host LXI di `.env`: `ATE_DC_LXI_HOST` / `ATE_AC_LXI_HOST`.

```bash
# Manual:
./launch_web_hmi.sh

# Produksi (systemd):
sudo systemctl enable --now ate-power-hmi.service
```

Buka `http://<ip-ni-ate>:8080/`

- PIN default ada di `.env` sebagai `ATE_HMI_PIN` (bukan password sudo).
- Satu sesi memegang kontrol (Take control). Browser lain view-only untuk setpoint/output; **E-STOP tetap aktif** untuk setiap sesi yang sudah login.
- Interlock HV di server: DC > 35 V / AC > 130 Vrms butuh konfirmasi sebelum OUTP ON. Setpoint yang menyeberang ke HV saat output hidup menjatuhkan output dulu.
- Tanpa instrumen Keysight, driver otomatis ke mode simulasi.
- HMI desktop PyQt6 tetap ada (`./launch_power_gui.sh`) sebagai fallback jika ada DISPLAY.

---

## 🚀 Cara Menjalankan Script Uji & Demonstrasi

```bash
# 1. Aktifkan environment Python ATE (Python 3.10 di Ubuntu 22.04):
source /home/paridit/project/ATE/.venv/bin/activate

# 2. Pemeriksaan kesehatan hardware dan driver:
python3 /home/paridit/project/ATE/scripts/verify_drivers.py

# 3. Demonstrasi sekuens pengujian ATE:
python3 /home/paridit/project/ATE/scripts/demo_ate_sequence.py
```

Instalasi ulang stack driver (jika diperlukan):

```bash
sudo bash /home/paridit/project/ATE/scripts/install_drivers.sh
```
