# Konfigurasi Perangkat Keras ATE (Automated Test Equipment)

Dokumen ini menjelaskan spesifikasi lengkap dan arsitektur perangkat keras sistem **Automated Test Equipment (ATE)**, mencakup chassis PXIe, modul-modul instrumentasi internal, serta instrumen catu daya eksternal (*Power Supplies*) yang terhubung melalui antarmuka **GPIB (IEEE 488)**.

---

## 1. Ikhtisar Sistem (System Overview)

Sistem ATE ini menggabungkan platform komputasi dan akuisisi data modular **NI PXI Express** dengan instrumen catu daya berkapasitas tinggi **Keysight** untuk pengujian avionik (*Avionics Unit Under Test / UUT*).

Controller Slot 1 (NI PXIe-8821) sekarang menjalankan **Ubuntu 22.04.5 LTS Server** (hostname `ni-ate`, kernel HWE `6.8.0-138-generic`). Stack software dan path proyek: lihat [Panduan Instalasi Driver](driver_installation_guide.md).

```
+----------------------------------------------------------------------------------------------------+
|                                         ATE SYSTEM ARCHITECTURE                                    |
+----------------------------------------------------------------------------------------------------+
| [ RACK INSTRUMENTASI PXIe ]                                                                        |
|  +-----------------------------------------------------------------------------------------------+ |
|  |                                      NI PXIe-1071 Chassis                                     | |
|  +--------------------+--------------------+-----------------------+-----------------------------+ |
|  |       SLOT 1       |       SLOT 2       |        SLOT 3         |           SLOT 4            | |
|  | (Controller Slot)  |   (Hybrid Slot)    |     (Hybrid Slot)     |        (Hybrid Slot)        | |
|  |                    |                    |                       |                             | |
|  |    NI PXIe-8821    |    NI PXI-GPIB     |   Astronics Ballard   |        NI PXIe-6341         | |
|  | Embedded Controll. |  GPIB Controller   |      OmniBus® II      |      Multifunction I/O      | |
|  |                    |                    |     (ARINC 429)       |           (DAQ)             | |
|  +--------------------+---------+----------+-----------------------+-----------------------------+ |
|                                 |                                                                  |
|                                 | [ GPIB Bus Cable (IEEE 488) ]                                    |
|                                 v                                                                  |
| [ RACK POWER INSTRUMENTATION (KEYSIGHT) ]                                                          |
|  +-----------------------------------------------------------------------------------------------+ |
|  |  [1U] Keysight N5746A System DC Power Supply (40V / 19A, 760W) - GPIB / LXI                     | |
|  +-----------------------------------------------------------------------------------------------+ |
|  |  [3U] Keysight AC6803B Basic AC Power Source (2000VA / 2kVA, 135V/270V, 45-500Hz) - GPIB / LXI | |
|  +-----------------------------------------------------------------------------------------------+ |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Spesifikasi Detail Chassis

| Parameter | Spesifikasi |
| :--- | :--- |
| **Model** | **NI PXIe-1071** |
| **Pabrikan** | National Instruments (NI) |
| **Tipe Chassis** | 4-Slot 3U PXI Express Chassis |
| **Bandwidth Sistem** | Hingga 3 GB/s total system bandwidth (Dedicated PCI Express links) |
| **Konfigurasi Slot** | • 1x System Controller Slot (Slot 1)<br>• 3x PXIe Hybrid Slots (Slot 2, 3, 4 - mendukung modul PXI, PXI Express, dan CompactPCI) |
| **Sistem Pendingin** | Fan pendingin terintegrasi dengan intake di panel depan kiri |
| **Kontrol Daya** | Push-button power switch dengan indikator LED di panel depan kiri |

---

## 3. Rincian Modul PXIe Internal (Per Slot)

### Slot 1: NI PXIe-8821 (Embedded Controller)
*Komputer industri terintegrasi yang bertindak sebagai Master Controller sistem ATE.*

- **Model:** NI PXIe-8821
- **Pabrikan:** National Instruments
- **Tipe Slot:** PXI Express System Controller Slot (Slot 1)
- **Host OS (saat ini):** Ubuntu 22.04.5 LTS Server, hostname `ni-ate`, user `paridit`
- **Kernel:** `6.8.0-138-generic` (HWE) dengan `iommu=pt`
- **Fitur & Port I/O Panel Depan:**
  - **Serial COM (`|O|O|`):** 1x Port Serial RS-232 (DB-9 Male) untuk komunikasi periferal/UUT.
  - **USB 2.0:** 2x Port USB 2.0 (Hitam) untuk mouse, keyboard, dan perangkat USB standar.
  - **USB 3.0 (`SS`):** 2x Port USB 3.0 SuperSpeed (Biru) untuk transfer data berkecepatan tinggi.
  - **Display (`DP`):** 1x DisplayPort untuk output monitor eksternal.
  - **Ethernet LAN (`ACT/LINK`):** 1x RJ-45 Gigabit Ethernet (10/100/1000 Mbps).
  - **Trigger Port (`TRIG`):** 1x Konektor SMA untuk input/output sinyal clock & trigger eksternal.
  - **Tombol Kontrol:** 1x Recessed Reset Pushbutton.
  - **Indikator LED Status:**
    - `USER1` / `USER2`: LED indikator yang dapat diprogram pengguna.
    - `PWR OK / FAULT`: Indikator daya dan status error hardware (Hijau = OK, Merah/Kuning = Fault).
    - `DRIVE`: Indikator aktivitas penyimpanan data / drive.

---

### Slot 2: NI PXI-GPIB (Instrument Controller Interface)
*Modul antarmuka kontroler GPIB (IEEE 488) untuk mengendalikan instrumen eksternal.*

- **Model:** NI PXI-GPIB
- **Pabrikan:** National Instruments
- **PCI ID:** `1093:c821`
- **Tipe Slot:** PXI Hybrid Slot (Slot 2)
- **Resource VISA:** `GPIB0::INTFC` (instrumen Keysight tampil sebagai `GPIB0::<addr>::INSTR` setelah daya instrumen menyala)
- **Konektor:** Standard 24-Pin IEEE 488 (GPIB Micro-D connector dengan screw lock)
- **Fungsi Utama:**
  - Menjadi master bus GPIB untuk mengontrol instrumen catu daya eksternal (**Keysight N5746A** dan **Keysight AC6803B**) via perintah SCPI (*Standard Commands for Programmable Instruments*).
  - Kecepatan transfer hingga 1.5 MB/s (IEEE 488.1) atau hingga 8 MB/s (HS488).

---

### Slot 3: Astronics Ballard Technology OmniBus® II (Avionics Databus Interface)
*Modul interface bus data avionik modular multi-protokol.*

- **Model:** Astronics Ballard Technology OmniBus® II
- **Pabrikan:** Astronics Ballard Technology
- **PCI ID:** `1bd0:1103` × 2 (Core A dan Core B)
- **Tipe Slot:** PXI / cPCI Hybrid Slot (Slot 3)
- **Device node:** `/dev/bti-pcim.0`, `/dev/bti-pcim.1`
- **Protokol:** **ARINC 429** (Transmitter & Receiver avionik komersial/militer).
- **Arsitektur:** Dual-Core Architecture (`CORE A` & `CORE B`).
- **Konektor & Indikator:**
  - `CORE A`: High-Density Multi-pin D-sub Interface Connector.
  - `CORE B`: High-Density Multi-pin D-sub Interface Connector.
  - `P1` / `P2` LEDs: Indikator status aktivitas Core A dan Core B.
- **Fungsi Utama:**
  - Simulasi bus komunikasi avionik, pembacaan data label ARINC 429, serta pengujian protokol UUT.

---

### Slot 4: NI PXIe-6341 (Multifunction DAQ)
*Modul akuisisi data multifungsi (X Series DAQ) berkecepatan tinggi.*

- **Model:** NI PXIe-6341
- **Pabrikan:** National Instruments
- **PCI ID:** `1093:c4c4` (subsystem `1093:742a`)
- **Nama DAQmx:** `Dev1`
- **Tipe Slot:** PXI Express Hybrid Slot (Slot 4)
- **Konektor:** 1x 68-pin VHDCI Connector (`CONNECTOR 0 (AI 0 to 15)`)
- **Spesifikasi Utama:**
  - **Analog Input (AI):** 16 Kanal Single-Ended / 8 Kanal Differential (16-bit, 500 kS/s).
  - **Analog Output (AO):** 2 Kanal (16-bit, 900 kS/s).
  - **Digital I/O (DIO):** 24 Jalur bidirectional hardware-timed.
  - **Counter/Timers:** 4x 32-bit counter/timer untuk pengukuran frekuensi, PWM, event counting.

---

## 4. Instrumen Eksternal (Terhubung via GPIB)

Kedua instrumen catu daya terpasang pada rak instrumen dan terhubung langsung ke modul **NI PXI-GPIB (Slot 2)** menggunakan kabel bus GPIB (daisy-chain IEEE 488).

```
+-----------------------------------------------------------------------------------+
|                           KEYSIGHT EXTERNAL INSTRUMENTS                           |
+-----------------------------------------------------------------------------------+
|  [1U] Keysight N5746A System DC Power Supply (40V / 19A, 760W)                     |
|       [VOLTAGE knob] [DC VOLTS: 88.88] [DC AMPS: 88.88] [CURRENT knob] [488 LED]  |
+-----------------------------------------------------------------------------------+
|  [3U] Keysight AC6803B AC Power Source (2000VA / 2kVA, 135V/270V, 45-500Hz)       |
|       [Graphic Display LCD] [Keypad 0-9] [Meter / Menu / Voltage / Freq / Select] |
+-----------------------------------------------------------------------------------+
```

### 1. Keysight N5746A — System DC Power Supply (1U)

- **Model:** Keysight N5746A
- **Pabrikan:** Keysight Technologies
- **Form Factor:** 1U Rackmount
- **Tipe Perangkat:** Programmable DC Power Supply
- **Kapasitas Output:**
  - **Tegangan Output:** 0 – 40 V DC
  - **Arus Output:** 0 – 19 A DC
  - **Daya Maksimum:** 760 Watt
- **Fitur & Panel Depan:**
  - Knop putar *Rotary Encoder* terpisah untuk **VOLTAGE** dan **CURRENT** (dengan mode *FINE* tuning).
  - Dual 7-segment digital display: `DC VOLTS` dan `DC AMPS`.
  - Mode Operasi: *Constant Voltage* (CV) & *Constant Current* (CC).
  - Fitur Proteksi: *Over-Voltage Protection* (OVP), *Over-Current Protection* (OCP), *Under-Voltage Limit* (UVL), dan *Over-Temperature Protection* (PROT).
  - Indikator Status: `PROT`, `FINE`, `LIMIT/M`, `OVP/UVL`, `OCP/488` (LED 488 menyala saat aktif di GPIB), `LAN`, `OUT ON`.
- **Antarmuka Kontrol (aktif di rak ini):** **LAN / LXI** — N5746A `10.11.11.11` (VXI-11), AC6803B `10.11.11.12` (HiSLIP). GPIB tetap cadangan.
  - GPIB (IEEE 488)
  - LAN / Ethernet (LXI Core compliant)
  - USB 2.0
- **Fungsi dalam ATE:**
  - Menyediakan sumber daya DC programmable (misal 28 VDC daya standar avionik pesawat) untuk memberi daya pada UUT dan mengukur konsumsi arus secara presisi.

---

### 2. Keysight AC6803B — Basic AC Power Source (3U)

- **Model:** Keysight AC6803B
- **Pabrikan:** Keysight Technologies
- **Form Factor:** 3U Rackmount
- **Tipe Perangkat:** Programmable AC Power Source
- **Kapasitas Output:**
  - **Daya Output:** **2000 VA (2 kVA)**
  - **Rentang Tegangan Rendah (Low Range):** 1 – 135 V AC RMS, Arus hingga 20 A RMS
  - **Rentang Tegangan Tinggi (High Range):** 2 – 270 V AC RMS, Arus hingga 10 A RMS
  - **Rentang Frekuensi:** **45 Hz hingga 500 Hz** (Mendukung pengujian frekuensi **400 Hz** standar kelistrikan avionik pesawat).
- **Fitur & Panel Depan:**
  - Layar grafis LCD untuk menampilkan pengukuran tegangan (Vrms), arus (Irms, Ipeak), daya aktif (W), daya semu (VA), dan faktor daya (*Power Factor* / PF).
  - Keypad numerik lengkap (`0-9`, `.`, `E`, `Enter`) untuk pengaturan nilai cepat.
  - Tombol fungsi langsung: `Meter`, `Menu`, `Protect`, `Back`, `Voltage`, `Freq`, `On/Off`, dan tombol navigasi arah (*Arrow pad & Select*).
  - Indikator Status: `Protect` LED dan `Output` LED dengan label peringatan tegangan tinggi.
- **Antarmuka Kontrol (aktif di rak ini):** **LAN / LXI** — AC6803B `10.11.11.12` (HiSLIP). GPIB tetap cadangan.
  - GPIB (IEEE 488)
  - LAN / Ethernet (LXI compliant)
  - USB
- **Fungsi dalam ATE:**
  - Mensimulasikan sumber daya AC avionik (misalnya **115 VAC @ 400 Hz**) untuk pengujian unit avionik/LRU (*Line Replaceable Unit*), serta uji toleransi fluktuasi frekuensi/tegangan AC.

---

## 5. Matriks Ringkasan Pemetaan Hardware & Antarmuka

| No | Unit / Modul | Pabrikan & Model | Lokasi Fisik | Antarmuka Kontrol | Peran / Fungsi Utama |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Chassis** | NI PXIe-1071 | Main Rack | PCIe Backplane | Chassis 4-slot modular 3U |
| 2 | **Embedded Controller** | NI PXIe-8821 | PXIe Slot 1 | PCIe Host / OS | CPU Host, DP, LAN, Serial RS-232, USB |
| 3 | **GPIB Controller** | NI PXI-GPIB | PXIe Slot 2 | IEEE 488 Master | Master komunikasi bus GPIB |
| 4 | **Avionics Databus** | Astronics OmniBus® II | PXIe Slot 3 | PCIe / cPCI | Interface ARINC 429 (Core A & B) |
| 5 | **Multifunction DAQ** | NI PXIe-6341 | PXIe Slot 4 | PCIe (DAQmx) | 16 AI, 2 AO, 24 DIO, 4 Timer/Counter |
| 6 | **System DC Supply** | Keysight N5746A | Eksternal (1U) | **LXI** `TCPIP0::10.11.11.11::inst0::INSTR` (GPIB cadangan) | DC Power: 0-40V / 0-19A (760W) |
| 7 | **AC Power Source** | Keysight AC6803B | Eksternal (3U) | **LXI HiSLIP** `TCPIP0::10.11.11.12::hislip0::INSTR` (GPIB cadangan) | AC Power: 115V/230V, 400Hz (2 kVA) |

---

## 6. Kebutuhan Driver & Software Stack

### 1. Driver Instrumen & DAQ (National Instruments)
- **NI-488.2:** Driver untuk modul NI PXI-GPIB (pengendali bus GPIB).
- **NI-VISA:** Virtual Instrument Software Architecture API untuk komunikasi SCPI ke instrumen Keysight via GPIB.
- **NI-DAQmx:** Driver untuk modul akuisisi data NI PXIe-6341.
- **NI-Serial:** Driver untuk port serial RS-232 pada NI PXIe-8821.
- *Installer tersedia di repository:* `driver/NILinux2026Q3DeviceDrivers/` — di host Ubuntu 22.04 pakai `ni-ubuntu2204-drivers-2026Q3.deb` (bukan paket 24.04).

### 2. Driver Avionik (Astronics Ballard)
- **BTIDriver:** Pustaka C/C++ dan Python untuk protokol ARINC 429 pada OmniBus II.
- **Astronics Ballard LabVIEW Driver:** Paket integrasi VI LabVIEW.
- *Installer & library tersedia di repository:* `driver/Astronic Ballard/`.

### 3. Contoh Kontrol Instrumen GPIB via Python (`pyvisa`)

```python
import pyvisa

# Inisialisasi Resource Manager NI-VISA
rm = pyvisa.ResourceManager()

# Membuka koneksi LXI ke DC Power Supply (Keysight N5746A)
dc_ps = rm.open_resource("TCPIP0::10.11.11.11::inst0::INSTR")
print("DC Supply ID:", dc_ps.query("*IDN?"))

# Mengatur tegangan 28V DC dan batas arus 5A
dc_ps.write("VOLT 28.0")
dc_ps.write("CURR 5.0")
dc_ps.write("OUTP ON")

# Membuka koneksi LXI ke AC Power Source (Keysight AC6803B)
ac_source = rm.open_resource("TCPIP0::10.11.11.12::hislip0::INSTR")
print("AC Source ID:", ac_source.query("*IDN?"))

# Mengatur tegangan AC 115V @ 400 Hz (Standar Avionik)
ac_source.write("VOLT 115.0")
ac_source.write("FREQ 400.0")
ac_source.write("OUTP ON")
```

---

## 7. Diagram Alur Konektivitas Sistem Terintegrasi

```mermaid
graph TD
    subgraph PXIe_Chassis ["NI PXIe-1071 Chassis"]
        Controller["Slot 1: NI PXIe-8821<br>(Embedded Controller / Host PC)"]
        GPIB_Card["Slot 2: NI PXI-GPIB<br>(IEEE 488 Controller)"]
        Avionics_Card["Slot 3: Ballard OmniBus II<br>(ARINC 429 Core A & B)"]
        DAQ_Card["Slot 4: NI PXIe-6341<br>(Multifunction DAQ)"]

        Controller ---|PCIe Bus| GPIB_Card
        Controller ---|PCIe Bus| Avionics_Card
        Controller ---|PCIe Bus| DAQ_Card
    end

    subgraph LXI_Rack ["Catu Daya Eksternal (LXI / LAN)"]
        DC_Supply["Keysight N5746A<br>10.11.11.11 VXI-11<br>(40V / 19A, 760W)"]
        AC_Supply["Keysight AC6803B<br>10.11.11.12 HiSLIP<br>(2000VA, 115V/230V, 400Hz)"]
        
        Controller ==>|Ethernet LXI| DC_Supply
        Controller ==>|Ethernet LXI| AC_Supply
    end

    subgraph UUT_Section ["Unit Under Test (UUT) / Avionics LRU"]
        UUT["Avionics LRU / Unit Under Test"]
    end

    subgraph Peripherals ["Antarmuka Operator & Sensor"]
        Operator["Host Ubuntu 22.04 Server (ni-ate)<br>DP / SSH / LAN — HMI PyQt6 opsional"]
        Sensors_Wiring["Breakout Box / Sensor I/O Wiring"]
    end

    Controller -->|DP, USB, RJ45| Operator
    DC_Supply -.->|28 VDC Power Line| UUT
    AC_Supply -.->|115 VAC 400Hz Power Line| UUT
    Avionics_Card <-->|ARINC 429 Tx / Rx Bus| UUT
    DAQ_Card <-->|VHDCI 68-Pin (AI/AO/DIO)| Sensors_Wiring
    Sensors_Wiring <-->|Discrete Stimulus & Sense| UUT
```
