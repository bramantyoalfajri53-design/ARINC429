#!/usr/bin/env bash
# ==============================================================================
# Automated Test Equipment (ATE) - Driver Installation Script
# Platform: Ubuntu 22.04 (Jammy) / Ubuntu 24.04 (Noble) x86_64
# Hardware: NI PXIe-1071, NI PXIe-8821, NI PXI-GPIB, Ballard OmniBus II, NI PXIe-6341
#
# Two-phase flow:
#   1) Kernel < 6.5  -> install HWE + iommu=pt, schedule this script after reboot
#   2) Kernel >= 6.5 -> install NI + Ballard drivers and rebuild Python venv
# ==============================================================================

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}==============================================================================${NC}"
echo -e "${CYAN}        ATE System - Hardware Drivers & Software Stack Installer              ${NC}"
echo -e "${CYAN}==============================================================================${NC}"

if [ "${EUID}" -ne 0 ]; then
    echo -e "${RED}[ERROR] Script ini harus dijalankan dengan hak akses root (sudo).${NC}"
    echo -e "${YELLOW}Silakan jalankan: sudo bash $0${NC}"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
    REAL_USER="${SUDO_USER}"
else
    REAL_USER="$(stat -c %U "${PROJECT_DIR}")"
fi

LOG_FILE="${ATE_INSTALL_LOG:-/var/log/ate-driver-install.log}"
mkdir -p "$(dirname "${LOG_FILE}")"
exec > >(tee -a "${LOG_FILE}") 2>&1

. /etc/os-release
KERNEL_RELEASE="$(uname -r)"
KERNEL_VERSION="${KERNEL_RELEASE%%-*}"
PENDING_FLAG="/var/lib/ate/pending-driver-install"
ONESHOT_UNIT="/etc/systemd/system/ate-driver-install.service"

echo -e "${BLUE}[INFO] Direktori Proyek ATE:${NC} ${PROJECT_DIR}"
echo -e "${BLUE}[INFO] User runtime:${NC} ${REAL_USER}"
echo -e "${BLUE}[INFO] OS:${NC} ${PRETTY_NAME} (${VERSION_ID})"
echo -e "${BLUE}[INFO] Kernel Linux Aktif:${NC} ${KERNEL_RELEASE}"
echo -e "${BLUE}[INFO] Arsitektur Sistem:${NC} $(uname -m)"
echo -e "${BLUE}[INFO] Log:${NC} ${LOG_FILE}"

APT_BASE_OPTS=(-o Acquire::ForceIPv4=true -o Acquire::Retries=5 -o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30)

run_apt() {
    local attempt=1
    local max_attempts=3
    while true; do
        if apt-get "${APT_BASE_OPTS[@]}" "$@"; then
            return 0
        fi
        if [ "${attempt}" -ge "${max_attempts}" ]; then
            echo -e "${RED}[ERROR] apt-get $* gagal setelah ${max_attempts} percobaan.${NC}"
            return 1
        fi
        attempt=$((attempt + 1))
        echo -e "${YELLOW}[WARN] apt-get gagal, retry ${attempt}/${max_attempts} dalam 15 detik...${NC}"
        sleep 15
        apt-get "${APT_BASE_OPTS[@]}" update || true
    done
}

kernel_meets_ni_min() {
    dpkg --compare-versions "${KERNEL_VERSION}" ge "6.5"
}

ensure_iommu_passthrough() {
    local grub_file="/etc/default/grub"
    echo -e "${BLUE}[INFO] Memastikan parameter kernel iommu=pt (workaround DMA remapping NI)...${NC}"
    if [ ! -f "${grub_file}.ate.bak" ]; then
        cp -a "${grub_file}" "${grub_file}.ate.bak"
    fi
    if grep -qE '^GRUB_CMDLINE_LINUX_DEFAULT=.*iommu=pt' "${grub_file}"; then
        echo -e "${GREEN}[OK] iommu=pt sudah ada di GRUB_CMDLINE_LINUX_DEFAULT.${NC}"
        return 0
    fi
    python3 - <<'PY'
from pathlib import Path
p = Path("/etc/default/grub")
text = p.read_text()
lines = []
updated = False
for line in text.splitlines(keepends=True):
    if line.startswith("GRUB_CMDLINE_LINUX_DEFAULT="):
        prefix, _, rest = line.partition("=")
        quote = rest[:1] if rest[:1] in "'\"" else ""
        value = rest.strip()
        if quote:
            value = value[1:]
            if value.endswith(quote):
                value = value[:-1]
        if "iommu=pt" not in value.split():
            value = (value + " iommu=pt").strip()
        line = f'{prefix}="{value}"\n'
        updated = True
    lines.append(line)
if not updated:
    lines.append('GRUB_CMDLINE_LINUX_DEFAULT="iommu=pt"\n')
p.write_text("".join(lines))
PY
    update-grub
    echo -e "${GREEN}[OK] GRUB diperbarui dengan iommu=pt.${NC}"
}

schedule_post_reboot_install() {
    mkdir -p /var/lib/ate
    date -Is > "${PENDING_FLAG}"
    cat > "${ONESHOT_UNIT}" <<EOF
[Unit]
Description=ATE driver stack install after HWE kernel boot
After=network-online.target
Wants=network-online.target
ConditionPathExists=${PENDING_FLAG}
ConditionKernelVersion=>=6.5

[Service]
Type=oneshot
ExecStart=/bin/bash ${SCRIPT_DIR}/install_drivers.sh
StandardOutput=append:${LOG_FILE}
StandardError=append:${LOG_FILE}
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable ate-driver-install.service
    echo -e "${GREEN}[OK] Instalasi driver dijadwalkan otomatis setelah reboot.${NC}"
}

clear_post_reboot_install() {
    rm -f "${PENDING_FLAG}"
    if systemctl list-unit-files | grep -q '^ate-driver-install.service'; then
        systemctl disable ate-driver-install.service >/dev/null 2>&1 || true
        rm -f "${ONESHOT_UNIT}"
        systemctl daemon-reload || true
    fi
}

# ------------------------------------------------------------------------------
# PHASE 1: Kernel HWE 6.8 + IOMMU passthrough
# ------------------------------------------------------------------------------
if ! kernel_meets_ni_min; then
    echo -e "\n${YELLOW}>>> [Phase 1] Kernel ${KERNEL_VERSION} < 6.5 (syarat NI Linux Device Drivers 2026 Q3).${NC}"
    echo -e "${YELLOW}>>> Menginstall linux-generic-hwe-22.04 dan menyiapkan reboot...${NC}"

    apt-get "${APT_BASE_OPTS[@]}" update || true
    run_apt install -y \
        linux-generic-hwe-22.04 \
        linux-headers-generic-hwe-22.04

    ensure_iommu_passthrough
    schedule_post_reboot_install

    echo -e "\n${GREEN}==============================================================================${NC}"
    echo -e "${GREEN} Kernel HWE terpasang. Sistem akan reboot dalam 8 detik.                      ${NC}"
    echo -e "${GREEN} Setelah boot, installer driver ATE berjalan otomatis.                        ${NC}"
    echo -e "${GREEN} Log: ${LOG_FILE}                                                              ${NC}"
    echo -e "${GREEN}==============================================================================${NC}"
    sleep 8
    reboot
    exit 0
fi

ensure_iommu_passthrough

# ------------------------------------------------------------------------------
# PHASE 2: OS deps + NI + Ballard + Python
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}>>> [1/5] Memperbarui Repositori OS & Menginstall Paket Dependensi...${NC}"
apt-get "${APT_BASE_OPTS[@]}" update || true
run_apt install -y \
    build-essential \
    linux-headers-"$(uname -r)" \
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

echo -e "${GREEN}[OK] Dependensi sistem dasar berhasil terinstall.${NC}"

# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}>>> [2/5] Mengkonfigurasi Repositori & Menginstall Driver National Instruments...${NC}"

case "${VERSION_ID}" in
    22.04) NI_DEB_NAME="ni-ubuntu2204-drivers-2026Q3.deb" ;;
    24.04) NI_DEB_NAME="ni-ubuntu2404-drivers-2026Q3.deb" ;;
    *)
        echo -e "${RED}[ERROR] Ubuntu ${VERSION_ID} tidak didukung script ini (hanya 22.04 / 24.04).${NC}"
        exit 1
        ;;
esac

NI_DEB_PATH="${PROJECT_DIR}/driver/NILinux2026Q3DeviceDrivers/${NI_DEB_NAME}"
if [ ! -f "${NI_DEB_PATH}" ]; then
    echo -e "${RED}[ERROR] File paket NI deb tidak ditemukan di: ${NI_DEB_PATH}${NC}"
    exit 1
fi

echo -e "${BLUE}[INFO] Memasang repositori NI dari:${NC} ${NI_DEB_PATH}"
dpkg -i "${NI_DEB_PATH}" || run_apt install -f -y
apt-get "${APT_BASE_OPTS[@]}" update

echo -e "${BLUE}[INFO] Menginstall paket driver NI (NI-DAQmx, NI-VISA, NI-488.2, NI-Serial, PXI Platform)...${NC}"
run_apt install -y \
    ni-daqmx \
    ni-daqmx-mio \
    libnidaqmx \
    libnidaqmx-devel \
    ni-visa \
    ni-488.2 \
    ni-serial \
    ni-pxiplatformservices

if [ -e /usr/lib/x86_64-linux-gnu/libnidaqmx.so ] && [ ! -e /usr/lib/x86_64-linux-gnu/libnicaiu.so ]; then
    ln -sf /usr/lib/x86_64-linux-gnu/libnidaqmx.so /usr/lib/x86_64-linux-gnu/libnicaiu.so
fi
ldconfig

for svc in nidevldu nisds gpibenumsvc; do
    if systemctl list-unit-files "${svc}.service" >/dev/null 2>&1; then
        systemctl enable --now "${svc}.service" || true
        systemctl restart "${svc}.service" || true
    fi
done
echo -e "${GREEN}[OK] Driver National Instruments selesai dikonfigurasi.${NC}"

# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}>>> [3/5] Mengkompilasi & Memasang Driver Astronics Ballard (BTIKPCI & BTIDriver)...${NC}"

BALLARD_DIR="${PROJECT_DIR}/driver/Astronic Ballard"
BTIKPCI_SRC="${BALLARD_DIR}/BTIKPCI"
BUILD_TMP="/tmp/btikpci_build"

if [ ! -d "${BTIKPCI_SRC}" ]; then
    echo -e "${RED}[ERROR] Direktori source BTIKPCI tidak ditemukan di: ${BTIKPCI_SRC}${NC}"
    exit 1
fi

echo -e "${BLUE}[INFO] Mengkompilasi modul kernel btipci.ko...${NC}"
rm -rf "${BUILD_TMP}"
mkdir -p "${BUILD_TMP}"
cp -a "${BTIKPCI_SRC}/." "${BUILD_TMP}/"
cd "${BUILD_TMP}"
make clean || true
# Kernel HWE 6.8 on Ubuntu 22.04 is built with gcc-12; default gcc is 11.4
if command -v gcc-12 >/dev/null 2>&1; then
    make CC=gcc-12
else
    make
fi

echo -e "${BLUE}[INFO] Memasang btipci.ko ke /lib/modules/$(uname -r)/extra/...${NC}"
install -d "/lib/modules/$(uname -r)/extra"
install -m 0644 "${BUILD_TMP}/release/btipci.ko" "/lib/modules/$(uname -r)/extra/"

echo -e "${BLUE}[INFO] Mengkonfigurasi aturan Udev (/etc/udev/rules.d/70-btipci.rules)...${NC}"
echo 'SUBSYSTEM=="btipci", MODE="0666"' > /etc/udev/rules.d/70-btipci.rules
udevadm control --reload-rules || true
udevadm trigger || true
depmod -a
modprobe btipci || insmod "/lib/modules/$(uname -r)/extra/btipci.ko"
echo -e "${GREEN}[OK] Modul kernel Astronics Ballard (btipci.ko) berhasil dipasang dan dimuat.${NC}"

BTIDRIVER_LIB_DIR="${BALLARD_DIR}/BTIDRIVER/DRIVERINTEL64"
if [ -d "${BTIDRIVER_LIB_DIR}" ]; then
    echo -e "${BLUE}[INFO] Memasang shared libraries BTIDriver ke /usr/local/lib/...${NC}"
    cp -p "${BTIDRIVER_LIB_DIR}"/libbti*.so /usr/local/lib/
    cp -p "${BTIDRIVER_LIB_DIR}/BTIVI.so" /usr/local/lib/ || true
    if [ -f "${BTIDRIVER_LIB_DIR}/ballard.conf" ]; then
        cp -p "${BTIDRIVER_LIB_DIR}/ballard.conf" /etc/ballard.conf
    fi
    echo "/usr/local/lib" > /etc/ld.so.conf.d/ballard.conf
    ldconfig
    echo -e "${GREEN}[OK] Shared libraries BTIDriver (C/C++ API) siap digunakan.${NC}"
fi

# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}>>> [4/5] Menyiapkan Python Virtual Environment & Instrument Binding...${NC}"

VENV_PATH="${PROJECT_DIR}/.venv"
VENV_PY="${VENV_PATH}/bin/python3"
NEED_VENV_REBUILD=0
if [ ! -x "${VENV_PY}" ]; then
    NEED_VENV_REBUILD=1
elif ! sudo -u "${REAL_USER}" "${VENV_PY}" -c "import sys" >/dev/null 2>&1; then
    NEED_VENV_REBUILD=1
fi

if [ "${NEED_VENV_REBUILD}" -eq 1 ]; then
    echo -e "${BLUE}[INFO] Virtualenv lama tidak valid (copy dari mesin lain). Membuat ulang...${NC}"
    rm -rf "${VENV_PATH}"
    sudo -u "${REAL_USER}" python3 -m venv "${VENV_PATH}"
fi

echo -e "${BLUE}[INFO] Menginstall modul Python (pyvisa, nidaqmx, pyserial, PyQt6)...${NC}"
sudo -u "${REAL_USER}" "${VENV_PATH}/bin/pip" install --upgrade pip setuptools wheel
sudo -u "${REAL_USER}" "${VENV_PATH}/bin/pip" install \
    pyvisa \
    pyvisa-py \
    nidaqmx \
    pyserial \
    numpy \
    PyQt6 \
    pyqtgraph \
    fastapi \
    "uvicorn[standard]" \
    itsdangerous \
    python-multipart

BALLARD_WHL="${BALLARD_DIR}/BTIDRIVER/Python/btidriver-1.0.0+813415b-py3-none-linux_x86_64.whl"
if [ ! -f "${BALLARD_WHL}" ]; then
    echo -e "${RED}[ERROR] Wheel BTIDriver tidak ditemukan: ${BALLARD_WHL}${NC}"
    exit 1
fi
sudo -u "${REAL_USER}" "${VENV_PATH}/bin/pip" install "${BALLARD_WHL}"
echo -e "${GREEN}[OK] Package Python instrumen berhasil diinstall.${NC}"

# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}>>> [5/5] Melakukan Verifikasi Deteksi Perangkat Keras...${NC}"
set +e
sudo -u "${REAL_USER}" env \
    LD_LIBRARY_PATH="${BTIDRIVER_LIB_DIR}:/usr/local/lib:${LD_LIBRARY_PATH:-}" \
    "${VENV_PATH}/bin/python3" "${PROJECT_DIR}/scripts/verify_drivers.py"
VERIFY_RC=$?
set -e

clear_post_reboot_install

echo -e "\n${GREEN}==============================================================================${NC}"
if [ "${VERIFY_RC}" -eq 0 ]; then
    echo -e "${GREEN}       Instalasi driver & software stack ATE selesai.                         ${NC}"
else
    echo -e "${YELLOW}       Instalasi selesai, tetapi verifikasi mengembalikan kode ${VERIFY_RC}.   ${NC}"
    echo -e "${YELLOW}       Periksa log: ${LOG_FILE}                                                ${NC}"
fi
echo -e "${GREEN}==============================================================================${NC}"
exit "${VERIFY_RC}"
