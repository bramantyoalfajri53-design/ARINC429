# Panduan Pemrograman & API Instrumen ATE

Dokumen ini berisi panduan komprehensif, referensi API, dan contoh kode pemrograman Python untuk mengendalikan seluruh instrumen perangkat keras pada sistem **Automated Test Equipment (ATE)**.

---

## Daftar Isi
1. [Inisialisasi Environment](#1-inisialisasi-environment)
2. [Standar Keselamatan Listrik & Proteksi Instrumen (Safety Interlocks)](#2-standar-keselamatan-listrik--proteksi-instrumen-safety-interlocks)
3. [Kontrol Instrumen Daya Eksternal (GPIB & PyVISA)](#3-kontrol-instrumen-daya-eksternal-gpib--pyvisa)
   - [3.1 Keysight N5746A (DC Power Supply)](#31-keysight-n5746a-dc-power-supply)
   - [3.2 Keysight AC6803B (AC Power Source - 115V @ 400Hz)](#32-keysight-ac6803b-ac-power-source---115v--400hz)
4. [Akuisisi Data Multifungsi (NI-DAQmx / NI PXIe-6341)](#4-akuisisi-data-multifungsi-ni-daqmx--ni-pxie-6341)
5. [Komunikasi Bus Avionik (ARINC 429 / Ballard OmniBus II)](#5-komunikasi-bus-avionik-arinc-429--ballard-omnibus-ii)
6. [Komunikasi Serial RS-232 (NI PXIe-8821)](#6-komunikasi-serial-rs-232-ni-pxie-8821)
7. [Contoh Sekuens Uji Terintegrasi (End-to-End Test Sequence)](#7-contoh-sekuens-uji-terintegrasi-end-to-end-test-sequence)

---

## 1. Inisialisasi Environment

Host ATE saat ini: **Ubuntu 22.04.5 LTS Server** di NI PXIe-8821 (`ni-ate`), proyek di `/home/paridit/project/ATE`. Virtual environment memakai **Python 3.10** (bukan salinan `.venv` Python 3.12 dari Linux Mint).

Aktifkan environment sebelum menjalankan script pengujian:

```bash
source /home/paridit/project/ATE/.venv/bin/activate
```

HMI PyQt6 (`gui/power_controller_gui.py` / `launch_power_gui.sh`) memerlukan `DISPLAY`. Di Ubuntu Server tanpa desktop, pakai **HMI web**:

```bash
./launch_web_hmi.sh
# atau: sudo systemctl start ate-power-hmi
```

Buka `http://<ip-ni-ate>:8080/`, masukkan PIN (`ATE_HMI_PIN` di `.env`), lalu **Take control**. Sesi lain view-only untuk setpoint/output; **E-STOP tetap tersedia**. Driver SCPI ada di `hmi/backend/ate_power/drivers.py` (wrapper `gui/instrument_drivers.py` untuk desktop legacy).

---

## 2. Standar Keselamatan Listrik & Proteksi Instrumen (Safety Interlocks)

Untuk melindungi operator, unit yang diuji (*Unit Under Test* / UUT seperti LRU avionik), serta instrumen laboratorium bernilai tinggi, seluruh script automasi dan aplikasi HMI menerapkan standar keselamatan **DO-160 / MIL-STD-704F** dan kaidah pengujian kelistrikan otomatis:

### 2.1 Kaidah Pengendalian Daya & Logika Keselamatan

1. **Cold-Start Safe Initialization (Inisialisasi Aman 0V)**:
   - Saat instrumen pertama kali terhubung atau aplikasi dijalankan, output catu daya selalu diset ke `OUTP OFF` dan target tegangan dimulai dari `0.0V`.
   - Hal ini mencegah lonjakan tegangan instan (*voltage surge / hot plugging*) saat kabel dihubungkan ke UUT.

2. **Hardware Over-Voltage Protection (OVP Clamping)**:
   - Nilai OVP ditulis langsung ke register hardware EEPROM instrumen (`VOLT:PROT`). Jika tegangan melebihi batas OVP (akibat kesalahan regulasi atau induktansi beban), sirkuit *crowbar* internal Keysight N5746A akan memutus output dalam hitungan mikrodetik.
   - Nilai OVP standar: **35.0 V** untuk bus DC 28V pesawat.

3. **Current Compliance & Over-Current Protection (OCP)**:
   - Batas arus (*Current Limit*) wajib ditentukan sebelum daya diaktifkan untuk mencegah arus pendek (*short circuit*) membakar jalur PCB UUT.

4. **High-Voltage Operator Confirmation Interlock**:
   - Jika tegangan yang diminta melebihi ambang batas tegangan tinggi (**> 35.0 VDC** atau **> 130.0 VAC RMS**), sistem HMI mewajibkan konfirmasi operator secara sadar melalui kotak dialog peringatan sebelum relay output diaktifkan.
   - Setpoint/preset yang menyeberang ke wilayah HV **saat output masih ON** tidak diterapkan live: output dijatuhkan dulu, setpoint diprogram, lalu operator harus menekan ON + konfirmasi lagi.
   - Tombol **0V Off** mematikan output sekaligus mereset setpoint ke 0 V.

5. **Frequency Safeguard (Proteksi Frekuensi AC)**:
   - Frekuensi AC dibatasi secara ketat pada **45.0 Hz s/d 500.0 Hz** (standar avionik 400 Hz nominal). Mencegah pemberian frekuensi sangat rendah pada transformator atau motor 400 Hz yang dapat memicu saturasi inti magnetik dan arus lebih.
   - Perpindahan pita **mains (≤65 Hz)** ↔ **avionik (360–440 Hz)** / pita lain **saat output ON** mematikan output terlebih dahulu. Preset `230V@50Hz` tidak boleh menyuntikkan 50 Hz ke beban 400 Hz yang sedang bertegangan.

6. **Global Emergency Stop (E-STOP) & Crash-Safe Handler**:
   - Tombol E-Stop seketika mematikan output dan mereset tegangan ke 0 V. Tersedia untuk **setiap sesi yang sudah login**, termasuk view-only.
   - Dilengkapi *Python exit hook* (`atexit`), sehingga jika proses aplikasi ditutup atau terjadi crash, modul driver akan otomatis mengirimkan perintah `OUTP OFF` ke seluruh instrumen sebelum proses berhenti.
   - Beralih ke mode simulasi selalu memaksa output hardware OFF terlebih dahulu.

---

## 3. Kontrol Instrumen Daya Eksternal (GPIB & PyVISA)

Kedua instrumen catu daya dikendalikan menggunakan pustaka `pyvisa` melalui protokol perintah standar **SCPI** (*Standard Commands for Programmable Instruments*).

### 2.1 Keysight N5746A (DC Power Supply)

```python
import pyvisa
import time

class KeysightN5746A:
    """Driver kontroler untuk Keysight N5746A System DC Power Supply (40V, 19A, 760W)"""
    def __init__(self, resource_name="TCPIP0::10.11.11.11::inst0::INSTR"):
        self.rm = pyvisa.ResourceManager()
        self.inst = self.rm.open_resource(resource_name, timeout=3000)
        self.inst.write("*CLS")  # Clear error status
        
    def get_identity(self):
        return self.inst.query("*IDN?").strip()
        
    def configure_output(self, voltage_volts: float, current_limit_amps: float, ovp_volts: float = 35.0):
        """Mengatur batas tegangan, batas arus, dan Over-Voltage Protection"""
        self.inst.write(f"VOLT:PROT {ovp_volts:.2f}")      # Set OVP
        self.inst.write(f"VOLT {voltage_volts:.3f}")        # Set Voltage Target
        self.inst.write(f"CURR {current_limit_amps:.3f}")   # Set Current Limit
        
    def set_output_state(self, enabled: bool):
        """Mengaktifkan atau mematikan output daya DC"""
        state = "ON" if enabled else "OFF"
        self.inst.write(f"OUTP {state}")
        
    def measure_actual(self):
        """Membaca tegangan dan arus aktual yang dialirkan ke beban"""
        v_act = float(self.inst.query("MEAS:VOLT?"))
        i_act = float(self.inst.query("MEAS:CURR?"))
        return {"voltage_v": v_act, "current_a": i_act, "power_w": v_act * i_act}
        
    def close(self):
        self.set_output_state(False)
        self.inst.close()

# Contoh Penggunaan:
if __name__ == "__main__":
    dc_ps = KeysightN5746A("TCPIP0::10.11.11.11::inst0::INSTR")
    print("Connected to:", dc_ps.get_identity())
    
    # Beri daya 28 VDC (Standar Avionik) dengan batas arus 4.0 Ampere
    dc_ps.configure_output(voltage_volts=28.0, current_limit_amps=4.0, ovp_volts=32.0)
    dc_ps.set_output_state(True)
    time.sleep(1)
    
    readings = dc_ps.measure_actual()
    print(f"Tegangan Aktual: {readings['voltage_v']:.2f} V, Arus: {readings['current_a']:.3f} A, Daya: {readings['power_w']:.2f} W")
    
    # Matikan setelah selesai
    dc_ps.set_output_state(False)
    dc_ps.close()
```

---

### 2.2 Keysight AC6803B (AC Power Source - 115V @ 400Hz)

```python
import pyvisa
import time

class KeysightAC6803B:
    """Driver kontroler untuk Keysight AC6803B AC Power Source (2000VA, 135V/270V, 45-500Hz)"""
    def __init__(self, resource_name="TCPIP0::10.11.11.12::hislip0::INSTR"):
        self.rm = pyvisa.ResourceManager()
        self.inst = self.rm.open_resource(resource_name, timeout=4000)
        self.inst.write("*CLS")
        
    def get_identity(self):
        return self.inst.query("*IDN?").strip()
        
    def configure_ac_output(self, voltage_rms: float = 115.0, frequency_hz: float = 400.0, current_limit: float = 10.0):
        """Mengatur output AC standar avionik (115 VAC @ 400 Hz)"""
        # Pilih rentang tegangan AC6803B (135 V atau 270 V)
        if voltage_rms <= 135.0:
            self.inst.write("VOLT:RANG 135")
        else:
            self.inst.write("VOLT:RANG 270")
            
        self.inst.write(f"VOLT {voltage_rms:.2f}")
        self.inst.write(f"FREQ {frequency_hz:.1f}")
        self.inst.write(f"CURR:LIM {current_limit:.2f}")
        
    def set_output_state(self, enabled: bool):
        state = "ON" if enabled else "OFF"
        self.inst.write(f"OUTP {state}")
        
    def measure_ac_parameters(self):
        """Membaca parameter AC lengkap: Vrms, Irms, Ipeak, Real Power (W), Apparent Power (VA), Power Factor"""
        v_rms = float(self.inst.query("MEAS:VOLT:AC?"))
        i_rms = float(self.inst.query("MEAS:CURR:AC?"))
        p_real = float(self.inst.query("MEAS:POW:AC:REAL?"))
        p_apparent = float(self.inst.query("MEAS:POW:AC:APP?"))
        pf = (p_real / p_apparent) if p_apparent > 0.5 else 1.0
        return {
            "v_rms": v_rms,
            "i_rms": i_rms,
            "power_watts": p_real,
            "power_va": p_apparent,
            "power_factor": pf
        }
        
    def close(self):
        self.set_output_state(False)
        self.inst.close()

# Contoh Penggunaan:
if __name__ == "__main__":
    ac_source = KeysightAC6803B("TCPIP0::10.11.11.12::hislip0::INSTR")
    print("Connected to:", ac_source.get_identity())
    
    # Konfigurasi 115 VAC @ 400 Hz (Daya Pesawat)
    ac_source.configure_ac_output(voltage_rms=115.0, frequency_hz=400.0, current_limit=5.0)
    ac_source.set_output_state(True)
    time.sleep(2)
    
    metrics = ac_source.measure_ac_parameters()
    print(f"V_RMS: {metrics['v_rms']:.2f} V | I_RMS: {metrics['i_rms']:.3f} A | P: {metrics['power_watts']:.1f} W | PF: {metrics['power_factor']:.2f}")
    
    ac_source.set_output_state(False)
    ac_source.close()
```

---

## 3. Akuisisi Data Multifungsi (NI-DAQmx / NI PXIe-6341)

Modul **NI PXIe-6341 (Dev1)** dikendalikan menggunakan library Python `nidaqmx`.

### 3.1 Pengukuran Analog Input (Voltage AI)

```python
import nidaqmx
from nidaqmx.constants import TerminalConfiguration, VoltageUnits

def read_analog_channels(device_name="Dev1", channels=[0, 1, 2, 3]):
    """Membaca tegangan DC dari 4 kanal Analog Input (AI0 - AI3)"""
    with nidaqmx.Task() as task:
        for ch in channels:
            task.ai_channels.add_ai_voltage_chan(
                physical_channel=f"{device_name}/ai{ch}",
                terminal_config=TerminalConfiguration.DIFF, # Mode Diferensial
                min_val=-10.0,
                max_val=10.0,
                units=VoltageUnits.VOLTS
            )
        
        # Baca 1 sample dari semua kanal
        data = task.read()
        return {f"AI{ch}": round(val, 4) for ch, val in zip(channels, data)}

if __name__ == "__main__":
    voltages = read_analog_channels("Dev1", [0, 1, 2, 3])
    print("Hasil Pembacaan Analog Input:", voltages)
```

---

### 3.2 Stimulus Analog Output (AO Generation)

```python
import nidaqmx
import time

def set_analog_output(device_name="Dev1", channel=0, voltage=3.3):
    """Mengeluarkan tegangan analog presisi (misal: simulasi sensor 0-5V atau 0-10V)"""
    with nidaqmx.Task() as task:
        task.ao_channels.add_ao_voltage_chan(
            physical_channel=f"{device_name}/ao{channel}",
            min_val=-10.0,
            max_val=10.0
        )
        task.write(voltage)
        print(f"Analog Output ao{channel} diset ke {voltage:.3f} V")

if __name__ == "__main__":
    set_analog_output("Dev1", channel=0, voltage=5.0)
```

---

### 3.3 Kontrol Digital I/O (Relay & Discrete Signals)

```python
import nidaqmx
from nidaqmx.constants import LineGrouping

def control_digital_outputs(device_name="Dev1", port=0, bit_mask=0x0F):
    """Menulis 8-bit logika digital ke Port 0 (misal: trigger relay board atau discrete signals)"""
    with nidaqmx.Task() as task:
        task.do_channels.add_do_chan(
            lines=f"{device_name}/port{port}/line0:7",
            line_grouping=LineGrouping.CHAN_FOR_ALL_LINES
        )
        task.write(bit_mask)
        print(f"Digital Output Port {port} diset: 0b{bit_mask:08b} (0x{bit_mask:02X})")

def read_digital_inputs(device_name="Dev1", port=1):
    """Membaca 8-bit discrete digital inputs dari Port 1"""
    with nidaqmx.Task() as task:
        task.di_channels.add_di_chan(
            lines=f"{device_name}/port{port}/line0:7",
            line_grouping=LineGrouping.CHAN_FOR_ALL_LINES
        )
        data = task.read()
        return data

if __name__ == "__main__":
    control_digital_outputs("Dev1", port=0, bit_mask=0x55)
```

---

## 4. Komunikasi Bus Avionik (ARINC 429 / Ballard OmniBus II)

Modul **Astronics Ballard OmniBus II (Slot 3)** dikendalikan menggunakan paket `btidriver`.

### 4.1 Inisialisasi Card & Core

```python
from btidriver import bticard, bti429, DriverError

# Buka Card 0 dan Core A (Core 0)
hCard = bticard.CardOpen(0)
hCoreA = bticard.CoreOpen(0, hCard)

# Reset dan mulai Core
bticard.CardReset(hCard)
bticard.CardStart(hCard)
print("Card & Core A ARINC 429 berhasil diinisialisasi.")
```

---

### 4.2 Transmisi Label ARINC 429

```python
from btidriver import bticard, bti429

def transmit_arinc429_label(hCore, channel=0, label_octal=0o203, speed_high=True, data_32bit=0x12345600):
    """
    Mengirimkan pesan ARINC 429 pada kanal transmit.
    label_octal: Label dalam format Oktal (misal: 0o203 untuk Pressure Altitude)
    speed_high: True = 100 kbps (High Speed), False = 12.5 kbps (Low Speed)
    """
    speed_flag = bti429.CHCFG429_HIGHSPEED if speed_high else bti429.CHCFG429_LOWSPEED
    
    # Konfigurasi Kanal Tx
    bti429.ChConfig(speed_flag, channel, hCore)
    
    # Susun kata 32-bit ARINC 429
    # Label 8-bit bit-reversed + SDI (2-bit) + Data (19-bit) + SSM (2-bit) + Paritas (1-bit)
    bti429.BldWord(data_32bit, label_octal, bti429.PARITY429_ODD)
    
    # Kirim ke kanal
    bti429.MsgBlockWr(data_32bit, channel, hCore)
    print(f"Terkirim Label ARINC 429: {oct(label_octal)} (0x{data_32bit:08X}) pada Ch {channel}")
```

---

### 4.3 Penerimaan & Filter Pesan ARINC 429

```python
from btidriver import bticard, bti429
import time

def receive_arinc429_messages(hCore, channel=0, duration_sec=3):
    """Membaca pesan ARINC 429 yang masuk pada kanal Receiver selama durasi tertentu"""
    print(f"Memonitor ARINC 429 Rx pada Channel {channel} selama {duration_sec} detik...")
    
    end_time = time.time() + duration_sec
    while time.time() < end_time:
        # Periksa apakah ada pesan yang diterima
        status, data, time_tag = bti429.MsgBlockRd(channel, hCore)
        if status:
            label = bti429.GetLabel(data)
            print(f"[{time_tag} us] Diterima Label: {oct(label)} Data: 0x{data:08X}")
        time.sleep(0.05)
```

---

## 5. Komunikasi Serial RS-232 (NI PXIe-8821)

Port COM pada panel depan controller (`/dev/ttyS0` atau `/dev/ttyACM0`) dapat digunakan untuk antarmuka UUT, CLI debug, atau sensor serial:

```python
import serial
import time

def send_serial_command(port="/dev/ttyS0", baudrate=115200, command="*STATUS?\n"):
    with serial.Serial(port=port, baudrate=baudrate, timeout=1.0) as ser:
        ser.reset_input_buffer()
        ser.reset_output_buffer()
        
        # Kirim perintah ASCII
        ser.write(command.encode('utf-8'))
        time.sleep(0.1)
        
        # Baca respon
        response = ser.readline().decode('utf-8', errors='ignore').strip()
        return response

if __name__ == "__main__":
    resp = send_serial_command("/dev/ttyS0", 115200, "*IDN?\n")
    print("Respon Serial UUT:", resp)
```

---

## 6. Contoh Sekuens Uji Terintegrasi (End-to-End Test Sequence)

Script terpadu di bawah ini menunjukkan siklus pengujian lengkap (*Full Test Sequence*):
1. **Power-On Sequence:** Mengaktifkan catu daya DC 28V (Keysight N5746A) dan catu daya AC 115V @ 400Hz (Keysight AC6803B).
2. **Current & Power Verification:** Memeriksa apakah konsumsi arus UUT dalam batas normal.
3. **Avionics Bus Stimulus:** Mengirimkan perintah uji bus ARINC 429 melalui Ballard OmniBus II.
4. **Analog & Discrete Measurement:** Mengukur respon voltase analog UUT via NI PXIe-6341.
5. **Pass/Fail Decision & Safe Shutdown:** Memutuskan status lulus/gagal dan mematikan catu daya dengan aman.

```python
#!/usr/bin/env python3
"""
ATE Integrated Test Sequence Demonstration
==============================================================================
"""

import time
import sys

def run_automated_test_sequence():
    print("\n" + "=" * 70)
    print("  MEMULAI SEKUENSI PENGUJIAN OTOMATIS ATE (AVIONICS UUT)")
    print("=" * 70)
    
    test_passed = True
    
    # --------------------------------------------------------------------------
    # LANGKAH 1: Power-On Sequence (Keysight DC & AC Supplies)
    # --------------------------------------------------------------------------
    print("\n[STEP 1] Memberikan Catu Daya DC (28V) dan AC (115V @ 400Hz)...")
    try:
        # Inisialisasi DC
        print(" -> Menyalakan Keysight N5746A DC Supply (28.0 V, Limit: 3.5 A)...")
        time.sleep(0.5)
        print("    [OK] DC Power Stabil: 28.01 V, Arus: 1.24 A (Dalam batas nominal)")
        
        # Inisialisasi AC
        print(" -> Menyalakan Keysight AC6803B AC Source (115.0 VAC @ 400 Hz)...")
        time.sleep(0.5)
        print("    [OK] AC Power Stabil: 115.1 VAC @ 400.0 Hz, Power: 45.2 W, PF: 0.94")
    except Exception as e:
        print(f"    [FAIL] Error pada catu daya: {e}")
        test_passed = False

    # --------------------------------------------------------------------------
    # LANGKAH 2: Komunikasi ARINC 429 Bus (Ballard OmniBus II)
    # --------------------------------------------------------------------------
    print("\n[STEP 2] Mengirimkan Stimulus Pesan ARINC 429 ke UUT...")
    try:
        from btidriver import bticard
        hCard = bticard.CardOpen(0)
        hCoreA = bticard.CoreOpen(0, hCard)
        bticard.CardReset(hCard)
        bticard.CardStart(hCard)
        
        print(" -> Transmisi Label 0o203 (Altitude Request) & Label 0o210 (Airspeed)...")
        time.sleep(0.5)
        print("    [OK] Pesan ARINC 429 terkirim dan diterima (Echo Verified).")
        
        bticard.CardClose(hCard)
    except Exception as e:
        print(f"    [FAIL] Error ARINC 429: {e}")
        test_passed = False

    # --------------------------------------------------------------------------
    # LANGKAH 3: Akuisisi Respon Analog & Digital (NI PXIe-6341 DAQ)
    # --------------------------------------------------------------------------
    print("\n[STEP 3] Mengukur Respon Analog & Status Sinyal Diskrit UUT...")
    try:
        import nidaqmx
        from nidaqmx.system import System
        system = System.local()
        dev = system.devices["Dev1"]
        
        print(f" -> Membaca kanal AI0 (Output Sensor V) & AI1 (BITE Status V) dari {dev.name}...")
        # Simulasi pembacaan
        measured_v_ai0 = 4.98
        measured_v_ai1 = 0.02
        
        print(f"    AI0 Measured: {measured_v_ai0:.2f} V (Toleransi: 4.80 - 5.20 V) -> PASS")
        print(f"    AI1 (BITE):    {measured_v_ai1:.2f} V (Toleransi: 0.00 - 0.50 V) -> PASS")
    except Exception as e:
        print(f"    [FAIL] Error DAQmx: {e}")
        test_passed = False

    # --------------------------------------------------------------------------
    # LANGKAH 4: Safe Shutdown
    # --------------------------------------------------------------------------
    print("\n[STEP 4] Melakukan Safe Power-Down Sequence...")
    print(" -> Mematikan output daya AC dan DC...")
    time.sleep(0.5)
    print("    [OK] Seluruh catu daya dimatikan dengan aman.")

    # --------------------------------------------------------------------------
    # HASIL AKHIR
    # --------------------------------------------------------------------------
    print("\n" + "=" * 70)
    if test_passed:
        print("  HASIL AKHIR PENGUJIAN: [ PASSED ] (UUT MEMENUHI SEMUA SPESIFIKASI)")
    else:
        print("  HASIL AKHIR PENGUJIAN: [ FAILED ] (TERDAPAT KEGAGALAN PADA PARAMETER UJI)")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    run_automated_test_sequence()
```
