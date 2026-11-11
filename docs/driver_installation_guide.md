# Panduan Instalasi Driver & Software Stack ATE

Dokumen ini berisi panduan teknis instalasi, kompilasi modul kernel, konfigurasi *system services*, dan penyiapan *runtime environment* untuk sistem **Automated Test Equipment (ATE)**.

**Kondisi host saat ini (sudah terpasang):**

| Parameter | Nilai |
| :--- | :--- |
| Hostname | `ni-ate` (NI PXIe-8821) |
| OS | Ubuntu 22.04.5 LTS Server (Jammy) |
| Kernel | `6.8.0-138-generic` (HWE; syarat NI 2026 Q3: ≥ 6.5) |
| IOMMU | Passthrough (`iommu=pt` di cmdline) |
| User / path proyek | `paridit` / `/home/paridit/project/ATE` |
| Python venv | `.venv` dengan **Python 3.10** |
| Paket NI | NI Linux Device Drivers **2026 Q3** via `ni-ubuntu2204-drivers-2026Q3.deb` |

> Repositori ini sebelumnya dikembangkan di Linux Mint / Ubuntu 24.04. Host produksi sekarang **Ubuntu 22.04 Server**. Jangan memakai paket `ni-ubuntu2404-*.deb` di mesin ini.

Cara termudah memasang ulang seluruh stack:

```bash
sudo bash /home/paridit/project/ATE/scripts/install_drivers.sh
```

Script tersebut dua fase: jika kernel < 6.5, ia memasang HWE + `iommu=pt` lalu reboot; setelah kernel ≥ 6.5, ia memasang driver NI, `btipci`, dan venv.

---

## 1. Arsitektur Perangkat Lunak & Driver

Sistem ATE berjalan di **Ubuntu 22.04.5 LTS Server** dengan stack berjenjang sebagai berikut:

```
+-----------------------------------------------------------------------------------+
|                            ATE APPLICATION LAYER (Python 3.10)                    |
|  - Test Sequences / Test Executive                                                |
|  - pyvisa (GPIB / SCPI)     - nidaqmx (DAQ Control)     - btidriver (ARINC 429)  |
+-----------------------------------------------------------------------------------+
|                         C / C++ USER-SPACE RUNTIME LIBRARIES                      |
|  - libvisa.so (NI-VISA)     - libnidaqmx.so (DAQmx)     - libbtiCard.so / libbti429|
+-----------------------------------------------------------------------------------+
|                            SYSTEM SERVICES & DAEMONS                              |
|  - nidevldu.service (Device Loader)                     - nisds.service (Sync)    |
|  - gpibenumsvc.service (GPIB Enumerator)                - nipal / nipxicmsd       |
|  - niroco.service (Route Coordinator)                   - udev (Device Nodes)     |
+-----------------------------------------------------------------------------------+
|                         LINUX KERNEL MODULES (DKMS / DRIVERS)                     |
|  - nipalk.ko (NI Base Driver)   - ni488k.ko (GPIB)     - btipci.ko (Ballard ARINC)|
|  - nistc3rk.ko, niraptrk.ko, nifslk.ko (NI-DAQmx X Series Kernel Stack)          |
+-----------------------------------------------------------------------------------+
|                                 HARDWARE LAYER                                    |
|  - NI PXIe-8821   - NI PXI-GPIB   - Ballard OmniBus II   - NI PXIe-6341 DAQ       |
|  - Keysight N5746A DC Supply      - Keysight AC6803B AC Source                    |
+-----------------------------------------------------------------------------------+
```

Kernel generic HWE 6.8 sudah memadai untuk ATE ini. Jangan ganti ke Ubuntu lowlatency kernel: NI menguji flavor generic, dan seluruh DKMS (`nipalk`, `btipci`, …) harus dikompilasi ulang per flavor.

---

## 2. Dependensi Sistem Operasi

Sebelum memasang driver instrumentasi, sistem memerlukan *build tools*, *kernel headers*, dan *development libraries*. Di Ubuntu 22.04 HWE, compiler default adalah **gcc 11.4**; kernel 6.8 dibangun dengan **gcc-12** (dipakai saat kompilasi `btipci.ko`).

```bash
sudo apt-get update -o Acquire::ForceIPv4=true
sudo apt-get install -y -o Acquire::ForceIPv4=true \
    build-essential \
    gcc-12 \
    linux-headers-$(uname -r) \
    dkms \
    python3-pip \
    python3-venv \
    python3-dev \
    libncurses-dev \
    libusb-1.0-0-dev \
    pkg-config \
    pciutils \
    git \
    curl \
    setserial
```

> [!NOTE]
> Flag `-o Acquire::ForceIPv4=true` mencegah timeout jika routing IPv6 tidak tersedia. Mirror APT host ini diarahkan ke `archive.ubuntu.com` (mirror `biznetgio` sempat putus saat unduhan paket NI).

### 2.1 Kernel HWE 6.8 dan IOMMU

NI Linux Device Drivers 2026 Q3 untuk Ubuntu 22.04 mensyaratkan kernel **minimal 6.5**. Kernel GA 5.15 tidak cukup.

```bash
sudo apt-get install -y linux-generic-hwe-22.04 linux-headers-generic-hwe-22.04
```

Kernel 6.8 mengaktifkan DMA remapping (IOMMU) yang dapat merusak komunikasi NI. Workaround resmi NI: **passthrough**.

```bash
# /etc/default/grub — jangan hapus parameter yang sudah ada
GRUB_CMDLINE_LINUX_DEFAULT="iommu=pt"
sudo update-grub
sudo reboot
```

Setelah boot, `cat /proc/cmdline` harus memuat `iommu=pt`, dan journal kernel menampilkan `iommu: Default domain type: Passthrough`.

---

## 3. Instalasi Driver National Instruments (NI Linux)

Pakai repositori **Ubuntu 22.04 (Jammy)**, bukan 24.04/Noble.

### 3.1 Pemasangan Repositori NI
```bash
sudo dpkg -i "/home/paridit/project/ATE/driver/NILinux2026Q3DeviceDrivers/ni-ubuntu2204-drivers-2026Q3.deb"
sudo apt-get update -o Acquire::ForceIPv4=true
```

### 3.2 Paket Driver yang Wajib Dipasang
| Paket APT | Fungsi Utama | Modul Kernel Terkait |
| :--- | :--- | :--- |
| `ni-daqmx` & `ni-daqmx-mio` | Driver kartu akuisisi data PXIe-6341 | `nistc3rk`, `niraptrk`, `nifslk`, `nisdigk` |
| `libnidaqmx` & `libnidaqmx-devel` | Header C/C++ dan *shared library* `libnidaqmx.so` | - |
| `ni-visa` | API VISA untuk komunikasi SCPI | `NiViPciK` |
| `ni-488.2` | Driver kontroler bus GPIB (Slot 2) | `ni488k` |
| `ni-serial` | Port serial RS-232 controller | `ni843x` |
| `ni-pxiplatformservices` | Manajemen backplane chassis PXIe-1071 | `nipxirmk`, `nipxicmm` |

```bash
sudo apt-get install -y -o Acquire::ForceIPv4=true \
    ni-daqmx \
    ni-daqmx-mio \
    libnidaqmx \
    libnidaqmx-devel \
    ni-visa \
    ni-488.2 \
    ni-serial \
    ni-pxiplatformservices
```

DKMS akan membangun modul untuk kernel aktif (`6.8.0-138-generic`). Proses ini memakan waktu beberapa menit.

### 3.3 Penyesuaian Symlink Library DAQmx
Agar modul Python `nidaqmx` menemukan library C:

```bash
sudo ln -sf /usr/lib/x86_64-linux-gnu/libnidaqmx.so /usr/lib/x86_64-linux-gnu/libnicaiu.so
sudo ldconfig
```

### 3.4 Manajemen Layanan Latar Belakang (Systemd)
Pastikan service berikut aktif:

```bash
sudo systemctl enable --now nidevldu.service
sudo systemctl enable --now nisds.service
sudo systemctl enable --now gpibenumsvc.service
sudo systemctl enable --now nipal.service
sudo systemctl enable --now nipxicmsd.service
sudo systemctl enable --now niroco.service
```

Jika `niroco` gagal saat instalasi pertama (modul `nidimk` belum selesai dimuat), restart setelah DKMS selesai:

```bash
sudo systemctl restart niroco.service
```

---

## 4. Kompilasi & Instalasi Driver Astronics Ballard (ARINC 429)

Driver **OmniBus® II** terdiri dari modul kernel (`btipci.ko`) dan pustaka runtime C (`libbtiCard.so`, `libbti429.so`).

### 4.1 Kompilasi Modul Kernel (`btipci.ko`)
Source ada di `driver/Astronic Ballard/BTIKPCI/`. Makefile Ballard men-set `CC=gcc` (gcc 11 di Jammy), sementara kernel HWE 6.8 dibangun dengan gcc-12 dan membutuhkan flag `-ftrivial-auto-var-init=zero`. **Wajib kompilasi dengan gcc-12:**

```bash
cd "/home/paridit/project/ATE/driver/Astronic Ballard/BTIKPCI"

make clean || true
make CC=gcc-12

sudo install -d "/lib/modules/$(uname -r)/extra"
sudo install -m 0644 release/btipci.ko "/lib/modules/$(uname -r)/extra/"
sudo depmod -a
```

Tanpa `CC=gcc-12`, kompilasi gagal: `gcc: error: unrecognized command-line option '-ftrivial-auto-var-init=zero'`.

### 4.2 Konfigurasi Izin Akses Perangkat (Udev Rule)
```bash
echo 'SUBSYSTEM=="btipci", MODE="0666"' | sudo tee /etc/udev/rules.d/70-btipci.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Node yang terbentuk di host ini: `/dev/bti-pcim.0`, `/dev/bti-pcim.1` (dua core OmniBus II).

### 4.3 Memuat Modul ke Kernel
```bash
sudo modprobe btipci
lsmod | grep btipci
```

### 4.4 Pemasangan Shared Libraries C/C++ (`BTIDriver`)
```bash
cd "/home/paridit/project/ATE/driver/Astronic Ballard/BTIDRIVER/DRIVERINTEL64"
sudo cp -p libbti*.so /usr/local/lib/
sudo cp -p BTIVI.so /usr/local/lib/ || true
sudo cp -p ballard.conf /etc/ballard.conf

echo "/usr/local/lib" | sudo tee /etc/ld.so.conf.d/ballard.conf
sudo ldconfig
```

---

## 5. Konfigurasi Environment Python

Automasi ATE memakai virtual environment `.venv` berbasis **Python 3.10** (interpreter sistem Ubuntu 22.04). Jangan menyalin `.venv` dari mesin Linux Mint (Python 3.12); binary-nya tidak jalan di host ini.

### 5.1 Membuat Virtual Environment
```bash
cd /home/paridit/project/ATE
python3 -m venv .venv
source .venv/bin/activate
```

### 5.2 Memasang Modul Python Inti
```bash
pip install --upgrade pip setuptools wheel
pip install \
    pyvisa \
    pyvisa-py \
    nidaqmx \
    pyserial \
    numpy \
    PyQt6 \
    pyqtgraph
```

### 5.3 Memasang Binding Python Astronics Ballard
```bash
pip install "/home/paridit/project/ATE/driver/Astronic Ballard/BTIDRIVER/Python/btidriver-1.0.0+813415b-py3-none-linux_x86_64.whl"
```

---

## 6. Verifikasi & Pengujian Driver

```bash
source /home/paridit/project/ATE/.venv/bin/activate
python3 /home/paridit/project/ATE/scripts/verify_drivers.py
```

### Kriteria Status Sukses (host `ni-ate`):
- **PCI Scan:** PLX PEX 8725, NI PXIe-6341 (`1093:c4c4` / sub `1093:742a`), NI PXI-GPIB (`1093:c821`), Ballard OmniBus II (`1bd0:1103` × 2).
- **Ballard:** `btipci` dimuat, `Ballard Card 0 Open` = PASS, Core A = PASS.
- **NI-DAQmx:** `Dev1` terdeteksi (`nilsdev` menampilkan `Dev1`).
- **NI-VISA:** `GPIB0::INTFC` aktif. Instrumen Keysight (`GPIB0::5::INSTR`, `GPIB0::7::INSTR`) hanya muncul jika catu daya Keysight menyala.
- **Serial Ports:** port COM controller terdeteksi.

---

## 7. Pemecahan Masalah (Troubleshooting)

### Q1: `nilsdev` atau `nidaqmx` tidak mendeteksi `Dev1`
```bash
sudo systemctl restart nidevldu
dmesg | grep -E "nipalk|nistc3rk|nifslk"
```
Pastikan kernel ≥ 6.5 dan `iommu=pt` aktif. Tanpa passthrough, journal berisi `DMAR: [DMA Read NO_PASID]`.

### Q2: Ballard `CardOpen(0)` menghasilkan `ERR_NOCARD`
```bash
lsmod | grep btipci
sudo modprobe btipci
```
Jika `btipci.ko` belum ada untuk kernel baru, kompilasi ulang dengan `make CC=gcc-12`.

### Q3: PyVISA tidak menemukan `GPIB0::INTFC`
```bash
sudo systemctl restart gpibenumsvc
ls -l /dev/gpib* /dev/nipalk
```

### Q4: Instrumen Keysight tidak tampil di `list_resources()`
Controller `GPIB0::INTFC` bisa PASS meskipun N5746A / AC6803B belum menyala. Nyalakan instrumen, lalu scan ulang `*IDN?`.

### Q5: `niroco.service` core-dump saat boot pertama setelah install
Biasanya race: service start sebelum DKMS `nidimk` selesai. Setelah modul ada di `lsmod`, jalankan `sudo systemctl restart niroco`.
