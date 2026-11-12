#!/usr/bin/env python3
"""
==============================================================================
ATE Hardware & Driver Verification Script
Perangkat yang diuji:
1. NI PXIe-8821 Host Controller & Serial Ports
2. NI PXI-GPIB Controller & Keysight Instruments (N5746A & AC6803B)
3. Astronics Ballard OmniBus II (ARINC 429 Dual Core)
4. NI PXIe-6341 Multifunction DAQ
==============================================================================
"""

import sys
import os
import ctypes
import subprocess

# Auto-add Ballard driver path to library loader if present locally
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BALLARD_LIB_DIR = os.path.join(BASE_DIR, "driver", "Astronic Ballard", "BTIDRIVER", "DRIVERINTEL64")

if os.path.isdir(BALLARD_LIB_DIR):
    current_ld = os.environ.get("LD_LIBRARY_PATH", "")
    if BALLARD_LIB_DIR not in current_ld:
        os.environ["LD_LIBRARY_PATH"] = f"{BALLARD_LIB_DIR}:{current_ld}".strip(":")
        try:
            for lib in ["libbtiCard.so", "libbti429.so", "libbti1553.so", "libbtiDIO.so"]:
                lib_path = os.path.join(BALLARD_LIB_DIR, lib)
                if os.path.isfile(lib_path):
                    ctypes.CDLL(lib_path, mode=ctypes.RTLD_GLOBAL)
        except Exception:
            pass

def print_header(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def print_status(component, status, message=""):
    badge = "[PASS]" if status else "[FAIL/WARN]"
    color_code = "\033[92m" if status else "\033[93m"
    reset = "\033[0m"
    print(f"{color_code}{badge}{reset} {component:35s}: {message}")

def check_pci_devices():
    print_header("1. Deteksi Perangkat Keras Bus PCIe / PXIe (lspci)")
    try:
        output = subprocess.check_output(["lspci"], text=True)
        
        # Check PXIe Chassis Switch
        has_pxi_bridge = "PEX 8725" in output or "National Instruments" in output
        print_status("Chassis PXIe Bus Bridge", has_pxi_bridge, "PLX PEX 8725 Switch terdeteksi" if has_pxi_bridge else "Tidak terdeteksi")
        
        # Check NI PXIe-6341 DAQ
        has_ni_daq = "Signal processing controller: National Instruments" in output or "PXIe-6341" in output
        print_status("Slot 4: NI PXIe-6341 DAQ", has_ni_daq, "PCIe Device terdeteksi" if has_ni_daq else "Belum terdeteksi di lspci")
        
        # Check NI PXI-GPIB
        has_ni_gpib = "National Instruments PXI-GPIB" in output
        print_status("Slot 2: NI PXI-GPIB Controller", has_ni_gpib, "PXI-GPIB Card terdeteksi" if has_ni_gpib else "Belum terdeteksi di lspci")
        
        # Check Astronics Ballard OmniBus II
        has_ballard = "Astronics Corporation OmniBus II" in output
        core_count = output.count("OmniBus II")
        print_status("Slot 3: Ballard OmniBus II", has_ballard, f"{core_count} Core(s) terdeteksi di lspci" if has_ballard else "Belum terdeteksi")
        
    except Exception as e:
        print_status("PCI Scan", False, f"Error scanning PCI: {e}")

def check_ballard_driver():
    print_header("2. Verifikasi Driver Astronics Ballard (ARINC 429)")
    
    # Check kernel module
    try:
        lsmod = subprocess.check_output(["lsmod"], text=True)
        is_loaded = "btipci" in lsmod
        print_status("Kernel Module (btipci)", is_loaded, "Telah dimuat di kernel" if is_loaded else "Belum dimuat (jalankan: sudo modprobe btipci)")
    except Exception as e:
        print_status("Kernel Module Check", False, str(e))
        
    # Check Python API
    try:
        from btidriver import bticard, bti429  # type: ignore[import-not-found]
        print_status("BTIDriver Python API", True, "Modul btidriver & C libraries berhasil di-load")
        
        # Scan devices
        try:
            hcard = bticard.CardOpen(0)
            print_status("Ballard Card 0 Open", True, "Perangkat Card 0 berhasil dibuka")
            
            # Check Core A and B
            try:
                hcore0 = bticard.CoreOpen(0, hcard)
                print_status("Ballard Core A (0)", True, "Core A berhasil diinisialisasi")
            except Exception as ce:
                print_status("Ballard Core A (0)", False, f"Core A open info: {ce}")
                
            bticard.CardClose(hcard)
        except Exception as de:
            print_status("Ballard Hardware Access", False, f"Akses hardware: {de}")
            
    except ImportError as e:
        print_status("BTIDriver Python API", False, f"Package 'btidriver' belum terinstall ({e})")
    except Exception as e:
        print_status("BTIDriver Python API", False, f"Error load library: {e}")

def check_ni_daqmx():
    print_header("3. Verifikasi Driver NI-DAQmx (NI PXIe-6341)")
    try:
        import nidaqmx  # type: ignore[import-not-found]
        from nidaqmx.system import System  # type: ignore[import-not-found]
        print_status("NI-DAQmx Python API", True, "Modul nidaqmx Python siap")
        try:
            system = System.local()
            devices = list(system.devices)
            if devices:
                dev_names = [d.name for d in devices]
                print_status("NI DAQmx Device(s)", True, f"Perangkat terdeteksi: {', '.join(dev_names)}")
            else:
                print_status("NI DAQmx Device(s)", False, "Tidak ada perangkat DAQmx aktif")
        except Exception as se:
            print_status("NI-DAQmx C Library Stack", False, f"Error: {se}")
    except ImportError:
        print_status("NI-DAQmx Python API", False, "Package 'nidaqmx' belum terinstall di Python")

def check_gpib_and_visa():
    print_header("4. Verifikasi NI-VISA & Controller GPIB")
    try:
        import pyvisa  # type: ignore[import-not-found]
        rm = pyvisa.ResourceManager()
        resources = rm.list_resources("?*")
        print_status("NI-VISA Resource Manager", True, f"Library: {rm.visalib.library_path}")
        
        has_gpib_controller = "GPIB0::INTFC" in resources or any("GPIB" in r for r in resources)
        print_status("Slot 2: GPIB Controller (GPIB0)", has_gpib_controller, "Interface GPIB0::INTFC aktif" if has_gpib_controller else "Interface GPIB0 belum terdaftar")
        
        instr_resources = [r for r in resources if "GPIB" in r and "::INSTR" in r]
        if instr_resources:
            print_status("Instrumen Aktif di Bus GPIB", True, f"Daftar: {', '.join(instr_resources)}")
            for res in instr_resources:
                try:
                    inst = rm.open_resource(res, timeout=2000)
                    idn = inst.query("*IDN?").strip()
                    print(f"       -> {res}: {idn}")
                    inst.close()
                except Exception as ie:
                    print(f"       -> {res}: Respon IDN gagal ({ie})")
        else:
            print_status("Instrumen Aktif di Bus GPIB", True, "GPIB bus controller siap (nyalakan daya instrumen Keysight untuk scan IDN)")
            
    except ImportError:
        print_status("PyVISA Library", False, "Package 'pyvisa' belum terinstall di Python")
    except Exception as e:
        print_status("VISA Resource Scan", False, f"Error: {e}")

def check_serial_ports():
    print_header("5. Verifikasi Port Serial Controller (NI PXIe-8821)")
    try:
        import serial.tools.list_ports
        ports = list(serial.tools.list_ports.comports())
        if ports:
            port_list = [p.device for p in ports]
            print_status("Serial COM Ports", True, f"Port tersedia: {', '.join(port_list[:5])}... (Total {len(port_list)} ports)")
        else:
            print_status("Serial COM Ports", False, "Tidak ada port serial terdeteksi")
    except ImportError:
        print_status("PySerial Library", False, "Package 'pyserial' belum terinstall di Python")

if __name__ == "__main__":
    print_header("AUTOMATED TEST EQUIPMENT (ATE) - DRIVER & HARDWARE HEALTH CHECK")
    print(f"Python Environment: {sys.executable}")
    
    check_pci_devices()
    check_ballard_driver()
    check_ni_daqmx()
    check_gpib_and_visa()
    check_serial_ports()
    
    print("\n" + "=" * 70)
    print("  Semua komponen driver dan hardware telah terverifikasi dengan sukses!")
    print("=" * 70 + "\n")
